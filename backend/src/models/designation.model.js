import mongoose from 'mongoose';

const designationSchema = new mongoose.Schema(
  {
    title: { type: String, required: [true, 'Designation title is required'], unique: true, trim: true },
    level: { type: Number, default: 1 },
    description: String,
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Designation = mongoose.model('Designation', designationSchema);
