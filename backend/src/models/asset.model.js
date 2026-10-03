import mongoose from 'mongoose';
import { ASSET_CATEGORIES, ASSET_STATUS } from '../constants/index.js';

const assetSchema = new mongoose.Schema(
  {
    assetTag: { type: String, unique: true },
    name: { type: String, required: [true, 'Asset name is required'], trim: true },
    category: { type: String, enum: ASSET_CATEGORIES, default: 'other' },
    brand: String,
    serialNumber: String,
    purchaseDate: String,
    purchaseCost: Number,
    status: { type: String, enum: ASSET_STATUS, default: 'available' },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    assignedDate: String,
    notes: String,
  },
  { timestamps: true }
);

export const Asset = mongoose.model('Asset', assetSchema);
