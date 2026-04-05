import { NavTabs } from "@/components/nav-tabs";
import { TransactionList } from "@/components/transaction-list";
import { recentTransactions } from "@/lib/mock-data";

export default function HistoryPage() {
  return (
    <>
      <main className="min-h-screen px-4 pb-28 pt-6 md:px-6">
        <div className="mx-auto max-w-4xl">
          <div className="mb-6">
            <p className="text-sm uppercase tracking-[0.28em] text-white/[0.38]">
              Wallet activity
            </p>
            <h1 className="mt-3 font-display text-4xl font-bold text-white">
              Transaction history
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-8 text-white/60">
              A beginner-friendly ledger of transfers, deposits, and swaps. Tap
              any item later to open a detailed receipt view when backend data is
              connected.
            </p>
          </div>

          <TransactionList transactions={recentTransactions} />
        </div>
      </main>
      <NavTabs />
    </>
  );
}
