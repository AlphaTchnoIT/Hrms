import mongoose from 'mongoose';
import { EXPENSE_CATEGORIES, EXPENSE_STATUS } from '../constants/index.js';

const expenseSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: [true, 'Title is required'], trim: true },
    category: { type: String, enum: EXPENSE_CATEGORIES, default: 'other' },
    amount: { type: Number, required: [true, 'Amount is required'], min: [0.01, 'Amount must be positive'] },
    miles: { type: Number, min: 0 }, // mileage claims: amount = miles x HMRC approved rate
    expenseDate: { type: String, required: [true, 'Expense date is required'] }, // "YYYY-MM-DD"
    description: String,
    receiptUrl: String,
    status: { type: String, enum: EXPENSE_STATUS, default: 'pending' },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: Date,
    reviewNote: String,
    reimbursedAt: Date,
  },
  { timestamps: true }
);

export const Expense = mongoose.model('Expense', expenseSchema);
