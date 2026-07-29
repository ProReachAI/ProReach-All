"use client";

import { ArrowLeft, ArrowRight, Check, ImagePlus, LoaderCircle, X } from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import type { ProductProject } from "@/lib/types";

type ProjectForm = {
  name: string;
  websiteUrl: string;
  oneLiner: string;
  description: string;
  problemStatement: string;
  solution: string;
  targetAudience: string;
  audiencePainPoints: string;
  useCases: string;
  keyFeatures: string;
  differentiators: string;
  proofPoints: string;
  competitors: string;
  brandVoice: string;
  toneGuidelines: string;
  wordsToUse: string;
  wordsToAvoid: string;
  primaryGoal: string;
  primaryCta: string;
  additionalContext: string;
};

const emptyForm: ProjectForm = {
  name: "", websiteUrl: "", oneLiner: "", description: "", problemStatement: "", solution: "",
  targetAudience: "", audiencePainPoints: "", useCases: "", keyFeatures: "", differentiators: "",
  proofPoints: "", competitors: "", brandVoice: "", toneGuidelines: "", wordsToUse: "",
  wordsToAvoid: "", primaryGoal: "", primaryCta: "", additionalContext: "",
};

function fromProject(project?: ProductProject | null): ProjectForm {
  if (!project) return emptyForm;
  return {
    name: project.name,
    websiteUrl: project.websiteUrl ?? "",
    oneLiner: project.oneLiner,
    description: project.description,
    problemStatement: project.problemStatement,
    solution: project.solution,
    targetAudience: project.targetAudience,
    audiencePainPoints: project.audiencePainPoints,
    useCases: project.useCases,
    keyFeatures: project.keyFeatures.join("\n"),
    differentiators: project.differentiators,
    proofPoints: project.proofPoints,
    competitors: project.competitors,
    brandVoice: project.brandVoice,
    toneGuidelines: project.toneGuidelines,
    wordsToUse: project.wordsToUse.join("\n"),
    wordsToAvoid: project.wordsToAvoid.join("\n"),
    primaryGoal: project.primaryGoal,
    primaryCta: project.primaryCta,
    additionalContext: project.additionalContext,
  };
}

const steps = [
  { label: "Product", caption: "What it is and does" },
  { label: "Customer", caption: "Who needs it and why" },
  { label: "Positioning", caption: "Features, difference, proof" },
  { label: "Voice", caption: "How the brand should speak" },
];

function lines(value: string) {
  return value.split(/\n|,/).map((item) => item.trim()).filter(Boolean);
}

