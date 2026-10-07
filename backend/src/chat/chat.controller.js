import { LeaveRequest, Settings, User } from '../models/index.js';
import { ApiError } from '../utils/ApiError.js';
import { sendSuccess } from '../utils/response.js';
import { todayInTz } from '../utils/date.js';
import { CHAT_FILE_RETENTION_DAYS, CHAT_FILES_TOTAL_BYTES } from '../constants/index.js';
import { Conversation, Message, directKeyFor } from './chat.model.js';
import { emitToUsers, onlineUserIds } from './chat.socket.js';
import { deleteFile, openFile, saveFile, totalStoredBytes } from './chat.storage.js';
import { checkFile } from './chat.upload.js';

const DAY_MS = 24 * 60 * 60 * 1000;

/*
 * Chat REST API. Only members can read or write a conversation;
 * nobody else (HR / admin included) can open it, so other people's chats are a 404.
 */

const MEMBER_POPULATE = {
  path: 'members.user',
  select: 'firstName lastName avatar email role status designation',
  populate: { path: 'designation', select: 'title' },
};
const SENDER_SELECT = 'firstName lastName avatar';
const MESSAGE_POPULATE = [
  { path: 'sender', select: SENDER_SELECT },
  { path: 'replyTo', select: 'sender text type deletedAt attachment.name attachment.kind', populate: { path: 'sender', select: 'firstName lastName' } },
];
const PAGE_SIZE = 40;

const idOf = (value) => String(value?._id || value);
const memberIds = (conversation) => conversation.members.map((m) => idOf(m.user));
const fullName = (user) => `${user.firstName} ${user.lastName || ''}`.trim();
const preview = (text) => (text.length > 120 ? `${text.slice(0, 117)}...` : text);

// The conversation as one member sees it (their own unread count)
function conversationView(conversation, userId) {
  const data = conversation.toObject();
  const me = data.members.find((m) => idOf(m.user) === String(userId));
  return {
    ...data,
    unread: me?.unread || 0,
    muted: Boolean(me?.muted),
    members: data.members.filter((m) => m.user).map((m) => ({ ...m.user, lastReadAt: m.lastReadAt || null })),
  };
}

async function populated(conversationId) {
  return Conversation.findById(conversationId).populate(MEMBER_POPULATE);
}

// Sends every member their own view of the conversation (unread counts differ per person)
async function pushConversation(conversationId) {
  const conversation = await populated(conversationId);
  if (!conversation) return;
  memberIds(conversation).forEach((id) => emitToUsers([id], 'conversation:updated', conversationView(conversation, id)));
}

async function loadConversation(req) {
  const conversation = await Conversation.findOne({ _id: req.params.id, 'members.user': req.user._id });
  if (!conversation) throw ApiError.notFound('Conversation not found');
  return conversation;
}

function assertGroupAdmin(conversation, userId) {
  if (conversation.type !== 'group') throw ApiError.badRequest('This is not a group chat');
  if (!conversation.admins.some((id) => String(id) === String(userId))) throw ApiError.forbidden('Only group admins can do this');
}

async function activeUserIds(ids) {
  const unique = [...new Set(ids.map(String))];
  const found = await User.find({ _id: { $in: unique }, status: 'active' }).distinct('_id');
  if (found.length !== unique.length) throw ApiError.field('userIds', 'Some of the selected people are no longer active');
  return found;
}

// "Oliver added Emily" style line inside the chat
async function addSystemMessage(conversation, text) {
  const message = await Message.create({ conversation: conversation._id, type: 'system', text });
  conversation.lastMessage = { text, sender: null, at: message.createdAt };
  conversation.lastMessageAt = message.createdAt;
  await conversation.save();
  emitToUsers(memberIds(conversation), 'message:new', { conversationId: String(conversation._id), message: message.toObject() });
}

/* ------------------------------ conversations ------------------------------ */

// GET /api/chat/conversations
export async function listConversations(req, res) {
  const conversations = await Conversation.find({ 'members.user': req.user._id })
    .populate(MEMBER_POPULATE)
    .sort({ lastMessageAt: -1 })
    .limit(200);
  sendSuccess(res, { data: conversations.map((c) => conversationView(c, req.user._id)) });
}

