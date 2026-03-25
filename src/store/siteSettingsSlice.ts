import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { SiteSettings, TeamMember, Testimonial } from '../types';
import {
  fetchSiteSettingsApi,
  updateSiteSettingsApi,
  fetchTeamMembersApi,
  createTeamMemberApi,
  updateTeamMemberApi,
  deleteTeamMemberApi,
  fetchTestimonialsApi,
  createTestimonialApi,
  updateTestimonialApi,
  deleteTestimonialApi,
} from '../services/api';

// ── State type ────────────────────────────────────────────────────────────────

interface SiteSettingsState {
  settings: SiteSettings;
  members: TeamMember[];
  testimonials: Testimonial[];
  status: 'idle' | 'loading' | 'success' | 'error';
  error: string | null;
}

const initialState: SiteSettingsState = {
  settings: {},
  members: [],
  testimonials: [],
  status: 'idle',
  error: null,
};

// ── Site Settings thunks ──────────────────────────────────────────────────────

export const fetchSiteSettingsAsync = createAsyncThunk(
  'siteSettings/fetchSettings',
  async (_: void, { rejectWithValue }) => {
    try {
      const { settings } = await fetchSiteSettingsApi();
      return settings;
    } catch (e: unknown) {
      return rejectWithValue((e as Error).message ?? 'Failed to load site settings.');
    }
  }
);

export const updateSiteSettingsAsync = createAsyncThunk(
  'siteSettings/updateSettings',
  async (arg: { token: string; data: SiteSettings }, { rejectWithValue }) => {
    try {
      const { settings } = await updateSiteSettingsApi(arg.token, arg.data);
      return settings;
    } catch (e: unknown) {
      return rejectWithValue((e as Error).message ?? 'Failed to update site settings.');
    }
  }
);

// ── Team Member thunks ────────────────────────────────────────────────────────

export const fetchTeamMembersAsync = createAsyncThunk(
  'siteSettings/fetchMembers',
  async (token: string | null | undefined, { rejectWithValue }) => {
    try {
      const { members } = await fetchTeamMembersApi(token);
      return members;
    } catch (e: unknown) {
      return rejectWithValue((e as Error).message ?? 'Failed to load team members.');
    }
  }
);

export const createTeamMemberAsync = createAsyncThunk(
  'siteSettings/createMember',
  async (
    arg: { token: string; data: Partial<Omit<TeamMember, 'id' | 'createdAt' | 'updatedAt'>> },
    { rejectWithValue }
  ) => {
    try {
      const { member } = await createTeamMemberApi(arg.token, arg.data);
      return member;
    } catch (e: unknown) {
      return rejectWithValue((e as Error).message ?? 'Failed to create team member.');
    }
  }
);

export const updateTeamMemberAsync = createAsyncThunk(
  'siteSettings/updateMember',
  async (
    arg: { token: string; id: number; data: Partial<Omit<TeamMember, 'id' | 'createdAt' | 'updatedAt'>> },
    { rejectWithValue }
  ) => {
    try {
      const { member } = await updateTeamMemberApi(arg.token, arg.id, arg.data);
      return member;
    } catch (e: unknown) {
      return rejectWithValue((e as Error).message ?? 'Failed to update team member.');
    }
  }
);

export const deleteTeamMemberAsync = createAsyncThunk(
  'siteSettings/deleteMember',
  async (arg: { token: string; id: number }, { rejectWithValue }) => {
    try {
      await deleteTeamMemberApi(arg.token, arg.id);
      return arg.id;
    } catch (e: unknown) {
      return rejectWithValue((e as Error).message ?? 'Failed to delete team member.');
    }
  }
);

// ── Testimonial thunks ────────────────────────────────────────────────────────

export const fetchTestimonialsAsync = createAsyncThunk(
  'siteSettings/fetchTestimonials',
  async (token: string | null | undefined, { rejectWithValue }) => {
    try {
      const { testimonials } = await fetchTestimonialsApi(token);
      return testimonials;
    } catch (e: unknown) {
      return rejectWithValue((e as Error).message ?? 'Failed to load testimonials.');
    }
  }
);

