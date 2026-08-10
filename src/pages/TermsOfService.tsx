import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  FileText,
  ShieldAlert,
  Wrench,
  DollarSign,
  Car,
  Scale,
  CheckCircle2,
  Search,
  Printer,
  ChevronRight,
  Mail,
  Phone,
  MapPin,
  Clock,
  ShieldCheck,
  AlertTriangle,
  HelpCircle,
  Camera,
  RotateCcw,
} from 'lucide-react';
import PageSEO from '../components/PageSEO';

interface TermsSection {
  id: string;
  number: string;
  title: string;
  icon: React.ElementType;
  content: React.ReactNode;
  keywords: string[];
}

export default function TermsOfService() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSectionId, setActiveSectionId] = useState('section-1');

  const lastUpdated = 'August 10, 2026';
  const effectiveDate = 'August 10, 2026';

  const sections: TermsSection[] = useMemo(
    () => [
      {
        id: 'section-1',
        number: '01',
        title: 'Agreement & Acceptance of Terms',
        icon: Scale,
        keywords: ['agreement', 'acceptance', 'binding', 'contract', 'philippines', 'legal', '1625 autolab'],
        content: (
          <div className="space-y-4 text-gray-300 leading-relaxed">
            <p>
              These Terms of Service ("Terms", "Agreement") constitute a legally binding agreement between you ("Client", "User", "Customer") and <strong className="text-white">1625 Autolab</strong> ("Shop", "We", "Us", "Our"), located at KM 20 Ortigas Ave Ext., Cainta, Rizal, Philippines, 1900.
            </p>
            <p>
              By accessing or using our website, placing an online order, requesting automotive service quotes, reserving retrofitting slots, or entrusting your vehicle to our workshop for retrofitting, customization, or repair services, you acknowledge that you have read, understood, and agree to be bound by these Terms.
            </p>
            <div className="bg-brand-dark border-l-4 border-brand-orange p-4 rounded-r-sm space-y-2 text-sm">
              <div className="flex items-center gap-2 text-brand-orange font-bold uppercase tracking-wider text-xs">
                <Scale className="w-4 h-4" /> Governing Philippine Laws
              </div>
              <p className="text-gray-300">
                These Terms are formulated in compliance with the <strong className="text-white">Civil Code of the Philippines</strong>, Republic Act No. 7394 (<strong className="text-white">Consumer Act of the Philippines</strong>), and Republic Act No. 8792 (<strong className="text-white">Electronic Commerce Act of 2000</strong>).
              </p>
            </div>
          </div>
        ),
      },
      {
        id: 'section-2',
        number: '02',
        title: 'Automotive Retrofitting & Customization Services',
        icon: Wrench,
        keywords: ['services', 'retrofitting', 'headlights', 'projectors', 'led', 'halo', 'wiring', 'modifications', 'customization'],
        content: (
          <div className="space-y-4 text-gray-300 leading-relaxed">
            <p>
              1625 Autolab specializes in automotive headlight retrofitting, HID/LED projector conversions, custom ambient lighting, Android headunit installations, security systems, and custom auto modifications.
            </p>
            
            <div className="space-y-3">
              <div className="bg-brand-dark p-4 rounded-sm border border-gray-800">
                <h4 className="text-brand-orange font-bold text-sm mb-1 uppercase tracking-wide">A. Custom Modification Nature</h4>
                <p className="text-xs text-gray-400">
                  Client acknowledges that headlight retrofitting and custom vehicle upgrades involve disassembling factory headlight housings, cutting/shrouding internal reflectors, installing aftermarket components, and splicing electrical lines. While executed with maximum professional precision, these alterations alter original factory specifications.
                </p>
              </div>

              <div className="bg-brand-dark p-4 rounded-sm border border-gray-800">
                <h4 className="text-brand-orange font-bold text-sm mb-1 uppercase tracking-wide">B. Pre-Service Vehicle Diagnostic Check</h4>
                <p className="text-xs text-gray-400">
                  Prior to starting work, 1625 Autolab technicians perform a preliminary inspection of the vehicle's electrical system, existing headlight housing condition, lens clarity, and dashboard alerts. Existing defects, micro-cracks, faded lenses, or faulty wiring will be noted on the Job Order.
                </p>
              </div>

              <div className="bg-brand-dark p-4 rounded-sm border border-gray-800">
                <h4 className="text-brand-orange font-bold text-sm mb-1 uppercase tracking-wide">C. Turnaround Times & Work Duration</h4>
                <p className="text-xs text-gray-400">
                  Estimated completion times provided by 1625 Autolab are target estimates based on normal operating conditions. Complex retrofits, lens curing times, sealant drying periods, or unexpected vehicle wiring intricacies may extend completion timelines. We will communicate updates promptly.
                </p>
              </div>
            </div>
          </div>
        ),
      },
      {
        id: 'section-3',
        number: '03',
        title: 'Appointments, Booking Deposits & Cancellations',
        icon: Clock,
        keywords: ['booking', 'appointment', 'deposit', 'downpayment', 'cancellation', 'reschedule', 'slot'],
        content: (
          <div className="space-y-4 text-gray-300 leading-relaxed">
            <p>
              To ensure dedicated workshop space, technician allocation, and component staging, service appointments are subject to the following terms:
            </p>
            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-3 bg-brand-dark p-3.5 rounded-sm border border-gray-800">
                <CheckCircle2 className="w-4 h-4 text-brand-orange shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white block font-bold mb-0.5">Booking Downpayment / Slot Reservation Fee</strong>
                  <span className="text-xs text-gray-400">
                    A non-refundable reservation downpayment or part-staging fee may be required to lock in your scheduled retrofit slot or order specialty parts.
                  </span>
                </div>
              </li>

              <li className="flex items-start gap-3 bg-brand-dark p-3.5 rounded-sm border border-gray-800">
                <CheckCircle2 className="w-4 h-4 text-brand-orange shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white block font-bold mb-0.5">Rescheduling Policy</strong>
                  <span className="text-xs text-gray-400">
                    Clients may request to reschedule their appointment at least 24 to 48 hours prior to the booked slot without penalty, subject to slot availability.
                  </span>
                </div>
              </li>

              <li className="flex items-start gap-3 bg-brand-dark p-3.5 rounded-sm border border-gray-800">
                <CheckCircle2 className="w-4 h-4 text-brand-orange shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white block font-bold mb-0.5">No-Show & Late Arrival</strong>
                  <span className="text-xs text-gray-400">
                    Arriving more than 45 minutes late without notice may result in forfeiture of the reserved time slot to prevent delay to other queued vehicles.
                  </span>
                </div>
              </li>
            </ul>
          </div>
        ),
      },
      {
        id: 'section-4',
        number: '04',
        title: 'Pricing, Invoicing & Payment Terms',
        icon: DollarSign,
        keywords: ['pricing', 'payment', 'cash', 'gcash', 'bank transfer', 'receipt', 'invoice', 'taxes'],
        content: (
          <div className="space-y-4 text-gray-300 leading-relaxed">
            <p>
              All prices quoted on our website, service catalogue, or job estimates are in Philippine Pesos (PHP, ₱) and are inclusive of standard local taxes unless otherwise specified.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-brand-dark p-4 rounded-sm border border-gray-800">
                <h4 className="text-white font-bold text-sm mb-2">Accepted Payment Methods</h4>
                <ul className="text-xs text-gray-400 space-y-1.5">
                  <li>• Cash (in-shop payment upon completion)</li>
                  <li>• GCash / Maya Digital Wallet</li>
                  <li>• Bank Transfer (BDO, BPI, UnionBank)</li>
                  <li>• Credit / Debit Cards (via authorized terminal/gateway)</li>
                </ul>
              </div>

              <div className="bg-brand-dark p-4 rounded-sm border border-gray-800">
                <h4 className="text-white font-bold text-sm mb-2">Payment Upon Release</h4>
                <p className="text-xs text-gray-400">
                  Full payment of the balance is due prior to vehicle release or dispatch of ordered products. Official Receipts (OR) or Sales Invoices (SI) are issued upon full settlement.
                </p>
              </div>
            </div>
          </div>
        ),
      },
      {
        id: 'section-5',
        number: '05',
        title: 'Vehicle Drop-Off, Storage & Unclaimed Vehicles',
        icon: Car,
        keywords: ['vehicle', 'drop-off', 'pick-up', 'storage fee', 'unclaimed', 'liability', 'valuables'],
        content: (
          <div className="space-y-4 text-gray-300 leading-relaxed">
            <p>
              Clients leaving their vehicles at 1625 Autolab shop premises agree to the following vehicle care policies:
            </p>
            
            <div className="bg-brand-dark p-4 rounded-sm border border-gray-800 space-y-3 text-sm">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-brand-orange shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white block font-bold">Personal Property & Valuables Notice</strong>
                  <span className="text-xs text-gray-400">
                    Clients are requested to remove all personal valuables, cash, electronic gadgets, tools, and loose items from the vehicle prior to drop-off. 1625 Autolab is not liable for loss or theft of unattached personal items left inside the vehicle.
                  </span>
                </div>
              </div>
            </div>

            <p className="text-sm">
              <strong className="text-white">Vehicle Pick-Up & Storage Fees:</strong> Upon notification that retrofitting work is completed, clients must pick up their vehicle within three (3) calendar days. Starting on the fourth (4th) day after completion notification, a daily storage fee of ₱300/day may apply unless prior arrangements have been approved in writing.
            </p>
          </div>
        ),
      },
      {
        id: 'section-6',
        number: '06',
        title: 'Warranty Terms & Workmanship Guarantee',
        icon: ShieldCheck,
        keywords: ['warranty', 'guarantee', 'moisture', 'seal', 'led driver', 'workmanship', 'coverage', 'replacement'],
        content: (
          <div className="space-y-4 text-gray-300 leading-relaxed">
            <p>
              1625 Autolab takes pride in superior retrofitting craft. All custom retrofit work performed by our technicians is backed by our standard <strong className="text-white">Shop Workmanship & Moisture Warranty</strong>:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-brand-dark p-4 rounded-sm border border-gray-800">
                <h4 className="text-brand-orange font-bold text-sm mb-1">Moisture & Seal Warranty</h4>
                <p className="text-xs text-gray-400">
                  Covers headlight housing re-sealing against water intrusion, condensation, or seal failure for the specified warranty duration (e.g., 6 to 12 months per package).
                </p>
              </div>

              <div className="bg-brand-dark p-4 rounded-sm border border-gray-800">
                <h4 className="text-brand-orange font-bold text-sm mb-1">Component Warranty</h4>
                <p className="text-xs text-gray-400">
                  Projector lenses, LED drivers, HID ballasts, and bulbs carry manufacturer warranty coverage as indicated on your job order/receipt.
                </p>
              </div>

              <div className="bg-brand-dark p-4 rounded-sm border border-gray-800">
                <h4 className="text-brand-orange font-bold text-sm mb-1">Free Inspection</h4>
                <p className="text-xs text-gray-400">
                  Should minor condensation occur within the initial break-in period, bring the vehicle back for complimentary inspection and re-sealing.
                </p>
              </div>
            </div>

            <div className="bg-brand-dark/90 border border-red-500/30 p-4 rounded-sm space-y-2 text-xs">
              <div className="flex items-center gap-2 text-red-400 font-bold uppercase">
                <ShieldAlert className="w-4 h-4" /> Conditions That Void Warranty
              </div>
              <ul className="text-gray-400 space-y-1 list-disc list-inside">
                <li>Tampering, opening, or unauthorized modification by third-party shops or DIY attempts.</li>
                <li>Direct high-pressure power washer spraying into rubber breathers or housing seals.</li>
                <li>Physical impact, vehicular collision, road debris damage, or deep water flooding.</li>
                <li>Use of unrated bulbs, improper fuses, or unauthorized electrical modifications.</li>
              </ul>
            </div>
          </div>
        ),
      },
      {
        id: 'section-7',
        number: '07',
        title: 'Product Returns, Refunds & Replacement Policy',
        icon: RotateCcw,
        keywords: ['returns', 'refunds', 'replacement', 'consumer act', 'defective', 'parts', 'shipping'],
        content: (
          <div className="space-y-4 text-gray-300 leading-relaxed">
            <p>
              Pursuant to Republic Act No. 7394 (Consumer Act of the Philippines), clients are entitled to remedies for defective goods or non-conforming services:
            </p>
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2">
                <ChevronRight className="w-4 h-4 text-brand-orange shrink-0 mt-0.5" />
                <span><strong className="text-white">Defective Parts:</strong> Standalone products or parts purchased online or at the shop showing manufacturing defects within seven (7) days of purchase are eligible for direct replacement upon inspection.</span>
              </li>
              <li className="flex items-start gap-2">
                <ChevronRight className="w-4 h-4 text-brand-orange shrink-0 mt-0.5" />
                <span><strong className="text-white">Custom Labor:</strong> Once custom retrofitting labor has commenced or completed, labor charges are non-refundable. Defective installation will be rectified under warranty.</span>
              </li>
              <li className="flex items-start gap-2">
                <ChevronRight className="w-4 h-4 text-brand-orange shrink-0 mt-0.5" />
                <span><strong className="text-white">Proof of Purchase:</strong> Official Receipt or digital Job Order Reference is required for all warranty and return claims.</span>
              </li>
            </ul>
          </div>
        ),
      },
      {
        id: 'section-8',
        number: '08',
        title: 'Build Showcase Media & Photography Rights',
        icon: Camera,
        keywords: ['photos', 'showcase', 'social media', 'portfolio', 'builds', 'youtube', 'facebook', 'instagram'],
        content: (
          <div className="space-y-4 text-gray-300 leading-relaxed">
            <p>
              1625 Autolab regularly documents completed headlight retrofits and vehicle builds for our online portfolio, social media channels (Facebook, Instagram, YouTube), and website showcases.
            </p>
            <p className="text-sm">
              By entrusting your vehicle to 1625 Autolab, you grant us permission to photograph and record video of your vehicle's exterior and lighting setup for promotional and educational purposes. <strong className="text-white">We automatically blur or obscure vehicle license plates and conduction stickers</strong> prior to public publishing. If you prefer your vehicle not to be featured, please notify us during job order sign-off.
            </p>
          </div>
        ),
      },
      {
        id: 'section-9',
        number: '09',
        title: 'Limitation of Liability',
        icon: ShieldAlert,
        keywords: ['limitation', 'liability', 'indemnity', 'damages', 'force majeure', 'disclaimer'],
        content: (
          <div className="space-y-4 text-gray-300 leading-relaxed">
            <p>
              To the maximum extent permitted under applicable Philippine law, 1625 Autolab shall not be held liable for indirect, incidental, consequential, special, or punitive damages, including loss of vehicle use during retrofitting, car rental expenses, or pre-existing mechanical failures unrelated to our scope of work.
            </p>
            <p className="text-sm">
              <strong className="text-white">Force Majeure:</strong> Neither party shall be liable for service delays or failures caused by events beyond reasonable control, including natural disasters, typhoons, severe flooding, power grid outages, acts of government, or civil disruptions.
            </p>
          </div>
        ),
      },
      {
        id: 'section-10',
        number: '10',
        title: 'Intellectual Property Rights',
        icon: FileText,
        keywords: ['intellectual property', 'copyright', 'trademark', 'logo', 'assets', 'website'],
        content: (
          <div className="space-y-4 text-gray-300 leading-relaxed">
            <p>
              All content on the 1625 Autolab website—including logos, graphics, service titles, retrofitting guides, product photos, software code, design layouts, and brand assets—is the exclusive intellectual property of 1625 Autolab and protected under Philippine Intellectual Property laws (RA 8293). Unauthorized copying, reproduction, or redistribution is strictly prohibited.
            </p>
          </div>
        ),
      },
      {
        id: 'section-11',
        number: '11',
        title: 'Governing Law & Dispute Resolution',
        icon: Scale,
        keywords: ['governing law', 'jurisdiction', 'cainta', 'rizal', 'dispute resolution', 'courts', 'philippines'],
        content: (
          <div className="space-y-4 text-gray-300 leading-relaxed">
            <p>
              These Terms shall be governed by, construed, and enforced in accordance with the laws of the Republic of the Philippines.
            </p>
            <div className="bg-brand-dark p-5 rounded-sm border border-gray-800 text-sm space-y-2">
              <strong className="text-white block font-bold">Amicable Settlement & Jurisdiction</strong>
              <p className="text-xs text-gray-400">
                In the event of any dispute, claim, or disagreement arising from or relating to these Terms or services rendered, the parties agree to first seek an amicable resolution through good-faith negotiation. If unresolved, exclusive venue for any legal action shall lie in the proper courts of <strong className="text-white">Cainta, Rizal, Philippines</strong> or Pasig City, Metro Manila.
              </p>
            </div>
          </div>
        ),
      },
      {
        id: 'section-12',
        number: '12',
        title: 'Amendments & Contact Information',
        icon: HelpCircle,
        keywords: ['amendments', 'contact', 'address', 'phone', 'email', 'questions'],
        content: (
          <div className="space-y-4 text-gray-300 leading-relaxed">
            <p>
              1625 Autolab reserves the right to modify or replace these Terms of Service at any time. Material updates will be posted on this page with an updated "Last Updated" date.
            </p>
            <div className="bg-brand-dark p-5 rounded-sm border border-gray-800 text-sm space-y-3">
              <div className="font-bold text-white uppercase tracking-wider text-xs border-b border-gray-800 pb-2">
                Contact 1625 Autolab Management
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-gray-300">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-brand-orange shrink-0" />
                  <span>KM 20 Ortigas Ave Ext., Cainta, Rizal, PH</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-brand-orange shrink-0" />
                  <a href="mailto:1625autolab@gmail.com" className="text-brand-orange hover:underline break-all">
                    1625autolab@gmail.com
                  </a>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-brand-orange shrink-0" />
                  <span>0939 330 8263</span>
                </div>
              </div>
            </div>
          </div>
        ),
      },
    ],
    []
  );

  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return sections;
    const q = searchQuery.toLowerCase().trim();
    return sections.filter(
      (sec) =>
        sec.title.toLowerCase().includes(q) ||
        sec.keywords.some((k) => k.includes(q))
    );
  }, [sections, searchQuery]);

  const scrollToSection = (id: string) => {
    setActiveSectionId(id);
    const el = document.getElementById(id);
    if (el) {
      const offset = 100;
      const bodyRect = document.body.getBoundingClientRect().top;
      const elementRect = el.getBoundingClientRect().top;
      const elementPosition = elementRect - bodyRect;
      const offsetPosition = elementPosition - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth',
      });
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-brand-dark font-sans text-brand-light">
      <PageSEO
        title="Terms of Service"
        description="Read the official Terms of Service for 1625 Autolab governing automotive retrofitting services, bookings, warranty policies, vehicle care, and consumer rights under Philippine law."
        keywords="Terms of Service, 1625 Autolab Terms, Automotive Retrofitting Warranty, Consumer Rights Philippines, RA 7394, Vehicle Modification Rules"
      />

      {/* Hero Header */}
      <section className="bg-brand-darker border-b border-gray-800 pt-28 pb-16 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-brand-orange/5 rounded-full blur-3xl pointer-events-none" />
        <div className="container mx-auto px-4 md:px-6 relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 bg-brand-orange/10 border border-brand-orange/30 text-brand-orange px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest mb-6">
              <FileText className="w-4 h-4" /> Shop Policies & Terms
            </div>
            <h1 className="text-3xl sm:text-5xl md:text-6xl font-display font-black text-white uppercase tracking-tight leading-tight mb-6">
              Terms of <span className="text-brand-orange">Service</span>
            </h1>
            <p className="text-gray-400 text-base md:text-lg leading-relaxed max-w-3xl mx-auto mb-8">
              Guidelines, warranty terms, and service agreements governing our automotive retrofitting and customization services.
            </p>

            {/* Quick Metadata Bar */}
            <div className="flex flex-wrap items-center justify-center gap-6 pt-4 border-t border-gray-800/80 text-xs text-gray-400">
              <div>
                <span className="text-gray-500 uppercase font-bold tracking-wider">Effective Date:</span>{' '}
                <span className="text-gray-300 font-semibold">{effectiveDate}</span>
              </div>
              <div className="hidden sm:block text-gray-700">•</div>
              <div>
                <span className="text-gray-500 uppercase font-bold tracking-wider">Last Updated:</span>{' '}
                <span className="text-gray-300 font-semibold">{lastUpdated}</span>
              </div>
              <div className="hidden sm:block text-gray-700">•</div>
              <button
                onClick={handlePrint}
                className="inline-flex items-center gap-1.5 text-brand-orange hover:text-orange-400 transition-colors font-bold uppercase tracking-wider text-xs"
              >
                <Printer className="w-3.5 h-3.5" /> Print Terms
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Highlights Grid */}
      <section className="bg-brand-dark border-b border-gray-800 py-10">
        <div className="container mx-auto px-4 md:px-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-brand-darker border border-gray-800 p-4 rounded-sm flex items-start gap-4">
              <div className="w-10 h-10 rounded-sm bg-brand-orange/10 border border-brand-orange/30 flex items-center justify-center text-brand-orange shrink-0">
                <Wrench className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-white font-bold text-sm">Expert Retrofitting</h4>
                <p className="text-xs text-gray-400">Precision custom headlight and electrical work.</p>
              </div>
            </div>

            <div className="bg-brand-darker border border-gray-800 p-4 rounded-sm flex items-start gap-4">
              <div className="w-10 h-10 rounded-sm bg-brand-orange/10 border border-brand-orange/30 flex items-center justify-center text-brand-orange shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-white font-bold text-sm">Seal & Moisture Guarantee</h4>
                <p className="text-xs text-gray-400">Shop warranty protection for retrofitted housings.</p>
              </div>
            </div>

            <div className="bg-brand-darker border border-gray-800 p-4 rounded-sm flex items-start gap-4">
              <div className="w-10 h-10 rounded-sm bg-brand-orange/10 border border-brand-orange/30 flex items-center justify-center text-brand-orange shrink-0">
                <DollarSign className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-white font-bold text-sm">Transparent Billing</h4>
                <p className="text-xs text-gray-400">Official sales invoices & detailed job orders.</p>
              </div>
            </div>

            <div className="bg-brand-darker border border-gray-800 p-4 rounded-sm flex items-start gap-4">
              <div className="w-10 h-10 rounded-sm bg-brand-orange/10 border border-brand-orange/30 flex items-center justify-center text-brand-orange shrink-0">
                <Scale className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-white font-bold text-sm">Philippine Law</h4>
                <p className="text-xs text-gray-400">Governed by RA 7394 & Philippine Civil Code.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content Layout */}
      <section className="py-16">
        <div className="container mx-auto px-4 md:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            
            {/* Left Sticky Sidebar */}
            <div className="lg:col-span-4 space-y-6">
              <div className="bg-brand-darker border border-gray-800 p-6 rounded-sm sticky top-24 space-y-6">
                
                {/* Search input */}
                <div>
                  <label htmlFor="terms-search" className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                    Search Terms
                  </label>
                  <div className="relative">
                    <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      id="terms-search"
                      type="text"
                      placeholder="Search (e.g. warranty, deposit, storage)..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-brand-dark border border-gray-700 text-white pl-9 pr-4 py-2.5 rounded-sm text-sm focus:outline-none focus:border-brand-orange transition-colors placeholder:text-gray-500"
                    />
                  </div>
                  {searchQuery && (
                    <div className="flex justify-between items-center mt-2 text-xs">
                      <span className="text-gray-400">{filteredSections.length} result(s) found</span>
                      <button
                        onClick={() => setSearchQuery('')}
                        className="text-brand-orange hover:underline text-xs"
                      >
                        Clear search
                      </button>
                    </div>
                  )}
                </div>

                {/* Table of Contents */}
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-widest text-white border-b border-gray-800 pb-3 mb-4 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-brand-orange" /> Table of Contents
                  </h3>
                  <nav className="space-y-1 max-h-[60vh] overflow-y-auto pr-1">
                    {filteredSections.map((sec) => {
                      const isActive = activeSectionId === sec.id;
                      const Icon = sec.icon;
                      return (
                        <button
                          key={sec.id}
                          onClick={() => scrollToSection(sec.id)}
                          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-sm text-left transition-colors text-xs font-medium ${
                            isActive
                              ? 'bg-brand-orange/15 border-l-2 border-brand-orange text-white font-bold'
                              : 'text-gray-400 hover:text-white hover:bg-brand-dark'
                          }`}
                        >
                          <span className="flex items-center gap-2.5 truncate">
                            <span className="text-brand-orange font-mono text-[11px] shrink-0">{sec.number}</span>
                            <span className="truncate">{sec.title}</span>
                          </span>
                          <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-brand-orange' : 'text-gray-600'}`} />
                        </button>
                      );
                    })}
                    {filteredSections.length === 0 && (
                      <p className="text-xs text-gray-500 py-4 text-center">No matching sections found.</p>
                    )}
                  </nav>
                </div>

                {/* Privacy Policy Link Box */}
                <div className="pt-4 border-t border-gray-800">
                  <div className="bg-brand-dark p-4 rounded-sm border border-gray-800 space-y-2 text-xs">
                    <div className="font-bold text-white flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-brand-orange" /> Data Privacy Questions?
                    </div>
                    <p className="text-gray-400">
                      Learn how we handle your personal data under the Data Privacy Act of 2012.
                    </p>
                    <Link
                      to="/privacy-policy"
                      className="text-brand-orange hover:underline font-bold block pt-1"
                    >
                      View Privacy Policy &rarr;
                    </Link>
                  </div>
                </div>

              </div>
            </div>

            {/* Right Main Articles Panel */}
            <div className="lg:col-span-8 space-y-12">
              {filteredSections.map((sec) => {
                const Icon = sec.icon;
                return (
                  <article
                    key={sec.id}
                    id={sec.id}
                    className="bg-brand-darker border border-gray-800 rounded-sm p-6 md:p-8 scroll-mt-28 space-y-6 hover:border-gray-700/80 transition-colors"
                  >
                    <header className="flex items-start justify-between border-b border-gray-800 pb-5 gap-4">
                      <div className="flex items-center gap-3">
                        <span className="w-10 h-10 rounded-sm bg-brand-orange/10 border border-brand-orange/30 flex items-center justify-center text-brand-orange font-mono font-bold text-base shrink-0">
                          {sec.number}
                        </span>
                        <h2 className="text-xl md:text-2xl font-display font-bold text-white uppercase tracking-wide">
                          {sec.title}
                        </h2>
                      </div>
                      <Icon className="w-6 h-6 text-gray-600 shrink-0 hidden sm:block" />
                    </header>

                    <div>{sec.content}</div>
                  </article>
                );
              })}

              {/* Bottom Support Banner */}
              <div className="bg-gradient-to-r from-brand-darker via-brand-dark to-brand-darker border border-brand-orange/30 p-8 rounded-sm text-center space-y-4">
                <Wrench className="w-10 h-10 text-brand-orange mx-auto" />
                <h3 className="text-2xl font-display font-bold text-white uppercase tracking-wider">
                  Ready to Retrofit Your Vehicle?
                </h3>
                <p className="text-gray-400 text-sm max-w-xl mx-auto">
                  Have questions about our service packages, retrofitting warranties, or custom build options?
                </p>
                <div className="pt-2 flex flex-wrap items-center justify-center gap-4">
                  <Link
                    to="/booking"
                    className="inline-flex items-center gap-2 bg-brand-orange text-white px-6 py-3 font-bold uppercase tracking-wider text-xs hover:bg-orange-600 transition-colors rounded-sm"
                  >
                    Book an Appointment
                  </Link>
                  <Link
                    to="/contact"
                    className="inline-flex items-center gap-2 bg-brand-dark border border-gray-700 text-gray-300 px-6 py-3 font-bold uppercase tracking-wider text-xs hover:text-white hover:border-gray-500 transition-colors rounded-sm"
                  >
                    Contact Support
                  </Link>
                </div>
              </div>

            </div>

          </div>
        </div>
      </section>
    </div>
  );
}
