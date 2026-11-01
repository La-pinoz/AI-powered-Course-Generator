import express from 'express';
import cors from 'cors';
import config from './config/env.js';
import connectDB from './config/db.js';
import healthRoutes from './routes/healthRoutes.js';
import userRoutes from './routes/userRoutes.js';
import errorHandler from './middlewares/errorHandler.js';

const app = express();

app.use(cors({ origin: config.clientOrigin }));
app.use(express.json());

app.use('/api/health', healthRoutes);
app.use('/api/users', userRoutes);

app.use(errorHandler);

await connectDB();
app.listen(config.port, () => {
  console.log(`[server] Listening on http://localhost:${config.port}`);
});
