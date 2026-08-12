import React, { useState } from 'react';
import {
  Plus, Trash2, Save, X, Upload, Loader2, ChevronDown, ChevronUp,
  GripVertical, Layers, Tag, Image as ImageIcon, SlidersHorizontal,
  Box, Pencil, AlertCircle, Sparkles
} from 'lucide-react';
import {
  createServiceVariationApi, updateServiceVariationApi, deleteServiceVariationApi,
  createProductVariationApi, updateProductVariationApi, deleteProductVariationApi,
  uploadAdminImageApi,
} from '../services/api';
import type { ServiceVariation, ProductVariation, ServiceVariationSpec, ProductVariationSpec } from '../types';

type Variation = ServiceVariation | ProductVariation;
type Spec = ServiceVariationSpec | ProductVariationSpec;

interface VariationForm {
  name: string;
  description: string;
  price: string;
  images: string[];
  specs: Spec[];
  colorsCsv: string;
  colorImages: Record<string, string[]>;
  sortOrder: number;
  trackStock: boolean;
  stockQty: number;
}

const EMPTY_FORM: VariationForm = {
  name: '',
  description: '',
  price: '',
  images: [],
  specs: [],
  colorsCsv: '',
  colorImages: {},
  sortOrder: 0,
  trackStock: true,
  stockQty: 0,
};

function variationToForm(v: Variation): VariationForm {
  return {
    name:        v.name,
    description: v.description,
    price:       v.price,
    images:      [...v.images],
    specs:       v.specs.map(s => ({ ...s })),
    colorsCsv:   (v.colors ?? []).join(', '),
    colorImages: { ...(v.colorImages ?? {}) },
    sortOrder:   v.sortOrder,
    trackStock:  'trackStock' in v ? (v.trackStock ?? true) : true,
    stockQty:    'stockQty' in v ? (v.stockQty ?? 0) : 0,
  };
}

interface Props {
  variations: Variation[];
  parentId: number | string;
  parentType: 'service' | 'product';
  token: string;
  onSaved: (updated: Variation[]) => void;
}

const UPLOAD_MAX_MB = 10;

