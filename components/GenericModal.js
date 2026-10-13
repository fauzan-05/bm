'use client';

import { FiX } from 'react-icons/fi';

export default function GenericModal({
  isOpen,
  title,
  children,
  onSave,
  onCancel,
  loading = false,
  saveText = 'Save',
  size = 'md', // sm, md, lg
}) {
  if (!isOpen) return null;

  const modalClass = size === 'lg' ? 'modal modal-lg' : size === 'sm' ? 'modal modal-sm' : 'modal';

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className={modalClass} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button onClick={onCancel} aria-label="Close">
            <FiX />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onCancel} disabled={loading}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={onSave} disabled={loading}>
            {loading ? 'Saving…' : saveText}
          </button>
        </div>
      </div>
    </div>
  );
}
