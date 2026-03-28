import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { PortfolioCategoryState } from '../types';
import {
  fetchPortfolioCategoriesApi,
  createPortfolioCategoryApi,
  updatePortfolioCategoryApi,
  deletePortfolioCategoryApi,
} from '../services/api';

// ── Thunks ────────────────────────────────────────────────────────────────────

export const fetchPortfolioCategoriesAsync = createAsyncThunk(
  'portfolioCategories/fetchAll',
  async (token: string | null | undefined, { rejectWithValue }) => {
    try {
      const { categories } = await fetchPortfolioCategoriesApi(token);
      return categories;
    } catch (e: unknown) {
      return rejectWithValue((e as Error).message ?? 'Failed to load categories.');
    }
  }
);

export const createPortfolioCategoryAsync = createAsyncThunk(
  'portfolioCategories/create',
  async (
    arg: { token: string; data: { name: string; sortOrder?: number } },
    { rejectWithValue }
  ) => {
    try {
      const { category } = await createPortfolioCategoryApi(arg.token, arg.data);
      return category;
    } catch (e: unknown) {
      return rejectWithValue((e as Error).message ?? 'Failed to create category.');
    }
  }
);

export const updatePortfolioCategoryAsync = createAsyncThunk(
  'portfolioCategories/update',
  async (
    arg: { token: string; id: number; data: { name?: string; sortOrder?: number } },
    { rejectWithValue }
  ) => {
    try {
      const { category } = await updatePortfolioCategoryApi(arg.token, arg.id, arg.data);
      return category;
    } catch (e: unknown) {
      return rejectWithValue((e as Error).message ?? 'Failed to update category.');
    }
  }
);

export const deletePortfolioCategoryAsync = createAsyncThunk(
  'portfolioCategories/delete',
  async (arg: { token: string; id: number }, { rejectWithValue }) => {
    try {
      await deletePortfolioCategoryApi(arg.token, arg.id);
      return arg.id;
    } catch (e: unknown) {
      return rejectWithValue((e as Error).message ?? 'Failed to delete category.');
    }
  }
);

// ── Slice ─────────────────────────────────────────────────────────────────────

const initialState: PortfolioCategoryState = {
  categories: [],
  status:     'idle',
  error:      null,
};

const portfolioCategoriesSlice = createSlice({
  name: 'portfolioCategories',
  initialState,
  reducers: {
    resetPortfolioCategoriesStatus: (state) => {
      state.status = 'idle';
      state.error  = null;
    },
  },
  extraReducers: (builder) => {
    // fetchAll
    builder
      .addCase(fetchPortfolioCategoriesAsync.pending, (state) => {
        state.status = 'loading';
        state.error  = null;
      })
      .addCase(fetchPortfolioCategoriesAsync.fulfilled, (state, action) => {
        state.status     = 'success';
        state.categories = action.payload;
      })
      .addCase(fetchPortfolioCategoriesAsync.rejected, (state, action) => {
        state.status = 'error';
        state.error  = action.payload as string;
      });

    // create
    builder
      .addCase(createPortfolioCategoryAsync.pending, (state) => {
        state.status = 'loading';
        state.error  = null;
      })
      .addCase(createPortfolioCategoryAsync.fulfilled, (state, action) => {
        state.status = 'success';
        state.categories.push(action.payload);
      })
      .addCase(createPortfolioCategoryAsync.rejected, (state, action) => {
        state.status = 'error';
        state.error  = action.payload as string;
      });

    // update
    builder
      .addCase(updatePortfolioCategoryAsync.pending, (state) => {
        state.status = 'loading';
        state.error  = null;
      })
      .addCase(updatePortfolioCategoryAsync.fulfilled, (state, action) => {
        state.status = 'success';
        const idx = state.categories.findIndex(c => c.id === action.payload.id);
        if (idx !== -1) state.categories[idx] = action.payload;
      })
      .addCase(updatePortfolioCategoryAsync.rejected, (state, action) => {
        state.status = 'error';
        state.error  = action.payload as string;
      });

    // delete
    builder
      .addCase(deletePortfolioCategoryAsync.pending, (state) => {
        state.status = 'loading';
        state.error  = null;
      })
      .addCase(deletePortfolioCategoryAsync.fulfilled, (state, action) => {
        state.status     = 'success';
        state.categories = state.categories.filter(c => c.id !== action.payload);
      })
      .addCase(deletePortfolioCategoryAsync.rejected, (state, action) => {
        state.status = 'error';
        state.error  = action.payload as string;
      });
  },
});

export const { resetPortfolioCategoriesStatus } = portfolioCategoriesSlice.actions;
export default portfolioCategoriesSlice.reducer;
