import { Conversation, Message } from './chat.model.js';
import { emitToUsers } from './chat.socket.js';
import { deleteFile } from './chat.storage.js';
import { CHAT_URGENT_FOR_MINUTES, CHAT_URGENT_REPEAT_MINUTES } from '../constants/index.js';

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;

/*
 * Removes chat files older than CHAT_FILE_RETENTION_DAYS (their messages stay and show
 * "file no longer available"). Messages themselves are removed by the TTL index after a year.
 */
export async function removeExpiredChatFiles() {
  let removed = 0;
  for (;;) {
    const batch = await Message.find({ 'attachment.expiresAt': { $lte: new Date() }, 'attachment.removedAt': null }).limit(100);
    if (!batch.length) break;
    for (const message of batch) {
      await deleteFile(message.attachment.fileId);
      message.attachment.removedAt = new Date();
      await message.save();
      removed += 1;
      const conversation = await Conversation.findById(message.conversation).select('members.user');
      if (conversation) {
        emitToUsers(
          conversation.members.map((m) => m.user),
          'message:file-removed',
          { conversationId: String(conversation._id), messageId: String(message._id) }
        );
      }
    }
  }
  return removed;
}

/*
 * Urgent messages: everyone who hasn't read it yet is notified again every CHAT_URGENT_REPEAT_MINUTES
 * for CHAT_URGENT_FOR_MINUTES (like Teams). Runs every minute; returns how many people were notified.
 * (On a host that sleeps when idle, e.g. a free plan, repeats stop while the server is asleep.)
 */
export async function pingUrgentMessages(now = new Date()) {
  const repeatMs = CHAT_URGENT_REPEAT_MINUTES * MINUTE_MS;
  const since = new Date(now.getTime() - CHAT_URGENT_FOR_MINUTES * MINUTE_MS);
  const due = new Date(now.getTime() - repeatMs);
  const messages = await Message.find({
    priority: 'urgent',
    deletedAt: null,
    createdAt: { $gte: since, $lte: due },
    $or: [{ urgentPingAt: null }, { urgentPingAt: { $lte: due } }],
  })
    .populate('sender', 'firstName lastName avatar')
    .limit(200);

  let notified = 0;
  for (const message of messages) {
    // Claim this round (another server, if any, won't send it twice)
    const claimed = await Message.updateOne({ _id: message._id, urgentPingAt: message.urgentPingAt ?? null }, { $set: { urgentPingAt: now } });
    if (!claimed.modifiedCount) continue;

    const conversation = await Conversation.findById(message.conversation).select('members.user members.lastReadAt');
    if (!conversation) continue;
    const unread = conversation.members
      .filter((m) => String(m.user) !== String(message.sender?._id) && (!m.lastReadAt || m.lastReadAt < message.createdAt))
      .map((m) => m.user);
    if (!unread.length) continue;

    emitToUsers(unread, 'message:urgent', {
      conversationId: String(conversation._id),
      message: {
        _id: String(message._id),
        text: message.text,
        attachment: message.attachment ? { kind: message.attachment.kind, name: message.attachment.name } : undefined,
        priority: 'urgent',
        sender: message.sender,
        createdAt: message.createdAt,
      },
    });
    notified += unread.length;
  }
  return notified;
}

export function startChatJobs() {
  const run = () => removeExpiredChatFiles().catch((error) => console.error('Chat file clean-up failed:', error.message));
  run();
  setInterval(run, HOUR_MS).unref();
  const urgent = () => pingUrgentMessages().catch((error) => console.error('Urgent repeat failed:', error.message));
  setInterval(urgent, MINUTE_MS).unref();
}
