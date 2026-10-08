import crypto from 'crypto';
import { env } from '../config/env.js';
import { User } from '../models/index.js';
import { Conversation, Message } from './chat.model.js';

/*
 * Audio calls (WebRTC), 1-to-1 and in group chats. The voice goes straight between the browsers
 * (in a group, every person connects to every other: a "mesh", fine for audio up to MAX_PARTICIPANTS);
 * this server only passes the set-up messages along ("signaling") over the chat socket:
 *
 *   call:start { conversationId }   -> the other members (all their tabs) <- call:incoming
 *                                      a group that already has a call: { callId, existing: true }, join it instead
 *   call:accept { callId }          -> join. Reply: who is already in; the joiner sends each of them an offer.
 *                                      Those people <- call:joined { user }; the joiner's other tabs stop ringing
 *   call:signal { callId, to, data } -> that person's tab <- call:signal { from, data } (offer / answer / ICE)
 *   call:mute { callId, muted }     -> the others <- call:muted { userId, muted }
 *   call:invite { callId, userIds } -> ring more people. A group call rings group members (new people are
 *                                      added to the group first, by any member, over the REST API).
 *                                      A 1-to-1 call becomes a new group with everyone; the call carries on
 *                                      in it without reconnecting: the two people in it <- call:upgraded
 *   call:mute-request { callId, userId } (group admins and whoever started the call)
 *                                   -> that person's tab <- call:muted-by { by }: their mic goes off, they can turn it back on
 *   call:reject / call:leave        -> 1-to-1: the call ends. Group: the others <- call:left { userId };
 *                                      the call ends when nobody is left
 *   everyone <- call:ended { reason }, group members <- call:status (for the "Join call" bar in the chat)
 *
 * Every call leaves a line in the chat ("Missed audio call from …", "Group audio call · 12:30 · 4 people").
 * Calls are kept in memory, like presence: fine while the API runs as one server.
 */

export const MAX_PARTICIPANTS = 8;
const RING_TIMEOUT_MS = 45 * 1000;
const MAX_SIGNAL_CHARS = 32 * 1024; // an SDP offer is a few KB
const TURN_CREDENTIAL_TTL_S = 12 * 60 * 60;
const USER_SELECT = 'firstName lastName avatar';

const calls = new Map(); // callId -> call
const callOfConversation = new Map(); // conversationId -> callId (one call per chat)
const busy = new Map(); // userId -> callId: in a call, or being rung for a 1-to-1 call

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

const toRooms = (userIds) => userIds.map((id) => helpers.roomOf(id));
const joinedIds = (call) => [...call.joined.keys()];

// Group members see "Call in progress · 3 people · Join"
function statusOf(call, active = true) {
  return { callId: call.id, conversationId: call.conversationId, active, participants: active ? joinedIds(call) : [] };
}
function pushStatus(call, active = true) {
  if (call.isGroup) helpers.io.to(toRooms(call.members)).emit('call:status', statusOf(call, active));
}

// Sends to the tab each person joined from
function emitToJoined(call, event, payload, exceptUserId) {
  const sockets = [...call.joined].filter(([userId]) => userId !== exceptUserId).map(([, socketId]) => socketId);
  if (sockets.length) helpers.io.to(sockets).emit(event, payload);
}

function stopRinging(call) {
  clearTimeout(call.ringTimer);
  call.ringTimer = null;
  if (!call.isGroup && busy.get(call.calleeId) === call.id && !call.joined.has(call.calleeId)) busy.delete(call.calleeId);
}

// reason: declined | missed | ended | failed
function endCall(call, reason) {
  if (!calls.has(call.id)) return;
  calls.delete(call.id);
  if (callOfConversation.get(call.conversationId) === call.id) callOfConversation.delete(call.conversationId);
  clearTimeout(call.ringTimer);
  call.inviteTimers.forEach(clearTimeout);
  call.members.forEach((id) => busy.get(id) === call.id && busy.delete(id));

  const answered = Boolean(call.answeredAt);
  const finalReason = !answered && reason !== 'declined' ? 'missed' : reason;
  helpers.io.to(toRooms(call.members)).emit('call:ended', { callId: call.id, reason: finalReason });
  pushStatus(call, false);

  let text;
  if (call.isGroup) {
    text = answered
      ? `Group audio call · ${duration(Date.now() - call.answeredAt)} · ${call.everJoined.size} people`
      : `Missed group audio call from ${call.callerName}`;
  } else if (answered) text = `Audio call from ${call.callerName} · ${duration(Date.now() - call.answeredAt)}`;
  else if (finalReason === 'declined') text = `${call.calleeName} declined an audio call from ${call.callerName}`;
  else text = `Missed audio call from ${call.callerName}`;
  logCall(call.conversationId, call.members, text);
}

