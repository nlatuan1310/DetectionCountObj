import axios from 'axios';

/**
 * Axios instance chung cho toàn bộ ứng dụng.
 * Quản lý base URL, headers, và interceptors.
 */
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Response interceptor — log lỗi
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.detail || error.message || 'Lỗi không xác định';
    console.error('[API Error]', message);
    return Promise.reject(error);
  }
);

export default apiClient;
