
'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Payment } from '@/lib/types';
import { format, isValid } from 'date-fns';
import { formatCurrency } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Info, Download, Percent, Edit, Printer, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useSession } from '@/firebase';
import { DEFAULT_TAX_LABEL, ONTARIO_HST_RATE, formatTaxLabel } from '@/lib/tax';
import { formatPackageContents } from '@/lib/package-utils';

interface PaymentDetailsDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  payment: Payment | null;
}

const RECEIPT_LOGO_PATH = '/assets/logoRectangle.png';
let receiptLogoDataUrlPromise: Promise<string | null> | null = null;

function getReceiptLogoDataUrl() {
  if (typeof window === 'undefined') return Promise.resolve(null);

  receiptLogoDataUrlPromise ??= fetch(RECEIPT_LOGO_PATH)
    .then(response => {
      if (!response.ok) throw new Error('Could not load receipt logo.');
      return response.blob();
    })
    .then(blob => new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    }))
    .catch(() => null);

  return receiptLogoDataUrlPromise;
}

export function PaymentDetailsDialog({
  isOpen,
  onOpenChange,
  payment,
}: PaymentDetailsDialogProps) {
  const router = useRouter();
  const { tenant } = useSession();
  const [isPdfPreviewOpen, setIsPdfPreviewOpen] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState('');
  const [isPdfGenerating, setIsPdfGenerating] = useState(false);

  useEffect(() => {
    return () => {
      if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);
    };
  }, [pdfPreviewUrl]);

  useEffect(() => {
    if (!isOpen || !payment) {
      setIsPdfPreviewOpen(false);
      setPdfPreviewUrl('');
    }
  }, [isOpen, payment?.id]);

  if (!payment) return null;
  const detailTaxRate = payment.taxRate ?? tenant?.taxRate ?? ONTARIO_HST_RATE;
  const detailTaxLabel = formatTaxLabel(payment.taxLabel || tenant?.taxLabel || DEFAULT_TAX_LABEL, detailTaxRate);

  const getPdfFilename = () => `receipt-${payment.studentName.replace(/\s+/g, '_')}-${payment.id}.pdf`;

  const handleEdit = () => {
    if (payment) {
      onOpenChange(false);
      router.push(`/app/payments?edit=${payment.id}`);
    }
  };

  const generatePdf = async () => {
    const fallbackLogoDataUrl = await getReceiptLogoDataUrl();
    const businessName = tenant?.receiptBusinessName || tenant?.name || 'InstructorOS';
    const logoDataUrl = tenant?.receiptLogoDataUrl || fallbackLogoDataUrl;
    const receiptWebsite = tenant?.receiptWebsite || 'www.instructoros.ca';
    const receiptPhone = tenant?.receiptPhone || '';
    const receiptEmail = tenant?.receiptEmail || tenant?.ownerEmail || '';
    const receiptAddress = tenant?.receiptAddress || '';
    const hstNumber = tenant?.hstNumber || '';
    const paymentTaxRate = payment.taxRate ?? tenant?.taxRate ?? ONTARIO_HST_RATE;
    const paymentTaxLabel = formatTaxLabel(payment.taxLabel || tenant?.taxLabel || DEFAULT_TAX_LABEL, paymentTaxRate);
    const doc = new jsPDF({ unit: 'mm', format: 'letter' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 14;
    const contentWidth = pageWidth - margin * 2;
    const brandYellow: [number, number, number] = [255, 193, 7];
    const ink: [number, number, number] = [17, 24, 39];
    const muted: [number, number, number] = [107, 114, 128];
    const border: [number, number, number] = [229, 231, 235];
    const soft: [number, number, number] = [249, 250, 251];
    const paidColor: [number, number, number] = payment.amountDue > 0 ? [220, 38, 38] : [22, 163, 74];
    const receiptNumber = payment.id ? payment.id.slice(-8).toUpperCase() : 'N/A';
    const statusLabel = payment.amountDue > 0 ? 'BALANCE DUE' : 'PAID';

    doc.setProperties({
      title: `${businessName} Receipt - ${payment.studentName}`,
      subject: 'Payment Receipt',
      author: businessName,
    });

    const formatPdfDate = (value: string, pattern = 'MMM d, yyyy') => {
      const parsedDate = new Date(value);
      return isValid(parsedDate) ? format(parsedDate, pattern) : 'N/A';
    };

    const drawInstructorOsLogo = (x: number, y: number) => {
      if (logoDataUrl) {
        doc.addImage(logoDataUrl, 'PNG', x, y - 2, 82, 21);
        return;
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.setTextColor(...ink);
      doc.text(doc.splitTextToSize(businessName, 82).slice(0, 1), x, y + 7);
      doc.setFontSize(6.5);
      doc.setCharSpace(1.8);
      doc.text('DRIVING SCHOOL OPERATIONS', x, y + 14);
      doc.setCharSpace(0);
    };

    const drawHeader = () => {
      doc.setFillColor(255, 255, 255);
      doc.rect(0, 0, pageWidth, 42, 'F');
      doc.setFillColor(...brandYellow);
      doc.rect(0, 0, 4, 42, 'F');
      doc.setDrawColor(...border);
      doc.setLineWidth(0.25);
      doc.line(margin, 42, pageWidth - margin, 42);

      drawInstructorOsLogo(margin, 12);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.setTextColor(...ink);
      doc.text('Payment Receipt', pageWidth - margin, 17, { align: 'right' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...muted);
      doc.text(`Receipt #${receiptNumber}`, pageWidth - margin, 24, { align: 'right' });
      doc.text(formatPdfDate(payment.paymentDate, 'MMMM d, yyyy'), pageWidth - margin, 30, { align: 'right' });

      const pillWidth = payment.amountDue > 0 ? 34 : 20;
      const pillX = pageWidth - margin - pillWidth;
      doc.setFillColor(...paidColor);
      doc.roundedRect(pillX, 33, pillWidth, 7, 3.5, 3.5, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(255, 255, 255);
      doc.text(statusLabel, pillX + pillWidth / 2, 37.8, { align: 'center' });
    };

    const drawInfoCard = (x: number, y: number, width: number, title: string, value: string, detail?: string) => {
      doc.setFillColor(...soft);
      doc.setDrawColor(...border);
      doc.roundedRect(x, y, width, 24, 3, 3, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(...muted);
      doc.text(title.toUpperCase(), x + 4, y + 6);
      doc.setFontSize(11);
      doc.setTextColor(...ink);
      const valueLines = doc.splitTextToSize(value, width - 8);
      doc.text(valueLines.slice(0, 2), x + 4, y + 13);
      if (detail) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(...muted);
        doc.text(detail, x + 4, y + 21);
      }
    };

    const drawKeyValue = (label: string, value: string, x: number, y: number, width: number, options?: { bold?: boolean; color?: [number, number, number] }) => {
      doc.setFont('helvetica', options?.bold ? 'bold' : 'normal');
      doc.setFontSize(options?.bold ? 10 : 9);
      doc.setTextColor(...muted);
      doc.text(label, x, y);
      doc.setTextColor(...(options?.color || ink));
      doc.text(value, x + width, y, { align: 'right' });
    };

    const addPageIfNeeded = (currentY: number, requiredHeight: number) => {
      if (currentY + requiredHeight <= pageHeight - 24) return currentY;
      doc.addPage();
      return 20;
    };

    drawHeader();

    const gap = 4;
    const studentCardWidth = contentWidth * 0.47;
    const dateCardWidth = contentWidth * 0.25;
    const statusCardWidth = contentWidth - studentCardWidth - dateCardWidth - gap * 2;
    const cardsY = 49;

    drawInfoCard(
      margin,
      cardsY,
      studentCardWidth,
      'Student',
      payment.studentName || 'Walk-in Customer',
      payment.studentId ? `Student ID: ${payment.studentId.slice(0, 8)}` : 'Manual / walk-in receipt'
    );
    drawInfoCard(
      margin + studentCardWidth + gap,
      cardsY,
      dateCardWidth,
      'Payment Date',
      formatPdfDate(payment.paymentDate),
      formatPdfDate(payment.paymentDate, 'h:mm a')
    );
    drawInfoCard(
      margin + studentCardWidth + dateCardWidth + gap * 2,
      cardsY,
      statusCardWidth,
      'Payment Method',
      payment.paymentMethod,
      statusLabel
    );

    if (receiptAddress || receiptPhone || receiptEmail || hstNumber) {
      const profileLines = [
        receiptAddress,
        [receiptPhone, receiptEmail].filter(Boolean).join(' | '),
        hstNumber ? `GST/HST #: ${hstNumber}` : '',
      ].filter(Boolean);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...muted);
      doc.text(profileLines, margin, cardsY + 32);
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...ink);
    doc.text('Items Billed', margin, 84);

    const tableRows = payment.items.map(item => {
      const itemDate = new Date(item.date);
      const displayDate = isValid(itemDate) ? itemDate : new Date(payment.paymentDate);
      const quantity = item.quantity || 1;
      const lineTotal = item.price * quantity;

      const serviceCell = item.packageItems?.length
        ? `${item.name}\nIncludes: ${formatPackageContents(item.packageItems)}`
        : item.name;

      return [
        format(displayDate, 'MMM d, yyyy'),
        serviceCell,
        String(quantity),
        formatCurrency(item.price),
        formatCurrency(lineTotal),
      ];
    });

    autoTable(doc, {
      head: [['Lesson Date', 'Service', 'Qty', 'Rate', 'Amount']],
      body: tableRows.length ? tableRows : [['-', 'No items billed', '-', '-', '-']],
      startY: 88,
      margin: { left: margin, right: margin, top: 18, bottom: 24 },
      theme: 'grid',
      styles: {
        font: 'helvetica',
        fontSize: 8.8,
        cellPadding: 3,
        textColor: ink,
        lineColor: border,
        lineWidth: 0.15,
      },
      headStyles: {
        fillColor: ink,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
      },
      alternateRowStyles: {
        fillColor: [252, 252, 253],
      },
      columnStyles: {
        0: { cellWidth: 30 },
        1: { cellWidth: contentWidth - 30 - 14 - 27 - 30 },
        2: { cellWidth: 14, halign: 'center' },
        3: { cellWidth: 27, halign: 'right' },
        4: { cellWidth: 30, halign: 'right', fontStyle: 'bold' },
      },
    });

    let cursorY = ((doc as any).lastAutoTable?.finalY || 98) + 10;
    const summaryRows = [
      { label: 'Subtotal', value: formatCurrency(payment.subtotal) },
      ...(payment.discount > 0 ? [{ label: 'Discount', value: `-${formatCurrency(payment.discount)}` }] : []),
      ...(payment.tax > 0 ? [{ label: paymentTaxLabel, value: formatCurrency(payment.tax) }] : []),
      ...(payment.creditApplied && payment.creditApplied > 0 ? [{ label: 'Advance Credit', value: `-${formatCurrency(payment.creditApplied)}` }] : []),
      { label: 'Total Bill', value: formatCurrency(payment.total), bold: true },
      { label: 'Amount Paid', value: formatCurrency(payment.paidAmount) },
      { label: 'Amount Due', value: formatCurrency(payment.amountDue), bold: true, color: paidColor },
    ];
    const totalsHeight = 18 + summaryRows.length * 6;
    const detailsHeight = 18 + 4 * 6;
    const cardHeight = Math.max(totalsHeight, detailsHeight);
    cursorY = addPageIfNeeded(cursorY, cardHeight + 10);

    const leftCardWidth = contentWidth * 0.48;
    const rightCardWidth = contentWidth - leftCardWidth - 8;
    doc.setFillColor(...soft);
    doc.setDrawColor(...border);
    doc.roundedRect(margin, cursorY, leftCardWidth, cardHeight, 3, 3, 'FD');
    doc.roundedRect(margin + leftCardWidth + 8, cursorY, rightCardWidth, cardHeight, 3, 3, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...ink);
    doc.text('Payment Details', margin + 4, cursorY + 7);
    doc.text('Receipt Summary', margin + leftCardWidth + 12, cursorY + 7);

    let detailsY = cursorY + 16;
    drawKeyValue('Method', payment.paymentMethod, margin + 4, detailsY, leftCardWidth - 8);
    detailsY += 6;
    drawKeyValue('Paid On', formatPdfDate(payment.paymentDate), margin + 4, detailsY, leftCardWidth - 8);
    detailsY += 6;
    drawKeyValue('Status', statusLabel, margin + 4, detailsY, leftCardWidth - 8, { bold: true, color: paidColor });
    detailsY += 6;
    drawKeyValue('E-transfer', 'Justdriveca1@gmail.com', margin + 4, detailsY, leftCardWidth - 8);

    let totalsY = cursorY + 16;
    summaryRows.forEach((row) => {
      drawKeyValue(row.label, row.value, margin + leftCardWidth + 12, totalsY, rightCardWidth - 8, {
        bold: row.bold,
        color: row.color,
      });
      totalsY += 6;
    });

    cursorY += cardHeight + 10;

    if (payment.notes) {
      const noteLines = doc.splitTextToSize(payment.notes, contentWidth - 8);
      const notesHeight = 18 + noteLines.length * 4.4;
      cursorY = addPageIfNeeded(cursorY, notesHeight + 8);
      doc.setFillColor(255, 251, 235);
      doc.setDrawColor(253, 230, 138);
      doc.roundedRect(margin, cursorY, contentWidth, notesHeight, 3, 3, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...ink);
      doc.text('Notes', margin + 4, cursorY + 7);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...ink);
      doc.text(noteLines, margin + 4, cursorY + 15);
      cursorY += notesHeight + 10;
    }

    if (payment.transactions && payment.transactions.length > 0) {
      cursorY = addPageIfNeeded(cursorY, 18);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(...ink);
      doc.text('Payment Activity', margin, cursorY);
      cursorY += 6;

      payment.transactions.slice().reverse().forEach(transaction => {
        const noteLines = transaction.note ? doc.splitTextToSize(transaction.note, contentWidth - 40) : [];
        const rowHeight = 13 + noteLines.length * 4;
        cursorY = addPageIfNeeded(cursorY, rowHeight + 4);

        doc.setDrawColor(...border);
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(margin, cursorY, contentWidth, rowHeight, 2.5, 2.5, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(...ink);
        doc.text(transaction.type.replace('-', ' ').toUpperCase(), margin + 4, cursorY + 6);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(...muted);
        doc.text(`${formatPdfDate(transaction.date)} • ${transaction.method}`, margin + 4, cursorY + 11);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(transaction.amount < 0 ? 220 : 22, transaction.amount < 0 ? 38 : 163, transaction.amount < 0 ? 38 : 74);
        doc.text(formatCurrency(transaction.amount), pageWidth - margin - 4, cursorY + 8, { align: 'right' });
        if (noteLines.length > 0) {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8);
          doc.setTextColor(...muted);
          doc.text(noteLines, margin + 4, cursorY + 16);
        }
        cursorY += rowHeight + 4;
      });
    }

    cursorY = addPageIfNeeded(cursorY, 16);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...ink);
    doc.text(`Thank you for choosing ${businessName}.`, margin, cursorY);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...muted);
    doc.text('Please keep this receipt for your records.', margin, cursorY + 5);

    const pageCount = doc.getNumberOfPages();
    for (let page = 1; page <= pageCount; page += 1) {
      doc.setPage(page);
      doc.setDrawColor(...border);
      doc.setLineWidth(0.2);
      doc.line(margin, pageHeight - 17, pageWidth - margin, pageHeight - 17);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...muted);
      doc.text([businessName, receiptPhone, receiptWebsite].filter(Boolean).join(' | '), margin, pageHeight - 10);
      doc.text(`Page ${page} of ${pageCount}`, pageWidth - margin, pageHeight - 10, { align: 'right' });
    }

    return doc;
  };

  const createPdfDocument = async () => {
    setIsPdfGenerating(true);
    try {
      return await generatePdf();
    } finally {
      setIsPdfGenerating(false);
    }
  };

  const handleDownloadPdf = async () => {
    const doc = await createPdfDocument();
    doc.save(getPdfFilename());
  };

  const handleViewPdf = async () => {
    const doc = await createPdfDocument();
    const pdfBlob = doc.output('blob');
    const nextUrl = URL.createObjectURL(pdfBlob);
    setPdfPreviewUrl(nextUrl);
    setIsPdfPreviewOpen(true);
  };

  const handlePrintPdf = async () => {
    const doc = await createPdfDocument();
    doc.autoPrint();
    const pdfUrl = doc.output('bloburl');
    window.open(pdfUrl, '_blank');

  };

  const handlePdfPreviewOpenChange = (open: boolean) => {
    setIsPdfPreviewOpen(open);
    if (!open) {
      setPdfPreviewUrl('');
    }
  };

  const getStatusVariant = () => {
    switch (payment.status) {
        case 'paid': return 'default';
        case 'unpaid': return 'destructive';
        default: return 'outline';
    }
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl">{payment.studentName}</DialogTitle>
            <DialogDescription>
              Payment on {format(new Date(payment.paymentDate), 'MMMM d, yyyy')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                  <InfoItem label="Total Amount" value={formatCurrency(payment.total)} />
                  <InfoItem label="Payment Method" value={payment.paymentMethod} />
              </div>
               <InfoItem label="Status">
                  <Badge variant={getStatusVariant()} className="capitalize">{payment.status.replace('-', ' ')}</Badge>
              </InfoItem>

              {payment.notes && (
                  <InfoItem icon={Info} label="Notes">
                      <p className="text-sm text-foreground whitespace-pre-wrap">{payment.notes}</p>
                  </InfoItem>
              )}

              <Separator />

              <div>
                  <h3 className="font-semibold mb-3">Items Billed</h3>
                  <ScrollArea className="h-[150px] border rounded-md p-4">
                      <div className="space-y-3">
                          {payment.items.map((item) => {
                              const itemDate = new Date(item.date);
                              const displayDate = isValid(itemDate) ? itemDate : new Date(payment.paymentDate);
                              const quantity = item.quantity || 1;
                              const lineTotal = item.price * quantity;
                              return (
                                  <div key={item.billItemId} className="flex justify-between items-start gap-4">
                                      <div>
                                          <p className="font-medium">{item.name}</p>
                                          {!!item.packageItems?.length && (
                                            <p className="text-xs text-muted-foreground">
                                              Includes: {formatPackageContents(item.packageItems)}
                                            </p>
                                          )}
                                          <p className="text-xs text-muted-foreground">{format(displayDate, 'MMM d, yyyy')}</p>
                                          <p className="text-xs text-muted-foreground">
                                            {quantity} x {formatCurrency(item.price)}
                                          </p>
                                      </div>
                                      <span className="font-medium">{formatCurrency(lineTotal)}</span>
                                  </div>
                              );
                          })}
                      </div>
                  </ScrollArea>
                  <div className="mt-4 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span className="font-medium">{formatCurrency(payment.subtotal)}</span>
                    </div>
                    {payment.discount > 0 && (
                      <div className="flex justify-between text-green-600">
                        <span className="text-muted-foreground flex items-center gap-1"><Percent className="h-4 w-4"/> Discount</span>
                        <span className="font-medium">-{formatCurrency(payment.discount)}</span>
                      </div>
                    )}
                    {payment.tax > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{detailTaxLabel}</span>
                        <span className="font-medium">{formatCurrency(payment.tax)}</span>
                      </div>
                    )}
                    <Separator />
                    <div className="flex justify-between text-base font-bold">
                      <span>Total Bill</span>
                      <span>{formatCurrency(payment.total)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Amount Paid</span>
                      <span className="font-medium">{formatCurrency(payment.paidAmount)}</span>
                    </div>
                    {(payment.creditApplied || 0) > 0 && (
                      <div className="flex justify-between text-emerald-700">
                        <span>Advance Credit Used</span>
                        <span className="font-medium">-{formatCurrency(payment.creditApplied || 0)}</span>
                      </div>
                    )}
                    <div className={cn("flex justify-between font-bold", payment.amountDue > 0 ? 'text-destructive' : 'text-green-600')}>
                      <span>Amount Due</span>
                      <span>{formatCurrency(payment.amountDue)}</span>
                    </div>
                  </div>
              </div>
              {payment.transactions && payment.transactions.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-3">Payment Activity</h3>
                  <div className="space-y-2 rounded-md border p-3">
                    {payment.transactions.slice().reverse().map(transaction => (
                      <div key={transaction.id} className="flex items-start justify-between gap-3 text-sm">
                        <div>
                          <p className="font-medium capitalize">{transaction.type.replace('-', ' ')}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(transaction.date), 'MMM d, yyyy')} • {transaction.method}
                          </p>
                          {transaction.note && <p className="text-xs text-muted-foreground">{transaction.note}</p>}
                        </div>
                        <span className={cn("font-semibold", transaction.amount < 0 ? 'text-destructive' : 'text-emerald-700')}>
                          {formatCurrency(transaction.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
              <Button variant="outline" onClick={handleEdit}>
                  <Edit className="mr-2 h-4 w-4" />
                  Edit
              </Button>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button variant="outline" onClick={handlePrintPdf} disabled={isPdfGenerating}>
                    <Printer className="mr-2 h-4 w-4" />
                    Print
                </Button>
                <Button variant="outline" onClick={handleDownloadPdf} disabled={isPdfGenerating}>
                    <Download className="mr-2 h-4 w-4" />
                    Download
                </Button>
                <Button onClick={handleViewPdf} disabled={isPdfGenerating}>
                    <Eye className="mr-2 h-4 w-4" />
                    {isPdfGenerating ? 'Preparing...' : 'View PDF'}
                </Button>
              </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isPdfPreviewOpen} onOpenChange={handlePdfPreviewOpenChange}>
        <DialogContent className="flex h-[92vh] max-w-5xl flex-col overflow-hidden p-0 sm:max-w-5xl">
          <DialogHeader className="border-b px-4 py-3 sm:px-6">
            <DialogTitle>Receipt Preview</DialogTitle>
            <DialogDescription>
              Review the PDF receipt before downloading it.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 bg-muted p-2 sm:p-4">
            {pdfPreviewUrl ? (
              <iframe
                src={pdfPreviewUrl}
                title={`Receipt preview for ${payment.studentName}`}
                className="h-full w-full rounded-lg border bg-background"
              />
            ) : (
              <div className="flex h-full items-center justify-center rounded-lg border bg-background text-sm text-muted-foreground">
                Preparing PDF preview...
              </div>
            )}
          </div>
          <DialogFooter className="border-t px-4 py-3 sm:px-6">
            <Button variant="outline" onClick={handlePrintPdf} disabled={isPdfGenerating}>
              <Printer className="mr-2 h-4 w-4" />
              Print
            </Button>
            <Button onClick={handleDownloadPdf} disabled={isPdfGenerating}>
              <Download className="mr-2 h-4 w-4" />
              {isPdfGenerating ? 'Preparing...' : 'Download PDF'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

const InfoItem = ({ label, value, children, icon: Icon }: { label: string; value?: string, children?: React.ReactNode, icon?: React.ElementType }) => (
    <div>
      <div className="flex items-center gap-2">
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
      </div>
      {value && <p className="text-lg font-semibold mt-1">{value}</p>}
      {children}
    </div>
);
