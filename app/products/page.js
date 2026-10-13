'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, resolveImg, downloadTemplate } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { mockProducts } from '@/lib/mockData';
import { archiveToDrafts } from '@/lib/drafts';
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

// Helper to sort products by latest added first (newest timestamp / highest ID)
const sortLatestFirst = (list) => {
  return [...list].sort((a, b) => {
    // 1. By created_at date descending (newest timestamp first)
    const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
    const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
    if (timeA && timeB && timeA !== timeB && !isNaN(timeA) && !isNaN(timeB)) {
      return timeB - timeA;
    }
    if (timeA && !timeB) return -1;
    if (!timeA && timeB) return 1;

    // 2. By updated_at date descending
    const updA = a.updated_at ? new Date(a.updated_at).getTime() : 0;
    const updB = b.updated_at ? new Date(b.updated_at).getTime() : 0;
    if (updA && updB && updA !== updB && !isNaN(updA) && !isNaN(updB)) {
      return updB - updA;
    }

    // 3. By numeric ID descending (higher / newer ID first)
    const idA = typeof a.id === 'number' ? a.id : parseInt(a.id, 10);
    const idB = typeof b.id === 'number' ? b.id : parseInt(b.id, 10);
    if (!isNaN(idA) && !isNaN(idB) && idA !== idB) {
      return idB - idA;
    }

    return 0;
  });
};

export default function ProductsPage() {
  const router = useRouter();
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
    setLoading(true);
    try {
      let path = `/admin/products?page=${currentPage}&limit=20`;
      if (selectedCategory) path += `&category_id=${selectedCategory}`;
      if (searchTerm.trim()) {
        path += `&search=${encodeURIComponent(searchTerm.trim())}`;
      } else if (selectedLetter !== 'ALL') {
        path += `&letter=${selectedLetter}`;
      } else {
        path += `&sort=latest&order=desc`;
      }

      let fetchedList = [];
      let totalP = 1;
      try {
        const data = await api('GET', path);
        if (data && data.products && data.products.length > 0) {
          fetchedList = data.products;
          totalP = data.pagination?.totalPages || 1;
        }
      } catch {
        // Backend offline fallback
      }

      // Read local custom products saved in browser
      let localList = [];
      if (typeof window !== 'undefined') {
        try {
          const raw = localStorage.getItem('bm_local_products');
          if (raw) localList = JSON.parse(raw);
        } catch {}
      }

      // Combine local products, fetched products, and fallback mock products
      let combined = [...localList, ...fetchedList];
      if (combined.length === 0) {
        combined = [...mockProducts];
      }

      // Deduplicate by ID
      const seen = new Set();
      let uniqueList = [];
      for (const item of combined) {
        const key = String(item.id);
        if (!seen.has(key)) {
          seen.add(key);
          uniqueList.push(item);
        }
      }

      // Filter by category if selected
      if (selectedCategory) {
        uniqueList = uniqueList.filter(
          (p) => String(p.category_id) === String(selectedCategory)
        );
      }

      // Filter by search term or letter
      if (searchTerm.trim()) {
        const q = searchTerm.trim().toLowerCase();
        uniqueList = uniqueList.filter(
          (p) =>
            (p.name || '').toLowerCase().includes(q) ||
            (p.brand_name || '').toLowerCase().includes(q) ||
            (p.sku_id || '').toLowerCase().includes(q)
        );
      } else if (selectedLetter !== 'ALL') {
        uniqueList = uniqueList.filter((p) =>
          (p.name || '').trim().toUpperCase().startsWith(selectedLetter)
        );
      } else {
        // When 'ALL' is selected: sort latest added products first (NOT alphabetical)
        uniqueList = sortLatestFirst(uniqueList);
      }

      setProducts(uniqueList);
      setTotalPages(totalP);
    } catch {
      setProducts(sortLatestFirst(mockProducts));
      setTotalPages(1);
    } finally {
      setLoading(false);
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
    router.push(`/products/add?id=${id}`);
  };

  const openVariants = (prod) => {
    router.push(`/products/add?id=${prod.id}&sheet=variants`);
  };

  const handleDeleteProduct = async () => {
    if (!deleteProductTarget) return;
    try {
      archiveToDrafts({
        name: deleteProductTarget.name,
        source_page: 'products',
        source_label: 'Products',
        item_type: 'product',
        original_data: deleteProductTarget,
        description: deleteProductTarget.description,
        images: deleteProductTarget.images || (deleteProductTarget.image ? [deleteProductTarget.image] : []),
        brand_id: deleteProductTarget.brand_id,
        category_id: deleteProductTarget.category_id,
        subcategory_id: deleteProductTarget.subcategory_id,
        gst_percent: deleteProductTarget.gst_percent,
        is_veg: deleteProductTarget.is_veg,
      });

      // Remove from local cache as well
      if (typeof window !== 'undefined') {
        try {
          const raw = localStorage.getItem('bm_local_products');
          if (raw) {
            const list = JSON.parse(raw);
            const remaining = list.filter((p) => String(p.id) !== String(deleteProductTarget.id));
            localStorage.setItem('bm_local_products', JSON.stringify(remaining));
          }
        } catch {}
      }

      await api('DELETE', `/admin/products/${deleteProductTarget.id}`).catch(() => {});
      showToast(`Product "${deleteProductTarget.name}" moved to Drafts`, 'success');
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
                    <Link
                      href={`/products/add?id=${p.id}`}
                      className="btn btn-sm btn-outline"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                    >
                      <FiEdit2 /> Edit
                    </Link>
                    <Link
                      href={`/products/add?id=${p.id}&sheet=variants`}
                      className="btn btn-sm btn-outline"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                    >
                      <FiLayers /> Variants
                    </Link>
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
