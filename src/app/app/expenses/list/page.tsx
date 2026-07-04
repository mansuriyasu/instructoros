"use client"

import { useState, useMemo } from "react"
import { useBusinessExpenses } from "@/hooks/use-business-expenses"
import type { BusinessExpense } from "@/hooks/use-business-expenses"
import { Button } from "@/components/ui/button"
import { Trash2, Download, FileImage, Pencil, Filter, Search } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { EditExpenseDialog } from "../_components/edit-expense-dialog"

export default function ExpensesList() {
  const { expenses, deleteExpense, isLoaded } = useBusinessExpenses()
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString())
  const [selectedCategory, setSelectedCategory] = useState("All")
  const [editingExpense, setEditingExpense] = useState<BusinessExpense | null>(null)

  const [filterType, setFilterType] = useState<"all" | "business" | "personal">("all")

  const years = useMemo(() => {
    const y = new Set(expenses.map(e => e.date.substring(0, 4)))
    y.add(new Date().getFullYear().toString())
    return Array.from(y).sort((a, b) => b.localeCompare(a))
  }, [expenses])

  const typeFilteredExpenses = useMemo(() => {
    return expenses.filter(e => {
      const type = e.expenseType || 'business'
      return filterType === 'all' || type === filterType
    })
  }, [expenses, filterType])

  const categories = useMemo(() => {
    const c = new Set(typeFilteredExpenses.map(e => e.category))
    return Array.from(c).sort()
  }, [typeFilteredExpenses])

  const filtered = useMemo(() => {
    return typeFilteredExpenses.filter(e => {
      const matchYear = e.date.startsWith(selectedYear)
      const matchCat = selectedCategory === "All" || e.category === selectedCategory
      return matchYear && matchCat
    })
  }, [typeFilteredExpenses, selectedYear, selectedCategory])

  const handleExportCSV = () => {
    if (filtered.length === 0) return
    const headers = ["Date", "Category", "Vendor", "Payment Method", "Amount", "Notes"]
    const rows = filtered.map(e => [
      e.date, 
      `"${e.category}"`, 
      `"${e.vendor}"`, 
      `"${e.paymentMethod || ''}"`, 
      e.amount.toString(), 
      `"${e.notes || ''}"`
    ])
    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n")
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.download = `business_expenses_${selectedYear}.csv`
    link.click()
  }

  if (!isLoaded) return <div className="p-8 text-center text-muted-foreground animate-pulse">Loading...</div>

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500">
      
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/70 dark:bg-card/50 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-2xl p-4 sm:p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl shadow-inner w-full sm:w-auto">
            <button onClick={() => setFilterType('all')} className={`flex-1 sm:flex-none px-4 py-1.5 text-sm rounded-lg font-medium transition-all ${filterType === 'all' ? "bg-white dark:bg-slate-700 shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>All</button>
            <button onClick={() => setFilterType('business')} className={`flex-1 sm:flex-none px-4 py-1.5 text-sm rounded-lg font-medium transition-all ${filterType === 'business' ? "bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-blue-400" : "text-muted-foreground hover:text-foreground"}`}>Business</button>
            <button onClick={() => setFilterType('personal')} className={`flex-1 sm:flex-none px-4 py-1.5 text-sm rounded-lg font-medium transition-all ${filterType === 'personal' ? "bg-white dark:bg-slate-700 shadow-sm text-emerald-600 dark:text-emerald-400" : "text-muted-foreground hover:text-foreground"}`}>Personal</button>
          </div>

          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <select 
              value={selectedYear} 
              onChange={e => setSelectedYear(e.target.value)}
              className="bg-white dark:bg-background border rounded-lg pl-9 pr-8 py-2 text-sm font-medium shadow-sm focus:ring-2 focus:ring-[#C9A84C] outline-none transition-all w-full sm:w-[120px]"
            >
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <select 
              value={selectedCategory} 
              onChange={e => setSelectedCategory(e.target.value)}
              className="bg-white dark:bg-background border rounded-lg pl-9 pr-8 py-2 text-sm font-medium shadow-sm focus:ring-2 focus:ring-[#C9A84C] outline-none transition-all w-full sm:w-[180px] truncate"
            >
              <option value="All">All Categories</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <Button variant="outline" onClick={handleExportCSV} disabled={filtered.length === 0} className="w-full sm:w-auto gap-2 bg-white dark:bg-background hover:bg-muted shadow-sm">
          <Download className="w-4 h-4" /> Export CSV
        </Button>
      </div>

      {/* Mobile Card View */}
      <div className="grid grid-cols-1 gap-4 md:hidden">
        {filtered.length === 0 ? (
          <div className="bg-white/50 dark:bg-card/50 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-2xl p-8 text-center text-muted-foreground shadow-sm">
            No expenses found for the selected filters.
          </div>
        ) : (
          filtered.map(e => (
            <div key={e.id} className="bg-white/70 dark:bg-card/50 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-2xl p-5 shadow-sm flex flex-col gap-3">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-lg text-foreground">{e.vendor}</h3>
                  <p className="text-xs text-muted-foreground">{e.date}</p>
                </div>
                <div className="text-right flex flex-col items-end gap-1">
                  <p className="font-bold text-lg text-red-600 dark:text-red-400">${e.amount.toFixed(2)}</p>
                  <div className="flex gap-1">
                    {filterType === 'all' && (
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${(!e.expenseType || e.expenseType === 'business') ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'}`}>
                        {e.expenseType || 'business'}
                      </span>
                    )}
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[#0D1B2A]/10 text-[#0D1B2A] dark:bg-[#F0D080]/20 dark:text-[#F0D080]">
                      {e.category}
                    </span>
                  </div>
                </div>
              </div>
              
              {e.notes && (
                <div className="bg-muted/30 rounded-lg p-3 text-sm text-muted-foreground mt-2">
                  <span className="font-semibold text-foreground/70 text-xs uppercase block mb-1">Notes</span>
                  {e.notes}
                </div>
              )}
              
              <div className="flex items-center justify-between mt-2 pt-4 border-t border-border/50">
                <div className="text-xs text-muted-foreground">
                  <span className="font-semibold">Paid with:</span> {e.paymentMethod || '-'}
                </div>
                <div className="flex gap-1">
                  {e.receiptUrl && (
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" className="h-8 w-8 p-0 rounded-full" title="View Receipt">
                          <FileImage className="w-4 h-4 text-[#C9A84C]" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-[95vw] sm:max-w-3xl border-0 bg-transparent p-0 shadow-none">
                        <DialogHeader className="sr-only">
                          <DialogTitle>Receipt for {e.vendor}</DialogTitle>
                        </DialogHeader>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={e.receiptUrl} alt={`Receipt for ${e.vendor}`} className="w-full h-auto rounded-lg shadow-2xl bg-white" />
                      </DialogContent>
                    </Dialog>
                  )}
                  <Button variant="outline" size="sm" className="h-8 w-8 p-0 rounded-full" onClick={() => setEditingExpense(e)} title="Edit">
                    <Pencil className="w-4 h-4 text-blue-500" />
                  </Button>
                  <Button variant="outline" size="sm" className="h-8 w-8 p-0 rounded-full hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/50" onClick={() => { if(confirm('Delete this expense?')) deleteExpense(e.id) }} title="Delete">
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block bg-white/70 dark:bg-card/50 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-black/5 dark:bg-white/5 border-b border-white/10">
              <tr>
                <th className="px-6 py-4 font-semibold min-w-[120px]">Date</th>
                <th className="px-6 py-4 font-semibold min-w-[150px]">Category</th>
                <th className="px-6 py-4 font-semibold min-w-[180px]">Vendor</th>
                <th className="px-6 py-4 font-semibold min-w-[150px]">Payment</th>
                <th className="px-6 py-4 font-semibold min-w-[200px]">Notes</th>
                <th className="px-6 py-4 font-semibold text-center">Receipt</th>
                <th className="px-6 py-4 font-semibold min-w-[120px] text-right">Amount</th>
                <th className="px-6 py-4 font-semibold w-[100px] text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center">
                      <Search className="w-8 h-8 mb-3 opacity-20" />
                      <p>No expenses found for the selected filters.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map(e => (
                  <tr key={e.id} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors group">
                    <td className="px-6 py-4 font-medium text-foreground/80">{e.date}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1 items-start">
                        {filterType === 'all' && (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${(!e.expenseType || e.expenseType === 'business') ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'}`}>
                            {e.expenseType || 'business'}
                          </span>
                        )}
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-[#0D1B2A]/10 text-[#0D1B2A] dark:bg-[#F0D080]/20 dark:text-[#F0D080]">
                          {e.category}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-medium">{e.vendor}</td>
                    <td className="px-6 py-4 text-muted-foreground">{e.paymentMethod || '-'}</td>
                    <td className="px-6 py-4 text-muted-foreground truncate max-w-[200px]">{e.notes || '-'}</td>
                    <td className="px-6 py-4 text-center">
                      {e.receiptUrl ? (
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted/50 rounded-full" title="View Receipt">
                              <FileImage className="w-4 h-4 text-[#C9A84C]" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-3xl border-0 bg-transparent p-0 shadow-none">
                            <DialogHeader className="sr-only">
                              <DialogTitle>Receipt for {e.vendor}</DialogTitle>
                            </DialogHeader>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={e.receiptUrl} alt={`Receipt for ${e.vendor}`} className="w-full h-auto rounded-lg shadow-2xl bg-white" />
                          </DialogContent>
                        </Dialog>
                      ) : (
                        <span className="text-muted-foreground/30 text-xs">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-red-600 dark:text-red-400">
                      ${e.amount.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-1 opacity-50 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-950/50 rounded-full transition-colors" onClick={() => setEditingExpense(e)} title="Edit Expense">
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/50 rounded-full transition-colors" onClick={() => { if(confirm('Delete this expense?')) deleteExpense(e.id) }} title="Delete Expense">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {filtered.length > 0 && (
              <tfoot className="bg-gradient-to-r from-[#0D1B2A] to-[#1E3A8A] text-white font-bold">
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-right uppercase tracking-wider text-xs text-white/80">Total for view</td>
                  <td className="px-6 py-4 text-right text-[#F0D080] text-lg">
                    ${filtered.reduce((sum, e) => sum + e.amount, 0).toFixed(2)}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      <EditExpenseDialog 
        expense={editingExpense} 
        isOpen={!!editingExpense} 
        onClose={() => setEditingExpense(null)} 
      />
    </div>
  )
}
