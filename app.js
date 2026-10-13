// ── CONFIG ──────────────────────────────────────────────────────────
const BASE = 'https://api.bettermend.in/bm/api';
const MEDIA = 'https://api.bettermend.in/bm';

let token = localStorage.getItem('bm_admin_token') || '';
let adminUser = JSON.parse(localStorage.getItem('bm_admin_user') || 'null');
let otpSent = false;

// page state
let currentPage = 'products';
let productsPage = 1;
let productsTotalPages = 1;
let productsLetter = 'ALL';
let productSearchTimer = null;
let allCategories = [];
let allBrands = [];
let allUnits = [];
let allSizes = [];
let allColors = [];
let allMainCats = [];
let allSubcats = [];

// product modal attribute state
let selectedSizeIds = new Set();
let selectedColorIds = new Set();
let selectedUnitIds = new Set();

// variant detail state
let variantDetailProductId = null;

// ── API HELPER ───────────────────────────────────────────────────────
async function api(method, path, body, isFormData) {
  const opts = {
    method,
    headers: { Authorization: 'Bearer ' + token }
  };
  if (body && !isFormData) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  } else if (body && isFormData) {
    opts.body = body;
  }
  const res = await fetch(BASE + path, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Request failed');
  return data;
}

// ── AUTH ─────────────────────────────────────────────────────────────
async function handleLogin() {
  const phone = document.getElementById('loginPhone').value.trim();
  const otp = document.getElementById('loginOtp').value.trim();
  const btn = document.getElementById('loginBtn');
  const errEl = document.getElementById('loginError');
  errEl.classList.add('hidden');

  if (!phone || phone.length !== 10) {
    showLoginError('Enter a valid 10-digit phone number');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Please wait…';

  try {
    if (!otpSent) {
      await api('POST', '/auth/admin-login', { phone });
      otpSent = true;
      document.getElementById('otpSection').classList.remove('hidden');
      btn.textContent = 'Verify OTP';
      btn.disabled = false;
      showToast('OTP sent (demo: 1234)');
    } else {
      if (!otp) { showLoginError('Enter OTP'); btn.disabled = false; btn.textContent = 'Verify OTP'; return; }
      const data = await api('POST', '/auth/admin-login', { phone, otp });
      token = data.token;
      adminUser = data.user;
      localStorage.setItem('bm_admin_token', token);
      localStorage.setItem('bm_admin_user', JSON.stringify(adminUser));
      initApp();
    }
  } catch (e) {
    showLoginError(e.message);
    btn.disabled = false;
    btn.textContent = otpSent ? 'Verify OTP' : 'Send OTP';
  }
}

function showLoginError(msg) {
  const el = document.getElementById('loginError');
  el.textContent = msg;
  el.classList.remove('hidden');
}

function logout() {
  token = '';
  adminUser = null;
  localStorage.removeItem('bm_admin_token');
  localStorage.removeItem('bm_admin_user');
  document.getElementById('app').classList.add('hidden');
  document.getElementById('loginScreen').classList.remove('hidden');
  otpSent = false;
  document.getElementById('loginOtp').value = '';
  document.getElementById('otpSection').classList.add('hidden');
  document.getElementById('loginBtn').textContent = 'Send OTP';
}

// ── INIT ─────────────────────────────────────────────────────────────
function initApp() {
  document.getElementById('loginScreen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  if (adminUser) document.getElementById('adminName').textContent = adminUser.name || adminUser.phone;
  loadMasterData().then(() => showPage('products'));
}

async function loadMasterData() {
  try {
    const [catRes, brandRes, unitRes, sizeRes, colorRes, mainCatRes] = await Promise.all([
      api('GET', '/categories'),
      api('GET', '/admin/brands'),
      api('GET', '/units'),
      api('GET', '/admin/sizes'),
      api('GET', '/admin/colors'),
      api('GET', '/admin/main-categories'),
    ]);
    allCategories = catRes.categories || [];
    allBrands = brandRes.brands || [];
    allUnits = unitRes.units || [];
    allSizes = sizeRes.sizes || [];
    allColors = colorRes.colors || [];
    allMainCats = mainCatRes.main_categories || [];

    // load subcats
    const subRes = await Promise.all(allCategories.map(c => api('GET', `/categories/${c.id}/subcategories`).catch(() => ({ subcategories: [] }))));
    allSubcats = subRes.flatMap((r, i) => (r.subcategories || []).map(s => ({ ...s, category_name: allCategories[i].name })));

    populateCategoryFilter();
  } catch (e) {
    console.error('Master data load failed', e);
  }
}

function populateCategoryFilter() {
  const sel = document.getElementById('filterCategory');
  sel.innerHTML = '<option value="">All Categories</option>';
  allCategories.forEach(c => {
    const o = document.createElement('option');
    o.value = c.id;
    o.textContent = c.name;
    sel.appendChild(o);
  });
}

function buildAlphaBar() {
  const bar = document.getElementById('alphaBar');
  if (!bar) return;
  const letters = ['ALL', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')];
  bar.innerHTML = letters.map(l =>
    `<button class="alpha-btn${l === productsLetter ? ' active' : ''}" onclick="setAlphaFilter('${l}')">${l}</button>`
  ).join('');
}

function setAlphaFilter(letter) {
  productsLetter = letter;
  productsPage = 1;
  document.getElementById('productSearch').value = '';
  buildAlphaBar();
  loadProducts();
}

function onCategoryFilterChange() {
  productsPage = 1;
  loadProducts();
}

// ── NAVIGATION ───────────────────────────────────────────────────────
function showPage(name) {
  currentPage = name;
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('page-' + name).classList.add('active');
  document.querySelector(`[data-page="${name}"]`).classList.add('active');
  const titles = { products: 'Products', categories: 'Categories', brands: 'Brands', units: 'Units', sizes: 'Sizes', colors: 'Colors' };
  document.getElementById('pageTitle').textContent = titles[name] || name;
  closeSidebar();

  if (name === 'products') { productsPage = 1; productsLetter = 'ALL'; loadProducts(); }
  else if (name === 'categories') loadCategoriesPage();
  else if (name === 'brands') loadBrandsPage();
  else if (name === 'units') loadUnitsPage();
  else if (name === 'sizes') loadSizesPage();
  else if (name === 'colors') loadColorsPage();
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
}

// ── TOAST ────────────────────────────────────────────────────────────
let toastTimer = null;
function showToast(msg, type) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast' + (type ? ' ' + type : '');
  el.classList.remove('hidden');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), 3000);
}

// ── MODALS ───────────────────────────────────────────────────────────
function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
}
function openModal(id) {
  document.getElementById(id).classList.remove('hidden');
}

// ── CONFIRM ──────────────────────────────────────────────────────────
function confirmDelete(msg, onOk) {
  document.getElementById('confirmMsg').textContent = msg;
  const btn = document.getElementById('confirmOkBtn');
  btn.onclick = () => { closeModal('confirmModal'); onOk(); };
  openModal('confirmModal');
}

// ── DEBOUNCE ─────────────────────────────────────────────────────────
function debounceProductSearch() {
  productsLetter = 'ALL';
  clearTimeout(productSearchTimer);
  productSearchTimer = setTimeout(() => { productsPage = 1; loadProducts(); }, 400);
}

// ── IMAGE MANAGER ────────────────────────────────────────────────────
// productImages: string[] stored in memory, rendered as visual grid
let productImageUrls = [];

function renderImgGrid() {
  const grid = document.getElementById('productImagesGrid');
  if (!grid) return;
  grid.innerHTML = productImageUrls.map((url, i) => `
    <div class="img-thumb">
      <img src="${resolveImg(url)}" onerror="this.src=''"/>
      <button class="img-thumb-del" onclick="removeProductImg(${i})">✕</button>
    </div>`).join('');
}

