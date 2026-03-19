import { useParams, Link } from 'react-router-dom';
import { services } from '../components/ServicesGrid';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';

const serviceDetails: Record<string, { image: string; fullDescription: string; features: string[] }> = {
  '1': {
    image: 'https://images.unsplash.com/photo-1580273916550-e323be2ae537?q=80&w=1964&auto=format&fit=crop',
    fullDescription: 'Our headlight retrofitting service is where art meets engineering. We don\'t just install bulbs; we completely rebuild your headlight housings with state-of-the-art bi-LED or HID projectors. This ensures a razor-sharp cutoff line, massive width, and intense brightness without blinding oncoming traffic. We can customize the look with RGB demon eyes, sequential switchback halos, etched lenses, and custom paint matching.',
    features: ['Bi-LED & HID Projector Conversions', 'RGBW Demon Eyes & Halos', 'Custom Lens Etching', 'Housing Paint & Blackouts', 'Sequential Turn Signals', 'Moisture Sealing & Warranty']
  },
  '2': {
    image: 'https://images.unsplash.com/photo-1533558701576-23c65e0272fb?q=80&w=1974&auto=format&fit=crop',
    fullDescription: 'Upgrade your vehicle\'s infotainment system with our premium Android Headunit installations. We seamlessly integrate modern technology into older vehicles, providing you with wireless Apple CarPlay, Android Auto, GPS navigation, and access to thousands of apps via the Google Play Store. Our installations include custom-fitted bezels and wiring harnesses to retain steering wheel controls and factory cameras.',
    features: ['Wireless Apple CarPlay & Android Auto', 'High-Resolution IPS/OLED Touchscreens', 'Factory Steering Wheel Control Retention', 'Custom 3D Printed Bezels', 'Backup & 360 Camera Integration', 'DSP Audio Tuning']
  },
  '5': {
    image: 'https://images.unsplash.com/photo-1600705722908-bab1e61c0b4d?q=80&w=2070&auto=format&fit=crop',
    fullDescription: 'Protect your investment with our advanced security system installations. We go beyond basic alarms, offering comprehensive security solutions that deter theft and provide peace of mind. From hidden kill switches and GPS tracking modules to 2-way paging alarms with remote start capabilities, we customize the security setup to your specific vehicle and needs.',
    features: ['2-Way Paging Alarm Systems', 'Hidden Kill Switches', 'Real-Time GPS Tracking', 'Remote Engine Start', 'Tilt & Glass Break Sensors', 'Smartphone Integration']
  },
  '6': {
    image: 'https://images.unsplash.com/photo-1603386329225-868f9b1ee6c9?q=80&w=2069&auto=format&fit=crop',
    fullDescription: 'Transform the look and feel of your vehicle with our aesthetic upgrades. We offer a wide range of services to personalize your ride, both inside and out. From aggressive aftermarket grilles and aerodynamic splitters to premium interior ambient lighting and custom vinyl wrapping for trim pieces, we pay attention to the small details that make a big impact.',
    features: ['Custom Ambient Interior Lighting', 'Aftermarket Grille Installation', 'Interior Trim Vinyl Wrapping', 'Aero Kit & Splitter Installation', 'Custom Emblems & Badging', 'Caliper Painting']
  }
};

export default function ServiceDetail() {
  const { id } = useParams<{ id: string }>();
  const service = services.find(s => s.id === id);
  const details = id ? serviceDetails[id] : null;

  if (!service || !details) {
    return (
      <div className="pt-32 pb-24 min-h-screen bg-brand-darker flex flex-col items-center justify-center">
        <h1 className="text-4xl font-display font-bold text-white mb-4">Service Not Found</h1>
        <Link to="/services" className="text-brand-orange hover:text-white transition-colors">
          &larr; Back to Services
        </Link>
      </div>
    );
  }

  return (
    <div className="pt-32 pb-24 min-h-screen bg-brand-darker">
      <div className="container mx-auto px-4 md:px-6">
        <Link to="/services" className="inline-flex items-center gap-2 text-gray-400 hover:text-brand-orange transition-colors mb-8 font-bold uppercase tracking-widest text-sm">
          <ArrowLeft className="w-4 h-4" /> Back to Services
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Image */}
          <div className="bg-brand-dark border border-gray-800 rounded-sm overflow-hidden shadow-2xl shadow-brand-orange/5">
            <img 
              src={details.image} 
              alt={service.title} 
              className="w-full h-full object-cover aspect-video lg:aspect-square"
              referrerPolicy="no-referrer"
            />
          </div>

          {/* Content */}
          <div className="space-y-8">
            <div>
              <span className="text-brand-orange font-bold uppercase tracking-widest text-sm block mb-2">
                Service Details
              </span>
              <h1 className="text-4xl md:text-6xl font-display font-black text-white uppercase tracking-tighter mb-6">
                {service.title}
              </h1>
              <div className="w-20 h-1 bg-brand-orange mb-8"></div>
              <p className="text-gray-300 text-lg leading-relaxed">
                {details.fullDescription}
              </p>
            </div>

            <div className="bg-brand-gray/30 border border-gray-800 p-8 rounded-sm">
              <h3 className="text-2xl font-display font-bold text-white uppercase tracking-wide mb-6">
                Key Features & Benefits
              </h3>
              <ul className="space-y-4">
                {details.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <CheckCircle2 className="w-6 h-6 text-brand-orange shrink-0" />
                    <span className="text-gray-300">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="pt-8 border-t border-gray-800">
              <Link
                to="/booking"
                className="inline-block bg-brand-orange hover:bg-orange-600 text-white font-display uppercase tracking-wider px-8 py-4 rounded-sm transition-all transform hover:-translate-y-1 hover:shadow-[0_10px_20px_rgba(243,111,33,0.3)]"
              >
                Book This Service
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
