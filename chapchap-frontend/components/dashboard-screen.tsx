"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { id, parseEther } from "ethers";
import { ChatComposer } from "@/components/chat-composer";
import { ChatMessage } from "@/components/chat-message";
import { FundWalletSheet } from "@/components/fund-wallet-sheet";
import { NavTabs } from "@/components/nav-tabs";
import { PrivateBalanceCard } from "@/components/private-balance-card";
import { PromptSuggestions } from "@/components/prompt-suggestions";
import { ThemeToggle } from "@/components/theme-toggle";
import { TransactionSuccessCard } from "@/components/transaction-success-card";
import { WalletHeader } from "@/components/wallet-header";
import { useAuth } from "@/components/providers/auth-provider";
import { useWallet } from "@/components/providers/wallet-provider";
import { ApiError } from "@/lib/api/client";
import {
  parseConfidentialPrompt,
  recordConfidentialTx,
  submitAgreementProof,
} from "@/lib/api/confidential";
import { clearStoredChatSession } from "@/lib/auth-storage";
import {
  CHAPCHAP_CONFIDENTIAL_CORE_ADDRESS,
  ZAMA_SEPOLIA_CHAIN_ID,
  getTxExplorerUrl,
} from "@/lib/contracts/chapchap-confidential-core";
import {
  encryptAmount64,
  toUint64Wei,
  type ZamaEncryptionProgress,
} from "@/lib/zamaClient";
import {
  Attachment,
  ChatItem,
  ConfidentialActionCard,
  PromptSuggestion,
  SubmittedTransactionView,
} from "@/lib/types";

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      on?: (event: string, listener: (...args: unknown[]) => void) => void;
      removeListener?: (event: string, listener: (...args: unknown[]) => void) => void;
    };
  }
}

type PendingActionState =
  | {
      field: "recipient_address" | "amount" | "transfer_mode";
      action: ConfidentialActionCard;
    }
  | null;

type EncryptionRecoveryState =
  | {
      action: ConfidentialActionCard;
      kind: "private_transfer" | "private_save_after_deposit";
      message: string;
    }
  | null;

const PROMPTS: PromptSuggestion[] = [
  { id: "send-private", label: "Send 0.002 ETH to Ada privately" },
  { id: "send-public", label: "Send 0.002 ETH to Ada publicly" },
  { id: "save", label: "Save 0.01 ETH for 7 days" },
  {
    id: "agreement",
    label: "Create agreement: pay Ada if she delivers the logo before Friday",
  },
  { id: "proof", label: "Submit proof for my agreement" },
];

const INITIAL_ASSISTANT_MESSAGE: ChatItem = {
  id: "assistant-intro",
  kind: "assistant_message",
  text:
    "I can help you prepare confidential payments, private savings deposits, agreements, and proof reviews on Sepolia. Tell me what you want to do.",
};

