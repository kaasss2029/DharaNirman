const API_BASE_URL = window.API_BASE_URL || 'http://127.0.0.1:8000';

function apiToken() {
  return sessionStorage.getItem('ulpin-access-token');
}

async function apiRequest(path, options = {}) {
  const headers = new Headers(options.headers || {});
  const token = apiToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (options.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json');

  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : await response.text();
  if (!response.ok) {
    const message = typeof payload === 'object' && payload.detail ? payload.detail : `Request failed (${response.status})`;
    throw new Error(message);
  }
  return payload;
}

async function apiLogin(identifier, role) {
  const result = await apiRequest('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ identifier, role })
  });
  sessionStorage.setItem('ulpin-access-token', result.access_token);
  sessionStorage.setItem('ulpin-user', JSON.stringify(result.user));
  return result.user;
}

function clearApiSession() {
  sessionStorage.removeItem('ulpin-access-token');
  sessionStorage.removeItem('ulpin-user');
  sessionStorage.removeItem('ulpin-session');
}
