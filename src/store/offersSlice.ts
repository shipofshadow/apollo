import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { Offer, OfferState } from '../types';
import {
  fetchOffersApi,
  createOfferApi,
  updateOfferApi,
  deleteOfferApi,
} from '../services/api';

// ── Thunks ────────────────────────────────────────────────────────────────────

export const fetchOffersAsync = createAsyncThunk(
  'offers/fetchAll',
  async (token: string | null | undefined, { rejectWithValue }) => {
    try {
      const { offers } = await fetchOffersApi(token);
      return offers;
    } catch (e: unknown) {
      return rejectWithValue((e as Error).message ?? 'Failed to load offers.');
    }
  }
);

export const createOfferAsync = createAsyncThunk(
  'offers/create',
  async (
    arg: { token: string; data: Partial<Omit<Offer, 'id' | 'createdAt' | 'updatedAt'>> },
    { rejectWithValue }
  ) => {
    try {
      const { offer } = await createOfferApi(arg.token, arg.data);
      return offer;
    } catch (e: unknown) {
      return rejectWithValue((e as Error).message ?? 'Failed to create offer.');
    }
  }
);

export const updateOfferAsync = createAsyncThunk(
  'offers/update',
  async (
    arg: { token: string; id: number; data: Partial<Omit<Offer, 'id' | 'createdAt' | 'updatedAt'>> },
    { rejectWithValue }
  ) => {
    try {
      const { offer } = await updateOfferApi(arg.token, arg.id, arg.data);
      return offer;
    } catch (e: unknown) {
      return rejectWithValue((e as Error).message ?? 'Failed to update offer.');
    }
  }
);

export const deleteOfferAsync = createAsyncThunk(
  'offers/delete',
  async (arg: { token: string; id: number }, { rejectWithValue }) => {
    try {
      await deleteOfferApi(arg.token, arg.id);
      return arg.id;
    } catch (e: unknown) {
      return rejectWithValue((e as Error).message ?? 'Failed to delete offer.');
    }
  }
);

// ── Slice ─────────────────────────────────────────────────────────────────────

const initialState: OfferState = {
  items:  [],
  status: 'idle',
  error:  null,
};

const offersSlice = createSlice({
  name: 'offers',
  initialState,
  reducers: {
    resetOffersStatus: (state) => {
      state.status = 'idle';
      state.error  = null;
    },
  },
  extraReducers: (builder) => {
    // fetchAll
    builder
      .addCase(fetchOffersAsync.pending, (state) => {
        state.status = 'loading';
        state.error  = null;
      })
      .addCase(fetchOffersAsync.fulfilled, (state, action) => {
        state.status = 'success';
        state.items  = action.payload;
      })
      .addCase(fetchOffersAsync.rejected, (state, action) => {
        state.status = 'error';
        state.error  = action.payload as string;
      });

    // create
    builder
      .addCase(createOfferAsync.pending, (state) => {
        state.status = 'loading';
        state.error  = null;
      })
      .addCase(createOfferAsync.fulfilled, (state, action) => {
        state.status = 'success';
        state.items.push(action.payload);
      })
      .addCase(createOfferAsync.rejected, (state, action) => {
        state.status = 'error';
        state.error  = action.payload as string;
      });

    // update
    builder
      .addCase(updateOfferAsync.pending, (state) => {
        state.status = 'loading';
        state.error  = null;
      })
      .addCase(updateOfferAsync.fulfilled, (state, action) => {
        state.status = 'success';
        const idx = state.items.findIndex(o => o.id === action.payload.id);
        if (idx !== -1) state.items[idx] = action.payload;
      })
      .addCase(updateOfferAsync.rejected, (state, action) => {
        state.status = 'error';
        state.error  = action.payload as string;
      });

    // delete
    builder
      .addCase(deleteOfferAsync.pending, (state) => {
        state.status = 'loading';
        state.error  = null;
      })
      .addCase(deleteOfferAsync.fulfilled, (state, action) => {
        state.status = 'success';
        state.items  = state.items.filter(o => o.id !== action.payload);
      })
      .addCase(deleteOfferAsync.rejected, (state, action) => {
        state.status = 'error';
        state.error  = action.payload as string;
      });
  },
});

export const { resetOffersStatus } = offersSlice.actions;
export default offersSlice.reducer;