// GET /api/chat/conversations/:id
export async function getConversation(req, res) {
  const conversation = await loadConversation(req);
  sendSuccess(res, { data: conversationView(await populated(conversation._id), req.user._id) });
}

// GET /api/chat/unread -> total unread messages (badge in the top bar) and the chats I muted
export async function getUnreadTotal(req, res) {
  const [result] = await Conversation.aggregate([
    { $match: { 'members.user': req.user._id } },
    { $unwind: '$members' },
    { $match: { 'members.user': req.user._id } },
    { $group: { _id: null, total: { $sum: '$members.unread' }, muted: { $addToSet: { $cond: ['$members.muted', '$_id', null] } } } },
  ]);
  const muted = (result?.muted || []).filter(Boolean).map(String);
  sendSuccess(res, { data: { total: result?.total || 0, muted } });
}

// POST /api/chat/conversations/direct { userId } -> opens the existing chat with that person or starts one
export async function openDirectChat(req, res) {
  const otherId = req.body.userId;
  if (otherId === String(req.user._id)) throw ApiError.field('userId', 'You cannot start a chat with yourself');
  await activeUserIds([otherId]);

  const directKey = directKeyFor(req.user._id, otherId);
  let conversation = await Conversation.findOne({ type: 'direct', directKey });
  if (!conversation) {
    try {
      conversation = await Conversation.create({
        type: 'direct',
        directKey,
        members: [{ user: req.user._id }, { user: otherId }],
        createdBy: req.user._id,
      });
    } catch (error) {
      // Both people opened the chat at the same moment: use the one that won
      if (error.code !== 11000) throw error;
      conversation = await Conversation.findOne({ type: 'direct', directKey });
    }
  }
  sendSuccess(res, { data: conversationView(await populated(conversation._id), req.user._id) });
}

// POST /api/chat/conversations/group { name, userIds }
export async function createGroup(req, res) {
  const ids = await activeUserIds([req.user._id, ...req.body.userIds]);
  if (ids.length < 2) throw ApiError.field('userIds', 'Add at least one other person');

  const conversation = await Conversation.create({
    type: 'group',
    name: req.body.name,
    members: ids.map((user) => ({ user, lastReadAt: new Date() })),
    admins: [req.user._id],
    createdBy: req.user._id,
  });
  await addSystemMessage(conversation, `${fullName(req.user)} created the group "${conversation.name}"`);
  await pushConversation(conversation._id);
  sendSuccess(res, { data: conversationView(await populated(conversation._id), req.user._id), message: 'Group created', status: 201 });
}

// PATCH /api/chat/conversations/:id { name } (group admins)
export async function renameGroup(req, res) {
  const conversation = await loadConversation(req);
  assertGroupAdmin(conversation, req.user._id);
  conversation.name = req.body.name;
  await addSystemMessage(conversation, `${fullName(req.user)} renamed the group to "${conversation.name}"`);
  await pushConversation(conversation._id);
  sendSuccess(res, { message: 'Group renamed' });
}

// POST /api/chat/conversations/:id/members { userIds } (group admins)
export async function addMembers(req, res) {
  const conversation = await loadConversation(req);
  assertGroupAdmin(conversation, req.user._id);

  const existing = new Set(memberIds(conversation));
  const newIds = (await activeUserIds(req.body.userIds)).filter((id) => !existing.has(String(id)));
  if (!newIds.length) throw ApiError.field('userIds', 'They are already in this group');

  conversation.members.push(...newIds.map((user) => ({ user, lastReadAt: new Date() })));
  const names = (await User.find({ _id: { $in: newIds } }).select('firstName lastName')).map(fullName);
  await addSystemMessage(conversation, `${fullName(req.user)} added ${names.join(', ')}`);
  await pushConversation(conversation._id);
  sendSuccess(res, { message: `${names.length} ${names.length === 1 ? 'person' : 'people'} added` });
}

