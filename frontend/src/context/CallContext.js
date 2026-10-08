'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Mic, MicOff, Phone, PhoneOff } from 'lucide-react';
import { Avatar } from '@/components/ui';
import { getFullName } from '@/lib/format';
import { useChat } from './ChatContext';

/*
 * 1-to-1 audio calls over WebRTC: the voice goes straight between the two browsers, the server only
 * passes the set-up messages along on the chat socket (see backend/src/chat/chat.calls.js).
 * Incoming calls ring in every open tab (HRMS and Chat); answering in one stops the others.
 *
 * call.status: starting (asking for the mic / the server) -> calling (ringing at the other end)
 *              ringing (incoming) -> connecting -> active
 */
const CallContext = createContext(null);

const CONNECT_TIMEOUT_MS = 25 * 1000;

const notificationsAllowed = () => typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted';

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

export function CallProvider({ children }) {
  const { enabled, connected, on, emit } = useChat();
  const [call, setCall] = useState(null); // what the call panel shows
  const callRef = useRef(null); // the live call: { id, peer, direction, iceServers, stream, pc, pendingCandidates, ... }
  const audioRef = useRef(null);

  const update = useCallback((changes) => setCall((previous) => (previous ? { ...previous, ...changes } : previous)), []);

  // Stops everything of the current call (tone, mic, connection, notification)
  const cleanup = useCallback(() => {
    const current = callRef.current;
    if (!current) return;
    callRef.current = null;
    current.stopTone?.();
    current.notification?.close();
    clearTimeout(current.connectTimer);
    current.pc?.close();
    current.stream?.getTracks().forEach((track) => track.stop());
    if (audioRef.current) audioRef.current.srcObject = null;
    setCall(null);
  }, []);

  const fail = useCallback(
    (message) => {
      const current = callRef.current;
      if (current?.id) emit('call:end', { callId: current.id, reason: 'failed' });
      cleanup();
      toast.error(message);
    },
    [emit, cleanup]
  );

  const createPeer = useCallback(
    (current) => {
      const pc = new RTCPeerConnection({ iceServers: current.iceServers || [] });
      current.stream.getTracks().forEach((track) => pc.addTrack(track, current.stream));
      pc.onicecandidate = (event) => {
        if (event.candidate) emit('call:signal', { callId: current.id, data: { candidate: event.candidate.toJSON() } });
      };
      pc.ontrack = (event) => {
        if (!audioRef.current) return;
        audioRef.current.srcObject = event.streams[0];
        audioRef.current.play().catch(() => {});
      };
      pc.onconnectionstatechange = () => {
        if (callRef.current !== current) return;
        const state = pc.connectionState;
        if (state === 'connected') {
          clearTimeout(current.connectTimer);
          current.startedAt = current.startedAt || Date.now();
          update({ status: 'active', startedAt: current.startedAt, reconnecting: false });
        } else if (state === 'disconnected') {
          update({ reconnecting: true });
        } else if (state === 'failed') {
          fail('The call was cut off: the connection between you two was lost');
        }
      };
      // Never connected: usually two networks that need a TURN server (see backend .env.example)
      current.connectTimer = setTimeout(() => {
        if (callRef.current === current && !current.startedAt) fail('Could not connect the call. Your networks may be blocking it, please try again.');
      }, CONNECT_TIMEOUT_MS);
      current.pc = pc;
      current.pendingCandidates = [];
      return pc;
    },
    [emit, update, fail]
  );

  // Outgoing: conversationId of a 1-to-1 chat, peer = the other member (for the panel)
  const startCall = useCallback(
    async (conversationId, peer) => {
      if (!enabled) return;
      if (callRef.current) {
        toast.error('You are already on a call');
        return;
      }
      const current = { id: null, conversationId, peer, direction: 'out' };
      callRef.current = current;
      setCall({ id: null, peer, direction: 'out', status: 'starting', muted: false });
      try {
        current.stream = await getMicrophone();
        if (callRef.current !== current) throw new Error(''); // hung up meanwhile
        const res = await emit('call:start', { conversationId }, { ack: true });
        if (res?.error) throw new Error(res.error);
        current.id = res.callId;
        current.iceServers = res.iceServers;
        // Hung up while the server was setting it up
        if (callRef.current !== current) {
          emit('call:end', { callId: res.callId });
          return;
        }
        current.stopTone = startTone('outgoing');
        update({ id: res.callId, status: 'calling' });
      } catch (error) {
        current.stream?.getTracks().forEach((track) => track.stop());
        if (callRef.current === current) {
          callRef.current = null;
          setCall(null);
        }
        if (error.message) toast.error(error.message);
      }
    },
    [enabled, emit, update]
  );

  const accept = useCallback(async () => {
    const current = callRef.current;
    if (!current || current.direction !== 'in' || current.accepting) return;
    current.accepting = true;
    current.stopTone?.();
    current.notification?.close();
    update({ status: 'connecting' });
    try {
      current.stream = await getMicrophone();
      if (callRef.current !== current) return;
      createPeer(current);
      const res = await emit('call:accept', { callId: current.id }, { ack: true });
      if (res?.error) throw new Error(res.error);
    } catch (error) {
      if (callRef.current === current) {
        emit('call:reject', { callId: current.id });
        cleanup();
      }
      toast.error(error.message);
    }
  }, [emit, update, createPeer, cleanup]);

  const hangUp = useCallback(() => {
    const current = callRef.current;
    if (!current) return;
    if (current.id) emit(current.direction === 'in' && !current.accepting ? 'call:reject' : 'call:end', { callId: current.id });
    cleanup();
  }, [emit, cleanup]);

  const toggleMute = useCallback(() => {
    const track = callRef.current?.stream?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    update({ muted: !track.enabled });
  }, [update]);

  useEffect(() => {
    if (!enabled) return undefined;
    const offs = [
      on('call:incoming', ({ callId, conversationId, from, iceServers }) => {
        if (callRef.current) return; // the server already says "busy", this is just in case
        const current = { id: callId, conversationId, peer: from, direction: 'in', iceServers };
        callRef.current = current;
        current.stopTone = startTone('incoming');
        if (document.visibilityState !== 'visible' && notificationsAllowed()) {
          current.notification = new Notification(`Incoming call from ${getFullName(from)}`, { body: 'Audio call', tag: `call-${callId}`, requireInteraction: true });
          current.notification.onclick = () => {
            window.focus();
            current.notification.close();
          };
        }
        setCall({ id: callId, peer: from, direction: 'in', status: 'ringing', muted: false });
      }),

      // The other person answered: send them our offer
      on('call:accepted', async ({ callId }) => {
        const current = callRef.current;
        if (!current || current.id !== callId || current.direction !== 'out') return;
        current.stopTone?.();
        update({ status: 'connecting' });
        try {
          const pc = createPeer(current);
          await pc.setLocalDescription(await pc.createOffer());
          emit('call:signal', { callId, data: { description: pc.localDescription.toJSON() } });
        } catch {
          fail('Could not start the call, please try again');
        }
      }),

      on('call:signal', async ({ callId, data }) => {
        const current = callRef.current;
        const pc = current?.pc;
        if (!pc || current.id !== callId) return;
        try {
          if (data.description) {
            await pc.setRemoteDescription(data.description);
            for (const candidate of current.pendingCandidates.splice(0)) await pc.addIceCandidate(candidate);
            if (data.description.type === 'offer') {
              await pc.setLocalDescription(await pc.createAnswer());
              emit('call:signal', { callId, data: { description: pc.localDescription.toJSON() } });
            }
          } else if (data.candidate) {
            if (pc.remoteDescription) await pc.addIceCandidate(data.candidate);
            else current.pendingCandidates.push(data.candidate);
          }
        } catch {
          /* a candidate that does not fit, the others still can */
        }
      }),

      on('call:ended', ({ callId, reason }) => {
        const current = callRef.current;
        if (!current || current.id !== callId) return;
        const name = current.peer?.firstName || 'They';
        const wasActive = Boolean(current.startedAt);
        cleanup();
        if (reason === 'answered-elsewhere') return;
        if (current.direction === 'out' && reason === 'declined') toast(`${name} declined the call`, { icon: '📵' });
        else if (current.direction === 'out' && reason === 'missed') toast(`${name} didn't answer`, { icon: '📵' });
        else if (current.direction === 'in' && reason === 'missed') toast(`Missed call from ${getFullName(current.peer)}`, { icon: '📵' });
        else if (reason === 'failed') toast.error('The call was cut off: the connection was lost');
        else if (wasActive) toast('Call ended', { icon: '📞' });
      }),
    ];
    return () => offs.forEach((off) => off());
  }, [enabled, on, emit, update, createPeer, cleanup, fail]);

  // Lost the chat connection: the server has already ended the call
  useEffect(() => {
    if (!connected && callRef.current) {
      cleanup();
      toast.error('Call dropped: you lost your connection');
    }
  }, [connected, cleanup]);

  // Leaving the page ends the call cleanly
  useEffect(() => cleanup, [cleanup]);

  const value = useMemo(() => ({ call, startCall }), [call, startCall]);

  return (
    <CallContext.Provider value={value}>
      {children}
      <audio ref={audioRef} autoPlay playsInline className="hidden" />
      {call && <CallPanel call={call} onAccept={accept} onHangUp={hangUp} onToggleMute={toggleMute} />}
    </CallContext.Provider>
  );
}

