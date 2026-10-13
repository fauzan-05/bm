'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { mockMasterData } from '@/lib/mockData';
import GenericModal from '@/components/GenericModal';
import ConfirmModal from '@/components/ConfirmModal';
import { FiPlus, FiLayers, FiEdit2, FiTrash2 } from 'react-icons/fi';
import { archiveToDrafts } from '@/lib/drafts';

export default function UnitsPage() {
  const { masterData, refreshMasterData } = useAuth();
  const { showToast } = useToast();

  const [units, setUnits] = useState(masterData?.units?.length ? masterData.units : mockMasterData.units);
  const [loading, setLoading] = useState(false);

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState(null);
  const [number, setNumber] = useState('');
  const [unitType, setUnitType] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [lengthCm, setLengthCm] = useState('');
  const [widthCm, setWidthCm] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [saving, setSaving] = useState(false);

  // Deactivate modal
  const [deactivateId, setDeactivateId] = useState(null);

  const loadUnits = useCallback(async () => {
    try {
      const data = await api('GET', '/units');
      if (data && data.units && data.units.length > 0) {
        setUnits(data.units);
      } else {
        setUnits(masterData?.units?.length ? masterData.units : mockMasterData.units);
      }
    } catch {
      // Backend offline fallback
      setUnits(masterData?.units?.length ? masterData.units : mockMasterData.units);
    }
  }, [masterData]);

  useEffect(() => {
    loadUnits();
  }, [loadUnits]);

  const openAddModal = () => {
    setEditingUnit(null);
    setNumber('');
    setUnitType('');
    setWeightKg('');
    setLengthCm('');
    setWidthCm('');
    setHeightCm('');
    setModalOpen(true);
  };

  const openEditModal = (unit) => {
    setEditingUnit(unit);
    setNumber(String(unit.number || ''));
    setUnitType(unit.unit_type || '');
    setWeightKg(String(unit.weight_kg ?? ''));
    setLengthCm(String(unit.length_cm ?? ''));
    setWidthCm(String(unit.width_cm ?? ''));
    setHeightCm(String(unit.height_cm ?? ''));
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!number || !unitType.trim()) {
      showToast('Number and Unit Type are required', 'error');
      return;
    }

    setSaving(true);
    try {
      const body = {
        number: parseFloat(number) || 0,
        unit_type: unitType.trim(),
        weight_kg: parseFloat(weightKg) || 0,
        length_cm: lengthCm ? parseFloat(lengthCm) : null,
        width_cm: widthCm ? parseFloat(widthCm) : null,
        height_cm: heightCm ? parseFloat(heightCm) : null,
      };

      if (editingUnit) {
        await api('PUT', `/units/${editingUnit.id}`, body);
        showToast('Unit updated', 'success');
      } else {
        await api('POST', '/units', body);
        showToast('Unit created', 'success');
      }

      setModalOpen(false);
      refreshMasterData();
      loadUnits();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async () => {
    if (!deactivateId) return;
    const item = units.find((u) => u.id === deactivateId) || { id: deactivateId, number: deactivateId, unit_type: 'Unit' };
    try {
      archiveToDrafts({
        name: `${item.number} ${item.unit_type || ''}`.trim(),
        source_page: 'units',
        source_label: 'Units',
        item_type: 'unit',
        original_data: item,
        description: `Weight: ${item.weight_kg ?? 0}kg • Dimensions: ${item.length_cm ?? '-'}x${item.width_cm ?? '-'}x${item.height_cm ?? '-'}cm`,
      });

      await api('DELETE', `/units/${deactivateId}`).catch(() => {});
      showToast(`Unit "${item.number} ${item.unit_type || ''}" moved to Drafts`, 'success');
      setDeactivateId(null);
      refreshMasterData();
      loadUnits();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  return (
    <div>
      <div className="page-toolbar">
        <h3>Product Units</h3>
        <button className="btn btn-primary" onClick={openAddModal} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <FiPlus size={15} /> Add Unit
        </button>
      </div>

      {loading ? (
        <div className="loading">
          <div className="spinner"></div>
          <p>Loading units…</p>
        </div>
      ) : units.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon" style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px' }}>
            <FiLayers size={40} style={{ color: '#94a3b8' }} />
          </div>
          <p>No units found</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Display Name</th>
                <th>Number</th>
                <th>Type</th>
                <th>Weight (kg)</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {units.map((u) => (
                <tr key={u.id}>
                  <td>
                    <strong>{u.display_name}</strong>
                  </td>
                  <td>{String(u.number || '')}</td>
                  <td>{u.unit_type || ''}</td>
                  <td>{u.weight_kg ?? '—'}</td>
                  <td>
                    {u.is_active !== false ? (
                      <span className="badge badge-green">Active</span>
                    ) : (
                      <span className="badge badge-grey">Inactive</span>
                    )}
                  </td>
                  <td className="table-actions">
                    <button
                      type="button"
                      className="btn btn-sm btn-outline"
                      onClick={() => openEditModal(u)}
                      title="Edit"
                    >
                      <FiEdit2 size={13} />
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-danger"
                      onClick={() => setDeactivateId(u.id)}
                      title="Deactivate"
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
        title={editingUnit ? 'Edit Unit' : 'Add Unit'}
        onSave={handleSave}
        onCancel={() => setModalOpen(false)}
        loading={saving}
      >
        <div className="form-row">
          <div className="form-group">
            <label>Number *</label>
            <input
              type="number"
              placeholder="e.g. 1, 500"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>Unit Type *</label>
            <input
              type="text"
              placeholder="kg, g, L, ml, pcs…"
              value={unitType}
              onChange={(e) => setUnitType(e.target.value)}
            />
          </div>
        </div>

        <div className="form-row" style={{ marginTop: '10px' }}>
          <div className="form-group">
            <label>Weight (kg) *</label>
            <input
              type="number"
              step="0.001"
              placeholder="Weight in kg"
              value={weightKg}
              onChange={(e) => setWeightKg(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>Length (cm)</label>
            <input
              type="number"
              step="0.1"
              placeholder="Optional"
              value={lengthCm}
              onChange={(e) => setLengthCm(e.target.value)}
            />
          </div>
        </div>

        <div className="form-row" style={{ marginTop: '10px' }}>
          <div className="form-group">
            <label>Width (cm)</label>
            <input
              type="number"
              step="0.1"
              placeholder="Optional"
              value={widthCm}
              onChange={(e) => setWidthCm(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>Height (cm)</label>
            <input
              type="number"
              step="0.1"
              placeholder="Optional"
              value={heightCm}
              onChange={(e) => setHeightCm(e.target.value)}
            />
          </div>
        </div>
      </GenericModal>

      {/* CONFIRM DEACTIVATE MODAL */}
      <ConfirmModal
        isOpen={!!deactivateId}
        title="Deactivate Unit"
        message="Deactivate this unit?"
        confirmText="Deactivate"
        onConfirm={handleDeactivate}
        onCancel={() => setDeactivateId(null)}
      />
    </div>
  );
}
