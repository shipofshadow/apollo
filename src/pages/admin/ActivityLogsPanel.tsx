import { useEffect, useMemo, useState } from 'react';
import { Activity, ChevronDown, Loader2, RefreshCw, Search, UserRound } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  fetchOwnerActivityLogsApi,
  fetchOwnerActivityUsersApi,
  type OwnerActivityLogEntry,
  type OwnerActivityUserSummary,
} from '../../services/api';

type UserSort = 'most_recent' | 'most_active' | 'name_asc' | 'name_desc';
type ActivityCategory =
  | 'auth'
  | 'booking'
  | 'order'
  | 'inventory'
  | 'content'
  | 'team'
  | 'waitlist'
  | 'settings'
  | 'queue'
  | 'other';

const SORT_LABEL: Record<UserSort, string> = {
  most_recent: 'Most Recent Activity',
  most_active: 'Most Active Users',
  name_asc: 'Name A-Z',
  name_desc: 'Name Z-A',
};

const EVENT_LABELS: Record<string, string> = {
  user_logged_in: 'User Logged In',
  user_registered: 'User Registered',
  user_logged_out: 'User Logged Out',
  user_password_reset: 'Password Reset',
  booking_submitted: 'Booking Submitted',
  status_changed: 'Booking Status Changed',
  before_photos_updated: 'Before Photos Updated',
  after_photos_updated: 'After Photos Updated',
  parts_updated: 'Parts Status Updated',
  internal_notes_updated: 'Internal Notes Updated',
  technician_assigned: 'Technician Assigned',
  technician_unassigned: 'Technician Unassigned',
  calibration_updated: 'Calibration Updated',
  appointment_rescheduled: 'Appointment Rescheduled',
  build_update_posted: 'Build Update Posted',
  build_update_created: 'Build Update Created',
  order_created: 'Order Created',
  order_status_changed: 'Order Status Changed',
  order_tracking_updated: 'Order Tracking Updated',
  order_payment_status_updated: 'Order Payment Updated',
  inventory_item_created: 'Inventory Item Created',
  inventory_item_updated: 'Inventory Item Updated',
  inventory_stock_adjusted: 'Stock Adjusted',
  supplier_created: 'Supplier Created',
  purchase_order_created: 'Purchase Order Created',
  purchase_order_status_updated: 'Purchase Order Status Updated',
  booking_part_requirement_created: 'Part Requirement Created',
  booking_part_requirement_updated: 'Part Requirement Updated',
  team_member_created: 'Team Member Created',
  team_member_updated: 'Team Member Updated',
  team_member_deleted: 'Team Member Deleted',
  waitlist_joined: 'Joined Waitlist',
  waitlist_claim_booked: 'Waitlist Claimed and Booked',
  waitlist_removed: 'Waitlist Entry Removed',
  waitlist_notified: 'Waitlist Notified',
  waitlist_expired: 'Waitlist Expired',
  faq_created: 'FAQ Created',
  faq_updated: 'FAQ Updated',
  faq_deleted: 'FAQ Deleted',
  testimonial_created: 'Testimonial Created',
  testimonial_updated: 'Testimonial Updated',
  testimonial_deleted: 'Testimonial Deleted',
  blog_post_created: 'Blog Post Created',
  blog_post_updated: 'Blog Post Updated',
  blog_post_deleted: 'Blog Post Deleted',
  shop_hours_updated: 'Shop Hours Updated',
  shop_closed_date_added: 'Closed Date Added',
  shop_closed_date_removed: 'Closed Date Removed',
  site_settings_updated: 'Site Settings Updated',
  notification_queue_replay_failed: 'Notification Queue Replay',
  created: 'Created',
  updated: 'Updated',
  deleted: 'Deleted',
};

const CATEGORY_LABEL: Record<ActivityCategory, string> = {
  auth: 'Auth',
  booking: 'Booking',
  order: 'Order',
  inventory: 'Inventory',
  content: 'Content',
  team: 'Team',
  waitlist: 'Waitlist',
  settings: 'Settings',
  queue: 'Queue',
  other: 'Other',
};

const CATEGORY_BADGE: Record<ActivityCategory, string> = {
  auth: 'border-cyan-700/50 bg-cyan-900/30 text-cyan-200',
  booking: 'border-orange-700/50 bg-orange-900/30 text-orange-200',
  order: 'border-emerald-700/50 bg-emerald-900/30 text-emerald-200',
  inventory: 'border-amber-700/50 bg-amber-900/30 text-amber-200',
  content: 'border-violet-700/50 bg-violet-900/30 text-violet-200',
  team: 'border-blue-700/50 bg-blue-900/30 text-blue-200',
  waitlist: 'border-fuchsia-700/50 bg-fuchsia-900/30 text-fuchsia-200',
  settings: 'border-slate-600/60 bg-slate-800/40 text-slate-200',
  queue: 'border-lime-700/50 bg-lime-900/30 text-lime-200',
  other: 'border-gray-700 bg-gray-800/60 text-gray-200',
};

