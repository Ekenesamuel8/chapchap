"use client";

import { BottomSheet } from "@/components/bottom-sheet";
import { CopyIcon, WalletIcon } from "@/components/icons";

type FundWalletSheetProps = {
  open: boolean;
  onClose: () => void;
  fullAddress: string;
  onCopyAddress: () => void;
};

export function FundWalletSheet({
  open,
  onClose,
  fullAddress,
  onCopyAddress,
}: FundWalletSheetProps) {
  return (
    <BottomSheet open={open} onClose={onClose} title="Fund Wallet">
      <div className="grid gap-4">
        <div className="rounded-[1.6rem] border border-white/10 bg-white/5 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-display text-md font-semibold text-white">
                Receive Crypto
              </p>
              <p className="mt-2 text-sm leading-6 text-white/[0.68]">
                Use this address to receive Tezos USDC or supported assets on
                Etherlink.
              </p>
            </div>
            <div className="rounded-2xl bg-accent/15 p-3 text-accent-soft">
              <WalletIcon />
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-accent-soft/20 bg-black/20 p-4">
            <p className="text-xs uppercase tracking-[0.24em] text-white/40">
              Wallet address
            </p>
            <p className="mt-2 break-all text-sm leading-7 text-white/[0.82]">
              {fullAddress}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={onCopyAddress}
                className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-black"
              >
                <CopyIcon className="size-4" />
                Copy address
              </button>
              <p className="text-xs text-white/50">
                Only send supported assets on Etherlink / Tezos EVM.
              </p>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-center rounded-[1.5rem] border border-dashed border-white/[0.15] bg-white/[0.03] p-6">
            <div className="grid size-32 place-items-center rounded-[1.25rem] border border-white/[0.12] bg-[radial-gradient(circle_at_top,_rgba(118,87,246,0.25),_transparent_70%)] text-center text-xs leading-5 text-white/[0.55]">
              QR code
              <span className="block">placeholder</span>
            </div>
          </div>
        </div>

        <div className="rounded-[1.6rem] border border-white/10 bg-white/5 p-4">
          <p className="font-display text-md font-semibold text-white">
            Fund via On-ramp
          </p>
          <p className="mt-2 text-sm leading-6 text-white/[0.68]">
            Add money with supported fiat ramp providers or cash out when you
            are ready.
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              className="rounded-[1.35rem] border border-white/10 bg-gradient-to-br from-accent/30 to-accent-soft/12 p-4 text-left"
            >
              <p className="font-semibold text-white">Buy Crypto</p>
              <p className="mt-2 text-sm text-white/[0.65]">
                Launch provider selection when backend is ready.
              </p>
            </button>
            <button
              type="button"
              className="rounded-[1.35rem] border border-white/10 bg-gradient-to-br from-amber-400/20 to-pink-500/10 p-4 text-left"
            >
              <p className="font-semibold text-white">Cash Out</p>
              <p className="mt-2 text-sm text-white/[0.65]">
                Prepare off-ramp flow for withdrawals and bank payouts.
              </p>
            </button>
          </div>
        </div>
      </div>
    </BottomSheet>
  );
}
