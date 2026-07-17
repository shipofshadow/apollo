import { DEFAULT_SEO, ROUTE_SEO } from './src/seo/routes';

export const config = {
  matcher: '/((?!api|assets|_vercel|.*\\..*).*)',
};

const SITE_URL = 'https://1625autolab.com';
const DEFAULT_OG_IMAGE = 'https://cdn.1625autolab.com/1625autolab/logos/1625%20Autolab%20FB%20Logo.png';
const BOT_UA = /facebookexternalhit|Facebot|Twitterbot|LinkedInBot|WhatsApp|TelegramBot|Slackbot|Discordbot|Pinterest/i;

export default async function middleware(req: Request) {
  const ua = req.headers.get('user-agent') || '';
  if (!BOT_UA.test(ua)) {
    return;
  }

  const url = new URL(req.url);
  const seo = ROUTE_SEO[url.pathname] ?? DEFAULT_SEO;
  const image = seo.image ?? DEFAULT_OG_IMAGE;
  const canonical = `${SITE_URL}${url.pathname === '/' ? '' : url.pathname}`;

  const indexRes = await fetch(new URL('/index.html', req.url));
  let html = await indexRes.text();

  const metaTags = `
    <title>${escapeHtml(seo.title)}</title>
    <meta name="description" content="${escapeHtml(seo.description)}" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${canonical}" />
    <meta property="og:site_name" content="1625 Autolab" />
    <meta property="og:title" content="${escapeHtml(seo.title)}" />
    <meta property="og:description" content="${escapeHtml(seo.description)}" />
    <meta property="og:image" content="${image}" />
    <meta property="og:image:alt" content="${escapeHtml(seo.title)}" />
    <meta property="og:locale" content="en_PH" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(seo.title)}" />
    <meta name="twitter:description" content="${escapeHtml(seo.description)}" />
    <meta name="twitter:image" content="${image}" />
    <link rel="canonical" href="${canonical}" />
  `;

  html = html
    .replace(/<title>.*?<\/title>/i, '')
    .replace(/<meta\s+(name="description"|property="og:[^"]*"|name="twitter:[^"]*")[^>]*>/gi, '')
    .replace('</head>', `${metaTags}</head>`);

  return new Response(html, {
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
}

function escapeHtml(str: string) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
