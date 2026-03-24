import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { Product, ProductState } from '../types';
import {
  fetchProductsApi,
  createProductApi,
  updateProductApi,
  deleteProductApi,
} from '../services/api';

// ── Thunks ────────────────────────────────────────────────────────────────────

export const fetchProductsAsync = createAsyncThunk(
  'products/fetchAll',
  async (token: string | null | undefined, { rejectWithValue }) => {
    try {
      const { products } = await fetchProductsApi(token);
      return products;
    } catch (e: unknown) {
      return rejectWithValue((e as Error).message ?? 'Failed to load products.');
    }
  }
);

export const createProductAsync = createAsyncThunk(
  'products/create',
  async (
    arg: { token: string; data: Partial<Omit<Product, 'id' | 'createdAt' | 'updatedAt'>> },
    { rejectWithValue }
  ) => {
    try {
      const { product } = await createProductApi(arg.token, arg.data);
      return product;
    } catch (e: unknown) {
      return rejectWithValue((e as Error).message ?? 'Failed to create product.');
    }
  }
);

export const updateProductAsync = createAsyncThunk(
  'products/update',
  async (
    arg: { token: string; id: number; data: Partial<Omit<Product, 'id' | 'createdAt' | 'updatedAt'>> },
    { rejectWithValue }
  ) => {
    try {
      const { product } = await updateProductApi(arg.token, arg.id, arg.data);
      return product;
    } catch (e: unknown) {
      return rejectWithValue((e as Error).message ?? 'Failed to update product.');
    }
  }
);

export const deleteProductAsync = createAsyncThunk(
  'products/delete',
  async (arg: { token: string; id: number }, { rejectWithValue }) => {
    try {
      await deleteProductApi(arg.token, arg.id);
      return arg.id;
    } catch (e: unknown) {
      return rejectWithValue((e as Error).message ?? 'Failed to delete product.');
    }
  }
);

// ── Slice ─────────────────────────────────────────────────────────────────────

const initialState: ProductState = {
  items:  [],
  status: 'idle',
  error:  null,
};

const productsSlice = createSlice({
  name: 'products',
  initialState,
  reducers: {
    resetProductsStatus: (state) => {
      state.status = 'idle';
      state.error  = null;
    },
  },
  extraReducers: (builder) => {
    // fetchAll
    builder
      .addCase(fetchProductsAsync.pending, (state) => {
        state.status = 'loading';
        state.error  = null;
      })
      .addCase(fetchProductsAsync.fulfilled, (state, action) => {
        state.status = 'success';
        state.items  = action.payload;
      })
      .addCase(fetchProductsAsync.rejected, (state, action) => {
        state.status = 'error';
        state.error  = action.payload as string;
      });

    // create
    builder
      .addCase(createProductAsync.pending, (state) => {
        state.status = 'loading';
        state.error  = null;
      })
      .addCase(createProductAsync.fulfilled, (state, action) => {
        state.status = 'success';
        state.items.push(action.payload);
      })
      .addCase(createProductAsync.rejected, (state, action) => {
        state.status = 'error';
        state.error  = action.payload as string;
      });

    // update
    builder
      .addCase(updateProductAsync.pending, (state) => {
        state.status = 'loading';
        state.error  = null;
      })
      .addCase(updateProductAsync.fulfilled, (state, action) => {
        state.status = 'success';
        const idx = state.items.findIndex(p => p.id === action.payload.id);
        if (idx !== -1) state.items[idx] = action.payload;
      })
      .addCase(updateProductAsync.rejected, (state, action) => {
        state.status = 'error';
        state.error  = action.payload as string;
      });

    // delete
    builder
      .addCase(deleteProductAsync.pending, (state) => {
        state.status = 'loading';
        state.error  = null;
      })
      .addCase(deleteProductAsync.fulfilled, (state, action) => {
        state.status = 'success';
        state.items  = state.items.filter(p => p.id !== action.payload);
      })
      .addCase(deleteProductAsync.rejected, (state, action) => {
        state.status = 'error';
        state.error  = action.payload as string;
      });
  },
});

export const { resetProductsStatus } = productsSlice.actions;
export default productsSlice.reducer;
