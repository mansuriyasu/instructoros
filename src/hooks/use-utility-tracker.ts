"use client";

import { useState, useEffect } from 'react';

export type TenantRentEntry = {
  id: string;
  name: string;
  amount: number | null;
};

export type MonthlyData = {
  id: string; // "2025-01"
  year: number;
  month: number; // 0-11
  utilities: {
    gas: number | null;
    electricity: number | null;
    wifi: number | null;
    water: number | null;
    numberOfPeople: number | null;
  };
  rent: {
    tenants: TenantRentEntry[];
  };
  myCosts: {
    mortgage: number | null;
    insurance: number | null;
    maintenance: number | null;
    waterTank: number | null;
    houseTax: number | null;
    waterBill: number | null;
    rentalIn: number | null;
  };
};

export type UtilityTrackerData = {
  years: number[];
  monthlyData: MonthlyData[];
  settings: {
    defaultTenants: { id: string; name: string }[];
  };
};

const STORAGE_KEY = 'utilityTrackerData_v4';

const emptyUtilities = { gas: null, electricity: null, wifi: 62, water: null, numberOfPeople: null };
const emptyMyCosts = { mortgage: null, insurance: null, maintenance: null, waterTank: null, houseTax: null, waterBill: null, rentalIn: null };

function generateYearData(year: number): MonthlyData[] {
  return Array.from({ length: 12 }, (_, i) => ({
    id: `${year}-${i.toString().padStart(2, '0')}`,
    year,
    month: i,
    utilities: { ...emptyUtilities },
    rent: { tenants: [] },
    myCosts: { ...emptyMyCosts },
  }));
}

