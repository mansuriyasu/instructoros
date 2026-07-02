"use client"

import { useState, useMemo } from "react"
import { useUtilityTracker } from "@/hooks/use-utility-tracker"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts"

export default function UtilityTrackerDashboard() {
  const { data } = useUtilityTracker()
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear())

  // Default to 2025 if current year is not in data
  const yearToUse = data?.years.includes(selectedYear) ? selectedYear : (data?.years[0] || 2025)

  const yearData = useMemo(() => {
    return data?.monthlyData.filter((m) => m.year === yearToUse) || []
  }, [data, yearToUse])

  const kpis = useMemo(() => {
    let totalMortgage = 0
    let rentalIncome = 0
    let totalUtilities = 0
    let totalPeople = 0
    let utilityMonths = 0

    yearData.forEach((m) => {
      totalMortgage += m.myCosts.mortgage || 0
      
      const monthRent = m.rent.tenants.reduce((sum, t) => sum + (t.amount || 0), 0)
      rentalIncome += monthRent

      const monthUtil = (m.utilities.gas || 0) + (m.utilities.electricity || 0) + (m.utilities.wifi || 0) + (m.utilities.water || 0)
      totalUtilities += monthUtil

      if (m.utilities.numberOfPeople && m.utilities.numberOfPeople > 0) {
        totalPeople += m.utilities.numberOfPeople
        utilityMonths++
      }
    })

    const netPosition = rentalIncome - totalMortgage - totalUtilities
    const avgPeople = utilityMonths > 0 ? totalPeople / utilityMonths : 0
    const perPersonUtil = avgPeople > 0 ? totalUtilities / avgPeople : 0

    return { totalMortgage, rentalIncome, netPosition, totalUtilities, perPersonUtil }
  }, [yearData])

  const chartData = useMemo(() => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    return yearData.map(m => ({
      name: months[m.month],
      Gas: m.utilities.gas || 0,
      Electricity: m.utilities.electricity || 0,
      WiFi: m.utilities.wifi || 0,
      Water: m.utilities.water || 0,
    }))
  }, [yearData])

  if (!data) return <div className="p-8 text-center text-muted-foreground animate-pulse">Loading Utility Tracker...</div>

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-300">
      {/* Top Bar */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Dashboard Overview</h2>
        <select 
          value={yearToUse} 
          onChange={(e) => setSelectedYear(Number(e.target.value))}
          className="bg-background border rounded-md px-3 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#C9A84C]"
        >
          {data.years.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: "Total Mortgage", value: kpis.totalMortgage },
          { label: "Rental Income", value: kpis.rentalIncome },
          { label: "Net Position", value: kpis.netPosition, isNet: true },
          { label: "Total Utilities", value: kpis.totalUtilities },
          { label: "Per Person Avg (Yearly)", value: kpis.perPersonUtil },
        ].map((kpi, i) => (
          <div key={i} className="bg-card border rounded-xl p-4 shadow-sm flex flex-col justify-center transition-all hover:shadow-md">
            <p className="text-sm text-muted-foreground font-medium mb-1">{kpi.label}</p>
            <p className={`text-2xl font-bold ${kpi.isNet ? (kpi.value >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400') : 'text-[#0D1B2A] dark:text-[#F0D080]'}`}>
              ${kpi.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
        ))}
      </div>

      {/* Chart & Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Utility Breakdown Chart */}
        <div className="bg-card border rounded-xl p-4 shadow-sm flex flex-col gap-4">
          <h3 className="font-semibold text-lg text-[#0D1B2A] dark:text-white">Utility Breakdown</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} vertical={false} />
                <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`} />
                <Tooltip cursor={{ fill: 'rgba(0,0,0,0.05)' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                <Legend iconType="circle" />
                <Bar dataKey="Gas" stackId="a" fill="#C9A84C" radius={[0, 0, 4, 4]} />
                <Bar dataKey="Electricity" stackId="a" fill="#0D1B2A" />
                <Bar dataKey="Water" stackId="a" fill="#3B82F6" />
                <Bar dataKey="WiFi" stackId="a" fill="#10B981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Tenant Rent Breakdown */}
        <div className="bg-card border rounded-xl p-4 shadow-sm flex flex-col gap-4 overflow-hidden">
          <h3 className="font-semibold text-lg text-[#0D1B2A] dark:text-white">Tenant Rent Breakdown</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/50">
                <tr>
                  <th className="px-4 py-3 rounded-tl-md">Month</th>
                  <th className="px-4 py-3">Tenants</th>
                  <th className="px-4 py-3 text-right rounded-tr-md">Total Rent</th>
                </tr>
              </thead>
              <tbody>
                {yearData.filter(m => m.rent.tenants.length > 0).length === 0 && (
                  <tr><td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">No rent data for this year.</td></tr>
                )}
                {yearData.map((m, i) => {
                  if (m.rent.tenants.length === 0) return null;
                  const monthName = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m.month];
                  const totalRent = m.rent.tenants.reduce((sum, t) => sum + (t.amount || 0), 0);
                  return (
                    <tr key={m.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-medium">{monthName}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {m.rent.tenants.map(t => (
                            <span key={t.id} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[#0D1B2A]/10 text-[#0D1B2A] dark:bg-[#F0D080]/20 dark:text-[#F0D080]">
                              {t.name}: ${t.amount || 0}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-bold">${totalRent.toLocaleString()}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  )
}
