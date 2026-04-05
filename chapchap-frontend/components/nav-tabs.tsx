"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HistoryIcon, WalletIcon } from "@/components/icons";

const items = [
  { href: "/dashboard", label: "Assistant", icon: WalletIcon },
  { href: "/wallet", label: "Wallet", icon: WalletIcon },
  { href: "/history", label: "History", icon: HistoryIcon },
];

export function NavTabs() {
  const pathname = usePathname();

  return (
    <nav className="glass-panel edge-glow fixed bottom-4 left-1/2 z-40 flex w-[calc(100%-1.5rem)] max-w-sm -translate-x-1/2 items-center justify-between rounded-full border border-white/10 px-2 py-1 sm:px-3 sm:py-2 md:bottom-6">
      {items.map((item) => {
        const isActive = pathname === item.href;
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-2 rounded-full px-2 py-1 sm:px-4 sm:py-2 text-sm ${
              isActive
                ? "bg-white text-black"
                : "text-white/[0.62] hover:bg-white/[0.06] hover:text-white"
            }`}
          >
            <Icon className="size-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
