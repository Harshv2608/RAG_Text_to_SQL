import express from 'express';
import cors from 'cors';
import queryRouter from './routes/query';
import evalRouter from './routes/eval';
import healthRouter from './routes/health';
import metricsRouter from './routes/metrics';
import benchmarkRouter from './routes/benchmark';
import dotenv from 'dotenv';
dotenv.config();

export const app = express();

app.use(cors());
app.use(express.json());

app.use('/query', queryRouter);
app.use('/eval', evalRouter);
app.use('/health', healthRouter);
app.use('/metrics', metricsRouter);
app.use('/benchmark', benchmarkRouter);

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`Gateway listening on port ${PORT}`));
}
