"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChatComposer } from "@/components/chat-composer";
import { ChatMessage } from "@/components/chat-message";
import { FundWalletSheet } from "@/components/fund-wallet-sheet";
import { NavTabs } from "@/components/nav-tabs";
import { PromptSuggestions } from "@/components/prompt-suggestions";
import { TransactionConfirmationSheet } from "@/components/transaction-confirmation-sheet";
import { TransactionSuccessCard } from "@/components/transaction-success-card";
import { TransactionList } from "@/components/transaction-list";
import { WalletHeader } from "@/components/wallet-header";
import { useAuth } from "@/components/providers/auth-provider";
import { chatWithAgent, submitPaymentIntent } from "@/lib/api/agent";
import { fetchDashboard, fetchFundOptions } from "@/lib/api/auth";
import { ApiError, API_BASE_URL } from "@/lib/api/client";
import { recentTransactions } from "@/lib/mock-data";
import {
  Attachment,
  AgentChatResponse,
  ChatItem,
  DashboardResponse,
  FundOptionsResponse,
  PaymentConfirmationSummary,
  PaymentIntentView,
  PromptSuggestion,
  SubmittedTransactionView,
} from "@/lib/types";

const initialAssistantMessage: ChatItem = {
  id: "assistant-intro",
  kind: "assistant_message",
  text: "I can help you prepare payments and wallet actions. Tell me what you want to do, and I'll turn it into a reviewable request.",
};

