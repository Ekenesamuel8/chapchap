import {
  Attachment,
  ChatMessageType,
  PaymentIntent,
  PromptSuggestion,
  TransactionRecord,
} from "@/lib/types";

export const mockUser = {
  name: "Dear",
  balance: "$0.00",
  address: "0x88...78885775",
  fullAddress: "0x88c8d5fd41b1dc654e92237b9d6a78885775",
  savings: "Save 0.00",
};

export const promptSuggestions: PromptSuggestion[] = [
  {
    id: "invest-100",
    label: "How do I invest $100?",
    scenario: "welcome",
  },
  {
    id: "portfolio-analysis",
    label: "Analyze my portfolio and suggest investment",
    scenario: "investment",
  },
  {
    id: "buy-iphone",
    label: "Purchase an iPhone",
    scenario: "product",
  },
  {
    id: "swap-tezos",
    label: "Swap 10 tezos to USDC",
    scenario: "payment",
  },
];

export const sampleAttachments: Attachment[] = [
  {
    id: "product-a",
    alt: "Phone case set",
    gradient: "from-fuchsia-400/40 via-violet-500/25 to-sky-400/30",
  },
  {
    id: "product-b",
    alt: "Wireless earbuds",
    gradient: "from-amber-300/30 via-pink-400/20 to-violet-600/30",
  },
];

export const welcomeMessages: ChatMessageType[] = [
  {
    id: "assistant-welcome",
    role: "assistant",
    text: "I can help you pay, compare prices, fund your wallet, or explain a crypto action in plain language.",
  },
];

export const investmentMessages: ChatMessageType[] = [
  {
    id: "user-investment",
    role: "user",
    text: "Analyze my portfolio and suggest investment",
  },
  {
    id: "assistant-investment",
    role: "assistant",
    card: {
      type: "investment",
      heading: "Here’s the full breakdown of your Portfolio",
      body: "You have about $20 sitting idle. A safer beginner move is to keep most of it liquid in USDC, then test a small position in a yield product or a commerce-focused token basket. That way you learn how the market behaves without overcommitting funds you may need soon.",
    },
  },
];

export const productMessages: ChatMessageType[] = [
  {
    id: "user-product",
    role: "user",
    text: "Where do I get these for cheap compare the prices for me",
    attachments: sampleAttachments,
  },
  {
    id: "assistant-product",
    role: "assistant",
    card: {
      type: "product",
      heading: "Best value options I found",
      summary: "I compared nearby merchants and two online sellers. The lowest total today comes from QuickCart, but Kudi Market has faster pickup if timing matters more than price.",
      products: [
        {
          id: "quickcart",
          name: "Starter tech bundle",
          vendor: "QuickCart",
          price: "$84.40",
          eta: "Arrives tomorrow",
          accent: "from-violet-500/35 to-cyan-400/20",
        },
        {
          id: "kudi-market",
          name: "Same items, local pickup",
          vendor: "Kudi Market",
          price: "$89.10",
          eta: "Pickup in 2 hours",
          accent: "from-amber-400/35 to-pink-400/20",
        },
      ],
    },
  },
];

export const paymentIntent: PaymentIntent = {
  amount: "$29",
  asset: "USDC",
  recipient: "Ada",
  recipientAddress: "0x72...1dA4",
  network: "Etherlink",
  estimatedGas: "0.00042 XTZ",
  note: "Send $29 to Ada",
  schedule: "In the next 50 mins",
};

export const paymentMessages: ChatMessageType[] = [
  {
    id: "user-payment",
    role: "user",
    text: "Send $29 to Ada in next 50 mins",
  },
  {
    id: "assistant-payment",
    role: "assistant",
    card: {
      type: "payment",
      heading: "Payment request ready for confirmation",
      body: "I prepared a USDC transfer to Ada on Etherlink. Review the amount, recipient, schedule, and network details before you approve it.",
      highlight: "Clear confirmation keeps accidental transfers from slipping through.",
    },
  },
];

export const recentTransactions: TransactionRecord[] = [
  {
    id: "tx-1",
    type: "received",
    title: "USDC received",
    subtitle: "From Seun",
    amount: "+$120.00",
    time: "Today, 10:24 AM",
    status: "incoming",
    hash: "0x9834...af29",
  },
  {
    id: "tx-2",
    type: "sent",
    title: "Ada transfer",
    subtitle: "Scheduled payment",
    amount: "-$29.00",
    time: "Today, 9:10 AM",
    status: "pending",
    hash: "0x1238...bb17",
  },
  {
    id: "tx-3",
    type: "swap",
    title: "XTZ to USDC",
    subtitle: "Wallet balance top up",
    amount: "$45.00",
    time: "Yesterday, 7:45 PM",
    status: "success",
    hash: "0x72ce...91f0",
  },
];