function generatePreloadData2025(): MonthlyData[] {
  const base = generateYearData(2025);
  
  base[1].utilities = { gas: 83, electricity: null, wifi: 62, water: 76.05, numberOfPeople: 7 };
  base[1].rent.tenants = [ { id: "r1", name: "Arshil", amount: 470 }, { id: "r2", name: "Zaid", amount: 470 } ];
  base[1].myCosts = { mortgage: 3803, insurance: 140, maintenance: 85, waterTank: 26.89, houseTax: null, waterBill: null, rentalIn: 940 };

  base[2].utilities = { gas: 304, electricity: 171.45, wifi: 62, water: 261.95, numberOfPeople: 7 };
  base[2].rent.tenants = [ { id: "r1", name: "Arshil", amount: 470 }, { id: "r2", name: "Zaid", amount: 470 }, { id: "r3", name: "Ashraf", amount: 1100 }, { id: "r4", name: "Basement", amount: 1600 } ];
  base[2].myCosts = { mortgage: 3511, insurance: 140, maintenance: 85, waterTank: 26.89, houseTax: 535, waterBill: null, rentalIn: 2540 };

  base[3].utilities = { gas: 90, electricity: 152.27, wifi: 62, water: 253.50, numberOfPeople: 9 };
  base[3].rent.tenants = [ { id: "r1", name: "Arshil", amount: 470 }, { id: "r2", name: "Zaid", amount: 470 }, { id: "r3", name: "Ashraf", amount: 1100 }, { id: "r4", name: "Basement", amount: 1600 } ];
  base[3].myCosts = { mortgage: 3511, insurance: 140, maintenance: 85, waterTank: 26.89, houseTax: 535, waterBill: null, rentalIn: 3640 };

  base[4].utilities = { gas: 157.30, electricity: 184.63, wifi: 62, water: 261.95, numberOfPeople: 9 };
  base[4].rent.tenants = [ { id: "r1", name: "Arshil", amount: 470 }, { id: "r2", name: "Zaid", amount: 470 }, { id: "r3", name: "Ashraf", amount: 1100 }, { id: "r4", name: "Basement", amount: 1600 } ];
  base[4].myCosts = { mortgage: 3511, insurance: 140, maintenance: 85, waterTank: 26.89, houseTax: 535, waterBill: null, rentalIn: 3640 };

  base[5].utilities = { gas: 53.25, electricity: 168.32, wifi: 62, water: 253.50, numberOfPeople: 7 };
  base[5].rent.tenants = [ { id: "r1", name: "Arshil", amount: 470 }, { id: "r2", name: "Zaid", amount: 470 }, { id: "r4", name: "Basement", amount: 1600 } ];
  base[5].myCosts = { mortgage: 3511, insurance: 140, maintenance: 85, waterTank: 26.89, houseTax: null, waterBill: null, rentalIn: 2540 };

  base[6].utilities = { gas: 110.15, electricity: 255.62, wifi: 62, water: 228.15, numberOfPeople: 8 };
  base[6].rent.tenants = [ { id: "r1", name: "Arshil", amount: 470 }, { id: "r2", name: "Zaid", amount: 470 }, { id: "r4", name: "Basement", amount: 1600 } ];
  base[6].myCosts = { mortgage: 3511, insurance: 140, maintenance: 85, waterTank: 26.89, houseTax: 70, waterBill: 1466, rentalIn: 2540 };

  base[7].utilities = { gas: 51.90, electricity: 285.99, wifi: 62, water: null, numberOfPeople: 8 };
  base[7].rent.tenants = [ { id: "r1", name: "Arshil", amount: 470 }, { id: "r2", name: "Zaid", amount: 470 }, { id: "r4", name: "Basement", amount: 1600 } ];
  base[7].myCosts = { mortgage: 3511, insurance: 140, maintenance: 85, waterTank: 26.89, houseTax: 70, waterBill: null, rentalIn: 2540 };

  base[8].utilities = { gas: 95.52, electricity: 182.24, wifi: 62, water: 160, numberOfPeople: 8 };
  base[8].rent.tenants = [ { id: "r1", name: "Arshil", amount: 470 }, { id: "r2", name: "Zaid", amount: 470 }, { id: "r4", name: "Basement", amount: 1600 } ];
  base[8].myCosts = { mortgage: 3511, insurance: 140, maintenance: 85, waterTank: 26.89, houseTax: 70, waterBill: null, rentalIn: 2540 };

  base[9].utilities = { gas: 72.28, electricity: 164.33, wifi: 62, water: 160, numberOfPeople: 8 };
  base[9].rent.tenants = [ { id: "r1", name: "Arshil", amount: 470 }, { id: "r2", name: "Zaid", amount: 470 }, { id: "r4", name: "Basement", amount: 1600 } ];
  base[9].myCosts = { mortgage: 3511, insurance: 140, maintenance: 85, waterTank: 26.89, houseTax: null, waterBill: null, rentalIn: 2540 };

  base[10].utilities = { gas: 154.19, electricity: 191, wifi: 62, water: 180, numberOfPeople: 9 };
  base[10].rent.tenants = [ { id: "r1", name: "Arshil", amount: 470 }, { id: "r2", name: "Zaid", amount: 470 }, { id: "r4", name: "Basement", amount: 1600 } ];
  base[10].myCosts = { mortgage: 3511, insurance: 140, maintenance: 85, waterTank: 26.89, houseTax: null, waterBill: 1103, rentalIn: 2540 };

  base[11].utilities = { gas: 165.60, electricity: 162.67, wifi: 62, water: 180, numberOfPeople: 8 };
  base[11].rent.tenants = [ { id: "r1", name: "Arshil", amount: 470 }, { id: "r2", name: "Zaid", amount: 470 }, { id: "r4", name: "Basement", amount: 1550 } ];
  base[11].myCosts = { mortgage: 3511, insurance: 140, maintenance: 85, waterTank: 26.89, houseTax: null, waterBill: null, rentalIn: 2490 };

  return base;
}

