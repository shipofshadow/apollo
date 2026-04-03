import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import logoUrl from '../assets/logo.png';
import type { Booking, BuildUpdate } from '../types';

type GenerateJobCompletionPDFOptions = {
  buildUpdates?: BuildUpdate[];
  includeAdminExtras?: boolean;
};

type PhotoTile = {
  sourceUrl: string;
  dataUrl: string;
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

function normalizeSignatureData(signatureData?: string): string | null {
  if (!signatureData) return null;
  if (signatureData.startsWith('data:image')) return signatureData;
  if (signatureData.startsWith('iVBOR')) {
    return `data:image/png;base64,${signatureData}`;
  }
  return null;
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

async function toDataUrlFromUrl(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(String(reader.result ?? ''));
      reader.onerror = () => reject(new Error('Unable to read remote image.'));
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

async function resolvePhotoTiles(urls: string[]): Promise<PhotoTile[]> {
  const loaded = await Promise.all(
    urls.map(async (sourceUrl) => {
      const dataUrl = await toDataUrlFromUrl(sourceUrl);
      return dataUrl ? { sourceUrl, dataUrl } : null;
    }),
  );

  return loaded.filter((item): item is PhotoTile => item !== null);
}

function drawHeader(doc: jsPDF, logoDataUrl: string | null): number {
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
  doc.text('1625 AUTO LAB', 36, 14);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(226, 232, 240);
  doc.text('Premium Automotive Lighting', 36, 20);

  doc.setTextColor(...BRAND.orange);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('Job Completion Certificate', 198, 20, { align: 'right' });

  return 40;
}

function maybeAddPage(doc: jsPDF, cursorY: number, neededHeight: number): number {
  if (cursorY + neededHeight <= 282) return cursorY;
  doc.addPage();
  return 20;
}

export async function generateJobCompletionPDF(
  booking: Booking,
  options: GenerateJobCompletionPDFOptions = {},
): Promise<void> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const logoDataUrl = await toDataUrlFromAsset(logoUrl);
  const signatureData = normalizeSignatureData(booking.signatureData);

  const buildUpdates = options.buildUpdates ?? [];

  let y = drawHeader(doc, logoDataUrl);

  const createdDate = booking.createdAt
    ? new Date(booking.createdAt).toLocaleString('en-PH', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '-';

  autoTable(doc, {
    startY: y,
    margin: { left: 12, right: 12 },
    body: [
      ['Reference Number', valueOrDash(booking.referenceNumber)],
      ['Issued Date', createdDate],
      ['Appointment', `${valueOrDash(booking.appointmentDate)} ${valueOrDash(booking.appointmentTime)}`],
      ['Status', valueOrDash(booking.status)],
    ],
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 2.5 },
    columnStyles: {
      0: { cellWidth: 42, fontStyle: 'bold', textColor: BRAND.gray },
      1: { cellWidth: 'auto' },
    },
    headStyles: { fillColor: BRAND.slate },
  });

  y = (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? y;
  y += 4;

  const serviceLine = booking.selectedVariations && booking.selectedVariations.length > 0
    ? booking.selectedVariations.map(v => v.variationName).join(', ')
    : '-';

  autoTable(doc, {
    startY: y,
    margin: { left: 12, right: 12 },
    head: [['Customer / Vehicle', 'Job Details']],
    body: [
      [
        [
          `Name: ${valueOrDash(booking.name)}`,
          `Phone: ${valueOrDash(booking.phone)}`,
          `Email: ${valueOrDash(booking.email)}`,
          `Vehicle: ${valueOrDash(booking.vehicleYear)} ${valueOrDash(booking.vehicleMake)} ${valueOrDash(booking.vehicleModel)}`,
        ].join('\n'),
        [
          `Service(s): ${valueOrDash(booking.serviceName)}`,
          `Variations: ${serviceLine}`,
          `Technician: ${valueOrDash(booking.assignedTech?.name)}`,
        ].join('\n'),
      ],
    ],
    theme: 'striped',
    styles: { fontSize: 9, cellPadding: 2.5, valign: 'top' },
    headStyles: { fillColor: BRAND.slate, textColor: [255, 255, 255] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  y = (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? y;
  y += 4;

  autoTable(doc, {
    startY: y,
    margin: { left: 12, right: 12 },
    head: [['Calibration Summary']],
    body: [[
      [
        `Beam Angle: ${valueOrDash(booking.calibrationData?.beamAngle)}`,
        `Lux Output: ${valueOrDash(booking.calibrationData?.luxOutput)}`,
        `Calibration Notes: ${valueOrDash(booking.calibrationData?.notes)}`,
      ].join('\n'),
    ]],
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 2.5 },
    headStyles: { fillColor: BRAND.slate, textColor: [255, 255, 255] },
  });

  y = (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? y;
  y += 4;

  if (buildUpdates.length > 0) {
    autoTable(doc, {
      startY: y,
      margin: { left: 12, right: 12 },
      head: [['Build Updates', 'Note', 'Technician']],
      body: buildUpdates
        .slice()
        .reverse()
        .map(update => [
          new Date(update.createdAt).toLocaleString('en-PH', {
            year: 'numeric',
            month: 'short',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
          }),
          valueOrDash(update.note),
          valueOrDash(update.assignedTech?.name),
        ]),
      theme: 'striped',
      styles: { fontSize: 8.5, cellPadding: 2 },
      headStyles: { fillColor: BRAND.slate, textColor: [255, 255, 255] },
      columnStyles: {
        0: { cellWidth: 36 },
        2: { cellWidth: 40 },
      },
    });

    y = (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? y;
    y += 4;
  }

  if (options.includeAdminExtras) {
    const adminNotes = valueOrDash(booking.internalNotes);
    const techRole = valueOrDash(booking.assignedTech?.role);
    const beforeRefs = booking.beforePhotos?.length ? booking.beforePhotos.join('\n') : '-';
    const afterRefs = booking.afterPhotos?.length ? booking.afterPhotos.join('\n') : '-';
    const buildPhotoRefs = buildUpdates
      .flatMap(update => update.photoUrls)
      .filter(Boolean);
    const embeddedBuildPhotos = await resolvePhotoTiles(buildPhotoRefs);

    autoTable(doc, {
      startY: y,
      margin: { left: 12, right: 12 },
      head: [['Admin Notes', 'Technician Role']],
      body: [[adminNotes, techRole]],
      theme: 'grid',
      styles: { fontSize: 8.5, cellPadding: 2.5, valign: 'top' },
      headStyles: { fillColor: BRAND.slate, textColor: [255, 255, 255] },
    });

    y = (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? y;
    y += 4;

    autoTable(doc, {
      startY: y,
      margin: { left: 12, right: 12 },
      head: [['Before Photo References', 'After Photo References']],
      body: [[beforeRefs, afterRefs]],
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2.5, valign: 'top' },
      headStyles: { fillColor: BRAND.slate, textColor: [255, 255, 255] },
    });

    y = (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? y;
    y += 4;

    if (embeddedBuildPhotos.length > 0) {
      y = maybeAddPage(doc, y, 24);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...BRAND.slate);
      doc.text('Build Update Photo Thumbnails', 12, y + 4);
      y += 8;

      const tileW = 58;
      const tileH = 38;
      const rowGap = 6;
      const colGap = 6;
      const left = 12;
      const cols = 3;

      for (let i = 0; i < embeddedBuildPhotos.length; i += 1) {
        const col = i % cols;
        const row = Math.floor((i % 9) / cols);

        if (i > 0 && i % 9 === 0) {
          doc.addPage();
          y = 20;
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(10);
          doc.setTextColor(...BRAND.slate);
          doc.text('Build Update Photo Thumbnails (cont.)', 12, y + 4);
          y += 8;
        }

        const x = left + col * (tileW + colGap);
        const tileY = y + row * (tileH + rowGap);
        doc.setDrawColor(203, 213, 225);
        doc.rect(x, tileY, tileW, tileH);

        try {
          doc.addImage(embeddedBuildPhotos[i].dataUrl, 'JPEG', x + 1, tileY + 1, tileW - 2, tileH - 2, undefined, 'FAST');
        } catch {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7);
          doc.setTextColor(...BRAND.gray);
          doc.text('Image render failed', x + 2, tileY + 6);
        }
      }

      const rowsUsed = Math.ceil((embeddedBuildPhotos.length % 9 || 9) / cols);
      y += rowsUsed * (tileH + rowGap);
    }

    if (buildPhotoRefs.length > embeddedBuildPhotos.length) {
      const unresolved = buildPhotoRefs.filter(
        url => !embeddedBuildPhotos.some(photo => photo.sourceUrl === url),
      );
      autoTable(doc, {
        startY: y,
        margin: { left: 12, right: 12 },
        head: [['Unresolved Build Photo References']],
        body: unresolved.map(url => [url]),
        theme: 'striped',
        styles: { fontSize: 7.5, cellPadding: 2 },
        headStyles: { fillColor: BRAND.slate, textColor: [255, 255, 255] },
      });

      y = (doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? y;
      y += 4;
    }
  }

  if (signatureData) {
    y = maybeAddPage(doc, y, 46);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...BRAND.slate);
    doc.text('Customer Signature', 12, y + 4);

    doc.setDrawColor(203, 213, 225);
    doc.rect(12, y + 7, 80, 34);
    try {
      doc.addImage(signatureData, 'PNG', 14, y + 9, 76, 30, undefined, 'FAST');
    } catch {
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...BRAND.gray);
      doc.text('Signature image could not be rendered.', 15, y + 25);
    }

    y += 44;
  }

  y = maybeAddPage(doc, y, 22);
  doc.setDrawColor(226, 232, 240);
  doc.line(12, y + 2, 198, y + 2);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...BRAND.gray);
  doc.text(
    'This job sheet reflects the recorded booking details and calibration data at the time of generation.',
    12,
    y + 8,
  );
  doc.text('1625 Auto Lab - NKKS Arcade, Brgy. Alasas, San Fernando, Pampanga', 12, y + 13);

  const safeRef = valueOrDash(booking.referenceNumber).replace(/[^a-zA-Z0-9_-]/g, '_');
  doc.save(`job-sheet-${safeRef}.pdf`);
}
