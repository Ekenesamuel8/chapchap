"use client";

import { FormEvent, useState } from "react";
import { ChatItem, ConfidentialActionCard } from "@/lib/types";

type ChatMessageProps = {
  message: ChatItem;
  onPrepareAction?: (action: ConfidentialActionCard) => void;
  onSelectTransferMode?: (
    action: ConfidentialActionCard,
    transferMode: "confidential" | "public",
  ) => void;
  onSubmitProof?: (
    agreementId: number,
    proofText: string,
    proofLink?: string,
  ) => Promise<void> | void;
};

const privacyNote =
  "Sensitive values are encrypted where supported by Zama/FHEVM. Wallet addresses and transaction existence may still be public.";

export function ChatMessage({
  message,
  onPrepareAction,
  onSelectTransferMode,
  onSubmitProof,
}: ChatMessageProps) {
  const isUser = message.kind === "user_message";
  const [proofText, setProofText] = useState("");
  const [proofLink, setProofLink] = useState("");
  const [agreementIdInput, setAgreementIdInput] = useState(
    message.kind === "proof_submission_card" && message.agreementId
      ? String(message.agreementId)
      : "",
  );
  const [isSubmittingProof, setSubmittingProof] = useState(false);

  const handleProofSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (message.kind !== "proof_submission_card" || !proofText.trim()) return;
    const agreementId = Number(agreementIdInput);
    if (!Number.isFinite(agreementId) || agreementId <= 0) return;

    setSubmittingProof(true);
    try {
      await onSubmitProof?.(agreementId, proofText.trim(), proofLink.trim() || undefined);
      setProofText("");
      setProofLink("");
    } finally {
      setSubmittingProof(false);
    }
  };

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
            className={`rounded-[1.5rem] px-2 py-1 text-[12px] leading-7 sm:px-4 sm:py-3 ${
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

        {message.kind === "confidential_action_card" ? (
          <div className="glass-panel edge-glow mt-3 rounded-[1.6rem] border border-accent-soft/20 p-4">
            <p className="font-display text-lg font-semibold text-white">
              {getCardTitle(message.action.intent)}
            </p>
            <div className="mt-3 grid gap-2 text-sm text-white/[0.72]">
              {message.action.intent === "confidential_payment" ? (
                <>
                  <DetailRow label="Recipient" value={message.action.recipientName ?? "Not specified"} />
                  <DetailRow label="Recipient address" value={message.action.recipientAddress ?? "Required before continuing"} />
                  <DetailRow label="Amount" value={message.action.amount ?? "Not specified"} />
                  <DetailRow label="Asset" value={message.action.asset} />
                  <DetailRow
                    label="Transfer mode"
                    value={
                      message.action.transferMode === "confidential"
                        ? "Confidential"
                        : message.action.transferMode === "public"
                          ? "Public"
                          : "Choose private or public"
                    }
                  />
                  <DetailRow
                    label="Recipient outcome"
                    value={
                      message.action.transferMode === "public"
                        ? "Recipient will receive normal Sepolia ETH in their wallet."
                        : "Recipient will receive funds inside ChapChap private balance."
                    }
                  />
                </>
              ) : null}

              {message.action.intent === "public_payment" ? (
                <>
                  <DetailRow label="Recipient" value={message.action.recipientName ?? "Not specified"} />
                  <DetailRow label="Recipient address" value={message.action.recipientAddress ?? "Required before continuing"} />
                  <DetailRow label="Amount" value={message.action.amount ?? "Not specified"} />
                  <DetailRow label="Asset" value={message.action.asset} />
                  <DetailRow label="Transfer mode" value="Public" />
                  <DetailRow
                    label="Recipient outcome"
                    value="Recipient will receive normal Sepolia ETH in their wallet."
                  />
                </>
              ) : null}

              {message.action.intent === "confidential_savings" ? (
                <>
                  <DetailRow label="Amount" value={message.action.amount ?? "Not specified"} />
                  <DetailRow label="Asset" value={message.action.asset} />
                  <DetailRow label="Lock rule" value={message.action.lockRule ?? "Flexible"} />
                  <DetailRow
                    label="Unlocks on"
                    value={
                      message.action.unlockAt
                        ? new Date(message.action.unlockAt).toLocaleString()
                        : "Not specified yet"
                    }
                  />
                </>
              ) : null}

              {message.action.intent === "confidential_agreement" ? (
                <>
                  <DetailRow label="Recipient" value={message.action.recipientName ?? "Not specified"} />
                  <DetailRow label="Recipient address" value={message.action.recipientAddress ?? "Required before continuing"} />
                  <DetailRow label="Amount" value={message.action.amount ?? "Not specified yet"} />
                  <DetailRow label="Condition" value={message.action.condition ?? "Not specified"} />
                  <DetailRow label="Deadline" value={message.action.deadline ? new Date(message.action.deadline).toLocaleString() : "Not specified"} />
                  <DetailRow label="Proof required" value="Yes, proof may be submitted for AI-assisted review." />
                </>
              ) : null}
            </div>

            <p className="mt-3 text-xs leading-6 text-white/[0.55]">
              {privacyNote}
            </p>

            {message.action.missingFields.includes("transfer_mode") ? (
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => onSelectTransferMode?.(message.action, "confidential")}
                  className="rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-sm font-semibold text-white"
                >
                  Choose Confidential
                </button>
                <button
                  type="button"
                  onClick={() => onSelectTransferMode?.(message.action, "public")}
                  className="rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-sm font-semibold text-white"
                >
                  Choose Public
                </button>
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => onPrepareAction?.(message.action)}
              disabled={message.action.missingFields.includes("transfer_mode")}
              className="mt-4 rounded-full bg-white px-4 py-2 text-sm font-semibold text-black"
            >
              {message.action.intent === "confidential_agreement"
                ? "Create Agreement"
                : message.action.intent === "public_payment"
                  ? "Send Public ETH"
                : "Continue"}
            </button>
          </div>
        ) : null}

        {message.kind === "proof_submission_card" ? (
          <form
            onSubmit={handleProofSubmit}
            className="glass-panel edge-glow mt-3 rounded-[1.6rem] border border-cyan-400/20 p-4"
          >
            <p className="font-display text-lg font-semibold text-white">
              Submit proof
            </p>
            <p className="mt-2 text-sm leading-6 text-white/[0.68]">
              Add the evidence you want reviewed for your agreement. This verdict stays offchain for now.
            </p>
            <input
              value={agreementIdInput}
              onChange={(event) => setAgreementIdInput(event.target.value)}
              placeholder="Agreement record ID"
              className="mt-4 w-full rounded-[1.3rem] border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none placeholder:text-white/[0.28]"
            />
            <textarea
              value={proofText}
              onChange={(event) => setProofText(event.target.value)}
              placeholder="Explain what was delivered, missed, or disputed."
              className="mt-4 min-h-28 w-full rounded-[1.3rem] border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none placeholder:text-white/[0.28]"
            />
            <input
              value={proofLink}
              onChange={(event) => setProofLink(event.target.value)}
              placeholder="Optional proof link"
              className="mt-3 w-full rounded-[1.3rem] border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none placeholder:text-white/[0.28]"
            />
            <button
              type="submit"
              disabled={!proofText.trim() || !agreementIdInput.trim() || isSubmittingProof}
              className="mt-4 rounded-full bg-white px-4 py-2 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmittingProof ? "Reviewing..." : "Run AI verdict"}
            </button>
          </form>
        ) : null}

        {message.kind === "proof_result_card" ? (
          <div className="glass-panel edge-glow mt-3 rounded-[1.6rem] border border-emerald-400/20 p-4">
            <p className="font-display text-lg font-semibold text-white">
              AI-assisted verdict
            </p>
            <div className="mt-3 grid gap-2 text-sm text-white/[0.72]">
              <DetailRow label="Recommendation" value={message.recommendation} />
              <DetailRow label="Confidence" value={`${Math.round(message.confidence * 100)}%`} />
              <DetailRow label="Reasoning" value={message.reasoning} />
            </div>
            <p className="mt-3 text-xs leading-6 text-white/[0.55]">
              This is an AI-assisted recommendation only. Final settlement logic will be added in a later step.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <p>
      <span className="font-semibold text-white">{label}:</span> {value}
    </p>
  );
}

function getCardTitle(intent: ConfidentialActionCard["intent"]) {
  switch (intent) {
    case "confidential_payment":
      return "Confidential payment";
    case "public_payment":
      return "Public payment";
    case "confidential_savings":
      return "Confidential savings";
    case "confidential_agreement":
      return "Confidential agreement";
    case "proof_submission":
      return "Proof submission";
    default:
      return "Confidential action";
  }
}
