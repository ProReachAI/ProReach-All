"use client";

import {
  AlertTriangle, ArrowUpRight, AtSign, BriefcaseBusiness, CalendarDays, Camera, Check, ChevronDown,
  CircleGauge, Clock3, FileText, Flag, ImagePlus, Layers3, LayoutGrid, LoaderCircle, Menu,
  MessageCircle, Package, PenLine, Plus, Radio, Send, Settings,
  Sparkles, Target, X, Zap, LogOut,
} from "lucide-react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useMemo, useState } from "react";
import { CampaignComposer } from "@/components/campaign-composer";
import { ProjectSetup } from "@/components/project-setup";
import { activePublishingDestinations, destinationsForPlatform, publishingReadiness } from "@/lib/integrations/publishing";
import { platformLabel, type Campaign, type ConnectionSummary, type MediaType, type Platform, type ProductProject, type SocialPost } from "@/lib/types";
import { cn, formatSchedule } from "@/lib/utils";

const platformIcon: Record<Platform, React.ComponentType<{ size?: number; strokeWidth?: number }>> = {
  facebook: Flag, instagram: Camera, threads: MessageCircle, x: AtSign, linkedin: BriefcaseBusiness,
};

const providerIcon = {
  meta: Layers3, instagram: Camera, threads: MessageCircle, x: AtSign, linkedin: BriefcaseBusiness,
} satisfies Record<ConnectionSummary["provider"], React.ComponentType<{ size?: number; strokeWidth?: number }>>;

const statusLabel: Record<SocialPost["status"], string> = {
  draft: "Draft", review: "Needs review", approved: "Approved", scheduled: "Scheduled",
  publishing: "Publishing", published: "Published", failed: "Failed",
};

function oauthConnectionHref(provider: ConnectionSummary["provider"]) {
  return provider === "linkedin" ? "/api/oauth/linkedin?mode=organization" : `/api/oauth/${provider}`;
}

type View = "overview" | "drafts" | "calendar" | "connections";

type Props = {
  projects: ProductProject[];
  selectedProject: ProductProject | null;
  initialCampaign: Campaign | null;
  connections: ConnectionSummary[];
  initialView?: "overview" | "connections";
  initialNotice?: string;
  authUser: { name: string; email: string; initials: string };
};

