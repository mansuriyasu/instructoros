import { redirect } from 'next/navigation';

export default function ServicesPage() {
    redirect('/app/settings?tab=services');
}