// DELETE /api/chat/conversations/:id/members/:userId  (admins remove anyone, everyone can leave)
export async function removeMember(req, res) {
  const conversation = await loadConversation(req);
  if (conversation.type !== 'group') throw ApiError.badRequest('You cannot leave a 1-to-1 chat');

  const targetId = req.params.userId;
  const leaving = targetId === String(req.user._id);
  if (!leaving) assertGroupAdmin(conversation, req.user._id);
  if (!memberIds(conversation).includes(targetId)) throw ApiError.notFound('They are not in this group');

  const target = await User.findById(targetId).select('firstName lastName');
  conversation.members = conversation.members.filter((m) => String(m.user) !== targetId);
  conversation.admins = conversation.admins.filter((id) => String(id) !== targetId);
  emitToUsers([targetId], 'conversation:removed', { conversationId: String(conversation._id) });

  // Last person out: nothing left to keep
  if (!conversation.members.length) {
    const fileIds = await Message.find({ conversation: conversation._id, 'attachment.fileId': { $exists: true } }).distinct('attachment.fileId');
    await Promise.all([...fileIds.map(deleteFile), Message.deleteMany({ conversation: conversation._id }), conversation.deleteOne()]);
    return sendSuccess(res, { message: 'You left the group' });
  }
  // A group always keeps an admin: the longest-standing member takes over
  if (!conversation.admins.length) conversation.admins = [conversation.members[0].user];

  await addSystemMessage(conversation, leaving ? `${fullName(target)} left the group` : `${fullName(req.user)} removed ${fullName(target)}`);
  await pushConversation(conversation._id);
  return sendSuccess(res, { message: leaving ? 'You left the group' : `${fullName(target)} removed` });
}

/* -------------------------------- messages -------------------------------- */

// A quoted message that was deleted later shows no text or file
function messageView(message) {
  const data = message.toObject();
  if (data.replyTo?.deletedAt) data.replyTo = { ...data.replyTo, text: '', attachment: undefined };
  return data;
}

const isLastMessage = (conversation, message) => conversation.lastMessage?.at?.getTime() === message.createdAt.getTime();

// A message in a chat I'm still in (mine = only my own messages)
async function loadMessage(req, { mine = false } = {}) {
  const message = await Message.findById(req.params.id);
  if (!message || message.type === 'system') throw ApiError.notFound('Message not found');
  if (mine && String(message.sender) !== String(req.user._id)) throw ApiError.notFound('Message not found');
  const conversation = await Conversation.findOne({ _id: message.conversation, 'members.user': req.user._id });
  if (!conversation) throw ApiError.notFound('Message not found');
  return { message, conversation };
}

// Edits and reactions: everyone in the chat gets the new version of the message
async function pushMessageUpdate(conversation, message) {
  await message.populate(MESSAGE_POPULATE);
  const data = messageView(message);
  emitToUsers(memberIds(conversation), 'message:updated', { conversationId: String(conversation._id), message: data });
  return data;
}

// GET /api/chat/conversations/:id/messages?before=<ISO date>  -> oldest first, PAGE_SIZE at a time
export async function listMessages(req, res) {
  const conversation = await loadConversation(req);
  const filter = { conversation: conversation._id };
  const before = req.query.before ? new Date(req.query.before) : null;
  if (before && !Number.isNaN(before.getTime())) filter.createdAt = { $lt: before };

  const messages = await Message.find(filter)
    .populate(MESSAGE_POPULATE)
    .sort({ createdAt: -1 })
    .limit(PAGE_SIZE + 1);
  const hasMore = messages.length > PAGE_SIZE;
  sendSuccess(res, { data: messages.slice(0, PAGE_SIZE).reverse().map(messageView), meta: { hasMore } });
}

// Checks shared by text and file messages: the other person is still here, the quoted message exists
async function assertCanPost(conversation, me, replyTo) {
  if (conversation.type === 'direct') {
    const otherId = memberIds(conversation).find((id) => id !== String(me));
    if (!(await User.exists({ _id: otherId, status: 'active' }))) throw ApiError.badRequest('This person is no longer with the company');
  }
  if (replyTo && !(await Message.exists({ _id: replyTo, conversation: conversation._id, type: 'text' }))) {
    throw ApiError.field('replyTo', 'The message you replied to is no longer available');
  }
}

