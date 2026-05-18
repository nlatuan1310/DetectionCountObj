import apiClient from './apiClient';

/**
 * Service quản lý Dataset Versions API.
 */

export const listVersions = async (projectId) => {
  const res = await apiClient.get(`/projects/${projectId}/versions`);
  return res.data;
};

export const createVersion = async (projectId, data) => {
  const res = await apiClient.post(`/projects/${projectId}/versions`, data);
  return res.data;
};

export const getVersionDetail = async (projectId, versionId) => {
  const res = await apiClient.get(`/projects/${projectId}/versions/${versionId}`);
  return res.data;
};

export const generateVersion = async (projectId, versionId, config = {}) => {
  const res = await apiClient.post(
    `/projects/${projectId}/versions/${versionId}/generate`,
    config
  );
  return res.data;
};

export const deleteVersion = async (projectId, versionId) => {
  await apiClient.delete(`/projects/${projectId}/versions/${versionId}`);
};

export const previewAugmentation = async (projectId, augmentation_config) => {
  const res = await apiClient.post(`/projects/${projectId}/preview-augmentation`, {
    augmentation_config
  });
  return res.data; // { image_base64: "..." }
};
