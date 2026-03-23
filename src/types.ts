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
  vehicleInfo: string;
  serviceId: number;
  appointmentDate: string;
  appointmentTime: string;
  notes: string;
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
  serviceId: number;
  serviceName: string;
  appointmentDate: string;
  appointmentTime: string;
  notes: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  createdAt: string;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  img: string;
  description?: string;
  features?: string[];
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
