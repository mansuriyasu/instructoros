import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { Student } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function downloadJson(data: unknown, filename: string) {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

function convertToCSV(data: Student[]) {
  if (!data || data.length === 0) {
    return "";
  }
  const headers = Object.keys(data[0]) as (keyof Student)[];
  
  const replacer = (key: string, value: any) => value === null ? '' : value;

  const csvRows = data.map(row =>
    headers.map(fieldName => {
      let value = row[fieldName] === null || row[fieldName] === undefined ? '' : String(row[fieldName]);
      // Escape quotes and commas
      if (value.includes('"') || value.includes(',')) {
        value = `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    }).join(',')
  );

  return [headers.join(','), ...csvRows].join('\n');
}


export function downloadCsv(data: Student[], filename: string) {
    const csv = convertToCSV(data);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

const serviceColors = ['chart-1', 'chart-2', 'chart-3', 'chart-4', 'chart-5'] as const;

export const getServiceColorName = (id: string | null | undefined): typeof serviceColors[number] => {
  if (!id) return 'chart-1'; // Default color
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash; // Convert to 32bit integer
  }
  const index = Math.abs(hash) % serviceColors.length;
  return serviceColors[index];
};
