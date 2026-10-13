'use client';

import { useState } from 'react';
import { BASE, getToken, downloadTemplate } from '@/lib/api';
import { useToast } from '@/context/ToastContext';
import {
  FiUploadCloud,
  FiX,
  FiFileText,
  FiFolder,
  FiImage,
  FiCheckCircle,
  FiAlertTriangle,
  FiXCircle,
  FiUpload,
} from 'react-icons/fi';

export default function BulkUploadModal({ isOpen, onClose, onSuccess }) {
  const [excelFile, setExcelFile] = useState(null);
  const [imageFiles, setImageFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [progressText, setProgressText] = useState('');
  const [result, setResult] = useState(null); // { success, message, results, errors }

  const { showToast } = useToast();

  if (!isOpen) return null;

  const handleExcelChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setExcelFile(e.target.files[0]);
    }
  };

  const handleImagesChange = (e) => {
    if (e.target.files) {
      setImageFiles(Array.from(e.target.files));
    }
  };

  const handleSubmit = async () => {
    if (!excelFile) {
      showToast('Please select an Excel file', 'error');
      return;
    }

    setUploading(true);
    setResult(null);
    setProgressPercent(15);
    setProgressText('Uploading files…');

    try {
      const fd = new FormData();
      fd.append('excel', excelFile);
      imageFiles.forEach((file) => fd.append('images', file));

      setProgressPercent(45);
      setProgressText('Processing on server…');

      const token = getToken();
      const res = await fetch(`${BASE}/admin/bulk-upload`, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token },
        body: fd,
      });

      setProgressPercent(90);
      const data = await res.json().catch(() => ({}));
      setProgressPercent(100);

      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Bulk upload failed');
      }

      setProgressText('Complete!');
      setResult({
        success: true,
        data: data.results,
      });
      showToast('Bulk upload completed', 'success');
      if (onSuccess) onSuccess();
    } catch (err) {
      setProgressPercent(100);
      setProgressText('Failed');
      setResult({
        success: false,
        error: err.message,
      });
      showToast(err.message, 'error');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: '580px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            <FiUploadCloud /> Bulk Upload Products
          </h3>
          <button onClick={onClose} aria-label="Close">
            <FiX />
          </button>
        </div>

        <div className="modal-body">
          {/* Step 1 */}
          <div className="bulk-step">
            <div className="bulk-step-num">1</div>
            <div>
              <strong>Download the Excel template</strong>
              <br />
              <small style={{ color: 'var(--text-muted)' }}>
                Fill Products &amp; Variants sheets. Use exact SKU IDs (BM-PROD-XXXXX / BM-VAR-XXXXX).
              </small>
              <br />
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                style={{ marginTop: '8px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                onClick={downloadTemplate}
              >
                <FiFileText /> Download Template
              </button>
            </div>
          </div>

          {/* Step 2 */}
          <div className="bulk-step">
            <div className="bulk-step-num">2</div>
            <div>
              <strong>Prepare images</strong>
              <br />
              <small style={{ color: 'var(--text-muted)' }}>
                Name each image exactly as in Excel (e.g. <code>BM-PROD-00001_1.jpg</code>). Select all images together.
              </small>
            </div>
          </div>

          {/* Step 3 */}
          <div className="bulk-step">
            <div className="bulk-step-num">3</div>
            <div>
              <strong>Select Excel + Images</strong>
              <br />
              <label className="bulk-file-label" htmlFor="bulkExcelInput" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <FiFolder /> Choose Excel (.xlsx)
              </label>
              <input
                type="file"
                id="bulkExcelInput"
                accept=".xlsx"
                style={{ display: 'none' }}
                onChange={handleExcelChange}
              />
              <div className="bulk-file-name">
                {excelFile ? excelFile.name : 'No file selected'}
              </div>

              <label className="bulk-file-label" htmlFor="bulkImagesInput" style={{ marginTop: '10px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <FiImage /> Choose Images (multiple)
              </label>
              <input
                type="file"
                id="bulkImagesInput"
                accept="image/*"
                multiple
                style={{ display: 'none' }}
                onChange={handleImagesChange}
              />
              <div className="bulk-file-name">
                {imageFiles.length ? `${imageFiles.length} image(s) selected` : 'No images selected'}
              </div>
            </div>
          </div>

          {/* Progress */}
          {uploading && (
            <div className="bulk-progress">
              <div className="bulk-progress-bar">
                <div style={{ width: `${progressPercent}%`, background: 'var(--primary)' }}></div>
              </div>
              <div className="bulk-progress-text">{progressText}</div>
            </div>
          )}

          {/* Result */}
          {result && (
            <div className={`bulk-result ${result.success ? 'success' : 'error'}`}>
              {result.success ? (
                <>
                  <strong style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <FiCheckCircle color="#16a34a" /> Done!
                  </strong>
                  <br />
                  Products: {result.data?.created ?? 0} created, {result.data?.updated ?? 0} updated
                  <br />
                  Variants: {result.data?.variants_created ?? 0} created, {result.data?.variants_updated ?? 0} updated
                  {result.data?.errors?.length > 0 && (
                    <>
                      <br />
                      <br />
                      <strong style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <FiAlertTriangle color="#f59e0b" /> Warnings ({result.data.errors.length}):
                      </strong>
                      <ul>
                        {result.data.errors.slice(0, 20).map((e, idx) => (
                          <li key={idx}>{e}</li>
                        ))}
                        {result.data.errors.length > 20 && (
                          <li>…and {result.data.errors.length - 20} more</li>
                        )}
                      </ul>
                    </>
                  )}
                </>
              ) : (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <FiXCircle color="#ef4444" /> {result.error}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose} disabled={uploading}>
            Close
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={uploading || !excelFile}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <FiUpload /> {uploading ? 'Uploading…' : 'Upload Now'}
          </button>
        </div>
      </div>
    </div>
  );
}
