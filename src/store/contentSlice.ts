import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ContentPost {
  id: number;
  title: string;
  type: 'Blog' | 'Portfolio';
  content: string;
  status: 'Draft' | 'Published';
}

interface ContentState {
  posts: ContentPost[];
}

// ── Initial data ──────────────────────────────────────────────────────────────

const initialState: ContentState = {
  posts: [
    {
      id: 1,
      title: 'Honda BR-V 2017 Full Setup',
      type: 'Portfolio',
      content:
        'Equipped with X1 Bi-LED Projector Headlights and Tri-Color Foglights. Both with 6-8 years lifespan & 3 Years Warranty.',
      status: 'Published',
    },
    {
      id: 2,
      title: 'Why Upgrade Your Headlights?',
      type: 'Blog',
      content:
        'Upgrading your headlights is one of the best safety improvements you can make to your vehicle.',
      status: 'Draft',
    },
  ],
};

// ── Slice ─────────────────────────────────────────────────────────────────────

const contentSlice = createSlice({
  name: 'content',
  initialState,
  reducers: {
    addPost(state, action: PayloadAction<Omit<ContentPost, 'id'>>) {
      state.posts.push({ ...action.payload, id: Date.now() });
    },
    updatePost(state, action: PayloadAction<ContentPost>) {
      const idx = state.posts.findIndex(p => p.id === action.payload.id);
      if (idx !== -1) state.posts[idx] = action.payload;
    },
    deletePost(state, action: PayloadAction<number>) {
      state.posts = state.posts.filter(p => p.id !== action.payload);
    },
    toggleStatus(state, action: PayloadAction<number>) {
      const post = state.posts.find(p => p.id === action.payload);
      if (post) {
        post.status = post.status === 'Published' ? 'Draft' : 'Published';
      }
    },
  },
});

export const { addPost, updatePost, deletePost, toggleStatus } = contentSlice.actions;
export default contentSlice.reducer;
