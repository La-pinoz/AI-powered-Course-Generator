import config from './config/env.js';
import connectDB from './config/db.js';
import app from './app.js';
import { recoverStaleLessons } from './services/lessonQueue.js';

await connectDB();
await recoverStaleLessons();
app.listen(config.port, () => {
  console.log(`[server] Listening on http://localhost:${config.port}`);
});