export function Dashboard({ projects, selectedProject, initialCampaign, connections, initialView = "overview", initialNotice, authUser }: Props) {
  const router = useRouter();
  const [campaign, setCampaign] = useState(initialCampaign);
  const [active, setActive] = useState<View>(initialView);
  const [projectSetupOpen, setProjectSetupOpen] = useState(projects.length === 0);
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
    const destinations = connections.filter((connection) => connection.connected).flatMap((connection) => connection.accounts).filter((account) => account.platform === post.platform);
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
    router.push(`/?project=${encodeURIComponent(id)}`);
  }

  function savedProject(project: ProductProject) {
    setProjectSetupOpen(false); setEditingProject(null);
    setNotice(`Product context saved for ${project.name}.`);
    router.push(`/?project=${encodeURIComponent(project.id)}`);
    router.refresh();
  }

  return (
    <div className="app-shell">
      <aside className={cn("sidebar", mobileNav && "sidebar-open")}>
        <div className="brand-row">
          <div className="brand-mark-img">
            <Image src="/logo.png" alt="BuildToReach logo" width={36} height={36} style={{ borderRadius: "8px", objectFit: "contain" }} />
          </div>
          <div>
            <strong>BuildToReach</strong>
            <small>marketing agent</small>
          </div>
          <button className="mobile-close" onClick={() => setMobileNav(false)} aria-label="Close navigation"><X size={19} /></button>
        </div>
        <nav className="primary-nav" aria-label="Main navigation">
          <NavButton icon={LayoutGrid} label="Overview" active={active === "overview"} onClick={() => setActive("overview")} />
          <NavButton icon={PenLine} label="Draft studio" active={active === "drafts"} onClick={() => setActive("drafts")} count={review.length} />
          <NavButton icon={CalendarDays} label="Content calendar" active={active === "calendar"} onClick={() => setActive("calendar")} count={scheduled.length} />
          <NavButton icon={CircleGauge} label="Performance" />
          <NavButton icon={Radio} label="Connections" active={active === "connections"} onClick={() => setActive("connections")} />
        </nav>
        <div className="sidebar-spacer" />
        <div className="autopilot-card"><div className="autopilot-title"><Zap size={15} fill="currentColor" /> Approval mode</div><p>BuildToReach drafts and schedules. You keep the final say.</p><div className="safety-row"><span className="pulse-dot" /> Safe mode active</div></div>
        <nav className="secondary-nav"><NavButton icon={Target} label="Growth plan" /><NavButton icon={Settings} label="Product context" onClick={() => selectedProject && setEditingProject(selectedProject)} /></nav>
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
          <button className="mobile-menu" onClick={() => setMobileNav(true)} aria-label="Open navigation"><Menu size={21} /></button>
          <div className="project-switcher">
            <Package size={15} />
            {projects.length > 0 ? <label><span>Project</span><select aria-label="Select project" value={selectedProject?.id ?? ""} onChange={(event) => chooseProject(event.target.value)}>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select><ChevronDown size={14} /></label> : <strong>No project yet</strong>}
          </div>
          <div className="topbar-actions">
            <button className="ghost-button new-project-button" onClick={() => { setEditingProject(null); setProjectSetupOpen(true); }}><Plus size={15} /> New project</button>
            {selectedProject && <button className="primary-button" onClick={() => setComposerOpen(true)}><Sparkles size={16} /> Generate campaign</button>}
          </div>
        </header>

        {active === "connections" ? <ConnectionsView connections={connections} /> : !selectedProject ? <NoProject onCreate={() => setProjectSetupOpen(true)} /> : active === "calendar" ? <CalendarView posts={posts} connections={connections} onApprove={approvePost} onPublish={openPublishing} onEditPost={setEditingPost} onGenerateImage={generatePostImage} imageBusy={imageBusy} onCreateVariant={createVariant} variantBusy={variantBusy} onGenerate={() => setComposerOpen(true)} /> : active === "drafts" ? <DraftStudio posts={review} connections={connections} onApprove={approvePost} onPublish={openPublishing} onEditPost={setEditingPost} onGenerateImage={generatePostImage} imageBusy={imageBusy} onCreateVariant={createVariant} variantBusy={variantBusy} onGenerate={() => setComposerOpen(true)} onConnections={() => setActive("connections")} /> : campaign ? <Overview project={selectedProject} campaign={campaign} connections={connections} review={review} scheduled={scheduled} published={published} onApprove={approvePost} onPublish={openPublishing} onEditPost={setEditingPost} onGenerateImage={generatePostImage} imageBusy={imageBusy} onGenerate={() => setComposerOpen(true)} onEdit={() => setEditingProject(selectedProject)} onConnections={() => setActive("connections")} /> : <ProjectReady project={selectedProject} onGenerate={() => setComposerOpen(true)} onEdit={() => setEditingProject(selectedProject)} />}
      </main>

      {(projectSetupOpen || editingProject) && <ProjectSetup project={editingProject} onClose={() => { if (projects.length > 0) { setProjectSetupOpen(false); setEditingProject(null); } }} onSaved={savedProject} />}
      {composerOpen && selectedProject && <CampaignComposer project={selectedProject} connections={connections} onClose={() => setComposerOpen(false)} onCreated={(created) => { setCampaign(created); setComposerOpen(false); setActive("drafts"); setNotice("Campaign generated from the saved product context. Review every draft before approval."); }} />}
      {editingPost && <EditPostModal post={editingPost} busy={editBusy} onClose={() => !editBusy && setEditingPost(null)} onSave={savePostCopy} />}
      {publishDecision && <PublishDecisionModal post={publishDecision} connections={connections} scheduleAt={scheduleAt} onScheduleAt={setScheduleAt} selectedDestinationId={selectedDestinationId} onDestination={setSelectedDestinationId} busy={publishBusy} onClose={() => !publishBusy && setPublishDecision(null)} onSchedule={schedulePost} onPostNow={postNow} onConnections={() => { setPublishDecision(null); setActive("connections"); }} />}
      {notice && <div className="toast"><Check size={17} /><span>{notice}{publishedLink && <> <a href={publishedLink} target="_blank" rel="noreferrer">View published post</a></>}</span><button onClick={() => { setNotice(null); setPublishedLink(null); }} aria-label="Dismiss notification"><X size={15} /></button></div>}
    </div>
  );
}

