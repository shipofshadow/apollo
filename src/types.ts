// ── Auth ───────────────────────────────────────────────────────────────────

export type UserRole = 'owner' | 'admin' | 'manager' | 'staff' | 'client';

export interface User {
  id: number;
  name: string;
  email: string;
  phone: string;
  avatar_url?: string | null;
  role: UserRole;
  permissions?: string[];
  created_at: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  status: 'idle' | 'loading' | 'success' | 'error';
  error: string | null;
}

// ── Service ────────────────────────────────────────────────────────────────

export interface ServiceVariationSpec {
  label: string;
  value: string;
}

export interface ServiceVariation {
  id: number;
  serviceId: number;
  name: string;
  description: string;
  price: string;
  images: string[];
  specs: ServiceVariationSpec[];
  colors?: string[];
  colorImages?: Record<string, string[]>;
  sortOrder: number;
}

export interface Service {
  id: number;
  slug: string;              // URL-safe identifier, e.g. "headlight-retrofits"
  title: string;
  description: string;       // short, shown on cards
  fullDescription: string;   // long, shown on detail page
  icon: string;              // Lucide icon name
  imageUrl: string;          // hero image URL
  duration: string;          // e.g. "4–6 Hours"
  startingPrice: string;     // e.g. "₱13,750"
  features: string[];        // Key Features & Benefits
  variations: ServiceVariation[];
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ServicesState {
  items: Service[];
  status: 'idle' | 'loading' | 'success' | 'error';
  error: string | null;
}

// ── Booking ────────────────────────────────────────────────────────────────

export interface BookingPayload {
  name: string;
  email: string;
  phone: string;
  /** Computed display string: "Year Make Model" */
  vehicleInfo: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleYear: string;
  /** All selected service IDs (supports multi-service bookings) */
  serviceIds: number[];
  /** Variation chosen per service: [{serviceId, variationId, variationName}] */
  selectedVariations?: { serviceId: number; variationId: number; variationName: string }[];
  appointmentDate: string;
  appointmentTime: string;
  notes: string;
  /** Base64 PNG of the signed waiver, if captured */
  signatureData?: string;
  /** URLs returned by the media-upload endpoint */
  mediaUrls?: string[];
  /** Cloudflare Turnstile token */
  'cf-turnstile-response'?: string;
  /** Optional waitlist claim token used to reserve a released slot */
  waitlistClaimToken?: string;
}

export interface BookingState {
  status: 'idle' | 'loading' | 'success' | 'error';
  error: string | null;
  appointments: Booking[];
}

export interface ClientVehicle {
  id: number;
  userId: number;
  make: string;
  model: string;
  year: string;
  imageUrl?: string | null;
  vin?: string | null;
  licensePlate?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ClientAdminSummary {
  id: number;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  bookingCount: number;
  lastBookingAt: string | null;
}

export interface Customer360Profile {
  id: number;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
}

export interface Customer360Booking {
  id: string;
  referenceNumber: string | null;
  serviceName: string;
  appointmentDate: string;
  appointmentTime: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface Customer360Order {
  id: number;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  totalAmount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Customer360Communication {
  source: 'inapp' | 'queue' | string;
  event: string;
  title: string;
  message: string;
  status: string;
  createdAt: string;
}

export interface Customer360Spend {
  lifetimeSpend: number;
  spend30d: number;
  spend90d: number;
  avgOrderValue: number;
  totalOrders: number;
  totalBookings: number;
  completedBookings: number;
  bookings30d: number;
  bookings90d: number;
}

export interface Customer360Data {
  profile: Customer360Profile;
  vehicles: ClientVehicle[];
  bookings: Customer360Booking[];
  orders: Customer360Order[];
  reviews: BookingReview[];
  spend: Customer360Spend;
  communications: Customer360Communication[];
}

export interface MarketingCampaign {
  id: number;
  name: string;
  type: 'abandoned_cart' | 'no_booking_90d' | 'win_back';
  status: 'draft' | 'active' | 'paused';
  scheduleEnabled: boolean;
  scheduleType: 'manual' | 'daily' | 'weekly' | 'monthly';
  scheduleTime: string;
  scheduleWeekday: number | null;
  scheduleDay: number | null;
  scheduleTimezone: string;
  channels: Array<'inapp' | 'email' | 'sms'>;
  title: string;
  message: string;
  ctaUrl: string | null;
  triggerConfig: Record<string, unknown>;
  lastRunAt: string | null;
  nextRunAt: string | null;
  createdBy: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignAudienceRecipient {
  userId: number;
  name: string;
  email: string;
  phone: string;
}

export interface MarketingCampaignRunResult {
  runId: number;
  campaign: MarketingCampaign;
  targetCount: number;
  queuedCount: number;
  dryRun: boolean;
  previewRecipients: CampaignAudienceRecipient[];
}

export interface CampaignFailureSummary {
  channel: 'inapp' | 'email' | 'sms' | string;
  error: string;
  total: number;
}

export interface CampaignRecentFailure {
  runId: number;
  userId: number | null;
  channel: 'inapp' | 'email' | 'sms' | string;
  recipient: string;
  error: string;
  processedAt: string | null;
}

export interface CampaignAnalyticsData {
  campaign: MarketingCampaign;
  totals: { total: number; queued: number; sent: number; failed: number };
  byChannel: Array<{ channel: string; total: number }>;
  byStatusByChannel: Array<{ channel: string; status: string; total: number }>;
  failureSummary: CampaignFailureSummary[];
  recentFailures: CampaignRecentFailure[];
  runs: Array<{ id: number; runType: string; dryRun: boolean; targetCount: number; queuedCount: number; createdAt: string }>;
}

export interface InventoryItem {
  id: number;
  sku: string;
  name: string;
  category: string;
  unit: string;
  qtyOnHand: number;
  reorderPoint: number;
  unitCost: number;
  supplierId: number | null;
  supplierName: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface InventorySupplier {
  id: number;
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryMovement {
  id: number;
  itemId: number;
  itemSku: string;
  itemName: string;
  movementType: string;
  quantityDelta: number;
  note: string;
  referenceType: string | null;
  referenceId: string | null;
  actorUserId: number | null;
  actorName: string | null;
  createdAt: string;
}

export interface InventoryAlert {
  id: number;
  itemId: number;
  itemSku: string;
  itemName: string;
  status: 'open' | 'resolved';
  qtySnapshot: number;
  reorderPointSnapshot: number;
  message: string;
  createdAt: string;
  resolvedAt: string | null;
}

export interface PurchaseOrderItem {
  id: number;
  itemId: number;
  itemSku: string;
  itemName: string;
  quantity: number;
  unitCost: number;
  lineTotal: number;
  receivedQty: number;
}

export interface PurchaseOrder {
  id: number;
  poNumber: string;
  supplierId: number | null;
  supplierName: string | null;
  status: 'draft' | 'ordered' | 'partially_received' | 'received' | 'cancelled';
  notes: string | null;
  orderedAt: string | null;
  expectedAt: string | null;
  receivedAt: string | null;
  createdBy: number | null;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
  items: PurchaseOrderItem[];
}

export interface BookingPartRequirement {
  id: number;
  bookingId: string;
  inventoryItemId: number | null;
  inventorySku: string | null;
  inventoryName: string | null;
  partName: string;
  quantity: number;
  status: 'needed' | 'ordered' | 'arrived' | 'installed' | 'cancelled';
  supplierId: number | null;
  supplierName: string | null;
  poItemId: number | null;
  note: string;
  createdBy: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceItem {
  id: string;
  title: string;
  description: string;
  icon: string;
}

export interface BuildItem {
  id: string;
  title: string;
  category: string;
  imageUrl: string;
}

export interface PortfolioItem {
  id: number;
  title: string;
  category: string;
  description: string;
  imageUrl: string;
  images: string[];
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PortfolioState {
  items: PortfolioItem[];
  status: 'idle' | 'loading' | 'success' | 'error';
  error: string | null;
}

export interface PortfolioCategory {
  id: number;
  name: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface PortfolioCategoryState {
  categories: PortfolioCategory[];
  status: 'idle' | 'loading' | 'success' | 'error';
  error: string | null;
}

export interface Booking {
  id: string;
  referenceNumber: string;
  userId?: number | null;
  assignedTechId?: number | null;
  assignedTech?: AssignedTechnician | null;
  name: string;
  email: string;
  phone: string;
  vehicleInfo: string;
  vehicleMake?: string;
  vehicleModel?: string;
  vehicleYear?: string;
  /** Primary service ID (first selected) – kept for backward compat */
  serviceId: number;
  /** All selected service IDs */
  serviceIds: number[];
  /** Comma-joined service names */
  serviceName: string;
  /** Variation chosen per service */
  selectedVariations?: { serviceId: number; variationId: number; variationName: string }[];
  appointmentDate: string;
  appointmentTime: string;
  notes: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'awaiting_parts';
  awaitingParts?: boolean;
  partsNotes?: string;
  internalNotes?: string;
  calibrationData?: {
    beamAngle?: string;
    luxOutput?: string;
    notes?: string;
    [key: string]: string | undefined;
  } | null;
  signatureData?: string;
  mediaUrls?: string[];
  beforePhotos?: string[];
  afterPhotos?: string[];
  createdAt: string;
  /** Optional: Slug for public build showcase page */
  buildSlug?: string;
}

export interface AssignedTechnician {
  id: number;
  userId?: number | null;
  name: string;
  role: string;
  imageUrl?: string | null;
}

export interface ProductVariationSpec {
  label: string;
  value: string;
}

export interface ProductVariation {
  id: number;
  productId: number;
  name: string;
  description: string;
  price: string;
  images: string[];
  specs: ProductVariationSpec[];
  colors?: string[];
  colorImages?: Record<string, string[]>;
  sortOrder: number;
  trackStock?: boolean;
  stockQty?: number;
}

export interface Product {
  id: number;
  uuid?: string;
  name: string;
  description: string;
  price: number;
  category: string;
  imageUrl: string;
  features: string[];
  variations: ProductVariation[];
  sortOrder: number;
  isActive: boolean;
  trackStock?: boolean;
  stockQty?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProductState {
  items: Product[];
  status: 'idle' | 'loading' | 'success' | 'error';
  error: string | null;
}

export interface FacebookAttachmentMedia {
  image?: { src: string; height: number; width: number };
}

export interface FacebookSubAttachment {
  type?: string;
  media?: FacebookAttachmentMedia;
  url?: string;
  description?: string;
}

export interface FacebookAttachment {
  type?: string;
  description?: string;
  media?: FacebookAttachmentMedia;
  url?: string;
  subattachments?: { data: FacebookSubAttachment[] };
}

// ── Blog Post ──────────────────────────────────────────────────────────────

export interface BlogPost {
  id: number;
  title: string;
  content: string;
  status: 'Draft' | 'Published';
  coverImage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BlogState {
  posts: BlogPost[];
  status: 'idle' | 'loading' | 'success' | 'error';
  error: string | null;
}

// ── Facebook ───────────────────────────────────────────────────────────────

export interface FacebookPost {
  id: string;
  message?: string;
  created_time: string;
  full_picture?: string;
  attachments?: { data: FacebookAttachment[] };
  likes?: { summary: { total_count: number } };
  comments?: { summary: { total_count: number } };
  shares?: { count: number };
}

// ── Shop hours ────────────────────────────────────────────────────────────────

export interface ShopDayHours {
  /** 0 = Sunday … 6 = Saturday */
  dayOfWeek: number;
  isOpen: boolean;
  /** "HH:MM" 24-hour, e.g. "09:00" */
  openTime: string;
  /** "HH:MM" 24-hour, e.g. "18:00" */
  closeTime: string;
  /** Appointment slot interval in hours */
  slotIntervalH: number;
}

export interface AvailabilityResponse {
  isOpen: boolean;
  openTime: string;
  closeTime: string;
  slotIntervalH: number;
  /** Set when the shop is closed due to a one-off holiday/closure (not the weekly schedule). */
  closureReason?: string | null;
  availableSlots: string[];
  bookedSlots: string[];
  /** Maximum number of bookings allowed per time slot. */
  slotCapacity: number;
  /** Number of active bookings per slot for the requested date. */
  slotCounts: Record<string, number>;
}

// ── Site Settings ─────────────────────────────────────────────────────────────

export interface SiteSettings {
  about_heading?: string;
  company_description_1?: string;
  company_description_2?: string;
  about_image_url?: string;
  [key: string]: string | undefined;
}

// ── Team Member ───────────────────────────────────────────────────────────────

export interface TeamMember {
  id: number;
  userId: number | null;
  name: string;
  role: string;
  imageUrl: string | null;
  bio: string | null;
  fullBio: string | null;
  email: string | null;
  phone: string | null;
  facebook: string | null;
  instagram: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ── Testimonial ───────────────────────────────────────────────────────────────

export interface Testimonial {
  id: number;
  name: string;
  role: string;
  content: string;
  rating: number;
  imageUrl: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

// ── FAQ ───────────────────────────────────────────────────────────────────────

export interface FaqItem {
  id: number;
  question: string;
  answer: string;
  category: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FaqState {
  items: FaqItem[];
  status: 'idle' | 'loading' | 'success' | 'error';
  error: string | null;
}

// ── Offer ─────────────────────────────────────────────────────────────────────

export interface Offer {
  id: number;
  title: string;
  subtitle: string;
  description: string;
  badgeText: string;
  ctaText: string;
  ctaUrl: string;
  linkedServiceId: number | null;
  linkedProductId: number | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface OfferState {
  items: Offer[];
  status: 'idle' | 'loading' | 'success' | 'error';
  error: string | null;
}

// ── Before/After ─────────────────────────────────────────────────────────────

export interface BeforeAfterItem {
  id: number;
  title: string;
  description: string;
  vehicleMake: string;
  vehicleModel: string;
  beforeImageUrl: string;
  afterImageUrl: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface WaitlistEntry {
  id: number;
  slotDate: string;
  slotTime: string;
  userId: number | null;
  name: string;
  email: string;
  phone: string;
  serviceIds: string;
  notes: string | null;
  status: 'waiting' | 'notified' | 'booked' | 'expired';
  notifiedAt: string | null;
  claimToken?: string | null;
  claimExpiresAt?: string | null;
  claimedAt?: string | null;
  bookedBookingId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CartItem {
  productId: number | string;
  variationId?: number | null;
  quantity: number;
  name: string;
  variationName?: string;
  unitPrice: number;
  imageUrl?: string;
}

export interface ProductOrderItem {
  id: number;
  productId: number;
  variationId: number | null;
  productName: string;
  variationName: string;
  unitPrice: number;
  quantity: number;
  subtotal: number;
}

export type ProductOrderStatus =
  | 'pending'
  | 'confirmed'
  | 'preparing'
  | 'ready_for_pickup'
  | 'out_for_delivery'
  | 'completed'
  | 'cancelled';

export interface ProductOrder {
  id: number;
  orderNumber: string;
  userId: number | null;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  fulfillmentType: 'courier' | 'walk_in';
  deliveryAddress: string | null;
  deliveryCity: string;
  deliveryProvince: string;
  deliveryPostalCode: string;
  status: ProductOrderStatus;
  paymentStatus: 'unpaid' | 'paid' | 'cod';
  courierName: string;
  trackingNumber: string;
  notes: string | null;
  subtotal: number;
  shippingFee: number;
  totalAmount: number;
  createdAt: string;
  updatedAt: string;
  items: ProductOrderItem[];
}

// ── Build Update ───────────────────────────────────────────────────────────────

export interface BuildUpdate {
  id: number;
  bookingId: string;
  assignedTechId?: number | null;
  assignedTech?: AssignedTechnician | null;
  note: string;
  photoUrls: string[];
  createdAt: string;
}

export interface BookingActivityLog {
  id: number;
  bookingId: string;
  actorUserId: number | null;
  actorRole: 'system' | 'admin' | 'client';
  eventType: string;
  action: string;
  detail: string | null;
  createdAt: string;
}


// ── In-app Notification ────────────────────────────────────────────────────────

export type NotificationType =
  | 'new_booking'
  | 'new_order'
  | 'order_created'
  | 'order_status'
  | 'order_tracking'
  | 'status_changed'
  | 'build_update'
  | 'parts_update'
  | 'assignment'
  | 'slot_available'
  | 'security_alert';

export interface AppNotification {
  id: number;
  userId: number | null;
  type: NotificationType;
  title: string;
  message: string;
  data: Record<string, unknown> | null;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationsState {
  items: AppNotification[];
  unreadCount: number;
  status: 'idle' | 'loading' | 'success' | 'error';
  error: string | null;
}

// ── Booking Review ─────────────────────────────────────────────────────────────

export interface BookingReview {
  id: number;
  bookingId: string;
  userId: number;
  reviewerName: string;
  serviceName: string;
  vehicleInfo: string;
  rating: number;       // 1-5
  review: string | null;
  isApproved: boolean;
  createdAt: string;
  updatedAt: string;
}

// ── Notification Preferences ───────────────────────────────────────────────────

export interface NotificationPreferences {
  emailNewBooking:    boolean;
  emailNewOrder:      boolean;
  emailOrderCreated:  boolean;
  emailOrderStatus:   boolean;
  emailOrderTracking: boolean;
  emailStatusChanged: boolean;
  emailBuildUpdate:   boolean;
  emailPartsUpdate:   boolean;
  inappNewOrder:      boolean;
  inappOrderCreated:  boolean;
  inappOrderStatus:   boolean;
  inappOrderTracking: boolean;
  inappStatusChanged: boolean;
  inappBuildUpdate:   boolean;
  inappPartsUpdate:   boolean;
  inappNewBooking:    boolean;
  inappAssignment:    boolean;
  inappSecurityAlert: boolean;
  inappSlotAvailable: boolean;
  smsNewBooking:      boolean;
  smsAssignment:      boolean;
  smsStatusChanged:   boolean;
}

// ── Customer Loyalty Stats ─────────────────────────────────────────────────────

export interface CustomerStats {
  totalVisits:     number;
  completedVisits: number;
  memberSince:     string | null;
}

export interface SemaphoreAccountDetails {
  account_id: number;
  account_name: string;
  status: string;
  credit_balance: number;
}

export interface SemaphoreAccountResponse {
  configured: boolean;
  sender_name: string;
  account: SemaphoreAccountDetails | null;
}

export interface SemaphoreMessage {
  message_id: number;
  recipient: string;
  message: string;
  sender_name: string;
  network: string;
  status: string;
  type: string;
  source: string;
  created_at: string;
  updated_at: string;
}

export interface SemaphoreMessagesResponse {
  configured: boolean;
  messages: SemaphoreMessage[];
  page: number;
  limit: number;
}

export interface NotificationQueueJob {
  id: number;
  event: string;
  status: 'queued' | 'processing' | 'retry' | 'done' | 'failed' | string;
  attempts: number;
  maxAttempts: number;
  runAfter: string;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
  processedAt: string | null;
  payload: Record<string, unknown>;
}

export interface NotificationQueueSummary {
  counts: {
    queued: number;
    processing: number;
    retry: number;
    failed: number;
    done: number;
  };
  lastProcessedAt: string | null;
  oldestPendingAt: string | null;
  lastFailure: {
    id: number;
    event: string;
    lastError: string | null;
    updatedAt: string;
  } | null;
}

export interface NotificationQueueHealth {
  warning: boolean;
  message: string;
  warnAfterSeconds: number;
  secondsSinceLastProcessed: number | null;
  pendingCount: number;
  summary: NotificationQueueSummary;
}

export interface NotificationQueueResponse {
  summary: NotificationQueueSummary;
  jobs: NotificationQueueJob[];
}

// ── Extended Admin Stats ───────────────────────────────────────────────────────

export interface TopService {
  name:  string;
  count: number;
}
