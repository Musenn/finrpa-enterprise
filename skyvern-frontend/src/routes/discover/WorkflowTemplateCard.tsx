type Props = {
  title: string;
  image: string;
  onClick: () => void;
};

function WorkflowTemplateCard({ title, image, onClick }: Props) {
  return (
    <div className="glass-card h-52 w-full cursor-pointer overflow-hidden" onClick={onClick}>
      <div className="h-28 px-6 pt-6" style={{ background: "rgba(26,58,92,0.03)" }}>
        <img src={image} alt={title} className="h-full w-full object-contain" />
      </div>
      <div className="h-24 space-y-1 p-3">
        <h1
          className="line-clamp-2 overflow-hidden text-ellipsis"
          title={title}
          style={{ color: "var(--finrpa-text-primary)" }}
        >
          {title}
        </h1>
        <p className="text-sm" style={{ color: "var(--finrpa-text-muted)" }}>Template</p>
      </div>
    </div>
  );
}

export { WorkflowTemplateCard };
