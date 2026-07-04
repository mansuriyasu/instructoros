'use client';

import { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { Building2, Image as ImageIcon, Loader2, RotateCcw, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useFirestore, useSession } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { compressImage } from '@/lib/image-utils';
import { DEFAULT_TAX_LABEL, ONTARIO_HST_RATE, formatTaxLabel } from '@/lib/tax';

export function WorkspaceProfileSettings() {
  const firestore = useFirestore();
  const { tenant, activeTenantId, canManageTenant } = useSession();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [isPreparingLogo, setIsPreparingLogo] = useState(false);
  const [form, setForm] = useState({
    name: '',
    receiptBusinessName: '',
    receiptLogoDataUrl: '',
    receiptPhone: '',
    receiptEmail: '',
    receiptWebsite: '',
    receiptAddress: '',
    hstNumber: '',
    taxLabel: DEFAULT_TAX_LABEL,
    taxRatePercent: String(ONTARIO_HST_RATE * 100),
    taxEnabledByDefault: false,
  });

  useEffect(() => {
    if (!tenant) return;
    setForm({
      name: tenant.name || '',
      receiptBusinessName: tenant.receiptBusinessName || tenant.name || '',
      receiptLogoDataUrl: tenant.receiptLogoDataUrl || '',
      receiptPhone: tenant.receiptPhone || '',
      receiptEmail: tenant.receiptEmail || tenant.ownerEmail || '',
      receiptWebsite: tenant.receiptWebsite || 'www.instructoros.ca',
      receiptAddress: tenant.receiptAddress || '',
      hstNumber: tenant.hstNumber || '',
      taxLabel: tenant.taxLabel || DEFAULT_TAX_LABEL,
      taxRatePercent: String(((tenant.taxRate ?? ONTARIO_HST_RATE) * 100).toFixed(2).replace(/\.00$/, '')),
      taxEnabledByDefault: Boolean(tenant.taxEnabledByDefault),
    });
  }, [tenant]);

  const updateField = (key: keyof typeof form, value: string | boolean) => {
    setForm(current => ({ ...current, [key]: value }));
  };

  const handleLogoChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsPreparingLogo(true);
    try {
      const dataUri = await compressImage(file, 600, 0.72);
      updateField('receiptLogoDataUrl', dataUri);
    } catch {
      toast({ variant: 'destructive', title: 'Logo could not be prepared.' });
    } finally {
      setIsPreparingLogo(false);
      event.target.value = '';
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!activeTenantId || !canManageTenant) return;

    const taxRatePercent = Number(form.taxRatePercent);
    if (!Number.isFinite(taxRatePercent) || taxRatePercent < 0 || taxRatePercent > 30) {
      toast({ variant: 'destructive', title: 'Enter a valid tax rate percentage.' });
      return;
    }

    setIsSaving(true);
    try {
      await updateDoc(doc(firestore, 'tenants', activeTenantId), {
        name: form.name.trim(),
        receiptBusinessName: form.receiptBusinessName.trim(),
        receiptLogoDataUrl: form.receiptLogoDataUrl,
        receiptPhone: form.receiptPhone.trim(),
        receiptEmail: form.receiptEmail.trim(),
        receiptWebsite: form.receiptWebsite.trim(),
        receiptAddress: form.receiptAddress.trim(),
        hstNumber: form.hstNumber.trim(),
        taxLabel: form.taxLabel.trim() || DEFAULT_TAX_LABEL,
        taxRate: taxRatePercent / 100,
        taxEnabledByDefault: form.taxEnabledByDefault,
        updatedAt: new Date().toISOString(),
      });
      toast({ title: 'Workspace profile saved.' });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Could not save workspace profile',
        description: error instanceof Error ? error.message : 'Please try again.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (!canManageTenant) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          Your school admin manages workspace profile, tax, and receipt settings.
        </CardContent>
      </Card>
    );
  }

  const taxPreview = formatTaxLabel(form.taxLabel, Number(form.taxRatePercent || 0) / 100);

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Workspace profile
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5 lg:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="workspaceName">Workspace name</Label>
            <Input id="workspaceName" value={form.name} onChange={event => updateField('name', event.target.value)} className="rounded-lg" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="receiptBusinessName">Receipt business name</Label>
            <Input id="receiptBusinessName" value={form.receiptBusinessName} onChange={event => updateField('receiptBusinessName', event.target.value)} className="rounded-lg" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="receiptPhone">Phone</Label>
            <Input id="receiptPhone" value={form.receiptPhone} onChange={event => updateField('receiptPhone', event.target.value)} className="rounded-lg" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="receiptEmail">Email</Label>
            <Input id="receiptEmail" type="email" value={form.receiptEmail} onChange={event => updateField('receiptEmail', event.target.value)} className="rounded-lg" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="receiptWebsite">Website</Label>
            <Input id="receiptWebsite" value={form.receiptWebsite} onChange={event => updateField('receiptWebsite', event.target.value)} className="rounded-lg" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="hstNumber">GST/HST number</Label>
            <Input id="hstNumber" value={form.hstNumber} onChange={event => updateField('hstNumber', event.target.value)} placeholder="Optional" className="rounded-lg" />
          </div>
          <div className="space-y-2 lg:col-span-2">
            <Label htmlFor="receiptAddress">Business address</Label>
            <Textarea id="receiptAddress" value={form.receiptAddress} onChange={event => updateField('receiptAddress', event.target.value)} className="min-h-20 rounded-lg" />
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5" />
            Logo and receipt tax
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5 lg:grid-cols-2">
          <div className="space-y-3">
            <Label htmlFor="receiptLogo">School logo</Label>
            <Input id="receiptLogo" type="file" accept="image/*" onChange={handleLogoChange} disabled={isPreparingLogo} className="rounded-lg" />
            {form.receiptLogoDataUrl ? (
              <div className="flex items-center gap-4 rounded-lg border bg-muted/30 p-3">
                <img src={form.receiptLogoDataUrl} alt="Receipt logo preview" className="h-14 max-w-44 rounded bg-white object-contain p-2" />
                <Button type="button" variant="outline" size="sm" onClick={() => updateField('receiptLogoDataUrl', '')}>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Remove
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Receipts will use the business name when no logo is uploaded.</p>
            )}
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-[1fr_120px] gap-3">
              <div className="space-y-2">
                <Label htmlFor="taxLabel">Tax label</Label>
                <Input id="taxLabel" value={form.taxLabel} onChange={event => updateField('taxLabel', event.target.value)} className="rounded-lg" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="taxRate">Rate %</Label>
                <Input id="taxRate" type="number" min="0" max="30" step="0.01" value={form.taxRatePercent} onChange={event => updateField('taxRatePercent', event.target.value)} className="rounded-lg" />
              </div>
            </div>
            <label className="flex items-center gap-3 rounded-lg border bg-muted/30 px-3 py-3 text-sm">
              <Checkbox checked={form.taxEnabledByDefault} onCheckedChange={checked => updateField('taxEnabledByDefault', Boolean(checked))} />
              <span className="font-medium">Apply {taxPreview} by default on new bills</span>
            </label>
            <p className="text-xs leading-5 text-muted-foreground">
              Ontario taxable supplies normally use HST at 13%. If your supply is exempt, zero-rated, or outside Ontario, confirm the correct treatment before charging tax.
            </p>
          </div>
        </CardContent>
      </Card>

      <Button type="submit" disabled={isSaving || isPreparingLogo} className="rounded-lg">
        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
        Save workspace profile
      </Button>
    </form>
  );
}
