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

/**
 * Returns true when a Facebook post qualifies for the portfolio:
 *  - more than 2 images attached, OR
 *  - message body is longer than 150 characters
 */
export function isPortfolioPost(post: FacebookPost): boolean {
  return (
    getPostImages(post).length > 2 ||
    (post.message?.length ?? 0) > 150
  );
}