function fmtDate(v: string | null): string {
  if (!v) return 'N/A';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleString();
}

function compactJson(value: unknown): string {
  if (value === null || value === undefined) return '';
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function titleCaseSnake(value: string): string {
  return value
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function readableEvent(log: OwnerActivityLogEntry): string {
  const key = String(log.description || '').trim();
  if (!key) return 'Activity Recorded';
  return EVENT_LABELS[key] ?? titleCaseSnake(key);
}

function readableSubject(log: OwnerActivityLogEntry): string {
  const type = log.subjectType ? titleCaseSnake(log.subjectType) : 'General';
  return log.subjectId ? `${type} #${log.subjectId}` : type;
}

function readableTable(log: OwnerActivityLogEntry): string {
  if (log.subjectType && log.subjectType.trim() !== '') {
    return log.subjectType;
  }

  const props = log.properties ?? {};
  const subjectType = typeof props.subjectType === 'string' ? props.subjectType.trim() : '';
  if (subjectType !== '') {
    return subjectType;
  }

  return 'n/a';
}

function readablePerformer(log: OwnerActivityLogEntry): string {
  const causer = log.causer ?? null;
  const name = typeof causer?.name === 'string' ? causer.name.trim() : '';
  const email = typeof causer?.email === 'string' ? causer.email.trim() : '';
  if (name && email) return `${name} (${email})`;
  if (name) return name;
  if (email) return email;

  const type = log.causerType ? titleCaseSnake(log.causerType) : 'System';
  if (log.causerId) return `${type} #${log.causerId}`;
  return type;
}

function categoryForLog(log: OwnerActivityLogEntry): ActivityCategory {
  const key = String(log.description || '').toLowerCase();
  const logName = String(log.logName || '').toLowerCase();
  const subjectType = String(log.subjectType || '').toLowerCase();
  const source = `${key} ${logName} ${subjectType}`;

  if (source.includes('auth') || source.includes('user_logged_') || source.includes('password_reset')) return 'auth';
  if (source.includes('booking') || source.includes('technician_') || source.includes('appointment_') || source.includes('calibration_') || source.includes('build_update_')) return 'booking';
  if (source.includes('order_') || source.includes('orders') || subjectType === 'product_orders') return 'order';
  if (source.includes('inventory') || source.includes('supplier_') || source.includes('purchase_order_') || source.includes('part_requirement_')) return 'inventory';
  if (source.includes('faq_') || source.includes('testimonial_') || source.includes('blog_post_')) return 'content';
  if (source.includes('team_member_') || subjectType === 'team_members') return 'team';
  if (source.includes('waitlist_') || subjectType === 'booking_waitlist') return 'waitlist';
  if (source.includes('shop_') || source.includes('settings_') || source.includes('site_settings')) return 'settings';
  if (source.includes('queue') || source.includes('notification_jobs') || source.includes('notification_queue')) return 'queue';

  return 'other';
}

function summarizeLog(log: OwnerActivityLogEntry): string {
  const props = log.properties ?? {};
  const action = typeof props.action === 'string' ? props.action : '';
  const detail = typeof props.detail === 'string' ? props.detail : '';
  const eventType = typeof props.eventType === 'string' ? props.eventType : '';

  if (action && detail) return `${action}: ${detail}`;
  if (action) return action;
  if (detail) return detail;
  if (eventType && EVENT_LABELS[eventType]) return EVENT_LABELS[eventType];

  const attrs = log.attribute_changes?.attributes;
  if (attrs && typeof attrs === 'object') {
    const changed = Object.keys(attrs);
    if (changed.length > 0) return `Changed: ${changed.join(', ')}`;
  }

  return log.logName ? `Log: ${titleCaseSnake(log.logName)}` : 'No additional details';
}

function prettyValue(value: unknown): string {
  if (value === null || value === undefined) return 'empty';
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') return value.trim() === '' ? 'empty' : value;
  if (Array.isArray(value)) return value.length === 0 ? 'none' : value.join(', ');
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

type AttributeChangeLine = {
  field: string;
  before: string;
  after: string;
};

function extractAttributeChangeLines(log: OwnerActivityLogEntry): AttributeChangeLine[] {
  const changes = log.attribute_changes;
  if (!changes) return [];

  const after = (changes.attributes ?? {}) as Record<string, unknown>;
  const before = (changes.old ?? {}) as Record<string, unknown>;
  const keys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]));

  return keys
    .map((key) => {
      const beforeRaw = before[key];
      const afterRaw = after[key];
      return {
        field: titleCaseSnake(key),
        before: prettyValue(beforeRaw),
        after: prettyValue(afterRaw),
        hasChanged: compactJson(beforeRaw) !== compactJson(afterRaw),
      };
    })
    .filter((row) => row.hasChanged)
    .map(({ field, before: b, after: a }) => ({ field, before: b, after: a }));
}

