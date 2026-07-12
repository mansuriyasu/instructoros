import { Metadata } from 'next';
import { SettingsClientPage } from './_components/settings-client-page';

export const metadata: Metadata = {
  title: 'Settings',
  description: 'Manage workspace settings and import or export your data.',
};

export default function SettingsPage() {
  return <SettingsClientPage />;
}