function generatePreloadData2026(): MonthlyData[] {
  const base = generateYearData(2026);
  
  base[0].utilities = { gas: 181, electricity: 225.61, wifi: 62, water: 160, numberOfPeople: 8 };
  base[0].rent.tenants = [ { id: "r1", name: "Arshil", amount: 470 }, { id: "r2", name: "Zaid", amount: 470 }, { id: "r3", name: "Ashraf", amount: 470 }, { id: "r4", name: "Basement", amount: 1550 } ];
  base[0].myCosts = { mortgage: 3511, insurance: 140, maintenance: 85, waterTank: 26.89, houseTax: null, waterBill: null, rentalIn: 2960 };

  base[1].utilities = { gas: 184, electricity: 155.84, wifi: 62, water: 160, numberOfPeople: 8 };
  base[1].rent.tenants = [ { id: "r1", name: "Arshil", amount: 470 }, { id: "r2", name: "Zaid", amount: 470 }, { id: "r3", name: "Ashraf", amount: 470 }, { id: "r4", name: "Basement", amount: 1550 } ];
  base[1].myCosts = { mortgage: 3511, insurance: 140, maintenance: 85, waterTank: 26.89, houseTax: null, waterBill: null, rentalIn: 2960 };

  base[2].utilities = { gas: 175, electricity: 138, wifi: 62, water: 160, numberOfPeople: 7 };
  base[2].rent.tenants = [ { id: "r1", name: "Arshil", amount: 470 }, { id: "r2", name: "Zaid", amount: 470 }, { id: "r3", name: "Ashraf", amount: 470 }, { id: "r4", name: "Basement", amount: 1550 } ];
  base[2].myCosts = { mortgage: 3511, insurance: 160, maintenance: 85, waterTank: 26.89, houseTax: 565, waterBill: null, rentalIn: 2960 };

  base[3].rent.tenants = [ { id: "r1", name: "Arshil", amount: 470 }, { id: "r2", name: "Zaid", amount: 470 }, { id: "r3", name: "Ashraf", amount: 470 }, { id: "r4", name: "Basement", amount: 1550 } ];
  base[3].myCosts = { mortgage: 3511, insurance: 160, maintenance: 85, waterTank: 26.89, houseTax: 565, waterBill: null, rentalIn: 2960 };

  base[4].rent.tenants = [ { id: "r1", name: "Arshil", amount: 470 }, { id: "r2", name: "Zaid", amount: 470 }, { id: "r3", name: "Ashraf", amount: 470 }, { id: "r4", name: "Basement", amount: 1550 } ];
  base[4].myCosts = { mortgage: 3511, insurance: 160, maintenance: 85, waterTank: 26.89, houseTax: 565, waterBill: null, rentalIn: 2960 };

  for (let i = 5; i <= 11; i++) {
    base[i].myCosts = { mortgage: 3511, insurance: 160, maintenance: 85, waterTank: 26.89, houseTax: null, waterBill: null, rentalIn: null };
  }

  return base;
}


export function useUtilityTracker() {
  const [data, setData] = useState<UtilityTrackerData | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setData(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse utilityTrackerData", e);
      }
    } else {
      // Initialize with 2025 and 2026
      const initialData: UtilityTrackerData = {
        years: [2025, 2026],
        monthlyData: [...generatePreloadData2025(), ...generatePreloadData2026()],
        settings: { defaultTenants: [] },
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initialData));
      setData(initialData);
    }
  }, []);

  const saveData = (newData: UtilityTrackerData) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
    setData(newData);
  };

  const updateMonth = (monthId: string, updates: Partial<MonthlyData>) => {
    if (!data) return;
    const newMonthlyData = data.monthlyData.map((m) =>
      m.id === monthId ? { ...m, ...updates } : m
    );
    saveData({ ...data, monthlyData: newMonthlyData });
  };

  const addYear = (year: number) => {
    if (!data || data.years.includes(year)) return;
    saveData({
      ...data,
      years: [...data.years, year].sort((a, b) => a - b),
      monthlyData: [...data.monthlyData, ...generateYearData(year)],
    });
  };

  const resetData = () => {
    const initialData: UtilityTrackerData = {
      years: [2025, 2026],
      monthlyData: [...generatePreloadData2025(), ...generatePreloadData2026()],
      settings: { defaultTenants: [] },
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initialData));
    setData(initialData);
  };

  return { data, saveData, updateMonth, addYear, resetData };
}
