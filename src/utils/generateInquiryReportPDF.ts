import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import logoUrl from '../assets/logo.png';
import type { SiteSettings } from '../types';

type Inquiry = {
  id: string;
  referenceNumber?: string;
  fullName: string;
  contactNumber: string;
  emailAddress: string;
  facebookName: string;
  plateNumber?: string;
  appointmentDate: string;
  appointmentTime: string;
  make: string;
  model: string;
  year?: string;
  productToPurchase: string;
  status: string;
  internalNotes?: string | null;
  createdAt?: string;
};

type GenerateInquiryReportPDFOptions = {
  settings?: SiteSettings;
};

const BRAND = {
  orange: [249, 115, 22] as [number, number, number],
  slate: [15, 23, 42] as [number, number, number],
  gray: [71, 85, 105] as [number, number, number],
};

function valueOrDash(value: string | number | null | undefined): string {
  if (value == null) return '-';
  const str = String(value).trim();
  return str.length > 0 ? str : '-';
}

async function toDataUrlFromAsset(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(String(reader.result ?? ''));
      reader.onerror = () => reject(new Error('Unable to read logo file.'));
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function drawHeader(doc: jsPDF, logoDataUrl: string | null, businessName: string, tagline: string): number {
  doc.setFillColor(...BRAND.slate);
  doc.rect(0, 0, 210, 32, 'F');

  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, 'PNG', 12, 6, 20, 20);
    } catch {
      // Ignore bad image payloads and continue with text-only header.
    }
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(businessName, 36, 14);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(226, 232, 240);
  doc.text(tagline, 36, 20);

  doc.setTextColor(...BRAND.orange);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('Inquiry Detail Report', 198, 20, { align: 'right' });

  return 40;
}

function maybeAddPage(doc: jsPDF, cursorY: number, neededHeight: number): number {
  if (cursorY + neededHeight <= 282) return cursorY;
  doc.addPage();
  return 20;
}

export async function generateInquiryReportPDF(
  inquiry: Inquiry,
  options: GenerateInquiryReportPDFOptions = {},
): Promise<void> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const logoDataUrl = await toDataUrlFromAsset(logoUrl);

  const settings = options.settings ?? {};

  const businessName = (settings.business_name ?? settings.footer_name ?? '').trim() || '1625 AUTO LAB';
  const tagline = (settings.footer_tagline ?? '').trim() || 'Premium Automotive Lighting';
  const footerAddress = (settings.footer_address ?? '').trim() || '1625 Auto Lab';
  const footerPhone = (settings.footer_phone ?? '').trim();

  let y = drawHeader(doc, logoDataUrl, businessName, tagline);

  const createdDate = inquiry.createdAt
    ? new Date(inquiry.createdAt).toLocaleString('en-PH', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Manila',
      })
    : '-';

  autoTable(doc, {
    startY: y,
    margin: { left: 12, right: 12 },
    body: [
      ['Reference Number', valueOrDash(inquiry.referenceNumber || inquiry.id)],
      ['Submitted Date', createdDate],
      ['Current Status', valueOrDash(inquiry.status).toUpperCase()],
    ],
    theme: 'plain',
    styles: { fontSize: 10, cellPadding: 1, textColor: BRAND.slate },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 50, textColor: BRAND.gray },
      1: { cellWidth: 136 },
    },
  });

  y = (doc as any).lastAutoTable.finalY + 8;

  // -- Client & Vehicle Details ----------------------------------------------------
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...BRAND.orange);
  doc.text('CLIENT & VEHICLE DETAILS', 12, y);
  y += 4;

  autoTable(doc, {
    startY: y,
    margin: { left: 12, right: 12 },
    theme: 'grid',
    headStyles: { fillColor: [248, 250, 252], textColor: BRAND.gray, fontStyle: 'bold' },
    styles: { fontSize: 9, cellPadding: 3, textColor: BRAND.slate, lineColor: [226, 232, 240] },
    body: [
      ['Customer Name', valueOrDash(inquiry.fullName), 'Vehicle Make', valueOrDash(inquiry.make)],
      ['Contact Number', valueOrDash(inquiry.contactNumber), 'Vehicle Model', valueOrDash(inquiry.model)],
      ['Email Address', valueOrDash(inquiry.emailAddress), 'Vehicle Year', valueOrDash(inquiry.year)],
      ['Facebook Name', valueOrDash(inquiry.facebookName), 'Plate Number', valueOrDash(inquiry.plateNumber)],
    ],
  });

  y = (doc as any).lastAutoTable.finalY + 8;
  y = maybeAddPage(doc, y, 30);

  // -- Request Details ----------------------------------------------------
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...BRAND.orange);
  doc.text('REQUEST DETAILS', 12, y);
  y += 4;

  autoTable(doc, {
    startY: y,
    margin: { left: 12, right: 12 },
    theme: 'grid',
    headStyles: { fillColor: [248, 250, 252], textColor: BRAND.gray, fontStyle: 'bold' },
    styles: { fontSize: 9, cellPadding: 3, textColor: BRAND.slate, lineColor: [226, 232, 240] },
    body: [
      ['Product / Service', valueOrDash(inquiry.productToPurchase)],
      ['Appointment Date', valueOrDash(inquiry.appointmentDate)],
      ['Appointment Time', valueOrDash(inquiry.appointmentTime)],
    ],
    columnStyles: {
      0: { cellWidth: 50, fontStyle: 'bold', fillColor: [248, 250, 252] },
      1: { cellWidth: 136 },
    },
  });

  y = (doc as any).lastAutoTable.finalY + 8;
  y = maybeAddPage(doc, y, 30);

  // -- Internal Notes --------------------------------------------------------
  if (inquiry.internalNotes && inquiry.internalNotes.trim() !== '') {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...BRAND.orange);
    doc.text('INTERNAL NOTES', 12, y);
    y += 4;

    autoTable(doc, {
      startY: y,
      margin: { left: 12, right: 12 },
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 4, textColor: BRAND.slate, lineColor: [226, 232, 240] },
      body: [[inquiry.internalNotes]],
    });

    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // -- Footer ------------------------------------------------------------------
  const pageCount = (doc.internal as any).getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);

    const addressLine = [footerAddress, footerPhone].filter(Boolean).join(' • ');
    if (addressLine) {
      doc.text(addressLine, 105, 285, { align: 'center' });
    }

    doc.text(`Page ${i} of ${pageCount}`, 198, 285, { align: 'right' });
    doc.text(`Generated: ${new Date().toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}`, 12, 285, { align: 'left' });
  }

  doc.save(`inquiry-${inquiry.referenceNumber || inquiry.id.substring(0, 8) || 'report'}.pdf`);
}
