export const BACKEND_URL: string =
  (import.meta.env.VITE_BACKEND_URL as string | undefined) ?? 'http://localhost:8000';

/**
 * The URL Facebook should redirect back to after OAuth authorisation.
 * Must be registered as a "Valid OAuth Redirect URI" in your Facebook App.
 * Defaults to the current page origin + /admin for local development.
 */
export const FB_REDIRECT_URI: string =
  (import.meta.env.VITE_FB_REDIRECT_URI as string | undefined) ??
  (typeof window !== 'undefined' ? `${window.location.origin}/admin` : 'http://localhost:5173/admin');
