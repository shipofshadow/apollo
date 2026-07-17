export interface RouteSEO {
  title: string;
  description: string;
  image?: string;
}

export const ROUTE_SEO: Record<string, RouteSEO> = {
  '/': {
    title: '1625 Autolab',
    description: 'Automotive retrofitting, projector headlights, HID/LED conversion and car customization.',
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
    title: 'Order Inquiry | 1625 Autolab',
    description: 'Submit an order inquiry for retrofitting, lighting upgrades, and custom automotive work.',
  },
  '/calendar': {
    title: 'Calendar | 1625 Autolab',
    description: 'View upcoming appointments and booking availability for 1625 Autolab.',
  },
};

export const DEFAULT_SEO = ROUTE_SEO['/'];
