"use client";

import { useTheme } from "@/components/providers/theme-provider";

type ThemeToggleProps = {
  className?: string;
};

export function ThemeToggle({ className = "" }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.05] px-2 py-1 text-sm font-semibold text-white/[0.86] shadow-sm ${className}`.trim()}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
    >
      <span className="text-base leading-none">{theme === "dark" ? "☀" : "☾"}</span>
      
    </button>
  );
}
