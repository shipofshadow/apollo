import { createAvatar } from '@dicebear/core';
import { bottts } from '@dicebear/collection';

type AvatarIdentity = {
  id?: number | string | null;
  name?: string | null;
  email?: string | null;
};

function seedFromIdentity(identity: AvatarIdentity): string {
  const idPart = identity.id !== null && identity.id !== undefined ? String(identity.id) : '';
  const namePart = (identity.name ?? '').trim();
  const emailPart = (identity.email ?? '').trim().toLowerCase();
  const seed = [idPart, namePart, emailPart].filter(Boolean).join('|');
  return seed !== '' ? seed : 'guest';
}

export function getDicebearAvatarDataUri(identity: AvatarIdentity): string {
  const avatar = createAvatar(bottts, {
    seed: seedFromIdentity(identity),
    size: 128,
    flip: true,
    backgroundColor: ['#FBBF24', '#F87171', '#60A5FA', '#34D399', '#A78BFA', '#F472B6'],
  });

  return `data:image/svg+xml;utf8,${encodeURIComponent(avatar.toString())}`;
}
