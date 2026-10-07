import mongoose from 'mongoose';

/*
 * Where chat files are kept. For now: MongoDB GridFS (no outside service, nothing extra to run).
 * Everything that touches the bytes is in this file, so moving to our own file server later
 * (e.g. MinIO on a VPS) means rewriting only these functions.
 */

const BUCKET = 'chatFiles';
const bucket = () => new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: BUCKET });

// Saves the bytes and returns the new file id
export function saveFile(buffer, { filename, contentType, metadata = {} }) {
  return new Promise((resolve, reject) => {
    const upload = bucket().openUploadStream(filename, { metadata: { ...metadata, contentType } });
    upload.once('error', reject);
    upload.once('finish', () => resolve(upload.id));
    upload.end(buffer);
  });
}

export function openFile(fileId) {
  return bucket().openDownloadStream(new mongoose.Types.ObjectId(String(fileId)));
}

// Never throws: a missing file is already "deleted"
export async function deleteFile(fileId) {
  if (!fileId) return;
  try {
    await bucket().delete(new mongoose.Types.ObjectId(String(fileId)));
  } catch (error) {
    if (!/FileNotFound|File not found/i.test(error.message)) console.error('Chat file delete failed:', error.message);
  }
}

// Bytes used by all chat files (for the company-wide limit)
export async function totalStoredBytes() {
  const [result] = await mongoose.connection.db
    .collection(`${BUCKET}.files`)
    .aggregate([{ $group: { _id: null, bytes: { $sum: '$length' } } }])
    .toArray();
  return result?.bytes || 0;
}
