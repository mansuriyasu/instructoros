"use client"

import { useMemo, useState } from "react"
import { useBusinessExpenses } from "@/hooks/use-business-expenses"
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts"
import { DollarSign, TrendingUp, Award, Calendar } from "lucide-react"

const COLORS = ['#0D1B2A', '#1E3A8A', '#3B82F6', '#60A5FA', '#93C5FD', '#C9A84C', '#F0D080', '#FCD34D', '#10B981', '#F43F5E', '#8B5CF6']

export default function ExpensesDashboard() {
  const { expenses, isLoaded } = useBusinessExpenses()
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString())
  const [filterType, setFilterType] = useState<"all" | "business" | "personal">("business")

  const years = useMemo(() => {
    const y = new Set(expenses.map(e => e.date.substring(0, 4)))
    y.add(new Date().getFullYear().toString())
    return Array.from(y).sort((a, b) => b.localeCompare(a))
  }, [expenses])

  const filteredExpenses = useMemo(() => {
    return expenses.filter(e => {
      const isYearMatch = e.date.startsWith(selectedYear)
      const type = e.expenseType || 'business'
      const isTypeMatch = filterType === 'all' || type === filterType
      return isYearMatch && isTypeMatch
    })
  }, [expenses, selectedYear, filterType])

  const categoryData = useMemo(() => {
    const map = new Map<string, number>()
    filteredExpenses.forEach(e => {
      map.set(e.category, (map.get(e.category) || 0) + e.amount)
    })
    return Array.from(map.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
  }, [filteredExpenses])

  const monthlyData = useMemo(() => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    const data = months.map(m => ({ name: m, amount: 0 }))
    filteredExpenses.forEach(e => {
      const monthIndex = parseInt(e.date.substring(5, 7)) - 1
      if (monthIndex >= 0 && monthIndex < 12) {
        data[monthIndex].amount += e.amount
      }
    })
    return data
  }, [filteredExpenses])

  const totalExpenses = filteredExpenses.reduce((sum, e) => sum + e.amount, 0)
  const topCategory = categoryData.length > 0 ? categoryData[0] : null

  if (!isLoaded) return <div className="p-8 text-center text-muted-foreground animate-pulse">Loading...</div>

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500">
      
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white/50 dark:bg-card/50 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-2xl p-5 shadow-sm gap-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-muted-foreground" />
          <h2 className="text-lg font-bold">Overview</h2>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl shadow-inner">
            <button onClick={() => setFilterType('all')} className={`px-4 py-1.5 text-sm rounded-lg font-medium transition-all ${filterType === 'all' ? "bg-white dark:bg-slate-700 shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>All</button>
            <button onClick={() => setFilterType('business')} className={`px-4 py-1.5 text-sm rounded-lg font-medium transition-all ${filterType === 'business' ? "bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-blue-400" : "text-muted-foreground hover:text-foreground"}`}>Business</button>
            <button onClick={() => setFilterType('personal')} className={`px-4 py-1.5 text-sm rounded-lg font-medium transition-all ${filterType === 'personal' ? "bg-white dark:bg-slate-700 shadow-sm text-emerald-600 dark:text-emerald-400" : "text-muted-foreground hover:text-foreground"}`}>Personal</button>
          </div>

          <select 
            value={selectedYear} 
            onChange={e => setSelectedYear(e.target.value)}
            className="bg-white dark:bg-background border rounded-lg px-4 py-2 text-sm font-medium shadow-sm focus:ring-2 focus:ring-[#C9A84C] outline-none transition-all w-full sm:w-auto"
          >
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="relative overflow-hidden bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950/40 dark:to-background border border-red-200/50 dark:border-red-900/50 rounded-2xl p-6 shadow-sm hover:-translate-y-1 hover:shadow-md transition-all duration-300 flex flex-col justify-center">
          <div className="absolute right-0 top-0 p-4 opacity-10"><DollarSign className="w-24 h-24" /></div>
          <div className="relative z-10">
            <p className="text-sm text-red-800/70 dark:text-red-300/70 font-semibold mb-1 uppercase tracking-wider">Total Expenses ({selectedYear})</p>
            <p className="text-4xl font-extrabold text-red-600 dark:text-red-400 drop-shadow-sm">
              ${totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>
        
        <div className="relative overflow-hidden bg-gradient-to-br from-[#F0D080]/20 to-white dark:from-[#C9A84C]/10 dark:to-background border border-[#F0D080]/30 rounded-2xl p-6 shadow-sm hover:-translate-y-1 hover:shadow-md transition-all duration-300 flex flex-col justify-center">
          <div className="absolute right-0 top-0 p-4 opacity-10"><Award className="w-24 h-24" /></div>
          <div className="relative z-10">
            <p className="text-sm text-muted-foreground font-semibold mb-1 uppercase tracking-wider">Top Expense Category</p>
            <p className="text-2xl font-extrabold text-[#0D1B2A] dark:text-[#F0D080] truncate">
              {topCategory ? topCategory.name : "None"}
            </p>
            {topCategory && <p className="text-sm font-medium text-muted-foreground mt-2 bg-black/5 dark:bg-white/10 w-fit px-2 py-0.5 rounded-md">${topCategory.value.toLocaleString()} ({Math.round(topCategory.value / totalExpenses * 100)}%)</p>}
          </div>
        </div>

        <div className="relative overflow-hidden bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/20 dark:to-background border border-blue-100 dark:border-blue-900/30 rounded-2xl p-6 shadow-sm hover:-translate-y-1 hover:shadow-md transition-all duration-300 flex flex-col justify-center">
          <div className="absolute right-0 top-0 p-4 opacity-10"><TrendingUp className="w-24 h-24" /></div>
          <div className="relative z-10">
            <p className="text-sm text-muted-foreground font-semibold mb-1 uppercase tracking-wider">Monthly Average</p>
            <p className="text-3xl font-extrabold text-[#0D1B2A] dark:text-[#60A5FA]">
              ${(totalExpenses / 12).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        <div className="bg-white/70 dark:bg-card/50 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-2xl p-5 sm:p-6 shadow-sm hover:shadow-md transition-all duration-300">
          <h3 className="font-bold text-lg mb-6 flex items-center gap-2">
            <PieChart className="w-5 h-5 text-[#C9A84C]" /> Expenses by Category
          </h3>
          {categoryData.length === 0 ? (
            <div className="h-[250px] sm:h-[300px] flex items-center justify-center text-muted-foreground bg-muted/20 rounded-xl">No data for {selectedYear}</div>
          ) : (
            <div className="h-[250px] sm:h-[300px] -mx-4 sm:mx-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={3}
                    dataKey="value"
                    stroke="none"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} className="hover:opacity-80 transition-opacity" />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => `$${value.toFixed(2)}`} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }} />
                  <Legend layout="horizontal" verticalAlign="bottom" align="center" wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}/>
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="bg-white/70 dark:bg-card/50 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-2xl p-5 sm:p-6 shadow-sm hover:shadow-md transition-all duration-300">
          <h3 className="font-bold text-lg mb-6 flex items-center gap-2">
            <BarChart className="w-5 h-5 text-[#3B82F6]" /> Monthly Trend
          </h3>
          <div className="h-[250px] sm:h-[300px] -ml-4 sm:ml-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.1} vertical={false} />
                <XAxis dataKey="name" fontSize={11} tickLine={false} axisLine={false} dy={10} />
                <YAxis fontSize={11} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`} />
                <Tooltip cursor={{ fill: 'rgba(0,0,0,0.05)' }} formatter={(value: number) => `$${value.toFixed(2)}`} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }} />
                <Bar dataKey="amount" fill="#0D1B2A" radius={[6, 6, 0, 0]} name="Expenses" className="dark:fill-[#60A5FA] hover:opacity-80 transition-opacity" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    </div>
  )
}
