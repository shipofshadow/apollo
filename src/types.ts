// ── Auth ───────────────────────────────────────────────────────────────────

export interface User {
  id: number;
  name: string;
  email: string;
  phone: string;
  role: 'client' | 'admin';
  created_at: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  status: 'idle' | 'loading' | 'success' | 'error';
  error: string | null;
}

// ── Service ────────────────────────────────────────────────────────────────

export interface Service {
  id: number;
  title: string;
  description: string;       // short, shown on cards
  fullDescription: string;   // long, shown on detail page
  icon: string;              // Lucide icon name
  imageUrl: string;          // hero image URL
  duration: string;          // e.g. "4–6 Hours"
  startingPrice: string;     // e.g. "₱13,750"
  features: string[];        // Key Features & Benefits
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
  appointmentDate: string;
  appointmentTime: string;
  notes: string;
  /** Base64 PNG of the signed waiver, if captured */
  signatureData?: string;
  /** URLs returned by the media-upload endpoint */
  mediaUrls?: string[];
}

export interface BookingState {
  status: 'idle' | 'loading' | 'success' | 'error';
  error: string | null;
  appointments: Booking[];
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

export interface Booking {
  id: string;
  userId?: number | null;
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
  appointmentDate: string;
  appointmentTime: string;
  notes: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'awaiting_parts';
  awaitingParts?: boolean;
  partsNotes?: string;
  signatureData?: string;
  mediaUrls?: string[];
  createdAt: string;
}

export interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  category: string;
  imageUrl: string;
  features: string[];
  sortOrder: number;
  isActive: boolean;
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
  media?: FacebookAttachmentMedia;
  url?: string;
  description?: string;
}

export interface FacebookAttachment {
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
