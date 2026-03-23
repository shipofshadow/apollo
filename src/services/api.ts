import type { BookingPayload, Booking, FacebookPost, User } from '../types';
import { BACKEND_URL } from '../config';

// ── Helpers ─────────────────────────────────────────────────────────────────

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  token?: string | null
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> ?? {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(`${BACKEND_URL}${path}`, { ...options, headers });
  } catch {
    throw new Error('Unable to reach the backend server. Please check your connection.');
  }

  const data = await response.json();
  if (!response.ok) throw new Error(data?.detail ?? `Request failed (${response.status})`);
  return data as T;
}

// ── Auth API ─────────────────────────────────────────────────────────────────

export const loginApi = (email: string, password: string) =>
  apiFetch<{ token: string; user: User }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

export const registerApi = (data: {
  name: string; email: string; phone: string; password: string;
}) =>
  apiFetch<{ token: string; user: User }>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const fetchMeApi = (token: string) =>
  apiFetch<{ user: User }>('/api/auth/me', {}, token);

export const updateProfileApi = (
  token: string,
  data: { name?: string; phone?: string; password?: string; password_confirmation?: string }
) =>
  apiFetch<{ user: User }>('/api/auth/profile', {
    method: 'PUT',
    body: JSON.stringify(data),
  }, token);

export const logoutApi = (token: string) =>
  apiFetch<{ message: string }>('/api/auth/logout', { method: 'POST' }, token);

// ── Booking API ──────────────────────────────────────────────────────────────

export const submitBookingApi = (payload: BookingPayload, token?: string | null) =>
  apiFetch<{ booking: Booking }>('/api/bookings', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, token);

export const fetchMyBookingsApi = (token: string) =>
  apiFetch<{ bookings: Booking[] }>('/api/bookings/mine', {}, token);

export const fetchAllBookingsApi = (token: string) =>
  apiFetch<{ bookings: Booking[] }>('/api/bookings', {}, token);

export const updateBookingStatusApi = (
  token: string,
  id: string,
  status: string
) =>
  apiFetch<{ booking: Booking }>(`/api/bookings/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  }, token);

// ── Legacy / mock (kept for offline fallback) ────────────────────────────────

export const submitBooking = async (payload: BookingPayload): Promise<Booking> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        ...payload,
        id: Math.random().toString(36).substr(2, 9),
        status: 'pending',
        createdAt: new Date().toISOString(),
      });
    }, 800);
  });
};

// ── Facebook feed ─────────────────────────────────────────────────────────────

export interface FacebookPostsPage {
  posts: FacebookPost[];
  nextCursor: string | null;
}

export const fetchFacebookPosts = async (after?: string): Promise<FacebookPostsPage> => {
  const params = new URLSearchParams();
  if (after) params.set('after', after);
  const url = `${BACKEND_URL}/api/posts${params.size ? `?${params}` : ''}`;

  let response: Response;
  try {
    response = await fetch(url);
  } catch {
    throw new Error('Unable to reach the backend server. Please check your connection.');
  }

  const data = await response.json();
  if (!response.ok) throw new Error(data?.detail ?? 'Failed to fetch Facebook posts.');

  const nextCursor: string | null = data?.paging?.cursors?.after ?? null;
  const hasNext: boolean = Boolean(data?.paging?.next);

  return {
    posts: (data.data ?? []) as FacebookPost[],
    nextCursor: hasNext ? nextCursor : null,
  };
};