export function DashboardScreen() {
  const router = useRouter();
  const { hydrated, isAuthenticated, token, logout, user } = useAuth();
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
    refreshWalletState,
    revealPrivateBalance,
    getContract,
    getSignerClient,
  } = useWallet();
  const [composerValue, setComposerValue] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [chatItems, setChatItems] = useState<ChatItem[]>([INITIAL_ASSISTANT_MESSAGE]);
  const [isChatLoading, setChatLoading] = useState(false);
  const [isFundWalletOpen, setFundWalletOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingActionState>(null);
  const [submittedTransaction, setSubmittedTransaction] =
    useState<SubmittedTransactionView | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [encryptionRecovery, setEncryptionRecovery] =
    useState<EncryptionRecoveryState>(null);
  const hasStartedInitialLoadRef = useRef(false);

  useEffect(() => {
    if (!hydrated) return;
    if (!isAuthenticated || !token) {
      router.replace("/");
      return;
    }
    if (hasStartedInitialLoadRef.current) return;
    hasStartedInitialLoadRef.current = true;
    clearStoredChatSession();
    setChatItems([INITIAL_ASSISTANT_MESSAGE]);
    setPendingAction(null);
    setSubmittedTransaction(null);
    setStatusMessage(null);
    setEncryptionRecovery(null);
  }, [hydrated, isAuthenticated, router, token]);

  useEffect(() => () => {
    clearStoredChatSession();
  }, []);

  const promptSuggestions = PROMPTS;
  const receiveAddress = connectedAddress;

  const walletAddressLabel = useMemo(() => {
    if (connectedAddress) return shortenAddress(connectedAddress);
    return "No wallet yet";
  }, [connectedAddress]);

  const balanceLabel = useMemo(() => {
    if (!connectedAddress || !walletBalanceEth) return "Connect MetaMask";
    return `${walletBalanceEth} ETH`;
  }, [connectedAddress, walletBalanceEth]);

  const savingsLabel = connectedAddress
    ? "Live Sepolia wallet connected"
    : "Connect on Sepolia to continue";

  const networkLabel = "Sepolia / Zama FHEVM";

  const contractSetupMessage = CHAPCHAP_CONFIDENTIAL_CORE_ADDRESS
    ? null
    : "Contract setup needed: add NEXT_PUBLIC_ZAMA_CORE_CONTRACT_ADDRESS before submitting confidential savings, private transfers, or agreements.";

  const appendChatItem = useCallback((item: ChatItem) => {
    setChatItems((current) => [...current, item]);
  }, []);

  const pushAssistantMessage = useCallback(
    (text: string) => {
      appendChatItem({ id: createId("assistant"), kind: "assistant_message", text });
    },
    [appendChatItem],
  );

  const pushAssistantFollowup = useCallback(
    (text: string) => {
      appendChatItem({ id: createId("followup"), kind: "assistant_followup", text });
    },
    [appendChatItem],
  );

  const pushSystemMessage = useCallback(
    (text: string) => {
      appendChatItem({ id: createId("system"), kind: "system_error", text });
    },
    [appendChatItem],
  );

  const handleConnectWallet = useCallback(async () => {
    try {
      await connectWallet();
      setStatusMessage("Wallet connected on Sepolia / Zama FHEVM.");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "I couldn't connect your wallet right now.";
      pushSystemMessage(message);
    }
  }, [connectWallet, pushSystemMessage]);

  const handleDisconnectWallet = useCallback(() => {
    disconnectWallet();
    setPendingAction(null);
    setSubmittedTransaction(null);
    setEncryptionRecovery(null);
    setStatusMessage("Wallet disconnected from ChapChap Confidential.");
  }, [disconnectWallet]);

  useEffect(() => {
    if (connectedAddress !== null) return;
    setPendingAction(null);
  }, [connectedAddress]);

  const handleSuggestionSelect = (label: string) => {
    setComposerValue(label);
  };

  const handlePendingActionReply = async (message: string) => {
    if (!pendingAction) return false;

    if (pendingAction.field === "recipient_address") {
      const recipientAddress = extractAddress(message);
      if (!recipientAddress) {
        pushAssistantFollowup(
          "Please send a valid Sepolia wallet address that starts with 0x.",
        );
        return true;
      }

      const resolvedAction: ConfidentialActionCard = {
        ...pendingAction.action,
        recipientAddress,
        missingFields: pendingAction.action.missingFields.filter(
          (field) => field !== "recipient_address",
        ),
      };
      setPendingAction(resolvePendingAction(resolvedAction));
      pushAssistantMessage("Recipient wallet captured.");
      appendChatItem({
        id: createId("card"),
        kind: "confidential_action_card",
        action: resolvedAction,
      });
      return true;
    }

    if (pendingAction.field === "transfer_mode") {
      const transferMode = extractTransferModeReply(message);
      if (!transferMode) {
        pushAssistantFollowup(
          "Reply with private/confidential or public/normal so I know which transfer mode to use.",
        );
        return true;
      }

      handleTransferModeSelection(pendingAction.action, transferMode);
      return true;
    }

    if (pendingAction.field === "amount") {
      const amount = extractEthAmount(message);
      if (!amount) {
        pushAssistantFollowup(
          "Please send the agreement amount in ETH, for example 0.02 ETH.",
        );
        return true;
      }

      const resolvedAction: ConfidentialActionCard = {
        ...pendingAction.action,
        amount,
        missingFields: pendingAction.action.missingFields.filter(
          (field) => field !== "amount",
        ),
      };
      setPendingAction(resolvePendingAction(resolvedAction));
      pushAssistantMessage("Agreement amount added.");
      appendChatItem({
        id: createId("card"),
        kind: "confidential_action_card",
        action: resolvedAction,
      });
      return true;
    }

    return false;
  };

  const handleTransferModeSelection = useCallback(
    (
      action: ConfidentialActionCard,
      transferMode: "confidential" | "public",
    ) => {
      const resolvedAction: ConfidentialActionCard = {
        ...action,
        intent: transferMode === "public" ? "public_payment" : "confidential_payment",
        transferMode,
        missingFields: action.missingFields.filter((field) => field !== "transfer_mode"),
      };
      const nextPending = resolvePendingAction(resolvedAction);
      setPendingAction(nextPending);
      pushAssistantMessage(
        transferMode === "public"
          ? "Public Sepolia transfer selected."
          : "Confidential ChapChap transfer selected.",
      );
      if (nextPending?.field === "recipient_address") {
        pushAssistantFollowup(
          "I still need the recipient wallet address before you continue. Paste the Sepolia address next.",
        );
      }
      appendChatItem({
        id: createId("card"),
        kind: "confidential_action_card",
        action: resolvedAction,
      });
    },
    [appendChatItem, pushAssistantFollowup, pushAssistantMessage],
  );

  const sendPrompt = async (rawPrompt?: string) => {
    const prompt = (rawPrompt ?? composerValue).trim();
    if (!prompt || !token) return;

    appendChatItem({
      id: createId("user"),
      kind: "user_message",
      text: prompt,
      attachments: attachments.length ? attachments : undefined,
    });

    setComposerValue("");
    setAttachments([]);
    setStatusMessage(null);
    setEncryptionRecovery(null);
    setChatLoading(true);

    try {
      const handledPendingReply = await handlePendingActionReply(prompt);
      if (handledPendingReply) return;

      const response = await parseConfidentialPrompt(prompt, token);

      if (response.intent === "proof_submission") {
        appendChatItem({
          id: createId("assistant"),
          kind: "assistant_followup",
          text: "Add the agreement record ID and the proof you want reviewed.",
        });
        appendChatItem({
          id: createId("proof"),
          kind: "proof_submission_card",
        });
        return;
      }

      if (response.intent === "general_help") {
        pushAssistantMessage(
          "I can help you send a confidential payment draft, send a public Sepolia transfer, deposit to savings, create an agreement, or review proof. Try one of the prompt ideas below.",
        );
        return;
      }

      const action = toConfidentialActionCard(response);
      const nextPendingAction = resolvePendingAction(action);
      setPendingAction(nextPendingAction);

      appendChatItem({
        id: createId("assistant"),
        kind: "assistant_message",
        text: response.public_summary,
      });

      if (nextPendingAction?.field === "recipient_address") {
        appendChatItem({
          id: createId("followup"),
          kind: "assistant_followup",
          text: "I still need the recipient wallet address before you continue. Paste the Sepolia address next.",
        });
      }

      if (nextPendingAction?.field === "amount") {
        appendChatItem({
          id: createId("followup"),
          kind: "assistant_followup",
          text: "I still need the ETH amount for this agreement. Send something like 0.02 ETH.",
        });
      }

      if (nextPendingAction?.field === "transfer_mode") {
        appendChatItem({
          id: createId("followup"),
          kind: "assistant_followup",
          text: "Do you want this as a confidential ChapChap transfer or a normal public Sepolia ETH transfer?",
        });
      }

      appendChatItem({
        id: createId("card"),
        kind: "confidential_action_card",
        action,
      });
    } catch (error) {
      const message = mapFrontendError(
        error,
        "I couldn't parse that confidential request right now.",
      );
      pushSystemMessage(message);
    } finally {
      setChatLoading(false);
    }
  };

  const handlePrepareAction = async (action: ConfidentialActionCard) => {
    try {
      setStatusMessage(null);
      setEncryptionRecovery(null);

      const unresolved = resolvePendingAction(action);
      if (unresolved) {
        setPendingAction(unresolved);
        if (unresolved.field === "recipient_address") {
          pushAssistantFollowup("Paste the recipient's Sepolia wallet address to continue.");
        } else if (unresolved.field === "amount") {
          pushAssistantFollowup("Send the agreement amount in ETH to continue.");
        } else {
          pushAssistantFollowup(
            "Choose whether this should be a confidential ChapChap transfer or a normal public Sepolia ETH transfer.",
          );
        }
        return;
      }

      if (
        contractSetupMessage &&
        action.intent !== "public_payment"
      ) {
        pushSystemMessage(contractSetupMessage);
        return;
      }

      if (!connectedAddress) {
        await handleConnectWallet();
      }

      if (action.intent === "confidential_payment") {
        await submitPaymentAction(action);
        return;
      }

      if (action.intent === "public_payment") {
        await submitPublicPaymentAction(action);
        return;
      }

      if (action.intent === "confidential_savings") {
        await submitSavingsAction(action);
        return;
      }

      if (action.intent === "confidential_agreement") {
        await submitAgreementAction(action);
      }
    } catch (error) {
      const message = mapFrontendError(
        error,
        "I couldn't prepare that contract action right now.",
      );
      setStatusMessage(null);
      pushSystemMessage(message);
    }
  };

  const handleZamaProgress = useCallback((progress: ZamaEncryptionProgress) => {
    setStatusMessage(progress.message);
  }, []);

  const submitSavingsAction = useCallback(
    async (
      action: ConfidentialActionCard,
      options: { skipDeposit?: boolean } = {},
    ) => {
      const amount = action.amount;
      if (!amount) {
        throw new Error("This savings draft is missing an ETH amount.");
      }
      if (!token) {
        throw new Error("You need to be signed in before recording confidential actions.");
      }

      const publicAmountWei = await preflightConfidentialAmount({
        amount,
        connectedAddress,
      });
      const { contract, signerAddress } = await getContract();

      let depositHash: string | null = null;
      if (!options.skipDeposit) {
        setStatusMessage("Waiting for wallet confirmation...");
        const depositTx = await contract.deposit({ value: publicAmountWei });
        setStatusMessage("Submitting confidential transaction...");
        await depositTx.wait();
        depositHash = depositTx.hash;
      }

      let encryptedAmount: `0x${string}`;
      let inputProof: `0x${string}`;
      let amountWeiUint64: bigint;
      try {
        const encrypted = await encryptAmount64(
          window.ethereum,
          CHAPCHAP_CONFIDENTIAL_CORE_ADDRESS,
          signerAddress,
          publicAmountWei,
          { onProgress: handleZamaProgress },
        );
        encryptedAmount = encrypted.encryptedAmount;
        inputProof = encrypted.inputProof;
        amountWeiUint64 = encrypted.amountWeiUint64;
      } catch (error) {
        const message =
          options.skipDeposit || depositHash
            ? "Deposit succeeded, but private savings encryption failed. Your funds remain in your ChapChap contract balance. Retry private save."
            : getEncryptionFailureMessage(error);
        setEncryptionRecovery({
          action,
          kind: "private_save_after_deposit",
          message,
        });
        throw new Error(message);
      }

      setStatusMessage("Waiting for wallet confirmation...");
      const savingsTx = await contract.saveConfidential(
        encryptedAmount,
        inputProof,
        amountWeiUint64,
      );
      setStatusMessage("Submitting confidential transaction...");
      await savingsTx.wait();

      await recordConfidentialTx(
        action.actionId,
        {
          tx_hash: savingsTx.hash,
          status: "submitted",
          contract_address: CHAPCHAP_CONFIDENTIAL_CORE_ADDRESS,
          intent: "confidential_savings",
        },
        token,
      );

      const receiptView: SubmittedTransactionView = {
        amount,
        asset: action.asset,
        recipient: "ChapChap Confidential Core",
        network: networkLabel,
        txHash: savingsTx.hash,
        explorerUrl: getTxExplorerUrl(savingsTx.hash),
        submittedAt: new Date().toLocaleString(),
        status: "submitted",
      };

      setSubmittedTransaction(receiptView);
      setPendingAction(null);
      setEncryptionRecovery(null);
      setStatusMessage("Saved to history. Transaction submitted.");
      pushAssistantMessage(
        depositHash
          ? `Savings deposit and confidential save submitted on Sepolia. Deposit tx: ${shortenHash(
              depositHash,
            )}. Save tx: ${shortenHash(savingsTx.hash)}.`
          : `Confidential save submitted on Sepolia. Save tx: ${shortenHash(savingsTx.hash)}.`,
      );
      await refreshWalletState();
    },
    [
      connectedAddress,
      getContract,
      handleZamaProgress,
      networkLabel,
      pushAssistantMessage,
      refreshWalletState,
      token,
    ],
  );

  const submitAgreementAction = useCallback(
    async (action: ConfidentialActionCard) => {
      if (!token) {
        throw new Error("You need to be signed in before recording confidential actions.");
      }
      if (!action.recipientAddress) {
        throw new Error("This agreement still needs a recipient address.");
      }
      if (!action.amount) {
        throw new Error("This agreement still needs an ETH amount.");
      }

      const deadlineTimestamp = resolveAgreementDeadline(action.deadline);
      const metadataHash = buildAgreementMetadataHash(action, deadlineTimestamp);
      const { contract } = await getContract();
      setStatusMessage("Waiting for wallet confirmation...");
      const tx = await contract.createAgreement(
        action.recipientAddress,
        deadlineTimestamp,
        metadataHash,
        { value: parseEther(action.amount) },
      );
      setStatusMessage("Submitting confidential transaction...");
      await tx.wait();

      await recordConfidentialTx(
        action.actionId,
        {
          tx_hash: tx.hash,
          status: "submitted",
          contract_address: CHAPCHAP_CONFIDENTIAL_CORE_ADDRESS,
          intent: "confidential_agreement",
        },
        token,
      );

      const receiptView: SubmittedTransactionView = {
        amount: action.amount,
        asset: action.asset,
        recipient: action.recipientName ?? shortenAddress(action.recipientAddress),
        network: networkLabel,
        txHash: tx.hash,
        explorerUrl: getTxExplorerUrl(tx.hash),
        submittedAt: new Date().toLocaleString(),
        status: "submitted",
      };

      setSubmittedTransaction(receiptView);
      setPendingAction(null);
      setEncryptionRecovery(null);
      setStatusMessage("Saved to history. Transaction submitted.");
      pushAssistantMessage(
        "Agreement transaction submitted on Sepolia. You can review the tx hash now and submit proof later from the same chat.",
      );
      await refreshWalletState();
    },
    [getContract, networkLabel, pushAssistantMessage, refreshWalletState, token],
  );

  const submitPaymentAction = useCallback(
    async (action: ConfidentialActionCard) => {
      if (!token) {
        throw new Error("You need to be signed in before recording confidential actions.");
      }
      if (!action.recipientAddress) {
        throw new Error("This payment still needs a recipient address.");
      }
      if (!action.amount) {
        throw new Error("This payment still needs an ETH amount.");
      }

      const amountWei = await preflightConfidentialAmount({
        amount: action.amount,
        connectedAddress,
      });
      const { contract, signerAddress } = await getContract();
      const senderMirrorBalance = await contract.publicBalanceMirror(signerAddress);

      if (BigInt(senderMirrorBalance) < amountWei) {
        throw new Error("Deposit into your confidential balance first.");
      }

      let encryptedAmount: `0x${string}`;
      let inputProof: `0x${string}`;
      let amountWeiUint64: bigint;
      try {
        const encrypted = await encryptAmount64(
          window.ethereum,
          CHAPCHAP_CONFIDENTIAL_CORE_ADDRESS,
          signerAddress,
          amountWei,
          { onProgress: handleZamaProgress },
        );
        encryptedAmount = encrypted.encryptedAmount;
        inputProof = encrypted.inputProof;
        amountWeiUint64 = encrypted.amountWeiUint64;
      } catch (error) {
        const message = getEncryptionFailureMessage(error);
        setEncryptionRecovery({
          action,
          kind: "private_transfer",
          message,
        });
        throw new Error(message);
      }

      setStatusMessage("Waiting for wallet confirmation...");
      const tx = await contract.transferConfidential(
        action.recipientAddress,
        encryptedAmount,
        inputProof,
        amountWeiUint64,
      );
      setStatusMessage("Submitting confidential transaction...");
      await tx.wait();

      await recordConfidentialTx(
        action.actionId,
        {
          tx_hash: tx.hash,
          status: "submitted",
          contract_address: CHAPCHAP_CONFIDENTIAL_CORE_ADDRESS,
          intent: "confidential_payment",
        },
        token,
      );

      const receiptView: SubmittedTransactionView = {
        amount: action.amount,
        asset: action.asset,
        recipient: action.recipientName ?? shortenAddress(action.recipientAddress),
        network: networkLabel,
        txHash: tx.hash,
        explorerUrl: getTxExplorerUrl(tx.hash),
        submittedAt: new Date().toLocaleString(),
        status: "submitted",
      };

      setSubmittedTransaction(receiptView);
      setPendingAction(null);
      setEncryptionRecovery(null);
      setStatusMessage("Saved to history. Transaction submitted.");
      pushAssistantMessage(
        `Confidential transfer submitted on Sepolia. Tx hash: ${shortenHash(tx.hash)}.`,
      );
      await refreshWalletState();
    },
    [
      connectedAddress,
      getContract,
      handleZamaProgress,
      networkLabel,
      pushAssistantMessage,
      refreshWalletState,
      token,
    ],
  );

  const submitPublicPaymentAction = useCallback(
    async (action: ConfidentialActionCard) => {
      if (!token) {
        throw new Error("You need to be signed in before recording confidential actions.");
      }
      if (!action.recipientAddress) {
        throw new Error("This payment still needs a recipient address.");
      }
      if (!action.amount) {
        throw new Error("This payment still needs an ETH amount.");
      }

      const { signer } = await getSignerClient();
      setStatusMessage("Waiting for wallet confirmation...");
      const tx = await signer.sendTransaction({
        to: action.recipientAddress,
        value: parseEther(action.amount),
      });
      setStatusMessage("Submitting public transaction...");
      await tx.wait();

      await recordConfidentialTx(
        action.actionId,
        {
          tx_hash: tx.hash,
          status: "submitted",
          contract_address: null,
          intent: "public_payment",
        },
        token,
      );

      const receiptView: SubmittedTransactionView = {
        amount: action.amount,
        asset: action.asset,
        recipient: action.recipientName ?? shortenAddress(action.recipientAddress),
        network: networkLabel,
        txHash: tx.hash,
        explorerUrl: getTxExplorerUrl(tx.hash),
        submittedAt: new Date().toLocaleString(),
        status: "submitted",
      };

      setSubmittedTransaction(receiptView);
      setPendingAction(null);
      setEncryptionRecovery(null);
      setStatusMessage("Saved to history. Transaction submitted.");
      pushAssistantMessage(
        `Public Sepolia ETH transfer submitted. Tx hash: ${shortenHash(tx.hash)}.`,
      );
      await refreshWalletState();
    },
    [getSignerClient, networkLabel, pushAssistantMessage, refreshWalletState, token],
  );

  const handleRetryPrivateAction = useCallback(async () => {
    if (!encryptionRecovery) return;
    setStatusMessage(null);
    try {
      if (encryptionRecovery.kind === "private_save_after_deposit") {
        await submitSavingsAction(encryptionRecovery.action, { skipDeposit: true });
        return;
      }
      await submitPaymentAction(encryptionRecovery.action);
    } catch (error) {
      const message = mapFrontendError(
        error,
        "The Zama Sepolia relayer is temporarily unreachable. Your funds were not moved. Try again, or use public transfer for demo.",
      );
      pushSystemMessage(message);
    }
  }, [
    encryptionRecovery,
    pushSystemMessage,
    submitPaymentAction,
    submitSavingsAction,
  ]);

  const handleSendPublicInstead = useCallback(async () => {
    if (!encryptionRecovery || encryptionRecovery.kind !== "private_transfer") return;
    const publicAction: ConfidentialActionCard = {
      ...encryptionRecovery.action,
      intent: "public_payment",
      transferMode: "public",
      missingFields: encryptionRecovery.action.missingFields.filter(
        (field) => field !== "transfer_mode",
      ),
    };

    setStatusMessage(null);
    setEncryptionRecovery(null);
    pushAssistantMessage("Switching this draft to a public Sepolia ETH transfer.");

    try {
      await submitPublicPaymentAction(publicAction);
    } catch (error) {
      const message = mapFrontendError(
        error,
        "I couldn't submit the public Sepolia transfer right now.",
      );
      pushSystemMessage(message);
    }
  }, [
    encryptionRecovery,
    pushAssistantMessage,
    pushSystemMessage,
    submitPublicPaymentAction,
  ]);

  const handleSubmitProof = async (
    agreementId: number,
    proofText: string,
    proofLink?: string,
  ) => {
    if (!token) {
      throw new Error("You need to be signed in before submitting proof.");
    }

    const result = await submitAgreementProof(agreementId, proofText, proofLink, token);
    appendChatItem({
      id: createId("proof-result"),
      kind: "proof_result_card",
      recommendation: result.recommendation,
      confidence: result.confidence,
      reasoning: result.reasoning,
    });
  };

  if (!hydrated || (isAuthenticated && !user)) {
    return (
      <div className="min-h-screen px-4 py-8 text-white">
        <div className="glass-panel edge-glow mx-auto max-w-4xl rounded-[2rem] border border-white/10 p-6">
          Loading ChapChap Confidential...
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <>
      <div className="min-h-screen bg-background px-4 pb-28 pt-6 text-foreground md:px-6">
        <div className="mx-auto max-w-4xl">
          <main className="glass-panel edge-glow overflow-hidden rounded-[2.2rem] border border-white/10">
            <div className="relative overflow-hidden px-5 pb-6 pt-7 sm:px-8 sm:pt-8">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-[radial-gradient(circle_at_top,_rgba(118,87,246,0.22),_transparent_70%)]" />
              <div className="mb-4 flex items-center justify-end gap-4">
                <ThemeToggle />
                <button
                  type="button"
                  onClick={() => {
                    clearStoredChatSession();
                    disconnectWallet();
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
                address={walletAddressLabel}
                savings={savingsLabel}
                networkLabel={networkLabel}
                connectedAddress={connectedAddress}
                isWalletConnecting={isWalletConnecting}
                onCopy={() => navigator.clipboard.writeText(connectedAddress ?? "")}
                onFundWallet={() => setFundWalletOpen(true)}
                onConnectWallet={() => void handleConnectWallet()}
                onDisconnectWallet={handleDisconnectWallet}
              />

              <section className="mt-12">
                <h1 className="text-lg font-semibold tracking-tight text-white sm:text-[2.7rem]">
                  Hi {user?.full_name || "there"}
                </h1>
                <p className="mt-1 max-w-lg text-lg font-semibold leading-tight tracking-tight text-white/[0.74] sm:text-[2.7rem]">
                  Chat with ChapChap.
                </p>
                <p className="mt-3 text-sm text-white/[0.52]">
                  Describe a confidential payment, savings plan, agreement, or proof review and I’ll prepare the right Sepolia flow.
                </p>
              </section>

              {contractSetupMessage ? (
                <div className="mt-6 rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                  {contractSetupMessage}
                </div>
              ) : null}

              <section className="mt-10">
                <PromptSuggestions
                  prompts={promptSuggestions}
                  onSelect={handleSuggestionSelect}
                />
              </section>

              <section className="mt-6">
                <PrivateBalanceCard
                  connectedAddress={connectedAddress}
                  privateBalanceStatus={privateBalanceStatus}
                  privateBalanceEth={privateBalanceEth}
                  privateBalanceHandle={privateBalanceHandle}
                  privateBalanceError={privateBalanceError}
                  onReveal={revealPrivateBalance}
                />
              </section>

              <section className="mt-6 space-y-4">
                {chatItems.map((message) => (
                  <ChatMessage
                    key={message.id}
                    message={message}
                    onPrepareAction={(action) => void handlePrepareAction(action)}
                    onSelectTransferMode={handleTransferModeSelection}
                    onSubmitProof={handleSubmitProof}
                  />
                ))}

                {isChatLoading ? (
                  <div className="glass-panel inline-flex items-center gap-2 rounded-full px-4 py-3 text-white/[0.65]">
                    <span className="typing-dot size-1 rounded-full bg-white/[0.65]" />
                    <span className="typing-dot size-1 rounded-full bg-white/[0.65]" />
                    <span className="typing-dot size-1 rounded-full bg-white/[0.65]" />
                    <span className="ml-2 text-xs">ChapChap is preparing your confidential request</span>
                  </div>
                ) : null}

                {statusMessage ? (
                  <p className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                    {statusMessage}
                  </p>
                ) : null}

                {encryptionRecovery ? (
                  <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-4 text-sm text-amber-100">
                    <p className="leading-6">{encryptionRecovery.message}</p>
                    <div className="mt-3 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => void handleRetryPrivateAction()}
                        className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black"
                      >
                        {encryptionRecovery.kind === "private_save_after_deposit"
                          ? "Retry private save"
                          : "Retry private transfer"}
                      </button>
                      {encryptionRecovery.kind === "private_transfer" ? (
                        <button
                          type="button"
                          onClick={() => void handleSendPublicInstead()}
                          className="rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-sm font-semibold text-white"
                        >
                          Send publicly instead
                        </button>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </section>
            </div>

            <div className="px-4 pb-4 sm:px-6">
              <ChatComposer
                value={composerValue}
                onChange={setComposerValue}
                onSend={() => void sendPrompt()}
                onAttachmentAdd={setAttachments}
                attachments={attachments}
              />
              <div className="mt-3 rounded-[1.5rem] border border-white/10 bg-white/[0.03] px-4 py-3 text-xs leading-6 text-white/[0.55]">
                Sensitive values are encrypted where supported by Zama/FHEVM. Wallet addresses and transaction existence may still be public.
              </div>
            </div>
          </main>
        </div>
      </div>

      <FundWalletSheet
        open={isFundWalletOpen}
        onClose={() => setFundWalletOpen(false)}
        receiveAddress={receiveAddress}
        onCopyAddress={() => navigator.clipboard.writeText(receiveAddress ?? "")}
      />

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

function toConfidentialActionCard(payload: {
  action_id: number | null;
  intent: ConfidentialActionCard["intent"];
  missing_fields: string[];
  public_summary: string;
  agreement_record_id?: number;
  payload: Record<string, unknown>;
}): ConfidentialActionCard {
  if (payload.action_id === null) {
    throw new Error("Only action-backed confidential intents can be rendered as action cards.");
  }

  return {
    actionId: payload.action_id,
    intent: payload.intent,
    publicSummary: payload.public_summary,
    missingFields: payload.missing_fields,
    recipientName: stringOrNull(payload.payload.recipient_name),
    recipientAddress: stringOrNull(payload.payload.recipient_address),
    amount: stringOrNull(payload.payload.amount_display),
    asset: stringOrNull(payload.payload.asset) ?? "ETH",
    lockRule: stringOrNull(payload.payload.lock_rule),
    unlockAt: stringOrNull(payload.payload.unlock_at),
    condition: stringOrNull(payload.payload.condition_summary),
    deadline: stringOrNull(payload.payload.deadline),
    metadataHash: stringOrNull(payload.payload.metadata_hash),
    agreementRecordId: payload.agreement_record_id ?? null,
    transferMode: parseTransferMode(payload.payload.transfer_mode),
  };
}

function resolvePendingAction(action: ConfidentialActionCard): PendingActionState {
  if (
    (action.intent === "confidential_payment" || action.intent === "public_payment") &&
    action.missingFields.includes("transfer_mode")
  ) {
    return { field: "transfer_mode", action };
  }
  if (action.missingFields.includes("recipient_address")) {
    return { field: "recipient_address", action };
  }
  if (action.intent === "confidential_agreement" && !action.amount) {
    return { field: "amount", action };
  }
  return null;
}

function extractAddress(text: string) {
  const match = text.match(/\b0x[a-fA-F0-9]{40}\b/);
  return match?.[0] ?? null;
}

function extractEthAmount(text: string) {
  const match = text.match(/\b(\d+(?:\.\d{1,8})?)\s*(?:eth)?\b/i);
  return match?.[1] ?? null;
}

function extractTransferModeReply(text: string) {
  const lowered = text.toLowerCase();
  if (
    lowered.includes("private") ||
    lowered.includes("privately") ||
    lowered.includes("confidential")
  ) {
    return "confidential" as const;
  }
  if (
    lowered.includes("public") ||
    lowered.includes("publicly") ||
    lowered.includes("normal") ||
    lowered.includes("normally")
  ) {
    return "public" as const;
  }
  return null;
}

function resolveAgreementDeadline(deadline: string | null) {
  if (deadline) {
    const parsed = Date.parse(deadline);
    if (!Number.isNaN(parsed)) {
      return Math.floor(parsed / 1000);
    }
  }
  return Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;
}

function buildAgreementMetadataHash(
  action: ConfidentialActionCard,
  deadlineTimestamp: number,
) {
  const metadata = [
    `condition:${action.condition ?? action.publicSummary}`,
    `deadline:${deadlineTimestamp}`,
    `proof_required:true`,
  ].join("|");
  return id(metadata);
}

function shortenHash(hash: string) {
  if (hash.length <= 14) return hash;
  return `${hash.slice(0, 8)}...${hash.slice(-6)}`;
}

function shortenAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function stringOrNull(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function parseTransferMode(value: unknown) {
  if (value === "confidential" || value === "public" || value === "unspecified") {
    return value;
  }
  return null;
}

async function preflightConfidentialAmount({
  amount,
  connectedAddress,
}: {
  amount: string;
  connectedAddress: string | null;
}) {
  if (!CHAPCHAP_CONFIDENTIAL_CORE_ADDRESS) {
    throw new Error(
      "NEXT_PUBLIC_ZAMA_CORE_CONTRACT_ADDRESS is missing. Add the deployed Sepolia contract address first.",
    );
  }
  if (!window.ethereum) {
    throw new Error("MetaMask wasn't detected in this browser.");
  }
  const accounts = (await window.ethereum.request({
    method: "eth_accounts",
  })) as unknown;
  const walletAddress =
    connectedAddress ||
    (Array.isArray(accounts) && typeof accounts[0] === "string" ? accounts[0] : null);
  if (!walletAddress) {
    throw new Error("Connect MetaMask on Sepolia before encrypting confidential amounts.");
  }

  const chainIdHex = await window.ethereum.request({ method: "eth_chainId" });
  const chainId = typeof chainIdHex === "string" ? Number(chainIdHex) : null;
  if (chainId !== ZAMA_SEPOLIA_CHAIN_ID) {
    throw new Error("Switch MetaMask to Sepolia before encrypting confidential amounts.");
  }

  return toUint64Wei(amount);
}

function mapFrontendError(error: unknown, fallbackMessage: string) {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    (error.code === 4001 || error.code === "ACTION_REJECTED")
  ) {
    return "Wallet confirmation was rejected.";
  }

  if (error instanceof Error) {
    const lowered = error.message.toLowerCase();

    if (lowered.includes("insufficient funds")) {
      return "Insufficient Sepolia ETH for this transaction.";
    }
    if (lowered.includes("invalidamount")) {
      return "Deposit into your confidential balance first.";
    }
    if (lowered.includes("missing") && lowered.includes("contract address")) {
      return error.message;
    }
    if (lowered.includes("zama relayer needs")) {
      return "The Zama encryption client could not initialize with this wallet provider.";
    }
    if (
      lowered.includes("zama sepolia relayer is temporarily unreachable") ||
      lowered.includes("could not reach the sepolia relayer") ||
      lowered.includes("zama relayer encryption failed") ||
      (lowered.includes("relayer") && lowered.includes("404"))
    ) {
      return getEncryptionFailureMessage(error);
    }
    if (lowered.includes("requires a sepolia wallet connection")) {
      return "Switch MetaMask to Sepolia before encrypting confidential amounts.";
    }
    if (lowered.includes("user rejected")) {
      return "Wallet confirmation was rejected.";
    }
    if (lowered.includes("deposit into your confidential balance first")) {
      return "Deposit into your confidential balance first.";
    }

    return error.message || fallbackMessage;
  }

  return fallbackMessage;
}

function getEncryptionFailureMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("Your funds were not moved")) {
    return message;
  }
  return "The Zama Sepolia relayer is temporarily unreachable. Your funds were not moved. Try again, or use public transfer for demo.";
}

function createId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}
