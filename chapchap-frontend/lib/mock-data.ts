import { Attachment, TransactionRecord } from "@/lib/types";

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
    title: "ETH to savings",
    subtitle: "Confidential deposit",
    amount: "$45.00",
    time: "Yesterday, 7:45 PM",
    status: "success",
    hash: "0x72ce...91f0",
  },
];
