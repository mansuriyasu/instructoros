'use client';

import { useMemo, useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Payment } from '@/lib/types';
import { format } from 'date-fns';
import { formatCurrency } from '@/lib/utils';
import {
  AlertCircle,
  ArrowUpDown,
  CalendarIcon,
  Download,
  Eye,
  MessageCircle,
  Pencil,
  ReceiptText,
  Search,
  Trash2,
  WalletCards,
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useRouter } from 'next/navigation';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DateRange } from 'react-day-picker';
import { endOfDay } from 'date-fns';
import { useStudents } from '@/hooks/use-students';
import { useToast } from '@/hooks/use-toast';

interface PaymentsDataTableProps {
  payments: Payment[];
  statusFilter: 'all' | 'paid' | 'unpaid';
  setStatusFilter: (status: 'all' | 'paid' | 'unpaid') => void;
  onRecordPayment: (payment: Payment) => void;
  onDelete: (paymentId: string) => void;
  onViewDetails: (payment: Payment) => void;
  onUpdatePayment: (payment: Payment) => void;
  dateRange?: DateRange;
}

type SortKey = 'studentName' | 'total' | 'paymentDate' | 'amountDue' | 'totalCost';
type SortDirection = 'asc' | 'desc';

interface SortConfig {
  key: SortKey;
  direction: SortDirection;
}

const ITEMS_PER_PAGE = 10;

function formatPaymentDate(date: string) {
  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) return 'No date';
  return format(parsedDate, 'MMM dd, yyyy');
}

function getStatusVariant(status: Payment['status'], isPartial: boolean) {
  if (isPartial) return 'warning';
  return status === 'paid' ? 'default' : 'destructive';
}

