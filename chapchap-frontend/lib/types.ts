export type MessageRole = "user" | "assistant";

export type TransactionStatus = "success" | "pending" | "incoming";

export type Attachment = {
  id: string;
  alt: string;
  gradient: string;
};

export type PromptSuggestion = {
  id: string;
  label: string;
  scenario: ConversationScenario;
};

export type InvestmentCard = {
  type: "investment";
  heading: string;
  body: string;
};

export type ProductCard = {
  type: "product";
  heading: string;
  summary: string;
  products: Array<{
    id: string;
    name: string;
    vendor: string;
    price: string;
    eta: string;
    accent: string;
  }>;
};

export type PaymentCard = {
  type: "payment";
  heading: string;
  body: string;
  highlight: string;
};

export type MessageCard = InvestmentCard | ProductCard | PaymentCard;

export type ChatMessageType = {
  id: string;
  role: MessageRole;
  text?: string;
  card?: MessageCard;
  attachments?: Attachment[];
};

export type PaymentIntent = {
  amount: string;
  asset: string;
  recipient: string;
  recipientAddress: string;
  network: string;
  estimatedGas: string;
  note: string;
  schedule: string;
};

export type TransactionRecord = {
  id: string;
  type: "sent" | "received" | "swap";
  title: string;
  subtitle: string;
  amount: string;
  time: string;
  status: TransactionStatus;
  hash: string;
};

export type ConversationScenario =
  | "welcome"
  | "investment"
  | "product"
  | "payment";
