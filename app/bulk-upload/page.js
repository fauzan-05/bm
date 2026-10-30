'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { BASE, getToken, downloadTemplate, api, resolveImg, bulkDeleteProducts } from '@/lib/api';
import { archiveToDrafts, archiveManyToDrafts } from '@/lib/drafts';
import { useToast } from '@/context/ToastContext';
import BulkDeleteModal from '@/components/BulkDeleteModal';
import ConfirmModal from '@/components/ConfirmModal';
import {
  FiUploadCloud,
  FiFileText,
  FiFolder,
  FiImage,
  FiCheckCircle,
  FiAlertTriangle,
  FiXCircle,
  FiUpload,
  FiDownload,
  FiArrowRight,
  FiBox,
  FiLayers,
  FiInfo,
  FiTrash2,
  FiSearch,
  FiRefreshCw,
  FiEdit2,
} from 'react-icons/fi';

export default function BulkUploadPage() {
  const [excelFile, setExcelFile] = useState(null);
  const [imageFiles, setImageFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [progressText, setProgressText] = useState('');
  const [result, setResult] = useState(null);

  const { showToast } = useToast();

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
      showToast('Please choose an Excel file to upload', 'error');
      return;
    }

    setUploading(true);
    setResult(null);
    setProgressPercent(15);
    setProgressText('Uploading files to server...');

    try {
      const fd = new FormData();
      fd.append('excel', excelFile);
      imageFiles.forEach((file) => fd.append('images', file));

      setProgressPercent(45);
      setProgressText('Optimizing images and updating catalog in database...');

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

      setProgressText('Upload Complete!');
      setResult({
        success: true,
        data: data.results,
      });
      showToast('Master Catalog Bulk Upload completed successfully!', 'success');
      loadProducts();
    } catch (err) {
      setProgressPercent(100);
      setProgressText('Upload Failed');
      setResult({
        success: false,
        error: err.message,
      });
      showToast(err.message, 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleReset = () => {
    setExcelFile(null);
    setImageFiles([]);
    setResult(null);
    setProgressPercent(0);
    setProgressText('');
  };

  // Product management & bulk delete states
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkDeleteModalOpen, setBulkDeleteModalOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkDeleteProgress, setBulkDeleteProgress] = useState('');
  const [singleDeleteTarget, setSingleDeleteTarget] = useState(null);

  const loadProducts = useCallback(async () => {
    setLoadingProducts(true);
    try {
      let path = '/admin/products?page=1&limit=60&sort=latest&order=desc';
      if (searchTerm.trim()) {
        path += `&search=${encodeURIComponent(searchTerm.trim())}`;
      }
      const data = await api('GET', path);
      setProducts(Array.isArray(data?.products) ? data.products : []);
    } catch {
      setProducts([]);
    } finally {
      setLoadingProducts(false);
    }
  }, [searchTerm]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const isAllSelected =
    products.length > 0 && products.every((p) => selectedIds.some((id) => String(id) === String(p.id)));

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(products.map((p) => p.id));
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds((prev) =>
      prev.some((x) => String(x) === String(id))
        ? prev.filter((x) => String(x) !== String(id))
        : [...prev, id]
    );
  };

  const clearSelection = () => {
    setSelectedIds([]);
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    setBulkDeleting(true);
    setBulkDeleteProgress(`Archiving ${selectedIds.length} products to Drafts...`);

    try {
      const selectedProducts = products.filter((p) =>
        selectedIds.some((id) => String(id) === String(p.id))
      );
      archiveManyToDrafts(selectedProducts);

      setBulkDeleteProgress(`Deleting ${selectedIds.length} products...`);
      const res = await bulkDeleteProducts(selectedIds);

      showToast(
        `Successfully deleted ${res.count || selectedIds.length} products and moved to Drafts`,
        'success'
      );
      setSelectedIds([]);
      setBulkDeleteModalOpen(false);
      loadProducts();
    } catch (err) {
      showToast('Bulk delete failed: ' + err.message, 'error');
    } finally {
      setBulkDeleting(false);
      setBulkDeleteProgress('');
    }
  };

  const handleSingleDelete = async () => {
    if (!singleDeleteTarget) return;
    try {
      archiveToDrafts(singleDeleteTarget);
      await api('DELETE', `/admin/products/${singleDeleteTarget.id}`);
      showToast(`Product "${singleDeleteTarget.name}" moved to Drafts`, 'success');
      setSingleDeleteTarget(null);
      loadProducts();
    } catch (err) {
      showToast('Delete failed: ' + err.message, 'error');
    }
  };

  return (
    <div style={{ maxWidth: '980px', margin: '0 auto', paddingBottom: '40px' }}>
      {/* PAGE HEADER */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-color, #1e293b)', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FiUploadCloud style={{ color: 'var(--primary, #0ea5e9)' }} />
            Bulk Upload Master Catalog
          </h1>
          <p style={{ color: 'var(--text-muted, #64748b)', margin: '4px 0 0', fontSize: '14px' }}>
            Upload thousands of products and variant images simultaneously into the BetterMend master database.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={downloadTemplate}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
          >
            <FiDownload /> Master Catalog Template
          </button>
          <a
            href="http://localhost:2456/stock-sync/vendor_stock_sync_sample_template.xlsx"
            download="vendor_stock_sync_sample_template.xlsx"
            className="btn btn-outline"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
          >
            <FiFileText /> Vendor Stock Sync Sample
          </a>
          <Link
            href="/products"
            className="btn btn-outline"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
          >
            <FiBox /> View Products
          </Link>
        </div>
      </div>

      {/* 3 STEPS GUIDANCE CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div className="card" style={{ padding: '16px 20px', borderRadius: '12px', borderLeft: '4px solid #0ea5e9' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <span style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#e0f2fe', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '13px' }}>1</span>
            <strong style={{ fontSize: '15px' }}>Download Template</strong>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-muted, #64748b)', margin: 0 }}>
            Click Download Template to get the pre-populated Excel workbook with Products, Variants, and Categories references.
          </p>
        </div>

        <div className="card" style={{ padding: '16px 20px', borderRadius: '12px', borderLeft: '4px solid #8b5cf6' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <span style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#ede9fe', color: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '13px' }}>2</span>
            <strong style={{ fontSize: '15px' }}>Prepare Images</strong>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-muted, #64748b)', margin: 0 }}>
            Name each image exactly as referenced in Excel (e.g. <code>BM-PROD-00001_1.jpg</code>). Supported formats: JPG, PNG, WebP.
          </p>
        </div>

        <div className="card" style={{ padding: '16px 20px', borderRadius: '12px', borderLeft: '4px solid #10b981' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <span style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#d1fae5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '13px' }}>3</span>
            <strong style={{ fontSize: '15px' }}>Upload &amp; Auto-Sync</strong>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-muted, #64748b)', margin: 0 }}>
            Select your Excel and all photos together. Sharp auto-compresses and uploads photos to Cloudinary instantly.
          </p>
        </div>
      </div>

      {/* UPLOAD FORM CARD */}
      <div className="card" style={{ padding: '28px', borderRadius: '16px', marginBottom: '24px' }}>
        <h3 style={{ fontSize: '17px', fontWeight: '600', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FiFolder style={{ color: 'var(--primary)' }} /> Select Files for Bulk Upload
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginBottom: '24px' }}>
          {/* EXCEL FILE PICKER */}
          <div style={{ border: '2px dashed #cbd5e1', borderRadius: '12px', padding: '24px', textAlign: 'center', background: excelFile ? '#f0fdf4' : '#f8fafc', borderColor: excelFile ? '#86efac' : '#cbd5e1' }}>
            <FiFileText style={{ fontSize: '36px', color: excelFile ? '#16a34a' : '#64748b', marginBottom: '10px' }} />
            <h4 style={{ margin: '0 0 6px', fontSize: '15px' }}>Step 1: Excel Workbook</h4>
            <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 16px' }}>
              Select the completed <code>.xlsx</code> or <code>.xls</code> template
            </p>

            <label className="btn btn-secondary btn-sm" htmlFor="bulkExcelPageInput" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <FiFolder /> {excelFile ? 'Change Excel' : 'Choose Excel (.xlsx)'}
            </label>
            <input
              type="file"
              id="bulkExcelPageInput"
              accept=".xlsx,.xls"
              style={{ display: 'none' }}
              onChange={handleExcelChange}
              disabled={uploading}
            />

            <div style={{ marginTop: '12px', fontSize: '13px', fontWeight: '500', color: excelFile ? '#15803d' : '#94a3b8' }}>
              {excelFile ? `✓ ${excelFile.name} (${(excelFile.size / 1024).toFixed(1)} KB)` : 'No file chosen yet'}
            </div>
          </div>

          {/* IMAGES PICKER */}
          <div style={{ border: '2px dashed #cbd5e1', borderRadius: '12px', padding: '24px', textAlign: 'center', background: imageFiles.length > 0 ? '#f0fdf4' : '#f8fafc', borderColor: imageFiles.length > 0 ? '#86efac' : '#cbd5e1' }}>
            <FiImage style={{ fontSize: '36px', color: imageFiles.length > 0 ? '#16a34a' : '#64748b', marginBottom: '10px' }} />
            <h4 style={{ margin: '0 0 6px', fontSize: '15px' }}>Step 2: Product Photos</h4>
            <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 16px' }}>
              Select up to 500 images referenced in the Excel sheet
            </p>

            <label className="btn btn-secondary btn-sm" htmlFor="bulkImagesPageInput" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <FiImage /> {imageFiles.length > 0 ? 'Change Images' : 'Choose Images (Multiple)'}
            </label>
            <input
              type="file"
              id="bulkImagesPageInput"
              accept="image/*"
              multiple
              style={{ display: 'none' }}
              onChange={handleImagesChange}
              disabled={uploading}
            />

            <div style={{ marginTop: '12px', fontSize: '13px', fontWeight: '500', color: imageFiles.length > 0 ? '#15803d' : '#94a3b8' }}>
              {imageFiles.length > 0 ? `✓ ${imageFiles.length} photo(s) selected` : '0 photos selected (Optional if images already hosted)'}
            </div>
          </div>
        </div>

        {/* PROGRESS BAR */}
        {uploading && (
          <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '12px', marginBottom: '20px', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: '600', marginBottom: '8px' }}>
              <span>{progressText}</span>
              <span>{progressPercent}%</span>
            </div>
            <div style={{ height: '8px', width: '100%', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: `${progressPercent}%`,
                  background: 'var(--primary, #0ea5e9)',
                  transition: 'width 0.4s ease',
                }}
              />
            </div>
          </div>
        )}

        {/* RESULT BOX */}
        {result && (
          <div
            style={{
              padding: '20px',
              borderRadius: '12px',
              marginBottom: '20px',
              background: result.success ? '#f0fdf4' : '#fef2f2',
              border: `1px solid ${result.success ? '#bbf7d0' : '#fecaca'}`,
            }}
          >
            {result.success ? (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#16a34a', fontWeight: '700', fontSize: '16px', marginBottom: '12px' }}>
                  <FiCheckCircle style={{ fontSize: '20px' }} />
                  Bulk Upload Succeeded!
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '12px' }}>
                  <div style={{ background: '#ffffff', padding: '12px', borderRadius: '8px', border: '1px solid #dcfce7' }}>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>Products Created</div>
                    <div style={{ fontSize: '20px', fontWeight: '700', color: '#15803d' }}>{result.data?.created ?? 0}</div>
                  </div>
                  <div style={{ background: '#ffffff', padding: '12px', borderRadius: '8px', border: '1px solid #dcfce7' }}>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>Products Updated</div>
                    <div style={{ fontSize: '20px', fontWeight: '700', color: '#0369a1' }}>{result.data?.updated ?? 0}</div>
                  </div>
                  <div style={{ background: '#ffffff', padding: '12px', borderRadius: '8px', border: '1px solid #dcfce7' }}>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>Variants Created</div>
                    <div style={{ fontSize: '20px', fontWeight: '700', color: '#7c3aed' }}>{result.data?.variants_created ?? 0}</div>
                  </div>
                  <div style={{ background: '#ffffff', padding: '12px', borderRadius: '8px', border: '1px solid #dcfce7' }}>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>Variants Updated</div>
                    <div style={{ fontSize: '20px', fontWeight: '700', color: '#0f766e' }}>{result.data?.variants_updated ?? 0}</div>
                  </div>
                </div>

                {result.data?.errors?.length > 0 && (
                  <div style={{ marginTop: '16px', padding: '12px', background: '#fffbeb', borderRadius: '8px', border: '1px solid #fde68a' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#b45309', fontWeight: '600', fontSize: '14px', marginBottom: '6px' }}>
                      <FiAlertTriangle /> Warnings ({result.data.errors.length}):
                    </div>
                    <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: '#92400e' }}>
                      {result.data.errors.slice(0, 10).map((errItem, idx) => (
                        <li key={idx}>{errItem}</li>
                      ))}
                      {result.data.errors.length > 10 && (
                        <li>...and {result.data.errors.length - 10} more warnings</li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ color: '#dc2626', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <FiXCircle style={{ fontSize: '22px', flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <strong style={{ fontSize: '15px' }}>Upload Error:</strong>
                  <div style={{ fontSize: '14px', marginTop: '4px' }}>{result.error}</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* SUBMIT ACTIONS */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px' }}>
          {(excelFile || imageFiles.length > 0 || result) && (
            <button
              type="button"
              className="btn btn-outline"
              onClick={handleReset}
              disabled={uploading}
            >
              Clear
            </button>
          )}

          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={uploading || !excelFile}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 24px', fontSize: '15px' }}
          >
            <FiUpload /> {uploading ? 'Uploading & Processing...' : 'Start Bulk Upload'}
          </button>
        </div>
      </div>

      {/* MANAGE BULK UPLOADED PRODUCTS SECTION */}
      <div className="card" style={{ padding: '24px', borderRadius: '16px', marginTop: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: '700', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FiBox style={{ color: 'var(--primary, #0ea5e9)' }} />
              Manage Master Catalog Products
            </h3>
            <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0' }}>
              Select all or individual products uploaded via bulk upload, and delete them in bulk.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder="Search products / SKU..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  padding: '7px 12px 7px 32px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                  width: '210px',
                }}
              />
              <FiSearch style={{ position: 'absolute', left: '10px', top: '10px', color: '#94a3b8', fontSize: '14px' }} />
            </div>

            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={loadProducts}
              title="Refresh list"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
            >
              <FiRefreshCw className={loadingProducts ? 'spin' : ''} />
            </button>
          </div>
        </div>

        {/* SELECTION ACTION BAR */}
        {products.length > 0 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
              padding: '10px 16px',
              marginBottom: '16px',
              background: selectedIds.length > 0 ? '#eff6ff' : '#f8fafc',
              borderRadius: '10px',
              border: `1.5px solid ${selectedIds.length > 0 ? '#93c5fd' : '#e2e8f0'}`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <label
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '13.5px',
                  margin: 0,
                  userSelect: 'none',
                }}
              >
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  onChange={toggleSelectAll}
                  style={{ width: '17px', height: '17px', cursor: 'pointer', accentColor: '#0ea5e9' }}
                />
                <span>{isAllSelected ? 'Deselect All' : 'Select All'} ({products.length})</span>
              </label>

              {selectedIds.length > 0 && (
                <span
                  style={{
                    padding: '2px 10px',
                    borderRadius: '12px',
                    background: '#dbeafe',
                    color: '#1d4ed8',
                    fontSize: '12px',
                    fontWeight: '700',
                  }}
                >
                  ✓ {selectedIds.length} Selected
                </span>
              )}
            </div>

            {selectedIds.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={clearSelection}
                  style={{ fontSize: '12.5px' }}
                >
                  Clear Selection
                </button>
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={() => setBulkDeleteModalOpen(true)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12.5px' }}
                >
                  <FiTrash2 /> Delete Selected ({selectedIds.length})
                </button>
              </div>
            )}
          </div>
        )}

        {/* PRODUCTS TABLE / LIST */}
        {loadingProducts ? (
          <div style={{ textAlign: 'center', padding: '32px', color: '#64748b' }}>
            <div className="spinner" style={{ margin: '0 auto 10px' }} />
            Loading catalog products...
          </div>
        ) : products.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px', color: '#94a3b8' }}>
            <FiBox style={{ fontSize: '32px', marginBottom: '8px' }} />
            <div>No products found</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', fontSize: '13px' }}>
              <thead>
                <tr>
                  <th style={{ width: '40px', textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      onChange={toggleSelectAll}
                      style={{ cursor: 'pointer', accentColor: '#0ea5e9' }}
                    />
                  </th>
                  <th style={{ width: '56px' }}>Image</th>
                  <th>Name</th>
                  <th>SKU</th>
                  <th>Brand</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => {
                  const isSelected = selectedIds.some((id) => String(id) === String(p.id));
                  const img = p.images && p.images.length > 0 ? p.images[0] : (p.image || '');

                  return (
                    <tr
                      key={p.id}
                      style={{
                        background: isSelected ? '#f0f9ff' : undefined,
                        transition: 'background 0.15s ease',
                      }}
                    >
                      <td style={{ textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(p.id)}
                          style={{ cursor: 'pointer', accentColor: '#0ea5e9' }}
                        />
                      </td>
                      <td>
                        <div
                          style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '6px',
                            background: '#f1f5f9',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            overflow: 'hidden',
                          }}
                        >
                          {img ? (
                            <img
                              src={resolveImg(img)}
                              alt={p.name}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          ) : (
                            <FiBox style={{ color: '#94a3b8' }} />
                          )}
                        </div>
                      </td>
                      <td>
                        <strong>{p.name}</strong>
                      </td>
                      <td>
                        <code style={{ fontSize: '11.5px' }}>{p.sku_id || '—'}</code>
                      </td>
                      <td>
                        {p.brand_name ? (
                          <span className="badge badge-brand">{p.brand_name}</span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <Link
                            href={`/products/add?id=${p.id}`}
                            className="btn btn-sm btn-outline"
                            title="Edit"
                            style={{ padding: '4px 8px' }}
                          >
                            <FiEdit2 />
                          </Link>
                          <button
                            type="button"
                            className="btn btn-sm btn-danger"
                            onClick={() => setSingleDeleteTarget(p)}
                            title="Delete"
                            style={{ padding: '4px 8px' }}
                          >
                            <FiTrash2 />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* BULK DELETE CONFIRMATION MODAL */}
      <BulkDeleteModal
        isOpen={bulkDeleteModalOpen}
        selectedItems={products.filter((p) =>
          selectedIds.some((id) => String(id) === String(p.id))
        )}
        onClose={() => !bulkDeleting && setBulkDeleteModalOpen(false)}
        onConfirm={handleBulkDelete}
        loading={bulkDeleting}
        progressText={bulkDeleteProgress}
      />

      {/* SINGLE DELETE CONFIRM MODAL */}
      <ConfirmModal
        isOpen={!!singleDeleteTarget}
        title="Delete Product"
        message={`Delete "${singleDeleteTarget?.name}"? It will be removed from catalog and moved to Drafts.`}
        onConfirm={handleSingleDelete}
        onCancel={() => setSingleDeleteTarget(null)}
      />
    </div>
  );
}

