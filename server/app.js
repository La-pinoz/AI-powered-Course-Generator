import express from 'express';
import cors from 'cors';
import config from './config/env.js';
import healthRoutes from './routes/healthRoutes.js';
import userRoutes from './routes/userRoutes.js';
import courseRoutes from './routes/courseRoutes.js';
import errorHandler from './middlewares/errorHandler.js';

// The Express app without connecting to the DB or listening, so tests can import it.
const app = express();

app.use(cors({ origin: config.clientOrigin }));
app.use(express.json());

app.use('/api/health', healthRoutes);
app.use('/api/users', userRoutes);
app.use('/api/courses', courseRoutes);

app.use(errorHandler);

export default app;
