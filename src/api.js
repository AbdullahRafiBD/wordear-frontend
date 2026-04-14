import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle response errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  googleLogin: (idToken) => api.post('/auth/google', { id_token: idToken }),
  logout: () => api.post('/auth/logout'),
  getUser: () => api.get('/user'),
};

export const wordsAPI = {
  getAllWords: () => api.get('/words'),
  getWordsByLetter: (letter) => {
    console.log('🔍 Fetching words for letter:', letter);
    return api.get(`/words/${letter}`).catch(error => {
      console.error('❌ Words API Error:', {
        status: error.response?.status,
        message: error.response?.data?.message || error.message,
        endpoint: `${API_BASE_URL}/words/${letter}`,
        headers: error.response?.headers,
      });
      throw error;
    });
  },
};

export const attemptsAPI = {
  saveAttempts: async (attempts) => {
    console.log('💾 Saving attempts to backend:', attempts);
    try {
      const response = await api.post('/attempts', { attempts });
      console.log('✅ Attempts saved successfully:', response.data);
      return response;
    } catch (error) {
      console.error('❌ Failed to save attempts:', error.response?.data || error.message);
      throw error;
    }
  },
  getAllAttempts: () => api.get('/attempts'),
  getAttemptsByCategory: (category) => api.get(`/attempts/category/${category}`),
  getStats: () => api.get('/attempts/stats'),
  deleteAttempt: (word, category) => api.delete(`/attempts/${encodeURIComponent(word)}/${encodeURIComponent(category)}`),
};

export const groupsAPI = {
  getGroups: () => api.get('/groups'),
  createGroup: (data) => api.post('/groups', data),
  getGroup: (id) => api.get(`/groups/${id}`),
  updateGroup: (id, data) => api.put(`/groups/${id}`, data),
  deleteGroup: (id) => api.delete(`/groups/${id}`),
  addItem: (groupId, data) => api.post(`/groups/${groupId}/items`, data),
  updateItem: (groupId, itemId, data) => api.put(`/groups/${groupId}/items/${itemId}`, data),
  deleteItem: (groupId, itemId) => api.delete(`/groups/${groupId}/items/${itemId}`),
};

export const shadowingAPI = {
  getLevels: () => api.get('/shadowing/levels'),
  getSentences: (levelId) => api.get(`/shadowing/levels/${levelId}/sentences`),
  saveAttempts: async (attempts) => {
    try {
      const response = await api.post('/shadowing/attempts', { attempts });
      return response;
    } catch (error) {
      console.error('Failed to save shadowing attempts:', error.response?.data || error.message);
      throw error;
    }
  },
  getAllAttempts: () => api.get('/shadowing/attempts'),
  getStats: () => api.get('/shadowing/stats'),
  deleteAttempt: (id) => api.delete(`/shadowing/attempts/${id}`),
};

export default api;

