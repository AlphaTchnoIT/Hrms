import mongoose from 'mongoose';
import { CHAT_RETENTION_DAYS } from '../constants/index.js';

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
    deletedAt: Date, // "This message was deleted" (text, reply and reactions are cleared)
  },
  { timestamps: true }
);

messageSchema.index({ conversation: 1, createdAt: -1 });
messageSchema.index({ sender: 1 });
messageSchema.index({ 'attachment.fileId': 1 }, { sparse: true });
messageSchema.index({ 'attachment.expiresAt': 1 }, { sparse: true });
// Retention: MongoDB deletes messages automatically once they are older than CHAT_RETENTION_DAYS
messageSchema.index({ createdAt: 1 }, { expireAfterSeconds: CHAT_RETENTION_DAYS * 24 * 60 * 60 });

export const directKeyFor = (a, b) => [String(a), String(b)].sort().join(':');

export const Conversation = mongoose.model('Conversation', conversationSchema);
export const Message = mongoose.model('Message', messageSchema);
