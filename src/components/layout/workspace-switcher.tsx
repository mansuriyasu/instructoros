"use client";

import { useEffect, useMemo, useState } from "react";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { Building2, Loader2, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useFirestore, useSession, useUser } from "@/firebase";
import type { Tenant } from "@/lib/auth-config";
import { cn } from "@/lib/utils";

type WorkspaceSwitcherProps = {
  variant?: "sidebar" | "menu";
};

type WorkspaceOption = Pick<Tenant, "id" | "name" | "type" | "status">;

export function WorkspaceSwitcher({ variant = "sidebar" }: WorkspaceSwitcherProps) {
  const firestore = useFirestore();
  const { user } = useUser();
  const { profile, tenant, activeTenantId } = useSession();
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState<WorkspaceOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [switchingTo, setSwitchingTo] = useState("");

  const tenantIds = useMemo(() => {
    const ids = profile?.tenantIds || [];
    return Array.from(new Set(ids.filter(Boolean)));
  }, [profile?.tenantIds]);

  useEffect(() => {
    let cancelled = false;

    async function loadWorkspaces() {
      if (!tenantIds.length) {
        setWorkspaces([]);
        return;
      }

      setIsLoading(true);
      try {
        const loaded = await Promise.all(
          tenantIds.map(async tenantId => {
            try {
              const snapshot = await getDoc(doc(firestore, "tenants", tenantId));
              if (!snapshot.exists()) return null;
              const data = snapshot.data() as Tenant;
              return {
                id: snapshot.id,
                name: data.name,
                type: data.type,
                status: data.status,
              } satisfies WorkspaceOption;
            } catch {
              return null;
            }
          })
        );

        if (!cancelled) {
          setWorkspaces(loaded.filter(Boolean) as WorkspaceOption[]);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void loadWorkspaces();

    return () => {
      cancelled = true;
    };
  }, [firestore, tenantIds]);

  const visibleWorkspaces = workspaces.length ? workspaces : tenant ? [{
    id: tenant.id,
    name: tenant.name,
    type: tenant.type,
    status: tenant.status,
  }] : [];

  if (!user || visibleWorkspaces.length <= 1) {
    return null;
  }

  const switchWorkspace = async (tenantId: string) => {
    if (!tenantId || tenantId === activeTenantId || switchingTo) return;

    setSwitchingTo(tenantId);
    try {
      await updateDoc(doc(firestore, "users", user.uid), {
        activeTenantId: tenantId,
        updatedAt: new Date().toISOString(),
      });
      router.push("/app");
    } finally {
      setSwitchingTo("");
    }
  };

  if (variant === "menu") {
    return (
      <div className="border-t p-2">
        <p className="px-2 pb-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">Workspace</p>
        <div className="space-y-1">
          {visibleWorkspaces.map(workspace => {
            const Icon = workspace.type === "school" ? Building2 : UserRound;
            const isActive = workspace.id === activeTenantId;
            return (
              <button
                key={workspace.id}
                type="button"
                onClick={() => switchWorkspace(workspace.id)}
                disabled={isActive || Boolean(switchingTo)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition",
                  isActive ? "bg-[#FFF8D8] font-bold text-[#111827]" : "hover:bg-muted"
                )}
              >
                {switchingTo === workspace.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{workspace.name}</span>
                  <span className="block text-xs font-medium text-muted-foreground">
                    {workspace.type === "school" ? "School" : "Personal"}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-[14px] mb-2 rounded-[14px] border border-[#ECECEC] bg-white p-2">
      <div className="mb-1 flex items-center justify-between px-1">
        <p className="text-[11px] font-bold uppercase tracking-wide text-[#8A8E96]">Workspace</p>
        {isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-[#8A8E96]" />}
      </div>
      <div className="space-y-1">
        {visibleWorkspaces.map(workspace => {
          const Icon = workspace.type === "school" ? Building2 : UserRound;
          const isActive = workspace.id === activeTenantId;
          return (
            <button
              key={workspace.id}
              type="button"
              onClick={() => switchWorkspace(workspace.id)}
              disabled={isActive || Boolean(switchingTo)}
              className={cn(
                "flex w-full items-center gap-2 rounded-[10px] px-2 py-2 text-left transition",
                isActive ? "bg-[#FFF8D8]" : "hover:bg-[#F7F7F6]"
              )}
            >
              {switchingTo === workspace.id ? (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#191B20]" />
              ) : (
                <Icon className="h-4 w-4 shrink-0 text-[#191B20]" />
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12px] font-bold text-[#191B20]">{workspace.name}</span>
                <span className="block text-[11px] text-[#8A8E96]">{workspace.type === "school" ? "School" : "Personal"}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
