export const BASE = 'https://api.bettermend.in/bm/api';
export const MEDIA = 'https://api.bettermend.in/bm';

export function getToken() {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('bm_admin_token') || '';
}

export function setToken(token) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('bm_admin_token', token);
  }
}

export function removeToken() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('bm_admin_token');
  }
}

export function getStoredUser() {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('bm_admin_user');
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setStoredUser(user) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('bm_admin_user', JSON.stringify(user));
  }
}

export function removeStoredUser() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('bm_admin_user');
  }
}

export function resolveImg(path) {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return MEDIA + (path.startsWith('/') ? path : '/' + path);
}

export async function api(method, path, body = null, isFormData = false) {
  const token = getToken();
  const headers = {};
  if (token) {
    headers['Authorization'] = 'Bearer ' + token;
  }

  const opts = {
    method,
    headers,
  };

  if (body) {
    if (isFormData) {
      opts.body = body;
    } else {
      headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
  }

  const res = await fetch(BASE + path, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || `Request failed with status ${res.status}`);
  }
  return data;
}

export async function uploadImages(files) {
  const fd = new FormData();
  Array.from(files).forEach((f) => fd.append('images', f));
  const data = await api('POST', '/admin/upload', fd, true);
  return data.urls || [];
}

export function downloadTemplate() {
  const token = getToken();
  const url = `${BASE}/admin/template?token=${encodeURIComponent(token)}`;
  const a = document.createElement('a');
  a.href = url;
  a.download = 'bettermend_product_template.xlsx';
  a.target = '_blank';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
