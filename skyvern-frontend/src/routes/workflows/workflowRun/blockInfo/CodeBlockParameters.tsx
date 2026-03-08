import { CodeEditor } from "@/routes/workflows/components/CodeEditor";
import type { WorkflowParameter } from "@/routes/workflows/types/workflowTypes";

type Props = {
  code: string;
  parameters?: Array<WorkflowParameter>;
};

function CodeBlockParameters({ code, parameters }: Props) {
  return (
    <div className="space-y-4">
      <div className="flex gap-16">
        <div className="w-80">
          <h1 className="text-lg">Code</h1>
          <h2 className="text-base" style={{ color: "var(--finrpa-text-muted)" }}>
            The Python snippet executed for this block
          </h2>
        </div>
        <CodeEditor
          className="w-full"
          language="python"
          value={code}
          readOnly
          minHeight="160px"
          maxHeight="400px"
        />
      </div>
      {parameters && parameters.length > 0 ? (
        <div className="flex gap-16">
          <div className="w-80">
            <h1 className="text-lg">Parameters</h1>
            <h2 className="text-base" style={{ color: "var(--finrpa-text-muted)" }}>
              Inputs passed to this code block
            </h2>
          </div>
          <div className="flex w-full flex-col gap-3">
            {parameters.map((parameter) => (
              <div
                key={parameter.key}
                className="rounded border bg-slate-elevation3 p-3"
                style={{ borderColor: "var(--glass-border)" }}
              >
                <p className="font-medium">{parameter.key}</p>
                {parameter.description ? (
                  <p className="text-sm" style={{ color: "var(--finrpa-text-muted)" }}>
                    {parameter.description}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export { CodeBlockParameters };
