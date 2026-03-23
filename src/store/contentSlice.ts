import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { BlogPost, BlogState } from '../types';
import {
  fetchBlogPostsApi,
  createBlogPostApi,
  updateBlogPostApi,
  deleteBlogPostApi,
} from '../services/api';

// Re-export for Admin.tsx compatibility
export type { BlogPost as ContentPost };

// ── Thunks ────────────────────────────────────────────────────────────────────

export const fetchBlogPostsAsync = createAsyncThunk(
  'content/fetchAll',
  async (token: string | null | undefined, { rejectWithValue }) => {
    try {
      const { posts } = await fetchBlogPostsApi(token);
      return posts;
    } catch (e: unknown) {
      return rejectWithValue((e as Error).message ?? 'Failed to load blog posts.');
    }
  }
);

export const createBlogPostAsync = createAsyncThunk(
  'content/create',
  async (
    arg: { token: string; data: { title: string; content: string; status: 'Draft' | 'Published' } },
    { rejectWithValue }
  ) => {
    try {
      const { post } = await createBlogPostApi(arg.token, arg.data);
      return post;
    } catch (e: unknown) {
      return rejectWithValue((e as Error).message ?? 'Failed to create blog post.');
    }
  }
);

export const updateBlogPostAsync = createAsyncThunk(
  'content/update',
  async (
    arg: { token: string; id: number; data: Partial<{ title: string; content: string; status: 'Draft' | 'Published' }> },
    { rejectWithValue }
  ) => {
    try {
      const { post } = await updateBlogPostApi(arg.token, arg.id, arg.data);
      return post;
    } catch (e: unknown) {
      return rejectWithValue((e as Error).message ?? 'Failed to update blog post.');
    }
  }
);

export const deleteBlogPostAsync = createAsyncThunk(
  'content/delete',
  async (arg: { token: string; id: number }, { rejectWithValue }) => {
    try {
      await deleteBlogPostApi(arg.token, arg.id);
      return arg.id;
    } catch (e: unknown) {
      return rejectWithValue((e as Error).message ?? 'Failed to delete blog post.');
    }
  }
);

// ── Slice ─────────────────────────────────────────────────────────────────────

const initialState: BlogState = {
  posts:  [],
  status: 'idle',
  error:  null,
};

const contentSlice = createSlice({
  name: 'content',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      // fetchAll
      .addCase(fetchBlogPostsAsync.pending, (state) => {
        state.status = 'loading';
        state.error  = null;
      })
      .addCase(fetchBlogPostsAsync.fulfilled, (state, action) => {
        state.status = 'success';
        state.posts  = action.payload;
      })
      .addCase(fetchBlogPostsAsync.rejected, (state, action) => {
        state.status = 'error';
        state.error  = action.payload as string;
      })

      // create
      .addCase(createBlogPostAsync.fulfilled, (state, action) => {
        state.posts.unshift(action.payload);
      })

      // update
      .addCase(updateBlogPostAsync.fulfilled, (state, action) => {
        const idx = state.posts.findIndex(p => p.id === action.payload.id);
        if (idx !== -1) state.posts[idx] = action.payload;
      })

      // delete
      .addCase(deleteBlogPostAsync.fulfilled, (state, action) => {
        state.posts = state.posts.filter(p => p.id !== action.payload);
      });
  },
});

export default contentSlice.reducer;