function leave(call, userId) {
  if (!call.joined.has(userId)) return;
  call.joined.delete(userId);
  call.muted.delete(userId);
  if (busy.get(userId) === call.id) busy.delete(userId);
  // 1-to-1: one side leaving ends it. Group: it goes on while anyone is in.
  if (!call.isGroup || call.joined.size === 0) return endCall(call, 'ended');
  emitToJoined(call, 'call:left', { callId: call.id, userId });
  return pushStatus(call);
}

// Nobody answered in time: a 1-to-1 call or a group call nobody joined ends,
// otherwise only the ringing stops (people can still join from the chat)
function ringTimeout(call) {
  call.ringTimer = null;
  if (!call.answeredAt) return endCall(call, 'missed');
  const notJoined = call.members.filter((id) => !call.joined.has(id));
  if (notJoined.length) helpers.io.to(toRooms(notJoined)).emit('call:ended', { callId: call.id, reason: 'missed' });
  return undefined;
}

// Ring people into a call that is going on; after the ring time, stop ringing the ones who did not join
function ringInto(call, userIds, inviterId) {
  if (!userIds.length) return;
  userIds.forEach((id) =>
    helpers.io.to(helpers.roomOf(id)).emit('call:incoming', {
      callId: call.id,
      conversationId: call.conversationId,
      isGroup: true,
      groupName: call.groupName,
      from: call.people.get(inviterId),
      iceServers: iceServersFor(id),
    })
  );
  const timer = setTimeout(() => {
    call.inviteTimers.delete(timer);
    const notJoined = userIds.filter((id) => !call.joined.has(id));
    if (calls.has(call.id) && notJoined.length) helpers.io.to(toRooms(notJoined)).emit('call:ended', { callId: call.id, reason: 'missed' });
  }, RING_TIMEOUT_MS);
  call.inviteTimers.add(timer);
}

const firstNames = (users) => users.map((u) => u.firstName);
function listNames(names) {
  return names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0] || '';
}

// Who is in the call right now. No database read here: joining must not wait between
// "who is in" and "add me", or two people joining at once would miss each other.
const peopleIn = (call) => joinedIds(call).map((id) => ({ user: call.people.get(id), muted: call.muted.has(id) }));

export function initCalls(chatHelpers) {
  helpers = chatHelpers;
}

