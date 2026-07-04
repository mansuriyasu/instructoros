'use client';

import { useState, useRef } from 'react';
import { useServices } from '@/hooks/use-services';
import { Service, ServiceCategory } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { GripVertical, Edit, Trash2, Plus, Info, Settings, Clock, ArrowRight, AlertTriangle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { ServiceFormDialog } from './service-form-dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useServiceCategories } from '@/hooks/use-service-categories';
import { ManageCategoriesDialog } from './manage-categories-dialog';

function formatDuration(minutes: number) {
    if (!minutes || minutes <= 0) return null;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    
    const hStr = h > 0 ? `${h}h` : '';
    const mStr = m > 0 ? `${m}m` : '';
    
    return [hStr, mStr].filter(Boolean).join(' ');
}

export function ServiceList() {
  const { services, loading, addService, updateService, deleteService, updateServiceOrder } = useServices();
  const { categories, loading: categoriesLoading, saveCategoryOrder, updateCategoryName, deleteCategory } = useServiceCategories();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);

  const draggedItem = useRef<Service | null>(null);
  const [dragOverItem, setDragOverItem] = useState<Service | null>(null);

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, service: Service) => {
    draggedItem.current = service;
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>, service: Service) => {
    if (draggedItem.current !== service) {
        setDragOverItem(service);
    }
  };

  const handleDragEnd = () => {
    if (draggedItem.current && dragOverItem) {
        const items = [...services];
        const draggedIndex = items.findIndex(item => item.id === draggedItem.current!.id);
        const targetIndex = items.findIndex(item => item.id === dragOverItem.id);

        const [reorderedItem] = items.splice(draggedIndex, 1);
        items.splice(targetIndex, 0, reorderedItem);
        
        updateServiceOrder(items);
    }
    draggedItem.current = null;
    setDragOverItem(null);
  };
  
  const handleEdit = (service: Service) => {
    setEditingService(service);
    setIsFormOpen(true);
  };

  const handleAddNew = () => {
    setEditingService(null);
    setIsFormOpen(true);
  };

  const handleSave = async (data: Omit<Service, 'id' | 'order'> | Service, isEditing: boolean) => {
    if (isEditing) {
      await updateService(data as Service);
    } else {
      await addService(data as Omit<Service, 'id' | 'order'>);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Services</h1>
          <p className="text-muted-foreground">Manage your offered services and packages.</p>
        </div>
        <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setIsCategoryManagerOpen(true)}>
                <Settings className="mr-2 h-4 w-4" /> Manage Categories
            </Button>
            <Button onClick={handleAddNew}>
                <Plus className="mr-2 h-4 w-4" /> Add Service
            </Button>
        </div>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Tip</AlertTitle>
        <AlertDescription>
          Drag and drop services to reorder how they appear on the payment page.
        </AlertDescription>
      </Alert>

      <div 
        className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4"
        onDragOver={(e) => e.preventDefault()} // Necessary to allow drop
      >
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square w-full rounded-2xl" />
          ))
        ) : services.length > 0 ? (
          services.map((service) => (
            <Card
              key={service.id}
              draggable
              onDragStart={(e) => handleDragStart(e, service)}
              onDragEnter={(e) => handleDragEnter(e, service)}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => e.preventDefault()}
              className={cn(
                "cursor-grab transition-all duration-200 border border-border/50 shadow-md rounded-2xl bg-card hover:shadow-lg hover:-translate-y-1 aspect-square flex flex-col relative group overflow-hidden",
                draggedItem.current?.id === service.id && "opacity-50 scale-95",
                dragOverItem?.id === service.id && "ring-2 ring-primary scale-105"
              )}
            >
              <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-primary/10 to-transparent rounded-bl-full pointer-events-none" />
              <CardContent className="flex flex-col h-full p-4">
                <div className="flex items-start justify-between w-full mb-2">
                   <div className="p-1.5 bg-muted/50 rounded-md cursor-grab active:cursor-grabbing text-muted-foreground hover:bg-muted transition-colors">
                     <GripVertical className="h-4 w-4" />
                   </div>
                   <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="secondary" size="icon" className="h-7 w-7 rounded-full bg-background/80 backdrop-blur shadow-sm hover:bg-background" onClick={() => handleEdit(service)}>
                        <Edit className="h-3 w-3 text-foreground" />
                      </Button>
                      <Button variant="destructive" size="icon" className="h-7 w-7 rounded-full shadow-sm" onClick={() => deleteService(service.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                   </div>
                </div>

                <div className="flex-1 flex flex-col overflow-hidden min-h-0">
                  <p className="font-bold text-base sm:text-lg leading-tight mb-2 line-clamp-2">{service.name}</p>
                  
                  <div className="flex flex-wrap gap-1.5 overflow-hidden">
                     {service.category && <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-medium truncate max-w-full">{service.category}</Badge>}
                     {service.duration && (
                        <Badge variant="outline" className="flex items-center gap-1 text-[10px] px-1.5 py-0 font-medium shrink-0 bg-background/50">
                            <Clock className="h-2.5 w-2.5" />
                            {formatDuration(service.duration)}
                        </Badge>
                     )}
                  </div>
                </div>

                <div className="mt-auto pt-3 border-t border-border/40">
                  {(() => {
                    const finalPrice = service.discount ? service.price - service.discount : service.price;
                    const hasLoss = service.cost && service.cost > finalPrice;
                    
                    return (
                      <div className="flex flex-col text-xs mb-1 relative">
                        {hasLoss && (
                          <div 
                            className="absolute right-0 top-0 text-amber-500 bg-amber-50 dark:bg-amber-950/50 p-1 rounded-full cursor-help"
                            title="Cost exceeds sell price"
                          >
                            <AlertTriangle className="h-4 w-4" />
                          </div>
                        )}
                        {(service.discount || service.cost) ? (
                          <div className="flex flex-col text-xs text-muted-foreground">
                            {service.cost ? (
                                <div className="flex items-center gap-1">
                                    <span className={cn(hasLoss && "text-amber-600 dark:text-amber-400 font-semibold")}>Cost: {formatCurrency(service.cost)}</span>
                                </div>
                            ) : null}
                            {service.discount ? (
                               <div className="flex items-center gap-1.5 mt-0.5">
                                  <span className="line-through text-[10px]">{formatCurrency(service.price)}</span>
                                  <span className="text-green-600 dark:text-green-400 font-bold text-sm sm:text-base">{formatCurrency(finalPrice)}</span>
                               </div>
                            ) : <span className="font-bold text-foreground text-sm sm:text-base mt-0.5">{formatCurrency(finalPrice)}</span>}
                          </div>
                        ) : (
                          <p className="font-extrabold text-lg sm:text-xl text-foreground tracking-tight">{formatCurrency(finalPrice)}</p>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="text-center py-16 border-2 border-dashed rounded-lg">
            <h3 className="text-lg font-semibold">No services found</h3>
            <p className="text-muted-foreground mt-1">Click "Add Service" to get started.</p>
          </div>
        )}
      </div>

      <ServiceFormDialog
        isOpen={isFormOpen}
        onOpenChange={setIsFormOpen}
        service={editingService}
        onSave={handleSave}
      />
      
      {!categoriesLoading && (
        <ManageCategoriesDialog
            isOpen={isCategoryManagerOpen}
            onOpenChange={setIsCategoryManagerOpen}
            categories={categories}
            onSave={saveCategoryOrder}
            onUpdateCategoryName={updateCategoryName}
            onDeleteCategory={deleteCategory}
        />
      )}
    </div>
  );
}
