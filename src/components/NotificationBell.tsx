import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, BellRing, X, CheckCheck, Package, CalendarCheck2, Wrench, AlertCircle, ShieldAlert, UserCheck, Clock3 } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '../store';
import {
  markReadAsync,
  markAllReadAsync,
  deleteNotificationAsync,
} from '../store/notificationsSlice';
import type { AppNotification, NotificationType } from '../types';

// ── Icon map per notification type ───────────────────────────────────────────

const TYPE_ICON: Record<NotificationType, React.ElementType> = {
  new_booking:    CalendarCheck2,
  new_order:      Package,
  order_created:  Package,
  order_status:   CheckCheck,
  order_tracking: Package,
  status_changed: CheckCheck,
  build_update:   Wrench,
  parts_update:   Package,
  assignment:     UserCheck,
  slot_available: Clock3,
  security_alert: ShieldAlert,
};

const TYPE_COLOR: Record<NotificationType, string> = {
  new_booking:    'text-brand-orange',
  new_order:      'text-brand-orange',
  order_created:  'text-brand-orange',
  order_status:   'text-green-400',
  order_tracking: 'text-cyan-400',
  status_changed: 'text-green-400',
  build_update:   'text-blue-400',
  parts_update:   'text-yellow-400',
  assignment:     'text-cyan-400',
  slot_available: 'text-lime-400',
  security_alert: 'text-red-400',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60)   return 'just now';
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
  const panelRef = useRef<HTMLDivElement>(null);

  const resolveBookingId = (payload: Record<string, unknown> | null): string | null => {
    if (!payload) return null;

    const direct = payload.bookingId ?? payload.booking_id ?? payload.id;
    if (direct !== undefined && direct !== null && String(direct).trim() !== '') {
      return String(direct);
    }

    const nestedBooking = payload.booking as Record<string, unknown> | undefined;
    if (nestedBooking) {
      const nestedId = nestedBooking.bookingId ?? nestedBooking.booking_id ?? nestedBooking.id;
      if (nestedId !== undefined && nestedId !== null && String(nestedId).trim() !== '') {
        return String(nestedId);
      }
    }

    return null;
  };

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

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleNotificationClick = useCallback((n: AppNotification) => {
    // Mark as read first
    if (!n.isRead && token) {
      dispatch(markReadAsync({ token, id: n.id }));
    }
    setOpen(false);

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

    // Navigate to the related booking
    const bookingId = resolveBookingId(n.data);
    if (!bookingId) return;

    if (user?.role && user.role !== 'client') {
      navigate('/admin/bookings', { state: { openBookingId: String(bookingId) } });
    } else {
      navigate(`/client/bookings/${bookingId}`);
    }
  }, [dispatch, token, user, navigate]);

  const handleMarkAllRead = useCallback(() => {
    if (!token) return;
    dispatch(markAllReadAsync(token));
  }, [dispatch, token]);

  const handleDelete = useCallback((e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (!token) return;
    dispatch(deleteNotificationAsync({ token, id }));
  }, [dispatch, token]);

  const hasUnread = unreadCount > 0;

  return (
    <div className={`relative ${className}`} ref={panelRef}>
      {/* Bell button */}
      <button
        onClick={() => setOpen(v => !v)}
        className="relative flex items-center justify-center w-9 h-9 rounded-sm border border-gray-700 hover:border-brand-orange bg-brand-dark transition-colors"
        aria-label={`Notifications${hasUnread ? ` (${unreadCount} unread)` : ''}`}
      >
        {hasUnread
          ? <BellRing className="w-4 h-4 text-brand-orange motion-safe:animate-wiggle" />
          : <Bell className="w-4 h-4 text-gray-400" />}
        {hasUnread && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] flex items-center justify-center bg-brand-orange text-white text-[10px] font-bold rounded-full px-1 leading-none">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute right-0 mt-2 w-80 max-h-[420px] flex flex-col bg-brand-dark border border-gray-700 rounded-sm shadow-2xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 shrink-0">
            <span className="text-sm font-bold text-white uppercase tracking-widest">Notifications</span>
            {hasUnread && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs text-brand-orange hover:text-orange-400 transition-colors font-bold"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="overflow-y-auto flex-1">
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2 text-gray-500">
                <Bell className="w-8 h-8 opacity-30" />
                <p className="text-sm">No notifications yet</p>
              </div>
            ) : (
              items.map(n => {
                const Icon  = TYPE_ICON[n.type]  ?? AlertCircle;
                const color = TYPE_COLOR[n.type] ?? 'text-gray-400';
                return (
                  <div
                    key={n.id}
                    onClick={() => handleNotificationClick(n)}
                    className={`group relative flex gap-3 px-4 py-3 border-b border-gray-800 cursor-pointer transition-colors hover:bg-gray-800/60 ${
                      !n.isRead ? 'bg-brand-orange/5' : ''
                    }`}
                  >
                    {/* Unread dot */}
                    {!n.isRead && (
                      <span className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-brand-orange" />
                    )}

                    {/* Icon */}
                    <div className={`shrink-0 mt-0.5 ${color}`}>
                      <Icon className="w-4 h-4" />
                    </div>

                    {/* Text */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white leading-snug truncate">{n.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5 leading-snug line-clamp-2">{n.message}</p>
                      <p className="text-[10px] text-gray-600 mt-1">{timeAgo(n.createdAt)}</p>
                    </div>

                    {/* Delete button */}
                    <button
                      onClick={e => handleDelete(e, n.id)}
                      className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-gray-600 hover:text-red-400 mt-0.5"
                      aria-label="Delete notification"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
