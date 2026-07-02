import { PaymentHistoryClientPage } from "./_components/payment-history-client-page";

export default function PaymentHistoryPage() {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-5">
        <div className="space-y-1">
            <h1 className="text-2xl font-bold">Payment History</h1>
            <p className="text-sm text-muted-foreground">Review payments, balances, and receipts.</p>
        </div>
        <PaymentHistoryClientPage />
    </div>
  );
}
