import { z } from 'zod';
import { CHAT_GROUP_MAX_MEMBERS, CHAT_MESSAGE_MAX_LENGTH, CHAT_REACTIONS } from '../constants/index.js';
import { objectId, optionalObjectId, optionalText, requiredText } from '../validators/common.js';

const userIds = z
  .array(objectId('person'), { required_error: 'Select at least one person' })
  .min(1, 'Select at least one person')
  .max(CHAT_GROUP_MAX_MEMBERS, `A group can have at most ${CHAT_GROUP_MAX_MEMBERS} people`);

export const directChatSchema = z.object({ userId: objectId('person') });

export const groupChatSchema = z.object({
  name: requiredText('Group name', { max: 80 }),
  userIds,
});

export const renameGroupSchema = z.object({ name: requiredText('Group name', { max: 80 }) });

export const addMembersSchema = z.object({ userIds });

const messageText = requiredText('Message', { max: CHAT_MESSAGE_MAX_LENGTH });

export const messageSchema = z.object({ text: messageText, replyTo: optionalObjectId('message') });

export const editMessageSchema = z.object({ text: messageText });

// Sent as form fields next to the file; the caption is optional
export const attachmentMessageSchema = z.object({
  text: optionalText('Message', CHAT_MESSAGE_MAX_LENGTH),
  replyTo: optionalObjectId('message'),
});

export const reactionSchema = z.object({ emoji: z.enum(CHAT_REACTIONS, { errorMap: () => ({ message: 'Pick one of the reactions' }) }) });

export const muteSchema = z.object({ muted: z.boolean({ required_error: 'muted is required' }) });
