import { Dashboard } from "@/components/dashboard";
import { getLatestCampaign, hasDatabase } from "@/lib/db";
import { listConnections } from "@/lib/integrations/repository";
import { listProjects } from "@/lib/projects";
import type { ConnectionSummary } from "@/lib/types";

export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  let connections: ConnectionSummary[] = [];
  let projects = [] as Awaited<ReturnType<typeof listProjects>>;
  let dataError: string | undefined;
  try {
    connections = await listConnections();
    if (hasDatabase()) projects = await listProjects();
  } catch (error) {
    dataError = "The database could not be loaded. Check DATABASE_URL and run the latest migration.";
    console.warn("Dashboard data failed", error instanceof Error ? error.message : "Unknown error");
  }
  const requestedProject = typeof params.project === "string" ? params.project : undefined;
  const selectedProject = projects.find((project) => project.id === requestedProject) ?? projects[0] ?? null;
  let campaign = null as Awaited<ReturnType<typeof getLatestCampaign>>;
  if (selectedProject) {
    try {
      campaign = await getLatestCampaign(selectedProject.id);
    } catch (error) {
      dataError = "Campaigns could not be loaded. Check that the latest database migration has been applied.";
      console.warn("Campaign loading failed", error instanceof Error ? error.message : "Unknown error");
    }
  }
  const provider = typeof params.provider === "string" ? params.provider : "provider";
  const outcome = typeof params.integration === "string" ? params.integration : undefined;
  const integrationError = typeof params.integration_error === "string" ? params.integration_error : undefined;
  const accounts = typeof params.accounts === "string" ? Number(params.accounts) : undefined;
  const providerIsAlreadyConnected = connections.some((connection) => connection.provider === provider && connection.connected);
  const message = dataError ?? (outcome === "connected"
    ? `${provider === "meta" ? "Meta" : provider} connected successfully${Number.isFinite(accounts) ? ` · ${accounts} publishing account${accounts === 1 ? "" : "s"} found` : ""}.`
    : outcome === "cancelled"
      ? "Authorization was cancelled. Nothing was connected."
      : outcome === "failed"
        ? providerIsAlreadyConnected
          ? undefined
          : `Could not connect ${provider}. Check its callback URL, app permissions, and server logs.`
        : integrationError === "not_configured"
          ? `${provider === "meta" ? "Meta" : provider} credentials are not configured yet.`
          : undefined);
  return (
    <Dashboard
      projects={projects}
      selectedProject={selectedProject}
      initialCampaign={campaign}
      connections={connections}
      initialView={params.view === "connections" ? "connections" : "overview"}
      initialNotice={message}
    />
  );
}
