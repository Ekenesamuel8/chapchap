"use client";

import { CopyIcon, WalletIcon } from "@/components/icons";

type WalletHeaderProps = {
  balance: string;
  address: string;
  savings: string;
  onCopy: () => void;
  onFundWallet: () => void;
};

export function WalletHeader({
  balance,
  address,
  savings,
  onCopy,
  onFundWallet,
}: WalletHeaderProps) {
  return (
    <section className="text-center">
      <div className="mx-auto mb-3 flex size-9 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-accent-soft">
        <WalletIcon />
      </div>
      <p className="font-display text-2xl font-bold tracking-tight text-white">
        {balance}
      </p>
      <div className="mt-3 flex items-center justify-center gap-3 text-xs text-white/[0.55]">
        <button
          className="inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1.5 hover:bg-white/10"
          onClick={onCopy}
          type="button"
        >
          <span>{address}</span>
          <CopyIcon className="size-3.5" />
        </button>
        <span>{savings}</span>
      </div>
      <div className="mt-3 flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={onFundWallet}
          className="rounded-full border border-white/10 bg-white/5 px-1.5 py-1 text-xs sm:text-sm sm:px-5 sm:py-3 text-white"
        >
          Fund Wallet
        </button>
        <div className="rounded-full border border-white/10 bg-white/5 px-2 py-1 sm:px-4 sm:py-3 text-xs sm:text-sm text-white/[0.7]">
          Etherlink / Tezos EVM
        </div>
      </div>
    </section>
  );
}
