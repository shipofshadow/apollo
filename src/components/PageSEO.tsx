import { Helmet } from 'react-helmet-async';
import { useLocation } from 'react-router-dom';

const SITE_URL = 'https://1625autolab.com';
const DEFAULT_OG_IMAGE = 'https://cdn.1625autolab.com/1625autolab/logos/1625%20Autolab%20FB%20Logo.png';
const SITE_NAME = '1625 Autolab';
const THEME_COLOR = '#f97316';

interface PageSEOProps {
  title: string;
  description: string;
  image?: string;
  keywords?: string;
  type?: 'website' | 'article';
  /** When false the title is used as-is; when true (default) " | 1625 Autolab" is appended. */
  appendSiteName?: boolean;
  /** Optional JSON-LD schema markup to be injected for rich results. */
  schemaMarkup?: Record<string, unknown> | null;
  /** Override the canonical URL for this page. */
  canonicalUrl?: string;
  /** Override the default robots policy for this page. */
  robots?: string;
}

/**
 * Use react-helmet-async to update <title> and all relevant meta tags
 * (description, Open Graph, Twitter Card, canonical) for that route.
 * Works with SEO crawlers by managing meta tags in the document head.
 */
export default function PageSEO({
  title,
  description,
  image = DEFAULT_OG_IMAGE,
  keywords = 'automotive retrofitting, projector headlights, HID conversion, LED conversion, car customization, 1625 Autolab',
  type = 'website',
  appendSiteName = true,
  schemaMarkup = null,
  canonicalUrl,
  robots = 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1',
}: PageSEOProps) {
  const { pathname } = useLocation();

  const fullTitle = appendSiteName ? `${title} | ${SITE_NAME}` : title;
  const resolvedCanonicalUrl = canonicalUrl ?? `${SITE_URL}${pathname === '/' ? '' : pathname}`;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />
      <meta name="theme-color" content={THEME_COLOR} />
      <meta name="robots" content={robots} />
      
      {/* Open Graph */}
      <meta property="og:type" content={type} />
      <meta property="og:url" content={resolvedCanonicalUrl} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />
      <meta property="og:image:alt" content={fullTitle} />
      <meta property="og:locale" content="en_PH" />
      
      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />
      
      {/* Canonical */}
      <link rel="canonical" href={resolvedCanonicalUrl} />

      {schemaMarkup && (
        <script type="application/ld+json">
          {JSON.stringify(schemaMarkup)}
        </script>
      )}
    </Helmet>
  );
}