function NavButton({ icon: Icon, label, active, onClick, count }: { icon: typeof LayoutGrid; label: string; active?: boolean; onClick?: () => void; count?: number }) {
  return <button className={cn("nav-button", active && "active")} onClick={onClick}><Icon size={18} strokeWidth={1.8} /><span>{label}</span>{count ? <em>{count}</em> : null}</button>;
}

function NoProject({ onCreate }: { onCreate: () => void }) {
  return <div className="onboarding-empty"><div className="empty-orbit"><Package size={30} /></div><span className="eyebrow">START WITH PRODUCT TRUTH</span><h1>Create your first project.</h1><p>Give BuildToReach the product, customer, positioning, proof, and voice context it needs. Every future campaign will be generated inside those factual boundaries.</p><button className="primary-button" onClick={onCreate}><Plus size={16} /> Create project</button><div className="empty-principles"><span><strong>01</strong> Product facts</span><span><strong>02</strong> Audience context</span><span><strong>03</strong> Voice guardrails</span></div></div>;
}

function ProjectReady({ project, onGenerate, onEdit }: { project: ProductProject; onGenerate: () => void; onEdit: () => void }) {
  return <div className="page-wrap project-ready"><span className="eyebrow">{project.name.toUpperCase()} · CONTEXT READY</span><h1>The product truth is saved.<br /><em>Now give this week a job.</em></h1><p>{project.oneLiner}</p><div className="context-preview"><ContextBlock label="Audience" value={project.targetAudience} /><ContextBlock label="Problem" value={project.problemStatement} /><ContextBlock label="Difference" value={project.differentiators} /></div><div className="ready-actions"><button className="primary-button" onClick={onGenerate}><Sparkles size={16} /> Generate first campaign</button><button className="ghost-button" onClick={onEdit}><Settings size={15} /> Review product context</button></div></div>;
}

