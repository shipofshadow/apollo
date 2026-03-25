import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Settings, Users, MessageSquare, Loader2, AlertCircle,
  Plus, Pencil, Trash2, Save, X, Upload, Star,
} from 'lucide-react';
import {
  fetchSiteSettingsAsync, updateSiteSettingsAsync,
  fetchTeamMembersAsync, createTeamMemberAsync, updateTeamMemberAsync, deleteTeamMemberAsync,
  fetchTestimonialsAsync, createTestimonialAsync, updateTestimonialAsync, deleteTestimonialAsync,
} from '../../store/siteSettingsSlice';
import { uploadAdminImageApi } from '../../services/api';
import type { AppDispatch, RootState } from '../../store';
import { useAuth } from '../../context/AuthContext';
import type { TeamMember, Testimonial } from '../../types';

const UPLOAD_MAX_MB = 10;
function validateImageFile(file: File): string | null {
  return file.size > UPLOAD_MAX_MB * 1024 * 1024
    ? `Image must be under ${UPLOAD_MAX_MB} MB.`
    : null;
}

// ── Sub-panel: Company Info ───────────────────────────────────────────────────

function CompanyInfoPanel() {
  const dispatch = useDispatch<AppDispatch>();
  const { token } = useAuth();
  const { settings, status } = useSelector((s: RootState) => s.siteSettings);

  const [form, setForm] = useState({
    about_heading:         '',
    company_description_1: '',
    company_description_2: '',
    about_image_url:       '',
  });
  const [saving,       setSaving]       = useState(false);
  const [saveError,    setSaveError]    = useState<string | null>(null);
  const [saveSuccess,  setSaveSuccess]  = useState(false);
  const [imgUploading, setImgUploading] = useState(false);

  useEffect(() => {
    dispatch(fetchSiteSettingsAsync());
  }, [dispatch]);

  useEffect(() => {
    setForm({
      about_heading:         settings.about_heading         ?? '',
      company_description_1: settings.company_description_1 ?? '',
      company_description_2: settings.company_description_2 ?? '',
      about_image_url:       settings.about_image_url       ?? '',
    });
  }, [settings]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      await dispatch(updateSiteSettingsAsync({ token, data: form })).unwrap();
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: unknown) {
      setSaveError((err as Error)?.message ?? 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h3 className="text-lg font-display font-bold text-white uppercase tracking-wide mb-6">
        Company / About Page Info
      </h3>

      {status === 'loading' && (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 text-brand-orange animate-spin" /></div>
      )}

      {status !== 'loading' && (
        <form onSubmit={handleSave} className="bg-brand-dark border border-gray-800 rounded-sm p-6 space-y-5">
          {saveError && (
            <div className="flex items-center gap-2 bg-red-900/30 border border-red-500/40 text-red-400 px-4 py-3 rounded-sm text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" /> {saveError}
            </div>
          )}
          {saveSuccess && (
            <div className="bg-green-900/30 border border-green-500/40 text-green-400 px-4 py-3 rounded-sm text-sm">
              Settings saved successfully.
            </div>
          )}

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-gray-400">About Section Heading</label>
            <input value={form.about_heading}
              onChange={e => setForm(f => ({ ...f, about_heading: e.target.value }))}
              className="w-full bg-brand-darker border border-gray-700 text-white px-4 py-3 focus:outline-none focus:border-brand-orange rounded-sm" />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Company Description (Paragraph 1)</label>
            <textarea rows={4} value={form.company_description_1}
              onChange={e => setForm(f => ({ ...f, company_description_1: e.target.value }))}
              className="w-full bg-brand-darker border border-gray-700 text-white px-4 py-3 focus:outline-none focus:border-brand-orange rounded-sm resize-none" />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Company Description (Paragraph 2)</label>
            <textarea rows={4} value={form.company_description_2}
              onChange={e => setForm(f => ({ ...f, company_description_2: e.target.value }))}
              className="w-full bg-brand-darker border border-gray-700 text-white px-4 py-3 focus:outline-none focus:border-brand-orange rounded-sm resize-none" />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-gray-400">About Section Image</label>
            <div className="flex gap-2">
              <input value={form.about_image_url}
                onChange={e => setForm(f => ({ ...f, about_image_url: e.target.value }))}
                className="flex-1 bg-brand-darker border border-gray-700 text-white px-4 py-3 focus:outline-none focus:border-brand-orange rounded-sm"
                placeholder="https://… or upload below" />
              <label className={`flex items-center gap-2 px-4 py-3 border border-gray-700 text-gray-300 hover:text-white hover:border-brand-orange transition-colors rounded-sm cursor-pointer text-sm font-bold uppercase tracking-widest ${imgUploading ? 'opacity-60 pointer-events-none' : ''}`}>
                {imgUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                <span className="hidden sm:inline">Upload</span>
                <input type="file" accept="image/*" className="hidden" disabled={imgUploading} onChange={async e => {
                  const file = e.target.files?.[0];
                  if (!file || !token) return;
                  const sizeErr = validateImageFile(file);
                  if (sizeErr) { setSaveError(sizeErr); e.target.value = ''; return; }
                  setImgUploading(true);
                  try {
                    const url = await uploadAdminImageApi(token, file, 'services');
                    setForm(f => ({ ...f, about_image_url: url }));
                  } catch (err: unknown) {
                    setSaveError((err as Error)?.message ?? 'Image upload failed.');
                  } finally {
                    setImgUploading(false);
                    e.target.value = '';
                  }
                }} />
              </label>
            </div>
            {form.about_image_url && (
              <div className="relative mt-2 h-32 w-full rounded-sm border border-gray-700 overflow-hidden bg-gray-800">
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="w-6 h-6 text-gray-600 animate-spin" />
                </div>
                <img src={form.about_image_url} alt="About section"
                  className="w-full h-full object-cover opacity-0 transition-opacity duration-300"
                  onLoad={e => { (e.target as HTMLImageElement).style.opacity = '1'; }}
                  onError={e => { (e.target as HTMLImageElement).parentElement!.style.display = 'none'; }}
                  referrerPolicy="no-referrer"
                />
                <button type="button" onClick={() => setForm(f => ({ ...f, about_image_url: '' }))}
                  className="absolute top-1 right-1 p-1 bg-black/60 hover:bg-red-500/70 text-white rounded-sm transition-colors"
                  title="Remove image">
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-gray-800">
            <button type="submit" disabled={saving}
              className="flex items-center gap-2 bg-brand-orange text-white px-8 py-3 font-bold uppercase tracking-widest hover:bg-orange-600 transition-colors disabled:opacity-60 rounded-sm">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Changes
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

// ── Sub-panel: Team Members ───────────────────────────────────────────────────

type MemberForm = {
  id: number | null;
  name: string; role: string; imageUrl: string;
  bio: string; fullBio: string; email: string; phone: string;
  facebook: string; instagram: string; sortOrder: number; isActive: boolean;
};
const EMPTY_MEMBER: MemberForm = {
  id: null, name: '', role: '', imageUrl: '', bio: '', fullBio: '',
  email: '', phone: '', facebook: '', instagram: '', sortOrder: 0, isActive: true,
};

function TeamMembersPanel() {
  const dispatch = useDispatch<AppDispatch>();
  const { token } = useAuth();
  const { members, status } = useSelector((s: RootState) => s.siteSettings);

  const [editing,      setEditing]      = useState(false);
  const [current,      setCurrent]      = useState<MemberForm>(EMPTY_MEMBER);
  const [saving,       setSaving]       = useState(false);
  const [saveError,    setSaveError]    = useState<string | null>(null);
  const [deleteConf,   setDeleteConf]   = useState<number | null>(null);
  const [imgUploading, setImgUploading] = useState(false);

  useEffect(() => {
    if (token) dispatch(fetchTeamMembersAsync(token));
  }, [token, dispatch]);

  const openNew  = () => { setCurrent(EMPTY_MEMBER); setSaveError(null); setEditing(true); };
  const openEdit = (m: TeamMember) => {
    setCurrent({
      id: m.id, name: m.name, role: m.role, imageUrl: m.imageUrl ?? '',
      bio: m.bio ?? '', fullBio: m.fullBio ?? '', email: m.email ?? '',
      phone: m.phone ?? '', facebook: m.facebook ?? '', instagram: m.instagram ?? '',
      sortOrder: m.sortOrder, isActive: m.isActive,
    });
    setSaveError(null);
    setEditing(true);
  };
  const cancel = () => { setEditing(false); setSaveError(null); };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    setSaveError(null);
    const data = {
      name: current.name, role: current.role,
      imageUrl: current.imageUrl || null, bio: current.bio || null,
      fullBio: current.fullBio || null, email: current.email || null,
      phone: current.phone || null, facebook: current.facebook || null,
      instagram: current.instagram || null, sortOrder: current.sortOrder,
      isActive: current.isActive,
    };
    try {
      if (current.id !== null) {
        await dispatch(updateTeamMemberAsync({ token, id: current.id, data })).unwrap();
      } else {
        await dispatch(createTeamMemberAsync({ token, data })).unwrap();
      }
      setEditing(false);
    } catch (err: unknown) {
      setSaveError((err as Error)?.message ?? 'Failed to save team member.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!token) return;
    await dispatch(deleteTeamMemberAsync({ token, id }));
    setDeleteConf(null);
  };

  if (editing) {
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-display font-bold text-white uppercase tracking-wide">
            {current.id ? 'Edit Team Member' : 'New Team Member'}
          </h3>
          <button onClick={cancel} className="text-gray-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="bg-brand-dark border border-gray-800 rounded-sm p-6 space-y-5">
          {saveError && (
            <div className="flex items-center gap-2 bg-red-900/30 border border-red-500/40 text-red-400 px-4 py-3 rounded-sm text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" /> {saveError}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Name *</label>
              <input required value={current.name} onChange={e => setCurrent(p => ({ ...p, name: e.target.value }))}
                className="w-full bg-brand-darker border border-gray-700 text-white px-4 py-3 focus:outline-none focus:border-brand-orange rounded-sm" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Role / Position</label>
              <input value={current.role} onChange={e => setCurrent(p => ({ ...p, role: e.target.value }))}
                className="w-full bg-brand-darker border border-gray-700 text-white px-4 py-3 focus:outline-none focus:border-brand-orange rounded-sm" />
            </div>

            <div className="md:col-span-2 space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Profile Image</label>
              <div className="flex gap-2">
                <input value={current.imageUrl} onChange={e => setCurrent(p => ({ ...p, imageUrl: e.target.value }))}
                  className="flex-1 bg-brand-darker border border-gray-700 text-white px-4 py-3 focus:outline-none focus:border-brand-orange rounded-sm"
                  placeholder="https://… or upload" />
                <label className={`flex items-center gap-2 px-4 py-3 border border-gray-700 text-gray-300 hover:text-white hover:border-brand-orange transition-colors rounded-sm cursor-pointer text-sm font-bold uppercase tracking-widest ${imgUploading ? 'opacity-60 pointer-events-none' : ''}`}>
                  {imgUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  <span className="hidden sm:inline">Upload</span>
                  <input type="file" accept="image/*" className="hidden" disabled={imgUploading} onChange={async e => {
                    const file = e.target.files?.[0];
                    if (!file || !token) return;
                    const sizeErr = validateImageFile(file);
                    if (sizeErr) { setSaveError(sizeErr); e.target.value = ''; return; }
                    setImgUploading(true);
                    try {
                      const url = await uploadAdminImageApi(token, file, 'team');
                      setCurrent(p => ({ ...p, imageUrl: url }));
                    } catch (err: unknown) {
                      setSaveError((err as Error)?.message ?? 'Image upload failed.');
                    } finally {
                      setImgUploading(false);
                      e.target.value = '';
                    }
                  }} />
                </label>
              </div>
              {current.imageUrl && (
                <div className="relative mt-2 h-24 w-24 rounded-sm border border-gray-700 overflow-hidden bg-gray-800">
                  <img src={current.imageUrl} alt="Preview"
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                    onError={e => { (e.target as HTMLImageElement).parentElement!.style.display = 'none'; }}
                  />
                  <button type="button" onClick={() => setCurrent(p => ({ ...p, imageUrl: '' }))}
                    className="absolute top-1 right-1 p-1 bg-black/60 hover:bg-red-500/70 text-white rounded-sm transition-colors">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Email</label>
              <input type="email" value={current.email} onChange={e => setCurrent(p => ({ ...p, email: e.target.value }))}
                className="w-full bg-brand-darker border border-gray-700 text-white px-4 py-3 focus:outline-none focus:border-brand-orange rounded-sm" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Phone</label>
              <input value={current.phone} onChange={e => setCurrent(p => ({ ...p, phone: e.target.value }))}
                className="w-full bg-brand-darker border border-gray-700 text-white px-4 py-3 focus:outline-none focus:border-brand-orange rounded-sm" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Facebook URL</label>
              <input value={current.facebook} onChange={e => setCurrent(p => ({ ...p, facebook: e.target.value }))}
                className="w-full bg-brand-darker border border-gray-700 text-white px-4 py-3 focus:outline-none focus:border-brand-orange rounded-sm"
                placeholder="https://facebook.com/…" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Instagram URL</label>
              <input value={current.instagram} onChange={e => setCurrent(p => ({ ...p, instagram: e.target.value }))}
                className="w-full bg-brand-darker border border-gray-700 text-white px-4 py-3 focus:outline-none focus:border-brand-orange rounded-sm"
                placeholder="https://instagram.com/…" />
            </div>

            <div className="md:col-span-2 space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Short Bio (shown on card)</label>
              <textarea rows={3} value={current.bio} onChange={e => setCurrent(p => ({ ...p, bio: e.target.value }))}
                className="w-full bg-brand-darker border border-gray-700 text-white p-4 focus:outline-none focus:border-brand-orange rounded-sm resize-none" />
            </div>
            <div className="md:col-span-2 space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Full Bio (shown in modal)</label>
              <textarea rows={5} value={current.fullBio} onChange={e => setCurrent(p => ({ ...p, fullBio: e.target.value }))}
                className="w-full bg-brand-darker border border-gray-700 text-white p-4 focus:outline-none focus:border-brand-orange rounded-sm resize-none" />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Sort Order</label>
              <input type="number" value={current.sortOrder} onChange={e => setCurrent(p => ({ ...p, sortOrder: Number(e.target.value) }))}
                className="w-full bg-brand-darker border border-gray-700 text-white px-4 py-3 focus:outline-none focus:border-brand-orange rounded-sm" />
            </div>
            <div className="flex items-center gap-3 mt-6">
              <input type="checkbox" id="memberActive" checked={current.isActive}
                onChange={e => setCurrent(p => ({ ...p, isActive: e.target.checked }))}
                className="w-4 h-4 accent-brand-orange" />
              <label htmlFor="memberActive" className="text-xs font-bold uppercase tracking-widest text-gray-400">Active (visible on site)</label>
            </div>
          </div>

          <div className="flex gap-4 pt-4 border-t border-gray-800">
            <button type="submit" disabled={saving}
              className="flex items-center gap-2 bg-brand-orange text-white px-8 py-3 font-bold uppercase tracking-widest hover:bg-orange-600 transition-colors disabled:opacity-60 rounded-sm">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {current.id ? 'Save Changes' : 'Add Member'}
            </button>
            <button type="button" onClick={cancel}
              className="px-6 py-3 border border-gray-700 text-gray-400 hover:text-white font-bold uppercase tracking-widest transition-colors rounded-sm">
              Cancel
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-display font-bold text-white uppercase tracking-wide">Team Members</h3>
        <button onClick={openNew}
          className="flex items-center gap-2 bg-brand-orange text-white px-4 py-2 text-sm font-bold uppercase tracking-widest hover:bg-orange-600 transition-colors rounded-sm">
          <Plus className="w-4 h-4" /> Add Member
        </button>
      </div>

      {status === 'loading' && (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 text-brand-orange animate-spin" /></div>
      )}

      {members.length > 0 && (
        <div className="bg-brand-dark border border-gray-800 rounded-sm overflow-x-auto">
          <table className="w-full text-left min-w-[500px]">
            <thead>
              <tr className="border-b border-gray-800 bg-brand-darker/50">
                {['Member', 'Role', 'Status', 'Order', 'Actions'].map(h => (
                  <th key={h} className="p-4 text-xs font-bold uppercase tracking-widest text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {members.map(m => (
                <tr key={m.id} className="border-b border-gray-800 hover:bg-brand-darker/50 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      {m.imageUrl && (
                        <img src={m.imageUrl} alt={m.name}
                          className="w-10 h-10 rounded-full object-cover border border-gray-700"
                          referrerPolicy="no-referrer"
                          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                      )}
                      <span className="text-white font-bold">{m.name}</span>
                    </div>
                  </td>
                  <td className="p-4 text-gray-400 text-sm">{m.role}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 text-xs font-bold uppercase tracking-widest rounded-sm ${m.isActive ? 'bg-green-500/10 text-green-500' : 'bg-gray-800 text-gray-400'}`}>
                      {m.isActive ? 'Active' : 'Hidden'}
                    </span>
                  </td>
                  <td className="p-4 text-gray-400 text-sm">{m.sortOrder}</td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <button onClick={() => openEdit(m)}
                        className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-700 text-gray-300 hover:border-brand-orange hover:text-brand-orange text-xs font-bold uppercase rounded-sm transition-colors">
                        <Pencil className="w-3 h-3" /> Edit
                      </button>
                      {deleteConf === m.id ? (
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => handleDelete(m.id)}
                            className="px-3 py-1.5 bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 text-xs font-bold uppercase rounded-sm transition-colors">
                            Confirm
                          </button>
                          <button onClick={() => setDeleteConf(null)}
                            className="px-3 py-1.5 border border-gray-700 text-gray-400 hover:text-white text-xs font-bold uppercase rounded-sm transition-colors">
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => setDeleteConf(m.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-700 text-gray-500 hover:border-red-500/50 hover:text-red-400 text-xs font-bold uppercase rounded-sm transition-colors">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {members.length === 0 && status !== 'loading' && (
        <div className="bg-brand-dark border border-gray-800 rounded-sm p-8 text-center text-gray-500">
          <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No team members yet. Click <strong>Add Member</strong> to create one.</p>
        </div>
      )}
    </div>
  );
}

// ── Sub-panel: Testimonials ───────────────────────────────────────────────────

type TestimonialForm = {
  id: number | null;
  name: string; role: string; content: string; rating: number;
  imageUrl: string; isActive: boolean; sortOrder: number;
};
const EMPTY_TESTIMONIAL: TestimonialForm = {
  id: null, name: '', role: '', content: '', rating: 5,
  imageUrl: '', isActive: true, sortOrder: 0,
};

function TestimonialsPanel() {
  const dispatch = useDispatch<AppDispatch>();
  const { token } = useAuth();
  const { testimonials, status } = useSelector((s: RootState) => s.siteSettings);

  const [editing,      setEditing]      = useState(false);
  const [current,      setCurrent]      = useState<TestimonialForm>(EMPTY_TESTIMONIAL);
  const [saving,       setSaving]       = useState(false);
  const [saveError,    setSaveError]    = useState<string | null>(null);
  const [deleteConf,   setDeleteConf]   = useState<number | null>(null);
  const [imgUploading, setImgUploading] = useState(false);

  useEffect(() => {
    if (token) dispatch(fetchTestimonialsAsync(token));
  }, [token, dispatch]);

  const openNew  = () => { setCurrent(EMPTY_TESTIMONIAL); setSaveError(null); setEditing(true); };
  const openEdit = (t: Testimonial) => {
    setCurrent({
      id: t.id, name: t.name, role: t.role, content: t.content,
      rating: t.rating, imageUrl: t.imageUrl ?? '', isActive: t.isActive, sortOrder: t.sortOrder,
    });
    setSaveError(null);
    setEditing(true);
  };
  const cancel = () => { setEditing(false); setSaveError(null); };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    setSaveError(null);
    const data = {
      name: current.name, role: current.role, content: current.content,
      rating: current.rating, imageUrl: current.imageUrl || null,
      isActive: current.isActive, sortOrder: current.sortOrder,
    };
    try {
      if (current.id !== null) {
        await dispatch(updateTestimonialAsync({ token, id: current.id, data })).unwrap();
      } else {
        await dispatch(createTestimonialAsync({ token, data })).unwrap();
      }
      setEditing(false);
    } catch (err: unknown) {
      setSaveError((err as Error)?.message ?? 'Failed to save testimonial.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!token) return;
    await dispatch(deleteTestimonialAsync({ token, id }));
    setDeleteConf(null);
  };

  if (editing) {
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-display font-bold text-white uppercase tracking-wide">
            {current.id ? 'Edit Testimonial' : 'New Testimonial'}
          </h3>
          <button onClick={cancel} className="text-gray-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="bg-brand-dark border border-gray-800 rounded-sm p-6 space-y-5">
          {saveError && (
            <div className="flex items-center gap-2 bg-red-900/30 border border-red-500/40 text-red-400 px-4 py-3 rounded-sm text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" /> {saveError}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Client Name *</label>
              <input required value={current.name} onChange={e => setCurrent(p => ({ ...p, name: e.target.value }))}
                className="w-full bg-brand-darker border border-gray-700 text-white px-4 py-3 focus:outline-none focus:border-brand-orange rounded-sm" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Role / Vehicle</label>
              <input value={current.role} onChange={e => setCurrent(p => ({ ...p, role: e.target.value }))}
                placeholder="e.g. Honda Civic Owner"
                className="w-full bg-brand-darker border border-gray-700 text-white px-4 py-3 focus:outline-none focus:border-brand-orange rounded-sm" />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Rating (1–5)</label>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map(n => (
                  <button key={n} type="button" onClick={() => setCurrent(p => ({ ...p, rating: n }))}>
                    <Star className={`w-6 h-6 ${n <= current.rating ? 'fill-brand-orange text-brand-orange' : 'text-gray-600'}`} />
                  </button>
                ))}
                <span className="text-gray-400 text-sm ml-1">{current.rating}/5</span>
              </div>
            </div>

            <div className="flex items-center gap-3 mt-6">
              <input type="checkbox" id="testimonialActive" checked={current.isActive}
                onChange={e => setCurrent(p => ({ ...p, isActive: e.target.checked }))}
                className="w-4 h-4 accent-brand-orange" />
              <label htmlFor="testimonialActive" className="text-xs font-bold uppercase tracking-widest text-gray-400">Active (visible on site)</label>
            </div>

            <div className="md:col-span-2 space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Client Photo</label>
              <div className="flex gap-2">
                <input value={current.imageUrl} onChange={e => setCurrent(p => ({ ...p, imageUrl: e.target.value }))}
                  className="flex-1 bg-brand-darker border border-gray-700 text-white px-4 py-3 focus:outline-none focus:border-brand-orange rounded-sm"
                  placeholder="https://… or upload" />
                <label className={`flex items-center gap-2 px-4 py-3 border border-gray-700 text-gray-300 hover:text-white hover:border-brand-orange transition-colors rounded-sm cursor-pointer text-sm font-bold uppercase tracking-widest ${imgUploading ? 'opacity-60 pointer-events-none' : ''}`}>
                  {imgUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  <span className="hidden sm:inline">Upload</span>
                  <input type="file" accept="image/*" className="hidden" disabled={imgUploading} onChange={async e => {
                    const file = e.target.files?.[0];
                    if (!file || !token) return;
                    const sizeErr = validateImageFile(file);
                    if (sizeErr) { setSaveError(sizeErr); e.target.value = ''; return; }
                    setImgUploading(true);
                    try {
                      const url = await uploadAdminImageApi(token, file, 'testimonials');
                      setCurrent(p => ({ ...p, imageUrl: url }));
                    } catch (err: unknown) {
                      setSaveError((err as Error)?.message ?? 'Image upload failed.');
                    } finally {
                      setImgUploading(false);
                      e.target.value = '';
                    }
                  }} />
                </label>
              </div>
              {current.imageUrl && (
                <div className="relative mt-2 h-16 w-16 rounded-full border border-gray-700 overflow-hidden bg-gray-800">
                  <img src={current.imageUrl} alt="Preview"
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                    onError={e => { (e.target as HTMLImageElement).parentElement!.style.display = 'none'; }}
                  />
                  <button type="button" onClick={() => setCurrent(p => ({ ...p, imageUrl: '' }))}
                    className="absolute top-0 right-0 p-0.5 bg-black/60 hover:bg-red-500/70 text-white rounded-full transition-colors">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>

            <div className="md:col-span-2 space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Testimonial Content *</label>
              <textarea required rows={5} value={current.content} onChange={e => setCurrent(p => ({ ...p, content: e.target.value }))}
                className="w-full bg-brand-darker border border-gray-700 text-white p-4 focus:outline-none focus:border-brand-orange rounded-sm resize-none"
                placeholder="What the client said…" />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Sort Order</label>
              <input type="number" value={current.sortOrder} onChange={e => setCurrent(p => ({ ...p, sortOrder: Number(e.target.value) }))}
                className="w-full bg-brand-darker border border-gray-700 text-white px-4 py-3 focus:outline-none focus:border-brand-orange rounded-sm" />
            </div>
          </div>

          <div className="flex gap-4 pt-4 border-t border-gray-800">
            <button type="submit" disabled={saving}
              className="flex items-center gap-2 bg-brand-orange text-white px-8 py-3 font-bold uppercase tracking-widest hover:bg-orange-600 transition-colors disabled:opacity-60 rounded-sm">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {current.id ? 'Save Changes' : 'Add Testimonial'}
            </button>
            <button type="button" onClick={cancel}
              className="px-6 py-3 border border-gray-700 text-gray-400 hover:text-white font-bold uppercase tracking-widest transition-colors rounded-sm">
              Cancel
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-display font-bold text-white uppercase tracking-wide">Client Testimonials</h3>
        <button onClick={openNew}
          className="flex items-center gap-2 bg-brand-orange text-white px-4 py-2 text-sm font-bold uppercase tracking-widest hover:bg-orange-600 transition-colors rounded-sm">
          <Plus className="w-4 h-4" /> Add Testimonial
        </button>
      </div>

      {status === 'loading' && (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 text-brand-orange animate-spin" /></div>
      )}

      {testimonials.length > 0 && (
        <div className="bg-brand-dark border border-gray-800 rounded-sm overflow-x-auto">
          <table className="w-full text-left min-w-[500px]">
            <thead>
              <tr className="border-b border-gray-800 bg-brand-darker/50">
                {['Client', 'Rating', 'Status', 'Order', 'Actions'].map(h => (
                  <th key={h} className="p-4 text-xs font-bold uppercase tracking-widest text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {testimonials.map(t => (
                <tr key={t.id} className="border-b border-gray-800 hover:bg-brand-darker/50 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      {t.imageUrl && (
                        <img src={t.imageUrl} alt={t.name}
                          className="w-10 h-10 rounded-full object-cover border border-gray-700"
                          referrerPolicy="no-referrer"
                          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                      )}
                      <div>
                        <p className="text-white font-bold">{t.name}</p>
                        <p className="text-gray-500 text-xs">{t.role}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex gap-0.5">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className={`w-3.5 h-3.5 ${i < t.rating ? 'fill-brand-orange text-brand-orange' : 'text-gray-700'}`} />
                      ))}
                    </div>
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-1 text-xs font-bold uppercase tracking-widest rounded-sm ${t.isActive ? 'bg-green-500/10 text-green-500' : 'bg-gray-800 text-gray-400'}`}>
                      {t.isActive ? 'Active' : 'Hidden'}
                    </span>
                  </td>
                  <td className="p-4 text-gray-400 text-sm">{t.sortOrder}</td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <button onClick={() => openEdit(t)}
                        className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-700 text-gray-300 hover:border-brand-orange hover:text-brand-orange text-xs font-bold uppercase rounded-sm transition-colors">
                        <Pencil className="w-3 h-3" /> Edit
                      </button>
                      {deleteConf === t.id ? (
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => handleDelete(t.id)}
                            className="px-3 py-1.5 bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 text-xs font-bold uppercase rounded-sm transition-colors">
                            Confirm
                          </button>
                          <button onClick={() => setDeleteConf(null)}
                            className="px-3 py-1.5 border border-gray-700 text-gray-400 hover:text-white text-xs font-bold uppercase rounded-sm transition-colors">
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => setDeleteConf(t.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-700 text-gray-500 hover:border-red-500/50 hover:text-red-400 text-xs font-bold uppercase rounded-sm transition-colors">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {testimonials.length === 0 && status !== 'loading' && (
        <div className="bg-brand-dark border border-gray-800 rounded-sm p-8 text-center text-gray-500">
          <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No testimonials yet. Click <strong>Add Testimonial</strong> to create one.</p>
        </div>
      )}
    </div>
  );
}

// ── Main SiteSettingsPanel ────────────────────────────────────────────────────

type Tab = 'company' | 'team' | 'testimonials';

export default function SiteSettingsPanel() {
  const [activeTab, setActiveTab] = useState<Tab>('company');

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'company',      label: 'Company Info',  icon: <Settings className="w-4 h-4" /> },
    { key: 'team',         label: 'Team Members',  icon: <Users className="w-4 h-4" /> },
    { key: 'testimonials', label: 'Testimonials',  icon: <MessageSquare className="w-4 h-4" /> },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-display font-bold text-white uppercase tracking-wide">Site Settings</h2>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 mb-8 border-b border-gray-800">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`flex items-center gap-2 px-5 py-3 text-xs font-bold uppercase tracking-widest transition-colors border-b-2 -mb-px ${
              activeTab === t.key
                ? 'border-brand-orange text-brand-orange'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'company'      && <CompanyInfoPanel />}
      {activeTab === 'team'         && <TeamMembersPanel />}
      {activeTab === 'testimonials' && <TestimonialsPanel />}
    </div>
  );
}