function removeProductImg(i) {
  productImageUrls.splice(i, 1);
  renderImgGrid();
}

async function handleImgUpload(input, context) {
  const files = Array.from(input.files);
  if (!files.length) return;
  const fd = new FormData();
  files.forEach(f => fd.append('images', f));
  try {
    const data = await api('POST', '/admin/upload', fd, true);
    (data.urls || []).forEach(u => productImageUrls.push(u));
    renderImgGrid();
    showToast('Images uploaded');
  } catch (e) {
    showToast('Upload failed: ' + e.message, 'error');
  }
  input.value = '';
}

function resolveImg(path) {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  return MEDIA + (path.startsWith('/') ? path : '/' + path);
}

// ── UTILITY ──────────────────────────────────────────────────────────
function imgTag(src, cls) {
  if (!src) return `<div class="${cls || 'table-img'}" style="background:#f0edf8;display:flex;align-items:center;justify-content:center;font-size:20px">📦</div>`;
  return `<img src="${resolveImg(src)}" class="${cls || 'table-img'}" onerror="this.src=''" style="background:#f0edf8"/>`;
}

function escHtml(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── STARTUP ──────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  if (token && adminUser) {
    initApp();
  }
  // allow Enter key on login
  document.getElementById('loginOtp').addEventListener('keydown', e => { if (e.key === 'Enter') handleLogin(); });
  document.getElementById('loginPhone').addEventListener('keydown', e => { if (e.key === 'Enter') handleLogin(); });
});

// ════════════════════════════════════════════════════════════════════
// PRODUCTS
// ════════════════════════════════════════════════════════════════════

