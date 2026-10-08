import crypto from 'crypto';
import { env } from '../config/env.js';
import { User } from '../models/index.js';
import { Conversation, Message } from './chat.model.js';

/*
 * 1-to-1 audio calls (WebRTC). The voice goes straight between the two browsers;
 * this server only passes the set-up messages along ("signaling") over the chat socket:
 *   caller -> call:start { conversationId }      callee (all tabs) <- call:incoming
 *   callee -> call:accept { callId }             caller <- call:accepted, callee's other tabs <- call:ended (answered-elsewhere)
 *   callee -> call:reject / either -> call:end   both <- call:ended { reason }
 *   either -> call:signal { callId, data }       the other side's tab <- call:signal (offer / answer / ICE candidates)
 * Every call leaves a line in the chat ("Missed audio call from …", "Audio call · 3:12").
 *
 * Calls are kept in memory, like presence: fine while the API runs as one server.
 */

const RING_TIMEOUT_MS = 45 * 1000;
const MAX_SIGNAL_CHARS = 32 * 1024; // an SDP offer is a few KB
const TURN_CREDENTIAL_TTL_S = 12 * 60 * 60;
const USER_SELECT = 'firstName lastName avatar';

const calls = new Map(); // callId -> call
const busy = new Map(); // userId -> callId (one call at a time per person)

let helpers = null; // { io, roomOf, isOnline, emitToUsers } from chat.socket.js

