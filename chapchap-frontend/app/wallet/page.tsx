"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { NavTabs } from "@/components/nav-tabs";
import { PrivateBalanceCard } from "@/components/private-balance-card";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAuth } from "@/components/providers/auth-provider";
import { useWallet } from "@/components/providers/wallet-provider";
import {
  fetchConfidentialSavings,
  requestSavingsWithdrawal,
} from "@/lib/api/confidential";
import { ApiError } from "@/lib/api/client";
import { getAddressExplorerUrl } from "@/lib/contracts/chapchap-confidential-core";
import { ConfidentialSavingsPosition } from "@/lib/types";

export default function WalletPage() {
  const router = useRouter();
  const { hydrated, isAuthenticated, logout, token, user } = useAuth();
  const {
    connectedAddress,
    walletBalanceEth,
    isWalletConnecting,
    privateBalanceStatus,
    privateBalanceEth,
    privateBalanceHandle,
    privateBalanceError,
    connectWallet,
    disconnectWallet,
    revealPrivateBalance,
  } = useWallet();
  const [savingsPositions, setSavingsPositions] = useState<ConfidentialSavingsPosition[]>([]);
  const [savingsError, setSavingsError] = useState<string | null>(null);
  const [withdrawStatus, setWithdrawStatus] = useState<string | null>(null);
  const [withdrawingId, setWithdrawingId] = useState<number | null>(null);

  useEffect(() => {
    if (!hydrated) return;
    if (!isAuthenticated) {
      router.replace("/");
    }
  }, [hydrated, isAuthenticated, router]);

  const loadSavings = useCallback(async () => {
    if (!token) return;
    try {
      setSavingsError(null);
      const savings = await fetchConfidentialSavings(token);
      setSavingsPositions(savings);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        logout();
        router.replace("/");
        return;
      }
      setSavingsError("I couldn't load your confidential savings right now.");
    }
  }, [logout, router, token]);

  useEffect(() => {
    if (!hydrated || !isAuthenticated || !token) return;
    void loadSavings();
  }, [hydrated, isAuthenticated, loadSavings, token]);

  const handleWithdraw = useCallback(
    async (savingsId: number) => {
      if (!token) return;
      setWithdrawingId(savingsId);
      setWithdrawStatus(null);
      try {
        const response = await requestSavingsWithdrawal(savingsId, undefined, token);
        setWithdrawStatus(response.message);
        setSavingsPositions((current) =>
          current.map((item) =>
            item.id === savingsId
              ? {
                  ...item,
                  status: response.status,
                  withdraw_tx_hash: response.withdraw_tx_hash,
                }
              : item,
          ),
        );
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          logout();
          router.replace("/");
          return;
        }
        if (error instanceof ApiError) {
          const detail =
            error.data && typeof error.data === "object"
              ? Reflect.get(error.data, "detail")
              : null;
          setWithdrawStatus(
            typeof detail === "string"
              ? detail
              : "Withdrawal contract wiring is still pending.",
          );
        } else {
          setWithdrawStatus("Withdrawal contract wiring is still pending.");
        }
      } finally {
        setWithdrawingId(null);
      }
    },
    [logout, router, token],
  );

  const receiveAddress = connectedAddress;
  const walletBalanceLabel = connectedAddress && walletBalanceEth ? `${walletBalanceEth} ETH` : "Connect MetaMask";
  const privateBalanceLabel =
    privateBalanceStatus === "revealed" && privateBalanceEth !== null
      ? `${privateBalanceEth} ETH`
      : privateBalanceStatus === "empty"
        ? "No private balance yet"
        : "Private balance available, decrypt to view";
  const connectedAddressLabel = useMemo(
    () =>
      connectedAddress
        ? `${connectedAddress.slice(0, 6)}...${connectedAddress.slice(-4)}`
        : "Not connected",
    [connectedAddress],
  );

  if (!hydrated || (isAuthenticated && !user)) {
    return (
      <main className="min-h-screen px-4 pb-28 pt-6 md:px-6 text-white">
        <div className="mx-auto max-w-4xl">
          <div className="glass-panel edge-glow rounded-[2rem] border border-white/10 p-6">
            Loading wallet tools...
          </div>
        </div>
      </main>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <>
      <main className="min-h-screen px-4 pb-28 pt-6 md:px-6">
        <div className="mx-auto max-w-4xl space-y-6">
          <section className="glass-panel edge-glow rounded-[2rem] border border-white/10 p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.28em] text-white/[0.38]">
                  Wallet tools
                </p>
                <h1 className="mt-3 font-display text-4xl font-bold text-white">
                  Wallet ETH and private balance
                </h1>
                <p className="mt-3 max-w-2xl text-base leading-8 text-white/60">
                  Manage your connected Sepolia wallet, receive ETH, reveal the ChapChap private balance that lives inside the confidential contract, and track when savings unlock.
                </p>
              </div>
              <ThemeToggle />
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <div className="glass-panel edge-glow rounded-[2rem] border border-white/10 p-6">
              <h2 className="font-display text-2xl font-semibold text-white">
                Connected wallet
              </h2>
              <div className="mt-5 space-y-3 text-sm text-white/[0.72]">
                <p>
                  <span className="font-semibold text-white">Address:</span>{" "}
                  {connectedAddressLabel}
                </p>
                <p>
                  <span className="font-semibold text-white">Wallet ETH:</span>{" "}
                  {walletBalanceLabel}
                </p>
                <p>
                  <span className="font-semibold text-white">ChapChap Private Balance:</span>{" "}
                  {privateBalanceLabel}
                </p>
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void connectWallet()}
                  disabled={isWalletConnecting}
                  className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isWalletConnecting ? "Connecting..." : connectedAddress ? "Reconnect Wallet" : "Connect Wallet"}
                </button>
                <button
                  type="button"
                  onClick={disconnectWallet}
                  disabled={!connectedAddress}
                  className="rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Disconnect Wallet
                </button>
              </div>

              <div className="mt-5 rounded-[1.5rem] border border-white/10 bg-white/5 p-4 text-sm text-white/[0.72]">
                Sensitive values are encrypted where supported by Zama/FHEVM. Wallet addresses and transaction existence may still be public.
              </div>
            </div>

            <PrivateBalanceCard
              connectedAddress={connectedAddress}
              privateBalanceStatus={privateBalanceStatus}
              privateBalanceEth={privateBalanceEth}
              privateBalanceHandle={privateBalanceHandle}
              privateBalanceError={privateBalanceError}
              onReveal={revealPrivateBalance}
            />
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <div className="glass-panel edge-glow rounded-[2rem] border border-white/10 p-6">
              <h2 className="font-display text-2xl font-semibold text-white">
                Receive on Sepolia
              </h2>
              <p className="mt-3 text-sm leading-7 text-white/[0.62]">
                Share this address to receive ETH for public transfers, contract deposits, and confidential savings funding.
              </p>
              <div className="mt-5 rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-white/40">
                  Address
                </p>
                <p className="mt-3 break-all text-sm leading-7 text-white/[0.82]">
                  {receiveAddress ?? "Connect MetaMask to reveal your receive address."}
                </p>
              </div>
              {receiveAddress ? (
                <a
                  href={getAddressExplorerUrl(receiveAddress)}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex text-sm text-accent-soft hover:text-white"
                >
                  View receive address on Sepolia Etherscan
                </a>
              ) : null}
            </div>

            <div className="glass-panel edge-glow rounded-[2rem] border border-white/10 p-6">
              <h2 className="font-display text-2xl font-semibold text-white">
                Transfer notes
              </h2>
              <div className="mt-5 grid gap-3">
                <div className="rounded-[1.5rem] border border-white/10 bg-gradient-to-br from-accent/25 to-accent-soft/10 p-4">
                  <p className="font-semibold text-white">Confidential transfer</p>
                  <p className="mt-1 text-sm text-white/[0.62]">
                    The recipient receives value inside the ChapChap private balance and can reveal it after connecting the same wallet here.
                  </p>
                </div>
                <div className="rounded-[1.5rem] border border-white/10 bg-gradient-to-br from-emerald-400/20 to-cyan-500/10 p-4">
                  <p className="font-semibold text-white">Public transfer</p>
                  <p className="mt-1 text-sm text-white/[0.62]">
                    The recipient receives normal Sepolia ETH directly in MetaMask through a standard wallet transaction.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="glass-panel edge-glow rounded-[2rem] border border-white/10 p-6">
            <h2 className="font-display text-2xl font-semibold text-white">
              Private savings positions
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-white/[0.68]">
              Your savings become withdrawable after the lock date. They do not automatically return unless an automated keeper is added later.
            </p>

            {savingsError ? (
              <div className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                {savingsError}
              </div>
            ) : null}

            {withdrawStatus ? (
              <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                {withdrawStatus}
              </div>
            ) : null}

            <div className="mt-5 grid gap-4">
              {savingsPositions.length ? (
                savingsPositions.map((position) => {
                  const canWithdraw = position.status === "withdrawable";
                  return (
                    <div
                      key={position.id}
                      className="rounded-[1.6rem] border border-white/10 bg-white/5 p-5"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-white">
                            {position.amount_display} {position.asset}
                          </p>
                          <p className="mt-1 text-sm text-white/[0.62]">
                            Lock rule: {position.lock_rule || "Flexible"}
                          </p>
                        </div>
                        <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-semibold text-white/[0.72]">
                          {formatSavingsStatus(position.status)}
                        </span>
                      </div>

                      <div className="mt-4 grid gap-2 text-sm text-white/[0.72] sm:grid-cols-2">
                        <p>
                          <span className="font-semibold text-white">Unlocks on:</span>{" "}
                          {position.unlock_at
                            ? new Date(position.unlock_at).toLocaleString()
                            : "No unlock time"}
                        </p>
                        <p>
                          <span className="font-semibold text-white">Deposit tx:</span>{" "}
                          {position.tx_hash ? shortenHash(position.tx_hash) : "Pending"}
                        </p>
                        {position.withdraw_tx_hash ? (
                          <p>
                            <span className="font-semibold text-white">Withdraw tx:</span>{" "}
                            {shortenHash(position.withdraw_tx_hash)}
                          </p>
                        ) : null}
                        <p>
                          <span className="font-semibold text-white">
                            Availability:
                          </span>{" "}
                          {canWithdraw
                            ? "Ready to withdraw"
                            : position.unlock_at
                              ? `Unlocks on ${new Date(position.unlock_at).toLocaleString()}`
                              : "Waiting for lock data"}
                        </p>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-3">
                        {canWithdraw ? (
                          <button
                            type="button"
                            onClick={() => void handleWithdraw(position.id)}
                            disabled={withdrawingId === position.id}
                            className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {withdrawingId === position.id ? "Checking withdrawal..." : "Withdraw"}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="rounded-[1.6rem] border border-dashed border-white/10 bg-white/[0.03] p-5 text-sm text-white/[0.62]">
                  No private savings positions yet. Start from the Assistant tab with a prompt like
                  {" "}
                  <span className="font-semibold text-white">
                    Save 0.01 ETH for 7 days
                  </span>
                  .
                </div>
              )}
            </div>
          </section>
        </div>
      </main>
      <NavTabs />
    </>
  );
}

function formatSavingsStatus(status: ConfidentialSavingsPosition["status"]) {
  switch (status) {
    case "active":
      return "Active";
    case "withdrawable":
      return "Withdrawable";
    case "withdrawn":
      return "Withdrawn";
    case "failed":
      return "Failed";
    default:
      return status;
  }
}

function shortenHash(hash: string) {
  if (hash.length <= 14) {
    return hash;
  }
  return `${hash.slice(0, 8)}...${hash.slice(-6)}`;
}
