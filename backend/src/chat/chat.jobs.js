import { Conversation, Message } from './chat.model.js';
import { emitToUsers } from './chat.socket.js';
import { deleteFile } from './chat.storage.js';

const HOUR_MS = 60 * 60 * 1000;

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

export function startChatJobs() {
  const run = () => removeExpiredChatFiles().catch((error) => console.error('Chat file clean-up failed:', error.message));
  run();
  setInterval(run, HOUR_MS).unref();
}
