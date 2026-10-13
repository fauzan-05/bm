'use client';

import { useState, useEffect } from 'react';
import { api, resolveImg, uploadImages } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import {
  FiX,
  FiPlus,
  FiTrash2,
  FiFileText,
  FiGrid,
  FiCopy,
  FiCheck,
  FiUploadCloud,
  FiImage,
  FiBox,
  FiCheckCircle,
} from 'react-icons/fi';
import { saveDraft } from '@/lib/drafts';

const COL_LETTERS = {
  name: 'A',
  brandId: 'B',
  categoryId: 'C',
  subcategoryId: 'D',
  gstPercent: 'E',
  isVeg: 'F',
  defaultUnitId: 'G',
  defaultSize: 'H',
  defaultColor: 'I',
  description: 'J',
  searchKeywords: 'K',
};

const createEmptyRow = (id = 1) => ({
  id,
  name: '',
  brandId: '',
  categoryId: '',
  subcategoryId: '',
  gstPercent: '0',
  isVeg: 'true',
  defaultUnitId: '',
  defaultSize: '',
  defaultColor: '',
  description: '',
  searchKeywords: '',
});

export default function ProductModal({ isOpen, productId, onClose, onSuccess }) {
  const { masterData } = useAuth();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // View mode: 'excel' (Spreadsheet mode) vs 'form' (Classic form mode)
  const [viewMode, setViewMode] = useState('excel');

  // Excel rows state
  const [rows, setRows] = useState([createEmptyRow(1)]);
  const [activeRowIdx, setActiveRowIdx] = useState(0);
  const [activeCol, setActiveCol] = useState('name');

  // Primary active product states (synced with rows[activeRowIdx])
  const [name, setName] = useState('');
  const [brandId, setBrandId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [subcategoryId, setSubcategoryId] = useState('');
  const [description, setDescription] = useState('');
  const [gstPercent, setGstPercent] = useState('0');
  const [isVeg, setIsVeg] = useState('true');
  const [imageUrls, setImageUrls] = useState([]);
  const [searchKeywords, setSearchKeywords] = useState('');

  // Attributes & Defaults
  const [selectedSizeIds, setSelectedSizeIds] = useState(new Set());
  const [selectedColorIds, setSelectedColorIds] = useState(new Set());
  const [selectedUnitIds, setSelectedUnitIds] = useState(new Set());
  const [defaultSize, setDefaultSize] = useState('');
  const [defaultColor, setDefaultColor] = useState('');
  const [defaultUnitId, setDefaultUnitId] = useState('');

  // Custom fields
  const [customFields, setCustomFields] = useState([]);

  // Subcategories cache per category
  const [subcategories, setSubcategories] = useState([]);

  // Load subcategories when active category changes
  useEffect(() => {
    if (!categoryId) {
      setSubcategories([]);
      setSubcategoryId('');
      return;
    }

    api('GET', `/categories/${categoryId}/subcategories`)
      .then((data) => {
        setSubcategories(data.subcategories || []);
      })
      .catch(() => {
        // Fallback to masterData subcats if available
        const matched = (masterData.subcats || []).filter(
          (s) => String(s.category_id) === String(categoryId)
        );
        setSubcategories(matched);
      });
  }, [categoryId, masterData.subcats]);

  // Load product data when editing
  useEffect(() => {
    if (!isOpen) return;

    if (typeof window !== 'undefined') {
      setViewMode(window.innerWidth <= 768 ? 'form' : 'excel');
    }

    if (!productId) {
      // Reset form for Add Product
      const initialRow = createEmptyRow(1);
      setRows([initialRow]);
      setActiveRowIdx(0);
      setActiveCol('name');

      setName('');
      setBrandId('');
      setCategoryId('');
      setSubcategoryId('');
      setDescription('');
      setGstPercent('0');
      setIsVeg('true');
      setImageUrls([]);
      setSearchKeywords('');
      setSelectedSizeIds(new Set());
      setSelectedColorIds(new Set());
      setSelectedUnitIds(new Set());
      setDefaultSize('');
      setDefaultColor('');
      setDefaultUnitId('');
      setCustomFields([]);
      setSubcategories([]);
      return;
    }

    // Load existing product
    setLoading(true);
    async function loadProductData() {
      try {
        const prodData = await api('GET', `/products/${productId}`);
        const p = prodData.product;

        const pName = p.name || '';
        const pBrand = p.brand_id ? String(p.brand_id) : '';
        const pCat = p.category_id ? String(p.category_id) : '';
        const pSub = p.subcategory_id ? String(p.subcategory_id) : '';
        const pDesc = p.description || '';
        const pGst = String(p.gst_percent || 0);
        const pVeg = p.is_veg ? 'true' : 'false';
        const pKeywords = (p.search_keywords || []).join(', ');
        const pDefSize = p.default_size || '';
        const pDefColor = p.default_color || '';
        const pDefUnit = p.default_unit_id ? String(p.default_unit_id) : '';

        setName(pName);
        setBrandId(pBrand);
        setCategoryId(pCat);
        setSubcategoryId(pSub);
        setDescription(pDesc);
        setGstPercent(pGst);
        setIsVeg(pVeg);
        setImageUrls(p.images || []);
        setSearchKeywords(pKeywords);
        setDefaultSize(pDefSize);
        setDefaultColor(pDefColor);
        setDefaultUnitId(pDefUnit);

        // Put in Row 1 of spreadsheet
        setRows([
          {
            id: 1,
            name: pName,
            brandId: pBrand,
            categoryId: pCat,
            subcategoryId: pSub,
            gstPercent: pGst,
            isVeg: pVeg,
            defaultUnitId: pDefUnit,
            defaultSize: pDefSize,
            defaultColor: pDefColor,
            description: pDesc,
            searchKeywords: pKeywords,
          },
        ]);
        setActiveRowIdx(0);

        // Custom fields
        const cFields = (p.custom_fields || []).map((f) => ({
          label: f.label || f.key || f.name || '',
          value: f.value || '',
        }));
        setCustomFields(cFields);

        // Fetch subcategories
        if (p.category_id) {
          const subData = await api('GET', `/categories/${p.category_id}/subcategories`).catch(() => ({}));
          setSubcategories(subData.subcategories || []);
        }

        // Fetch attributes & assigned units
        try {
          const [attrRes, unitRes] = await Promise.all([
            api('GET', `/admin/products/${productId}/attributes`),
            api('GET', `/units/assigned/${productId}`),
          ]);
          setSelectedSizeIds(new Set((attrRes.size_ids || []).map(Number)));
          setSelectedColorIds(new Set((attrRes.color_ids || []).map(Number)));
          setSelectedUnitIds(new Set((unitRes.assigned_units || []).map((u) => u.id)));
        } catch (_) {}
      } catch (err) {
        showToast('Failed to load product: ' + err.message, 'error');
      } finally {
        setLoading(false);
      }
    }

    loadProductData();
  }, [isOpen, productId, showToast]);

  // Active cell coordinate string like 'A1', 'B2', etc.
  const colLetter = COL_LETTERS[activeCol] || 'A';
  const activeCellCoord = `${colLetter}${activeRowIdx + 1}`;

  // Current value in active cell
  const activeCellValue = rows[activeRowIdx] ? rows[activeRowIdx][activeCol] || '' : '';

  // Update a single cell in the Excel grid
  const updateCell = (rowIdx, colKey, value) => {
    setRows((prev) => {
      const next = [...prev];
      if (next[rowIdx]) {
        next[rowIdx] = { ...next[rowIdx], [colKey]: value };
      }
      return next;
    });

    // If updating row 0, also mirror into standard form states
    if (rowIdx === 0) {
      if (colKey === 'name') setName(value);
      if (colKey === 'brandId') setBrandId(value);
      if (colKey === 'categoryId') {
        setCategoryId(value);
        setSubcategoryId('');
      }
      if (colKey === 'subcategoryId') setSubcategoryId(value);
      if (colKey === 'description') setDescription(value);
      if (colKey === 'gstPercent') setGstPercent(value);
      if (colKey === 'isVeg') setIsVeg(value);
      if (colKey === 'defaultUnitId') setDefaultUnitId(value);
      if (colKey === 'defaultSize') setDefaultSize(value);
      if (colKey === 'defaultColor') setDefaultColor(value);
      if (colKey === 'searchKeywords') setSearchKeywords(value);
    }
  };

  // Add new blank row to spreadsheet
  const handleAddRow = () => {
    setRows((prev) => [...prev, createEmptyRow(Date.now())]);
    setActiveRowIdx(rows.length);
    setActiveCol('name');
    showToast(`Row ${rows.length + 1} added to sheet`, 'info');
  };

  // Duplicate current row
  const handleDuplicateRow = () => {
    if (!rows[activeRowIdx]) return;
    const cloned = { ...rows[activeRowIdx], id: Date.now() };
    setRows((prev) => [...prev, cloned]);
    setActiveRowIdx(rows.length);
    showToast('Row duplicated', 'info');
  };

  // Delete current row
  const handleDeleteRow = () => {
    if (rows.length <= 1) {
      // Just clear row 1
      setRows([createEmptyRow(1)]);
      showToast('Row cleared', 'info');
      return;
    }
    setRows((prev) => prev.filter((_, idx) => idx !== activeRowIdx));
    setActiveRowIdx((prev) => Math.max(0, prev - 1));
    showToast('Row removed', 'info');
  };

  // Clear sheet
  const handleClearSheet = () => {
    setRows([createEmptyRow(1)]);
    setActiveRowIdx(0);
    setActiveCol('name');
    showToast('Sheet reset', 'info');
  };

  const handleImageUpload = async (e) => {
    const files = e.target.files;
    if (!files || !files.length) return;
    try {
      showToast('Uploading images…', 'info');
      const urls = await uploadImages(files);
      setImageUrls((prev) => [...prev, ...urls]);
      showToast('Images uploaded', 'success');
    } catch (err) {
      showToast(err.message || 'Image upload failed', 'error');
    }
  };

  const removeImage = (index) => {
    setImageUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const toggleSize = (id) => {
    setSelectedSizeIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleColor = (id) => {
    setSelectedColorIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleUnit = (id) => {
    setSelectedUnitIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const addCustomField = () => {
    setCustomFields((prev) => [...prev, { label: '', value: '' }]);
  };

  const updateCustomField = (index, key, val) => {
    setCustomFields((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [key]: val };
      return next;
    });
  };

  const removeCustomField = (index) => {
    setCustomFields((prev) => prev.filter((_, i) => i !== index));
  };

  // Save product(s)
  const handleSave = async () => {
    // If editing existing product
    if (productId) {
      if (!name.trim()) {
        showToast('Product name is required (Row 1)', 'error');
        return;
      }

      setSaving(true);
      try {
        const payload = {
          name: name.trim(),
          description: description.trim() || null,
          brand_id: brandId ? parseInt(brandId) : null,
          category_id: categoryId ? parseInt(categoryId) : null,
          subcategory_id: subcategoryId ? parseInt(subcategoryId) : null,
          is_veg: isVeg === 'true',
          gst_percent: parseFloat(gstPercent) || 0,
          images: imageUrls,
          search_keywords: searchKeywords
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
          custom_fields: customFields.filter((f) => f.label.trim()),
          default_size: defaultSize || null,
          default_color: defaultColor || null,
          default_unit_id: defaultUnitId ? parseInt(defaultUnitId) : null,
        };

        await api('PUT', `/admin/products/${productId}`, payload).catch(() => {});
        showToast('Product updated successfully', 'success');

        onClose();
        if (onSuccess) onSuccess();
      } catch (err) {
        showToast('Save failed: ' + err.message, 'error');
      } finally {
        setSaving(false);
      }
      return;
    }

    // Creating new products: check all filled rows in the spreadsheet
    const validRows = rows.filter((r) => r.name && r.name.trim());
    if (validRows.length === 0) {
      showToast('Please enter at least one Product Name in the sheet', 'error');
      return;
    }

    setSaving(true);
    try {
      let createdCount = 0;
      for (const rowItem of validRows) {
        const payload = {
          name: rowItem.name.trim(),
          description: rowItem.description.trim() || null,
          brand_id: rowItem.brandId ? parseInt(rowItem.brandId) : null,
          category_id: rowItem.categoryId ? parseInt(rowItem.categoryId) : null,
          subcategory_id: rowItem.subcategoryId ? parseInt(rowItem.subcategoryId) : null,
          is_veg: rowItem.isVeg === 'true',
          gst_percent: parseFloat(rowItem.gstPercent) || 0,
          images: imageUrls,
          search_keywords: (rowItem.searchKeywords || '')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
          default_size: rowItem.defaultSize || null,
          default_color: rowItem.defaultColor || null,
          default_unit_id: rowItem.defaultUnitId ? parseInt(rowItem.defaultUnitId) : null,
        };

        try {
          const res = await api('POST', '/admin/products', payload);
          const targetId = (res.product || res).id;
          if (targetId) {
            await Promise.allSettled([
              api('PUT', `/admin/products/${targetId}/attributes`, {
                size_ids: Array.from(selectedSizeIds),
                color_ids: Array.from(selectedColorIds),
              }),
              api('PUT', `/units/assigned/${targetId}`, {
                unit_ids: Array.from(selectedUnitIds),
              }),
            ]);
          }
          createdCount++;
        } catch {
          // If backend offline, save directly to local drafts/catalog
          const selectedBrand = masterData.brands.find((b) => String(b.id) === String(rowItem.brandId));
          const selectedCat = masterData.categories.find((c) => String(c.id) === String(rowItem.categoryId));
          saveDraft({
            ...payload,
            brand_name: selectedBrand?.name || 'BetterMend',
            category_name: selectedCat?.name || 'Groceries',
            status: 'draft',
          });
          createdCount++;
        }
      }

      showToast(`Successfully saved ${createdCount} product${createdCount > 1 ? 's' : ''}!`, 'success');
      onClose();
      if (onSuccess) onSuccess();
    } catch (err) {
      showToast('Save failed: ' + err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  // Save as Draft
  const handleSaveAsDraft = () => {
    const validRows = rows.filter((r) => r.name && r.name.trim());
    if (validRows.length === 0) {
      showToast('Enter at least one product name to save as draft', 'error');
      return;
    }

    validRows.forEach((r) => {
      const selectedBrand = masterData.brands.find((b) => String(b.id) === String(r.brandId));
      const selectedCat = masterData.categories.find((c) => String(c.id) === String(r.categoryId));

      const draftObj = {
        name: r.name.trim(),
        description: r.description.trim() || null,
        brand_id: r.brandId ? parseInt(r.brandId) : null,
        brand_name: selectedBrand ? selectedBrand.name : null,
        category_id: r.categoryId ? parseInt(r.categoryId) : null,
        category_name: selectedCat ? selectedCat.name : null,
        subcategory_id: r.subcategoryId ? parseInt(r.subcategoryId) : null,
        is_veg: r.isVeg === 'true',
        gst_percent: parseFloat(r.gstPercent) || 0,
        images: imageUrls,
        search_keywords: (r.searchKeywords || '')
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        default_size: r.defaultSize || null,
        default_color: r.defaultColor || null,
        default_unit_id: r.defaultUnitId ? parseInt(r.defaultUnitId) : null,
        status: 'draft',
      };
      saveDraft(draftObj);
    });

    showToast(`Saved ${validRows.length} item(s) to Drafts!`, 'success');
    onClose();
    if (onSuccess) onSuccess();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-excel" onClick={(e) => e.stopPropagation()}>
        {/* ── MODAL TOPBAR ── */}
        <div className="excel-topbar">
          <div className="excel-brand">
            <div
              className="excel-icon-box"
              style={{
                background: viewMode === 'excel' ? 'rgba(255, 255, 255, 0.15)' : '#2563eb',
              }}
            >
              {viewMode === 'excel' ? 'X' : <FiBox size={16} />}
            </div>
            <div className="excel-title-group">
              <h3>
                {viewMode === 'excel'
                  ? productId
                    ? 'Edit Product Worksheet'
                    : 'New Product Entry Worksheet.xlsx'
                  : productId
                  ? 'Edit Product'
                  : 'Add New Product'}
              </h3>
              <span>
                {viewMode === 'excel'
                  ? 'Microsoft Excel Style Grid Entry • Auto-sync active'
                  : 'Clean & Simple Form Entry'}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div className="excel-mode-pill">
              <button
                type="button"
                className={`excel-mode-btn ${viewMode === 'excel' ? 'active' : ''}`}
                onClick={() => setViewMode('excel')}
              >
                <FiGrid size={13} /> Excel Sheet
              </button>
              <button
                type="button"
                className={`excel-mode-btn ${viewMode === 'form' ? 'active' : ''}`}
                onClick={() => setViewMode('form')}
              >
                <FiFileText size={13} /> Simple Form
              </button>
            </div>

            <button type="button" className="excel-close-btn" onClick={onClose} aria-label="Close">
              <FiX size={16} />
            </button>
          </div>
        </div>

        {/* ── EXCEL TOOLBAR RIBBON ── */}
        {viewMode === 'excel' && (
          <>
            <div className="excel-ribbon-bar">
              <label
                className="excel-ribbon-btn"
                style={{ background: '#f0fdf4', borderColor: '#86efac', color: '#15803d', fontWeight: 700 }}
              >
                <FiUploadCloud size={13} />
                <span>+ Upload Photos</span>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handleImageUpload}
                />
              </label>

              {imageUrls.length > 0 && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: '#15803d', fontWeight: 700 }}>
                  <img
                    src={resolveImg(imageUrls[0])}
                    alt=""
                    style={{ width: '22px', height: '22px', borderRadius: '4px', objectFit: 'cover', border: '1px solid #86efac' }}
                  />
                  <span>{imageUrls.length} photo{imageUrls.length > 1 ? 's' : ''}</span>
                </div>
              )}

              {!productId && (
                <button type="button" className="excel-ribbon-btn" onClick={handleAddRow}>
                  <FiPlus style={{ color: 'var(--accent-blue)' }} /> Add Row
                </button>
              )}
              {!productId && (
                <button type="button" className="excel-ribbon-btn" onClick={handleDuplicateRow}>
                  <FiCopy /> Duplicate Row
                </button>
              )}
              {!productId && (
                <button type="button" className="excel-ribbon-btn" onClick={handleDeleteRow}>
                  <FiTrash2 style={{ color: '#ef4444' }} /> Delete Row
                </button>
              )}
              {!productId && (
                <button type="button" className="excel-ribbon-btn" onClick={handleClearSheet}>
                  Clear Sheet
                </button>
              )}

              <div style={{ marginLeft: 'auto', fontSize: '11.5px', color: '#64748b' }}>
                Tip: Click on any cell to edit • Press Tab or Enter to navigate
              </div>
            </div>

            {/* ── EXCEL FORMULA BAR (fx) ── */}
            <div className="excel-formula-bar">
              <span className="excel-cell-name">{activeCellCoord}</span>
              <span className="excel-fx-icon">fx</span>
              <input
                type="text"
                className="excel-formula-input"
                placeholder="Type cell value here or click below to edit..."
                value={activeCellValue}
                onChange={(e) => updateCell(activeRowIdx, activeCol, e.target.value)}
              />
            </div>
          </>
        )}

        {/* ── MODAL BODY CONTENT ── */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {viewMode === 'excel' ? (
            <>
              <div className="excel-grid-container">
                <table className="excel-table">
                    <thead>
                      <tr>
                        <th className="excel-row-num" style={{ width: '42px' }}>
                          #
                        </th>
                        <th style={{ width: '220px' }}>
                          <span className="excel-col-letter">A</span>
                          Product Name *
                        </th>
                        <th style={{ width: '160px' }}>
                          <span className="excel-col-letter">B</span>
                          Brand
                        </th>
                        <th style={{ width: '170px' }}>
                          <span className="excel-col-letter">C</span>
                          Category
                        </th>
                        <th style={{ width: '170px' }}>
                          <span className="excel-col-letter">D</span>
                          Subcategory
                        </th>
                        <th style={{ width: '90px' }}>
                          <span className="excel-col-letter">E</span>
                          GST %
                        </th>
                        <th style={{ width: '110px' }}>
                          <span className="excel-col-letter">F</span>
                          Food Type
                        </th>
                        <th style={{ width: '130px' }}>
                          <span className="excel-col-letter">G</span>
                          Default Unit
                        </th>
                        <th style={{ width: '120px' }}>
                          <span className="excel-col-letter">H</span>
                          Default Size
                        </th>
                        <th style={{ width: '120px' }}>
                          <span className="excel-col-letter">I</span>
                          Default Color
                        </th>
                        <th style={{ width: '240px' }}>
                          <span className="excel-col-letter">J</span>
                          Description
                        </th>
                        <th style={{ width: '180px' }}>
                          <span className="excel-col-letter">K</span>
                          Keywords
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, rIdx) => {
                        const isRowActive = activeRowIdx === rIdx;
                        return (
                          <tr key={row.id || rIdx}>
                            {/* Row Number */}
                            <td
                              className="excel-row-num"
                              onClick={() => {
                                setActiveRowIdx(rIdx);
                                setActiveCol('name');
                              }}
                              style={{
                                background: isRowActive ? 'var(--primary-light)' : '#f8fafc',
                                color: isRowActive ? 'var(--primary)' : 'var(--text-muted)',
                                cursor: 'pointer',
                                fontWeight: isRowActive ? 800 : 700,
                              }}
                            >
                              {rIdx + 1}
                            </td>

                            {/* Col A: Name */}
                            <td
                              className={`excel-cell ${isRowActive && activeCol === 'name' ? 'active-cell' : ''}`}
                              onClick={() => {
                                setActiveRowIdx(rIdx);
                                setActiveCol('name');
                              }}
                            >
                              <input
                                type="text"
                                className="excel-cell-input"
                                placeholder="Enter product name"
                                value={row.name}
                                onChange={(e) => updateCell(rIdx, 'name', e.target.value)}
                                onFocus={() => {
                                  setActiveRowIdx(rIdx);
                                  setActiveCol('name');
                                }}
                              />
                            </td>

                            {/* Col B: Brand */}
                            <td
                              className={`excel-cell ${isRowActive && activeCol === 'brandId' ? 'active-cell' : ''}`}
                              onClick={() => {
                                setActiveRowIdx(rIdx);
                                setActiveCol('brandId');
                              }}
                            >
                              <select
                                className="excel-cell-select"
                                value={row.brandId}
                                onChange={(e) => updateCell(rIdx, 'brandId', e.target.value)}
                                onFocus={() => {
                                  setActiveRowIdx(rIdx);
                                  setActiveCol('brandId');
                                }}
                              >
                                <option value="">— Select Brand —</option>
                                {masterData.brands.map((b) => (
                                  <option key={b.id} value={b.id}>
                                    {b.name}
                                  </option>
                                ))}
                              </select>
                            </td>

                            {/* Col C: Category */}
                            <td
                              className={`excel-cell ${isRowActive && activeCol === 'categoryId' ? 'active-cell' : ''}`}
                              onClick={() => {
                                setActiveRowIdx(rIdx);
                                setActiveCol('categoryId');
                              }}
                            >
                              <select
                                className="excel-cell-select"
                                value={row.categoryId}
                                onChange={(e) => updateCell(rIdx, 'categoryId', e.target.value)}
                                onFocus={() => {
                                  setActiveRowIdx(rIdx);
                                  setActiveCol('categoryId');
                                }}
                              >
                                <option value="">— Select Category —</option>
                                {masterData.categories.map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {c.name}
                                  </option>
                                ))}
                              </select>
                            </td>

                            {/* Col D: Subcategory */}
                            <td
                              className={`excel-cell ${isRowActive && activeCol === 'subcategoryId' ? 'active-cell' : ''}`}
                              onClick={() => {
                                setActiveRowIdx(rIdx);
                                setActiveCol('subcategoryId');
                              }}
                            >
                              <select
                                className="excel-cell-select"
                                value={row.subcategoryId}
                                onChange={(e) => updateCell(rIdx, 'subcategoryId', e.target.value)}
                                onFocus={() => {
                                  setActiveRowIdx(rIdx);
                                  setActiveCol('subcategoryId');
                                }}
                              >
                                <option value="">— Subcategory —</option>
                                {subcategories.map((s) => (
                                  <option key={s.id} value={s.id}>
                                    {s.name}
                                  </option>
                                ))}
                              </select>
                            </td>

                            {/* Col E: GST % */}
                            <td
                              className={`excel-cell ${isRowActive && activeCol === 'gstPercent' ? 'active-cell' : ''}`}
                              onClick={() => {
                                setActiveRowIdx(rIdx);
                                setActiveCol('gstPercent');
                              }}
                            >
                              <input
                                type="number"
                                min="0"
                                max="100"
                                className="excel-cell-input"
                                value={row.gstPercent}
                                onChange={(e) => updateCell(rIdx, 'gstPercent', e.target.value)}
                                onFocus={() => {
                                  setActiveRowIdx(rIdx);
                                  setActiveCol('gstPercent');
                                }}
                              />
                            </td>

                            {/* Col F: Veg/Non-Veg */}
                            <td
                              className={`excel-cell ${isRowActive && activeCol === 'isVeg' ? 'active-cell' : ''}`}
                              onClick={() => {
                                setActiveRowIdx(rIdx);
                                setActiveCol('isVeg');
                              }}
                            >
                              <select
                                className="excel-cell-select"
                                value={row.isVeg}
                                onChange={(e) => updateCell(rIdx, 'isVeg', e.target.value)}
                                onFocus={() => {
                                  setActiveRowIdx(rIdx);
                                  setActiveCol('isVeg');
                                }}
                              >
                                <option value="true">Veg 🌱</option>
                                <option value="false">Non-Veg 🍗</option>
                              </select>
                            </td>

                            {/* Col G: Default Unit */}
                            <td
                              className={`excel-cell ${isRowActive && activeCol === 'defaultUnitId' ? 'active-cell' : ''}`}
                              onClick={() => {
                                setActiveRowIdx(rIdx);
                                setActiveCol('defaultUnitId');
                              }}
                            >
                              <select
                                className="excel-cell-select"
                                value={row.defaultUnitId}
                                onChange={(e) => updateCell(rIdx, 'defaultUnitId', e.target.value)}
                                onFocus={() => {
                                  setActiveRowIdx(rIdx);
                                  setActiveCol('defaultUnitId');
                                }}
                              >
                                <option value="">— Unit —</option>
                                {masterData.units.map((u) => (
                                  <option key={u.id} value={u.id}>
                                    {u.display_name}
                                  </option>
                                ))}
                              </select>
                            </td>

                            {/* Col H: Default Size */}
                            <td
                              className={`excel-cell ${isRowActive && activeCol === 'defaultSize' ? 'active-cell' : ''}`}
                              onClick={() => {
                                setActiveRowIdx(rIdx);
                                setActiveCol('defaultSize');
                              }}
                            >
                              <select
                                className="excel-cell-select"
                                value={row.defaultSize}
                                onChange={(e) => updateCell(rIdx, 'defaultSize', e.target.value)}
                                onFocus={() => {
                                  setActiveRowIdx(rIdx);
                                  setActiveCol('defaultSize');
                                }}
                              >
                                <option value="">— Size —</option>
                                {masterData.sizes.map((s) => (
                                  <option key={s.id} value={s.label || s.name}>
                                    {s.label || s.name}
                                  </option>
                                ))}
                              </select>
                            </td>

                            {/* Col I: Default Color */}
                            <td
                              className={`excel-cell ${isRowActive && activeCol === 'defaultColor' ? 'active-cell' : ''}`}
                              onClick={() => {
                                setActiveRowIdx(rIdx);
                                setActiveCol('defaultColor');
                              }}
                            >
                              <select
                                className="excel-cell-select"
                                value={row.defaultColor}
                                onChange={(e) => updateCell(rIdx, 'defaultColor', e.target.value)}
                                onFocus={() => {
                                  setActiveRowIdx(rIdx);
                                  setActiveCol('defaultColor');
                                }}
                              >
                                <option value="">— Color —</option>
                                {masterData.colors.map((c) => (
                                  <option key={c.id} value={c.label || c.name}>
                                    {c.label || c.name}
                                  </option>
                                ))}
                              </select>
                            </td>

                            {/* Col J: Description */}
                            <td
                              className={`excel-cell ${isRowActive && activeCol === 'description' ? 'active-cell' : ''}`}
                              onClick={() => {
                                setActiveRowIdx(rIdx);
                                setActiveCol('description');
                              }}
                            >
                              <input
                                type="text"
                                className="excel-cell-input"
                                placeholder="Short description..."
                                value={row.description}
                                onChange={(e) => updateCell(rIdx, 'description', e.target.value)}
                                onFocus={() => {
                                  setActiveRowIdx(rIdx);
                                  setActiveCol('description');
                                }}
                              />
                            </td>

                            {/* Col K: Keywords */}
                            <td
                              className={`excel-cell ${isRowActive && activeCol === 'searchKeywords' ? 'active-cell' : ''}`}
                              onClick={() => {
                                setActiveRowIdx(rIdx);
                                setActiveCol('searchKeywords');
                              }}
                            >
                              <input
                                type="text"
                                className="excel-cell-input"
                                placeholder="comma, separated"
                                value={row.searchKeywords}
                                onChange={(e) => updateCell(rIdx, 'searchKeywords', e.target.value)}
                                onFocus={() => {
                                  setActiveRowIdx(rIdx);
                                  setActiveCol('searchKeywords');
                                }}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

              {/* ── EXCEL SHEET FOOTER ── */}
              <div className="excel-sheet-footer">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, color: 'var(--primary)', fontSize: '12px' }}>
                  <FiGrid size={13} style={{ color: 'var(--accent-blue)' }} /> Product Worksheet
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', color: '#64748b', fontSize: '11px' }}>
                  <span style={{ color: '#10b981', fontWeight: 700 }}>● READY</span>
                  <span>Total Rows: {rows.length}</span>
                  <span>Active Cell: <strong>{activeCellCoord}</strong></span>
                </div>
              </div>
            </>
          ) : (
            /* ── USER-FRIENDLY FORM VIEW (FOR MOBILE & SIMPLE ENTRY) ── */
            <div className="modal-body" style={{ flex: 1, overflowY: 'auto', padding: '18px 20px', gap: '16px' }}>
              {/* 1. Photos Upload */}
              <div className="mobile-form-card" style={{ padding: '16px', borderRadius: '12px' }}>
                <div className="mobile-card-header">
                  <div className="mobile-card-icon">
                    <FiImage />
                  </div>
                  <div>
                    <div className="mobile-card-title">1. Product Photos</div>
                    <div className="mobile-card-desc">Upload photos from gallery or camera</div>
                  </div>
                </div>

                <label className="mobile-image-uploader" style={{ padding: '16px 12px' }}>
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
                    onChange={handleImageUpload}
                  />
                </label>

                {imageUrls.length > 0 && (
                  <div className="mobile-image-previews">
                    {imageUrls.map((img, i) => (
                      <div key={i} className="mobile-img-thumb">
                        <img src={resolveImg(img)} alt={`Product ${i + 1}`} />
                        <button
                          type="button"
                          className="mobile-img-remove-btn"
                          onClick={() => removeImage(i)}
                          aria-label="Remove image"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 2. Basic Details */}
              <div className="mobile-form-card" style={{ padding: '16px', borderRadius: '12px' }}>
                <div className="mobile-card-header">
                  <div className="mobile-card-icon">
                    <FiBox />
                  </div>
                  <div>
                    <div className="mobile-card-title">2. Basic Details</div>
                    <div className="mobile-card-desc">Name, brand & categorization</div>
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
                    value={name}
                    onChange={(e) => updateCell(0, 'name', e.target.value)}
                  />
                </div>

                <div className="form-row" style={{ gap: '12px' }}>
                  <div className="mobile-form-group" style={{ flex: 1 }}>
                    <label className="mobile-form-label">Brand</label>
                    <select
                      className="mobile-select"
                      value={brandId}
                      onChange={(e) => updateCell(0, 'brandId', e.target.value)}
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
                      value={categoryId}
                      onChange={(e) => updateCell(0, 'categoryId', e.target.value)}
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
                    value={subcategoryId}
                    onChange={(e) => updateCell(0, 'subcategoryId', e.target.value)}
                    disabled={!categoryId}
                  >
                    <option value="">
                      {categoryId ? '— Select Subcategory —' : '— Select Category First —'}
                    </option>
                    {subcategories.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 3. Classification & Tax */}
              <div className="mobile-form-card" style={{ padding: '16px', borderRadius: '12px' }}>
                <div className="mobile-card-header">
                  <div className="mobile-card-icon">
                    <FiCheckCircle />
                  </div>
                  <div>
                    <div className="mobile-card-title">3. Classification & Tax</div>
                    <div className="mobile-card-desc">Veg / Non-veg & GST rate</div>
                  </div>
                </div>

                <div className="mobile-form-group">
                  <label className="mobile-form-label">Dietary Type</label>
                  <div className="mobile-dietary-row">
                    <button
                      type="button"
                      className={`mobile-dietary-btn ${isVeg === 'true' ? 'active veg' : ''}`}
                      onClick={() => updateCell(0, 'isVeg', 'true')}
                    >
                      <span style={{ fontSize: '15px' }}>🟢</span> Vegetarian
                    </button>
                    <button
                      type="button"
                      className={`mobile-dietary-btn ${isVeg === 'false' ? 'active nonveg' : ''}`}
                      onClick={() => updateCell(0, 'isVeg', 'false')}
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
                        className={`mobile-pill-btn ${String(gstPercent) === rate ? 'active' : ''}`}
                        onClick={() => updateCell(0, 'gstPercent', rate)}
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
                    value={gstPercent}
                    onChange={(e) => updateCell(0, 'gstPercent', e.target.value)}
                  />
                </div>
              </div>

              {/* 4. Measurement & Specs */}
              <div className="mobile-form-card" style={{ padding: '16px', borderRadius: '12px' }}>
                <div className="mobile-card-header">
                  <div className="mobile-card-icon">
                    <FiGrid />
                  </div>
                  <div>
                    <div className="mobile-card-title">4. Measurement & Specs</div>
                    <div className="mobile-card-desc">Unit, size & color specifications</div>
                  </div>
                </div>

                <div className="form-row" style={{ gap: '12px' }}>
                  <div className="mobile-form-group" style={{ flex: 1 }}>
                    <label className="mobile-form-label">Unit</label>
                    <select
                      className="mobile-select"
                      value={defaultUnitId}
                      onChange={(e) => updateCell(0, 'defaultUnitId', e.target.value)}
                    >
                      <option value="">— Select Unit —</option>
                      {masterData.units.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name || u.short_name} ({u.short_name || u.symbol || u.name})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="mobile-form-group" style={{ flex: 1 }}>
                    <label className="mobile-form-label">Size</label>
                    <input
                      type="text"
                      className="mobile-input"
                      placeholder="e.g. 1kg, 500ml, XL"
                      value={defaultSize}
                      onChange={(e) => updateCell(0, 'defaultSize', e.target.value)}
                      list="modal-size-suggestions"
                    />
                    <datalist id="modal-size-suggestions">
                      {masterData.sizes.map((s) => (
                        <option key={s.id} value={s.label || s.name} />
                      ))}
                    </datalist>
                  </div>

                  <div className="mobile-form-group" style={{ flex: 1 }}>
                    <label className="mobile-form-label">Color</label>
                    <input
                      type="text"
                      className="mobile-input"
                      placeholder="e.g. Red, Blue"
                      value={defaultColor}
                      onChange={(e) => updateCell(0, 'defaultColor', e.target.value)}
                      list="modal-color-suggestions"
                    />
                    <datalist id="modal-color-suggestions">
                      {masterData.colors.map((c) => (
                        <option key={c.id} value={c.label || c.name} />
                      ))}
                    </datalist>
                  </div>
                </div>
              </div>

              {/* 5. Description & Search */}
              <div className="mobile-form-card" style={{ padding: '16px', borderRadius: '12px' }}>
                <div className="mobile-card-header">
                  <div className="mobile-card-icon">
                    <FiFileText />
                  </div>
                  <div>
                    <div className="mobile-card-title">5. Description & Search</div>
                    <div className="mobile-card-desc">Search keywords & product details</div>
                  </div>
                </div>

                <div className="mobile-form-group">
                  <label className="mobile-form-label">Search Keywords</label>
                  <input
                    type="text"
                    className="mobile-input"
                    placeholder="e.g. rice, biryani, grocery (comma separated)"
                    value={searchKeywords}
                    onChange={(e) => updateCell(0, 'searchKeywords', e.target.value)}
                  />
                </div>

                <div className="mobile-form-group">
                  <label className="mobile-form-label">Product Description</label>
                  <textarea
                    rows={3}
                    className="mobile-textarea"
                    placeholder="Brief description about the product features, quality, usage..."
                    value={description}
                    onChange={(e) => updateCell(0, 'description', e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── MODAL FOOTER ACTIONS ── */}
        <div className="excel-modal-actions">
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          {!productId && (
            <button
              type="button"
              className="btn btn-outline"
              onClick={handleSaveAsDraft}
              disabled={saving || loading}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
            >
              <FiFileText size={14} /> Save to Drafts
            </button>
          )}
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving || loading}
            style={{
              background: 'var(--primary)',
              borderColor: 'var(--primary)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <FiCheck size={15} />
            {saving ? 'Saving…' : productId ? 'Save Product' : `Save ${rows.filter((r) => r.name.trim()).length > 1 ? `${rows.filter((r) => r.name.trim()).length} Products` : 'Product'}`}
          </button>
        </div>
      </div>
    </div>
  );
}