export function handleCallEvents(socket) {
  const me = socket.data.userId;

  // Calls already going on in my group chats (just connected, or reconnected)
  calls.forEach((call) => call.isGroup && call.members.includes(me) && socket.emit('call:status', statusOf(call)));

  socket.on('call:start', async (payload = {}, ack) => {
    try {
      if (busy.has(me)) return reply(ack, { error: 'You are already on a call' });
      const conversation = await Conversation.findOne({ _id: payload.conversationId, 'members.user': me }).select('type name members.user admins');
      if (!conversation) return reply(ack, { error: 'Conversation not found' });
      const conversationId = String(conversation._id);
      const isGroup = conversation.type === 'group';

      // Someone in this group started one already: join that
      const existing = calls.get(callOfConversation.get(conversationId));
      if (existing) return reply(ack, isGroup ? { callId: existing.id, existing: true } : { error: 'A call is already going on in this chat' });

      const memberIds = conversation.members.map((m) => String(m.user));
      const activeUsers = await User.find({ _id: { $in: memberIds }, status: 'active' }).select(USER_SELECT).lean();
      const activeIds = activeUsers.map((u) => String(u._id));
      const caller = await User.findById(me).select(USER_SELECT);
      if (!caller) return reply(ack, { error: 'Could not start the call, please try again' });
      const others = activeIds.filter((id) => id !== me);
      if (!others.length) return reply(ack, { error: isGroup ? 'Nobody else is in this group' : 'This person is no longer with the company' });
      if (busy.has(me)) return reply(ack, { error: 'You are already on a call' });

      const reachable = others.filter((id) => helpers.isOnline(id) && !busy.has(id));
      if (!reachable.length) {
        if (!isGroup) {
          const peer = await User.findById(others[0]).select('firstName');
          const why = busy.has(others[0]) ? 'is on another call' : 'is offline';
          await logCall(conversationId, memberIds, `Missed audio call from ${fullName(caller)}`);
          return reply(ack, { error: `${peer.firstName} ${why}. They will see a missed call.` });
        }
        return reply(ack, { error: 'Nobody else in this group is online or free right now' });
      }

      const call = {
        id: crypto.randomUUID(),
        conversationId,
        isGroup,
        members: [me, ...others],
        callerId: me,
        callerName: fullName(caller),
        calleeId: isGroup ? null : others[0],
        calleeName: null,
        groupName: isGroup ? conversation.name : null,
        inviteTimers: new Set(), // "ring more people" timers
        joined: new Map([[me, socket.id]]), // userId -> the tab they are in the call from
        everJoined: new Set([me]),
        muted: new Set(),
        people: new Map(activeUsers.map((u) => [String(u._id), u])), // userId -> { _id, firstName, lastName, avatar }
        moderators: new Set([me, ...(isGroup ? conversation.admins.map(String) : [])]), // can mute others
        answeredAt: null, // when a second person joined
      };
      if (!isGroup) call.calleeName = fullName(await User.findById(call.calleeId).select('firstName lastName'));
      if (busy.has(me) || callOfConversation.has(conversationId)) return reply(ack, { error: 'Could not start the call, please try again' });

      calls.set(call.id, call);
      callOfConversation.set(conversationId, call.id);
      busy.set(me, call.id);
      if (!isGroup) busy.set(call.calleeId, call.id);
      call.ringTimer = setTimeout(() => ringTimeout(call), RING_TIMEOUT_MS);

      reachable.forEach((id) =>
        helpers.io.to(helpers.roomOf(id)).emit('call:incoming', {
          callId: call.id,
          conversationId,
          isGroup,
          groupName: isGroup ? conversation.name : null,
          from: caller.toObject(),
          iceServers: iceServersFor(id),
        })
      );
      pushStatus(call);
      return reply(ack, { callId: call.id, iceServers: iceServersFor(me), canModerate: isGroup });
    } catch {
      return reply(ack, { error: 'Could not start the call, please try again' });
    }
  });

  // Answer a ringing call, or join a group call that is going on
  socket.on('call:accept', async ({ callId } = {}, ack) => {
    try {
      const call = calls.get(callId);
      if (!call || !call.members.includes(me) || call.joined.has(me)) return reply(ack, { error: 'This call has ended' });
      if (!call.isGroup && call.calleeId !== me) return reply(ack, { error: 'This call has ended' });
      if (call.joined.size >= MAX_PARTICIPANTS) return reply(ack, { error: `This call is full (${MAX_PARTICIPANTS} people)` });
      if (busy.has(me) && busy.get(me) !== call.id) return reply(ack, { error: 'You are already on a call' });

      const user = call.people.get(me) || (await User.findById(me).select(USER_SELECT).lean());

      // From here on nothing waits: read who is in and add me in one go
      if (!calls.has(call.id) || call.joined.has(me)) return reply(ack, { error: 'This call has ended' });
      if (busy.has(me) && busy.get(me) !== call.id) return reply(ack, { error: 'You are already on a call' });
      if (call.joined.size >= MAX_PARTICIPANTS) return reply(ack, { error: `This call is full (${MAX_PARTICIPANTS} people)` });
      const already = peopleIn(call);
      call.people.set(me, user);
      call.joined.set(me, socket.id);
      call.everJoined.add(me);
      busy.set(me, call.id);
      if (!call.answeredAt) call.answeredAt = Date.now();
      if (!call.isGroup) stopRinging(call);

      socket.to(helpers.roomOf(me)).emit('call:ended', { callId, reason: 'answered-elsewhere' });
      emitToJoined(call, 'call:joined', { callId, user }, me);
      pushStatus(call);
      return reply(ack, { ok: true, participants: already, iceServers: iceServersFor(me), canModerate: call.isGroup && call.moderators.has(me) });
    } catch {
      return reply(ack, { error: 'Could not join the call, please try again' });
    }
  });

  socket.on('call:reject', ({ callId } = {}) => {
    const call = calls.get(callId);
    if (!call || !call.members.includes(me) || call.joined.has(me)) return;
    if (!call.isGroup) {
      if (call.calleeId === me) endCall(call, 'declined');
      return;
    }
    // Group: stop ringing in my other tabs; the call goes on for the others
    helpers.io.to(helpers.roomOf(me)).emit('call:ended', { callId, reason: 'answered-elsewhere' });
  });

  socket.on('call:leave', ({ callId, reason } = {}) => {
    const call = calls.get(callId);
    if (!call || call.joined.get(me) !== socket.id) return;
    if (!call.isGroup && reason === 'failed') endCall(call, 'failed');
    else leave(call, me);
  });

  // Offer / answer / ICE candidate for one person in the call, passed along as it is
  socket.on('call:signal', ({ callId, to, data } = {}) => {
    const call = calls.get(callId);
    if (!call || call.joined.get(me) !== socket.id || !call.joined.has(String(to))) return;
    if (!data || typeof data !== 'object' || JSON.stringify(data).length > MAX_SIGNAL_CHARS) return;
    helpers.io.to(call.joined.get(String(to))).emit('call:signal', { callId, from: me, data });
  });

  socket.on('call:mute', ({ callId, muted } = {}) => {
    const call = calls.get(callId);
    if (!call || call.joined.get(me) !== socket.id) return;
    if (muted) call.muted.add(me);
    else call.muted.delete(me);
    emitToJoined(call, 'call:muted', { callId, userId: me, muted: Boolean(muted) }, me);
  });

  // Ring more people into the call (see the top of this file)
  socket.on('call:invite', async ({ callId, userIds } = {}, ack) => {
    try {
      const call = calls.get(callId);
      if (!call || call.joined.get(me) !== socket.id) return reply(ack, { error: 'You are not in this call' });
      if (!call.answeredAt) return reply(ack, { error: 'Wait until someone has joined the call' });
      const wanted = [...new Set((Array.isArray(userIds) ? userIds : []).map(String))].filter((id) => id !== me && !call.joined.has(id));
      if (!wanted.length) return reply(ack, { error: 'Pick someone who is not in the call yet' });
      if (call.joined.size + wanted.length > MAX_PARTICIPANTS) return reply(ack, { error: `A call can have up to ${MAX_PARTICIPANTS} people` });
      const users = await User.find({ _id: { $in: wanted }, status: 'active' }).select(USER_SELECT).lean();
      if (!users.length) return reply(ack, { error: 'They are no longer with the company' });
      const ids = users.map((u) => String(u._id));

      if (!call.isGroup) {
        // 1-to-1 becomes a new group with everyone; the two people in it keep their connection
        const everyone = [...new Set([call.callerId, call.calleeId, ...ids])];
        const twoOf = await User.find({ _id: { $in: [call.callerId, call.calleeId] } }).select(USER_SELECT).lean();
        const all = [...twoOf, ...users];
        const name = listNames(firstNames(all)).slice(0, 80);
        const conversation = await Conversation.create({
          type: 'group',
          name,
          members: everyone.map((user) => ({ user, lastReadAt: new Date() })),
          admins: [call.callerId, call.calleeId],
          createdBy: me,
        });
        if (!calls.has(call.id) || call.isGroup) return reply(ack, { error: 'This call has ended' });
        if (callOfConversation.get(call.conversationId) === call.id) callOfConversation.delete(call.conversationId);
        call.conversationId = String(conversation._id);
        call.isGroup = true;
        call.groupName = name;
        call.members = everyone;
        call.moderators = new Set([call.callerId, call.calleeId]);
        all.forEach((u) => call.people.set(String(u._id), u));
        callOfConversation.set(call.conversationId, call.id);
        emitToJoined(call, 'call:upgraded', { callId, conversationId: call.conversationId, title: name, canModerate: true });
        // A first line in the new chat (also makes it show up in everyone's chat list)
        await logCall(call.conversationId, everyone, `${call.people.get(me).firstName} added ${listNames(firstNames(users))} to the call`);
      } else {
        // Group call: only people in the group (new people are added to the group first)
        const conversation = await Conversation.findById(call.conversationId).select('members.user');
        const inGroup = new Set((conversation?.members || []).map((m) => String(m.user)));
        if (ids.some((id) => !inGroup.has(id))) return reply(ack, { error: 'Add them to the group first' });
        if (!calls.has(call.id)) return reply(ack, { error: 'This call has ended' });
        users.forEach((u) => {
          const id = String(u._id);
          if (!call.members.includes(id)) call.members.push(id);
          call.people.set(id, u);
        });
      }

      const reachable = ids.filter((id) => helpers.isOnline(id) && !busy.has(id) && !call.joined.has(id));
      ringInto(call, reachable, me);
      pushStatus(call);
      const unreachable = users.filter((u) => !reachable.includes(String(u._id))).map((u) => u.firstName);
      return reply(ack, { ok: true, ringing: reachable.length, unreachable, conversationId: call.conversationId });
    } catch {
      return reply(ack, { error: 'Could not add them, please try again' });
    }
  });

  // Group admins / the person who started the call can turn someone's mic off (they can turn it back on)
  socket.on('call:mute-request', ({ callId, userId } = {}, ack) => {
    const call = calls.get(callId);
    const target = String(userId);
    if (!call || !call.isGroup || call.joined.get(me) !== socket.id || !call.joined.has(target) || target === me) {
      return reply(ack, { error: 'This person is not in the call' });
    }
    if (!call.moderators.has(me)) return reply(ack, { error: 'Only group admins and whoever started the call can mute others' });
    helpers.io.to(call.joined.get(target)).emit('call:muted-by', { callId, by: call.people.get(me) });
    return reply(ack, { ok: true });
  });

  // Closed tab, lost connection, account deactivated: that person leaves the call
  socket.on('disconnect', () => {
    const call = calls.get(busy.get(me));
    if (call && call.joined.get(me) === socket.id) leave(call, me);
  });
}
