import mongoose from 'mongoose';
import { GOAL_STATUS } from '../constants/index.js';

// Performance goal (OKR style) with self and manager review
const goalSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: [true, 'Goal title is required'], trim: true },
    description: String,
    startDate: String,
    dueDate: String,
    weightage: { type: Number, default: 0, min: 0, max: 100 },
    progress: { type: Number, default: 0, min: 0, max: 100 },
    status: { type: String, enum: GOAL_STATUS, default: 'not-started' },
    selfRating: { type: Number, min: 1, max: 5 },
    selfComment: String,
    managerRating: { type: Number, min: 1, max: 5 },
    managerComment: String,
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export const Goal = mongoose.model('Goal', goalSchema);
