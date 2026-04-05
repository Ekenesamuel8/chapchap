"use client";

import { ReactNode } from "react";

type BottomSheetProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
};

export function BottomSheet({
  open,
  onClose,
  title,
  children,
}: BottomSheetProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 px-4 pb-4 pt-10 backdrop-blur-sm">
      <button
        aria-label="Close panel"
        className="absolute inset-0"
        onClick={onClose}
        type="button"
      />
      <div className="glass-panel edge-glow animate-float-up relative z-10 w-full max-w-xl rounded-[2rem] border border-white/10 p-5 sm:p-6">
        <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-white/[0.15]" />
        {title ? (
          <div className="mb-5 flex items-center justify-between gap-4">
            <h3 className="font-display text-xl font-semibold text-white">
              {title}
            </h3>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-white/[0.7] hover:bg-white/10"
            >
              Close
            </button>
          </div>
        ) : null}
        {children}
      </div>
    </div>
  );
}
