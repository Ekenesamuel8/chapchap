export type SourceType = "text" | "voice" | "image";

export type Attachment = {
  id: string;
  alt: string;
  gradient: string;
};

export type AuthUser = {
  id: number;
  email: string;
  full_name: string;
  avatar_url: string | null;
};

export type AuthResponse = {
  token: string;
  user: AuthUser;
};

export type WalletSummary = {
  address: string;
  address_short: string;
  wallet_type: string;
  chain_name: string;
  chain_id: number;
  explorer_base_url: string;
};

export type BalanceItem = {
  asset_symbol: string;
  asset_address: string | null;
  balance: string;
  balance_usd: string;
};

export type DashboardResponse = {
  user: AuthUser;
  wallet: WalletSummary;
  balances: BalanceItem[];
  recent_transactions: TransactionHistoryItem[];
  prompt_suggestions: string[];
};

export type ParseResponse = {
  prompt_request_id: number;
  parsed_intent_id: number;
  intent: string;
  confidence: number;
  missing_fields: string[];
  payload: Record<string, unknown>;
};

export type PaymentConfirmationSummary = {
  amount: string;
  currency: string;
  token_symbol: string;
  recipient_name: string | null;
  recipient_address: string | null;
  network: string;
  estimated_gas_xtz: string;
  note: string | null;
  schedule_in_minutes: number | null;
  scheduled_for?: string | null;
  explorer_base_url?: string | null;
};

export type SupportedAsset = {
  symbol: string;
  name: string;
  contract_address: string | null;
  decimals: number;
  is_native: boolean;
};

export type FundOptionsResponse = {
  receive: {
    address: string;
    address_short: string;
    network: string;
    chain_id: number;
    explorer_base_url: string;
    supported_assets: SupportedAsset[];
    note: string;
  };
  ramp_options: Array<{
    type: "onramp" | "offramp";
    label: string;
    enabled: boolean;
  }>;
};

export type ExecuteResponse = {
  action_type: "payment_confirmation";
  payment_intent_id: number;
  summary: PaymentConfirmationSummary;
};

export type PaymentSubmissionResponse = {
  payment_intent_id: number;
  status:
    | "submitted"
    | "failed"
    | "awaiting_confirmation"
    | "confirmed"
    | "draft"
    | "scheduled";
  tx_hash: string | null;
  explorer_url: string | null;
  balance_summary?: {
    wallet_address: string;
    balances: Array<{
      asset_symbol: string;
      balance: string;
      balance_usd: string;
    }>;
  };
};

export type PendingIntentSessionSummary = {
  id: number;
  status:
    | "collecting"
    | "ready_for_confirmation"
    | "results_ready"
    | "cancelled"
    | "completed";
  collected_data: Record<string, unknown>;
  missing_fields: string[];
};

export type ProductResultItem = {
  title: string;
  merchant_name: string;
  price: string;
  currency: string;
  tag: string;
  image_url: string;
  product_url: string;
};

export type GiftCardResultItem = {
  brand: string;
  title: string;
  denomination: string;
  country: string;
  availability: string;
  cta_label: string;
  mode: string;
};

export type SavingsResult = {
  id: number;
  asset: string;
  amount: string;
  strategy_name: string;
  strategy_type: string;
  apy_estimate: string;
  mode: string;
  status: string;
};

export type SwapPreview = {
  amount_in: string;
  source_token: string;
  destination_token: string;
  estimated_output: string;
  network: string;
  estimated_fee_xtz: string;
  slippage_note: string;
};

export type AgentChatResponse =
  | {
      type: "assistant_message";
      message: string;
    }
  | {
      type: "assistant_followup";
      message: string;
      intent: "payment" | "product_search" | "swap" | "save";
      session?: PendingIntentSessionSummary;
    }
  | {
      type: "payment_confirmation";
      message: string;
      intent: "payment";
      session: PendingIntentSessionSummary;
      payment: {
        payment_intent_id: number;
        summary: PaymentConfirmationSummary;
      };
    }
  | {
      type: "system_error";
      message: string;
      error_code: string;
    }
  | {
      type: "product_results";
      message: string;
      intent: "product_search";
      query?: string;
      session: PendingIntentSessionSummary;
      results: ProductResultItem[];
    }
  | {
      type: "swap_preview";
      message: string;
      intent: "swap";
      session?: PendingIntentSessionSummary;
      swap: SwapPreview;
    }
  | {
      type: "savings_result";
      message: string;
      intent: "save";
      savings: SavingsResult;
    }
  | {
      type: "giftcard_results";
      message: string;
      intent: "gift_card";
      results: GiftCardResultItem[];
    };

