import mongoose from 'mongoose';

const { ObjectId, Mixed } = mongoose.Schema.Types;

const lessonSchema = new mongoose.Schema(
  {
    course: { type: ObjectId, ref: 'Course', required: true, index: true }, // for cascade delete
    module: { type: ObjectId, ref: 'Module', required: true, index: true },
    title: { type: String, required: true, trim: true },
    order: { type: Number, required: true }, // 1-based within the module
    objectives: [String], // from the outline
    content: { type: [Mixed], default: [] }, // filled by a later spec
    isEnriched: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export default mongoose.model('Lesson', lessonSchema);