export function DashboardScreen() {
  const router = useRouter();
  const { hydrated, isAuthenticated, token, logout } = useAuth();
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [isDashboardLoading, setDashboardLoading] = useState(true);
  const [fundOptions, setFundOptions] = useState<FundOptionsResponse | null>(null);
  const [composerValue, setComposerValue] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [chatItems, setChatItems] = useState<ChatItem[]>([initialAssistantMessage]);
  const [isChatLoading, setChatLoading] = useState(false);
  const [isFundWalletOpen, setFundWalletOpen] = useState(false);
  const [isConfirmOpen, setConfirmOpen] = useState(false);
  const [confirmationSummary, setConfirmationSummary] =
    useState<PaymentConfirmationSummary | null>(null);
  const [confirmationPaymentIntentId, setConfirmationPaymentIntentId] =
    useState<number | null>(null);
  const [isSubmittingPayment, setSubmittingPayment] = useState(false);
  const [confirmationError, setConfirmationError] = useState<string | null>(null);
  const [submittedTransaction, setSubmittedTransaction] =
    useState<SubmittedTransactionView | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!hydrated) return;
    if (!isAuthenticated || !token) {
      router.replace("/");
      return;
    }

    setDashboardLoading(true);
    setDashboardError(null);

    Promise.allSettled([fetchDashboard(token), fetchFundOptions(token)])
      .then((results) => {
        const [dashboardResult, fundOptionsResult] = results;

        if (dashboardResult.status === "fulfilled") {
          setDashboard(dashboardResult.value);
        } else {
          throw dashboardResult.reason;
        }

        if (fundOptionsResult.status === "fulfilled") {
          setFundOptions(fundOptionsResult.value);
        }
      })
      .catch((error) => {
        if (error instanceof ApiError && error.status === 401) {
          logout();
          router.replace("/");
          return;
        }

        setDashboardError(
          "I couldn't load your wallet right now. Please refresh or try again shortly.",
        );
      })
      .finally(() => {
        setDashboardLoading(false);
      });
  }, [hydrated, isAuthenticated, logout, router, token]);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development" || !dashboard) return;
    console.log("ChapChap /api/me/dashboard response", dashboard);
  }, [dashboard]);

  const promptSuggestions = useMemo<PromptSuggestion[]>(
    () =>
      (dashboard?.prompt_suggestions ?? []).map((label, index) => ({
        id: `${index}-${label}`,
        label,
      })),
    [dashboard],
  );

  const nativeBalance = useMemo(
    () => dashboard?.balances.find((item) => item.asset_symbol === "XTZ") ?? null,
    [dashboard],
  );

  const balanceLabel = useMemo(() => {
    const usdBalance = nativeBalance?.balance_usd;
    const hasUsdValue = usdBalance && Number(usdBalance) > 0;

    if (hasUsdValue) {
      return `$${usdBalance}`;
    }

    if (nativeBalance && Number(nativeBalance.balance) > 0) {
      return `${nativeBalance.balance} ${nativeBalance.asset_symbol}`;
    }

    const firstFundedAsset = dashboard?.balances.find(
      (item) => Number(item.balance) > 0,
    );
    if (firstFundedAsset) {
      return `${firstFundedAsset.balance} ${firstFundedAsset.asset_symbol}`;
    }

    return "$0.00";
  }, [dashboard, nativeBalance]);

  const savingsLabel = useMemo(() => {
    if (nativeBalance && Number(nativeBalance.balance) > 0) {
      return `Wallet funded: ${nativeBalance.balance} ${nativeBalance.asset_symbol}`;
    }

    const assetsTracked = dashboard?.balances.length ?? 0;
    return `${assetsTracked} assets tracked`;
  }, [dashboard, nativeBalance]);

  const visibleBalances = useMemo(
    () =>
      (dashboard?.balances ?? []).filter(
        (item) => Number(item.balance) > 0 || item.asset_symbol === "XTZ",
      ),
    [dashboard],
  );

  const walletView = dashboard?.wallet;
  const networkLabel = fundOptions?.receive.network
    ? `${fundOptions.receive.network} / Chain ${fundOptions.receive.chain_id}`
    : "Etherlink / Tezos EVM";

  const paymentIntentView = useMemo<PaymentIntentView | null>(() => {
    if (!confirmationSummary) return null;

    return {
      amount: confirmationSummary.amount,
      asset: confirmationSummary.token_symbol,
      recipient: confirmationSummary.recipient_name ?? "Unknown recipient",
      recipientAddress:
        confirmationSummary.recipient_address ?? "Not provided yet",
      network: confirmationSummary.network,
      estimatedGas: `${confirmationSummary.estimated_gas_xtz} XTZ`,
      note: confirmationSummary.note ?? "No note",
      schedule:
        confirmationSummary.schedule_in_minutes === null
          ? "Immediate"
          : `In ${confirmationSummary.schedule_in_minutes} mins`,
    };
  }, [confirmationSummary]);

  const handleSuggestionSelect = (label: string) => {
    setComposerValue(label);
  };

  const appendChatItem = (item: ChatItem) => {
    setChatItems((current) => [...current, item]);
  };

  const appendChatResponse = appendChatResponseFactory(
    appendChatItem,
    setConfirmationSummary,
    setConfirmationPaymentIntentId,
    setConfirmOpen,
  );

  const handleSend = async () => {
    const prompt = composerValue.trim();
    if (!prompt || !token) return;

    appendChatItem({
      id: crypto.randomUUID(),
      kind: "user_message",
      text: prompt,
      attachments: attachments.length ? attachments : undefined,
    });

    setComposerValue("");
    setAttachments([]);
    setStatusMessage(null);
    setConfirmationError(null);
    setChatLoading(true);

    try {
      const response = await chatWithAgent(prompt, token);
      appendChatResponse(response);
    } catch (error) {
      const message = mapChatError(error);
      appendChatItem({
        id: crypto.randomUUID(),
        kind: "system_error",
        text: message,
      });
    } finally {
      setChatLoading(false);
    }
  };

  const handleConfirmTransaction = async () => {
    if (!confirmationPaymentIntentId || !token || !paymentIntentView) return;

    setSubmittingPayment(true);
    setConfirmationError(null);
    setStatusMessage(null);

    try {
      const response = await submitPaymentIntent(confirmationPaymentIntentId, token);
      setConfirmOpen(false);
      setSubmittedTransaction({
        amount: paymentIntentView.amount,
        asset: paymentIntentView.asset,
        recipient: paymentIntentView.recipient,
        network: paymentIntentView.network,
        txHash: response.tx_hash ?? "",
        explorerUrl: response.explorer_url,
        submittedAt: new Date().toLocaleString(),
      });
      appendChatItem({
        id: crypto.randomUUID(),
        kind: "assistant_message",
        text: "Your blockchain transfer was submitted successfully.",
      });
      setStatusMessage("Transaction submitted onchain.");
    } catch (error) {
      const message = mapPaymentSubmissionError(error);
      setConfirmationError(message);
      setStatusMessage(message);
    } finally {
      setSubmittingPayment(false);
    }
  };

  if (!hydrated || isDashboardLoading) {
    return (
      <div className="min-h-screen px-4 py-8 text-white">
        <div className="glass-panel edge-glow mx-auto max-w-4xl rounded-[2rem] border border-white/10 p-6">
          Loading your ChapChap wallet...
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  if (dashboardError || !dashboard || !walletView) {
    return (
      <>
        <div className="min-h-screen px-4 py-8 text-white">
          <div className="glass-panel edge-glow mx-auto max-w-4xl rounded-[2rem] border border-white/10 p-6">
            <p className="font-display text-2xl font-semibold">Backend connection issue</p>
            <p className="mt-3 text-sm text-white/[0.68]">
              {dashboardError ??
                "I couldn't load your dashboard. Please sign in again."}
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => router.refresh()}
                className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black"
              >
                Retry
              </button>
              <button
                type="button"
                onClick={() => {
                  logout();
                  router.replace("/");
                }}
                className="rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-semibold text-white"
              >
                Sign in again
              </button>
            </div>
          </div>
        </div>
        <NavTabs />
      </>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-background px-4 pb-28 pt-6 text-foreground md:px-6">
        <div className="mx-auto grid max-w-6xl gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <main className="glass-panel edge-glow overflow-hidden rounded-[2.2rem] border border-white/10">
            <div className="relative overflow-hidden px-5 pb-6 pt-7 sm:px-8 sm:pt-8">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-[radial-gradient(circle_at_top,_rgba(118,87,246,0.22),_transparent_70%)]" />
              <div className="mb-4 flex items-center justify-between gap-4">
                <div className="text-xs uppercase tracking-[0.28em] text-white/[0.35]">
                  Connected to {API_BASE_URL}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    logout();
                    router.replace("/");
                  }}
                  className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs font-semibold text-white"
                >
                  Logout
                </button>
              </div>

              <WalletHeader
                balance={balanceLabel}
                address={walletView.address_short}
                savings={savingsLabel}
                networkLabel={networkLabel}
                onCopy={() => navigator.clipboard.writeText(walletView.address)}
                onFundWallet={() => setFundWalletOpen(true)}
              />

              {visibleBalances.length ? (
                <div className="mt-6 flex flex-wrap justify-center gap-3">
                  {visibleBalances.map((item) => (
                    <div
                      key={`${item.asset_symbol}-${item.asset_address ?? "native"}`}
                      className="rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm text-white/[0.82]"
                    >
                      <span className="font-semibold">{item.asset_symbol}</span>:{" "}
                      {item.balance}
                    </div>
                  ))}
                </div>
              ) : null}

              <section className="mt-12">
                <h1 className="text-lg font-semibold tracking-tight text-white sm:text-[2.7rem]">
                  Hi {dashboard.user.full_name || "there"}
                </h1>
                <p className="mt-1 max-w-lg text-lg font-semibold leading-tight tracking-tight text-white/[0.74] sm:text-[2.7rem]">
                  Start your transactions..
                </p>
                <p className="mt-3 text-sm text-white/[0.52]">
                  Prompt our AI to make any transaction.
                </p>
              </section>

              <section className="mt-10">
                <PromptSuggestions
                  prompts={promptSuggestions}
                  onSelect={handleSuggestionSelect}
                />
              </section>

              <section className="mt-6 space-y-4">
                {chatItems.map((message) => (
                  <ChatMessage
                    key={message.id}
                    message={message}
                    onOpenConfirmation={(paymentIntentId) => {
                      if (paymentIntentId === confirmationPaymentIntentId) {
                        setConfirmOpen(true);
                      }
                    }}
                  />
                ))}

                {isChatLoading ? (
                  <div className="glass-panel inline-flex items-center gap-2 rounded-full px-4 py-3 text-white/[0.65]">
                    <span className="typing-dot size-1 rounded-full bg-white/[0.65]" />
                    <span className="typing-dot size-1 rounded-full bg-white/[0.65]" />
                    <span className="typing-dot size-1 rounded-full bg-white/[0.65]" />
                    <span className="ml-2 text-xs">ChapChap is preparing your request</span>
                  </div>
                ) : null}

                {statusMessage ? (
                  <p className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                    {statusMessage}
                  </p>
                ) : null}
              </section>
            </div>

            <div className="px-4 pb-4 sm:px-6">
              <ChatComposer
                value={composerValue}
                onChange={setComposerValue}
                onSend={handleSend}
                onAttachmentAdd={setAttachments}
                attachments={attachments}
              />
            </div>
          </main>

          <aside className="hidden xl:block">
            <div className="sticky top-6 space-y-6">
              <TransactionList transactions={recentTransactions} />
              <div className="glass-panel edge-glow rounded-[1.8rem] border border-white/10 p-5">
                <p className="font-display text-xl font-semibold text-white">
                  Live wallet data
                </p>
                <p className="mt-3 text-sm leading-7 text-white/[0.62]">
                  Your address, balances, prompt suggestions, and payment drafts
                  now come from the Django backend. Confirmation stays explicit
                  before any onchain transfer is submitted.
                </p>
              </div>
            </div>
          </aside>
        </div>
      </div>

      <FundWalletSheet
        open={isFundWalletOpen}
        onClose={() => setFundWalletOpen(false)}
        fundOptions={fundOptions}
        onCopyAddress={() => navigator.clipboard.writeText(walletView.address)}
      />

      {paymentIntentView ? (
        <TransactionConfirmationSheet
          open={isConfirmOpen}
          onClose={() => {
            setConfirmOpen(false);
            setConfirmationError(null);
          }}
          onConfirm={handleConfirmTransaction}
          paymentIntent={paymentIntentView}
          isSubmitting={isSubmittingPayment}
          errorMessage={confirmationError}
        />
      ) : null}

      {submittedTransaction ? (
        <TransactionSuccessCard
          open={Boolean(submittedTransaction)}
          transaction={submittedTransaction}
          onDone={() => setSubmittedTransaction(null)}
        />
      ) : null}

      <NavTabs />
    </>
  );
}

