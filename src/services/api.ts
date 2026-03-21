import type { BookingPayload, Booking, FacebookPost } from '../types';

export const submitBooking = async (payload: BookingPayload): Promise<Booking> => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      // Simulate a 2-second network request
      // Randomly fail 10% of the time to show error handling
      if (Math.random() < 0.1) {
        reject(new Error('Failed to submit booking. Please try again.'));
      } else {
        const newBooking: Booking = {
          ...payload,
          id: Math.random().toString(36).substr(2, 9),
          status: 'pending',
          date: new Date().toISOString(),
        };
        resolve(newBooking);
      }
    }, 2000);
  });
};

export const fetchFacebookPosts = async (): Promise<FacebookPost[]> => {
  const accessToken = import.meta.env.VITE_FB_ACCESS_TOKEN as string | undefined;
  if (!accessToken) {
    throw new Error('Facebook access token is not configured.');
  }

  const fields = [
    'id',
    'message',
    'created_time',
    'full_picture',
    'attachments{description,media,url,subattachments}',
    'likes.summary(true).limit(0)',
    'comments.summary(true).limit(0)',
    'shares',
  ].join(',');

  const url = `https://graph.facebook.com/v25.0/me/posts?fields=${fields}`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error?.message ?? 'Failed to fetch Facebook posts.');
  }

  return (data.data ?? []) as FacebookPost[];
};
