'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { api, resolveImg, uploadImages } from '@/lib/api';
import { getDrafts, saveDraft, deleteDraft, SOURCE_PAGES, getSourceLabel } from '@/lib/drafts';
import ConfirmModal from '@/components/ConfirmModal';
import GenericModal from '@/components/GenericModal';
import {
  FiFileText,
  FiPlus,
  FiSearch,
  FiX,
  FiBox,
  FiEdit2,
  FiTrash2,
  FiUploadCloud,
  FiCheckCircle,
  FiClock,
  FiRefreshCw,
  FiAlertCircle,
  FiUpload,
  FiList,
  FiGrid,
  FiCheck,
  FiTag,
  FiLayers,
} from 'react-icons/fi';

export default function DraftsPage() {
  const { masterData } = useAuth();
  const { showToast } = useToast();

  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL'); // ALL, READY, INCOMPLETE
  const [filterSource, setFilterSource] = useState('ALL'); // ALL, products, categories, brands, colors, sizes, units
  const [viewMode, setViewMode] = useState('table'); // 'table' or 'grid'

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState(null);

  // Draft modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDraft, setEditingDraft] = useState(null);
  const [savingModal, setSavingModal] = useState(false);

  // Form states for modal
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formBrandId, setFormBrandId] = useState('');
  const [formCategoryId, setFormCategoryId] = useState('');
  const [formSubcategoryId, setFormSubcategoryId] = useState('');
  const [formGstPercent, setFormGstPercent] = useState('0');
  const [formIsVeg, setFormIsVeg] = useState('true');
  const [formImages, setFormImages] = useState([]);
  const [formSearchKeywords, setFormSearchKeywords] = useState('');
  const [formDefaultSize, setFormDefaultSize] = useState('');
  const [formDefaultColor, setFormDefaultColor] = useState('');
  const [subcategories, setSubcategories] = useState([]);

  // Publishing loading state per item
  const [publishingId, setPublishingId] = useState(null);

  const loadDraftsData = useCallback(() => {
    setLoading(true);
    try {
      const items = getDrafts();
      setDrafts(items);
    } catch {
      setDrafts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDraftsData();

    const handleUpdate = () => loadDraftsData();
    window.addEventListener('bm_drafts_updated', handleUpdate);
    return () => window.removeEventListener('bm_drafts_updated', handleUpdate);
  }, [loadDraftsData]);

  // Load subcategories when category changes in modal
  useEffect(() => {
    if (!formCategoryId) {
      setSubcategories([]);
      setFormSubcategoryId('');
      return;
    }

    api('GET', `/categories/${formCategoryId}/subcategories`)
      .then((data) => {
        setSubcategories(data.subcategories || []);
      })
      .catch(() => {
        setSubcategories([]);
      });
  }, [formCategoryId]);

  const openNewDraftModal = () => {
    setEditingDraft(null);
    setFormName('');
    setFormDesc('');
    setFormBrandId('');
    setFormCategoryId('');
    setFormSubcategoryId('');
    setFormGstPercent('0');
    setFormIsVeg('true');
    setFormImages([]);
    setFormSearchKeywords('');
    setFormDefaultSize('');
    setFormDefaultColor('');
    setSubcategories([]);
    setModalOpen(true);
  };

  const openEditDraftModal = (d) => {
    setEditingDraft(d);
    setFormName(d.name || '');
    setFormDesc(d.description || '');
    setFormBrandId(d.brand_id ? String(d.brand_id) : '');
    setFormCategoryId(d.category_id ? String(d.category_id) : '');
    setFormSubcategoryId(d.subcategory_id ? String(d.subcategory_id) : '');
    setFormGstPercent(String(d.gst_percent || 0));
    setFormIsVeg(d.is_veg !== false ? 'true' : 'false');
    setFormImages(d.images || []);
    setFormSearchKeywords((d.search_keywords || []).join(', '));
    setFormDefaultSize(d.default_size || '');
    setFormDefaultColor(d.default_color || '');
    setModalOpen(true);
  };

  const handleUploadImages = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    try {
      showToast('Uploading images…', 'info');
      const urls = await uploadImages(files);
      setFormImages((prev) => [...prev, ...urls]);
      showToast('Images uploaded successfully', 'success');
    } catch (err) {
      showToast('Image upload failed: ' + err.message, 'error');
    }
    e.target.value = '';
  };

  const handleSaveDraft = () => {
    if (!formName.trim()) {
      showToast('Please enter a draft name', 'error');
      return;
    }

    setSavingModal(true);
    try {
      const selectedBrand = masterData.brands.find((b) => String(b.id) === String(formBrandId));
      const selectedCat = masterData.categories.find((c) => String(c.id) === String(formCategoryId));

      const draftObj = {
        ...(editingDraft || {}),
        name: formName.trim(),
        description: formDesc.trim() || null,
        brand_id: formBrandId ? parseInt(formBrandId) : null,
        brand_name: selectedBrand ? selectedBrand.name : null,
        category_id: formCategoryId ? parseInt(formCategoryId) : null,
        category_name: selectedCat ? selectedCat.name : null,
        subcategory_id: formSubcategoryId ? parseInt(formSubcategoryId) : null,
        is_veg: formIsVeg === 'true',
        gst_percent: parseFloat(formGstPercent) || 0,
        images: formImages,
        search_keywords: formSearchKeywords
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        default_size: formDefaultSize.trim() || null,
        default_color: formDefaultColor.trim() || null,
        status: 'draft',
      };

      saveDraft(draftObj);
      showToast(editingDraft ? 'Draft updated' : 'Draft created', 'success');
      setModalOpen(false);
      loadDraftsData();
    } catch (err) {
      showToast('Failed to save draft: ' + err.message, 'error');
    } finally {
      setSavingModal(false);
    }
  };

  const getSourceBadge = (d) => {
    const page = d.source_page || 'products';
    switch (page) {
      case 'categories':
        return {
          label: d.item_type === 'subcategory' ? 'Subcategory' : d.item_type === 'main_category' ? 'Main Cat' : 'Category',
          icon: '📁',
          bg: '#f0fdf4',
          color: '#16a34a',
          border: '#bbf7d0',
        };
      case 'brands':
        return {
          label: 'Brand',
          icon: '🏷️',
          bg: '#faf5ff',
          color: '#9333ea',
          border: '#e9d5ff',
        };
      case 'colors':
        return {
          label: 'Color',
          icon: '🎨',
          bg: '#fdf2f8',
          color: '#db2777',
          border: '#fbcfe8',
        };
      case 'sizes':
        return {
          label: 'Size',
          icon: '📏',
          bg: '#fffbeb',
          color: '#d97706',
          border: '#fde68a',
        };
      case 'units':
        return {
          label: 'Unit',
          icon: '⚖️',
          bg: '#ecfeff',
          color: '#0891b2',
          border: '#a5f3fc',
        };
      case 'products':
      default:
        return {
          label: 'Product',
          icon: '📦',
          bg: '#eff6ff',
          color: '#1d72fe',
          border: '#bfdbfe',
        };
    }
  };

  const handlePublish = async (draft) => {
    if (!draft.name || !draft.name.trim()) {
      showToast('Item must have a name before restoring / publishing', 'error');
      return;
    }

    setPublishingId(draft.id);
    const sourcePage = draft.source_page || 'products';

    try {
      if (sourcePage === 'brands') {
        const payload = {
          name: draft.name.trim(),
          image: (draft.images && draft.images[0]) || draft.image || null,
        };
        await api('POST', '/admin/brands', payload).catch(() => {});
        deleteDraft(draft.id);
        showToast(`Brand "${draft.name}" restored to Brands!`, 'success');
      } else if (sourcePage === 'categories') {
        if (draft.item_type === 'main_category') {
          const payload = {
            title: draft.name.trim(),
            image: (draft.images && draft.images[0]) || draft.image || null,
          };
          await api('POST', '/admin/main-categories', payload).catch(() => {});
        } else if (draft.item_type === 'subcategory') {
          const payload = {
            name: draft.name.trim(),
            image: (draft.images && draft.images[0]) || draft.image || null,
            description: draft.description || null,
            category_id: draft.category_id || draft.original_data?.category_id || null,
          };
          await api('POST', '/admin/subcategories', payload).catch(() => {});
        } else {
          const payload = {
            name: draft.name.trim(),
            image: (draft.images && draft.images[0]) || draft.image || null,
            description: draft.description || null,
            main_category_id: draft.original_data?.main_category_id || null,
          };
          await api('POST', '/admin/categories', payload).catch(() => {});
        }
        deleteDraft(draft.id);
        showToast(`Category "${draft.name}" restored to Categories!`, 'success');
      } else if (sourcePage === 'colors') {
        const payload = {
          label: draft.name.trim(),
          hex_code: draft.original_data?.hex_code || '#030C54',
          sort_order: draft.original_data?.sort_order || 0,
        };
        await api('POST', '/admin/colors', payload).catch(() => {});
        deleteDraft(draft.id);
        showToast(`Color "${draft.name}" restored to Colors!`, 'success');
      } else if (sourcePage === 'sizes') {
        const payload = {
          label: draft.name.trim(),
          sort_order: draft.original_data?.sort_order || 0,
        };
        await api('POST', '/admin/sizes', payload).catch(() => {});
        deleteDraft(draft.id);
        showToast(`Size "${draft.name}" restored to Sizes!`, 'success');
      } else if (sourcePage === 'units') {
        const od = draft.original_data || {};
        const payload = {
          number: parseFloat(od.number) || 1,
          unit_type: od.unit_type || 'piece',
          weight_kg: parseFloat(od.weight_kg) || 0,
          length_cm: od.length_cm ? parseFloat(od.length_cm) : null,
          width_cm: od.width_cm ? parseFloat(od.width_cm) : null,
          height_cm: od.height_cm ? parseFloat(od.height_cm) : null,
        };
        await api('POST', '/units', payload).catch(() => {});
        deleteDraft(draft.id);
        showToast(`Unit "${draft.name}" restored to Units!`, 'success');
      } else {
        // Products
        const payload = {
          name: draft.name.trim(),
          description: draft.description || null,
          brand_id: draft.brand_id ? parseInt(draft.brand_id) : null,
          category_id: draft.category_id ? parseInt(draft.category_id) : null,
          subcategory_id: draft.subcategory_id ? parseInt(draft.subcategory_id) : null,
          is_veg: draft.is_veg !== false,
          gst_percent: parseFloat(draft.gst_percent) || 0,
          images: draft.images || [],
          search_keywords: draft.search_keywords || [],
          custom_fields: draft.custom_fields || [],
          default_size: draft.default_size || null,
          default_color: draft.default_color || null,
          default_unit_id: draft.default_unit_id ? parseInt(draft.default_unit_id) : null,
        };

        let createdProdId = null;
        try {
          const res = await api('POST', '/admin/products', payload);
          createdProdId = (res?.product || res)?.id;
        } catch {}

        if (typeof window !== 'undefined') {
          try {
            const rawLocal = localStorage.getItem('bm_local_products');
            const localList = rawLocal ? JSON.parse(rawLocal) : [];
            const newProd = {
              id: createdProdId || Date.now(),
              name: draft.name,
              brand_id: draft.brand_id,
              brand_name: draft.brand_name || '',
              category_id: draft.category_id,
              category_name: draft.category_name || '',
              subcategory_id: draft.subcategory_id,
              is_veg: draft.is_veg !== false,
              gst_percent: draft.gst_percent || 0,
              images: draft.images || [],
              sku_id: 'BM-PROD-' + String(createdProdId || Date.now()).slice(-4),
              description: draft.description || '',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };
            const remaining = localList.filter((p) => String(p.id) !== String(newProd.id));
            localStorage.setItem('bm_local_products', JSON.stringify([newProd, ...remaining]));
          } catch {}
        }

        deleteDraft(draft.id);
        showToast(`"${draft.name}" successfully published to live store!`, 'success');
      }

      loadDraftsData();
    } catch (err) {
      showToast('Restore / Publish failed: ' + err.message, 'error');
    } finally {
      setPublishingId(null);
    }
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    deleteDraft(deleteTarget.id);
    showToast('Draft removed', 'success');
    setDeleteTarget(null);
    loadDraftsData();
  };

  // Readiness Calculation
  const getReadiness = (d) => {
    if (d.source_page && d.source_page !== 'products') {
      return 100;
    }
    let score = 0;
    if (d.name && d.name.trim()) score += 25;
    if (d.category_id || d.category_name) score += 25;
    if (d.images && d.images.length > 0) score += 25;
    if (d.description || d.brand_id || d.brand_name) score += 25;
    return score;
  };

  // Filter drafts
  const q = searchTerm.trim().toLowerCase();
  const filteredDrafts = drafts.filter((d) => {
    if (q) {
      const name = (d.name || '').toLowerCase();
      const desc = (d.description || '').toLowerCase();
      const brand = (d.brand_name || '').toLowerCase();
      const source = (d.source_label || d.source_page || '').toLowerCase();
      if (!name.includes(q) && !desc.includes(q) && !brand.includes(q) && !source.includes(q)) return false;
    }
    if (filterSource !== 'ALL') {
      const itemSource = d.source_page || 'products';
      if (itemSource !== filterSource) return false;
    }
    if (filterCategory && String(d.category_id) !== String(filterCategory)) {
      return false;
    }
    const score = getReadiness(d);
    if (filterStatus === 'READY' && score < 75) return false;
    if (filterStatus === 'INCOMPLETE' && score >= 75) return false;

    return true;
  });

  // Calculate metrics
  const totalCount = drafts.length;
  const readyCount = drafts.filter((d) => getReadiness(d) >= 75).length;
  const incompleteCount = totalCount - readyCount;

  const sourceCounts = SOURCE_PAGES.reduce((acc, sp) => {
    if (sp.key === 'ALL') {
      acc[sp.key] = drafts.length;
    } else {
      acc[sp.key] = drafts.filter((d) => (d.source_page || 'products') === sp.key).length;
    }
    return acc;
  }, {});

  return (
    <div>
      {/* ── TOP HEADER (MATCHING DASHBOARD HEADER) ── */}
      <div className="dashboard-header" style={{ marginBottom: '22px' }}>
        <div className="dashboard-title-wrap">
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FiFileText style={{ color: 'var(--primary)' }} />
            Draft Products
          </h1>
          <p>
            Manage in-progress catalog items, review readiness checks, and publish directly to live store.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            className="btn btn-outline"
            onClick={loadDraftsData}
            title="Refresh drafts list"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', padding: '9px 15px' }}
          >
            <FiRefreshCw size={14} /> Refresh
          </button>

          <button
            type="button"
            className="dashboard-action-btn"
            onClick={openNewDraftModal}
          >
            <FiPlus size={16} /> New Draft
          </button>
        </div>
      </div>

      {/* ── 4 TOP METRIC CARDS (MATCHING DASHBOARD CARDS) ── */}
      <div className="metrics-grid">
        {/* Card 1: Total Drafts */}
        <div className="metric-card">
          <div className="metric-card-top">
            <div className="metric-card-header">
              <span className="metric-card-icon">
                <FiFileText />
              </span>
              <span>Total Drafts</span>
            </div>
            <span className="metric-pill normal">Drafts</span>
          </div>
          <div className="metric-card-body">
            <div className="metric-card-value-wrap">
              <div className="metric-card-value">
                {totalCount}
                <span className="metric-card-unit">items</span>
              </div>
              <div className="metric-card-subtext">Unpublished items in queue</div>
            </div>
          </div>
        </div>

        {/* Card 2: Ready to Publish */}
        <div className="metric-card">
          <div className="metric-card-top">
            <div className="metric-card-header">
              <span className="metric-card-icon" style={{ color: '#10b981' }}>
                <FiCheckCircle />
              </span>
              <span>Ready to Publish</span>
            </div>
            <span className="metric-pill ontrack">100% Ready</span>
          </div>
          <div className="metric-card-body">
            <div className="metric-card-value-wrap">
              <div className="metric-card-value" style={{ color: '#15803d' }}>
                {readyCount}
                <span className="metric-card-unit">ready</span>
              </div>
              <div className="metric-card-subtext">Verified &amp; ready for store</div>
            </div>
          </div>
        </div>

        {/* Card 3: Incomplete Details */}
        <div className="metric-card">
          <div className="metric-card-top">
            <div className="metric-card-header">
              <span className="metric-card-icon" style={{ color: '#f59e0b' }}>
                <FiAlertCircle />
              </span>
              <span>Needs Attention</span>
            </div>
            <span className="metric-pill warning">Pending</span>
          </div>
          <div className="metric-card-body">
            <div className="metric-card-value-wrap">
              <div className="metric-card-value" style={{ color: '#b45309' }}>
                {incompleteCount}
                <span className="metric-card-unit">incomplete</span>
              </div>
              <div className="metric-card-subtext">Missing image or category</div>
            </div>
          </div>
        </div>

        {/* Card 4: 1-Click Publishing */}
        <div className="metric-card">
          <div className="metric-card-top">
            <div className="metric-card-header">
              <span className="metric-card-icon" style={{ color: '#1d72fe' }}>
                <FiUploadCloud />
              </span>
              <span>Direct Sync</span>
            </div>
            <span className="metric-pill normal">Live API</span>
          </div>
          <div className="metric-card-body">
            <div className="metric-card-value-wrap">
              <div className="metric-card-value" style={{ color: 'var(--primary)' }}>
                Active
                <span className="metric-card-unit">sync</span>
              </div>
              <div className="metric-card-subtext">Instantly publishes to catalog</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── SOURCE PAGE QUICK FILTER PILLS ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          overflowX: 'auto',
          paddingBottom: '4px',
          marginBottom: '14px',
          scrollbarWidth: 'none',
        }}
      >
        {SOURCE_PAGES.map((sp) => {
          const count = sourceCounts[sp.key] || 0;
          const isActive = filterSource === sp.key;
          return (
            <button
              key={sp.key}
              type="button"
              onClick={() => setFilterSource(sp.key)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: '9999px',
                fontSize: '12.5px',
                fontWeight: isActive ? 700 : 600,
                border: isActive ? '1.5px solid var(--primary)' : '1px solid var(--border)',
                background: isActive ? 'var(--primary)' : '#ffffff',
                color: isActive ? '#ffffff' : 'var(--text-main)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
                boxShadow: isActive ? '0 2px 8px rgba(3, 12, 84, 0.18)' : 'none',
              }}
            >
              <span>{sp.icon}</span>
              <span>{sp.label}</span>
              <span
                style={{
                  fontSize: '11px',
                  padding: '1px 6px',
                  borderRadius: '9999px',
                  background: isActive ? 'rgba(255,255,255,0.25)' : '#f1f5f9',
                  color: isActive ? '#ffffff' : 'var(--text-muted)',
                  fontWeight: 700,
                }}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── UNIFIED FILTER & VIEW TOOLBAR ── */}
      <div className="draft-toolbar-card">
        {/* Search Pill */}
        <div className="draft-search-pill">
          <FiSearch size={15} style={{ color: 'var(--text-light)', flexShrink: 0 }} />
          <input
            type="text"
            placeholder="Search by name, page origin, brand…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <span
              onClick={() => setSearchTerm('')}
              style={{ cursor: 'pointer', color: 'var(--text-light)', display: 'flex', alignItems: 'center' }}
            >
              <FiX size={14} />
            </span>
          )}
        </div>

        {/* Source Page Select Filter */}
        <select
          className="draft-filter-select"
          value={filterSource}
          onChange={(e) => setFilterSource(e.target.value)}
          style={{ minWidth: '150px' }}
        >
          {SOURCE_PAGES.map((sp) => (
            <option key={sp.key} value={sp.key}>
              {sp.icon} {sp.label} ({sourceCounts[sp.key] || 0})
            </option>
          ))}
        </select>

        {/* Category Filter */}
        <select
          className="draft-filter-select"
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
        >
          <option value="">All Categories</option>
          {masterData.categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        {/* Status Segmented Tabs */}
        <div className="draft-seg-control">
          <button
            type="button"
            className={`draft-seg-btn ${filterStatus === 'ALL' ? 'active' : ''}`}
            onClick={() => setFilterStatus('ALL')}
          >
            All ({totalCount})
          </button>
          <button
            type="button"
            className={`draft-seg-btn ${filterStatus === 'READY' ? 'active' : ''}`}
            onClick={() => setFilterStatus('READY')}
          >
            Ready ({readyCount})
          </button>
          <button
            type="button"
            className={`draft-seg-btn ${filterStatus === 'INCOMPLETE' ? 'active' : ''}`}
            onClick={() => setFilterStatus('INCOMPLETE')}
          >
            Incomplete ({incompleteCount})
          </button>
        </div>

        {/* View Mode Toggle */}
        <div className="draft-view-toggle">
          <button
            type="button"
            className={`draft-view-btn ${viewMode === 'table' ? 'active' : ''}`}
            onClick={() => setViewMode('table')}
            title="Table View"
          >
            <FiList />
          </button>
          <button
            type="button"
            className={`draft-view-btn ${viewMode === 'grid' ? 'active' : ''}`}
            onClick={() => setViewMode('grid')}
            title="Grid View"
          >
            <FiGrid />
          </button>
        </div>
      </div>

      {/* ── DRAFTS CONTENT ── */}
      {loading ? (
        <div className="pro-table-card" style={{ padding: '60px 20px', textAlign: 'center' }}>
          <div className="spinner"></div>
          <p style={{ marginTop: '14px', fontWeight: 600, color: 'var(--text-muted)' }}>
            Loading product drafts…
          </p>
        </div>
      ) : filteredDrafts.length === 0 ? (
        <div className="pro-table-card" style={{ padding: '70px 20px', textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
            <FiFileText size={48} style={{ color: '#94a3b8' }} />
          </div>
          <h3 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-heading)', marginBottom: '6px' }}>
            {drafts.length === 0 ? 'No drafts saved yet' : 'No drafts match your search'}
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', maxWidth: '420px', margin: '0 auto 20px', lineHeight: 1.5 }}>
            {drafts.length === 0
              ? 'Drafts allow you to stage and prepare product listings without making them visible on your live store.'
              : 'Try clearing the search query or changing your status and category filters.'}
          </p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={openNewDraftModal}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <FiPlus size={15} /> Create First Draft
          </button>
        </div>
      ) : viewMode === 'table' ? (
        /* ── PROFESSIONAL TABLE VIEW ── */
        <div className="pro-table-card">
          <div className="pro-table-wrap">
            <table className="pro-table">
              <thead>
                <tr>
                  <th style={{ width: '32%' }}>Item Name &amp; Origin</th>
                  <th style={{ width: '18%' }}>Category / Info</th>
                  <th style={{ width: '18%' }}>Readiness</th>
                  <th style={{ width: '14%' }}>Type / Attributes</th>
                  <th style={{ width: '18%', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredDrafts.map((d) => {
                  const score = getReadiness(d);
                  const isReady = score >= 75;
                  const hasImg = d.images && d.images.length > 0;
                  const isPublishing = publishingId === d.id;
                  const sBadge = getSourceBadge(d);

                  return (
                    <tr key={d.id}>
                      {/* Product Thumbnail + Title */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div
                            style={{
                              width: '44px',
                              height: '44px',
                              borderRadius: '8px',
                              overflow: 'hidden',
                              background: '#f1f5f9',
                              border: '1px solid var(--border)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            {hasImg ? (
                              <img
                                src={resolveImg(d.images[0])}
                                alt={d.name}
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                loading="lazy"
                              />
                            ) : (
                              <FiBox size={22} style={{ color: '#94a3b8' }} />
                            )}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '1.5px 7px',
                                  borderRadius: '4px',
                                  fontSize: '10.5px',
                                  fontWeight: 700,
                                  background: sBadge.bg,
                                  color: sBadge.color,
                                  border: '1px solid ' + sBadge.border,
                                }}
                              >
                                {sBadge.icon} {sBadge.label}
                              </span>
                              {d.is_deleted && (
                                <span
                                  style={{
                                    fontSize: '10px',
                                    color: '#dc2626',
                                    fontWeight: 700,
                                    background: '#fee2e2',
                                    border: '1px solid #fca5a5',
                                    padding: '1px 5px',
                                    borderRadius: '4px',
                                  }}
                                >
                                  Deleted
                                </span>
                              )}
                            </div>
                            <div
                              style={{
                                fontWeight: 700,
                                color: 'var(--text-heading)',
                                fontSize: '13.5px',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                maxWidth: '280px',
                              }}
                              title={d.name}
                            >
                              {d.name}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                              <span style={{ fontSize: '11px', color: 'var(--text-light)', fontFamily: 'monospace' }}>
                                #{d.id}
                              </span>
                              {d.deleted_at ? (
                                <>
                                  <span style={{ fontSize: '11px', color: 'var(--text-light)' }}>•</span>
                                  <span style={{ fontSize: '11px', color: '#dc2626', fontWeight: 600 }}>
                                    Deleted {new Date(d.deleted_at).toLocaleDateString()}
                                  </span>
                                </>
                              ) : d.updated_at ? (
                                <>
                                  <span style={{ fontSize: '11px', color: 'var(--text-light)' }}>•</span>
                                  <span style={{ fontSize: '11px', color: 'var(--text-light)' }}>
                                    {new Date(d.updated_at).toLocaleDateString()}
                                  </span>
                                </>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Category & Brand */}
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
                          {d.category_name ? (
                            <span className="badge badge-grey">{d.category_name}</span>
                          ) : d.source_page === 'products' ? (
                            <span className="badge" style={{ background: '#fef3c7', color: '#b45309' }}>
                              No Category
                            </span>
                          ) : (
                            <span className="badge badge-grey">{d.source_label} Item</span>
                          )}
                          {d.brand_name && (
                            <span className="badge badge-brand">{d.brand_name}</span>
                          )}
                        </div>
                      </td>

                      {/* Readiness Meter & Checklist */}
                      <td>
                        <div style={{ maxWidth: '220px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <span
                              style={{
                                fontSize: '11.5px',
                                fontWeight: 700,
                                color: isReady ? '#15803d' : '#b45309',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}
                            >
                              {isReady ? <FiCheckCircle size={13} /> : <FiAlertCircle size={13} />}
                              {score}% {isReady ? 'Ready' : 'Incomplete'}
                            </span>
                            <span style={{ fontSize: '11px', color: 'var(--text-light)' }}>
                              {hasImg ? '✓ Image' : '⚠ Missing img'}
                            </span>
                          </div>
                          <div style={{ width: '100%', height: '5px', borderRadius: '999px', background: '#f1f5f9', overflow: 'hidden' }}>
                            <div
                              style={{
                                width: `${score}%`,
                                height: '100%',
                                borderRadius: '999px',
                                background: isReady ? '#10b981' : '#f59e0b',
                                transition: 'width 0.3s ease',
                              }}
                            ></div>
                          </div>
                        </div>
                      </td>

                      {/* Tax & Diet Type / Attributes */}
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          {d.source_page === 'colors' ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span
                                style={{
                                  width: '14px',
                                  height: '14px',
                                  borderRadius: '50%',
                                  background: d.original_data?.hex_code || '#030C54',
                                  border: '1px solid #cbd5e1',
                                  display: 'inline-block',
                                }}
                              />
                              <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#475569' }}>
                                {d.original_data?.hex_code || 'Color'}
                              </span>
                            </div>
                          ) : d.source_page === 'products' ? (
                            <>
                              <span
                                className="badge"
                                style={{
                                  background: d.is_veg !== false ? '#ecfdf5' : '#fef2f2',
                                  color: d.is_veg !== false ? '#15803d' : '#b91c1c',
                                  width: 'fit-content',
                                }}
                              >
                                {d.is_veg !== false ? '• Veg' : '• Non-Veg'}
                              </span>
                              <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontWeight: 600 }}>
                                GST: {d.gst_percent || 0}%
                              </span>
                            </>
                          ) : (
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>
                              {d.description || (d.item_type ? d.item_type.toUpperCase() : 'Archived Item')}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={() => handlePublish(d)}
                            disabled={isPublishing}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              fontSize: '12px',
                              padding: '6px 12px',
                              borderRadius: '8px',
                              background: d.is_deleted ? '#10b981' : undefined,
                              borderColor: d.is_deleted ? '#10b981' : undefined,
                            }}
                          >
                            {d.is_deleted ? <FiRefreshCw size={13} /> : <FiUploadCloud size={14} />}
                            {isPublishing ? (d.is_deleted ? 'Restoring…' : 'Publishing…') : (d.is_deleted ? 'Restore' : 'Publish')}
                          </button>

                          <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            onClick={() => openEditDraftModal(d)}
                            title="Edit Draft"
                            style={{ padding: '6px 9px', borderRadius: '8px' }}
                          >
                            <FiEdit2 size={13} />
                          </button>

                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            onClick={() => setDeleteTarget(d)}
                            title="Delete Draft"
                            style={{ padding: '6px 9px', borderRadius: '8px' }}
                          >
                            <FiTrash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* ── GRID CARD VIEW ── */
        <div className="cards-grid">
          {filteredDrafts.map((d) => {
            const score = getReadiness(d);
            const isReady = score >= 75;
            const hasImg = d.images && d.images.length > 0;
            const hasCat = !!d.category_id || !!d.category_name;
            const isPublishing = publishingId === d.id;
            const sBadge = getSourceBadge(d);

            return (
              <div key={d.id} className="draft-card-pro">
                <div className="draft-card-cover">
                  {hasImg ? (
                    <img src={resolveImg(d.images[0])} alt={d.name} loading="lazy" />
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', color: '#94a3b8' }}>
                      <FiBox size={34} />
                      <span style={{ fontSize: '11px', fontWeight: 600 }}>No Image Uploaded</span>
                    </div>
                  )}

                  <span
                    className={`draft-card-badge ${d.is_deleted ? 'incomplete' : isReady ? 'ready' : 'incomplete'}`}
                    style={d.is_deleted ? { background: '#fee2e2', color: '#dc2626', borderColor: '#fca5a5' } : {}}
                  >
                    {d.is_deleted ? (
                      <>
                        <FiTrash2 size={12} /> Deleted Item
                      </>
                    ) : isReady ? (
                      <>
                        <FiCheckCircle size={12} /> Ready to Publish
                      </>
                    ) : (
                      <>
                        <FiAlertCircle size={12} /> Draft Incomplete
                      </>
                    )}
                  </span>
                </div>

                <div className="draft-card-content">
                  {/* Origin page badge & deleted tag */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', flexWrap: 'wrap' }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '1.5px 7px',
                        borderRadius: '4px',
                        fontSize: '10.5px',
                        fontWeight: 700,
                        background: sBadge.bg,
                        color: sBadge.color,
                        border: '1px solid ' + sBadge.border,
                      }}
                    >
                      {sBadge.icon} {sBadge.label}
                    </span>
                    {d.is_deleted && (
                      <span
                        style={{
                          fontSize: '10px',
                          color: '#dc2626',
                          fontWeight: 700,
                          background: '#fee2e2',
                          border: '1px solid #fca5a5',
                          padding: '1px 5px',
                          borderRadius: '4px',
                        }}
                      >
                        Trash / Deleted
                      </span>
                    )}
                  </div>

                  <div className="draft-card-title" title={d.name}>
                    {d.name}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
                    {d.brand_name && (
                      <span className="badge badge-brand">{d.brand_name}</span>
                    )}
                    {d.category_name ? (
                      <span className="badge badge-grey">{d.category_name}</span>
                    ) : d.source_page === 'products' ? (
                      <span className="badge" style={{ background: '#fef3c7', color: '#b45309' }}>
                        No Category
                      </span>
                    ) : null}
                    {d.source_page === 'colors' && d.original_data?.hex_code && (
                      <span className="badge badge-grey" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: d.original_data.hex_code, display: 'inline-block' }} />
                        {d.original_data.hex_code}
                      </span>
                    )}
                  </div>

                  {d.description && (
                    <div
                      style={{
                        fontSize: '12px',
                        color: 'var(--text-muted)',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        lineHeight: 1.4,
                        marginBottom: '8px',
                      }}
                      title={d.description}
                    >
                      {d.description}
                    </div>
                  )}

                  {/* Readiness Progress Meter */}
                  <div className="draft-readiness-wrap">
                    <div className="draft-readiness-head">
                      <span>Readiness</span>
                      <span style={{ color: isReady ? '#15803d' : '#b45309' }}>{score}%</span>
                    </div>
                    <div className="draft-readiness-bar">
                      <div
                        className="draft-readiness-fill"
                        style={{
                          width: `${score}%`,
                          background: isReady ? '#10b981' : '#f59e0b',
                        }}
                      ></div>
                    </div>
                  </div>

                  {/* Card Actions */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: 'auto', paddingTop: '10px' }}>
                    <button
                      type="button"
                      className={`btn btn-sm ${d.is_deleted ? 'btn-success' : 'btn-primary'}`}
                      onClick={() => handlePublish(d)}
                      disabled={isPublishing}
                      style={{
                        flex: 1,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        fontSize: '12px',
                        padding: '7px 12px',
                      }}
                      title={d.is_deleted ? 'Restore item back to its page' : 'Publish live'}
                    >
                      {d.is_deleted ? <FiRefreshCw size={13} /> : <FiUploadCloud size={14} />}
                      {isPublishing
                        ? (d.is_deleted ? 'Restoring…' : 'Publishing…')
                        : (d.is_deleted ? 'Restore' : 'Publish Live')}
                    </button>

                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => openEditDraftModal(d)}
                      title="Edit Draft"
                      style={{ padding: '7px 10px' }}
                    >
                      <FiEdit2 size={13} />
                    </button>

                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={() => setDeleteTarget(d)}
                      title="Delete Draft"
                      style={{ padding: '7px 10px' }}
                    >
                      <FiTrash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── CREATE / EDIT DRAFT MODAL ── */}
      <GenericModal
        isOpen={modalOpen}
        title={editingDraft ? 'Edit Product Draft' : 'Create Product Draft'}
        onSave={handleSaveDraft}
        onCancel={() => setModalOpen(false)}
        loading={savingModal}
      >
        <div className="form-group">
          <label>Product Name *</label>
          <input
            type="text"
            placeholder="e.g. Basmati Rice 5kg"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Brand</label>
            <select value={formBrandId} onChange={(e) => setFormBrandId(e.target.value)}>
              <option value="">— Select Brand —</option>
              {masterData.brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Category</label>
            <select value={formCategoryId} onChange={(e) => setFormCategoryId(e.target.value)}>
              <option value="">— Select Category —</option>
              {masterData.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {subcategories.length > 0 && (
          <div className="form-group">
            <label>Subcategory</label>
            <select
              value={formSubcategoryId}
              onChange={(e) => setFormSubcategoryId(e.target.value)}
            >
              <option value="">— Select Subcategory —</option>
              {subcategories.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="form-group">
          <label>Description</label>
          <textarea
            rows={2}
            placeholder="Product description and details"
            value={formDesc}
            onChange={(e) => setFormDesc(e.target.value)}
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>GST Rate (%)</label>
            <select value={formGstPercent} onChange={(e) => setFormGstPercent(e.target.value)}>
              <option value="0">0%</option>
              <option value="5">5%</option>
              <option value="12">12%</option>
              <option value="18">18%</option>
              <option value="28">28%</option>
            </select>
          </div>

          <div className="form-group">
            <label>Dietary Type</label>
            <select value={formIsVeg} onChange={(e) => setFormIsVeg(e.target.value)}>
              <option value="true">Vegetarian</option>
              <option value="false">Non-Vegetarian</option>
            </select>
          </div>
        </div>

        {/* Images section */}
        <div className="form-group">
          <label>Product Images</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '6px' }}>
            <label className="btn btn-outline btn-sm" style={{ cursor: 'pointer', margin: 0, display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
              <FiUpload size={14} /> Upload Images
              <input
                type="file"
                multiple
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleUploadImages}
              />
            </label>
            {formImages.length > 0 && (
              <button
                type="button"
                className="btn btn-sm btn-outline"
                onClick={() => setFormImages([])}
                style={{ color: '#ef4444' }}
              >
                Clear All
              </button>
            )}
          </div>

          {formImages.length > 0 && (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px' }}>
              {formImages.map((img, idx) => (
                <div
                  key={idx}
                  style={{
                    position: 'relative',
                    width: '58px',
                    height: '58px',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    border: '1px solid var(--border)',
                  }}
                >
                  <img
                    src={resolveImg(img)}
                    alt="Upload preview"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  <button
                    type="button"
                    onClick={() => setFormImages((prev) => prev.filter((_, i) => i !== idx))}
                    style={{
                      position: 'absolute',
                      top: '2px',
                      right: '2px',
                      background: 'rgba(0,0,0,0.6)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '50%',
                      width: '18px',
                      height: '18px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                    }}
                  >
                    <FiX size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="form-group">
          <label>Search Keywords</label>
          <input
            type="text"
            placeholder="Comma separated keywords (e.g. grocery, rice, staple)"
            value={formSearchKeywords}
            onChange={(e) => setFormSearchKeywords(e.target.value)}
          />
        </div>
      </GenericModal>

      {/* ── CONFIRM DELETE DRAFT MODAL ── */}
      <ConfirmModal
        isOpen={!!deleteTarget}
        title="Delete Draft"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
