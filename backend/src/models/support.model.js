import mongoose from 'mongoose';
import {
  GRIEVANCE_CATEGORIES,
  GRIEVANCE_STATUS,
  SUGGESTION_STATUS,
  SUGGESTION_TYPES,
  TICKET_CATEGORIES,
  TICKET_PRIORITY,
  TICKET_STATUS,
} from '../constants/index.js';

const ref = (model) => ({ type: mongoose.Schema.Types.ObjectId, ref: model });

const messageSchema = new mongoose.Schema(
  {
    by: ref('User'),
    message: { type: String, required: true, trim: true },
    isInternal: { type: Boolean, default: false }, // internal note, hidden from the requester
  },
  { timestamps: true }
);

const ticketSchema = new mongoose.Schema(
  {
    ticketNo: { type: String, unique: true },
    raisedBy: { ...ref('User'), required: true },
    category: { type: String, enum: TICKET_CATEGORIES, required: true },
    priority: { type: String, enum: TICKET_PRIORITY, default: 'medium' },
    subject: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    assetTag: String,
    status: { type: String, enum: TICKET_STATUS, default: 'open' },
    assignedTo: ref('User'),
    comments: [messageSchema],
    resolvedAt: Date,
    resolution: String,
  },
  { timestamps: true }
);

ticketSchema.index({ raisedBy: 1, createdAt: -1 });
ticketSchema.index({ status: 1 });

export const Ticket = mongoose.model('Ticket', ticketSchema);

// Confidential: visible only to the submitter and HR. Anonymous grievances hide the submitter from HR.
const grievanceSchema = new mongoose.Schema(
  {
    refNo: { type: String, unique: true },
    submittedBy: { ...ref('User'), required: true },
    isAnonymous: { type: Boolean, default: false },
    category: { type: String, enum: GRIEVANCE_CATEGORIES, required: true },
    subject: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    status: { type: String, enum: GRIEVANCE_STATUS, default: 'submitted' },
    responses: [messageSchema],
    resolution: String,
    handledBy: ref('User'),
  },
  { timestamps: true }
);

export const Grievance = mongoose.model('Grievance', grievanceSchema);

const suggestionSchema = new mongoose.Schema(
  {
    submittedBy: { ...ref('User'), required: true },
    type: { type: String, enum: SUGGESTION_TYPES, default: 'suggestion' },
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    status: { type: String, enum: SUGGESTION_STATUS, default: 'new' },
    response: String,
    respondedBy: ref('User'),
  },
  { timestamps: true }
);

export const Suggestion = mongoose.model('Suggestion', suggestionSchema);
