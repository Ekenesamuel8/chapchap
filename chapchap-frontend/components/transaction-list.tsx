"use client";

import { ConfidentialHistoryItem } from "@/lib/types";

type TransactionListProps = {
  transactions: ConfidentialHistoryItem[];
};

const statusClasses: Record<ConfidentialHistoryItem["status"], string> = {
  confirmed: "bg-emerald-400/15 text-emerald-300",
  submitted: "bg-sky-400/15 text-sky-200",
  draft: "bg-white/10 text-white/80",
  awaiting_wallet: "bg-amber-400/15 text-amber-200",
  failed: "bg-rose-400/15 text-rose-200",
  reviewed: "bg-violet-400/15 text-violet-200",
};

export function TransactionList({ transactions }: TransactionListProps) {
  return (
    <div className="glass-panel edge-glow rounded-[1.8rem] border border-white/10 p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-display text-xl font-semibold text-white">
            Confidential activity
          </p>
          <p className="mt-1 text-sm text-white/[0.58]">
            Synced from your confidential action history.
          </p>
        </div>
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/[0.65]">
          {transactions.length} items
        </span>
      </div>

      <div className="mt-5 space-y-3">
        {transactions.length ? (
          transactions.map((transaction, index) => (
            <div
              key={`${transaction.created_at}-${transaction.type}-${index}`}
              className="rounded-[1.4rem] border border-white/[0.08] bg-white/[0.03] px-4 py-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-medium text-white">{formatType(transaction.type)}</p>
                  <p className="mt-1 text-sm text-white/[0.55]">
                    {transaction.public_summary}
                  </p>
                  <p className="mt-2 text-xs text-white/[0.48]">
                    {getModeDescription(transaction.type)}
                  </p>
                  <p className="mt-2 text-xs text-white/[0.48]">
                    Network: {transaction.network}
                  </p>
                  <p className="mt-1 break-all text-xs text-white/[0.42]">
                    Tx hash: {transaction.tx_hash ?? "Not submitted yet"}
                  </p>
                  <p className="mt-1 break-all text-xs text-white/[0.42]">
                    Contract: {transaction.contract_address ?? "Pending wallet step"}
                  </p>
                  <p className="mt-2 text-xs text-white/40">
                    {new Date(transaction.created_at).toLocaleString()}
                  </p>
                </div>
                <div className="text-right">
                  <span
                    className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusClasses[transaction.status]}`}
                  >
                    {formatStatus(transaction.status)}
                  </span>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-[1.4rem] border border-white/[0.08] bg-white/[0.03] px-4 py-8 text-center text-sm text-white/[0.58]">
            No confidential actions yet. Start with a private payment, savings vault, or agreement prompt.
          </div>
        )}
      </div>
    </div>
  );
}

function formatType(type: ConfidentialHistoryItem["type"]) {
  return type.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatStatus(status: ConfidentialHistoryItem["status"]) {
  return status.replace(/_/g, " ");
}

function getModeDescription(type: ConfidentialHistoryItem["type"]) {
  switch (type) {
    case "confidential_payment":
      return "Recipient receives inside ChapChap private balance.";
    case "public_payment":
      return "Recipient receives normal Sepolia ETH.";
    case "confidential_savings":
      return "Funds move into the ChapChap private savings flow.";
    case "confidential_agreement":
      return "Agreement escrow stays in the ChapChap contract until settlement.";
    default:
      return "Confidential activity recorded for this wallet.";
  }
}
