import type { BookingPayload, Booking, FacebookPost, User, Service, Product, PortfolioItem, PortfolioCategory, Offer, BeforeAfterItem, ServiceVariation, ProductVariation, BuildUpdate, AppNotification, BookingActivityLog, ClientVehicle, ClientAdminSummary, UserRole, WaitlistEntry } from '../types';
import { BACKEND_URL } from '../config';

// ── Helpers ─────────────────────────────────────────────────────────────────

export const API_OFFLINE_EVENT = 'apollo:api-offline';
export const AUTH_EXPIRED_EVENT = 'apollo:auth-expired';

function notifyApiOffline(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(API_OFFLINE_EVENT));
  }
}

function notifyAuthExpired(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT));
  }
}

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
    notifyApiOffline();
    throw new Error('API is offline.');
  }

  const data = await response.json();
  if (!response.ok) {
    // Auto-logout on token expiry
    if (response.status === 401) {
      notifyAuthExpired();
    }
    throw new Error(data?.detail ?? `Request failed (${response.status})`);
  }
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
  data: { name?: string; phone?: string; avatar_url?: string | null; password?: string; password_confirmation?: string }
) =>
  apiFetch<{ user: User }>('/api/auth/profile', {
    method: 'PUT',
    body: JSON.stringify(data),
  }, token);

