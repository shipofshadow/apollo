import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { Service, ServicesState } from '../types';
import {
  fetchServicesApi,
  fetchServiceByIdApi,
  createServiceApi,
  updateServiceApi,
  deleteServiceApi,
} from '../services/api';

// ── Thunks ────────────────────────────────────────────────────────────────────

export const fetchServicesAsync = createAsyncThunk(
  'services/fetchAll',
  async (token: string | null | undefined, { rejectWithValue }) => {
    try {
      const { services } = await fetchServicesApi(token);
      return services;
    } catch (e: unknown) {
      return rejectWithValue((e as Error).message ?? 'Failed to load services.');
    }
  }
);

export const fetchServiceByIdAsync = createAsyncThunk(
  'services/fetchById',
  async (
    arg: { id: number; token?: string | null },
    { rejectWithValue }
  ) => {
    try {
      const { service } = await fetchServiceByIdApi(arg.id, arg.token);
      return service;
    } catch (e: unknown) {
      return rejectWithValue((e as Error).message ?? 'Failed to load service.');
    }
  }
);

export const createServiceAsync = createAsyncThunk(
  'services/create',
  async (
    arg: { token: string; data: Partial<Omit<Service, 'id' | 'createdAt' | 'updatedAt'>> },
    { rejectWithValue }
  ) => {
    try {
      const { service } = await createServiceApi(arg.token, arg.data);
      return service;
    } catch (e: unknown) {
      return rejectWithValue((e as Error).message ?? 'Failed to create service.');
    }
  }
);

export const updateServiceAsync = createAsyncThunk(
  'services/update',
  async (
    arg: {
      token: string;
      id: number;
      data: Partial<Omit<Service, 'id' | 'createdAt' | 'updatedAt'>>;
    },
    { rejectWithValue }
  ) => {
    try {
      const { service } = await updateServiceApi(arg.token, arg.id, arg.data);
      return service;
    } catch (e: unknown) {
      return rejectWithValue((e as Error).message ?? 'Failed to update service.');
    }
  }
);

export const deleteServiceAsync = createAsyncThunk(
  'services/delete',
  async (arg: { token: string; id: number }, { rejectWithValue }) => {
    try {
      await deleteServiceApi(arg.token, arg.id);
      return arg.id;
    } catch (e: unknown) {
      return rejectWithValue((e as Error).message ?? 'Failed to delete service.');
    }
  }
);

// ── Initial state (hardcoded fallback shown until API responds) ───────────────

const FALLBACK_SERVICES: Service[] = [
  {
    id: 1, title: 'Headlight Retrofits',
    description: 'Custom projector retrofits, demon eyes, halos, and sequential turn signals for maximum visibility and aggressive styling.',
    fullDescription: 'Our headlight retrofitting service is where art meets engineering. We don\'t just install bulbs; we completely rebuild your headlight housings with state-of-the-art bi-LED or HID projectors.',
    icon: 'Lightbulb',
    imageUrl: 'https://images.unsplash.com/photo-1580273916550-e323be2ae537?q=80&w=1964&auto=format&fit=crop',
    duration: '4–6 Hours', startingPrice: '₱13,750',
    features: ['Bi-LED & HID Projector Conversions','RGBW Demon Eyes & Halos','Custom Lens Etching','Housing Paint & Blackouts','Sequential Turn Signals','Moisture Sealing & Warranty'],
    sortOrder: 1, isActive: true, createdAt: '', updatedAt: '',
  },
  {
    id: 2, title: 'Android Headunits',
    description: 'Modernize your dash with high-resolution Android screens featuring Apple CarPlay, Android Auto, and custom bezels.',
    fullDescription: 'Upgrade your vehicle\'s infotainment system with our premium Android Headunit installations.',
    icon: 'MonitorPlay',
    imageUrl: 'https://images.unsplash.com/photo-1533558701576-23c65e0272fb?q=80&w=1974&auto=format&fit=crop',
    duration: '2–3 Hours', startingPrice: '₱8,250',
    features: ['Wireless Apple CarPlay & Android Auto','High-Resolution IPS/OLED Touchscreens','Factory Steering Wheel Control Retention','Custom 3D Printed Bezels','Backup & 360 Camera Integration','DSP Audio Tuning'],
    sortOrder: 2, isActive: true, createdAt: '', updatedAt: '',
  },
  {
    id: 3, title: 'Security Systems',
    description: 'Advanced alarm systems, GPS tracking, and kill switches to protect your investment.',
    fullDescription: 'Protect your investment with our advanced security system installations.',
    icon: 'ShieldAlert',
    imageUrl: 'https://images.unsplash.com/photo-1600705722908-bab1e61c0b4d?q=80&w=2070&auto=format&fit=crop',
    duration: '2–4 Hours', startingPrice: '₱11,000',
    features: ['2-Way Paging Alarm Systems','Hidden Kill Switches','Real-Time GPS Tracking','Remote Engine Start','Tilt & Glass Break Sensors','Smartphone Integration'],
    sortOrder: 3, isActive: true, createdAt: '', updatedAt: '',
  },
  {
    id: 4, title: 'Aesthetic Upgrades',
    description: 'Transform the look of your vehicle inside and out with custom grilles, ambient lighting, vinyl wraps, and more.',
    fullDescription: 'Transform the look and feel of your vehicle with our aesthetic upgrades.',
    icon: 'CarFront',
    imageUrl: 'https://images.unsplash.com/photo-1603386329225-868f9b1ee6c9?q=80&w=2069&auto=format&fit=crop',
    duration: 'Varies', startingPrice: 'Consultation',
    features: ['Custom Ambient Interior Lighting','Aftermarket Grille Installation','Interior Trim Vinyl Wrapping','Aero Kit & Splitter Installation','Custom Emblems & Badging','Caliper Painting'],
    sortOrder: 4, isActive: true, createdAt: '', updatedAt: '',
  },
];

const initialState: ServicesState = {
  items:  FALLBACK_SERVICES,
  status: 'idle',
  error:  null,
};

// ── Slice ─────────────────────────────────────────────────────────────────────

const servicesSlice = createSlice({
  name: 'services',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      // fetchAll
      .addCase(fetchServicesAsync.pending, (state) => {
        state.status = 'loading';
        state.error  = null;
      })
      .addCase(fetchServicesAsync.fulfilled, (state, action) => {
        state.status = 'success';
        state.items  = action.payload;
      })
      .addCase(fetchServicesAsync.rejected, (state, action) => {
        state.status = 'error';
        state.error  = action.payload as string;
        // keep existing items (fallback) on failure
      })

      // fetchById – upsert into items
      .addCase(fetchServiceByIdAsync.fulfilled, (state, action) => {
        const idx = state.items.findIndex(s => s.id === action.payload.id);
        if (idx !== -1) state.items[idx] = action.payload;
        else state.items.push(action.payload);
      })

      // create
      .addCase(createServiceAsync.fulfilled, (state, action) => {
        state.items.push(action.payload);
        state.items.sort((a, b) => a.sortOrder - b.sortOrder);
      })

      // update
      .addCase(updateServiceAsync.fulfilled, (state, action) => {
        const idx = state.items.findIndex(s => s.id === action.payload.id);
        if (idx !== -1) state.items[idx] = action.payload;
      })

      // delete
      .addCase(deleteServiceAsync.fulfilled, (state, action) => {
        state.items = state.items.filter(s => s.id !== action.payload);
      });
  },
});

export default servicesSlice.reducer;
