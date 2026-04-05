"use client";

import { BottomSheet } from "@/components/bottom-sheet";
import { PaymentIntent } from "@/lib/types";

type TransactionConfirmationSheetProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  paymentIntent: PaymentIntent;
};

export function TransactionConfirmationSheet({
  open,
  onClose,
  onConfirm,
  paymentIntent,
}: TransactionConfirmationSheetProps) {
  return (
    <BottomSheet open={open} onClose={onClose} title="Confirm transaction">
      <div className="rounded-[1.6rem] border border-accent-soft/20 bg-gradient-to-br from-accent-soft/12 via-white/[0.03] to-accent-warm/12 p-5">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm text-white/[0.55]">Amount</p>
            <p className="font-display text-3xl font-bold text-white">
              {paymentIntent.amount} {paymentIntent.asset}
            </p>
          </div>
          <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs text-white/[0.7]">
            {paymentIntent.network}
          </span>
        </div>

        <dl className="mt-5 grid gap-3">
          <DetailRow label="Recipient" value={paymentIntent.recipient} />
          <DetailRow
            label="Recipient address"
            value={paymentIntent.recipientAddress}
          />
          <DetailRow label="Asset" value={paymentIntent.asset} />
          <DetailRow label="Estimated gas" value={paymentIntent.estimatedGas} />
          <DetailRow label="Note" value={paymentIntent.note} />
          <DetailRow label="Schedule" value={paymentIntent.schedule} />
        </dl>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-white/10 bg-white/5 px-4 py-3 font-semibold text-white/80"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="rounded-full bg-white px-4 py-3 font-semibold text-black"
        >
          Confirm
        </button>
      </div>
    </BottomSheet>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/[0.08] bg-black/20 px-4 py-3">
      <dt className="text-sm text-white/50">{label}</dt>
      <dd className="text-right text-sm font-medium text-white/[0.86]">{value}</dd>
    </div>
  );
}
