'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import GenericModal from '@/components/GenericModal';
import ConfirmModal from '@/components/ConfirmModal';
import { FiPlus, FiMaximize2, FiEdit2, FiTrash2 } from 'react-icons/fi';
import { archiveToDrafts } from '@/lib/drafts';

export default function SizesPage() {
  const { refreshMasterData } = useAuth();
  const { showToast } = useToast();

  const [sizes, setSizes] = useState([]);
  const [loading, setLoading] = useState(false);

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSize, setEditingSize] = useState(null);
  const [label, setLabel] = useState('');
  const [sortOrder, setSortOrder] = useState('0');
  const [saving, setSaving] = useState(false);

  // Delete
  const [deleteTargetId, setDeleteTargetId] = useState(null);

  const loadSizes = useCallback(async () => {
    try {
      const data = await api('GET', '/admin/sizes');
      setSizes(Array.isArray(data?.sizes) ? data.sizes : []);
    } catch (err) {
      setSizes([]);
      showToast(err.message || 'Failed to load sizes from backend', 'error');
    }
  }, [showToast]);

  useEffect(() => {
    loadSizes();
  }, [loadSizes]);

  const openAddModal = () => {
    setEditingSize(null);
    setLabel('');
    setSortOrder('0');
    setModalOpen(true);
  };

  const openEditModal = (s) => {
    setEditingSize(s);
    setLabel(s.label || '');
    setSortOrder(String(s.sort_order || 0));
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!label.trim()) {
      showToast('Label is required', 'error');
      return;
    }

    setSaving(true);
    try {
      const body = {
        label: label.trim(),
        sort_order: parseInt(sortOrder) || 0,
      };

      if (editingSize) {
        await api('PUT', `/admin/sizes/${editingSize.id}`, body);
        showToast('Size updated', 'success');
      } else {
        await api('POST', '/admin/sizes', body);
        showToast('Size created', 'success');
      }

      setModalOpen(false);
      refreshMasterData();
      loadSizes();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTargetId) return;
    const item = sizes.find((s) => s.id === deleteTargetId) || { id: deleteTargetId, label: `Size #${deleteTargetId}` };
    try {
      archiveToDrafts({
        name: item.label,
        source_page: 'sizes',
        source_label: 'Sizes',
        item_type: 'size',
        original_data: item,
        description: `Sort Order: ${item.sort_order ?? 0}`,
      });

      await api('DELETE', `/admin/sizes/${deleteTargetId}`);
      showToast(`Size "${item.label}" moved to Drafts`, 'success');
      setDeleteTargetId(null);
      refreshMasterData();
      loadSizes();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  return (
    <div>
      <div className="page-toolbar">
        <h3>Sizes</h3>
        <button className="btn btn-primary" onClick={openAddModal} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <FiPlus size={15} /> Add Size
        </button>
      </div>

      {loading ? (
        <div className="loading">
          <div className="spinner"></div>
          <p>Loading sizes…</p>
        </div>
      ) : sizes.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon" style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px' }}>
            <FiMaximize2 size={40} style={{ color: '#94a3b8' }} />
          </div>
          <p>No sizes found</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Label</th>
                <th>Sort Order</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sizes.map((s) => (
                <tr key={s.id}>
                  <td>
                    <strong>{s.label}</strong>
                  </td>
                  <td>{s.sort_order || 0}</td>
                  <td>
                    {s.is_active !== false ? (
                      <span className="badge badge-green">Active</span>
                    ) : (
                      <span className="badge badge-grey">Inactive</span>
                    )}
                  </td>
                  <td className="table-actions">
                    <button
                      type="button"
                      className="btn btn-sm btn-outline"
                      onClick={() => openEditModal(s)}
                      title="Edit"
                    >
                      <FiEdit2 size={13} />
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-danger"
                      onClick={() => setDeleteTargetId(s.id)}
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
        title={editingSize ? 'Edit Size' : 'Add Size'}
        onSave={handleSave}
        onCancel={() => setModalOpen(false)}
        loading={saving}
      >
        <div className="form-group">
          <label>Label *</label>
          <input
            type="text"
            placeholder="e.g. S, M, L, XL, Free Size"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
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
        title="Delete Size"
        message="Are you sure you want to delete this size?"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTargetId(null)}
      />
    </div>
  );
}
