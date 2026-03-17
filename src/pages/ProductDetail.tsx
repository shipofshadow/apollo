import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Check } from 'lucide-react';

const products = [
  { 
    id: 'p1',
    name: 'RGB Demon Eyes Kit', 
    price: 149.99, 
    category: 'Lighting',
    img: 'https://images.unsplash.com/photo-1584345611124-287a5085e648?q=80&w=2015&auto=format&fit=crop',
    description: 'Add a menacing look to your headlights with our RGB Demon Eyes Kit. Control colors and patterns directly from your smartphone.',
    features: ['Bluetooth smartphone control', 'Millions of colors', 'Easy installation', 'Durable and heat-resistant']
  },
  { 
    id: 'p2',
    name: '10.1" Android Headunit', 
    price: 499.99, 
    category: 'Electronics',
    img: 'https://images.unsplash.com/photo-1533558701576-23c65e0272fb?q=80&w=1974&auto=format&fit=crop',
    description: 'Upgrade your infotainment system with this massive 10.1" Android headunit. Features wireless CarPlay and Android Auto.',
    features: ['10.1" IPS Touchscreen', 'Wireless Apple CarPlay & Android Auto', 'Built-in GPS navigation', 'DSP Audio Processing']
  },
  { 
    id: 'p3',
    name: 'Sequential LED Halos', 
    price: 199.99, 
    category: 'Lighting',
    img: 'https://images.unsplash.com/photo-1603386329225-868f9b1ee6c9?q=80&w=2069&auto=format&fit=crop',
    description: 'Custom sequential LED halos for a modern, aggressive front-end look. Features switchback turn signal functionality.',
    features: ['Sequential turn signals', 'Ultra-bright white DRL', 'Custom fit for various models', 'Waterproof drivers']
  },
  { 
    id: 'p4',
    name: 'Performance ECU Tune', 
    price: 599.99, 
    category: 'Performance',
    img: 'https://images.unsplash.com/photo-1503375815615-58532f627725?q=80&w=2070&auto=format&fit=crop',
    description: 'Unlock hidden horsepower and torque with our custom ECU tune. Optimized for your specific modifications.',
    features: ['Increased HP and Torque', 'Improved throttle response', 'Optimized air/fuel ratio', 'Reversible to stock']
  },
  { 
    id: 'p5',
    name: 'Custom Switch Panel', 
    price: 89.99, 
    category: 'Interior',
    img: 'https://images.unsplash.com/photo-1632823471565-1ec2a74b45b4?q=80&w=2070&auto=format&fit=crop',
    description: 'Clean up your interior wiring with this custom switch panel. Perfect for controlling auxiliary lighting and accessories.',
    features: ['Laser-cut aluminum panel', 'LED backlit switches', 'Pre-wired with relays', 'OEM-like fitment']
  },
  { 
    id: 'p6',
    name: '2-Way Paging Alarm', 
    price: 299.99, 
    category: 'Security',
    img: 'https://images.unsplash.com/photo-1600705722908-bab1e61c0b4d?q=80&w=2070&auto=format&fit=crop',
    description: 'Protect your investment with our advanced 2-way paging alarm system. Get real-time alerts on your LCD remote.',
    features: ['Up to 1-mile range', 'LCD 2-way remote', 'Shock and tilt sensors', 'Starter kill relay']
  },
];

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  
  const product = products.find(p => p.id === id);

  if (!product) {
    return (
      <div className="min-h-screen bg-brand-darker pt-32 pb-24 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-display font-black text-white mb-4">Product Not Found</h1>
          <Link to="/products" className="text-brand-orange hover:text-white transition-colors">
            Return to Products
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-32 pb-24 min-h-screen bg-brand-darker">
      <div className="container mx-auto px-4 md:px-6">
        <Link 
          to="/products" 
          className="inline-flex items-center gap-2 text-gray-400 hover:text-brand-orange transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Products
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Product Image */}
          <div className="relative aspect-square rounded-sm overflow-hidden border border-gray-800 group">
            <div className="absolute inset-0 bg-brand-orange/20 mix-blend-overlay z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <img 
              src={product.img} 
              alt={product.name}
              className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-700"
            />
          </div>

          {/* Product Info */}
          <div className="flex flex-col">
            <div className="mb-6">
              <span className="text-brand-orange font-bold uppercase tracking-widest text-sm block mb-2">
                {product.category}
              </span>
              <h1 className="text-4xl md:text-5xl font-display font-black text-white uppercase tracking-tighter mb-4">
                {product.name}
              </h1>
              <div className="text-3xl font-display font-bold text-white">
                ${product.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>

            <div className="prose prose-invert prose-orange max-w-none mb-8">
              <p className="text-gray-400 text-lg leading-relaxed">
                {product.description}
              </p>
            </div>

            {product.features && (
              <div className="mb-8">
                <h3 className="text-xl font-display font-bold text-white uppercase tracking-wider mb-4">
                  Key Features
                </h3>
                <ul className="space-y-3">
                  {product.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-3 text-gray-400">
                      <Check className="w-5 h-5 text-brand-orange shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
