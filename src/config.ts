export const BACKEND_URL: string =
  (import.meta.env.VITE_BACKEND_URL as string | undefined) ?? 'http://localhost:8000';

export const CHATBOT_API_URL: string =
  (import.meta.env.VITE_CHATBOT_API_URL as string | undefined) ?? 'http://localhost:8000';
