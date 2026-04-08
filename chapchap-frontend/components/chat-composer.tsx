"use client";

import { ChangeEvent, useRef } from "react";
import { Attachment } from "@/lib/types";
import { MicIcon, PaperclipIcon, SendIcon } from "@/components/icons";

type ChatComposerProps = {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  // onScenarioQuickAction: (scenario: ConversationScenario) => void;
  onAttachmentAdd: (attachments: Attachment[]) => void;
  attachments: Attachment[];
};

export function ChatComposer({
  value,
  onChange,
  onSend,
  // onScenarioQuickAction,
  onAttachmentAdd,
  attachments,
}: ChatComposerProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleAttach = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    const nextAttachments =
      files.length > 0
        ? files.map((file, index) => ({
            id: `${file.name}-${index}`,
            alt: file.name.replace(/\.[^/.]+$/, ""),
            gradient:
              index % 2 === 0
                ? "from-violet-500/40 via-fuchsia-500/25 to-cyan-400/25"
                : "from-amber-300/30 via-orange-400/25 to-pink-500/30",
          }))
        : [];

    if (nextAttachments.length > 0) {
      onAttachmentAdd(nextAttachments);
    }

    event.target.value = "";
  };

  return (
    <div className="glass-panel edge-glow rounded-[2rem] border border-white/10 px-4 pb-4 pt-5">
      
      {attachments.length ? (
        <div className="mb-4 flex gap-2 overflow-x-auto no-scrollbar">
          {attachments.map((attachment) => (
            <div
              key={attachment.id}
              className={`h-16 min-w-24 rounded-2xl border border-white/[0.08] bg-gradient-to-br ${attachment.gradient} p-2 text-xs text-white/[0.8]`}
            >
              <div className="flex h-full items-end rounded-xl border border-white/10 bg-black/[0.15] p-2">
                {attachment.alt}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Send a message.."
        className="w-full bg-transparent text-base text-white outline-none placeholder:text-white/[0.28]"
      />

      <div className="mt-5 flex items-center justify-between">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex size-7 items-center justify-center rounded-full bg-accent text-white shadow-[0_8px_30px_rgba(118,87,246,0.4)]"
        >
          <PaperclipIcon className="size-4" />
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleAttach}
        />

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="flex size-7 items-center justify-center rounded-full bg-accent text-white shadow-[0_8px_30px_rgba(118,87,246,0.4)]"
          >
            <MicIcon className="size-4" />
          </button>
          <button
            type="button"
            onClick={onSend}
            className="flex size-7 items-center justify-center rounded-full bg-accent text-white shadow-[0_8px_30px_rgba(118,87,246,0.4)]"
          >
            <SendIcon className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