export default function ActivityLogsPanel() {
  const { token, user } = useAuth();
  const { showToast } = useToast();

  const [sort, setSort] = useState<UserSort>('most_recent');
  const [users, setUsers] = useState<OwnerActivityUserSummary[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [logs, setLogs] = useState<OwnerActivityLogEntry[]>([]);
  const [search, setSearch] = useState('');

  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const selectedUser = useMemo(
    () => users.find((u) => u.userId === selectedUserId) ?? null,
    [users, selectedUserId]
  );

  const loadUsers = async () => {
    if (!token) return;
    setLoadingUsers(true);
    try {
      const res = await fetchOwnerActivityUsersApi(token, sort);
      const nextUsers = res.users ?? [];
      setUsers(nextUsers);

      if (nextUsers.length === 0) {
        setSelectedUserId(null);
        setLogs([]);
        return;
      }

      const stillExists = selectedUserId !== null && nextUsers.some((u) => u.userId === selectedUserId);
      if (!stillExists) {
        setSelectedUserId(nextUsers[0].userId);
      }
    } catch (e: unknown) {
      showToast((e as Error).message ?? 'Failed to load users with activity.', 'error');
    } finally {
      setLoadingUsers(false);
    }
  };

  const loadLogs = async (userId: number | null) => {
    if (!token || userId === null) {
      setLogs([]);
      return;
    }

    setLoadingLogs(true);
    try {
      const res = await fetchOwnerActivityLogsApi(token, { userId, limit: 400 });
      setLogs(res.logs ?? []);
    } catch (e: unknown) {
      showToast((e as Error).message ?? 'Failed to load activity logs.', 'error');
      setLogs([]);
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    loadUsers();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, sort]);

  useEffect(() => {
    loadLogs(selectedUserId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUserId, token]);

  const filteredLogs = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return logs;

    return logs.filter((log) => {
      const haystack = [
        log.description,
        log.logName,
        log.subjectType ?? '',
        log.subjectId ?? '',
        compactJson(log.properties),
        compactJson(log.attribute_changes),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [logs, search]);

  if (user?.role !== 'owner') {
    return (
      <div className="rounded-lg border border-red-700/30 bg-red-950/20 p-5">
        <p className="text-xs font-bold uppercase tracking-widest text-red-300">Owner Access Required</p>
        <p className="mt-2 text-sm text-red-100/80">This activity log view is restricted to owner accounts only.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-gray-800 bg-[#121212] p-6">
        <p className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-brand-orange">Owner Console</p>
        <h2 className="mt-2 text-3xl font-black uppercase tracking-tight text-white">User Activity Logs</h2>
        <p className="mt-2 text-xs font-mono text-gray-400">Filter users, then inspect every recorded action for the selected account.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <section className="lg:col-span-4 rounded-lg border border-gray-800 bg-[#121212]">
          <header className="flex items-center justify-between border-b border-gray-800 bg-[#151515] px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Users With Activity</p>
            <div className="relative">
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-500" />
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as UserSort)}
                className="appearance-none rounded border border-gray-700 bg-[#111111] py-1 pl-2 pr-7 text-[10px] font-bold uppercase tracking-widest text-gray-300 focus:border-brand-orange focus:outline-none"
              >
                {Object.entries(SORT_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          </header>

          <div className="max-h-[32rem] overflow-y-auto p-2">
            {loadingUsers ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-5 w-5 animate-spin text-brand-orange" />
              </div>
            ) : users.length === 0 ? (
              <div className="px-3 py-10 text-center">
                <UserRound className="mx-auto h-8 w-8 text-gray-600" />
                <p className="mt-2 text-xs uppercase tracking-widest text-gray-500">No users found</p>
              </div>
            ) : (
              users.map((u) => {
                const active = selectedUserId === u.userId;
                return (
                  <button
                    key={u.userId}
                    type="button"
                    onClick={() => setSelectedUserId(u.userId)}
                    className={`mb-2 w-full rounded border px-3 py-3 text-left transition-colors ${
                      active
                        ? 'border-brand-orange/60 bg-brand-orange/10'
                        : 'border-gray-800 bg-[#141414] hover:border-gray-700 hover:bg-[#181818]'
                    }`}
                  >
                    <p className="truncate text-sm font-bold text-white">{u.userName || 'Unknown User'}</p>
                    <p className="truncate text-[11px] text-gray-500">{u.userEmail || 'No email'}</p>
                    <div className="mt-2 flex items-center justify-between text-[10px] uppercase tracking-widest text-gray-400">
                      <span>{u.totalActivities} events</span>
                      <span>{fmtDate(u.lastActivityAt)}</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </section>

        <section className="lg:col-span-8 rounded-lg border border-gray-800 bg-[#121212]">
          <header className="flex flex-col gap-3 border-b border-gray-800 bg-[#151515] px-4 py-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Selected User</p>
              <h3 className="text-sm font-bold text-white">
                {selectedUser ? `${selectedUser.userName} (${selectedUser.totalActivities} logs)` : 'No user selected'}
              </h3>
            </div>
            <div className="flex w-full items-center gap-2 md:w-auto">
              <div className="relative w-full md:w-72">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-500" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search logs, subject, payload..."
                  className="w-full rounded border border-gray-700 bg-[#121212] py-2 pl-8 pr-3 text-xs text-white placeholder:text-gray-500 focus:border-brand-orange focus:outline-none"
                />
              </div>
              <button
                type="button"
                onClick={() => loadLogs(selectedUserId)}
                disabled={loadingLogs || selectedUserId === null}
                className="inline-flex items-center gap-1 rounded border border-gray-700 bg-[#121212] px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-gray-300 hover:border-brand-orange hover:text-brand-orange disabled:opacity-40"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loadingLogs ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </header>

          <div className="max-h-[32rem] overflow-y-auto p-3">
            {loadingLogs ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-5 w-5 animate-spin text-brand-orange" />
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="py-16 text-center text-gray-500">
                <Activity className="mx-auto h-8 w-8 text-gray-600" />
                <p className="mt-2 text-xs uppercase tracking-widest">No activity entries for this filter.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredLogs.map((log) => (
                  <article key={log.id} className="rounded border border-gray-800 bg-[#141414] p-3">
                    {(() => {
                      const category = categoryForLog(log);
                      return (
                    <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                      <div>
                        <p className="text-sm font-bold text-white">{readableEvent(log)}</p>
                        <p className="mt-1 text-xs text-gray-300">{summarizeLog(log)}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] tracking-widest text-gray-500">
                          <span className={`rounded border px-1.5 py-0.5 font-bold ${CATEGORY_BADGE[category]}`}>{CATEGORY_LABEL[category]}</span>
                          <span className="rounded border border-gray-700 px-1.5 py-0.5">Table: {readableTable(log)}</span>
                          <span className="rounded border border-gray-700 px-1.5 py-0.5">{titleCaseSnake(log.logName || 'default')}</span>
                          <span className="rounded border border-gray-700 px-1.5 py-0.5">{readableSubject(log)}</span>
                          <span className="rounded border border-gray-700 px-1.5 py-0.5">Performed by: {readablePerformer(log)}</span>
                        </div>
                      </div>
                      <p className="text-[11px] font-mono text-gray-400">{fmtDate(log.createdAt)}</p>
                    </div>
                      );
                    })()}

                    {log.attribute_changes && (
                      <div className="mt-3 rounded border border-brand-orange/30 bg-brand-orange/5 p-2">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-brand-orange">What Changed</p>
                        {extractAttributeChangeLines(log).length > 0 ? (
                          <ul className="mt-2 space-y-1.5 text-[11px] text-gray-200">
                            {extractAttributeChangeLines(log).map((item) => (
                              <li key={item.field} className="rounded border border-brand-orange/20 bg-[#181818] px-2 py-1.5">
                                <span className="font-semibold text-white">{item.field}:</span>{' '}
                                <span className="text-gray-400">{item.before}</span>
                                <span className="mx-1 text-brand-orange">→</span>
                                <span>{item.after}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="mt-1 text-[11px] text-gray-300">No field-level changes detected.</p>
                        )}

                        <details className="mt-2">
                          <summary className="cursor-pointer text-[10px] uppercase tracking-widest text-gray-400">Show technical JSON</summary>
                          <pre className="mt-1 overflow-x-auto text-[11px] text-gray-300">{JSON.stringify(log.attribute_changes, null, 2)}</pre>
                        </details>
                      </div>
                    )}

                    {log.properties && Object.keys(log.properties).length > 0 && (
                      <details className="mt-3 rounded border border-gray-700 bg-[#111111] p-2">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Custom Properties</p>
                        <pre className="mt-1 overflow-x-auto text-[11px] text-gray-300">{JSON.stringify(log.properties, null, 2)}</pre>
                      </details>
                    )}
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
