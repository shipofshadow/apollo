import { createSlice, createAsyncThunk, type PayloadAction } from '@reduxjs/toolkit';
import type { BookingPayload, BookingState, Booking } from '../types';
import {
  submitBookingApi,
  fetchMyBookingsApi,
  fetchAllBookingsApi,
  updateBookingStatusApi,
  cancelMyBookingApi,
  fetchBookingByIdApi,
  rescheduleBookingApi,
  adminRescheduleBookingApi,
  submitBooking as submitBookingMock,
} from '../services/api';
import { BACKEND_URL } from '../config';

// Try the real API; fall back to mock when backend is not reachable
export const submitBookingAsync = createAsyncThunk(
  'booking/submit',
  async (
    arg: { payload: BookingPayload; token?: string | null },
    { rejectWithValue }
  ) => {
    try {
      if (BACKEND_URL) {
        const { booking } = await submitBookingApi(arg.payload, arg.token);
        return booking;
      }
      return await submitBookingMock(arg.payload);
    } catch (e: unknown) {
      return rejectWithValue((e as Error).message ?? 'Failed to submit booking.');
    }
  }
);

export const fetchMyBookingsAsync = createAsyncThunk(
  'booking/fetchMine',
  async (token: string, { rejectWithValue }) => {
    try {
      const { bookings } = await fetchMyBookingsApi(token);
      return bookings;
    } catch (e: unknown) {
      return rejectWithValue((e as Error).message ?? 'Failed to load bookings.');
    }
  }
);

export const fetchAllBookingsAsync = createAsyncThunk(
  'booking/fetchAll',
  async (token: string, { rejectWithValue }) => {
    try {
      const { bookings } = await fetchAllBookingsApi(token);
      return bookings;
    } catch (e: unknown) {
      return rejectWithValue((e as Error).message ?? 'Failed to load bookings.');
    }
  }
);

export const updateBookingStatusAsync = createAsyncThunk(
  'booking/updateStatus',
  async (
    arg: { token: string; id: string; status: string },
    { rejectWithValue }
  ) => {
    try {
      const { booking } = await updateBookingStatusApi(arg.token, arg.id, arg.status);
      return booking;
    } catch (e: unknown) {
      return rejectWithValue((e as Error).message ?? 'Failed to update booking.');
    }
  }
);

export const cancelMyBookingAsync = createAsyncThunk(
  'booking/cancelMine',
  async (arg: { token: string; id: string }, { rejectWithValue }) => {
    try {
      const { booking } = await cancelMyBookingApi(arg.token, arg.id);
      return booking;
    } catch (e: unknown) {
      return rejectWithValue((e as Error).message ?? 'Failed to cancel booking.');
    }
  }
);

export const fetchBookingByIdAsync = createAsyncThunk(
  'booking/fetchById',
  async (arg: { token: string; id: string }, { rejectWithValue }) => {
    try {
      const { booking } = await fetchBookingByIdApi(arg.token, arg.id);
      return booking;
    } catch (e: unknown) {
      return rejectWithValue((e as Error).message ?? 'Failed to load booking.');
    }
  }
);

export const rescheduleMyBookingAsync = createAsyncThunk(
  'booking/rescheduleMine',
  async (
    arg: { token: string; id: string; appointmentDate: string; appointmentTime: string },
    { rejectWithValue }
  ) => {
    try {
      const { booking } = await rescheduleBookingApi(
        arg.token, arg.id, arg.appointmentDate, arg.appointmentTime
      );
      return booking;
    } catch (e: unknown) {
      return rejectWithValue((e as Error).message ?? 'Failed to reschedule booking.');
    }
  }
);

export const adminRescheduleBookingAsync = createAsyncThunk(
  'booking/adminReschedule',
  async (
    arg: { token: string; id: string; appointmentDate: string; appointmentTime: string },
    { rejectWithValue }
  ) => {
    try {
      const { booking } = await adminRescheduleBookingApi(
        arg.token, arg.id, arg.appointmentDate, arg.appointmentTime
      );
      return booking;
    } catch (e: unknown) {
      return rejectWithValue((e as Error).message ?? 'Failed to reschedule booking.');
    }
  }
);

