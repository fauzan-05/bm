'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { api, resolveImg } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import {
  FiPlus,
  FiBox,
  FiFolder,
  FiTag,
  FiLayers,
  FiArrowUpRight,
  FiCheck,
} from 'react-icons/fi';
import ProductModal from '@/components/ProductModal';
import VariantDetailModal from '@/components/VariantDetailModal';

export default function OverviewDashboardPage() {
  const { user, masterData } = useAuth();
  const { showToast } = useToast();

  const [products, setProducts] = useState([]);
  const [totalProducts, setTotalProducts] = useState(0);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [editProductId, setEditProductId] = useState(null);

  const [variantModalOpen, setVariantModalOpen] = useState(false);
  const [variantProduct, setVariantProduct] = useState(null);


  const loadDashboardData = useCallback(async () => {
    try {
      const data = await api('GET', '/admin/products?page=1&limit=6');
      const rows = Array.isArray(data?.products) ? data.products : [];
      setProducts(rows);
      setTotalProducts(data?.pagination?.total ?? rows.length);
    } catch (err) {
      setProducts([]);
      setTotalProducts(0);
      showToast(err.message || 'Failed to load dashboard data from backend', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

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
      {/* ── GREETING & TOP ACTION (MATCHING SCREENSHOT) ── */}
      <div className="dashboard-header">
        <div className="dashboard-title-wrap">
          <h1>
            {greeting}, {adminName} !
          </h1>
          <p>
            {todayFormatted} &nbsp;•&nbsp; Catalog overview from backend
          </p>
        </div>

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

      {/* ── 4 TOP METRIC CARDS (MATCHING SCREENSHOT) ── */}
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
          </div>
          <div className="metric-card-body">
            <div className="metric-card-value-wrap">
              <div className="metric-card-value">
                {totalProducts}
                <span className="metric-card-unit">items</span>
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
          </div>
          <div className="metric-card-body">
            <div className="metric-card-value-wrap">
              <div className="metric-card-value">
                {masterData.categories.length}
                <span className="metric-card-unit">/ {masterData.subcats.length} sub</span>
              </div>
              <div className="metric-card-subtext" style={{ marginTop: '6px' }}>
                {masterData.mainCats.length} main categories
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
          </div>
          <div className="metric-card-body">
            <div className="metric-card-value-wrap">
              <div className="metric-card-value">
                {masterData.units.length}
                <span className="metric-card-unit">units</span>
              </div>
              <div className="metric-card-trend">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                  <FiArrowUpRight /> {masterData.sizes.length}
                </span>{' '}
                sizes
              </div>
              <div className="metric-card-subtext">
                {masterData.colors.length} color swatches
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── MIDDLE GRID (UPCOMING LIST & LARGE CHART) ── */}
      <div className="dashboard-middle-grid">
        {/* Left Column: Recent Products (Doctor Card Style) */}
        <div className="dash-card">
          <div className="dash-card-header">
            <h2 className="dash-card-title">Recent Catalog Products</h2>
            <Link href="/products" className="dash-card-link">
              <span>View All</span>
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
              products.slice(0, 4).map((p) => {
                const img = p.images && p.images[0] ? p.images[0] : '';
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
                          <span style={{ fontSize: '11px', color: '#16a34a' }}>
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

      {/* ── BOTTOM ROW (3 WIDGETS MATCHING SCREENSHOT) ── */}
      <div className="dashboard-bottom-grid">
        {/* Widget 1: Categories Health (matching Lab Report) */}
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
                ) : null}
              </div>
            ))}
            {masterData.mainCats.length === 0 && (
              <p style={{ color: 'var(--text-light)', fontSize: '12px' }}>
                No main categories configured
              </p>
            )}
          </div>
        </div>

        {/* Widget 2: Recent Activity (matching Messages) */}
        <div className="dash-card">
          <div className="dash-card-header">
            <h2 className="dash-card-title">Catalog Notifications</h2>
          </div>
          <p style={{ color: 'var(--text-light)', fontSize: '12px' }}>
            Recent activity is not available from the backend.
          </p>
        </div>

        {/* Widget 3: Inventory Units Checklist (matching Today's Medicine) */}
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
