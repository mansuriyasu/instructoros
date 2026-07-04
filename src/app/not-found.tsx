import Link from 'next/link';
import { Compass } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function NotFoundPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md rounded-xl">
        <CardContent className="space-y-5 p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <Compass className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black">Page not found</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              This page does not exist, or it moved to the app workspace.
            </p>
          </div>
          <Button asChild className="w-full rounded-lg">
            <Link href="/app">Open app</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
