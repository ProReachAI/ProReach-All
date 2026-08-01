"use client";

import {
  AlertTriangle, ArrowUpRight, BarChart3, CalendarDays, Check, ChevronDown,
  CircleGauge, Clock3, Compass, FileText, ImagePlus, LayoutGrid, LoaderCircle, Menu,
  Package, PenLine, Plus, Radio, Send, Settings, ShieldCheck, Sparkles, Target, TrendingUp, X, Zap, LogOut,
} from "lucide-react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useMemo, useState } from "react";
import type { IconType } from "react-icons";
import { FaLinkedinIn } from "react-icons/fa6";
import { SiFacebook, SiInstagram, SiMeta, SiThreads, SiX } from "react-icons/si";
import { CampaignComposer } from "@/components/campaign-composer";
import { ProReachLogo } from "@/components/proreach-logo";
import { ProjectSetup } from "@/components/project-setup";
import { activePublishingDestinations, destinationsForPlatform, publishingReadiness } from "@/lib/integrations/publishing";
import { platformLabel, type Campaign, type ConnectionSummary, type MediaType, type Platform, type ProductProject, type SocialPost } from "@/lib/types";
import { cn, formatSchedule } from "@/lib/utils";

const platformIcon: Record<Platform, IconType> = {
  facebook: SiFacebook, instagram: SiInstagram, threads: SiThreads, x: SiX, linkedin: FaLinkedinIn,
};

const providerIcon = {
  meta: SiMeta, instagram: SiInstagram, threads: SiThreads, x: SiX, linkedin: FaLinkedinIn,
} satisfies Record<ConnectionSummary["provider"], IconType>;

const statusLabel: Record<SocialPost["status"], string> = {
  draft: "Draft", review: "Needs review", approved: "Approved", scheduled: "Scheduled",
  publishing: "Publishing", published: "Published", failed: "Failed",
};

function oauthConnectionHref(provider: ConnectionSummary["provider"], projectId: string) {
  const query = new URLSearchParams({ project: projectId });
  return `/api/oauth/${provider}?${query}`;
}

type View = "overview" | "drafts" | "calendar" | "performance" | "connections" | "growth";

const viewLabel: Record<View, string> = {
  overview: "Overview",
  drafts: "Draft studio",
  calendar: "Content calendar",
  performance: "Performance",
  connections: "Connections",
  growth: "Growth plan",
};

type Props = {
  projects: ProductProject[];
  selectedProject: ProductProject | null;
  initialCampaign: Campaign | null;
  connections: ConnectionSummary[];
  initialView?: "overview" | "connections";
  initialNotice?: string;
  initialSelectionId?: string;
  authUser: { name: string; email: string; initials: string };
};

