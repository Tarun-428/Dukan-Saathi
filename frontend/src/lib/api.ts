import axios from 'axios'
import { useAuthStore } from '@/stores/authStore'

const apiBaseURL = import.meta.env.VITE_API_URL || 'https://dukan-saathi.onrender.com/api/v1'

const api = axios.create({
  baseURL: apiBaseURL,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config
    if (error.response?.status === 402 && window.location.pathname !== '/subscribe') {
      window.location.href = '/subscribe'
      return Promise.reject(error)
    }
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true
      const refresh = useAuthStore.getState().refreshToken
      if (refresh) {
        try {
          const { data } = await axios.post(`${apiBaseURL}/auth/refresh`, {
            refresh_token: refresh,
          })
          useAuthStore.getState().setTokens(data.access_token, data.refresh_token)
          original.headers.Authorization = `Bearer ${data.access_token}`
          return api(original)
        } catch {
          useAuthStore.getState().logout()
        }
      }
    }
    return Promise.reject(error)
  }
)

export default api
