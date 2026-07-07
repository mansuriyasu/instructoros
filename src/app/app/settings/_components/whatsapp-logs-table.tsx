'use client';

import { useWhatsAppLogs } from '@/hooks/use-whatsapp-logs';
import { format } from 'date-fns';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, CheckCircle2, XCircle, MessageCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export function WhatsAppLogsTable() {
  const { whatsAppLogs, loading } = useWhatsAppLogs();

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!whatsAppLogs || whatsAppLogs.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center p-12 text-center">
          <p className="text-lg font-medium text-muted-foreground">No WhatsApp activity found</p>
          <p className="text-sm text-muted-foreground mt-1">
            WhatsApp messages opened from InstructorOS will appear here.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>WhatsApp Activity</CardTitle>
        <CardDescription>A log of WhatsApp messages opened from the app.</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[600px] rounded-md border">
          <Table>
            <TableHeader className="sticky top-0 bg-background/95 backdrop-blur z-10 shadow-sm">
              <TableRow>
                <TableHead className="w-[180px]">Date & Time</TableHead>
                <TableHead className="w-[150px]">To</TableHead>
                <TableHead>Message</TableHead>
                <TableHead className="w-[120px]">Channel</TableHead>
                <TableHead className="w-[100px] text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {whatsAppLogs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="font-medium whitespace-nowrap">
                    {format(new Date(log.date), 'MMM d, yyyy')}
                    <div className="text-xs text-muted-foreground">
                      {format(new Date(log.date), 'h:mm a')}
                    </div>
                  </TableCell>
                  <TableCell>{log.to}</TableCell>
                  <TableCell className="max-w-[300px]">
                    <div className="text-sm whitespace-pre-wrap break-words text-muted-foreground leading-relaxed">
                      {log.body}
                    </div>
                    {log.status === 'error' && log.errorMessage && (
                      <div className="text-xs text-red-500 mt-2 font-medium">
                        Error: {log.errorMessage}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1.5 items-start">
                      {log.channel === 'whatsapp' ? (
                        <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-200">
                          <MessageCircle className="h-3 w-3 mr-1" />
                          WhatsApp
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-200">
                          <MessageCircle className="h-3 w-3 mr-1" />
                          WhatsApp
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    {log.status === 'sent' ? (
                      <div className="flex items-center justify-end text-green-600 gap-1.5">
                        <CheckCircle2 className="h-4 w-4" />
                        <span className="text-sm font-medium">Opened</span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end text-red-500 gap-1.5">
                        <XCircle className="h-4 w-4" />
                        <span className="text-sm font-medium">Failed</span>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
