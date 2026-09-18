import { api } from './api';

export const getDatasetSchema = async () => {
  const res = await api.get(`/dataset/schema`);
  return res.data;
};

export const getDatasetQueries = async () => {
  const res = await api.get(`/dataset/queries`);
  return res.data;
};