function appendChatResponseFactory(
  appendChatItem: (item: ChatItem) => void,
  setConfirmationSummary: (summary: PaymentConfirmationSummary | null) => void,
  setConfirmationPaymentIntentId: (paymentIntentId: number | null) => void,
  setConfirmOpen: (open: boolean) => void,
) {
  return (response: AgentChatResponse) => {
    if (response.type === "assistant_message") {
      appendChatItem({
        id: crypto.randomUUID(),
        kind: "assistant_message",
        text: response.message,
      });
      return;
    }

    if (response.type === "assistant_followup") {
      appendChatItem({
        id: crypto.randomUUID(),
        kind: "assistant_followup",
        text: response.message,
      });
      return;
    }

    if (response.type === "system_error") {
      appendChatItem({
        id: crypto.randomUUID(),
        kind: "system_error",
        text: response.message,
      });
      return;
    }

    if (response.type === "product_results") {
      appendChatItem({
        id: crypto.randomUUID(),
        kind: "assistant_message",
        text: response.message,
      });
      appendChatItem({
        id: crypto.randomUUID(),
        kind: "product_results",
        results: response.results,
      });
      return;
    }

    setConfirmationSummary(response.payment.summary);
    setConfirmationPaymentIntentId(response.payment.payment_intent_id);
    setConfirmOpen(true);

    appendChatItem({
      id: crypto.randomUUID(),
      kind: "assistant_message",
      text: response.message,
    });
    appendChatItem({
      id: crypto.randomUUID(),
      kind: "payment_confirmation_card",
      paymentIntentId: response.payment.payment_intent_id,
      summary: response.payment.summary,
    });
  };
}

function mapChatError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 401) return "Please sign in again.";
    if (
      error.data &&
      typeof error.data === "object" &&
      Reflect.get(error.data, "type") === "system_error"
    ) {
      const message = Reflect.get(error.data, "message");
      if (typeof message === "string" && message.trim()) return message;
    }
    if (error.status === 400 || error.status === 422) {
      return "I couldn't prepare that request just yet. Please add a bit more detail and try again.";
    }
    if (error.status >= 500) {
      return "ChapChap hit a backend issue while preparing that request. Please try again shortly.";
    }
    return error.message;
  }

  return "Something went wrong while preparing that request.";
}

function mapPaymentSubmissionError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 401) return "Please sign in again.";
    if (error.status === 400 || error.status === 422) return error.message;
    if (error.status >= 500) {
      return "The blockchain transfer could not be submitted right now. Please try again shortly.";
    }
    return error.message;
  }

  return "The blockchain transfer could not be submitted right now.";
}
