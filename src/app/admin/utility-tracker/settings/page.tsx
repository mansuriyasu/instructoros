"use client"

import { useState } from "react"
import { useUtilityTracker } from "@/hooks/use-utility-tracker"
import { Download, Plus, AlertTriangle } from "lucide-react"

export default function SettingsPage() {
  const { data, addYear, resetData } = useUtilityTracker()
  const [newYear, setNewYear] = useState<number>(new Date().getFullYear() + 1)

  if (!data) return <div className="p-8 text-center text-muted-foreground animate-pulse">Loading...</div>

  const handleAddYear = () => {
    if (data.years.includes(newYear)) {
      alert(`${newYear} already exists!`)
      return
    }
    addYear(newYear)
    setNewYear(newYear + 1)
  }

  const handleReset = () => {
    if (window.confirm("WARNING: This will delete ALL your utility tracker data permanently. Are you absolutely sure?")) {
      resetData()
    }
  }

  const exportCSV = () => {
    let csv = "Month_ID,Year,Month,Gas,Electricity,WiFi,Water,NumberOfPeople,Mortgage,Insurance,Maintenance,WaterTank,HouseTax,WaterBill,RentalIn,TotalRent\n"
    
    data.monthlyData.forEach(m => {
      const rentTotal = m.rent.tenants.reduce((sum, t) => sum + (t.amount || 0), 0)
      const row = [
        m.id, 
        m.year, 
        m.month + 1,
        m.utilities.gas || 0,
        m.utilities.electricity || 0,
        m.utilities.wifi || 0,
        m.utilities.water || 0,
        m.utilities.numberOfPeople || 0,
        m.myCosts.mortgage || 0,
        m.myCosts.insurance || 0,
        m.myCosts.maintenance || 0,
        m.myCosts.waterTank || 0,
        m.myCosts.houseTax || 0,
        m.myCosts.waterBill || 0,
        m.myCosts.rentalIn || 0,
        rentTotal
      ].join(",")
      csv += row + "\n"
    })

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.setAttribute("download", `utility-tracker-data-${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl animate-in fade-in duration-300">
      
      {/* Add Year */}
      <div className="bg-card border rounded-xl p-6 shadow-sm">
        <h2 className="text-xl font-semibold mb-2 text-[#0D1B2A] dark:text-white">Add Tracking Year</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Add a new year to track. This will automatically generate blank data rows for January through December.
        </p>
        <div className="flex gap-2 items-center">
          <input 
            type="number" 
            value={newYear} 
            onChange={(e) => setNewYear(Number(e.target.value))} 
            className="bg-background border rounded-md px-3 py-2 text-sm w-32 focus:ring-[#C9A84C] focus:outline-none focus:ring-2"
          />
          <button 
            onClick={handleAddYear}
            className="flex items-center gap-2 bg-[#0D1B2A] text-[#F0D080] px-4 py-2 rounded-md font-medium hover:bg-[#1a365d] transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Year
          </button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {data.years.map(y => (
            <span key={y} className="px-2 py-1 bg-muted rounded text-xs font-medium text-muted-foreground">
              {y} Active
            </span>
          ))}
        </div>
      </div>

      {/* Export Data */}
      <div className="bg-card border rounded-xl p-6 shadow-sm">
        <h2 className="text-xl font-semibold mb-2 text-[#0D1B2A] dark:text-white">Export Data</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Download all your utility tracker data as a CSV file, which can be opened in Excel, Google Sheets, or Apple Numbers.
        </p>
        <button 
          onClick={exportCSV}
          className="flex items-center gap-2 bg-muted hover:bg-muted/80 text-foreground px-4 py-2 rounded-md font-medium transition-colors border"
        >
          <Download className="w-4 h-4" /> Export CSV
        </button>
      </div>

      {/* Danger Zone */}
      <div className="border border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/10 rounded-xl p-6 shadow-sm mt-4">
        <div className="flex items-center gap-2 text-red-600 dark:text-red-400 mb-2">
          <AlertTriangle className="w-5 h-5" />
          <h2 className="text-xl font-semibold">Danger Zone</h2>
        </div>
        <p className="text-sm text-red-600/80 dark:text-red-400/80 mb-4">
          Resetting will permanently delete all your Utility Tracker data from this browser's local storage. This action cannot be undone.
        </p>
        <button 
          onClick={handleReset}
          className="flex items-center gap-2 bg-red-100 hover:bg-red-200 text-red-700 dark:bg-red-900/50 dark:hover:bg-red-900/80 dark:text-red-300 px-4 py-2 rounded-md font-medium transition-colors"
        >
          Factory Reset Data
        </button>
      </div>

    </div>
  )
}