export default function VariationsManager({ variations, parentId, parentType, token, onSaved }: Props) {
  const [editingId,  setEditingId]  = useState<number | 'new' | null>(null);
  const [form,       setForm]       = useState<VariationForm>(EMPTY_FORM);
  const [saving,     setSaving]     = useState(false);
  const [saveError,  setSaveError]  = useState<string | null>(null);
  const [deleting,   setDeleting]   = useState<number | null>(null);
  const [imgBusy,    setImgBusy]    = useState(false);
  const [collapsed,  setCollapsed]  = useState(false);

  const createVariation = parentType === 'service'
    ? (data: Partial<Omit<ServiceVariation, 'id' | 'serviceId'>>) =>
        createServiceVariationApi(token, parentId, data)
    : (data: Partial<Omit<ProductVariation, 'id' | 'productId'>>) =>
        createProductVariationApi(token, parentId, data);

  const updateVariation = parentType === 'service'
    ? (vid: number, data: Partial<Omit<ServiceVariation, 'id' | 'serviceId'>>) =>
        updateServiceVariationApi(token, parentId, vid, data)
    : (vid: number, data: Partial<Omit<ProductVariation, 'id' | 'productId'>>) =>
        updateProductVariationApi(token, parentId, vid, data);

  const deleteVariation = parentType === 'service'
    ? (vid: number) => deleteServiceVariationApi(token, parentId, vid)
    : (vid: number) => deleteProductVariationApi(token, parentId, vid);

  const openNew = () => {
    setForm({ ...EMPTY_FORM, sortOrder: variations.length });
    setSaveError(null);
    setEditingId('new');
  };

  const openEdit = (v: Variation) => {
    setForm(variationToForm(v));
    setSaveError(null);
    setEditingId(v.id);
  };

  const cancel = () => {
    setEditingId(null);
    setSaveError(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setSaveError('Variation name is required.'); return; }
    const colors = form.colorsCsv
      .split(',')
      .map(color => color.trim())
      .filter(Boolean);
    const colorImages = colors.reduce<Record<string, string[]>>((acc, color) => {
      const urls = form.colorImages[color] ?? [];
      const filtered = urls.map(url => url.trim()).filter(Boolean);
      if (filtered.length > 0) {
        acc[color] = filtered;
      }
      return acc;
    }, {});
    const payloadBase = {
      ...form,
      colors,
      colorImages,
    };
    const payload = parentType === 'product'
      ? { ...payloadBase, trackStock: form.trackStock, stockQty: Math.max(0, form.stockQty) }
      : payloadBase;
    setSaving(true);
    setSaveError(null);
    try {
      let result: Variation;
      if (editingId === 'new') {
        const { variation } = await createVariation(payload as never);
        result = variation;
        onSaved([...variations, result]);
      } else {
        const { variation } = await updateVariation(editingId as number, payload as never);
        result = variation;
        onSaved(variations.map(v => (v.id === result.id ? result : v)));
      }
      setEditingId(null);
    } catch (err: unknown) {
      setSaveError((err as Error)?.message ?? 'Failed to save variation.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (vid: number) => {
    setDeleting(vid);
    try {
      await deleteVariation(vid);
      onSaved(variations.filter(v => v.id !== vid));
    } catch (err: unknown) {
      setSaveError((err as Error)?.message ?? 'Failed to delete variation.');
    } finally {
      setDeleting(null);
    }
  };

  // ── Image helpers ──────────────────────────────────────────────────────────

  const handleUploadImage = async (file: File) => {
    if (file.size > UPLOAD_MAX_MB * 1024 * 1024) {
      setSaveError(`Image must be under ${UPLOAD_MAX_MB} MB.`);
      return;
    }
    setImgBusy(true);
    try {
      const url = await uploadAdminImageApi(token, file, parentType === 'service' ? 'services' : 'products');
      setForm(p => ({ ...p, images: [...p.images, url] }));
    } catch (err: unknown) {
      setSaveError((err as Error)?.message ?? 'Image upload failed.');
    } finally {
      setImgBusy(false);
    }
  };

  const removeImage = (idx: number) =>
    setForm(p => ({ ...p, images: p.images.filter((_, i) => i !== idx) }));

  const handleUploadColorImage = async (color: string, file: File) => {
    if (file.size > UPLOAD_MAX_MB * 1024 * 1024) {
      setSaveError(`Image must be under ${UPLOAD_MAX_MB} MB.`);
      return;
    }
    setImgBusy(true);
    try {
      const url = await uploadAdminImageApi(token, file, parentType === 'service' ? 'services' : 'products');
      setForm(p => ({
        ...p,
        colorImages: {
          ...p.colorImages,
          [color]: [...(p.colorImages[color] ?? []), url],
        },
      }));
    } catch (err: unknown) {
      setSaveError((err as Error)?.message ?? 'Image upload failed.');
    } finally {
      setImgBusy(false);
    }
  };

  const removeColorImage = (color: string, idx: number) => {
    setForm(p => ({
      ...p,
      colorImages: {
        ...p.colorImages,
        [color]: (p.colorImages[color] ?? []).filter((_, i) => i !== idx),
      },
    }));
  };

  // ── Spec helpers ────────────────────────────────────────────────────────────

  const addSpec = () =>
    setForm(p => ({ ...p, specs: [...p.specs, { label: '', value: '' }] }));

  const updateSpec = (idx: number, field: 'label' | 'value', val: string) =>
    setForm(p => ({
      ...p,
      specs: p.specs.map((s, i) => (i === idx ? { ...s, [field]: val } : s)),
    }));

  const removeSpec = (idx: number) =>
    setForm(p => ({ ...p, specs: p.specs.filter((_, i) => i !== idx) }));

  const parsedColors = form.colorsCsv
    .split(',')
    .map(color => color.trim())
    .filter(Boolean);

  // ── Render form ─────────────────────────────────────────────────────────────

  if (editingId !== null) {
    return (
      <div className="bg-[#121212] border border-gray-800/90 rounded-2xl p-5 sm:p-6 space-y-6 shadow-2xl animate-fade-in font-sans">
        {/* Modal/Form Header */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-800/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand-orange/10 border border-brand-orange/20 flex items-center justify-center text-brand-orange">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-mono font-bold uppercase tracking-wider text-white">
                {editingId === 'new' ? 'Add New Variation' : 'Edit Variation'}
              </h4>
              <p className="text-[11px] font-mono text-gray-500">Configure package tier, pricing, specifications, and gallery</p>
            </div>
          </div>
          <button
            type="button"
            onClick={cancel}
            className="w-8 h-8 rounded-lg bg-gray-800/60 hover:bg-gray-800 text-gray-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer border border-gray-700/50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {saveError && (
          <div className="flex items-center gap-2 text-xs font-mono text-red-400 bg-red-950/40 border border-red-500/30 p-3 rounded-xl">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{saveError}</span>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-6">
          {/* Section 1: Basic Information */}
          <div className="space-y-4">
            <div className="text-xs font-mono font-bold uppercase tracking-wider text-brand-orange flex items-center gap-2">
              <Tag className="w-3.5 h-3.5" /> Basic Variation Info
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-mono font-bold uppercase tracking-wider text-gray-400">
                  Variation Name <span className="text-brand-orange">*</span>
                </label>
                <input
                  required
                  value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  className="w-full bg-brand-darker border border-gray-800 text-white px-3.5 py-2.5 rounded-xl text-xs font-mono focus:outline-none focus:border-brand-orange placeholder:text-gray-600 transition-colors"
                  placeholder="e.g. Stage 2 Bi-LED Retrofit"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-mono font-bold uppercase tracking-wider text-gray-400">Price Display</label>
                <input
                  value={form.price}
                  onChange={e => setForm(p => ({ ...p, price: e.target.value }))}
                  className="w-full bg-brand-darker border border-gray-800 text-white px-3.5 py-2.5 rounded-xl text-xs font-mono focus:outline-none focus:border-brand-orange placeholder:text-gray-600 transition-colors"
                  placeholder="e.g. ₱18,500"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-mono font-bold uppercase tracking-wider text-gray-400">Description</label>
              <textarea
                rows={2}
                value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                className="w-full bg-brand-darker border border-gray-800 text-white px-3.5 py-2.5 rounded-xl text-xs font-mono focus:outline-none focus:border-brand-orange placeholder:text-gray-600 resize-none transition-colors"
                placeholder="Brief summary of included components or upgrades..."
              />
            </div>
          </div>

          {/* Section 2: Colors & Color-Specific Galleries */}
          <div className="space-y-4 pt-2 border-t border-gray-800/80">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-mono font-bold uppercase tracking-wider text-gray-400">
                  Colors / Finish Variants <span className="font-normal text-gray-500">(comma-separated)</span>
                </label>
              </div>
              <input
                value={form.colorsCsv}
                onChange={e => setForm(p => ({ ...p, colorsCsv: e.target.value }))}
                className="w-full bg-brand-darker border border-gray-800 text-white px-3.5 py-2.5 rounded-xl text-xs font-mono focus:outline-none focus:border-brand-orange placeholder:text-gray-600 transition-colors"
                placeholder="e.g. Chrome, Matte Black, Gloss Carbon"
              />
            </div>

            {parsedColors.length > 0 && (
              <div className="space-y-3 bg-brand-darker/60 border border-gray-800 p-4 rounded-xl">
                <label className="text-xs font-mono font-bold uppercase tracking-wider text-gray-400 flex items-center gap-2">
                  <ImageIcon className="w-3.5 h-3.5 text-brand-orange" /> Color-Specific Image Galleries
                </label>
                <div className="grid grid-cols-1 gap-3">
                  {parsedColors.map(color => {
                    const colorUrls = form.colorImages[color] ?? [];
                    return (
                      <div key={color} className="border border-gray-800 rounded-xl p-3 bg-brand-dark/60 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-mono font-bold text-gray-200 uppercase tracking-wider px-2 py-0.5 rounded bg-gray-800 border border-gray-700">
                            {color}
                          </span>
                          <label className={`flex items-center gap-1.5 px-3 py-1 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 hover:text-white text-[11px] font-mono font-bold uppercase tracking-wider rounded-lg cursor-pointer transition-all ${imgBusy ? 'opacity-50 pointer-events-none' : ''}`}>
                            {imgBusy ? <Loader2 className="w-3 h-3 animate-spin text-brand-orange" /> : <Upload className="w-3 h-3 text-brand-orange" />}
                            Upload Image
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              disabled={imgBusy}
                              onChange={e => {
                                const file = e.target.files?.[0];
                                if (file) handleUploadColorImage(color, file);
                                e.target.value = '';
                              }}
                            />
                          </label>
                        </div>

                        {colorUrls.length > 0 ? (
                          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                            {colorUrls.map((url, idx) => (
                              <div key={idx} className="relative group aspect-square rounded-lg overflow-hidden border border-gray-700 bg-gray-800">
                                <img src={url} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                <button
                                  type="button"
                                  onClick={() => removeColorImage(color, idx)}
                                  className="absolute top-1 right-1 p-1 bg-black/80 hover:bg-red-600 text-white rounded-md opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-gray-500 text-[11px] font-mono italic">No images uploaded for {color} yet.</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Section 3: General Variation Images */}
          <div className="space-y-3 pt-2 border-t border-gray-800/80">
            <div className="flex items-center justify-between">
              <label className="text-xs font-mono font-bold uppercase tracking-wider text-gray-400 flex items-center gap-2">
                <ImageIcon className="w-3.5 h-3.5 text-brand-orange" /> Main Gallery Images <span className="font-normal text-gray-500">({form.images.length})</span>
              </label>
              <label className={`flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-200 hover:text-white text-xs font-mono font-bold uppercase tracking-wider rounded-lg cursor-pointer transition-all ${imgBusy ? 'opacity-50 pointer-events-none' : ''}`}>
                {imgBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-orange" /> : <Upload className="w-3.5 h-3.5 text-brand-orange" />}
                Add Photo
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={imgBusy}
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) handleUploadImage(file);
                    e.target.value = '';
                  }}
                />
              </label>
            </div>

            {form.images.length > 0 ? (
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2.5">
                {form.images.map((url, idx) => (
                  <div key={idx} className="relative group aspect-square rounded-xl overflow-hidden border border-gray-700/80 bg-gray-900 shadow-md">
                    <img src={url} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    {idx === 0 && (
                      <span className="absolute top-1.5 left-1.5 text-[9px] font-mono font-extrabold bg-brand-orange text-white px-1.5 py-0.5 rounded shadow-sm uppercase tracking-wider">
                        Cover
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => removeImage(idx)}
                      className="absolute top-1.5 right-1.5 p-1 bg-black/80 hover:bg-red-600 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-xs font-mono italic bg-brand-darker p-3 rounded-xl border border-gray-800">
                No gallery photos added yet. Upload photos to display in product/service showcase.
              </p>
            )}
          </div>

          {/* Section 4: Specifications */}
          <div className="space-y-3 pt-2 border-t border-gray-800/80">
            <div className="flex items-center justify-between">
              <label className="text-xs font-mono font-bold uppercase tracking-wider text-gray-400 flex items-center gap-2">
                <SlidersHorizontal className="w-3.5 h-3.5 text-brand-orange" /> Technical Specs
              </label>
              <button
                type="button"
                onClick={addSpec}
                className="flex items-center gap-1.5 text-xs font-mono font-bold uppercase tracking-wider text-brand-orange hover:text-orange-400 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Add Spec
              </button>
            </div>

            {form.specs.length > 0 ? (
              <div className="space-y-2">
                {form.specs.map((spec, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <GripVertical className="w-4 h-4 text-gray-700 shrink-0" />
                    <input
                      value={spec.label}
                      onChange={e => updateSpec(idx, 'label', e.target.value)}
                      placeholder="Label (e.g. Lens Pattern)"
                      className="flex-1 bg-brand-darker border border-gray-800 text-white px-3 py-2 text-xs font-mono focus:outline-none focus:border-brand-orange rounded-xl placeholder:text-gray-600"
                    />
                    <input
                      value={spec.value}
                      onChange={e => updateSpec(idx, 'value', e.target.value)}
                      placeholder="Value (e.g. Cut-off Line)"
                      className="flex-1 bg-brand-darker border border-gray-800 text-white px-3 py-2 text-xs font-mono focus:outline-none focus:border-brand-orange rounded-xl placeholder:text-gray-600"
                    />
                    <button
                      type="button"
                      onClick={() => removeSpec(idx)}
                      className="p-2 text-gray-500 hover:text-red-400 transition-colors shrink-0 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-xs font-mono italic bg-brand-darker p-3 rounded-xl border border-gray-800">
                No technical specifications configured.
              </p>
            )}
          </div>

          {/* Section 5: Order & Stock Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-gray-800/80">
            <div className="space-y-1.5">
              <label className="text-xs font-mono font-bold uppercase tracking-wider text-gray-400">Sort Order Position</label>
              <input
                type="number"
                min={0}
                value={form.sortOrder}
                onChange={e => setForm(p => ({ ...p, sortOrder: parseInt(e.target.value) || 0 }))}
                className="w-full bg-brand-darker border border-gray-800 text-white px-3.5 py-2 text-xs font-mono focus:outline-none focus:border-brand-orange rounded-xl"
              />
            </div>

            {parentType === 'product' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-mono font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                    <Box className="w-3.5 h-3.5 text-brand-orange" /> Stock Quantity
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer select-none text-gray-300 text-xs font-mono font-bold uppercase tracking-wider">
                    <input
                      type="checkbox"
                      checked={form.trackStock}
                      onChange={e => setForm(p => ({ ...p, trackStock: e.target.checked }))}
                      className="accent-brand-orange w-4 h-4 rounded cursor-pointer"
                    />
                    Track Inventory
                  </label>
                </div>
                <input
                  type="number"
                  min={0}
                  value={form.stockQty}
                  disabled={!form.trackStock}
                  onChange={e => setForm(p => ({ ...p, stockQty: Math.max(0, parseInt(e.target.value, 10) || 0) }))}
                  className="w-full bg-brand-darker border border-gray-800 text-white px-3.5 py-2 text-xs font-mono focus:outline-none focus:border-brand-orange rounded-xl disabled:opacity-40"
                />
              </div>
            )}
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-800/90">
            <button
              type="button"
              onClick={cancel}
              className="px-5 py-2.5 border border-gray-700 hover:border-gray-600 text-gray-300 hover:text-white text-xs font-mono font-bold uppercase tracking-wider rounded-xl transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 bg-brand-orange hover:bg-orange-600 text-white px-6 py-2.5 text-xs font-mono font-bold uppercase tracking-wider transition-all disabled:opacity-50 rounded-xl shadow-lg cursor-pointer"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin text-white" /> : <Save className="w-4 h-4" />}
              <span>{editingId === 'new' ? 'Create Variation' : 'Save Changes'}</span>
            </button>
          </div>
        </form>
      </div>
    );
  }

  // ── Variations List View ───────────────────────────────────────────────────

  return (
    <div className="bg-[#121212] border border-gray-800/80 rounded-2xl overflow-hidden shadow-2xl p-5 sm:p-6 space-y-4 font-sans">
      {/* Header Bar */}
      <div className="flex items-center justify-between pb-3 border-b border-gray-800/80">
        <button
          type="button"
          onClick={() => setCollapsed(c => !c)}
          className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-gray-300 hover:text-white transition-colors cursor-pointer"
        >
          {collapsed ? <ChevronDown className="w-4 h-4 text-brand-orange" /> : <ChevronUp className="w-4 h-4 text-brand-orange" />}
          <span className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-brand-orange" />
            <span>Variations ({variations.length})</span>
          </span>
        </button>

        <button
          type="button"
          onClick={openNew}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-brand-orange/10 hover:bg-brand-orange border border-brand-orange/30 text-brand-orange hover:text-white text-xs font-mono font-bold uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" /> Add Variation
        </button>
      </div>

      {saveError && (
        <div className="flex items-center gap-2 text-xs font-mono text-red-400 bg-red-950/40 border border-red-500/30 p-3 rounded-xl">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
          <span>{saveError}</span>
        </div>
      )}

      {/* Variations List */}
      {!collapsed && (
        <div className="space-y-3 pt-1">
          {variations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 px-4 text-center bg-brand-darker/60 border border-gray-800/80 rounded-xl space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-gray-900 border border-gray-800 flex items-center justify-center text-gray-600">
                <Sparkles className="w-6 h-6 text-brand-orange/50" />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-mono font-bold text-gray-300 uppercase tracking-wider">No Variations Configured</p>
                <p className="text-[11px] font-mono text-gray-500 max-w-sm">
                  Add variations to offer multiple tiers, color options, or custom packages with their own photos and specs.
                </p>
              </div>
              <button
                type="button"
                onClick={openNew}
                className="px-4 py-2 bg-brand-orange text-white text-xs font-mono font-bold uppercase tracking-wider rounded-xl transition-all shadow-md cursor-pointer"
              >
                + Create First Variation
              </button>
            </div>
          ) : (
            variations.map(v => (
              <div
                key={v.id}
                className="group relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 border border-gray-800/90 rounded-xl bg-gradient-to-r from-brand-dark/90 via-[#161616] to-brand-dark hover:border-gray-700 transition-all shadow-md"
              >
                <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                  {v.images[0] ? (
                    <img
                      src={v.images[0]}
                      alt={v.name}
                      className="w-14 h-14 object-cover rounded-xl border border-gray-700/80 shrink-0 shadow-sm"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-xl border border-gray-800 bg-gray-900 flex items-center justify-center text-gray-600 shrink-0">
                      <ImageIcon className="w-6 h-6" />
                    </div>
                  )}

                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <p className="text-sm font-mono font-bold text-white truncate">{v.name}</p>
                      {v.price && (
                        <span className="text-xs font-mono font-bold text-brand-orange bg-brand-orange/10 px-2 py-0.5 rounded border border-brand-orange/20">
                          {v.price}
                        </span>
                      )}
                    </div>

                    {v.description && (
                      <p className="text-xs font-mono text-gray-400 line-clamp-1">{v.description}</p>
                    )}

                    <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono text-gray-500 pt-0.5">
                      <span className="flex items-center gap-1">
                        <ImageIcon className="w-3 h-3 text-gray-600" /> {v.images.length} photo{v.images.length !== 1 ? 's' : ''}
                      </span>
                      {v.specs.length > 0 && (
                        <span className="flex items-center gap-1">
                          <SlidersHorizontal className="w-3 h-3 text-gray-600" /> {v.specs.length} spec{v.specs.length !== 1 ? 's' : ''}
                        </span>
                      )}
                      {v.colors && v.colors.length > 0 && (
                        <span className="flex items-center gap-1">
                          <Tag className="w-3 h-3 text-gray-600" /> {v.colors.length} color{v.colors.length !== 1 ? 's' : ''}
                        </span>
                      )}
                      {parentType === 'product' && 'trackStock' in v && v.trackStock && (
                        <span className="flex items-center gap-1 text-gray-400">
                          <Box className="w-3 h-3 text-gray-500" /> Stock: {'stockQty' in v ? (v.stockQty ?? 0) : 0}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  <button
                    type="button"
                    onClick={() => openEdit(v)}
                    className="px-3.5 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-200 hover:text-white text-xs font-mono font-bold uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <Pencil className="w-3.5 h-3.5 text-brand-orange" /> Edit
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDelete(v.id)}
                    disabled={deleting === v.id}
                    className="p-1.5 bg-gray-800/80 hover:bg-red-950/60 border border-gray-700 hover:border-red-500/50 text-gray-400 hover:text-red-400 rounded-xl transition-all disabled:opacity-50 cursor-pointer"
                    title="Delete variation"
                  >
                    {deleting === v.id ? <Loader2 className="w-3.5 h-3.5 animate-spin text-red-400" /> : <Trash2 className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
