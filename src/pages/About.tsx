import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Users, Shield, Zap, X, Mail, Phone, Facebook, Instagram, Loader2 } from 'lucide-react';
import { fetchTeamMembersAsync, fetchSiteSettingsAsync } from '../store/siteSettingsSlice';
import type { AppDispatch, RootState } from '../store';
import type { TeamMember } from '../types';

// Fallback team data used when the backend is not available
const FALLBACK_TEAM: TeamMember[] = [
  {
    id: 1,
    name: 'Alex "The Spark" Mercer',
    role: 'Master Retrofitter & Founder',
    imageUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=1974&auto=format&fit=crop',
    bio: 'With over 15 years of experience in automotive electronics, Alex founded 1625 Auto Lab to push the boundaries of custom lighting.',
    fullBio: 'Alex started his journey in his parents\' garage, fixing broken headlight seals and upgrading halogen bulbs. His obsession with perfection led him to master projector retrofitting and custom LED integration. Today, he oversees all major builds at 1625 Auto Lab, ensuring every vehicle leaves with a signature look and flawless functionality.',
    email: 'alex@1625autolab.com',
    phone: '0939 330 8263',
    facebook: null,
    instagram: null,
    sortOrder: 0,
    isActive: true,
    createdAt: '',
    updatedAt: '',
  },
  {
    id: 2,
    name: 'Sarah Chen',
    role: 'Lead Technician',
    imageUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=1976&auto=format&fit=crop',
    bio: 'Specializing in Android headunit integrations and complex wiring harnesses. Sarah ensures every install looks factory-perfect.',
    fullBio: 'Sarah holds a degree in Electrical Engineering and brings a meticulous approach to automotive wiring. She specializes in integrating modern Android headunits into older vehicles, ensuring steering wheel controls, backup cameras, and factory amplifiers work seamlessly. Her wiring harnesses are known for being cleaner than OEM.',
    email: 'sarah@1625autolab.com',
    phone: '0939 330 8264',
    facebook: null,
    instagram: null,
    sortOrder: 1,
    isActive: true,
    createdAt: '',
    updatedAt: '',
  },
];

const DEFAULT_SETTINGS = {
  about_heading:         'Built on Precision. Driven by Passion.',
  company_description_1: 'Founded in 2018, 1625 Auto Lab started as a small garage operation focused on fixing poorly done headlight retrofits. Today, we are Los Angeles\' premier destination for high-end automotive electronics and premium vehicle upgrades.',
  company_description_2: 'We believe that your vehicle is an extension of your personality. Our mission is to provide unparalleled craftsmanship, using only the highest quality components, to turn your automotive vision into reality.',
  about_image_url:       'https://images.unsplash.com/photo-1632823471565-1ec2a74b45b4?q=80&w=2070&auto=format&fit=crop',
};

