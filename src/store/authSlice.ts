import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { AuthState, User } from '../types';
import {
  loginApi,
  registerApi,
  fetchMeApi,
  updateProfileApi,
  logoutApi,
} from '../services/api';

// ── localStorage helpers ──────────────────────────────────────────────────────

const TOKEN_KEY = 'apollo_token';
const USER_KEY  = 'apollo_user';

function saveToStorage(token: string, user: User): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch { /* storage unavailable */ }
}

function clearStorage(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  } catch { /* ignore */ }
}

function loadFromStorage(): { token: string | null; user: User | null } {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const raw   = localStorage.getItem(USER_KEY);
    if (!token || !raw) return { token: null, user: null };

    // Decode the JWT payload (middle segment) to check expiry without a lib
    const parts   = token.split('.');
    const payload = JSON.parse(atob(parts[1]));
    if ((payload.exp ?? 0) * 1000 < Date.now()) {
      clearStorage();
      return { token: null, user: null };
    }

    return { token, user: JSON.parse(raw) as User };
  } catch {
    return { token: null, user: null };
  }
}

// ── Thunks ────────────────────────────────────────────────────────────────────

export const loginAsync = createAsyncThunk(
  'auth/login',
  async (creds: { email: string; password: string }, { rejectWithValue }) => {
    try {
      return await loginApi(creds.email, creds.password);
    } catch (e: unknown) {
      return rejectWithValue((e as Error).message ?? 'Login failed.');
    }
  }
);

export const registerAsync = createAsyncThunk(
  'auth/register',
  async (
    data: { name: string; email: string; phone: string; password: string },
    { rejectWithValue }
  ) => {
    try {
      return await registerApi(data);
    } catch (e: unknown) {
      return rejectWithValue((e as Error).message ?? 'Registration failed.');
    }
  }
);

export const fetchMeAsync = createAsyncThunk(
  'auth/fetchMe',
  async (token: string, { rejectWithValue }) => {
    try {
      const { user } = await fetchMeApi(token);
      return user;
    } catch (e: unknown) {
      return rejectWithValue((e as Error).message ?? 'Failed to load profile.');
    }
  }
);

export const updateProfileAsync = createAsyncThunk(
  'auth/updateProfile',
  async (
    arg: {
      token: string;
      data: { name?: string; phone?: string; password?: string; password_confirmation?: string };
    },
    { rejectWithValue }
  ) => {
    try {
      const { user } = await updateProfileApi(arg.token, arg.data);
      return user;
    } catch (e: unknown) {
      return rejectWithValue((e as Error).message ?? 'Failed to update profile.');
    }
  }
);

export const logoutAsync = createAsyncThunk(
  'auth/logout',
  async (token: string) => {
    try { await logoutApi(token); } catch { /* ignore server error */ }
    clearStorage();
  }
);

// ── Slice ─────────────────────────────────────────────────────────────────────

const stored = loadFromStorage();

const initialState: AuthState = {
  user:   stored.user,
  token:  stored.token,
  status: 'idle',
  error:  null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearAuthError: (state) => { state.error = null; },
    clearAuth: (state) => {
      state.user  = null;
      state.token = null;
      state.status = 'idle';
      state.error  = null;
      clearStorage();
    },
  },
  extraReducers: (builder) => {
    // ── login ────────────────────────────────────────────────────────────
    builder.addCase(loginAsync.pending, (state) => {
      state.status = 'loading';
      state.error  = null;
    });
    builder.addCase(loginAsync.fulfilled, (state, action) => {
      state.status = 'success';
      state.token  = action.payload.token;
      state.user   = action.payload.user;
      saveToStorage(action.payload.token, action.payload.user);
    });
    builder.addCase(loginAsync.rejected, (state, action) => {
      state.status = 'error';
      state.error  = action.payload as string;
    });

    // ── register ─────────────────────────────────────────────────────────
    builder.addCase(registerAsync.pending, (state) => {
      state.status = 'loading';
      state.error  = null;
    });
    builder.addCase(registerAsync.fulfilled, (state, action) => {
      state.status = 'success';
      state.token  = action.payload.token;
      state.user   = action.payload.user;
      saveToStorage(action.payload.token, action.payload.user);
    });
    builder.addCase(registerAsync.rejected, (state, action) => {
      state.status = 'error';
      state.error  = action.payload as string;
    });

    // ── fetchMe ──────────────────────────────────────────────────────────
    builder.addCase(fetchMeAsync.fulfilled, (state, action) => {
      state.user = action.payload;
      if (state.token) saveToStorage(state.token, action.payload);
    });

    // ── updateProfile ─────────────────────────────────────────────────────
    builder.addCase(updateProfileAsync.pending, (state) => {
      state.status = 'loading';
      state.error  = null;
    });
    builder.addCase(updateProfileAsync.fulfilled, (state, action) => {
      state.status = 'success';
      state.user   = action.payload;
      if (state.token) saveToStorage(state.token, action.payload);
    });
    builder.addCase(updateProfileAsync.rejected, (state, action) => {
      state.status = 'error';
      state.error  = action.payload as string;
    });

    // ── logout ────────────────────────────────────────────────────────────
    builder.addCase(logoutAsync.fulfilled, (state) => {
      state.user   = null;
      state.token  = null;
      state.status = 'idle';
      state.error  = null;
    });
  },
});

export const { clearAuthError, clearAuth } = authSlice.actions;
export default authSlice.reducer;
