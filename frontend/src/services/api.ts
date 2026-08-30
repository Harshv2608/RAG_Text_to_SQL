import axios from 'axios';

// Ensure this matches the gateway port
const GATEWAY_URL = 'http://localhost:3000';

export const api = axios.create({
  baseURL: GATEWAY_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

export const checkHealth = async () => {
  const res = await api.get('/health');
  return res.data;
};

export const submitQuery = async (payload: { question: string, tier: 1|2|3, rag_enabled: boolean }) => {
  const res = await api.post('/query', payload);
  return res.data;
};

export const checkQueryStatus = async (jobId: string) => {
  const res = await api.get(`/query/${jobId}/status`);
  return res.data;
};

export const submitEvalBatch = async (payload: { question: string, tier: 1|2|3, rag_enabled: boolean, question_id: string }[]) => {
  const res = await api.post('/eval', payload);
  return res.data;
};

export const getMetrics = async () => {
  const res = await api.get('/metrics');
  return res.data;
};

export const getBenchmarkSummary = async () => {
  const res = await api.get('/benchmark/summary');
  return res.data;
};
