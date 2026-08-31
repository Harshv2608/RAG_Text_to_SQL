import axios from 'axios';

// Ensure this matches the gateway port or deployment URL
const GATEWAY_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const api = axios.create({
  baseURL: GATEWAY_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

let cachedAdminKey: string | null = null;

export const checkHealth = async () => {
  const res = await api.get('/health');
  return res.data;
};

export const submitEvalBatch = async (tier: number, rag: boolean) => {
  const res = await api.post('/eval', { tier, rag }, {
    headers: {
      'x-admin-key': cachedAdminKey || ''
    }
  });
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

export const getMetrics = async () => {
  const res = await api.get('/metrics');
  return res.data;
};

export const getBenchmarkSummary = async () => {
  const res = await api.get('/benchmark/summary');
  return res.data;
};

export const getConditions = async () => {
  const res = await api.get('/benchmark/conditions');
  return res.data;
};
