import config from './config/env.js';
import connectDB from './config/db.js';
import app from './app.js';
import { recoverStaleLessons } from './services/lessonQueue.js';
import { recoverStaleAudio } from './services/audioJobs.js';
import { sweepOrphans } from './services/audioStorage.js';

if (!config.youtubeApiKey) {
  console.warn('[config] YOUTUBE_API_KEY is not set: saved module videos still show, but new searches are unavailable.');
}

await connectDB();
await recoverStaleLessons();
await recoverStaleAudio(); // Hinglish audio jobs a restart interrupted become 'failed'
sweepOrphans().catch((err) => console.warn('[audio] orphan sweep failed:', err.message));
app.listen(config.port, () => {
  console.log(`[server] Listening on http://localhost:${config.port}`);
});
