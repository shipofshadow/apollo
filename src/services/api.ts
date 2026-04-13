import type { BookingPayload, Booking, FacebookPost, User, Service, Product, PortfolioItem, PortfolioCategory, Offer, BeforeAfterItem, ServiceVariation, ProductVariation, BuildUpdate, AppNotification, BookingActivityLog, ClientVehicle, ClientAdminSummary, UserRole, WaitlistEntry, CartItem, ProductOrder, ProductOrderStatus, SemaphoreAccountResponse, SemaphoreMessagesResponse, NotificationQueueResponse, NotificationQueueHealth, Customer360Data, MarketingCampaign, MarketingCampaignRunResult, CampaignAudienceRecipient, CampaignAnalyticsData, InventoryItem, InventoryMovement, InventoryAlert, InventorySupplier, PurchaseOrder, BookingPartRequirement } from '../types';
import { BACKEND_URL } from '../config';

// ── Helpers ─────────────────────────────────────────────────────────────────

export const API_OFFLINE_EVENT = 'apollo:api-offline';
export const AUTH_EXPIRED_EVENT = 'apollo:auth-expired';

const API_TIMEOUT_MS = 20_000;
const MAX_RETRIES = 2;
const OFFLINE_CHECK_TIMEOUT_MS = 3_500;

let lastApiSuccessAt = 0;
let lastOfflineEventAt = 0;
let offlineCheckInFlight: Promise<void> | null = null;

async function probeBackendOnline(): Promise<boolean> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), OFFLINE_CHECK_TIMEOUT_MS);

  try {
    const response = await fetch(`${BACKEND_URL}/health`, {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal,
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}

function notifyApiOffline(): void {
  if (typeof window === 'undefined') return;

  const now = Date.now();

  // If the API recently replied successfully, avoid false offline toasts.
  if (now - lastApiSuccessAt < 10_000) return;

  if (offlineCheckInFlight) return;

  offlineCheckInFlight = (async () => {
    const online = await probeBackendOnline();
    if (online) {
      lastApiSuccessAt = Date.now();
      return;
    }

    if (Date.now() - lastOfflineEventAt < 5_000) return;

    lastOfflineEventAt = Date.now();
    window.dispatchEvent(new CustomEvent(API_OFFLINE_EVENT));
  })().finally(() => {
    offlineCheckInFlight = null;
  });
}

function markApiOnline(): void {
  lastApiSuccessAt = Date.now();
}

function notifyAuthExpired(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT));
  }
}

async function safeJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
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

  const method = (options.method ?? 'GET').toUpperCase();
  const isReadOnly = method === 'GET' || method === 'HEAD';

  let lastError: Error = new Error('API is offline.');

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(`${BACKEND_URL}${path}`, {
        ...options,
        headers,
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timeoutId);
      const isAbort = err instanceof DOMException && err.name === 'AbortError';
      lastError = isAbort
        ? new Error('Request timed out. Please try again.')
        : new Error('API is offline.');

      if (isReadOnly && attempt < MAX_RETRIES) continue;

      if (!isAbort) notifyApiOffline();
      throw lastError;
    } finally {
      clearTimeout(timeoutId);
    }

    // Retry on 5xx for read-only requests
    if (response.status >= 500 && isReadOnly && attempt < MAX_RETRIES) {
      lastError = new Error(`Request failed (${response.status})`);
      continue;
    }

    const data = await safeJson(response);
    if (!response.ok) {
      if (response.status === 401) notifyAuthExpired();
      throw new Error((data as { detail?: string } | null)?.detail ?? `Request failed (${response.status})`);
    }

    markApiOnline();
    return data as T;
  }

  throw lastError;
}

// ── Auth API ─────────────────────────────────────────────────────────────────

export const loginApi = (email: string, password: string, cfTurnstileToken: string) =>
  apiFetch<{ token: string; user: User }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password, 'cf-turnstile-response': cfTurnstileToken }),
  });

export const registerApi = (data: {
  name: string; email: string; phone: string; password: string; cfTurnstileToken: string;
}) =>
  apiFetch<{ message: string; verification_required: boolean; user: User }>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ ...data, 'cf-turnstile-response': data.cfTurnstileToken }),
  });

export const fetchMeApi = (token: string) =>
  apiFetch<{ user: User }>('/api/auth/me', {}, token);

