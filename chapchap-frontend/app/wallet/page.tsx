"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { NavTabs } from "@/components/nav-tabs";
import { useAuth } from "@/components/providers/auth-provider";
import { fetchFundOptions } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { FundOptionsResponse } from "@/lib/types";

export default function WalletPage() {
  const router = useRouter();
  const { hydrated, isAuthenticated, logout, token } = useAuth();
  const [fundOptions, setFundOptions] = useState<FundOptionsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hydrated) return;
    if (!isAuthenticated || !token) {
      router.replace("/");
      return;
    }

    fetchFundOptions(token)
      .then(setFundOptions)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          logout();
          router.replace("/");
          return;
        }
        setError("I couldn't load your funding options right now.");
      });
  }, [hydrated, isAuthenticated, logout, router, token]);

  const receive = fundOptions?.receive;

  return (
    <>
      <main className="min-h-screen px-4 pb-28 pt-6 md:px-6">
        <div className="mx-auto max-w-4xl space-y-6">
          <section className="glass-panel edge-glow rounded-[2rem] border border-white/10 p-6">
            <p className="text-sm uppercase tracking-[0.28em] text-white/[0.38]">
              Wallet tools
            </p>
            <h1 className="mt-3 font-display text-4xl font-bold text-white">
              Fund and receive
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-8 text-white/60">
              This route gives ChapChap a clear entry point for receiving crypto
              and adding fiat on-ramp options later.
            </p>
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <div className="glass-panel edge-glow rounded-[2rem] border border-white/10 p-6">
              <h2 className="font-display text-2xl font-semibold text-white">
                Receive Crypto
              </h2>
              <p className="mt-3 text-sm leading-7 text-white/[0.62]">
                Share this address to receive supported {receive?.network ?? "Etherlink"} assets.
              </p>
              <div className="mt-5 rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-white/40">
                  Address
                </p>
                <p className="mt-3 break-all text-sm leading-7 text-white/[0.82]">
                  {receive?.address ?? error ?? "Wallet address will appear here once loaded."}
                </p>
              </div>
              <div className="mt-5 rounded-[1.5rem] border border-white/10 bg-white/5 p-4 text-sm text-white/[0.72]">
                Supported assets: {receive?.supported_assets.map((asset) => asset.symbol).join(", ") || "XTZ, USDC"}
              </div>
              <div className="mt-5 grid size-40 place-items-center rounded-[1.6rem] border border-dashed border-white/[0.12] bg-white/[0.03] text-center text-sm text-white/[0.45]">
                QR code placeholder
              </div>
            </div>

            <div className="glass-panel edge-glow rounded-[2rem] border border-white/10 p-6">
              <h2 className="font-display text-2xl font-semibold text-white">
                Buy or Cash Out
              </h2>
              <p className="mt-3 text-sm leading-7 text-white/[0.62]">
                Hook your preferred on-ramp providers here when the backend integration is ready.
              </p>
              <div className="mt-5 grid gap-3">
                {fundOptions?.ramp_options.map((option) => (
                  <button
                    key={option.type}
                    type="button"
                    disabled={!option.enabled}
                    className={`rounded-[1.5rem] border border-white/10 p-4 text-left disabled:cursor-not-allowed disabled:opacity-70 ${
                      option.type === "onramp"
                        ? "bg-gradient-to-br from-accent/25 to-accent-soft/10"
                        : "bg-gradient-to-br from-amber-400/20 to-pink-500/10"
                    }`}
                  >
                    <p className="font-semibold text-white">{option.label}</p>
                    <p className="mt-1 text-sm text-white/[0.62]">
                      {option.enabled ? "Provider available." : "Provider integration coming soon."}
                    </p>
                  </button>
                )) ?? null}
              </div>
            </div>
          </section>
        </div>
      </main>
      <NavTabs />
    </>
  );
}