// Saves a message, updates the chat list for everyone and pushes it live
async function postMessage(conversation, me, fields, previewText) {
  const message = await Message.create({ conversation: conversation._id, sender: me, ...fields });

  // One update: last message, +1 unread for everyone else, and the sender has read up to now
  await Conversation.updateOne(
    { _id: conversation._id },
    {
      $set: {
        lastMessage: { text: preview(previewText), sender: me, at: message.createdAt },
        lastMessageAt: message.createdAt,
        'members.$[mine].unread': 0,
        'members.$[mine].lastReadAt': message.createdAt,
      },
      $inc: { 'members.$[other].unread': 1 },
    },
    { arrayFilters: [{ 'mine.user': me }, { 'other.user': { $ne: me } }] }
  );

  await message.populate(MESSAGE_POPULATE);
  const data = messageView(message);
  emitToUsers(memberIds(conversation), 'message:new', { conversationId: String(conversation._id), message: data });
  return data;
}

// POST /api/chat/conversations/:id/messages { text, replyTo }
export async function sendMessage(req, res) {
  const conversation = await loadConversation(req);
  await assertCanPost(conversation, req.user._id, req.body.replyTo);
  const data = await postMessage(conversation, req.user._id, { text: req.body.text, replyTo: req.body.replyTo || undefined }, req.body.text);
  sendSuccess(res, { data, status: 201 });
}

// POST /api/chat/conversations/:id/attachments  (multipart: file + optional text, replyTo)
export async function sendAttachment(req, res) {
  if (!req.file) throw ApiError.field('file', 'Choose a file to send');
  const conversation = await loadConversation(req);
  await assertCanPost(conversation, req.user._id, req.body.replyTo);

  const { name, contentType, kind } = checkFile(req.file.originalname);
  if ((await totalStoredBytes()) + req.file.size > CHAT_FILES_TOTAL_BYTES) {
    throw ApiError.badRequest('Chat file storage is full. Older files are removed automatically after 90 days, please try again later.');
  }

  const fileId = await saveFile(req.file.buffer, {
    filename: name,
    contentType,
    metadata: { conversation: conversation._id, uploadedBy: req.user._id },
  });
  const attachment = { fileId, name, size: req.file.size, contentType, kind, expiresAt: new Date(Date.now() + CHAT_FILE_RETENTION_DAYS * DAY_MS) };
  const caption = req.body.text || '';
  try {
    const data = await postMessage(
      conversation,
      req.user._id,
      { text: caption, replyTo: req.body.replyTo || undefined, attachment },
      caption || (kind === 'image' ? '📷 Photo' : `📎 ${name}`)
    );
    sendSuccess(res, { data, status: 201 });
  } catch (error) {
    await deleteFile(fileId); // don't keep a file nobody can see
    throw error;
  }
}

// GET /api/chat/files/:fileId[?download=1]  -> the file, only for members of that chat
export async function downloadFile(req, res) {
  const message = await Message.findOne({ 'attachment.fileId': req.params.fileId });
  if (!message || !(await Conversation.exists({ _id: message.conversation, 'members.user': req.user._id }))) {
    throw ApiError.notFound('File not found');
  }
  const { attachment } = message;
  if (message.deletedAt || attachment.removedAt) throw new ApiError(410, 'This file is no longer available');

  res.set({
    'Content-Type': attachment.contentType,
    'Content-Length': String(attachment.size),
    'Cache-Control': 'private, max-age=86400',
    // Never run anything from an uploaded file
    'Content-Security-Policy': "default-src 'none'; sandbox",
    'X-Content-Type-Options': 'nosniff',
  });
  // Photos can be shown in the page; everything else is always a download
  if (attachment.kind !== 'image' || req.query.download) res.attachment(attachment.name);

  const stream = openFile(attachment.fileId);
  stream.on('error', () => {
    if (!res.headersSent) res.status(410).json({ success: false, message: 'This file is no longer available' });
    else res.destroy();
  });
  stream.pipe(res);
}

