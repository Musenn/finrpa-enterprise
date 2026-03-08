type Props = {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
};

function ExampleCasePill({ icon, label, onClick }: Props) {
  return (
    <div
      className="flex cursor-pointer gap-2 whitespace-normal border px-4 py-3 transition-colors lg:whitespace-nowrap"
      style={{
        background: "rgba(255,255,255,0.7)",
        borderColor: "var(--glass-border)",
        color: "var(--finrpa-text-primary)",
        borderRadius: "var(--radius-lg)",
        boxShadow: "var(--glass-shadow)",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.9)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.7)"; }}
      onClick={onClick}
    >
      <div style={{ color: "var(--finrpa-blue)" }}>{icon}</div>
      <div>{label}</div>
    </div>
  );
}

export { ExampleCasePill };
