import config from './config/env.js';
import connectDB from './config/db.js';
import app from './app.js';
import { recoverStaleLessons } from './services/lessonQueue.js';
import { recoverStaleAudio } from './services/audioJobs.js';
import { sweepOrphans } from './services/audioStorage.js';

await connectDB();
await recoverStaleLessons();
await recoverStaleAudio(); // Hinglish audio jobs a restart interrupted become 'failed'
sweepOrphans().catch((err) => console.warn('[audio] orphan sweep failed:', err.message));
app.listen(config.port, () => {
  console.log(`[server] Listening on http://localhost:${config.port}`);
});
