export interface RouteSEO {
  title: string;
  description: string;
  image?: string;
  noindex?: boolean;
}

export const ROUTE_SEO: Record<string, RouteSEO> = {
  '/': {
    title: '1625 Autolab | Headlight Retrofit | Android Headunit',
    description: 'Specializing in custom headlight retrofit and android headunit. We don\'t just fix cars; we upgrade them.',
  },
  '/services': {
    title: 'Services | 1625 Autolab',
    description: 'Explore our full range of automotive retrofitting and lighting conversion services.',
  },
  '/products': {
    title: 'Products | 1625 Autolab',
    description: 'Browse our curated automotive lighting, upgrade, and customization products.',
  },
  '/portfolio': {
    title: 'Portfolio | 1625 Autolab',
    description: 'See our completed retrofit and customization projects from 1625 Autolab.',
  },
  '/booking': {
    title: 'Book an Appointment | 1625 Autolab',
    description: 'Schedule your headlight conversion, retrofit, or customization service with 1625 Autolab.',
  },
  '/blog': {
    title: 'Blog | 1625 Autolab',
    description: 'Read the latest automotive customization insights and project highlights from 1625 Autolab.',
  },
  '/about': {
    title: 'About Us | 1625 Autolab',
    description: 'Learn more about 1625 Autolab and our commitment to premium automotive upgrades.',
  },
  '/faq': {
    title: 'FAQ | 1625 Autolab',
    description: 'Find answers to common questions about services, bookings, and custom upgrades.',
  },
  '/contact': {
    title: 'Contact Us | 1625 Autolab',
    description: 'Get in touch with 1625 Autolab for bookings, inquiries, and consultations.',
  },
  '/order': {
    title: 'Schedule Request | 1625 Autolab',
    description: 'Submit an order inquiry for retrofitting, lighting upgrades, and custom automotive work.',
    image: 'https://cdn.1625autolab.com/1625autolab/logos/order.png'
  },
  '/calendar': {
    title: 'Calendar | 1625 Autolab',
    description: 'View upcoming appointments and booking availability for 1625 Autolab.',
  },
  // Private & Auth routes - not crawlable
  '/admin': {
    title: 'Admin Portal | 1625 Autolab',
    description: 'Admin portal for managing shop bookings, inquiries, and settings.',
    noindex: true,
  },
  '/client': {
    title: 'Client Portal | 1625 Autolab',
    description: 'Client dashboard for managing account bookings and vehicle records.',
    noindex: true,
  },
  '/login': {
    title: 'Sign In | 1625 Autolab',
    description: 'Log in to your 1625 Autolab account.',
    noindex: true,
  },
  '/register': {
    title: 'Create Account | 1625 Autolab',
    description: 'Sign up for a 1625 Autolab account.',
    noindex: true,
  },
  '/forgot-password': {
    title: 'Forgot Password | 1625 Autolab',
    description: 'Reset your 1625 Autolab account password.',
    noindex: true,
  },
  '/reset-password': {
    title: 'Reset Password | 1625 Autolab',
    description: 'Set a new password for your 1625 Autolab account.',
    noindex: true,
  },
};

export const DEFAULT_SEO = ROUTE_SEO['/'];

