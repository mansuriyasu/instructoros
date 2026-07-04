import { Metadata } from 'next';
import { SettingsClientPage } from './_components/settings-client-page';

export const metadata: Metadata = {
  title: 'Settings',
  description: 'Manage app settings, view SMS logs, and import/export data.',
};

export default function SettingsPage() {
  return <SettingsClientPage />;
}
