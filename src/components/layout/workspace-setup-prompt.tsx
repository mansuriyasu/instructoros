"use client";

import { FormEvent, useEffect, useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { Building2, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useFirestore, useSession } from "@/firebase";
import { useToast } from "@/hooks/use-toast";

export function WorkspaceSetupPrompt() {
  const firestore = useFirestore();
  const { tenant, activeTenantId, canManageTenant } = useSession();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState({
    workspaceName: "",
    businessName: "",
    messageSenderName: "",
    phone: "",
    email: "",
    website: "",
    address: "",
  });

  const shouldOpen = Boolean(
    canManageTenant
    && tenant
    && activeTenantId
    && !tenant.profileSetupCompletedAt
  );

  useEffect(() => {
    if (!tenant) return;
    setForm({
      workspaceName: tenant.name || "",
      businessName: tenant.receiptBusinessName || tenant.name || "",
      messageSenderName: tenant.messageSenderName || tenant.receiptBusinessName || tenant.name || "",
      phone: tenant.receiptPhone || "",
      email: tenant.receiptEmail || tenant.ownerEmail || "",
      website: tenant.receiptWebsite || "",
      address: tenant.receiptAddress || "",
    });
  }, [tenant]);

  const updateField = (key: keyof typeof form, value: string) => {
    setForm(current => ({ ...current, [key]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!activeTenantId) return;

    const businessName = form.businessName.trim();
    const messageSenderName = form.messageSenderName.trim();
    const receiptEmail = form.email.trim();

    if (!businessName || !messageSenderName || !receiptEmail) {
      toast({
        variant: "destructive",
        title: "Please complete the required fields.",
        description: "Business name, message name, and email are needed for invoices and student messages.",
      });
      return;
    }

    setIsSaving(true);
    try {
      await updateDoc(doc(firestore, "tenants", activeTenantId), {
        name: form.workspaceName.trim() || businessName,
        receiptBusinessName: businessName,
        messageSenderName,
        receiptPhone: form.phone.trim(),
        receiptEmail,
        receiptWebsite: form.website.trim(),
        receiptAddress: form.address.trim(),
        profileSetupCompletedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      toast({ title: "Workspace details saved." });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Could not save setup",
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={shouldOpen}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl" hideCloseButton>
        <DialogHeader>
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F4C430] text-[#0D1B2A]">
            <Building2 className="h-6 w-6" />
          </div>
          <DialogTitle>Set up your business details</DialogTitle>
          <DialogDescription>
            These details belong to your school or instructor business. They will be used on invoices, receipts, and student WhatsApp messages.
          </DialogDescription>
        </DialogHeader>

        <form className="grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="setupWorkspaceName">Workspace name</Label>
            <Input
              id="setupWorkspaceName"
              value={form.workspaceName}
              onChange={event => updateField("workspaceName", event.target.value)}
              placeholder={tenant?.type === "school" ? "School workspace name" : "Instructor workspace name"}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="setupBusinessName">
              {tenant?.type === "school" ? "Legal school / business name" : "Legal business or personal name"}
            </Label>
            <Input
              id="setupBusinessName"
              value={form.businessName}
              onChange={event => updateField("businessName", event.target.value)}
              placeholder={tenant?.type === "school" ? "Example Driving School Inc." : "Your name or business name"}
              required
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="setupMessageSenderName">Name shown in student messages</Label>
            <Input
              id="setupMessageSenderName"
              value={form.messageSenderName}
              onChange={event => updateField("messageSenderName", event.target.value)}
              placeholder={tenant?.type === "school" ? "Your school name" : "Your instructor name"}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="setupPhone">Phone</Label>
            <Input id="setupPhone" value={form.phone} onChange={event => updateField("phone", event.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="setupEmail">Email for receipts</Label>
            <Input
              id="setupEmail"
              type="email"
              value={form.email}
              onChange={event => updateField("email", event.target.value)}
              required
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="setupWebsite">Website or social link</Label>
            <Input id="setupWebsite" value={form.website} onChange={event => updateField("website", event.target.value)} />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="setupAddress">Business address for invoices</Label>
            <Textarea
              id="setupAddress"
              value={form.address}
              onChange={event => updateField("address", event.target.value)}
              className="min-h-20"
            />
          </div>

          <div className="sm:col-span-2">
            <Button type="submit" className="w-full" disabled={isSaving}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save and continue
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
