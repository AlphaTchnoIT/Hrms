import mongoose from 'mongoose';

/*
 * UK go-live / compliance checklist. Each item is something the company must have in place
 * (often reviewed by its employment lawyer or accountant); admin records who reviewed it and when.
 */
export const COMPLIANCE_STATUS = ['to-do', 'in-progress', 'done', 'not-applicable'];

const complianceItemSchema = new mongoose.Schema(
  {
    key: { type: String, unique: true, sparse: true }, // built-in items; custom items have none
    category: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true },
    description: String,
    settingsLink: String, // where in the app this is configured
    status: { type: String, enum: COMPLIANCE_STATUS, default: 'to-do' },
    owner: String,
    reviewedBy: String, // e.g. "Smith & Co Solicitors" / "ABC Accountants"
    reviewedOn: String, // "YYYY-MM-DD"
    nextReviewOn: String, // "YYYY-MM-DD"; admins are reminded when it is due
    documentUrl: String,
    notes: String,
    order: { type: Number, default: 100 },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export const ComplianceItem = mongoose.model('ComplianceItem', complianceItemSchema);
