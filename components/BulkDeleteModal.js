'use client';

import { FiX, FiTrash2, FiAlertTriangle, FiBox } from 'react-icons/fi';
import { resolveImg } from '@/lib/api';

export default function BulkDeleteModal({
  isOpen,
  selectedItems = [],
  onClose,
  onConfirm,
  loading = false,
  progressText = '',
}) {
  if (!isOpen) return null;

  const count = selectedItems.length;

  return (
    <div className="modal-overlay" onClick={loading ? undefined : onClose}>
      <div
        className="modal"
        style={{ maxWidth: '520px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3 style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: '#dc2626' }}>
            <FiTrash2 /> Delete {count} Product{count > 1 ? 's' : ''}
          </h3>
          {!loading && (
            <button onClick={onClose} aria-label="Close">
              <FiX />
            </button>
          )}
        </div>

        <div className="modal-body" style={{ padding: '20px 24px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
              padding: '12px 16px',
              background: '#fef2f2',
              borderRadius: '8px',
              border: '1px solid #fee2e2',
              color: '#991b1b',
              fontSize: '13.5px',
              marginBottom: '16px',
            }}
          >
            <FiAlertTriangle style={{ fontSize: '20px', flexShrink: 0, marginTop: '2px', color: '#dc2626' }} />
            <div>
              <strong>Are you sure you want to delete {count} selected product{count > 1 ? 's' : ''}?</strong>
              <div style={{ marginTop: '4px', fontSize: '12.5px', color: '#7f1d1d' }}>
                They will be removed from all active shops and archived safely to <strong>Drafts</strong> so you can restore them anytime if needed.
              </div>
            </div>
          </div>

          <div style={{ fontSize: '13px', fontWeight: '600', marginBottom: '8px', color: 'var(--text-heading, #1e293b)' }}>
            Selected Products ({count}):
          </div>

          <div
            style={{
              maxHeight: '200px',
              overflowY: 'auto',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '8px',
              background: '#f8fafc',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}
          >
            {selectedItems.map((item) => {
              const img =
                item.images && item.images.length > 0
                  ? item.images[0]
                  : item.image || '';
              return (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '6px 8px',
                    background: '#ffffff',
                    borderRadius: '6px',
                    border: '1px solid #edf2f7',
                  }}
                >
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '4px',
                      background: '#f1f5f9',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                      flexShrink: 0,
                    }}
                  >
                    {img ? (
                      <img
                        src={resolveImg(img)}
                        alt={item.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <FiBox style={{ fontSize: '14px', color: '#94a3b8' }} />
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: '13px',
                        fontWeight: '600',
                        color: '#1e293b',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {item.name}
                    </div>
                    {item.sku_id && (
                      <div style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace' }}>
                        {item.sku_id}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {loading && (
            <div
              style={{
                marginTop: '16px',
                padding: '12px',
                background: '#f0f9ff',
                borderRadius: '8px',
                border: '1px solid #bae6fd',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                color: '#0369a1',
                fontSize: '13px',
                fontWeight: '600',
              }}
            >
              <div className="spinner" style={{ width: '18px', height: '18px', borderWidth: '2px' }} />
              <span>{progressText || 'Deleting products and archiving to Drafts...'}</span>
            </div>
          )}
        </div>

        <div className="modal-footer" style={{ padding: '14px 24px' }}>
          <button
            type="button"
            className="btn btn-outline"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={onConfirm}
            disabled={loading || count === 0}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
          >
            <FiTrash2 /> {loading ? 'Deleting...' : `Delete ${count} Product${count > 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}

