import React, { useState, useEffect, useCallback } from 'react';
import {
  Facebook, Link2, Link2Off, Loader2, AlertCircle, CheckCircle2,
  Plus, Send, X, ChevronDown, ChevronUp, ImageIcon,
} from 'lucide-react';
import { useDispatch } from 'react-redux';
import { useAuth } from '../../context/AuthContext';
import {
  fetchFbAuthUrlApi,
  fetchFbPagesApi,
  deleteFbPageApi,
  publishFbPostApi,
} from '../../services/api';
import { addPortfolioItem } from '../../store/portfolioSlice';
import type { AppDispatch } from '../../store';
import type { FacebookPage } from '../../types';
import { BACKEND_URL } from '../../config';

// ── helpers ───────────────────────────────────────────────────────────────────

/** Build the callback URL the Facebook OAuth dialog will redirect back to. */
function callbackUrl(): string {
  return `${BACKEND_URL}/api/admin/fb/callback`;
}

// ── sub-components ────────────────────────────────────────────────────────────

function PageCard({
  page,
  onDisconnect,
}: {
  page: FacebookPage;
  onDisconnect: (pageId: string) => void;
}) {
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="flex items-center justify-between gap-4 bg-brand-darker border border-gray-800 rounded-sm px-4 py-3">
      <div className="flex items-center gap-3 min-w-0">
        <Facebook className="w-5 h-5 text-[#1877F2] shrink-0" />
        <div className="min-w-0">
          <p className="text-white font-bold text-sm truncate">{page.pageName}</p>
          <p className="text-gray-500 text-xs truncate">ID: {page.pageId}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {page.tokenValid ? (
          <span className="flex items-center gap-1 text-green-400 text-xs font-bold uppercase tracking-widest">
            <CheckCircle2 className="w-3.5 h-3.5" /> Connected
          </span>
        ) : (
          <span className="flex items-center gap-1 text-red-400 text-xs font-bold uppercase tracking-widest">
            <AlertCircle className="w-3.5 h-3.5" /> Token expired
          </span>
        )}

        {confirming ? (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => { onDisconnect(page.pageId); setConfirming(false); }}
              className="px-3 py-1.5 bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 text-xs font-bold uppercase rounded-sm transition-colors"
            >
              Confirm
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="px-3 py-1.5 border border-gray-700 text-gray-400 hover:text-white text-xs font-bold uppercase rounded-sm transition-colors"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirming(true)}
            title="Disconnect page"
            className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-700 text-gray-500 hover:border-red-500/50 hover:text-red-400 text-xs font-bold uppercase rounded-sm transition-colors"
          >
            <Link2Off className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

// ── main panel ────────────────────────────────────────────────────────────────

export default function FacebookPanel() {
  const { token } = useAuth();
  const dispatch  = useDispatch<AppDispatch>();

  // ── pages ──
  const [pages,        setPages]        = useState<FacebookPage[]>([]);
  const [pagesLoading, setPagesLoading] = useState(false);
  const [pagesError,   setPagesError]   = useState<string | null>(null);

  // ── connect / OAuth ──
  const [connecting, setConnecting] = useState(false);
  const [connectErr, setConnectErr] = useState<string | null>(null);

  // ── post composer ──
  const [composerOpen,    setComposerOpen]    = useState(false);
  const [selectedPageId,  setSelectedPageId]  = useState('');
  const [message,         setMessage]         = useState('');
  const [features,        setFeatures]        = useState<string[]>(['']);
  const [isPortfolio,     setIsPortfolio]     = useState(false);
  const [portfolioTitle,  setPortfolioTitle]  = useState('');
  const [portfolioCategory, setPortfolioCategory] = useState('');
  const [portfolioImageUrl, setPortfolioImageUrl] = useState('');
  const [publishing,      setPublishing]      = useState(false);
  const [publishResult,   setPublishResult]   = useState<{ postId: string; savedToPortfolio: boolean } | null>(null);
  const [publishError,    setPublishError]    = useState<string | null>(null);

  // ── load pages ──────────────────────────────────────────────────────────────
  const loadPages = useCallback(async () => {
    if (!token) return;
    setPagesLoading(true);
    setPagesError(null);
    try {
      const { pages: list } = await fetchFbPagesApi(token);
      setPages(list);
      if (list.length > 0 && selectedPageId === '') {
        setSelectedPageId(list[0].pageId);
      }
    } catch (e: unknown) {
      setPagesError((e as Error).message ?? 'Failed to load pages.');
    } finally {
      setPagesLoading(false);
    }
  }, [token, selectedPageId]);

  useEffect(() => {
    void loadPages();
    // loadPages is stable (memoized with useCallback on token); re-run only when token changes.
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── OAuth callback redirect ─────────────────────────────────────────────────
  // This effect runs once on mount to detect a Facebook OAuth redirect
  // (?code=…&state=…). After consuming the params the URL is cleaned so a
  // refresh does not re-trigger the flow.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code   = params.get('code');
    const state  = params.get('state');
    if (!code || !state || !token) return;

    // Clean the URL so a refresh doesn't re-trigger the flow
    window.history.replaceState({}, '', window.location.pathname);

    const redirectUri = callbackUrl();
    const url = `${BACKEND_URL}/api/admin/fb/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}&redirect_uri=${encodeURIComponent(redirectUri)}`;

    setConnecting(true);
    setConnectErr(null);
    fetch(url)
      .then(r => r.json())
      .then(data => {
        if (data.detail) throw new Error(data.detail);
        void loadPages();
      })
      .catch((e: unknown) => setConnectErr((e as Error).message ?? 'OAuth callback failed.'))
      .finally(() => setConnecting(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── connect page ────────────────────────────────────────────────────────────
  const handleConnect = async () => {
    if (!token) return;
    setConnecting(true);
    setConnectErr(null);
    try {
      const redirectUri = callbackUrl();
      const { url } = await fetchFbAuthUrlApi(token, redirectUri);
      window.location.href = url;
    } catch (e: unknown) {
      setConnectErr((e as Error).message ?? 'Could not start Facebook Login.');
      setConnecting(false);
    }
  };

  // ── disconnect page ─────────────────────────────────────────────────────────
  const handleDisconnect = async (pageId: string) => {
    if (!token) return;
    try {
      await deleteFbPageApi(token, pageId);
      setPages(prev => prev.filter(p => p.pageId !== pageId));
      if (selectedPageId === pageId) {
        setSelectedPageId('');
      }
    } catch (e: unknown) {
      setPagesError((e as Error).message ?? 'Failed to disconnect page.');
    }
  };

  // ── feature bullet helpers ──────────────────────────────────────────────────
  const setFeature = (idx: number, value: string) =>
    setFeatures(prev => prev.map((f, i) => (i === idx ? value : f)));

  const addFeature    = () => setFeatures(prev => [...prev, '']);
  const removeFeature = (idx: number) =>
    setFeatures(prev => prev.length > 1 ? prev.filter((_, i) => i !== idx) : ['']);

  // ── publish ─────────────────────────────────────────────────────────────────
  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !selectedPageId) return;
    setPublishing(true);
    setPublishError(null);
    setPublishResult(null);

    try {
      const cleanFeatures = features.map(f => f.trim()).filter(Boolean);
      const payload = {
        pageId:  selectedPageId,
        message,
        features: cleanFeatures,
        isPortfolio,
        ...(isPortfolio && {
          portfolioTitle:    portfolioTitle.trim(),
          portfolioCategory: portfolioCategory.trim(),
          portfolioImageUrl: portfolioImageUrl.trim(),
        }),
      };

      const result = await publishFbPostApi(token, payload);

      // If a portfolio item was created server-side, push it into the Redux store
      // without a second API call (it's already persisted).
      if (result.portfolioItem) {
        dispatch(addPortfolioItem(result.portfolioItem));
      }

      setPublishResult({
        postId:           result.postId,
        savedToPortfolio: result.portfolioItem !== null,
      });

      // Reset form
      setMessage('');
      setFeatures(['']);
      setIsPortfolio(false);
      setPortfolioTitle('');
      setPortfolioCategory('');
      setPortfolioImageUrl('');
      setComposerOpen(false);
    } catch (e: unknown) {
      setPublishError((e as Error).message ?? 'Failed to publish post.');
    } finally {
      setPublishing(false);
    }
  };

  // ── render ──────────────────────────────────────────────────────────────────
  const validPages = pages.filter(p => p.tokenValid);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-display font-bold text-white uppercase tracking-wide">
          Facebook Pages
        </h2>
        <p className="text-gray-500 text-sm mt-1">
          Connect your Facebook Page to publish posts directly from this admin panel.
        </p>
      </div>

      {/* Connected pages */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400">
            Connected Pages
          </h3>
          <button
            onClick={handleConnect}
            disabled={connecting}
            className="flex items-center gap-2 bg-[#1877F2] hover:bg-[#166fe5] text-white px-4 py-2 text-xs font-bold uppercase tracking-widest transition-colors disabled:opacity-60 rounded-sm"
          >
            {connecting
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <Link2 className="w-3.5 h-3.5" />}
            Connect Page
          </button>
        </div>

        {connectErr && (
          <div className="flex items-center gap-2 bg-red-900/30 border border-red-500/40 text-red-400 px-4 py-3 rounded-sm text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" /> {connectErr}
          </div>
        )}

        {pagesLoading && (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 text-brand-orange animate-spin" />
          </div>
        )}

        {pagesError && (
          <div className="flex items-center gap-2 bg-red-900/30 border border-red-500/40 text-red-400 px-4 py-3 rounded-sm text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" /> {pagesError}
          </div>
        )}

        {!pagesLoading && pages.length === 0 && (
          <div className="bg-brand-dark border border-gray-800 rounded-sm p-8 text-center text-gray-500">
            <Facebook className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">No pages connected yet. Click <strong>Connect Page</strong> to get started.</p>
          </div>
        )}

        {pages.map(page => (
          <PageCard key={page.pageId} page={page} onDisconnect={handleDisconnect} />
        ))}
      </section>

      {/* Post composer */}
      {validPages.length > 0 && (
        <section className="bg-brand-dark border border-gray-800 rounded-sm overflow-hidden">
          {/* Composer toggle */}
          <button
            onClick={() => { setComposerOpen(v => !v); setPublishError(null); setPublishResult(null); }}
            className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-800/40 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Send className="w-4 h-4 text-brand-orange" />
              <span className="text-sm font-bold uppercase tracking-widest text-white">
                Publish a Post
              </span>
            </div>
            {composerOpen
              ? <ChevronUp className="w-4 h-4 text-gray-400" />
              : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </button>

          {composerOpen && (
            <form onSubmit={handlePublish} className="border-t border-gray-800 p-5 space-y-5">

              {publishResult && (
                <div className="flex items-start gap-2 bg-green-900/30 border border-green-500/40 text-green-400 px-4 py-3 rounded-sm text-sm">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <p>Post published! ID: <code className="font-mono text-xs">{publishResult.postId}</code></p>
                    {publishResult.savedToPortfolio && (
                      <p className="mt-0.5 text-green-300">Also saved to the Portfolio section.</p>
                    )}
                  </div>
                </div>
              )}

              {publishError && (
                <div className="flex items-center gap-2 bg-red-900/30 border border-red-500/40 text-red-400 px-4 py-3 rounded-sm text-sm">
                  <AlertCircle className="w-4 h-4 shrink-0" /> {publishError}
                </div>
              )}

              {/* Page selector */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-gray-400">
                  Post to Page
                </label>
                <select
                  value={selectedPageId}
                  onChange={e => setSelectedPageId(e.target.value)}
                  className="w-full bg-brand-darker border border-gray-700 text-white px-4 py-3 focus:outline-none focus:border-brand-orange rounded-sm text-sm"
                >
                  {validPages.map(p => (
                    <option key={p.pageId} value={p.pageId}>{p.pageName}</option>
                  ))}
                </select>
              </div>

              {/* Message */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-gray-400">
                  Message *
                </label>
                <textarea
                  required
                  rows={4}
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder="Write your post message here…"
                  className="w-full bg-brand-darker border border-gray-700 text-white px-4 py-3 focus:outline-none focus:border-brand-orange rounded-sm resize-none text-sm"
                />
              </div>

              {/* Feature bullets */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-gray-400">
                  Features / Highlights
                  <span className="ml-2 text-gray-600 normal-case font-normal">
                    (appended as bullet points)
                  </span>
                </label>
                <div className="space-y-2">
                  {features.map((feat, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <span className="text-brand-orange text-sm select-none shrink-0">•</span>
                      <input
                        type="text"
                        value={feat}
                        onChange={e => setFeature(idx, e.target.value)}
                        placeholder={`Feature ${idx + 1}`}
                        className="flex-1 bg-brand-darker border border-gray-700 text-white px-3 py-2 focus:outline-none focus:border-brand-orange rounded-sm text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => removeFeature(idx)}
                        className="text-gray-600 hover:text-red-400 transition-colors"
                        title="Remove"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={addFeature}
                  className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-gray-400 hover:text-brand-orange transition-colors pt-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Feature
                </button>
              </div>

              {/* Portfolio checkbox */}
              <div className="border-t border-gray-800 pt-5 space-y-4">
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isPortfolio}
                    onChange={e => setIsPortfolio(e.target.checked)}
                    className="accent-brand-orange w-4 h-4"
                  />
                  <span className="text-sm font-bold uppercase tracking-widest text-white">
                    Also save as a Portfolio item
                  </span>
                </label>
                <p className="text-xs text-gray-500 -mt-2 pl-7">
                  The post will be saved to the Portfolio section and tagged <code className="font-mono">#Portfolio</code> on Facebook.
                </p>

                {/* Portfolio extra fields – visible only when checkbox is on */}
                {isPortfolio && (
                  <div className="pl-7 space-y-4 border-l-2 border-brand-orange/30">
                    {/* Portfolio title */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-widest text-gray-400">
                        Portfolio Title *
                      </label>
                      <input
                        required={isPortfolio}
                        type="text"
                        value={portfolioTitle}
                        onChange={e => setPortfolioTitle(e.target.value)}
                        placeholder="e.g. Subaru WRX STI Quad Retrofit"
                        className="w-full bg-brand-darker border border-gray-700 text-white px-4 py-3 focus:outline-none focus:border-brand-orange rounded-sm text-sm"
                      />
                    </div>

                    {/* Portfolio category */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-widest text-gray-400">
                        Category
                      </label>
                      <input
                        type="text"
                        value={portfolioCategory}
                        onChange={e => setPortfolioCategory(e.target.value)}
                        placeholder="e.g. Quad Projector Retrofit"
                        className="w-full bg-brand-darker border border-gray-700 text-white px-4 py-3 focus:outline-none focus:border-brand-orange rounded-sm text-sm"
                      />
                    </div>

                    {/* Portfolio image */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-widest text-gray-400">
                        Image URL
                        <span className="ml-2 text-gray-600 normal-case font-normal">(optional)</span>
                      </label>
                      <div className="flex gap-2 items-center">
                        <ImageIcon className="w-4 h-4 text-gray-600 shrink-0" />
                        <input
                          type="url"
                          value={portfolioImageUrl}
                          onChange={e => setPortfolioImageUrl(e.target.value)}
                          placeholder="https://…"
                          className="flex-1 bg-brand-darker border border-gray-700 text-white px-4 py-3 focus:outline-none focus:border-brand-orange rounded-sm text-sm"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Submit */}
              <div className="flex gap-3 pt-2 border-t border-gray-800">
                <button
                  type="submit"
                  disabled={publishing || !selectedPageId}
                  className="flex items-center gap-2 bg-brand-orange text-white px-8 py-3 font-bold uppercase tracking-widest hover:bg-orange-600 transition-colors disabled:opacity-60 rounded-sm text-sm"
                >
                  {publishing
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <Send className="w-4 h-4" />}
                  {publishing ? 'Publishing…' : 'Publish Post'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setComposerOpen(false);
                    setPublishError(null);
                    setPublishResult(null);
                  }}
                  className="px-5 py-3 border border-gray-700 text-gray-400 hover:text-white font-bold uppercase tracking-widest transition-colors rounded-sm text-sm"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </section>
      )}

      {/* No valid pages notice when pages exist but all tokens expired */}
      {pages.length > 0 && validPages.length === 0 && (
        <div className="flex items-start gap-3 bg-yellow-900/20 border border-yellow-500/30 text-yellow-400 px-4 py-4 rounded-sm text-sm">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">All page tokens have expired.</p>
            <p className="mt-1 text-yellow-500">
              Disconnect the expired pages and click <strong>Connect Page</strong> to re-authorise.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
