/**
 * VariationsManager
 *
 * Reusable admin UI to create / edit / delete variations for a service or product.
 * Each variation has a name, description, price, a multi-image gallery, and specs
 * (key-value pairs).
 *
 * Usage:
 *   <VariationsManager
 *     variations={service.variations}
 *     parentId={service.id}
 *     parentType="service"
 *     token={token}
 *     onSaved={updatedVariations => setVariations(updatedVariations)}
 *   />
 */

import React, { useState } from 'react';
import {
  Plus, Trash2, Save, X, Upload, Loader2, ChevronDown, ChevronUp, GripVertical,
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
  };
}

interface Props {
  variations: Variation[];
  parentId: number;
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
    const payload = {
      ...form,
      colors,
      colorImages,
    };
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
      <div className="border border-gray-700 rounded-sm p-5 space-y-5 bg-brand-darker">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-bold uppercase tracking-widest text-brand-orange">
            {editingId === 'new' ? 'New Variation' : 'Edit Variation'}
          </h4>
          <button type="button" onClick={cancel} className="text-gray-500 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {saveError && (
          <div className="text-red-400 text-xs bg-red-900/20 border border-red-500/30 px-3 py-2 rounded-sm">
            {saveError}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-widest text-gray-500">Name *</label>
              <input
                required
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                className="w-full bg-brand-dark border border-gray-700 text-white px-3 py-2 text-sm focus:outline-none focus:border-brand-orange rounded-sm"
                placeholder="e.g. Basic Package"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-widest text-gray-500">Price</label>
              <input
                value={form.price}
                onChange={e => setForm(p => ({ ...p, price: e.target.value }))}
                className="w-full bg-brand-dark border border-gray-700 text-white px-3 py-2 text-sm focus:outline-none focus:border-brand-orange rounded-sm"
                placeholder="e.g. ₱15,000"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold uppercase tracking-widest text-gray-500">Description</label>
            <textarea
              rows={2}
              value={form.description}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              className="w-full bg-brand-dark border border-gray-700 text-white px-3 py-2 text-sm focus:outline-none focus:border-brand-orange rounded-sm resize-none"
              placeholder="Brief description of this variation…"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold uppercase tracking-widest text-gray-500">
              Colors <span className="font-normal text-gray-600">(optional)</span>
            </label>
            <input
              value={form.colorsCsv}
              onChange={e => setForm(p => ({ ...p, colorsCsv: e.target.value }))}
              className="w-full bg-brand-dark border border-gray-700 text-white px-3 py-2 text-sm focus:outline-none focus:border-brand-orange rounded-sm"
              placeholder="e.g. Red, Matte Black, Gloss White"
            />
          </div>

