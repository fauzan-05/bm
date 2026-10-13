'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { mockMasterData } from '@/lib/mockData';
import GenericModal from '@/components/GenericModal';
import ConfirmModal from '@/components/ConfirmModal';
import { FiPlus, FiDroplet, FiEdit2, FiTrash2 } from 'react-icons/fi';

export default function ColorsPage() {
  const { masterData, refreshMasterData } = useAuth();
  const { showToast } = useToast();

  const [colors, setColors] = useState(masterData?.colors?.length ? masterData.colors : mockMasterData.colors);
  const [loading, setLoading] = useState(false);

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingColor, setEditingColor] = useState(null);
  const [label, setLabel] = useState('');
  const [hexCode, setHexCode] = useState('#000000');
  const [sortOrder, setSortOrder] = useState('0');
  const [saving, setSaving] = useState(false);

  // Delete
  const [deleteTargetId, setDeleteTargetId] = useState(null);

  const loadColors = useCallback(async () => {
    try {
      const data = await api('GET', '/admin/colors');
      if (data && data.colors && data.colors.length > 0) {
        setColors(data.colors);
      } else {
        setColors(masterData?.colors?.length ? masterData.colors : mockMasterData.colors);
      }
    } catch {
      setColors(masterData?.colors?.length ? masterData.colors : mockMasterData.colors);
    }
  }, [masterData]);

  useEffect(() => {
    loadColors();
  }, [loadColors]);

  const openAddModal = () => {
    setEditingColor(null);
    setLabel('');
    setHexCode('#030C54');
    setSortOrder('0');
    setModalOpen(true);
  };

  const openEditModal = (c) => {
    setEditingColor(c);
    setLabel(c.label || '');
    setHexCode(c.hex_code || '#030C54');
    setSortOrder(String(c.sort_order || 0));
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!label.trim()) {
      showToast('Color label is required', 'error');
      return;
    }

    setSaving(true);
    try {
      const body = {
        label: label.trim(),
        hex_code: hexCode.trim() || null,
        sort_order: parseInt(sortOrder) || 0,
      };

      if (editingColor) {
        await api('PUT', `/admin/colors/${editingColor.id}`, body);
        showToast('Color updated', 'success');
      } else {
        await api('POST', '/admin/colors', body);
        showToast('Color created', 'success');
      }

      setModalOpen(false);
      refreshMasterData();
      loadColors();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTargetId) return;
    try {
      await api('DELETE', `/admin/colors/${deleteTargetId}`);
      showToast('Color deleted', 'success');
      setDeleteTargetId(null);
      refreshMasterData();
      loadColors();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  return (
    <div>
      <div className="page-toolbar">
        <h3>Colors</h3>
        <button className="btn btn-primary" onClick={openAddModal} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <FiPlus size={15} /> Add Color
        </button>
      </div>

      {loading ? (
        <div className="loading">
          <div className="spinner"></div>
          <p>Loading colors…</p>
        </div>
      ) : colors.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon" style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px' }}>
            <FiDroplet size={40} style={{ color: '#94a3b8' }} />
          </div>
          <p>No colors found</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Swatch</th>
                <th>Label</th>
                <th>Hex</th>
                <th>Sort</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {colors.map((c) => (
                <tr key={c.id}>
                  <td>
                    <span
                      className="color-swatch"
                      style={{ background: c.hex_code || '#ccc' }}
                    ></span>
                  </td>
                  <td>
                    <strong>{c.label}</strong>
                  </td>
                  <td>
                    <code>{c.hex_code || '—'}</code>
                  </td>
                  <td>{c.sort_order || 0}</td>
                  <td>
                    {c.is_active !== false ? (
                      <span className="badge badge-green">Active</span>
                    ) : (
                      <span className="badge badge-grey">Inactive</span>
                    )}
                  </td>
                  <td className="table-actions">
                    <button
                      type="button"
                      className="btn btn-sm btn-outline"
                      onClick={() => openEditModal(c)}
                      title="Edit"
                    >
                      <FiEdit2 size={13} />
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-danger"
                      onClick={() => setDeleteTargetId(c.id)}
                      title="Delete"
                    >
                      <FiTrash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ADD / EDIT MODAL */}
      <GenericModal
        isOpen={modalOpen}
        title={editingColor ? 'Edit Color' : 'Add Color'}
        onSave={handleSave}
        onCancel={() => setModalOpen(false)}
        loading={saving}
      >
        <div className="form-group">
          <label>Label *</label>
          <input
            type="text"
            placeholder="e.g. Red, Royal Blue, Olive Green"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
        </div>

        <div className="form-row" style={{ marginTop: '10px', alignItems: 'center' }}>
          <div className="form-group">
            <label>Hex Code</label>
            <input
              type="text"
              placeholder="#FF0000"
              value={hexCode}
              onChange={(e) => setHexCode(e.target.value)}
            />
          </div>
          <div className="form-group" style={{ maxWidth: '90px' }}>
            <label>Color Picker</label>
            <input
              type="color"
              value={hexCode.startsWith('#') && hexCode.length === 7 ? hexCode : '#030C54'}
              onChange={(e) => setHexCode(e.target.value)}
              style={{ height: '38px', padding: '2px', cursor: 'pointer' }}
            />
          </div>
          <div className="form-group" style={{ maxWidth: '80px', alignItems: 'center' }}>
            <label>Preview</label>
            <span
              className="color-swatch"
              style={{
                background: hexCode || '#ccc',
                width: '36px',
                height: '36px',
                marginTop: '2px',
              }}
            ></span>
          </div>
        </div>

        <div className="form-group" style={{ marginTop: '10px' }}>
          <label>Sort Order</label>
          <input
            type="number"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
          />
        </div>
      </GenericModal>

      {/* CONFIRM DELETE MODAL */}
      <ConfirmModal
        isOpen={!!deleteTargetId}
        title="Delete Color"
        message="Are you sure you want to delete this color?"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTargetId(null)}
      />
    </div>
  );
}
