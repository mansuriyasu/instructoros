'use client';

import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { LicenseType } from '@/lib/types';
import { Button } from '@/components/ui/button';
import type { StudentStatusFilter } from './student-grid';

interface StudentGridHeaderProps {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  statusFilter: StudentStatusFilter;
  setStatusFilter: (status: StudentStatusFilter) => void;
  licenseTypeFilter: string;
  setLicenseTypeFilter: (type: string) => void;
  tagFilter: string;
  setTagFilter: (tag: string) => void;
  availableTags: string[];
}

const statusOptions: StudentStatusFilter[] = ['current', 'all', 'active', 'booked', 'on-hold', 'deactivated'];
const licenseTypeOptions: (LicenseType | 'all')[] = ['all', 'G', 'G2'];

const statusLabels: Record<StudentStatusFilter, string> = {
  current: 'Active + booked',
  all: 'All',
  active: 'Active',
  booked: 'Booked',
  'on-hold': 'On hold',
  deactivated: 'Deactivated',
};

export function StudentGridHeader({
  searchTerm,
  setSearchTerm,
  statusFilter,
  setStatusFilter,
  licenseTypeFilter,
  setLicenseTypeFilter,
  tagFilter,
  setTagFilter,
  availableTags,
}: StudentGridHeaderProps) {
  
  const hasFilters = statusFilter !== 'current' || licenseTypeFilter !== 'all' || tagFilter !== 'all';
  
  const clearFilters = () => {
    setStatusFilter('current');
    setLicenseTypeFilter('all');
    setTagFilter('all');
  };

  return (
    <div className="mb-4 flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, phone, or license..."
            className="h-14 rounded-2xl border-border/80 bg-card pl-12 text-base shadow-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-14 w-14 shrink-0 rounded-2xl bg-card shadow-sm"
          aria-label="Student filters"
        >
          <SlidersHorizontal className="h-5 w-5" />
        </Button>
      </div>
      <div className="flex w-full flex-wrap items-center gap-2">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-10 min-w-[145px] flex-1 rounded-xl bg-card">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {statusOptions.map((status) => (
              <SelectItem key={status} value={status} className="capitalize">
                {statusLabels[status]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={licenseTypeFilter} onValueChange={setLicenseTypeFilter}>
          <SelectTrigger className="h-10 min-w-[92px] flex-1 rounded-xl bg-card">
            <SelectValue placeholder="License" />
          </SelectTrigger>
          <SelectContent>
            {licenseTypeOptions.map((type) => (
              <SelectItem key={type} value={type}>
                {type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={tagFilter} onValueChange={setTagFilter}>
          <SelectTrigger className="h-10 min-w-[130px] flex-1 rounded-xl bg-card">
            <SelectValue placeholder="Tag" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All tags</SelectItem>
            {availableTags.map((tag) => (
              <SelectItem key={tag} value={tag}>
                {tag}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {hasFilters && (
            <Button variant="ghost" size="icon" onClick={clearFilters}>
                <X className="h-5 w-5" />
            </Button>
        )}
      </div>
    </div>
  );
}