function DeletePaymentButton({
  payment,
  onDelete,
  compact = false,
}: {
  payment: Payment;
  onDelete: (paymentId: string) => void;
  compact?: boolean;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size={compact ? 'sm' : 'icon'}
          className={cn('text-destructive hover:text-destructive', compact && 'h-9 px-3')}
          onClick={(event) => event.stopPropagation()}
        >
          <Trash2 className={cn('h-4 w-4', compact && 'mr-2')} />
          {compact ? 'Delete' : <span className="sr-only">Delete</span>}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this payment?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete the payment record for {payment.studentName}.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={(event) => event.stopPropagation()}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(event) => {
              event.stopPropagation();
              onDelete(payment.id);
            }}
            className="bg-destructive hover:bg-destructive/90"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function PaymentsDataTable({
  payments,
  statusFilter,
  setStatusFilter,
  onRecordPayment,
  onDelete,
  onViewDetails,
  onUpdatePayment,
  dateRange,
}: PaymentsDataTableProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { students } = useStudents();
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'paymentDate', direction: 'desc' });

  const filteredPayments = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();
    
    // Default to All Time if no dateRange.from is provided.
    const from = dateRange?.from;
    const to = dateRange?.to || from;

    return (payments || []).filter((payment) => {
      let matchesDate = true;
      // Always show all unpaid records regardless of the selected date range
      if (from && statusFilter !== 'unpaid') {
        const pDate = new Date(payment.paymentDate);
        matchesDate = pDate >= from && pDate <= endOfDay(to!);
      }

      const matchesStatus = statusFilter === 'all' || payment.status === statusFilter;
      const matchesSearch =
        !normalizedSearch ||
        payment.studentName.toLowerCase().includes(normalizedSearch) ||
        payment.paymentMethod.toLowerCase().includes(normalizedSearch) ||
        payment.items?.some((item) => item.name.toLowerCase().includes(normalizedSearch));

      return matchesStatus && matchesSearch && matchesDate;
    });
  }, [payments, searchQuery, statusFilter, dateRange]);

  const sortedPayments = useMemo(() => {
    const sortablePayments = [...filteredPayments];
    sortablePayments.sort((a, b) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];

      let comparison = 0;
      if (sortConfig.key === 'paymentDate') {
        comparison = new Date(a.paymentDate).getTime() - new Date(b.paymentDate).getTime();
      } else if (typeof aValue === 'string' && typeof bValue === 'string') {
        comparison = aValue.localeCompare(bValue);
      } else if (typeof aValue === 'number' && typeof bValue === 'number') {
        comparison = aValue - bValue;
      }

      return sortConfig.direction === 'asc' ? comparison : -comparison;
    });
    return sortablePayments;
  }, [filteredPayments, sortConfig]);

  const totalPages = Math.max(1, Math.ceil(sortedPayments.length / ITEMS_PER_PAGE));

  const paginatedPayments = useMemo(() => {
    const safePage = Math.min(currentPage, totalPages);
    const startIndex = (safePage - 1) * ITEMS_PER_PAGE;
    return sortedPayments.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [currentPage, sortedPayments, totalPages]);

  const handleSort = (key: SortKey) => {
    const direction = sortConfig.key === key && sortConfig.direction === 'asc' ? 'desc' : 'asc';
    setSortConfig({ key, direction });
    setCurrentPage(1);
  };

  const handleSortSelect = (value: string) => {
    const [key, direction] = value.split(':') as [SortKey, SortDirection];
    setSortConfig({ key, direction });
    setCurrentPage(1);
  };

  const handleEditClick = (payment: Payment) => {
    router.push(`/app/payments?edit=${payment.id}`);
  };

  const handleDateChange = (payment: Payment, date: Date | undefined) => {
    if (date) {
      onUpdatePayment({ ...payment, paymentDate: date.toISOString() });
    }
  };

  const handleFilterChange = (value: string) => {
    setStatusFilter(value as 'all' | 'paid' | 'unpaid');
    setCurrentPage(1);
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  const handleExportCSV = () => {
    if (sortedPayments.length === 0) {
      toast({ title: 'No payments to export.' });
      return;
    }

    const headers = ['Date', 'Student Name', 'Services', 'Total', 'Total Cost', 'Paid Amount', 'Amount Due', 'Status', 'Payment Method'];
    
    const escapeCSV = (value: any) => {
      if (value === null || value === undefined) return '';
      const str = String(value);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = sortedPayments.map(p => {
      const services = p.items?.map(i => i.name).join('; ') || '';
      return [
        formatPaymentDate(p.paymentDate),
        p.studentName,
        services,
        p.total,
        p.totalCost || 0,
        p.paidAmount || 0,
        p.amountDue || 0,
        p.status,
        p.paymentMethod
      ].map(escapeCSV).join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `payments_export_${format(new Date(), 'yyyyMMdd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSendWhatsApp = (payment: Payment) => {
    const student = students?.find(s => s.id === payment.studentId);
    if (!student || !student.mobileNumber) {
      toast({ variant: 'destructive', title: 'Error', description: 'Student not found or missing mobile number.' });
      return;
    }
    
    const services = payment.items?.map(i => i.name).join(', ') || 'driving lessons';
    const isPartial = payment.amountDue > 0 && payment.paidAmount > 0;
    
    let message = '';
    if (payment.status === 'paid') {
      message = `Hi ${payment.studentName},\n\nThank you for your payment of $${payment.total} for ${services}.\n\nHere is your receipt confirmation. Drive safely!\n\nInstructorOS`;
    } else {
      const balanceType = isPartial ? 'remaining balance' : 'outstanding balance';
      message = `Hi ${payment.studentName},\n\nThis is a gentle reminder that there is an ${balanceType} of $${payment.amountDue} for your ${services}.\n\nPlease let us know if you have any questions!\n\nInstructorOS`;
    }

    const cleanedNumber = student.mobileNumber.replace(/\D/g, '');
    const url = `https://api.whatsapp.com/send?phone=1${cleanedNumber}&text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  return (
    <section className="space-y-4">
      <div className="space-y-3 rounded-lg border bg-card p-3 lg:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <Tabs value={statusFilter} onValueChange={handleFilterChange} className="w-full lg:w-auto">
            <TabsList className="grid h-11 w-full grid-cols-3 lg:w-auto">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="unpaid">Due</TabsTrigger>
              <TabsTrigger value="paid">Paid</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="grid gap-2 sm:grid-cols-[1fr_180px_auto] lg:w-[620px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(event) => handleSearchChange(event.target.value)}
                placeholder="Search student or service"
                className="h-11 pl-9"
              />
            </div>
            <Select value={`${sortConfig.key}:${sortConfig.direction}`} onValueChange={handleSortSelect}>
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="paymentDate:desc">Newest first</SelectItem>
                <SelectItem value="paymentDate:asc">Oldest first</SelectItem>
                <SelectItem value="studentName:asc">Student A-Z</SelectItem>
                <SelectItem value="amountDue:desc">Most due</SelectItem>
                <SelectItem value="total:desc">Highest total</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" className="h-11 px-3" onClick={handleExportCSV}>
              <Download className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Export</span>
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{sortedPayments.length} payment{sortedPayments.length === 1 ? '' : 's'}</span>
          <span>Page {Math.min(currentPage, totalPages)} of {totalPages}</span>
        </div>
      </div>

      <div className="space-y-3 lg:hidden">
        {paginatedPayments.length === 0 ? (
          <Card className="rounded-lg">
            <CardContent className="flex min-h-48 flex-col items-center justify-center p-6 text-center">
              <ReceiptText className="mb-3 h-8 w-8 text-muted-foreground" />
              <h3 className="font-semibold">No payments found</h3>
              <p className="mt-1 text-sm text-muted-foreground">Try a different search or filter.</p>
            </CardContent>
          </Card>
        ) : (
          paginatedPayments.map((payment) => (
            <Card key={payment.id} className="rounded-lg">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-base font-semibold">{payment.studentName}</h3>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <CalendarIcon className="h-3.5 w-3.5" />
                        {formatPaymentDate(payment.paymentDate)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <WalletCards className="h-3.5 w-3.5" />
                        {payment.paymentMethod}
                      </span>
                    </div>
                  </div>
                  <Badge variant={getStatusVariant(payment.status, payment.amountDue > 0 && payment.paidAmount > 0)} className="shrink-0 capitalize">
                    {payment.amountDue > 0 && payment.paidAmount > 0 ? 'Partial' : payment.status}
                  </Badge>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2 rounded-md bg-muted/50 p-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Total</p>
                    <p className="mt-1 font-semibold">{formatCurrency(payment.total)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Paid</p>
                    <p className="mt-1 font-semibold">{formatCurrency(payment.paidAmount || 0)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Due</p>
                    <p className={cn('mt-1 font-semibold', payment.amountDue > 0 && 'text-destructive')}>
                      {formatCurrency(payment.amountDue || 0)}
                    </p>
                  </div>
                </div>

                {payment.amountDue > 0 && (
                  <div className="mt-3 flex items-center gap-2 rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    Balance remaining: {formatCurrency(payment.amountDue)}
                  </div>
                )}

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Button variant="outline" size="sm" onClick={() => onViewDetails(payment)}>
                    <Eye className="mr-2 h-4 w-4" />
                    Details
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleEditClick(payment)}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit Bill
                  </Button>
                  {payment.status !== 'paid' && (
                    <Button size="sm" onClick={() => onRecordPayment(payment)}>
                      <WalletCards className="mr-2 h-4 w-4" />
                      Record
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => handleSendWhatsApp(payment)}>
                    <MessageCircle className="mr-2 h-4 w-4 text-emerald-600" />
                    WhatsApp
                  </Button>
                  <DeletePaymentButton payment={payment} onDelete={onDelete} compact />
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <div className="hidden rounded-lg border bg-card lg:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <Button variant="ghost" onClick={() => handleSort('paymentDate')}>
                  Date
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead>
                <Button variant="ghost" onClick={() => handleSort('studentName')}>
                  Student
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead>
                <Button variant="ghost" onClick={() => handleSort('total')}>
                  Amount
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead>
                <Button variant="ghost" onClick={() => handleSort('totalCost')}>
                  Cost
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead>
                <Button variant="ghost" onClick={() => handleSort('amountDue')}>
                  Balance Due
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedPayments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center">
                  No payments found.
                </TableCell>
              </TableRow>
            ) : (
              paginatedPayments.map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="ghost" className="pl-0 text-left font-normal">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {formatPaymentDate(payment.paymentDate)}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={new Date(payment.paymentDate)}
                          onSelect={(date) => handleDateChange(payment, date)}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </TableCell>
                  <TableCell onClick={() => handleEditClick(payment)} className="cursor-pointer font-medium">
                    {payment.studentName}
                  </TableCell>
                  <TableCell onClick={() => handleEditClick(payment)} className="cursor-pointer">
                    {formatCurrency(payment.total)}
                  </TableCell>
                  <TableCell onClick={() => handleEditClick(payment)} className="cursor-pointer">
                    {formatCurrency(payment.totalCost)}
                  </TableCell>
                  <TableCell
                    onClick={() => handleEditClick(payment)}
                    className={cn('cursor-pointer', payment.amountDue > 0 && 'text-destructive')}
                  >
                    {formatCurrency(payment.amountDue)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={getStatusVariant(payment.status, payment.amountDue > 0 && payment.paidAmount > 0)}
                      className="w-24 cursor-pointer justify-center capitalize"
                      onClick={() => {
                        if (payment.status !== 'paid') onRecordPayment(payment);
                      }}
                    >
                      {payment.amountDue > 0 && payment.paidAmount > 0 ? 'Partial' : payment.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <Button variant="ghost" size="icon" onClick={() => handleSendWhatsApp(payment)} title="Send WhatsApp">
                      <MessageCircle className="h-4 w-4 text-emerald-600" />
                      <span className="sr-only">WhatsApp</span>
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => onViewDetails(payment)} title="Details">
                      <Eye className="h-4 w-4" />
                      <span className="sr-only">Details</span>
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleEditClick(payment)} title="Edit">
                      <Pencil className="h-4 w-4" />
                      <span className="sr-only">Edit</span>
                    </Button>
                    <DeletePaymentButton payment={payment} onDelete={onDelete} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between rounded-lg border bg-card p-3">
          <Button variant="outline" size="sm" onClick={() => setCurrentPage((page) => Math.max(page - 1, 1))} disabled={currentPage === 1}>
            Previous
          </Button>
          <div className="text-sm font-medium">
            Page {Math.min(currentPage, totalPages)} of {totalPages}
          </div>
          <Button variant="outline" size="sm" onClick={() => setCurrentPage((page) => Math.min(page + 1, totalPages))} disabled={currentPage === totalPages}>
            Next
          </Button>
        </div>
      )}
    </section>
  );
}