function Overview({ project, campaign, connections, review, scheduled, published, onApprove, onPublish, onEditPost, onGenerateImage, imageBusy, onGenerate, onEdit, onConnections }: {
  project: ProductProject; campaign: Campaign; connections: ConnectionSummary[]; review: SocialPost[]; scheduled: SocialPost[]; published: SocialPost[]; onApprove: (id: string) => void; onPublish: (post: SocialPost) => void; onEditPost: (post: SocialPost) => void; onGenerateImage: (id: string, mediaType: MediaType) => void; imageBusy: string | null; onGenerate: () => void; onEdit: () => void; onConnections: () => void;
}) {
  const connectedDestinations = new Set(connections.flatMap((connection) => connection.accounts.map((account) => account.platform))).size;
  return <div className="page-wrap">
    <section className="hero-row project-hero"><div><span className="eyebrow">{project.name.toUpperCase()} · LATEST CAMPAIGN</span><h1>Product truth,<br /><span>turned into attention.</span></h1><p><strong>{campaign.name}</strong> — {campaign.thesis}</p></div><button className="context-button" onClick={onEdit}><Settings size={15} /><span><small>CONTEXT SOURCE</small><strong>{project.name}</strong></span><ArrowUpRight size={14} /></button></section>
    <section className="metric-grid"><Metric label="Ready to review" value={String(review.length)} meta="Requires your approval" icon={Sparkles} tone="violet" /><Metric label="Scheduled" value={String(scheduled.length)} meta="Publishing queue" icon={Clock3} tone="blue" /><Metric label="Published" value={String(published.length)} meta="Latest campaign" icon={Send} tone="green" /><Metric label="Destinations" value={String(connectedDestinations)} meta="Connected accounts" icon={Radio} tone="amber" /></section>
    <section className="content-grid"><div className="panel queue-panel"><div className="panel-heading"><div><span className="eyebrow">REVIEW QUEUE</span><h2>Worth your attention</h2></div><button className="text-button" onClick={onGenerate}>New campaign <ArrowUpRight size={15} /></button></div><div className="post-list">{review.slice(0, 3).map((post) => <PostRow key={post.id} post={post} onApprove={onApprove} onPublish={onPublish} onEdit={onEditPost} onGenerateImage={onGenerateImage} generatingImage={imageBusy === post.id} />)}</div>{review.length === 0 && <PanelEmpty title="No drafts waiting" copy="Generate a campaign when you have a new objective." action="Generate campaign" onAction={onGenerate} />}</div><aside className="panel next-panel"><div className="panel-heading compact"><div><span className="eyebrow">NEXT UP</span><h2>Publishing rhythm</h2></div></div><Timeline posts={scheduled} /></aside></section>
    <section className="panel product-context-strip"><div><span className="eyebrow">SAVED PRODUCT CONTEXT</span><h3>{project.oneLiner}</h3><p>{project.targetAudience}</p></div><div className="context-tags">{project.keyFeatures.slice(0, 4).map((feature) => <span key={feature}>{feature}</span>)}</div><button className="outline-button" onClick={onEdit}>Edit context</button></section>
    <section className="connections-strip"><div><span className="eyebrow">DISTRIBUTION</span><h2>Connected destinations only. No fake activity.</h2></div><div className="connection-icons">{connections.map((connection) => { const Icon = providerIcon[connection.provider]; return <span key={connection.provider} className={cn("connection-bubble", connection.connected && "connected")} title={connection.label}><Icon size={18} /><i /></span>; })}<button onClick={onConnections}>Manage <ArrowUpRight size={14} /></button></div></section>
  </div>;
}

function Metric({ label, value, meta, icon: Icon, tone }: { label: string; value: string; meta: string; icon: typeof Sparkles; tone: string }) {
  return <article className="metric-card"><div className={cn("metric-icon", tone)}><Icon size={18} /></div><span>{label}</span><strong>{value}</strong><small>{meta}</small></article>;
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
        <label><span>Hashtags</span><input value={hashtags} maxLength={400} onChange={(event) => setHashtags(event.target.value)} placeholder="#ProductMarketing #BuildInPublic" /><small>Separate hashtags with spaces or commas. BuildToReach keeps up to eight.</small></label>
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
      {confirmNow && selectedDestination && <div className="publish-confirmation"><AlertTriangle size={20} /><div><strong>Publish now to {selectedDestination.displayName}?</strong><p>This is the {selectedDestination.destinationType === "organization" ? "LinkedIn company Page" : selectedDestination.platform === "linkedin" ? "LinkedIn personal profile" : platformLabel[selectedDestination.platform]} destination. The approved {mediaLabel[post.mediaType]}, description, CTA, and {post.hashtags.length} hashtags will be public immediately. This action cannot be undone from BuildToReach.</p><div><button className="ghost-button" onClick={() => setConfirmNow(false)} disabled={Boolean(busy)}>Go back</button><button className="primary-button" onClick={onPostNow} disabled={Boolean(busy)}>{busy === "now" ? <LoaderCircle className="spin" size={15} /> : <Send size={15} />} Confirm & publish</button></div></div></div>}
      <footer>{connected && !selectedDestination && <span>Choose a destination before scheduling or publishing.</span>}<button className="ghost-button" onClick={onClose} disabled={Boolean(busy)}>Keep approved for later</button></footer>
    </section>
  </div>;
}