export const updateProfileApi = (
  token: string,
  data: { name?: string; email?: string; phone?: string; avatar_url?: string | null; password?: string; password_confirmation?: string }
) =>
  apiFetch<{ user: User }>('/api/auth/profile', {
    method: 'PUT',
    body: JSON.stringify(data),
  }, token);

export const verifyEmailApi = (token: string) =>
  apiFetch<{ message: string; user: User }>(`/api/auth/verify-email?token=${encodeURIComponent(token)}`);

export const resendVerificationApi = (email: string) =>
  apiFetch<{ message: string }>('/api/auth/resend-verification', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });

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
  const data = await safeJson(response) as { url?: string; detail?: string } | null;
  if (!response.ok) {
    if (response.status === 401) notifyAuthExpired();
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

export const forgotPasswordApi = (email: string, cfTurnstileToken: string) =>
  apiFetch<{ message: string }>('/api/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email, 'cf-turnstile-response': cfTurnstileToken }),
  });

export const resetPasswordApi = (token: string, password: string, passwordConfirm: string, cfTurnstileToken: string) =>
  apiFetch<{ message: string }>('/api/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token, password, passwordConfirm, 'cf-turnstile-response': cfTurnstileToken }),
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
    const data = await safeJson(response) as { detail?: string } | null;
    throw new Error(data?.detail ?? `Request failed (${response.status})`);
  }

  return response.blob();
};

export interface OwnerActivityUserSummary {
  userId: number;
  userName: string;
  userEmail: string;
  totalActivities: number;
  lastActivityAt: string | null;
}

export interface OwnerActivityLogEntry {
  id: number;
  logName: string;
  description: string;
  subjectType: string | null;
  subjectId: string | null;
  causerType: string | null;
  causerId: string | null;
  properties: Record<string, unknown>;
  attribute_changes: {
    attributes?: Record<string, unknown>;
    old?: Record<string, unknown>;
  } | null;
  createdAt: string;
  subject: Record<string, unknown> | null;
  causer: Record<string, unknown> | null;
}

export const fetchOwnerActivityUsersApi = (
  token: string,
  sort: 'most_recent' | 'most_active' | 'name_asc' | 'name_desc' = 'most_recent'
) =>
  apiFetch<{ users: OwnerActivityUserSummary[] }>(`/api/admin/activity-logs/users?sort=${encodeURIComponent(sort)}`, {}, token);

export const fetchOwnerActivityLogsApi = (
  token: string,
  params: { userId?: number; limit?: number } = {}
) => {
  const q = new URLSearchParams();
  if (params.userId && params.userId > 0) q.set('userId', String(params.userId));
  q.set('limit', String(params.limit && params.limit > 0 ? params.limit : 300));
  const qs = q.toString();
  return apiFetch<{ logs: OwnerActivityLogEntry[] }>(`/api/admin/activity-logs${qs ? `?${qs}` : ''}`, {}, token);
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

export const submitBookingApi = (payload: BookingPayload & { 'cf-turnstile-response'?: string }, token?: string | null) =>
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
  const data = await safeJson(response) as { urls?: string[]; detail?: string } | null;
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
  const data = await safeJson(response) as { url?: string; detail?: string } | null;
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
  const data = await safeJson(response) as { urls?: string[]; detail?: string } | null;
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
  avatar_url?: string | null;
  avatarUrl?: string | null;
  role: UserRole;
  is_active: boolean;
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

export const fetchAssignableUsersApi = (token: string) =>
  apiFetch<{ users: AdminManagedUser[] }>('/api/admin/users/assignable', {}, token);

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

export const updateAdminUserStatusApi = (token: string, id: number, isActive: boolean) =>
  apiFetch<{ user: AdminManagedUser }>(`/api/admin/users/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ is_active: isActive }),
  }, token);

export const updateAdminUserInfoApi = (
  token: string,
  id: number,
  data: { name?: string; email?: string; phone?: string }
) =>
  apiFetch<{ user: AdminManagedUser }>(`/api/admin/users/${id}/info`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }, token);

export const deleteAdminUserApi = (token: string, id: number) =>
  apiFetch<{ deleted: boolean }>(`/api/admin/users/${id}`, {
    method: 'DELETE',
  }, token);

export const fetchAdminClientsApi = (token: string, params?: { search?: string }) => {
  const q = new URLSearchParams();
  if (params?.search) q.set('search', params.search);
  const query = q.toString();
  const path = query ? `/api/admin/clients?${query}` : '/api/admin/clients';
  return apiFetch<{ clients: ClientAdminSummary[] }>(path, {}, token);
};

export const fetchAdminClientBookingsApi = (token: string, clientId: number) =>
  apiFetch<{ bookings: Booking[] }>(`/api/admin/clients/${clientId}/bookings`, {}, token);

export const fetchAdminClientVehiclesApi = (token: string, clientId: number) =>
  apiFetch<{ vehicles: ClientVehicle[] }>(`/api/admin/clients/${clientId}/vehicles`, {}, token);

export const fetchAdminCustomer360Api = (token: string, clientId: number, limit = 25) =>
  apiFetch<{ customer360: Customer360Data }>(`/api/admin/customers/${clientId}/360?limit=${encodeURIComponent(String(limit))}`, {}, token);

// ── Marketing Campaigns API ────────────────────────────────────────────────

export const fetchCampaignsApi = (token: string) =>
  apiFetch<{ campaigns: MarketingCampaign[] }>('/api/admin/campaigns', {}, token);

export const fetchCampaignApi = (token: string, id: number) =>
  apiFetch<{ campaign: MarketingCampaign }>(`/api/admin/campaigns/${id}`, {}, token);

export const createCampaignApi = (
  token: string,
  data: Partial<MarketingCampaign> & { name: string; type: MarketingCampaign['type']; message: string; channels: MarketingCampaign['channels'] }
) =>
  apiFetch<{ campaign: MarketingCampaign }>('/api/admin/campaigns', {
    method: 'POST',
    body: JSON.stringify(data),
  }, token);

export const updateCampaignApi = (
  token: string,
  id: number,
  data: Partial<MarketingCampaign>
) =>
  apiFetch<{ campaign: MarketingCampaign }>(`/api/admin/campaigns/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }, token);

