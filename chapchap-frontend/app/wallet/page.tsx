import { NavTabs } from "@/components/nav-tabs";
import { mockUser } from "@/lib/mock-data";

export default function WalletPage() {
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
                Share this address to receive Tezos USDC or supported Etherlink
                assets.
              </p>
              <div className="mt-5 rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-white/40">
                  Address
                </p>
                <p className="mt-3 break-all text-sm leading-7 text-white/[0.82]">
                  {mockUser.fullAddress}
                </p>
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
                Hook your preferred on-ramp providers here when the backend
                integration is ready.
              </p>
              <div className="mt-5 grid gap-3">
                <button
                  type="button"
                  className="rounded-[1.5rem] border border-white/10 bg-gradient-to-br from-accent/25 to-accent-soft/10 p-4 text-left"
                >
                  <p className="font-semibold text-white">Buy Crypto</p>
                  <p className="mt-1 text-sm text-white/[0.62]">
                    Open supported fiat providers.
                  </p>
                </button>
                <button
                  type="button"
                  className="rounded-[1.5rem] border border-white/10 bg-gradient-to-br from-amber-400/20 to-pink-500/10 p-4 text-left"
                >
                  <p className="font-semibold text-white">Cash Out</p>
                  <p className="mt-1 text-sm text-white/[0.62]">
                    Withdraw crypto balances to local rails later.
                  </p>
                </button>
              </div>
            </div>
          </section>
        </div>
      </main>
      <NavTabs />
    </>
  );
}