function ConnectionsView({ connections: initialConnections }: { connections: ConnectionSummary[] }) {
  const [connections, setConnections] = useState(initialConnections);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  async function verify(connection: ConnectionSummary) {
    if (!connection.id) return; setBusy(connection.id); setFeedback(null);
    try { const response = await fetch(`/api/integrations/${connection.id}/verify`, { method: "POST" }); if (!response.ok) throw new Error("The token is no longer valid. Reconnect this account."); setFeedback(`${connection.label} is connected and responding.`); setConnections((current) => current.map((item) => item.id === connection.id ? { ...item, status: "active", connected: true } : item)); }
    catch (error) { setFeedback(error instanceof Error ? error.message : "Verification failed."); setConnections((current) => current.map((item) => item.id === connection.id ? { ...item, status: "error", connected: false } : item)); }
    finally { setBusy(null); }
  }

  async function disconnect(connection: ConnectionSummary) {
    if (!connection.id) return; if (confirming !== connection.id) { setConfirming(connection.id); return; } setBusy(connection.id); setFeedback(null);
    try { const response = await fetch(`/api/integrations/${connection.id}`, { method: "DELETE" }); if (!response.ok) throw new Error("Disconnect failed."); setConnections((current) => current.map((item) => item.id === connection.id ? { ...item, id: undefined, connected: false, status: undefined, accountName: undefined, accounts: [] } : item)); setFeedback(`${connection.label} disconnected. Stored tokens were removed.`); }
    catch (error) { setFeedback(error instanceof Error ? error.message : "Disconnect failed."); }
    finally { setBusy(null); setConfirming(null); }
  }

  return <div className="page-wrap subpage"><span className="eyebrow">CONNECTIONS</span><h1>Your publishing desk.</h1><p className="page-lead">Authorize each provider once. OAuth grants and destination tokens are encrypted, verified, and removable.</p>{feedback && <div className="connection-feedback">{feedback}<button onClick={() => setFeedback(null)} aria-label="Dismiss message"><X size={14} /></button></div>}<div className="connection-grid">{connections.map((connection) => { const Icon = providerIcon[connection.provider]; const isBusy = busy === connection.id; return <article className={cn("connection-card", connection.connected && "is-connected")} key={connection.provider}><div className={cn("connection-logo", connection.provider)}><Icon size={24} /></div><div className="connection-copy"><h3>{connection.label}</h3><strong>{connection.accountName ?? (connection.configured ? "Not connected" : "Setup required")}</strong><p>{connection.note}</p>{connection.accounts.length > 0 && <div className="connected-accounts">{connection.accounts.map((account) => <span key={account.id}>{account.platform === "facebook" ? "FB" : account.platform === "instagram" ? "IG" : account.destinationType === "organization" ? "Page" : account.platform === "linkedin" ? "Profile" : "@"} {account.username ?? account.displayName}</span>)}</div>}{connection.provider === "linkedin" && connection.connected && !connection.accounts.some((account) => account.destinationType === "organization") && <p className="connection-warning">Only a personal profile is connected. Reconnect after enabling LinkedIn Community Management API access to add company Pages.</p>}</div><div className="connection-actions">{connection.connected && connection.id ? <><a className="connect-button" href={oauthConnectionHref(connection.provider)}>Reconnect <ArrowUpRight size={15} /></a><button className="verify-button" onClick={() => verify(connection)} disabled={isBusy}>{isBusy ? <LoaderCircle className="spin" size={14} /> : <Radio size={14} />} Verify</button><button className={cn("disconnect-button", confirming === connection.id && "confirm")} onClick={() => disconnect(connection)} disabled={isBusy}>{confirming === connection.id ? "Confirm disconnect" : "Disconnect"}</button></> : <a className={cn("connect-button", !connection.configured && "needs-setup")} href={connection.configured ? oauthConnectionHref(connection.provider) : `/setup/integrations#${connection.provider}`}>{connection.configured ? connection.provider === "linkedin" ? "Connect company Page" : "Connect" : "Configure"} <ArrowUpRight size={15} /></a>}</div></article>; })}</div><div className="api-note"><Sparkles size={18} /><div><strong>Connection boundaries</strong><p>BuildToReach requests publishing permissions only. It does not follow accounts, send DMs, or automate comments.</p></div></div></div>;
}
