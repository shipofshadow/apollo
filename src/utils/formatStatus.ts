/** Map raw booking‑status keys to friendly labels. */
const STATUS_LABELS: Record<string, string> = {
  pending:        'Pending',
  confirmed:      'Confirmed',
  completed:      'Completed',
  cancelled:      'Cancelled',
  awaiting_parts: 'Awaiting Parts',
};

/**
 * Convert a raw status value (e.g. `"awaiting_parts"`) to a
 * human-readable label (e.g. `"Awaiting Parts"`).
 */
export function formatStatus(status: string): string {
  return STATUS_LABELS[status] ?? status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
