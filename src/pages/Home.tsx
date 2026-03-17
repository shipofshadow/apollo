import Hero from '../components/Hero';
import ServicesGrid from '../components/ServicesGrid';
import PromoBanner from '../components/PromoBanner';
import RecentBuilds from '../components/RecentBuilds';
import FacebookFeed from '../components/FacebookFeed';
import Testimonials from '../components/Testimonials';

export default function Home() {
  return (
    <>
      <Hero />
      <ServicesGrid />
      <PromoBanner />
      <RecentBuilds />
      <Testimonials />
      <FacebookFeed />
    </>
  );
}
