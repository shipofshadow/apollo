import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const SITE_URL = 'https://1625autolab.com';
const DEFAULT_OG_IMAGE = 'https://cdn.1625autolab.com/1625autolab/icons/android-chrome-512x512.png';

interface PageSEOProps {
  title: string;
  description: string;
  image?: string;
  type?: 'website' | 'article';
  /** When false the title is used as-is; when true (default) " | 1625 Auto Lab" is appended. */
  appendSiteName?: boolean;
}

function setMetaContent(selector: string, content: string) {
  document.querySelector(selector)?.setAttribute('content', content);
}

/**
 * Drop this component anywhere inside a page to update <title> and all relevant
 * meta tags (description, Open Graph, Twitter Card, canonical) for that route.
 * No extra packages required — uses plain DOM manipulation via useEffect.
 */
export default function PageSEO({
  title,
  description,
  image = DEFAULT_OG_IMAGE,
  type = 'website',
  appendSiteName = true,
}: PageSEOProps) {
  const { pathname } = useLocation();

  useEffect(() => {
    const fullTitle = appendSiteName ? `${title} | 1625 Auto Lab` : title;
    const canonicalUrl = `${SITE_URL}${pathname}`;

    document.title = fullTitle;

    setMetaContent('meta[name="description"]', description);
    setMetaContent('meta[property="og:title"]', fullTitle);
    setMetaContent('meta[property="og:description"]', description);
    setMetaContent('meta[property="og:url"]', canonicalUrl);
    setMetaContent('meta[property="og:type"]', type);
    setMetaContent('meta[property="og:image"]', image);
    setMetaContent('meta[name="twitter:title"]', fullTitle);
    setMetaContent('meta[name="twitter:description"]', description);
    setMetaContent('meta[name="twitter:image"]', image);

    let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.href = canonicalUrl;
  }, [title, description, pathname, image, type, appendSiteName]);

  return null;
}
