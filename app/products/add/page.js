'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, uploadImages, resolveImg } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { saveDraft } from '@/lib/drafts';
import {
  FiArrowLeft,
  FiPlus,
  FiTrash2,
  FiCopy,
  FiCheck,
  FiFileText,
  FiGrid,
  FiHelpCircle,
  FiImage,
  FiUploadCloud,
  FiBox,
  FiX,
  FiLayers,
  FiEdit3,
} from 'react-icons/fi';

// ── SHEET 1: PRODUCT DETAILS COLUMNS (EXCEL SPREADSHEET) ──
const PRODUCT_COLUMNS = [
  { key: 'images', letter: 'A', label: 'Product Photos', width: '150px' },
  { key: 'name', letter: 'B', label: 'Product Name *', width: '230px' },
  { key: 'brandId', letter: 'C', label: 'Brand', width: '170px' },
  { key: 'categoryId', letter: 'D', label: 'Category', width: '180px' },
  { key: 'subcategoryId', letter: 'E', label: 'Subcategory', width: '180px' },
  { key: 'isVeg', letter: 'F', label: 'Food Type', width: '130px' },
  { key: 'gstPercent', letter: 'G', label: 'GST %', width: '100px' },
  { key: 'description', letter: 'H', label: 'Description', width: '260px' },
  { key: 'searchKeywords', letter: 'I', label: 'Search Keywords', width: '200px' },
];

// ── SHEET 2: VARIANTS COLUMNS (EXCEL SPREADSHEET) ──
const VARIANT_COLUMNS = [
  { key: 'images', letter: 'A', label: 'Images', width: '140px' },
  { key: 'unitId', letter: 'B', label: 'Unit', width: '180px' },
  { key: 'size', letter: 'C', label: 'Size', width: '160px' },
  { key: 'color', letter: 'D', label: 'Color', width: '160px' },
  { key: 'description', letter: 'E', label: 'Description', width: '240px' },
  { key: 'customFields', letter: 'F', label: 'Custom Fields', width: '220px' },
];

const PROD_COL_LETTERS = PRODUCT_COLUMNS.reduce((acc, col) => {
  acc[col.key] = col.letter;
  return acc;
}, {});

const VAR_COL_LETTERS = VARIANT_COLUMNS.reduce((acc, col) => {
  acc[col.key] = col.letter;
  return acc;
}, {});

const createEmptyProductRow = (id = 1) => ({
  id,
  images: [],
  name: '',
  brandId: '',
  categoryId: '',
  subcategoryId: '',
  isVeg: 'true',
  gstPercent: '0',
  description: '',
  searchKeywords: '',
});

const createEmptyVariantRow = (id = 1) => ({
  id,
  images: [],
  unitId: '',
  size: '',
  color: '',
  description: '',
  customFields: [], // Array of { label: '', value: '' }
});

