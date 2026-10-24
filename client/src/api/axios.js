import axios from 'axios';

const api = axios.create({
  baseURL: '/api'
});

api.interceptors.request.use(config => {
  const token = localStorage.getItem('acpro_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  const activeCompanyContext = localStorage.getItem('acpro_context_company_id');
  if (activeCompanyContext) {
    config.headers['x-company-context'] = activeCompanyContext;
  }
  return config;
});

export default api;
