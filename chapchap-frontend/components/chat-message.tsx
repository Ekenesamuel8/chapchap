import { AssistantCard } from "@/components/assistant-card";
import { ChatMessageType } from "@/lib/types";

type ChatMessageProps = {
  message: ChatMessageType;
};

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";

  return (
    <div
      className={`animate-float-up flex ${
        isUser ? "justify-end" : "justify-start"
      }`}
    >
      <div className={`max-w-[92%] ${isUser ? "items-end" : "items-start"}`}>
        {message.attachments?.length ? (
          <div className="mb-3 grid grid-cols-2 gap-2">
            {message.attachments.map((attachment) => (
              <div
                key={attachment.id}
                className={`h-28 rounded-[1.35rem] border border-white/[0.08] bg-gradient-to-br ${attachment.gradient} p-3`}
              >
                <div className="flex h-full items-end rounded-[1rem] border border-white/10 bg-black/[0.15] p-2 text-xs text-white/[0.75]">
                  {attachment.alt}
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {message.text ? (
          <div
            className={`rounded-[1.5rem] px-2 py-1 sm:px-4 sm:py-3 text-[12px] leading-7 ${
              isUser
                ? "purple-ring bg-white/[0.08] text-white"
                : "glass-panel text-white/[0.78]"
            }`}
          >
            {message.text}
          </div>
        ) : null}

        {message.card ? (
          <div className="mt-3">
            <AssistantCard card={message.card} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
