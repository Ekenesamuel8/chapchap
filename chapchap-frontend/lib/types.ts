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
  recent_transactions: Array<Record<string, string>>;
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
  status: "submitted" | "failed" | "awaiting_confirmation" | "confirmed" | "draft";
  tx_hash: string | null;
  explorer_url: string | null;
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

export type AgentChatResponse =
  | {
      type: "assistant_message";
      message: string;
    }
  | {
      type: "assistant_followup";
      message: string;
      intent: "payment" | "product_search";
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
      kind: "payment_confirmation_card";
      paymentIntentId: number;
      summary: PaymentConfirmationSummary;
    }
  | {
      id: string;
      kind: "product_results";
      results: ProductResultItem[];
    }
  | {
      id: string;
      kind: "system_error";
      text: string;
    };
