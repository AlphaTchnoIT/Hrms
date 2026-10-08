import { Router } from 'express';
import { requireFeature } from '../middlewares/auth.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import {
  addMembers,
  createFolder,
  createGroup,
  createSavedFolder,
  deleteFolder,
  deleteMessage,
  deleteSavedFolder,
  downloadFile,
  editMessage,
  getConversation,
  getPresence,
  getUnreadTotal,
  listConversations,
  listFolders,
  listMessages,
  listSaved,
  markRead,
  moveToFolder,
  openDirectChat,
  removeMember,
  renameFolder,
  renameGroup,
  renameSavedFolder,
  reorderFolders,
  saveMessage,
  searchMessages,
  sendAttachment,
  sendMessage,
  setMuted,
  setPinned,
  toggleReaction,
  unsaveMessage,
} from './chat.controller.js';
import {
  addMembersSchema,
  attachmentMessageSchema,
  directChatSchema,
  editMessageSchema,
  folderOrderSchema,
  folderSchema,
  groupChatSchema,
  messageSchema,
  moveToFolderSchema,
  muteSchema,
  pinSchema,
  reactionSchema,
  renameGroupSchema,
  saveMessageSchema,
} from './chat.validator.js';
import { receiveFile } from './chat.upload.js';

// Employee chat (1-to-1 and groups). Live updates go out over Socket.IO, see chat.socket.js
const router = Router();
router.use(requireFeature('chat'));

router.get('/conversations', listConversations);
router.post('/conversations/direct', validate(directChatSchema), openDirectChat);
router.post('/conversations/group', validate(groupChatSchema), createGroup);
router.get('/conversations/:id', getConversation);
router.patch('/conversations/:id', validate(renameGroupSchema), renameGroup);
router.post('/conversations/:id/members', validate(addMembersSchema), addMembers);
router.delete('/conversations/:id/members/:userId', removeMember);
router.get('/conversations/:id/messages', listMessages);
router.post('/conversations/:id/messages', validate(messageSchema), sendMessage);
router.post('/conversations/:id/attachments', receiveFile, validate(attachmentMessageSchema), sendAttachment);
router.get('/files/:fileId', downloadFile);
router.post('/conversations/:id/read', markRead);
router.patch('/conversations/:id/mute', validate(muteSchema), setMuted);
router.patch('/conversations/:id/pin', validate(pinSchema), setPinned);
router.patch('/conversations/:id/folder', validate(moveToFolderSchema), moveToFolder);
router.get('/folders', listFolders);
router.post('/folders', validate(folderSchema), createFolder);
router.put('/folders/order', validate(folderOrderSchema), reorderFolders);
router.patch('/folders/:folderId', validate(folderSchema), renameFolder);
router.delete('/folders/:folderId', deleteFolder);
router.patch('/messages/:id', validate(editMessageSchema), editMessage);
router.post('/messages/:id/reactions', validate(reactionSchema), toggleReaction);
router.delete('/messages/:id', deleteMessage);
router.get('/search', searchMessages);
router.get('/saved', listSaved);
router.post('/saved', validate(saveMessageSchema), saveMessage);
router.delete('/saved/:messageId', unsaveMessage);
router.post('/saved-folders', validate(folderSchema), createSavedFolder);
router.patch('/saved-folders/:folderId', validate(folderSchema), renameSavedFolder);
router.delete('/saved-folders/:folderId', deleteSavedFolder);
router.get('/unread', getUnreadTotal);
router.get('/presence', getPresence);

export default router;
