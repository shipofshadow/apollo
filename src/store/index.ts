import { configureStore } from '@reduxjs/toolkit';
import authReducer     from './authSlice';
import bookingReducer  from './bookingSlice';
import servicesReducer from './servicesSlice';
import contentReducer  from './contentSlice';

export const store = configureStore({
  reducer: {
    auth:     authReducer,
    booking:  bookingReducer,
    services: servicesReducer,
    content:  contentReducer,
  },
});

export type RootState   = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

