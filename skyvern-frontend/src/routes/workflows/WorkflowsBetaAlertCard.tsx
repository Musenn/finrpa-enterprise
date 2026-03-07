import { Button } from "@/components/ui/button";

function WorkflowsBetaAlertCard() {
  return (
    <div className="flex flex-col items-center rounded-lg bg-slate-900 p-4 shadow">
      <header>
        <h1 className="py-4 text-3xl">Workflows (Beta)</h1>
      </header>
      <div>Workflows through UI are currently under construction.</div>
      <div>
        Today, you can create and run workflows through the API.
      </div>
      <div className="flex gap-4 py-4">
        <Button variant="secondary" asChild>
          <a
            href="https://github.com/Musenn/finrpa-enterprise"
            target="_blank"
            rel="noopener noreferrer"
          >
            View on GitHub
          </a>
        </Button>
      </div>
    </div>
  );
}

export { WorkflowsBetaAlertCard };
