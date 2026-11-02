import mongoose from 'mongoose';

const { ObjectId, Mixed } = mongoose.Schema.Types;

const moduleSchema = new mongoose.Schema(
  {
    course: { type: ObjectId, ref: 'Course', required: true, index: true },
    title: { type: String, required: true, trim: true },
    order: { type: Number, required: true }, // 1-based
    lessons: [{ type: ObjectId, ref: 'Lesson' }], // in order
    // Reserved for later sessions; null until then.
    video: { type: Mixed, default: null }, // {query, videoId, title, channelTitle, fetchedAt}
    sideQuest: { type: Mixed, default: null }, // {items: [{kind, title, body, searchTerms}], generatedAt}
  },
  { timestamps: true },
);

export default mongoose.model('Module', moduleSchema);
