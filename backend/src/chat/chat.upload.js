import multer from 'multer';
import { CHAT_FILE_MAX_BYTES, CHAT_FILE_TYPES } from '../constants/index.js';
import { ApiError } from '../utils/ApiError.js';

const MAX_MB = CHAT_FILE_MAX_BYTES / 1024 / 1024;

// One file per message, kept in memory (max 5 MB) until it is saved
const single = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: CHAT_FILE_MAX_BYTES, files: 1, fields: 5 },
}).single('file');

// multipart/form-data with a "file" field (+ optional text and replyTo) -> req.file, req.body
export function receiveFile(req, res, next) {
  single(req, res, (error) => {
    if (!error) return next();
    if (error.code === 'LIMIT_FILE_SIZE') return next(ApiError.field('file', `Files can be up to ${MAX_MB} MB`));
    return next(ApiError.badRequest(error.message || 'Could not read the file'));
  });
}

const EXTENSION_TYPES = Object.fromEntries(Object.entries(CHAT_FILE_TYPES).flatMap(([type, extensions]) => extensions.map((ext) => [ext, type])));

/*
 * The type is decided by the file extension from our own list (never by what the browser claims),
 * and the name is cleaned so it is safe to show and to use as a download name.
 */
export function checkFile(originalName = '') {
  const name = originalName
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_')
    .trim()
    .slice(-120);
  const extension = name.includes('.') ? name.split('.').pop().toLowerCase() : '';
  const contentType = EXTENSION_TYPES[extension];
  if (!contentType) {
    throw ApiError.field('file', 'You can send photos (JPG, PNG, GIF, WebP), PDF, Word, Excel, PowerPoint, text and CSV files');
  }
  return { name: name || `file.${extension}`, contentType, kind: contentType.startsWith('image/') ? 'image' : 'file' };
}