export function Dashboard({ projects, selectedProject, initialCampaign, connections: initialConnections, initialView = "overview", initialNotice, initialSelectionId, authUser }: Props) {
  const router = useRouter();
  const [campaign, setCampaign] = useState(initialCampaign);
  const [connections, setConnections] = useState(initialConnections);
  const [active, setActive] = useState<View>(initialView);
  const [projectSetupOpen, setProjectSetupOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<ProductProject | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [notice, setNotice] = useState<string | null>(initialNotice ?? null);
  const [imageBusy, setImageBusy] = useState<string | null>(null);
  const [publishDecision, setPublishDecision] = useState<SocialPost | null>(null);
  const [publishBusy, setPublishBusy] = useState<"now" | "schedule" | null>(null);
  const [scheduleAt, setScheduleAt] = useState("");
  const [selectedDestinationId, setSelectedDestinationId] = useState("");
  const [publishedLink, setPublishedLink] = useState<string | null>(null);
  const [editingPost, setEditingPost] = useState<SocialPost | null>(null);
  const [editBusy, setEditBusy] = useState(false);
  const [variantBusy, setVariantBusy] = useState<string | null>(null);

  const posts = campaign?.posts ?? [];
  const scheduled = posts.filter((post) => post.status === "scheduled");
  const review = posts.filter((post) => post.status === "review" || post.status === "draft" || post.status === "approved" || post.status === "failed");
  const published = posts.filter((post) => post.status === "published");

  async function approvePost(id: string) {
    try {
      const response = await fetch(`/api/posts/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "approve" }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Approval failed.");
      let approved: SocialPost | undefined;
      setCampaign((current) => current ? ({ ...current, posts: current.posts.map((post) => {
        if (post.id !== id) return post;
        approved = { ...post, status: "approved" };
        return approved;
      }) }) : current);
      const source = approved ?? posts.find((post) => post.id === id);
      if (source) openPublishing({ ...source, status: "approved" });
      setNotice("Post approved. Choose Post now or schedule it.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Approval failed.");
    }
  }

  function openPublishing(post: SocialPost) {
    const suggested = post.scheduledFor ? new Date(post.scheduledFor) : new Date(Date.now() + 60 * 60 * 1000);
    if (suggested.getTime() <= Date.now()) suggested.setTime(Date.now() + 60 * 60 * 1000);
    const offset = suggested.getTimezoneOffset() * 60_000;
    setScheduleAt(new Date(suggested.getTime() - offset).toISOString().slice(0, 16));
    const destinations = connections.filter((connection) => connection.connected).flatMap((connection) => connection.accounts).filter((account) => account.enabled !== false && account.platform === post.platform);
    setSelectedDestinationId(destinations.length === 1 ? destinations[0].id : "");
    setPublishDecision(post);
  }

  async function schedulePost() {
    if (!publishDecision || !scheduleAt || !selectedDestinationId) return;
    setPublishBusy("schedule"); setNotice(null);
    try {
      const scheduledFor = new Date(scheduleAt).toISOString();
      const response = await fetch(`/api/posts/${publishDecision.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "schedule", scheduledFor, socialAccountId: selectedDestinationId }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Scheduling failed.");
      setCampaign((current) => current ? ({ ...current, posts: current.posts.map((post) => post.id === publishDecision.id ? { ...post, status: "scheduled", scheduledFor: payload.scheduledFor, socialAccountId: selectedDestinationId } : post) }) : current);
      setPublishDecision(null);
      setNotice(`Post scheduled for ${formatSchedule(payload.scheduledFor)}.`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Scheduling failed."); }
    finally { setPublishBusy(null); }
  }

  async function postNow() {
    if (!publishDecision || !selectedDestinationId) return;
    setPublishBusy("now"); setNotice(null);
    try {
      const response = await fetch(`/api/posts/${publishDecision.id}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ socialAccountId: selectedDestinationId }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Publishing failed.");
      setCampaign((current) => current ? ({ ...current, posts: current.posts.map((post) => post.id === publishDecision.id ? { ...post, status: "published", remotePostId: payload.remotePostId, remotePostUrl: payload.remotePostUrl } : post) }) : current);
      setPublishDecision(null);
      const destinationKind = payload.destination?.type === "organization" ? "company Page" : "personal profile";
      setPublishedLink(payload.remotePostUrl ?? null);
      setNotice(`Published successfully to ${payload.destination?.displayName ?? platformLabel[publishDecision.platform]} (${destinationKind}).`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Publishing failed.");
    } finally { setPublishBusy(null); }
  }

  async function savePostCopy(content: Pick<SocialPost, "hook" | "body" | "cta" | "hashtags">) {
    if (!editingPost) return;
    setEditBusy(true); setNotice(null);
    try {
      const response = await fetch(`/api/posts/${editingPost.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update", ...content }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Post update failed.");
      const updated = { ...content, hashtags: payload.hashtags as string[] };
      setCampaign((current) => current ? ({
        ...current,
        posts: current.posts.map((post) => post.id === editingPost.id ? { ...post, ...updated } : post),
      }) : current);
      setPublishDecision((current) => current?.id === editingPost.id ? { ...current, ...updated } : current);
      setEditingPost(null);
      setNotice("Description, CTA, and hashtags saved.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Post update failed.");
    } finally { setEditBusy(false); }
  }

  async function generatePostImage(id: string, mediaType: MediaType) {
    setImageBusy(id); setNotice(null);
    try {
      const response = await fetch(`/api/posts/${id}/media`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mediaType }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Image generation failed.");
      setCampaign((current) => current ? ({
        ...current,
        posts: current.posts.map((post) => post.id === id ? {
          ...post, mediaType: payload.mediaType, mediaUrl: payload.mediaUrl, mediaItems: payload.mediaItems ?? [],
        } : post),
      }) : current);
      setNotice(payload.warning ?? (payload.provider === "cloudflare-flux-2-klein-4b"
        ? "Premium AI scene generated, branded accurately, and saved to R2."
        : "Accurate branded visual rendered and saved to R2."));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Image generation failed.");
    } finally {
      setImageBusy(null);
    }
  }

  async function createVariant(source: SocialPost, platform: Platform) {
    const key = `${source.id}:${platform}`;
    setVariantBusy(key); setNotice(null);
    try {
      const response = await fetch(`/api/posts/${source.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create_variant", platform }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Could not create the platform version.");
      const variant = payload.post as SocialPost;
      setCampaign((current) => current ? ({ ...current, posts: [...current.posts, variant] }) : current);
      setActive("drafts");
      setNotice(`${platformLabel[platform]} version created. Review it, generate media if needed, then approve it to publish.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not create the platform version.");
    } finally {
      setVariantBusy(null);
    }
  }

  function chooseProject(id: string) {
    router.push(`/dashboard?project=${encodeURIComponent(id)}`);
  }

  function savedProject(project: ProductProject) {
    setProjectSetupOpen(false); setEditingProject(null);
    setNotice(`Product context saved for ${project.name}.`);
    router.push(`/dashboard?project=${encodeURIComponent(project.id)}`);
    router.refresh();
  }

  return (
    <div className="app-shell">
      <aside className={cn("sidebar", mobileNav && "sidebar-open")}>
        <div className="brand-row">
          <ProReachLogo size={36} />
          <button className="mobile-close" onClick={() => setMobileNav(false)} aria-label="Close navigation"><X size={19} /></button>
        </div>
        <nav className="primary-nav" aria-label="Main navigation">
          <NavButton icon={LayoutGrid} label="Overview" active={active === "overview"} onClick={() => setActive("overview")} />
          <NavButton icon={PenLine} label="Draft studio" active={active === "drafts"} onClick={() => setActive("drafts")} count={review.length} />
          <NavButton icon={CalendarDays} label="Content calendar" active={active === "calendar"} onClick={() => setActive("calendar")} count={scheduled.length} />
          <NavButton icon={CircleGauge} label="Performance" active={active === "performance"} onClick={() => setActive("performance")} />
          <NavButton icon={Radio} label="Connections" active={active === "connections"} onClick={() => setActive("connections")} />
        </nav>
        <div className="sidebar-spacer" />
        <div className="autopilot-card"><div className="autopilot-title"><Zap size={15} fill="currentColor" /> Approval mode</div><p>ProReach drafts and schedules. You keep the final say.</p><div className="safety-row"><span className="pulse-dot" /> Safe mode active</div></div>
        <nav className="secondary-nav"><NavButton icon={Compass} label="Growth plan" active={active === "growth"} onClick={() => setActive("growth")} /><NavButton icon={Settings} label="Product context" onClick={() => selectedProject && setEditingProject(selectedProject)} /></nav>
        <div className="profile-row">
          <div className="avatar">{authUser.initials}</div>
          <div><strong>{authUser.name}</strong><small>{authUser.email}</small></div>
          <form action="/auth/signout" method="post">
            <button className="profile-signout" type="submit" aria-label="Sign out" title="Sign out"><LogOut size={16} /></button>
          </form>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="topbar-left">
            <button className="mobile-menu" onClick={() => setMobileNav(true)} aria-label="Open navigation"><Menu size={21} /></button>
            <div className="workspace-route"><span>Workspace</span><strong>{viewLabel[active]}</strong></div>
            <div className="project-switcher">
              <Package size={15} />
              {projects.length > 0 ? <label><span>Active project</span><select aria-label="Select project" value={selectedProject?.id ?? ""} onChange={(event) => chooseProject(event.target.value)}>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select><ChevronDown size={14} /></label> : <strong>No project yet</strong>}
            </div>
          </div>
          <div className="topbar-actions">
            <button className="ghost-button new-project-button" onClick={() => { setEditingProject(null); setProjectSetupOpen(true); }}><Plus size={15} /> New project</button>
            {selectedProject && <button className="primary-button" onClick={() => setComposerOpen(true)}><Sparkles size={16} /> Generate campaign</button>}
          </div>
        </header>

        {active === "connections" ? <ConnectionsView project={selectedProject} connections={connections} initialSelectionId={initialSelectionId} onConnectionsChange={setConnections} /> : !selectedProject ? <NoProject onCreate={() => setProjectSetupOpen(true)} /> : active === "performance" ? <PerformanceView posts={posts} /> : active === "growth" ? <GrowthPlanView project={selectedProject} campaign={campaign} onEdit={() => setEditingProject(selectedProject)} onGenerate={() => setComposerOpen(true)} /> : active === "calendar" ? <CalendarView posts={posts} connections={connections} onApprove={approvePost} onPublish={openPublishing} onEditPost={setEditingPost} onGenerateImage={generatePostImage} imageBusy={imageBusy} onCreateVariant={createVariant} variantBusy={variantBusy} onGenerate={() => setComposerOpen(true)} /> : active === "drafts" ? <DraftStudio posts={review} connections={connections} onApprove={approvePost} onPublish={openPublishing} onEditPost={setEditingPost} onGenerateImage={generatePostImage} imageBusy={imageBusy} onCreateVariant={createVariant} variantBusy={variantBusy} onGenerate={() => setComposerOpen(true)} onConnections={() => setActive("connections")} /> : campaign ? <Overview project={selectedProject} campaign={campaign} connections={connections} review={review} scheduled={scheduled} published={published} onApprove={approvePost} onPublish={openPublishing} onEditPost={setEditingPost} onGenerateImage={generatePostImage} imageBusy={imageBusy} onGenerate={() => setComposerOpen(true)} onEdit={() => setEditingProject(selectedProject)} onConnections={() => setActive("connections")} /> : <ProjectReady project={selectedProject} onGenerate={() => setComposerOpen(true)} onEdit={() => setEditingProject(selectedProject)} />}
      </main>

      {(projectSetupOpen || editingProject) && <ProjectSetup project={editingProject} onClose={() => { setProjectSetupOpen(false); setEditingProject(null); }} onSaved={savedProject} />}
      {composerOpen && selectedProject && <CampaignComposer project={selectedProject} connections={connections} onClose={() => setComposerOpen(false)} onCreated={(created) => { setCampaign(created); setComposerOpen(false); setActive("drafts"); setNotice("Campaign generated from the saved product context. Review every draft before approval."); }} />}
      {editingPost && <EditPostModal post={editingPost} busy={editBusy} onClose={() => !editBusy && setEditingPost(null)} onSave={savePostCopy} />}
      {publishDecision && <PublishDecisionModal post={publishDecision} connections={connections} scheduleAt={scheduleAt} onScheduleAt={setScheduleAt} selectedDestinationId={selectedDestinationId} onDestination={setSelectedDestinationId} busy={publishBusy} onClose={() => !publishBusy && setPublishDecision(null)} onSchedule={schedulePost} onPostNow={postNow} onConnections={() => { setPublishDecision(null); setActive("connections"); }} />}
      {notice && <div className="toast"><Check size={17} /><span>{notice}{publishedLink && <> <a href={publishedLink} target="_blank" rel="noreferrer">View published post</a></>}</span><button onClick={() => { setNotice(null); setPublishedLink(null); }} aria-label="Dismiss notification"><X size={15} /></button></div>}
    </div>
  );
}

function NavButton({ icon: Icon, label, active, onClick, count }: { icon: typeof LayoutGrid; label: string; active?: boolean; onClick?: () => void; count?: number }) {
  return <button className={cn("nav-button", active && "active")} onClick={onClick}><i className="nav-icon"><Icon size={17} strokeWidth={1.9} /></i><span>{label}</span>{count ? <em>{count}</em> : null}</button>;
}

function NoProject({ onCreate }: { onCreate: () => void }) {
  return <div className="onboarding-empty">
    <div className="onboarding-ambient onboarding-ambient-one" />
    <div className="onboarding-ambient onboarding-ambient-two" />
    <section className="onboarding-stage">
      <div className="empty-orbit"><Package size={30} /></div>
      <span className="eyebrow">START WITH PRODUCT TRUTH</span>
      <h1>Build a campaign people <em>remember.</em></h1>
      <p>Teach ProReach your product, audience, proof, and voice once. Then turn every idea into a coordinated, on-brand campaign across every connected channel.</p>
      <button className="primary-button" onClick={onCreate}><Plus size={16} /> Create your first project</button>
      <div className="empty-principles"><span><strong>01</strong> Product facts</span><span><strong>02</strong> Audience context</span><span><strong>03</strong> Voice guardrails</span></div>
    </section>
    <aside className="onboarding-float onboarding-float-left"><span><Target size={17} /></span><div><small>PRODUCT-AWARE</small><strong>Grounded in your truth</strong></div></aside>
    <aside className="onboarding-float onboarding-float-right"><span><Sparkles size={17} /></span><div><small>CAMPAIGN READY</small><strong>Every channel, coordinated</strong></div></aside>
  </div>;
}

function ProjectReady({ project, onGenerate, onEdit }: { project: ProductProject; onGenerate: () => void; onEdit: () => void }) {
  return <div className="page-wrap project-ready"><span className="eyebrow">{project.name.toUpperCase()} · CONTEXT READY</span><h1>The product truth is saved.<br /><em>Now give this week a job.</em></h1><p>{project.oneLiner}</p><div className="context-preview"><ContextBlock label="Audience" value={project.targetAudience} /><ContextBlock label="Problem" value={project.problemStatement} /><ContextBlock label="Difference" value={project.differentiators} /></div><div className="ready-actions"><button className="primary-button" onClick={onGenerate}><Sparkles size={16} /> Generate first campaign</button><button className="ghost-button" onClick={onEdit}><Settings size={15} /> Review product context</button></div></div>;
}

function PerformanceView({ posts }: { posts: SocialPost[] }) {
  const published = posts.filter((post) => post.status === "published");
  const scheduled = posts.filter((post) => post.status === "scheduled");
  const failed = posts.filter((post) => post.status === "failed");
  const deliveryTotal = published.length + failed.length;
  const deliveryRate = deliveryTotal ? Math.round((published.length / deliveryTotal) * 100) : 0;
  const distribution = [...new Set(posts.map((post) => post.platform))].map((platform) => ({
    platform,
    total: posts.filter((post) => post.platform === platform).length,
    published: published.filter((post) => post.platform === platform).length,
  }));
  return <div className="page-wrap subpage performance-page">
    <span className="eyebrow">PERFORMANCE</span><h1>Signal, without vanity.</h1><p className="page-lead">A truthful view of what ProReach has prepared, scheduled, and successfully delivered. Audience analytics will appear only when providers return verified data.</p>
    <section className="performance-summary">
      <article className="performance-hero-card"><span><TrendingUp size={18} /> DELIVERY HEALTH</span><strong>{deliveryRate}%</strong><p>{deliveryTotal ? `${published.length} of ${deliveryTotal} publishing attempts completed successfully.` : "Publish your first approved post to establish a delivery baseline."}</p><i style={{ "--delivery": `${deliveryRate}%` } as React.CSSProperties} /></article>
      <article><span>Published</span><strong>{published.length}</strong><small>Live destinations</small></article>
      <article><span>Scheduled</span><strong>{scheduled.length}</strong><small>In the queue</small></article>
      <article><span>Platforms</span><strong>{distribution.length}</strong><small>With campaign drafts</small></article>
    </section>
    <section className="performance-grid">
      <div className="panel platform-performance"><div className="panel-heading"><div><span className="eyebrow">CHANNEL OUTPUT</span><h2>Where the campaign is moving</h2></div><BarChart3 size={20} /></div>
        <div className="platform-performance-list">{distribution.map(({ platform, total, published: live }) => { const Icon = platformIcon[platform]; const width = posts.length ? Math.max(8, Math.round((total / posts.length) * 100)) : 0; return <div key={platform}><span className={cn("platform-icon", platform)}><Icon size={14} /></span><p><strong>{platformLabel[platform]}</strong><small>{live} published · {total} total</small></p><i><b style={{ width: `${width}%` }} /></i><em>{total}</em></div>; })}{distribution.length === 0 && <PanelEmpty title="No channel signal yet" copy="Generate a campaign to begin tracking real publishing activity." />}</div>
      </div>
      <aside className="panel performance-note"><span><Sparkles size={17} /></span><h2>Honest metrics only.</h2><p>ProReach never invents impressions, clicks, or engagement. This page starts with operational truth and is ready for verified provider analytics as those permissions are connected.</p><div><Check size={14} /> No estimated reach</div><div><Check size={14} /> No fabricated engagement</div><div><Check size={14} /> Delivery status from real posts</div></aside>
    </section>
  </div>;
}

function GrowthPlanView({ project, campaign, onEdit, onGenerate }: { project: ProductProject; campaign: Campaign | null; onEdit: () => void; onGenerate: () => void }) {
  const contextFields = [project.description, project.targetAudience, project.problemStatement, project.differentiators, project.proofPoints, project.brandVoice, project.primaryGoal, project.primaryCta];
  const contextScore = Math.round((contextFields.filter((value) => value.trim().length > 0).length / contextFields.length) * 100);
  return <div className="page-wrap subpage growth-page">
    <span className="eyebrow">GROWTH PLAN · {project.name.toUpperCase()}</span><h1>Turn product truth into momentum.</h1><p className="page-lead">A focused plan built from the context you have already approved—not generic growth advice.</p>
    <section className="growth-hero">
      <div><span>PRIMARY OUTCOME</span><h2>{project.primaryGoal}</h2><p>{project.oneLiner}</p><button className="primary-button" onClick={onGenerate}><Sparkles size={15} /> {campaign ? "Create next campaign" : "Create first campaign"}</button></div>
      <aside><span>Context readiness</span><strong>{contextScore}%</strong><div><i style={{ width: `${contextScore}%` }} /></div><small>Audience, proof, positioning, voice, goal, and CTA are grounded.</small><button className="text-button" onClick={onEdit}>Review source of truth <ArrowUpRight size={14} /></button></aside>
    </section>
    <section className="growth-steps">
      <article><span>01</span><div><Target size={19} /><small>FOCUS</small><h3>Own the problem</h3><p>{project.problemStatement}</p></div></article>
      <article><span>02</span><div><Compass size={19} /><small>POSITION</small><h3>Make the difference clear</h3><p>{project.differentiators}</p></div></article>
      <article><span>03</span><div><Sparkles size={19} /><small>PROVE</small><h3>Earn the next step</h3><p>{project.proofPoints}</p></div></article>
    </section>
    <section className="panel growth-voice"><div><span className="eyebrow">MESSAGE GUARDRAIL</span><h2>Sound unmistakably like {project.name}.</h2></div><blockquote>{project.brandVoice}</blockquote><div><span>Default CTA</span><strong>{project.primaryCta}</strong></div></section>
  </div>;
}

function Overview({ project, campaign, connections, review, scheduled, published, onApprove, onPublish, onEditPost, onGenerateImage, imageBusy, onGenerate, onEdit, onConnections }: {
  project: ProductProject; campaign: Campaign; connections: ConnectionSummary[]; review: SocialPost[]; scheduled: SocialPost[]; published: SocialPost[]; onApprove: (id: string) => void; onPublish: (post: SocialPost) => void; onEditPost: (post: SocialPost) => void; onGenerateImage: (id: string, mediaType: MediaType) => void; imageBusy: string | null; onGenerate: () => void; onEdit: () => void; onConnections: () => void;
}) {
  const connectedDestinations = new Set(connections.flatMap((connection) => connection.accounts.filter((account) => account.enabled !== false).map((account) => account.platform))).size;
  const totalPosts = campaign.posts.length;
  const movedForward = scheduled.length + published.length;
  const progress = totalPosts ? Math.round((movedForward / totalPosts) * 100) : 0;
  const nextDraft = review[0];
  const NextIcon = nextDraft ? platformIcon[nextDraft.platform] : Sparkles;
  return <div className="page-wrap overview-dashboard">
    <section className="overview-welcome">
      <div><span className="eyebrow">{project.name.toUpperCase()} · COMMAND CENTER</span><h1>Good to see you.<br /><em>Let&apos;s move the story forward.</em></h1><p>{campaign.name} is active. Focus on the next meaningful decision instead of another blank prompt.</p></div>
      <div className="overview-header-actions"><button className="overview-context-action" onClick={onEdit}><Settings size={15} /><span><small>SOURCE OF TRUTH</small><strong>{project.name}</strong></span></button><button className="primary-button" onClick={onGenerate}><Sparkles size={15} /> New campaign</button></div>
    </section>

    <section className="overview-command-grid">
      <article className="campaign-pulse-card">
        <header><span><i /> ACTIVE CAMPAIGN</span><em>{totalPosts} platform drafts</em></header>
        <div className="campaign-pulse-copy"><span>{campaign.name}</span><h2>{campaign.thesis}</h2></div>
        <div className="campaign-progress-area">
          <div className="campaign-progress-ring" style={{ "--campaign-progress": `${progress * 3.6}deg` } as React.CSSProperties}><div><strong>{progress}%</strong><small>moved forward</small></div></div>
          <div className="campaign-stage-list"><div><i className="review" /><span><strong>{review.length}</strong><small>Needs your eye</small></span></div><div><i className="scheduled" /><span><strong>{scheduled.length}</strong><small>Scheduled</small></span></div><div><i className="published" /><span><strong>{published.length}</strong><small>Published</small></span></div></div>
        </div>
        <footer><span><Target size={14} /> Grounded in {project.name}&apos;s product context</span><button onClick={onEdit}>View context <ArrowUpRight size={13} /></button></footer>
      </article>

      <aside className="next-action-card">
        <header><span>NEXT BEST ACTION</span><i><Sparkles size={14} /></i></header>
        {nextDraft ? <><div className={cn("next-action-platform",nextDraft.platform)}><NextIcon size={18} /><span>{platformLabel[nextDraft.platform]} · {statusLabel[nextDraft.status]}</span></div><h2>{nextDraft.hook}</h2><p>{nextDraft.body}</p><div className="next-action-meta"><span>{nextDraft.pillar}</span><span>{nextDraft.mediaType}</span></div><footer><button className="ghost-button" onClick={() => onEditPost(nextDraft)}>Open draft</button>{["review","draft"].includes(nextDraft.status) ? <button className="primary-button" onClick={() => onApprove(nextDraft.id)}><Check size={14} /> Approve</button> : <button className="primary-button" onClick={() => onPublish(nextDraft)}><Send size={14} /> Publish options</button>}</footer></> : <><div className="next-action-clear"><Check size={22} /></div><h2>Your review queue is clear.</h2><p>Everything in this campaign has moved forward. Start the next campaign when the product story has a new job to do.</p><footer><button className="primary-button" onClick={onGenerate}><Sparkles size={14} /> Create campaign</button></footer></>}
      </aside>
    </section>

    <section className="overview-stat-row">
      <article><span className="overview-stat-icon violet"><Sparkles size={17} /></span><div><small>READY TO REVIEW</small><strong>{review.length}</strong></div><em>{review.length ? "Your attention" : "All clear"}</em></article>
      <article><span className="overview-stat-icon cyan"><Clock3 size={17} /></span><div><small>IN THE QUEUE</small><strong>{scheduled.length}</strong></div><em>Scheduled posts</em></article>
      <article><span className="overview-stat-icon coral"><Send size={17} /></span><div><small>SHIPPED</small><strong>{published.length}</strong></div><em>This campaign</em></article>
      <article><span className="overview-stat-icon lime"><Radio size={17} /></span><div><small>DESTINATIONS</small><strong>{connectedDestinations}</strong></div><em>Ready to publish</em></article>
    </section>

    <section className="overview-workbench">
      <div className="panel overview-review-panel"><div className="panel-heading"><div><span className="eyebrow">REVIEW WORKBENCH</span><h2>Make the message unmistakably yours</h2></div><span className="overview-queue-count">{review.length} open</span></div><div className="post-list">{review.slice(0,3).map((post) => <PostRow key={post.id} post={post} onApprove={onApprove} onPublish={onPublish} onEdit={onEditPost} onGenerateImage={onGenerateImage} generatingImage={imageBusy === post.id} />)}</div>{review.length === 0 && <PanelEmpty title="Nothing waiting for review" copy="Your active campaign is moving. Create another when you have a timely objective." action="Generate campaign" onAction={onGenerate} />}</div>
      <aside className="overview-side-stack">
        <section className="panel overview-schedule-panel"><div className="panel-heading compact"><div><span className="eyebrow">PUBLISHING PULSE</span><h2>Coming up next</h2></div><Clock3 size={18} /></div><Timeline posts={scheduled} /></section>
        <section className="panel overview-channel-panel"><header><div><span className="eyebrow">CHANNEL HEALTH</span><h2>Your distribution desk</h2></div><button onClick={onConnections}>Manage <ArrowUpRight size={13} /></button></header><div>{connections.map((connection) => { const Icon = providerIcon[connection.provider]; return <span key={connection.provider} className={cn(connection.connected && "connected")}><i><Icon size={15} /></i><strong>{connection.label}</strong><em>{connection.connected ? "Ready" : "Connect"}</em></span>; })}</div></section>
      </aside>
    </section>

    <section className="overview-context-ribbon"><div><span><Target size={17} /></span><p><small>PRODUCT SIGNAL</small><strong>{project.oneLiner}</strong></p></div><div className="context-tags">{project.keyFeatures.slice(0,4).map((feature) => <span key={feature}>{feature}</span>)}</div><button onClick={onEdit}>Keep context sharp <ArrowUpRight size={14} /></button></section>
  </div>;
}

function ContextBlock({ label, value }: { label: string; value: string }) {
  return <article><span>{label}</span><p>{value}</p></article>;
}

function PanelEmpty({ title, copy, action, onAction }: { title: string; copy: string; action?: string; onAction?: () => void }) {
  return <div className="empty-state"><FileText size={22} /><strong>{title}</strong><span>{copy}</span>{action && onAction && <button className="text-button" onClick={onAction}>{action} <ArrowUpRight size={14} /></button>}</div>;
}

function PostRow({ post, connections = [], onApprove, onPublish, onEdit, onGenerateImage, generatingImage = false, onCreateVariant, variantBusy }: {
  post: SocialPost;
  connections?: ConnectionSummary[];
  onApprove: (id: string) => void;
  onPublish?: (post: SocialPost) => void;
  onEdit: (post: SocialPost) => void;
  onGenerateImage?: (id: string, mediaType: MediaType) => void;
  generatingImage?: boolean;
  onCreateVariant?: (post: SocialPost, platform: Platform) => void;
  variantBusy?: string | null;
}) {
  const Icon = platformIcon[post.platform];
  const canApprove = post.status === "review" || post.status === "draft";
  const canGenerateImage = !["publishing", "published", "failed"].includes(post.status);
  const mediaLabel: Record<MediaType, string> = { image: "Image", carousel: "Carousel", motion: "Motion clip" };
  const canChoosePublish = (post.status === "approved" || post.status === "scheduled" || post.status === "failed") && onPublish;
  const canEdit = !["publishing", "published"].includes(post.status);
  const readiness = publishingReadiness(post, connections);
  const activeDestinations = activePublishingDestinations(connections);
  const alternativePlatforms = [...new Set(activeDestinations.map((account) => account.platform))].filter((platform) => platform !== post.platform);
  const target = readiness.destinations[0];
  return <article className="post-row">
    <div className={cn("platform-icon large", post.platform)}><Icon size={18} /></div>
    <div className="post-copy">
      <div><span className={cn("status-pill", post.status)}>{statusLabel[post.status]}</span><small>{post.pillar}</small><span className={cn("media-kind", post.mediaType)}>{mediaLabel[post.mediaType]}</span></div>
      <h3>{post.hook}</h3><p>{post.body}</p>{post.hashtags.length > 0 && <div className="post-hashtags">{post.hashtags.map((hashtag) => <span key={hashtag}>{hashtag}</span>)}</div>}<MediaPreview post={post} />
      <span className="schedule"><Clock3 size={13} /> {formatSchedule(post.scheduledFor)}</span>
      {post.status === "scheduled" && post.destinationName && <span className="published-destination"><Clock3 size={13} /> Scheduled for {post.destinationName}{post.platform === "linkedin" ? ` (${post.destinationType === "organization" ? "company Page" : "personal profile"})` : ""}</span>}
      {post.status === "published" && <span className="published-destination"><Send size={13} /> Published to {post.destinationName ?? platformLabel[post.platform]}{post.platform === "linkedin" ? ` (${post.destinationType === "organization" ? "company Page" : "personal profile"})` : ""}{post.remotePostUrl && <> · <a href={post.remotePostUrl} target="_blank" rel="noreferrer">View post</a></>}</span>}
      {post.status !== "published" && connections.length > 0 && <span className={cn("publishing-readiness", readiness.connected ? "ready" : "mismatch")}>
        <Radio size={13} />
        {readiness.connected
          ? `${platformLabel[post.platform]} connected${target ? ` · ${target.username ? `@${target.username}` : target.displayName}` : ""}${readiness.hasMedia ? "" : " · media required"}`
          : alternativePlatforms.length > 0
            ? `${platformLabel[post.platform]} draft · ${alternativePlatforms.map((platform) => platformLabel[platform]).join(", ")} connected`
            : `${platformLabel[post.platform]} connection required`}
      </span>}
    </div>
    {(canEdit || canApprove || canChoosePublish || (onGenerateImage && canGenerateImage)) && <div className="post-actions">
      {onGenerateImage && canGenerateImage && <>
        <select className="media-type-select" aria-label="Media format" value={post.mediaType} onChange={(event) => onGenerateImage(post.id, event.target.value as MediaType)} disabled={generatingImage || (post.platform === "instagram" && post.mediaType === "motion")}>
          <option value="image">Image</option>{!["x", "threads"].includes(post.platform) && <option value="carousel">Carousel</option>}{["facebook", "linkedin"].includes(post.platform) && <option value="motion">3–5s motion</option>}
        </select>
        <button className="image-button" onClick={() => onGenerateImage(post.id, post.mediaType)} disabled={generatingImage}>
          {generatingImage ? <LoaderCircle className="spin" size={15} /> : <ImagePlus size={15} />}{post.mediaUrl ? `Replace ${mediaLabel[post.mediaType].toLowerCase()}` : `Generate ${mediaLabel[post.mediaType].toLowerCase()}`}
        </button>
      </>}
      {canEdit && <button className="icon-button" aria-label="Edit post description and hashtags" onClick={() => onEdit(post)}><PenLine size={16} /></button>}
      {canApprove && <button className="approve-button" onClick={() => onApprove(post.id)}><Check size={16} /> Approve</button>}
      {onCreateVariant && canEdit && alternativePlatforms.slice(0, 2).map((platform) => <button className="variant-button" key={platform} onClick={() => onCreateVariant(post, platform)} disabled={variantBusy === `${post.id}:${platform}`}>
        {variantBusy === `${post.id}:${platform}` ? <LoaderCircle className="spin" size={14} /> : <Plus size={14} />} Create {platformLabel[platform]} version
      </button>)}
      {canChoosePublish && <button className="publish-options-button" onClick={() => onPublish(post)}><Send size={15} /> {post.status === "failed" ? "Retry publishing" : post.status === "scheduled" ? "Change destination" : readiness.connected ? "Publish now" : "Publishing setup"}</button>}
    </div>}
  </article>;
}

function MediaPreview({ post }: { post: SocialPost }) {
  if (!post.mediaUrl) return null;
  if (post.mediaType === "carousel" && post.mediaItems.length > 1) return <div className="carousel-media-preview">{post.mediaItems.map((item, index) => <Image key={item.key} src={item.url} alt={`${post.hook}, slide ${index + 1}`} width={1080} height={1350} unoptimized />)}<span>{post.mediaItems.length} slides</span></div>;
  const dimensions = post.mediaType === "motion" ? { width: 720, height: 900 } : { width: 1200, height: 1500 };
  return <div className={cn("single-media-wrap", post.mediaType === "motion" && "motion")}><Image className="post-media-preview" src={post.mediaUrl} alt={`Generated ${post.mediaType} for ${post.hook}`} {...dimensions} unoptimized />{post.mediaType === "motion" && <span>3–5s loop</span>}</div>;
}

function Timeline({ posts }: { posts: SocialPost[] }) {
  if (posts.length === 0) return <div className="timeline-empty">Approved posts will appear here.</div>;
  return <div className="timeline">{posts.slice(0, 4).map((post, index) => { const Icon = platformIcon[post.platform]; return <div className="timeline-item" key={post.id}><div className="timeline-line"><span className={cn("platform-icon", post.platform)}><Icon size={15} /></span>{index < posts.length - 1 && <i />}</div><div><small>{formatSchedule(post.scheduledFor)}</small><strong>{post.hook}</strong><span>{statusLabel[post.status]}{post.destinationName ? ` · ${post.destinationName}${post.platform === "linkedin" ? post.destinationType === "organization" ? " Page" : " profile" : ""}` : ""}</span></div></div>; })}</div>;
}

function DraftStudio({ posts, connections, onApprove, onPublish, onEditPost, onGenerateImage, imageBusy, onCreateVariant, variantBusy, onGenerate, onConnections }: { posts: SocialPost[]; connections: ConnectionSummary[]; onApprove: (id: string) => void; onPublish: (post: SocialPost) => void; onEditPost: (post: SocialPost) => void; onGenerateImage: (id: string, mediaType: MediaType) => void; imageBusy: string | null; onCreateVariant: (post: SocialPost, platform: Platform) => void; variantBusy: string | null; onGenerate: () => void; onConnections: () => void }) {
  const active = activePublishingDestinations(connections);
  return <div className="page-wrap subpage"><span className="eyebrow">DRAFT STUDIO</span><h1>Review before reach.</h1><p className="page-lead">Every generated claim stays here until you decide it is accurate, useful, and ready.</p><section className="active-publishing-panel"><div><span className="eyebrow">ACTIVE PUBLISHING CONNECTIONS</span><strong>{active.length ? `${active.length} destination${active.length === 1 ? "" : "s"} ready` : "No destinations connected"}</strong></div><div className="active-destination-list">{active.map((account) => { const Icon = platformIcon[account.platform]; return <span key={account.id}><Icon size={15} /><i><strong>{platformLabel[account.platform]}</strong><small>{account.username ? `@${account.username}` : account.displayName}</small></i><Check size={13} /></span>; })}{active.length === 0 && <small>Connect an account before publishing.</small>}</div><button className="outline-button" onClick={onConnections}>Manage connections <ArrowUpRight size={14} /></button></section><div className="panel"><div className="post-list">{posts.map((post) => <PostRow key={post.id} post={post} connections={connections} onApprove={onApprove} onPublish={onPublish} onEdit={onEditPost} onGenerateImage={onGenerateImage} generatingImage={imageBusy === post.id} onCreateVariant={onCreateVariant} variantBusy={variantBusy} />)}</div>{posts.length === 0 && <PanelEmpty title="No drafts yet" copy="Generate a campaign from the selected project context." action="Generate campaign" onAction={onGenerate} />}</div></div>;
}

function CalendarView({ posts, connections, onApprove, onPublish, onEditPost, onGenerateImage, imageBusy, onCreateVariant, variantBusy, onGenerate }: { posts: SocialPost[]; connections: ConnectionSummary[]; onApprove: (id: string) => void; onPublish: (post: SocialPost) => void; onEditPost: (post: SocialPost) => void; onGenerateImage: (id: string, mediaType: MediaType) => void; imageBusy: string | null; onCreateVariant: (post: SocialPost, platform: Platform) => void; variantBusy: string | null; onGenerate: () => void }) {
  const groups = useMemo(() => { const map = new Map<string, SocialPost[]>(); posts.forEach((post) => { const key = post.scheduledFor ? new Date(post.scheduledFor).toDateString() : "Unscheduled"; map.set(key, [...(map.get(key) ?? []), post]); }); return [...map.entries()]; }, [posts]);
  return <div className="page-wrap subpage"><span className="eyebrow">CONTENT CALENDAR</span><h1>Everything has a moment.</h1><p className="page-lead">Only real generated, approved, and published posts appear here.</p>{groups.length > 0 ? <div className="calendar-list">{groups.map(([date, items]) => <section className="calendar-day" key={date}><div className="day-label"><strong>{date === "Unscheduled" ? date : new Intl.DateTimeFormat("en-IN", { weekday: "short" }).format(new Date(date))}</strong><span>{date === "Unscheduled" ? "" : new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short" }).format(new Date(date))}</span></div><div className="day-posts">{items.map((post) => <PostRow key={post.id} post={post} connections={connections} onApprove={onApprove} onPublish={onPublish} onEdit={onEditPost} onGenerateImage={onGenerateImage} generatingImage={imageBusy === post.id} onCreateVariant={onCreateVariant} variantBusy={variantBusy} />)}</div></section>)}</div> : <div className="panel calendar-empty"><PanelEmpty title="Calendar is empty" copy="Generate the first campaign for this project." action="Generate campaign" onAction={onGenerate} /></div>}</div>;
}

function EditPostModal({ post, busy, onClose, onSave }: {
  post: SocialPost;
  busy: boolean;
  onClose: () => void;
  onSave: (content: Pick<SocialPost, "hook" | "body" | "cta" | "hashtags">) => void;
}) {
  const [hook, setHook] = useState(post.hook);
  const [body, setBody] = useState(post.body);
  const [cta, setCta] = useState(post.cta);
  const [hashtags, setHashtags] = useState(post.hashtags.join(" "));
  const parsedHashtags = [...new Set(hashtags.split(/[\s,]+/).map((value) => `#${value.replace(/^#+/, "").replace(/[^\p{L}\p{N}_]/gu, "")}`).filter((value) => value.length > 1))].slice(0, 8);
  const characterCount = [hook, body, cta, parsedHashtags.join(" ")].filter(Boolean).join("\n\n").length;
  const invalidForX = post.platform === "x" && characterCount > 280;
  const canSave = hook.trim().length >= 3 && body.trim().length >= 10 && !invalidForX;
  return <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
    <section className="edit-post-dialog" role="dialog" aria-modal="true" aria-label="Edit post description and hashtags" onMouseDown={(event) => event.stopPropagation()}>
      <header><div><span className="eyebrow">EDIT {platformLabel[post.platform].toUpperCase()} POST</span><h2>Make every word intentional.</h2><p>This exact copy and these hashtags will be used for scheduling and publishing.</p></div><button className="icon-button" onClick={onClose} disabled={busy} aria-label="Close editor"><X size={18} /></button></header>
      <div className="edit-post-form">
        <label><span>Headline / hook</span><input value={hook} maxLength={300} onChange={(event) => setHook(event.target.value)} /></label>
        <label><span>Description</span><textarea value={body} maxLength={5000} rows={8} onChange={(event) => setBody(event.target.value)} /></label>
        <label><span>Call to action</span><input value={cta} maxLength={500} onChange={(event) => setCta(event.target.value)} /></label>
        <label><span>Hashtags</span><input value={hashtags} maxLength={400} onChange={(event) => setHashtags(event.target.value)} placeholder="#ProductMarketing #BuildInPublic" /><small>Separate hashtags with spaces or commas. ProReach keeps up to eight.</small></label>
        <div className={cn("copy-count", invalidForX && "over-limit")}><span>{parsedHashtags.length} hashtags</span><strong>{characterCount}{post.platform === "x" ? " / 280" : " characters"}</strong></div>
      </div>
      <footer><button className="ghost-button" onClick={onClose} disabled={busy}>Cancel</button><button className="primary-button" disabled={busy || !canSave} onClick={() => onSave({ hook: hook.trim(), body: body.trim(), cta: cta.trim(), hashtags: parsedHashtags })}>{busy ? <LoaderCircle className="spin" size={15} /> : <Check size={15} />} Save post</button></footer>
    </section>
  </div>;
}

function PublishDecisionModal({ post, connections, scheduleAt, onScheduleAt, selectedDestinationId, onDestination, busy, onClose, onSchedule, onPostNow, onConnections }: {
  post: SocialPost;
  connections: ConnectionSummary[];
  scheduleAt: string;
  onScheduleAt: (value: string) => void;
  selectedDestinationId: string;
  onDestination: (value: string) => void;
  busy: "now" | "schedule" | null;
  onClose: () => void;
  onSchedule: () => void;
  onPostNow: () => void;
  onConnections: () => void;
}) {
  const [confirmNow, setConfirmNow] = useState(false);
  const destinations = destinationsForPlatform(connections, post.platform);
  const selectedDestination = destinations.find((account) => account.id === selectedDestinationId);
  const connected = destinations.length > 0;
  const connectedPlatforms = [...new Set(activePublishingDestinations(connections).map((account) => account.platform))];
  const hasMedia = Boolean(post.mediaUrl || post.mediaItems.length);
  const mediaLabel: Record<MediaType, string> = { image: "single image", carousel: `${post.mediaItems.length || 4} slide carousel`, motion: "3–5 second motion clip" };
  const Icon = platformIcon[post.platform];
  const now = new Date();
  const minimumScheduleAt = new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  return <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
    <section className="publish-dialog" role="dialog" aria-modal="true" aria-label="Choose when to publish" onMouseDown={(event) => event.stopPropagation()}>
      <header>
        <div><span className="eyebrow">{post.status === "failed" ? "READY TO RETRY" : post.status === "scheduled" ? "SCHEDULED" : "APPROVED"} · {platformLabel[post.platform].toUpperCase()}</span><h2>When should this go live?</h2><p>The {mediaLabel[post.mediaType]} and final post copy will be sent to the exact {platformLabel[post.platform]} destination selected below.</p></div>
        <button className="icon-button" onClick={onClose} disabled={Boolean(busy)} aria-label="Close publishing options"><X size={18} /></button>
      </header>
      <div className="publish-summary"><span className={cn("platform-icon large", post.platform)}><Icon size={18} /></span><div><strong>{post.hook}</strong><small>{mediaLabel[post.mediaType]} · {post.hashtags.length} hashtags</small></div></div>
      {connected && <label className="publish-destination"><span>Publishing destination</span><select value={selectedDestinationId} onChange={(event) => { onDestination(event.target.value); setConfirmNow(false); }}><option value="">Choose the exact account or Page</option>{destinations.map((account) => <option key={account.id} value={account.id}>{account.displayName} — {account.destinationType === "organization" ? "Company Page" : account.platform === "linkedin" ? "Personal profile" : platformLabel[account.platform]}</option>)}</select>{selectedDestination?.platform === "linkedin" && <small>{selectedDestination.destinationType === "organization" ? "This post will appear on the LinkedIn company Page." : "This post will appear on your personal LinkedIn profile, not a company Page."}</small>}</label>}
      <div className="destination-scope"><strong>Active publishing connections</strong><div>{connectedPlatforms.map((platform) => { const PlatformIcon = platformIcon[platform]; return <span className={cn(platform === post.platform && "target")} key={platform}><PlatformIcon size={13} /> {platformLabel[platform]} {platform === post.platform && <em>compatible</em>}</span>; })}</div><p>This is a <strong>{platformLabel[post.platform]} draft</strong>. It can publish only to a connected {platformLabel[post.platform]} destination. Use “Create {connectedPlatforms.find((platform) => platform !== post.platform) ? platformLabel[connectedPlatforms.find((platform) => platform !== post.platform)!] : "platform"} version” in Draft Studio to reuse it elsewhere.</p></div>
      {connected ? <div className="publish-choices">
        <article>
          <div><Clock3 size={18} /><span><strong>Schedule</strong><small>Publish automatically at your selected local time.</small></span></div>
          <input type="datetime-local" value={scheduleAt} min={minimumScheduleAt} onChange={(event) => onScheduleAt(event.target.value)} />
          <button className="outline-button" onClick={onSchedule} disabled={Boolean(busy) || !scheduleAt || !hasMedia || !selectedDestination}>{busy === "schedule" ? <LoaderCircle className="spin" size={15} /> : <CalendarDays size={15} />} Schedule post</button>
        </article>
        <article className="post-now-choice">
          <div><Send size={18} /><span><strong>Publish Now</strong><small>Review the destination warning before anything is sent.</small></span></div>
          <button className="primary-button" onClick={() => setConfirmNow(true)} disabled={Boolean(busy) || !hasMedia || !selectedDestination}><Send size={15} /> Publish Now</button>
        </article>
      </div> : <div className="publish-connection-required"><Radio size={21} /><div><strong>Connect {platformLabel[post.platform]} before publishing</strong><p>Your approval is saved. No content has been sent anywhere.</p></div><button className="primary-button" onClick={onConnections}>Manage connections</button></div>}
      {connected && !hasMedia && <div className="publish-warning"><AlertTriangle size={18} /><div><strong>Generate the {mediaLabel[post.mediaType]} before publishing</strong><p>This prevents an approved visual post from being sent as text only.</p></div></div>}
      {confirmNow && selectedDestination && <div className="publish-confirmation"><AlertTriangle size={20} /><div><strong>Publish now to {selectedDestination.displayName}?</strong><p>This is the {selectedDestination.destinationType === "organization" ? "LinkedIn company Page" : selectedDestination.platform === "linkedin" ? "LinkedIn personal profile" : platformLabel[selectedDestination.platform]} destination. The approved {mediaLabel[post.mediaType]}, description, CTA, and {post.hashtags.length} hashtags will be public immediately. This action cannot be undone from ProReach.</p><div><button className="ghost-button" onClick={() => setConfirmNow(false)} disabled={Boolean(busy)}>Go back</button><button className="primary-button" onClick={onPostNow} disabled={Boolean(busy)}>{busy === "now" ? <LoaderCircle className="spin" size={15} /> : <Send size={15} />} Confirm & publish</button></div></div></div>}
      <footer>{connected && !selectedDestination && <span>Choose a destination before scheduling or publishing.</span>}<button className="ghost-button" onClick={onClose} disabled={Boolean(busy)}>Keep approved for later</button></footer>
    </section>
  </div>;
}

function ConnectionsView({ project, connections, initialSelectionId, onConnectionsChange }: { project: ProductProject | null; connections: ConnectionSummary[]; initialSelectionId?: string; onConnectionsChange: (connections: ConnectionSummary[]) => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const initialSelection = connections.find((connection) => connection.id === initialSelectionId);
  const [selecting, setSelecting] = useState<ConnectionSummary | null>(initialSelection?.accounts.length ? initialSelection : null);
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>(() => initialSelection?.accounts.filter((account) => account.enabled !== false).map((account) => account.id) ?? []);
  const [selectionBusy, setSelectionBusy] = useState(false);

  function updateConnections(updater: (connections: ConnectionSummary[]) => ConnectionSummary[]) {
    onConnectionsChange(updater(connections));
  }

  function openSelector(connection: ConnectionSummary) {
    setSelecting(connection);
    setSelectedAccountIds(connection.accounts.filter((account) => account.enabled !== false).map((account) => account.id));
  }

  function toggleAccount(id: string) {
    setSelectedAccountIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  }

  async function saveSelection() {
    if (!selecting?.id || selectedAccountIds.length === 0) return;
    setSelectionBusy(true); setFeedback(null);
    try {
      const response = await fetch(`/api/integrations/${selecting.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountIds: selectedAccountIds }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Publishing destinations could not be saved.");
      updateConnections((current) => current.map((connection) => connection.id === selecting.id ? {
        ...connection,
        accounts: connection.accounts.map((account) => ({ ...account, enabled: selectedAccountIds.includes(account.id) })),
      } : connection));
      setFeedback(`${selectedAccountIds.length} ${selecting.label} destination${selectedAccountIds.length === 1 ? "" : "s"} enabled for publishing.`);
      setSelecting(null);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Publishing destinations could not be saved.");
    } finally { setSelectionBusy(false); }
  }

  async function verify(connection: ConnectionSummary) {
    if (!connection.id) return; setBusy(connection.id); setFeedback(null);
    try { const response = await fetch(`/api/integrations/${connection.id}/verify`, { method: "POST" }); if (!response.ok) throw new Error("The token is no longer valid. Reconnect this account."); setFeedback(`${connection.label} is connected and responding.`); updateConnections((current) => current.map((item) => item.id === connection.id ? { ...item, status: "active", connected: true } : item)); }
    catch (error) { setFeedback(error instanceof Error ? error.message : "Verification failed."); updateConnections((current) => current.map((item) => item.id === connection.id ? { ...item, status: "error", connected: false } : item)); }
    finally { setBusy(null); }
  }

  async function disconnect(connection: ConnectionSummary) {
    if (!connection.id) return; if (confirming !== connection.id) { setConfirming(connection.id); return; } setBusy(connection.id); setFeedback(null);
    try { const response = await fetch(`/api/integrations/${connection.id}`, { method: "DELETE" }); if (!response.ok) throw new Error("Disconnect failed."); updateConnections((current) => current.map((item) => item.id === connection.id ? { ...item, id: undefined, connected: false, status: undefined, accountName: undefined, accounts: [] } : item)); setFeedback(`${connection.label} disconnected. Stored tokens were removed.`); }
    catch (error) { setFeedback(error instanceof Error ? error.message : "Disconnect failed."); }
    finally { setBusy(null); setConfirming(null); }
  }

  if (!project) return <div className="page-wrap subpage connections-page"><span className="eyebrow">CONNECTIONS</span><h1>Create a project first.</h1><p className="page-lead">Every social account connection belongs to one project, so create the brand project before connecting its Pages and profiles.</p></div>;
  return <div className="page-wrap subpage connections-page"><span className="eyebrow">{project.name.toUpperCase()} · CONNECTIONS</span><h1>Connect once. Publish with confidence.</h1><p className="page-lead">Sign in to <strong>{project.name}&apos;s</strong> social accounts. Every OAuth connection is stored only under this project, and switching projects switches the available publishing accounts.</p>{feedback && <div className="connection-feedback">{feedback}<button onClick={() => setFeedback(null)} aria-label="Dismiss message"><X size={14} /></button></div>}<div className="oauth-explainer"><span><ShieldCheck size={18} /></span><div><strong>OAuth sign-in only</strong><p>Project users never enter Client IDs, Client Secrets, or access tokens. Click a provider, sign in on its website, and approve ProReach.</p></div><div><i>1</i> Click Connect <i>2</i> Approve on provider <i>3</i> Choose destinations</div></div><div className="connection-grid">{connections.map((connection) => { const Icon = providerIcon[connection.provider]; const isBusy = busy === connection.id; const enabledCount = connection.accounts.filter((account) => account.enabled !== false).length; return <article className={cn("connection-card", connection.connected && "is-connected")} key={connection.provider}><div className={cn("connection-logo", connection.provider)}><Icon size={24} /></div><div className="connection-copy"><h3>{connection.label}</h3><strong>{connection.accountName ?? (connection.configured ? "Ready for OAuth sign-in" : "OAuth currently unavailable")}</strong><p>{connection.note}</p>{!connection.configured && <p className="connection-warning">The ProReach administrator has not enabled {connection.label} OAuth for this deployment yet.</p>}{connection.accounts.length > 0 && <div className="connected-accounts">{connection.accounts.map((account) => <span className={cn(account.enabled !== false ? "enabled" : "disabled")} key={account.id}>{account.enabled !== false && <Check size={10} />}{account.platform === "facebook" ? "Page" : account.platform === "instagram" ? "IG" : account.destinationType === "organization" ? "Page" : account.platform === "linkedin" ? "Profile" : "@"} {account.username ?? account.displayName}</span>)}</div>}{connection.accounts.length > 1 && <button className="choose-destinations-button" onClick={() => openSelector(connection)}><Settings size={13} /> Choose Pages & profiles <em>{enabledCount}/{connection.accounts.length}</em></button>}{connection.provider === "linkedin" && connection.connected && !connection.accounts.some((account) => account.destinationType === "organization") && <p className="connection-warning">Only a personal profile was returned. LinkedIn company Pages require approved Community Management API access.</p>}</div><div className="connection-actions">{connection.connected && connection.id ? <><a className="connect-button" href={oauthConnectionHref(connection.provider, project.id)}>Reconnect <ArrowUpRight size={15} /></a><button className="verify-button" onClick={() => verify(connection)} disabled={isBusy}>{isBusy ? <LoaderCircle className="spin" size={14} /> : <Radio size={14} />} Verify</button><button className={cn("disconnect-button", confirming === connection.id && "confirm")} onClick={() => disconnect(connection)} disabled={isBusy}>{confirming === connection.id ? "Confirm disconnect" : "Disconnect"}</button></> : connection.configured ? <a className="connect-button" href={oauthConnectionHref(connection.provider, project.id)}>Connect with {connection.label} <ArrowUpRight size={15} /></a> : <button className="connect-button needs-setup" type="button" disabled>Connect with {connection.label}</button>}</div></article>; })}</div><div className="api-note"><Sparkles size={18} /><div><strong>Project boundary</strong><p>Only {project.name}&apos;s enabled destinations can appear when publishing this project&apos;s campaign.</p></div></div>{selecting && <DestinationSelector connection={selecting} selectedIds={selectedAccountIds} busy={selectionBusy} onToggle={toggleAccount} onClose={() => !selectionBusy && setSelecting(null)} onSave={saveSelection} />}</div>;
}

function DestinationSelector({ connection, selectedIds, busy, onToggle, onClose, onSave }: { connection: ConnectionSummary; selectedIds: string[]; busy: boolean; onToggle: (id: string) => void; onClose: () => void; onSave: () => void }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={onClose}><section className="destination-selector-dialog" role="dialog" aria-modal="true" aria-label={`Choose ${connection.label} publishing destinations`} onMouseDown={(event) => event.stopPropagation()}><header><div><span className="eyebrow">OAUTH COMPLETE · {connection.label.toUpperCase()}</span><h2>Choose where ProReach can publish.</h2><p>Only selected destinations appear in campaign publishing. You can change this later without signing in again.</p></div><button className="icon-button" onClick={onClose} disabled={busy} aria-label="Close destination selector"><X size={18} /></button></header><div className="destination-selector-list">{connection.accounts.map((account) => { const Icon = platformIcon[account.platform]; const selected = selectedIds.includes(account.id); return <button type="button" className={cn(selected && "selected")} onClick={() => onToggle(account.id)} key={account.id}><span className={cn("platform-icon large",account.platform)}><Icon size={17} /></span><p><strong>{account.displayName}</strong><small>{account.destinationType === "organization" ? "Company Page" : account.platform === "facebook" ? "Facebook Page" : account.username ? `@${account.username}` : `${platformLabel[account.platform]} profile`}</small></p><i>{selected ? <Check size={15} /> : <Plus size={15} />}</i></button>; })}</div><footer><span>{selectedIds.length} of {connection.accounts.length} selected</span><div><button className="ghost-button" onClick={onClose} disabled={busy}>Cancel</button><button className="primary-button" onClick={onSave} disabled={busy || selectedIds.length === 0}>{busy ? <LoaderCircle className="spin" size={15} /> : <Check size={15} />} Enable destinations</button></div></footer></section></div>;
}
