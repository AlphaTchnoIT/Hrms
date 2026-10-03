import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    message: String,
    link: String,
    isRead: { type: Boolean, default: false },
    dedupeKey: String, // set by automatic reminders so the same reminder is sent only once
  },
  { timestamps: true }
);

notificationSchema.index({ user: 1, createdAt: -1 });
notificationSchema.index({ dedupeKey: 1 }, { unique: true, sparse: true });

export const Notification = mongoose.model('Notification', notificationSchema);
