"use client";

import Image from "next/image";
import {
  ArrowRight,
  CalendarClock,
  Check,
  ChevronRight,
  CircleCheckBig,
  Gauge,
  Layers3,
  Menu,
  MessageSquareText,
  MousePointer2,
  PenTool,
  Play,
  Radio,
  ShieldCheck,
  Sparkles,
  Target,
  WandSparkles,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

const channels = ["LinkedIn", "Instagram", "Threads", "X", "Facebook"];

const features = [
  {
    icon: Target,
    number: "01",
    title: "A source of truth for every product",
    copy: "Give ProReach your positioning, audience, proof, voice, and guardrails once. Every campaign starts from facts—not a blank prompt.",
    className: "lp-feature-context",
  },
  {
    icon: WandSparkles,
    number: "02",
    title: "One brief becomes a complete campaign",
    copy: "Turn a timely goal into coordinated, channel-aware drafts with a clear thesis, visual direction, and publishing plan.",
    className: "lp-feature-campaign",
  },
  {
    icon: Layers3,
    number: "03",
    title: "Native to the channel—not copied across it",
    copy: "Shape the same idea for the rhythm of LinkedIn, Instagram, Threads, X, and Facebook without losing the core message.",
    className: "lp-feature-native",
  },
  {
    icon: ShieldCheck,
    number: "04",
    title: "Approval is part of the system",
    copy: "Review copy, refine the CTA, choose the destination, and approve the final version before anything can publish.",
    className: "lp-feature-approval",
  },
  {
    icon: CalendarClock,
    number: "05",
    title: "A calm path from draft to published",
    copy: "See what is in review, what is scheduled, and what has shipped—without rebuilding your plan in five separate tools.",
    className: "lp-feature-calendar",
  },
  {
    icon: PenTool,
    number: "06",
    title: "Visuals that respect the brand",
    copy: "Generate campaign visuals while keeping exact logos and critical brand elements crisp, controlled, and reusable.",
    className: "lp-feature-visual",
  },
];

const faqs = [
  {
    question: "What is ProReach?",
    answer: "ProReach is an approval-first AI marketing workspace. It turns saved product context into coordinated social campaigns, channel-specific drafts, visuals, schedules, and publish-ready posts.",
  },
  {
    question: "How is ProReach different from a generic AI writer?",
    answer: "A generic writer starts from each new prompt. ProReach starts from a reusable product source of truth—your customer, positioning, proof, brand voice, and constraints—so the output stays consistent across campaigns.",
  },
  {
    question: "Does ProReach publish automatically?",
    answer: "Not without your decision. ProReach is designed around human approval: you review and edit each draft, select the correct destination, and choose whether to publish now or schedule it.",
  },
  {
    question: "Which social channels does ProReach support?",
    answer: "The current workspace supports campaign variants and publishing workflows for LinkedIn, Instagram, Threads, X, and Facebook, subject to each platform connection and permission setup.",
  },
  {
    question: "Who is ProReach built for?",
    answer: "ProReach is built for founders, indie builders, lean marketing teams, and product marketers who need consistent multi-channel output without giving up factual accuracy or final creative control.",
  },
];

export function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const heroRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const elements = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      }),
      { threshold: 0.12 },
    );
    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, []);

  function moveHero(event: React.PointerEvent<HTMLElement>) {
    if (!heroRef.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const rect = heroRef.current.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    heroRef.current.style.setProperty("--pointer-x", `${event.clientX - rect.left}px`);
    heroRef.current.style.setProperty("--pointer-y", `${event.clientY - rect.top}px`);
    heroRef.current.style.setProperty("--tilt-x", `${x * 8}deg`);
    heroRef.current.style.setProperty("--tilt-y", `${y * -6}deg`);
  }

  function resetHero() {
    heroRef.current?.style.setProperty("--tilt-x", "0deg");
    heroRef.current?.style.setProperty("--tilt-y", "0deg");
  }

  return (
    <main className="lp-page">
      <div className="lp-progress" aria-hidden="true" />
      <header className="lp-nav-shell">
        <nav className="lp-nav" aria-label="Main navigation">
          <a className="lp-brand" href="#top" aria-label="ProReach home">
            <span><Image src="/logo.png" alt="" width={38} height={38} priority /></span>
            <strong>ProReach</strong>
          </a>
          <div className={menuOpen ? "lp-nav-links is-open" : "lp-nav-links"}>
            <a href="#product" onClick={() => setMenuOpen(false)}>Product</a>
            <a href="#workflow" onClick={() => setMenuOpen(false)}>How it works</a>
            <a href="#control" onClick={() => setMenuOpen(false)}>Why ProReach</a>
            <a href="#faq" onClick={() => setMenuOpen(false)}>FAQ</a>
          </div>
          <div className="lp-nav-actions">
            <a className="lp-signin" href="/login">Sign in</a>
            <a className="lp-nav-cta" href="/login">Open workspace <ArrowRight size={15} /></a>
          </div>
          <button className="lp-menu-button" type="button" aria-label={menuOpen ? "Close menu" : "Open menu"} aria-expanded={menuOpen} onClick={() => setMenuOpen((value) => !value)}>
            {menuOpen ? <X size={21} /> : <Menu size={21} />}
          </button>
        </nav>
      </header>

      <section id="top" className="lp-hero" ref={heroRef} onPointerMove={moveHero} onPointerLeave={resetHero}>
        <div className="lp-hero-grid" aria-hidden="true" />
        <div className="lp-orb lp-orb-one" aria-hidden="true" />
        <div className="lp-orb lp-orb-two" aria-hidden="true" />
        <div className="lp-hero-copy">
          <div className="lp-kicker" data-reveal>
            <span><Sparkles size={13} /></span>
            Approval-first AI marketing
            <i>Built for product truth</i>
          </div>
          <h1 data-reveal>
            Make your product<br />
            <span>impossible to ignore.</span>
          </h1>
          <p data-reveal>
            ProReach turns what you know about your product into focused campaigns, channel-native posts, and a publishing plan—while you keep the final say.
          </p>
          <div className="lp-hero-actions" data-reveal>
            <a className="lp-primary-cta" href="/login">Start building your reach <ArrowRight size={17} /></a>
            <a className="lp-secondary-cta" href="#workflow"><span><Play size={13} fill="currentColor" /></span> See the workflow</a>
          </div>
          <div className="lp-hero-proof" data-reveal>
            <span><Check size={14} /> Google sign-in</span>
            <span><Check size={14} /> Human approval</span>
            <span><Check size={14} /> Multi-channel</span>
          </div>
        </div>

        <div className="lp-hero-visual" aria-label="ProReach campaign workspace preview">
          <div className="lp-visual-glow" aria-hidden="true" />
          <div className="lp-product-window">
            <div className="lp-window-top">
              <div className="lp-window-dots"><i /><i /><i /></div>
              <span>proreach / campaign studio</span>
              <div className="lp-live-pill"><i /> Approval mode</div>
            </div>
            <div className="lp-window-layout">
              <aside className="lp-demo-sidebar">
                <div className="lp-demo-logo">PR</div>
                <i className="active" /><i /><i /><i /><i />
              </aside>
              <div className="lp-demo-main">
                <header>
                  <div><small>CAMPAIGN / 01</small><strong>Launch the signal</strong></div>
                  <button type="button"><WandSparkles size={11} /> Generate</button>
                </header>
                <div className="lp-demo-stats">
                  <article><span>Drafts</span><strong>12</strong><small>5 channels</small></article>
                  <article><span>In review</span><strong>04</strong><small>Needs your eye</small></article>
                  <article><span>Scheduled</span><strong>08</strong><small>Next 7 days</small></article>
                </div>
                <div className="lp-demo-content">
                  <article className="lp-demo-post">
                    <div className="lp-demo-post-head"><span>in</span><p><strong>LinkedIn</strong><small>Founder perspective</small></p><em>Review</em></div>
                    <h3>Your product doesn&apos;t need more content.</h3>
                    <p>It needs one clear idea, expressed with enough truth that people remember it.</p>
                    <div className="lp-copy-lines"><i /><i /><i /></div>
                    <footer><button type="button">Edit draft</button><button type="button"><Check size={10} /> Approve</button></footer>
                  </article>
                  <article className="lp-demo-calendar">
                    <header><CalendarClock size={13} /><strong>Publishing pulse</strong></header>
                    <div><span>WED</span><p><b>Product truth carousel</b><small>Instagram · 12:00</small></p><i /></div>
                    <div><span>THU</span><p><b>Founder point of view</b><small>Threads · 17:30</small></p><i /></div>
                    <div><span>FRI</span><p><b>Launch narrative</b><small>LinkedIn · 10:00</small></p><i /></div>
                  </article>
                </div>
              </div>
            </div>
          </div>

          <div className="lp-float-card lp-float-context">
            <span><Target size={15} /></span>
            <p><small>PRODUCT CONTEXT</small><strong>Voice & proof locked</strong></p>
          </div>
          <div className="lp-float-card lp-float-approved">
            <span><CircleCheckBig size={15} /></span>
            <p><small>READY TO REACH</small><strong>Campaign approved</strong></p>
          </div>
          <div className="lp-cursor-tag" aria-hidden="true"><MousePointer2 size={13} fill="currentColor" /> You decide</div>
        </div>
      </section>

      <section className="lp-channel-strip" aria-label="Supported social channels">
        <p>Built to carry one clear idea across every channel</p>
        <div className="lp-marquee">
          <div>
            {[...channels, ...channels].map((channel, index) => <span key={`${channel}-${index}`}><i>{channel === "LinkedIn" ? "in" : channel[0]}</i>{channel}</span>)}
          </div>
        </div>
      </section>

      <section id="product" className="lp-section lp-problem-section">
        <div className="lp-section-heading" data-reveal>
          <span className="lp-section-index">01 / PRODUCT INTELLIGENCE</span>
          <h2>More content isn&apos;t the answer.<br /><em>More coherence is.</em></h2>
          <p>Most marketing tools help you produce faster. ProReach helps every piece belong to the same product story.</p>
        </div>
        <div className="lp-contrast-grid" data-reveal>
          <article className="lp-before-card">
            <header><span>WITHOUT CONTEXT</span><em>Fragmented</em></header>
            <div className="lp-chaos-map" aria-hidden="true">
              <i className="lp-chaos-one">Generic prompt</i><i className="lp-chaos-two">Different voice</i><i className="lp-chaos-three">Unverified claim</i><i className="lp-chaos-four">Copy + paste</i>
              <span />
            </div>
            <h3>Every post starts over.</h3>
            <p>Scattered prompts create scattered positioning, repeated edits, and messages that sound like everyone else.</p>
          </article>
          <article className="lp-after-card">
            <header><span>WITH PROREACH</span><em><i /> Coherent</em></header>
            <div className="lp-truth-core" aria-hidden="true">
              <div><Sparkles size={19} /><strong>Product truth</strong><small>One reusable context</small></div>
              <span className="lp-ray-one" /><span className="lp-ray-two" /><span className="lp-ray-three" />
              <i className="lp-output-one">LinkedIn</i><i className="lp-output-two">Instagram</i><i className="lp-output-three">Threads</i>
            </div>
            <h3>Every campaign compounds.</h3>
            <p>Your audience, voice, proof, and positioning travel with every brief—so speed never costs consistency.</p>
          </article>
        </div>
      </section>

      <section className="lp-section lp-feature-section">
        <div className="lp-section-heading lp-centered" data-reveal>
          <span className="lp-section-index">02 / ONE CONNECTED WORKFLOW</span>
          <h2>Everything between the idea<br />and <em>“it&apos;s live.”</em></h2>
          <p>A focused operating system for product marketing—not another infinite canvas of disconnected AI tools.</p>
        </div>
        <div className="lp-feature-grid">
          {features.map(({ icon: Icon, number, title, copy, className }) => (
            <article className={`lp-feature-card ${className}`} key={number} data-reveal>
              <header><span><Icon size={19} /></span><i>{number}</i></header>
              <h3>{title}</h3>
              <p>{copy}</p>
              <div className="lp-feature-art" aria-hidden="true" />
            </article>
          ))}
        </div>
      </section>

      <section id="workflow" className="lp-section lp-workflow-section">
        <div className="lp-workflow-sticky" data-reveal>
          <span className="lp-section-index">03 / HOW IT WORKS</span>
          <h2>From what you know<br />to where they scroll.</h2>
          <p>Four deliberate steps replace the usual cycle of prompting, copying, correcting, and chasing approvals.</p>
          <a href="/login">Build your first campaign <ArrowRight size={16} /></a>
        </div>
        <ol className="lp-workflow-list">
          <li data-reveal><span>01</span><div><Target size={20} /><h3>Teach the product truth</h3><p>Capture who the product is for, what makes it different, which claims are verified, and how the brand should sound.</p></div></li>
          <li data-reveal><span>02</span><div><Sparkles size={20} /><h3>Set the campaign focus</h3><p>Add the current goal and timely angle. ProReach turns that brief into a coordinated campaign instead of isolated posts.</p></div></li>
          <li data-reveal><span>03</span><div><MessageSquareText size={20} /><h3>Shape every channel</h3><p>Review platform-native copy, CTAs, hashtags, media direction, and channel variants in one draft studio.</p></div></li>
          <li data-reveal><span>04</span><div><Radio size={20} /><h3>Approve, schedule, reach</h3><p>Choose the right account, make the final call, and move approved work into a visible publishing calendar.</p></div></li>
        </ol>
      </section>

      <section id="control" className="lp-control-section">
        <div className="lp-control-orbit" aria-hidden="true"><i /><i /><i /></div>
        <div className="lp-control-copy" data-reveal>
          <span className="lp-section-index">04 / HUMAN CONTROL, BY DESIGN</span>
          <h2>AI moves fast.<br /><em>Your judgment stays final.</em></h2>
          <p>ProReach is intentionally approval-first. The system can draft, adapt, organize, and prepare—but publishing remains a human decision.</p>
          <ul>
            <li><Check size={15} /> Reviewable copy and hashtags</li>
            <li><Check size={15} /> Explicit publishing destination</li>
            <li><Check size={15} /> Clear draft-to-live status</li>
            <li><Check size={15} /> No silent autopublishing</li>
          </ul>
        </div>
        <div className="lp-control-panel" data-reveal>
          <div className="lp-approval-card">
            <header><div><span>in</span><p><strong>LinkedIn launch post</strong><small>Prepared from Product Context v3</small></p></div><em>Awaiting you</em></header>
            <blockquote>“The strongest product story isn&apos;t the loudest one. It&apos;s the one every channel tells consistently.”</blockquote>
            <div className="lp-approval-meta"><span>#ProductMarketing</span><span>#BuildInPublic</span></div>
            <footer><button type="button">Edit draft</button><button type="button"><ShieldCheck size={14} /> Approve & choose timing</button></footer>
          </div>
          <div className="lp-safety-note"><ShieldCheck size={16} /><p><strong>Approval boundary active</strong><small>Nothing publishes until you choose the destination and timing.</small></p></div>
        </div>
      </section>

      <section className="lp-section lp-outcomes-section">
        <div className="lp-section-heading" data-reveal>
          <span className="lp-section-index">05 / BUILT FOR LEAN TEAMS</span>
          <h2>Feel like a marketing team.<br /><em>Stay as focused as a founder.</em></h2>
        </div>
        <div className="lp-outcome-grid">
          <article data-reveal><Gauge size={22} /><span>Move with clarity</span><h3>Less blank-page time.</h3><p>Start campaigns from saved context and a current goal instead of rebuilding the brief every week.</p></article>
          <article data-reveal><Layers3 size={22} /><span>Stay recognizable</span><h3>One product story.</h3><p>Carry the same positioning and proof across channels without making every post feel identical.</p></article>
          <article data-reveal><ShieldCheck size={22} /><span>Keep control</span><h3>No surprise publishing.</h3><p>Give automation the repetitive work while keeping human judgment at the moments that matter.</p></article>
        </div>
      </section>

      <section id="faq" className="lp-section lp-faq-section">
        <div className="lp-faq-heading" data-reveal>
          <span className="lp-section-index">06 / QUESTIONS, ANSWERED</span>
          <h2>What teams ask<br />before they reach.</h2>
          <p>Clear answers about the product, workflow, and control model.</p>
        </div>
        <div className="lp-faq-list" data-reveal>
          {faqs.map((faq, index) => (
            <details key={faq.question} open={index === 0}>
              <summary><span>{String(index + 1).padStart(2, "0")}</span>{faq.question}<i><ChevronRight size={17} /></i></summary>
              <p>{faq.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="lp-final-cta">
        <div className="lp-final-noise" aria-hidden="true" />
        <div className="lp-final-orb" aria-hidden="true" />
        <div data-reveal>
          <span><Sparkles size={14} /> Your product already has a story</span>
          <h2>Give it the reach<br />it deserves.</h2>
          <p>Build the source of truth. Create the campaign. Keep the final say.</p>
          <a href="/login">Enter your workspace <ArrowRight size={18} /></a>
        </div>
      </section>

      <footer className="lp-footer">
        <div className="lp-footer-brand">
          <a className="lp-brand" href="#top"><span><Image src="/logo.png" alt="" width={38} height={38} /></span><strong>ProReach</strong></a>
          <p>Approval-first AI marketing for products worth remembering.</p>
        </div>
        <div><strong>Product</strong><a href="#product">Capabilities</a><a href="#workflow">Workflow</a><a href="#control">Approval model</a></div>
        <div><strong>Access</strong><a href="/login">Sign in</a><a href="/login">Open workspace</a></div>
        <div><strong>Legal</strong><a href="/privacy">Privacy</a><a href="/terms">Terms</a></div>
        <p className="lp-footer-bottom">© {new Date().getFullYear()} ProReach. Built for thoughtful growth.</p>
      </footer>
    </main>
  );
}