export const runCampaignApi = (token: string, id: number) =>
  apiFetch<{ result: MarketingCampaignRunResult }>(`/api/admin/campaigns/${id}/run`, {
    method: 'POST',
  }, token);

export const dryRunCampaignApi = (token: string, id: number) =>
  apiFetch<{ result: MarketingCampaignRunResult }>(`/api/admin/campaigns/${id}/dry-run`, {
    method: 'POST',
  }, token);

export const runScheduledCampaignsApi = (token: string, limit = 20) =>
  apiFetch<{ result: { processed: number; queuedDeliveries: number; errors: Array<{ campaignId: number; message: string }> } }>('/api/admin/campaigns/run-scheduled', {
    method: 'POST',
    body: JSON.stringify({ limit }),
  }, token);

export const fetchCampaignAudienceApi = (token: string, type: MarketingCampaign['type']) =>
  apiFetch<{ audience: CampaignAudienceRecipient[] }>(`/api/admin/campaign-audiences/${encodeURIComponent(type)}`, {}, token);

export const deleteCampaignApi = (token: string, id: number) =>
  apiFetch<{ ok: boolean }>(`/api/admin/campaigns/${id}`, {
    method: 'DELETE',
  }, token);

export const fetchCampaignAnalyticsApi = (token: string, id: number) =>
  apiFetch<CampaignAnalyticsData>(`/api/admin/campaigns/${id}/analytics`, {}, token);

// ── Inventory API ──────────────────────────────────────────────────────────

export const fetchInventoryItemsApi = (token: string, params: { search?: string; lowStockOnly?: boolean } = {}) => {
  const query = new URLSearchParams();
  if (params.search) query.set('search', params.search);
  if (params.lowStockOnly) query.set('lowStockOnly', 'true');
  const qs = query.toString();
  return apiFetch<{ items: InventoryItem[] }>(`/api/admin/inventory/items${qs ? `?${qs}` : ''}`, {}, token);
};

export const createInventoryItemApi = (token: string, data: Partial<InventoryItem> & { sku: string; name: string }) =>
  apiFetch<{ item: InventoryItem }>('/api/admin/inventory/items', {
    method: 'POST',
    body: JSON.stringify(data),
  }, token);

