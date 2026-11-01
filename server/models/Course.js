import mongoose from 'mongoose';

const courseSchema = new mongoose.Schema(
  {
    creator: { type: String, required: true, index: true }, // User.auth0Id (Auth0 `sub`)
    topic: { type: String, required: true, trim: true, minlength: 2, maxlength: 200 }, // what the user typed
    title: { type: String, required: true, trim: true }, // AI-generated
    description: { type: String, trim: true },
    depth: { type: String, enum: ['quick', 'standard', 'in-depth'], required: true },
    options: {
      sideQuest: { type: Boolean, default: false },
      hinglishAudio: { type: Boolean, default: false },
    },
    modules: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Module' }], // in order
    moduleCount: { type: Number, required: true }, // denormalised for the list endpoint
    lessonCount: { type: Number, required: true },
    // Progress lives on the course: one owner per course, so one progress record per course.
    progress: {
      completedLessons: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Lesson' }],
      currentLesson: { type: mongoose.Schema.Types.ObjectId, ref: 'Lesson', default: null },
    },
    lastActivityAt: { type: Date, default: Date.now }, // created, or last progress change
  },
  { timestamps: true },
);

courseSchema.index({ creator: 1, lastActivityAt: -1 });

export default mongoose.model('Course', courseSchema);
