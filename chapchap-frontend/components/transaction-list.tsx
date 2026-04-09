"use client";

import { TransactionHistoryItem } from "@/lib/types";

type TransactionListProps = {
  transactions: TransactionHistoryItem[];
};

const statusClasses: Record<TransactionHistoryItem["status"], string> = {
  confirmed: "bg-emerald-400/15 text-emerald-300",
  submitted: "bg-sky-400/15 text-sky-200",
  pending: "bg-amber-400/15 text-amber-200",
  scheduled: "bg-violet-400/15 text-violet-200",
  failed: "bg-rose-400/15 text-rose-200",
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
            Synced from your PostgreSQL history.
          </p>
        </div>
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/[0.65]">
          {transactions.length} items
        </span>
      </div>

      <div className="mt-5 space-y-3">
        {transactions.length ? (
          transactions.map((transaction) => (
            <div
              key={transaction.id}
              className="rounded-[1.4rem] border border-white/[0.08] bg-white/[0.03] px-4 py-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-medium text-white">
                    {transaction.title ?? formatTitle(transaction)}
                  </p>
                  <p className="mt-1 text-sm text-white/[0.55]">
                    {transaction.subtitle ?? transaction.network}
                  </p>
                  <p className="mt-2 text-xs text-white/[0.48]">
                    Type: {transaction.transaction_type}
                  </p>
                  <p className="mt-1 text-xs text-white/[0.48]">
                    Recipient: {transaction.recipient_address ?? "Not applicable"}
                  </p>
                  <p className="mt-1 break-all text-xs text-white/[0.42]">
                    Tx hash: {transaction.tx_hash ?? "Pending / not available"}
                  </p>
                  <p className="mt-2 text-xs text-white/40">
                    {new Date(transaction.created_at).toLocaleString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-display text-md font-semibold text-white">
                    {formatAmount(transaction)}
                  </p>
                  <span
                    className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusClasses[transaction.status]}`}
                  >
                    {transaction.status}
                  </span>
                </div>
              </div>

              {transaction.explorer_url ? (
                <a
                  href={transaction.explorer_url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex text-xs font-semibold text-accent-soft"
                >
                  View on Explorer
                </a>
              ) : null}
            </div>
          ))
        ) : (
          <div className="rounded-[1.4rem] border border-white/[0.08] bg-white/[0.03] px-4 py-5 text-sm text-white/[0.58]">
            No activity yet. Your sends, scheduled payments, savings positions, and gift card requests will appear here.
          </div>
        )}
      </div>
    </div>
  );
}

function formatTitle(transaction: TransactionHistoryItem) {
  return `${transaction.transaction_type} ${transaction.asset_symbol}`.replace(
    /\b\w/g,
    (char) => char.toUpperCase(),
  );
}

function formatAmount(transaction: TransactionHistoryItem) {
  if (transaction.amount === "0") return transaction.asset_symbol;
  return `${transaction.amount} ${transaction.asset_symbol}`;
}
