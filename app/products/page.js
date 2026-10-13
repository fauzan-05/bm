'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { api, resolveImg, downloadTemplate } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { mockProducts } from '@/lib/mockData';
import {
  FiPlus,
  FiUploadCloud,
  FiFileText,
  FiBox,
  FiEdit2,
  FiLayers,
  FiTrash2,
} from 'react-icons/fi';
import ProductModal from '@/components/ProductModal';
import VariantDetailModal from '@/components/VariantDetailModal';
import BulkUploadModal from '@/components/BulkUploadModal';
import ConfirmModal from '@/components/ConfirmModal';

const ALPHABET = ['ALL', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')];

export default function ProductsPage() {
  const { masterData } = useAuth();
  const { showToast } = useToast();

  const [products, setProducts] = useState(mockProducts);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedLetter, setSelectedLetter] = useState('ALL');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Modals state
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [editProductId, setEditProductId] = useState(null);

  const [variantModalOpen, setVariantModalOpen] = useState(false);
  const [variantProduct, setVariantProduct] = useState(null); // { id, name }

  const [bulkUploadOpen, setBulkUploadOpen] = useState(false);

  const [deleteProductTarget, setDeleteProductTarget] = useState(null); // { id, name }

  const searchTimerRef = useRef(null);

  const loadProducts = useCallback(async () => {
    try {
      let path = `/admin/products?page=${currentPage}&limit=20`;
      if (selectedCategory) path += `&category_id=${selectedCategory}`;
      if (searchTerm.trim()) {
        path += `&search=${encodeURIComponent(searchTerm.trim())}`;
      } else if (selectedLetter !== 'ALL') {
        path += `&letter=${selectedLetter}`;
      }

      const data = await api('GET', path);
      if (data && data.products && data.products.length > 0) {
        setProducts(data.products);
        setTotalPages(data.pagination?.totalPages || 1);
      } else {
        setProducts(mockProducts);
        setTotalPages(1);
      }
    } catch {
      // Backend offline fallback
      setProducts(mockProducts);
      setTotalPages(1);
    }
  }, [currentPage, selectedCategory, searchTerm, selectedLetter]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearchTerm(val);
    setSelectedLetter('ALL');
    setCurrentPage(1);

    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      // triggers loadProducts via searchTerm state
    }, 400);
  };

  const handleLetterSelect = (letter) => {
    setSelectedLetter(letter);
    setSearchTerm('');
    setCurrentPage(1);
  };

  const handleCategoryChange = (e) => {
    setSelectedCategory(e.target.value);
    setCurrentPage(1);
  };

  const openAddProduct = () => {
    setEditProductId(null);
    setProductModalOpen(true);
  };

  const openEditProduct = (id) => {
    setEditProductId(id);
    setProductModalOpen(true);
  };

  const openVariants = (prod) => {
    setVariantProduct(prod);
    setVariantModalOpen(true);
  };

  const handleDeleteProduct = async () => {
    if (!deleteProductTarget) return;
    try {
      await api('DELETE', `/admin/products/${deleteProductTarget.id}`);
      showToast('Product deleted successfully', 'success');
      setDeleteProductTarget(null);
      loadProducts();
    } catch (err) {
      showToast('Delete failed: ' + err.message, 'error');
    }
  };

  return (
    <div>
      {/* TOOLBAR */}
      <div className="page-toolbar">
        <div className="search-box">
          <input
            type="text"
            placeholder="Search products…"
            value={searchTerm}
            onChange={handleSearchChange}
          />
        </div>

        <div className="toolbar-filters">
          <select value={selectedCategory} onChange={handleCategoryChange}>
            <option value="">All Categories</option>
            {masterData.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <Link
          href="/products/add"
          className="btn btn-primary"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          <FiPlus /> Add Product
        </Link>
        <button
          className="btn btn-secondary"
          onClick={() => setBulkUploadOpen(true)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          <FiUploadCloud /> Bulk Upload
        </button>
        <button
          className="btn btn-secondary"
          onClick={downloadTemplate}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          <FiFileText /> Template
        </button>
      </div>

      {/* ALPHABET BAR */}
      <div className="alpha-bar">
        {ALPHABET.map((letter) => (
          <button
            key={letter}
            className={`alpha-btn ${letter === selectedLetter ? 'active' : ''}`}
            onClick={() => handleLetterSelect(letter)}
          >
            {letter}
          </button>
        ))}
      </div>

      {/* PRODUCTS LIST */}
      {loading ? (
        <div className="loading">
          <div className="spinner"></div>
          <br />
          Loading products…
        </div>
      ) : products.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">
            <FiBox />
          </div>
          <p>No products found</p>
        </div>
      ) : (
        <div className="cards-grid">
          {products.map((p) => {
            const img = p.images && p.images.length > 0 ? p.images[0] : '';
            const cat = masterData.categories.find((c) => c.id === p.category_id);

            return (
              <div key={p.id} className="product-card">
                <div className="product-card-img">
                  {img ? (
                    <img src={resolveImg(img)} alt={p.name} />
                  ) : (
                    <FiBox />
                  )}
                </div>
                <div className="product-card-body">
                  <div className="product-card-name">{p.name}</div>
                  <div className="product-card-meta">
                    {p.brand_name && (
                      <span className="badge badge-brand">{p.brand_name}</span>
                    )}
                    {cat && <span className="badge badge-grey">{cat.name}</span>}
                  </div>
                  <div className="product-card-sku">{p.sku_id || ''}</div>
                  <div className="product-card-actions">
                    <button
                      type="button"
                      className="btn btn-sm btn-outline"
                      onClick={() => openEditProduct(p.id)}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                    >
                      <FiEdit2 /> Edit
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline"
                      onClick={() => openVariants(p)}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                    >
                      <FiLayers /> Variants
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-danger"
                      onClick={() => setDeleteProductTarget(p)}
                      aria-label="Delete product"
                      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <FiTrash2 />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* PAGINATION */}
      {totalPages > 1 && (
        <div className="pagination">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
            <button
              key={page}
              className={page === currentPage ? 'active' : ''}
              onClick={() => setCurrentPage(page)}
            >
              {page}
            </button>
          ))}
        </div>
      )}

      {/* PRODUCT MODAL */}
      <ProductModal
        isOpen={productModalOpen}
        productId={editProductId}
        onClose={() => setProductModalOpen(false)}
        onSuccess={loadProducts}
      />

      {/* VARIANTS DETAIL MODAL */}
      {variantProduct && (
        <VariantDetailModal
          isOpen={variantModalOpen}
          productId={variantProduct.id}
          productName={variantProduct.name}
          onClose={() => {
            setVariantModalOpen(false);
            setVariantProduct(null);
          }}
        />
      )}

      {/* BULK UPLOAD MODAL */}
      <BulkUploadModal
        isOpen={bulkUploadOpen}
        onClose={() => setBulkUploadOpen(false)}
        onSuccess={loadProducts}
      />

      {/* CONFIRM DELETE MODAL */}
      <ConfirmModal
        isOpen={!!deleteProductTarget}
        title="Delete Product"
        message="Delete this product? This will also remove it from all shops."
        onConfirm={handleDeleteProduct}
        onCancel={() => setDeleteProductTarget(null)}
      />
    </div>
  );
}
