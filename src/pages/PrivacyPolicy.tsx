import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldCheck,
  Lock,
  FileText,
  Eye,
  UserCheck,
  CheckCircle2,
  Search,
  Printer,
  ChevronRight,
  Mail,
  Phone,
  MapPin,
  ExternalLink,
  Info,
  Scale,
  Database,
  Server,
  KeyRound,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import PageSEO from '../components/PageSEO';

interface PolicySection {
  id: string;
  number: string;
  title: string;
  icon: React.ElementType;
  content: React.ReactNode;
  keywords: string[];
}

export default function PrivacyPolicy() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSectionId, setActiveSectionId] = useState('section-1');

  const lastUpdated = 'August 10, 2026';
  const effectiveDate = 'August 10, 2026';

  const sections: PolicySection[] = useMemo(
    () => [
      {
        id: 'section-1',
        number: '01',
        title: 'Introduction & Statutory Legal Basis',
        icon: Scale,
        keywords: ['ra 10173', 'data privacy act', 'republic act', 'legal basis', 'philippines', 'national privacy commission', 'npc'],
        content: (
          <div className="space-y-4 text-gray-300 leading-relaxed">
            <p>
              Welcome to <strong className="text-white">1625 Autolab</strong> ("we," "our," or "us"). We are committed to protecting and respecting your personal privacy. This Privacy Policy sets out the principles and practices governing our collection, use, processing, storage, disclosure, and protection of your personal data when you visit our website, utilize our automotive retrofitting and customization services, create a client account, submit inquiries, or make purchases.
            </p>
            <div className="bg-brand-dark border-l-4 border-brand-orange p-4 rounded-r-sm space-y-2">
              <div className="flex items-center gap-2 text-brand-orange font-bold uppercase tracking-wider text-xs">
                <ShieldCheck className="w-4 h-4" /> Compliance Mandate
              </div>
              <p className="text-sm text-gray-300">
                This policy is formulated in strict compliance with <strong className="text-white">Republic Act No. 10173</strong>, otherwise known as the <strong className="text-white">Data Privacy Act of 2012 (DPA 2012)</strong> of the Republic of the Philippines, its Implementing Rules and Regulations (IRR), and all applicable circulars issued by the <strong className="text-white">National Privacy Commission (NPC)</strong>.
              </p>
            </div>
            <p>
              By accessing our website, booking an appointment, inquiring about headlight retrofitting or vehicle modifications, or providing personal data to 1625 Autolab through online or offline channels, you acknowledge that you have read, understood, and consented to the collection and processing of your personal data as described herein.
            </p>
          </div>
        ),
      },
      {
        id: 'section-2',
        number: '02',
        title: 'Core Data Privacy Principles (RA 10173)',
        icon: Eye,
        keywords: ['transparency', 'legitimate purpose', 'proportionality', 'principles', 'fairness', 'lawfulness'],
        content: (
          <div className="space-y-4 text-gray-300 leading-relaxed">
            <p>
              In accordance with Section 11 of Republic Act No. 10173, 1625 Autolab adheres strictly to the three fundamental principles of data privacy:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-6">
              <div className="bg-brand-dark p-5 rounded-sm border border-gray-800 hover:border-gray-700 transition-colors">
                <div className="w-10 h-10 rounded-full bg-brand-orange/10 flex items-center justify-center text-brand-orange mb-3">
                  <Eye className="w-5 h-5" />
                </div>
                <h4 className="text-white font-bold mb-2">1. Transparency</h4>
                <p className="text-xs text-gray-400 leading-normal">
                  Data subjects are informed of the nature, purpose, and extent of the processing of their personal data prior to or during collection.
                </p>
              </div>

              <div className="bg-brand-dark p-5 rounded-sm border border-gray-800 hover:border-gray-700 transition-colors">
                <div className="w-10 h-10 rounded-full bg-brand-orange/10 flex items-center justify-center text-brand-orange mb-3">
                  <FileText className="w-5 h-5" />
                </div>
                <h4 className="text-white font-bold mb-2">2. Legitimate Purpose</h4>
                <p className="text-xs text-gray-400 leading-normal">
                  Personal data is processed strictly for declared, specified, and legitimate business purposes (e.g., retrofitting work, billing, warranty).
                </p>
              </div>

              <div className="bg-brand-dark p-5 rounded-sm border border-gray-800 hover:border-gray-700 transition-colors">
                <div className="w-10 h-10 rounded-full bg-brand-orange/10 flex items-center justify-center text-brand-orange mb-3">
                  <Scale className="w-5 h-5" />
                </div>
                <h4 className="text-white font-bold mb-2">3. Proportionality</h4>
                <p className="text-xs text-gray-400 leading-normal">
                  Processing is limited to data that is relevant, adequate, and necessary for the stated purpose. Excessive data collection is avoided.
                </p>
              </div>
            </div>
          </div>
        ),
      },
      {
        id: 'section-3',
        number: '03',
        title: 'Information We Collect',
        icon: Database,
        keywords: ['collection', 'personal data', 'vehicle details', 'phone number', 'email', 'name', 'address', 'payment', 'inquiries'],
        content: (
          <div className="space-y-4 text-gray-300 leading-relaxed">
            <p>
              To deliver high-quality automotive retrofitting, customization services, and support, 1625 Autolab collects the following categories of personal and technical data:
            </p>
            <div className="space-y-3">
              <div className="bg-brand-dark p-4 rounded-sm border border-gray-800">
                <h4 className="text-brand-orange font-bold text-sm mb-1 uppercase tracking-wide">A. Personal Identification Data</h4>
                <p className="text-sm text-gray-300">
                  Full name, email address, mobile phone number, telephone number, mailing address, garage/billing location, and user account credentials (username, encrypted password).
                </p>
              </div>

              <div className="bg-brand-dark p-4 rounded-sm border border-gray-800">
                <h4 className="text-brand-orange font-bold text-sm mb-1 uppercase tracking-wide">B. Vehicle & Retrofit Specifications</h4>
                <p className="text-sm text-gray-300">
                  Vehicle Make, Model, Year, Body Style, License Plate / Conduction Sticker number, existing headlight configuration, custom build preferences, and vehicle photos submitted for consultation or showcase.
                </p>
              </div>

              <div className="bg-brand-dark p-4 rounded-sm border border-gray-800">
                <h4 className="text-brand-orange font-bold text-sm mb-1 uppercase tracking-wide">C. Transactional & Service Records</h4>
                <p className="text-sm text-gray-300">
                  Booking appointment schedules, service order history, job quotes, invoice/receipt details, parts installed, warranty claims, and communication history (inquiry tickets, live chat, email logs).
                </p>
              </div>

              <div className="bg-brand-dark p-4 rounded-sm border border-gray-800">
                <h4 className="text-brand-orange font-bold text-sm mb-1 uppercase tracking-wide">D. Technical & Usage Data</h4>
                <p className="text-sm text-gray-300">
                  IP address, browser type, operating system, referrer URL, pages visited, session duration, Cloudflare Turnstile anti-bot verification tokens, and browser cookies.
                </p>
              </div>
            </div>
          </div>
        ),
      },
      {
        id: 'section-4',
        number: '04',
        title: 'Purposes of Data Processing',
        icon: UserCheck,
        keywords: ['purpose', 'processing', 'booking', 'orders', 'notifications', 'customer service', 'marketing', 'warranty'],
        content: (
          <div className="space-y-4 text-gray-300 leading-relaxed">
            <p>
              Your personal data is collected and processed exclusively for the following specified, legitimate business purposes:
            </p>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              {[
                'Scheduling, managing, and fulfilling retrofitting and installation appointments.',
                'Processing online product orders, cart items, checkout transactions, and issuing receipts.',
                'Maintaining customer vehicle records ("My Garage") to streamline future upgrades and warranty servicing.',
                'Sending automated SMS and email notifications regarding booking updates, job completion, and reminders.',
                'Providing customer support, answering technical inquiries, and managing inquiry reference numbers.',
                'Protecting website security against spam, bot abuse, fraudulent transactions, and unauthorized access.',
                'Complying with statutory, tax, legal, and accounting requirements under Philippine law.',
                'Improving our website performance, service catalogue, and user experience through anonymized analytics.',
              ].map((item, idx) => (
                <li key={idx} className="flex items-start gap-3 bg-brand-dark p-3 rounded-sm border border-gray-800/80">
                  <CheckCircle2 className="w-4 h-4 text-brand-orange shrink-0 mt-0.5" />
                  <span className="text-gray-300">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        ),
      },
      {
        id: 'section-5',
        number: '05',
        title: 'Data Protection & Security Measures',
        icon: Lock,
        keywords: ['security', 'protection', 'encryption', 'tls', 'ssl', 'storage', 'retention', 'access control'],
        content: (
          <div className="space-y-4 text-gray-300 leading-relaxed">
            <p>
              Section 20 of RA 10173 mandates the implementation of reasonable and appropriate organizational, physical, and technical measures to protect personal data against accidental or unlawful destruction, alteration, disclosure, or unauthorized access.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-4">
              <div className="bg-brand-dark p-4 rounded-sm border border-gray-800 space-y-2">
                <div className="flex items-center gap-2 text-white font-bold text-sm">
                  <KeyRound className="w-4 h-4 text-brand-orange" /> Technical Safeguards
                </div>
                <p className="text-xs text-gray-400">
                  We employ SSL/TLS end-to-end encryption for all web communications, database password hashing (bcrypt/argon2), secure token-based session management, restricted API access, and regular security patching.
                </p>
              </div>

              <div className="bg-brand-dark p-4 rounded-sm border border-gray-800 space-y-2">
                <div className="flex items-center gap-2 text-white font-bold text-sm">
                  <Server className="w-4 h-4 text-brand-orange" /> Organizational Safeguards
                </div>
                <p className="text-xs text-gray-400">
                  Access to client records and personal data is strictly role-restricted to authorized 1625 Autolab technicians and administrative personnel who are bound by confidentiality agreements.
                </p>
              </div>
            </div>
            <p className="text-sm">
              <strong className="text-white">Data Retention:</strong> We retain your personal data only for as long as necessary to fulfill the purposes for which it was collected, or as required by applicable Philippine tax and accounting laws (typically up to 5 to 10 years for financial records). Upon expiration of the retention period, data is securely anonymized or permanently destroyed.
            </p>
          </div>
        ),
      },
      {
        id: 'section-6',
        number: '06',
        title: 'Data Sharing & Third-Party Disclosures',
        icon: Server,
        keywords: ['sharing', 'third party', 'disclosure', 'subcontractors', 'payment processors', 'legal requirement'],
        content: (
          <div className="space-y-4 text-gray-300 leading-relaxed">
            <p>
              <strong className="text-white">1625 Autolab does not sell, rent, trade, or monetize your personal data to third-party marketers.</strong>
            </p>
            <p>
              We may disclose personal data to trusted third-party service providers and processors solely for essential operational purposes under strict Data Sharing Agreements compliant with RA 10173:
            </p>
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2">
                <ChevronRight className="w-4 h-4 text-brand-orange shrink-0 mt-0.5" />
                <span><strong className="text-white">Payment & Gateway Processors:</strong> To verify payments, process bank transfers, or handle digital wallet transactions.</span>
              </li>
              <li className="flex items-start gap-2">
                <ChevronRight className="w-4 h-4 text-brand-orange shrink-0 mt-0.5" />
                <span><strong className="text-white">SMS & Email Service Providers:</strong> To dispatch automated booking reminders, order receipts, and inquiry notifications.</span>
              </li>
              <li className="flex items-start gap-2">
                <ChevronRight className="w-4 h-4 text-brand-orange shrink-0 mt-0.5" />
                <span><strong className="text-white">Security & Anti-Bot Infrastructure:</strong> Cloudflare Turnstile for securing public forms against automated attacks.</span>
              </li>
              <li className="flex items-start gap-2">
                <ChevronRight className="w-4 h-4 text-brand-orange shrink-0 mt-0.5" />
                <span><strong className="text-white">Legal Mandates & Law Enforcement:</strong> When required by Philippine court orders, law enforcement requests, or valid subpoenas pursuant to Philippine laws.</span>
              </li>
            </ul>
          </div>
        ),
      },
      {
        id: 'section-7',
        number: '07',
        title: 'Data Subject Rights Under RA 10173',
        icon: ShieldCheck,
        keywords: ['rights', 'data subject rights', 'access', 'object', 'erasure', 'rectification', 'damages', 'portability', 'complaint'],
        content: (
          <div className="space-y-6 text-gray-300 leading-relaxed">
            <p>
              Under Chapter IV of the Data Privacy Act of 2012 (RA 10173), you are guaranteed the following statutory rights as a Data Subject. You may exercise any of these rights by contacting our Data Protection Officer:
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-brand-dark p-4 rounded-sm border border-gray-800">
                <div className="flex items-center gap-2 text-brand-orange font-bold text-sm mb-2">
                  <span className="w-6 h-6 rounded-full bg-brand-orange/20 flex items-center justify-center text-xs text-brand-orange">1</span>
                  Right to be Informed
                </div>
                <p className="text-xs text-gray-400">
                  You have the right to be informed whether your personal data will be, is being, or was processed, including information on automated decision-making and profiling.
                </p>
              </div>

              <div className="bg-brand-dark p-4 rounded-sm border border-gray-800">
                <div className="flex items-center gap-2 text-brand-orange font-bold text-sm mb-2">
                  <span className="w-6 h-6 rounded-full bg-brand-orange/20 flex items-center justify-center text-xs text-brand-orange">2</span>
                  Right to Access
                </div>
                <p className="text-xs text-gray-400">
                  You have the right to request reasonable access to your personal data, sources of data, recipients, processing methods, and data modification history.
                </p>
              </div>

              <div className="bg-brand-dark p-4 rounded-sm border border-gray-800">
                <div className="flex items-center gap-2 text-brand-orange font-bold text-sm mb-2">
                  <span className="w-6 h-6 rounded-full bg-brand-orange/20 flex items-center justify-center text-xs text-brand-orange">3</span>
                  Right to Object
                </div>
                <p className="text-xs text-gray-400">
                  You have the right to object to the processing of your personal data, including processing for direct marketing, automated profiling, or direct consent revocation.
                </p>
              </div>

              <div className="bg-brand-dark p-4 rounded-sm border border-gray-800">
                <div className="flex items-center gap-2 text-brand-orange font-bold text-sm mb-2">
                  <span className="w-6 h-6 rounded-full bg-brand-orange/20 flex items-center justify-center text-xs text-brand-orange">4</span>
                  Right to Erasure or Blocking
                </div>
                <p className="text-xs text-gray-400">
                  You have the right to suspend, withdraw, or order the blocking, removal, or destruction of your personal data from our systems upon valid statutory grounds.
                </p>
              </div>

              <div className="bg-brand-dark p-4 rounded-sm border border-gray-800">
                <div className="flex items-center gap-2 text-brand-orange font-bold text-sm mb-2">
                  <span className="w-6 h-6 rounded-full bg-brand-orange/20 flex items-center justify-center text-xs text-brand-orange">5</span>
                  Right to Rectification
                </div>
                <p className="text-xs text-gray-400">
                  You have the right to dispute inaccurate or erroneous personal data and have 1625 Autolab rectify and correct it promptly.
                </p>
              </div>

              <div className="bg-brand-dark p-4 rounded-sm border border-gray-800">
                <div className="flex items-center gap-2 text-brand-orange font-bold text-sm mb-2">
                  <span className="w-6 h-6 rounded-full bg-brand-orange/20 flex items-center justify-center text-xs text-brand-orange">6</span>
                  Right to Data Portability
                </div>
                <p className="text-xs text-gray-400">
                  You have the right to obtain a copy of your personal data in an electronic, structured, and commonly used format for transfer to another controller.
                </p>
              </div>

              <div className="bg-brand-dark p-4 rounded-sm border border-gray-800">
                <div className="flex items-center gap-2 text-brand-orange font-bold text-sm mb-2">
                  <span className="w-6 h-6 rounded-full bg-brand-orange/20 flex items-center justify-center text-xs text-brand-orange">7</span>
                  Right to File a Complaint
                </div>
                <p className="text-xs text-gray-400">
                  You have the right to file a complaint before the National Privacy Commission (NPC) if your personal data rights have been violated.
                </p>
              </div>

              <div className="bg-brand-dark p-4 rounded-sm border border-gray-800">
                <div className="flex items-center gap-2 text-brand-orange font-bold text-sm mb-2">
                  <span className="w-6 h-6 rounded-full bg-brand-orange/20 flex items-center justify-center text-xs text-brand-orange">8</span>
                  Right to Damages
                </div>
                <p className="text-xs text-gray-400">
                  You have the right to be indemnified for any damages sustained due to inaccurate, incomplete, outdated, false, or unlawfully obtained personal data.
                </p>
              </div>
            </div>
          </div>
        ),
      },
      {
        id: 'section-8',
        number: '08',
        title: 'Cookies & Local Storage',
        icon: Database,
        keywords: ['cookies', 'localstorage', 'session', 'cache', 'tracking', 'analytics'],
        content: (
          <div className="space-y-4 text-gray-300 leading-relaxed">
            <p>
              1625 Autolab uses cookies, web storage, and session tokens to enhance site navigation, remember your shopping cart items, maintain secure user authentication, and analyze anonymous visitor trends.
            </p>
            <p className="text-sm">
              You can control cookie settings through your browser preferences. However, disabling essential cookies may impact your ability to log in, save items in your cart, or submit booking forms.
            </p>
          </div>
        ),
      },
      {
        id: 'section-9',
        number: '09',
        title: 'Minors & Age Limit',
        icon: AlertCircle,
        keywords: ['minors', 'age limit', 'children', 'consent', 'parental'],
        content: (
          <div className="space-y-4 text-gray-300 leading-relaxed">
            <p>
              Our services and website are intended for individuals who are at least 18 years of age or possess legal capacity to enter into binding contracts under Philippine law. We do not knowingly collect personal data from minors without parental or legal guardian consent. If we learn that personal data of a minor has been collected without legal authorization, we will delete such data immediately.
            </p>
          </div>
        ),
      },
      {
        id: 'section-10',
        number: '10',
        title: 'Data Protection Officer (DPO) Contact Details',
        icon: Mail,
        keywords: ['dpo', 'data protection officer', 'contact', 'email', 'phone', 'address', 'inquiry', 'rights request'],
        content: (
          <div className="space-y-4 text-gray-300 leading-relaxed">
            <p>
              If you have any questions, requests, complaints, or wish to exercise your rights under Republic Act No. 10173, please reach out to our designated Data Protection Officer:
            </p>
            <div className="bg-brand-dark p-6 rounded-sm border border-gray-800 space-y-4">
              <div className="font-bold text-white uppercase tracking-wider text-base border-b border-gray-800 pb-3">
                1625 Autolab — Data Protection Office
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-brand-orange shrink-0 mt-1" />
                  <div>
                    <span className="text-gray-400 block text-xs uppercase font-bold">Office Address</span>
                    <span className="text-white">KM 20 Ortigas Ave Ext., Cainta, Rizal, Philippines, 1900</span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Mail className="w-5 h-5 text-brand-orange shrink-0 mt-1" />
                  <div>
                    <span className="text-gray-400 block text-xs uppercase font-bold">Email Address</span>
                    <a href="mailto:1625autolab@gmail.com" className="text-brand-orange hover:underline break-all">
                      1625autolab@gmail.com
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Phone className="w-5 h-5 text-brand-orange shrink-0 mt-1" />
                  <div>
                    <span className="text-gray-400 block text-xs uppercase font-bold">Hotline</span>
                    <a href="tel:09393308263" className="text-white hover:text-brand-orange">
                      0939 330 8263
                    </a>
                  </div>
                </div>
              </div>
              <div className="pt-2 border-t border-gray-800/80 text-xs text-gray-400">
                Data privacy requests are handled free of charge and processed within thirty (30) business days upon verification of your identity.
              </div>
            </div>
          </div>
        ),
      },
      {
        id: 'section-11',
        number: '11',
        title: 'National Privacy Commission (NPC)',
        icon: ExternalLink,
        keywords: ['npc', 'national privacy commission', 'complaint', 'regulatory body', 'pasay', 'roxas boulevard'],
        content: (
          <div className="space-y-4 text-gray-300 leading-relaxed">
            <p>
              If you feel that your data privacy request has not been satisfactorily addressed by our Data Protection Officer, you have the statutory right to escalate your concern or lodge a formal complaint directly with the National Privacy Commission of the Philippines:
            </p>
            <div className="bg-brand-dark p-5 rounded-sm border border-gray-800 space-y-3 text-sm">
              <div className="flex items-center justify-between border-b border-gray-800 pb-2">
                <span className="font-bold text-white">National Privacy Commission (NPC)</span>
                <a
                  href="https://privacy.gov.ph"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-orange hover:underline inline-flex items-center gap-1 text-xs font-bold"
                >
                  privacy.gov.ph <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <p className="text-xs text-gray-400">
                5th Floor Delegation Building, PICC Complex, Roxas Boulevard, Pasay City, Metro Manila 1307, Philippines
              </p>
              <div className="flex flex-wrap gap-4 text-xs text-gray-300">
                <span><strong>Email:</strong> info@privacy.gov.ph / complaints@privacy.gov.ph</span>
                <span><strong>Hotline:</strong> (02) 8234-2228</span>
              </div>
            </div>
          </div>
        ),
      },
      {
        id: 'section-12',
        number: '12',
        title: 'Policy Updates & Amendments',
        icon: HelpCircle,
        keywords: ['updates', 'revisions', 'amendments', 'version', 'effective date'],
        content: (
          <div className="space-y-4 text-gray-300 leading-relaxed">
            <p>
              1625 Autolab reserves the right to update or modify this Privacy Policy at any time to reflect changes in regulatory standards, company policies, or legal requirements under Philippine law. Any revisions will be published on this page with an updated "Last Updated" timestamp. We encourage you to review this policy periodically.
            </p>
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
        title="Privacy Policy & Data Privacy Act of 2012 (RA 10173)"
        description="Learn about 1625 Autolab's commitment to data privacy, statutory compliance under Republic Act No. 10173 (Data Privacy Act of 2012), Data Subject Rights, and DPO details."
        keywords="Privacy Policy, Data Privacy Act of 2012, RA 10173, National Privacy Commission, 1625 Autolab Privacy, Data Protection Philippines"
      />

      {/* Hero Header */}
      <section className="bg-brand-darker border-b border-gray-800 pt-28 pb-16 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-brand-orange/5 rounded-full blur-3xl pointer-events-none" />
        <div className="container mx-auto px-4 md:px-6 relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 bg-brand-orange/10 border border-brand-orange/30 text-brand-orange px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest mb-6">
              <ShieldCheck className="w-4 h-4" /> Legal Compliance & Transparency
            </div>
            <h1 className="text-3xl sm:text-5xl md:text-6xl font-display font-black text-white uppercase tracking-tight leading-tight mb-6">
              Privacy Policy & <span className="text-brand-orange">RA 10173</span>
            </h1>
            <p className="text-gray-400 text-base md:text-lg leading-relaxed max-w-3xl mx-auto mb-8">
              Protecting your personal information under the <strong className="text-gray-200">Republic Act No. 10173 (Data Privacy Act of 2012)</strong> of the Philippines.
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
                <Printer className="w-3.5 h-3.5" /> Print Policy
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Quick Compliance Cards Banner */}
      <section className="bg-brand-dark border-b border-gray-800 py-10">
        <div className="container mx-auto px-4 md:px-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-brand-darker border border-gray-800 p-4 rounded-sm flex items-start gap-4">
              <div className="w-10 h-10 rounded-sm bg-brand-orange/10 border border-brand-orange/30 flex items-center justify-center text-brand-orange shrink-0">
                <Scale className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-white font-bold text-sm">RA 10173 Compliant</h4>
                <p className="text-xs text-gray-400">Aligned with Philippine Data Privacy Regulations.</p>
              </div>
            </div>

            <div className="bg-brand-darker border border-gray-800 p-4 rounded-sm flex items-start gap-4">
              <div className="w-10 h-10 rounded-sm bg-brand-orange/10 border border-brand-orange/30 flex items-center justify-center text-brand-orange shrink-0">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-white font-bold text-sm">Encrypted Processing</h4>
                <p className="text-xs text-gray-400">TLS/SSL security for all transactions and accounts.</p>
              </div>
            </div>

            <div className="bg-brand-darker border border-gray-800 p-4 rounded-sm flex items-start gap-4">
              <div className="w-10 h-10 rounded-sm bg-brand-orange/10 border border-brand-orange/30 flex items-center justify-center text-brand-orange shrink-0">
                <UserCheck className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-white font-bold text-sm">Data Subject Rights</h4>
                <p className="text-xs text-gray-400">Full statutory control over your personal data.</p>
              </div>
            </div>

            <div className="bg-brand-darker border border-gray-800 p-4 rounded-sm flex items-start gap-4">
              <div className="w-10 h-10 rounded-sm bg-brand-orange/10 border border-brand-orange/30 flex items-center justify-center text-brand-orange shrink-0">
                <Mail className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-white font-bold text-sm">Designated DPO</h4>
                <p className="text-xs text-gray-400">Direct response channel for privacy inquiries.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content Area with Sticky Sidebar */}
      <section className="py-16">
        <div className="container mx-auto px-4 md:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            
            {/* Left Sidebar - Table of Contents & Search */}
            <div className="lg:col-span-4 space-y-6">
              <div className="bg-brand-darker border border-gray-800 p-6 rounded-sm sticky top-24 space-y-6">
                
                {/* Search Bar */}
                <div>
                  <label htmlFor="policy-search" className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                    Search Policy Sections
                  </label>
                  <div className="relative">
                    <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      id="policy-search"
                      type="text"
                      placeholder="Search (e.g. DPO, Rights, Cookies)..."
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

                {/* Table of Contents List */}
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

                {/* Data Protection Officer Quick Card */}
                <div className="pt-4 border-t border-gray-800">
                  <div className="bg-brand-dark p-4 rounded-sm border border-gray-800 space-y-2 text-xs">
                    <div className="font-bold text-white flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-brand-orange" /> Privacy Concerns?
                    </div>
                    <p className="text-gray-400">
                      Contact our Data Protection Officer for inquiries regarding RA 10173 compliance.
                    </p>
                    <a
                      href="mailto:1625autolab@gmail.com"
                      className="text-brand-orange hover:underline font-bold block pt-1 break-all"
                    >
                      1625autolab@gmail.com
                    </a>
                  </div>
                </div>

              </div>
            </div>

            {/* Right Main Content Panel */}
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

              {/* Bottom Support / Registration Consent Banner */}
              <div className="bg-gradient-to-r from-brand-darker via-brand-dark to-brand-darker border border-brand-orange/30 p-8 rounded-sm text-center space-y-4">
                <Info className="w-10 h-10 text-brand-orange mx-auto" />
                <h3 className="text-2xl font-display font-bold text-white uppercase tracking-wider">
                  Questions or Data Requests?
                </h3>
                <p className="text-gray-400 text-sm max-w-xl mx-auto">
                  If you wish to access, rectify, or request deletion of your personal records stored at 1625 Autolab, our team is ready to assist you.
                </p>
                <div className="pt-2 flex flex-wrap items-center justify-center gap-4">
                  <a
                    href="mailto:1625autolab@gmail.com?subject=Data%20Privacy%20Request%20-%20RA%2010173"
                    className="inline-flex items-center gap-2 bg-brand-orange text-white px-6 py-3 font-bold uppercase tracking-wider text-xs hover:bg-orange-600 transition-colors rounded-sm"
                  >
                    <Mail className="w-4 h-4" /> Submit Data Subject Request
                  </a>
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