export const updateInventoryItemApi = (token: string, id: number, data: Partial<InventoryItem>) =>
  apiFetch<{ item: InventoryItem }>(`/api/admin/inventory/items/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }, token);

export const adjustInventoryApi = (
  token: string,
  data: { itemId: number; quantityDelta: number; note?: string }
) =>
  apiFetch<{ item: InventoryItem }>('/api/admin/inventory/adjust', {
    method: 'POST',
    body: JSON.stringify(data),
  }, token);

export const fetchInventoryMovementsApi = (token: string, limit = 100) =>
  apiFetch<{ movements: InventoryMovement[] }>(`/api/admin/inventory/movements?limit=${encodeURIComponent(String(limit))}`, {}, token);

export const fetchInventoryAlertsApi = (token: string, status: 'open' | 'resolved' | 'all' = 'open', limit = 100) =>
  apiFetch<{ alerts: InventoryAlert[] }>(`/api/admin/inventory/alerts?status=${encodeURIComponent(status)}&limit=${encodeURIComponent(String(limit))}`, {}, token);

export const fetchInventorySuppliersApi = (token: string) =>
  apiFetch<{ suppliers: InventorySupplier[] }>('/api/admin/inventory/suppliers', {}, token);

export const createInventorySupplierApi = (token: string, data: Partial<InventorySupplier> & { name: string }) =>
  apiFetch<{ supplier: InventorySupplier }>('/api/admin/inventory/suppliers', {
    method: 'POST',
    body: JSON.stringify(data),
  }, token);

export const fetchPurchaseOrdersApi = (token: string, limit = 100) =>
  apiFetch<{ purchaseOrders: PurchaseOrder[] }>(`/api/admin/inventory/purchase-orders?limit=${encodeURIComponent(String(limit))}`, {}, token);

export const createPurchaseOrderApi = (
  token: string,
  data: {
    supplierId?: number | null;
    notes?: string;
    expectedAt?: string;
    items: Array<{ itemId: number; quantity: number; unitCost: number }>;
  }
) =>
  apiFetch<{ purchaseOrder: PurchaseOrder }>('/api/admin/inventory/purchase-orders', {
    method: 'POST',
    body: JSON.stringify(data),
  }, token);

export const updatePurchaseOrderStatusApi = (
  token: string,
  id: number,
  status: PurchaseOrder['status']
) =>
  apiFetch<{ purchaseOrder: PurchaseOrder }>(`/api/admin/inventory/purchase-orders/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  }, token);

// ── Booking Part Requirements API ─────────────────────────────────────────

export const fetchBookingPartRequirementsApi = (token: string, bookingId: string) =>
  apiFetch<{ requirements: BookingPartRequirement[] }>(`/api/bookings/${encodeURIComponent(bookingId)}/parts/requirements`, {}, token);

export const createBookingPartRequirementApi = (
  token: string,
  bookingId: string,
  data: {
    partName: string;
    quantity: number;
    inventoryItemId?: number | null;
    supplierId?: number | null;
    note?: string;
  }
) =>
  apiFetch<{ requirement: BookingPartRequirement }>(`/api/bookings/${encodeURIComponent(bookingId)}/parts/requirements`, {
    method: 'POST',
    body: JSON.stringify(data),
  }, token);

