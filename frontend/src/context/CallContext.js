'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { Mic, MicOff, Phone, PhoneOff, Users, Volume2, VolumeX } from 'lucide-react';
import { Avatar } from '@/components/ui';
import { getFullName } from '@/lib/format';
import { useChat } from './ChatContext';

/*
 * Audio calls over WebRTC, 1-to-1 and in group chats (up to 8 people, everyone connected to everyone).
 * The voice goes straight between the browsers; the server only passes the set-up messages along
 * on the chat socket (see backend/src/chat/chat.calls.js).
 * Incoming calls ring in every open tab (HRMS and Chat); answering in one stops the others.
 * Whoever joins sends an offer to each person already in the call. A connection that fails (or never
 * connects) is retried with an ICE restart before that person shows as "Couldn't connect".
 *
 * call.status: starting (asking for the mic / the server) -> calling (ringing at the other end)
 *              ringing (incoming) -> connecting -> active
 */
const CallContext = createContext(null);

const CONNECT_TIMEOUT_MS = 30 * 1000;
const MAX_RETRIES = 2;
const MAX_PARTICIPANTS = 8; // same as the server
const SPEAKING_LEVEL = 0.04;

const notificationsAllowed = () => typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted';
const idOf = (user) => String(user?._id || user);
// Without a TURN server only people who can reach each other directly (often: the same network) connect
const hasTurn = (iceServers = []) => iceServers.some((server) => [].concat(server.urls).some((url) => /^turns?:/.test(url)));
const NO_TURN_HINT = 'Calls between different networks need the TURN server, which is not set up on the server yet.';

// Ring tones made in the browser (no sound files). Returns a function that stops it.
function startTone(kind) {
  let context;
  try {
    context = new (window.AudioContext || window.webkitAudioContext)();
  } catch {
    return () => {};
  }
  const parts = kind === 'incoming' ? [[0, 0.3, 660], [0.4, 0.3, 880], [0.8, 0.3, 660]] : [[0, 1.2, 425]];
  const ring = () => {
    const now = context.currentTime;
    parts.forEach(([at, length, frequency]) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, now + at);
      gain.gain.exponentialRampToValueAtTime(0.06, now + at + 0.03);
      gain.gain.setValueAtTime(0.06, now + at + length - 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + at + length);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(now + at);
      oscillator.stop(now + at + length + 0.05);
    });
  };
  ring();
  const timer = setInterval(ring, kind === 'incoming' ? 2500 : 3500);
  return () => {
    clearInterval(timer);
    context.close().catch(() => {});
  };
}

async function getMicrophone() {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Calls need a secure (https) connection to use the microphone');
  }
  try {
    return await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false });
  } catch (error) {
    if (error.name === 'NotAllowedError') throw new Error('Allow microphone access in your browser to make calls');
    if (error.name === 'NotFoundError') throw new Error('No microphone found on this device');
    throw new Error('Could not use your microphone');
  }
}

