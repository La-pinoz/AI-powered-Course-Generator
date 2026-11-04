import mongoose from 'mongoose';

const { ObjectId, Mixed } = mongoose.Schema.Types;

export const VIDEO_STATUSES = ['searching', 'ready', 'none', 'failed'];

// One YouTube result. Only videoId, title, channelTitle and durationSec of approved ones reach the client.
const videoCandidateSchema = new mongoose.Schema(
  {
    videoId: { type: String, required: true },
    title: { type: String },
    channelTitle: { type: String },
    description: { type: String }, // cut to 300 characters; kept so ranking can re-run without a call
    durationSec: { type: Number },
    viewCount: { type: Number, default: null }, // null when hidden
    likeCount: { type: Number, default: null }, // null when hidden
    publishedAt: { type: Date },
  },
  { _id: false },
);

// The module's video (Spec 7). `null` on the module means it hasn't been searched yet.
const moduleVideoSchema = new mongoose.Schema(
  {
    status: { type: String, enum: VIDEO_STATUSES, required: true },
    query: { type: String }, // the latest search phrase
    candidates: { type: [videoCandidateSchema], default: [] },
    approvedIds: { type: [String], default: [] }, // best first
    selectedVideoId: { type: String, default: null },
    searchCount: { type: Number, default: 0 }, // successful search.list calls
    lostAllVideos: { type: Boolean, default: false }, // reopens one Search again; cleared by the next claim
    startedAt: { type: Date }, // identifies the job that owns the record
    fetchedAt: { type: Date }, // details saved; a retry can skip videos.list
    checkedAt: { type: Date }, // last successful refresh of the details
    errorKind: { type: String }, // 'quota' | 'busy' | 'timeout' | 'failed' | 'interrupted': picks the safe message
    lastError: { type: String }, // server-only, never sent to the client
  },
  { _id: false },
);

const moduleSchema = new mongoose.Schema(
  {
    course: { type: ObjectId, ref: 'Course', required: true, index: true },
    title: { type: String, required: true, trim: true },
    order: { type: Number, required: true }, // 1-based
    lessons: [{ type: ObjectId, ref: 'Lesson' }], // in order
    video: { type: moduleVideoSchema, default: null },
    // Reserved for a later session; null until then.
    sideQuest: { type: Mixed, default: null }, // {items: [{kind, title, body, searchTerms}], generatedAt}
  },
  { timestamps: true },
);

export default mongoose.model('Module', moduleSchema);