export const updateBookingPartRequirementApi = (
  token: string,
  bookingId: string,
  requirementId: number,
  data: Partial<Pick<BookingPartRequirement, 'status' | 'note' | 'supplierId' | 'poItemId'>>
) =>
  apiFetch<{ requirement: BookingPartRequirement }>(`/api/bookings/${encodeURIComponent(bookingId)}/parts/requirements/${requirementId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }, token);

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

export const fetchSemaphoreAccountApi = (token: string, refresh = false) => {
  const qs = refresh ? '?refresh=true' : '';
  return apiFetch<SemaphoreAccountResponse>(`/api/admin/semaphore/account${qs}`, {}, token);
};

export const fetchSemaphoreMessagesApi = (
  token: string,
  params: { page?: number; limit?: number; status?: string; network?: string; startDate?: string; endDate?: string; refresh?: boolean } = {}
) => {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));
  if (params.status) query.set('status', params.status);
  if (params.network) query.set('network', params.network);
  if (params.startDate) query.set('startDate', params.startDate);
  if (params.endDate) query.set('endDate', params.endDate);
  if (params.refresh) query.set('refresh', 'true');
  const qs = query.toString();
  return apiFetch<SemaphoreMessagesResponse>(`/api/admin/semaphore/messages${qs ? `?${qs}` : ''}`, {}, token);
};

export const fetchNotificationQueueApi = (
  token: string,
  params: { status?: string; limit?: number } = {}
) => {
  const query = new URLSearchParams();
  if (params.status) query.set('status', params.status);
  if (params.limit) query.set('limit', String(params.limit));
  const qs = query.toString();
  return apiFetch<NotificationQueueResponse>(`/api/admin/notification-queue${qs ? `?${qs}` : ''}`, {}, token);
};

export const fetchNotificationQueueHealthApi = (
  token: string,
  warnAfterSeconds?: number
) => {
  const query = new URLSearchParams();
  if (warnAfterSeconds && warnAfterSeconds > 0) {
    query.set('warnAfterSeconds', String(warnAfterSeconds));
  }
  const qs = query.toString();
  return apiFetch<{ health: NotificationQueueHealth }>(`/api/admin/notification-queue/health${qs ? `?${qs}` : ''}`, {}, token);
};

export const replayFailedNotificationJobsApi = (
  token: string,
  limit = 50
) =>
  apiFetch<{ replayed: number; ids: number[] }>('/api/admin/notification-queue/replay-failed', {
    method: 'POST',
    body: JSON.stringify({ limit }),
  }, token);

export const replayNotificationJobApi = (token: string, id: number) =>
  apiFetch<{ replayed: number; ids: number[] }>(`/api/admin/notification-queue/${id}/replay`, {
    method: 'POST',
  }, token);

export interface MigrationEntry {
  name: string;
  status: 'ran' | 'pending';
  ran_at: string | null;
}

export interface MigrationStatusResponse {
  migrations: MigrationEntry[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  counts: {
    ran: number;
    pending: number;
    total: number;
  };
}

export interface MigrationRunResponse {
  ran: string[];
  skipped: string[];
  total: number;
}

export const fetchMigrationStatusApi = (
  token: string,
  params: { page?: number; pageSize?: number } = {}
) => {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.pageSize) query.set('pageSize', String(params.pageSize));
  const qs = query.toString();
  return apiFetch<MigrationStatusResponse>(`/api/admin/migrate${qs ? `?${qs}` : ''}`, {}, token);
};

export const runMigrationsApi = (token: string) =>
  apiFetch<MigrationRunResponse>('/api/admin/migrate', { method: 'POST' }, token);

export const runNotificationQueueWorkerApi = (token: string, limit?: number) =>
  apiFetch<{ stats: { processed: number; failed: number; retried: number } }>('/api/admin/cron/notification-queue', {
    method: 'POST',
    body: JSON.stringify(limit ? { limit } : {}),
  }, token);

export const runWaitlistAutoFillWorkerApi = (token: string) =>
  apiFetch<{ stats: { slotsChecked: number; notified: number } }>('/api/admin/cron/waitlist-autofill', {
    method: 'POST',
  }, token);

export const runAppointmentRemindersWorkerApi = (
  token: string,
  payload: { date?: string; dryRun?: boolean } = {}
) =>
  apiFetch<{ stats: { date: string; dryRun: boolean; totalBookings: number; attempted: number; skipped: number; errors: number } }>('/api/admin/cron/appointment-reminders', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, token);

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

type FacebookPostsCacheEntry = {
  expiresAt: number;
  value: FacebookPostsPage;
};

const FB_POSTS_CACHE_TTL_MS = 5 * 60 * 1000;
const facebookPostsMemoryCache = new Map<string, FacebookPostsCacheEntry>();

function facebookPostsCacheKey(after?: string, limit = 100): string {
  return `apollo:fb:posts:${after ?? 'first'}:${limit}`;
}

function readFacebookPostsCache(key: string): FacebookPostsPage | null {
  const now = Date.now();
  const memoryEntry = facebookPostsMemoryCache.get(key);
  if (memoryEntry && memoryEntry.expiresAt > now) {
    return memoryEntry.value;
  }

  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as FacebookPostsCacheEntry;
    if (!parsed || typeof parsed.expiresAt !== 'number' || !parsed.value) {
      return null;
    }
    if (parsed.expiresAt <= now) {
      window.sessionStorage.removeItem(key);
      return null;
    }

    facebookPostsMemoryCache.set(key, parsed);
    return parsed.value;
  } catch {
    return null;
  }
}

function writeFacebookPostsCache(key: string, value: FacebookPostsPage): void {
  const entry: FacebookPostsCacheEntry = {
    expiresAt: Date.now() + FB_POSTS_CACHE_TTL_MS,
    value,
  };

  facebookPostsMemoryCache.set(key, entry);

  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.sessionStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // Ignore storage failures; in-memory cache is enough.
  }
}

type FacebookPostsResponse = {
  data?: FacebookPost[];
  detail?: string;
  paging?: {
    next?: string;
    cursors?: {
      after?: string;
    };
  };
};

export const fetchFacebookPosts = async (after?: string, limit = 100): Promise<FacebookPostsPage> => {
  const cacheKey = facebookPostsCacheKey(after, limit);
  const cached = readFacebookPostsCache(cacheKey);
  if (cached) {
    return cached;
  }

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

  const data = await safeJson(response) as FacebookPostsResponse | null;
  if (!response.ok) throw new Error(data?.detail ?? 'Failed to fetch Facebook posts.');

  const nextCursor: string | null = data?.paging?.cursors?.after ?? null;
  const hasNext: boolean = Boolean(data?.paging?.next);

  const page = {
    posts: data?.data ?? [],
    nextCursor: hasNext ? nextCursor : null,
  };

  writeFacebookPostsCache(cacheKey, page);
  return page;
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
  'cf-turnstile-response': string;
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

  const data = await safeJson(response) as { url?: string; detail?: string } | null;
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

export const fetchWaitlistClaimApi = (claimToken: string) =>
  apiFetch<{ entry: WaitlistEntry }>(`/api/waitlist/claim/${encodeURIComponent(claimToken)}`);

// ── Orders ───────────────────────────────────────────────────────────────────

export interface CreateOrderPayload {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  fulfillmentType: 'courier' | 'walk_in';
  deliveryAddress?: string;
  deliveryCity?: string;
  deliveryProvince?: string;
  deliveryPostalCode?: string;
  shippingFee?: number;
  notes?: string;
  items: Array<Pick<CartItem, 'productId' | 'variationId' | 'quantity'>>;
}

export const createOrderApi = (data: CreateOrderPayload, token?: string | null) =>
  apiFetch<{ order: ProductOrder }>('/api/orders', {
    method: 'POST',
    body: JSON.stringify(data),
  }, token);

export const fetchMyOrdersApi = (token: string) =>
  apiFetch<{ orders: ProductOrder[] }>('/api/orders/mine', {}, token);

export const fetchOrderByIdApi = (token: string, id: number) =>
  apiFetch<{ order: ProductOrder }>(`/api/orders/${id}`, {}, token);

export interface AdminOrderFilters {
  status?: ProductOrderStatus;
  paymentStatus?: 'unpaid' | 'paid' | 'cod';
  fulfillmentType?: 'courier' | 'walk_in';
  query?: string;
  createdFrom?: string;
  createdTo?: string;
  page?: number;
  pageSize?: number;
}

export const fetchAdminOrdersApi = (token: string, filters: AdminOrderFilters = {}) => {
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  if (filters.paymentStatus) params.set('paymentStatus', filters.paymentStatus);
  if (filters.fulfillmentType) params.set('fulfillmentType', filters.fulfillmentType);
  if (filters.query) params.set('query', filters.query);
  if (filters.createdFrom) params.set('createdFrom', filters.createdFrom);
  if (filters.createdTo) params.set('createdTo', filters.createdTo);
  if (filters.page) params.set('page', String(filters.page));
  if (filters.pageSize) params.set('pageSize', String(filters.pageSize));
  const qs = params.toString() ? `?${params.toString()}` : '';
  return apiFetch<{ orders: ProductOrder[]; total: number; page: number; pageSize: number }>(`/api/admin/orders${qs}`, {}, token);
};

export const updateAdminOrderStatusApi = (token: string, id: number, status: ProductOrderStatus) =>
  apiFetch<{ order: ProductOrder }>(`/api/admin/orders/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  }, token);

export const updateAdminOrderTrackingApi = (token: string, id: number, courierName: string, trackingNumber: string) =>
  apiFetch<{ order: ProductOrder }>(`/api/admin/orders/${id}/tracking`, {
    method: 'PATCH',
    body: JSON.stringify({ courierName, trackingNumber }),
  }, token);

export const updateAdminOrderPaymentApi = (token: string, id: number, paymentStatus: 'unpaid' | 'paid' | 'cod') =>
  apiFetch<{ order: ProductOrder }>(`/api/admin/orders/${id}/payment`, {
    method: 'PATCH',
    body: JSON.stringify({ paymentStatus }),
  }, token);
