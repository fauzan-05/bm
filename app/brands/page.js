'use client';

import { useState, useEffect, useCallback } from 'react';
import { api, resolveImg, uploadImages } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import GenericModal from '@/components/GenericModal';
import ConfirmModal from '@/components/ConfirmModal';
import { FiPlus, FiTag, FiEdit2, FiTrash2, FiUploadCloud } from 'react-icons/fi';
import { archiveToDrafts } from '@/lib/drafts';

export default function BrandsPage() {
  const { refreshMasterData } = useAuth();
  const { showToast } = useToast();

  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(false);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBrand, setEditingBrand] = useState(null);
  const [name, setName] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [saving, setSaving] = useState(false);

  // Delete modal state
  const [deleteTargetId, setDeleteTargetId] = useState(null);

  const loadBrands = useCallback(async () => {
    try {
      const data = await api('GET', '/admin/brands');
      setBrands(Array.isArray(data?.brands) ? data.brands : []);
    } catch (err) {
      setBrands([]);
      showToast(err.message || 'Failed to load brands from backend', 'error');
    }
  }, [showToast]);

  useEffect(() => {
    loadBrands();
  }, [loadBrands]);

  const openAddModal = () => {
    setEditingBrand(null);
    setName('');
    setImageUrl('');
    setModalOpen(true);
  };

  const openEditModal = (brand) => {
    setEditingBrand(brand);
    setName(brand.name || '');
    setImageUrl(brand.image || '');
    setModalOpen(true);
  };

  const handleUploadImage = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      showToast('Uploading image…', 'info');
      const urls = await uploadImages([file]);
      if (urls.length > 0) {
        setImageUrl(urls[0]);
        showToast('Image uploaded', 'success');
      }
    } catch (err) {
      showToast('Upload failed: ' + err.message, 'error');
    }
    e.target.value = '';
  };

  const handleSave = async () => {
    if (!name.trim()) {
      showToast('Brand name is required', 'error');
      return;
    }

    setSaving(true);
    try {
      const body = {
        name: name.trim(),
        image: imageUrl.trim() || null,
      };

      if (editingBrand) {
        await api('PUT', `/admin/brands/${editingBrand.id}`, body);
        showToast('Brand updated', 'success');
      } else {
        await api('POST', '/admin/brands', body);
        showToast('Brand created', 'success');
      }

      setModalOpen(false);
      refreshMasterData();
      loadBrands();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTargetId) return;
    const item = brands.find((b) => b.id === deleteTargetId) || { id: deleteTargetId, name: `Brand #${deleteTargetId}` };
    try {
      archiveToDrafts({
        name: item.name,
        source_page: 'brands',
        source_label: 'Brands',
        item_type: 'brand',
        original_data: item,
        image: item.image,
      });

      await api('DELETE', `/admin/brands/${deleteTargetId}`);
      showToast(`Brand "${item.name}" moved to Drafts`, 'success');
      setDeleteTargetId(null);
      refreshMasterData();
      loadBrands();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  return (
    <div>
      <div className="page-toolbar">
        <h3>Brands</h3>
        <button className="btn btn-primary" onClick={openAddModal} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <FiPlus size={15} /> Add Brand
        </button>
      </div>

      {loading ? (
        <div className="loading">
          <div className="spinner"></div>
          <p>Loading brands…</p>
        </div>
      ) : brands.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon" style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px' }}>
            <FiTag size={40} style={{ color: '#94a3b8' }} />
          </div>
          <p>No brands found</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Image</th>
                <th>Name</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {brands.map((b) => (
                <tr key={b.id}>
                  <td>
                    {b.image ? (
                      <img
                        src={resolveImg(b.image)}
                        alt={b.name}
                        className="table-img"
                      />
                    ) : (
                      <div
                        className="table-img"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#94a3b8',
                        }}
                      >
                        <FiTag size={20} />
                      </div>
                    )}
                  </td>
                  <td>
                    <strong>{b.name}</strong>
                  </td>
                  <td>
                    {b.is_active !== false ? (
                      <span className="badge badge-green">Active</span>
                    ) : (
                      <span className="badge badge-grey">Inactive</span>
                    )}
                  </td>
                  <td className="table-actions">
                    <button
                      type="button"
                      className="btn btn-sm btn-outline"
                      onClick={() => openEditModal(b)}
                      title="Edit"
                    >
                      <FiEdit2 size={13} />
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-danger"
                      onClick={() => setDeleteTargetId(b.id)}
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
        title={editingBrand ? 'Edit Brand' : 'Add Brand'}
        onSave={handleSave}
        onCancel={() => setModalOpen(false)}
        loading={saving}
      >
        <div className="form-group">
          <label>Name *</label>
          <input
            type="text"
            placeholder="Brand name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label>Image URL</label>
          <input
            type="text"
            placeholder="URL or upload image"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
          />
          <label
            className="btn btn-outline btn-sm upload-btn"
            style={{ marginTop: '6px', width: 'fit-content', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
          >
            <FiUploadCloud size={14} /> Upload
            <input
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleUploadImage}
            />
          </label>
        </div>
      </GenericModal>

      {/* CONFIRM DELETE MODAL */}
      <ConfirmModal
        isOpen={!!deleteTargetId}
        title="Delete Brand"
        message="Are you sure you want to delete this brand?"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTargetId(null)}
      />
    </div>
  );
}
