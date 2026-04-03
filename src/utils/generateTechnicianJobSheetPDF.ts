import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import logoUrl from '../assets/logo.png';
import type { Booking } from '../types';

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

function drawLineField(doc: jsPDF, label: string, y: number): number {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...BRAND.slate);
  doc.text(label, 12, y);
  doc.setDrawColor(148, 163, 184);
  doc.line(52, y, 198, y);
  return y + 8;
}

export async function generateTechnicianJobSheetPDF(booking: Booking): Promise<void> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const logoDataUrl = await toDataUrlFromAsset(logoUrl);

  doc.setFillColor(...BRAND.slate);
  doc.rect(0, 0, 210, 32, 'F');

  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, 'PNG', 12, 6, 20, 20);
    } catch {
      // Continue with text-only header if image cannot render.
    }
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('1625 AUTO LAB', 36, 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(226, 232, 240);
  doc.text('Technician Work Order', 36, 20);

  doc.setTextColor(...BRAND.orange);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Technician Job Sheet', 198, 20, { align: 'right' });

  autoTable(doc, {
    startY: 40,
    margin: { left: 12, right: 12 },
    body: [
      ['Reference Number', valueOrDash(booking.referenceNumber)],
      ['Appointment Date', valueOrDash(booking.appointmentDate)],
      ['Appointment Time', valueOrDash(booking.appointmentTime)],
      ['Assigned Technician', valueOrDash(booking.assignedTech?.name)],
    ],
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 2.5 },
    columnStyles: {
      0: { cellWidth: 45, fontStyle: 'bold', textColor: BRAND.gray },
      1: { cellWidth: 'auto' },
    },
  });

  let y = (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? 40;
  y += 4;

  autoTable(doc, {
    startY: y,
    margin: { left: 12, right: 12 },
    head: [['Customer / Vehicle', 'Requested Work']],
    body: [[
      [
        `Customer: ${valueOrDash(booking.name)}`,
        `Phone: ${valueOrDash(booking.phone)}`,
        `Email: ${valueOrDash(booking.email)}`,
        `Vehicle: ${valueOrDash(booking.vehicleYear)} ${valueOrDash(booking.vehicleMake)} ${valueOrDash(booking.vehicleModel)}`,
      ].join('\n'),
      [
        `Service(s): ${valueOrDash(booking.serviceName)}`,
        `Variations: ${(booking.selectedVariations?.map(v => v.variationName).join(', ') || '-')}`,
        `Client Notes: ${valueOrDash(booking.notes)}`,
      ].join('\n'),
    ]],
    theme: 'striped',
    styles: { fontSize: 9, cellPadding: 2.5, valign: 'top' },
    headStyles: { fillColor: BRAND.slate, textColor: [255, 255, 255] },
  });

  y = (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? y;
  y += 8;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...BRAND.slate);
  doc.text('Manual Completion Fields', 12, y);
  y += 6;

  y = drawLineField(doc, 'Beam Angle:', y);
  y = drawLineField(doc, 'Lux Output:', y);
  y = drawLineField(doc, 'Calibration Notes:', y);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...BRAND.slate);
  doc.text('Customer Signature:', 12, y + 4);
  doc.setDrawColor(148, 163, 184);
  doc.rect(52, y, 146, 28);

  y += 38;
  doc.setDrawColor(226, 232, 240);
  doc.line(12, y, 198, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...BRAND.gray);
  doc.text('Use this sheet for pre-job and on-vehicle validation. Keep with booking records after completion.', 12, y + 6);

  const safeRef = valueOrDash(booking.referenceNumber).replace(/[^a-zA-Z0-9_-]/g, '_');
  doc.save(`technician-job-sheet-${safeRef}.pdf`);
}
