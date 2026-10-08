import { Server } from 'socket.io';
import { env } from '../config/env.js';
import { Settings } from '../models/index.js';
import { userFromToken } from '../middlewares/auth.middleware.js';
import { Conversation } from './chat.model.js';

/*
 * Real-time part of chat (Socket.IO on the same port as the API).
 * Messages are saved through the REST API (validated there); the socket only pushes events:
 *   message:new, message:updated, message:deleted, message:file-removed, conversation:updated, conversation:removed, conversation:read,
 *   conversation:prefs ({ muted } / { pinned } / { folder }, only to that user), chat:folders (only to that user),
 *   typing, presence
 * Every user joins the room "user:<id>", so pushing to someone reaches all their open tabs.
 *
 * Presence is kept in memory, which is fine while the API runs as one server.
 * With several servers this needs the Socket.IO Redis adapter.
 */

let io = null;
const connections = new Map(); // userId -> number of open sockets (tabs / devices)

const roomOf = (userId) => `user:${userId}`;

export function initChatSocket(httpServer) {
  io = new Server(httpServer, { cors: { origin: env.clientOrigins, credentials: true } });

  // Same login rules as the REST API, plus the company must have chat switched on
  io.use(async (socket, next) => {
    try {
      const user = await userFromToken(socket.handshake.auth?.token);
      if (user.mustChangePassword) return next(new Error('Please set a new password to continue'));
      const settings = await Settings.getSettings();
      if (settings.features?.chat === false) return next(new Error('Chat is switched off for your company'));
      socket.data.userId = String(user._id);
      return next();
    } catch (error) {
      return next(new Error(error.message || 'Not authorized'));
    }
  });

  io.on('connection', (socket) => {
    const { userId } = socket.data;
    socket.join(roomOf(userId));

    const count = (connections.get(userId) || 0) + 1;
    connections.set(userId, count);
    if (count === 1) io.emit('presence', { userId, online: true });

    // { conversationId, isTyping } -> the other members see "… is typing"
    socket.on('typing', async (payload = {}) => {
      try {
        const conversation = await Conversation.findOne({ _id: payload.conversationId, 'members.user': userId }).select('members.user');
        if (!conversation) return;
        const others = conversation.members.map((m) => String(m.user)).filter((id) => id !== userId);
        emitToUsers(others, 'typing', { conversationId: String(conversation._id), userId, isTyping: Boolean(payload.isTyping) });
      } catch {
        /* bad id, ignore */
      }
    });

    socket.on('disconnect', () => {
      const left = (connections.get(userId) || 1) - 1;
      if (left > 0) {
        connections.set(userId, left);
      } else {
        connections.delete(userId);
        io.emit('presence', { userId, online: false });
      }
    });
  });

  return io;
}

export function emitToUsers(userIds, event, payload) {
  if (!io) return;
  const rooms = [...new Set(userIds.map(String))].map(roomOf);
  if (rooms.length) io.to(rooms).emit(event, payload);
}

export function onlineUserIds() {
  return [...connections.keys()];
}

// Leavers / deactivated accounts lose their live connection straight away
export function disconnectUser(userId) {
  if (io) io.in(roomOf(userId)).disconnectSockets(true);
}
