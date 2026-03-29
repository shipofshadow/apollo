import { useEffect, useRef, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '../store';
import { fetchNotificationsAsync } from '../store/notificationsSlice';

/**
 * Polls `/api/notifications` at a fixed interval while the user is logged in.
 *
 * WebSocket would give true real-time push, but the PHP backend uses a
 * traditional request/response model (FastRoute + Apache/nginx) which does not
 * support persistent connections without a separate Ratchet/Swoole server
 * process.  Polling every 15–30 seconds is the practical equivalent for this
 * stack and feels real-time enough for a booking-management app.
 *
 * Interval:
 *   backoffice (admin/manager/staff) → 15 seconds
 *   client → 30 seconds
 */
const ADMIN_INTERVAL_MS  = 15_000;
const CLIENT_INTERVAL_MS = 30_000;

export function useNotificationPoller(): void {
  const dispatch = useDispatch<AppDispatch>();
  const { user, token } = useSelector((s: RootState) => s.auth);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const poll = useCallback(() => {
    if (token) {
      dispatch(fetchNotificationsAsync(token));
    }
  }, [dispatch, token]);

  useEffect(() => {
    if (!user || !token) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Fetch immediately on login
    poll();

    const isBackoffice = user.role === 'admin' || user.role === 'manager' || user.role === 'staff';
    const intervalMs = isBackoffice ? ADMIN_INTERVAL_MS : CLIENT_INTERVAL_MS;
    intervalRef.current = setInterval(poll, intervalMs);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [user, token, poll]);
}
