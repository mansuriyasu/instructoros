'use client';

import { useEffect, useMemo, useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { Pencil, Plus, Save, Tag, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useFirestore, useSession } from '@/firebase';
import { useStudents } from '@/hooks/use-students';
import { useToast } from '@/hooks/use-toast';

const DEFAULT_TAGS = ['Failed', 'Passed', 'Payment Done', 'Pending'];

function normalizeTag(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

export function StudentTagSettings() {
  const firestore = useFirestore();
  const { tenant, activeTenantId, canManageTenant } = useSession();
  const { students, updateStudent } = useStudents();
  const { toast } = useToast();
  const [tags, setTags] = useState<string[]>(DEFAULT_TAGS);
  const [newTag, setNewTag] = useState('');
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const usedTags = useMemo(() => {
    const values = new Set<string>();
    (students || []).forEach(student => {
      (Array.isArray(student.tags) ? student.tags : []).forEach(tag => {
        const clean = normalizeTag(String(tag));
        if (clean) values.add(clean);
      });
    });
    return values;
  }, [students]);

  useEffect(() => {
    const configured = Array.isArray(tenant?.customerTags) ? tenant.customerTags.map(normalizeTag).filter(Boolean) : DEFAULT_TAGS;
    setTags(Array.from(new Set(configured)));
  }, [tenant?.customerTags]);

  if (!canManageTenant) return null;

  const saveWorkspaceTags = async (nextTags: string[]) => {
    if (!firestore || !activeTenantId) throw new Error('Workspace is not ready.');
    const cleanTags = Array.from(new Set(nextTags.map(normalizeTag).filter(Boolean)));
    await updateDoc(doc(firestore, 'tenants', activeTenantId), {
      customerTags: cleanTags,
      updatedAt: new Date().toISOString(),
    });
    setTags(cleanTags);
  };

  const addTag = async () => {
    const clean = normalizeTag(newTag);
    if (!clean || tags.some(tag => tag.toLowerCase() === clean.toLowerCase())) return;
    setIsSaving(true);
    try {
      await saveWorkspaceTags([...tags, clean]);
      setNewTag('');
      toast({ title: 'Tag added.' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Could not add tag', description: error instanceof Error ? error.message : 'Please try again.' });
    } finally {
      setIsSaving(false);
    }
  };

  const renameTag = async (oldTag: string) => {
    const clean = normalizeTag(editingValue);
    if (!clean || clean.toLowerCase() === oldTag.toLowerCase()) {
      setEditingTag(null);
      return;
    }
    setIsSaving(true);
    try {
      await Promise.all((students || []).filter(student => (student.tags || []).some(tag => tag.toLowerCase() === oldTag.toLowerCase())).map(student => updateStudent({
        id: student.id,
        tags: Array.from(new Set((student.tags || []).map(tag => tag.toLowerCase() === oldTag.toLowerCase() ? clean : tag))),
      })));
      await saveWorkspaceTags(tags.map(tag => tag.toLowerCase() === oldTag.toLowerCase() ? clean : tag));
      setEditingTag(null);
      toast({ title: 'Tag renamed.' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Could not rename tag', description: error instanceof Error ? error.message : 'Please try again.' });
    } finally {
      setIsSaving(false);
    }
  };

  const deleteTag = async (tagToDelete: string) => {
    setIsSaving(true);
    try {
      await Promise.all((students || []).filter(student => (student.tags || []).some(tag => tag.toLowerCase() === tagToDelete.toLowerCase())).map(student => updateStudent({
        id: student.id,
        tags: (student.tags || []).filter(tag => tag.toLowerCase() !== tagToDelete.toLowerCase()),
      })));
      await saveWorkspaceTags(tags.filter(tag => tag.toLowerCase() !== tagToDelete.toLowerCase()));
      toast({ title: 'Tag deleted.', description: usedTags.has(tagToDelete) ? 'It was removed from all student records.' : undefined });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Could not delete tag', description: error instanceof Error ? error.message : 'Please try again.' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="rounded-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Tag className="h-5 w-5" />Student tags</CardTitle>
        <p className="text-sm text-muted-foreground">Create and manage tags used on student records. Renaming or deleting a tag updates every student using it.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input value={newTag} onChange={event => setNewTag(event.target.value)} placeholder="New tag name" className="rounded-lg" />
          <Button type="button" onClick={() => void addTag()} disabled={isSaving || !newTag.trim()} className="shrink-0 rounded-lg"><Plus className="mr-2 h-4 w-4" />Add</Button>
        </div>
        <div className="divide-y rounded-lg border">
          {tags.map(tag => (
            <div key={tag} className="flex items-center gap-2 p-3">
              {editingTag === tag ? (
                <Input value={editingValue} onChange={event => setEditingValue(event.target.value)} className="h-9 flex-1 rounded-lg" autoFocus />
              ) : (
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{tag}</p><p className="text-xs text-muted-foreground">{usedTags.has(tag) ? 'Used on student records' : 'Not used yet'}</p></div>
              )}
              {editingTag === tag ? (
                <Button type="button" variant="outline" size="icon" aria-label={`Save ${tag}`} onClick={() => void renameTag(tag)} disabled={isSaving} className="h-9 w-9 rounded-lg"><Save className="h-4 w-4" /></Button>
              ) : (
                <Button type="button" variant="ghost" size="icon" aria-label={`Rename ${tag}`} onClick={() => { setEditingTag(tag); setEditingValue(tag); }} disabled={isSaving} className="h-9 w-9 rounded-lg"><Pencil className="h-4 w-4" /></Button>
              )}
              <Button type="button" variant="ghost" size="icon" aria-label={`Delete ${tag}`} onClick={() => void deleteTag(tag)} disabled={isSaving} className="h-9 w-9 rounded-lg text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