export function ProjectSetup({ project, onClose, onSaved }: {
  project?: ProductProject | null;
  onClose: () => void;
  onSaved: (project: ProductProject) => void;
}) {
  const [form, setForm] = useState(() => fromProject(project));
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(project?.logoUrl ?? null);
  const isEditing = Boolean(project);

  useEffect(() => () => {
    if (logoPreview?.startsWith("blob:")) URL.revokeObjectURL(logoPreview);
  }, [logoPreview]);

  const stepComplete = useMemo(() => {
    if (step === 0) return form.name.trim().length >= 2 && form.oneLiner.trim().length >= 10 && form.description.trim().length >= 30;
    if (step === 1) return form.problemStatement.trim().length >= 20 && form.solution.trim().length >= 20 && form.targetAudience.trim().length >= 20 && form.audiencePainPoints.trim().length >= 20;
    if (step === 2) return lines(form.keyFeatures).length > 0 && form.differentiators.trim().length >= 20 && form.proofPoints.trim().length >= 10;
    return form.brandVoice.trim().length >= 10 && form.primaryGoal.trim().length >= 10 && form.primaryCta.trim().length >= 5;
  }, [form, step]);

  function field(name: keyof ProjectForm, value: string) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function save() {
    setLoading(true); setError(null);
    try {
      const payload = {
        ...form,
        keyFeatures: lines(form.keyFeatures),
        wordsToUse: lines(form.wordsToUse),
        wordsToAvoid: lines(form.wordsToAvoid),
      };
      const response = await fetch(project ? `/api/projects/${project.id}` : "/api/projects", {
        method: project ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      let result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Project could not be saved.");
      if (logoFile) {
        const upload = new FormData();
        upload.set("logo", logoFile);
        const logoResponse = await fetch(`/api/projects/${result.project.id}/logo`, { method: "POST", body: upload });
        result = await logoResponse.json();
        if (!logoResponse.ok) throw new Error(result.error ?? "The project was saved, but its logo could not be uploaded.");
      }
      onSaved(result.project);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Project could not be saved.");
    } finally { setLoading(false); }
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="project-wizard" role="dialog" aria-modal="true" aria-label={isEditing ? "Edit project context" : "Create project"}>
        <header className="wizard-header">
          <div><span className="eyebrow">{isEditing ? "PRODUCT CONTEXT" : "NEW PROJECT"}</span><h2>{isEditing ? `Keep ${project?.name} accurate.` : "Teach BuildToReach the product truth."}</h2><p>This context becomes the factual boundary for every generated post.</p></div>
          <button className="icon-button" onClick={onClose} aria-label="Close project setup"><X size={18} /></button>
        </header>

        <div className="wizard-layout">
          <ol className="wizard-steps">
            {steps.map((item, index) => <li className={index === step ? "active" : index < step ? "done" : ""} key={item.label}><span>{index < step ? <Check size={13} /> : index + 1}</span><div><strong>{item.label}</strong><small>{item.caption}</small></div></li>)}
          </ol>

          <div className="wizard-body">
            {step === 0 && <>
              <div className="form-grid project-form-grid">
                <Input label="Product name" value={form.name} onChange={(value) => field("name", value)} required placeholder="Your product name" />
                <Input label="Website" value={form.websiteUrl} onChange={(value) => field("websiteUrl", value)} placeholder="https://…" />
                <label className="wide brand-logo-field">
                  Brand logo <small>Recommended · PNG, JPEG or WebP · max 5 MB</small>
                  <span className="brand-logo-picker">
                    <span className="brand-logo-preview">
                      {logoPreview ? <Image unoptimized src={logoPreview} alt="Brand logo preview" width={58} height={50} /> : <ImagePlus size={24} />}
                    </span>
                    <span className="brand-logo-copy">
                      <strong>{logoFile?.name ?? (project?.logoUrl ? "Current brand logo" : "Upload your exact logo")}</strong>
                      <em>We place this asset after AI generation, so it stays sharp and accurate.</em>
                    </span>
                    <span className="outline-button">{logoPreview ? "Replace" : "Choose file"}</span>
                    <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => {
                      const file = event.target.files?.[0] ?? null;
                      if (file && file.size > 5 * 1024 * 1024) {
                        setError("The logo must be smaller than 5 MB.");
                        event.target.value = "";
                        return;
                      }
                      setError(null);
                      setLogoFile(file);
                      setLogoPreview(file ? URL.createObjectURL(file) : project?.logoUrl ?? null);
                    }} />
                  </span>
                </label>
                <TextArea wide label="One-line promise" value={form.oneLiner} onChange={(value) => field("oneLiner", value)} required placeholder="What outcome does the product create, for whom?" />
                <TextArea wide label="Product description" value={form.description} onChange={(value) => field("description", value)} required placeholder="Explain what the product does, how it works, and its current stage." />
              </div>
            </>}
            {step === 1 && <div className="form-grid project-form-grid">
              <TextArea label="Problem" value={form.problemStatement} onChange={(value) => field("problemStatement", value)} required placeholder="What painful situation exists before the product?" />
              <TextArea label="Solution" value={form.solution} onChange={(value) => field("solution", value)} required placeholder="How does the product resolve that situation?" />
              <TextArea label="Target audience" value={form.targetAudience} onChange={(value) => field("targetAudience", value)} required placeholder="Roles, company stage, behavior, and relevant context." />
              <TextArea label="Audience pain points" value={form.audiencePainPoints} onChange={(value) => field("audiencePainPoints", value)} required placeholder="Specific frustrations, objections, and failed alternatives." />
              <TextArea wide label="Primary use cases" value={form.useCases} onChange={(value) => field("useCases", value)} placeholder="Real moments when someone reaches for the product." />
            </div>}
            {step === 2 && <div className="form-grid project-form-grid">
              <TextArea label="Key features" hint="One per line" value={form.keyFeatures} onChange={(value) => field("keyFeatures", value)} required placeholder={"Core workflow\nImportant capability\nControl or integration"} />
              <TextArea label="Differentiators" value={form.differentiators} onChange={(value) => field("differentiators", value)} required placeholder="Why choose this instead of the current alternative?" />
              <TextArea wide label="Verified proof points" value={form.proofPoints} onChange={(value) => field("proofPoints", value)} required placeholder="Only facts AI may claim: shipped capabilities, measured results, real testimonials, or honest product status." />
              <TextArea wide label="Competitors or alternatives" value={form.competitors} onChange={(value) => field("competitors", value)} placeholder="Products, manual workflows, or doing nothing." />
            </div>}
            {step === 3 && <div className="form-grid project-form-grid">
              <TextArea label="Brand voice" value={form.brandVoice} onChange={(value) => field("brandVoice", value)} required placeholder="How should the writing sound? Include 3–5 traits." />
              <TextArea label="Tone guidelines" value={form.toneGuidelines} onChange={(value) => field("toneGuidelines", value)} placeholder="Sentence style, formatting, humour, technical depth." />
              <TextArea label="Preferred words" hint="One per line" value={form.wordsToUse} onChange={(value) => field("wordsToUse", value)} placeholder="Words and phrases that feel like your brand." />
              <TextArea label="Words to avoid" hint="One per line" value={form.wordsToAvoid} onChange={(value) => field("wordsToAvoid", value)} placeholder="Hype, jargon, and claims you never want used." />
              <TextArea label="Primary marketing goal" value={form.primaryGoal} onChange={(value) => field("primaryGoal", value)} required placeholder="The default business outcome for content." />
              <TextArea label="Default CTA" value={form.primaryCta} onChange={(value) => field("primaryCta", value)} required placeholder="The natural next step a qualified reader should take." />
              <TextArea wide label="Additional context" value={form.additionalContext} onChange={(value) => field("additionalContext", value)} placeholder="Pricing, launch stage, geography, constraints, or current priorities." />
            </div>}
            {error && <p className="form-error wizard-error">{error}</p>}
          </div>
        </div>

        <footer className="wizard-footer">
          <button className="ghost-button" onClick={step === 0 ? onClose : () => setStep((value) => value - 1)}>{step === 0 ? "Cancel" : <><ArrowLeft size={15} /> Back</>}</button>
          {step < steps.length - 1
            ? <button className="primary-button" disabled={!stepComplete} onClick={() => setStep((value) => value + 1)}>Continue <ArrowRight size={15} /></button>
            : <button className="primary-button" disabled={!stepComplete || loading} onClick={save}>{loading ? <LoaderCircle className="spin" size={16} /> : <Check size={16} />}{loading ? "Saving…" : isEditing ? "Save context" : "Create project"}</button>}
        </footer>
      </section>
    </div>
  );
}

function Input({ label, value, onChange, placeholder, required }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; required?: boolean }) {
  return <label>{label}{required && <b>*</b>}<input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} /></label>;
}

function TextArea({ label, value, onChange, placeholder, required, wide, hint }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; required?: boolean; wide?: boolean; hint?: string }) {
  return <label className={wide ? "wide" : undefined}>{label}{required && <b>*</b>}{hint && <small>{hint}</small>}<textarea value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} /></label>;
}