          {parsedColors.length > 0 && (
            <div className="space-y-3">
              <label className="text-xs font-bold uppercase tracking-widest text-gray-500">
                Color Images
              </label>
              {parsedColors.map(color => {
                const colorUrls = form.colorImages[color] ?? [];
                return (
                  <div key={color} className="border border-gray-800 rounded-sm p-3 bg-brand-dark/40 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold uppercase tracking-widest text-gray-300">{color}</p>
                      <label className={`flex items-center gap-1.5 px-2.5 py-1 border border-gray-700 text-gray-400 hover:text-white hover:border-brand-orange text-[10px] font-bold uppercase tracking-widest rounded-sm cursor-pointer transition-colors ${imgBusy ? 'opacity-60 pointer-events-none' : ''}`}>
                        {imgBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                        Add
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
                      <div className="grid grid-cols-4 gap-2">
                        {colorUrls.map((url, idx) => (
                          <div key={idx} className="relative group aspect-square rounded-sm overflow-hidden border border-gray-700 bg-gray-800">
                            <img src={url} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            <button
                              type="button"
                              onClick={() => removeColorImage(color, idx)}
                              className="absolute top-1 right-1 p-0.5 bg-black/70 hover:bg-red-600 text-white rounded-sm opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-600 text-xs italic">No images for this color yet.</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Images */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-widest text-gray-500">
                Images <span className="font-normal text-gray-600">({form.images.length})</span>
              </label>
              <label className={`flex items-center gap-1.5 px-3 py-1.5 border border-gray-700 text-gray-400 hover:text-white hover:border-brand-orange text-xs font-bold uppercase tracking-widest rounded-sm cursor-pointer transition-colors ${imgBusy ? 'opacity-60 pointer-events-none' : ''}`}>
                {imgBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                Add Image
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
            {form.images.length > 0 && (
              <div className="grid grid-cols-4 gap-2">
                {form.images.map((url, idx) => (
                  <div key={idx} className="relative group aspect-square rounded-sm overflow-hidden border border-gray-700 bg-gray-800">
                    <img src={url} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    {idx === 0 && (
                      <span className="absolute top-1 left-1 text-[9px] font-bold bg-brand-orange text-white px-1 rounded-sm">Cover</span>
                    )}
                    <button
                      type="button"
                      onClick={() => removeImage(idx)}
                      className="absolute top-1 right-1 p-0.5 bg-black/70 hover:bg-red-600 text-white rounded-sm opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {form.images.length === 0 && (
              <p className="text-gray-600 text-xs italic">No images yet — upload one above.</p>
            )}
          </div>

          {/* Specs */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-widest text-gray-500">Specs</label>
              <button
                type="button"
                onClick={addSpec}
                className="flex items-center gap-1 text-xs font-bold uppercase tracking-widest text-gray-400 hover:text-brand-orange transition-colors"
              >
                <Plus className="w-3 h-3" /> Add Spec
              </button>
            </div>
            {form.specs.map((spec, idx) => (
              <div key={idx} className="flex gap-2 items-center">
                <GripVertical className="w-3 h-3 text-gray-700 shrink-0" />
                <input
                  value={spec.label}
                  onChange={e => updateSpec(idx, 'label', e.target.value)}
                  placeholder="Label (e.g. Beam Pattern)"
                  className="flex-1 bg-brand-dark border border-gray-700 text-white px-2 py-1.5 text-xs focus:outline-none focus:border-brand-orange rounded-sm"
                />
                <input
                  value={spec.value}
                  onChange={e => updateSpec(idx, 'value', e.target.value)}
                  placeholder="Value (e.g. D-shape)"
                  className="flex-1 bg-brand-dark border border-gray-700 text-white px-2 py-1.5 text-xs focus:outline-none focus:border-brand-orange rounded-sm"
                />
                <button type="button" onClick={() => removeSpec(idx)} className="text-gray-600 hover:text-red-400 transition-colors shrink-0">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            {form.specs.length === 0 && (
              <p className="text-gray-600 text-xs italic">No specs yet — add one above.</p>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold uppercase tracking-widest text-gray-500">Sort Order</label>
            <input
              type="number"
              min={0}
              value={form.sortOrder}
              onChange={e => setForm(p => ({ ...p, sortOrder: parseInt(e.target.value) || 0 }))}
              className="w-24 bg-brand-dark border border-gray-700 text-white px-3 py-2 text-sm focus:outline-none focus:border-brand-orange rounded-sm"
            />
          </div>

          <div className="flex gap-3 pt-2 border-t border-gray-800">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-1.5 bg-brand-orange text-white px-5 py-2 text-xs font-bold uppercase tracking-widest hover:bg-orange-600 transition-colors disabled:opacity-60 rounded-sm"
            >
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
              {editingId === 'new' ? 'Add Variation' : 'Save'}
            </button>
            <button
              type="button"
              onClick={cancel}
              className="px-4 py-2 border border-gray-700 text-gray-400 hover:text-white text-xs font-bold uppercase tracking-widest transition-colors rounded-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    );
  }

  // ── Variations list view ───────────────────────────────────────────────────

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setCollapsed(c => !c)}
          className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-gray-400 hover:text-white transition-colors"
        >
          {collapsed ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
          Variations ({variations.length})
        </button>
        <button
          type="button"
          onClick={openNew}
          className="flex items-center gap-1.5 px-3 py-1.5 border border-dashed border-gray-600 text-gray-400 hover:text-brand-orange hover:border-brand-orange text-xs font-bold uppercase tracking-widest rounded-sm transition-colors"
        >
          <Plus className="w-3 h-3" /> Add Variation
        </button>
      </div>

      {saveError && (
        <div className="text-red-400 text-xs bg-red-900/20 border border-red-500/30 px-3 py-2 rounded-sm">
          {saveError}
        </div>
      )}

      {!collapsed && (
        <div className="space-y-2">
          {variations.length === 0 && (
            <p className="text-gray-600 text-xs italic px-1">
              No variations yet. Add one to give customers package options with their own images and specs.
            </p>
          )}
          {variations.map(v => (
            <div key={v.id} className="flex items-start gap-3 p-3 border border-gray-800 rounded-sm bg-brand-darker">
              {v.images[0] && (
                <img
                  src={v.images[0]}
                  alt={v.name}
                  className="w-12 h-12 object-cover rounded-sm border border-gray-700 shrink-0"
                  referrerPolicy="no-referrer"
                />
              )}
              <div className="flex-grow min-w-0">
                <p className="text-white text-sm font-bold truncate">{v.name}</p>
                {v.price && (
                  <p className="text-brand-orange text-xs font-bold">{v.price}</p>
                )}
                <div className="flex gap-2 mt-1 text-xs text-gray-600">
                  <span>{v.images.length} image{v.images.length !== 1 ? 's' : ''}</span>
                  {v.specs.length > 0 && <span>{v.specs.length} spec{v.specs.length !== 1 ? 's' : ''}</span>}
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => openEdit(v)}
                  className="px-2 py-1 border border-gray-700 text-gray-400 hover:border-brand-orange hover:text-brand-orange text-xs font-bold uppercase rounded-sm transition-colors"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(v.id)}
                  disabled={deleting === v.id}
                  className="p-1 border border-gray-700 text-gray-500 hover:border-red-500/50 hover:text-red-400 rounded-sm transition-colors disabled:opacity-50"
                >
                  {deleting === v.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
