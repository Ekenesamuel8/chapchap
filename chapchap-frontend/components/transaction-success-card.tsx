"use client";

import { SuccessIcon } from "@/components/icons";
import { SubmittedTransactionView } from "@/lib/types";

type TransactionSuccessCardProps = {
  transaction: SubmittedTransactionView;
  open: boolean;
  onDone: () => void;
};

export function TransactionSuccessCard({
  transaction,
  open,
  onDone,
}: TransactionSuccessCardProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-black/65 p-4 backdrop-blur-sm">
      <div className="glass-panel edge-glow animate-float-up relative w-full max-w-md overflow-y-auto rounded-[2rem] border border-white/10 p-4 text-center max-h-[90vh] sm:p-6">
        <button
          type="button"
          onClick={onDone}
          aria-label="Close"
          className="absolute right-4 top-4 inline-flex size-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-lg text-white/[0.8] hover:bg-white/10"
        >
          ×
        </button>
        <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-success/15 text-success">
          <SuccessIcon className="size-8" />
        </div>
        <h3 className="mt-4 font-display text-2xl font-bold text-white sm:text-3xl">
          {transaction.status === "scheduled"
            ? "Payment Scheduled"
            : "Transaction Successful"}
        </h3>
        <p className="mt-2 text-sm leading-6 text-white/[0.68]">
          {transaction.amount} {transaction.asset} to {transaction.recipient}
        </p>

        <div className="mt-5 rounded-[1.6rem] border border-white/10 bg-white/5 p-4 text-left">
          <DetailRow label="Recipient" value={transaction.recipient} />
          <DetailRow label="Network" value={transaction.network} />
          <DetailRow
            label={transaction.status === "scheduled" ? "Status" : "Tx hash"}
            value={
              transaction.status === "scheduled"
                ? "Scheduled"
                : shortenHash(transaction.txHash)
            }
          />
          <DetailRow label="Timestamp" value={transaction.submittedAt} />
        </div>

        <div className="mt-5 grid gap-3">
          {transaction.explorerUrl && transaction.status !== "scheduled" ? (
            <a
              href={transaction.explorerUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-full bg-white px-4 py-3 font-semibold text-black"
            >
              View on Explorer
            </a>
          ) : null}
          <button
            type="button"
            onClick={onDone}
            className="rounded-full border border-white/10 bg-white/5 px-4 py-3 font-semibold text-white/[0.82]"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function shortenHash(hash: string) {
  if (hash.length <= 14) return hash;
  return `${hash.slice(0, 8)}...${hash.slice(-6)}`;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 py-2 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <span className="text-white/50">{label}</span>
      <span className="break-all font-medium text-white/[0.86]">{value}</span>
    </div>
  );
}
