import { formatDate, formatTime, getFullName } from '@/lib/format';

export const sameId = (a, b) => String(a?._id || a) === String(b?._id || b);

// The other person in a 1-to-1 chat
export function otherMember(conversation, me) {
  return conversation.members.find((m) => !sameId(m, me)) || conversation.members[0];
}

export function conversationTitle(conversation, me) {
  if (conversation.type === 'group') return conversation.name;
  return getFullName(otherMember(conversation, me));
}

// 'online' | 'leave' | 'offline'; someone on leave shows as on leave even if they open the app
export function presenceOf(userId, { online, onLeave }) {
  const id = String(userId);
  if (onLeave.has(id)) return 'leave';
  return online.has(id) ? 'online' : 'offline';
}

export const PRESENCE_LABEL = { online: 'Online', leave: 'On leave', offline: 'Offline' };
export const PRESENCE_DOT = { online: 'bg-emerald-500', leave: 'bg-amber-500', offline: 'bg-slate-300' };

// Today -> "10:42 am", earlier -> "07 Oct"
export function listTime(value) {
  if (!value) return '';
  const date = new Date(value);
  return new Date().toDateString() === date.toDateString() ? formatTime(date) : formatDate(date, { day: '2-digit', month: 'short' });
}

export function dayLabel(value) {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return formatDate(date, { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' });
}

// Newest first, the order the conversation list uses
export const byLatest = (a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt);

// Same list as the server (backend CHAT_REACTIONS)
export const CHAT_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

// [{ emoji, count, mine, names }] in the order of CHAT_REACTIONS
export function groupReactions(reactions = [], meId, members = []) {
  return CHAT_REACTIONS.map((emoji) => {
    const users = reactions.filter((r) => r.emoji === emoji).map((r) => r.user);
    const names = users.map((id) => (sameId(id, meId) ? 'You' : members.find((m) => sameId(m, id))?.firstName)).filter(Boolean);
    return { emoji, count: users.length, mine: users.some((id) => sameId(id, meId)), names };
  }).filter((r) => r.count);
}

// Splits text into plain parts and web links (rendered as <a>, never as HTML)
const URL_PATTERN = /(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"])/g;
export function splitLinks(text = '') {
  return text.split(URL_PATTERN).map((part, i) => ({ text: part, isLink: i % 2 === 1 }));
}

// Same rules as the server (backend CHAT_FILE_* constants)
export const CHAT_FILE_MAX_BYTES = 5 * 1024 * 1024;
export const CHAT_FILE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv'];
export const CHAT_FILE_ACCEPT = CHAT_FILE_EXTENSIONS.map((ext) => `.${ext}`).join(',');
export const isImageName = (name = '') => /\.(jpe?g|png|gif|webp)$/i.test(name);

// null when the file can be sent, otherwise the reason
export function fileProblem(file) {
  const extension = file.name.includes('.') ? file.name.split('.').pop().toLowerCase() : '';
  if (!CHAT_FILE_EXTENSIONS.includes(extension)) return 'You can send photos, PDF, Word, Excel, PowerPoint, text and CSV files';
  if (file.size > CHAT_FILE_MAX_BYTES) return 'Files can be up to 5 MB';
  return null;
}

export function fileSize(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// One-line text for a message: its text, or what was attached
export function messagePreview(message) {
  if (message?.text) return message.text;
  if (message?.attachment) return message.attachment.kind === 'image' ? '📷 Photo' : `📎 ${message.attachment.name}`;
  return '';
}
