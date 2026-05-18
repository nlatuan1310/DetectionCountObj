import apiClient from './apiClient';

/**
 * Service gọi API quản lý Projects (đợt thu thập dữ liệu).
 */

export const getProjects = async () => {
  const response = await apiClient.get('/projects');
  return response.data;
};

export const createProject = async ({ name, description }) => {
  const response = await apiClient.post('/projects', { name, description });
  return response.data;
};

export const getProject = async (projectId) => {
  const response = await apiClient.get(`/projects/${projectId}`);
  return response.data;
};

export const deleteProject = async (projectId) => {
  await apiClient.delete(`/projects/${projectId}`);
};
