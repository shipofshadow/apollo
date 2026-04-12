import type { FacebookPost } from '../types';

export function getPostImages(post: FacebookPost): string[] {
  const subattachments = post.attachments?.data?.[0]?.subattachments?.data;
  if (subattachments && subattachments.length > 0) {
    return subattachments
      .map((sub) => sub.media?.image?.src)
      .filter((src): src is string => Boolean(src));
  }
  const single =
    post.full_picture ?? post.attachments?.data?.[0]?.media?.image?.src ?? null;
  return single ? [single] : [];
}

export function getPostTitle(post: FacebookPost, maxLength = 80): string {
  const msg = post.message ?? '';
  const firstLine = msg.split('\n')[0].trim();
  return firstLine.length > maxLength
    ? firstLine.slice(0, maxLength) + '…'
    : firstLine || 'Facebook Post';
}

export function getPostUrl(postId: string): string {
  const parts = postId.split('_');
  return parts.length === 2
    ? `https://www.facebook.com/${parts[0]}/posts/${parts[1]}`
    : `https://www.facebook.com/${postId}`;
}

function normalizePostText(post: FacebookPost): string {
  return (post.message ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasVehicleName(text: string): boolean {
  return (
    /\b(?:vehicle|unit|car)\s*:\s*[a-z0-9][a-z0-9\s\-_/]{2,}/i.test(text) ||
    /\b(?:19|20)\d{2}\s+[a-z][a-z0-9\-]+\s+[a-z][a-z0-9\-]+/i.test(text)
  );
}

function hasServiceCountMarker(text: string): boolean {
  return /\bx\s*[12]\b/i.test(text);
}

function hasInstallKeyword(text: string): boolean {
  return /\b(?:head\s*unit|headunit|android\s*head\s*unit|head\s*light|headlights?|fog\s*light|foglights?|projector\s*headlights?)\b/i.test(text);
}

/**
 * Returns true when a Facebook post qualifies for the portfolio:
 *  - has at least two images,
 *  - includes a vehicle name,
 *  - includes x1 or x2 marker,
 *  - includes install keywords (headunit/headlights/foglights),
 *  - and message length over 200 characters.
 */
export function isPortfolioPost(post: FacebookPost): boolean {
  const text = normalizePostText(post);

  return (
    getPostImages(post).length >= 2 &&
    hasVehicleName(text) &&
    hasServiceCountMarker(text) &&
    hasInstallKeyword(text) &&
    text.length > 200
  );
}
