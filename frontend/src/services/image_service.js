import apiClient from './apiClient';

/**
 * Service gọi API quản lý Images.
 */

export const getProjectImages = async (projectId) => {
  const response = await apiClient.get(`/projects/${projectId}/images`);
  return response.data;
};

export const uploadImages = async (projectId, files, isBackground = false) => {
  const formData = new FormData();
  files.forEach((file) => formData.append('files', file));

  const response = await apiClient.post(
    `/projects/${projectId}/images?is_background=${isBackground}`,
    formData,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000, // Upload timeout 2 phút
    }
  );
  return response.data;
};

export const deleteImage = async (imageId) => {
  await apiClient.delete(`/images/${imageId}`);
};

export const toggleGolden = async (imageId) => {
  const response = await apiClient.patch(`/images/${imageId}/golden`);
  return response.data;
};

export const getBackgroundImages = async () => {
  const response = await apiClient.get('/background-images');
  return response.data;
};
