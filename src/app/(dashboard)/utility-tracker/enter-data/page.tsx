"use client"

import { useState, useEffect } from "react"
import { useUtilityTracker, MonthlyData } from "@/hooks/use-utility-tracker"
import { Plus, Trash2, ArrowRight } from "lucide-react"

type EntryType = "utilities" | "rent" | "myCosts"
const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]

export default function EnterDataPage() {
  const { data, updateMonth } = useUtilityTracker()
  const [entryType, setEntryType] = useState<EntryType>("utilities")
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth())
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear())

  // State for the form values
  const [utilities, setUtilities] = useState<MonthlyData['utilities']>({ gas: null, electricity: null, wifi: 62, water: null, numberOfPeople: null })
  const [rent, setRent] = useState<MonthlyData['rent']>({ tenants: [] })
  const [myCosts, setMyCosts] = useState<MonthlyData['myCosts']>({ mortgage: null, insurance: null, maintenance: null, waterTank: null, houseTax: null, waterBill: null, rentalIn: null })

  const [isSaved, setIsSaved] = useState(false)

  // Sync state when month/year changes
  useEffect(() => {
    if (!data) return
    
    // Auto-select valid year if current selection is invalid
    if (!data.years.includes(selectedYear) && data.years.length > 0) {
      setSelectedYear(data.years[0])
      return
    }

    const monthData = data.monthlyData.find(m => m.year === selectedYear && m.month === selectedMonth)
    if (monthData) {
      setUtilities(monthData.utilities)
      setRent(monthData.rent)
      setMyCosts(monthData.myCosts)
    }
  }, [data, selectedMonth, selectedYear])

  if (!data) return <div className="p-8 text-center text-muted-foreground animate-pulse">Loading...</div>

  const handleSave = () => {
    const monthId = `${selectedYear}-${selectedMonth.toString().padStart(2, '0')}`
    
    // Warn before overwriting
    const existing = data.monthlyData.find(m => m.id === monthId)
    let shouldSave = true
    
    if (existing) {
      const hasData = (() => {
        if (entryType === "utilities") return existing.utilities.gas !== null || existing.utilities.electricity !== null;
        if (entryType === "rent") return existing.rent.tenants.length > 0;
        if (entryType === "myCosts") return existing.myCosts.mortgage !== null || existing.myCosts.insurance !== null;
      })();
      
      if (hasData) {
        shouldSave = window.confirm(`You already have ${entryType} data saved for ${months[selectedMonth]} ${selectedYear}. Are you sure you want to overwrite it?`)
      }
    }

    if (!shouldSave) return

    updateMonth(monthId, {
      ...(entryType === 'utilities' ? { utilities } : {}),
      ...(entryType === 'rent' ? { rent } : {}),
      ...(entryType === 'myCosts' ? { myCosts } : {})
    })

    setIsSaved(true)
    setTimeout(() => setIsSaved(false), 2000)

    // Auto-advance
    if (selectedMonth === 11) {
      setSelectedMonth(0)
      if (data.years.includes(selectedYear + 1)) {
        setSelectedYear(selectedYear + 1)
      }
    } else {
      setSelectedMonth(prev => prev + 1)
    }
  }

  const handleNumChange = (e: React.ChangeEvent<HTMLInputElement>, setter: any, field: string) => {
    const val = e.target.value
    setter((prev: any) => ({ ...prev, [field]: val === "" ? null : Number(val) }))
  }

  return (
    <div className="flex flex-col gap-6 max-w-3xl animate-in fade-in duration-300">
      
      {/* Controls */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-card border rounded-xl p-4 shadow-sm">
        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1 block">Entry Type</label>
          <select value={entryType} onChange={e => setEntryType(e.target.value as EntryType)} className="w-full bg-background border rounded-md px-3 py-2 text-sm focus:ring-[#C9A84C] focus:outline-none focus:ring-2">
            <option value="utilities">Utilities</option>
            <option value="rent">Rent</option>
            <option value="myCosts">My Costs</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1 block">Month</label>
          <select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))} className="w-full bg-background border rounded-md px-3 py-2 text-sm focus:ring-[#C9A84C] focus:outline-none focus:ring-2">
            {months.map((m, i) => <option key={i} value={i}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1 block">Year</label>
          <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} className="w-full bg-background border rounded-md px-3 py-2 text-sm focus:ring-[#C9A84C] focus:outline-none focus:ring-2">
            {data.years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* Form Area */}
      <div className="bg-card border rounded-xl p-6 shadow-sm">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold capitalize text-[#0D1B2A] dark:text-white">{entryType.replace(/([A-Z])/g, ' $1').trim()} Data</h2>
        </div>

        {/* UTILITIES FORM */}
        {entryType === "utilities" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Gas</label>
                <input type="number" value={utilities.gas ?? ""} onChange={e => handleNumChange(e, setUtilities, "gas")} className="w-full bg-background border rounded-md px-3 py-2 text-sm focus:ring-[#C9A84C] focus:outline-none focus:ring-2" placeholder="0.00" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Electricity</label>
                <input type="number" value={utilities.electricity ?? ""} onChange={e => handleNumChange(e, setUtilities, "electricity")} className="w-full bg-background border rounded-md px-3 py-2 text-sm focus:ring-[#C9A84C] focus:outline-none focus:ring-2" placeholder="0.00" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">WiFi (Default 62)</label>
                <input type="number" value={utilities.wifi ?? ""} onChange={e => handleNumChange(e, setUtilities, "wifi")} className="w-full bg-background border rounded-md px-3 py-2 text-sm focus:ring-[#C9A84C] focus:outline-none focus:ring-2" placeholder="62.00" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Water</label>
                <input type="number" value={utilities.water ?? ""} onChange={e => handleNumChange(e, setUtilities, "water")} className="w-full bg-background border rounded-md px-3 py-2 text-sm focus:ring-[#C9A84C] focus:outline-none focus:ring-2" placeholder="0.00" />
              </div>
              <div className="sm:col-span-2">
                <label className="text-sm font-medium mb-1 block">Number of People</label>
                <input type="number" value={utilities.numberOfPeople ?? ""} onChange={e => handleNumChange(e, setUtilities, "numberOfPeople")} className="w-full sm:w-1/2 bg-background border rounded-md px-3 py-2 text-sm focus:ring-[#C9A84C] focus:outline-none focus:ring-2" placeholder="e.g. 3" />
              </div>
            </div>
            
            <div className="mt-6 p-4 bg-muted/50 rounded-lg flex justify-between items-center border border-muted">
              <div>
                <p className="text-sm text-muted-foreground">Total Utilities</p>
                <p className="text-xl font-bold text-[#0D1B2A] dark:text-white">${((utilities.gas || 0) + (utilities.electricity || 0) + (utilities.wifi || 0) + (utilities.water || 0)).toFixed(2)}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Per Person</p>
                <p className="text-xl font-bold text-[#C9A84C]">
                  ${utilities.numberOfPeople ? (((utilities.gas || 0) + (utilities.electricity || 0) + (utilities.wifi || 0) + (utilities.water || 0)) / utilities.numberOfPeople).toFixed(2) : "0.00"}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* RENT FORM */}
        {entryType === "rent" && (
          <div className="space-y-4">
            {rent.tenants.length === 0 && (
              <p className="text-sm text-muted-foreground py-4 text-center border border-dashed rounded-lg">No tenants added for this month.</p>
            )}
            {rent.tenants.map((t, index) => (
              <div key={t.id} className="flex gap-2 items-end">
                <div className="flex-1">
                  <label className="text-sm font-medium mb-1 block">Tenant Name</label>
                  <input type="text" value={t.name} onChange={e => {
                    const newTenants = [...rent.tenants];
                    newTenants[index].name = e.target.value;
                    setRent({ ...rent, tenants: newTenants });
                  }} className="w-full bg-background border rounded-md px-3 py-2 text-sm focus:ring-[#C9A84C] focus:outline-none focus:ring-2" placeholder="Name" />
                </div>
                <div className="flex-1">
                  <label className="text-sm font-medium mb-1 block">Amount</label>
                  <input type="number" value={t.amount ?? ""} onChange={e => {
                    const newTenants = [...rent.tenants];
                    const val = e.target.value;
                    newTenants[index].amount = val === "" ? null : Number(val);
                    setRent({ ...rent, tenants: newTenants });
                  }} className="w-full bg-background border rounded-md px-3 py-2 text-sm focus:ring-[#C9A84C] focus:outline-none focus:ring-2" placeholder="0.00" />
                </div>
                <button onClick={() => {
                  const newTenants = rent.tenants.filter((_, i) => i !== index);
                  setRent({ ...rent, tenants: newTenants });
                }} className="p-2.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950 rounded-md transition-colors border border-transparent hover:border-red-200">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            
            <button onClick={() => {
              setRent({ ...rent, tenants: [...rent.tenants, { id: Math.random().toString(36).substring(2, 9), name: "", amount: null }] });
            }} className="flex items-center gap-2 text-sm font-medium text-[#C9A84C] hover:text-[#0D1B2A] dark:hover:text-[#F0D080] transition-colors py-2">
              <Plus className="w-4 h-4" /> Add Tenant
            </button>

            <div className="mt-6 p-4 bg-muted/50 rounded-lg flex justify-between items-center border border-muted">
              <p className="text-sm text-muted-foreground">Total Rent</p>
              <p className="text-xl font-bold text-green-600 dark:text-green-400">
                ${rent.tenants.reduce((sum, t) => sum + (t.amount || 0), 0).toFixed(2)}
              </p>
            </div>
          </div>
        )}

        {/* MY COSTS FORM */}
        {entryType === "myCosts" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { key: 'mortgage', label: 'Mortgage' },
                { key: 'insurance', label: 'Insurance' },
                { key: 'maintenance', label: 'Maintenance' },
                { key: 'waterTank', label: 'Water Tank' },
                { key: 'houseTax', label: 'House Tax' },
                { key: 'waterBill', label: 'Water Bill' },
                { key: 'rentalIn', label: 'Rental In' }
              ].map(field => (
                <div key={field.key}>
                  <label className="text-sm font-medium mb-1 block">{field.label}</label>
                  <input type="number" value={(myCosts as any)[field.key] ?? ""} onChange={e => handleNumChange(e, setMyCosts, field.key)} className="w-full bg-background border rounded-md px-3 py-2 text-sm focus:ring-[#C9A84C] focus:outline-none focus:ring-2" placeholder="0.00" />
                </div>
              ))}
            </div>

            <div className="mt-6 p-4 bg-muted/50 rounded-lg flex justify-between items-center border border-muted">
              <p className="text-sm text-muted-foreground">Total Costs</p>
              <p className="text-xl font-bold text-red-600 dark:text-red-400">
                ${['mortgage', 'insurance', 'maintenance', 'waterTank', 'houseTax', 'waterBill', 'rentalIn'].reduce((sum, field) => sum + ((myCosts as any)[field] || 0), 0).toFixed(2)}
              </p>
            </div>
          </div>
        )}

        <div className="mt-8 flex items-center justify-between border-t pt-6">
          <p className="text-sm text-muted-foreground">
            {isSaved ? <span className="text-green-600 dark:text-green-400 font-medium">✓ Saved successfully!</span> : "Save when ready to proceed."}
          </p>
          <button onClick={handleSave} className="flex items-center gap-2 bg-[#0D1B2A] hover:bg-[#1a365d] text-[#F0D080] px-6 py-2.5 rounded-md font-medium transition-colors shadow-sm focus:ring-2 focus:ring-offset-2 focus:ring-[#0D1B2A]">
            Save & Next <ArrowRight className="w-4 h-4" />
          </button>
        </div>

      </div>
    </div>
  )
}
