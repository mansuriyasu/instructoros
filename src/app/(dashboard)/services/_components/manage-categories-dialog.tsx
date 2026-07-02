'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ServiceCategory } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { GripVertical, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

interface ManageCategoriesDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  categories: ServiceCategory[];
  onSave: (categories: ServiceCategory[]) => void;
  onUpdateCategoryName: (oldName: string, newName: string) => Promise<void>;
  onDeleteCategory: (categoryName: string) => Promise<void>;
}

export function ManageCategoriesDialog({
  isOpen,
  onOpenChange,
  categories: initialCategories,
  onSave,
  onUpdateCategoryName,
  onDeleteCategory,
}: ManageCategoriesDialogProps) {
  const { toast } = useToast();
  const [categories, setCategories] = useState<ServiceCategory[]>(initialCategories);
  const [newCategoryName, setNewCategoryName] = useState('');

  const draggedItem = useRef<ServiceCategory | null>(null);
  const [dragOverItem, setDragOverItem] = useState<ServiceCategory | null>(null);

  useEffect(() => {
    if (isOpen) {
      setCategories(initialCategories);
    }
  }, [isOpen, initialCategories]);

  const handleAddCategory = () => {
    if (newCategoryName.trim() === '') {
      toast({ variant: 'destructive', title: 'Category name cannot be empty' });
      return;
    }
    if (categories.some(c => c.name.toLowerCase() === newCategoryName.trim().toLowerCase())) {
        toast({ variant: 'destructive', title: 'Category name must be unique' });
        return;
    }

    const newCategory: ServiceCategory = {
      id: newCategoryName.trim().toLowerCase().replace(/\s+/g, '-'),
      name: newCategoryName.trim(),
      order: categories.length,
    };
    setCategories(prev => [...prev, newCategory]);
    setNewCategoryName('');
  };
  
  const handleCategoryNameChange = async (oldName: string, newName: string) => {
    if (newName.trim() === '') {
        toast({ variant: 'destructive', title: 'Category name cannot be empty' });
        return;
    }
    if (categories.some(c => c.name.toLowerCase() === newName.trim().toLowerCase() && c.name !== oldName)) {
        toast({ variant: 'destructive', title: 'Category name must be unique' });
        return;
    }
    
    await onUpdateCategoryName(oldName, newName.trim());
    setCategories(prev =>
      prev.map(c => (c.name === oldName ? { ...c, name: newName.trim() } : c))
    );
    toast({ title: 'Category renamed!' });
  };

  const handleDelete = async (category: ServiceCategory) => {
    await onDeleteCategory(category.name);
    setCategories(prev => prev.filter(c => c.id !== category.id));
    toast({ title: 'Category deleted!' });
  };

  const handleSaveOrder = () => {
    const updatedCategories = categories.map((c, index) => ({ ...c, order: index }));
    onSave(updatedCategories);
    onOpenChange(false);
    toast({ title: 'Category order saved!' });
  };
  
  // --- Drag and Drop Handlers ---
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, category: ServiceCategory) => {
    draggedItem.current = category;
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>, category: ServiceCategory) => {
    if (draggedItem.current !== category) {
      setDragOverItem(category);
    }
  };

  const handleDragEnd = () => {
    if (draggedItem.current && dragOverItem) {
      const items = [...categories];
      const draggedIndex = items.findIndex(item => item.id === draggedItem.current!.id);
      const targetIndex = items.findIndex(item => item.id === dragOverItem.id);

      const [reorderedItem] = items.splice(draggedIndex, 1);
      items.splice(targetIndex, 0, reorderedItem);
      
      setCategories(items);
    }
    draggedItem.current = null;
    setDragOverItem(null);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Manage Service Categories</DialogTitle>
          <DialogDescription>
            Add, edit, delete, and reorder your service categories.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4" onDragOver={(e) => e.preventDefault()}>
            <div className="space-y-2">
                {categories.map((category) => (
                    <div
                        key={category.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, category)}
                        onDragEnter={(e) => handleDragEnter(e, category)}
                        onDragEnd={handleDragEnd}
                        onDragOver={(e) => e.preventDefault()}
                        className={cn(
                            "flex items-center gap-2 p-2 rounded-md border bg-card cursor-grab transition-all",
                            draggedItem.current?.id === category.id && "opacity-50",
                            dragOverItem?.id === category.id && "ring-2 ring-primary"
                        )}
                    >
                        <GripVertical className="h-5 w-5 text-muted-foreground" />
                        <Input
                            defaultValue={category.name}
                            onBlur={(e) => handleCategoryNameChange(category.name, e.target.value)}
                            className="flex-1"
                        />
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Deleting this category will remove it from all associated services. This action cannot be undone.
                                </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(category)} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                ))}
            </div>

             <div className="flex gap-2">
                <Input
                    placeholder="New category name"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
                />
                <Button onClick={handleAddCategory}>Add</Button>
            </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSaveOrder}>
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
