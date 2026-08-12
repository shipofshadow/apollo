import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell, BellRing, BellOff, CheckCheck, Check, Package,
  CalendarCheck2, Wrench, AlertCircle, ShieldAlert, UserCheck,
  Clock, Sparkles, Trash2, ChevronRight
} from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '../store';
import {
  markReadAsync,
  markAllReadAsync,
  deleteNotificationAsync,
} from '../store/notificationsSlice';
import { fetchBookingByIdAsync } from '../store/bookingSlice';
import type { AppNotification } from '../types';

// ── Icon map per notification type ───────────────────────────────────────────

const TYPE_ICON: Record<string, React.ElementType> = {
  new_booking: CalendarCheck2,
  new_order: Package,
  order_created: Package,
  order_status: CheckCheck,
  order_tracking: Package,
  status_changed: CheckCheck,
  build_update: Wrench,
  parts_update: Package,
  assignment: UserCheck,
  slot_available: Clock,
  security_alert: ShieldAlert,
  inquiry: UserCheck,
  customer_inquiry: UserCheck,
  appointment_rescheduled: Clock,
  appointment_reminder: Clock,
  appointment_reminder_3h: Clock,
  inquiry_status_changed: CheckCheck,
};

const TYPE_COLOR: Record<string, { icon: string; bg: string; border: string }> = {
  new_booking: { icon: 'text-brand-orange', bg: 'bg-brand-orange/10', border: 'border-brand-orange/20' },
  new_order: { icon: 'text-brand-orange', bg: 'bg-brand-orange/10', border: 'border-brand-orange/20' },
  order_created: { icon: 'text-brand-orange', bg: 'bg-brand-orange/10', border: 'border-brand-orange/20' },
  order_status: { icon: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  order_tracking: { icon: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20' },
  status_changed: { icon: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  build_update: { icon: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
  parts_update: { icon: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
  assignment: { icon: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20' },
  slot_available: { icon: 'text-lime-400', bg: 'bg-lime-500/10', border: 'border-lime-500/20' },
  security_alert: { icon: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/20' },
  inquiry: { icon: 'text-brand-orange', bg: 'bg-brand-orange/10', border: 'border-brand-orange/20' },
  customer_inquiry: { icon: 'text-brand-orange', bg: 'bg-brand-orange/10', border: 'border-brand-orange/20' },
  appointment_rescheduled: { icon: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
  appointment_reminder: { icon: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20' },
  appointment_reminder_3h: { icon: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20' },
  inquiry_status_changed: { icon: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  /** Pass a custom className to override position/size of the wrapper */
  className?: string;
}

export default function NotificationBell({ className = '' }: Props) {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const { items, unreadCount } = useSelector((s: RootState) => s.notifications);
  const { token, user } = useSelector((s: RootState) => s.auth);

  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const panelRef = useRef<HTMLDivElement>(null);

  const resolveOrderId = (payload: Record<string, unknown> | null): string | null => {
    if (!payload) return null;

    const direct = payload.orderId ?? payload.order_id ?? payload.id;
    if (direct !== undefined && direct !== null && String(direct).trim() !== '') {
      return String(direct);
    }

    const nestedOrder = payload.order as Record<string, unknown> | undefined;
    if (nestedOrder) {
      const nestedId = nestedOrder.orderId ?? nestedOrder.order_id ?? nestedOrder.id;
      if (nestedId !== undefined && nestedId !== null && String(nestedId).trim() !== '') {
        return String(nestedId);
      }
    }

    return null;
  };

  // Close on outside click or Escape key
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleNotificationClick = useCallback(async (n: AppNotification) => {
    // Mark as read first
    if (!n.isRead && token) {
      dispatch(markReadAsync({ token, id: n.id }));
    }
    setOpen(false);

    // 1. Order notifications -> /admin/orders or /orders/:id/receipt
    const isOrderNotification = ['new_order', 'order_created', 'order_status', 'order_tracking'].includes(n.type);
    if (isOrderNotification) {
      const orderId = resolveOrderId(n.data);
      if (!orderId) return;

      const canManageOrders = Boolean(user?.permissions?.includes('products:manage')) || user?.role === 'owner' || user?.role === 'admin';
      if (canManageOrders) {
        navigate('/admin/orders', { state: { openOrderId: Number(orderId) } });
      } else {
        navigate(`/orders/${orderId}/receipt`);
      }
      return;
    }

    // 2. Extract payload IDs
    const payload = n.data || {};
    const titleLower = (n.title || '').toLowerCase();
    const msgLower = (n.message || '').toLowerCase();

    const rawInquiryId = payload.inquiryId ?? payload.inquiry_id;
    const rawRefNum = payload.referenceNumber ?? payload.reference_number;
    const rawId = payload.id ?? payload.bookingId ?? payload.booking_id;

    const isInquiryExplicit =
      ['inquiry', 'customer_inquiry', 'appointment_rescheduled', 'inquiry_status_changed', 'inquiry_created'].includes(n.type) ||
      Boolean(payload.inquiryId) ||
      Boolean(payload.inquiry_id) ||
      Boolean(payload.is_inquiry) ||
      (typeof rawId === 'string' && rawId.startsWith('inq-')) ||
      (typeof rawRefNum === 'string' && rawRefNum.trim() !== '') ||
      titleLower.includes('inquiry') ||
      msgLower.includes('inquiry') ||
      (titleLower.includes('appointment') && !titleLower.includes('booking'));

    // Route to AdminInquiryDetail
    if (isInquiryExplicit) {
      const targetId = rawInquiryId ?? rawRefNum ?? rawId;
      if (targetId) {
        const idStr = String(targetId).trim();
        const cleanId = idStr.replace(/^inq-/, '');
        const formattedInquiryId = `inq-${cleanId}`;

        if (user?.role && user.role !== 'client') {
          navigate(`/admin/bookings?inquiryId=${encodeURIComponent(cleanId)}`, { state: { openBookingId: formattedInquiryId } });
        } else {
          navigate('/client/inquiries', { state: { openInquiryId: cleanId } });
        }
        return;
      }
    }

    // 3. Fallback: check raw ID for booking or inquiry
    const targetId = rawId ?? rawInquiryId ?? rawRefNum;
    if (!targetId) return;

    const idStr = String(targetId).trim();
    const cleanId = idStr.replace(/^inq-/, '');

    if (user?.role && user.role !== 'client') {
      // If ID starts with inq-, open AdminInquiryDetail
      if (idStr.startsWith('inq-')) {
        navigate(`/admin/bookings?inquiryId=${encodeURIComponent(cleanId)}`, { state: { openBookingId: idStr } });
        return;
      }

      // Try fetching as Booking; if it returns 404, fallback to AdminInquiryDetail!
      if (token) {
        try {
          await dispatch(fetchBookingByIdAsync({ token, id: idStr })).unwrap();
          navigate(`/admin/bookings?bookingId=${encodeURIComponent(idStr)}`, { state: { openBookingId: idStr } });
          return;
        } catch {
          // Booking 404 -> it is an inquiry! Route directly to AdminInquiryDetail
          navigate(`/admin/bookings?inquiryId=${encodeURIComponent(cleanId)}`, { state: { openBookingId: `inq-${cleanId}` } });
          return;
        }
      }

      navigate(`/admin/bookings?bookingId=${encodeURIComponent(idStr)}`, { state: { openBookingId: idStr } });
    } else {
      navigate(`/client/bookings/${idStr}`);
    }
  }, [dispatch, token, user, navigate]);

  const handleMarkAllRead = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!token) return;
    dispatch(markAllReadAsync(token));
  }, [dispatch, token]);

  const handleMarkSingleRead = useCallback((e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (!token) return;
    dispatch(markReadAsync({ token, id }));
  }, [dispatch, token]);

  const handleDelete = useCallback((e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (!token) return;
    dispatch(deleteNotificationAsync({ token, id }));
  }, [dispatch, token]);

  const filteredItems = useMemo(() => {
    if (filter === 'unread') {
      return items.filter(n => !n.isRead);
    }
    return items;
  }, [items, filter]);

  const hasUnread = unreadCount > 0;

  return (
    <div className={`relative ${className}`} ref={panelRef}>
      {/* Bell button */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={`relative flex items-center justify-center w-10 h-10 rounded-xl border transition-all duration-200 cursor-pointer ${
          open
            ? 'border-brand-orange bg-brand-orange/10 text-brand-orange shadow-[0_0_20px_rgba(249,115,22,0.25)]'
            : hasUnread
            ? 'border-brand-orange/40 hover:border-brand-orange bg-brand-dark/90 text-brand-orange hover:shadow-[0_0_15px_rgba(249,115,22,0.2)]'
            : 'border-gray-800 hover:border-gray-700 bg-brand-dark/80 text-gray-400 hover:text-white'
        }`}
        aria-label={`Notifications${hasUnread ? ` (${unreadCount} unread)` : ''}`}
      >
        {hasUnread ? (
          <BellRing className="w-4 h-4 text-brand-orange motion-safe:animate-wiggle" />
        ) : (
          <Bell className="w-4 h-4 transition-transform group-hover:scale-110" />
        )}

        {hasUnread && (
          <span className="absolute -top-1 -right-1 min-w-[20px] h-[20px] flex items-center justify-center bg-brand-orange text-white text-[10px] font-mono font-extrabold rounded-full px-1 shadow-[0_2px_8px_rgba(249,115,22,0.6)] border-2 border-[#0a0a0a]">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute right-0 mt-3 w-80 sm:w-96 max-h-[500px] flex flex-col bg-[#121212]/95 border border-gray-800/90 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.85)] backdrop-blur-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          
          {/* Header */}
          <div className="px-4 py-3.5 border-b border-gray-800/80 bg-brand-darker/60 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Bell className="w-3.5 h-3.5 text-brand-orange" /> Notifications
              </span>
              {hasUnread && (
                <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-brand-orange/20 text-brand-orange border border-brand-orange/30 rounded-full">
                  {unreadCount} new
                </span>
              )}
            </div>

            {hasUnread && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-[11px] font-mono text-gray-400 hover:text-brand-orange transition-colors flex items-center gap-1 cursor-pointer font-medium"
              >
                <CheckCheck className="w-3.5 h-3.5 text-brand-orange" /> Mark all read
              </button>
            )}
          </div>

          {/* Filter Tabs */}
          {items.length > 0 && (
            <div className="px-4 py-2 border-b border-gray-800/60 bg-brand-dark/40 flex items-center gap-2 text-xs font-mono">
              <button
                type="button"
                onClick={() => setFilter('all')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer text-[11px] font-semibold ${
                  filter === 'all'
                    ? 'bg-gray-800 text-white border border-gray-700'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                All ({items.length})
              </button>
              <button
                type="button"
                onClick={() => setFilter('unread')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer text-[11px] font-semibold flex items-center gap-1.5 ${
                  filter === 'unread'
                    ? 'bg-brand-orange/20 text-brand-orange border border-brand-orange/30'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                Unread ({unreadCount})
              </button>
            </div>
          )}

          {/* Notifications Scroll List */}
          <div className="overflow-y-auto flex-1 divide-y divide-gray-800/50 custom-scrollbar">
            {filteredItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 gap-3 text-center">
                <div className="w-12 h-12 rounded-2xl bg-gray-900 border border-gray-800 flex items-center justify-center text-gray-600">
                  {filter === 'unread' ? <Sparkles className="w-6 h-6 text-brand-orange/40" /> : <BellOff className="w-6 h-6 text-gray-600" />}
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-mono font-bold text-gray-300 uppercase tracking-wider">
                    {filter === 'unread' ? 'All caught up!' : 'No notifications'}
                  </p>
                  <p className="text-[11px] font-mono text-gray-500">
                    {filter === 'unread' ? 'You have no unread notifications.' : 'Activity updates will appear here.'}
                  </p>
                </div>
              </div>
            ) : (
              filteredItems.map(n => {
                const Icon = TYPE_ICON[n.type] ?? AlertCircle;
                const style = TYPE_COLOR[n.type] ?? { icon: 'text-gray-400', bg: 'bg-gray-800/50', border: 'border-gray-700/50' };

                return (
                  <div
                    key={n.id}
                    onClick={() => { void handleNotificationClick(n); }}
                    className={`group relative flex items-start gap-3.5 px-4 py-3.5 transition-all cursor-pointer ${
                      !n.isRead
                        ? 'bg-gradient-to-r from-brand-orange/10 via-brand-dark/40 to-transparent hover:from-brand-orange/15'
                        : 'hover:bg-gray-800/40'
                    }`}
                  >
                    {/* Left Accent Bar for Unread */}
                    {!n.isRead && (
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-brand-orange rounded-r" />
                    )}

                    {/* Icon Badge */}
                    <div className={`shrink-0 w-9 h-9 rounded-xl border ${style.bg} ${style.border} ${style.icon} flex items-center justify-center shadow-sm`}>
                      <Icon className="w-4 h-4" />
                    </div>

                    {/* Text Details */}
                    <div className="flex-1 min-w-0 pr-4">
                      <div className="flex items-center justify-between gap-2">
                        <p className={`text-xs font-mono font-bold truncate ${!n.isRead ? 'text-white' : 'text-gray-300'}`}>
                          {n.title}
                        </p>
                        <span className="text-[10px] font-mono text-gray-500 shrink-0 flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5 text-gray-600" />
                          {timeAgo(n.createdAt)}
                        </span>
                      </div>

                      <p className="text-xs font-mono text-gray-400 mt-1 leading-normal line-clamp-2">
                        {n.message}
                      </p>
                    </div>

                    {/* Quick Hover Action Buttons */}
                    <div className="absolute right-2 top-3 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-[#121212]/90 p-1 rounded-lg border border-gray-800 shadow-md">
                      {!n.isRead && (
                        <button
                          type="button"
                          onClick={e => handleMarkSingleRead(e, n.id)}
                          title="Mark as read"
                          className="p-1 text-gray-400 hover:text-brand-orange transition-colors rounded cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={e => handleDelete(e, n.id)}
                        title="Delete notification"
                        className="p-1 text-gray-400 hover:text-red-400 transition-colors rounded cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          {items.length > 0 && (
            <div className="px-4 py-2.5 bg-brand-darker/80 border-t border-gray-800/80 flex items-center justify-between text-[11px] font-mono text-gray-500">
              <span>{items.length} total notifications</span>
              <span className="flex items-center gap-1 text-gray-400">
                Click to view details <ChevronRight className="w-3 h-3 text-brand-orange" />
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
