'use client';

import { useEffect, useMemo, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ImportExportClientPage } from './import-export-client-page';
import { WorkspaceProfileSettings } from './workspace-profile-settings';
import { StudentTagSettings } from './student-tag-settings';
import { CalendarDays, Database, Settings2 } from 'lucide-react';
import { useSession } from '@/firebase';
import { GoogleCalendarSettings } from './google-calendar-settings';

export function SettingsClientPage() {
  const { role } = useSession();
  const [tab, setTab] = useState('workspace');
  const canImportExport = role === 'schoolAdmin' || role === 'soloInstructor' || role === 'mainAdmin';
  const canManageWorkspace = role === 'schoolAdmin' || role === 'soloInstructor' || role === 'mainAdmin';
  const visibleTabs = useMemo(() => [
    { value: 'workspace', label: 'Workspace', icon: Settings2, visible: canManageWorkspace },
    { value: 'integrations', label: 'Integrations', icon: CalendarDays, visible: true },
    { value: 'import-export', label: 'Import / Export', icon: Database, visible: canImportExport },
  ].filter(item => item.visible), [canImportExport, canManageWorkspace]);

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
      <div className="rounded-[22px] border border-white/75 bg-card p-5 shadow-elevated sm:p-7">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl">
            Settings
          </h1>
          <p className="text-muted-foreground mt-2 max-w-xl">
            Manage your workspace, integrations, tags, and data tools from one place.
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
        <TabsList className="grid h-auto w-full max-w-3xl rounded-2xl bg-secondary/55 p-1 shadow-inner" style={{ gridTemplateColumns: `repeat(${visibleTabs.length}, minmax(0, 1fr))` }}>
          {visibleTabs.map(({ value, label, icon: Icon }) => (
            <TabsTrigger key={value} value={value} className="flex min-h-10 items-center justify-center gap-2 rounded-xl text-xs sm:text-sm">
              <Icon className="h-4 w-4" />
              <span>{label}</span>
            </TabsTrigger>
          ))}
        </TabsList>
        <div className="mt-6">
            <TabsContent value="workspace">
                {canManageWorkspace ? <div className="space-y-5"><WorkspaceProfileSettings /><StudentTagSettings /></div> : null}
            </TabsContent>
            <TabsContent value="import-export">
                {canImportExport ? <ImportExportClientPage /> : null}
            </TabsContent>
            <TabsContent value="integrations">
                <GoogleCalendarSettings />
            </TabsContent>
        </div>
        </>
        )}
      </Tabs>
    </div>
  );
}
