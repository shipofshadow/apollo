/**
 * Shared constants, types, and utility functions for user management panels.
 * No React components here — kept in _sharedComponents.tsx.
 */

export const TABLE_PAGE_SIZE = 8;

// ── Permission catalog ────────────────────────────────────────────────────────

export const PERMISSION_CATALOG = [
  { key: 'analytics:view',      label: 'View Analytics',     description: 'Can view dashboard charts and reports.' },
  { key: 'bookings:manage',     label: 'Manage Bookings',    description: 'Can view and update booking records.' },
  { key: 'bookings:assign-tech',label: 'Assign Technicians', description: 'Can assign team members to jobs.' },
  { key: 'bookings:notes',      label: 'Internal Notes',     description: 'Can edit internal booking notes.' },
  { key: 'chatbot:manage',      label: 'Manage Chatbot',     description: 'Can access the chatbot console, handoff queue, and reply as an agent.' },
  { key: 'build-updates:manage',label: 'Build Updates',      description: 'Can post progress updates and photos.' },
  { key: 'clients:manage',      label: 'Manage Clients',     description: 'Can view clients and booking counts.' },
  { key: 'users:manage',        label: 'Manage Users',       description: 'Can create users and change user roles.' },
  { key: 'roles:view',          label: 'View Roles',         description: 'Can view role matrix and role definitions.' },
  { key: 'roles:manage',        label: 'Manage Roles',       description: 'Can create, edit, and delete roles.' },
  { key: 'security:audit:view', label: 'Security Audit',     description: 'Can view and export authentication security audit logs.' },
  { key: 'reviews:manage',      label: 'Manage Reviews',     description: 'Can approve, reject, and delete reviews.' },
  { key: 'shop-hours:manage',   label: 'Shop Hours',         description: 'Can update business hours.' },
  { key: 'media:upload',        label: 'Media Uploads',      description: 'Can upload service/product/content media.' },
  { key: 'client:self',         label: 'Client Portal',      description: 'Can use own client account pages only.' },
] as const;

export const PERMISSION_LABELS: Record<string, string> = PERMISSION_CATALOG.reduce((acc, item) => {
  acc[item.key] = item.label;
  return acc;
}, {} as Record<string, string>);

// ── Permission string helpers ─────────────────────────────────────────────────

export function stringifyPermissions(list: string[]): string {
  return list.join(', ');
}

export function parsePermissions(raw: string): string[] {
  const set = new Set<string>();
  raw
    .split(/[\n,]/g)
    .map(item => item.trim().toLowerCase())
    .filter(Boolean)
    .forEach(item => set.add(item));
  return Array.from(set);
}

export function stringifyPermissionLabel(permission: string): string {
  return PERMISSION_LABELS[permission] ?? permission;
}

export function togglePermissionInRaw(raw: string, permission: string): string {
  const list = parsePermissions(raw);
  const next = list.includes(permission)
    ? list.filter(item => item !== permission)
    : [...list, permission];
  return stringifyPermissions(next);
}

export function hasPermissionInRaw(raw: string, permission: string): boolean {
  return parsePermissions(raw).includes(permission);
}

export function slugifyRoleKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 32);
}

// ── Shared types ──────────────────────────────────────────────────────────────

export type RoleDraft = {
  key: string;
  name: string;
  description: string;
  permissions: string;
};

export type ConfirmDialogState = {
  title: string;
  message: string;
  confirmLabel?: string;
  tone?: 'default' | 'danger';
  onConfirm: () => Promise<void>;
};
