"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { useBusinessExpenses, EXPENSE_CATEGORIES, PERSONAL_EXPENSE_CATEGORIES, BusinessExpense } from "@/hooks/use-business-expenses"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Image as ImageIcon, X, Briefcase, User as UserIcon } from "lucide-react"
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

interface EditExpenseDialogProps {
  expense: BusinessExpense | null
  isOpen: boolean
  onClose: () => void
}

export function EditExpenseDialog({ expense, isOpen, onClose }: EditExpenseDialogProps) {
  const { updateExpense } = useBusinessExpenses()
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null)
  const [isCompressing, setIsCompressing] = useState(false)

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      expenseType: "business",
      date: "",
      amount: undefined,
      category: "",
      paymentMethod: "",
      vendor: "",
      notes: "",
      receiptUrl: "",
    },
  })

  useEffect(() => {
    if (expense && isOpen) {
      form.reset({
        expenseType: expense.expenseType || "business",
        date: expense.date,
        amount: expense.amount,
        category: expense.category,
        paymentMethod: expense.paymentMethod || "",
        vendor: expense.vendor,
        notes: expense.notes || "",
        receiptUrl: expense.receiptUrl || "",
      })
      setReceiptPreview(expense.receiptUrl || null)
    }
  }, [expense, isOpen, form])

  const currentExpenseType = form.watch("expenseType");
  const categoriesList = currentExpenseType === "personal" ? PERSONAL_EXPENSE_CATEGORIES : EXPENSE_CATEGORIES;

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setIsCompressing(true)
      try {
        const base64 = await compressImage(e.target.files[0], 800, 0.6)
        setReceiptPreview(base64)
        form.setValue("receiptUrl", base64)
      } catch (error) {
        console.error("Failed to compress image", error)
      } finally {
        setIsCompressing(false)
      }
    }
  }

  const clearReceipt = () => {
    setReceiptPreview(null)
    form.setValue("receiptUrl", "")
  }

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!expense) return
    try {
      await updateExpense(expense.id, values)
      onClose()
    } catch (error) {
      console.error("Failed to update expense", error)
      alert("Failed to save changes. Please try again.")
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl sm:rounded-2xl border-white/20 dark:border-white/10 shadow-2xl p-6 sm:p-8 bg-white/95 dark:bg-card/95 backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">Edit Expense</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pt-4">
            
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
                <div className="relative w-fit">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={receiptPreview} alt="Receipt preview" className="h-32 rounded-md object-cover border shadow-sm" />
                  <Button type="button" variant="destructive" size="icon" className="absolute -top-2 -right-2 h-6 w-6 rounded-full shadow-md hover:bg-red-600" onClick={clearReceipt}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                  <Input type="file" accept="image/*" onChange={handleImageUpload} disabled={isCompressing} className="max-w-[300px] cursor-pointer" />
                  {isCompressing && <span className="text-sm text-muted-foreground animate-pulse flex items-center gap-1"><ImageIcon className="w-4 h-4" /> Compressing...</span>}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-6 border-t border-border/50">
              <Button type="button" variant="outline" onClick={onClose} className="rounded-full px-6">Cancel</Button>
              <Button type="submit" className="rounded-full px-8 bg-gradient-to-r from-[#0D1B2A] to-[#1E3A8A] text-[#F0D080] hover:from-[#1a2b40] hover:to-[#2a4a9a] dark:from-[#C9A84C] dark:to-[#F0D080] dark:text-[#0D1B2A] dark:hover:from-[#d4b561] dark:hover:to-[#f5d996] shadow-md transition-all hover:shadow-lg">
                Save Changes
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
