'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { api, resolveImg } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { getDrafts } from '@/lib/drafts';
import {
  FiPlus,
  FiBox,
  FiFolder,
  FiTag,
  FiLayers,
  FiArrowUpRight,
  FiCheck,
  FiAlertTriangle,
  FiFileText,
  FiRefreshCw,
  FiPackage,
  FiMaximize2,
} from 'react-icons/fi';
import ProductModal from '@/components/ProductModal';
import VariantDetailModal from '@/components/VariantDetailModal';

export default function OverviewDashboardPage() {
  const { user, masterData, refreshMasterData } = useAuth();
  const { showToast } = useToast();

  const [products, setProducts] = useState([]);
  const [totalProducts, setTotalProducts] = useState(0);
  const [draftsCount, setDraftsCount] = useState(0);
  const [unsyncedCount, setUnsyncedCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [editProductId, setEditProductId] = useState(null);

  const [variantModalOpen, setVariantModalOpen] = useState(false);
  const [variantProduct, setVariantProduct] = useState(null);

  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch recent products and stock sync unsynced count in parallel
      const [prodRes, syncRes] = await Promise.allSettled([
        api('GET', '/admin/products?page=1&limit=6&sort=latest'),
        api('GET', '/stock-sync/unsynced-products'),
      ]);

      if (prodRes.status === 'fulfilled') {
        const data = prodRes.value;
        const rows = Array.isArray(data?.products) ? data.products : [];
        setProducts(rows);

        // Robust total extraction: backend returns pagination.totalCount
        const total =
          data?.pagination?.totalCount ??
          data?.pagination?.total ??
          data?.pagination?.totalItems ??
          data?.total ??
          rows.length;
        setTotalProducts(total);
      } else {
        setProducts([]);
        setTotalProducts(0);
      }

      if (syncRes.status === 'fulfilled') {
        const syncData = syncRes.value;
        const count =
          typeof syncData?.count === 'number'
            ? syncData.count
            : Array.isArray(syncData?.unsynced_products)
            ? syncData.unsynced_products.length
            : 0;
        setUnsyncedCount(count);
      }

      // Check drafts count in localStorage
      try {
        const d = getDrafts();
        setDraftsCount(Array.isArray(d) ? d.length : 0);
      } catch {
        setDraftsCount(0);
      }
    } catch (err) {
      console.warn('Dashboard load error:', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Greeting
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const adminName = user?.name ? user.name.split(' ')[0] : 'Admin';

  // Date formatting
  const todayFormatted = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div>
      {/* ── GREETING & TOP ACTION ── */}
      <div className="dashboard-header">
        <div className="dashboard-title-wrap">
          <h1>
            {greeting}, {adminName} !
          </h1>
          <p>
            {todayFormatted} &nbsp;•&nbsp; Catalog overview from backend
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => {
              loadDashboardData();
              if (refreshMasterData) refreshMasterData();
            }}
            title="Refresh dashboard data"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <FiRefreshCw className={loading ? 'spin' : ''} /> Refresh
          </button>
          <button
            className="dashboard-action-btn"
            onClick={() => {
              setEditProductId(null);
              setProductModalOpen(true);
            }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <FiPlus /> New Product
          </button>
        </div>
      </div>

      {/* ── UNSYNCED STOCK BARCODE ALERT BANNER ── */}
      {unsyncedCount > 0 && (
        <div
          style={{
            background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
            border: '1px solid #fde68a',
            borderRadius: '12px',
            padding: '12px 18px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              style={{
                background: '#fef3c7',
                padding: '8px',
                borderRadius: '8px',
                color: '#d97706',
                display: 'flex',
              }}
            >
              <FiAlertTriangle size={20} />
            </span>
            <div>
              <strong style={{ color: '#92400e', fontSize: '14px' }}>
                {unsyncedCount} Vendor Product{unsyncedCount > 1 ? 's' : ''} Require Barcode Sync
              </strong>
              <p style={{ margin: '2px 0 0', fontSize: '12.5px', color: '#b45309' }}>
                Vendor bulk uploads contain barcodes not matched with the Admin Master Catalog. Link them to activate inventory.
              </p>
            </div>
          </div>
          <Link
            href="/stock-management"
            className="btn btn-sm btn-primary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
          >
            <FiPackage /> Resolve in Stock Management &rarr;
          </Link>
        </div>
      )}

      {/* ── 4 TOP METRIC CARDS ── */}
      <div className="metrics-grid">
        {/* Card 1: Total Products */}
        <div className="metric-card">
          <div className="metric-card-top">
            <div className="metric-card-header">
              <span className="metric-card-icon">
                <FiBox />
              </span>
              <span>Total Products</span>
            </div>
            <Link href="/products" className="badge badge-brand" style={{ fontSize: '11px', textDecoration: 'none' }}>
              View All &rarr;
            </Link>
          </div>
          <div className="metric-card-body">
            <div className="metric-card-value-wrap">
              <div className="metric-card-value">
                {totalProducts ? totalProducts.toLocaleString() : 0}
                <span className="metric-card-unit">items</span>
              </div>
              <div className="metric-card-subtext" style={{ marginTop: '6px' }}>
                {draftsCount > 0 ? `${draftsCount} drafts pending • ` : ''}Active Master Catalog
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Categories */}
        <div className="metric-card">
          <div className="metric-card-top">
            <div className="metric-card-header">
              <span className="metric-card-icon">
                <FiFolder />
              </span>
              <span>Categories</span>
            </div>
            <Link href="/categories" className="badge badge-brand" style={{ fontSize: '11px', textDecoration: 'none' }}>
              Manage &rarr;
            </Link>
          </div>
          <div className="metric-card-body">
            <div className="metric-card-value-wrap">
              <div className="metric-card-value">
                {masterData.categories.length}
                <span className="metric-card-unit">categories</span>
              </div>
              <div className="metric-card-subtext" style={{ marginTop: '6px' }}>
                {masterData.mainCats.length} main • {masterData.subcats.length} subcategories
              </div>
            </div>
          </div>
        </div>

        {/* Card 3: Brand Partners */}
        <div className="metric-card">
          <div className="metric-card-top">
            <div className="metric-card-header">
              <span className="metric-card-icon">
                <FiTag />
              </span>
              <span>Registered Brands</span>
            </div>
            <Link href="/brands" className="badge badge-brand" style={{ fontSize: '11px', textDecoration: 'none' }}>
              Brands &rarr;
            </Link>
          </div>
          <div className="metric-card-body">
            <div className="metric-card-value-wrap">
              <div className="metric-card-value">
                {masterData.brands.length}
                <span className="metric-card-unit">brands</span>
              </div>
              <div className="metric-card-subtext" style={{ marginTop: '6px' }}>
                From backend catalog
              </div>
            </div>
          </div>
        </div>

        {/* Card 4: Inventory Units & Specs */}
        <div className="metric-card">
          <div className="metric-card-top">
            <div className="metric-card-header">
              <span className="metric-card-icon">
                <FiLayers />
              </span>
              <span>Units &amp; Sizes</span>
            </div>
            <Link href="/units" className="badge badge-brand" style={{ fontSize: '11px', textDecoration: 'none' }}>
              Units &rarr;
            </Link>
          </div>
          <div className="metric-card-body">
            <div className="metric-card-value-wrap">
              <div className="metric-card-value">
                {masterData.units.length}
                <span className="metric-card-unit">units</span>
              </div>
              <div className="metric-card-subtext" style={{ marginTop: '6px' }}>
                {masterData.sizes.length} sizes • {masterData.colors.length} color swatches
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── MIDDLE GRID (RECENT PRODUCTS LIST) ── */}
      <div className="dashboard-middle-grid">
        <div className="dash-card">
          <div className="dash-card-header">
            <div>
              <h2 className="dash-card-title">Recent Catalog Products</h2>
              <p style={{ fontSize: '12px', color: 'var(--text-light)', margin: '2px 0 0' }}>
                Latest items added to master catalog
              </p>
            </div>
            <Link href="/products" className="dash-card-link">
              <span>View All ({totalProducts.toLocaleString()})</span>
              <FiArrowUpRight />
            </Link>
          </div>

          <div className="appointment-list">
            {loading ? (
              <div className="loading" style={{ padding: '24px' }}>
                <div className="spinner"></div>
              </div>
            ) : products.length === 0 ? (
              <div className="empty-state" style={{ padding: '24px' }}>
                <p>No products added yet</p>
              </div>
            ) : (
              products.map((p) => {
                const img =
                  p.images && p.images[0]
                    ? p.images[0]
                    : p.image || p.imageUrl || p.image_url || '';
                const cat = masterData.categories.find((c) => c.id === p.category_id);

                return (
                  <div key={p.id} className="appointment-card">
                    <div className="appointment-avatar">
                      {img ? (
                        <img src={resolveImg(img)} alt={p.name} />
                      ) : (
                        <FiBox />
                      )}
                    </div>

                    <div className="appointment-info">
                      <div className="appointment-name">{p.name}</div>
                      <div className="appointment-meta">
                        {p.brand_name && (
                          <span className="badge badge-brand">{p.brand_name}</span>
                        )}
                        {cat && (
                          <span className="badge badge-grey">{cat.name}</span>
                        )}
                        {p.is_veg !== undefined && (
                          <span style={{ fontSize: '11px', color: p.is_veg ? '#16a34a' : '#dc2626', fontWeight: '600' }}>
                            {p.is_veg ? '• Veg' : '• Non-Veg'}
                          </span>
                        )}
                      </div>
                      <div className="appointment-date">
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <FiTag /> SKU: {p.sku_id || '—'}
                        </span>
                      </div>
                    </div>

                    <div className="appointment-actions">
                      <button
                        className="btn-pill-primary"
                        onClick={() => {
                          setEditProductId(p.id);
                          setProductModalOpen(true);
                        }}
                      >
                        Edit
                      </button>
                      <button
                        className="btn-pill-outline"
                        onClick={() => {
                          setVariantProduct(p);
                          setVariantModalOpen(true);
                        }}
                      >
                        Variants
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* ── BOTTOM ROW (3 WIDGETS) ── */}
      <div className="dashboard-bottom-grid">
        {/* Widget 1: Categories Health */}
        <div className="dash-card">
          <div className="dash-card-header">
            <h2 className="dash-card-title">Main Categories Status</h2>
            <Link href="/categories" className="dash-card-link">
              <span>View all</span>
              <FiArrowUpRight />
            </Link>
          </div>
          <div>
            {masterData.mainCats.slice(0, 4).map((mc) => (
              <div key={mc.id} className="report-item">
                <span className="report-item-title">{mc.title}</span>
                {mc.three_shop_restriction ? (
                  <span className="badge badge-brand">3-Shop Restriction</span>
                ) : (
                  <span className="badge badge-green">Active</span>
                )}
              </div>
            ))}
            {masterData.mainCats.length === 0 && (
              <p style={{ color: 'var(--text-light)', fontSize: '12px' }}>
                No main categories configured
              </p>
            )}
          </div>
        </div>

        {/* Widget 2: Catalog Notifications & Synchronization Health */}
        <div className="dash-card">
          <div className="dash-card-header">
            <h2 className="dash-card-title">Catalog Health &amp; Activity</h2>
            <span className="badge badge-green" style={{ fontSize: '10px' }}>
              Live
            </span>
          </div>
          <div>
            {/* Unsynced Barcodes Status */}
            {unsyncedCount > 0 ? (
              <div className="report-item">
                <div>
                  <div
                    className="report-item-title"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      color: '#b45309',
                      fontWeight: '700',
                    }}
                  >
                    <FiAlertTriangle style={{ color: '#d97706' }} /> Vendor Barcode Mismatches
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-light)' }}>
                    {unsyncedCount} uploaded item{unsyncedCount > 1 ? 's' : ''} require master catalog mapping
                  </div>
                </div>
                <Link href="/stock-management" className="badge badge-brand" style={{ textDecoration: 'none' }}>
                  Review
                </Link>
              </div>
            ) : (
              <div className="report-item">
                <div>
                  <div className="report-item-title" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <FiCheck style={{ color: '#10b981' }} /> Vendor Stock Sync
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-light)' }}>
                    All uploaded vendor barcodes synced
                  </div>
                </div>
                <span className="badge badge-green">Synced</span>
              </div>
            )}

            {/* Drafts Status */}
            {draftsCount > 0 ? (
              <div className="report-item">
                <div>
                  <div className="report-item-title" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <FiFileText style={{ color: '#6366f1' }} /> Pending Product Drafts
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-light)' }}>
                    {draftsCount} item{draftsCount > 1 ? 's' : ''} saved locally ready to publish
                  </div>
                </div>
                <Link href="/drafts" className="badge badge-grey" style={{ textDecoration: 'none' }}>
                  Drafts ({draftsCount})
                </Link>
              </div>
            ) : (
              <div className="report-item">
                <div>
                  <div className="report-item-title" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <FiBox style={{ color: '#0ea5e9' }} /> Master Catalog Status
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-light)' }}>
                    {totalProducts.toLocaleString()} products active &amp; healthy
                  </div>
                </div>
                <span className="badge badge-green">Active</span>
              </div>
            )}

            {/* Brands Status */}
            <div className="report-item">
              <div>
                <div className="report-item-title" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <FiTag style={{ color: '#8b5cf6' }} /> Brand Partners
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-light)' }}>
                  {masterData.brands.length} registered brands verified
                </div>
              </div>
              <Link href="/brands" className="badge badge-grey" style={{ textDecoration: 'none' }}>
                Manage
              </Link>
            </div>
          </div>
        </div>

        {/* Widget 3: Measurement Units Checklist */}
        <div className="dash-card">
          <div className="dash-card-header">
            <div>
              <h2 className="dash-card-title">Measurement Units</h2>
              <p style={{ fontSize: '11px', color: 'var(--text-light)', marginTop: '2px' }}>
                Inventory units from backend
              </p>
            </div>
            <Link href="/units" className="dash-card-link">
              <span>Manage</span>
              <FiArrowUpRight />
            </Link>
          </div>
          <div>
            {masterData.units.slice(0, 3).map((u) => (
              <div key={u.id} className="report-item">
                <div>
                  <div className="report-item-title" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <FiCheck style={{ color: '#10b981' }} />
                    {u.display_name}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-light)' }}>
                    Type: {u.unit_type} • {u.weight_kg ? `${u.weight_kg} kg` : 'Standard'}
                  </div>
                </div>
                {u.is_active !== undefined && (
                  <span className={`badge ${u.is_active ? 'badge-green' : 'badge-grey'}`}>
                    {u.is_active ? 'Active' : 'Inactive'}
                  </span>
                )}
              </div>
            ))}
            {masterData.units.length === 0 && (
              <p style={{ color: 'var(--text-light)', fontSize: '12px' }}>
                No units configured
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── MODALS (PRODUCT & VARIANTS) ── */}
      <ProductModal
        isOpen={productModalOpen}
        productId={editProductId}
        onClose={() => setProductModalOpen(false)}
        onSuccess={loadDashboardData}
      />

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
    </div>
  );
}