export default function AddProductPage() {
  const router = useRouter();
  const { masterData } = useAuth();
  const { showToast } = useToast();

  const [saving, setSaving] = useState(false);
  const [subcatCache, setSubcatCache] = useState({});

  // Screen detection (mobile vs desktop)
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkScreen = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      if (mobile) {
        setVariantViewMode('cards');
      }
    };
    checkScreen();
    window.addEventListener('resize', checkScreen);
    return () => window.removeEventListener('resize', checkScreen);
  }, []);

  // ── ACTIVE SHEET: 'details' (Sheet 1) OR 'variants' (Sheet 2) ──
  const [activeSheet, setActiveSheet] = useState('details');

  // Variant View Mode in Sheet 2: 'grid' (Excel Spreadsheet) vs 'cards' (Form Cards matching user mockup)
  const [variantViewMode, setVariantViewMode] = useState('grid');

  // Sheet 1: Product Master Rows (Excel Grid)
  const [productRows, setProductRows] = useState([
    createEmptyProductRow(1),
  ]);
  const [activeProdRowIdx, setActiveProdRowIdx] = useState(0);
  const [activeProdCol, setActiveProdCol] = useState('name');

  // Sheet 2: Variants Rows (Excel Grid / Cards)
  const [variantRows, setVariantRows] = useState([
    createEmptyVariantRow(1),
    createEmptyVariantRow(2),
    createEmptyVariantRow(3),
  ]);
  const [activeVarRowIdx, setActiveVarRowIdx] = useState(0);
  const [activeVarCol, setActiveVarCol] = useState('unitId');

  // Media Manager Popover State
  const [mediaTarget, setMediaTarget] = useState(null); // { type: 'product'|'variant', rowIdx: number }

  // Custom Fields Modal Popover State for Excel Grid mode
  const [customFieldTargetIdx, setCustomFieldTargetIdx] = useState(null); // variant row index

  // Dynamic Subcategories Cache
  const loadSubcategories = useCallback(
    async (catId) => {
      if (!catId || subcatCache[catId]) return;
      try {
        const res = await api('GET', `/categories/${catId}/subcategories`);
        setSubcatCache((prev) => ({
          ...prev,
          [catId]: res.subcategories || [],
        }));
      } catch {
        const matched = (masterData.subcats || []).filter(
          (s) => String(s.category_id) === String(catId)
        );
        setSubcatCache((prev) => ({
          ...prev,
          [catId]: matched,
        }));
      }
    },
    [subcatCache, masterData.subcats]
  );

  // ── SHEET 1 CELL UPDATE ──
  const updateProductCell = (rowIdx, colKey, value) => {
    setProductRows((prev) => {
      const next = [...prev];
      if (next[rowIdx]) {
        next[rowIdx] = { ...next[rowIdx], [colKey]: value };
        if (colKey === 'categoryId') {
          next[rowIdx].subcategoryId = '';
        }
      }
      return next;
    });

    if (colKey === 'categoryId' && value) {
      loadSubcategories(value);
    }
  };

  // ── SHEET 2 CELL UPDATE ──
  const updateVariantCell = (rowIdx, colKey, value) => {
    setVariantRows((prev) => {
      const next = [...prev];
      if (next[rowIdx]) {
        next[rowIdx] = { ...next[rowIdx], [colKey]: value };
      }
      return next;
    });
  };

  // ── CUSTOM FIELDS HANDLERS FOR VARIANTS ──
  const addVariantCustomField = (rowIdx) => {
    setVariantRows((prev) => {
      const next = [...prev];
      if (next[rowIdx]) {
        const existing = next[rowIdx].customFields || [];
        next[rowIdx] = {
          ...next[rowIdx],
          customFields: [...existing, { label: '', value: '' }],
        };
      }
      return next;
    });
  };

  const updateVariantCustomField = (rowIdx, fieldIdx, key, val) => {
    setVariantRows((prev) => {
      const next = [...prev];
      if (next[rowIdx] && next[rowIdx].customFields) {
        const cFields = [...next[rowIdx].customFields];
        cFields[fieldIdx] = { ...cFields[fieldIdx], [key]: val };
        next[rowIdx] = { ...next[rowIdx], customFields: cFields };
      }
      return next;
    });
  };

  const removeVariantCustomField = (rowIdx, fieldIdx) => {
    setVariantRows((prev) => {
      const next = [...prev];
      if (next[rowIdx] && next[rowIdx].customFields) {
        next[rowIdx] = {
          ...next[rowIdx],
          customFields: next[rowIdx].customFields.filter((_, i) => i !== fieldIdx),
        };
      }
      return next;
    });
  };

  const addNewVariant = () => {
    setVariantRows((prev) => [...prev, createEmptyVariantRow(Date.now())]);
    showToast(`Variant #${variantRows.length + 1} added`, 'info');
  };

  const duplicateVariant = (rIdx) => {
    if (!variantRows[rIdx]) return;
    const cloned = { ...variantRows[rIdx], id: Date.now() };
    setVariantRows((prev) => [...prev, cloned]);
    showToast(`Variant #${rIdx + 1} duplicated`, 'info');
  };

  const removeVariant = (rIdx) => {
    if (variantRows.length <= 1) {
      setVariantRows([createEmptyVariantRow(1)]);
      showToast('Variant reset to empty', 'info');
      return;
    }
    setVariantRows((prev) => prev.filter((_, idx) => idx !== rIdx));
    showToast(`Variant #${rIdx + 1} removed`, 'info');
  };

  // ── IMAGE UPLOAD HANDLING ──
  const handleUploadImages = async (e, type, rowIdx) => {
    const files = e.target.files;
    if (!files || !files.length) return;
    try {
      showToast('Uploading images…', 'info');
      const urls = await uploadImages(files);
      if (type === 'product') {
        const existing = productRows[rowIdx]?.images || [];
        updateProductCell(rowIdx, 'images', [...existing, ...urls]);
      } else {
        const existing = variantRows[rowIdx]?.images || [];
        updateVariantCell(rowIdx, 'images', [...existing, ...urls]);
      }
      showToast('Images uploaded successfully', 'success');
    } catch {
      // Fallback for offline/local preview
      const localUrls = Array.from(files).map((f) => URL.createObjectURL(f));
      if (type === 'product') {
        const existing = productRows[rowIdx]?.images || [];
        updateProductCell(rowIdx, 'images', [...existing, ...localUrls]);
      } else {
        const existing = variantRows[rowIdx]?.images || [];
        updateVariantCell(rowIdx, 'images', [...existing, ...localUrls]);
      }
      showToast('Images attached (preview ready)', 'info');
    }
    e.target.value = '';
  };

  const removeImage = (type, rowIdx, imgIdx) => {
    if (type === 'product') {
      const existing = productRows[rowIdx]?.images || [];
      updateProductCell(
        rowIdx,
        'images',
        existing.filter((_, i) => i !== imgIdx)
      );
    } else {
      const existing = variantRows[rowIdx]?.images || [];
      updateVariantCell(
        rowIdx,
        'images',
        existing.filter((_, i) => i !== imgIdx)
      );
    }
  };

  // ── DONE BUTTON ON SHEET 1 (TRANSITION TO SHEET 2 VARIANTS) ──
  const handleDoneToVariants = () => {
    const mainProd = productRows[0] || {};
    if (!mainProd.name || !mainProd.name.trim()) {
      showToast('Please enter the Product Name in Col B before proceeding to variants', 'error');
      setActiveProdCol('name');
      return;
    }
    setActiveSheet('variants');
    showToast(`Product "${mainProd.name}" confirmed! Now enter variants in Sheet 2.`, 'success');
  };

  // ── SAVE PRODUCT ACTION (CREATES PRODUCT & VARIANTS) ──
  const handleSaveProduct = async () => {
    const mainProd = productRows[0] || {};
    if (!mainProd.name || !mainProd.name.trim()) {
      showToast('Please enter the Product Name in Sheet 1', 'error');
      setActiveSheet('details');
      return;
    }

    setSaving(true);
    try {
      const firstVariant = variantRows[0] || {};
      const payload = {
        name: mainProd.name.trim(),
        description: mainProd.description ? mainProd.description.trim() : null,
        brand_id: mainProd.brandId ? parseInt(mainProd.brandId) : null,
        category_id: mainProd.categoryId ? parseInt(mainProd.categoryId) : null,
        subcategory_id: mainProd.subcategoryId ? parseInt(mainProd.subcategoryId) : null,
        is_veg: mainProd.isVeg === 'true',
        gst_percent: parseFloat(mainProd.gstPercent) || 0,
        images: mainProd.images || [],
        search_keywords: (mainProd.searchKeywords || '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        default_unit_id: firstVariant.unitId ? parseInt(firstVariant.unitId) : null,
        default_size: firstVariant.size || null,
        default_color: firstVariant.color || null,
      };

      // Valid variants from Sheet 2
      const validVariants = variantRows.filter(
        (v) =>
          (v.unitId && String(v.unitId).trim()) ||
          (v.size && v.size.trim()) ||
          (v.color && v.color.trim()) ||
          (v.description && v.description.trim()) ||
          (v.images && v.images.length > 0) ||
          (v.customFields && v.customFields.some((f) => f.label && f.label.trim()))
      );

      let createdTargetId = null;

      try {
        const res = await api('POST', '/admin/products', payload);
        createdTargetId = (res.product || res).id;

        if (createdTargetId) {
          // Add all variants to product
          for (const vr of validVariants) {
            const cFields = (vr.customFields || [])
              .filter((f) => f.label && f.label.trim())
              .map((f) => ({ label: f.label.trim(), value: f.value ? f.value.trim() : '' }));

            await api('POST', `/admin/products/${createdTargetId}/variants`, {
              unit_id: vr.unitId ? parseInt(vr.unitId) : null,
              size: vr.size || null,
              color: vr.color || null,
              description: vr.description || null,
              images: vr.images || [],
              custom_fields: cFields,
            }).catch(() => {});
          }

          // Link attributes
          const assignedSizeNames = validVariants.map((v) => v.size).filter(Boolean);
          const assignedColorNames = validVariants.map((v) => v.color).filter(Boolean);
          const matchedSizes = masterData.sizes.filter((s) =>
            assignedSizeNames.includes(s.label || s.name)
          );
          const matchedColors = masterData.colors.filter((c) =>
            assignedColorNames.includes(c.label || c.name)
          );
          const assignedUnitIds = Array.from(
            new Set(validVariants.map((v) => v.unitId).filter(Boolean).map(Number))
          );

          if (matchedSizes.length || matchedColors.length) {
            await api('PUT', `/admin/products/${createdTargetId}/attributes`, {
              size_ids: matchedSizes.map((s) => s.id),
              color_ids: matchedColors.map((c) => c.id),
            }).catch(() => {});
          }

          if (assignedUnitIds.length) {
            await api('PUT', `/units/assigned/${createdTargetId}`, {
              unit_ids: assignedUnitIds,
            }).catch(() => {});
          }
        }
      } catch {
        // Offline / mock catalog fallback
        const selectedBrand = masterData.brands.find(
          (b) => String(b.id) === String(mainProd.brandId)
        );
        const selectedCat = masterData.categories.find(
          (c) => String(c.id) === String(mainProd.categoryId)
        );

        saveDraft({
          ...payload,
          brand_name: selectedBrand?.name || null,
          category_name: selectedCat?.name || null,
          variants: validVariants,
          status: 'draft',
        });
      }

      showToast(
        `Successfully saved "${mainProd.name}" with ${validVariants.length} variant(s)!`,
        'success'
      );
      router.push('/products');
    } catch (err) {
      showToast('Save failed: ' + err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  // ── SAVE TO DRAFTS ──
  const handleSaveToDrafts = () => {
    const mainProd = productRows[0] || {};
    if (!mainProd.name || !mainProd.name.trim()) {
      showToast('Enter a product name to save as draft', 'error');
      return;
    }

    const selectedBrand = masterData.brands.find(
      (b) => String(b.id) === String(mainProd.brandId)
    );
    const selectedCat = masterData.categories.find(
      (c) => String(c.id) === String(mainProd.categoryId)
    );

    const validVariants = variantRows.filter(
      (v) =>
        (v.unitId && String(v.unitId).trim()) ||
        (v.size && v.size.trim()) ||
        (v.color && v.color.trim()) ||
        (v.description && v.description.trim()) ||
        (v.images && v.images.length > 0) ||
        (v.customFields && v.customFields.some((f) => f.label && f.label.trim()))
    );

    saveDraft({
      name: mainProd.name.trim(),
      description: mainProd.description || null,
      brand_id: mainProd.brandId ? parseInt(mainProd.brandId) : null,
      brand_name: selectedBrand?.name || null,
      category_id: mainProd.categoryId ? parseInt(mainProd.categoryId) : null,
      category_name: selectedCat?.name || null,
      subcategory_id: mainProd.subcategoryId ? parseInt(mainProd.subcategoryId) : null,
      is_veg: mainProd.isVeg === 'true',
      gst_percent: parseFloat(mainProd.gstPercent) || 0,
      images: mainProd.images || [],
      search_keywords: (mainProd.searchKeywords || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      default_size: variantRows[0]?.size || null,
      default_color: variantRows[0]?.color || null,
      default_unit_id: variantRows[0]?.unitId ? parseInt(variantRows[0].unitId) : null,
      variants: validVariants,
      status: 'draft',
    });

    showToast(`Saved "${mainProd.name}" to Drafts!`, 'success');
    router.push('/drafts');
  };

  // Active cell coordinate and value
  const currentProdRow = productRows[activeProdRowIdx] || createEmptyProductRow(1);
  const currentVarRow = variantRows[activeVarRowIdx] || createEmptyVariantRow(1);

  const activeCoord =
    activeSheet === 'details'
      ? `${PROD_COL_LETTERS[activeProdCol] || 'A'}${activeProdRowIdx + 1}`
      : `${VAR_COL_LETTERS[activeVarCol] || 'A'}${activeVarRowIdx + 1}`;

  const activeValue =
    activeSheet === 'details'
      ? activeProdCol === 'images'
        ? `${(currentProdRow.images || []).length} images uploaded`
        : currentProdRow[activeProdCol] || ''
      : activeVarCol === 'images'
      ? `${(currentVarRow.images || []).length} images uploaded`
      : activeVarCol === 'customFields'
      ? `${(currentVarRow.customFields || []).length} custom fields`
      : currentVarRow[activeVarCol] || '';

  const mainProduct = productRows[0] || {};
  const filledVariantsCount = variantRows.filter(
    (v) =>
      v.unitId ||
      v.size ||
      v.color ||
      v.description ||
      (v.images && v.images.length > 0) ||
      (v.customFields && v.customFields.length > 0)
  ).length;

  return (
    <>
      {/* ═══════════════════════════════════════════════════════════════════
          ── MOBILE SCREEN: NORMAL PRODUCT ADDING SECTION (<= 768px) ──
          ═══════════════════════════════════════════════════════════════════ */}
      <div className="mobile-product-page-wrapper">
        {/* 1. Mobile Topbar Header */}
        <div className="mobile-product-topbar">
          <Link href="/products" className="mobile-topbar-back-btn" title="Back to Products">
            <FiArrowLeft size={16} />
            <span>Products</span>
          </Link>

          <div className="mobile-product-topbar-title-box">
            <h1 className="mobile-product-topbar-title">Add Product</h1>
            <span className="mobile-product-topbar-sub">
              {activeSheet === 'details'
                ? 'Step 1: Basic Information'
                : `Step 2: Variants (${filledVariantsCount})`}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              className="mobile-topbar-draft-btn"
              onClick={handleSaveToDrafts}
              title="Save to Drafts"
            >
              <FiFileText size={13} />
              <span>Draft</span>
            </button>
            <button
              type="button"
              className="mobile-topbar-save-btn"
              onClick={handleSaveProduct}
              disabled={saving}
              title="Save Product"
            >
              <FiCheck size={14} />
              <span>{saving ? '…' : 'Save'}</span>
            </button>
          </div>
        </div>

        {/* 2. Step Switcher Tabs */}
        <div className="mobile-product-tabs-bar">
          <div className="mobile-product-tabs-pill">
            <button
              type="button"
              className={`mobile-product-tab-btn ${activeSheet === 'details' ? 'active' : ''}`}
              onClick={() => setActiveSheet('details')}
            >
              <FiBox size={14} />
              <span>1. Basic Details</span>
              {mainProduct.name && mainProduct.name.trim() && (
                <span className="mobile-product-tab-check">✓</span>
              )}
            </button>
            <button
              type="button"
              className={`mobile-product-tab-btn ${activeSheet === 'variants' ? 'active' : ''}`}
              onClick={() => {
                if (!mainProduct.name || !mainProduct.name.trim()) {
                  showToast('Please enter the Product Name first', 'error');
                  return;
                }
                setActiveSheet('variants');
              }}
            >
              <FiLayers size={14} />
              <span>2. Variants ({filledVariantsCount})</span>
            </button>
          </div>
        </div>

        {/* 3. Tab 1: Basic Details */}
        {activeSheet === 'details' && (
          <div className="mobile-form-container">
            {/* Card 1: Product Photos */}
            <div className="mobile-form-card">
              <div className="mobile-card-header">
                <div className="mobile-card-icon">
                  <FiImage />
                </div>
                <div>
                  <div className="mobile-card-title">1. Product Photos</div>
                  <div className="mobile-card-desc">Upload photos from device or camera</div>
                </div>
              </div>

              <label className="mobile-image-uploader">
                <div className="mobile-uploader-icon">
                  <FiUploadCloud />
                </div>
                <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--primary)' }}>
                  Tap to Choose or Take Photos
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Supports JPG, PNG, WEBP (multiple images)
                </div>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={(e) => handleUploadImages(e, 'product', 0)}
                />
              </label>

              {(mainProduct.images || []).length > 0 && (
                <div className="mobile-image-previews">
                  {(mainProduct.images || []).map((img, i) => (
                    <div key={i} className="mobile-img-thumb">
                      <img src={resolveImg(img)} alt={`Product ${i + 1}`} />
                      {i === 0 && <span className="mobile-img-main-badge">Cover</span>}
                      <button
                        type="button"
                        className="mobile-img-remove-btn"
                        onClick={() => removeImage('product', 0, i)}
                        aria-label="Remove image"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Card 2: Basic Information */}
            <div className="mobile-form-card">
              <div className="mobile-card-header">
                <div className="mobile-card-icon">
                  <FiBox />
                </div>
                <div>
                  <div className="mobile-card-title">2. Basic Details</div>
                  <div className="mobile-card-desc">Name, brand & categories</div>
                </div>
              </div>

              <div className="mobile-form-group">
                <label className="mobile-form-label">
                  Product Name <span className="required">*</span>
                </label>
                <input
                  type="text"
                  className="mobile-input"
                  placeholder="e.g. Basmati Rice 5kg"
                  value={mainProduct.name || ''}
                  onChange={(e) => updateProductCell(0, 'name', e.target.value)}
                />
              </div>

              <div className="form-row" style={{ gap: '12px' }}>
                <div className="mobile-form-group" style={{ flex: 1 }}>
                  <label className="mobile-form-label">Brand</label>
                  <select
                    className="mobile-select"
                    value={mainProduct.brandId || ''}
                    onChange={(e) => updateProductCell(0, 'brandId', e.target.value)}
                  >
                    <option value="">— Select Brand —</option>
                    {masterData.brands.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mobile-form-group" style={{ flex: 1 }}>
                  <label className="mobile-form-label">Category</label>
                  <select
                    className="mobile-select"
                    value={mainProduct.categoryId || ''}
                    onChange={(e) => updateProductCell(0, 'categoryId', e.target.value)}
                  >
                    <option value="">— Select Category —</option>
                    {masterData.categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mobile-form-group">
                <label className="mobile-form-label">Subcategory</label>
                <select
                  className="mobile-select"
                  value={mainProduct.subcategoryId || ''}
                  onChange={(e) => updateProductCell(0, 'subcategoryId', e.target.value)}
                  disabled={!mainProduct.categoryId}
                >
                  <option value="">
                    {mainProduct.categoryId ? '— Select Subcategory —' : '— Select Category First —'}
                  </option>
                  {(subcatCache[mainProduct.categoryId] || []).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Card 3: Classification & Tax */}
            <div className="mobile-form-card">
              <div className="mobile-card-header">
                <div className="mobile-card-icon">
                  <FiCheck />
                </div>
                <div>
                  <div className="mobile-card-title">3. Classification & Tax</div>
                  <div className="mobile-card-desc">Dietary type & GST percentage</div>
                </div>
              </div>

              <div className="mobile-form-group">
                <label className="mobile-form-label">Dietary Type</label>
                <div className="mobile-dietary-row">
                  <button
                    type="button"
                    className={`mobile-dietary-btn ${mainProduct.isVeg === 'true' ? 'active veg' : ''}`}
                    onClick={() => updateProductCell(0, 'isVeg', 'true')}
                  >
                    <span style={{ fontSize: '15px' }}>🟢</span> Vegetarian
                  </button>
                  <button
                    type="button"
                    className={`mobile-dietary-btn ${mainProduct.isVeg === 'false' ? 'active nonveg' : ''}`}
                    onClick={() => updateProductCell(0, 'isVeg', 'false')}
                  >
                    <span style={{ fontSize: '15px' }}>🔴</span> Non-Veg
                  </button>
                </div>
              </div>

              <div className="mobile-form-group">
                <label className="mobile-form-label">GST Tax Rate (%)</label>
                <div className="mobile-pills-row" style={{ marginBottom: '8px' }}>
                  {['0', '5', '12', '18', '28'].map((rate) => (
                    <button
                      key={rate}
                      type="button"
                      className={`mobile-pill-btn ${String(mainProduct.gstPercent) === rate ? 'active' : ''}`}
                      onClick={() => updateProductCell(0, 'gstPercent', rate)}
                    >
                      {rate}%
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  min="0"
                  max="100"
                  className="mobile-input"
                  placeholder="Custom GST %"
                  value={mainProduct.gstPercent || ''}
                  onChange={(e) => updateProductCell(0, 'gstPercent', e.target.value)}
                />
              </div>
            </div>

            {/* Card 4: Description & Search Keywords */}
            <div className="mobile-form-card">
              <div className="mobile-card-header">
                <div className="mobile-card-icon">
                  <FiFileText />
                </div>
                <div>
                  <div className="mobile-card-title">4. Description & Keywords</div>
                  <div className="mobile-card-desc">Customer description & search tags</div>
                </div>
              </div>

              <div className="mobile-form-group">
                <label className="mobile-form-label">Description</label>
                <textarea
                  rows={3}
                  className="mobile-textarea"
                  placeholder="Enter product description, highlights, ingredients, usage..."
                  value={mainProduct.description || ''}
                  onChange={(e) => updateProductCell(0, 'description', e.target.value)}
                />
              </div>

              <div className="mobile-form-group">
                <label className="mobile-form-label">Search Keywords</label>
                <input
                  type="text"
                  className="mobile-input"
                  placeholder="rice, basmati, premium (comma separated)"
                  value={mainProduct.searchKeywords || ''}
                  onChange={(e) => updateProductCell(0, 'searchKeywords', e.target.value)}
                />
                <span style={{ fontSize: '11px', color: 'var(--text-light)', marginTop: '2px' }}>
                  Keywords help customers discover this product faster.
                </span>
              </div>
            </div>

            {/* Card 5: Step 2 Call to Action */}
            <div className="mobile-form-card" style={{ background: '#f8fafc', border: '1.5px dashed #cbd5e1' }}>
              <div style={{ fontWeight: 800, fontSize: '14px', color: 'var(--primary)' }}>
                Step 1 Basic Details Completed?
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Proceed to Step 2 to add packaging units, sizes, colors and custom fields.
              </div>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleDoneToVariants}
                style={{
                  padding: '12px 18px',
                  borderRadius: '10px',
                  fontWeight: 800,
                  fontSize: '13.5px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  marginTop: '4px',
                }}
              >
                <FiCheck size={16} /> Continue to Add Variants (Step 2) ➔
              </button>
            </div>
          </div>
        )}

        {/* 4. Tab 2: Variants */}
        {activeSheet === 'variants' && (
          <div className="mobile-form-container">
            {/* Summary Banner */}
            <div className="mobile-summary-banner">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                {(mainProduct.images || [])[0] ? (
                  <img
                    src={resolveImg(mainProduct.images[0])}
                    alt=""
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '6px',
                      objectFit: 'cover',
                      border: '1px solid #86efac',
                      flexShrink: 0,
                    }}
                  />
                ) : (
                  <span style={{ fontSize: '20px', flexShrink: 0 }}>📦</span>
                )}
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: '13px',
                      fontWeight: 800,
                      color: '#14532d',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {mainProduct.name || 'New Product'}
                  </div>
                  <div style={{ fontSize: '11px', color: '#16a34a' }}>
                    {variantRows.length} variant{variantRows.length > 1 ? 's' : ''} configured
                  </div>
                </div>
              </div>

              <button
                type="button"
                className="btn btn-sm btn-outline"
                onClick={() => setActiveSheet('details')}
                style={{
                  background: '#ffffff',
                  fontSize: '11px',
                  padding: '5px 10px',
                  flexShrink: 0,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <FiEdit3 size={12} /> Edit Info
              </button>
            </div>

            {/* List of Variant Cards */}
            {variantRows.map((vr, rIdx) => (
              <div key={vr.id || rIdx} className="variant-mockup-card">
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderBottom: '1px solid #e2e8f0',
                    paddingBottom: '10px',
                  }}
                >
                  <span style={{ fontWeight: 800, color: 'var(--primary)', fontSize: '14.5px' }}>
                    Variant #{rIdx + 1}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <button
                      type="button"
                      className="mobile-var-btn-duplicate"
                      onClick={() => duplicateVariant(rIdx)}
                    >
                      <FiCopy size={12} /> Duplicate
                    </button>
                    {variantRows.length > 1 && (
                      <button
                        type="button"
                        className="mobile-var-btn-remove"
                        onClick={() => removeVariant(rIdx)}
                      >
                        <FiTrash2 size={12} /> Remove
                      </button>
                    )}
                  </div>
                </div>

                {/* Unit, Size, Color (Grid) */}
                <div className="variant-mockup-grid-3">
                  <div>
                    <label className="variant-mockup-label">UNIT</label>
                    <select
                      className="variant-mockup-select"
                      value={vr.unitId || ''}
                      onChange={(e) => updateVariantCell(rIdx, 'unitId', e.target.value)}
                    >
                      <option value="">— None —</option>
                      {masterData.units.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.display_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="variant-mockup-label">SIZE</label>
                    <select
                      className="variant-mockup-select"
                      value={vr.size || ''}
                      onChange={(e) => updateVariantCell(rIdx, 'size', e.target.value)}
                    >
                      <option value="">— None —</option>
                      {masterData.sizes.map((s) => (
                        <option key={s.id} value={s.label || s.name}>
                          {s.label || s.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="variant-mockup-label">COLOR</label>
                    <select
                      className="variant-mockup-select"
                      value={vr.color || ''}
                      onChange={(e) => updateVariantCell(rIdx, 'color', e.target.value)}
                    >
                      <option value="">— None —</option>
                      {masterData.colors.map((c) => (
                        <option key={c.id} value={c.label || c.name}>
                          {c.label || c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="variant-mockup-label">DESCRIPTION (OPTIONAL)</label>
                  <input
                    type="text"
                    className="variant-mockup-input"
                    placeholder="e.g. 500g pouch or Blue edition"
                    value={vr.description || ''}
                    onChange={(e) => updateVariantCell(rIdx, 'description', e.target.value)}
                  />
                </div>

                {/* Images */}
                <div>
                  <label className="variant-mockup-label">IMAGES</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <label className="variant-img-upload-zone">
                      <FiPlus size={20} />
                      <span>ADD PHOTO</span>
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={(e) => handleUploadImages(e, 'variant', rIdx)}
                      />
                    </label>

                    {(vr.images || []).map((img, i) => (
                      <div
                        key={i}
                        style={{
                          position: 'relative',
                          width: '90px',
                          height: '90px',
                          borderRadius: '10px',
                          overflow: 'hidden',
                          border: '1.5px solid #cbd5e1',
                          background: '#f8fafc',
                        }}
                      >
                        <img
                          src={resolveImg(img)}
                          alt=""
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                        <button
                          type="button"
                          onClick={() => removeImage('variant', rIdx, i)}
                          style={{
                            position: 'absolute',
                            top: '4px',
                            right: '4px',
                            background: '#ef4444',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '50%',
                            width: '20px',
                            height: '20px',
                            fontSize: '11px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Custom Fields */}
                <div className="custom-fields-section">
                  <div className="custom-fields-header">
                    <span className="custom-fields-title">Custom Fields</span>
                    <button
                      type="button"
                      className="custom-fields-add-btn"
                      onClick={() => addVariantCustomField(rIdx)}
                    >
                      + Add Field
                    </button>
                  </div>

                  {(vr.customFields || []).length === 0 ? (
                    <div style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic', padding: '4px 0' }}>
                      No custom fields. Click &quot;+ Add Field&quot; for attributes like Material, Warranty, Weight.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {(vr.customFields || []).map((cf, fIdx) => (
                        <div key={fIdx} className="custom-field-row">
                          <input
                            type="text"
                            className="custom-field-input"
                            placeholder="Label"
                            value={cf.label || ''}
                            onChange={(e) =>
                              updateVariantCustomField(rIdx, fIdx, 'label', e.target.value)
                            }
                          />
                          <input
                            type="text"
                            className="custom-field-input"
                            placeholder="Value"
                            value={cf.value || ''}
                            onChange={(e) =>
                              updateVariantCustomField(rIdx, fIdx, 'value', e.target.value)
                            }
                          />
                          <button
                            type="button"
                            className="custom-field-del-btn"
                            onClick={() => removeVariantCustomField(rIdx, fIdx)}
                            title="Delete field"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            <button
              type="button"
              className="mobile-add-variant-btn"
              onClick={addNewVariant}
            >
              <FiPlus size={18} /> + Add Another Variant
            </button>
          </div>
        )}

        {/* 5. Sticky Bottom Bar */}
        <div className="mobile-bottom-bar">
          {activeSheet === 'details' ? (
            <>
              <button
                type="button"
                className="btn btn-outline mobile-bottom-btn"
                onClick={handleSaveToDrafts}
              >
                <FiFileText size={15} /> Save Draft
              </button>
              <button
                type="button"
                className="btn btn-primary mobile-bottom-btn"
                onClick={handleDoneToVariants}
                style={{ background: 'var(--accent-blue)', borderColor: 'var(--accent-blue)' }}
              >
                <FiCheck size={16} /> Next: Variants ➔
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="btn btn-outline mobile-bottom-btn"
                onClick={() => setActiveSheet('details')}
              >
                ⬅ Back to Info
              </button>
              <button
                type="button"
                className="btn btn-primary mobile-bottom-btn"
                onClick={handleSaveProduct}
                disabled={saving}
                style={{ background: '#10b981', borderColor: '#10b981', color: '#ffffff' }}
              >
                <FiCheck size={16} /> {saving ? 'Saving…' : 'Save Product'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          ── DESKTOP SCREEN: EXCEL SPREADSHEET MODE (> 768px) ──
          ═══════════════════════════════════════════════════════════════════ */}
      <div className="excel-page-wrapper">
      {/* ── TOPBAR NAVIGATION ── */}
      <div className="excel-page-topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <Link href="/products" className="excel-back-btn" title="Back to Products">
            <FiArrowLeft size={16} />
            <span>Products</span>
          </Link>
          <div className="excel-page-title-box">
            <div className="excel-icon-box">X</div>
            <div>
              <h2 className="excel-page-title">
                {activeSheet === 'details'
                  ? 'Add Products — Sheet 1: Product Details.xlsx'
                  : `Add Products — Sheet 2: Variants (${mainProduct.name || 'New Product'}).xlsx`}
              </h2>
              <p className="excel-page-subtitle">
                {activeSheet === 'details'
                  ? 'Excel Spreadsheet Mode • Fill Col A to I then click Done to add variants'
                  : 'Excel Spreadsheet Mode • Add product variants (Unit, Size, Color, Description, Images, Custom Fields)'}
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Sheet Navigator Tabs */}
          <div className="sheet-nav-pill">
            <button
              type="button"
              className={`sheet-nav-btn ${activeSheet === 'details' ? 'active' : ''}`}
              onClick={() => setActiveSheet('details')}
            >
              <FiBox size={13} />
              <span>Sheet 1: Product Details</span>
              {mainProduct.name && mainProduct.name.trim() && (
                <span style={{ color: '#10b981', fontWeight: 800 }}>✓</span>
              )}
            </button>
            <button
              type="button"
              className={`sheet-nav-btn ${activeSheet === 'variants' ? 'active' : ''}`}
              onClick={() => {
                if (!mainProduct.name || !mainProduct.name.trim()) {
                  showToast('Please enter Product Name in Col B first', 'error');
                  return;
                }
                setActiveSheet('variants');
              }}
            >
              <FiLayers size={13} />
              <span>Sheet 2: Variants ({filledVariantsCount})</span>
            </button>
          </div>

          <button
            type="button"
            className="btn btn-outline"
            onClick={handleSaveToDrafts}
            disabled={saving}
            style={{ fontSize: '12px', padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
          >
            <FiFileText size={14} /> Save to Drafts
          </button>

          {activeSheet === 'details' ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleDoneToVariants}
              style={{
                background: 'var(--accent-blue)',
                borderColor: 'var(--accent-blue)',
                color: '#ffffff',
                fontWeight: 800,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 16px',
              }}
            >
              <FiCheck size={16} /> Done: Add Variants ➔
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSaveProduct}
              disabled={saving}
              style={{
                background: '#10b981',
                borderColor: '#10b981',
                color: '#ffffff',
                fontWeight: 800,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 16px',
              }}
            >
              <FiCheck size={16} /> {saving ? 'Saving…' : 'Save Product'}
            </button>
          )}
        </div>
      </div>

      {/* ── EXCEL TOOLBAR RIBBON ── */}
      <div className="excel-ribbon-bar">
        {activeSheet === 'details' ? (
          <>
            <label
              className="excel-ribbon-btn"
              style={{ background: '#f0fdf4', borderColor: '#86efac', color: '#15803d', fontWeight: 700 }}
            >
              <FiUploadCloud size={14} />
              <span>+ Upload Product Photos</span>
              <input
                type="file"
                multiple
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => handleUploadImages(e, 'product', activeProdRowIdx)}
              />
            </label>

            <button
              type="button"
              className="excel-ribbon-btn"
              onClick={() => {
                if ((mainProduct.images || []).length > 0) {
                  setMediaTarget({ type: 'product', rowIdx: activeProdRowIdx });
                } else {
                  showToast('Upload photos first using Col A or + Upload Product Photos', 'info');
                }
              }}
            >
              <FiImage size={13} /> View / Manage Photos ({(mainProduct.images || []).length})
            </button>

            <button
              type="button"
              className="excel-ribbon-btn"
              onClick={() => {
                setProductRows([createEmptyProductRow(1)]);
                showToast('Sheet 1 reset', 'info');
              }}
            >
              Clear Details
            </button>

            <button
              type="button"
              className="excel-ribbon-btn"
              onClick={handleDoneToVariants}
              style={{ background: '#eff6ff', borderColor: '#93c5fd', color: 'var(--accent-blue)', fontWeight: 800, marginLeft: '6px' }}
            >
              <FiCheck size={14} /> Done: Proceed to Sheet 2 (Variants) ➔
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className="excel-ribbon-btn"
              onClick={() => {
                setVariantRows((prev) => [...prev, createEmptyVariantRow(Date.now())]);
                setActiveVarRowIdx(variantRows.length);
                setActiveVarCol('unitId');
                showToast(`Variant Row ${variantRows.length + 1} added`, 'info');
              }}
            >
              <FiPlus style={{ color: 'var(--accent-blue)' }} /> Add Variant Row
            </button>

            <button
              type="button"
              className="excel-ribbon-btn"
              onClick={() => {
                if (!variantRows[activeVarRowIdx]) return;
                const cloned = { ...variantRows[activeVarRowIdx], id: Date.now() };
                setVariantRows((prev) => [...prev, cloned]);
                setActiveVarRowIdx(variantRows.length);
                showToast('Variant row duplicated', 'info');
              }}
            >
              <FiCopy /> Duplicate Row
            </button>

            <button
              type="button"
              className="excel-ribbon-btn"
              onClick={() => {
                if (variantRows.length <= 1) {
                  setVariantRows([createEmptyVariantRow(1)]);
                  showToast('Row cleared', 'info');
                  return;
                }
                setVariantRows((prev) => prev.filter((_, idx) => idx !== activeVarRowIdx));
                setActiveVarRowIdx((prev) => Math.max(0, prev - 1));
                showToast('Variant row deleted', 'info');
              }}
            >
              <FiTrash2 style={{ color: '#ef4444' }} /> Delete Row
            </button>

            <button
              type="button"
              className="excel-ribbon-btn"
              onClick={() => {
                setVariantRows([createEmptyVariantRow(1), createEmptyVariantRow(2), createEmptyVariantRow(3)]);
                setActiveVarRowIdx(0);
                showToast('Variants worksheet cleared', 'info');
              }}
            >
              Clear Sheet
            </button>

            {/* View Mode Toggle: Grid vs Cards */}
            <div style={{ display: 'inline-flex', alignItems: 'center', background: '#e2e8f0', borderRadius: '6px', padding: '2px', marginLeft: '6px' }}>
              <button
                type="button"
                className={`excel-ribbon-btn ${variantViewMode === 'grid' ? 'active' : ''}`}
                style={{
                  border: 'none',
                  background: variantViewMode === 'grid' ? '#ffffff' : 'transparent',
                  padding: '4px 10px',
                  boxShadow: variantViewMode === 'grid' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  color: variantViewMode === 'grid' ? 'var(--primary)' : '#64748b',
                }}
                onClick={() => setVariantViewMode('grid')}
              >
                <FiGrid size={12} /> Excel Grid
              </button>
              <button
                type="button"
                className={`excel-ribbon-btn ${variantViewMode === 'cards' ? 'active' : ''}`}
                style={{
                  border: 'none',
                  background: variantViewMode === 'cards' ? '#ffffff' : 'transparent',
                  padding: '4px 10px',
                  boxShadow: variantViewMode === 'cards' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  color: variantViewMode === 'cards' ? 'var(--primary)' : '#64748b',
                }}
                onClick={() => setVariantViewMode('cards')}
              >
                <FiFileText size={12} /> Form Cards
              </button>
            </div>

            <button
              type="button"
              className="excel-ribbon-btn"
              onClick={() => setActiveSheet('details')}
              style={{ marginLeft: 'auto' }}
            >
              <FiEdit3 size={13} /> ⬅ Back to Product Details (Sheet 1)
            </button>
          </>
        )}

        <div className="excel-ribbon-tip">
          <FiHelpCircle size={13} style={{ color: 'var(--accent-blue)' }} />
          <span>Click any cell to edit • Press Tab to navigate</span>
        </div>
      </div>

      {/* ── EXCEL FORMULA BAR (fx) ── */}
      <div className="excel-formula-bar">
        <span className="excel-cell-name">{activeCoord}</span>
        <span className="excel-fx-icon">fx</span>
        <input
          type="text"
          className="excel-formula-input"
          placeholder="Cell value will show here or type to edit..."
          value={activeValue}
          onChange={(e) => {
            if (activeSheet === 'details') {
              if (activeProdCol !== 'images') {
                updateProductCell(activeProdRowIdx, activeProdCol, e.target.value);
              }
            } else {
              if (activeVarCol !== 'images' && activeVarCol !== 'customFields') {
                updateVariantCell(activeVarRowIdx, activeVarCol, e.target.value);
              }
            }
          }}
          disabled={
            (activeSheet === 'details' && activeProdCol === 'images') ||
            (activeSheet === 'variants' && (activeVarCol === 'images' || activeVarCol === 'customFields'))
          }
        />
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          ── SHEET 1: PRODUCT DETAILS EXCEL SPREADSHEET ──
          ═══════════════════════════════════════════════════════════════════ */}
      {activeSheet === 'details' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div className="excel-grid-container" style={{ flex: 1, overflow: 'auto' }}>
            <table className="excel-table">
              <thead>
                <tr>
                  <th className="excel-row-num" style={{ width: '44px' }}>#</th>
                  {PRODUCT_COLUMNS.map((col) => (
                    <th key={col.key} style={{ width: col.width }}>
                      <span className="excel-col-letter">{col.letter}</span>
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {productRows.map((row, rIdx) => {
                  const isRowActive = activeProdRowIdx === rIdx;
                  const subcats = subcatCache[row.categoryId] || [];
                  const imgCount = (row.images || []).length;

                  return (
                    <tr key={row.id || rIdx}>
                      <td
                        className="excel-row-num"
                        onClick={() => {
                          setActiveProdRowIdx(rIdx);
                          setActiveProdCol('name');
                        }}
                      >
                        {rIdx + 1}
                      </td>

                      {/* Col A: Images / Photos */}
                      <td
                        className={`excel-cell ${isRowActive && activeProdCol === 'images' ? 'active-cell' : ''}`}
                        onClick={() => {
                          setActiveProdRowIdx(rIdx);
                          setActiveProdCol('images');
                        }}
                      >
                        <div className="excel-cell-img-wrap">
                          {imgCount > 0 ? (
                            <div
                              className="excel-cell-thumb-preview"
                              onClick={() => setMediaTarget({ type: 'product', rowIdx: rIdx })}
                              title="Click to view/manage photos"
                            >
                              <img
                                src={resolveImg(row.images[0])}
                                alt=""
                                className="excel-cell-thumb-img"
                              />
                              <span className="excel-cell-thumb-count">{imgCount} photo{imgCount > 1 ? 's' : ''}</span>
                            </div>
                          ) : (
                            <label className="excel-cell-img-btn">
                              <FiUploadCloud size={12} />
                              <span>+ Add Photos</span>
                              <input
                                type="file"
                                multiple
                                accept="image/*"
                                style={{ display: 'none' }}
                                onChange={(e) => handleUploadImages(e, 'product', rIdx)}
                              />
                            </label>
                          )}
                        </div>
                      </td>

                      {/* Col B: Product Name * */}
                      <td
                        className={`excel-cell ${isRowActive && activeProdCol === 'name' ? 'active-cell' : ''}`}
                        onClick={() => {
                          setActiveProdRowIdx(rIdx);
                          setActiveProdCol('name');
                        }}
                      >
                        <input
                          type="text"
                          className="excel-cell-input"
                          placeholder="e.g. Basmati Rice 5kg"
                          value={row.name}
                          onChange={(e) => updateProductCell(rIdx, 'name', e.target.value)}
                          onFocus={() => {
                            setActiveProdRowIdx(rIdx);
                            setActiveProdCol('name');
                          }}
                        />
                      </td>

                      {/* Col C: Brand */}
                      <td
                        className={`excel-cell ${isRowActive && activeProdCol === 'brandId' ? 'active-cell' : ''}`}
                        onClick={() => {
                          setActiveProdRowIdx(rIdx);
                          setActiveProdCol('brandId');
                        }}
                      >
                        <select
                          className="excel-cell-select"
                          value={row.brandId}
                          onChange={(e) => updateProductCell(rIdx, 'brandId', e.target.value)}
                          onFocus={() => {
                            setActiveProdRowIdx(rIdx);
                            setActiveProdCol('brandId');
                          }}
                        >
                          <option value="">— Brand —</option>
                          {masterData.brands.map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.name}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* Col D: Category */}
                      <td
                        className={`excel-cell ${isRowActive && activeProdCol === 'categoryId' ? 'active-cell' : ''}`}
                        onClick={() => {
                          setActiveProdRowIdx(rIdx);
                          setActiveProdCol('categoryId');
                        }}
                      >
                        <select
                          className="excel-cell-select"
                          value={row.categoryId}
                          onChange={(e) => updateProductCell(rIdx, 'categoryId', e.target.value)}
                          onFocus={() => {
                            setActiveProdRowIdx(rIdx);
                            setActiveProdCol('categoryId');
                          }}
                        >
                          <option value="">— Category —</option>
                          {masterData.categories.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* Col E: Subcategory */}
                      <td
                        className={`excel-cell ${isRowActive && activeProdCol === 'subcategoryId' ? 'active-cell' : ''}`}
                        onClick={() => {
                          setActiveProdRowIdx(rIdx);
                          setActiveProdCol('subcategoryId');
                        }}
                      >
                        <select
                          className="excel-cell-select"
                          value={row.subcategoryId}
                          onChange={(e) => updateProductCell(rIdx, 'subcategoryId', e.target.value)}
                          disabled={!row.categoryId}
                          onFocus={() => {
                            setActiveProdRowIdx(rIdx);
                            setActiveProdCol('subcategoryId');
                          }}
                        >
                          <option value="">— Subcategory —</option>
                          {subcats.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* Col F: Food Type (Veg / Non-veg) */}
                      <td
                        className={`excel-cell ${isRowActive && activeProdCol === 'isVeg' ? 'active-cell' : ''}`}
                        onClick={() => {
                          setActiveProdRowIdx(rIdx);
                          setActiveProdCol('isVeg');
                        }}
                      >
                        <select
                          className="excel-cell-select"
                          value={row.isVeg}
                          onChange={(e) => updateProductCell(rIdx, 'isVeg', e.target.value)}
                          onFocus={() => {
                            setActiveProdRowIdx(rIdx);
                            setActiveProdCol('isVeg');
                          }}
                        >
                          <option value="true">🟢 Vegetarian</option>
                          <option value="false">🔴 Non-Veg</option>
                        </select>
                      </td>

                      {/* Col G: GST % */}
                      <td
                        className={`excel-cell ${isRowActive && activeProdCol === 'gstPercent' ? 'active-cell' : ''}`}
                        onClick={() => {
                          setActiveProdRowIdx(rIdx);
                          setActiveProdCol('gstPercent');
                        }}
                      >
                        <select
                          className="excel-cell-select"
                          value={row.gstPercent}
                          onChange={(e) => updateProductCell(rIdx, 'gstPercent', e.target.value)}
                          onFocus={() => {
                            setActiveProdRowIdx(rIdx);
                            setActiveProdCol('gstPercent');
                          }}
                        >
                          <option value="0">0%</option>
                          <option value="5">5%</option>
                          <option value="12">12%</option>
                          <option value="18">18%</option>
                          <option value="28">28%</option>
                        </select>
                      </td>

                      {/* Col H: Description */}
                      <td
                        className={`excel-cell ${isRowActive && activeProdCol === 'description' ? 'active-cell' : ''}`}
                        onClick={() => {
                          setActiveProdRowIdx(rIdx);
                          setActiveProdCol('description');
                        }}
                      >
                        <input
                          type="text"
                          className="excel-cell-input"
                          placeholder="Product description and features..."
                          value={row.description}
                          onChange={(e) => updateProductCell(rIdx, 'description', e.target.value)}
                          onFocus={() => {
                            setActiveProdRowIdx(rIdx);
                            setActiveProdCol('description');
                          }}
                        />
                      </td>

                      {/* Col I: Search Keywords */}
                      <td
                        className={`excel-cell ${isRowActive && activeProdCol === 'searchKeywords' ? 'active-cell' : ''}`}
                        onClick={() => {
                          setActiveProdRowIdx(rIdx);
                          setActiveProdCol('searchKeywords');
                        }}
                      >
                        <input
                          type="text"
                          className="excel-cell-input"
                          placeholder="rice, basmati, premium (comma separated)"
                          value={row.searchKeywords}
                          onChange={(e) => updateProductCell(rIdx, 'searchKeywords', e.target.value)}
                          onFocus={() => {
                            setActiveProdRowIdx(rIdx);
                            setActiveProdCol('searchKeywords');
                          }}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ── DOCKED AT THE VERY BOTTOM OF THE PAGE ── */}
          <div
            style={{
              padding: '12px 24px',
              background: '#ffffff',
              borderTop: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px',
              flexShrink: 0,
              boxShadow: '0 -2px 10px rgba(0, 0, 0, 0.04)',
            }}
          >
            <div>
              <div style={{ fontWeight: 800, fontSize: '13.5px', color: 'var(--primary)' }}>
                Step 1: Product Master Details Completed?
              </div>
              <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                Click Done to proceed to Sheet 2 where you can add all variants (Unit, Size, Color, Description, Images, Custom Fields).
              </div>
            </div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleDoneToVariants}
              style={{
                background: 'var(--accent-blue)',
                padding: '9px 20px',
                fontSize: '13.5px',
                fontWeight: 800,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 3px 10px rgba(29, 114, 254, 0.25)',
                borderRadius: '8px',
              }}
            >
              <FiCheck size={16} /> Done: Add Variants (Sheet 2) ➔
            </button>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          ── SHEET 2: VARIANTS WORKSHEET (EXCEL GRID OR CARD FORMS) ──
          ═══════════════════════════════════════════════════════════════════ */}
      {activeSheet === 'variants' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Summary Banner of Product */}
          <div style={{ padding: '8px 18px', background: '#f0fdf4', borderBottom: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {(mainProduct.images || [])[0] ? (
                <img
                  src={resolveImg(mainProduct.images[0])}
                  alt=""
                  style={{ width: '32px', height: '32px', borderRadius: '4px', objectFit: 'cover', border: '1px solid #86efac' }}
                />
              ) : (
                <span style={{ fontSize: '18px' }}>📦</span>
              )}
              <span style={{ fontSize: '13px', fontWeight: 800, color: '#14532d' }}>
                Adding Variants for: <u>{mainProduct.name || 'New Product'}</u>
              </span>
              <span style={{ fontSize: '11.5px', color: '#16a34a' }}>
                • Total Variants: <strong>{variantRows.length}</strong>
              </span>
            </div>

            <button
              type="button"
              className="btn btn-sm btn-outline"
              onClick={() => setActiveSheet('details')}
              style={{ background: '#ffffff', fontSize: '11.5px', padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
            >
              <FiEdit3 size={12} /> Edit Product Details (Sheet 1)
            </button>
          </div>

          {/* ── MODE 1: EXCEL SPREADSHEET FOR VARIANTS ── */}
          {variantViewMode === 'grid' && !isMobile ? (
            <div className="excel-grid-container" style={{ flex: 1 }}>
              <table className="excel-table">
                <thead>
                  <tr>
                    <th className="excel-row-num" style={{ width: '44px' }}>#</th>
                    {VARIANT_COLUMNS.map((col) => (
                      <th key={col.key} style={{ width: col.width }}>
                        <span className="excel-col-letter">{col.letter}</span>
                        {col.label}
                      </th>
                    ))}
                    <th style={{ width: '70px', textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {variantRows.map((vr, rIdx) => {
                    const isRowActive = activeVarRowIdx === rIdx;
                    const imgCount = (vr.images || []).length;
                    const cFieldCount = (vr.customFields || []).length;

                    return (
                      <tr key={vr.id || rIdx}>
                        <td
                          className="excel-row-num"
                          onClick={() => {
                            setActiveVarRowIdx(rIdx);
                            setActiveVarCol('unitId');
                          }}
                        >
                          {rIdx + 1}
                        </td>

                        {/* Col A: IMAGES */}
                        <td
                          className={`excel-cell ${isRowActive && activeVarCol === 'images' ? 'active-cell' : ''}`}
                          onClick={() => {
                            setActiveVarRowIdx(rIdx);
                            setActiveVarCol('images');
                          }}
                        >
                          <div className="excel-cell-img-wrap">
                            {imgCount > 0 ? (
                              <div
                                className="excel-cell-thumb-preview"
                                onClick={() => setMediaTarget({ type: 'variant', rowIdx: rIdx })}
                                title="Click to view/manage variant photo"
                              >
                                <img
                                  src={resolveImg(vr.images[0])}
                                  alt=""
                                  className="excel-cell-thumb-img"
                                />
                                <span className="excel-cell-thumb-count">{imgCount}</span>
                              </div>
                            ) : (
                              <label className="excel-cell-img-btn">
                                <FiUploadCloud size={11} />
                                <span>+ Photo</span>
                                <input
                                  type="file"
                                  multiple
                                  accept="image/*"
                                  style={{ display: 'none' }}
                                  onChange={(e) => handleUploadImages(e, 'variant', rIdx)}
                                />
                              </label>
                            )}
                          </div>
                        </td>

                        {/* Col B: UNIT */}
                        <td
                          className={`excel-cell ${isRowActive && activeVarCol === 'unitId' ? 'active-cell' : ''}`}
                          onClick={() => {
                            setActiveVarRowIdx(rIdx);
                            setActiveVarCol('unitId');
                          }}
                        >
                          <select
                            className="excel-cell-select"
                            value={vr.unitId}
                            onChange={(e) => updateVariantCell(rIdx, 'unitId', e.target.value)}
                            onFocus={() => {
                              setActiveVarRowIdx(rIdx);
                              setActiveVarCol('unitId');
                            }}
                          >
                            <option value="">— None —</option>
                            {masterData.units.map((u) => (
                              <option key={u.id} value={u.id}>
                                {u.display_name}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Col C: SIZE */}
                        <td
                          className={`excel-cell ${isRowActive && activeVarCol === 'size' ? 'active-cell' : ''}`}
                          onClick={() => {
                            setActiveVarRowIdx(rIdx);
                            setActiveVarCol('size');
                          }}
                        >
                          <select
                            className="excel-cell-select"
                            value={vr.size}
                            onChange={(e) => updateVariantCell(rIdx, 'size', e.target.value)}
                            onFocus={() => {
                              setActiveVarRowIdx(rIdx);
                              setActiveVarCol('size');
                            }}
                          >
                            <option value="">— None —</option>
                            {masterData.sizes.map((s) => (
                              <option key={s.id} value={s.label || s.name}>
                                {s.label || s.name}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Col D: COLOR */}
                        <td
                          className={`excel-cell ${isRowActive && activeVarCol === 'color' ? 'active-cell' : ''}`}
                          onClick={() => {
                            setActiveVarRowIdx(rIdx);
                            setActiveVarCol('color');
                          }}
                        >
                          <select
                            className="excel-cell-select"
                            value={vr.color}
                            onChange={(e) => updateVariantCell(rIdx, 'color', e.target.value)}
                            onFocus={() => {
                              setActiveVarRowIdx(rIdx);
                              setActiveVarCol('color');
                            }}
                          >
                            <option value="">— None —</option>
                            {masterData.colors.map((c) => (
                              <option key={c.id} value={c.label || c.name}>
                                {c.label || c.name}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Col E: DESCRIPTION */}
                        <td
                          className={`excel-cell ${isRowActive && activeVarCol === 'description' ? 'active-cell' : ''}`}
                          onClick={() => {
                            setActiveVarRowIdx(rIdx);
                            setActiveVarCol('description');
                          }}
                        >
                          <input
                            type="text"
                            className="excel-cell-input"
                            placeholder="Optional"
                            value={vr.description}
                            onChange={(e) => updateVariantCell(rIdx, 'description', e.target.value)}
                            onFocus={() => {
                              setActiveVarRowIdx(rIdx);
                              setActiveVarCol('description');
                            }}
                          />
                        </td>

                        {/* Col F: CUSTOM FIELDS (User Mockup 1) */}
                        <td
                          className={`excel-cell ${isRowActive && activeVarCol === 'customFields' ? 'active-cell' : ''}`}
                          onClick={() => {
                            setActiveVarRowIdx(rIdx);
                            setActiveVarCol('customFields');
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 8px', height: '100%' }}>
                            <button
                              type="button"
                              className="custom-fields-add-btn"
                              onClick={() => setCustomFieldTargetIdx(rIdx)}
                              style={{ fontSize: '11px', padding: '3px 9px', borderRadius: '4px' }}
                            >
                              <FiPlus size={11} />
                              {cFieldCount > 0
                                ? `${cFieldCount} Custom Field${cFieldCount > 1 ? 's' : ''}`
                                : '+ Add Field'}
                            </button>
                          </div>
                        </td>

                        {/* Delete Action */}
                        <td style={{ textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={() => {
                              if (variantRows.length <= 1) {
                                setVariantRows([createEmptyVariantRow(1)]);
                              } else {
                                setVariantRows((prev) => prev.filter((_, idx) => idx !== rIdx));
                              }
                            }}
                            className="btn btn-sm btn-outline"
                            style={{ color: '#ef4444', border: 'none', padding: '3px 8px' }}
                            title="Delete row"
                          >
                            <FiTrash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            /* ── MODE 2: VARIANT FORM CARDS (MATCHING USER'S MOCKUPS EXACTLY) ── */
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '16px 24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                background: '#f8fafc',
              }}
            >
              {variantRows.map((vr, rIdx) => (
                <div key={vr.id || rIdx} className="variant-mockup-card">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>
                    <span style={{ fontWeight: 800, color: 'var(--primary)', fontSize: '14.5px' }}>
                      Variant #{rIdx + 1}
                    </span>
                    {variantRows.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setVariantRows((prev) => prev.filter((_, idx) => idx !== rIdx))
                        }
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#ef4444',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '12px',
                          fontWeight: 700,
                        }}
                      >
                        <FiTrash2 size={13} /> Remove
                      </button>
                    )}
                  </div>

                  {/* 1. UNIT, SIZE, COLOR (3-Column Grid) */}
                  <div className="variant-mockup-grid-3">
                    <div>
                      <label className="variant-mockup-label">UNIT</label>
                      <select
                        className="variant-mockup-select"
                        value={vr.unitId}
                        onChange={(e) => updateVariantCell(rIdx, 'unitId', e.target.value)}
                      >
                        <option value="">— None —</option>
                        {masterData.units.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.display_name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="variant-mockup-label">SIZE</label>
                      <select
                        className="variant-mockup-select"
                        value={vr.size}
                        onChange={(e) => updateVariantCell(rIdx, 'size', e.target.value)}
                      >
                        <option value="">— None —</option>
                        {masterData.sizes.map((s) => (
                          <option key={s.id} value={s.label || s.name}>
                            {s.label || s.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="variant-mockup-label">COLOR</label>
                      <select
                        className="variant-mockup-select"
                        value={vr.color}
                        onChange={(e) => updateVariantCell(rIdx, 'color', e.target.value)}
                      >
                        <option value="">— None —</option>
                        {masterData.colors.map((c) => (
                          <option key={c.id} value={c.label || c.name}>
                            {c.label || c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* 2. DESCRIPTION */}
                  <div>
                    <label className="variant-mockup-label">DESCRIPTION</label>
                    <input
                      type="text"
                      className="variant-mockup-input"
                      placeholder="Optional"
                      value={vr.description}
                      onChange={(e) => updateVariantCell(rIdx, 'description', e.target.value)}
                    />
                  </div>

                  {/* 3. IMAGES (+ ADD IMAGES Dashed Box) */}
                  <div>
                    <label className="variant-mockup-label">IMAGES</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                      <label className="variant-img-upload-zone">
                        <FiPlus size={20} />
                        <span>ADD IMAGES</span>
                        <input
                          type="file"
                          multiple
                          accept="image/*"
                          style={{ display: 'none' }}
                          onChange={(e) => handleUploadImages(e, 'variant', rIdx)}
                        />
                      </label>

                      {(vr.images || []).map((img, i) => (
                        <div
                          key={i}
                          style={{
                            position: 'relative',
                            width: '90px',
                            height: '90px',
                            borderRadius: '10px',
                            overflow: 'hidden',
                            border: '1.5px solid #cbd5e1',
                            background: '#f8fafc',
                          }}
                        >
                          <img
                            src={resolveImg(img)}
                            alt=""
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                          <button
                            type="button"
                            onClick={() => removeImage('variant', rIdx, i)}
                            style={{
                              position: 'absolute',
                              top: '4px',
                              right: '4px',
                              background: '#ef4444',
                              color: '#fff',
                              border: 'none',
                              borderRadius: '50%',
                              width: '20px',
                              height: '20px',
                              fontSize: '11px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 4. CUSTOM FIELDS (Matching User Image 1) */}
                  <div className="custom-fields-section">
                    <div className="custom-fields-header">
                      <span className="custom-fields-title">Custom Fields</span>
                      <button
                        type="button"
                        className="custom-fields-add-btn"
                        onClick={() => addVariantCustomField(rIdx)}
                      >
                        + Add Field
                      </button>
                    </div>

                    {(vr.customFields || []).length === 0 ? (
                      <div style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic', padding: '4px 0' }}>
                        No custom fields yet. Click &quot;+ Add Field&quot; to specify attributes like Material, Warranty, Weight.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {(vr.customFields || []).map((cf, fIdx) => (
                          <div key={fIdx} className="custom-field-row">
                            <input
                              type="text"
                              className="custom-field-input"
                              placeholder="Label"
                              value={cf.label}
                              onChange={(e) =>
                                updateVariantCustomField(rIdx, fIdx, 'label', e.target.value)
                              }
                            />
                            <input
                              type="text"
                              className="custom-field-input"
                              placeholder="Value"
                              value={cf.value}
                              onChange={(e) =>
                                updateVariantCustomField(rIdx, fIdx, 'value', e.target.value)
                              }
                            />
                            <button
                              type="button"
                              className="custom-field-del-btn"
                              onClick={() => removeVariantCustomField(rIdx, fIdx)}
                              title="Delete field"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 5. ACTION BUTTONS: Cancel & Save Variant (Matching User Image 2) */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #f1f5f9' }}>
                    <button
                      type="button"
                      className="variant-btn-cancel"
                      onClick={() => {
                        if (variantRows.length > 1) {
                          setVariantRows((prev) => prev.filter((_, idx) => idx !== rIdx));
                          showToast(`Variant #${rIdx + 1} discarded`, 'info');
                        } else {
                          setVariantRows([createEmptyVariantRow(1)]);
                          showToast('Variant reset to blank', 'info');
                        }
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="variant-btn-save"
                      onClick={() => {
                        const hasAny = vr.unitId || vr.size || vr.color || vr.description || (vr.images && vr.images.length > 0) || (vr.customFields && vr.customFields.length > 0);
                        if (!hasAny) {
                          showToast('Please fill at least one attribute for this variant', 'error');
                          return;
                        }
                        showToast(`Variant #${rIdx + 1} confirmed! Click Save Product at the bottom to save all`, 'success');
                      }}
                    >
                      Save Variant
                    </button>
                  </div>
                </div>
              ))}

              <button
                type="button"
                className="btn btn-outline"
                onClick={() => {
                  setVariantRows((prev) => [...prev, createEmptyVariantRow(Date.now())]);
                  showToast('New variant added', 'info');
                }}
                style={{
                  padding: '12px',
                  borderRadius: '10px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  background: '#ffffff',
                }}
              >
                <FiPlus size={16} /> + Add Another Variant
              </button>
            </div>
          )}

          {/* ── DOCKED AT THE VERY BOTTOM OF SHEET 2 ── */}
          <div
            style={{
              padding: '12px 24px',
              background: '#ffffff',
              borderTop: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px',
              flexShrink: 0,
              boxShadow: '0 -2px 10px rgba(0, 0, 0, 0.04)',
            }}
          >
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Step 2: Add variants for <strong>{mainProduct.name || 'product'}</strong>. Click <strong>Save Product</strong> when finished.
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setActiveSheet('details')}
                style={{ fontSize: '12.5px', padding: '7px 14px' }}
              >
                ⬅ Back to Sheet 1
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSaveProduct}
                disabled={saving}
                style={{
                  background: '#10b981',
                  borderColor: '#10b981',
                  padding: '8px 20px',
                  fontSize: '13px',
                  fontWeight: 800,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 3px 10px rgba(16, 185, 129, 0.25)',
                  borderRadius: '8px',
                }}
              >
                <FiCheck size={16} /> {saving ? 'Saving…' : 'Save Product'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── EXCEL BOTTOM SHEET TABS & STATUSBAR ── */}
      <div className="excel-bottom-tabs-bar">
        <button
          type="button"
          className={`excel-tab-pill-btn ${activeSheet === 'details' ? 'active' : ''}`}
          onClick={() => setActiveSheet('details')}
        >
          <FiBox size={13} />
          <span>Sheet 1: Product Details</span>
          {mainProduct.name && mainProduct.name.trim() && (
            <span style={{ color: '#10b981', fontWeight: 800 }}>✓</span>
          )}
        </button>

        <button
          type="button"
          className={`excel-tab-pill-btn ${activeSheet === 'variants' ? 'active' : ''}`}
          onClick={() => {
            if (!mainProduct.name || !mainProduct.name.trim()) {
              showToast('Please enter Product Name in Sheet 1 first', 'error');
              return;
            }
            setActiveSheet('variants');
          }}
        >
          <FiLayers size={13} />
          <span>Sheet 2: Variants ({filledVariantsCount})</span>
        </button>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '14px', fontSize: '11px', color: '#64748b' }}>
          {activeSheet === 'details' ? (
            <>
              <span style={{ color: mainProduct.name ? '#10b981' : '#f59e0b', fontWeight: 800 }}>
                ● {mainProduct.name ? 'DETAILS ENTERED' : 'ENTER PRODUCT DETAILS'}
              </span>
              <span>Images: <strong>{(mainProduct.images || []).length}</strong></span>
              <span>Active Cell: <strong>{activeCoord}</strong></span>
            </>
          ) : (
            <>
              <span style={{ color: '#10b981', fontWeight: 800 }}>● VARIANTS READY</span>
              <span>Total Rows: <strong>{variantRows.length}</strong></span>
              <span>Active Cell: <strong>{activeCoord}</strong></span>
            </>
          )}
        </div>
      </div>

      {/* ── MEDIA MANAGER MODAL (FOR IMAGES CELL) ── */}
      {mediaTarget && (
        <div
          className="excel-img-popover-overlay"
          onClick={() => setMediaTarget(null)}
        >
          <div
            className="excel-img-popover-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="excel-img-popover-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800, fontSize: '14px' }}>
                <FiImage size={16} />
                <span>
                  {mediaTarget.type === 'product'
                    ? 'Product Photos (Sheet 1, Row ' + (mediaTarget.rowIdx + 1) + ')'
                    : 'Variant Photos (Sheet 2, Row ' + (mediaTarget.rowIdx + 1) + ')'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setMediaTarget(null)}
                style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '16px' }}
              >
                ✕
              </button>
            </div>

            <div className="excel-img-popover-body">
              <label className="product-photo-dropzone" style={{ padding: '16px 12px' }}>
                <div className="product-photo-dropzone-icon" style={{ width: '38px', height: '38px', fontSize: '18px' }}>
                  <FiUploadCloud />
                </div>
                <div style={{ fontWeight: 800, fontSize: '13px', color: 'var(--primary)' }}>
                  Click to Add More Photos
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Supports JPG, PNG, WEBP
                </div>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={(e) => handleUploadImages(e, mediaTarget.type, mediaTarget.rowIdx)}
                />
              </label>

              {(() => {
                const images =
                  mediaTarget.type === 'product'
                    ? productRows[mediaTarget.rowIdx]?.images || []
                    : variantRows[mediaTarget.rowIdx]?.images || [];

                if (images.length === 0) {
                  return (
                    <div style={{ textAlign: 'center', padding: '16px', color: 'var(--text-muted)', fontSize: '12px' }}>
                      No photos uploaded yet. Click above to upload.
                    </div>
                  );
                }

                return (
                  <div className="product-photo-thumb-grid">
                    {images.map((img, i) => (
                      <div key={i} className="product-photo-thumb-item">
                        <img src={resolveImg(img)} alt="" />
                        {i === 0 && <span className="product-photo-main-tag">Main</span>}
                        <button
                          type="button"
                          className="product-photo-del-btn"
                          onClick={() => removeImage(mediaTarget.type, mediaTarget.rowIdx, i)}
                          title="Remove image"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                );
              })()}

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => setMediaTarget(null)}
                  style={{ fontSize: '12.5px', padding: '6px 16px' }}
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── CUSTOM FIELDS POPOVER MODAL (FOR EXCEL GRID MODE IN SHEET 2) ── */}
      {customFieldTargetIdx !== null && (
        <div
          className="excel-img-popover-overlay"
          onClick={() => setCustomFieldTargetIdx(null)}
        >
          <div
            className="excel-img-popover-card"
            style={{ maxWidth: '540px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="excel-img-popover-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800, fontSize: '14px' }}>
                <FiLayers size={16} />
                <span>Custom Fields — Variant #{customFieldTargetIdx + 1}</span>
              </div>
              <button
                type="button"
                onClick={() => setCustomFieldTargetIdx(null)}
                style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '16px' }}
              >
                ✕
              </button>
            </div>

            <div className="excel-img-popover-body">
              <div className="custom-fields-section" style={{ borderTop: 'none', marginTop: 0, paddingTop: 0 }}>
                <div className="custom-fields-header">
                  <span className="custom-fields-title">Custom Fields</span>
                  <button
                    type="button"
                    className="custom-fields-add-btn"
                    onClick={() => addVariantCustomField(customFieldTargetIdx)}
                  >
                    + Add Field
                  </button>
                </div>

                {((variantRows[customFieldTargetIdx]?.customFields) || []).length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '20px', color: '#94a3b8', fontSize: '13px' }}>
                    No custom fields yet. Click &quot;+ Add Field&quot; to add fields like Material, Warranty, Weight.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {(variantRows[customFieldTargetIdx]?.customFields || []).map((cf, fIdx) => (
                      <div key={fIdx} className="custom-field-row">
                        <input
                          type="text"
                          className="custom-field-input"
                          placeholder="Label"
                          value={cf.label}
                          onChange={(e) =>
                            updateVariantCustomField(customFieldTargetIdx, fIdx, 'label', e.target.value)
                          }
                        />
                        <input
                          type="text"
                          className="custom-field-input"
                          placeholder="Value"
                          value={cf.value}
                          onChange={(e) =>
                            updateVariantCustomField(customFieldTargetIdx, fIdx, 'value', e.target.value)
                          }
                        />
                        <button
                          type="button"
                          className="custom-field-del-btn"
                          onClick={() => removeVariantCustomField(customFieldTargetIdx, fIdx)}
                          title="Delete custom field"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => setCustomFieldTargetIdx(null)}
                  style={{ background: '#6d28d9', borderColor: '#6d28d9', padding: '8px 20px', fontSize: '13px' }}
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  </>
);
}
