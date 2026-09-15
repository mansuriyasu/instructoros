import Link from 'next/link';
import { MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StudentGrid } from '../_components/student-grid';

export default function StudentsPage() {
  return <><div className="mb-3 flex justify-end"><Button asChild variant="outline" size="sm"><Link href="/app/students/map"><MapPin className="mr-2 h-4 w-4" />Student Map</Link></Button></div><StudentGrid /></>;
}
