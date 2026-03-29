import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { NotificationsState } from '../types';
import {
  fetchNotificationsApi,
  markNotificationReadApi,
  markAllNotificationsReadApi,
  deleteNotificationApi,
} from '../services/api';

// ── Async thunks ─────────────────────────────────────────────────────────────

export const fetchNotificationsAsync = createAsyncThunk(
  'notifications/fetch',
  async (token: string) => {
    return await fetchNotificationsApi(token);
  }
);

export const markReadAsync = createAsyncThunk(
  'notifications/markRead',
  async ({ token, id }: { token: string; id: number }) => {
    await markNotificationReadApi(token, id);
    return id;
  }
);

export const markAllReadAsync = createAsyncThunk(
  'notifications/markAllRead',
  async (token: string) => {
    await markAllNotificationsReadApi(token);
  }
);

export const deleteNotificationAsync = createAsyncThunk(
  'notifications/delete',
  async ({ token, id }: { token: string; id: number }) => {
    await deleteNotificationApi(token, id);
    return id;
  }
);

// ── Initial state ─────────────────────────────────────────────────────────────

const initialState: NotificationsState = {
  items: [],
  unreadCount: 0,
  status: 'idle',
  error: null,
};

// ── Slice ─────────────────────────────────────────────────────────────────────

const notificationsSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {},
  extraReducers: builder => {
    // fetch
    builder
      .addCase(fetchNotificationsAsync.pending, state => {
        state.status = 'loading';
        state.error  = null;
      })
      .addCase(fetchNotificationsAsync.fulfilled, (state, action) => {
        state.status      = 'success';
        state.items       = action.payload.notifications;
        state.unreadCount = action.payload.unreadCount;
      })
      .addCase(fetchNotificationsAsync.rejected, (state, action) => {
        state.status = 'error';
        state.error  = action.error.message ?? 'Failed to load notifications';
      });

    // markRead
    builder.addCase(markReadAsync.fulfilled, (state, action) => {
      const item = state.items.find(n => n.id === action.payload);
      if (item && !item.isRead) {
        item.isRead = true;
        state.unreadCount = Math.max(0, state.unreadCount - 1);
      }
    });

    // markAllRead
    builder.addCase(markAllReadAsync.fulfilled, state => {
      state.items.forEach(n => { n.isRead = true; });
      state.unreadCount = 0;
    });

    // delete
    builder.addCase(deleteNotificationAsync.fulfilled, (state, action) => {
      const idx = state.items.findIndex(n => n.id === action.payload);
      if (idx !== -1) {
        if (!state.items[idx].isRead) state.unreadCount = Math.max(0, state.unreadCount - 1);
        state.items.splice(idx, 1);
      }
    });
  },
});

export default notificationsSlice.reducer;
