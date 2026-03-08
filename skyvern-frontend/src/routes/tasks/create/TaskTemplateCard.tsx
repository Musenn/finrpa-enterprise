import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useState } from "react";

type Props = {
  title: string;
  description: string;
  body: string;
  onClick: () => void;
};

function TaskTemplateCard({ title, description, body, onClick }: Props) {
  const [hovering, setHovering] = useState(false);

  return (
    <Card
      className="overflow-hidden border-0"
      style={{
        borderRadius: "var(--radius-lg)",
        boxShadow: "var(--glass-shadow)",
      }}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onMouseOver={() => setHovering(true)}
      onMouseOut={() => setHovering(false)}
    >
      <CardHeader
        className="rounded-t-md"
        style={{ background: hovering ? "rgba(26,58,92,0.10)" : "var(--glass-bg)" }}
      >
        <CardTitle className="font-normal">{title}</CardTitle>
        <CardDescription className="overflow-hidden text-ellipsis whitespace-nowrap" style={{ color: "var(--finrpa-text-muted)" }}>
          {description}
        </CardDescription>
      </CardHeader>
      <CardContent
        className="h-36 cursor-pointer rounded-b-md p-4 text-sm"
        style={{
          color: "var(--finrpa-text-secondary)",
          background: hovering ? "rgba(26,58,92,0.10)" : "var(--glass-bg)",
        }}
        onClick={() => {
          onClick();
        }}
      >
        {body}
      </CardContent>
    </Card>
  );
}

export { TaskTemplateCard };
