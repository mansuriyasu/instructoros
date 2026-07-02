'use client';

import { useEffect, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SmsLogsTable } from './sms-logs-table';
import { ImportExportClientPage } from './import-export-client-page';
import { ServiceList } from '../../services/_components/service-list';
import { BriefcaseBusiness, Database, MessageSquare } from 'lucide-react';

export function SettingsClientPage() {
  const [tab, setTab] = useState('sms-logs');

  useEffect(() => {
    const requestedTab = new URLSearchParams(window.location.search).get('tab');
    if (requestedTab === 'import-export' || requestedTab === 'sms-logs' || requestedTab === 'services') {
      setTab(requestedTab);
    }
  }, []);

  return (
    <div className="space-y-6">
      <div className="bg-card rounded-2xl p-8 border shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Settings & Data
          </h1>
          <p className="text-muted-foreground mt-2 max-w-xl">
            Manage your app settings, view automated text message history, and backup or restore your data securely.
          </p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="grid w-full max-w-2xl grid-cols-3">
          <TabsTrigger value="sms-logs" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            <span>SMS Logs</span>
          </TabsTrigger>
          <TabsTrigger value="services" className="flex items-center gap-2">
            <BriefcaseBusiness className="h-4 w-4" />
            <span>Services</span>
          </TabsTrigger>
          <TabsTrigger value="import-export" className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            <span>Import / Export</span>
          </TabsTrigger>
        </TabsList>
        <div className="mt-6">
            <TabsContent value="sms-logs">
                <SmsLogsTable />
            </TabsContent>
            <TabsContent value="services">
                <ServiceList />
            </TabsContent>
            <TabsContent value="import-export">
                <ImportExportClientPage />
            </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