export type PromptSuggestion = {
  id: string;
  label: string;
};

export type TransactionRecord = {
  id: string;
  type: "sent" | "received" | "swap";
  title: string;
  subtitle: string;
  amount: string;
  time: string;
  status: "success" | "pending" | "incoming";
  hash: string;
};

export type TransactionHistoryItem = {
  id: number;
  transaction_type: "send" | "receive" | "swap" | "giftcard" | "save";
  asset_symbol: string;
  amount: string;
  network: string;
  recipient_address: string | null;
  sender_address: string | null;
  tx_hash: string | null;
  explorer_url: string | null;
  status: "pending" | "submitted" | "confirmed" | "failed" | "scheduled";
  title: string | null;
  subtitle: string | null;
  metadata_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type PaymentIntentView = {
  amount: string;
  asset: string;
  recipient: string;
  recipientAddress: string;
  network: string;
  estimatedGas: string;
  note: string;
  schedule: string;
};

export type SubmittedTransactionView = {
  amount: string;
  asset: string;
  recipient: string;
  network: string;
  txHash: string;
  explorerUrl: string | null;
  submittedAt: string;
  status?: string;
};

export type ConfidentialIntent =
  | "confidential_payment"
  | "public_payment"
  | "confidential_savings"
  | "confidential_agreement"
  | "proof_submission"
  | "general_help";

export type ConfidentialActionStatus =
  | "draft"
  | "awaiting_wallet"
  | "submitted"
  | "confirmed"
  | "failed"
  | "reviewed";

export type ConfidentialParsePayload = {
  action_id: number | null;
  intent: ConfidentialIntent;
  confidence: number;
  missing_fields: string[];
  public_summary: string;
  payload: Record<string, unknown>;
  agreement_record_id?: number;
  savings_position_id?: number;
};

export type ConfidentialChatSession = {
  messages: ChatItem[];
  pendingAction:
    | {
        field: "recipient_address" | "amount" | "transfer_mode";
        action: ConfidentialActionCard;
      }
    | null;
  submittedTransaction: SubmittedTransactionView | null;
};

export type ConfidentialHistoryItem = {
  type: ConfidentialIntent;
  status: ConfidentialActionStatus;
  public_summary: string;
  tx_hash: string | null;
  contract_address: string | null;
  network: string;
  created_at: string;
};

export type ConfidentialProofResponse = {
  agreement_id: number;
  recommendation: "release" | "refund" | "dispute";
  confidence: number;
  reasoning: string;
};

export type ConfidentialTxRecordResponse = {
  action_id: number;
  status: ConfidentialActionStatus;
  tx_hash: string | null;
  contract_address: string | null;
  network: string;
};

export type ConfidentialSavingsStatus =
  | "active"
  | "withdrawable"
  | "withdrawn"
  | "failed";

export type ConfidentialSavingsPosition = {
  id: number;
  amount_display: string;
  asset: string;
  lock_rule: string | null;
  unlock_at: string | null;
  status: ConfidentialSavingsStatus;
  tx_hash: string | null;
  withdraw_tx_hash: string | null;
  withdrawn_at: string | null;
  created_at: string;
};

export type ConfidentialSavingsWithdrawResponse = {
  id: number;
  amount_display: string;
  asset: string;
  unlock_at: string | null;
  status: ConfidentialSavingsStatus;
  tx_hash: string | null;
  withdraw_tx_hash: string | null;
  message: string;
  withdrawal_contract_ready: boolean;
};

export type ConfidentialActionCard = {
  actionId: number;
  intent: ConfidentialIntent;
  publicSummary: string;
  missingFields: string[];
  recipientName: string | null;
  recipientAddress: string | null;
  amount: string | null;
  asset: string;
  lockRule: string | null;
  unlockAt: string | null;
  condition: string | null;
  deadline: string | null;
  metadataHash: string | null;
  agreementRecordId: number | null;
  transferMode: "confidential" | "public" | "unspecified" | null;
};

export type ChatItem =
  | {
      id: string;
      kind: "user_message";
      text: string;
      attachments?: Attachment[];
    }
  | {
      id: string;
      kind: "assistant_message";
      text: string;
    }
  | {
      id: string;
      kind: "assistant_followup";
      text: string;
    }
  | {
      id: string;
      kind: "system_error";
      text: string;
    }
  | {
      id: string;
      kind: "confidential_action_card";
      action: ConfidentialActionCard;
    }
  | {
      id: string;
      kind: "proof_submission_card";
      agreementId?: number | null;
    }
  | {
      id: string;
      kind: "proof_result_card";
      recommendation: "release" | "refund" | "dispute";
      confidence: number;
      reasoning: string;
    };
