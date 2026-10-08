import mongoose from 'mongoose';
import { CHAT_PRIORITIES, CHAT_RETENTION_DAYS } from '../constants/index.js';

/*
 * Chat between employees: 1-to-1 ("direct") or group conversations.
 * Each member keeps their own unread counter and last read time (for "Seen" receipts),
 * so listing conversations never has to count messages.
 */
const memberSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    unread: { type: Number, default: 0 },
    lastReadAt: Date,
    muted: { type: Boolean, default: false }, // no pop-ups / sounds for this chat (unread still counts)
    pinned: { type: Boolean, default: false }, // shown under "Favourites" at the top of my list
    importantUnread: { type: Number, default: 0 }, // unread Important / Urgent messages -> "Important" section
    mentionUnread: { type: Number, default: 0 }, // unread messages that @mention me
    folder: { type: mongoose.Schema.Types.ObjectId, ref: 'ChatFolder', default: null }, // my own folder for this chat
    joinedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const conversationSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['direct', 'group'], required: true },
    name: { type: String, trim: true }, // groups only
    // Direct chats: both user ids sorted and joined, so the same pair always gets the same conversation
    directKey: String,
    members: [memberSchema],
    admins: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // groups: can rename and add / remove people
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    lastMessage: {
      text: String,
      sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      at: Date,
    },
    lastMessageAt: { type: Date, default: Date.now }, // sort key for the conversation list
  },
  { timestamps: true }
);

conversationSchema.index({ 'members.user': 1, lastMessageAt: -1 });
conversationSchema.index({ directKey: 1 }, { unique: true, partialFilterExpression: { type: 'direct' } });

const messageSchema = new mongoose.Schema(
  {
    conversation: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // empty for system messages
    type: { type: String, enum: ['text', 'system'], default: 'text' },
    text: { type: String, default: '' },
    priority: { type: String, enum: CHAT_PRIORITIES, default: 'standard' },
    mentions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // @tagged members
    replyTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' }, // quoted message
    // A photo or document (file bytes live in GridFS, see chat.storage.js)
    attachment: {
      type: new mongoose.Schema(
        {
          fileId: mongoose.Schema.Types.ObjectId,
          name: String,
          size: Number,
          contentType: String,
          kind: { type: String, enum: ['image', 'file'] },
          expiresAt: Date, // the file is removed then; the message stays with "file no longer available"
          removedAt: Date,
        },
        { _id: false }
      ),
      default: undefined,
    },
    reactions: [{ emoji: String, user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, _id: false }],
    editedAt: Date,
    urgentPingAt: Date, // last repeat notification of an unread Urgent message (see chat.jobs.js)
    deletedAt: Date, // "This message was deleted" (text, reply and reactions are cleared)
  },
  { timestamps: true }
);

messageSchema.index({ conversation: 1, createdAt: -1 });
messageSchema.index({ sender: 1 });
messageSchema.index({ 'attachment.fileId': 1 }, { sparse: true });
messageSchema.index({ 'attachment.expiresAt': 1 }, { sparse: true });
messageSchema.index({ createdAt: -1 }, { partialFilterExpression: { priority: 'urgent' }, name: 'urgent_recent' });
// Retention: MongoDB deletes messages automatically once they are older than CHAT_RETENTION_DAYS
messageSchema.index({ createdAt: 1 }, { expireAfterSeconds: CHAT_RETENTION_DAYS * 24 * 60 * 60 });

/*
 * A user's own folder in the chat list ("Sales", "Clients"…). Only its owner sees it.
 * Which folder a chat is in is stored on the member (members.folder), one folder per chat.
 */
const chatFolderSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true, trim: true },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);
chatFolderSchema.index({ user: 1, order: 1 });

/*
 * Saved messages ("bookmarks"), each user's own, optionally in their own saved-message folders
 * (separate from the chat-list folders). Only a reference is kept: if the message is deleted,
 * expires or the user leaves the chat, the saved item shows as no longer available.
 */
const savedFolderSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true, trim: true },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);
savedFolderSchema.index({ user: 1, order: 1 });

const savedMessageSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    message: { type: mongoose.Schema.Types.ObjectId, ref: 'Message', required: true },
    conversation: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true },
    folder: { type: mongoose.Schema.Types.ObjectId, ref: 'SavedFolder', default: null },
  },
  { timestamps: true }
);
savedMessageSchema.index({ user: 1, message: 1 }, { unique: true });
savedMessageSchema.index({ user: 1, createdAt: -1 });

export const directKeyFor = (a, b) => [String(a), String(b)].sort().join(':');

export const Conversation = mongoose.model('Conversation', conversationSchema);
export const Message = mongoose.model('Message', messageSchema);
export const ChatFolder = mongoose.model('ChatFolder', chatFolderSchema);
export const SavedFolder = mongoose.model('SavedFolder', savedFolderSchema);
export const SavedMessage = mongoose.model('SavedMessage', savedMessageSchema);
