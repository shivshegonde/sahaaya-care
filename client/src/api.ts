const API_BASE = '/api/v1';

export function getAuthToken(): string | null {
  return localStorage.getItem('sahaaya_token');
}

export function setAuthToken(token: string | null) {
  if (token) {
    localStorage.setItem('sahaaya_token', token);
  } else {
    localStorage.removeItem('sahaaya_token');
  }
}

export async function apiRequest<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {})
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || `Request failed with status ${res.status}`);
  }

  return data as T;
}
