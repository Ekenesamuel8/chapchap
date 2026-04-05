"use client";

import { SuccessIcon } from "@/components/icons";
import { PaymentIntent } from "@/lib/types";

type TransactionSuccessCardProps = {
  paymentIntent: PaymentIntent;
  open: boolean;
  onDone: () => void;
};

export function TransactionSuccessCard({
  paymentIntent,
  open,
  onDone,
}: TransactionSuccessCardProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm">
      <div className="glass-panel edge-glow animate-float-up w-full max-w-md rounded-[2rem] border border-white/10 p-6 text-center">
        <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-success/15 text-success">
          <SuccessIcon className="size-8" />
        </div>
        <h3 className="mt-4 font-display text-3xl font-bold text-white">
          Transaction Sent
        </h3>
        <p className="mt-2 text-sm leading-6 text-white/[0.68]">
          {paymentIntent.amount} {paymentIntent.asset} to {paymentIntent.recipient}
        </p>

        <div className="mt-5 rounded-[1.6rem] border border-white/10 bg-white/5 p-4 text-left">
          <DetailRow label="Recipient" value={paymentIntent.recipient} />
          <DetailRow label="Network" value={paymentIntent.network} />
          <DetailRow label="Tx hash" value="0xb893...12d2" />
        </div>

        <div className="mt-5 grid gap-3">
          <button
            type="button"
            className="rounded-full bg-white px-4 py-3 font-semibold text-black"
          >
            View on Explorer
          </button>
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

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 text-sm">
      <span className="text-white/50">{label}</span>
      <span className="font-medium text-white/[0.86]">{value}</span>
    </div>
  );
}
