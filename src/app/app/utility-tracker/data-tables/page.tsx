"use client"

import { useState, useMemo } from "react"
import { useUtilityTracker } from "@/hooks/use-utility-tracker"
import { Plus, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"

type TabType = "utilities" | "rent" | "myCosts"
const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

export default function DataTablesPage() {
  const { data, updateMonth } = useUtilityTracker()
  const [activeTab, setActiveTab] = useState<TabType>("utilities")
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear())

  // Default to 2025 if current year is not in data
  const yearToUse = data?.years.includes(selectedYear) ? selectedYear : (data?.years[0] || 2025)

  const yearData = useMemo(() => {
    return data?.monthlyData.filter((m) => m.year === yearToUse) || []
  }, [data, yearToUse])

  if (!data) return <div className="p-8 text-center text-muted-foreground animate-pulse">Loading...</div>

  const getUtilitiesTotal = (month: typeof yearData[number]) => (
    (month.utilities.gas || 0) +
    (month.utilities.electricity || 0) +
    (month.utilities.wifi || 0) +
    (month.utilities.water || 0)
  )

  const getUtilitiesPerPerson = (month: typeof yearData[number]) => {
    const people = month.utilities.numberOfPeople || 0
    if (people <= 0) return null
    return getUtilitiesTotal(month) / people
  }

  const yearUtilitiesTotal = yearData.reduce((sum, month) => sum + getUtilitiesTotal(month), 0)
  const perPersonMonths = yearData
    .map(getUtilitiesPerPerson)
    .filter((value): value is number => value !== null)
  const averagePerPerson = perPersonMonths.length
    ? perPersonMonths.reduce((sum, value) => sum + value, 0) / perPersonMonths.length
    : null

  const handleEdit = (monthId: string, section: "utilities" | "myCosts", field: string, value: string) => {
    const numVal = value === "" ? null : Number(value)
    const month = data.monthlyData.find(m => m.id === monthId)
    if (!month) return
    
    updateMonth(monthId, { [section]: { ...month[section], [field]: numVal } } as any)
  }

  const handleRentEdit = (monthId: string, tenantIndex: number, field: "name" | "amount", value: string) => {
    const month = data.monthlyData.find(m => m.id === monthId)
    if (!month) return
    
    const newTenants = [...month.rent.tenants]
    if (field === "name") {
      newTenants[tenantIndex].name = value
    } else {
      newTenants[tenantIndex].amount = value === "" ? null : Number(value)
    }
    updateMonth(monthId, { rent: { tenants: newTenants } })
  }

  const handleRemoveTenant = (monthId: string, tenantIndex: number) => {
    const month = data.monthlyData.find(m => m.id === monthId)
    if (!month) return
    const newTenants = month.rent.tenants.filter((_, i) => i !== tenantIndex)
    updateMonth(monthId, { rent: { tenants: newTenants } })
  }

  const handleAddTenant = (monthId: string) => {
    const month = data.monthlyData.find(m => m.id === monthId)
    if (!month) return
    const newTenants = [...month.rent.tenants, { id: Math.random().toString(36).substring(2, 9), name: "", amount: null }]
    updateMonth(monthId, { rent: { tenants: newTenants } })
  }

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-300">
      
      {/* Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card border rounded-xl p-4 shadow-sm">
        <div className="flex gap-2">
          {[
            { id: "utilities", label: "Utilities" },
            { id: "rent", label: "Rent" },
            { id: "myCosts", label: "My Costs" }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={cn(
                "px-4 py-2 rounded-md text-sm font-medium transition-colors",
                activeTab === tab.id 
                  ? "bg-[#0D1B2A] text-[#F0D080] shadow-sm dark:bg-[#C9A84C] dark:text-[#0D1B2A]" 
                  : "bg-transparent text-muted-foreground hover:bg-muted"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
        
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-muted-foreground">Year:</label>
          <select 
            value={yearToUse} 
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="bg-background border rounded-md px-3 py-1.5 text-sm focus:ring-[#C9A84C] focus:outline-none focus:ring-2"
          >
            {data.years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tables */}
      <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
        
        {/* UTILITIES TABLE */}
        {activeTab === "utilities" && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b">
                <tr>
                  <th className="px-4 py-3 min-w-[100px]">Month</th>
                  <th className="px-4 py-3 min-w-[120px]">Gas</th>
                  <th className="px-4 py-3 min-w-[120px]">Electricity</th>
                  <th className="px-4 py-3 min-w-[120px]">WiFi</th>
                  <th className="px-4 py-3 min-w-[120px]">Water</th>
                  <th className="px-4 py-3 min-w-[120px]">People</th>
                  <th className="px-4 py-3 min-w-[130px] text-right bg-[#0D1B2A]/5 text-[#0D1B2A] dark:text-[#C9A84C]">Per Person</th>
                  <th className="px-4 py-3 min-w-[120px] text-right bg-[#0D1B2A]/5 text-[#0D1B2A] dark:text-[#C9A84C]">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {yearData.map((m) => {
                  const total = getUtilitiesTotal(m)
                  const perPerson = getUtilitiesPerPerson(m)
                  return (
                    <tr key={m.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-2 font-medium">{months[m.month]}</td>
                      <td className="px-4 py-2"><input type="number" value={m.utilities.gas ?? ""} onChange={e => handleEdit(m.id, "utilities", "gas", e.target.value)} className="w-full bg-transparent border-none p-1 focus:ring-1 focus:ring-[#C9A84C] rounded" placeholder="-" /></td>
                      <td className="px-4 py-2"><input type="number" value={m.utilities.electricity ?? ""} onChange={e => handleEdit(m.id, "utilities", "electricity", e.target.value)} className="w-full bg-transparent border-none p-1 focus:ring-1 focus:ring-[#C9A84C] rounded" placeholder="-" /></td>
                      <td className="px-4 py-2"><input type="number" value={m.utilities.wifi ?? ""} onChange={e => handleEdit(m.id, "utilities", "wifi", e.target.value)} className="w-full bg-transparent border-none p-1 focus:ring-1 focus:ring-[#C9A84C] rounded" placeholder="-" /></td>
                      <td className="px-4 py-2"><input type="number" value={m.utilities.water ?? ""} onChange={e => handleEdit(m.id, "utilities", "water", e.target.value)} className="w-full bg-transparent border-none p-1 focus:ring-1 focus:ring-[#C9A84C] rounded" placeholder="-" /></td>
                      <td className="px-4 py-2"><input type="number" value={m.utilities.numberOfPeople ?? ""} onChange={e => handleEdit(m.id, "utilities", "numberOfPeople", e.target.value)} className="w-full bg-transparent border-none p-1 focus:ring-1 focus:ring-[#C9A84C] rounded" placeholder="-" /></td>
                      <td className="px-4 py-2 text-right font-semibold text-[#0D1B2A] dark:text-[#C9A84C] bg-[#0D1B2A]/5">{perPerson === null ? '-' : `$${perPerson.toFixed(2)}`}</td>
                      <td className="px-4 py-2 text-right font-bold text-[#0D1B2A] dark:text-[#C9A84C] bg-[#0D1B2A]/5">${total.toFixed(2)}</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot className="bg-[#0D1B2A] text-white font-bold">
                <tr>
                  <td className="px-4 py-3">YEAR TOTAL</td>
                  <td className="px-4 py-3">${yearData.reduce((s, m) => s + (m.utilities.gas || 0), 0).toFixed(2)}</td>
                  <td className="px-4 py-3">${yearData.reduce((s, m) => s + (m.utilities.electricity || 0), 0).toFixed(2)}</td>
                  <td className="px-4 py-3">${yearData.reduce((s, m) => s + (m.utilities.wifi || 0), 0).toFixed(2)}</td>
                  <td className="px-4 py-3">${yearData.reduce((s, m) => s + (m.utilities.water || 0), 0).toFixed(2)}</td>
                  <td className="px-4 py-3"></td>
                  <td className="px-4 py-3 text-right text-[#F0D080]">
                    {averagePerPerson === null ? '-' : `$${averagePerPerson.toFixed(2)}`}
                  </td>
                  <td className="px-4 py-3 text-right text-[#F0D080]">
                    ${yearUtilitiesTotal.toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* MY COSTS TABLE */}
        {activeTab === "myCosts" && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b">
                <tr>
                  <th className="px-4 py-3 min-w-[100px]">Month</th>
                  <th className="px-4 py-3 min-w-[110px]">Mortgage</th>
                  <th className="px-4 py-3 min-w-[110px]">Insurance</th>
                  <th className="px-4 py-3 min-w-[110px]">Maint.</th>
                  <th className="px-4 py-3 min-w-[110px]">Tank</th>
                  <th className="px-4 py-3 min-w-[110px]">Tax</th>
                  <th className="px-4 py-3 min-w-[110px]">Water Bill</th>
                  <th className="px-4 py-3 min-w-[110px]">Rental In</th>
                  <th className="px-4 py-3 min-w-[120px] text-right bg-[#0D1B2A]/5 text-red-600 dark:text-red-400">Total Costs</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {yearData.map((m) => {
                  const costsTotal = ['mortgage', 'insurance', 'maintenance', 'waterTank', 'houseTax', 'waterBill'].reduce((sum, field) => sum + ((m.myCosts as any)[field] || 0), 0);
                  const total = costsTotal - (m.myCosts.rentalIn || 0);
                  const formattedTotal = total < 0 ? `-$${Math.abs(total).toFixed(2)}` : `$${total.toFixed(2)}`;

                  return (
                    <tr key={m.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-2 font-medium">{months[m.month]}</td>
                      {['mortgage', 'insurance', 'maintenance', 'waterTank', 'houseTax', 'waterBill', 'rentalIn'].map(field => (
                        <td key={field} className="px-4 py-2">
                          <input type="number" value={(m.myCosts as any)[field] ?? ""} onChange={e => handleEdit(m.id, "myCosts", field, e.target.value)} className="w-full bg-transparent border-none p-1 focus:ring-1 focus:ring-[#C9A84C] rounded" placeholder="-" />
                        </td>
                      ))}
                      <td className="px-4 py-2 text-right font-bold text-red-600 dark:text-red-400 bg-[#0D1B2A]/5">{formattedTotal}</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot className="bg-[#0D1B2A] text-white font-bold">
                <tr>
                  <td className="px-4 py-3">YEAR TOTAL</td>
                  {['mortgage', 'insurance', 'maintenance', 'waterTank', 'houseTax', 'waterBill', 'rentalIn'].map(field => (
                    <td key={field} className="px-4 py-3">
                      ${yearData.reduce((s, m) => s + ((m.myCosts as any)[field] || 0), 0).toFixed(2)}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-right text-red-400">
                    {(() => {
                      const finalYearTotal = yearData.reduce((s, m) => {
                        const costs = ['mortgage', 'insurance', 'maintenance', 'waterTank', 'houseTax', 'waterBill'].reduce((sum, field) => sum + ((m.myCosts as any)[field] || 0), 0);
                        return s + costs - (m.myCosts.rentalIn || 0);
                      }, 0);
                      return finalYearTotal < 0 ? `-$${Math.abs(finalYearTotal).toFixed(2)}` : `$${finalYearTotal.toFixed(2)}`;
                    })()}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* RENT TABLE */}
        {activeTab === "rent" && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b">
                <tr>
                  <th className="px-4 py-3 min-w-[100px]">Month</th>
                  <th className="px-4 py-3 min-w-[250px]">Tenants</th>
                  <th className="px-4 py-3 w-[100px] text-center">Action</th>
                  <th className="px-4 py-3 min-w-[120px] text-right bg-[#0D1B2A]/5 text-green-600 dark:text-green-400">Total Rent</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {yearData.map((m) => {
                  const total = m.rent.tenants.reduce((sum, t) => sum + (t.amount || 0), 0)
                  return (
                    <tr key={m.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-medium align-top">{months[m.month]}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-2">
                          {m.rent.tenants.length === 0 && <span className="text-muted-foreground text-xs italic">No tenants</span>}
                          {m.rent.tenants.map((t, i) => (
                            <div key={t.id} className="flex gap-2 items-center">
                              <input type="text" value={t.name} onChange={e => handleRentEdit(m.id, i, "name", e.target.value)} className="w-full bg-background border rounded px-2 py-1 text-xs focus:ring-1 focus:ring-[#C9A84C]" placeholder="Name" />
                              <span className="text-muted-foreground text-xs">$</span>
                              <input type="number" value={t.amount ?? ""} onChange={e => handleRentEdit(m.id, i, "amount", e.target.value)} className="w-24 bg-background border rounded px-2 py-1 text-xs focus:ring-1 focus:ring-[#C9A84C]" placeholder="Amount" />
                              <button onClick={() => handleRemoveTenant(m.id, i)} className="text-red-500 hover:text-red-700 p-1"><Trash2 className="w-3 h-3" /></button>
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center align-top">
                        <button onClick={() => handleAddTenant(m.id)} className="inline-flex items-center gap-1 text-xs font-medium text-[#C9A84C] hover:text-[#0D1B2A] transition-colors bg-muted/50 px-2 py-1 rounded">
                          <Plus className="w-3 h-3" /> Add
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-green-600 dark:text-green-400 align-top bg-[#0D1B2A]/5">${total.toFixed(2)}</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot className="bg-[#0D1B2A] text-white font-bold">
                <tr>
                  <td className="px-4 py-3" colSpan={3}>YEAR TOTAL RENT</td>
                  <td className="px-4 py-3 text-right text-green-400">
                    ${yearData.reduce((s, m) => s + m.rent.tenants.reduce((sum, t) => sum + (t.amount || 0), 0), 0).toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

      </div>
    </div>
  )
}
