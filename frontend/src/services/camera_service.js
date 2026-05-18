import apiClient from './apiClient';

/**
 * Camera Service — Giao tiếp API camera & inference.
 */

export const connectCamera = async (ip, username, password, channel = 1, streamType = 1) => {
  const response = await apiClient.post('/camera/connect', {
    ip,
    username,
    password,
    channel,
    stream_type: streamType,
  });
  return response.data;
};

export const disconnectCamera = async () => {
  const response = await apiClient.post('/camera/disconnect');
  return response.data;
};

export const getCameraStatus = async () => {
  const response = await apiClient.get('/camera/status');
  return response.data;
};

export const getInferenceStatus = async () => {
  const response = await apiClient.get('/inference/status');
  return response.data;
};

export const updateInferenceConfig = async (config) => {
  const response = await apiClient.post('/inference/config', config);
  return response.data;
};

export const updateZones = async (zoneConfig) => {
  const response = await apiClient.post('/inference/zones', zoneConfig);
  return response.data;
};

export const swapModel = async (modelPath) => {
  const response = await apiClient.post(`/inference/swap-model?model_path=${encodeURIComponent(modelPath)}`);
  return response.data;
};