export const createTestimonialAsync = createAsyncThunk(
  'siteSettings/createTestimonial',
  async (
    arg: { token: string; data: Partial<Omit<Testimonial, 'id' | 'createdAt' | 'updatedAt'>> },
    { rejectWithValue }
  ) => {
    try {
      const { testimonial } = await createTestimonialApi(arg.token, arg.data);
      return testimonial;
    } catch (e: unknown) {
      return rejectWithValue((e as Error).message ?? 'Failed to create testimonial.');
    }
  }
);

export const updateTestimonialAsync = createAsyncThunk(
  'siteSettings/updateTestimonial',
  async (
    arg: { token: string; id: number; data: Partial<Omit<Testimonial, 'id' | 'createdAt' | 'updatedAt'>> },
    { rejectWithValue }
  ) => {
    try {
      const { testimonial } = await updateTestimonialApi(arg.token, arg.id, arg.data);
      return testimonial;
    } catch (e: unknown) {
      return rejectWithValue((e as Error).message ?? 'Failed to update testimonial.');
    }
  }
);

export const deleteTestimonialAsync = createAsyncThunk(
  'siteSettings/deleteTestimonial',
  async (arg: { token: string; id: number }, { rejectWithValue }) => {
    try {
      await deleteTestimonialApi(arg.token, arg.id);
      return arg.id;
    } catch (e: unknown) {
      return rejectWithValue((e as Error).message ?? 'Failed to delete testimonial.');
    }
  }
);

// ── Slice ─────────────────────────────────────────────────────────────────────

const siteSettingsSlice = createSlice({
  name: 'siteSettings',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      // ── fetchSettings
      .addCase(fetchSiteSettingsAsync.pending, (state) => {
        state.status = 'loading';
        state.error  = null;
      })
      .addCase(fetchSiteSettingsAsync.fulfilled, (state, action) => {
        state.status   = 'success';
        state.settings = action.payload;
      })
      .addCase(fetchSiteSettingsAsync.rejected, (state, action) => {
        state.status = 'error';
        state.error  = action.payload as string;
      })

      // ── updateSettings
      .addCase(updateSiteSettingsAsync.fulfilled, (state, action) => {
        state.settings = action.payload;
      })

      // ── fetchMembers
      .addCase(fetchTeamMembersAsync.pending, (state) => {
        state.status = 'loading';
        state.error  = null;
      })
      .addCase(fetchTeamMembersAsync.fulfilled, (state, action) => {
        state.status  = 'success';
        state.members = action.payload;
      })
      .addCase(fetchTeamMembersAsync.rejected, (state, action) => {
        state.status = 'error';
        state.error  = action.payload as string;
      })

      // ── createMember
      .addCase(createTeamMemberAsync.fulfilled, (state, action) => {
        state.members.push(action.payload);
      })

      // ── updateMember
      .addCase(updateTeamMemberAsync.fulfilled, (state, action) => {
        const idx = state.members.findIndex(m => m.id === action.payload.id);
        if (idx !== -1) state.members[idx] = action.payload;
      })

      // ── deleteMember
      .addCase(deleteTeamMemberAsync.fulfilled, (state, action) => {
        state.members = state.members.filter(m => m.id !== action.payload);
      })

      // ── fetchTestimonials
      .addCase(fetchTestimonialsAsync.pending, (state) => {
        state.status = 'loading';
        state.error  = null;
      })
      .addCase(fetchTestimonialsAsync.fulfilled, (state, action) => {
        state.status       = 'success';
        state.testimonials = action.payload;
      })
      .addCase(fetchTestimonialsAsync.rejected, (state, action) => {
        state.status = 'error';
        state.error  = action.payload as string;
      })

      // ── createTestimonial
      .addCase(createTestimonialAsync.fulfilled, (state, action) => {
        state.testimonials.push(action.payload);
      })

      // ── updateTestimonial
      .addCase(updateTestimonialAsync.fulfilled, (state, action) => {
        const idx = state.testimonials.findIndex(t => t.id === action.payload.id);
        if (idx !== -1) state.testimonials[idx] = action.payload;
      })

      // ── deleteTestimonial
      .addCase(deleteTestimonialAsync.fulfilled, (state, action) => {
        state.testimonials = state.testimonials.filter(t => t.id !== action.payload);
      });
  },
});

export default siteSettingsSlice.reducer;
