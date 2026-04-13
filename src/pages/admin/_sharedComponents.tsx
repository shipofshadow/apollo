/**
 * Shared React components for user management panels.
 * Non-component utilities live in _sharedUtils.ts.
 */
import type { ReactNode } from 'react';
import { ChevronRight, X } from 'lucide-react';
import type { ConfirmDialogState } from './_sharedUtils';
import { TABLE_PAGE_SIZE } from './_sharedUtils';
export { TABLE_PAGE_SIZE } from './_sharedUtils';

// ── Role badge ────────────────────────────────────────────────────────────────

const ROLE_BADGE_STYLES: Record<string, string> = {
  admin:   'bg-red-900/50 text-red-300 border-red-800',
  manager: 'bg-amber-900/50 text-amber-300 border-amber-800',
  staff:   'bg-blue-900/50 text-blue-300 border-blue-800',
  client:  'bg-gray-800 text-gray-400 border-gray-700',
};

export function RoleBadge({ role }: { role: string }) {
  const cls = ROLE_BADGE_STYLES[role] ?? 'bg-purple-900/50 text-purple-300 border-purple-800';
  return (
    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest ${cls}`}>
      {role}
    </span>
  );
}

// ── Status badge ──────────────────────────────────────────────────────────────

export function StatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest ${
      isActive ? 'bg-green-900/50 text-green-300 border-green-800' : 'bg-red-900/50 text-red-300 border-red-800'
    }`}>
      {isActive ? 'Active' : 'Disabled'}
    </span>
  );
}

// ── Modal shell ───────────────────────────────────────────────────────────────

export function ModalShell({
  title,
  description,
  onClose,
  children,
}: {
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 px-4 py-6"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-lg rounded-xl border border-gray-700 bg-brand-dark shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-start justify-between gap-3 p-5 border-b border-gray-800 shrink-0">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-widest text-white">{title}</h3>
            {description && <p className="mt-1 text-xs text-gray-400">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="mt-0.5 text-gray-400 hover:text-white transition-colors shrink-0"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="overflow-y-auto p-5 flex-1">{children}</div>
      </div>
    </div>
  );
}

// ── Breadcrumbs ───────────────────────────────────────────────────────────────

export function Breadcrumbs({ items }: { items: { label: string; onClick?: () => void }[] }) {
  return (
    <nav className="flex items-center gap-1 text-xs text-gray-500 flex-wrap" aria-label="Breadcrumb">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <ChevronRight className="w-3 h-3 shrink-0" />}
          {item.onClick ? (
            <button
              type="button"
              onClick={item.onClick}
              className="hover:text-white transition-colors"
            >
              {item.label}
            </button>
          ) : (
            <span className="text-gray-300">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

// ── Confirm dialog ────────────────────────────────────────────────────────────

export function ConfirmDialog({
  dialog,
  confirming,
  onConfirm,
  onClose,
}: {
  dialog: ConfirmDialogState;
  confirming: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const isDanger = dialog.tone === 'danger';

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 px-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-sm border border-gray-700 bg-brand-dark p-5 shadow-2xl">
        <h3 className="text-sm font-bold uppercase tracking-widest text-white">{dialog.title}</h3>
        <p className="mt-2 text-sm text-gray-300">{dialog.message}</p>
        {isDanger && (
          <div className="mt-3 rounded-sm border border-red-900/70 bg-red-950/30 px-3 py-2">
            <p className="text-[11px] font-bold uppercase tracking-widest text-red-300">Warning: This action cannot be undone.</p>
          </div>
        )}
        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={confirming}
            className="px-3 py-2 rounded-sm border border-gray-700 text-xs font-bold uppercase tracking-widest text-gray-300 hover:border-gray-500 hover:text-white disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={confirming}
            className={[
              'px-3 py-2 rounded-sm text-xs font-bold uppercase tracking-widest text-white disabled:opacity-50',
              isDanger ? 'bg-red-700 hover:bg-red-600' : 'bg-brand-orange hover:bg-orange-600',
            ].join(' ')}
          >
            {confirming ? 'Please wait...' : (dialog.confirmLabel ?? 'Confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Pager ─────────────────────────────────────────────────────────────────────

export function Pager({
  page,
  totalPages,
  totalItems,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  totalItems: number;
  onPageChange: (next: number) => void;
}) {
  const from = totalItems === 0 ? 0 : (page - 1) * TABLE_PAGE_SIZE + 1;
  const to = Math.min(page * TABLE_PAGE_SIZE, totalItems);
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-800 px-3 py-2">
      <p className="text-xs text-gray-400">Showing {from}-{to} of {totalItems}</p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1}
          className="rounded-sm border border-gray-700 px-2 py-1 text-xs font-bold uppercase tracking-widest text-gray-300 hover:border-brand-orange hover:text-white disabled:opacity-40"
        >
          Prev
        </button>
        <p className="text-xs text-gray-400">Page {page} of {totalPages}</p>
        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
          className="rounded-sm border border-gray-700 px-2 py-1 text-xs font-bold uppercase tracking-widest text-gray-300 hover:border-brand-orange hover:text-white disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}
