import { Dashboard } from "@/components/dashboard";
import { getLatestCampaign, hasDatabase } from "@/lib/db";
import { listConnections } from "@/lib/integrations/repository";
import { listProjects } from "@/lib/projects";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import type { ConnectionSummary } from "@/lib/types";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Workspace",
  description: "Plan, review, schedule, and publish your product marketing campaigns.",
  robots: { index: false, follow: false },
};

export default async function DashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (!isSupabaseConfigured()) redirect("/login");
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getClaims();
  if (!authData?.claims) redirect("/login");

  const claims = authData.claims as Record<string, unknown>;
  const metadata = claims.user_metadata && typeof claims.user_metadata === "object"
    ? claims.user_metadata as Record<string, unknown>
    : {};
  const email = typeof claims.email === "string" ? claims.email : "Signed-in user";
  const name = typeof metadata.full_name === "string"
    ? metadata.full_name
    : typeof metadata.name === "string"
      ? metadata.name
      : email.split("@")[0];
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "PR";

  const params = await searchParams;
  let connections: ConnectionSummary[] = [];
  let projects = [] as Awaited<ReturnType<typeof listProjects>>;
  let dataError: string | undefined;
  try {
    connections = await listConnections();
    if (hasDatabase()) projects = await listProjects();
  } catch (error) {
    dataError = "The workspace database could not be reached. Check the Supabase database password and connection string.";
    console.warn("Dashboard data failed", error instanceof Error ? error.message : "Unknown error");
  }
  const requestedProject = typeof params.project === "string" ? params.project : undefined;
  const selectedProject = projects.find((project) => project.id === requestedProject) ?? projects[0] ?? null;
  let campaign = null as Awaited<ReturnType<typeof getLatestCampaign>>;
  if (selectedProject) {
    try {
      campaign = await getLatestCampaign(selectedProject.id);
    } catch (error) {
      dataError = "Campaign data could not be loaded. Confirm that the current database schema has been applied.";
      console.warn("Campaign loading failed", error instanceof Error ? error.message : "Unknown error");
    }
  }
  const provider = typeof params.provider === "string" ? params.provider : "provider";
  const outcome = typeof params.integration === "string" ? params.integration : undefined;
  const integrationError = typeof params.integration_error === "string" ? params.integration_error : undefined;
  const accounts = typeof params.accounts === "string" ? Number(params.accounts) : undefined;
  const needsDestinationSelection = typeof params.select_integration === "string";
  const providerIsAlreadyConnected = connections.some((connection) => connection.provider === provider && connection.connected);
  const message = dataError ?? (outcome === "connected"
    ? needsDestinationSelection
      ? `${provider === "meta" ? "Meta" : provider} connected successfully. Choose the Pages or profiles ProReach may publish to.`
      : `${provider === "meta" ? "Meta" : provider} connected successfully${Number.isFinite(accounts) ? ` · ${accounts} publishing account${accounts === 1 ? "" : "s"} found` : ""}.`
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
      initialSelectionId={typeof params.select_integration === "string" ? params.select_integration : undefined}
      authUser={{ name, email, initials }}
    />
  );
}