async function loadProducts() {
  const container = document.getElementById('productsList');
  const search = document.getElementById('productSearch').value.trim();
  const catId = document.getElementById('filterCategory').value;
  container.innerHTML = '<div class="loading"><div class="spinner"></div><br/>Loading products…</div>';
  buildAlphaBar();

  try {
    let path = `/admin/products?page=${productsPage}&limit=20`;
    if (catId) path += `&category_id=${catId}`;
    if (search) path += `&search=${encodeURIComponent(search)}`;
    else if (productsLetter !== 'ALL') path += `&letter=${productsLetter}`;

    const data = await api('GET', path);
    const products = data.products || [];
    const pagination = data.pagination || {};
    productsTotalPages = pagination.totalPages || 1;

    if (!products.length) {
      container.innerHTML = '<div class="empty-state"><div class="empty-icon">📦</div><p>No products found</p></div>';
      document.getElementById('productsPagination').innerHTML = '';
      return;
    }

    container.innerHTML = products.map(p => productCard(p)).join('');
    renderPagination(pagination);
  } catch (e) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><p>${escHtml(e.message)}</p></div>`;
  }
}

function productCard(p) {
  const img = (p.images && p.images.length) ? p.images[0] : '';
  const cat = allCategories.find(c => c.id === p.category_id);
  return `
  <div class="product-card">
    <div class="product-card-img">
      ${img ? `<img src="${resolveImg(img)}" onerror="this.parentElement.innerHTML='📦'"/>` : '📦'}
    </div>
    <div class="product-card-body">
      <div class="product-card-name">${escHtml(p.name)}</div>
      <div class="product-card-meta">
        ${p.brand_name ? `<span class="badge badge-purple">${escHtml(p.brand_name)}</span> ` : ''}
        ${cat ? `<span class="badge badge-grey">${escHtml(cat.name)}</span>` : ''}
      </div>
      <div class="product-card-sku">${escHtml(p.sku_id || '')}</div>
      <div class="product-card-actions">
        <button class="btn btn-sm btn-outline" onclick="openProductModal(${p.id})">✏️ Edit</button>
        <button class="btn btn-sm btn-outline" onclick="openVariantDetailModal(${p.id},'${escHtml(p.name)}')">🔧 Variants</button>
        <button class="btn btn-sm btn-danger" onclick="deleteProduct(${p.id})">🗑️</button>
      </div>
    </div>
  </div>`;
}

function renderPagination(pagination) {
  const el = document.getElementById('productsPagination');
  if (!pagination || pagination.totalPages <= 1) { el.innerHTML = ''; return; }
  let html = '';
  for (let i = 1; i <= pagination.totalPages; i++) {
    html += `<button class="${i === productsPage ? 'active' : ''}" onclick="goProductsPage(${i})">${i}</button>`;
  }
  el.innerHTML = html;
}

function goProductsPage(n) {
  productsPage = n;
  loadProducts();
}

// ── PRODUCT MODAL ────────────────────────────────────────────────────
async function openProductModal(id) {
  // reset
  document.getElementById('productId').value = '';
  document.getElementById('productName').value = '';
  document.getElementById('productDesc').value = '';
  document.getElementById('productGst').value = '0';
  document.getElementById('productIsVeg').value = 'true';
  productImageUrls = [];
  renderImgGrid();
  document.getElementById('productKeywords').value = '';
  document.getElementById('customFieldsContainer').innerHTML = '';
  selectedSizeIds = new Set();
  selectedColorIds = new Set();
  selectedUnitIds = new Set();
  renderAttrPickers();

  // populate selects
  populateSelect('productBrand', allBrands, 'id', 'name', '— None —');
  populateSelect('productCategory', allCategories, 'id', 'name', '— None —');
  populateSelect('productSubcategory', [], 'id', 'name', '— None —');

  document.getElementById('productModalTitle').textContent = id ? 'Edit Product' : 'Add Product';

  if (id) {
    try {
      const data = await api('GET', `/products/${id}`);
      const p = data.product;
      document.getElementById('productId').value = p.id;
      document.getElementById('productName').value = p.name || '';
      document.getElementById('productDesc').value = p.description || '';
      document.getElementById('productGst').value = p.gst_percent || 0;
      document.getElementById('productIsVeg').value = p.is_veg ? 'true' : 'false';
      productImageUrls = p.images || [];
      renderImgGrid();
      document.getElementById('productKeywords').value = (p.search_keywords || []).join(', ');

      if (p.brand_id) document.getElementById('productBrand').value = p.brand_id;
      if (p.category_id) {
        document.getElementById('productCategory').value = p.category_id;
        await onProductCategoryChange();
        if (p.subcategory_id) document.getElementById('productSubcategory').value = p.subcategory_id;
      }

      // load size/color/unit assignments
      try {
        const [attrRes, unitRes] = await Promise.all([
          api('GET', `/admin/products/${id}/attributes`),
          api('GET', `/units/assigned/${id}`),
        ]);
        selectedSizeIds = new Set((attrRes.size_ids || []).map(Number));
        selectedColorIds = new Set((attrRes.color_ids || []).map(Number));
        selectedUnitIds = new Set((unitRes.assigned_units || []).map(u => u.id));
      } catch (_) {}
      renderAttrPickers();

      // default selections
      document.getElementById('productDefaultSize').value = p.default_size || '';
      document.getElementById('productDefaultColor').value = p.default_color || '';
      document.getElementById('productDefaultUnit').value = p.default_unit_id || '';

      // custom fields
      const fields = p.custom_fields || [];
      fields.forEach(f => addCustomField(f.key || f.label || f.name, f.value));
    } catch (e) {
      showToast('Failed to load product: ' + e.message, 'error');
    }
  }

  openModal('productModal');
}

async function onProductCategoryChange() {
  const catId = document.getElementById('productCategory').value;
  const subSel = document.getElementById('productSubcategory');
  subSel.innerHTML = '<option value="">— None —</option>';
  if (!catId) return;
  try {
    const data = await api('GET', `/categories/${catId}/subcategories`);
    (data.subcategories || []).forEach(s => {
      const o = document.createElement('option');
      o.value = s.id; o.textContent = s.name;
      subSel.appendChild(o);
    });
  } catch (_) {}
}

function populateSelect(id, items, valKey, labelKey, placeholder) {
  const sel = document.getElementById(id);
  sel.innerHTML = `<option value="">${placeholder}</option>`;
  items.forEach(item => {
    const o = document.createElement('option');
    o.value = item[valKey]; o.textContent = item[labelKey];
    sel.appendChild(o);
  });
}

// ── ATTRIBUTE PICKERS ────────────────────────────────────────────────
function renderAttrPickers() {
  renderCheckboxPicker('sizesPickerWrap', allSizes, selectedSizeIds, 'size');
  renderCheckboxPicker('colorsPickerWrap', allColors, selectedColorIds, 'color');
  renderCheckboxPicker('unitsPickerWrap', allUnits.map(u => ({ ...u, label: u.display_name })), selectedUnitIds, 'unit');
  refreshDefaultDropdowns();
}

function renderCheckboxPicker(containerId, items, selectedSet, type) {
  const wrap = document.getElementById(containerId);
  if (!wrap) return;
  if (!items.length) { wrap.innerHTML = '<small style="color:#999">None defined</small>'; return; }
  wrap.innerHTML = items.map(item => `
    <label class="attr-check-label">
      <input type="checkbox" value="${item.id}" ${selectedSet.has(item.id) ? 'checked' : ''}
        onchange="onAttrCheck('${type}', ${item.id}, this.checked)"/>
      ${escHtml(item.label)}
    </label>`).join('');
}

function onAttrCheck(type, id, checked) {
  if (type === 'size') { checked ? selectedSizeIds.add(id) : selectedSizeIds.delete(id); }
  else if (type === 'color') { checked ? selectedColorIds.add(id) : selectedColorIds.delete(id); }
  else if (type === 'unit') { checked ? selectedUnitIds.add(id) : selectedUnitIds.delete(id); }
  refreshDefaultDropdowns();
}

function refreshDefaultDropdowns() {
  const defSize = document.getElementById('productDefaultSize');
  const defColor = document.getElementById('productDefaultColor');
  const defUnit = document.getElementById('productDefaultUnit');
  if (!defSize) return;

  const prevSize = defSize.value, prevColor = defColor.value, prevUnit = defUnit.value;

  defSize.innerHTML = '<option value="">— None —</option>' +
    allSizes.filter(s => selectedSizeIds.has(s.id)).map(s => `<option value="${escHtml(s.label)}">${escHtml(s.label)}</option>`).join('');
  defColor.innerHTML = '<option value="">— None —</option>' +
    allColors.filter(c => selectedColorIds.has(c.id)).map(c => `<option value="${escHtml(c.label)}">${escHtml(c.label)}</option>`).join('');
  defUnit.innerHTML = '<option value="">— None —</option>' +
    allUnits.filter(u => selectedUnitIds.has(u.id)).map(u => `<option value="${u.id}">${escHtml(u.display_name)}</option>`).join('');

  defSize.value = prevSize;
  defColor.value = prevColor;
  defUnit.value = prevUnit;
}

// ── CUSTOM FIELDS ────────────────────────────────────────────────────
let cfCount = 0;
function addCustomField(label, value) {
  cfCount++;
  const i = cfCount;
  const container = document.getElementById('customFieldsContainer');
  const div = document.createElement('div');
  div.className = 'custom-field-row';
  div.id = `cf_${i}`;
  div.innerHTML = `
    <input id="cflabel_${i}" type="text" placeholder="Label" value="${escHtml(label || '')}"/>
    <input id="cfvalue_${i}" type="text" placeholder="Value" value="${escHtml(value || '')}"/>
    <button class="btn btn-sm btn-danger" onclick="document.getElementById('cf_${i}').remove()">✕</button>`;
  container.appendChild(div);
}

function collectCustomFields() {
  const rows = document.querySelectorAll('#customFieldsContainer .custom-field-row');
  const fields = [];
  rows.forEach(row => {
    const i = row.id.replace('cf_', '');
    const label = document.getElementById(`cflabel_${i}`)?.value.trim();
    const value = document.getElementById(`cfvalue_${i}`)?.value.trim();
    if (label) fields.push({ label, value });
  });
  return fields;
}

// ── SAVE PRODUCT ─────────────────────────────────────────────────────
async function saveProduct() {
  const id = document.getElementById('productId').value;
  const name = document.getElementById('productName').value.trim();
  if (!name) { showToast('Product name is required', 'error'); return; }

  const images = productImageUrls.slice();
  const keywords = document.getElementById('productKeywords').value.split(',').map(s => s.trim()).filter(Boolean);
  const customFields = collectCustomFields();

  const default_unit_id = document.getElementById('productDefaultUnit').value;
  const body = {
    name,
    description: document.getElementById('productDesc').value.trim() || null,
    brand_id: document.getElementById('productBrand').value || null,
    category_id: document.getElementById('productCategory').value || null,
    subcategory_id: document.getElementById('productSubcategory').value || null,
    is_veg: document.getElementById('productIsVeg').value === 'true',
    gst_percent: parseFloat(document.getElementById('productGst').value) || 0,
    images,
    search_keywords: keywords,
    custom_fields: customFields,
    default_size: document.getElementById('productDefaultSize').value || null,
    default_color: document.getElementById('productDefaultColor').value || null,
    default_unit_id: default_unit_id ? parseInt(default_unit_id) : null,
  };

  try {
    if (id) {
      await api('PUT', `/admin/products/${id}`, body);
      await Promise.all([
        api('PUT', `/admin/products/${id}/attributes`, { size_ids: [...selectedSizeIds], color_ids: [...selectedColorIds] }),
        api('PUT', `/units/assigned/${id}`, { unit_ids: [...selectedUnitIds] }),
      ]);
      showToast('Product updated', 'success');
    } else {
      const res = await api('POST', '/admin/products', body);
      const newId = (res.product || res).id;
      await Promise.all([
        api('PUT', `/admin/products/${newId}/attributes`, { size_ids: [...selectedSizeIds], color_ids: [...selectedColorIds] }),
        api('PUT', `/units/assigned/${newId}`, { unit_ids: [...selectedUnitIds] }),
      ]);
      showToast('Product created', 'success');
    }
    closeModal('productModal');
    loadProducts();
  } catch (e) {
    showToast('Save failed: ' + e.message, 'error');
  }
}

async function deleteProduct(id) {
  confirmDelete('Delete this product? This will also remove it from all shops.', async () => {
    try {
      await api('DELETE', `/admin/products/${id}`);
      showToast('Product deleted', 'success');
      loadProducts();
    } catch (e) {
      showToast('Delete failed: ' + e.message, 'error');
    }
  });
}

// ── VARIANT DETAIL MODAL ─────────────────────────────────────────────
let variantDetailAssignedUnits = [];
let variantDetailAssignedSizes = [];
let variantDetailAssignedColors = [];
let vdImageUrls = [];

async function openVariantDetailModal(productId, productName) {
  variantDetailProductId = productId;
  document.getElementById('variantDetailTitle').textContent = `Variants — ${productName}`;
  document.getElementById('addVariantDetailForm').classList.add('hidden');
  try {
    const [attrRes, unitRes] = await Promise.all([
      api('GET', `/admin/products/${productId}/attributes`),
      api('GET', `/units/assigned/${productId}`),
    ]);
    const sIds = new Set((attrRes.size_ids || []).map(Number));
    const cIds = new Set((attrRes.color_ids || []).map(Number));
    variantDetailAssignedSizes = allSizes.filter(s => sIds.has(s.id));
    variantDetailAssignedColors = allColors.filter(c => cIds.has(c.id));
    variantDetailAssignedUnits = unitRes.assigned_units || [];
  } catch (_) {
    variantDetailAssignedUnits = allUnits;
    variantDetailAssignedSizes = allSizes;
    variantDetailAssignedColors = allColors;
  }
  await loadVariantDetails();
  openModal('variantDetailModal');
}

async function loadVariantDetails() {
  const container = document.getElementById('variantDetailList');
  container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  try {
    const data = await api('GET', `/admin/products/${variantDetailProductId}/variants`);
    const variants = data.variants || [];
    if (!variants.length) {
      container.innerHTML = '<div class="empty-state"><p>No variants yet. Click "+ Add Variant" to add one.</p></div>';
      return;
    }
    container.innerHTML = `
      <table><thead><tr>
        <th>SKU</th><th>Unit</th><th>Size</th><th>Color</th><th>Image</th><th>Actions</th>
      </tr></thead><tbody>
      ${variants.map(v => `
        <tr>
          <td><code>${escHtml(v.sku_id || '')}</code></td>
          <td>${escHtml(v.unit_display_name || '—')}</td>
          <td>${escHtml(v.size || '—')}</td>
          <td>${escHtml(v.color || '—')}</td>
          <td>${(v.images || []).slice(0,1).map(img => `<img src="${resolveImg(img)}" class="table-img"/>`).join('') || '—'}</td>
          <td class="table-actions">
            <button class="btn btn-sm btn-danger" onclick="deleteVariantDetail(${v.id})">🗑️</button>
          </td>
        </tr>`).join('')}
      </tbody></table>`;
  } catch (e) {
    container.innerHTML = `<div class="empty-state"><p>${escHtml(e.message)}</p></div>`;
  }
}

function openAddVariantDetail() {
  document.getElementById('vdUnit').innerHTML = '<option value="">— None —</option>' +
    variantDetailAssignedUnits.map(u => `<option value="${u.id}">${escHtml(u.display_name)}</option>`).join('');
  document.getElementById('vdSize').innerHTML = '<option value="">— None —</option>' +
    variantDetailAssignedSizes.map(s => `<option value="${escHtml(s.label)}">${escHtml(s.label)}</option>`).join('');
  document.getElementById('vdColor').innerHTML = '<option value="">— None —</option>' +
    variantDetailAssignedColors.map(c => `<option value="${escHtml(c.label)}">${escHtml(c.label)}</option>`).join('');
  document.getElementById('vdDesc').value = '';
  vdImageUrls = [];
  document.getElementById('vdImagesGrid').innerHTML = '';
  document.getElementById('addVariantDetailForm').classList.remove('hidden');
}

async function handleVdImgUpload(input) {
  const files = Array.from(input.files);
  if (!files.length) return;
  const fd = new FormData();
  files.forEach(f => fd.append('images', f));
  try {
    const data = await api('POST', '/admin/upload', fd, true);
    (data.urls || []).forEach(u => vdImageUrls.push(u));
    renderVdImgGrid();
    showToast('Images uploaded');
  } catch (e) { showToast('Upload failed: ' + e.message, 'error'); }
  input.value = '';
}

function renderVdImgGrid() {
  document.getElementById('vdImagesGrid').innerHTML = vdImageUrls.map((url, i) => `
    <div class="img-thumb">
      <img src="${resolveImg(url)}"/>
      <button class="img-thumb-del" onclick="vdImageUrls.splice(${i},1);renderVdImgGrid()">✕</button>
    </div>`).join('');
}

async function saveVariantDetail() {
  const body = {
    unit_id: document.getElementById('vdUnit').value ? parseInt(document.getElementById('vdUnit').value) : null,
    size: document.getElementById('vdSize').value || null,
    color: document.getElementById('vdColor').value || null,
    description: document.getElementById('vdDesc').value.trim() || null,
    images: vdImageUrls,
  };
  try {
    await api('POST', `/admin/products/${variantDetailProductId}/variants`, body);
    showToast('Variant added', 'success');
    document.getElementById('addVariantDetailForm').classList.add('hidden');
    loadVariantDetails();
  } catch (e) {
    showToast('Failed: ' + e.message, 'error');
  }
}

async function deleteVariantDetail(variantId) {
  confirmDelete('Delete this variant?', async () => {
    try {
      await api('DELETE', `/admin/products/${variantDetailProductId}/variants/${variantId}`);
      showToast('Variant deleted', 'success');
      loadVariantDetails();
    } catch (e) { showToast('Failed: ' + e.message, 'error'); }
  });
}

// ════════════════════════════════════════════════════════════════════
// CATEGORIES PAGE — breadcrumb drill-down
// ════════════════════════════════════════════════════════════════════
// catStack: array of { type, id, name }
// type: 'root' | 'maincat' | 'category' | 'subcat'
let catStack = [];

async function loadCategoriesPage() {
  catStack = [];
  await renderCatLevel();
}

// Render current level based on catStack
async function renderCatLevel() {
  renderCatBreadcrumb();
  const body = document.getElementById('catExplorerBody');
  body.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  const btns = document.getElementById('catToolbarBtns');

  const level = catStack.length === 0 ? 'root'
    : catStack[catStack.length - 1].type;

  try {
    if (catStack.length === 0) {
      // ROOT: show main categories
      const data = await api('GET', '/admin/main-categories');
      const items = data.main_categories || [];
      btns.innerHTML = `<button class="btn btn-primary btn-sm" onclick="catAddMainCat()">+ Main Category</button>`;
      renderCatCards(body, items, {
        getId: i => i.id, getName: i => i.title, getImg: i => i.image,
        getBadge: i => i.three_shop_restriction ? '<span class="badge badge-purple">3-Shop</span>' : '',
        onDrill: item => catDrill({ type: 'maincat', id: item.id, name: item.title }),
        onEdit: item => catEditMainCat(item.id),
        onDelete: item => catDeleteMainCat(item.id),
        emptyMsg: 'No main categories yet'
      });

    } else if (level === 'maincat') {
      // MAIN CAT → show categories
      const mc = catStack[catStack.length - 1];
      const data = await api('GET', `/admin/main-categories/${mc.id}/categories`);
      const items = data.categories || [];
      btns.innerHTML = `<button class="btn btn-primary btn-sm" onclick="catAddCategory(${mc.id})">+ Category</button>`;
      renderCatCards(body, items, {
        getId: i => i.id, getName: i => i.name, getImg: i => i.image,
        getBadge: () => '',
        onDrill: item => catDrill({ type: 'category', id: item.id, name: item.name }),
        onEdit: item => catEditCategory(item.id),
        onDelete: item => catDeleteCategory(item.id),
        emptyMsg: 'No categories in this main category'
      });

    } else if (level === 'category') {
      // CATEGORY → show subcategories (top-level, parent_id IS NULL)
      const cat = catStack[catStack.length - 1];
      const data = await api('GET', `/categories/${cat.id}/subcategories`);
      const items = data.subcategories || [];
      btns.innerHTML = `<button class="btn btn-primary btn-sm" onclick="catAddSubcat(${cat.id},null)">+ Subcategory</button>`;
      renderCatCards(body, items, {
        getId: i => i.id, getName: i => i.name, getImg: i => i.image,
        getBadge: () => '',
        onDrill: item => catDrill({ type: 'subcat', id: item.id, name: item.name, category_id: cat.id }),
        onEdit: item => catEditSubcat(item.id, cat.id),
        onDelete: item => catDeleteSubcat(item.id),
        emptyMsg: 'No subcategories — products live here'
      });

    } else if (level === 'subcat') {
      // SUBCAT → check for child subcats first, then show products
      const sub = catStack[catStack.length - 1];
      const catId = sub.category_id || catStack.find(s => s.type === 'category')?.id;
      const childData = await api('GET', `/categories/${catId}/subcategories?parent_id=${sub.id}`);
      const children = childData.subcategories || [];

      if (children.length > 0) {
        // has child subcats → show them
        btns.innerHTML = `<button class="btn btn-primary btn-sm" onclick="catAddSubcat(${catId},${sub.id})">+ Sub-subcategory</button>`;
        renderCatCards(body, children, {
          getId: i => i.id, getName: i => i.name, getImg: i => i.image,
          getBadge: () => '',
          onDrill: item => catDrill({ type: 'subcat', id: item.id, name: item.name, category_id: catId }),
          onEdit: item => catEditSubcat(item.id, catId),
          onDelete: item => catDeleteSubcat(item.id),
          emptyMsg: 'No sub-subcategories'
        });
      } else {
        // leaf subcat → show products
        btns.innerHTML = `
          <button class="btn btn-outline btn-sm" onclick="catAddSubcat(${catId},${sub.id})">+ Sub-subcategory</button>
          <button class="btn btn-primary btn-sm" onclick="openProductModal()">+ Product</button>`;
        const prodData = await api('GET', `/admin/products?page=1&limit=50&subcategory_id=${sub.id}`);
        const products = prodData.products || [];
        renderCatProducts(body, products);
      }
    }
  } catch (e) {
    body.innerHTML = `<div class="empty-state"><p>Error: ${escHtml(e.message)}</p></div>`;
  }
}

function catDrill(node) {
  catStack.push(node);
  renderCatLevel();
}

function catGoTo(index) {
  catStack = catStack.slice(0, index);
  renderCatLevel();
}

function renderCatBreadcrumb() {
  const bc = document.getElementById('catBreadcrumb');
  const parts = [{ name: '🏠 All', index: 0 }];
  catStack.forEach((s, i) => parts.push({ name: s.name, index: i + 1 }));
  bc.innerHTML = parts.map((p, i) => {
    const isLast = i === parts.length - 1;
    return isLast
      ? `<span class="bc-current">${escHtml(p.name)}</span>`
      : `<span class="bc-link" onclick="catGoTo(${p.index})">${escHtml(p.name)}</span><span class="bc-sep">›</span>`;
  }).join('');
}

function renderCatCards(container, items, opts) {
  if (!items.length) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">📂</div><p>${opts.emptyMsg}</p></div>`;
    return;
  }
  container.innerHTML = `<div class="cat-grid">${items.map(item => `
    <div class="cat-card">
      <div class="cat-card-img" onclick="${opts.onDrill ? `catDrillById(event)` : ''}">
        ${opts.getImg(item)
          ? `<img src="${resolveImg(opts.getImg(item))}" onerror="this.parentElement.innerHTML='📂'"/>`
          : '📂'}
      </div>
      <div class="cat-card-body">
        <div class="cat-card-name">${escHtml(opts.getName(item))}</div>
        ${opts.getBadge(item) ? `<div style="margin:4px 0">${opts.getBadge(item)}</div>` : ''}
        <div class="cat-card-actions">
          <button class="btn btn-sm btn-primary" onclick='catDrillItem(${JSON.stringify(item)}, ${JSON.stringify(opts.getName(item))})'>Open →</button>
          <button class="btn btn-sm btn-outline" onclick="event.stopPropagation();(${opts.onEdit.toString()})(${JSON.stringify(item)})">✏️</button>
          <button class="btn btn-sm btn-danger" onclick="event.stopPropagation();(${opts.onDelete.toString()})(${JSON.stringify(item)})">🗑️</button>
        </div>
      </div>
    </div>`).join('')}</div>`;

  // attach drill handlers
  items.forEach(item => {
    const cards = container.querySelectorAll('.cat-card');
    cards.forEach((card, idx) => {
      if (items[idx]) {
        card.querySelector('.btn-primary').onclick = (e) => { e.stopPropagation(); opts.onDrill(items[idx]); };
        card.querySelector('.btn-outline').onclick = (e) => { e.stopPropagation(); opts.onEdit(items[idx]); };
        card.querySelector('.btn-danger').onclick = (e) => { e.stopPropagation(); opts.onDelete(items[idx]); };
      }
    });
  });
}

