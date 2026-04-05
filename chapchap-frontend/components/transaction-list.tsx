import { TransactionRecord } from "@/lib/types";

type TransactionListProps = {
  transactions: TransactionRecord[];
};

const statusClasses: Record<TransactionRecord["status"], string> = {
  success: "bg-emerald-400/15 text-emerald-300",
  pending: "bg-amber-400/15 text-amber-200",
  incoming: "bg-sky-400/15 text-sky-200",
};

export function TransactionList({ transactions }: TransactionListProps) {
  return (
    <div className="glass-panel edge-glow rounded-[1.8rem] border border-white/10 p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-display text-xl font-semibold text-white">
            Recent activity
          </p>
          <p className="mt-1 text-sm text-white/[0.58]">
            Incoming, outgoing, and swap events.
          </p>
        </div>
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/[0.65]">
          Mocked history
        </span>
      </div>

      <div className="mt-5 space-y-3">
        {transactions.map((transaction) => (
          <button
            key={transaction.id}
            type="button"
            className="w-full rounded-[1.4rem] border border-white/[0.08] bg-white/[0.03] px-4 py-4 text-left hover:bg-white/[0.05]"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-medium text-white">{transaction.title}</p>
                <p className="mt-1 text-sm text-white/[0.55]">
                  {transaction.subtitle}
                </p>
                <p className="mt-2 text-xs text-white/40">{transaction.time}</p>
              </div>
              <div className="text-right">
                <p className="font-display text-md font-semibold text-white">
                  {transaction.amount}
                </p>
                <span
                  className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusClasses[transaction.status]}`}
                >
                  {transaction.status}
                </span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
