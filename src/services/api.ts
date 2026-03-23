import type { BookingPayload, Booking, FacebookPost, User, Service, Product } from '../types';
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

// ── Services API ─────────────────────────────────────────────────────────────

export const fetchServicesApi = (token?: string | null) =>
  apiFetch<{ services: Service[] }>('/api/services', {}, token);

export const fetchServiceByIdApi = (id: number, token?: string | null) =>
  apiFetch<{ service: Service }>(`/api/services/${id}`, {}, token);

export const createServiceApi = (
  token: string,
  data: Partial<Omit<Service, 'id' | 'createdAt' | 'updatedAt'>>
) =>
  apiFetch<{ service: Service }>('/api/services', {
    method: 'POST',
    body: JSON.stringify(data),
  }, token);

export const updateServiceApi = (
  token: string,
  id: number,
  data: Partial<Omit<Service, 'id' | 'createdAt' | 'updatedAt'>>
) =>
  apiFetch<{ service: Service }>(`/api/services/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }, token);

export const deleteServiceApi = (token: string, id: number) =>
  apiFetch<{ message: string }>(`/api/services/${id}`, {
    method: 'DELETE',
  }, token);

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

export const fetchAvailabilityApi = (date: string) =>
  apiFetch<{ bookedSlots: string[] }>(`/api/bookings/availability?date=${encodeURIComponent(date)}`);

export const uploadBookingMediaApi = async (files: File[]): Promise<string[]> => {
  const form = new FormData();
  files.forEach(f => form.append('files[]', f));

  let response: Response;
  try {
    response = await fetch(`${BACKEND_URL}/api/bookings/media`, { method: 'POST', body: form });
  } catch {
    throw new Error('Unable to reach the backend server.');
  }
  const data = await response.json();
  if (!response.ok) throw new Error(data?.detail ?? `Upload failed (${response.status})`);
  return (data as { urls: string[] }).urls;
};

export const updateBookingPartsApi = (
  token: string,
  id: string,
  awaitingParts: boolean,
  partsNotes: string
) =>
  apiFetch<{ booking: Booking }>(`/api/bookings/${id}/parts`, {
    method: 'PATCH',
    body: JSON.stringify({ awaitingParts, partsNotes }),
  }, token);

export const updateBookingStatusApi = (
  token: string,
  id: string,
  status: string
) =>
  apiFetch<{ booking: Booking }>(`/api/bookings/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  }, token);

// ── Blog API ─────────────────────────────────────────────────────────────────

export const fetchBlogPostsApi = (token?: string | null) =>
  apiFetch<{ posts: import('../types').BlogPost[] }>('/api/blog', {}, token);

export const fetchBlogPostByIdApi = (id: number, token?: string | null) =>
  apiFetch<{ post: import('../types').BlogPost }>(`/api/blog/${id}`, {}, token);

export const createBlogPostApi = (
  token: string,
  data: { title: string; content: string; status: 'Draft' | 'Published' }
) =>
  apiFetch<{ post: import('../types').BlogPost }>('/api/blog', {
    method: 'POST',
    body: JSON.stringify(data),
  }, token);

export const updateBlogPostApi = (
  token: string,
  id: number,
  data: Partial<{ title: string; content: string; status: 'Draft' | 'Published' }>
) =>
  apiFetch<{ post: import('../types').BlogPost }>(`/api/blog/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }, token);

export const deleteBlogPostApi = (token: string, id: number) =>
  apiFetch<{ message: string }>(`/api/blog/${id}`, {
    method: 'DELETE',
  }, token);

// ── Products API ─────────────────────────────────────────────────────────────

export const fetchProductsApi = (token?: string | null) =>
  apiFetch<{ products: Product[] }>('/api/products', {}, token);

export const fetchProductByIdApi = (id: number, token?: string | null) =>
  apiFetch<{ product: Product }>(`/api/products/${id}`, {}, token);

export const createProductApi = (
  token: string,
  data: Partial<Omit<Product, 'id' | 'createdAt' | 'updatedAt'>>
) =>
  apiFetch<{ product: Product }>('/api/products', {
    method: 'POST',
    body: JSON.stringify(data),
  }, token);

export const updateProductApi = (
  token: string,
  id: number,
  data: Partial<Omit<Product, 'id' | 'createdAt' | 'updatedAt'>>
) =>
  apiFetch<{ product: Product }>(`/api/products/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }, token);

export const deleteProductApi = (token: string, id: number) =>
  apiFetch<{ message: string }>(`/api/products/${id}`, {
    method: 'DELETE',
  }, token);

// ── Admin API ────────────────────────────────────────────────────────────────

export interface AdminStats {
  totalBookings: number;
  pendingBookings: number;
  confirmedBookings: number;
  completedBookings: number;
  cancelledBookings: number;
  activeBookings: number;
  bookingsThisWeek: number;
  bookingsThisMonth: number;
}

export const fetchAdminStatsApi = (token: string) =>
  apiFetch<AdminStats>('/api/admin/stats', {}, token);

// ── Legacy / mock (kept for offline fallback) ────────────────────────────────

export const submitBooking = async (payload: BookingPayload): Promise<Booking> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const primaryId = payload.serviceIds[0] ?? 0;
      resolve({
        ...payload,
        serviceId:  primaryId,
        serviceIds: payload.serviceIds,
        serviceName: `Service #${primaryId}`,
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