export default function AboutPage() {
  const dispatch = useDispatch<AppDispatch>();
  const { members, settings, status } = useSelector((s: RootState) => s.siteSettings);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);

  useEffect(() => {
    dispatch(fetchTeamMembersAsync(null));
    dispatch(fetchSiteSettingsAsync());
  }, [dispatch]);

  // Only show fallback when we haven't successfully loaded from the backend yet
  const displayTeam = status === 'success' ? members : (members.length > 0 ? members : FALLBACK_TEAM);
  const heading     = settings.about_heading         || DEFAULT_SETTINGS.about_heading;
  const desc1       = settings.company_description_1 || DEFAULT_SETTINGS.company_description_1;
  const desc2       = settings.company_description_2 || DEFAULT_SETTINGS.company_description_2;
  const aboutImage  = settings.about_image_url       || DEFAULT_SETTINGS.about_image_url;

  return (
    <div className="pt-32 pb-24 min-h-screen bg-brand-darker relative">
      <div className="container mx-auto px-4 md:px-6">

        {/* Company Section */}
        <div className="mb-24">
          <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
            <span className="text-brand-orange font-bold uppercase tracking-widest text-sm">
              Our Story
            </span>
            <h1 className="text-4xl md:text-6xl font-display font-black text-white uppercase tracking-tighter">
              About <span className="text-brand-orange">The Company</span>
            </h1>
            <div className="w-24 h-1 bg-brand-orange mx-auto mt-6"></div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="bg-asphalt aspect-video rounded-sm overflow-hidden border border-gray-800 shadow-2xl">
              <img
                src={aboutImage}
                alt="1625 Auto Lab Garage"
                className="w-full h-full object-cover mix-blend-luminosity opacity-80"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="space-y-6">
              <h3 className="text-3xl font-display font-bold text-white uppercase tracking-wide whitespace-pre-line">
                {heading}
              </h3>
              <p className="text-gray-400 leading-relaxed text-lg">
                {desc1}
              </p>
              <p className="text-gray-400 leading-relaxed text-lg">
                {desc2}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-8 border-t border-gray-800">
                <div className="text-center">
                  <Shield className="w-8 h-8 text-brand-orange mx-auto mb-3" />
                  <h4 className="text-white font-bold uppercase tracking-wider text-sm">Quality First</h4>
                </div>
                <div className="text-center">
                  <Zap className="w-8 h-8 text-brand-orange mx-auto mb-3" />
                  <h4 className="text-white font-bold uppercase tracking-wider text-sm">Innovation</h4>
                </div>
                <div className="text-center">
                  <Users className="w-8 h-8 text-brand-orange mx-auto mb-3" />
                  <h4 className="text-white font-bold uppercase tracking-wider text-sm">Community</h4>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Teams Section */}
        <div>
          <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
            <span className="text-brand-orange font-bold uppercase tracking-widest text-sm">
              The Experts
            </span>
            <h2 className="text-4xl md:text-5xl font-display font-black text-white uppercase tracking-tighter">
              Meet <span className="text-brand-orange">The Team</span>
            </h2>
            <div className="w-24 h-1 bg-brand-orange mx-auto mt-6"></div>
          </div>

          {status === 'loading' && members.length === 0 && (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 text-brand-orange animate-spin" />
            </div>
          )}

          {(status !== 'loading' || members.length > 0) && (
            <div className={`grid grid-cols-1 ${displayTeam.length === 1 ? 'max-w-sm mx-auto' : displayTeam.length === 2 ? 'md:grid-cols-2 max-w-3xl mx-auto' : 'md:grid-cols-2 lg:grid-cols-3'} gap-8`}>
              {displayTeam.map((member) => (
                <div
                  key={member.id}
                  onClick={() => setSelectedMember(member)}
                  className="bg-brand-dark border border-gray-800 rounded-sm overflow-hidden group hover:border-brand-orange/50 transition-colors duration-300 cursor-pointer"
                >
                  <div className="aspect-square overflow-hidden bg-brand-gray">
                    {member.imageUrl ? (
                      <img
                        src={member.imageUrl}
                        alt={member.name}
                        className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500 scale-105 group-hover:scale-100"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-brand-orange/10">
                        <span className="text-brand-orange font-black text-6xl uppercase">
                          {member.name[0]}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="p-8">
                    <span className="text-brand-orange font-bold uppercase tracking-widest text-xs mb-2 block">
                      {member.role}
                    </span>
                    <h3 className="text-2xl font-display font-bold text-white uppercase tracking-wide mb-4">
                      {member.name}
                    </h3>
                    <p className="text-gray-400 leading-relaxed text-sm">
                      {member.bio}
                    </p>
                    <span className="inline-block mt-4 text-brand-orange text-sm font-bold uppercase tracking-widest group-hover:text-white transition-colors">
                      View Profile &rarr;
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* Team Member Modal */}
      {selectedMember && (
        <div className="fixed inset-0 z-[100] flex items-start sm:items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto" onClick={() => setSelectedMember(null)}>
          <div
            className="bg-brand-darker border border-gray-800 w-full max-w-3xl flex flex-col md:flex-row overflow-hidden rounded-sm relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedMember(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white z-10 bg-brand-darker/50 rounded-full p-1"
            >
              <X className="w-6 h-6" />
            </button>
            <div className="w-full md:w-2/5 aspect-square md:aspect-auto bg-brand-gray">
              {selectedMember.imageUrl ? (
                <img
                  src={selectedMember.imageUrl}
                  alt={selectedMember.name}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-brand-orange/10">
                  <span className="text-brand-orange font-black text-8xl uppercase">
                    {selectedMember.name[0]}
                  </span>
                </div>
              )}
            </div>
            <div className="w-full md:w-3/5 p-8 flex flex-col justify-center">
              <span className="text-brand-orange font-bold uppercase tracking-widest text-xs mb-2 block">
                {selectedMember.role}
              </span>
              <h3 className="text-3xl font-display font-bold text-white uppercase tracking-wide mb-6">
                {selectedMember.name}
              </h3>
              {selectedMember.fullBio && (
                <p className="text-gray-300 leading-relaxed mb-8">
                  {selectedMember.fullBio}
                </p>
              )}

              <div className="space-y-4 pt-6 border-t border-gray-800">
                {selectedMember.email && (
                  <div className="flex items-center gap-3 text-gray-400">
                    <Mail className="w-5 h-5 text-brand-orange" />
                    <a href={`mailto:${selectedMember.email}`} className="hover:text-white transition-colors">{selectedMember.email}</a>
                  </div>
                )}
                {selectedMember.phone && (
                  <div className="flex items-center gap-3 text-gray-400">
                    <Phone className="w-5 h-5 text-brand-orange" />
                    <a href={`tel:${selectedMember.phone}`} className="hover:text-white transition-colors">{selectedMember.phone}</a>
                  </div>
                )}
                {selectedMember.facebook && (
                  <div className="flex items-center gap-3 text-gray-400">
                    <Facebook className="w-5 h-5 text-brand-orange" />
                    <a href={selectedMember.facebook} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Facebook</a>
                  </div>
                )}
                {selectedMember.instagram && (
                  <div className="flex items-center gap-3 text-gray-400">
                    <Instagram className="w-5 h-5 text-brand-orange" />
                    <a href={selectedMember.instagram} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Instagram</a>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