function renderCatProducts(container, products) {
  if (!products.length) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">📦</div><p>No products in this subcategory</p></div>';
    return;
  }
  container.innerHTML = `<div class="cat-grid">${products.map(p => `
    <div class="cat-card">
      <div class="cat-card-img">
        ${p.images && p.images[0] ? `<img src="${resolveImg(p.images[0])}" onerror="this.parentElement.innerHTML='📦'"/>` : '📦'}
      </div>
      <div class="cat-card-body">
        <div class="cat-card-name">${escHtml(p.name)}</div>
        <div style="font-size:11px;color:var(--text-muted);margin:2px 0">${escHtml(p.sku_id || '')}</div>
        <div class="cat-card-actions">
          <button class="btn btn-sm btn-outline" onclick="openProductModal(${p.id})">✏️ Edit</button>
          <button class="btn btn-sm btn-danger" onclick="deleteProduct(${p.id})">🗑️</button>
        </div>
      </div>
    </div>`).join('')}</div>`;
}

// ── CAT CRUD helpers ─────────────────────────────────────────────────
function catAddMainCat() {
  showGenericModal('Add Main Category',
    `<div class="form-group"><label>Title *</label><input id="gm_title"/></div>
     <div class="form-group"><label>Image</label><input id="gm_image" placeholder="URL or upload"/>
       <label class="btn btn-outline btn-sm" style="margin-top:6px">Upload<input type="file" accept="image/*" onchange="uploadSingleImg(this,'gm_image')" style="display:none"/></label></div>
     <div class="form-group"><label>3-Shop Restriction</label>
       <select id="gm_3shop"><option value="false">No</option><option value="true">Yes</option></select></div>`,
    async () => {
      const body = { title: document.getElementById('gm_title').value.trim(), image: document.getElementById('gm_image').value.trim() || null, three_shop_restriction: document.getElementById('gm_3shop').value === 'true' };
      if (!body.title) { showToast('Title required', 'error'); return false; }
      await api('POST', '/admin/main-categories', body);
      const d = await api('GET', '/admin/main-categories'); allMainCats = d.main_categories || [];
      renderCatLevel(); return true;
    });
}

