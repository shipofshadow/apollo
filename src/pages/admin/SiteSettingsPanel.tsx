import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Settings, Users, MessageSquare, Loader2, AlertCircle,
  Plus, Pencil, Trash2, Save, X, Upload, Star, Layout,
  ServerCog, CheckCircle2, Clock, RefreshCw, Database, Info,
} from 'lucide-react';
import {
  fetchSiteSettingsAsync, updateSiteSettingsAsync,
  fetchTeamMembersAsync, createTeamMemberAsync, updateTeamMemberAsync, deleteTeamMemberAsync,
  fetchTestimonialsAsync, createTestimonialAsync, updateTestimonialAsync, deleteTestimonialAsync,
} from '../../store/siteSettingsSlice';
import {
  uploadAdminImageApi,
  fetchAdminUsersApi,
  fetchAdminRolesApi,
  type AdminManagedUser,
  fetchMigrationStatusApi, runMigrationsApi,
  runNotificationQueueWorkerApi,
  runWaitlistAutoFillWorkerApi,
  runAppointmentRemindersWorkerApi,
  type AdminRole,
  type MigrationEntry,
} from '../../services/api';
import type { AppDispatch, RootState } from '../../store';
import { useAuth } from '../../context/AuthContext';
import type { TeamMember, Testimonial } from '../../types';
import { BACKEND_URL } from '../../config';

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
    map_embed_url:         '',
    map_link_url:          '',
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
      map_embed_url:         settings.map_embed_url         ?? '',
      map_link_url:          settings.map_link_url          ?? '',
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

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Map Embed URL (About Page)</label>
            <input value={form.map_embed_url}
              onChange={e => setForm(f => ({ ...f, map_embed_url: e.target.value }))}
              className="w-full bg-brand-darker border border-gray-700 text-white px-4 py-3 focus:outline-none focus:border-brand-orange rounded-sm"
              placeholder="https://www.openstreetmap.org/export/embed.html?… or Google Maps embed src" />
            <p className="text-xs text-gray-500">Paste the <code className="bg-brand-darker px-1 rounded">src</code> URL from an OpenStreetMap or Google Maps embed iframe. Leave blank to use the default map.</p>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Open in Maps Link (About Page)</label>
            <input value={form.map_link_url}
              onChange={e => setForm(f => ({ ...f, map_link_url: e.target.value }))}
              className="w-full bg-brand-darker border border-gray-700 text-white px-4 py-3 focus:outline-none focus:border-brand-orange rounded-sm"
              placeholder="https://www.openstreetmap.org/?mlat=… or Google Maps share link" />
            <p className="text-xs text-gray-500">The URL that opens when users click "Open in Maps". Leave blank to use the default link.</p>
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
  userId: number | null;
  name: string; role: string; imageUrl: string;
  bio: string; fullBio: string; email: string; phone: string;
  facebook: string; instagram: string; sortOrder: number; isActive: boolean;
};
const EMPTY_MEMBER: MemberForm = {
  id: null, userId: null, name: '', role: '', imageUrl: '', bio: '', fullBio: '',
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
  const [roleCatalog,  setRoleCatalog]  = useState<AdminRole[]>([]);
  const [userCatalog,  setUserCatalog]  = useState<AdminManagedUser[]>([]);
  const [linkedUserSearch, setLinkedUserSearch] = useState('');

  useEffect(() => {
    if (token) dispatch(fetchTeamMembersAsync(token));
  }, [token, dispatch]);

  useEffect(() => {
    if (!token) {
      setRoleCatalog([]);
      return;
    }

    let cancelled = false;
    fetchAdminRolesApi(token)
      .then(({ roles }) => {
        if (!cancelled) setRoleCatalog(roles);
      })
      .catch(() => {
        if (!cancelled) setRoleCatalog([]);
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (!token) {
      setUserCatalog([]);
      return;
    }

    let cancelled = false;
    fetchAdminUsersApi(token)
      .then(({ users }) => {
        if (!cancelled) setUserCatalog(users);
      })
      .catch(() => {
        if (!cancelled) setUserCatalog([]);
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const roleLabelByKey = useMemo(() => {
    return roleCatalog.reduce<Record<string, string>>((acc, role) => {
      acc[role.key] = role.name;
      return acc;
    }, {});
  }, [roleCatalog]);

  const userLabelById = useMemo(() => {
    return userCatalog.reduce<Record<number, string>>((acc, entry) => {
      acc[entry.id] = `${entry.name} (${entry.email})`;
      return acc;
    }, {});
  }, [userCatalog]);

  const selectableUsers = useMemo(() => {
    const q = linkedUserSearch.trim().toLowerCase();
    return userCatalog
      .filter(entry => entry.role !== 'client')
      .filter(entry => {
        if (q === '') return true;
        return entry.name.toLowerCase().includes(q)
          || entry.email.toLowerCase().includes(q)
          || (entry.phone ?? '').toLowerCase().includes(q);
      });
  }, [userCatalog, linkedUserSearch]);

  const openNew  = () => {
    setCurrent(EMPTY_MEMBER);
    setLinkedUserSearch('');
    setSaveError(null);
    setEditing(true);
  };
  const openEdit = (m: TeamMember) => {
    setCurrent({
      id: m.id, userId: m.userId ?? null, name: m.name, role: m.role, imageUrl: m.imageUrl ?? '',
      bio: m.bio ?? '', fullBio: m.fullBio ?? '', email: m.email ?? '',
      phone: m.phone ?? '', facebook: m.facebook ?? '', instagram: m.instagram ?? '',
      sortOrder: m.sortOrder, isActive: m.isActive,
    });
    setSaveError(null);
    setLinkedUserSearch(m.name);
    setEditing(true);
  };
  const cancel = () => {
    setEditing(false);
    setSaveError(null);
    setLinkedUserSearch('');
  };

  const handleUserPick = (userIdRaw: string) => {
    const userId = Number(userIdRaw);
    if (!Number.isFinite(userId) || userId <= 0) {
      setCurrent(prev => ({ ...prev, userId: null }));
      return;
    }

    const picked = userCatalog.find(item => item.id === userId);
    if (!picked) {
      setCurrent(prev => ({ ...prev, userId: null }));
      return;
    }

    setCurrent(prev => ({
      ...prev,
      userId: picked.id,
      name: picked.name,
      email: picked.email,
      phone: picked.phone ?? '',
      role: picked.role,
    }));
    setLinkedUserSearch(`${picked.name} ${picked.email}`);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (!current.userId) {
      setSaveError('Please select an existing user account for this team member.');
      return;
    }
    setSaving(true);
    setSaveError(null);
    const data = {
      userId: current.userId,
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
              <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Linked User *</label>
              <input
                value={linkedUserSearch}
                onChange={e => setLinkedUserSearch(e.target.value)}
                placeholder="Search user by name, email, or phone"
                className="w-full bg-brand-darker border border-gray-700 text-white px-4 py-3 focus:outline-none focus:border-brand-orange rounded-sm"
              />
              <select
                required
                value={current.userId ?? ''}
                onChange={e => handleUserPick(e.target.value)}
                className="w-full bg-brand-darker border border-gray-700 text-white px-4 py-3 focus:outline-none focus:border-brand-orange rounded-sm"
              >
                <option value="">Select user account</option>
                {selectableUsers.map(entry => (
                  <option key={entry.id} value={entry.id}>{entry.name} ({entry.email})</option>
                ))}
              </select>
              <p className="text-[11px] text-gray-500">Client accounts are excluded from team members.</p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Name *</label>
              <input required value={current.name}
                className="w-full bg-brand-darker border border-gray-700 text-gray-300 px-4 py-3 rounded-sm"
                readOnly />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Role / Position</label>
              <select value={current.role} onChange={e => setCurrent(p => ({ ...p, role: e.target.value }))}
                required
                className="w-full bg-brand-darker border border-gray-700 text-white px-4 py-3 focus:outline-none focus:border-brand-orange rounded-sm"
              >
                <option value="">Select role</option>
                {current.role && !roleCatalog.some(role => role.key === current.role) ? (
                  <option value={current.role}>{current.role}</option>
                ) : null}
                {roleCatalog.map(role => (
                  <option key={role.id} value={role.key}>{role.name}</option>
                ))}
              </select>
              {roleCatalog.length > 0 && (
                <p className="text-[11px] text-gray-500">
                  Role is restricted to configured access roles.
                </p>
              )}
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
              <input type="email" value={current.email}
                className="w-full bg-brand-darker border border-gray-700 text-gray-300 px-4 py-3 rounded-sm"
                readOnly />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Phone</label>
              <input value={current.phone}
                className="w-full bg-brand-darker border border-gray-700 text-gray-300 px-4 py-3 rounded-sm"
                readOnly />
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
                  <td className="p-4 text-gray-400 text-sm">
                    <div>{roleLabelByKey[m.role] ?? m.role}</div>
                    {m.userId ? (
                      <div className="text-[11px] text-gray-600">{userLabelById[m.userId] ?? `User #${m.userId}`}</div>
                    ) : null}
                  </td>
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

// ── Sub-panel: Footer Settings ───────────────────────────────────────────────

function FooterSettingsPanel() {
  const dispatch = useDispatch<AppDispatch>();
  const { token } = useAuth();
  const { settings, status } = useSelector((s: RootState) => s.siteSettings);

  const [form, setForm] = useState({
    footer_tagline:   '',
    footer_address:   '',
    footer_phone:     '',
    footer_phones:    '',
    footer_email:     '',
    footer_emails:    '',
    footer_instagram: '',
    footer_facebook:  '',
    footer_youtube:   '',
  });
  const [saving,      setSaving]      = useState(false);
  const [saveError,   setSaveError]   = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    dispatch(fetchSiteSettingsAsync());
  }, [dispatch]);

  useEffect(() => {
    setForm({
      footer_tagline:   settings.footer_tagline   ?? '',
      footer_address:   settings.footer_address   ?? '',
      footer_phone:     settings.footer_phone     ?? '',
      footer_phones:    settings.footer_phones    ?? '',
      footer_email:     settings.footer_email     ?? '',
      footer_emails:    settings.footer_emails    ?? '',
      footer_instagram: settings.footer_instagram ?? '',
      footer_facebook:  settings.footer_facebook  ?? '',
      footer_youtube:   settings.footer_youtube   ?? '',
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

  const inputCls = 'w-full bg-brand-darker border border-gray-700 text-white px-4 py-3 focus:outline-none focus:border-brand-orange rounded-sm';

  return (
    <div>
      <h3 className="text-lg font-display font-bold text-white uppercase tracking-wide mb-6">
        Footer Settings
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
              Footer settings saved successfully.
            </div>
          )}

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Tagline</label>
            <textarea rows={2} value={form.footer_tagline}
              onChange={e => setForm(f => ({ ...f, footer_tagline: e.target.value }))}
              className={`${inputCls} resize-none`}
              placeholder="Short description shown below the logo" />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Address</label>
            <textarea rows={2} value={form.footer_address}
              onChange={e => setForm(f => ({ ...f, footer_address: e.target.value }))}
              className={`${inputCls} resize-none`}
              placeholder="Shop address" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Primary Phone</label>
              <input value={form.footer_phone}
                onChange={e => setForm(f => ({ ...f, footer_phone: e.target.value }))}
                className={inputCls} placeholder="0939 330 8263" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Primary Email</label>
              <input value={form.footer_email}
                onChange={e => setForm(f => ({ ...f, footer_email: e.target.value }))}
                className={inputCls} placeholder="info@example.com" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Additional Phones</label>
              <textarea rows={3} value={form.footer_phones}
                onChange={e => setForm(f => ({ ...f, footer_phones: e.target.value }))}
                className={`${inputCls} resize-none`}
                placeholder={'One per line\n09123456789\n+639123456789'} />
              <p className="text-xs text-gray-600">Shown in footer contact block. Supports one per line or comma-separated.</p>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Additional Emails</label>
              <textarea rows={3} value={form.footer_emails}
                onChange={e => setForm(f => ({ ...f, footer_emails: e.target.value }))}
                className={`${inputCls} resize-none`}
                placeholder={'One per line\ninfo@example.com\nservice@example.com'} />
              <p className="text-xs text-gray-600">Shown in footer contact block. Supports one per line or comma-separated.</p>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Instagram URL</label>
            <input value={form.footer_instagram}
              onChange={e => setForm(f => ({ ...f, footer_instagram: e.target.value }))}
              className={inputCls} placeholder="https://www.instagram.com/yourhandle" />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Facebook URL</label>
            <input value={form.footer_facebook}
              onChange={e => setForm(f => ({ ...f, footer_facebook: e.target.value }))}
              className={inputCls} placeholder="https://www.facebook.com/yourpage" />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-gray-400">YouTube URL</label>
            <input value={form.footer_youtube}
              onChange={e => setForm(f => ({ ...f, footer_youtube: e.target.value }))}
              className={inputCls} placeholder="https://www.youtube.com/@yourchannel (leave blank to hide)" />
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

// ── Sub-panel: Contact Page Settings ─────────────────────────────────────────

function ContactPanel() {
  const dispatch = useDispatch<AppDispatch>();
  const { token } = useAuth();
  const { settings, status } = useSelector((s: RootState) => s.siteSettings);

  const [form, setForm] = useState({
    contact_heading: '',
    contact_tagline: '',
    contact_address: '',
    contact_phone:   '',
    contact_phones:  '',
    contact_email:   '',
    contact_emails:  '',
    contact_hours:   '',
  });
  const [saving,      setSaving]      = useState(false);
  const [saveError,   setSaveError]   = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => { dispatch(fetchSiteSettingsAsync()); }, [dispatch]);

  useEffect(() => {
    setForm({
      contact_heading: settings.contact_heading ?? '',
      contact_tagline: settings.contact_tagline ?? '',
      contact_address: settings.contact_address ?? '',
      contact_phone:   settings.contact_phone   ?? '',
      contact_phones:  settings.contact_phones  ?? '',
      contact_email:   settings.contact_email   ?? '',
      contact_emails:  settings.contact_emails  ?? '',
      contact_hours:   settings.contact_hours   ?? '',
    });
  }, [settings]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSaving(true); setSaveError(null); setSaveSuccess(false);
    try {
      await dispatch(updateSiteSettingsAsync({ token, data: form })).unwrap();
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: unknown) {
      setSaveError((err as Error)?.message ?? 'Failed to save settings.');
    } finally { setSaving(false); }
  };

  const inputCls = 'w-full bg-brand-darker border border-gray-700 text-white px-4 py-3 focus:outline-none focus:border-brand-orange rounded-sm text-sm transition-colors';

  return (
    <div>
      <h3 className="text-lg font-display font-bold text-white uppercase tracking-wide mb-2">Contact Page</h3>
      <p className="text-gray-500 text-sm mb-6">Edit the content shown on the public /contact page.</p>

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
            <div className="bg-green-900/30 border border-green-500/40 text-green-400 px-4 py-3 rounded-sm text-sm flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" /> Contact page settings saved.
            </div>
          )}

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Page Heading</label>
            <input value={form.contact_heading}
              onChange={e => setForm(f => ({ ...f, contact_heading: e.target.value }))}
              className={inputCls} placeholder="Contact The Lab" />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Tagline / Description</label>
            <textarea rows={3} value={form.contact_tagline}
              onChange={e => setForm(f => ({ ...f, contact_tagline: e.target.value }))}
              className={`${inputCls} resize-none`}
              placeholder="Short intro shown below the heading" />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Address</label>
            <textarea rows={2} value={form.contact_address}
              onChange={e => setForm(f => ({ ...f, contact_address: e.target.value }))}
              className={`${inputCls} resize-none`}
              placeholder="Full shop address" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Primary Phone</label>
              <input value={form.contact_phone}
                onChange={e => setForm(f => ({ ...f, contact_phone: e.target.value }))}
                className={inputCls} placeholder="0939 330 8263" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Primary Email</label>
              <input value={form.contact_email}
                onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))}
                className={inputCls} placeholder="info@example.com" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Additional Phones</label>
              <textarea rows={3} value={form.contact_phones}
                onChange={e => setForm(f => ({ ...f, contact_phones: e.target.value }))}
                className={`${inputCls} resize-none`}
                placeholder={'One per line\n09123456789\n+639123456789'} />
              <p className="text-xs text-gray-600">Shown on Contact page. Supports one per line or comma-separated.</p>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Additional Emails</label>
              <textarea rows={3} value={form.contact_emails}
                onChange={e => setForm(f => ({ ...f, contact_emails: e.target.value }))}
                className={`${inputCls} resize-none`}
                placeholder={'One per line\ninfo@example.com\nservice@example.com'} />
              <p className="text-xs text-gray-600">Shown on Contact page. Supports one per line or comma-separated.</p>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Business Hours</label>
            <textarea rows={3} value={form.contact_hours}
              onChange={e => setForm(f => ({ ...f, contact_hours: e.target.value }))}
              className={`${inputCls} resize-none`}
              placeholder="Mon–Fri: 9AM–6PM&#10;Sat: By Appointment&#10;Sun: Closed" />
            <p className="text-xs text-gray-600">Each line is shown as a separate entry.</p>
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

// ── Sub-panel: System Info & Migrations ───────────────────────────────────────

const APP_VERSION = '1.0.0';
const APP_NAME    = '1625 Auto Lab';
const TECH_STACK  = 'React 19 · Redux Toolkit · Tailwind CSS · PHP 8 · MySQL';

function SystemPanel() {
  const dispatch = useDispatch<AppDispatch>();
  const { token } = useAuth();
  const { settings } = useSelector((s: RootState) => s.siteSettings);

  const [staffBookingSettings, setStaffBookingSettings] = useState({
    staff_can_view_all_bookings: false,
    staff_can_manage_all_bookings: false,
  });
  const [staffSettingsSaving, setStaffSettingsSaving] = useState(false);
  const [staffSettingsError, setStaffSettingsError] = useState<string | null>(null);
  const [staffSettingsSuccess, setStaffSettingsSuccess] = useState(false);

  const [migrations,    setMigrations]    = useState<MigrationEntry[]>([]);
  const [migrTotal,     setMigrTotal]     = useState(0);
  const [migrPage,      setMigrPage]      = useState(1);
  const [migrPageSize,  setMigrPageSize]  = useState(5);
  const [migrCounts,    setMigrCounts]    = useState<{ ran: number; pending: number; total: number }>({ ran: 0, pending: 0, total: 0 });
  const [migrLoading,   setMigrLoading]   = useState(true);
  const [migrError,     setMigrError]     = useState<string | null>(null);
  const [running,       setRunning]       = useState(false);
  const [runResult,     setRunResult]     = useState<{ ran: string[]; skipped: string[]; total: number } | null>(null);
  const [runError,      setRunError]      = useState<string | null>(null);
  const [cronBusy,      setCronBusy]      = useState<'queue' | 'waitlist' | 'reminders' | null>(null);
  const [cronResult,    setCronResult]    = useState<string | null>(null);
  const [cronError,     setCronError]     = useState<string | null>(null);

  const loadStatus = useCallback(() => {
    if (!token) return;
    setMigrLoading(true);
    setMigrError(null);
    fetchMigrationStatusApi(token, { page: migrPage, pageSize: migrPageSize })
      .then(res => {
        setMigrations(res.migrations);
        setMigrTotal(res.total);
        setMigrCounts(res.counts);
      })
      .catch(e  => setMigrError((e as Error).message))
      .finally(() => setMigrLoading(false));
  }, [token, migrPage, migrPageSize]);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  useEffect(() => {
    dispatch(fetchSiteSettingsAsync());
  }, [dispatch]);

  useEffect(() => {
    const toBool = (value?: string) => ['1', 'true', 'yes', 'on'].includes((value ?? '').toLowerCase());
    setStaffBookingSettings({
      staff_can_view_all_bookings: toBool(settings.staff_can_view_all_bookings),
      staff_can_manage_all_bookings: toBool(settings.staff_can_manage_all_bookings),
    });
  }, [settings.staff_can_manage_all_bookings, settings.staff_can_view_all_bookings]);

  const handleRunMigrations = async () => {
    if (!token || running) return;
    setRunning(true);
    setRunResult(null);
    setRunError(null);
    try {
      const result = await runMigrationsApi(token);
      setRunResult(result);
      // Refresh the migration list after running
      loadStatus();
    } catch (e: unknown) {
      setRunError((e as Error).message ?? 'Failed to run migrations.');
    } finally {
      setRunning(false);
    }
  };

  const pendingCount = migrCounts.pending;
  const ranCount     = migrCounts.ran;
  const totalPages   = Math.max(1, Math.ceil(migrTotal / migrPageSize));

  const handleRunQueueWorker = async () => {
    if (!token || cronBusy) return;
    setCronBusy('queue');
    setCronResult(null);
    setCronError(null);
    try {
      const res = await runNotificationQueueWorkerApi(token);
      const s = res.stats;
      setCronResult(`Notification queue worker ran: processed ${s.processed}, retried ${s.retried}, failed ${s.failed}.`);
    } catch (e: unknown) {
      setCronError((e as Error).message ?? 'Failed to run notification queue worker.');
    } finally {
      setCronBusy(null);
    }
  };

  const handleRunWaitlistWorker = async () => {
    if (!token || cronBusy) return;
    setCronBusy('waitlist');
    setCronResult(null);
    setCronError(null);
    try {
      const res = await runWaitlistAutoFillWorkerApi(token);
      const s = res.stats;
      setCronResult(`Waitlist auto-fill worker ran: checked ${s.slotsChecked} slot(s), notified ${s.notified} user(s).`);
    } catch (e: unknown) {
      setCronError((e as Error).message ?? 'Failed to run waitlist auto-fill worker.');
    } finally {
      setCronBusy(null);
    }
  };

  const handleRunReminderWorker = async () => {
    if (!token || cronBusy) return;
    setCronBusy('reminders');
    setCronResult(null);
    setCronError(null);
    try {
      const res = await runAppointmentRemindersWorkerApi(token);
      const s = res.stats;
      setCronResult(`Appointment reminders ran for ${s.date}: attempted ${s.attempted}, skipped ${s.skipped}, errors ${s.errors}.`);
    } catch (e: unknown) {
      setCronError((e as Error).message ?? 'Failed to run appointment reminders worker.');
    } finally {
      setCronBusy(null);
    }
  };

  const handleSaveStaffBookingSettings = async () => {
    if (!token || staffSettingsSaving) return;
    setStaffSettingsSaving(true);
    setStaffSettingsError(null);
    setStaffSettingsSuccess(false);
    try {
      await dispatch(updateSiteSettingsAsync({
        token,
        data: {
          staff_can_view_all_bookings: staffBookingSettings.staff_can_view_all_bookings ? '1' : '0',
          staff_can_manage_all_bookings: staffBookingSettings.staff_can_manage_all_bookings ? '1' : '0',
        },
      })).unwrap();
      setStaffSettingsSuccess(true);
      setTimeout(() => setStaffSettingsSuccess(false), 3000);
    } catch (e: unknown) {
      setStaffSettingsError((e as Error).message ?? 'Failed to save staff booking access settings.');
    } finally {
      setStaffSettingsSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <h3 className="text-lg font-display font-bold text-white uppercase tracking-wide">
        System Information
      </h3>

      {/* Info cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-brand-dark border border-gray-800 rounded-sm p-5 flex items-start gap-4">
          <div className="w-10 h-10 bg-brand-orange/10 rounded-sm flex items-center justify-center shrink-0">
            <Info className="w-5 h-5 text-brand-orange" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1">Application</p>
            <p className="text-white font-bold text-sm">{APP_NAME}</p>
            <p className="text-gray-400 text-xs mt-0.5">v{APP_VERSION}</p>
          </div>
        </div>

        <div className="bg-brand-dark border border-gray-800 rounded-sm p-5 flex items-start gap-4">
          <div className="w-10 h-10 bg-blue-500/10 rounded-sm flex items-center justify-center shrink-0">
            <ServerCog className="w-5 h-5 text-blue-400" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1">Backend URL</p>
            <p className="text-white font-bold text-sm break-all">{BACKEND_URL}</p>
            <p className="text-gray-400 text-xs mt-0.5">PHP API Server</p>
          </div>
        </div>

        <div className="bg-brand-dark border border-gray-800 rounded-sm p-5 flex items-start gap-4">
          <div className="w-10 h-10 bg-purple-500/10 rounded-sm flex items-center justify-center shrink-0">
            <Database className="w-5 h-5 text-purple-400" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1">Migrations</p>
            <p className="text-white font-bold text-sm">{ranCount} / {migrations.length} applied</p>
            <p className={`text-xs mt-0.5 font-bold ${pendingCount > 0 ? 'text-yellow-400' : 'text-green-400'}`}>
              {pendingCount > 0 ? `${pendingCount} pending` : 'All up to date'}
            </p>
          </div>
        </div>

        <div className="bg-brand-dark border border-gray-800 rounded-sm p-5 flex items-start gap-4 sm:col-span-2 lg:col-span-3">
          <div className="w-10 h-10 bg-gray-700/50 rounded-sm flex items-center justify-center shrink-0">
            <Settings className="w-5 h-5 text-gray-400" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1">Tech Stack</p>
            <p className="text-gray-300 text-sm">{TECH_STACK}</p>
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-display font-bold text-white uppercase tracking-wide flex items-center gap-2">
            <Settings className="w-5 h-5 text-brand-orange" />
            Staff Booking Access
          </h3>
        </div>

        <div className="bg-brand-dark border border-gray-800 rounded-sm p-5 space-y-4">
          <p className="text-sm text-gray-300">
            Control whether staff accounts can see or modify bookings beyond the jobs directly assigned to them.
          </p>

          {staffSettingsError && (
            <div className="flex items-center gap-2 bg-red-900/30 border border-red-500/40 text-red-400 px-4 py-3 rounded-sm text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" /> {staffSettingsError}
            </div>
          )}

          {staffSettingsSuccess && (
            <div className="flex items-center gap-2 bg-green-900/30 border border-green-500/40 text-green-400 px-4 py-3 rounded-sm text-sm">
              <CheckCircle2 className="w-4 h-4 shrink-0" /> Staff booking access settings saved.
            </div>
          )}

          <label className="flex items-start gap-3 rounded-sm border border-gray-800 bg-brand-darker/40 px-4 py-4">
            <input
              type="checkbox"
              checked={staffBookingSettings.staff_can_view_all_bookings}
              onChange={e => setStaffBookingSettings(prev => ({ ...prev, staff_can_view_all_bookings: e.target.checked }))}
              className="mt-1 h-4 w-4 rounded border-gray-600 bg-brand-darker text-brand-orange focus:ring-brand-orange"
            />
            <span>
              <span className="block text-sm font-semibold text-white">Staff can view all bookings</span>
              <span className="block text-xs text-gray-400">When off, staff can only open bookings assigned to them.</span>
            </span>
          </label>

          <label className="flex items-start gap-3 rounded-sm border border-gray-800 bg-brand-darker/40 px-4 py-4">
            <input
              type="checkbox"
              checked={staffBookingSettings.staff_can_manage_all_bookings}
              onChange={e => setStaffBookingSettings(prev => ({ ...prev, staff_can_manage_all_bookings: e.target.checked }))}
              className="mt-1 h-4 w-4 rounded border-gray-600 bg-brand-darker text-brand-orange focus:ring-brand-orange"
            />
            <span>
              <span className="block text-sm font-semibold text-white">Staff can manage all bookings</span>
              <span className="block text-xs text-gray-400">When off, staff can only update bookings assigned to them.</span>
            </span>
          </label>

          <div className="pt-2 border-t border-gray-800 flex items-center justify-between gap-3">
            <p className="text-xs text-gray-500">Admins, owners, and managers keep full booking access.</p>
            <button
              type="button"
              onClick={handleSaveStaffBookingSettings}
              disabled={staffSettingsSaving}
              className="flex items-center gap-2 bg-brand-orange text-white px-5 py-2 text-xs font-bold uppercase tracking-widest hover:bg-orange-600 transition-colors disabled:opacity-50 rounded-sm"
            >
              {staffSettingsSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Access Rules
            </button>
          </div>
        </div>
      </div>

      {/* Database Migrations */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-display font-bold text-white uppercase tracking-wide flex items-center gap-2">
            <Database className="w-5 h-5 text-brand-orange" />
            Database Migrations
          </h3>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={loadStatus}
              disabled={migrLoading}
              title="Refresh status"
              className="flex items-center gap-1.5 px-3 py-2 border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 text-xs font-bold uppercase tracking-widest rounded-sm transition-colors disabled:opacity-50">
              <RefreshCw className={`w-3.5 h-3.5 ${migrLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              type="button"
              onClick={handleRunMigrations}
              disabled={running || migrLoading || pendingCount === 0}
              className="flex items-center gap-2 bg-brand-orange text-white px-5 py-2 text-sm font-bold uppercase tracking-widest hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed rounded-sm">
              {running
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Running…</>
                : <><RefreshCw className="w-4 h-4" /> Run Migrations</>
              }
            </button>
          </div>
        </div>

        {/* Run result banner */}
        {runResult && (
          <div className="mb-4 bg-green-900/30 border border-green-500/40 text-green-400 px-4 py-3 rounded-sm text-sm">
            <p className="font-bold mb-1">
              Migrations complete — {runResult.ran.length} applied, {runResult.skipped.length} skipped.
            </p>
            {runResult.ran.length > 0 && (
              <ul className="list-disc list-inside text-xs space-y-0.5 text-green-300">
                {runResult.ran.map(name => <li key={name}>{name}</li>)}
              </ul>
            )}
          </div>
        )}

        {runError && (
          <div className="mb-4 flex items-center gap-2 bg-red-900/30 border border-red-500/40 text-red-400 px-4 py-3 rounded-sm text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" /> {runError}
          </div>
        )}

        {migrLoading && (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 text-brand-orange animate-spin" />
          </div>
        )}

        {migrError && (
          <div className="flex items-center gap-2 bg-red-900/30 border border-red-500/40 text-red-400 px-4 py-3 rounded-sm text-sm mb-4">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{migrError}</span>
            <span className="text-gray-500 text-xs ml-2">(Database may not be configured)</span>
          </div>
        )}

        {!migrLoading && !migrError && migrations.length > 0 && (
          <div className="bg-brand-dark border border-gray-800 rounded-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-left">
                  <th className="px-5 py-3 text-xs font-bold uppercase tracking-widest text-gray-500">Migration File</th>
                  <th className="px-5 py-3 text-xs font-bold uppercase tracking-widest text-gray-500 w-28">Status</th>
                  <th className="px-5 py-3 text-xs font-bold uppercase tracking-widest text-gray-500 hidden md:table-cell">Applied At</th>
                </tr>
              </thead>
              <tbody>
                {migrations.map((m, i) => (
                  <tr key={m.name} className={`border-b border-gray-800/60 last:border-0 ${i % 2 === 1 ? 'bg-brand-darker/40' : ''}`}>
                    <td className="px-5 py-3 font-mono text-xs text-gray-300">{m.name}</td>
                    <td className="px-5 py-3">
                      {m.status === 'ran' ? (
                        <span className="inline-flex items-center gap-1.5 text-green-400 text-xs font-bold uppercase tracking-wider">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Applied
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-yellow-400 text-xs font-bold uppercase tracking-wider">
                          <Clock className="w-3.5 h-3.5" /> Pending
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-gray-500 text-xs hidden md:table-cell">
                      {m.ran_at ? new Date(m.ran_at).toLocaleString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex items-center justify-between px-5 py-3 border-t border-gray-800 text-xs text-gray-400">
              <span>
                Page {migrPage} of {totalPages} · {migrTotal} total migration(s)
              </span>
              <div className="flex items-center gap-2">
                <label className="text-gray-500">Per page</label>
                <select
                  value={String(migrPageSize)}
                  onChange={(e) => {
                    const size = Number(e.target.value) || 25;
                    setMigrPage(1);
                    setMigrPageSize(size);
                  }}
                  className="bg-brand-darker border border-gray-700 text-xs text-white px-2 py-1 rounded-sm"
                >
                  {[10, 25, 50, 100].map(v => <option key={v} value={v}>{v}</option>)}
                </select>
                <button
                  type="button"
                  onClick={() => setMigrPage(p => Math.max(1, p - 1))}
                  disabled={migrPage <= 1}
                  className="px-2 py-1 border border-gray-700 rounded-sm text-gray-300 hover:text-white disabled:opacity-40"
                >
                  Prev
                </button>
                <button
                  type="button"
                  onClick={() => setMigrPage(p => Math.min(totalPages, p + 1))}
                  disabled={migrPage >= totalPages}
                  className="px-2 py-1 border border-gray-700 rounded-sm text-gray-300 hover:text-white disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}

        {!migrLoading && !migrError && migrations.length === 0 && (
          <div className="bg-brand-dark border border-gray-800 rounded-sm p-8 text-center text-gray-500">
            <Database className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p>No migration files found.</p>
          </div>
        )}
      </div>

      {/* Cron Jobs */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-display font-bold text-white uppercase tracking-wide flex items-center gap-2">
            <ServerCog className="w-5 h-5 text-brand-orange" />
            Cron Jobs (Run Now)
          </h3>
        </div>

        {cronResult && (
          <div className="mb-4 bg-green-900/30 border border-green-500/40 text-green-400 px-4 py-3 rounded-sm text-sm">
            {cronResult}
          </div>
        )}

        {cronError && (
          <div className="mb-4 flex items-center gap-2 bg-red-900/30 border border-red-500/40 text-red-400 px-4 py-3 rounded-sm text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" /> {cronError}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-brand-dark border border-gray-800 rounded-sm p-5">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Notification Queue Worker</p>
            <p className="text-sm text-gray-300 mb-4">Process queued/retry notification jobs immediately.</p>
            <button
              type="button"
              onClick={handleRunQueueWorker}
              disabled={cronBusy !== null}
              className="flex items-center gap-2 bg-brand-orange text-white px-4 py-2 text-xs font-bold uppercase tracking-widest hover:bg-orange-600 transition-colors disabled:opacity-50 rounded-sm"
            >
              {cronBusy === 'queue' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Run Queue Worker
            </button>
          </div>

          <div className="bg-brand-dark border border-gray-800 rounded-sm p-5">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Waitlist Auto-Fill Worker</p>
            <p className="text-sm text-gray-300 mb-4">Expire stale claims and notify the next eligible waiting user.</p>
            <button
              type="button"
              onClick={handleRunWaitlistWorker}
              disabled={cronBusy !== null}
              className="flex items-center gap-2 bg-brand-orange text-white px-4 py-2 text-xs font-bold uppercase tracking-widest hover:bg-orange-600 transition-colors disabled:opacity-50 rounded-sm"
            >
              {cronBusy === 'waitlist' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Run Waitlist Worker
            </button>
          </div>

          <div className="bg-brand-dark border border-gray-800 rounded-sm p-5">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Appointment Reminders Worker</p>
            <p className="text-sm text-gray-300 mb-4">Send reminder SMS for tomorrow's confirmed/pending bookings.</p>
            <button
              type="button"
              onClick={handleRunReminderWorker}
              disabled={cronBusy !== null}
              className="flex items-center gap-2 bg-brand-orange text-white px-4 py-2 text-xs font-bold uppercase tracking-widest hover:bg-orange-600 transition-colors disabled:opacity-50 rounded-sm"
            >
              {cronBusy === 'reminders' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Run Reminders Worker
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main SiteSettingsPanel ────────────────────────────────────────────────────

type Tab = 'company' | 'contact' | 'footer' | 'team' | 'testimonials' | 'system';

export default function SiteSettingsPanel() {
  const [activeTab, setActiveTab] = useState<Tab>('company');

  const tabs: { key: Tab; label: string; hint: string; icon: React.ReactNode }[] = useMemo(() => [
    {
      key: 'company',
      label: 'Company Info',
      hint: 'About section and map details',
      icon: <Settings className="w-4 h-4" />,
    },
    {
      key: 'contact',
      label: 'Contact Page',
      hint: 'Contact copy and support channels',
      icon: <MessageSquare className="w-4 h-4" />,
    },
    {
      key: 'footer',
      label: 'Footer',
      hint: 'Global footer links and legal text',
      icon: <Layout className="w-4 h-4" />,
    },
    {
      key: 'team',
      label: 'Team Members',
      hint: 'Staff profiles and showcase ordering',
      icon: <Users className="w-4 h-4" />,
    },
    {
      key: 'testimonials',
      label: 'Testimonials',
      hint: 'Client reviews and social proof',
      icon: <MessageSquare className="w-4 h-4" />,
    },
    {
      key: 'system',
      label: 'System',
      hint: 'Environment checks and migrations',
      icon: <ServerCog className="w-4 h-4" />,
    },
  ], []);

  const activeTabMeta = useMemo(() => tabs.find(tab => tab.key === activeTab), [tabs, activeTab]);

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-xl border border-gray-800 bg-brand-dark p-5 sm:p-6">
        <div className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full bg-brand-orange/15 blur-3xl" />
        <div className="pointer-events-none absolute -left-16 bottom-0 h-40 w-40 rounded-full bg-orange-300/10 blur-3xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand-orange">Admin Controls</p>
            <h2 className="mt-1 text-2xl font-display font-bold uppercase tracking-wide text-white">Site Settings</h2>
            <p className="mt-2 max-w-2xl text-sm text-gray-300">
              Configure public-facing content, team profiles, testimonials, and operational system settings.
            </p>
          </div>
          <div className="rounded-lg border border-brand-orange/40 bg-brand-orange/10 px-3 py-2 text-right">
            <p className="text-[10px] uppercase tracking-widest text-gray-300">Current Section</p>
            <p className="text-sm font-semibold text-white">{activeTabMeta?.label ?? 'Company Info'}</p>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-gray-800 bg-brand-dark p-3">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {tabs.map(t => {
            const isActive = activeTab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={[
                  'group rounded-lg border px-3 py-3 text-left transition-all',
                  isActive
                    ? 'border-brand-orange bg-brand-orange/15 text-white shadow-[0_0_0_1px_rgba(249,115,22,0.25)]'
                    : 'border-gray-700 text-gray-300 hover:border-brand-orange/70 hover:text-white',
                ].join(' ')}
              >
                <span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest">
                  {t.icon} {t.label}
                </span>
                <span className="mt-1 block text-xs text-gray-500 group-hover:text-gray-300">{t.hint}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="rounded-xl border border-gray-800 bg-brand-dark p-4 sm:p-5">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-gray-800 pb-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Editing</p>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-white">{activeTabMeta?.label}</h3>
          </div>
          <p className="text-xs text-gray-400">{activeTabMeta?.hint}</p>
        </div>

        {activeTab === 'company'      && <CompanyInfoPanel />}
        {activeTab === 'contact'      && <ContactPanel />}
        {activeTab === 'footer'       && <FooterSettingsPanel />}
        {activeTab === 'team'         && <TeamMembersPanel />}
        {activeTab === 'testimonials' && <TestimonialsPanel />}
        {activeTab === 'system'       && <SystemPanel />}
      </section>
    </div>
  );
}
