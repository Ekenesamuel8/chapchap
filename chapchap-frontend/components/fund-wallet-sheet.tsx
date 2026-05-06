"use client";

import { BottomSheet } from "@/components/bottom-sheet";
import { CopyIcon, WalletIcon } from "@/components/icons";

type FundWalletSheetProps = {
  open: boolean;
  onClose: () => void;
  receiveAddress: string | null;
  onCopyAddress: () => void;
};

export function FundWalletSheet({
  open,
  onClose,
  receiveAddress,
  onCopyAddress,
}: FundWalletSheetProps) {
  const receiveAddressShort = receiveAddress
    ? `${receiveAddress.slice(0, 6)}...${receiveAddress.slice(-4)}`
    : "placeholder";

  return (
    <BottomSheet open={open} onClose={onClose} title="Receive on Sepolia">
      <div className="grid gap-4">
        <div className="rounded-[1.6rem] border border-white/10 bg-white/5 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-display text-md font-semibold text-white">
                Receive ETH
              </p>
              <p className="mt-2 text-sm leading-6 text-white/[0.68]">
                Use this wallet address to fund your confidential flow on Sepolia before submitting actions from the Assistant tab.
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
              {receiveAddress ?? "Connect MetaMask to reveal your receive address."}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={onCopyAddress}
                disabled={!receiveAddress}
                className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-60"
              >
                <CopyIcon className="size-4" />
                Copy address
              </button>
              <p className="text-xs text-white/50">
                Sensitive values are encrypted where supported by Zama/FHEVM. Wallet addresses and incoming transfer existence may still be public.
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-[1.3rem] border border-white/[0.1] bg-white/[0.03] p-4">
              <p className="text-xs uppercase tracking-[0.22em] text-white/[0.4]">
                Network
              </p>
              <p className="mt-2 text-sm text-white">
                Sepolia / Zama FHEVM
              </p>
            </div>
            <div className="rounded-[1.3rem] border border-white/[0.1] bg-white/[0.03] p-4">
              <p className="text-xs uppercase tracking-[0.22em] text-white/[0.4]">
                Supported asset
              </p>
              <p className="mt-2 text-sm text-white">
                ETH
              </p>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-center rounded-[1.5rem] border border-dashed border-white/[0.15] bg-white/[0.03] p-6">
            <div className="grid size-32 place-items-center rounded-[1.25rem] border border-white/[0.12] bg-[radial-gradient(circle_at_top,_rgba(118,87,246,0.25),_transparent_70%)] text-center text-xs leading-5 text-white/[0.55]">
              QR code
              <span className="block">{receiveAddressShort}</span>
            </div>
          </div>
        </div>

        <div className="rounded-[1.6rem] border border-white/10 bg-white/5 p-4">
          <p className="font-display text-md font-semibold text-white">
            Wallet execution
          </p>
          <p className="mt-2 text-sm leading-6 text-white/[0.68]">
            Connect MetaMask from the Assistant tab to run live Sepolia savings deposits and agreement creation. This screen remains the receive and funding view.
          </p>
          <div className="mt-4 rounded-[1.35rem] border border-white/10 bg-gradient-to-br from-accent/20 to-accent-soft/10 p-4 text-left">
            <p className="font-semibold text-white">Manual testnet funding</p>
            <p className="mt-2 text-sm text-white/[0.65]">
              Fund your connected MetaMask wallet with Sepolia ETH, then return to the Assistant tab to run confidential actions and public transfers.
            </p>
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
