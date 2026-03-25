import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  FileText, Loader2, AlertCircle, Plus, Pencil, Trash2, Save, X, Upload,
} from 'lucide-react';
import RichTextEditor from '../../components/RichTextEditor';
import {
  fetchBlogPostsAsync, createBlogPostAsync, updateBlogPostAsync, deleteBlogPostAsync,
} from '../../store/contentSlice';
import type { ContentPost } from '../../store/contentSlice';
import { uploadAdminImageApi } from '../../services/api';
import type { AppDispatch, RootState } from '../../store';
import { useAuth } from '../../context/AuthContext';

const UPLOAD_MAX_MB = 10;
function validateImageFile(file: File): string | null {
  return file.size > UPLOAD_MAX_MB * 1024 * 1024
    ? `Image must be under ${UPLOAD_MAX_MB} MB.`
    : null;
}

type PostForm = { id: number | null; title: string; content: string; status: 'Draft' | 'Published'; coverImage: string };
const EMPTY_POST: PostForm = { id: null, title: '', content: '', status: 'Draft', coverImage: '' };

export default function ContentPanel() {
  const dispatch = useDispatch<AppDispatch>();
  const { token } = useAuth();
  const { posts, status } = useSelector((s: RootState) => s.content);

  const [editing,      setEditing]      = useState(false);
  const [current,      setCurrent]      = useState<PostForm>(EMPTY_POST);
  const [saving,       setSaving]       = useState(false);
  const [saveError,    setSaveError]    = useState<string | null>(null);
  const [deleteConf,   setDeleteConf]   = useState<number | null>(null);
  const [imgUploading, setImgUploading] = useState(false);

  useEffect(() => {
    if (token) dispatch(fetchBlogPostsAsync(token));
  }, [token, dispatch]);

  const openNew  = ()                 => { setCurrent(EMPTY_POST); setSaveError(null); setEditing(true); };
  const openEdit = (p: ContentPost)   => {
    setCurrent({ id: p.id, title: p.title, content: p.content, status: p.status, coverImage: p.coverImage ?? '' });
    setSaveError(null);
    setEditing(true);
  };
  const cancel = () => { setEditing(false); setSaveError(null); };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    const plainText = (new DOMParser().parseFromString(current.content, 'text/html').body.textContent ?? '').trim();
    if (!plainText) { setSaveError('Content is required.'); return; }
    setSaving(true);
    setSaveError(null);
    const data = {
      title:   current.title,
      content: current.content,
      status:  current.status,
      ...(current.coverImage ? { coverImage: current.coverImage } : {}),
    };
    try {
      if (current.id !== null) {
        await dispatch(updateBlogPostAsync({ token, id: current.id, data })).unwrap();
      } else {
        await dispatch(createBlogPostAsync({ token, data })).unwrap();
      }
      setEditing(false);
    } catch (err: unknown) {
      setSaveError((err as Error)?.message ?? 'Failed to save blog post.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (post: ContentPost) => {
    if (!token) return;
    await dispatch(updateBlogPostAsync({
      token,
      id: post.id,
      data: { status: post.status === 'Published' ? 'Draft' : 'Published' },
    }));
  };

  const handleDelete = async (id: number) => {
    if (!token) return;
    await dispatch(deleteBlogPostAsync({ token, id }));
    setDeleteConf(null);
  };

  if (editing) {
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-display font-bold text-white uppercase tracking-wide">
            {current.id ? 'Edit Post' : 'New Post'}
          </h2>
          <button onClick={cancel} className="text-gray-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="bg-brand-dark border border-gray-800 rounded-sm p-6 space-y-6">
          {saveError && (
            <div className="flex items-center gap-2 bg-red-900/30 border border-red-500/40 text-red-400 px-4 py-3 rounded-sm text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {saveError}
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="md:col-span-2 space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Title *</label>
              <input required value={current.title} onChange={e => setCurrent(p => ({ ...p, title: e.target.value }))}
                className="w-full bg-brand-darker border border-gray-700 text-white px-4 py-3 focus:outline-none focus:border-brand-orange rounded-sm" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Status</label>
              <select value={current.status} onChange={e => setCurrent(p => ({ ...p, status: e.target.value as 'Draft' | 'Published' }))}
                className="w-full bg-brand-darker border border-gray-700 text-white px-4 py-3 focus:outline-none focus:border-brand-orange rounded-sm appearance-none">
                <option value="Draft">Draft</option>
                <option value="Published">Published</option>
              </select>
            </div>
            <div className="md:col-span-2 space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Cover Image</label>
              <div className="flex gap-2">
                <input value={current.coverImage} onChange={e => setCurrent(p => ({ ...p, coverImage: e.target.value }))}
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
                      const url = await uploadAdminImageApi(token, file, 'blog');
                      setCurrent(p => ({ ...p, coverImage: url }));
                    } catch (err: unknown) {
                      setSaveError((err as Error)?.message ?? 'Image upload failed.');
                    } finally {
                      setImgUploading(false);
                      e.target.value = '';
                    }
                  }} />
                </label>
              </div>
              {current.coverImage && (
                <div className="relative mt-2 h-32 w-full rounded-sm border border-gray-700 overflow-hidden bg-gray-800">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="w-6 h-6 text-gray-600 animate-spin" />
                  </div>
                  <img src={current.coverImage} alt={current.title || 'Preview'}
                    className="w-full h-full object-cover opacity-0 transition-opacity duration-300"
                    onLoad={e => { (e.target as HTMLImageElement).style.opacity = '1'; }}
                    onError={e => { (e.target as HTMLImageElement).parentElement!.style.display = 'none'; }}
                    referrerPolicy="no-referrer"
                  />
                  <button type="button" onClick={() => setCurrent(p => ({ ...p, coverImage: '' }))}
                    className="absolute top-1 right-1 p-1 bg-black/60 hover:bg-red-500/70 text-white rounded-sm transition-colors"
                    title="Remove image">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
            <div className="md:col-span-2 space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-gray-400">Content *</label>
              <RichTextEditor
                value={current.content}
                onChange={html => setCurrent(p => ({ ...p, content: html }))}
                placeholder="Write your blog post here…"
                minHeight={320}
              />
            </div>
          </div>
          <div className="flex gap-4 pt-4 border-t border-gray-800">
            <button type="submit" disabled={saving}
              className="flex items-center gap-2 bg-brand-orange text-white px-8 py-3 font-bold uppercase tracking-widest hover:bg-orange-600 transition-colors disabled:opacity-60 rounded-sm">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {current.id ? 'Save Changes' : 'Publish'}
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
        <h2 className="text-2xl font-display font-bold text-white uppercase tracking-wide">Blog Posts</h2>
        <button onClick={openNew}
          className="flex items-center gap-2 bg-brand-orange text-white px-4 py-2 text-sm font-bold uppercase tracking-widest hover:bg-orange-600 transition-colors rounded-sm">
          <Plus className="w-4 h-4" /> New Post
        </button>
      </div>

      {status === 'loading' && (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 text-brand-orange animate-spin" /></div>
      )}

      {posts.length > 0 && (
        <div className="bg-brand-dark border border-gray-800 rounded-sm overflow-x-auto">
          <table className="w-full text-left min-w-[500px]">
            <thead>
              <tr className="border-b border-gray-800 bg-brand-darker/50">
                {['Title', 'Status', 'Date', 'Actions'].map(h => (
                  <th key={h} className="p-4 text-xs font-bold uppercase tracking-widest text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {posts.map(post => (
                <tr key={post.id} className="border-b border-gray-800 hover:bg-brand-darker/50 transition-colors">
                  <td className="p-4 text-white font-bold">{post.title}</td>
                  <td className="p-4">
                    <button onClick={() => handleToggleStatus(post)}
                      className={`px-2 py-1 text-xs font-bold uppercase tracking-widest rounded-sm transition-colors ${
                        post.status === 'Published'
                          ? 'bg-green-500/10 text-green-500 hover:bg-green-500/20'
                          : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                      }`}>
                      {post.status}
                    </button>
                  </td>
                  <td className="p-4 text-gray-400 text-sm">
                    {new Date(post.createdAt).toLocaleDateString()}
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <button onClick={() => openEdit(post)}
                        className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-700 text-gray-300 hover:border-brand-orange hover:text-brand-orange text-xs font-bold uppercase rounded-sm transition-colors">
                        <Pencil className="w-3 h-3" /> Edit
                      </button>
                      {deleteConf === post.id ? (
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => handleDelete(post.id)}
                            className="px-3 py-1.5 bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 text-xs font-bold uppercase rounded-sm transition-colors">
                            Confirm
                          </button>
                          <button onClick={() => setDeleteConf(null)}
                            className="px-3 py-1.5 border border-gray-700 text-gray-400 hover:text-white text-xs font-bold uppercase rounded-sm transition-colors">
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => setDeleteConf(post.id)}
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

      {posts.length === 0 && status !== 'loading' && (
        <div className="bg-brand-dark border border-gray-800 rounded-sm p-8 text-center text-gray-500">
          <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No blog posts yet. Click <strong>New Post</strong> to create one.</p>
        </div>
      )}
    </div>
  );
}
