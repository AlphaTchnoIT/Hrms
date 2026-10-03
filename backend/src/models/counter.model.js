import mongoose from 'mongoose';

// Used to generate sequential numbers like EMP0001, AST0001
const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
});

counterSchema.statics.next = async function next(name) {
  const counter = await this.findByIdAndUpdate(name, { $inc: { seq: 1 } }, { new: true, upsert: true });
  return counter.seq;
};

export const Counter = mongoose.model('Counter', counterSchema);

export async function generateCode(name, prefix, width = 4) {
  const seq = await Counter.next(name);
  return `${prefix}${String(seq).padStart(width, '0')}`;
}
