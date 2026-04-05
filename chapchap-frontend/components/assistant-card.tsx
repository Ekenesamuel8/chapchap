import { MessageCard } from "@/lib/types";

type AssistantCardProps = {
  card: MessageCard;
};

export function AssistantCard({ card }: AssistantCardProps) {
  if (card.type === "investment") {
    return (
      <div className="glass-panel edge-glow rounded-[1.75rem] border border-white/[0.08] p-5">
        <p className="font-display text-xl font-semibold text-white">
          {card.heading}
        </p>
        <p className="mt-3 text-base leading-8 text-white/[0.78]">{card.body}</p>
      </div>
    );
  }

  if (card.type === "product") {
    return (
      <div className="glass-panel edge-glow rounded-[1.75rem] border border-white/[0.08] p-5">
        <p className="font-display text-xl font-semibold text-white">
          {card.heading}
        </p>
        <p className="mt-2 text-sm leading-7 text-white/[0.7]">{card.summary}</p>
        <div className="mt-5 grid gap-3">
          {card.products.map((product) => (
            <div
              key={product.id}
              className={`rounded-[1.4rem] border border-white/10 bg-gradient-to-br ${product.accent} p-4`}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-semibold text-white">{product.name}</p>
                  <p className="mt-1 text-sm text-white/[0.72]">{product.vendor}</p>
                </div>
                <div className="text-right">
                  <p className="font-display text-md font-semibold text-white">
                    {product.price}
                  </p>
                  <p className="text-xs text-white/[0.72]">{product.eta}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="glass-panel edge-glow rounded-[1.75rem] border border-white/[0.08] p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-display text-xl font-semibold text-white">
            {card.heading}
          </p>
          <p className="mt-3 text-sm leading-7 text-white/[0.7]">{card.body}</p>
        </div>
        <span className="rounded-full bg-accent/20 px-3 py-1 text-xs font-semibold text-accent-soft">
          Secure step
        </span>
      </div>
      <div className="mt-4 rounded-2xl border border-accent-soft/20 bg-accent-soft/10 p-3 text-sm leading-6 text-white/[0.78]">
        {card.highlight}
      </div>
    </div>
  );
}
