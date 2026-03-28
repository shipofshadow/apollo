import { configureStore } from '@reduxjs/toolkit';
import authReducer                from './authSlice';
import bookingReducer             from './bookingSlice';
import servicesReducer            from './servicesSlice';
import contentReducer             from './contentSlice';
import productsReducer            from './productsSlice';
import siteSettingsReducer        from './siteSettingsSlice';
import faqReducer                 from './faqSlice';
import portfolioReducer           from './portfolioSlice';
import portfolioCategoriesReducer from './portfolioCategoriesSlice';
import offersReducer              from './offersSlice';

export const store = configureStore({
  reducer: {
    auth:                authReducer,
    booking:             bookingReducer,
    services:            servicesReducer,
    content:             contentReducer,
    products:            productsReducer,
    siteSettings:        siteSettingsReducer,
    faq:                 faqReducer,
    portfolio:           portfolioReducer,
    portfolioCategories: portfolioCategoriesReducer,
    offers:              offersReducer,
  },
});

export type RootState   = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