const initialState: BookingState = {
  status: 'idle',
  error: null,
  appointments: [
    {
      id: 'mock-1',
      userId: null,
      name: 'John Smith',
      email: 'john@example.com',
      phone: '09171234567',
      vehicleInfo: '2020 Ford Mustang',
      vehicleMake: 'Ford',
      vehicleModel: 'Mustang',
      vehicleYear: '2020',
      serviceId: 1,
      serviceIds: [1],
      serviceName: 'Headlight Retrofit',
      appointmentDate: '2026-03-25',
      appointmentTime: '09:00 AM',
      notes: 'Want RGB halos and demon eyes.',
      status: 'pending',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'mock-2',
      userId: null,
      name: 'Sarah Connor',
      email: 'sarah@example.com',
      phone: '09189876543',
      vehicleInfo: '2018 Toyota Tacoma',
      vehicleMake: 'Toyota',
      vehicleModel: 'Hilux',
      vehicleYear: '2018',
      serviceId: 2,
      serviceIds: [2],
      serviceName: 'Android Headunit Installation',
      appointmentDate: '2026-03-24',
      appointmentTime: '11:00 AM',
      notes: 'Need wireless CarPlay.',
      status: 'confirmed',
      createdAt: new Date(Date.now() - 86400000).toISOString(),
    },
  ],
};

const bookingSlice = createSlice({
  name: 'booking',
  initialState,
  reducers: {
    resetBookingState: (state) => {
      state.status = 'idle';
      state.error  = null;
    },
    updateAppointmentStatus: (
      state,
      action: PayloadAction<{ id: string; status: Booking['status'] }>
    ) => {
      const appt = state.appointments.find(a => a.id === action.payload.id);
      if (appt) appt.status = action.payload.status;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(submitBookingAsync.pending, (state) => {
        state.status = 'loading';
        state.error  = null;
      })
      .addCase(submitBookingAsync.fulfilled, (state, action) => {
        state.status = 'success';
        state.appointments.unshift(action.payload);
      })
      .addCase(submitBookingAsync.rejected, (state, action) => {
        state.status = 'error';
        state.error  = action.payload as string;
      })
      .addCase(fetchMyBookingsAsync.fulfilled, (state, action) => {
        // Replace all real bookings with the current user's fresh data.
        // Keep only mock/demo entries so they can still serve as UI placeholders.
        state.appointments = [
          ...action.payload,
          ...state.appointments.filter(a => a.id.startsWith('mock')),
        ];
      })
      .addCase(fetchAllBookingsAsync.fulfilled, (state, action) => {
        state.appointments = action.payload;
      })
      .addCase(updateBookingStatusAsync.fulfilled, (state, action) => {
        const idx = state.appointments.findIndex(a => a.id === action.payload.id);
        if (idx !== -1) state.appointments[idx] = action.payload;
      })
      .addCase(cancelMyBookingAsync.fulfilled, (state, action) => {
        const idx = state.appointments.findIndex(a => a.id === action.payload.id);
        if (idx !== -1) state.appointments[idx] = action.payload;
      })
      .addCase(fetchBookingByIdAsync.fulfilled, (state, action) => {
        const idx = state.appointments.findIndex(a => a.id === action.payload.id);
        if (idx !== -1) state.appointments[idx] = action.payload;
        else state.appointments.unshift(action.payload);
      })
      .addCase(rescheduleMyBookingAsync.fulfilled, (state, action) => {
        const idx = state.appointments.findIndex(a => a.id === action.payload.id);
        if (idx !== -1) state.appointments[idx] = action.payload;
      })
      .addCase(adminRescheduleBookingAsync.fulfilled, (state, action) => {
        const idx = state.appointments.findIndex(a => a.id === action.payload.id);
        if (idx !== -1) state.appointments[idx] = action.payload;
      });
  },
});

export const { resetBookingState, updateAppointmentStatus } = bookingSlice.actions;
export default bookingSlice.reducer;

