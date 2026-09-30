const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const API_BASE_URL = (
  window.CONFIG?.API_BASE_URL ||
  window.API_BASE_URL ||
  localStorage.getItem('DHARA_API_URL') ||
  (isLocalhost ? 'http://127.0.0.1:8000' : 'https://dharanirman-backend.onrender.com')
).replace(/\/$/, '');

function apiToken() {
  return sessionStorage.getItem('ulpin-access-token');
}

function apiErrorMessage(payload, status) {
  if (typeof payload === 'object' && payload && payload.detail) {
    return typeof payload.detail === 'string' ? payload.detail : JSON.stringify(payload.detail);
  }
  return `Request failed (${status})`;
}

async function apiRequest(path, options = {}) {
  const headers = new Headers(options.headers || {});
  const token = apiToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (options.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json');

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  } catch (error) {
    throw new Error('Cannot reach the DharaNirman API. Start the backend and try again.');
  }
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : await response.text();
  if (!response.ok) {
    throw new Error(apiErrorMessage(payload, response.status));
  }
  return payload;
}

async function apiLogin(identifier, role, password) {
  const result = await apiRequest('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ identifier, role, password })
  });
  sessionStorage.setItem('ulpin-access-token', result.access_token);
  sessionStorage.setItem('ulpin-user', JSON.stringify(result.user));
  return result.user;
}

async function apiRegister(name, identifier, role = 'citizen', unit_id = 'U1204', state = null, city = null, password = '', confirm_password = '') {
  if (password !== confirm_password) {
    throw new Error("Create Password and Confirm Password must match.");
  }
  if (password.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }

  const result = await apiRequest('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name, identifier, role, unit_id, state, city, password, confirm_password })
  });
  sessionStorage.setItem('ulpin-access-token', result.access_token);
  sessionStorage.setItem('ulpin-user', JSON.stringify(result.user));
  return result.user;
}

async function apiGetRegulationProfile(state, city) {
  return apiRequest(`/api/regulations/profile?state=${encodeURIComponent(state)}&city=${encodeURIComponent(city)}`);
}

async function apiListProperties() {
  return apiRequest('/api/properties');
}

async function apiGetBuilding(buildingId) {
  return apiRequest(`/api/buildings/${buildingId}`);
}

async function apiCreateTitleApplication(payload) {
  return apiRequest('/api/title-applications', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

function clearApiSession() {
  sessionStorage.removeItem('ulpin-access-token');
  sessionStorage.removeItem('ulpin-user');
  sessionStorage.removeItem('ulpin-session');
  localStorage.removeItem('dharanirman_registered_users');
}
