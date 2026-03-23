import { configureStore } from '@reduxjs/toolkit';
import bookingReducer from './bookingSlice';
import authReducer from './authSlice';

export const store = configureStore({
  reducer: {
    auth:    authReducer,
    booking: bookingReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
