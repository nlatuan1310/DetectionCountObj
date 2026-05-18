import apiClient from './apiClient';

/**
 * Service gọi API quản lý Annotations (bounding boxes).
 */

export const getAnnotations = async (imageId) => {
  const response = await apiClient.get(`/images/${imageId}/annotations`);
  return response.data;
};

export const createAnnotations = async (imageId, annotations) => {
  const response = await apiClient.post(`/images/${imageId}/annotations`, {
    annotations,
  });
  return response.data;
};

export const updateAnnotation = async (annotationId, data) => {
  const response = await apiClient.put(`/annotations/${annotationId}`, data);
  return response.data;
};

export const deleteAnnotation = async (annotationId) => {
  await apiClient.delete(`/annotations/${annotationId}`);
};
