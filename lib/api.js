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
    throw new Error(`${method} ${BASE + path}: ${data.message || `Request failed with status ${res.status}`}`);
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

export async function bulkDeleteProducts(ids) {
  if (!Array.isArray(ids) || ids.length === 0) return { success: true, count: 0 };

  // 1. Try dedicated bulk-delete endpoint on backend
  try {
    const res = await api('POST', '/admin/products/bulk-delete', { ids });
    if (res && res.success) {
      return { success: true, count: res.count ?? ids.length };
    }
  } catch (err) {
    console.warn('Bulk-delete endpoint not available on server, falling back to batch individual delete:', err.message);
  }

  // 2. Resilient fallback: Parallel batch deletes (5 at a time)
  let successCount = 0;
  const chunkSize = 5;
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    const results = await Promise.allSettled(
      chunk.map((id) => api('DELETE', `/admin/products/${id}`))
    );
    results.forEach((r) => {
      if (r.status === 'fulfilled') successCount++;
    });
  }

  return { success: true, count: successCount };
}
