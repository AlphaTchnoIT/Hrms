import mongoose from 'mongoose';
import { HOLIDAY_TYPES } from '../constants/index.js';

const holidaySchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Holiday name is required'], trim: true },
    date: { type: String, required: [true, 'Date is required'] }, // "YYYY-MM-DD"
    type: { type: String, enum: HOLIDAY_TYPES, default: 'national' },
    description: String,
  },
  { timestamps: true }
);

holidaySchema.index({ date: 1, name: 1 }, { unique: true });

export const Holiday = mongoose.model('Holiday', holidaySchema);