function catEditMainCat(id) {
  const item = allMainCats.find(m => m.id === id) || {};
  showGenericModal('Edit Main Category',
    `<div class="form-group"><label>Title *</label><input id="gm_title" value="${escHtml(item.title || '')}"/></div>
     <div class="form-group"><label>Image</label><input id="gm_image" value="${escHtml(item.image || '')}"/>
       <label class="btn btn-outline btn-sm" style="margin-top:6px">Upload<input type="file" accept="image/*" onchange="uploadSingleImg(this,'gm_image')" style="display:none"/></label></div>
     <div class="form-group"><label>3-Shop Restriction</label>
       <select id="gm_3shop"><option value="false" ${!item.three_shop_restriction?'selected':''}>No</option><option value="true" ${item.three_shop_restriction?'selected':''}>Yes</option></select></div>`,
    async () => {
      const body = { title: document.getElementById('gm_title').value.trim(), image: document.getElementById('gm_image').value.trim() || null, three_shop_restriction: document.getElementById('gm_3shop').value === 'true' };
      if (!body.title) { showToast('Title required', 'error'); return false; }
      await api('PUT', `/admin/main-categories/${id}`, body);
      const d = await api('GET', '/admin/main-categories'); allMainCats = d.main_categories || [];
      renderCatLevel(); return true;
    });
}

