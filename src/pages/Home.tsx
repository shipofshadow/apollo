import { Link } from 'react-router-dom';
import { ArrowRight, CalendarClock, ShieldCheck, Sparkles } from 'lucide-react';
import Hero from '../components/Hero';
import ServicesGrid from '../components/ServicesGrid';
import PromoBanner from '../components/PromoBanner';
import RecentBuilds from '../components/RecentBuilds';
import FacebookFeed from '../components/FacebookFeed';
import Testimonials from '../components/Testimonials';
import HomeFaqSection from '../components/HomeFaqSection';

export default function Home() {
  return (
    <main className="bg-brand-dark">
      <Hero />

      <section className="relative border-y border-gray-800 bg-brand-darker/80">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_50%,rgba(243,111,33,0.12),transparent_45%),radial-gradient(circle_at_80%_50%,rgba(243,111,33,0.08),transparent_40%)]" />
        <div className="container mx-auto px-4 md:px-6 py-6 relative">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <a
              href="#services"
              className="group rounded-lg border border-gray-700 bg-brand-dark/70 px-4 py-4 transition-colors hover:border-brand-orange"
            >
              <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-brand-orange">
                <Sparkles className="h-4 w-4" /> Popular Upgrades
              </p>
              <p className="mt-2 text-sm text-gray-300 group-hover:text-white">
                Browse retrofit packages and core service options.
              </p>
            </a>

            <Link
              to="/booking"
              className="group rounded-lg border border-gray-700 bg-brand-dark/70 px-4 py-4 transition-colors hover:border-brand-orange"
            >
              <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-brand-orange">
                <CalendarClock className="h-4 w-4" /> Fast Booking
              </p>
              <p className="mt-2 text-sm text-gray-300 group-hover:text-white">
                Schedule your slot in minutes with live availability.
              </p>
            </Link>

            <a
              href="#builds"
              className="group rounded-lg border border-gray-700 bg-brand-dark/70 px-4 py-4 transition-colors hover:border-brand-orange"
            >
              <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-brand-orange">
                <ShieldCheck className="h-4 w-4" /> Real Build Proof
              </p>
              <p className="mt-2 text-sm text-gray-300 group-hover:text-white">
                See recent shop work, details, and finish quality.
              </p>
            </a>
          </div>
        </div>
      </section>

      <ServicesGrid />
      <PromoBanner />
      <RecentBuilds />
      <Testimonials />
      <HomeFaqSection />

      <section className="relative overflow-hidden border-y border-gray-800 bg-asphalt py-20">
        <div className="pointer-events-none absolute -left-16 top-1/2 h-64 w-64 -translate-y-1/2 rounded-full bg-brand-orange/15 blur-3xl" />
        <div className="pointer-events-none absolute -right-16 top-1/2 h-64 w-64 -translate-y-1/2 rounded-full bg-orange-300/10 blur-3xl" />
        <div className="container mx-auto px-4 md:px-6 relative">
          <div className="mx-auto max-w-4xl rounded-xl border border-gray-700 bg-brand-dark/80 p-8 text-center shadow-[0_10px_50px_rgba(0,0,0,0.35)] sm:p-10">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand-orange">Ready To Upgrade?</p>
            <h2 className="mt-3 text-3xl font-display font-black uppercase tracking-tight text-white sm:text-5xl">
              Build Your Ideal Setup
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-sm text-gray-300 sm:text-base">
              Share your vehicle and goals. We will recommend the right package for performance, style, and security.
            </p>

            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                to="/booking"
                className="inline-flex items-center justify-center gap-2 rounded-sm bg-brand-orange px-7 py-3 text-sm font-bold uppercase tracking-widest text-white transition-colors hover:bg-orange-600"
              >
                Start Booking
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/contact"
                className="inline-flex items-center justify-center gap-2 rounded-sm border border-gray-600 px-7 py-3 text-sm font-bold uppercase tracking-widest text-gray-200 transition-colors hover:border-white hover:text-white"
              >
                Talk To The Team
              </Link>
            </div>
          </div>
        </div>
      </section>

      <FacebookFeed />
    </main>
  );
}
