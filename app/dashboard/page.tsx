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
  const userId = typeof claims.sub === "string" ? claims.sub : undefined;
  if (!userId) redirect("/login");
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
    if (hasDatabase()) projects = await listProjects(userId, name);
  } catch (error) {
    dataError = "The workspace database could not be reached. Check the Supabase database password and connection string.";
    console.warn("Dashboard data failed", error instanceof Error ? error.message : "Unknown error");
  }
  const requestedProject = typeof params.project === "string" ? params.project : undefined;
  const selectedProject = projects.find((project) => project.id === requestedProject) ?? projects[0] ?? null;
  try {
    connections = await listConnections(userId, selectedProject?.id);
  } catch (error) {
    dataError = "Social connections could not be loaded for this project.";
    console.warn("Connection loading failed", error instanceof Error ? error.message : "Unknown error");
  }
  let campaign = null as Awaited<ReturnType<typeof getLatestCampaign>>;
  if (selectedProject) {
    try {
      campaign = await getLatestCampaign(userId, selectedProject.id);
    } catch (error) {
      dataError = "Campaign data could not be loaded. Confirm that the current database schema has been applied.";
      console.warn("Campaign loading failed", error instanceof Error ? error.message : "Unknown error");
    }
  }
  const provider = typeof params.provider === "string" ? params.provider : "provider";
  const outcome = typeof params.integration === "string" ? params.integration : undefined;
  const integrationError = typeof params.integration_error === "string" ? params.integration_error : undefined;
  const accounts = typeof params.accounts === "string" ? Number(params.accounts) : undefined;
  const requestedSelectionId = typeof params.select_integration === "string" ? params.select_integration : undefined;
  const selectionConnection = connections.find((connection) => connection.id === requestedSelectionId);
  const needsDestinationSelection = Boolean(selectionConnection?.accounts.length);
  const selectionHasNoDestinations = Boolean(requestedSelectionId && !needsDestinationSelection);
  const providerIsAlreadyConnected = connections.some((connection) => connection.provider === provider && connection.connected);
  const providerName = provider === "meta" ? "Facebook" : provider;
  const message = dataError ?? (outcome === "connected"
    ? needsDestinationSelection
      ? `${providerName} connected successfully. Choose the Pages or profiles ProReach may publish to.`
      : selectionHasNoDestinations || accounts === 0
        ? `${providerName} sign-in succeeded, but no eligible publishing destinations were returned. Confirm that this account manages a Page or professional profile, then reconnect.`
        : `${providerName} connected successfully${Number.isFinite(accounts) ? ` · ${accounts} publishing account${accounts === 1 ? "" : "s"} found` : ""}.`
    : outcome === "cancelled"
      ? "Authorization was cancelled. Nothing was connected."
      : outcome === "failed"
        ? providerIsAlreadyConnected
          ? undefined
          : `Could not connect ${providerName}. Check its callback URL, app permissions, and server logs.`
        : integrationError === "not_configured"
          ? `${providerName} OAuth is not enabled in this ProReach deployment yet.`
          : undefined);
  return (
    <Dashboard
      key={selectedProject?.id ?? "no-project"}
      projects={projects}
      selectedProject={selectedProject}
      initialCampaign={campaign}
      connections={connections}
      initialView={params.view === "connections" ? "connections" : "overview"}
      initialNotice={message}
      initialSelectionId={needsDestinationSelection ? requestedSelectionId : undefined}
      authUser={{ name, email, initials }}
    />
  );
}
