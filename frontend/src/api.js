export const API_BASE = import.meta.env.VITE_API_URL;

export const fetchBackendStatus = async () => {
  const response = await fetch(`${API_BASE}/`);
  return response.json();
};
