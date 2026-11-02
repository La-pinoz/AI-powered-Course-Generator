import mongoose from 'mongoose';

const { ObjectId, Mixed } = mongoose.Schema.Types;

export const LESSON_STATUSES = ['pending', 'generating', 'ready', 'failed'];
export const AUDIO_STATUSES = ['generating', 'ready', 'failed'];
export const AUDIO_STAGES = ['script', 'voice'];

// Hinglish audio of one lesson (Spec 6). `null` on the lesson means no audio yet ('none').
// Only status, stage, script, durationSec, voice and generatedAt are ever sent to the client.
const audioSchema = new mongoose.Schema(
  {
    status: { type: String, enum: AUDIO_STATUSES, required: true },
    stage: { type: String, enum: [...AUDIO_STAGES, null], default: null },
    language: { type: String, default: 'hinglish' },
    script: { type: [String], default: undefined }, // validated segments, set when ready
    fileId: { type: ObjectId }, // GridFS file in the `lessonAudio` bucket; never sent to the client
    mimeType: { type: String },
    bytes: { type: Number },
    durationSec: { type: Number },
    voice: { type: String },
    scriptModel: { type: String },
    ttsModel: { type: String },
    pipelineVersion: { type: Number },
    sourceHash: { type: String }, // SHA-256 of buildAudioSource(lesson); the cache key
    startedAt: { type: Date },
    generatedAt: { type: Date },
    attempts: { type: Number, default: 0 },
    errorKind: { type: String }, // 'busy' | 'failed' | 'timeout' | 'empty': picks the safe message
    lastError: { type: String }, // server-only, never sent to the client
  },
  { _id: false },
);

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
    audio: { type: audioSchema, default: null }, // Hinglish audio (Spec 6)
  },
  { timestamps: true },
);

// The queue's recovery scan and pending-lesson lookup.
lessonSchema.index({ course: 1, status: 1 });
// The boot scan for audio jobs a restart interrupted.
lessonSchema.index({ 'audio.status': 1 }, { sparse: true });

export default mongoose.model('Lesson', lessonSchema);
