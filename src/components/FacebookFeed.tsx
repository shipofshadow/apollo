/**
 * FacebookFeed
 *
 * Renders the official Facebook Page Plugin (iframe embed) instead of
 * the Graph API feed.  This requires no access token and always shows
 * the latest posts exactly as they appear on the Page timeline.
 *
 * The Facebook SDK is loaded lazily (only when the component mounts) so
 * it doesn't block the initial page render.
 */
import { useEffect, useRef, useState } from 'react';
import { Facebook } from 'lucide-react';

const FB_PAGE_URL = 'https://www.facebook.com/1625autolab';

/** Facebook Page Plugin accepts widths between 180 and 500 px. */
const FB_MIN_WIDTH = 180;
const FB_MAX_WIDTH = 500;

declare global {
  interface Window {
    FB?: {
      XFBML: { parse: () => void };
      init: (options: Record<string, unknown>) => void;
    };
    fbAsyncInit?: () => void;
  }
}

export default function FacebookFeed() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [pluginWidth, setPluginWidth] = useState(FB_MAX_WIDTH);

  // Keep pluginWidth in sync with the wrapper's actual rendered width.
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;

    let debounceTimer: ReturnType<typeof setTimeout>;

    const update = (entries?: ResizeObserverEntry[]) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        const w = entries ? entries[0].contentRect.width : el.clientWidth;
        const clamped = Math.min(FB_MAX_WIDTH, Math.max(FB_MIN_WIDTH, Math.floor(w)));
        setPluginWidth((prev) => (prev === clamped ? prev : clamped));
      }, 100);
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      clearTimeout(debounceTimer);
      ro.disconnect();
    };
  }, []);

  // Re-parse XFBML whenever the measured width changes so the plugin resizes.
  useEffect(() => {
    window.FB?.XFBML.parse();
  }, [pluginWidth]);

  useEffect(() => {
    // Re-parse XFBML after the SDK loads so the plugin renders
    const parsePlugin = () => window.FB?.XFBML.parse();

    if (window.FB) {
      parsePlugin();
      return;
    }

    // Load the SDK once
    if (!document.getElementById('facebook-jssdk')) {
      window.fbAsyncInit = () => {
        window.FB?.init({ xfbml: true, version: 'v19.0' });
        parsePlugin();
      };
      const script = document.createElement('script');
      script.id = 'facebook-jssdk';
      script.async = true;
      script.defer = true;
      script.crossOrigin = 'anonymous';
      script.src = 'https://connect.facebook.net/en_US/sdk.js';
      document.head.appendChild(script);
    }
  }, []);

  return (
    <section className="py-24 bg-brand-darker border-t border-gray-800">
      {/* Facebook root div required by the SDK */}
      <div id="fb-root" />

      <div className="container mx-auto px-4 md:px-6">
        {/* Section header */}
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <span className="text-brand-orange font-bold uppercase tracking-widest text-sm">
            Social Updates
          </span>
          <h2 className="text-4xl md:text-5xl font-display font-black text-white uppercase tracking-tighter">
            Latest from <span className="text-brand-orange">The Lab</span>
          </h2>
          <div className="w-24 h-1 bg-brand-orange mx-auto mt-6" />
        </div>

        {/* Two-column layout on lg+ screens; stacked on mobile */}
        <div className="flex flex-col lg:flex-row gap-10 items-start justify-center">
          {/* Responsive embed wrapper — capped at FB_MAX_WIDTH so the plugin
              always fills its container up to the SDK's 500 px hard limit. */}
          <div
            ref={wrapperRef}
            className="w-full lg:flex-1"
            style={{ maxWidth: FB_MAX_WIDTH }}
          >
            {/* Facebook Page Plugin */}
            <div
              className="fb-page rounded-sm overflow-hidden shadow-2xl border border-gray-800"
              data-href={FB_PAGE_URL}
              data-tabs="timeline"
              data-width={String(pluginWidth)}
              data-height="900"
              data-small-header="false"
              data-adapt-container-width="true"
              data-hide-cover="false"
              data-show-facepile="true"
            />
          </div>

          {/* Info / CTA panel */}
          <div className="w-full lg:flex-1 flex flex-col gap-8 lg:pt-4">
            <div className="space-y-4">
              <h3 className="text-2xl md:text-3xl font-display font-black text-white uppercase tracking-tighter">
                Follow Us on <span className="text-brand-orange">Facebook</span>
              </h3>
              <p className="text-gray-400 leading-relaxed">
                Stay up to date with our latest custom builds, shop updates, and behind-the-scenes content. 
                Follow our page to never miss a drop from 1625 Auto Lab.
              </p>
            </div>

            <ul className="space-y-3 text-gray-300 text-sm">
              {[
                'New build reveals & progress shots',
                'Shop announcements & specials',
                'Customer ride features',
                'Event coverage & giveaways',
              ].map((item) => (
                <li key={item} className="flex items-center gap-3">
                  <span className="w-2 h-2 rounded-full bg-brand-orange flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>

            {/* CTA link */}
            <a
              href={FB_PAGE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-3 border border-gray-700 text-gray-300 hover:border-brand-orange hover:text-brand-orange px-8 py-3 font-bold uppercase tracking-widest text-sm transition-colors rounded-sm self-start"
            >
              <Facebook className="w-5 h-5" />
              View Our Facebook Page
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
