'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Service } from '@/lib/types';
import { useEffect } from 'react';
import { Minus, Plus, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useServiceCategories } from '@/hooks/use-service-categories';
import { useServices } from '@/hooks/use-services';
import { getPackageComponentsValue, isPackageService } from '@/lib/package-utils';
import { formatCurrency } from '@/lib/utils';

const serviceSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters.'),
  price: z.coerce.number().min(0, 'Price must be a positive number.'),
  cost: z.coerce.number().min(0, 'Cost must be a positive number.').optional().nullable(),
  discount: z.coerce.number().min(0, 'Discount must be a positive number.').optional().nullable(),
  category: z.string().optional(),
  durationHours: z.coerce.number().min(0).optional(),
  durationMinutes: z.coerce.number().min(0).max(59).optional(),
  isPackage: z.boolean().default(false),
  packageItems: z.array(z.object({
    serviceId: z.string(),
    name: z.string(),
    quantity: z.coerce.number().int().min(1),
  })).default([]),
}).superRefine((values, ctx) => {
  if (values.isPackage && values.packageItems.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['packageItems'],
      message: 'Add at least one service to the package.',
    });
  }
});

interface ServiceFormDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  service?: Service | null;
  onSave: (data: Omit<Service, 'id' | 'order'> | Service, isEditing: boolean) => Promise<void>;
}

export function ServiceFormDialog({ isOpen, onOpenChange, service, onSave }: ServiceFormDialogProps) {
  const { toast } = useToast();
  const { categories } = useServiceCategories();
  const { services } = useServices();

  const form = useForm<z.infer<typeof serviceSchema>>({
    resolver: zodResolver(serviceSchema),
    defaultValues: {
      name: '',
      price: 0,
      cost: 0,
      discount: 0,
      category: '',
      durationHours: 0,
      durationMinutes: 0,
      isPackage: false,
      packageItems: [],
    },
  });

  const isEditing = !!service;
  const isPackage = form.watch('isPackage');
  const packageItems = form.watch('packageItems');
  const componentOptions = (services || []).filter(
    s => s.id !== service?.id && !isPackageService(s) && !packageItems.some(item => item.serviceId === s.id)
  );
  const individualValue = getPackageComponentsValue(packageItems, services);
  const packagePrice = Number(form.watch('price')) || 0;

  const setComponentQuantity = (serviceId: string, quantity: number) => {
    const current = form.getValues('packageItems');
    const next = quantity <= 0
      ? current.filter(item => item.serviceId !== serviceId)
      : current.map(item => (item.serviceId === serviceId ? { ...item, quantity } : item));
    form.setValue('packageItems', next, { shouldValidate: true });
  };

  useEffect(() => {
    if (isOpen) {
        if (service) {
          const hours = service.duration ? Math.floor(service.duration / 60) : 0;
          const minutes = service.duration ? service.duration % 60 : 0;
          form.reset({
            name: service.name,
            price: service.price,
            cost: service.cost,
            discount: service.discount,
            category: service.category || '',
            durationHours: hours,
            durationMinutes: minutes,
            isPackage: isPackageService(service),
            packageItems: service.packageItems || [],
          });
        } else {
          form.reset({ name: '', price: 0, cost: 0, discount: 0, category: '', durationHours: 0, durationMinutes: 0, isPackage: false, packageItems: [] });
        }
    }
  }, [service, form, isOpen]);

  const onSubmit = async (values: z.infer<typeof serviceSchema>) => {
    try {
      const duration = (values.durationHours || 0) * 60 + (values.durationMinutes || 0);
      
      const dataToSave = {
        name: values.name,
        price: values.price,
        cost: values.cost || 0,
        discount: values.isPackage ? 0 : values.discount || 0,
        duration: duration > 0 ? duration : 0,
        category: values.category === 'none' ? '' : values.category,
        // Empty array (not undefined) so editing a former package clears it.
        packageItems: values.isPackage ? values.packageItems : [],
      };

      if (isEditing && service) {
        await onSave({ ...service, ...dataToSave }, true);
      } else {
        await onSave(dataToSave, false);
      }
      toast({ title: `Service ${isEditing ? 'updated' : 'added'} successfully` });
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to save service:", error);
      toast({ variant: 'destructive', title: 'Error', description: `Failed to ${isEditing ? 'update' : 'add'} service.` });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Service' : 'Add New Service'}</DialogTitle>
          <DialogDescription>
            {isEditing ? 'Update the details for this service.' : 'Enter the details for the new service.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Service Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Single Driving Lesson" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                   <Select onValueChange={field.onChange} value={field.value || 'none'}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {categories.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="isPackage"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border px-3 py-2">
                  <FormLabel className="text-sm font-medium">This is a package</FormLabel>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />
            {isPackage && (
              <FormField
                control={form.control}
                name="packageItems"
                render={() => (
                  <FormItem className="rounded-lg border p-3">
                    <FormLabel className="text-sm">Included services</FormLabel>
                    <div className="space-y-2">
                      {packageItems.map(item => (
                        <div key={item.serviceId} className="flex items-center gap-2">
                          <span className="min-w-0 flex-1 truncate text-sm">{item.name}</span>
                          <Button type="button" variant="outline" size="icon" className="h-7 w-7 shrink-0" onClick={() => setComponentQuantity(item.serviceId, item.quantity - 1)}>
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-6 text-center text-sm font-semibold">{item.quantity}</span>
                          <Button type="button" variant="outline" size="icon" className="h-7 w-7 shrink-0" onClick={() => setComponentQuantity(item.serviceId, item.quantity + 1)}>
                            <Plus className="h-3 w-3" />
                          </Button>
                          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground" onClick={() => setComponentQuantity(item.serviceId, 0)}>
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                      {componentOptions.length > 0 && (
                        <Select
                          value=""
                          onValueChange={serviceId => {
                            const selected = componentOptions.find(s => s.id === serviceId);
                            if (!selected) return;
                            form.setValue(
                              'packageItems',
                              [...form.getValues('packageItems'), { serviceId: selected.id, name: selected.name, quantity: 1 }],
                              { shouldValidate: true }
                            );
                          }}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Add a service..." />
                          </SelectTrigger>
                          <SelectContent>
                            {componentOptions.map(s => (
                              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sell Price</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="170" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="cost"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cost Price</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        {...field} 
                        value={field.value ?? undefined} 
                        onChange={e => field.onChange(e.target.value ? Number(e.target.value) : undefined)} 
                        placeholder="e.g. 0" 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            {isPackage && individualValue > 0 && (
              <p className="text-xs text-muted-foreground">
                Individual value: {formatCurrency(individualValue)}
                {packagePrice > 0 && packagePrice < individualValue && (
                  <> — you save {formatCurrency(individualValue - packagePrice)}</>
                )}
              </p>
            )}
             {!isPackage && <FormField
                control={form.control}
                name="discount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Discount (Optional)</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        {...field} 
                        value={field.value ?? undefined} 
                        onChange={e => field.onChange(e.target.value ? Number(e.target.value) : undefined)} 
                        placeholder="10" 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />}
             <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="durationHours"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Duration (Hours)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="1" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="durationMinutes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Duration (Minutes)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="30" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter>
               <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? 'Saving...' : 'Save Service'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
