import { PromptSuggestion } from "@/lib/types";

type PromptSuggestionsProps = {
  prompts: PromptSuggestion[];
  onSelect: (label: string) => void;
};

export function PromptSuggestions({
  prompts,
  onSelect,
}: PromptSuggestionsProps) {
  return (
    <div className="space-y-3">
      {prompts.map((prompt) => (
        <button
          key={prompt.id}
          onClick={() => onSelect(prompt.label)}
          type="button"
          className="group flex w-full items-center gap-4 rounded-2xl border border-transparent px-1 py-1 text-left hover:border-white/[0.08] hover:bg-white/[0.03]"
        >
          <span className="mt-0.5 size-1.5 rounded-full bg-accent-soft shadow-[0_0_20px_rgba(184,142,255,0.7)]" />
          <span className="flex-1 border-b border-dashed border-white/[0.18] pb-1 text-[12px] text-white/[0.62] transition group-hover:text-white/[0.82]">
            {prompt.label}
          </span>
        </button>
      ))}
    </div>
  );
}
