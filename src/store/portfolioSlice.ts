import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { PortfolioItem, PortfolioState } from '../types';
import {
  fetchPortfolioApi,
  createPortfolioItemApi,
  updatePortfolioItemApi,
  deletePortfolioItemApi,
} from '../services/api';

// ── Thunks ────────────────────────────────────────────────────────────────────

export const fetchPortfolioAsync = createAsyncThunk(
  'portfolio/fetchAll',
  async (token: string | null | undefined, { rejectWithValue }) => {
    try {
      const { portfolio } = await fetchPortfolioApi(token);
      return portfolio;
    } catch (e: unknown) {
      return rejectWithValue((e as Error).message ?? 'Failed to load portfolio.');
    }
  }
);

export const createPortfolioItemAsync = createAsyncThunk(
  'portfolio/create',
  async (
    arg: { token: string; data: Partial<Omit<PortfolioItem, 'id' | 'createdAt' | 'updatedAt'>> },
    { rejectWithValue }
  ) => {
    try {
      const { portfolioItem } = await createPortfolioItemApi(arg.token, arg.data);
      return portfolioItem;
    } catch (e: unknown) {
      return rejectWithValue((e as Error).message ?? 'Failed to create portfolio item.');
    }
  }
);

export const updatePortfolioItemAsync = createAsyncThunk(
  'portfolio/update',
  async (
    arg: { token: string; id: number; data: Partial<Omit<PortfolioItem, 'id' | 'createdAt' | 'updatedAt'>> },
    { rejectWithValue }
  ) => {
    try {
      const { portfolioItem } = await updatePortfolioItemApi(arg.token, arg.id, arg.data);
      return portfolioItem;
    } catch (e: unknown) {
      return rejectWithValue((e as Error).message ?? 'Failed to update portfolio item.');
    }
  }
);

export const deletePortfolioItemAsync = createAsyncThunk(
  'portfolio/delete',
  async (arg: { token: string; id: number }, { rejectWithValue }) => {
    try {
      await deletePortfolioItemApi(arg.token, arg.id);
      return arg.id;
    } catch (e: unknown) {
      return rejectWithValue((e as Error).message ?? 'Failed to delete portfolio item.');
    }
  }
);

// ── Slice ─────────────────────────────────────────────────────────────────────

const initialState: PortfolioState = {
  items:  [],
  status: 'idle',
  error:  null,
};

const portfolioSlice = createSlice({
  name: 'portfolio',
  initialState,
  reducers: {
    resetPortfolioStatus: (state) => {
      state.status = 'idle';
      state.error  = null;
    },
  },
  extraReducers: (builder) => {
    // fetchAll
    builder
      .addCase(fetchPortfolioAsync.pending, (state) => {
        state.status = 'loading';
        state.error  = null;
      })
      .addCase(fetchPortfolioAsync.fulfilled, (state, action) => {
        state.status = 'success';
        state.items  = action.payload;
      })
      .addCase(fetchPortfolioAsync.rejected, (state, action) => {
        state.status = 'error';
        state.error  = action.payload as string;
      });

    // create
    builder
      .addCase(createPortfolioItemAsync.pending, (state) => {
        state.status = 'loading';
        state.error  = null;
      })
      .addCase(createPortfolioItemAsync.fulfilled, (state, action) => {
        state.status = 'success';
        state.items.push(action.payload);
      })
      .addCase(createPortfolioItemAsync.rejected, (state, action) => {
        state.status = 'error';
        state.error  = action.payload as string;
      });

    // update
    builder
      .addCase(updatePortfolioItemAsync.pending, (state) => {
        state.status = 'loading';
        state.error  = null;
      })
      .addCase(updatePortfolioItemAsync.fulfilled, (state, action) => {
        state.status = 'success';
        const idx = state.items.findIndex(p => p.id === action.payload.id);
        if (idx !== -1) state.items[idx] = action.payload;
      })
      .addCase(updatePortfolioItemAsync.rejected, (state, action) => {
        state.status = 'error';
        state.error  = action.payload as string;
      });

    // delete
    builder
      .addCase(deletePortfolioItemAsync.pending, (state) => {
        state.status = 'loading';
        state.error  = null;
      })
      .addCase(deletePortfolioItemAsync.fulfilled, (state, action) => {
        state.status = 'success';
        state.items  = state.items.filter(p => p.id !== action.payload);
      })
      .addCase(deletePortfolioItemAsync.rejected, (state, action) => {
        state.status = 'error';
        state.error  = action.payload as string;
      });
  },
});

export const { resetPortfolioStatus } = portfolioSlice.actions;
export default portfolioSlice.reducer;
