// lib/drafts.js
// Storage and helpers for product drafts

const STORAGE_KEY = 'bm_product_drafts';

export function getDrafts() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
      return [];
    }
    const drafts = JSON.parse(raw);
    if (!Array.isArray(drafts)) return [];

    // Remove sample entries written by earlier versions of the app.
    const userDrafts = drafts.filter(
      (draft) => !['draft-1', 'draft-2', 'draft-3'].includes(draft.id)
    );
    if (userDrafts.length !== drafts.length) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(userDrafts));
    }
    return userDrafts;
  } catch {
    return [];
  }
}

export const SOURCE_PAGES = [
  { key: 'ALL', label: 'All Pages', icon: '📑' },
  { key: 'products', label: 'Products', icon: '📦' },
  { key: 'categories', label: 'Categories', icon: '📁' },
  { key: 'brands', label: 'Brands', icon: '🏷️' },
  { key: 'colors', label: 'Colors', icon: '🎨' },
  { key: 'sizes', label: 'Sizes', icon: '📏' },
  { key: 'units', label: 'Units', icon: '⚖️' },
];

export function getSourceLabel(sourceKey) {
  const match = SOURCE_PAGES.find((s) => s.key === sourceKey);
  return match ? match.label : 'Products';
}

export function saveDraft(draft) {
  if (typeof window === 'undefined') return draft;
  const current = getDrafts();
  const now = new Date().toISOString();

  const source_page = draft.source_page || 'products';
  const source_label = draft.source_label || getSourceLabel(source_page);
  const item_type = draft.item_type || source_page;

  let updatedList;
  let savedItem;

  if (draft.id) {
    savedItem = {
      ...draft,
      source_page,
      source_label,
      item_type,
      updated_at: now,
    };
    updatedList = current.map((item) => (item.id === draft.id ? savedItem : item));
    // If not found in list, append it
    if (!current.some((item) => item.id === draft.id)) {
      updatedList.push(savedItem);
    }
  } else {
    savedItem = {
      ...draft,
      id: 'draft-' + Date.now(),
      source_page,
      source_label,
      item_type,
      created_at: now,
      updated_at: now,
      status: 'draft',
    };
    updatedList = [savedItem, ...current];
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedList));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('bm_drafts_updated'));
  }
  return savedItem;
}

export function archiveToDrafts(item) {
  if (typeof window === 'undefined') return item;
  const sourcePage = item.source_page || 'products';
  const sourceLabel = item.source_label || getSourceLabel(sourcePage);

  const archivedItem = {
    id: 'trash-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
    name: item.name || item.title || item.label || 'Untitled Deleted Item',
    source_page: sourcePage,
    source_label: sourceLabel,
    item_type: item.item_type || sourcePage,
    original_data: item.original_data || item,
    description: item.description || null,
    images: Array.isArray(item.images)
      ? item.images
      : item.image
      ? [item.image]
      : [],
    brand_id: item.brand_id || null,
    brand_name: item.brand_name || null,
    category_id: item.category_id || null,
    category_name: item.category_name || null,
    subcategory_id: item.subcategory_id || null,
    is_veg: item.is_veg,
    gst_percent: item.gst_percent,
    variants: item.variants || [],
    custom_fields: item.custom_fields || [],
    is_deleted: true,
    deleted_at: new Date().toISOString(),
    status: 'draft',
  };

  return saveDraft(archivedItem);
}

export function archiveManyToDrafts(items) {
  if (typeof window === 'undefined' || !Array.isArray(items) || items.length === 0) return [];
  const current = getDrafts();
  const archivedItems = items.map((item, idx) => {
    const sourcePage = item.source_page || 'products';
    const sourceLabel = item.source_label || getSourceLabel(sourcePage);
    return {
      id: 'trash-' + Date.now() + '-' + idx + '-' + Math.random().toString(36).substr(2, 4),
      name: item.name || item.title || item.label || 'Untitled Deleted Item',
      source_page: sourcePage,
      source_label: sourceLabel,
      item_type: item.item_type || sourcePage,
      original_data: item.original_data || item,
      description: item.description || null,
      images: Array.isArray(item.images)
        ? item.images
        : item.image
        ? [item.image]
        : [],
      brand_id: item.brand_id || null,
      brand_name: item.brand_name || null,
      category_id: item.category_id || null,
      category_name: item.category_name || null,
      subcategory_id: item.subcategory_id || null,
      is_veg: item.is_veg,
      gst_percent: item.gst_percent,
      variants: item.variants || [],
      custom_fields: item.custom_fields || [],
      is_deleted: true,
      deleted_at: new Date().toISOString(),
      status: 'draft',
    };
  });

  const updatedList = [...archivedItems, ...current];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedList));
  window.dispatchEvent(new Event('bm_drafts_updated'));
  return archivedItems;
}

export function deleteDraft(draftId) {
  if (typeof window === 'undefined') return;
  const current = getDrafts();
  const filtered = current.filter((item) => item.id !== draftId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('bm_drafts_updated'));
  }
}

export function clearAllDrafts() {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('bm_drafts_updated'));
  }
}
