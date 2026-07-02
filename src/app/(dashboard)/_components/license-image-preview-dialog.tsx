'use client';

import { Download, FileImage } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface LicenseImagePreviewDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  imageUrl: string;
  studentName?: string;
  onDownload: () => void;
}

function isPdf(url: string) {
  return url.startsWith('data:application/pdf') || /\.pdf($|\?)/i.test(url);
}

export function LicenseImagePreviewDialog({
  isOpen,
  onOpenChange,
  imageUrl,
  studentName,
  onDownload,
}: LicenseImagePreviewDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-hidden rounded-2xl p-0">
        <DialogHeader className="border-b px-4 py-3">
          <DialogTitle className="flex items-center gap-2 text-base">
            <FileImage className="h-4 w-4" />
            {studentName ? `${studentName}'s license` : 'Saved license'}
          </DialogTitle>
        </DialogHeader>
        <div className="max-h-[72vh] overflow-auto bg-muted/30 p-3">
          {imageUrl ? (
            isPdf(imageUrl) ? (
              <iframe
                src={imageUrl}
                title="Saved license preview"
                className="h-[70vh] w-full rounded-xl border bg-white"
              />
            ) : (
              <img
                src={imageUrl}
                alt="Saved license preview"
                className="mx-auto max-h-[70vh] w-auto max-w-full rounded-xl bg-white object-contain shadow-sm"
              />
            )
          ) : (
            <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              No license image is saved yet.
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t px-4 py-3">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button type="button" onClick={onDownload} disabled={!imageUrl}>
            <Download className="mr-2 h-4 w-4" />
            Download
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