function catDeleteMainCat(id) {
  confirmDelete('Delete this main category and all its contents?', async () => {
    try { await api('DELETE', `/admin/main-categories/${id}`); showToast('Deleted', 'success'); const d = await api('GET', '/admin/main-categories'); allMainCats = d.main_categories || []; renderCatLevel(); }
    catch (e) { showToast(e.message, 'error'); }
  });
}

function catAddCategory(mainCatId) {
  showGenericModal('Add Category',
    `<div class="form-group"><label>Name *</label><input id="gm_name"/></div>
     <div class="form-group"><label>Image</label><input id="gm_image" placeholder="URL or upload"/>
       <label class="btn btn-outline btn-sm" style="margin-top:6px">Upload<input type="file" accept="image/*" onchange="uploadSingleImg(this,'gm_image')" style="display:none"/></label></div>
     <div class="form-group"><label>Description</label><textarea id="gm_desc" rows="2"></textarea></div>`,
    async () => {
      const body = { name: document.getElementById('gm_name').value.trim(), main_category_id: mainCatId, image: document.getElementById('gm_image').value.trim() || null, description: document.getElementById('gm_desc').value.trim() || null };
      if (!body.name) { showToast('Name required', 'error'); return false; }
      await api('POST', '/admin/categories', body);
      const d = await api('GET', '/categories'); allCategories = d.categories || []; populateCategoryFilter();
      renderCatLevel(); return true;
    });
}

function catEditCategory(id) {
  const item = allCategories.find(c => c.id === id) || {};
  showGenericModal('Edit Category',
    `<div class="form-group"><label>Name *</label><input id="gm_name" value="${escHtml(item.name || '')}"/></div>
     <div class="form-group"><label>Image</label><input id="gm_image" value="${escHtml(item.image || '')}"/>
       <label class="btn btn-outline btn-sm" style="margin-top:6px">Upload<input type="file" accept="image/*" onchange="uploadSingleImg(this,'gm_image')" style="display:none"/></label></div>
     <div class="form-group"><label>Description</label><textarea id="gm_desc" rows="2">${escHtml(item.description || '')}</textarea></div>`,
    async () => {
      const body = { name: document.getElementById('gm_name').value.trim(), image: document.getElementById('gm_image').value.trim() || null, description: document.getElementById('gm_desc').value.trim() || null };
      if (!body.name) { showToast('Name required', 'error'); return false; }
      await api('PUT', `/admin/categories/${id}`, body);
      const d = await api('GET', '/categories'); allCategories = d.categories || []; populateCategoryFilter();
      renderCatLevel(); return true;
    });
}

function catDeleteCategory(id) {
  confirmDelete('Delete this category and all its products?', async () => {
    try { await api('DELETE', `/admin/categories/${id}`); showToast('Deleted', 'success'); const d = await api('GET', '/categories'); allCategories = d.categories || []; populateCategoryFilter(); renderCatLevel(); }
    catch (e) { showToast(e.message, 'error'); }
  });
}

function catAddSubcat(categoryId, parentId) {
  showGenericModal(parentId ? 'Add Sub-subcategory' : 'Add Subcategory',
    `<div class="form-group"><label>Name *</label><input id="gm_name"/></div>
     <div class="form-group"><label>Image</label><input id="gm_image" placeholder="URL or upload"/>
       <label class="btn btn-outline btn-sm" style="margin-top:6px">Upload<input type="file" accept="image/*" onchange="uploadSingleImg(this,'gm_image')" style="display:none"/></label></div>
     <div class="form-group"><label>Description</label><textarea id="gm_desc" rows="2"></textarea></div>`,
    async () => {
      const body = { name: document.getElementById('gm_name').value.trim(), category_id: categoryId, parent_id: parentId || null, image: document.getElementById('gm_image').value.trim() || null, description: document.getElementById('gm_desc').value.trim() || null };
      if (!body.name) { showToast('Name required', 'error'); return false; }
      await api('POST', '/admin/subcategories', body);
      renderCatLevel(); return true;
    });
}

function catEditSubcat(id, categoryId) {
  const item = allSubcats.find(s => s.id === id) || {};
  showGenericModal('Edit Subcategory',
    `<div class="form-group"><label>Name *</label><input id="gm_name" value="${escHtml(item.name || '')}"/></div>
     <div class="form-group"><label>Image</label><input id="gm_image" value="${escHtml(item.image || '')}"/>
       <label class="btn btn-outline btn-sm" style="margin-top:6px">Upload<input type="file" accept="image/*" onchange="uploadSingleImg(this,'gm_image')" style="display:none"/></label></div>
     <div class="form-group"><label>Description</label><textarea id="gm_desc" rows="2">${escHtml(item.description || '')}</textarea></div>`,
    async () => {
      const body = { name: document.getElementById('gm_name').value.trim(), category_id: categoryId, image: document.getElementById('gm_image').value.trim() || null, description: document.getElementById('gm_desc').value.trim() || null };
      if (!body.name) { showToast('Name required', 'error'); return false; }
      await api('PUT', `/admin/subcategories/${id}`, body);
      renderCatLevel(); return true;
    });
}

function catDeleteSubcat(id) {
  confirmDelete('Delete this subcategory and all its products?', async () => {
    try { await api('DELETE', `/admin/subcategories/${id}`); showToast('Deleted', 'success'); renderCatLevel(); }
    catch (e) { showToast(e.message, 'error'); }
  });
}

// ════════════════════════════════════════════════════════════════════
// BRANDS
// ════════════════════════════════════════════════════════════════════

async function loadBrandsPage() {
  const el = document.getElementById('brandList');
  el.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  try {
    const data = await api('GET', '/admin/brands');
    const items = data.brands || [];
    if (!items.length) { el.innerHTML = '<div class="empty-state"><p>No brands</p></div>'; return; }
    el.innerHTML = `<table><thead><tr><th>Image</th><th>Name</th><th>Status</th><th>Actions</th></tr></thead><tbody>
      ${items.map(b => `<tr>
        <td>${imgTag(b.image)}</td>
        <td><strong>${escHtml(b.name)}</strong></td>
        <td>${b.is_active !== false ? '<span class="badge badge-green">Active</span>' : '<span class="badge badge-grey">Inactive</span>'}</td>
        <td class="table-actions">
          <button class="btn btn-sm btn-outline" onclick="openBrandModal(${b.id})">✏️</button>
          <button class="btn btn-sm btn-danger" onclick="deleteBrand(${b.id})">🗑️</button>
        </td>
      </tr>`).join('')}
    </tbody></table>`;
  } catch (e) { el.innerHTML = `<div class="empty-state"><p>${escHtml(e.message)}</p></div>`; }
}

function openBrandModal(id) {
  const item = id ? allBrands.find(b => b.id === id) : null;
  showGenericModal(
    id ? 'Edit Brand' : 'Add Brand',
    `<div class="form-group"><label>Name *</label><input id="gm_name" value="${escHtml(item?.name || '')}"/></div>
     <div class="form-group"><label>Image URL</label><input id="gm_image" value="${escHtml(item?.image || '')}"/>
       <label class="btn btn-outline btn-sm upload-btn" style="margin-top:6px">Upload<input type="file" accept="image/*" onchange="uploadSingleImg(this,'gm_image')" style="display:none"/></label>
     </div>`,
    async () => {
      const body = { name: document.getElementById('gm_name').value.trim(), image: document.getElementById('gm_image').value.trim() || null };
      if (!body.name) { showToast('Name required', 'error'); return false; }
      if (id) await api('PUT', `/admin/brands/${id}`, body);
      else await api('POST', '/admin/brands', body);
      const bd = await api('GET', '/admin/brands');
      allBrands = bd.brands || [];
      loadBrandsPage();
      return true;
    }
  );
}

