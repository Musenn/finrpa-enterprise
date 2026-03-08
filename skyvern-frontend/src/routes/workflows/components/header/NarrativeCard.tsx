type Props = {
  index: number;
  description: string;
};

function NarrativeCard({ index, description }: Props) {
  return (
    <div className="glass-card-static flex h-32 w-52 flex-col gap-3 p-4">
      <div className="flex size-6 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: "var(--finrpa-blue)" }}>
        {index}
      </div>
      <div className="text-sm" style={{ color: "var(--finrpa-text-secondary)" }}>{description}</div>
    </div>
  );
}

export { NarrativeCard };
