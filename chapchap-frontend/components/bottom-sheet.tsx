"use client";

import { ReactNode, useEffect } from "react";

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
  useEffect(() => {
    if (!open) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center overflow-hidden bg-black/60 px-4 pb-4 pt-6 backdrop-blur-sm sm:pt-10">
      <button
        aria-label="Close panel"
        className="absolute inset-0"
        onClick={onClose}
        type="button"
      />
      <div className="glass-panel edge-glow animate-float-up relative z-10 flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-[2rem] border border-white/10">
        <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-white/[0.15]" />
        <div className="relative shrink-0 px-4 pb-2 pt-5 sm:px-5 sm:pt-6">
          {title ? (
            <div className="mb-3 flex items-center justify-between gap-4 pr-10">
              <h3 className="font-display text-xl font-semibold text-white">
                {title}
              </h3>
            </div>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-4 top-4 inline-flex size-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-lg text-white/[0.8] hover:bg-white/10 sm:right-5 sm:top-5"
          >
            ×
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-5 sm:px-5 sm:pb-6">
          {children}
        </div>
      </div>
    </div>
  );
}
