import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { fetchBuildShowcaseApi } from '../services/api';
import type { PortfolioItem } from '../types';

interface BuildUpdate {
  note: string;
  photoUrls: string[];
  createdAt: string;
}

interface BuildVehicle {
  make?: string;
  model?: string;
  year?: string;
  info?: string;
  label?: string;
}

interface BuildShowcaseItem extends PortfolioItem {
  parts?: string[];
  vehicle?: BuildVehicle;
  technician?: string;
  technicianRole?: string;
  technicianImage?: string;
  serviceName?: string;
  referenceNumber?: string;
  appointmentDate?: string;
  notes?: string;
  buildUpdates?: BuildUpdate[];
  beforeImages?: string[];
  afterImages?: string[];
}

function formatDate(raw?: string): string {
  if (!raw) return '';
  try {
    return new Date(raw).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return raw;
  }
}

export default function BuildShowcase() {
  const { slug } = useParams<{ slug: string }>();

  const [build, setBuild] = useState<BuildShowcaseItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shareState, setShareState] = useState<'idle' | 'success' | 'error'>('idle');
  const [lightbox, setLightbox] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) { setError('Not found'); setLoading(false); return; }
    setLoading(true);
    setError(null);
    fetchBuildShowcaseApi(slug)
      .then(data => setBuild(data as BuildShowcaseItem))
      .catch(() => setError('Not found'))
      .finally(() => setLoading(false));
  }, [slug]);

  useEffect(() => {
    if (!lightbox) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setLightbox(null); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [lightbox]);

  async function handleShare() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setShareState('success');
    } catch {
      setShareState('error');
    } finally {
      window.setTimeout(() => setShareState('idle'), 1800);
    }
  }

  if (loading) return (
    <div className="flex min-h-screen items-center justify-center bg-[#0f0f10]">
      <div className="flex flex-col items-center gap-3">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-brand-orange border-t-transparent" />
        <p className="text-xs uppercase tracking-widest text-gray-500">Loading build…</p>
      </div>
    </div>
  );
  if (error || !build) return (
    <div className="flex min-h-screen items-center justify-center bg-[#0f0f10]">
      <p className="text-sm text-red-400">Build not found.</p>
    </div>
  );

  // ── Image deduplication ──────────────────────────────────────────────────
  const rawImages    = Array.isArray(build.images) ? build.images.filter(Boolean) : [];
  const afterImages  = Array.isArray(build.afterImages)  && build.afterImages.length  > 0 ? build.afterImages.filter(Boolean)  : [];
  const beforeImages = Array.isArray(build.beforeImages) && build.beforeImages.length > 0 ? build.beforeImages.filter(Boolean) : [];

  // De-duplicate: track every URL already placed on the page
  const usedUrls = new Set<string>();

  // Hero lead: prefer afterImages[0], then rawImages[0]
  const leadImage = afterImages[0] ?? rawImages[0] ?? null;
  if (leadImage) usedUrls.add(leadImage);

  // Before/after panels (show only the first pair to avoid clutter)
  const beforeImageDisplay = beforeImages[0] ?? null;
  const afterImageDisplay  = afterImages[0]  ?? null;
  if (beforeImageDisplay) usedUrls.add(beforeImageDisplay);
  if (afterImageDisplay)  usedUrls.add(afterImageDisplay);

  // Gather all build-update photos so we can exclude them from gallery too
  const updatePhotoUrls = new Set<string>(
    (build.buildUpdates ?? []).flatMap(u => u.photoUrls).filter(Boolean)
  );
  updatePhotoUrls.forEach(u => usedUrls.add(u));

  // Gallery = everything in rawImages + afterImages not already used
  const allUniqueImages = [...new Set([...rawImages, ...afterImages])];
  const galleryImages = allUniqueImages.filter(url => !usedUrls.has(url)).slice(0, 12);

  // ── Derived booleans ─────────────────────────────────────────────────────
  const vehicleLabel   = build.vehicle?.label || build.vehicle?.info || '';
  const hasTech        = !!build.technician;
  const hasUpdates     = Array.isArray(build.buildUpdates) && build.buildUpdates.length > 0;
  const hasParts       = Array.isArray(build.parts)        && build.parts.length        > 0;
  const hasBeforeAfter = !!beforeImageDisplay && !!afterImageDisplay;

  return (
    <div className="min-h-screen bg-[#0f0f10] text-white">

      {/* ── Lightbox ── */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setLightbox(null)}
        >
          <img
            src={lightbox}
            alt="Full size"
            className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain shadow-2xl"
          />
          <button
            className="absolute right-5 top-5 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
            onClick={() => setLightbox(null)}
          >✕</button>
        </div>
      )}

      {/* ── Full-bleed hero image ── */}
      <div className="relative h-[55vh] min-h-[360px] w-full overflow-hidden md:h-[70vh]">
        {leadImage ? (
          <img
            src={leadImage}
            alt={build.title}
            className="h-full w-full object-cover"
            loading="eager"
          />
        ) : (
          <div className="h-full w-full bg-[#141416]" />
        )}
        {/* Gradient overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0f0f10] via-[#0f0f10]/40 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0f0f10]/60 to-transparent" />

        {/* Hero text overlaid on image */}
        <div className="absolute bottom-0 left-0 right-0 px-5 pb-8 md:px-10 md:pb-12 lg:px-16">
          <div className="mx-auto max-w-6xl">
            <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-brand-orange">
              1625 Auto Lab · Build Showcase
            </p>
            <h1 className="mt-2 text-3xl font-black uppercase leading-tight tracking-tight drop-shadow-lg md:text-[3.25rem]">
              {build.title}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {build.serviceName && (
                <span className="rounded-sm bg-brand-orange px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-white">
                  {build.serviceName}
                </span>
              )}
              {vehicleLabel && (
                <span className="rounded-sm border border-white/20 bg-black/40 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-gray-100 backdrop-blur-sm">
                  {vehicleLabel}
                </span>
              )}
              {build.appointmentDate && (
                <span className="rounded-sm border border-white/20 bg-black/40 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-gray-100 backdrop-blur-sm">
                  {formatDate(build.appointmentDate)}
                </span>
              )}
              {build.referenceNumber && (
                <span className="rounded-sm border border-white/20 bg-black/40 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-gray-400 backdrop-blur-sm">
                  #{build.referenceNumber}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="mx-auto max-w-6xl px-5 py-10 md:px-10 lg:px-16">

        {/* ── Description + share row ── */}
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <p className="max-w-2xl text-sm leading-relaxed text-gray-400">
            {build.description || 'A completed client build by 1625 Auto Lab.'}
          </p>
          <button
            onClick={handleShare}
            className="shrink-0 rounded-sm border border-white/15 bg-white/5 px-5 py-2.5 text-[11px] font-bold uppercase tracking-widest text-white transition hover:bg-white/10"
          >
            {shareState === 'success' ? '✓ Copied!' : shareState === 'error' ? 'Failed' : '⬡ Share Build'}
          </button>
        </div>

        {/* ── Info cards row ── */}
        {(hasTech || vehicleLabel || hasParts) && (
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">

            {/* Vehicle */}
            {vehicleLabel && (
              <div className="rounded-2xl border border-white/8 bg-[#141416] p-5">
                <p className="text-[9px] font-bold uppercase tracking-[0.28em] text-brand-orange">Vehicle</p>
                <p className="mt-2 text-lg font-bold leading-snug text-white">{vehicleLabel}</p>
                {(build.vehicle?.year || build.vehicle?.make || build.vehicle?.model) && (
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    {[
                      { label: 'Year',  val: build.vehicle?.year  },
                      { label: 'Make',  val: build.vehicle?.make  },
                      { label: 'Model', val: build.vehicle?.model },
                    ].filter(x => x.val).map(({ label, val }) => (
                      <div key={label} className="rounded-lg bg-white/4 px-2 py-2 text-center">
                        <p className="text-[8px] uppercase tracking-widest text-gray-600">{label}</p>
                        <p className="mt-0.5 truncate text-[11px] font-bold text-white">{val}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Technician */}
            {hasTech && (
              <div className="flex items-center gap-4 rounded-2xl border border-white/8 bg-[#141416] p-5">
                {build.technicianImage ? (
                  <img
                    src={build.technicianImage}
                    alt={build.technician}
                    className="h-14 w-14 shrink-0 rounded-full border border-white/10 object-cover"
                  />
                ) : (
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand-orange/20 text-xl font-black text-brand-orange">
                    {(build.technician ?? '?')[0].toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-[9px] font-bold uppercase tracking-[0.28em] text-gray-500">Technician</p>
                  <p className="mt-1 truncate font-bold text-white">{build.technician}</p>
                  {build.technicianRole && (
                    <p className="truncate text-[11px] text-brand-orange">{build.technicianRole}</p>
                  )}
                </div>
              </div>
            )}

            {/* Installed Parts */}
            {hasParts && (
              <div className="rounded-2xl border border-white/8 bg-[#141416] p-5">
                <p className="text-[9px] font-bold uppercase tracking-[0.28em] text-brand-orange">
                  Installed Parts
                </p>
                <ul className="mt-3 space-y-1.5">
                  {build.parts!.map((part, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-orange" />
                      {part}
                    </li>
                  ))}
                </ul>
              </div>
            )}

          </div>
        )}

        {/* ── Customer Notes ── */}
        {build.notes && (
          <div className="mt-6 rounded-2xl border border-white/8 bg-[#141416] px-6 py-4">
            <p className="text-[9px] font-bold uppercase tracking-[0.28em] text-gray-500">Customer Notes</p>
            <p className="mt-2 text-sm leading-relaxed text-gray-300">{build.notes}</p>
          </div>
        )}

        {/* ── Before / After ── */}
        {hasBeforeAfter && (
          <section className="mt-12">
            <SectionLabel>Before &amp; After</SectionLabel>
            <div className="mt-4 grid grid-cols-2 gap-2 overflow-hidden rounded-2xl border border-white/8 md:gap-0.5">
              <div
                className="group relative cursor-zoom-in overflow-hidden"
                onClick={() => setLightbox(beforeImageDisplay)}
              >
                <img
                  src={beforeImageDisplay!}
                  alt="Before"
                  className="h-56 w-full object-cover transition-transform duration-500 group-hover:scale-105 md:h-80"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                <span className="absolute bottom-3 left-3 rounded-sm bg-black/60 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-gray-300 backdrop-blur-sm">
                  Before
                </span>
              </div>
              <div
                className="group relative cursor-zoom-in overflow-hidden"
                onClick={() => setLightbox(afterImageDisplay)}
              >
                <img
                  src={afterImageDisplay!}
                  alt="After"
                  className="h-56 w-full object-cover transition-transform duration-500 group-hover:scale-105 md:h-80"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                <span className="absolute bottom-3 left-3 rounded-sm bg-brand-orange px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-white">
                  After
                </span>
              </div>
            </div>
          </section>
        )}

        {/* ── Build Progress Timeline ── */}
        {hasUpdates && (
          <section className="mt-12">
            <SectionLabel>Build Progress</SectionLabel>
            <div className="mt-5 space-y-0">
              {build.buildUpdates!.map((update, i) => (
                <div key={i} className="relative flex gap-5 pb-8 last:pb-0">
                  {/* Vertical line */}
                  {i < build.buildUpdates!.length - 1 && (
                    <div className="absolute left-[19px] top-10 h-[calc(100%-2rem)] w-px bg-white/8" />
                  )}
                  {/* Step number */}
                  <div className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-brand-orange/30 bg-brand-orange/10 text-[11px] font-black text-brand-orange">
                    {i + 1}
                  </div>
                  {/* Content */}
                  <div className="flex-1 rounded-2xl border border-white/8 bg-[#141416] p-5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Update {i + 1}</p>
                      {update.createdAt && (
                        <p className="text-[10px] text-gray-600">{formatDate(update.createdAt)}</p>
                      )}
                    </div>
                    {update.note && (
                      <p className="mt-2 text-sm leading-relaxed text-gray-300">{update.note}</p>
                    )}
                    {update.photoUrls.length > 0 && (
                      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                        {update.photoUrls.map((url, j) => (
                          <button
                            key={j}
                            className="group overflow-hidden rounded-xl border border-white/8 bg-black/30"
                            onClick={() => setLightbox(url)}
                          >
                            <img
                              src={url}
                              alt={`Update ${i + 1} · ${j + 1}`}
                              className="h-24 w-full object-cover transition-transform duration-300 group-hover:scale-110"
                              loading="lazy"
                            />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Gallery ── */}
        <section className="mt-12">
          <SectionLabel>Gallery</SectionLabel>
          {galleryImages.length > 0 ? (
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {galleryImages.map((url, i) => (
                <button
                  key={`${url}-${i}`}
                  className="group relative overflow-hidden rounded-xl border border-white/8 bg-black/20"
                  onClick={() => setLightbox(url)}
                >
                  <img
                    src={url}
                    alt={`${build.title} · ${i + 1}`}
                    className="h-36 w-full object-cover transition-transform duration-500 group-hover:scale-110 md:h-44"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-black/0 transition-colors duration-300 group-hover:bg-black/20" />
                  <span className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                    <span className="rounded-full bg-black/60 p-2 text-white backdrop-blur-sm">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
                      </svg>
                    </span>
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-white/8 bg-[#141416] px-4 py-10 text-center text-sm text-gray-600">
              All photos are featured in the sections above.
            </div>
          )}
        </section>

        {/* ── Footer stamp ── */}
        <div className="mt-16 border-t border-white/6 pt-8 text-center">
          <p className="text-[10px] uppercase tracking-[0.28em] text-gray-600">
            1625 Auto Lab · Completed Build
            {build.referenceNumber && <> · #{build.referenceNumber}</>}
          </p>
        </div>

      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="h-px flex-1 bg-white/8" />
      <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-gray-500">{children}</p>
      <span className="h-px flex-1 bg-white/8" />
    </div>
  );
}
