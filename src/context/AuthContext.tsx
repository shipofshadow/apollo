/**
 * AuthContext
 *
 * Wraps the Redux auth slice behind a clean React context so that
 * every component can call `useAuth()` without touching Redux directly.
 *
 * Shape of the returned value:
 *
 *   const {
 *     // ── state ──────────────────────────────────────────
 *     user,            // User | null
 *     token,           // string | null
 *     isAuthenticated, // boolean
 *     isAdmin,         // boolean (role === 'admin')
 *     isClient,        // boolean (role === 'client')
 *     status,          // 'idle' | 'loading' | 'success' | 'error'
 *     error,           // string | null
 *
 *     // ── actions ────────────────────────────────────────
 *     login,           // (email, password) => Promise<void>  throws on failure
 *     register,        // (data)            => Promise<void>  throws on failure
 *     logout,          // ()                => Promise<void>
 *     updateProfile,   // (data)            => Promise<void>  throws on failure
 *     clearError,      // ()                => void
 *   } = useAuth();
 *
 * Wrap your tree once with <AuthProvider> (inside the Redux <Provider>):
 *
 *   <Provider store={store}>
 *     <Router>
 *       <AuthProvider>
 *         <App />
 *       </AuthProvider>
 *     </Router>
 *   </Provider>
 */

import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { User } from '../types';
import type { AppDispatch, RootState } from '../store';
import {
  loginAsync,
  registerAsync,
  logoutAsync,
  updateProfileAsync,
  clearAuthError,
  clearAuth,
} from '../store/authSlice';

// ── Context shape ─────────────────────────────────────────────────────────────

export interface AuthContextValue {
  // State
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isClient: boolean;
  status: 'idle' | 'loading' | 'success' | 'error';
  error: string | null;

  // Actions – all async methods throw on failure so callers can catch
  login: (email: string, password: string) => Promise<void>;
  register: (data: {
    name: string;
    email: string;
    phone: string;
    password: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (data: {
    name?: string;
    phone?: string;
    avatar_url?: string | null;
    password?: string;
    password_confirmation?: string;
  }) => Promise<void>;

  // Helpers
  clearError: () => void;
  forceSignOut: () => void; // clears state + storage without an API call
  hasPermission: (permission: string) => boolean;
}

// ── Context object ────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);
AuthContext.displayName = 'AuthContext';

// ── Provider ──────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const dispatch = useDispatch<AppDispatch>();
  const { user, token, status, error } = useSelector(
    (s: RootState) => s.auth
  );

  // ── Async action wrappers ─────────────────────────────────────────────────

  const login = async (email: string, password: string): Promise<void> => {
    const result = await dispatch(loginAsync({ email, password }));
    if (loginAsync.rejected.match(result)) {
      throw new Error((result.payload as string) ?? 'Login failed.');
    }
  };

  const register = async (data: {
    name: string;
    email: string;
    phone: string;
    password: string;
  }): Promise<void> => {
    const result = await dispatch(registerAsync(data));
    if (registerAsync.rejected.match(result)) {
      throw new Error((result.payload as string) ?? 'Registration failed.');
    }
  };

  const logout = async (): Promise<void> => {
    await dispatch(logoutAsync(token ?? ''));
  };

  const updateProfile = async (data: {
    name?: string;
    phone?: string;
    avatar_url?: string | null;
    password?: string;
    password_confirmation?: string;
  }): Promise<void> => {
    if (!token) throw new Error('Not authenticated.');
    const result = await dispatch(updateProfileAsync({ token, data }));
    if (updateProfileAsync.rejected.match(result)) {
      throw new Error((result.payload as string) ?? 'Failed to update profile.');
    }
  };

  const clearError = (): void => {
    dispatch(clearAuthError());
  };

  const forceSignOut = (): void => {
    dispatch(clearAuth());
  };

  const hasPermission = (permission: string): boolean => {
    if (!user) return false;
    if (user.role === 'admin') return true;
    return Array.isArray(user.permissions) && user.permissions.includes(permission);
  };

  // ── Memoised value ────────────────────────────────────────────────────────

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      isAuthenticated: user !== null,
      isAdmin: user?.role === 'admin',
      isClient: user?.role === 'client',
      status,
      error,
      login,
      register,
      logout,
      updateProfile,
      clearError,
      forceSignOut,
      hasPermission,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user, token, status, error]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ── Consumer hook ─────────────────────────────────────────────────────────────

/**
 * Returns the current auth context.
 * Must be called inside a component rendered within <AuthProvider>.
 */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth() must be called inside <AuthProvider>.');
  }
  return ctx;
}
