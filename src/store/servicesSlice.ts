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

// ── Slice ─────────────────────────────────────────────────────────────────────

const initialState: ServicesState = {
  items:  [],
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
