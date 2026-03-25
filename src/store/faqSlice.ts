import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { FaqItem, FaqState } from '../types';
import { fetchFaqsApi, createFaqApi, updateFaqApi, deleteFaqApi } from '../services/api';

// ── Thunks ────────────────────────────────────────────────────────────────────

export const fetchFaqsAsync = createAsyncThunk(
  'faq/fetchFaqs',
  async (token: string | null | undefined, { rejectWithValue }) => {
    try {
      const { faqs } = await fetchFaqsApi(token);
      return faqs;
    } catch (e: unknown) {
      return rejectWithValue((e as Error).message ?? 'Failed to load FAQs.');
    }
  }
);

export const createFaqAsync = createAsyncThunk(
  'faq/createFaq',
  async (
    arg: { token: string; data: Partial<Omit<FaqItem, 'id' | 'createdAt' | 'updatedAt'>> },
    { rejectWithValue }
  ) => {
    try {
      const { faq } = await createFaqApi(arg.token, arg.data);
      return faq;
    } catch (e: unknown) {
      return rejectWithValue((e as Error).message ?? 'Failed to create FAQ.');
    }
  }
);

export const updateFaqAsync = createAsyncThunk(
  'faq/updateFaq',
  async (
    arg: { token: string; id: number; data: Partial<Omit<FaqItem, 'id' | 'createdAt' | 'updatedAt'>> },
    { rejectWithValue }
  ) => {
    try {
      const { faq } = await updateFaqApi(arg.token, arg.id, arg.data);
      return faq;
    } catch (e: unknown) {
      return rejectWithValue((e as Error).message ?? 'Failed to update FAQ.');
    }
  }
);

export const deleteFaqAsync = createAsyncThunk(
  'faq/deleteFaq',
  async (arg: { token: string; id: number }, { rejectWithValue }) => {
    try {
      await deleteFaqApi(arg.token, arg.id);
      return arg.id;
    } catch (e: unknown) {
      return rejectWithValue((e as Error).message ?? 'Failed to delete FAQ.');
    }
  }
);

// ── Slice ─────────────────────────────────────────────────────────────────────

const initialState: FaqState = {
  items: [],
  status: 'idle',
  error: null,
};

const faqSlice = createSlice({
  name: 'faq',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      // fetchFaqs
      .addCase(fetchFaqsAsync.pending, (state) => {
        state.status = 'loading';
        state.error  = null;
      })
      .addCase(fetchFaqsAsync.fulfilled, (state, action) => {
        state.status = 'success';
        state.items  = action.payload;
      })
      .addCase(fetchFaqsAsync.rejected, (state, action) => {
        state.status = 'error';
        state.error  = action.payload as string;
      })

      // createFaq
      .addCase(createFaqAsync.fulfilled, (state, action) => {
        state.items.push(action.payload);
      })

      // updateFaq
      .addCase(updateFaqAsync.fulfilled, (state, action) => {
        const idx = state.items.findIndex(f => f.id === action.payload.id);
        if (idx !== -1) state.items[idx] = action.payload;
      })

      // deleteFaq
      .addCase(deleteFaqAsync.fulfilled, (state, action) => {
        state.items = state.items.filter(f => f.id !== action.payload);
      });
  },
});

export default faqSlice.reducer;
