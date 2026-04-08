"use client";

import { BottomSheet } from "@/components/bottom-sheet";
import { CopyIcon, WalletIcon } from "@/components/icons";
import { FundOptionsResponse } from "@/lib/types";

type FundWalletSheetProps = {
  open: boolean;
  onClose: () => void;
  fundOptions: FundOptionsResponse | null;
  onCopyAddress: () => void;
};

export function FundWalletSheet({
  open,
  onClose,
  fundOptions,
  onCopyAddress,
}: FundWalletSheetProps) {
  const receive = fundOptions?.receive;
  const rampOptions = fundOptions?.ramp_options ?? [];

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
                Use this address to receive supported assets on {receive?.network ?? "Etherlink"}.
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
              {receive?.address ?? "Wallet address unavailable"}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={onCopyAddress}
                disabled={!receive?.address}
                className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-60"
              >
                <CopyIcon className="size-4" />
                Copy address
              </button>
              <p className="text-xs text-white/50">
                {receive?.note ?? "Only send supported assets on Etherlink."}
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-[1.3rem] border border-white/[0.1] bg-white/[0.03] p-4">
              <p className="text-xs uppercase tracking-[0.22em] text-white/[0.4]">
                Network
              </p>
              <p className="mt-2 text-sm text-white">
                {receive?.network ?? "Etherlink"} / Chain ID {receive?.chain_id ?? "-"}
              </p>
            </div>
            <div className="rounded-[1.3rem] border border-white/[0.1] bg-white/[0.03] p-4">
              <p className="text-xs uppercase tracking-[0.22em] text-white/[0.4]">
                Supported assets
              </p>
              <p className="mt-2 text-sm text-white">
                {receive?.supported_assets.map((asset) => asset.symbol).join(", ") || "XTZ, USDC"}
              </p>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-center rounded-[1.5rem] border border-dashed border-white/[0.15] bg-white/[0.03] p-6">
            <div className="grid size-32 place-items-center rounded-[1.25rem] border border-white/[0.12] bg-[radial-gradient(circle_at_top,_rgba(118,87,246,0.25),_transparent_70%)] text-center text-xs leading-5 text-white/[0.55]">
              QR code
              <span className="block">{receive?.address_short ?? "placeholder"}</span>
            </div>
          </div>
        </div>

        <div className="rounded-[1.6rem] border border-white/10 bg-white/5 p-4">
          <p className="font-display text-md font-semibold text-white">
            Fund via On-ramp
          </p>
          <p className="mt-2 text-sm leading-6 text-white/[0.68]">
            Add money with supported fiat ramp providers or cash out when you are ready.
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {rampOptions.map((option) => (
              <button
                key={option.type}
                type="button"
                disabled={!option.enabled}
                className={`rounded-[1.35rem] border border-white/10 p-4 text-left ${
                  option.type === "onramp"
                    ? "bg-gradient-to-br from-accent/30 to-accent-soft/12"
                    : "bg-gradient-to-br from-amber-400/20 to-pink-500/10"
                } disabled:cursor-not-allowed disabled:opacity-70`}
              >
                <p className="font-semibold text-white">{option.label}</p>
                <p className="mt-2 text-sm text-white/[0.65]">
                  {option.enabled
                    ? "Provider is available."
                    : "Provider routing is not enabled yet."}
                </p>
              </button>
            ))}
          </div>
        </div>

        <div className="sticky bottom-0 -mx-1 rounded-[1.4rem] border border-white/10 bg-black/30 p-1 backdrop-blur-sm">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white/[0.84]"
          >
            Close
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
