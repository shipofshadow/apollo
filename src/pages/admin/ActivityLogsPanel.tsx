import { useEffect, useMemo, useState } from 'react';
import { Activity, ChevronDown, Loader2, RefreshCw, Search, UserRound, ShieldAlert, FileText, ArrowRight } from 'lucide-react';
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
  auth: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-400 font-mono font-bold',
  booking: 'border-brand-orange/30 bg-brand-orange/10 text-brand-orange font-mono font-bold',
  order: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400 font-mono font-bold',
  inventory: 'border-amber-500/30 bg-amber-500/10 text-amber-400 font-mono font-bold',
  content: 'border-violet-500/30 bg-violet-500/10 text-violet-400 font-mono font-bold',
  team: 'border-sky-500/30 bg-sky-500/10 text-sky-400 font-mono font-bold',
  waitlist: 'border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-400 font-mono font-bold',
  settings: 'border-gray-700 bg-gray-800/60 text-gray-300 font-mono font-bold',
  queue: 'border-lime-500/30 bg-lime-500/10 text-lime-400 font-mono font-bold',
  other: 'border-gray-800 bg-gray-800/40 text-gray-400 font-mono font-bold',
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
      <div className="rounded-xl border border-red-500/30 bg-red-950/30 p-8 text-center space-y-3 font-sans shadow-2xl">
        <ShieldAlert className="w-12 h-12 text-red-400 mx-auto" />
        <h3 className="text-lg font-display font-black uppercase tracking-tight text-red-200">Owner Access Required</h3>
        <p className="text-xs font-mono text-red-300/80 max-w-md mx-auto">
          The User Activity Logs audit trail is restricted to root owner accounts only.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-sans pb-20">
      {/* Top Hero Card */}
      <section className="relative overflow-hidden rounded-xl border border-gray-800/80 bg-[#121212] p-6 shadow-2xl">
        <div className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full bg-brand-orange/15 blur-3xl" />
        <div className="pointer-events-none absolute -left-16 bottom-0 h-40 w-40 rounded-full bg-orange-300/10 blur-3xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-brand-orange/10 border border-brand-orange/20 rounded-xl">
              <Activity className="w-6 h-6 text-brand-orange" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-brand-orange">Owner Console</p>
              </div>
              <h2 className="text-2xl font-display font-black uppercase tracking-tight text-white">User Activity Logs &amp; Audit Trail</h2>
            </div>
          </div>
          <div className="rounded-lg border border-brand-orange/40 bg-brand-orange/10 px-4 py-2 text-right">
            <p className="text-[10px] font-mono uppercase tracking-widest text-gray-400">Total Tracked Accounts</p>
            <p className="text-sm font-mono font-bold text-white">{users.length} Users</p>
          </div>
        </div>
      </section>

      {/* Main Grid Workspace */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: User Selector Panel */}
        <section className="lg:col-span-4 rounded-xl border border-gray-800/80 bg-[#121212] overflow-hidden shadow-2xl flex flex-col justify-between">
          <div>
            <header className="flex items-center justify-between border-b border-gray-800/80 bg-brand-dark/50 px-5 py-4">
              <div className="flex items-center gap-2">
                <UserRound className="w-4 h-4 text-brand-orange" />
                <p className="text-xs font-mono font-bold uppercase tracking-widest text-white">Active Accounts</p>
              </div>
              <div className="relative">
                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-500" />
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as UserSort)}
                  className="appearance-none rounded-lg border border-gray-800 bg-brand-darker py-1.5 pl-3 pr-8 text-[10px] font-mono font-bold uppercase tracking-widest text-gray-300 focus:border-brand-orange focus:outline-none cursor-pointer"
                >
                  {Object.entries(SORT_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
            </header>

            <div className="max-h-[36rem] overflow-y-auto p-3 space-y-2">
              {loadingUsers ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-6 w-6 animate-spin text-brand-orange" />
                </div>
              ) : users.length === 0 ? (
                <div className="px-3 py-16 text-center space-y-2">
                  <UserRound className="mx-auto h-8 w-8 text-gray-600 opacity-50" />
                  <p className="text-xs font-mono uppercase tracking-widest text-gray-500">No active users recorded</p>
                </div>
              ) : (
                users.map((u) => {
                  const active = selectedUserId === u.userId;
                  return (
                    <button
                      key={u.userId}
                      type="button"
                      onClick={() => setSelectedUserId(u.userId)}
                      className={`w-full rounded-xl border p-4 text-left transition-all cursor-pointer ${
                        active
                          ? 'border-brand-orange bg-brand-orange/15 shadow-[0_0_15px_rgba(249,115,22,0.15)]'
                          : 'border-gray-800/80 bg-brand-darker/60 hover:border-gray-700 hover:bg-gray-800/40'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className={`truncate text-sm font-bold transition-colors ${active ? 'text-brand-orange' : 'text-white'}`}>
                          {u.userName || 'Unknown User'}
                        </p>
                        <span className="px-2 py-0.5 text-[9px] font-mono uppercase bg-brand-orange/10 text-brand-orange border border-brand-orange/30 rounded-full font-bold shrink-0">
                          {u.totalActivities} events
                        </span>
                      </div>
                      <p className="truncate text-xs font-mono text-gray-400 mt-0.5">{u.userEmail || 'No email registered'}</p>
                      <div className="mt-3 pt-2 border-t border-gray-800/60 flex items-center justify-between text-[10px] font-mono text-gray-500">
                        <span>Last Active</span>
                        <span className="text-gray-300 font-bold">{fmtDate(u.lastActivityAt)}</span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </section>

        {/* Right Column: Activity Logs Timeline */}
        <section className="lg:col-span-8 rounded-xl border border-gray-800/80 bg-[#121212] overflow-hidden shadow-2xl flex flex-col justify-between">
          <div>
            <header className="flex flex-col gap-3 border-b border-gray-800/80 bg-brand-dark/50 px-6 py-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-gray-500">Inspecting Target Account</p>
                <h3 className="text-sm font-bold text-white flex items-center gap-2 mt-0.5">
                  <FileText className="w-4 h-4 text-brand-orange" />
                  {selectedUser ? `${selectedUser.userName} (${selectedUser.userEmail || 'No email'})` : 'No user selected'}
                </h3>
              </div>
              <div className="flex w-full items-center gap-3 md:w-auto">
                <div className="relative w-full md:w-72">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-500" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search event, subject, or payload..."
                    className="w-full rounded-lg border border-gray-800 bg-brand-darker py-2 pl-9 pr-3 text-xs text-white placeholder:text-gray-600 focus:border-brand-orange focus:outline-none font-mono"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => loadLogs(selectedUserId)}
                  disabled={loadingLogs || selectedUserId === null}
                  className="flex items-center gap-2 rounded-lg border border-gray-800 bg-brand-darker px-4 py-2 text-xs font-mono font-bold uppercase tracking-wider text-gray-300 hover:border-brand-orange hover:text-white disabled:opacity-40 transition-colors cursor-pointer shrink-0"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${loadingLogs ? 'animate-spin text-brand-orange' : 'text-brand-orange'}`} />
                  <span>Refresh</span>
                </button>
              </div>
            </header>

            <div className="max-h-[36rem] overflow-y-auto p-6 space-y-4">
              {loadingLogs ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="h-8 w-8 animate-spin text-brand-orange" />
                </div>
              ) : filteredLogs.length === 0 ? (
                <div className="py-20 text-center space-y-3">
                  <Activity className="mx-auto h-10 w-10 text-gray-600 opacity-50" />
                  <p className="text-xs font-mono uppercase tracking-widest text-gray-500">No activity entries matching current search filter.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredLogs.map((log) => {
                    const category = categoryForLog(log);
                    const changes = extractAttributeChangeLines(log);
                    return (
                      <article key={log.id} className="rounded-xl border border-gray-800/80 bg-brand-darker/70 p-5 space-y-3 hover:border-brand-orange/40 transition-all shadow-xl">
                        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`px-2.5 py-0.5 text-[9px] uppercase rounded-full border ${CATEGORY_BADGE[category]}`}>
                                {CATEGORY_LABEL[category]}
                              </span>
                              <h4 className="text-sm font-bold text-white">{readableEvent(log)}</h4>
                            </div>
                            <p className="text-xs text-gray-300 leading-relaxed pt-1">{summarizeLog(log)}</p>
                          </div>
                          <span className="text-[11px] font-mono text-gray-400 shrink-0">{fmtDate(log.createdAt)}</span>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono text-gray-400 pt-1">
                          <span className="rounded bg-black/40 border border-gray-800 px-2 py-0.5">Table: <strong className="text-gray-200">{readableTable(log)}</strong></span>
                          <span className="rounded bg-black/40 border border-gray-800 px-2 py-0.5">Log: <strong className="text-gray-200">{titleCaseSnake(log.logName || 'default')}</strong></span>
                          <span className="rounded bg-black/40 border border-gray-800 px-2 py-0.5">Subject: <strong className="text-brand-orange">{readableSubject(log)}</strong></span>
                          <span className="rounded bg-black/40 border border-gray-800 px-2 py-0.5">Actor: <strong className="text-gray-200">{readablePerformer(log)}</strong></span>
                        </div>

                        {log.attribute_changes && (
                          <div className="mt-3 rounded-lg border border-brand-orange/30 bg-brand-orange/5 p-4 space-y-2">
                            <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-brand-orange flex items-center gap-1.5">
                              <ArrowRight className="w-3 h-3" /> Field Mutation Diff
                            </p>
                            {changes.length > 0 ? (
                              <ul className="space-y-2 text-xs font-mono">
                                {changes.map((item) => (
                                  <li key={item.field} className="rounded-md border border-gray-800 bg-[#121212] p-2.5 flex flex-wrap items-center justify-between gap-2">
                                    <span className="font-bold text-white">{item.field}:</span>
                                    <div className="flex items-center gap-2 text-xs">
                                      <span className="text-gray-400 line-through bg-red-950/40 border border-red-500/20 px-2 py-0.5 rounded">{item.before}</span>
                                      <span className="text-brand-orange font-bold">→</span>
                                      <span className="text-emerald-400 bg-emerald-950/40 border border-emerald-500/20 px-2 py-0.5 rounded">{item.after}</span>
                                    </div>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-[11px] font-mono text-gray-400">No field-level mutations recorded.</p>
                            )}

                            <details className="pt-2">
                              <summary className="cursor-pointer text-[10px] font-mono uppercase tracking-widest text-gray-400 hover:text-white transition-colors">
                                Toggle Raw JSON Payload
                              </summary>
                              <pre className="mt-2 overflow-x-auto rounded-lg border border-gray-800 bg-black/60 p-3 text-[11px] font-mono text-gray-300">
                                {JSON.stringify(log.attribute_changes, null, 2)}
                              </pre>
                            </details>
                          </div>
                        )}

                        {log.properties && Object.keys(log.properties).length > 0 && (
                          <details className="rounded-lg border border-gray-800 bg-black/40 p-3">
                            <summary className="cursor-pointer text-[10px] font-mono font-bold uppercase tracking-widest text-gray-400 hover:text-white transition-colors">
                              View Custom Properties ({Object.keys(log.properties).length})
                            </summary>
                            <pre className="mt-2 overflow-x-auto rounded-lg border border-gray-800 bg-[#121212] p-3 text-[11px] font-mono text-gray-300">
                              {JSON.stringify(log.properties, null, 2)}
                            </pre>
                          </details>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
