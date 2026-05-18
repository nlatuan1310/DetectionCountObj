import apiClient from './apiClient';

/**
 * Service gọi API quản lý Classes (loại sản phẩm).
 */

export const getClasses = async () => {
  const response = await apiClient.get('/classes');
  return response.data;
};

export const createClass = async ({ name }) => {
  const response = await apiClient.post('/classes', { name });
  return response.data;
};

export const updateClass = async (classId, data) => {
  const response = await apiClient.patch(`/classes/${classId}`, data);
  return response.data;
};

export const deleteClass = async (classId) => {
  const response = await apiClient.delete(`/classes/${classId}`);
  return response.data;
};
