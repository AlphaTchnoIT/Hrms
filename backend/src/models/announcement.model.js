import mongoose from 'mongoose';
import { ANNOUNCEMENT_CATEGORIES } from '../constants/index.js';

const announcementSchema = new mongoose.Schema(
  {
    title: { type: String, required: [true, 'Title is required'], trim: true },
    content: { type: String, required: [true, 'Content is required'] },
    category: { type: String, enum: ANNOUNCEMENT_CATEGORIES, default: 'general' },
    isPinned: { type: Boolean, default: false },
    expiresAt: Date,
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export const Announcement = mongoose.model('Announcement', announcementSchema);