const fullName = (user) => `${user.firstName} ${user.lastName || ''}`.trim();
const reply = (ack, data) => typeof ack === 'function' && ack(data);
const duration = (ms) => {
  const seconds = Math.round(ms / 1000);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = String(seconds % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
};

// STUN / TURN servers for the browser. TURN logins are short-lived (coturn "use-auth-secret"),
// so the shared secret never leaves this server.
function iceServersFor(userId) {
  const { stunUrls, turnUrls, turnSecret } = env.calls;
  const servers = [];
  if (stunUrls.length) servers.push({ urls: stunUrls });
  if (turnUrls.length && turnSecret) {
    const username = `${Math.floor(Date.now() / 1000) + TURN_CREDENTIAL_TTL_S}:${userId}`;
    const credential = crypto.createHmac('sha1', turnSecret).update(username).digest('base64');
    servers.push({ urls: turnUrls, username, credential });
  }
  return servers;
}

// A line in the chat, like the "added to the group" ones
async function logCall(conversationId, memberIds, text) {
  try {
    const message = await Message.create({ conversation: conversationId, type: 'system', text });
    await Conversation.updateOne(
      { _id: conversationId },
      { $set: { lastMessage: { text, sender: null, at: message.createdAt }, lastMessageAt: message.createdAt } }
    );
    helpers.emitToUsers(memberIds, 'message:new', { conversationId: String(conversationId), message: message.toObject() });
  } catch {
    /* the call itself already ended, never mind the log line */
  }
}

// reason: declined | missed (no answer / cancelled / caller left) | ended | disconnected | failed
function endCall(call, reason) {
  if (!calls.has(call.id)) return;
  calls.delete(call.id);
  clearTimeout(call.ringTimer);
  if (busy.get(call.callerId) === call.id) busy.delete(call.callerId);
  if (busy.get(call.calleeId) === call.id) busy.delete(call.calleeId);

  const answered = Boolean(call.answeredAt);
  const finalReason = !answered && reason !== 'declined' ? 'missed' : reason;
  helpers.io.to([helpers.roomOf(call.callerId), helpers.roomOf(call.calleeId)]).emit('call:ended', { callId: call.id, reason: finalReason });

  let text;
  if (answered) text = `Audio call from ${call.callerName} · ${duration(Date.now() - call.answeredAt)}`;
  else if (finalReason === 'declined') text = `${call.calleeName} declined an audio call from ${call.callerName}`;
  else text = `Missed audio call from ${call.callerName}`;
  logCall(call.conversationId, [call.callerId, call.calleeId], text);
}

// The call this socket is part of: the caller's tab, or the callee's tab that answered
// (while ringing, any of the callee's tabs may answer or decline)
function callOf(socket, callId) {
  const call = calls.get(callId);
  const me = socket.data.userId;
  if (!call) return null;
  if (call.callerId === me && call.callerSocket === socket.id) return call;
  if (call.calleeId === me && (!call.answeredAt || call.calleeSocket === socket.id)) return call;
  return null;
}

export function initCalls(chatHelpers) {
  helpers = chatHelpers;
}

export function handleCallEvents(socket) {
  const me = socket.data.userId;

  socket.on('call:start', async (payload = {}, ack) => {
    try {
      if (busy.has(me)) return reply(ack, { error: 'You are already on a call' });
      const conversation = await Conversation.findOne({ _id: payload.conversationId, type: 'direct', 'members.user': me }).select('members.user');
      if (!conversation) return reply(ack, { error: 'Calls work in 1-to-1 chats only' });
      const peerId = conversation.members.map((m) => String(m.user)).find((id) => id !== me);
      const [caller, peer] = await Promise.all([
        User.findById(me).select(USER_SELECT),
        User.findOne({ _id: peerId, status: 'active' }).select(USER_SELECT),
      ]);
      if (!caller || !peer) return reply(ack, { error: 'This person is no longer with the company' });

      const memberIds = [me, peerId];
      if (busy.has(me)) return reply(ack, { error: 'You are already on a call' });
      if (!helpers.isOnline(peerId) || busy.has(peerId)) {
        await logCall(conversation._id, memberIds, `Missed audio call from ${fullName(caller)}`);
        const why = busy.has(peerId) ? 'is on another call' : 'is offline';
        return reply(ack, { error: `${peer.firstName} ${why}. They will see a missed call.` });
      }

      const call = {
        id: crypto.randomUUID(),
        conversationId: String(conversation._id),
        callerId: me,
        calleeId: peerId,
        callerName: fullName(caller),
        calleeName: fullName(peer),
        callerSocket: socket.id,
        calleeSocket: null,
        answeredAt: null,
      };
      calls.set(call.id, call);
      busy.set(me, call.id);
      busy.set(peerId, call.id);
      call.ringTimer = setTimeout(() => endCall(call, 'missed'), RING_TIMEOUT_MS);

      helpers.io.to(helpers.roomOf(peerId)).emit('call:incoming', {
        callId: call.id,
        conversationId: call.conversationId,
        from: caller.toObject(),
        iceServers: iceServersFor(peerId),
      });
      return reply(ack, { callId: call.id, peer: peer.toObject(), iceServers: iceServersFor(me) });
    } catch {
      return reply(ack, { error: 'Could not start the call, please try again' });
    }
  });

  socket.on('call:accept', ({ callId } = {}, ack) => {
    const call = callOf(socket, callId);
    if (!call || call.calleeId !== me || call.answeredAt) return reply(ack, { error: 'This call has ended' });
    clearTimeout(call.ringTimer);
    call.answeredAt = Date.now();
    call.calleeSocket = socket.id;
    socket.to(helpers.roomOf(me)).emit('call:ended', { callId, reason: 'answered-elsewhere' });
    helpers.io.to(call.callerSocket).emit('call:accepted', { callId });
    return reply(ack, { ok: true });
  });

  socket.on('call:reject', ({ callId } = {}) => {
    const call = callOf(socket, callId);
    if (call && call.calleeId === me && !call.answeredAt) endCall(call, 'declined');
  });

  socket.on('call:end', ({ callId, reason } = {}) => {
    const call = callOf(socket, callId);
    if (call) endCall(call, reason === 'failed' ? 'failed' : 'ended');
  });

  // Offer / answer / ICE candidates, passed to the other side's tab as they are
  socket.on('call:signal', ({ callId, data } = {}) => {
    const call = callOf(socket, callId);
    if (!call || !call.answeredAt || !data || typeof data !== 'object') return;
    if (JSON.stringify(data).length > MAX_SIGNAL_CHARS) return;
    const target = call.callerId === me ? call.calleeSocket : call.callerSocket;
    helpers.io.to(target).emit('call:signal', { callId, data });
  });

  // Closed tab, lost connection, account deactivated: the call ends
  socket.on('disconnect', () => {
    const call = calls.get(busy.get(me));
    if (call && (call.callerSocket === socket.id || call.calleeSocket === socket.id)) endCall(call, 'disconnected');
  });
}
