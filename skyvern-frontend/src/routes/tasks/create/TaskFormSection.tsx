import { cn } from "@/util/utils";
import { useState } from "react";

type Props = {
  index: number;
  title: string;
  active: boolean;
  hasError?: boolean;
  onClick?: () => void;
  children?: React.ReactNode;
};

function TaskFormSection({
  index,
  title,
  active,
  onClick,
  children,
  hasError,
}: Props) {
  const [hovering, setHovering] = useState(false);

  return (
    <section className="space-y-8 rounded-lg px-6 py-5 glass-card-static">
      <header className="flex h-7 gap-4">
        <div
          className="flex h-7 cursor-pointer gap-4"
          onClick={() => onClick && onClick()}
          onMouseEnter={() => setHovering(true)}
          onMouseLeave={() => setHovering(false)}
          onMouseOver={() => setHovering(true)}
          onMouseOut={() => setHovering(false)}
        >
          <div
            className={cn(
              "flex w-7 items-center justify-center rounded-full border",
              {
                "border-destructive": !active && hasError,
              },
            )}
            style={{
              borderColor: (!active && hasError) ? undefined : "var(--glass-border)",
              ...(active || hovering ? { background: "var(--glass-border)", color: "var(--finrpa-text-primary)" } : {}),
            }}
          >
            <span style={{ color: "var(--finrpa-text-primary)" }}>{String(index)}</span>
          </div>
          <span
            className={cn("text-lg", {
              "text-destructive": !active && hasError,
            })}
          >
            {title}
          </span>
        </div>
      </header>
      {children}
    </section>
  );
}

export { TaskFormSection };