async function deleteBrand(id) {
  confirmDelete('Delete this brand?', async () => {
    try {
      await api('DELETE', `/admin/brands/${id}`);
      showToast('Deleted', 'success');
      const bd = await api('GET', '/admin/brands');
      allBrands = bd.brands || [];
      loadBrandsPage();
    } catch (e) { showToast(e.message, 'error'); }
  });
}

// ════════════════════════════════════════════════════════════════════
// UNITS
// ════════════════════════════════════════════════════════════════════

async function loadUnitsPage() {
  const el = document.getElementById('unitList');
  el.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  try {
    const data = await api('GET', '/units');
    const items = data.units || [];
    if (!items.length) { el.innerHTML = '<div class="empty-state"><p>No units</p></div>'; return; }
    el.innerHTML = `<table><thead><tr><th>Display Name</th><th>Number</th><th>Type</th><th>Weight (kg)</th><th>Status</th><th>Actions</th></tr></thead><tbody>
      ${items.map(u => `<tr>
        <td><strong>${escHtml(u.display_name)}</strong></td>
        <td>${escHtml(String(u.number || ''))}</td>
        <td>${escHtml(u.unit_type || '')}</td>
        <td>${u.weight_kg || '—'}</td>
        <td>${u.is_active !== false ? '<span class="badge badge-green">Active</span>' : '<span class="badge badge-grey">Inactive</span>'}</td>
        <td class="table-actions">
          <button class="btn btn-sm btn-outline" onclick="openUnitModal(${u.id})">✏️</button>
          <button class="btn btn-sm btn-danger" onclick="deleteUnit(${u.id})">🗑️</button>
        </td>
      </tr>`).join('')}
    </tbody></table>`;
  } catch (e) { el.innerHTML = `<div class="empty-state"><p>${escHtml(e.message)}</p></div>`; }
}

function openUnitModal(id) {
  const item = id ? allUnits.find(u => u.id === id) : null;
  showGenericModal(
    id ? 'Edit Unit' : 'Add Unit',
    `<div class="form-row">
       <div class="form-group"><label>Number *</label><input id="gm_number" type="number" value="${item?.number || ''}"/></div>
       <div class="form-group"><label>Unit Type *</label><input id="gm_utype" placeholder="kg, g, L, ml, pcs…" value="${escHtml(item?.unit_type || '')}"/></div>
     </div>
     <div class="form-row">
       <div class="form-group"><label>Weight (kg) *</label><input id="gm_wkg" type="number" step="0.001" value="${item?.weight_kg || ''}"/></div>
       <div class="form-group"><label>Length (cm)</label><input id="gm_lcm" type="number" step="0.1" value="${item?.length_cm || ''}"/></div>
     </div>
     <div class="form-row">
       <div class="form-group"><label>Width (cm)</label><input id="gm_wcm" type="number" step="0.1" value="${item?.width_cm || ''}"/></div>
       <div class="form-group"><label>Height (cm)</label><input id="gm_hcm" type="number" step="0.1" value="${item?.height_cm || ''}"/></div>
     </div>`,
    async () => {
      const body = {
        number: document.getElementById('gm_number').value,
        unit_type: document.getElementById('gm_utype').value.trim(),
        weight_kg: parseFloat(document.getElementById('gm_wkg').value) || 0,
        length_cm: parseFloat(document.getElementById('gm_lcm').value) || null,
        width_cm: parseFloat(document.getElementById('gm_wcm').value) || null,
        height_cm: parseFloat(document.getElementById('gm_hcm').value) || null,
      };
      if (!body.number || !body.unit_type) { showToast('Number and type required', 'error'); return false; }
      if (id) await api('PUT', `/units/${id}`, body);
      else await api('POST', '/units', body);
      const ud = await api('GET', '/units');
      allUnits = ud.units || [];
      loadUnitsPage();
      return true;
    }
  );
}

async function deleteUnit(id) {
  confirmDelete('Deactivate this unit?', async () => {
    try {
      await api('DELETE', `/units/${id}`);
      showToast('Unit deactivated', 'success');
      const ud = await api('GET', '/units');
      allUnits = ud.units || [];
      loadUnitsPage();
    } catch (e) { showToast(e.message, 'error'); }
  });
}

// ════════════════════════════════════════════════════════════════════
// SIZES
// ════════════════════════════════════════════════════════════════════

async function loadSizesPage() {
  const el = document.getElementById('sizeList');
  el.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  try {
    const data = await api('GET', '/admin/sizes');
    const items = data.sizes || [];
    if (!items.length) { el.innerHTML = '<div class="empty-state"><p>No sizes</p></div>'; return; }
    el.innerHTML = `<table><thead><tr><th>Label</th><th>Sort Order</th><th>Status</th><th>Actions</th></tr></thead><tbody>
      ${items.map(s => `<tr>
        <td><strong>${escHtml(s.label)}</strong></td>
        <td>${s.sort_order || 0}</td>
        <td>${s.is_active !== false ? '<span class="badge badge-green">Active</span>' : '<span class="badge badge-grey">Inactive</span>'}</td>
        <td class="table-actions">
          <button class="btn btn-sm btn-outline" onclick="openSizeModal(${s.id})">✏️</button>
          <button class="btn btn-sm btn-danger" onclick="deleteSize(${s.id})">🗑️</button>
        </td>
      </tr>`).join('')}
    </tbody></table>`;
  } catch (e) { el.innerHTML = `<div class="empty-state"><p>${escHtml(e.message)}</p></div>`; }
}

function openSizeModal(id) {
  const item = id ? allSizes.find(s => s.id === id) : null;
  showGenericModal(
    id ? 'Edit Size' : 'Add Size',
    `<div class="form-group"><label>Label *</label><input id="gm_label" value="${escHtml(item?.label || '')}"/></div>
     <div class="form-group"><label>Sort Order</label><input id="gm_sort" type="number" value="${item?.sort_order || 0}"/></div>`,
    async () => {
      const body = { label: document.getElementById('gm_label').value.trim(), sort_order: parseInt(document.getElementById('gm_sort').value) || 0 };
      if (!body.label) { showToast('Label required', 'error'); return false; }
      if (id) await api('PUT', `/admin/sizes/${id}`, body);
      else await api('POST', '/admin/sizes', body);
      const sd = await api('GET', '/admin/sizes');
      allSizes = sd.sizes || [];
      loadSizesPage();
      return true;
    }
  );
}

async function deleteSize(id) {
  confirmDelete('Delete this size?', async () => {
    try {
      await api('DELETE', `/admin/sizes/${id}`);
      showToast('Deleted', 'success');
      const sd = await api('GET', '/admin/sizes');
      allSizes = sd.sizes || [];
      loadSizesPage();
    } catch (e) { showToast(e.message, 'error'); }
  });
}

// ════════════════════════════════════════════════════════════════════
// COLORS
// ════════════════════════════════════════════════════════════════════

