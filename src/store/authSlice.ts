import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { AuthState, User } from '../types';
import {
  loginApi,
  registerApi,
  fetchMeApi,
  updateProfileApi,
  logoutApi,
  refreshTokenApi,
} from '../services/api';

// ── Storage helpers ───────────────────────────────────────────────────────────
//
// When "Remember Me" is checked  → credentials live in localStorage  (persist across restarts)
// When "Remember Me" is unchecked → credentials live in sessionStorage (cleared on tab close)
// The flag itself always lives in localStorage so we know which storage to read on reload.

const TOKEN_KEY        = 'apollo_token';
const REFRESH_TOKEN_KEY = 'apollo_refresh_token';
const USER_KEY         = 'apollo_user';
const REMEMBER_ME_KEY  = 'apollo_remember_me';

function saveToStorage(token: string, refreshToken: string, user: User, rememberMe: boolean): void {
  try {
    const store = rememberMe ? localStorage : sessionStorage;
    localStorage.setItem(REMEMBER_ME_KEY, rememberMe ? '1' : '0');
    store.setItem(TOKEN_KEY, token);
    store.setItem(REFRESH_TOKEN_KEY, refreshToken);
    store.setItem(USER_KEY, JSON.stringify(user));
  } catch { /* storage unavailable */ }
}

function clearStorage(): void {
  try {
    // Clear from both storages and remove the flag
    for (const key of [TOKEN_KEY, REFRESH_TOKEN_KEY, USER_KEY]) {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    }
    localStorage.removeItem(REMEMBER_ME_KEY);
  } catch { /* ignore */ }
}

function loadFromStorage(): { token: string | null; refreshToken: string | null; user: User | null } {
  try {
    // Determine which storage was used based on the persisted flag
    const remembered = localStorage.getItem(REMEMBER_ME_KEY) === '1';
    const store = remembered ? localStorage : sessionStorage;

    const token        = store.getItem(TOKEN_KEY);
    const refreshToken = store.getItem(REFRESH_TOKEN_KEY);
    const raw          = store.getItem(USER_KEY);

    if (!token || !raw) return { token: null, refreshToken: null, user: null };

    return { token, refreshToken, user: JSON.parse(raw) as User };
  } catch {
    return { token: null, refreshToken: null, user: null };
  }
}

// ── Thunks ────────────────────────────────────────────────────────────────────

export const loginAsync = createAsyncThunk(
  'auth/login',
  async (
    creds: { email: string; password: string; cfTurnstileToken: string; rememberMe?: boolean },
    { rejectWithValue }
  ) => {
    try {
      const result = await loginApi(creds.email, creds.password, creds.cfTurnstileToken, creds.rememberMe ?? false);
      return { ...result, rememberMe: creds.rememberMe ?? false };
    } catch (e: unknown) {
      return rejectWithValue((e as Error).message ?? 'Login failed.');
    }
  }
);

export const registerAsync = createAsyncThunk(
  'auth/register',
  async (
    data: { name: string; email: string; phone: string; password: string; cfTurnstileToken: string },
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
      data: { name?: string; email?: string; phone?: string; avatar_url?: string | null; password?: string; password_confirmation?: string };
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

export const refreshTokenAsync = createAsyncThunk(
  'auth/refreshToken',
  async (refreshToken: string, { rejectWithValue }) => {
    try {
      const { token: newToken, refresh_token: newRefreshToken } = await refreshTokenApi(refreshToken);
      return { token: newToken, refreshToken: newRefreshToken };
    } catch (e: unknown) {
      return rejectWithValue((e as Error).message ?? 'Token refresh failed.');
    }
  }
);

// ── Slice ─────────────────────────────────────────────────────────────────────

const stored = loadFromStorage();

const initialState: AuthState = {
  user: stored.user,
  token: stored.token,
  refreshToken: stored.refreshToken,
  status: 'idle',
  error: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearAuthError: (state) => { state.error = null; },
    clearAuth: (state) => {
      state.user = null;
      state.token = null;
      state.refreshToken = null;
      state.status = 'idle';
      state.error = null;
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
      state.refreshToken = (action.payload as any).refresh_token || null;
      state.user   = action.payload.user;

      const rememberMe = (action.payload as any).rememberMe ?? false;
      saveToStorage(action.payload.token, state.refreshToken || '', action.payload.user, rememberMe);
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
    builder.addCase(registerAsync.fulfilled, (state) => {
      state.status = 'success';
      state.error = null;
      state.token = null;
      state.refreshToken = null;
      state.user = null;
      clearStorage();
    });
    builder.addCase(registerAsync.rejected, (state, action) => {
      state.status = 'error';
      state.error  = action.payload as string;
    });

    // ── fetchMe ──────────────────────────────────────────────────────────
    builder.addCase(fetchMeAsync.fulfilled, (state, action) => {
      state.user = action.payload;
      const remembered = localStorage.getItem(REMEMBER_ME_KEY) === '1';
      if (state.token && state.refreshToken) saveToStorage(state.token, state.refreshToken, action.payload, remembered);
    });

    // ── updateProfile ─────────────────────────────────────────────────────
    builder.addCase(updateProfileAsync.pending, (state) => {
      state.status = 'loading';
      state.error  = null;
    });
    builder.addCase(updateProfileAsync.fulfilled, (state, action) => {
      state.status = 'success';
      state.user   = action.payload;
      const remembered = localStorage.getItem(REMEMBER_ME_KEY) === '1';
      if (state.token && state.refreshToken) saveToStorage(state.token, state.refreshToken, action.payload, remembered);
    });
    builder.addCase(updateProfileAsync.rejected, (state, action) => {
      state.status = 'error';
      state.error  = action.payload as string;
    });

    // ── logout ────────────────────────────────────────────────────────────
    builder.addCase(logoutAsync.fulfilled, (state) => {
      state.user       = null;
      state.token      = null;
      state.refreshToken = null;
      state.status     = 'idle';
      state.error      = null;
    });

    // ── refreshToken ────────────────────────────────────────────────────────
    builder.addCase(refreshTokenAsync.pending, (state) => {
      state.status = 'loading';
    });
    builder.addCase(refreshTokenAsync.fulfilled, (state, action) => {
      state.status = 'success';
      state.token = action.payload.token;
      state.refreshToken = action.payload.refreshToken;
      if (state.user) {
        const remembered = localStorage.getItem(REMEMBER_ME_KEY) === '1';
        saveToStorage(action.payload.token, action.payload.refreshToken, state.user, remembered);
      }
    });
    builder.addCase(refreshTokenAsync.rejected, (state, action) => {
      state.status = 'error';
      state.error = action.payload as string;
      state.user = null;
      state.token = null;
      state.refreshToken = null;
      clearStorage();
    });
  },
});

export const { clearAuthError, clearAuth } = authSlice.actions;
export default authSlice.reducer;
