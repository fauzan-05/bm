// lib/drafts.js
// Storage and helpers for product drafts

const STORAGE_KEY = 'bm_product_drafts';

const INITIAL_DRAFTS = [
  {
    id: 'draft-1',
    name: 'Organic Wildflower Honey 500g',
    brand_id: null,
    brand_name: 'BetterMend Organics',
    category_id: null,
    category_name: 'Groceries & Staples',
    subcategory_id: null,
    description: '100% pure raw unpasteurized organic wildflower honey sourced from certified beekeepers.',
    is_veg: true,
    gst_percent: 5,
    images: [],
    search_keywords: ['honey', 'organic', 'raw honey'],
    custom_fields: [{ label: 'Weight', value: '500g' }],
    default_size: '',
    default_color: '',
    default_unit_id: null,
    status: 'draft',
    created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 2).toISOString(),
  },
  {
    id: 'draft-2',
    name: 'Premium Cotton T-Shirt Navy',
    brand_id: null,
    brand_name: 'BetterMend Apparel',
    category_id: null,
    category_name: 'Clothing',
    subcategory_id: null,
    description: '220 GSM bio-washed combed cotton t-shirt with reinforced crew neck stitch.',
    is_veg: true,
    gst_percent: 12,
    images: [],
    search_keywords: ['cotton', 'tshirt', 'navy'],
    custom_fields: [{ label: 'Fit', value: 'Regular Fit' }],
    default_size: 'L',
    default_color: 'Navy Blue',
    default_unit_id: null,
    status: 'draft',
    created_at: new Date(Date.now() - 86400000).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 5).toISOString(),
  },
  {
    id: 'draft-3',
    name: 'Almond Milk Unsweetened 1L',
    brand_id: null,
    brand_name: 'NutriLife',
    category_id: null,
    category_name: 'Beverages',
    subcategory_id: null,
    description: 'Plant-based dairy-free unsweetened almond beverage enriched with calcium and Vitamin D.',
    is_veg: true,
    gst_percent: 5,
    images: [],
    search_keywords: ['almond milk', 'vegan', 'dairy free'],
    custom_fields: [{ label: 'Volume', value: '1000ml' }],
    default_size: '',
    default_color: '',
    default_unit_id: null,
    status: 'draft',
    created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    updated_at: new Date(Date.now() - 86400000).toISOString(),
  },
];

export function getDrafts() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_DRAFTS));
      return INITIAL_DRAFTS;
    }
    return JSON.parse(raw);
  } catch {
    return INITIAL_DRAFTS;
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
