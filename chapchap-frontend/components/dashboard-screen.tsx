"use client";

import { useMemo, useState } from "react";
import { ChatComposer } from "@/components/chat-composer";
import { ChatMessage } from "@/components/chat-message";
import { FundWalletSheet } from "@/components/fund-wallet-sheet";
import { NavTabs } from "@/components/nav-tabs";
import { PromptSuggestions } from "@/components/prompt-suggestions";
import { TransactionConfirmationSheet } from "@/components/transaction-confirmation-sheet";
import { TransactionList } from "@/components/transaction-list";
import { TransactionSuccessCard } from "@/components/transaction-success-card";
import { WalletHeader } from "@/components/wallet-header";
import {
  investmentMessages,
  mockUser,
  paymentIntent,
  paymentMessages,
  productMessages,
  promptSuggestions,
  recentTransactions,
  sampleAttachments,
  welcomeMessages,
} from "@/lib/mock-data";
import { Attachment, ChatMessageType, ConversationScenario } from "@/lib/types";

const greeting = {
  title: "Hi Dear",
  subtitle: "Start your transactions..",
  blurb: "Prompt our AI to make any transaction.",
};

export function DashboardScreen() {
  const [scenario, setScenario] = useState<ConversationScenario>("welcome");
  const [composerValue, setComposerValue] = useState("");
  const [isFundWalletOpen, setFundWalletOpen] = useState(false);
  const [isConfirmOpen, setConfirmOpen] = useState(false);
  const [isSuccessOpen, setSuccessOpen] = useState(false);
  const [isLoading, setLoading] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  const messages = useMemo<ChatMessageType[]>(() => {
    if (scenario === "investment") return investmentMessages;
    if (scenario === "product") return productMessages;
    if (scenario === "payment") return paymentMessages;
    return welcomeMessages;
  }, [scenario]);

  const handleScenarioChange = (nextScenario: ConversationScenario) => {
    setScenario(nextScenario);
    setComposerValue(
      nextScenario === "payment"
        ? "Send $29 to Ada in next 50 mins"
        : nextScenario === "investment"
          ? "Analyze my portfolio and suggest investment"
          : nextScenario === "product"
            ? "Where do I get these for cheap compare the prices for me"
            : ""
    );
    setAttachments(nextScenario === "product" ? sampleAttachments : []);
  };

  const handleSend = () => {
    const value = composerValue.trim().toLowerCase();
    if (!value && attachments.length === 0) return;

    setLoading(true);

    window.setTimeout(() => {
      if (
        attachments.length > 0 ||
        value.includes("cheap") ||
        value.includes("compare")
      ) {
        setScenario("product");
      } else if (
        value.includes("send") ||
        value.includes("$29") ||
        value.includes("ada")
      ) {
        setScenario("payment");
        setConfirmOpen(true);
      } else if (value.includes("invest") || value.includes("portfolio")) {
        setScenario("investment");
      } else {
        setScenario("welcome");
      }

      setLoading(false);
    }, 700);
  };

  const handleConfirmTransaction = () => {
    setConfirmOpen(false);
    setSuccessOpen(true);
  };

  return (
    <>
      <div className="min-h-screen bg-background px-4 pb-28 pt-6 text-foreground md:px-6">
        <div className="mx-auto grid max-w-6xl gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <main className="glass-panel edge-glow overflow-hidden rounded-[2.2rem] border border-white/10">
            <div className="relative overflow-hidden px-5 pb-6 pt-7 sm:px-8 sm:pt-8">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-[radial-gradient(circle_at_top,_rgba(118,87,246,0.22),_transparent_70%)]" />
              <WalletHeader
                balance={mockUser.balance}
                address={mockUser.address}
                savings={mockUser.savings}
                onCopy={() => navigator.clipboard.writeText(mockUser.fullAddress)}
                onFundWallet={() => setFundWalletOpen(true)}
              />

              <section className="mt-12">
                <h1 className="text-lg font-semibold tracking-tight text-white sm:text-[2.7rem]">
                  {greeting.title}
                </h1>
                <p className="mt-1 max-w-lg text-lg font-semibold leading-tight tracking-tight text-white/[0.74] sm:text-[2.7rem]">
                  {greeting.subtitle}
                </p>
                <p className="mt-3 text-sm text-white/[0.52]">{greeting.blurb}</p>
              </section>

              <section className="mt-10">
                <PromptSuggestions
                  prompts={promptSuggestions}
                  onSelect={handleScenarioChange}
                />
              </section>

              <section className="mt-6 space-y-4">
                {messages.map((message) => (
                  <ChatMessage key={message.id} message={message} />
                ))}

                {isLoading ? (
                  <div className="glass-panel inline-flex items-center gap-2 rounded-full px-4 py-3 text-white/[0.65]">
                    <span className="typing-dot size-1 rounded-full bg-white/[0.65]" />
                    <span className="typing-dot size-1 rounded-full bg-white/[0.65]" />
                    <span className="typing-dot size-1 rounded-full bg-white/[0.65]" />
                    <span className="ml-2 text-xs">ChapChap is thinking</span>
                  </div>
                ) : null}
              </section>
            </div>

            <div className="px-4 pb-4 sm:px-6">
              <ChatComposer
                value={composerValue}
                onChange={setComposerValue}
                onSend={handleSend}
                // onScenarioQuickAction={handleScenarioChange}
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
                  Safety first
                </p>
                <p className="mt-3 text-sm leading-7 text-white/[0.62]">
                  Every payment request in ChapChap stops at a clear
                  confirmation step before funds move. That keeps the AI helpful
                  without ever being reckless.
                </p>
              </div>
            </div>
          </aside>
        </div>
      </div>

      <FundWalletSheet
        open={isFundWalletOpen}
        onClose={() => setFundWalletOpen(false)}
        fullAddress={mockUser.fullAddress}
        onCopyAddress={() => navigator.clipboard.writeText(mockUser.fullAddress)}
      />

      <TransactionConfirmationSheet
        open={isConfirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleConfirmTransaction}
        paymentIntent={paymentIntent}
      />

      <TransactionSuccessCard
        open={isSuccessOpen}
        onDone={() => setSuccessOpen(false)}
        paymentIntent={paymentIntent}
      />

      <NavTabs />
    </>
  );
}