const clock = (ms) => {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = String(seconds % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
};

// Plays one person's voice (a hidden <audio> per person in the call); muted = "mute for me"
function RemoteAudio({ stream, muted }) {
  const ref = useRef(null);
  useEffect(() => {
    const audio = ref.current;
    if (!audio) return;
    audio.srcObject = stream;
    audio.play().catch(() => {});
  }, [stream]);
  return <audio ref={ref} autoPlay playsInline muted={muted} className="hidden" />;
}

export function CallProvider({ children }) {
  const { enabled, connected, on, emit } = useChat();
  const [call, setCall] = useState(null); // what the call panel shows
  const [streams, setStreams] = useState({}); // userId -> their voice
  const [speaking, setSpeaking] = useState(() => new Set());
  const [silenced, setSilenced] = useState(() => new Set()); // people I muted for myself only
  const [activeCalls, setActiveCalls] = useState({}); // group chats with a call going on: conversationId -> { callId, participants }
  // The live call: { id, conversationId, isGroup, title, caller, direction, iceServers, stream, joined, peers: Map(userId -> peer) }
  const callRef = useRef(null);

  const update = useCallback((changes) => setCall((previous) => (previous ? { ...previous, ...changes } : previous)), []);

  const setParticipant = useCallback((userId, changes) => {
    setCall((previous) => {
      if (!previous) return previous;
      const exists = previous.participants.some((p) => idOf(p.user) === userId);
      const participants = exists
        ? previous.participants.map((p) => (idOf(p.user) === userId ? { ...p, ...changes } : p))
        : [...previous.participants, { state: 'connecting', muted: false, ...changes }];
      return { ...previous, participants };
    });
  }, []);

  const dropPeer = useCallback((current, userId) => {
    const peer = current.peers.get(userId);
    if (peer) {
      clearTimeout(peer.timer);
      peer.pc.close();
      current.peers.delete(userId);
    }
    setStreams(({ [userId]: _gone, ...rest }) => rest);
    setCall((previous) => (previous ? { ...previous, participants: previous.participants.filter((p) => idOf(p.user) !== userId) } : previous));
  }, []);

  // Stops everything of the current call (tone, mic, connections, notification)
  const cleanup = useCallback(() => {
    const current = callRef.current;
    if (!current) return;
    callRef.current = null;
    current.stopTone?.();
    current.notification?.close();
    current.peers.forEach((peer) => {
      clearTimeout(peer.timer);
      peer.pc.close();
    });
    current.stream?.getTracks().forEach((track) => track.stop());
    setStreams({});
    setSilenced(new Set());
    setCall(null);
  }, []);

  const fail = useCallback(
    (message) => {
      const current = callRef.current;
      if (current?.id && current.joined) emit('call:leave', { callId: current.id, reason: 'failed' });
      cleanup();
      toast.error(message);
    },
    [emit, cleanup]
  );

  // Could not reach one person: a 1-to-1 call is over, in a group the others carry on
  const peerFailed = useCallback(
    (current, peer) => {
      const noTurn = !hasTurn(current.iceServers);
      if (!current.isGroup) {
        if (current.startedAt) fail('The call was cut off: the connection was lost');
        else fail(noTurn ? `Could not connect the call. ${NO_TURN_HINT}` : 'Could not connect the call. Your networks may be blocking it, please try again.');
        return;
      }
      clearTimeout(peer.timer);
      peer.pc.close();
      setParticipant(peer.userId, { state: 'failed' });
      if (noTurn && !current.warnedNoTurn) {
        current.warnedNoTurn = true;
        toast.error(`Couldn't connect to ${peer.user?.firstName || 'someone'}. ${NO_TURN_HINT}`, { duration: 8000 });
      }
    },
    [fail, setParticipant]
  );

  // A connection failed or did not come up in time: try again (ICE restart) before giving up.
  // Only the side that sent the offer restarts; the other side waits for the new offer.
  const troubleRef = useRef(null);
  const armTimer = (current, peer) => {
    clearTimeout(peer.timer);
    peer.timer = setTimeout(() => {
      if (callRef.current === current && current.peers.get(peer.userId) === peer && !peer.connected) troubleRef.current(current, peer);
    }, CONNECT_TIMEOUT_MS);
  };
  troubleRef.current = async (current, peer) => {
    if (peer.attempts >= MAX_RETRIES) {
      peerFailed(current, peer);
      return;
    }
    peer.attempts += 1;
    peer.connected = false;
    setParticipant(peer.userId, { state: 'reconnecting' });
    armTimer(current, peer);
    if (!peer.offerer) return;
    try {
      peer.pc.restartIce?.();
      await peer.pc.setLocalDescription(await peer.pc.createOffer({ iceRestart: true }));
      emit('call:signal', { callId: current.id, to: peer.userId, data: { description: peer.pc.localDescription.toJSON() } });
    } catch {
      /* the timer will try again or give up */
    }
  };

  const addPeer = useCallback(
    (current, user) => {
      const userId = idOf(user);
      if (current.peers.has(userId)) return current.peers.get(userId);
      const pc = new RTCPeerConnection({ iceServers: current.iceServers || [] });
      current.stream.getTracks().forEach((track) => pc.addTrack(track, current.stream));
      const peer = { userId, user, pc, pendingCandidates: [], connected: false, offerer: false, attempts: 0 };
      pc.onicecandidate = (event) => {
        if (event.candidate) emit('call:signal', { callId: current.id, to: userId, data: { candidate: event.candidate.toJSON() } });
      };
      pc.ontrack = (event) => setStreams((previous) => ({ ...previous, [userId]: event.streams[0] }));
      pc.onconnectionstatechange = () => {
        if (callRef.current !== current || current.peers.get(userId) !== peer) return;
        const state = pc.connectionState;
        if (state === 'connected') {
          clearTimeout(peer.timer);
          peer.connected = true;
          current.startedAt = current.startedAt || Date.now();
          update({ status: 'active', startedAt: current.startedAt });
          setParticipant(userId, { state: 'connected' });
        } else if (state === 'disconnected') {
          setParticipant(userId, { state: 'reconnecting' });
        } else if (state === 'failed') {
          troubleRef.current(current, peer);
        }
      };
      // Never connected in time: try again, then give up (usually two networks that need the TURN server)
      armTimer(current, peer);
      current.peers.set(userId, peer);
      setParticipant(userId, { user, state: 'connecting' });
      return peer;
    },
    [emit, update, setParticipant]
  );

  // Answer a ringing call / join a group call: send an offer to everyone already in
  const join = useCallback(
    async (current) => {
      if (current.accepting) return;
      current.accepting = true;
      current.stopTone?.();
      current.notification?.close();
      update({ status: 'connecting' });
      try {
        current.stream = current.stream || (await getMicrophone());
        if (callRef.current !== current) {
          current.stream.getTracks().forEach((track) => track.stop());
          return;
        }
        const res = await emit('call:accept', { callId: current.id }, { ack: true });
        if (res?.error) throw new Error(res.error);
        if (callRef.current !== current) {
          emit('call:leave', { callId: current.id });
          return;
        }
        current.joined = true;
        current.iceServers = res.iceServers || current.iceServers;
        if (!hasTurn(current.iceServers)) console.warn(`[calls] ${NO_TURN_HINT}`);
        // People who joined after me while my answer was on its way: they send me their offer
        (current.pendingJoined || []).forEach((user) => addPeer(current, user));
        update({ canModerate: Boolean(res.canModerate) });
        if (!res.participants.length) update({ status: 'calling' });
        await Promise.all(
          res.participants.map(async ({ user, muted }) => {
            const peer = addPeer(current, user);
            const { pc } = peer;
            peer.offerer = true;
            setParticipant(idOf(user), { muted });
            await pc.setLocalDescription(await pc.createOffer());
            emit('call:signal', { callId: current.id, to: idOf(user), data: { description: pc.localDescription.toJSON() } });
          })
        );
      } catch (error) {
        if (callRef.current === current) {
          if (current.joined) emit('call:leave', { callId: current.id });
          else emit('call:reject', { callId: current.id });
          cleanup();
        }
        toast.error(error.message || 'Could not join the call');
      }
    },
    [emit, update, addPeer, setParticipant, cleanup]
  );

  // Call from a chat: { conversationId, isGroup, title, peer (1-to-1) }.
  // In a group that already has a call going on, this joins it.
  const startCall = useCallback(
    async ({ conversationId, isGroup, title, peer }) => {
      if (!enabled) return;
      if (callRef.current) {
        toast.error('You are already on a call');
        return;
      }
      const current = { id: null, conversationId, isGroup, title, caller: null, direction: 'out', joined: false, peers: new Map() };
      callRef.current = current;
      setCall({ id: null, isGroup, title, peer, direction: 'out', status: 'starting', muted: false, participants: [] });
      try {
        current.stream = await getMicrophone();
        if (callRef.current !== current) throw new Error(''); // hung up meanwhile
        const res = await emit('call:start', { conversationId }, { ack: true });
        if (res?.error) throw new Error(res.error);
        current.id = res.callId;
        if (res.existing) {
          current.direction = 'in';
          update({ id: res.callId, direction: 'in' });
          await join(current);
          return;
        }
        current.iceServers = res.iceServers;
        current.joined = true;
        if (!hasTurn(current.iceServers)) console.warn(`[calls] ${NO_TURN_HINT}`);
        // Hung up while the server was setting it up
        if (callRef.current !== current) {
          emit('call:leave', { callId: res.callId });
          return;
        }
        current.stopTone = startTone('outgoing');
        update({ id: res.callId, status: 'calling', canModerate: Boolean(res.canModerate) });
      } catch (error) {
        current.stream?.getTracks().forEach((track) => track.stop());
        if (callRef.current === current) {
          callRef.current = null;
          setCall(null);
        }
        if (error.message) toast.error(error.message);
      }
    },
    [enabled, emit, update, join]
  );

  const accept = useCallback(() => {
    const current = callRef.current;
    if (current && current.direction === 'in' && !current.joined) join(current);
  }, [join]);

  const hangUp = useCallback(() => {
    const current = callRef.current;
    if (!current) return;
    if (current.id) {
      if (current.joined) emit('call:leave', { callId: current.id });
      else if (current.direction === 'in' && !current.accepting) emit('call:reject', { callId: current.id });
      else if (current.direction === 'in') emit('call:leave', { callId: current.id });
    }
    cleanup();
  }, [emit, cleanup]);

  const setMicOn = useCallback(
    (on) => {
      const current = callRef.current;
      const track = current?.stream?.getAudioTracks()[0];
      if (!track || track.enabled === on) return;
      track.enabled = on;
      update({ muted: !on });
      if (current.joined) emit('call:mute', { callId: current.id, muted: !on });
    },
    [emit, update]
  );
  const toggleMute = useCallback(() => setMicOn(!callRef.current?.stream?.getAudioTracks()[0]?.enabled), [setMicOn]);

  // Stop hearing someone; only for me, the others still hear them
  const toggleSilenced = useCallback((userId) => {
    setSilenced((previous) => {
      const next = new Set(previous);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }, []);

  // Group admins / whoever started the call: turn someone's mic off (they can turn it back on)
  const muteForEveryone = useCallback(
    async (userId) => {
      const current = callRef.current;
      if (!current?.joined) return;
      try {
        const res = await emit('call:mute-request', { callId: current.id, userId }, { ack: true });
        if (res?.error) throw new Error(res.error);
      } catch (error) {
        toast.error(error.message || 'Could not mute them');
      }
    },
    [emit]
  );

  useEffect(() => {
    if (!enabled) return undefined;
    const isMine = (callId) => callRef.current && callRef.current.id === callId;
    const offs = [
      on('call:incoming', ({ callId, conversationId, isGroup, groupName, from, iceServers }) => {
        if (callRef.current) return; // already on a call (or being rung): let it ring out
        const title = isGroup ? groupName : getFullName(from);
        const current = { id: callId, conversationId, isGroup, title, caller: from, direction: 'in', iceServers, joined: false, peers: new Map() };
        callRef.current = current;
        current.stopTone = startTone('incoming');
        if (document.visibilityState !== 'visible' && notificationsAllowed()) {
          const heading = isGroup ? `${getFullName(from)} is calling ${groupName}` : `Incoming call from ${getFullName(from)}`;
          current.notification = new Notification(heading, { body: isGroup ? 'Group audio call' : 'Audio call', tag: `call-${callId}`, requireInteraction: true });
          current.notification.onclick = () => {
            window.focus();
            current.notification.close();
          };
        }
        setCall({ id: callId, isGroup, title, peer: isGroup ? null : from, caller: from, direction: 'in', status: 'ringing', muted: false, participants: [] });
      }),

      // Someone joined my call: they will send me an offer
      on('call:joined', ({ callId, user }) => {
        const current = callRef.current;
        if (!isMine(callId)) return;
        if (!current.joined) {
          if (current.accepting) (current.pendingJoined ||= []).push(user);
          return;
        }
        current.stopTone?.();
        current.stopTone = null;
        if (!current.startedAt) update({ status: 'connecting' });
        addPeer(current, user);
        if (current.isGroup && current.startedAt) toast(`${user.firstName} joined the call`, { icon: '📞' });
      }),

      on('call:left', ({ callId, userId }) => {
        const current = callRef.current;
        if (!isMine(callId)) return;
        const name = current.peers.get(userId)?.user?.firstName;
        dropPeer(current, userId);
        if (name) toast(`${name} left the call`, { icon: '👋' });
        if (!current.peers.size) update({ status: 'calling', startedAt: current.startedAt });
      }),

      on('call:muted', ({ callId, userId, muted }) => {
        if (isMine(callId)) setParticipant(userId, { muted });
      }),

      on('call:muted-by', ({ callId, by }) => {
        if (!isMine(callId)) return;
        setMicOn(false);
        toast(`${by.firstName} muted you. Unmute when you want to speak.`, { icon: '🔇', duration: 6000 });
      }),

      on('call:signal', async ({ callId, from, data }) => {
        const current = callRef.current;
        if (!isMine(callId) || !current.joined) return;
        const peer = current.peers.get(from);
        if (!peer) return;
        const { pc } = peer;
        try {
          if (data.description) {
            await pc.setRemoteDescription(data.description);
            for (const candidate of peer.pendingCandidates.splice(0)) await pc.addIceCandidate(candidate);
            if (data.description.type === 'offer') {
              await pc.setLocalDescription(await pc.createAnswer());
              emit('call:signal', { callId, to: from, data: { description: pc.localDescription.toJSON() } });
            }
          } else if (data.candidate) {
            if (pc.remoteDescription) await pc.addIceCandidate(data.candidate);
            else peer.pendingCandidates.push(data.candidate);
          }
        } catch {
          /* a candidate that does not fit, the others still can */
        }
      }),

      on('call:ended', ({ callId, reason }) => {
        const current = callRef.current;
        if (!isMine(callId)) return;
        const wasActive = Boolean(current.startedAt);
        cleanup();
        if (reason === 'answered-elsewhere') return;
        const name = current.isGroup ? current.title : current.title?.split(' ')[0] || 'They';
        if (current.direction === 'out' && reason === 'declined') toast(`${name} declined the call`, { icon: '📵' });
        else if (current.direction === 'out' && reason === 'missed') toast(current.isGroup ? 'Nobody joined the call' : `${name} didn't answer`, { icon: '📵' });
        else if (current.direction === 'in' && reason === 'missed' && !current.joined) {
          toast(current.isGroup ? `Missed group call in ${current.title}` : `Missed call from ${current.title}`, { icon: '📵' });
        } else if (reason === 'failed') toast.error('The call was cut off: the connection was lost');
        else if (wasActive) toast('Call ended', { icon: '📞' });
      }),

      on('call:status', ({ conversationId, callId, active, participants }) =>
        setActiveCalls((previous) => {
          const next = { ...previous };
          if (active) next[conversationId] = { callId, participants };
          else delete next[conversationId];
          return next;
        })
      ),
    ];
    return () => offs.forEach((off) => off());
  }, [enabled, on, emit, update, addPeer, dropPeer, setParticipant, setMicOn, cleanup]);

  // Lost the chat connection: the server has already taken us out of the call
  useEffect(() => {
    if (connected) return;
    setActiveCalls({}); // the server sends them again on reconnect
    if (callRef.current) {
      cleanup();
      toast.error('Call dropped: you lost your connection');
    }
  }, [connected, cleanup]);

  // Who is talking right now (a ring around their picture)
  useEffect(() => {
    const entries = Object.entries(streams);
    if (!entries.length) {
      setSpeaking((previous) => (previous.size ? new Set() : previous));
      return undefined;
    }
    let context;
    try {
      context = new (window.AudioContext || window.webkitAudioContext)();
    } catch {
      return undefined;
    }
    const meters = entries.map(([userId, stream]) => {
      const analyser = context.createAnalyser();
      analyser.fftSize = 512;
      context.createMediaStreamSource(stream).connect(analyser);
      return { userId, analyser, data: new Uint8Array(analyser.fftSize) };
    });
    const timer = setInterval(() => {
      const now = new Set();
      meters.forEach(({ userId, analyser, data }) => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (const value of data) sum += ((value - 128) / 128) ** 2;
        if (Math.sqrt(sum / data.length) > SPEAKING_LEVEL) now.add(userId);
      });
      setSpeaking((previous) => (previous.size === now.size && [...now].every((id) => previous.has(id)) ? previous : now));
    }, 300);
    return () => {
      clearInterval(timer);
      context.close().catch(() => {});
    };
  }, [streams]);

  // Leaving the page ends the call cleanly
  useEffect(() => cleanup, [cleanup]);

  const value = useMemo(() => ({ call, startCall, activeCalls, maxParticipants: MAX_PARTICIPANTS }), [call, startCall, activeCalls]);

  return (
    <CallContext.Provider value={value}>
      {children}
      {Object.entries(streams).map(([userId, stream]) => (
        <RemoteAudio key={userId} stream={stream} muted={silenced.has(userId)} />
      ))}
      {call && (
        <CallPanel
          call={call}
          speaking={speaking}
          silenced={silenced}
          onAccept={accept}
          onHangUp={hangUp}
          onToggleMute={toggleMute}
          onToggleSilenced={toggleSilenced}
          onMuteForEveryone={muteForEveryone}
        />
      )}
    </CallContext.Provider>
  );
}

const PARTICIPANT_STATE = { connecting: 'Connecting…', reconnecting: 'Reconnecting…', failed: "Couldn't connect" };

function CallPanel({ call, speaking, silenced, onAccept, onHangUp, onToggleMute, onToggleSilenced, onMuteForEveryone }) {
  const [, tick] = useState(0);
  useEffect(() => {
    if (call.status !== 'active') return undefined;
    const timer = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(timer);
  }, [call.status]);

  const ringing = call.direction === 'in' && call.status === 'ringing';
  const reconnecting = call.participants.some((p) => p.state === 'reconnecting');
  let status = {
    starting: 'Starting…',
    calling: call.isGroup ? (call.startedAt ? 'Waiting for others…' : 'Calling the group…') : 'Ringing…',
    ringing: call.isGroup ? `${call.caller?.firstName} is calling` : 'Incoming audio call',
    connecting: 'Connecting…',
  }[call.status];
  if (call.status === 'active') {
    status = clock(Date.now() - call.startedAt);
    if (call.isGroup) status += ` · ${call.participants.length + 1} people`;
    else if (reconnecting) status = 'Reconnecting…';
  }

  const roundButton = 'flex h-12 w-12 items-center justify-center rounded-full text-white shadow-md transition focus:outline-none focus-visible:ring-4';
  const onePeer = !call.isGroup && (call.participants[0]?.user || call.peer);

  return (
    <div
      role="dialog"
      aria-label={`Audio call: ${call.title}`}
      className="fixed inset-x-3 bottom-3 z-[60] rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl sm:inset-x-auto sm:right-5 sm:bottom-5 sm:w-80"
    >
      <div className="flex items-center gap-3">
        <div className={ringing || call.status === 'calling' ? 'animate-pulse' : undefined}>
          {call.isGroup ? (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 text-brand-700">
              <Users className="h-5 w-5" />
            </div>
          ) : (
            <div className={clsx('rounded-full', onePeer && speaking.has(idOf(onePeer)) && 'ring-2 ring-emerald-500 ring-offset-2')}>
              <Avatar name={getFullName(onePeer)} src={onePeer?.avatar} size="md" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-slate-900">{call.title}</p>
          <p className={!call.isGroup && reconnecting ? 'text-sm text-amber-600' : 'text-sm text-slate-500'} aria-live="polite">
            {status}
          </p>
        </div>
      </div>

      {call.isGroup && call.participants.length > 0 && (
        <ul className="mt-3 max-h-52 space-y-1 overflow-y-auto border-t border-slate-100 pt-3">
          {call.participants.map(({ user, state, muted }) => {
            const userId = idOf(user);
            const name = getFullName(user);
            const quiet = silenced.has(userId);
            return (
              <li key={userId} className="flex items-center gap-2 text-sm">
                <div className={clsx('rounded-full', speaking.has(userId) && !quiet && 'ring-2 ring-emerald-500 ring-offset-1')}>
                  <Avatar name={name} src={user.avatar} size="sm" />
                </div>
                <span className="min-w-0 flex-1 truncate text-slate-700">{name}</span>
                {PARTICIPANT_STATE[state] && <span className={clsx('text-xs', state === 'failed' ? 'text-red-500' : 'text-amber-600')}>{PARTICIPANT_STATE[state]}</span>}
                {call.canModerate && !muted ? (
                  <button
                    onClick={() => onMuteForEveryone(userId)}
                    aria-label={`Mute ${name} for everyone`}
                    title="Mute for everyone"
                    className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  >
                    <Mic className="h-3.5 w-3.5" />
                  </button>
                ) : (
                  <span className={clsx('p-1', !muted && 'invisible')} title={muted ? 'Muted' : undefined}>
                    <MicOff className="h-3.5 w-3.5 text-slate-400" />
                  </span>
                )}
                <button
                  onClick={() => onToggleSilenced(userId)}
                  aria-label={quiet ? `Hear ${name} again` : `Stop hearing ${name} (only for you)`}
                  title={quiet ? 'Hear them again' : 'Mute for me'}
                  className={clsx('rounded-md p-1 hover:bg-slate-100', quiet ? 'text-amber-600' : 'text-slate-400 hover:text-slate-700')}
                >
                  {quiet ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-4 flex items-center justify-center gap-6">
        {ringing ? (
          <>
            <button onClick={onHangUp} aria-label="Decline" title="Decline" className={`${roundButton} bg-red-600 hover:bg-red-700 focus-visible:ring-red-500/30`}>
              <PhoneOff className="h-5 w-5" />
            </button>
            <button onClick={onAccept} aria-label={call.isGroup ? 'Join' : 'Answer'} title={call.isGroup ? 'Join' : 'Answer'} className={`${roundButton} bg-emerald-600 hover:bg-emerald-700 focus-visible:ring-emerald-500/30`}>
              <Phone className="h-5 w-5" />
            </button>
          </>
        ) : (
          <>
            <button
              onClick={onToggleMute}
              disabled={call.status === 'starting'}
              aria-label={call.muted ? 'Unmute' : 'Mute'}
              title={call.muted ? 'Unmute' : 'Mute'}
              className={`${roundButton} ${call.muted ? 'bg-amber-500 hover:bg-amber-600' : 'bg-slate-500 hover:bg-slate-600'} focus-visible:ring-slate-400/30 disabled:opacity-50`}
            >
              {call.muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </button>
            <button
              onClick={onHangUp}
              aria-label={call.isGroup ? 'Leave call' : 'End call'}
              title={call.isGroup ? 'Leave call' : 'End call'}
              className={`${roundButton} bg-red-600 hover:bg-red-700 focus-visible:ring-red-500/30`}
            >
              <PhoneOff className="h-5 w-5" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export function useCall() {
  const context = useContext(CallContext);
  if (!context) throw new Error('useCall must be used inside <CallProvider>');
  return context;
}
