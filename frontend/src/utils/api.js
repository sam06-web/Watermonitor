const API_BASE_URL = import.meta.env.VITE_API_URL || '';

export function getApiUrl(path) {
  return `${API_BASE_URL}${path}`;
}

export async function apiFetch(path, options = {}) {
  const url = getApiUrl(path);
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  
  return response.json();
}