export const uploadProfileAvatarApi = async (token: string, file: File): Promise<string> => {
  const form = new FormData();
  form.append('file', file);

  let response: Response;
  try {
    response = await fetch(`${BACKEND_URL}/api/auth/avatar-upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
  } catch {
    notifyApiOffline();
    throw new Error('API is offline.');
  }
  const data = await response.json();
  if (!response.ok) {
    if (response.status === 401) {
      notifyAuthExpired();
    }
    throw new Error(data?.detail ?? `Upload failed (${response.status})`);
  }
  return (data as { url: string }).url;
};

export const logoutApi = (token: string) =>
  apiFetch<{ message: string }>('/api/auth/logout', { method: 'POST' }, token);

export const refreshTokenApi = (refreshToken: string) =>
  apiFetch<{ token: string; refresh_token: string }>('/api/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

export const forgotPasswordApi = (email: string) =>
  apiFetch<{ message: string }>('/api/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });

export const resetPasswordApi = (token: string, password: string, passwordConfirm: string) =>
  apiFetch<{ message: string }>('/api/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token, password, passwordConfirm }),
  });

export const fetchAuthSessionsApi = (token: string) =>
  apiFetch<{ sessions: Array<{
    id: number;
    userId: number;
    ipAddress: string;
    userAgent: string;
    issuedAt: string;
    expiresAt: string;
    lastSeenAt: string;
    revokedAt: string | null;
    revokedReason: string | null;
    isCurrent: boolean;
    isActive: boolean;
  }> }>('/api/auth/sessions', {}, token);

export const revokeAuthSessionApi = (token: string, id: number) =>
  apiFetch<{ ok: boolean }>(`/api/auth/sessions/${id}`, {
    method: 'DELETE',
  }, token);

export const revokeOtherAuthSessionsApi = (token: string) =>
  apiFetch<{ revoked: number }>('/api/auth/sessions/revoke-others', {
    method: 'DELETE',
  }, token);

export const fetchSecurityAuditLogsApi = (token: string, limit = 200) =>
  apiFetch<{ logs: Array<{
    id: number;
    userId: number | null;
    userName: string | null;
    email: string;
    ipAddress: string;
    userAgent: string;
    eventType: string;
    outcome: string;
    detail: string | null;
    createdAt: string;
  }> }>(`/api/admin/security/audit?limit=${encodeURIComponent(String(limit))}`, {}, token);

export const exportSecurityAuditCsvApi = async (token: string, limit = 1000): Promise<Blob> => {
  let response: Response;
  try {
    response = await fetch(
      `${BACKEND_URL}/api/admin/security/audit/export?limit=${encodeURIComponent(String(limit))}`,
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      }
    );
  } catch {
    notifyApiOffline();
    throw new Error('API is offline.');
  }

  if (!response.ok) {
    try {
      const data = await response.json();
      throw new Error(data?.detail ?? `Request failed (${response.status})`);
    } catch (e: unknown) {
      throw new Error((e as Error).message ?? `Request failed (${response.status})`);
    }
  }

  return response.blob();
};

// ── Services API ─────────────────────────────────────────────────────────────

export const fetchServicesApi = (token?: string | null) =>
  apiFetch<{ services: Service[] }>('/api/services', {}, token);

export const fetchServiceByIdApi = (id: number, token?: string | null) =>
  apiFetch<{ service: Service }>(`/api/services/${id}`, {}, token);

export const fetchServiceBySlugApi = (slug: string, token?: string | null) =>
  apiFetch<{ service: Service }>(`/api/services/${encodeURIComponent(slug)}`, {}, token);

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

// ── Service Variation API ─────────────────────────────────────────────────────

export const createServiceVariationApi = (
  token: string,
  serviceId: number | string,
  data: Partial<Omit<ServiceVariation, 'id' | 'serviceId'>>
) =>
  apiFetch<{ variation: ServiceVariation }>(`/api/services/${serviceId}/variations`, {
    method: 'POST',
    body: JSON.stringify(data),
  }, token);

export const updateServiceVariationApi = (
  token: string,
  serviceId: number | string,
  varId: number,
  data: Partial<Omit<ServiceVariation, 'id' | 'serviceId'>>
) =>
  apiFetch<{ variation: ServiceVariation }>(`/api/services/${serviceId}/variations/${varId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }, token);

export const deleteServiceVariationApi = (token: string, serviceId: number | string, varId: number) =>
  apiFetch<{ message: string }>(`/api/services/${serviceId}/variations/${varId}`, {
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
  apiFetch<import('../types').AvailabilityResponse>(
    `/api/bookings/availability?date=${encodeURIComponent(date)}`
  );

export const uploadBookingMediaApi = async (files: File[]): Promise<string[]> => {
  const form = new FormData();
  files.forEach(f => form.append('files[]', f));

  let response: Response;
  try {
    response = await fetch(`${BACKEND_URL}/api/bookings/media`, { method: 'POST', body: form });
  } catch {
    notifyApiOffline();
    throw new Error('API is offline.');
  }
  const data = await response.json();
  if (!response.ok) throw new Error(data?.detail ?? `Upload failed (${response.status})`);
  return (data as { urls: string[] }).urls;
};

export const uploadAdminImageApi = async (
  token: string,
  file: File,
  type: 'services' | 'products' | 'blog' | 'team' | 'testimonials' | 'portfolio' | 'before-after'
): Promise<string> => {
  const form = new FormData();
  form.append('file', file);
  form.append('type', type);

  let response: Response;
  try {
    response = await fetch(`${BACKEND_URL}/api/admin/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
  } catch {
    notifyApiOffline();
    throw new Error('API is offline.');
  }
  const data = await response.json();
  if (!response.ok) throw new Error(data?.detail ?? `Upload failed (${response.status})`);
  return (data as { url: string }).url;
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

export const updateBookingQaPhotosApi = (
  token: string,
  id: string,
  data: { stage: 'before' | 'after'; photoUrls: string[] }
) =>
  apiFetch<{ booking: Booking }>(`/api/bookings/${id}/qa-photos`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }, token);

export const assignBookingTechnicianApi = (
  token: string,
  id: string,
  data: { assignedTechId?: number | null; assignedUserId?: number | null }
) =>
  apiFetch<{ booking: Booking }>(`/api/bookings/${id}/assign-tech`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }, token);

export const cancelMyBookingApi = (token: string, id: string) =>
  apiFetch<{ booking: Booking }>(`/api/bookings/${id}/cancel`, {
    method: 'PATCH',
  }, token);

export const deleteBookingApi = (token: string, id: string) =>
  apiFetch<{ deleted: boolean }>(`/api/bookings/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  }, token);

export const fetchBookingByIdApi = (token: string, id: string) =>
  apiFetch<{ booking: Booking }>(`/api/bookings/${encodeURIComponent(id)}`, {}, token);

export const rescheduleBookingApi = (
  token: string,
  id: string,
  appointmentDate: string,
  appointmentTime: string,
) =>
  apiFetch<{ booking: Booking }>(`/api/bookings/${encodeURIComponent(id)}/reschedule`, {
    method: 'PATCH',
    body: JSON.stringify({ appointmentDate, appointmentTime }),
  }, token);

export const adminRescheduleBookingApi = (
  token: string,
  id: string,
  appointmentDate: string,
  appointmentTime: string,
) =>
  apiFetch<{ booking: Booking }>(`/api/bookings/${encodeURIComponent(id)}/admin-reschedule`, {
    method: 'PATCH',
    body: JSON.stringify({ appointmentDate, appointmentTime }),
  }, token);

// ── Build Update API ──────────────────────────────────────────────────────────

export const fetchBuildUpdatesApi = (token: string, bookingId: string) =>
  apiFetch<{ updates: BuildUpdate[] }>(
    `/api/bookings/${encodeURIComponent(bookingId)}/build-updates`,
    {},
    token
  );

export const fetchBookingActivityApi = (token: string, bookingId: string) =>
  apiFetch<{ logs: BookingActivityLog[] }>(
    `/api/bookings/${encodeURIComponent(bookingId)}/activity`,
    {},
    token
  );

export const createBuildUpdateApi = (
  token: string,
  bookingId: string,
  data: { note: string; photoUrls: string[] }
) =>
  apiFetch<{ update: BuildUpdate }>(
    `/api/bookings/${encodeURIComponent(bookingId)}/build-updates`,
    { method: 'POST', body: JSON.stringify(data) },
    token
  );

export const uploadBuildUpdateMediaApi = async (
  token: string,
  bookingId: string,
  files: File[]
): Promise<string[]> => {
  const form = new FormData();
  files.forEach(f => form.append('files[]', f));

  let response: Response;
  try {
    response = await fetch(
      `${BACKEND_URL}/api/bookings/${encodeURIComponent(bookingId)}/build-updates/media`,
      { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form }
    );
  } catch {
    notifyApiOffline();
    throw new Error('API is offline.');
  }
  const data = await response.json();
  if (!response.ok) throw new Error(data?.detail ?? `Upload failed (${response.status})`);
  return (data as { urls: string[] }).urls;
};

// ── Vehicle data API (API Ninjas proxy) ───────────────────────────────────────

export interface CarTrim {
  make: string;
  model: string;
  generation: string;
  generation_year_begin: string;
  generation_year_end: string | null;
  serie: string;
  trim: string;
  trim_start_production_year: number | null;
  trim_end_production_year: number | null;
  car_type: string;
}

/**
 * Fetch all car makes from the backend proxy.
 * Optionally filtered by model year.
 */
export const fetchVehicleMakesApi = (year?: number) => {
  const params = year ? `?year=${year}` : '';
  return apiFetch<{ makes: string[] }>(`/api/vehicles/makes${params}`);
};

/**
 * Fetch all models for a given make from the backend proxy.
 */
export const fetchVehicleModelsApi = (make: string, year?: number) => {
  const params = new URLSearchParams({ make });
  if (year) params.set('year', String(year));
  return apiFetch<{ models: string[] }>(`/api/vehicles/models?${params}`);
};

/**
 * Fetch trims for a given make and model from the backend proxy.
 */
export const fetchVehicleTrimsApi = (make: string, model: string, limit = 50, page = 1) => {
  const params = new URLSearchParams({ make, model, limit: String(limit), page: String(page) });
  return apiFetch<{ trims: CarTrim[] }>(`/api/vehicles/trims?${params}`);
};

export const fetchShopHoursApi = () =>
  apiFetch<{ hours: import('../types').ShopDayHours[] }>('/api/shop/hours');

export const updateShopHoursApi = (token: string, hours: import('../types').ShopDayHours[]) =>
  apiFetch<{ hours: import('../types').ShopDayHours[] }>('/api/shop/hours', {
    method: 'PUT',
    body: JSON.stringify({ hours }),
  }, token);

export const fetchShopClosedDatesApi = () =>
  apiFetch<{ closedDates: { date: string; reason: string | null; isYearly: boolean }[] }>('/api/shop/closed-dates');

export const addShopClosedDateApi = (token: string, date: string, reason?: string, isYearly?: boolean) =>
  apiFetch<{ closedDates: { date: string; reason: string | null; isYearly: boolean }[] }>('/api/shop/closed-dates', {
    method: 'POST',
    body: JSON.stringify({ date, reason: reason ?? null, isYearly: isYearly ?? false }),
  }, token);

export const removeShopClosedDateApi = (token: string, date: string) =>
  apiFetch<{ closedDates: { date: string; reason: string | null; isYearly: boolean }[] }>(`/api/shop/closed-dates/${date}`, {
    method: 'DELETE',
  }, token);

// ── Blog API ─────────────────────────────────────────────────────────────────

export const fetchBlogPostsApi = (token?: string | null) =>
  apiFetch<{ posts: import('../types').BlogPost[] }>('/api/blog', {}, token);

export const fetchBlogPostByIdApi = (id: number, token?: string | null) =>
  apiFetch<{ post: import('../types').BlogPost }>(`/api/blog/${id}`, {}, token);

export const createBlogPostApi = (
  token: string,
  data: { title: string; content: string; status: 'Draft' | 'Published'; coverImage?: string }
) =>
  apiFetch<{ post: import('../types').BlogPost }>('/api/blog', {
    method: 'POST',
    body: JSON.stringify(data),
  }, token);

export const updateBlogPostApi = (
  token: string,
  id: number,
  data: Partial<{ title: string; content: string; status: 'Draft' | 'Published'; coverImage?: string }>
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

export const fetchProductByIdApi = (id: number | string, token?: string | null) =>
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
  id: number | string,
  data: Partial<Omit<Product, 'id' | 'createdAt' | 'updatedAt'>>
) =>
  apiFetch<{ product: Product }>(`/api/products/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }, token);

export const deleteProductApi = (token: string, id: number | string) =>
  apiFetch<{ message: string }>(`/api/products/${id}`, {
    method: 'DELETE',
  }, token);

// ── Product Variation API ─────────────────────────────────────────────────────

export const createProductVariationApi = (
  token: string,
  productId: number | string,
  data: Partial<Omit<ProductVariation, 'id' | 'productId'>>
) =>
  apiFetch<{ variation: ProductVariation }>(`/api/products/${productId}/variations`, {
    method: 'POST',
    body: JSON.stringify(data),
  }, token);

export const updateProductVariationApi = (
  token: string,
  productId: number | string,
  varId: number,
  data: Partial<Omit<ProductVariation, 'id' | 'productId'>>
) =>
  apiFetch<{ variation: ProductVariation }>(`/api/products/${productId}/variations/${varId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }, token);

export const deleteProductVariationApi = (token: string, productId: number | string, varId: number) =>
  apiFetch<{ message: string }>(`/api/products/${productId}/variations/${varId}`, {
    method: 'DELETE',
  }, token);

// ── Portfolio API ─────────────────────────────────────────────────────────────

export const fetchPortfolioApi = (token?: string | null) =>
  apiFetch<{ portfolio: PortfolioItem[] }>('/api/portfolio', {}, token);

export const fetchPortfolioItemApi = (id: number, token?: string | null) =>
  apiFetch<{ portfolioItem: PortfolioItem }>(`/api/portfolio/${id}`, {}, token);

export const createPortfolioItemApi = (
  token: string,
  data: Partial<Omit<PortfolioItem, 'id' | 'createdAt' | 'updatedAt'>>
) =>
  apiFetch<{ portfolioItem: PortfolioItem }>('/api/portfolio', {
    method: 'POST',
    body: JSON.stringify(data),
  }, token);

export const updatePortfolioItemApi = (
  token: string,
  id: number,
  data: Partial<Omit<PortfolioItem, 'id' | 'createdAt' | 'updatedAt'>>
) =>
  apiFetch<{ portfolioItem: PortfolioItem }>(`/api/portfolio/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }, token);

export const deletePortfolioItemApi = (token: string, id: number) =>
  apiFetch<{ message: string }>(`/api/portfolio/${id}`, {
    method: 'DELETE',
  }, token);

// ── Portfolio Categories API ──────────────────────────────────────────────────

export const fetchPortfolioCategoriesApi = (token?: string | null) =>
  apiFetch<{ categories: PortfolioCategory[] }>('/api/portfolio-categories', {}, token);

export const createPortfolioCategoryApi = (
  token: string,
  data: { name: string; sortOrder?: number }
) =>
  apiFetch<{ category: PortfolioCategory }>('/api/portfolio-categories', {
    method: 'POST',
    body: JSON.stringify(data),
  }, token);

export const updatePortfolioCategoryApi = (
  token: string,
  id: number,
  data: { name?: string; sortOrder?: number }
) =>
  apiFetch<{ category: PortfolioCategory }>(`/api/portfolio-categories/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }, token);

export const deletePortfolioCategoryApi = (token: string, id: number) =>
  apiFetch<{ message: string }>(`/api/portfolio-categories/${id}`, {
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
  todayBookings: number;
  todayPending: number;
  topServices: { name: string; count: number }[];
  peakHours: { time: string; count: number }[];
  reviewCount: number;
  avgRating: number;
}

export interface AdminManagedUser {
  id: number;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  created_at: string;
}

export interface AdminRole {
  id: number;
  key: string;
  name: string;
  description: string;
  permissions: string[];
  isSystem: boolean;
  created_at: string | null;
  updated_at: string | null;
}

export const fetchAdminUsersApi = (token: string, params?: { search?: string; role?: UserRole | '' }) => {
  const q = new URLSearchParams();
  if (params?.search) q.set('search', params.search);
  if (params?.role) q.set('role', params.role);
  const query = q.toString();
  const path = query ? `/api/admin/users?${query}` : '/api/admin/users';
  return apiFetch<{ users: AdminManagedUser[] }>(path, {}, token);
};

export const createAdminUserApi = (
  token: string,
  data: { name: string; email: string; phone?: string; password: string; role: UserRole }
) =>
  apiFetch<{ user: AdminManagedUser }>('/api/admin/users', {
    method: 'POST',
    body: JSON.stringify(data),
  }, token);

export const updateAdminUserRoleApi = (token: string, id: number, role: UserRole) =>
  apiFetch<{ user: AdminManagedUser }>(`/api/admin/users/${id}/role`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  }, token);

export const fetchAdminClientsApi = (token: string, params?: { search?: string }) => {
  const q = new URLSearchParams();
  if (params?.search) q.set('search', params.search);
  const query = q.toString();
  const path = query ? `/api/admin/clients?${query}` : '/api/admin/clients';
  return apiFetch<{ clients: ClientAdminSummary[] }>(path, {}, token);
};

export const fetchAdminRolesApi = (token: string) =>
  apiFetch<{ roles: AdminRole[] }>('/api/admin/roles', {}, token);

export const createAdminRoleApi = (
  token: string,
  data: { key: string; name: string; description?: string; permissions?: string[] }
) =>
  apiFetch<{ role: AdminRole }>('/api/admin/roles', {
    method: 'POST',
    body: JSON.stringify(data),
  }, token);

export const updateAdminRoleApi = (
  token: string,
  id: number,
  data: { key?: string; name?: string; description?: string; permissions?: string[] }
) =>
  apiFetch<{ role: AdminRole }>(`/api/admin/roles/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }, token);

export const deleteAdminRoleApi = (token: string, id: number) =>
  apiFetch<{ message: string }>(`/api/admin/roles/${id}`, {
    method: 'DELETE',
  }, token);

export const fetchAdminStatsApi = (token: string) =>
  apiFetch<AdminStats>('/api/admin/stats', {}, token);

export interface MigrationEntry {
  name: string;
  status: 'ran' | 'pending';
  ran_at: string | null;
}

export interface MigrationStatusResponse {
  migrations: MigrationEntry[];
}

export interface MigrationRunResponse {
  ran: string[];
  skipped: string[];
  total: number;
}

export const fetchMigrationStatusApi = (token: string) =>
  apiFetch<MigrationStatusResponse>('/api/admin/migrate', {}, token);

export const runMigrationsApi = (token: string) =>
  apiFetch<MigrationRunResponse>('/api/admin/migrate', { method: 'POST' }, token);

// ── Site Settings API ─────────────────────────────────────────────────────────

export const fetchSiteSettingsApi = () =>
  apiFetch<{ settings: import('../types').SiteSettings }>('/api/site-settings');

export const updateSiteSettingsApi = (
  token: string,
  data: import('../types').SiteSettings
) =>
  apiFetch<{ settings: import('../types').SiteSettings }>('/api/site-settings', {
    method: 'PUT',
    body: JSON.stringify(data),
  }, token);

// ── Team Members API ──────────────────────────────────────────────────────────

export const fetchTeamMembersApi = (token?: string | null) =>
  apiFetch<{ members: import('../types').TeamMember[] }>('/api/team-members', {}, token);

export const createTeamMemberApi = (
  token: string,
  data: Partial<Omit<import('../types').TeamMember, 'id' | 'createdAt' | 'updatedAt'>>
) =>
  apiFetch<{ member: import('../types').TeamMember }>('/api/team-members', {
    method: 'POST',
    body: JSON.stringify(data),
  }, token);

export const updateTeamMemberApi = (
  token: string,
  id: number,
  data: Partial<Omit<import('../types').TeamMember, 'id' | 'createdAt' | 'updatedAt'>>
) =>
  apiFetch<{ member: import('../types').TeamMember }>(`/api/team-members/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }, token);

export const deleteTeamMemberApi = (token: string, id: number) =>
  apiFetch<{ message: string }>(`/api/team-members/${id}`, {
    method: 'DELETE',
  }, token);

// ── Testimonials API ──────────────────────────────────────────────────────────

export const fetchTestimonialsApi = (token?: string | null) =>
  apiFetch<{ testimonials: import('../types').Testimonial[] }>('/api/testimonials', {}, token);

export const createTestimonialApi = (
  token: string,
  data: Partial<Omit<import('../types').Testimonial, 'id' | 'createdAt' | 'updatedAt'>>
) =>
  apiFetch<{ testimonial: import('../types').Testimonial }>('/api/testimonials', {
    method: 'POST',
    body: JSON.stringify(data),
  }, token);

export const updateTestimonialApi = (
  token: string,
  id: number,
  data: Partial<Omit<import('../types').Testimonial, 'id' | 'createdAt' | 'updatedAt'>>
) =>
  apiFetch<{ testimonial: import('../types').Testimonial }>(`/api/testimonials/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }, token);

export const deleteTestimonialApi = (token: string, id: number) =>
  apiFetch<{ message: string }>(`/api/testimonials/${id}`, {
    method: 'DELETE',
  }, token);

// ── FAQ API ───────────────────────────────────────────────────────────────────

export const fetchFaqsApi = (token?: string | null) =>
  apiFetch<{ faqs: import('../types').FaqItem[] }>('/api/faq', {}, token);

export const createFaqApi = (
  token: string,
  data: Partial<Omit<import('../types').FaqItem, 'id' | 'createdAt' | 'updatedAt'>>
) =>
  apiFetch<{ faq: import('../types').FaqItem }>('/api/faq', {
    method: 'POST',
    body: JSON.stringify(data),
  }, token);

export const updateFaqApi = (
  token: string,
  id: number,
  data: Partial<Omit<import('../types').FaqItem, 'id' | 'createdAt' | 'updatedAt'>>
) =>
  apiFetch<{ faq: import('../types').FaqItem }>(`/api/faq/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }, token);

export const deleteFaqApi = (token: string, id: number) =>
  apiFetch<{ message: string }>(`/api/faq/${id}`, {
    method: 'DELETE',
  }, token);

// ── Offers API ────────────────────────────────────────────────────────────────

export const fetchOffersApi = (token?: string | null) =>
  apiFetch<{ offers: Offer[] }>('/api/offers', {}, token);

export const fetchOfferByIdApi = (id: number, token?: string | null) =>
  apiFetch<{ offer: Offer }>(`/api/offers/${id}`, {}, token);

export const createOfferApi = (
  token: string,
  data: Partial<Omit<Offer, 'id' | 'createdAt' | 'updatedAt'>>
) =>
  apiFetch<{ offer: Offer }>('/api/offers', {
    method: 'POST',
    body: JSON.stringify(data),
  }, token);

export const updateOfferApi = (
  token: string,
  id: number,
  data: Partial<Omit<Offer, 'id' | 'createdAt' | 'updatedAt'>>
) =>
  apiFetch<{ offer: Offer }>(`/api/offers/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }, token);

export const deleteOfferApi = (token: string, id: number) =>
  apiFetch<{ message: string }>(`/api/offers/${id}`, {
    method: 'DELETE',
  }, token);

// ── Before/After API ─────────────────────────────────────────────────────────

export const fetchBeforeAfterItemsApi = (
  filters?: { make?: string; model?: string },
  token?: string | null
) => {
  const params = new URLSearchParams();
  if (filters?.make)  params.set('make',  filters.make);
  if (filters?.model) params.set('model', filters.model);
  const qs = params.toString() ? `?${params.toString()}` : '';
  return apiFetch<{ items: BeforeAfterItem[] }>(`/api/before-after${qs}`, {}, token);
};

export const fetchBeforeAfterItemApi = (id: number, token?: string | null) =>
  apiFetch<{ item: BeforeAfterItem }>(`/api/before-after/${id}`, {}, token);

export const createBeforeAfterItemApi = (
  token: string,
  data: Partial<Omit<BeforeAfterItem, 'id' | 'createdAt' | 'updatedAt'>>
) =>
  apiFetch<{ item: BeforeAfterItem }>('/api/before-after', {
    method: 'POST',
    body: JSON.stringify(data),
  }, token);

export const updateBeforeAfterItemApi = (
  token: string,
  id: number,
  data: Partial<Omit<BeforeAfterItem, 'id' | 'createdAt' | 'updatedAt'>>
) =>
  apiFetch<{ item: BeforeAfterItem }>(`/api/before-after/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }, token);

export const deleteBeforeAfterItemApi = (token: string, id: number) =>
  apiFetch<{ message: string }>(`/api/before-after/${id}`, {
    method: 'DELETE',
  }, token);

// ── Facebook feed ─────────────────────────────────────────────────────────────

export interface FacebookPostsPage {
  posts: FacebookPost[];
  nextCursor: string | null;
}

export const fetchFacebookPosts = async (after?: string, limit = 100): Promise<FacebookPostsPage> => {
  const params = new URLSearchParams();
  if (after) params.set('after', after);
  params.set('limit', String(limit));
  const url = `${BACKEND_URL}/api/posts?${params}`;

  let response: Response;
  try {
    response = await fetch(url);
  } catch {
    notifyApiOffline();
    throw new Error('API is offline.');
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

export const fetchAllFacebookPosts = async (): Promise<FacebookPost[]> => {
  const allPosts: FacebookPost[] = [];
  let cursor: string | undefined;

  while (true) {
    const page = await fetchFacebookPosts(cursor, 100);
    allPosts.push(...page.posts);
    if (!page.nextCursor) break;
    cursor = page.nextCursor;
  }

  return allPosts;
};

// ── Contact ──────────────────────────────────────────────────────────────────

export interface ContactMessagePayload {
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
}

export const sendContactMessageApi = (payload: ContactMessagePayload) =>
  apiFetch<{ message: string }>('/api/contact', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

// ── Notifications API ─────────────────────────────────────────────────────────

export const fetchNotificationsApi = (token: string) =>
  apiFetch<{ notifications: AppNotification[]; unreadCount: number }>(
    '/api/notifications',
    {},
    token
  );

export const markNotificationReadApi = (token: string, id: number) =>
  apiFetch<{ ok: boolean }>(`/api/notifications/${id}/read`, { method: 'PATCH' }, token);

export const markAllNotificationsReadApi = (token: string) =>
  apiFetch<{ ok: boolean }>('/api/notifications/read-all', { method: 'PATCH' }, token);

export const deleteNotificationApi = (token: string, id: number) =>
  apiFetch<{ ok: boolean }>(`/api/notifications/${id}`, { method: 'DELETE' }, token);

// ── Reviews API ───────────────────────────────────────────────────────────────

import type { BookingReview, NotificationPreferences, CustomerStats } from '../types';

export const getBookingReviewApi = (token: string, bookingId: string) =>
  apiFetch<{ review: BookingReview | null }>(`/api/bookings/${encodeURIComponent(bookingId)}/review`, {}, token);

export const submitBookingReviewApi = (
  token: string,
  bookingId: string,
  data: { rating: number; review: string }
) =>
  apiFetch<{ review: BookingReview }>(
    `/api/bookings/${encodeURIComponent(bookingId)}/review`,
    { method: 'POST', body: JSON.stringify(data) },
    token
  );

export const fetchAllReviewsApi = (token: string) =>
  apiFetch<{ reviews: BookingReview[] }>('/api/reviews', {}, token);

export const fetchPublishedReviewsApi = (serviceId?: number) => {
  const qs = serviceId != null ? `?service_id=${serviceId}` : '';
  return apiFetch<{ reviews: BookingReview[] }>(`/api/reviews/published${qs}`);
};

export const approveReviewApi = (token: string, id: number) =>
  apiFetch<{ ok: boolean }>(`/api/reviews/${id}/approve`, { method: 'PATCH' }, token);

export const rejectReviewApi = (token: string, id: number) =>
  apiFetch<{ ok: boolean }>(`/api/reviews/${id}/reject`, { method: 'PATCH' }, token);

export const deleteReviewApi = (token: string, id: number) =>
  apiFetch<{ ok: boolean }>(`/api/reviews/${id}`, { method: 'DELETE' }, token);

// ── Notification Preferences API ──────────────────────────────────────────────

export const getNotificationPrefsApi = (token: string) =>
  apiFetch<{ preferences: NotificationPreferences | null }>('/api/auth/notification-preferences', {}, token);

export const saveNotificationPrefsApi = (token: string, prefs: Partial<NotificationPreferences> | Record<string, boolean>) =>
  apiFetch<{ preferences: NotificationPreferences }>(
    '/api/auth/notification-preferences',
    { method: 'PUT', body: JSON.stringify(prefs) },
    token
  );

// ── Internal Notes API ────────────────────────────────────────────────────────

export const updateInternalNotesApi = (token: string, bookingId: string, internalNotes: string) =>
  apiFetch<{ booking: import('../types').Booking }>(
    `/api/bookings/${encodeURIComponent(bookingId)}/notes`,
    { method: 'PATCH', body: JSON.stringify({ internalNotes }) },
    token
  );

// ── Customer Stats API ────────────────────────────────────────────────────────

export const fetchCustomerStatsApi = (token: string, userId: number) =>
  apiFetch<{ stats: CustomerStats }>(`/api/customers/${userId}/stats`, {}, token);

// ── Client Garage API ───────────────────────────────────────────────────────

export const fetchMyVehiclesApi = (token: string) =>
  apiFetch<{ vehicles: ClientVehicle[] }>('/api/client/vehicles', {}, token);

export const createMyVehicleApi = (
  token: string,
  data: Pick<ClientVehicle, 'make' | 'model' | 'year'> & { imageUrl?: string; vin?: string; licensePlate?: string }
) =>
  apiFetch<{ vehicle: ClientVehicle }>('/api/client/vehicles', {
    method: 'POST',
    body: JSON.stringify(data),
  }, token);

export const updateMyVehicleApi = (
  token: string,
  id: number,
  data: Pick<ClientVehicle, 'make' | 'model' | 'year'> & { imageUrl?: string; vin?: string; licensePlate?: string }
) =>
  apiFetch<{ vehicle: ClientVehicle }>(`/api/client/vehicles/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }, token);

export const uploadMyVehicleImageApi = async (token: string, file: File): Promise<string> => {
  const form = new FormData();
  form.append('file', file);

  let response: Response;
  try {
    response = await fetch(`${BACKEND_URL}/api/client/vehicles/media`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
  } catch {
    notifyApiOffline();
    throw new Error('API is offline.');
  }

  const data = await response.json();
  if (!response.ok) throw new Error(data?.detail ?? `Upload failed (${response.status})`);
  return (data as { url: string }).url;
};

export const deleteMyVehicleApi = (token: string, id: number) =>
  apiFetch<{ ok: boolean }>(`/api/client/vehicles/${id}`, { method: 'DELETE' }, token);

// ── Build Showcase API ─────────────────────────────────────────────────────

export const fetchBuildShowcaseApi = (slug: string) =>
  apiFetch<PortfolioItem>(`/api/portfolio/slug/${encodeURIComponent(slug)}`);


// ── Calibration Certificate ───────────────────────────────────────────────────

export const updateCalibrationDataApi = (
  token: string,
  bookingId: string,
  data: { beamAngle?: string; luxOutput?: string; notes?: string; [key: string]: string | undefined }
) =>
  apiFetch<{ booking: Booking }>(`/api/bookings/${bookingId}/calibration`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }, token);

// ── GDPR / Data Privacy ───────────────────────────────────────────────────────

export const exportMyDataApi = async (token: string): Promise<void> => {
  let response: Response;
  try {
    response = await fetch(`${BACKEND_URL}/api/auth/data-export`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    notifyApiOffline();
    throw new Error('API is offline.');
  }
  if (!response.ok) {
    const d = await response.json().catch(() => ({}));
    throw new Error((d as { detail?: string }).detail ?? `Export failed (${response.status})`);
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `my-data-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
};

export const deleteMyAccountApi = (token: string, password: string) =>
  apiFetch<{ message: string }>('/api/auth/account', {
    method: 'DELETE',
    body: JSON.stringify({ password }),
  }, token);

// ── Waitlist ──────────────────────────────────────────────────────────────────

export interface JoinWaitlistPayload {
  slotDate: string;
  slotTime: string;
  name: string;
  email: string;
  phone?: string;
  serviceIds?: string;
  notes?: string;
}

export const joinWaitlistApi = (data: JoinWaitlistPayload, token?: string | null) =>
  apiFetch<{ entry: WaitlistEntry }>('/api/waitlist', {
    method: 'POST',
    body: JSON.stringify(data),
  }, token);

export const fetchWaitlistApi = (token: string, status?: string) => {
  const qs = status ? `?status=${encodeURIComponent(status)}` : '';
  return apiFetch<{ entries: WaitlistEntry[] }>(`/api/waitlist${qs}`, {}, token);
};

export const removeWaitlistEntryApi = (token: string, id: number) =>
  apiFetch<{ message: string }>(`/api/waitlist/${id}`, { method: 'DELETE' }, token);
