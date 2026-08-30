import { Router, Request, Response } from 'express';
import axios from 'axios';
import { sqlExecutionQueue } from '../queue/queue';

const router = Router();
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://127.0.0.1:8000';

router.get('/', async (req: Request, res: Response) => {
  let redisStatus = 'down';
  let aiServiceStatus = 'down';
  
  try {
    const client = await sqlExecutionQueue.client;
    if (client.status === 'ready') {
      redisStatus = 'up';
    } else {
      await client.ping();
      redisStatus = 'up';
    }
  } catch (e) {}
  
  try {
    // Check python backend health (assuming a generic root or health endpoint, here we just catch any response or connection)
    await axios.get(`${AI_SERVICE_URL}/`, { timeout: 2000 });
    aiServiceStatus = 'up';
  } catch (e: any) {
    if (e.response) {
      // It's up even if it 404s the root
      aiServiceStatus = 'up';
    }
  }
  
  res.json({
    status: 'ok',
    services: {
      gateway: 'up',
      redis: redisStatus,
      ai_service: aiServiceStatus
    }
  });
});

export default router;
