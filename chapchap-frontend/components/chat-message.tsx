import { ChatItem } from "@/lib/types";

type ChatMessageProps = {
  message: ChatItem;
  onOpenConfirmation?: (paymentIntentId: number) => void;
};

export function ChatMessage({
  message,
  onOpenConfirmation,
}: ChatMessageProps) {
  const isUser = message.kind === "user_message";

  return (
    <div
      className={`animate-float-up flex ${
        isUser ? "justify-end" : "justify-start"
      }`}
    >
      <div className={`max-w-[92%] ${isUser ? "items-end" : "items-start"}`}>
        {"attachments" in message && message.attachments?.length ? (
          <div className="mb-3 grid grid-cols-2 gap-2">
            {message.attachments.map((attachment) => (
              <div
                key={attachment.id}
                className={`h-28 rounded-[1.35rem] border border-white/[0.08] bg-gradient-to-br ${attachment.gradient} p-3`}
              >
                <div className="flex h-full items-end rounded-[1rem] border border-white/10 bg-black/[0.15] p-2 text-xs text-white/[0.75]">
                  {attachment.alt}
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {"text" in message && message.text ? (
          <div
            className={`rounded-[1.5rem] px-2 py-1 sm:px-4 sm:py-3 text-[12px] leading-7 ${
              isUser
                ? "purple-ring bg-white/[0.08] text-white"
                : message.kind === "system_error"
                  ? "border border-rose-400/20 bg-rose-500/10 text-rose-100"
                  : message.kind === "assistant_followup"
                    ? "border border-accent-soft/25 bg-accent-soft/10 text-white"
                  : "glass-panel text-white/[0.78]"
            }`}
          >
            {message.text}
          </div>
        ) : null}

        {message.kind === "payment_confirmation_card" ? (
          <div className="glass-panel edge-glow mt-3 rounded-[1.6rem] border border-accent-soft/20 p-4">
            <p className="font-display text-lg font-semibold text-white">
              Review transaction
            </p>
            <p className="mt-2 text-sm leading-6 text-white/[0.68]">
              {message.summary.amount} {message.summary.token_symbol} to{" "}
              {message.summary.recipient_name ?? "recipient"} on{" "}
              {message.summary.network}.
            </p>
            <button
              type="button"
              onClick={() => onOpenConfirmation?.(message.paymentIntentId)}
              className="mt-4 rounded-full bg-white px-4 py-2 text-sm font-semibold text-black"
            >
              Open confirmation
            </button>
          </div>
        ) : null}

        {message.kind === "product_results" ? (
          <div className="mt-3 grid gap-3">
            {message.results.map((result, index) => (
              <div
                key={`${result.title}-${result.merchant_name}-${index}`}
                className="glass-panel edge-glow rounded-[1.4rem] border border-white/10 p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-display text-base font-semibold text-white">
                      {result.title}
                    </p>
                    <p className="mt-1 text-sm text-white/[0.58]">
                      {result.merchant_name}
                    </p>
                  </div>
                  <span className="rounded-full border border-accent-soft/30 bg-accent-soft/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-soft">
                    {result.tag}
                  </span>
                </div>
                <a
                  href={result.product_url || "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex rounded-full border border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-semibold text-white/[0.84]"
                >
                  View Product
                </a>
              </div>
            ))}
          </div>
        ) : null}

        {message.kind === "swap_preview_card" ? (
          <div className="glass-panel edge-glow mt-3 rounded-[1.6rem] border border-cyan-400/20 p-4">
            <p className="font-display text-lg font-semibold text-white">
              Review swap preview
            </p>
            <div className="mt-3 grid gap-2 text-sm text-white/[0.72]">
              <p>
                <span className="font-semibold text-white">Swap in:</span>{" "}
                {message.preview.amount_in} {message.preview.source_token}
              </p>
              <p>
                <span className="font-semibold text-white">Estimated out:</span>{" "}
                {message.preview.estimated_output} {message.preview.destination_token}
              </p>
              <p>
                <span className="font-semibold text-white">Network:</span>{" "}
                {message.preview.network}
              </p>
              <p>
                <span className="font-semibold text-white">Estimated fee:</span>{" "}
                {message.preview.estimated_fee_xtz} XTZ
              </p>
            </div>
            <p className="mt-3 text-xs leading-6 text-white/[0.55]">
              {message.preview.slippage_note}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
