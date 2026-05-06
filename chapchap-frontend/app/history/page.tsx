"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { NavTabs } from "@/components/nav-tabs";
import { TransactionList } from "@/components/transaction-list";
import { useAuth } from "@/components/providers/auth-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { fetchConfidentialHistory } from "@/lib/api/confidential";
import { ApiError } from "@/lib/api/client";
import { ConfidentialHistoryItem } from "@/lib/types";

export default function HistoryPage() {
  const router = useRouter();
  const { hydrated, isAuthenticated, logout, token } = useAuth();
  const [history, setHistory] = useState<ConfidentialHistoryItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hydrated) return;
    if (!isAuthenticated || !token) {
      router.replace("/");
      return;
    }

    fetchConfidentialHistory(token)
      .then(setHistory)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          logout();
          router.replace("/");
          return;
        }
        setError("I couldn't load your confidential history right now.");
      });
  }, [hydrated, isAuthenticated, logout, router, token]);

  return (
    <>
      <main className="min-h-screen px-4 pb-28 pt-6 md:px-6">
        <div className="mx-auto max-w-4xl">
          <div className="mb-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.28em] text-white/[0.38]">
                  Confidential history
                </p>
                <h1 className="mt-3 font-display text-4xl font-bold text-white">
                  Private action log
                </h1>
                <p className="mt-3 max-w-2xl text-base leading-8 text-white/60">
                  Review your confidential payments, public transfers, savings drafts, agreements, and proof reviews powered by Zama/FHEVM on Sepolia.
                </p>
              </div>
              <ThemeToggle />
            </div>
          </div>

          {error ? (
            <div className="mb-4 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
              {error}
            </div>
          ) : null}

          <TransactionList transactions={history} />
        </div>
      </main>
      <NavTabs />
    </>
  );
}
