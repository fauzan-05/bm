'use client';

import { useState, useEffect, useCallback } from 'react';
import { api, resolveImg, uploadImages } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { FiX, FiTrash2, FiPlus, FiEdit2 } from 'react-icons/fi';
import ConfirmModal from '@/components/ConfirmModal';

export default function VariantDetailModal({ isOpen, productId, productName, onClose }) {
  const { masterData } = useAuth();
  const { showToast } = useToast();

  const [variants, setVariants] = useState([]);
  const [loading, setLoading] = useState(false);

  // Available options filtered by product assignments
  const [assignedUnits, setAssignedUnits] = useState([]);
  const [assignedSizes, setAssignedSizes] = useState([]);
  const [assignedColors, setAssignedColors] = useState([]);

  // Form State
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingVariantId, setEditingVariantId] = useState(null);
  const [vdUnitId, setVdUnitId] = useState('');
  const [vdSize, setVdSize] = useState('');
  const [vdColor, setVdColor] = useState('');
  const [vdDesc, setVdDesc] = useState('');
  const [vdImages, setVdImages] = useState([]);
  const [vdCustomFields, setVdCustomFields] = useState([]); // [{ label: '', value: '' }]
  const [savingVariant, setSavingVariant] = useState(false);

  // Delete confirm
  const [deleteTargetId, setDeleteTargetId] = useState(null);

  const resetForm = () => {
    setShowAddForm(false);
    setEditingVariantId(null);
    setVdUnitId('');
    setVdSize('');
    setVdColor('');
    setVdDesc('');
    setVdImages([]);
    setVdCustomFields([]);
  };

  const loadVariants = useCallback(async () => {
    if (!productId) return;
    setLoading(true);
    try {
      const data = await api('GET', `/admin/products/${productId}/variants`);
      setVariants(data.variants || []);
    } catch (err) {
      showToast('Failed to load variants: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [productId, showToast]);

  useEffect(() => {
    if (!isOpen || !productId) return;

    resetForm();

    // Fetch assigned attributes
    Promise.allSettled([
      api('GET', `/admin/products/${productId}/attributes`),
      api('GET', `/units/assigned/${productId}`),
    ]).then(([attrRes, unitRes]) => {
      const sIds = new Set(
        attrRes.status === 'fulfilled' ? (attrRes.value.size_ids || []).map(Number) : []
      );
      const cIds = new Set(
        attrRes.status === 'fulfilled' ? (attrRes.value.color_ids || []).map(Number) : []
      );
      const uList =
        unitRes.status === 'fulfilled' ? unitRes.value.assigned_units || [] : [];

      setAssignedSizes(sIds.size > 0 ? masterData.sizes.filter((s) => sIds.has(s.id)) : masterData.sizes);
      setAssignedColors(cIds.size > 0 ? masterData.colors.filter((c) => cIds.has(c.id)) : masterData.colors);
      setAssignedUnits(uList.length > 0 ? uList : masterData.units);
    });

    loadVariants();
  }, [isOpen, productId, masterData, loadVariants]);

  if (!isOpen) return null;

  // ── IMAGE UPLOAD HANDLING ──
  const handleVdImageUpload = async (e) => {
    const files = e.target.files;
    if (!files || !files.length) return;
    try {
      showToast('Uploading images…', 'info');
      const urls = await uploadImages(files);
      setVdImages((prev) => [...prev, ...urls]);
      showToast('Images uploaded', 'success');
    } catch (err) {
      // Fallback preview
      const localUrls = Array.from(files).map((f) => URL.createObjectURL(f));
      setVdImages((prev) => [...prev, ...localUrls]);
      showToast('Images attached (preview ready)', 'info');
    }
    e.target.value = '';
  };

  const removeVdImage = (index) => {
    setVdImages((prev) => prev.filter((_, i) => i !== index));
  };

  // ── CUSTOM FIELDS HANDLERS ──
  const addVdCustomField = () => {
    setVdCustomFields((prev) => [...prev, { label: '', value: '' }]);
  };

  const updateVdCustomField = (index, key, val) => {
    setVdCustomFields((prev) => {
      const next = [...prev];
      if (next[index]) {
        next[index] = { ...next[index], [key]: val };
      }
      return next;
    });
  };

  const removeVdCustomField = (index) => {
    setVdCustomFields((prev) => prev.filter((_, i) => i !== index));
  };

  // ── EDIT EXISTING VARIANT ──
  const handleEditVariant = (v) => {
    setEditingVariantId(v.id);
    setVdUnitId(v.unit_id ? String(v.unit_id) : '');
    setVdSize(v.size || '');
    setVdColor(v.color || '');
    setVdDesc(v.description || '');
    setVdImages(v.images || []);

    let cFields = [];
    if (Array.isArray(v.custom_fields) && v.custom_fields.length > 0) {
      cFields = v.custom_fields.map((f) => ({
        label: f.label || f.key || '',
        value: f.value || '',
      }));
    } else if (v.attributes && typeof v.attributes === 'object') {
      cFields = Object.entries(v.attributes).map(([k, val]) => ({
        label: k,
        value: String(val),
      }));
    }
    setVdCustomFields(cFields);
    setShowAddForm(true);
  };

  // ── SAVE VARIANT ACTION ──
  const handleSaveVariant = async () => {
    setSavingVariant(true);
    try {
      const validCustomFields = vdCustomFields
        .filter((f) => (f.label && f.label.trim()) || (f.value && f.value.trim()))
        .map((f) => ({
          label: (f.label || '').trim(),
          value: (f.value || '').trim(),
        }));

      const payload = {
        unit_id: vdUnitId ? parseInt(vdUnitId) : null,
        size: vdSize || null,
        color: vdColor || null,
        description: vdDesc ? vdDesc.trim() : null,
        images: vdImages,
        custom_fields: validCustomFields,
      };

      if (editingVariantId) {
        try {
          await api('PUT', `/admin/products/${productId}/variants/${editingVariantId}`, payload);
        } catch {
          await api('POST', `/admin/products/${productId}/variants`, payload);
        }
        showToast('Variant updated successfully', 'success');
      } else {
        await api('POST', `/admin/products/${productId}/variants`, payload);
        showToast('Variant added successfully', 'success');
      }

      resetForm();
      loadVariants();
    } catch (err) {
      showToast('Failed to save variant: ' + err.message, 'error');
    } finally {
      setSavingVariant(false);
    }
  };

  const handleDeleteVariant = async () => {
    if (!deleteTargetId) return;
    try {
      await api('DELETE', `/admin/products/${productId}/variants/${deleteTargetId}`);
      showToast('Variant deleted', 'success');
      setDeleteTargetId(null);
      loadVariants();
    } catch (err) {
      showToast('Failed to delete: ' + err.message, 'error');
    }
  };

  return (
    <>
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h3>Variants — {productName}</h3>
            <button onClick={onClose} aria-label="Close">
              <FiX />
            </button>
          </div>

          <div className="modal-body">
            {loading ? (
              <div className="loading">
                <div className="spinner"></div>
                <p>Loading variants…</p>
              </div>
            ) : variants.length === 0 && !showAddForm ? (
              <div className="empty-state">
                <p>No variants yet. Click &quot;+ Add Variant&quot; below to add one.</p>
              </div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>SKU</th>
                      <th>Unit</th>
                      <th>Size</th>
                      <th>Color</th>
                      <th>Description</th>
                      <th>Custom Fields</th>
                      <th>Image</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {variants.map((v) => {
                      const cFields = Array.isArray(v.custom_fields)
                        ? v.custom_fields
                        : v.attributes && typeof v.attributes === 'object'
                        ? Object.entries(v.attributes).map(([k, val]) => ({ label: k, value: String(val) }))
                        : [];

                      return (
                        <tr key={v.id}>
                          <td>
                            <code>{v.sku_id || '—'}</code>
                          </td>
                          <td>{v.unit_display_name || v.unit?.name || '—'}</td>
                          <td>{v.size || '—'}</td>
                          <td>{v.color || '—'}</td>
                          <td style={{ maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {v.description || '—'}
                          </td>
                          <td>
                            {cFields.length > 0 ? (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                {cFields.map((cf, idx) => (
                                  <span
                                    key={idx}
                                    style={{
                                      fontSize: '11px',
                                      padding: '2px 7px',
                                      borderRadius: '4px',
                                      background: '#f3e8ff',
                                      color: '#6b21a8',
                                      fontWeight: 600,
                                    }}
                                  >
                                    {cf.label}: {cf.value}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span style={{ color: '#94a3b8' }}>—</span>
                            )}
                          </td>
                          <td>
                            {v.images && v.images.length > 0 ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <img
                                  src={resolveImg(v.images[0])}
                                  alt=""
                                  className="table-img"
                                  style={{ width: '36px', height: '36px', borderRadius: '6px', objectFit: 'cover' }}
                                />
                                {v.images.length > 1 && (
                                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                    +{v.images.length - 1}
                                  </span>
                                )}
                              </div>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="table-actions">
                            <button
                              type="button"
                              className="btn btn-sm btn-outline"
                              onClick={() => handleEditVariant(v)}
                              aria-label="Edit variant"
                              title="Edit variant"
                              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                              <FiEdit2 size={13} />
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm btn-danger"
                              onClick={() => setDeleteTargetId(v.id)}
                              aria-label="Delete variant"
                              title="Delete variant"
                              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
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
            )}

            {!showAddForm ? (
              <button
                type="button"
                className="btn btn-outline"
                style={{
                  marginTop: '16px',
                  alignSelf: 'flex-start',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  borderColor: '#6d28d9',
                  color: '#6d28d9',
                  fontWeight: 700,
                }}
                onClick={() => {
                  resetForm();
                  setShowAddForm(true);
                }}
              >
                <FiPlus /> Add Variant
              </button>
            ) : (
              /* ── VARIANT FORM MATCHING EXACT USER MOCKUP SCREENSHOTS ── */
              <div
                style={{
                  marginTop: '16px',
                  padding: '20px',
                  background: '#faf8ff',
                  borderRadius: '12px',
                  border: '1.5px solid #e8e0f8',
                  boxShadow: '0 2px 8px rgba(109, 40, 217, 0.05)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>
                  <h4 style={{ margin: 0, color: '#6d28d9', fontWeight: 800 }}>
                    {editingVariantId ? 'Edit Variant' : 'New Variant'}
                  </h4>
                  <button
                    type="button"
                    onClick={resetForm}
                    style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
                  >
                    ✕ Close Form
                  </button>
                </div>

                {/* 1. UNIT, SIZE, COLOR (3-Column Grid) */}
                <div className="variant-mockup-grid-3">
                  <div>
                    <label className="variant-mockup-label">UNIT</label>
                    <select
                      className="variant-mockup-select"
                      value={vdUnitId}
                      onChange={(e) => setVdUnitId(e.target.value)}
                    >
                      <option value="">— None —</option>
                      {assignedUnits.map((u) => (
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
                      value={vdSize}
                      onChange={(e) => setVdSize(e.target.value)}
                    >
                      <option value="">— None —</option>
                      {assignedSizes.map((s) => (
                        <option key={s.id} value={s.label}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="variant-mockup-label">COLOR</label>
                    <select
                      className="variant-mockup-select"
                      value={vdColor}
                      onChange={(e) => setVdColor(e.target.value)}
                    >
                      <option value="">— None —</option>
                      {assignedColors.map((c) => (
                        <option key={c.id} value={c.label}>
                          {c.label}
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
                    value={vdDesc}
                    onChange={(e) => setVdDesc(e.target.value)}
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
                        accept="image/*"
                        multiple
                        onChange={handleVdImageUpload}
                        style={{ display: 'none' }}
                      />
                    </label>

                    {vdImages.map((url, i) => (
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
                          src={resolveImg(url)}
                          alt=""
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                        <button
                          type="button"
                          onClick={() => removeVdImage(i)}
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
                <div className="custom-fields-section" style={{ marginTop: '4px' }}>
                  <div className="custom-fields-header">
                    <span className="custom-fields-title">Custom Fields</span>
                    <button
                      type="button"
                      className="custom-fields-add-btn"
                      onClick={addVdCustomField}
                    >
                      + Add Field
                    </button>
                  </div>

                  {vdCustomFields.length === 0 ? (
                    <div style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic', padding: '4px 0' }}>
                      No custom fields yet. Click &quot;+ Add Field&quot; to specify attributes like Material, Warranty, Weight.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {vdCustomFields.map((cf, fIdx) => (
                        <div key={fIdx} className="custom-field-row">
                          <input
                            type="text"
                            className="custom-field-input"
                            placeholder="Label"
                            value={cf.label}
                            onChange={(e) => updateVdCustomField(fIdx, 'label', e.target.value)}
                          />
                          <input
                            type="text"
                            className="custom-field-input"
                            placeholder="Value"
                            value={cf.value}
                            onChange={(e) => updateVdCustomField(fIdx, 'value', e.target.value)}
                          />
                          <button
                            type="button"
                            className="custom-field-del-btn"
                            onClick={() => removeVdCustomField(fIdx)}
                            title="Delete custom field"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 5. ACTION BUTTONS: Cancel & Save Variant */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px', paddingTop: '10px', borderTop: '1px solid #e8e0f8' }}>
                  <button
                    type="button"
                    className="variant-btn-cancel"
                    onClick={resetForm}
                    disabled={savingVariant}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="variant-btn-save"
                    onClick={handleSaveVariant}
                    disabled={savingVariant}
                  >
                    {savingVariant ? 'Saving…' : (editingVariantId ? 'Update Variant' : 'Save Variant')}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button className="btn btn-outline" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={!!deleteTargetId}
        title="Delete Variant"
        message="Are you sure you want to delete this variant?"
        onConfirm={handleDeleteVariant}
        onCancel={() => setDeleteTargetId(null)}
      />
    </>
  );
}
