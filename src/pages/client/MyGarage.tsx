import { useEffect, useRef, useState } from 'react';
import { Car, ImagePlus, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react';
import type { ClientVehicle } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  fetchMyVehiclesApi,
  createMyVehicleApi,
  updateMyVehicleApi,
  deleteMyVehicleApi,
  uploadMyVehicleImageApi,
} from '../../services/api';

type VehicleForm = {
  make: string;
  model: string;
  year: string;
  imageUrl: string;
  vin: string;
  licensePlate: string;
};

const EMPTY_FORM: VehicleForm = {
  make: '',
  model: '',
  year: '',
  imageUrl: '',
  vin: '',
  licensePlate: '',
};

export default function MyGarage() {
  const { token } = useAuth();
  const { showToast } = useToast();

  const [vehicles, setVehicles] = useState<ClientVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<VehicleForm>(EMPTY_FORM);
  const [imageUploading, setImageUploading] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const loadVehicles = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const { vehicles: data } = await fetchMyVehiclesApi(token);
      setVehicles(data);
    } catch (err) {
      showToast((err as Error).message ?? 'Failed to load vehicles.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadVehicles();
  }, [token]);

  const startCreate = () => {
    setEditingId(0);
    setForm(EMPTY_FORM);
  };

  const startEdit = (vehicle: ClientVehicle) => {
    setEditingId(vehicle.id);
    setForm({
      make: vehicle.make,
      model: vehicle.model,
      year: vehicle.year,
      imageUrl: vehicle.imageUrl ?? '',
      vin: vehicle.vin ?? '',
      licensePlate: vehicle.licensePlate ?? '',
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const saveVehicle = async () => {
    if (!token) return;
    if (!form.make.trim() || !form.model.trim() || !form.year.trim()) {
      showToast('Make, model, and year are required.', 'error');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        make: form.make.trim(),
        model: form.model.trim(),
        year: form.year.trim(),
        imageUrl: form.imageUrl.trim() || undefined,
        vin: form.vin.trim() || undefined,
        licensePlate: form.licensePlate.trim() || undefined,
      };

      if (editingId && editingId > 0) {
        const { vehicle } = await updateMyVehicleApi(token, editingId, payload);
        setVehicles(prev => prev.map(v => (v.id === vehicle.id ? vehicle : v)));
        showToast('Vehicle updated.', 'success');
      } else {
        const { vehicle } = await createMyVehicleApi(token, payload);
        setVehicles(prev => [vehicle, ...prev]);
        showToast('Vehicle added to your garage.', 'success');
      }

      cancelEdit();
    } catch (err) {
      showToast((err as Error).message ?? 'Failed to save vehicle.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const removeVehicle = async (id: number) => {
    if (!token) return;
    setDeletingId(id);
    try {
      await deleteMyVehicleApi(token, id);
      setVehicles(prev => prev.filter(v => v.id !== id));
      showToast('Vehicle removed.', 'success');
      if (editingId === id) {
        cancelEdit();
      }
    } catch (err) {
      showToast((err as Error).message ?? 'Failed to delete vehicle.', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!token) return;
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setImageUploading(true);
    try {
      const url = await uploadMyVehicleImageApi(token, file);
      setForm(prev => ({ ...prev, imageUrl: url }));
      showToast('Vehicle image uploaded.', 'success');
    } catch (err) {
      showToast((err as Error).message ?? 'Failed to upload image.', 'error');
    } finally {
      setImageUploading(false);
    }
  };

  return (
    <div className="space-y-6 w-full">
      <div className="relative overflow-hidden rounded-xl border border-gray-800 bg-gradient-to-br from-brand-darker via-brand-dark to-[#151515] px-6 py-6 md:px-7 md:py-7">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-brand-orange/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-14 left-20 h-32 w-32 rounded-full bg-amber-400/10 blur-2xl" />

        <div className="relative">
          <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-brand-orange/90 mb-2">Client Portal</p>
          <h1 className="text-3xl md:text-4xl font-display font-black text-white uppercase tracking-tight">
          My Garage
          </h1>
          <p className="text-gray-400 mt-2 text-sm">Save your vehicles once and reuse them when booking.</p>
        </div>

        {editingId === null && (
          <div className="relative mt-4">
            <button
              type="button"
              onClick={startCreate}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-brand-orange text-white text-xs font-bold uppercase tracking-widest rounded-md hover:bg-orange-600 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Add Vehicle
            </button>
          </div>
        )}
      </div>

      <section className="bg-gradient-to-br from-brand-dark to-[#181818] border border-gray-800 rounded-xl p-5 md:p-6 space-y-5">
         <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Saved Vehicles</p>
        {loading ? (
          <div className="py-10 flex justify-center"><Loader2 className="w-6 h-6 text-brand-orange animate-spin" /></div>
        ) : vehicles.length === 0 ? (
          <div className="py-10 text-center text-gray-500 text-sm space-y-2">
            <Car className="w-8 h-8 mx-auto opacity-40" />
            <p>No vehicles yet. Add your first car to speed up booking.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {vehicles.map(vehicle => (
              <article key={vehicle.id} className="border border-gray-800 bg-brand-darker/80 rounded-xl p-4 hover:border-gray-700 transition-colors">
                {vehicle.imageUrl && (
                  <div className="mb-3 rounded-md overflow-hidden border border-gray-800 bg-black/40">
                    <img src={vehicle.imageUrl} alt={`${vehicle.year} ${vehicle.make} ${vehicle.model}`} className="w-full h-32 object-cover" />
                  </div>
                )}
                <p className="text-white font-bold text-sm md:text-base">{vehicle.year} {vehicle.make} {vehicle.model}</p>
                <p className="text-gray-500 text-xs mt-1">
                  {vehicle.licensePlate ? `Plate: ${vehicle.licensePlate}` : 'No plate saved'}
                  {vehicle.vin ? ` · VIN: ${vehicle.vin}` : ''}
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => startEdit(vehicle)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-widest border border-gray-700 text-gray-300 hover:text-white hover:border-brand-orange rounded-md transition-colors"
                  >
                    <Pencil className="w-3 h-3" /> Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => removeVehicle(vehicle.id)}
                    disabled={deletingId === vehicle.id}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-widest border border-red-900 text-red-400 hover:text-red-300 hover:border-red-500 rounded-md transition-colors disabled:opacity-60"
                  >
                    {deletingId === vehicle.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />} Remove
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}

        {editingId !== null && (
          <div className="border border-gray-800 bg-brand-darker rounded-xl p-4 md:p-5 space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
              {editingId > 0 ? 'Edit Vehicle' : 'Add Vehicle'}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input
                value={form.make}
                onChange={e => setForm(prev => ({ ...prev, make: e.target.value }))}
                placeholder="Make (e.g. Toyota)"
                className="w-full bg-black border border-gray-700 text-white px-3 py-2 text-sm rounded-md focus:outline-none focus:border-brand-orange"
              />
              <input
                value={form.model}
                onChange={e => setForm(prev => ({ ...prev, model: e.target.value }))}
                placeholder="Model (e.g. Vios)"
                className="w-full bg-black border border-gray-700 text-white px-3 py-2 text-sm rounded-md focus:outline-none focus:border-brand-orange"
              />
              <input
                value={form.year}
                onChange={e => setForm(prev => ({ ...prev, year: e.target.value }))}
                placeholder="Year (e.g. 2021)"
                className="w-full bg-black border border-gray-700 text-white px-3 py-2 text-sm rounded-md focus:outline-none focus:border-brand-orange"
              />
              <div className="space-y-2">
                {form.imageUrl ? (
                  <div className="relative h-[42px]">
                    <img src={form.imageUrl} alt="Vehicle" className="w-full h-full object-cover rounded-md border border-gray-700" />
                    <button
                      type="button"
                      onClick={() => setForm(prev => ({ ...prev, imageUrl: '' }))}
                      className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-black/80 border border-gray-700 text-gray-300 hover:text-white flex items-center justify-center"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => imageInputRef.current?.click()}
                    disabled={imageUploading}
                    className="w-full h-[42px] inline-flex items-center justify-center gap-1.5 border border-dashed border-gray-700 text-gray-400 hover:text-white hover:border-brand-orange text-[11px] font-bold uppercase tracking-widest rounded-md transition-colors disabled:opacity-60"
                  >
                    {imageUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImagePlus className="w-3.5 h-3.5" />} Add Photo
                  </button>
                )}
                <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageFileChange} />
              </div>
              <input
                value={form.licensePlate}
                onChange={e => setForm(prev => ({ ...prev, licensePlate: e.target.value }))}
                placeholder="License Plate (optional)"
                className="w-full bg-black border border-gray-700 text-white px-3 py-2 text-sm rounded-md focus:outline-none focus:border-brand-orange"
              />
              <input
                value={form.imageUrl}
                onChange={e => setForm(prev => ({ ...prev, imageUrl: e.target.value }))}
                placeholder="Image URL (optional)"
                className="md:col-span-2 w-full bg-black border border-gray-700 text-white px-3 py-2 text-sm rounded-md focus:outline-none focus:border-brand-orange"
              />
              <input
                value={form.vin}
                onChange={e => setForm(prev => ({ ...prev, vin: e.target.value }))}
                placeholder="VIN (optional)"
                className="md:col-span-2 w-full bg-black border border-gray-700 text-white px-3 py-2 text-sm rounded-md focus:outline-none focus:border-brand-orange"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={saveVehicle}
                disabled={saving || imageUploading}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-orange text-white text-xs font-bold uppercase tracking-widest rounded-md hover:bg-orange-600 transition-colors disabled:opacity-60"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} Save
              </button>
              <button
                type="button"
                onClick={cancelEdit}
                disabled={saving}
                className="px-4 py-2 border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 text-xs font-bold uppercase tracking-widest rounded-md transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
