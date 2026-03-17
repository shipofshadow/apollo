export interface BookingPayload {
  name: string;
  email: string;
  phone: string;
  vehicleInfo: string;
  serviceRequired: string;
  locationPreference: string;
  specificRequests: string;
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
  name: string;
  email: string;
  phone: string;
  vehicleInfo: string;
  serviceRequired: string;
  locationPreference: string;
  specificRequests: string;
  status: 'pending' | 'approved' | 'rejected';
  date: string;
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
