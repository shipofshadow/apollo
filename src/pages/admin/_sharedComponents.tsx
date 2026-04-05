/**
 * Shared React components for user management panels.
 * Non-component utilities live in _sharedUtils.ts.
 */
import type { ConfirmDialogState } from './_sharedUtils';
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
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 px-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-sm border border-gray-700 bg-brand-dark p-5 shadow-2xl">
        <h3 className="text-sm font-bold uppercase tracking-widest text-white">{dialog.title}</h3>
        <p className="mt-2 text-sm text-gray-300">{dialog.message}</p>
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
              dialog.tone === 'danger' ? 'bg-red-700 hover:bg-red-600' : 'bg-brand-orange hover:bg-orange-600',
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
