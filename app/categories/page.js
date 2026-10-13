'use client';

import { useState, useEffect, useCallback } from 'react';
import { api, resolveImg, uploadImages } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import {
  FiHome,
  FiArrowLeft,
  FiArrowRight,
  FiSearch,
  FiX,
  FiPlus,
  FiRefreshCw,
  FiEdit2,
  FiTrash2,
  FiFolder,
  FiBox,
  FiUpload,
} from 'react-icons/fi';
import GenericModal from '@/components/GenericModal';
import ConfirmModal from '@/components/ConfirmModal';
import ProductModal from '@/components/ProductModal';
import { mockMasterData } from '@/lib/mockData';

export default function CategoriesPage() {
  const { masterData, refreshMasterData } = useAuth();
  const { showToast } = useToast();

  // catStack: array of { type: 'maincat' | 'category' | 'subcat', id, name, category_id? }
  const [catStack, setCatStack] = useState([]);
  const [items, setItems] = useState(masterData?.mainCats?.length ? masterData.mainCats : mockMasterData.mainCats);
  const [leafProducts, setLeafProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [mainCatModal, setMainCatModal] = useState({ open: false, item: null });
  const [catModal, setCatModal] = useState({ open: false, item: null, mainCatId: null });
  const [subcatModal, setSubcatModal] = useState({ open: false, item: null, categoryId: null, parentId: null });
  const [confirmModal, setConfirmModal] = useState({ open: false, message: '', onConfirm: null });

  // Product modal (for leaf subcategory)
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [editProductId, setEditProductId] = useState(null);

  // Form states for modals
  const [formTitle, setFormTitle] = useState('');
  const [formImage, setFormImage] = useState('');
  const [form3Shop, setForm3Shop] = useState(false);
  const [formDesc, setFormDesc] = useState('');
  const [modalSaving, setModalSaving] = useState(false);

  const currentLevel = catStack.length === 0 ? 'root' : catStack[catStack.length - 1].type;

  const loadCurrentLevel = useCallback(async () => {
    setLeafProducts([]);
    try {
      if (catStack.length === 0) {
        // ROOT: main categories
        const data = await api('GET', '/admin/main-categories');
        if (data && data.main_categories && data.main_categories.length > 0) {
          setItems(data.main_categories);
        } else {
          setItems(masterData?.mainCats?.length ? masterData.mainCats : mockMasterData.mainCats);
        }
      } else if (currentLevel === 'maincat') {
        const mc = catStack[catStack.length - 1];
        const data = await api('GET', `/admin/main-categories/${mc.id}/categories`);
        if (data && data.categories && data.categories.length > 0) {
          setItems(data.categories);
        } else {
          setItems(masterData?.categories?.length ? masterData.categories : mockMasterData.categories);
        }
      } else if (currentLevel === 'category') {
        const cat = catStack[catStack.length - 1];
        const data = await api('GET', `/categories/${cat.id}/subcategories`);
        if (data && data.subcategories && data.subcategories.length > 0) {
          setItems(data.subcategories);
        } else {
          setItems(masterData?.subcats?.length ? masterData.subcats : mockMasterData.subcats);
        }
      } else if (currentLevel === 'subcat') {
        const sub = catStack[catStack.length - 1];
        const catId = sub.category_id || catStack.find((s) => s.type === 'category')?.id;
        const childData = await api('GET', `/categories/${catId}/subcategories?parent_id=${sub.id}`);
        const children = childData.subcategories || [];

        if (children.length > 0) {
          setItems(children);
        } else {
          setItems([]);
          const prodData = await api('GET', `/admin/products?page=1&limit=50&subcategory_id=${sub.id}`);
          setLeafProducts(prodData.products || []);
        }
      }
    } catch {
      // Backend offline fallback
      if (catStack.length === 0) {
        setItems(masterData?.mainCats?.length ? masterData.mainCats : mockMasterData.mainCats);
      } else if (currentLevel === 'maincat') {
        setItems(masterData?.categories?.length ? masterData.categories : mockMasterData.categories);
      } else if (currentLevel === 'category') {
        setItems(masterData?.subcats?.length ? masterData.subcats : mockMasterData.subcats);
      }
    }
  }, [catStack, currentLevel, masterData]);

  useEffect(() => {
    loadCurrentLevel();
  }, [loadCurrentLevel]);

  const drillInto = (node) => {
    setSearchQuery('');
    setCatStack((prev) => [...prev, node]);
  };

  const goToBreadcrumb = (index) => {
    setSearchQuery('');
    setCatStack((prev) => prev.slice(0, index));
  };

  const handleUploadSingleImg = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      showToast('Uploading image…', 'info');
      const urls = await uploadImages([file]);
      if (urls.length > 0) {
        setFormImage(urls[0]);
        showToast('Image uploaded', 'success');
      }
    } catch (err) {
      showToast('Upload failed: ' + err.message, 'error');
    }
    e.target.value = '';
  };

  // ── MAIN CATEGORY ACTIONS ──
  const openAddMainCat = () => {
    setFormTitle('');
    setFormImage('');
    setForm3Shop(false);
    setMainCatModal({ open: true, item: null });
  };

  const openEditMainCat = (item) => {
    setFormTitle(item.title || '');
    setFormImage(item.image || '');
    setForm3Shop(!!item.three_shop_restriction);
    setMainCatModal({ open: true, item });
  };

  const saveMainCat = async () => {
    if (!formTitle.trim()) {
      showToast('Title is required', 'error');
      return;
    }
    setModalSaving(true);
    try {
      const body = {
        title: formTitle.trim(),
        image: formImage.trim() || null,
        three_shop_restriction: form3Shop,
      };
      if (mainCatModal.item) {
        await api('PUT', `/admin/main-categories/${mainCatModal.item.id}`, body);
        showToast('Main category updated', 'success');
      } else {
        await api('POST', '/admin/main-categories', body);
        showToast('Main category created', 'success');
      }
      setMainCatModal({ open: false, item: null });
      refreshMasterData();
      loadCurrentLevel();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setModalSaving(false);
    }
  };

  const deleteMainCat = (id) => {
    setConfirmModal({
      open: true,
      message: 'Delete this main category and all its contents?',
      onConfirm: async () => {
        try {
          await api('DELETE', `/admin/main-categories/${id}`);
          showToast('Deleted', 'success');
          setConfirmModal({ open: false });
          refreshMasterData();
          loadCurrentLevel();
        } catch (err) {
          showToast(err.message, 'error');
        }
      },
    });
  };

  // ── CATEGORY ACTIONS ──
  const openAddCategory = (mainCatId) => {
    setFormTitle('');
    setFormImage('');
    setFormDesc('');
    setCatModal({ open: true, item: null, mainCatId });
  };

  const openEditCategory = (item) => {
    setFormTitle(item.name || '');
    setFormImage(item.image || '');
    setFormDesc(item.description || '');
    setCatModal({ open: true, item, mainCatId: item.main_category_id });
  };

  const saveCategory = async () => {
    if (!formTitle.trim()) {
      showToast('Name is required', 'error');
      return;
    }
    setModalSaving(true);
    try {
      const body = {
        name: formTitle.trim(),
        image: formImage.trim() || null,
        description: formDesc.trim() || null,
      };
      if (catModal.item) {
        await api('PUT', `/admin/categories/${catModal.item.id}`, body);
        showToast('Category updated', 'success');
      } else {
        body.main_category_id = catModal.mainCatId;
        await api('POST', '/admin/categories', body);
        showToast('Category created', 'success');
      }
      setCatModal({ open: false, item: null, mainCatId: null });
      refreshMasterData();
      loadCurrentLevel();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setModalSaving(false);
    }
  };

  const deleteCategory = (id) => {
    setConfirmModal({
      open: true,
      message: 'Delete this category and all its products?',
      onConfirm: async () => {
        try {
          await api('DELETE', `/admin/categories/${id}`);
          showToast('Deleted', 'success');
          setConfirmModal({ open: false });
          refreshMasterData();
          loadCurrentLevel();
        } catch (err) {
          showToast(err.message, 'error');
        }
      },
    });
  };

  // ── SUBCATEGORY ACTIONS ──
  const openAddSubcat = (categoryId, parentId = null) => {
    setFormTitle('');
    setFormImage('');
    setFormDesc('');
    setSubcatModal({ open: true, item: null, categoryId, parentId });
  };

  const openEditSubcat = (item, categoryId) => {
    setFormTitle(item.name || '');
    setFormImage(item.image || '');
    setFormDesc(item.description || '');
    setSubcatModal({ open: true, item, categoryId, parentId: item.parent_id || null });
  };

  const saveSubcat = async () => {
    if (!formTitle.trim()) {
      showToast('Name is required', 'error');
      return;
    }
    setModalSaving(true);
    try {
      const body = {
        name: formTitle.trim(),
        image: formImage.trim() || null,
        description: formDesc.trim() || null,
      };
      if (subcatModal.item) {
        body.category_id = subcatModal.categoryId;
        await api('PUT', `/admin/subcategories/${subcatModal.item.id}`, body);
        showToast('Subcategory updated', 'success');
      } else {
        body.category_id = subcatModal.categoryId;
        body.parent_id = subcatModal.parentId;
        await api('POST', '/admin/subcategories', body);
        showToast('Subcategory created', 'success');
      }
      setSubcatModal({ open: false, item: null, categoryId: null, parentId: null });
      refreshMasterData();
      loadCurrentLevel();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setModalSaving(false);
    }
  };

  const deleteSubcat = (id) => {
    setConfirmModal({
      open: true,
      message: 'Delete this subcategory and all its products?',
      onConfirm: async () => {
        try {
          await api('DELETE', `/admin/subcategories/${id}`);
          showToast('Deleted', 'success');
          setConfirmModal({ open: false });
          refreshMasterData();
          loadCurrentLevel();
        } catch (err) {
          showToast(err.message, 'error');
        }
      },
    });
  };

  // Delete product in leaf subcategory
  const deleteLeafProduct = (id) => {
    setConfirmModal({
      open: true,
      message: 'Delete this product?',
      onConfirm: async () => {
        try {
          await api('DELETE', `/admin/products/${id}`);
          showToast('Product deleted', 'success');
          setConfirmModal({ open: false });
          loadCurrentLevel();
        } catch (err) {
          showToast(err.message, 'error');
        }
      },
    });
  };

  // Breadcrumb items
  const breadcrumbItems = [{ name: 'All Categories', isRoot: true, index: 0 }];
  catStack.forEach((s, i) => breadcrumbItems.push({ name: s.name, isRoot: false, index: i + 1 }));

  // Filter items & products
  const q = searchQuery.trim().toLowerCase();
  const filteredItems = items.filter((item) => {
    if (!q) return true;
    const name = item.title || item.name || '';
    const desc = item.description || '';
    return name.toLowerCase().includes(q) || desc.toLowerCase().includes(q);
  });

  const filteredLeafProducts = leafProducts.filter((p) => {
    if (!q) return true;
    const name = p.name || '';
    const sku = p.sku_id || '';
    return name.toLowerCase().includes(q) || sku.toLowerCase().includes(q);
  });

  // Level Info Meta
  const getLevelMeta = () => {
    if (catStack.length === 0) {
      return {
        badge: 'Root Level',
        title: 'Main Categories',
        desc: 'Top-level department groupings (e.g., Men, Women, Kids)',
        count: `${filteredItems.length} main categories`,
      };
    }
    const current = catStack[catStack.length - 1];
    if (currentLevel === 'maincat') {
      return {
        badge: 'Level 1: Categories',
        title: `Categories inside "${current.name}"`,
        desc: 'Primary categories nested under this main category',
        count: `${filteredItems.length} categories`,
      };
    }
    if (currentLevel === 'category') {
      return {
        badge: 'Level 2: Subcategories',
        title: `Subcategories inside "${current.name}"`,
        desc: 'Specialized subcategories',
        count: `${filteredItems.length} subcategories`,
      };
    }
    if (currentLevel === 'subcat') {
      if (items.length > 0) {
        return {
          badge: 'Level 3: Sub-subcategories',
          title: `Nested Subcategories under "${current.name}"`,
          desc: 'Fine-grained product classifications',
          count: `${filteredItems.length} subcategories`,
        };
      }
      return {
        badge: 'Leaf Subcategory Products',
        title: `Products assigned to "${current.name}"`,
        desc: 'Leaf subcategory containing directly assigned products',
        count: `${filteredLeafProducts.length} products`,
      };
    }
    return {
      badge: 'Explorer',
      title: 'Categories',
      desc: '',
      count: `${filteredItems.length} items`,
    };
  };

  const levelMeta = getLevelMeta();

  return (
    <div className="cat-explorer-container">
      {/* ── TOP HEADER CARD: BREADCRUMBS & TOOLBAR ── */}
      <div className="cat-header-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {catStack.length > 0 && (
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => goToBreadcrumb(catStack.length - 1)}
              title="Go back one level"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontWeight: 700 }}
            >
              <FiArrowLeft size={14} /> Back
            </button>
          )}

          <nav className="cat-breadcrumb" aria-label="Category hierarchy">
            {breadcrumbItems.map((b, i) => {
              const isLast = i === breadcrumbItems.length - 1;
              return isLast ? (
                <span key={i} className="bc-current" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                  {b.isRoot && <FiHome size={13} style={{ marginBottom: '1px' }} />}
                  {b.name}
                </span>
              ) : (
                <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <span className="bc-link" onClick={() => goToBreadcrumb(b.index)} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                    {b.isRoot && <FiHome size={13} style={{ marginBottom: '1px' }} />}
                    {b.name}
                  </span>
                  <span className="bc-sep">›</span>
                </span>
              );
            })}
          </nav>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Quick Search */}
          <div className="cat-filter-wrap">
            <FiSearch size={14} style={{ color: 'var(--text-light)', flexShrink: 0 }} />
            <input
              type="text"
              className="cat-filter-input"
              placeholder="Search in this view…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <span
                style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--text-light)', cursor: 'pointer', padding: '0 2px' }}
                onClick={() => setSearchQuery('')}
                title="Clear search"
              >
                <FiX size={14} />
              </span>
            )}
          </div>

          {/* Primary Action Buttons */}
          <div className="cat-toolbar-btns">
            {catStack.length === 0 && (
              <button className="btn btn-primary btn-sm" onClick={openAddMainCat} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                <FiPlus size={14} /> Add Main Category
              </button>
            )}

            {currentLevel === 'maincat' && (
              <button
                className="btn btn-primary btn-sm"
                onClick={() => openAddCategory(catStack[catStack.length - 1].id)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
              >
                <FiPlus size={14} /> Add Category
              </button>
            )}

            {currentLevel === 'category' && (
              <button
                className="btn btn-primary btn-sm"
                onClick={() => openAddSubcat(catStack[catStack.length - 1].id, null)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
              >
                <FiPlus size={14} /> Add Subcategory
              </button>
            )}

            {currentLevel === 'subcat' && (
              <>
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => {
                    const sub = catStack[catStack.length - 1];
                    const catId = sub.category_id || catStack.find((s) => s.type === 'category')?.id;
                    openAddSubcat(catId, sub.id);
                  }}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                >
                  <FiPlus size={14} /> Add Sub-subcategory
                </button>
                {items.length === 0 && (
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => {
                      setEditProductId(null);
                      setProductModalOpen(true);
                    }}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                  >
                    <FiPlus size={14} /> Add Product
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── LEVEL INFO BANNER ── */}
      <div className="cat-level-banner">
        <div className="cat-level-info">
          <span className="cat-level-badge">{levelMeta.badge}</span>
          <div>
            <div className="cat-level-title">{levelMeta.title}</div>
            {levelMeta.desc && (
              <div style={{ fontSize: '12px', color: 'var(--text-light)', marginTop: '2px' }}>
                {levelMeta.desc}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span className="cat-level-count">{levelMeta.count}</span>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={loadCurrentLevel}
            title="Refresh current list"
            style={{ padding: '4px 10px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
          >
            <FiRefreshCw size={12} /> Refresh
          </button>
        </div>
      </div>

      {/* ── MAIN CONTENT LISTING ── */}
      {loading ? (
        <div className="card loading-state" style={{ minHeight: '260px', padding: '40px', textAlign: 'center' }}>
          <div className="spinner"></div>
          <p style={{ marginTop: '14px', fontWeight: 600, color: 'var(--text-muted)' }}>
            Loading categories…
          </p>
        </div>
      ) : items.length > 0 ? (
        filteredItems.length === 0 ? (
          <div className="card" style={{ padding: '40px 20px', textAlign: 'center', background: '#ffffff', border: '1px solid var(--border)' }}>
            <div style={{ marginBottom: '8px', display: 'flex', justifyContent: 'center' }}>
              <FiSearch size={32} style={{ color: 'var(--text-light)' }} />
            </div>
            <h4 style={{ fontWeight: 700, color: 'var(--text-heading)', marginBottom: '4px' }}>
              No items matching &ldquo;{searchQuery}&rdquo;
            </h4>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '14px' }}>
              Try searching with a different keyword or clear the search filter.
            </p>
            <button className="btn btn-outline btn-sm" onClick={() => setSearchQuery('')}>
              Clear Filter
            </button>
          </div>
        ) : (
          <div className="cat-grid">
            {filteredItems.map((item) => {
              const name = item.title || item.name;
              const img = item.image;
              const has3Shop = item.three_shop_restriction;

              const handleDrill = () => {
                if (catStack.length === 0) {
                  drillInto({ type: 'maincat', id: item.id, name: item.title });
                } else if (currentLevel === 'maincat') {
                  drillInto({ type: 'category', id: item.id, name: item.name });
                } else if (currentLevel === 'category') {
                  const cat = catStack[catStack.length - 1];
                  drillInto({ type: 'subcat', id: item.id, name: item.name, category_id: cat.id });
                } else if (currentLevel === 'subcat') {
                  const sub = catStack[catStack.length - 1];
                  const catId = sub.category_id || catStack.find((s) => s.type === 'category')?.id;
                  drillInto({ type: 'subcat', id: item.id, name: item.name, category_id: catId });
                }
              };

              return (
                <div key={item.id} className="cat-card">
                  <div className="cat-card-img" onClick={handleDrill}>
                    {img ? (
                      <img src={resolveImg(img)} alt={name} loading="lazy" />
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', color: 'var(--text-light)' }}>
                        <FiFolder size={36} style={{ color: '#94a3b8' }} />
                        <span style={{ fontSize: '11px', fontWeight: 600 }}>No Image</span>
                      </div>
                    )}
                    {has3Shop && (
                      <div className="cat-card-badge-float">
                        <span className="badge badge-brand" style={{ boxShadow: '0 2px 6px rgba(3,12,84,0.2)' }}>
                          3-Shop Only
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="cat-card-body">
                    <div className="cat-card-name" onClick={handleDrill} title={name}>
                      {name}
                    </div>
                    {item.description ? (
                      <div className="cat-card-desc" title={item.description}>
                        {item.description}
                      </div>
                    ) : (
                      <div className="cat-card-desc" style={{ fontStyle: 'italic', color: 'var(--text-light)' }}>
                        Click &apos;Open&apos; to view contents
                      </div>
                    )}
                    <div className="cat-card-footer">
                      <button
                        type="button"
                        className="btn-open-cat"
                        onClick={handleDrill}
                      >
                        <span>Open</span>
                        <FiArrowRight size={14} />
                      </button>
                      <button
                        type="button"
                        className="btn-icon-action"
                        title="Edit"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (catStack.length === 0) openEditMainCat(item);
                          else if (currentLevel === 'maincat') openEditCategory(item);
                          else if (currentLevel === 'category') {
                            const cat = catStack[catStack.length - 1];
                            openEditSubcat(item, cat.id);
                          } else if (currentLevel === 'subcat') {
                            const sub = catStack[catStack.length - 1];
                            const catId = sub.category_id || catStack.find((s) => s.type === 'category')?.id;
                            openEditSubcat(item, catId);
                          }
                        }}
                      >
                        <FiEdit2 size={13} />
                      </button>
                      <button
                        type="button"
                        className="btn-icon-action delete"
                        title="Delete"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (catStack.length === 0) deleteMainCat(item.id);
                          else if (currentLevel === 'maincat') deleteCategory(item.id);
                          else deleteSubcat(item.id);
                        }}
                      >
                        <FiTrash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : currentLevel === 'subcat' && leafProducts.length > 0 ? (
        filteredLeafProducts.length === 0 ? (
          <div className="card" style={{ padding: '40px 20px', textAlign: 'center', background: '#ffffff', border: '1px solid var(--border)' }}>
            <div style={{ marginBottom: '8px', display: 'flex', justifyContent: 'center' }}>
              <FiSearch size={32} style={{ color: 'var(--text-light)' }} />
            </div>
            <h4 style={{ fontWeight: 700, color: 'var(--text-heading)', marginBottom: '4px' }}>
              No products matching &ldquo;{searchQuery}&rdquo;
            </h4>
            <button className="btn btn-outline btn-sm" style={{ marginTop: '10px' }} onClick={() => setSearchQuery('')}>
              Clear Filter
            </button>
          </div>
        ) : (
          <div className="cat-prod-grid">
            {filteredLeafProducts.map((p) => (
              <div key={p.id} className="cat-prod-card">
                <div className="cat-prod-thumb">
                  {p.images && p.images[0] ? (
                    <img src={resolveImg(p.images[0])} alt={p.name} loading="lazy" />
                  ) : (
                    <FiBox size={36} style={{ color: '#94a3b8' }} />
                  )}
                </div>
                <div className="cat-prod-body">
                  <div className="cat-prod-title" title={p.name}>{p.name}</div>
                  {p.sku_id && <div className="cat-prod-sku">{p.sku_id}</div>}
                  <div className="cat-prod-footer">
                    <button
                      type="button"
                      className="btn btn-sm btn-outline"
                      style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}
                      onClick={() => {
                        setEditProductId(p.id);
                        setProductModalOpen(true);
                      }}
                    >
                      <FiEdit2 size={13} /> Edit
                    </button>
                    <button
                      type="button"
                      className="btn-icon-action delete"
                      title="Delete Product"
                      onClick={() => deleteLeafProduct(p.id)}
                    >
                      <FiTrash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        <div className="card empty-state" style={{ padding: '50px 20px', textAlign: 'center', background: '#ffffff', border: '1px solid var(--border)' }}>
          <div className="empty-icon" style={{ marginBottom: '12px', display: 'flex', justifyContent: 'center' }}>
            <FiFolder size={44} style={{ color: '#94a3b8' }} />
          </div>
          <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-heading)', marginBottom: '6px' }}>
            {currentLevel === 'subcat'
              ? 'No products or sub-subcategories yet'
              : 'No categories created yet'}
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', maxWidth: '420px', margin: '0 auto 16px', lineHeight: 1.5 }}>
            {currentLevel === 'subcat'
              ? 'You can create a finer sub-subcategory or add your first product directly into this subcategory.'
              : 'Start organizing your catalog by adding the first category item to this section.'}
          </p>

          <div>
            {catStack.length === 0 && (
              <button className="btn btn-primary" onClick={openAddMainCat} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <FiPlus size={15} /> Create First Main Category
              </button>
            )}
            {currentLevel === 'maincat' && (
              <button
                className="btn btn-primary"
                onClick={() => openAddCategory(catStack[catStack.length - 1].id)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <FiPlus size={15} /> Create First Category
              </button>
            )}
            {currentLevel === 'category' && (
              <button
                className="btn btn-primary"
                onClick={() => openAddSubcat(catStack[catStack.length - 1].id, null)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <FiPlus size={15} /> Create First Subcategory
              </button>
            )}
            {currentLevel === 'subcat' && (
              <div style={{ display: 'inline-flex', gap: '10px' }}>
                <button
                  className="btn btn-outline"
                  onClick={() => {
                    const sub = catStack[catStack.length - 1];
                    const catId = sub.category_id || catStack.find((s) => s.type === 'category')?.id;
                    openAddSubcat(catId, sub.id);
                  }}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <FiPlus size={15} /> Add Sub-subcategory
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    setEditProductId(null);
                    setProductModalOpen(true);
                  }}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <FiPlus size={15} /> Add Product
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── MAIN CATEGORY MODAL ── */}
      <GenericModal
        isOpen={mainCatModal.open}
        title={mainCatModal.item ? 'Edit Main Category' : 'Add Main Category'}
        onSave={saveMainCat}
        onCancel={() => setMainCatModal({ open: false, item: null })}
        loading={modalSaving}
      >
        <div className="form-group">
          <label>Title *</label>
          <input
            type="text"
            placeholder="e.g., Men, Women, Kids"
            value={formTitle}
            onChange={(e) => setFormTitle(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label>Image</label>
          <input
            type="text"
            placeholder="URL or upload an image"
            value={formImage}
            onChange={(e) => setFormImage(e.target.value)}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '8px' }}>
            <label className="btn btn-outline btn-sm" style={{ cursor: 'pointer', margin: 0, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <FiUpload size={14} /> Upload Image
              <input
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleUploadSingleImg}
              />
            </label>
            {formImage && (
              <button
                type="button"
                className="btn btn-sm btn-outline"
                onClick={() => setFormImage('')}
                style={{ color: '#ef4444' }}
              >
                Clear
              </button>
            )}
          </div>
          {formImage && (
            <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <img
                src={resolveImg(formImage)}
                alt="Preview"
                style={{
                  width: '60px',
                  height: '60px',
                  objectFit: 'cover',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                }}
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Image preview</span>
            </div>
          )}
        </div>
        <div className="form-group">
          <label>3-Shop Restriction</label>
          <select
            value={form3Shop ? 'true' : 'false'}
            onChange={(e) => setForm3Shop(e.target.value === 'true')}
          >
            <option value="false">No (Available everywhere)</option>
            <option value="true">Yes (3-Shop Restriction)</option>
          </select>
        </div>
      </GenericModal>

      {/* ── CATEGORY MODAL ── */}
      <GenericModal
        isOpen={catModal.open}
        title={catModal.item ? 'Edit Category' : 'Add Category'}
        onSave={saveCategory}
        onCancel={() => setCatModal({ open: false, item: null, mainCatId: null })}
        loading={modalSaving}
      >
        <div className="form-group">
          <label>Name *</label>
          <input
            type="text"
            placeholder="e.g., Clothing, Footwear"
            value={formTitle}
            onChange={(e) => setFormTitle(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label>Image</label>
          <input
            type="text"
            placeholder="URL or upload an image"
            value={formImage}
            onChange={(e) => setFormImage(e.target.value)}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '8px' }}>
            <label className="btn btn-outline btn-sm" style={{ cursor: 'pointer', margin: 0, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <FiUpload size={14} /> Upload Image
              <input
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleUploadSingleImg}
              />
            </label>
            {formImage && (
              <button
                type="button"
                className="btn btn-sm btn-outline"
                onClick={() => setFormImage('')}
                style={{ color: '#ef4444' }}
              >
                Clear
              </button>
            )}
          </div>
          {formImage && (
            <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <img
                src={resolveImg(formImage)}
                alt="Preview"
                style={{
                  width: '60px',
                  height: '60px',
                  objectFit: 'cover',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                }}
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Image preview</span>
            </div>
          )}
        </div>
        <div className="form-group">
          <label>Description</label>
          <textarea
            rows={2}
            placeholder="Brief description of this category"
            value={formDesc}
            onChange={(e) => setFormDesc(e.target.value)}
          />
        </div>
      </GenericModal>

      {/* ── SUBCATEGORY MODAL ── */}
      <GenericModal
        isOpen={subcatModal.open}
        title={
          subcatModal.item
            ? 'Edit Subcategory'
            : subcatModal.parentId
              ? 'Add Sub-subcategory'
              : 'Add Subcategory'
        }
        onSave={saveSubcat}
        onCancel={() => setSubcatModal({ open: false, item: null, categoryId: null, parentId: null })}
        loading={modalSaving}
      >
        <div className="form-group">
          <label>Name *</label>
          <input
            type="text"
            placeholder="e.g., T-Shirts, Formal Shirts"
            value={formTitle}
            onChange={(e) => setFormTitle(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label>Image</label>
          <input
            type="text"
            placeholder="URL or upload an image"
            value={formImage}
            onChange={(e) => setFormImage(e.target.value)}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '8px' }}>
            <label className="btn btn-outline btn-sm" style={{ cursor: 'pointer', margin: 0, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <FiUpload size={14} /> Upload Image
              <input
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleUploadSingleImg}
              />
            </label>
            {formImage && (
              <button
                type="button"
                className="btn btn-sm btn-outline"
                onClick={() => setFormImage('')}
                style={{ color: '#ef4444' }}
              >
                Clear
              </button>
            )}
          </div>
          {formImage && (
            <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <img
                src={resolveImg(formImage)}
                alt="Preview"
                style={{
                  width: '60px',
                  height: '60px',
                  objectFit: 'cover',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                }}
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Image preview</span>
            </div>
          )}
        </div>
        <div className="form-group">
          <label>Description</label>
          <textarea
            rows={2}
            placeholder="Brief description of this subcategory"
            value={formDesc}
            onChange={(e) => setFormDesc(e.target.value)}
          />
        </div>
      </GenericModal>

      {/* ── CONFIRM DELETE MODAL ── */}
      <ConfirmModal
        isOpen={confirmModal.open}
        message={confirmModal.message}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal({ open: false })}
      />

      <ProductModal
        isOpen={productModalOpen}
        productId={editProductId}
        onClose={() => setProductModalOpen(false)}
        onSuccess={loadCurrentLevel}
      />
    </div>
  );
}
