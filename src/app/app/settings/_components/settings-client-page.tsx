'use client';

import { useEffect, useMemo, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SmsLogsTable } from './sms-logs-table';
import { ImportExportClientPage } from './import-export-client-page';
import { WorkspaceProfileSettings } from './workspace-profile-settings';
import { ServiceList } from '../../services/_components/service-list';
import { BriefcaseBusiness, Database, MessageSquare, Settings2 } from 'lucide-react';
import { useSession } from '@/firebase';

export function SettingsClientPage() {
  const { role } = useSession();
  const [tab, setTab] = useState('workspace');
  const canManageServices = role === 'schoolAdmin' || role === 'soloInstructor' || role === 'mainAdmin';
  const canImportExport = role === 'schoolAdmin' || role === 'soloInstructor' || role === 'mainAdmin';
  const canManageWorkspace = role === 'schoolAdmin' || role === 'soloInstructor' || role === 'mainAdmin';
  const visibleTabs = useMemo(() => [
    { value: 'workspace', label: 'Workspace', icon: Settings2, visible: canManageWorkspace },
    { value: 'sms-logs', label: 'SMS Logs', icon: MessageSquare, visible: role !== 'schoolInstructor' },
    { value: 'services', label: 'Services', icon: BriefcaseBusiness, visible: canManageServices },
    { value: 'import-export', label: 'Import / Export', icon: Database, visible: canImportExport },
  ].filter(item => item.visible), [canImportExport, canManageServices, canManageWorkspace, role]);

  useEffect(() => {
    const requestedTab = new URLSearchParams(window.location.search).get('tab');
    if (visibleTabs.some(item => item.value === requestedTab)) {
      setTab(requestedTab || 'workspace');
    } else if (!visibleTabs.some(item => item.value === tab)) {
      setTab(visibleTabs[0]?.value || 'workspace');
    }
  }, [tab, visibleTabs]);

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
        {visibleTabs.length === 0 ? (
          <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
            Your school admin manages workspace settings and service configuration.
          </div>
        ) : (
        <>
        <TabsList className="grid w-full max-w-2xl" style={{ gridTemplateColumns: `repeat(${visibleTabs.length}, minmax(0, 1fr))` }}>
          {visibleTabs.map(({ value, label, icon: Icon }) => (
            <TabsTrigger key={value} value={value} className="flex items-center gap-2">
              <Icon className="h-4 w-4" />
              <span>{label}</span>
            </TabsTrigger>
          ))}
        </TabsList>
        <div className="mt-6">
            <TabsContent value="sms-logs">
                <SmsLogsTable />
            </TabsContent>
            <TabsContent value="workspace">
                {canManageWorkspace ? <WorkspaceProfileSettings /> : null}
            </TabsContent>
            <TabsContent value="services">
                {canManageServices ? <ServiceList /> : null}
            </TabsContent>
            <TabsContent value="import-export">
                {canImportExport ? <ImportExportClientPage /> : null}
            </TabsContent>
        </div>
        </>
        )}
      </Tabs>
    </div>
  );
}
