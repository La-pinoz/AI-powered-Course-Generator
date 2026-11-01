import mongoose from 'mongoose';

const { ObjectId } = mongoose.Schema.Types;

const moduleSchema = new mongoose.Schema(
  {
    course: { type: ObjectId, ref: 'Course', required: true, index: true },
    title: { type: String, required: true, trim: true },
    order: { type: Number, required: true }, // 1-based
    lessons: [{ type: ObjectId, ref: 'Lesson' }], // in order
  },
  { timestamps: true },
);

export default mongoose.model('Module', moduleSchema);
