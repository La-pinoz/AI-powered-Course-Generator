import mongoose from 'mongoose';

const { ObjectId, Mixed } = mongoose.Schema.Types;

export const LESSON_STATUSES = ['pending', 'generating', 'ready', 'failed'];

const lessonSchema = new mongoose.Schema(
  {
    course: { type: ObjectId, ref: 'Course', required: true, index: true }, // for cascade delete
    module: { type: ObjectId, ref: 'Module', required: true, index: true },
    title: { type: String, required: true, trim: true },
    order: { type: Number, required: true }, // 1-based within the module
    objectives: [String], // from the outline
    // Lifecycle of the content, written by the background lesson queue.
    status: { type: String, enum: LESSON_STATUSES, default: 'pending' },
    content: { type: [Mixed], default: [] }, // ordered typed blocks: explanation first, mcq last
    isEnriched: { type: Boolean, default: false }, // true together with status 'ready'
    summary: { type: String },
    videoQuery: { type: String }, // YouTube search phrase, used by the video session
    contentVersion: { type: Number, default: 1 }, // content format version
    generationStartedAt: { type: Date }, // detects a stuck 'generating' lesson after a restart
    generatedAt: { type: Date },
    attempts: { type: Number, default: 0 },
    lastError: { type: String }, // server-only, never sent to the client
    audio: { type: Mixed, default: null }, // reserved: Hinglish audio {status, url, durationSec, generatedAt}
  },
  { timestamps: true },
);

// The queue's recovery scan and pending-lesson lookup.
lessonSchema.index({ course: 1, status: 1 });

export default mongoose.model('Lesson', lessonSchema);
