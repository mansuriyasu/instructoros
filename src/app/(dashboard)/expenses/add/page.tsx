"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { useBusinessExpenses, EXPENSE_CATEGORIES, PERSONAL_EXPENSE_CATEGORIES } from "@/hooks/use-business-expenses"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CheckCircle2, Image as ImageIcon, Loader2, Sparkles, X, Briefcase, User as UserIcon } from "lucide-react"
import { compressImage } from "@/lib/image-utils"
import { cn } from "@/lib/utils"

const formSchema = z.object({
  expenseType: z.enum(["business", "personal"]).default("business"),
  date: z.string().nonempty("Date is required"),
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  category: z.string().nonempty("Category is required"),
  paymentMethod: z.string().nonempty("Payment method is required"),
  vendor: z.string().nonempty("Vendor / Payee is required"),
  notes: z.string().optional(),
  receiptUrl: z.string().optional(),
})

export default function AddExpensePage() {
  const { addExpense } = useBusinessExpenses()
  const { toast } = useToast()
  const router = useRouter()
  const [success, setSuccess] = useState(false)
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null)
  const [isCompressing, setIsCompressing] = useState(false)
  const [isScanningReceipt, setIsScanningReceipt] = useState(false)
  const [receiptScanError, setReceiptScanError] = useState<string | null>(null)

  const applyReceiptDetails = (details: any) => {
    if (details.date) form.setValue("date", details.date, { shouldValidate: true, shouldDirty: true })
    if (details.amount > 0) form.setValue("amount", details.amount, { shouldValidate: true, shouldDirty: true })
    if (details.category) form.setValue("category", details.category, { shouldValidate: true, shouldDirty: true })
    if (details.paymentMethod) form.setValue("paymentMethod", details.paymentMethod, { shouldValidate: true, shouldDirty: true })
    if (details.vendor) form.setValue("vendor", details.vendor, { shouldValidate: true, shouldDirty: true })
    if (details.notes) form.setValue("notes", details.notes, { shouldValidate: true, shouldDirty: true })
  }

  const scanReceipt = async (receiptDataUri: string) => {
    setIsScanningReceipt(true)
    setReceiptScanError(null)
    try {
      const response = await fetch("/api/receipt-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receiptFile: receiptDataUri }),
      })
      const result = await response.json()
      if (!response.ok || !result.ok) {
        throw new Error(result.error || "Could not scan the receipt.")
      }
      applyReceiptDetails(result.details)
    } catch (error) {
      console.error("Failed to scan receipt", error)
      setReceiptScanError(error instanceof Error ? error.message : "Could not scan the receipt.")
    } finally {
      setIsScanningReceipt(false)
    }
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setIsCompressing(true)
      try {
        const base64 = await compressImage(e.target.files[0], 1200, 0.7)
        setReceiptPreview(base64)
        form.setValue("receiptUrl", base64)
        await scanReceipt(base64)
      } catch (error) {
        console.error("Failed to compress image", error)
      } finally {
        setIsCompressing(false)
      }
    }
  }

  const clearReceipt = () => {
    setReceiptPreview(null)
    setReceiptScanError(null)
    form.setValue("receiptUrl", "")
  }

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      expenseType: "business",
      date: new Date().toISOString().split('T')[0],
      amount: undefined,
      category: "",
      paymentMethod: "",
      vendor: "",
      notes: "",
    },
  })

  const currentExpenseType = form.watch("expenseType");
  const categoriesList = currentExpenseType === "personal" ? PERSONAL_EXPENSE_CATEGORIES : EXPENSE_CATEGORIES;

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      await addExpense(values)
      setSuccess(true)
      toast({ title: "Expense saved!" })
    setTimeout(() => {
      setSuccess(false)
      form.reset({
        expenseType: "business",
        date: new Date().toISOString().split('T')[0],
        amount: undefined,
        category: "",
        paymentMethod: "",
        vendor: "",
        notes: "",
        receiptUrl: "",
      })
      setReceiptPreview(null)
      setReceiptScanError(null)
    }, 2000)
    } catch (error) {
      console.error("Failed to add expense", error)
      toast({ variant: "destructive", title: "Failed to save expense. Please try again." })
    }
  }

  return (
    <div className="max-w-2xl mx-auto bg-white/80 dark:bg-card/80 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-3xl p-6 sm:p-10 shadow-xl animate-in fade-in zoom-in-95 duration-500">
      <h2 className="text-2xl font-extrabold mb-8 text-foreground/90">Log New Expense</h2>

      {success ? (
        <div className="flex flex-col items-center justify-center py-16 text-center animate-in zoom-in duration-500">
          <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-6 shadow-inner">
            <CheckCircle2 className="w-10 h-10 text-green-500 dark:text-green-400" />
          </div>
          <h3 className="text-2xl font-bold text-green-700 dark:text-green-400">Expense Saved!</h3>
          <p className="text-muted-foreground mt-2">Your expense has been successfully recorded.</p>
        </div>
      ) : (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            
            <FormField control={form.control} name="expenseType" render={({ field }) => (
              <FormItem className="space-y-3">
                <FormLabel>Expense Type</FormLabel>
                <FormControl>
                  <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-full sm:w-fit shadow-inner">
                    <Button
                      type="button"
                      variant="ghost"
                      className={cn("flex-1 sm:flex-none rounded-lg px-6 gap-2 transition-all", field.value === 'business' ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm font-semibold" : "text-muted-foreground hover:text-foreground")}
                      onClick={() => {
                        field.onChange('business')
                        form.setValue('category', '')
                      }}
                    >
                      <Briefcase className="w-4 h-4" /> Business
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className={cn("flex-1 sm:flex-none rounded-lg px-6 gap-2 transition-all", field.value === 'personal' ? "bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm font-semibold" : "text-muted-foreground hover:text-foreground")}
                      onClick={() => {
                        field.onChange('personal')
                        form.setValue('category', '')
                      }}
                    >
                      <UserIcon className="w-4 h-4" /> Personal
                    </Button>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              <FormField control={form.control} name="date" render={({ field }) => (
                <FormItem>
                  <FormLabel>Date *</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} className="focus-visible:ring-[#C9A84C]" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="amount" render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount ($) *</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" placeholder="0.00" {...field} className="focus-visible:ring-[#C9A84C]" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="category" render={({ field }) => (
                <FormItem>
                  <FormLabel>Category *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="focus:ring-[#C9A84C]">
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {categoriesList.map(cat => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="paymentMethod" render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment Method *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="focus:ring-[#C9A84C]">
                        <SelectValue placeholder="Select payment method" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Credit Card">Credit Card</SelectItem>
                      <SelectItem value="Debit Card">Debit Card</SelectItem>
                      <SelectItem value="Cash">Cash</SelectItem>
                      <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="vendor" render={({ field }) => (
                <FormItem>
                  <FormLabel>Vendor / Payee *</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Shell Station, Mechanic" {...field} className="focus-visible:ring-[#C9A84C]" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem>
                <FormLabel>Description / Notes</FormLabel>
                <FormControl>
                  <Textarea placeholder="Any extra details about this expense..." {...field} className="focus-visible:ring-[#C9A84C] min-h-[100px]" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="flex flex-col gap-3">
              <FormLabel>Receipt Image (Optional)</FormLabel>
              {receiptPreview ? (
                <div className="flex flex-col gap-3">
                  <div className="relative w-fit">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={receiptPreview} alt="Receipt preview" className="h-32 rounded-md object-cover border shadow-sm" />
                    <Button type="button" variant="destructive" size="icon" className="absolute -top-2 -right-2 h-6 w-6 rounded-full shadow-md hover:bg-red-600" onClick={clearReceipt}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-fit gap-2"
                      onClick={() => scanReceipt(receiptPreview)}
                      disabled={isScanningReceipt}
                    >
                      {isScanningReceipt ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                      {isScanningReceipt ? "Scanning receipt" : "Scan receipt"}
                    </Button>
                    {isScanningReceipt && (
                      <span className="text-xs text-muted-foreground">Reading vendor, total, date, and category...</span>
                    )}
                    {receiptScanError && (
                      <span className="text-xs text-destructive">{receiptScanError}</span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                  <Input type="file" accept="image/*" onChange={handleImageUpload} disabled={isCompressing} className="max-w-[300px] cursor-pointer" />
                  {isCompressing && <span className="text-sm text-muted-foreground animate-pulse flex items-center gap-1"><ImageIcon className="w-4 h-4" /> Preparing receipt...</span>}
                  {!isCompressing && <span className="text-xs text-muted-foreground italic">The receipt will be scanned and attached.</span>}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-4 pt-8 border-t border-border/50">
              <Button type="button" variant="ghost" onClick={() => router.push('/expenses')} className="rounded-full px-6">Cancel</Button>
              <Button type="submit" className="rounded-full px-8 bg-gradient-to-r from-[#0D1B2A] to-[#1E3A8A] text-[#F0D080] hover:from-[#1a2b40] hover:to-[#2a4a9a] dark:from-[#C9A84C] dark:to-[#F0D080] dark:text-[#0D1B2A] dark:hover:from-[#d4b561] dark:hover:to-[#f5d996] shadow-lg transition-all hover:shadow-xl hover:-translate-y-0.5">
                Save Expense
              </Button>
            </div>
          </form>
        </Form>
      )}
    </div>
  )
}