async function loadColorsPage() {
  const el = document.getElementById('colorList');
  el.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
  try {
    const data = await api('GET', '/admin/colors');
    const items = data.colors || [];
    if (!items.length) { el.innerHTML = '<div class="empty-state"><p>No colors</p></div>'; return; }
    el.innerHTML = `<table><thead><tr><th>Swatch</th><th>Label</th><th>Hex</th><th>Sort</th><th>Status</th><th>Actions</th></tr></thead><tbody>
      ${items.map(c => `<tr>
        <td><span class="color-swatch" style="background:${escHtml(c.hex_code || '#ccc')}"></span></td>
        <td><strong>${escHtml(c.label)}</strong></td>
        <td><code>${escHtml(c.hex_code || '—')}</code></td>
        <td>${c.sort_order || 0}</td>
        <td>${c.is_active !== false ? '<span class="badge badge-green">Active</span>' : '<span class="badge badge-grey">Inactive</span>'}</td>
        <td class="table-actions">
          <button class="btn btn-sm btn-outline" onclick="openColorModal(${c.id})">✏️</button>
          <button class="btn btn-sm btn-danger" onclick="deleteColor(${c.id})">🗑️</button>
        </td>
      </tr>`).join('')}
    </tbody></table>`;
  } catch (e) { el.innerHTML = `<div class="empty-state"><p>${escHtml(e.message)}</p></div>`; }
}

function openColorModal(id) {
  const item = id ? allColors.find(c => c.id === id) : null;
  showGenericModal(
    id ? 'Edit Color' : 'Add Color',
    `<div class="form-group"><label>Label *</label><input id="gm_label" value="${escHtml(item?.label || '')}"/></div>
     <div class="form-row">
       <div class="form-group"><label>Hex Code</label><input id="gm_hex" type="text" placeholder="#FF0000" value="${escHtml(item?.hex_code || '')}"/></div>
       <div class="form-group"><label>Preview</label><span id="gm_swatch" class="color-swatch" style="background:${escHtml(item?.hex_code || '#ccc')};width:40px;height:40px;border-radius:8px;display:inline-block"></span></div>
     </div>
     <div class="form-group"><label>Sort Order</label><input id="gm_sort" type="number" value="${item?.sort_order || 0}"/></div>`,
    async () => {
      const body = {
        label: document.getElementById('gm_label').value.trim(),
        hex_code: document.getElementById('gm_hex').value.trim() || null,
        sort_order: parseInt(document.getElementById('gm_sort').value) || 0,
      };
      if (!body.label) { showToast('Label required', 'error'); return false; }
      if (id) await api('PUT', `/admin/colors/${id}`, body);
      else await api('POST', '/admin/colors', body);
      const cd = await api('GET', '/admin/colors');
      allColors = cd.colors || [];
      loadColorsPage();
      return true;
    }
  );
  // live preview
  setTimeout(() => {
    const hexInput = document.getElementById('gm_hex');
    if (hexInput) hexInput.addEventListener('input', () => {
      const sw = document.getElementById('gm_swatch');
      if (sw) sw.style.background = hexInput.value || '#ccc';
    });
  }, 100);
}

async function deleteColor(id) {
  confirmDelete('Delete this color?', async () => {
    try {
      await api('DELETE', `/admin/colors/${id}`);
      showToast('Deleted', 'success');
      const cd = await api('GET', '/admin/colors');
      allColors = cd.colors || [];
      loadColorsPage();
    } catch (e) { showToast(e.message, 'error'); }
  });
}

// ════════════════════════════════════════════════════════════════════
// GENERIC MODAL HELPER
// ════════════════════════════════════════════════════════════════════

function showGenericModal(title, bodyHtml, onSave) {
  document.getElementById('genericModalTitle').textContent = title;
  document.getElementById('genericModalBody').innerHTML = bodyHtml;
  const saveBtn = document.getElementById('genericModalSave');
  saveBtn.onclick = async () => {
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving…';
    try {
      const ok = await onSave();
      if (ok !== false) {
        closeModal('genericModal');
        showToast('Saved successfully', 'success');
      }
    } catch (e) {
      showToast('Error: ' + e.message, 'error');
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save';
    }
  };
  openModal('genericModal');
}

// ── SINGLE IMAGE UPLOAD (for generic modal) ──────────────────────────
async function uploadSingleImg(input, targetId) {
  const file = input.files[0];
  if (!file) return;
  const fd = new FormData();
  fd.append('images', file);
  try {
    const data = await api('POST', '/admin/upload', fd, true);
    const url = (data.urls || [])[0] || '';
    document.getElementById(targetId).value = url;
    showToast('Image uploaded');
  } catch (e) {
    showToast('Upload failed: ' + e.message, 'error');
  }
}

// ── Bulk Upload ──────────────────────────────────────────
function openBulkUpload() {
  document.getElementById('bulkExcelName').textContent = 'No file selected';
  document.getElementById('bulkImagesName').textContent = 'No images selected';
  document.getElementById('bulkExcelFile').value = '';
  document.getElementById('bulkImagesFile').value = '';
  document.getElementById('bulkProgress').classList.add('hidden');
  document.getElementById('bulkResult').classList.add('hidden');
  document.getElementById('bulkUploadBtn').disabled = false;
  openModal('bulkUploadModal');
}

function onBulkExcelChange(input) {
  document.getElementById('bulkExcelName').textContent =
    input.files[0] ? input.files[0].name : 'No file selected';
}

function onBulkImagesChange(input) {
  const n = input.files.length;
  document.getElementById('bulkImagesName').textContent =
    n ? `${n} image${n > 1 ? 's' : ''} selected` : 'No images selected';
}

async function downloadTemplate() {
  try {
    const a = document.createElement('a');
    a.href = BASE + '/admin/template?token=' + encodeURIComponent(token);
    a.download = 'bettermend_product_template.xlsx';
    a.target = '_blank';
    a.click();
  } catch (e) {
    showToast('Download failed: ' + e.message, 'error');
  }
}

async function submitBulkUpload() {
  const excelFile = document.getElementById('bulkExcelFile').files[0];
  if (!excelFile) { showToast('Please select an Excel file', 'error'); return; }

  const btn = document.getElementById('bulkUploadBtn');
  const progress = document.getElementById('bulkProgress');
  const progressFill = document.getElementById('bulkProgressFill');
  const progressText = document.getElementById('bulkProgressText');
  const resultDiv = document.getElementById('bulkResult');

  btn.disabled = true;
  progress.classList.remove('hidden');
  resultDiv.classList.add('hidden');
  progressFill.style.background = 'var(--primary)';
  progressFill.style.width = '10%';
  progressText.textContent = 'Uploading...';

  try {
    const fd = new FormData();
    fd.append('excel', excelFile);
    const imageFiles = document.getElementById('bulkImagesFile').files;
    for (const f of imageFiles) fd.append('images', f);

    progressFill.style.width = '40%';
    progressText.textContent = 'Processing on server...';

    const res = await fetch(BASE + '/admin/bulk-upload', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token },
      body: fd
    });

    progressFill.style.width = '90%';
    const data = await res.json();
    progressFill.style.width = '100%';

    if (!data.success) throw new Error(data.message);

    const r = data.results;
    let html = `<strong>&#x2705; Done!</strong><br>
      Products: ${r.created} created, ${r.updated} updated<br>
      Variants: ${r.variants_created} created, ${r.variants_updated} updated`;

    if (r.errors && r.errors.length) {
      html += `<br><br><strong>&#x26A0; Warnings (${r.errors.length}):</strong><ul>`;
      r.errors.slice(0, 20).forEach(e => { html += `<li>${e}</li>`; });
      if (r.errors.length > 20) html += `<li>...and ${r.errors.length - 20} more</li>`;
      html += '</ul>';
    }

    resultDiv.className = 'bulk-result success';
    resultDiv.innerHTML = html;
    resultDiv.classList.remove('hidden');
    progressText.textContent = 'Complete!';
    loadProducts();
  } catch (e) {
    progressFill.style.width = '100%';
    progressFill.style.background = 'var(--danger)';
    progressText.textContent = 'Failed';
    resultDiv.className = 'bulk-result error';
    resultDiv.innerHTML = '&#x274C; ' + e.message;
    resultDiv.classList.remove('hidden');
  } finally {
    btn.disabled = false;
  }
}
