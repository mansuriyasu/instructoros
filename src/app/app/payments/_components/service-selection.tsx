'use client';

import { useMemo } from 'react';
import { useServices } from '@/hooks/use-services';
import { Service } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';
import { isPackageService } from '@/lib/package-utils';
import { PackagePlus, Plus, Tag } from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { useServiceCategories } from '@/hooks/use-service-categories';

interface ServiceSelectionProps {
  onSelectService: (service: Service) => void;
}

export function ServiceSelection({ onSelectService }: ServiceSelectionProps) {
  const { services, loading: servicesLoading } = useServices();
  const { categories, loading: categoriesLoading } = useServiceCategories();

  const groupedServices = useMemo(() => {
    if (!services || !categories) return {};

    const categoryMap = new Map(categories.map(c => [c.name, c.order]));
    
    const acc: Record<string, Service[]> = {};

    services.forEach(service => {
        const category = service.category || 'General';
        if (!acc[category]) {
            acc[category] = [];
        }
        acc[category].push(service);
    });

    // Sort categories based on the order defined in the categories collection
    const sortedCategories = Object.keys(acc).sort((a, b) => {
        const orderA = categoryMap.get(a) ?? Infinity;
        const orderB = categoryMap.get(b) ?? Infinity;

        // Make "General" always last if other categories exist.
        if (a === 'General') return 1;
        if (b === 'General') return -1;
        
        return orderA - orderB;
    });

    const finalGrouped: Record<string, Service[]> = {};
    for (const category of sortedCategories) {
        finalGrouped[category] = acc[category].sort((sA, sB) => (sA.order || 0) - (sB.order || 0));
    }

    return finalGrouped;

  }, [services, categories]);
  
  const orderedCategories = useMemo(() => Object.keys(groupedServices), [groupedServices]);
  
  const loading = servicesLoading || categoriesLoading;

  if (loading) {
    return (
      <div className="space-y-4 rounded-2xl border bg-card p-4 shadow-sm">
        <h2 className="text-lg font-semibold mb-2">Services</h2>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i}>
            <Skeleton className="h-12 w-1/3 mb-2" />
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              <Skeleton className="h-24 w-full rounded-xl" />
              <Skeleton className="h-24 w-full rounded-xl" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border bg-card p-3 shadow-sm sm:p-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Add To Bill</p>
          <h2 className="text-lg font-semibold">Services</h2>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#0B5CAD]/10 text-[#0B5CAD]">
          <PackagePlus className="h-5 w-5" />
        </div>
      </div>
      {orderedCategories.length > 0 && (
        <Accordion type="multiple" defaultValue={orderedCategories} className="w-full">
            {orderedCategories.map((category) => (
            <AccordionItem value={category} key={category} className="border-b last:border-b-0">
                <AccordionTrigger className="py-3 text-left text-md font-semibold hover:no-underline">
                  <span>{category}</span>
                  <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    {groupedServices[category].length}
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                <div className="grid grid-cols-2 gap-2 pt-2 sm:grid-cols-3 sm:gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {groupedServices[category].map((service) => (
                    <Card
                        key={service.id}
                        onClick={() => onSelectService(service)}
                        className="group relative cursor-pointer overflow-hidden rounded-2xl border bg-card shadow-sm transition-all hover:-translate-y-0.5 hover:border-[#C9A84C] hover:shadow-md active:scale-[0.98]"
                    >
                        <CardContent className="flex h-28 flex-col justify-between p-3">
                        {isPackageService(service) && (
                            <div className="absolute right-0 top-0 rounded-bl-lg bg-violet-600 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-white">
                                Package
                            </div>
                        )}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground transition-colors group-hover:bg-[#C9A84C]/15 group-hover:text-[#9A7400]">
                            <Tag className="h-4 w-4" />
                          </div>
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#111827] text-white opacity-90">
                            <Plus className="h-4 w-4" />
                          </div>
                        </div>
                        <div>
                          <p className="line-clamp-2 text-sm font-semibold leading-tight sm:text-base">{service.name}</p>
                          <p className="mt-1 text-sm font-bold text-[#0B5CAD]">
                            {service.discount
                            ? (
                                <>
                                <span className="mr-1 text-xs font-medium text-muted-foreground line-through">{formatCurrency(service.price)}</span>
                                <span>{formatCurrency(service.price - service.discount)}</span>
                                </>
                            )
                            : formatCurrency(service.price)}
                          </p>
                          {isPackageService(service) && (
                            <p className="mt-0.5 text-[10px] text-muted-foreground">
                              Includes {service.packageItems!.reduce((sum, item) => sum + item.quantity, 0)} items
                            </p>
                          )}
                        </div>
                        </CardContent>
                    </Card>
                    ))}
                </div>
                </AccordionContent>
            </AccordionItem>
            ))}
        </Accordion>
      )}
    </div>
  );
}
