"use client";

import { LoaderCircle, Sparkles, X } from "lucide-react";
import { useMemo, useState } from "react";
import { platformLabel, platforms, type Campaign, type ConnectionSummary, type Platform, type ProductProject } from "@/lib/types";
import { cn } from "@/lib/utils";

export function CampaignComposer({ project, connections, onClose, onCreated }: {
  project: ProductProject;
  connections: ConnectionSummary[];
  onClose: () => void;
  onCreated: (campaign: Campaign) => void;
}) {
  const connected = useMemo(() => new Set(connections.flatMap((connection) => connection.accounts.filter((account) => account.enabled !== false).map((account) => account.platform))), [connections]);
  const [goal, setGoal] = useState(project.primaryGoal);
  const [focus, setFocus] = useState("");
  const [instructions, setInstructions] = useState("");
  const [selected, setSelected] = useState<Platform[]>(() => platforms.filter((platform) => connected.has(platform)));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(platform: Platform) {
    setSelected((current) => current.includes(platform) ? current.filter((item) => item !== platform) : [...current, platform]);
  }

  async function generate() {
    if (selected.length === 0) { setError("Choose at least one platform."); return; }
    setLoading(true); setError(null);
    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: project.id, goal, focus, instructions, platforms: selected }),
      });
      const payload = await response.json().catch(() => ({ error: "The server returned an unreadable response. Please try again." }));
      if (!response.ok) throw new Error(payload.error ?? "Generation failed.");
      onCreated(payload.campaign);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Generation failed.");
    } finally { setLoading(false); }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="composer campaign-composer" role="dialog" aria-modal="true" aria-label="Create campaign" onMouseDown={(event) => event.stopPropagation()}>
        <header><div><span className="eyebrow">NEW CAMPAIGN · {project.name.toUpperCase()}</span><h2>Choose this week&apos;s job.</h2><p>ProReach already knows the product context. Give this campaign a clear objective and focus.</p></div><button className="icon-button" onClick={onClose} aria-label="Close campaign composer"><X size={18} /></button></header>
        <div className="form-grid campaign-form-grid">
          <label className="wide">Campaign goal<textarea value={goal} onChange={(event) => setGoal(event.target.value)} /></label>
          <label>Timely focus or angle<span className="campaign-field-help">What makes this relevant now and the one message to emphasize.</span><textarea value={focus} onChange={(event) => setFocus(event.target.value)} maxLength={1000} placeholder="Example: Introduce the live web product ahead of the Android launch. Focus on finding the right tone and the first free rewrite." /></label>
          <label>Additional instructions<span className="campaign-field-help">Required details, tone preferences, and claims or topics to avoid.</span><textarea value={instructions} onChange={(event) => setInstructions(event.target.value)} maxLength={1500} placeholder="Example: Use practical workplace examples. Avoid exaggerated or guaranteed claims. Do not imply the product replaces human judgment." /></label>
          <fieldset className="platform-picker"><legend>Platforms</legend><p>Connected destinations are selected automatically. You can still draft for a platform before connecting it.</p><div>{platforms.map((platform) => <button type="button" className={cn(selected.includes(platform) && "selected")} onClick={() => toggle(platform)} key={platform}><span>{selected.includes(platform) ? "✓" : "+"}</span>{platformLabel[platform]}{connected.has(platform) && <small>connected</small>}</button>)}</div></fieldset>
        </div>
        <div className="composer-note"><Sparkles size={16} /> Generation uses the saved audience, positioning, proof, voice, and claim guardrails for {project.name}.</div>
        {error && <p className="form-error">{error}</p>}
        <footer><button className="ghost-button" onClick={onClose}>Cancel</button><button className="primary-button" onClick={generate} disabled={loading || goal.trim().length < 10 || selected.length === 0}>{loading ? <LoaderCircle className="spin" size={17} /> : <Sparkles size={17} />}{loading ? "Generating real drafts…" : "Generate campaign"}</button></footer>
      </section>
    </div>
  );
}