function CallPanel({ call, onAccept, onHangUp, onToggleMute }) {
  const [, tick] = useState(0);
  useEffect(() => {
    if (call.status !== 'active') return undefined;
    const timer = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(timer);
  }, [call.status]);

  const ringing = call.direction === 'in' && call.status === 'ringing';
  let status = {
    starting: 'Starting…',
    calling: 'Ringing…',
    ringing: 'Incoming audio call',
    connecting: 'Connecting…',
  }[call.status];
  if (call.status === 'active') status = call.reconnecting ? 'Reconnecting…' : clock(Date.now() - call.startedAt);

  const roundButton = 'flex h-12 w-12 items-center justify-center rounded-full text-white shadow-md transition focus:outline-none focus-visible:ring-4';

  return (
    <div
      role="dialog"
      aria-label={`Audio call with ${getFullName(call.peer)}`}
      className="fixed inset-x-3 bottom-3 z-[60] rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl sm:inset-x-auto sm:right-5 sm:bottom-5 sm:w-80"
    >
      <div className="flex items-center gap-3">
        <div className={ringing || call.status === 'calling' ? 'animate-pulse' : undefined}>
          <Avatar name={getFullName(call.peer)} src={call.peer?.avatar} size="md" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-slate-900">{getFullName(call.peer)}</p>
          <p className={call.reconnecting ? 'text-sm text-amber-600' : 'text-sm text-slate-500'} aria-live="polite">
            {status}
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-center gap-6">
        {ringing ? (
          <>
            <button onClick={onHangUp} aria-label="Decline" title="Decline" className={`${roundButton} bg-red-600 hover:bg-red-700 focus-visible:ring-red-500/30`}>
              <PhoneOff className="h-5 w-5" />
            </button>
            <button onClick={onAccept} aria-label="Answer" title="Answer" className={`${roundButton} bg-emerald-600 hover:bg-emerald-700 focus-visible:ring-emerald-500/30`}>
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
            <button onClick={onHangUp} aria-label="End call" title="End call" className={`${roundButton} bg-red-600 hover:bg-red-700 focus-visible:ring-red-500/30`}>
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