// PATCH /api/chat/messages/:id { text }  (own messages only)
export async function editMessage(req, res) {
  const { message, conversation } = await loadMessage(req, { mine: true });
  if (message.deletedAt) throw ApiError.badRequest('This message was deleted');

  message.text = req.body.text;
  message.editedAt = new Date();
  await message.save();
  if (isLastMessage(conversation, message)) {
    conversation.lastMessage.text = preview(message.text);
    await conversation.save();
  }
  sendSuccess(res, { data: await pushMessageUpdate(conversation, message), message: 'Message edited' });
}

// POST /api/chat/messages/:id/reactions { emoji } -> adds my reaction, or removes it if I already reacted with it
export async function toggleReaction(req, res) {
  const { message, conversation } = await loadMessage(req);
  if (message.deletedAt) throw ApiError.badRequest('This message was deleted');

  const reaction = { emoji: req.body.emoji, user: req.user._id };
  const reacted = message.reactions.some((r) => r.emoji === reaction.emoji && String(r.user) === String(reaction.user));
  await Message.updateOne({ _id: message._id }, reacted ? { $pull: { reactions: reaction } } : { $addToSet: { reactions: reaction } });

  const updated = await Message.findById(message._id);
  sendSuccess(res, { data: await pushMessageUpdate(conversation, updated) });
}

// DELETE /api/chat/messages/:id  (own messages only)
export async function deleteMessage(req, res) {
  const { message, conversation } = await loadMessage(req, { mine: true });
  if (message.deletedAt) return sendSuccess(res, { message: 'Message deleted' });

  const fileId = message.attachment?.fileId;
  message.set({ text: '', replyTo: undefined, reactions: [], attachment: undefined, deletedAt: new Date() });
  await message.save();
  await deleteFile(fileId);
  if (isLastMessage(conversation, message)) {
    conversation.lastMessage.text = 'This message was deleted';
    await conversation.save();
  }
  emitToUsers(memberIds(conversation), 'message:deleted', { conversationId: String(conversation._id), messageId: String(message._id) });
  return sendSuccess(res, { message: 'Message deleted' });
}

// PATCH /api/chat/conversations/:id/mute { muted } -> no pop-ups or sounds for this chat (only for me)
export async function setMuted(req, res) {
  const conversation = await loadConversation(req);
  await Conversation.updateOne({ _id: conversation._id, 'members.user': req.user._id }, { $set: { 'members.$.muted': req.body.muted } });
  // Every open tab / device of mine follows (no pop-ups there either)
  emitToUsers([req.user._id], 'conversation:muted', { conversationId: String(conversation._id), muted: req.body.muted });
  sendSuccess(res, { data: { muted: req.body.muted }, message: req.body.muted ? 'Chat muted' : 'Chat unmuted' });
}

// POST /api/chat/conversations/:id/read -> clears my unread count, others see "Seen"
export async function markRead(req, res) {
  const conversation = await loadConversation(req);
  const at = new Date();
  await Conversation.updateOne(
    { _id: conversation._id, 'members.user': req.user._id },
    { $set: { 'members.$.unread': 0, 'members.$.lastReadAt': at } }
  );
  emitToUsers(memberIds(conversation), 'conversation:read', { conversationId: String(conversation._id), userId: String(req.user._id), at });
  sendSuccess(res, { data: { at } });
}

/* -------------------------------- presence -------------------------------- */

// GET /api/chat/presence -> who is online now and who is on approved leave today
export async function getPresence(_req, res) {
  const settings = await Settings.getSettings();
  const today = todayInTz(settings.timezone);
  const onLeave = await LeaveRequest.find({ status: 'approved', fromDate: { $lte: today }, toDate: { $gte: today } }).distinct('user');
  sendSuccess(res, { data: { online: onlineUserIds(), onLeave: onLeave.map(String) } });
}
