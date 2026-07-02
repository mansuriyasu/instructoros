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
import { Service } from '@/lib/types';
import { useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useServiceCategories } from '@/hooks/use-service-categories';

const serviceSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters.'),
  price: z.coerce.number().min(0, 'Price must be a positive number.'),
  cost: z.coerce.number().min(0, 'Cost must be a positive number.').optional().nullable(),
  discount: z.coerce.number().min(0, 'Discount must be a positive number.').optional().nullable(),
  category: z.string().optional(),
  durationHours: z.coerce.number().min(0).optional(),
  durationMinutes: z.coerce.number().min(0).max(59).optional(),
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
    },
  });

  const isEditing = !!service;

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
          });
        } else {
          form.reset({ name: '', price: 0, cost: 0, discount: 0, category: '', durationHours: 0, durationMinutes: 0 });
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
        discount: values.discount || 0,
        duration: duration > 0 ? duration : 0,
        category: values.category === 'none' ? '' : values.category,
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
             <FormField
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
              />
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
