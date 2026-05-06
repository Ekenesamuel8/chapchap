"use client";

type PrivateBalanceCardProps = {
  connectedAddress: string | null;
  privateBalanceStatus:
    | "idle"
    | "loading"
    | "available"
    | "empty"
    | "decrypting"
    | "revealed"
    | "error";
  privateBalanceEth: string | null;
  privateBalanceHandle: string | null;
  privateBalanceError: string | null;
  isDisabled?: boolean;
  onReveal: () => Promise<void> | void;
};

export function PrivateBalanceCard({
  connectedAddress,
  privateBalanceStatus,
  privateBalanceEth,
  privateBalanceHandle,
  privateBalanceError,
  isDisabled = false,
  onReveal,
}: PrivateBalanceCardProps) {
  const statusLabel = getStatusLabel(privateBalanceStatus, privateBalanceEth);

  return (
    <section className="glass-panel edge-glow rounded-[1.8rem] border border-white/10 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-white/[0.38]">
            ChapChap Private Balance
          </p>
          <h2 className="mt-2 font-display text-2xl font-semibold text-white">
            Private wallet state
          </h2>
        </div>
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/[0.62]">
          {privateBalanceStatus === "revealed" ? "Revealed" : "Encrypted"}
        </span>
      </div>

      <div className="mt-5 space-y-3 text-sm text-white/[0.72]">
        <p>
          <span className="font-semibold text-white">Connected wallet:</span>{" "}
          {connectedAddress ? shortenAddress(connectedAddress) : "Not connected"}
        </p>
        <p>
          <span className="font-semibold text-white">Encrypted balance status:</span>{" "}
          {statusLabel}
        </p>
        <p>
          <span className="font-semibold text-white">Decrypted balance:</span>{" "}
          {privateBalanceStatus === "revealed" && privateBalanceEth !== null
            ? `${privateBalanceEth} ETH`
            : privateBalanceStatus === "empty"
              ? "No private balance yet"
              : "Private balance available, decrypt to view"}
        </p>
        {privateBalanceHandle ? (
          <p className="break-all text-xs text-white/[0.48]">
            Handle: {privateBalanceHandle}
          </p>
        ) : null}
      </div>

      <p className="mt-4 text-xs leading-6 text-white/[0.55]">
        Only the connected wallet owner can decrypt this ChapChap balance.
      </p>

      {privateBalanceError ? (
        <p className="mt-3 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {privateBalanceError}
        </p>
      ) : null}

      <button
        type="button"
        disabled={!connectedAddress || isDisabled || privateBalanceStatus === "decrypting"}
        onClick={() => void onReveal()}
        className="mt-4 rounded-full bg-white px-4 py-2 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-60"
      >
        {privateBalanceStatus === "decrypting"
          ? "Decrypting..."
          : "Reveal Private Balance"}
      </button>
    </section>
  );
}

function getStatusLabel(status: PrivateBalanceCardProps["privateBalanceStatus"], value: string | null) {
  switch (status) {
    case "idle":
      return "Connect MetaMask on Sepolia to load your ChapChap balance.";
    case "loading":
      return "Checking your encrypted ChapChap balance...";
    case "available":
      return "Private balance available, decrypt to view.";
    case "empty":
      return "No private ChapChap balance detected yet.";
    case "decrypting":
      return "Decrypting with the connected wallet...";
    case "revealed":
      return value !== null ? `${value} ETH` : "Private balance decrypted.";
    case "error":
      return "Encrypted balance exists, but the current view could not be refreshed.";
    default:
      return "Private balance available, decrypt to view.";
  }
}

function shortenAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
