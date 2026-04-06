"use client"

import { useState, type CSSProperties } from "react"
import Link from "next/link"
import { useSiteReveal } from "@/app/components/useSiteReveal"

const PAGE_STYLE = { "--page-accent": "#4f7cff" } as CSSProperties

const CAPABILITIES = [
  {
    title: "Design Engine",
    href: "/engine",
    body: "A room-planning workflow for acoustics, seating, speakers, screen, lighting, and reporting.",
    tags: ["Room", "Treatment", "Layout"],
    cta: "Open Tool",
    photo: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=75&auto=format&fit=crop",
  },
  {
    title: "Knowledge Base",
    href: "/knowledge",
    body: "Technical guidance on acoustics, speakers, room planning, and practical home theater decisions.",
    tags: ["Acoustics", "Speakers", "Planning"],
    cta: "Explore",
    photo: "https://images.unsplash.com/photo-1545558014-8692077e9b5c?w=800&q=75&auto=format&fit=crop",
  },
  {
    title: "Learning Paths",
    href: "/learn",
    body: "Structured learning paths for building understanding step by step, from first principles to advanced design.",
    tags: ["Paths", "Progress", "Practice"],
    cta: "Start Learning",
    photo: "https://images.unsplash.com/photo-1524178232363-1fb2b075b655?w=800&q=75&auto=format&fit=crop",
  },
]

const ENGINE_STEPS = [
  {
    step: "01",
    title: "Room dimensions",
    body: "Start with the room envelope and define the physical limits before any other decisions are made.",
  },
  {
    step: "02",
    title: "Acoustic treatment",
    body: "Set the treatment strategy before placement decisions are locked in — absorption, bass traps, diffusion.",
  },
  {
    step: "03",
    title: "Seating & speaker layout",
    body: "Coordinate seating and speaker positions so listening and viewing geometry work together.",
  },
  {
    step: "04",
    title: "Screen, lighting, visuals",
    body: "Define the visual side of the room with screen sizing, throw distance, and lighting decisions.",
  },
  {
    step: "05",
    title: "Summary and PDF report",
    body: "Review the full design in-app and export a detailed PDF report you can actually use.",
  },
  {
    step: "06",
    title: "Calibration and tuning",
    body: "Validate the design with measurements and iteratively refine where room response needs attention.",
  },
]

const INSIGHTS = [
  {
    tag: "Platform",
    title: "Knowledge supports every design decision",
    body: "Move from concepts like room modes and reflections straight into planning decisions.",
    size: "large",
    photo: "https://images.unsplash.com/photo-1593359677879-a4bb92f4834d?w=1000&q=75&auto=format&fit=crop",
  },
  {
    tag: "Learning",
    title: "Structured paths build real confidence",
    body: "From fundamentals to advanced calibration — five tracks, each with a clear outcome.",
    size: "small",
    photo: "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=800&q=75&auto=format&fit=crop",
  },
  {
    tag: "Resources",
    title: "Calculators and references add depth",
    body: "Validate the details with room mode calculators, RT60 tools, and standards references.",
    size: "small",
    photo: "https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=800&q=75&auto=format&fit=crop",
  },
]

const FAQS = [
  {
    q: "How is speaker layout determined?",
    a: "Speaker placement is derived from room geometry, listening position, and international standards including Dolby Atmos and THX guidelines. The Design Engine calculates optimal angles and positions for each channel.",
  },
  {
    q: "What does acoustic treatment actually do?",
    a: "Treatment controls how sound behaves in the room — reducing modal resonances, flutter echo, and excess reverb. Correct treatment placement before equipment upgrades is always the higher-value decision.",
  },
  {
    q: "How do I determine the right screen size and placement?",
    a: "Screen sizing uses SMPTE and THX viewing angle standards relative to your primary seating row. The Design Engine factors in throw ratio, aspect ratio, and room width to give a precise recommendation.",
  },
  {
    q: "Can I use the platform without a dedicated room?",
    a: "Yes. The platform is designed for both dedicated rooms and media room conversions. The Knowledge Base and Design Engine account for real-world constraints including existing drywall, limited treatment options, and budget.",
  },
]

export default function HomePage() {
  useSiteReveal()
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  return (
    <main className="site-shell" style={PAGE_STYLE}>

      {/* ── layout-only extras ── */}
      <style>{`
        .hp-hero-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 52px;
          align-items: center;
        }
        @media (max-width: 768px) {
          .hp-hero-grid { grid-template-columns: 1fr; gap: 28px; }
          .hp-hero-photo { order: -1; height: 260px !important; }
        }
        .hp-hero-photo {
          height: 420px;
          border-radius: 20px;
          overflow: hidden;
          border: 1px solid rgba(255,255,255,0.44);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.88), 0 24px 48px rgba(70,80,92,0.10);
          position: relative;
        }
        .hp-hero-photo img { width:100%; height:100%; object-fit:cover; display:block; }
        .hp-hero-photo-label {
          position: absolute;
          bottom: 14px;
          left: 14px;
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: rgba(255,255,255,0.8);
          background: rgba(0,0,0,0.36);
          backdrop-filter: blur(8px);
          padding: 5px 10px;
          border-radius: 999px;
        }

        .hp-trust {
          padding: 26px 0;
          border-bottom: 1px solid var(--site-border-soft);
        }
        .hp-trust-label {
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: var(--site-text-soft);
          text-align: center;
          margin-bottom: 18px;
          opacity: 0.7;
        }
        .hp-trust-row {
          display: flex;
          justify-content: center;
          flex-wrap: wrap;
          gap: 8px 28px;
        }
        .hp-trust-item {
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: rgba(29,34,40,0.32);
        }

        .hp-cap-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 14px;
        }
        @media (max-width: 768px) { .hp-cap-grid { grid-template-columns: 1fr; } }

        .hp-cap-photo {
          height: 110px;
          border-radius: 14px;
          overflow: hidden;
          border: 1px solid rgba(29,34,40,0.06);
          margin: 4px 0;
        }
        .hp-cap-photo img { width:100%; height:100%; object-fit:cover; display:block; }

        .hp-process-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
        }
        @media (max-width: 768px) { .hp-process-grid { grid-template-columns: 1fr; } }

        .hp-insights-grid {
          display: grid;
          grid-template-columns: 1.4fr 1fr;
          grid-template-rows: auto auto;
          gap: 14px;
        }
        @media (max-width: 768px) { .hp-insights-grid { grid-template-columns: 1fr; } }

        .hp-insight {
          border-radius: 20px;
          overflow: hidden;
          border: 1px solid rgba(255,255,255,0.44);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.86), 0 16px 32px rgba(70,80,92,0.08);
          position: relative;
        }
        .hp-insight.is-large { grid-row: span 2; min-height: 460px; display:flex; flex-direction:column; justify-content:flex-end; }
        .hp-insight.is-small { min-height: 210px; display:flex; flex-direction:column; justify-content:flex-end; }
        .hp-insight-bg { position:absolute; inset:0; }
        .hp-insight-bg img { width:100%; height:100%; object-fit:cover; display:block; }
        .hp-insight-bg::after {
          content:'';
          position:absolute;
          inset:0;
          background: linear-gradient(to bottom, rgba(10,12,16,0.02) 0%, rgba(10,12,16,0.64) 100%);
        }
        .hp-insight-content { position:relative; padding:20px; }
        .hp-insight-tag {
          display: inline-block;
          margin-bottom: 8px;
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: rgba(255,255,255,0.72);
          background: rgba(255,255,255,0.14);
          backdrop-filter: blur(8px);
          padding: 4px 9px;
          border-radius: 999px;
        }
        .hp-insight-title {
          font-size: 17px;
          font-weight: 700;
          color: #fff;
          line-height: 1.28;
          margin-bottom: 8px;
          letter-spacing: -0.02em;
        }
        .hp-insight.is-small .hp-insight-title { font-size: 14px; }
        .hp-insight-body { font-size: 12px; line-height: 1.62; color: rgba(255,255,255,0.64); }

        .hp-faq-list { max-width: 720px; margin: 0 auto; border-top: 1px solid var(--site-border-soft); }
        .hp-faq-item { border-bottom: 1px solid var(--site-border-soft); }
        .hp-faq-q {
          width:100%; background:none; border:none; text-align:left;
          padding: 18px 0;
          display:flex; align-items:center; justify-content:space-between; gap:16px;
          cursor:pointer;
          font-family: inherit;
          font-size: 14px;
          font-weight: 500;
          color: var(--site-text);
          transition: color 0.16s;
        }
        .hp-faq-q:hover { color: #000; }
        .hp-faq-chevron { font-size:13px; color: var(--site-text-soft); transition:transform 0.22s; flex-shrink:0; }
        .hp-faq-chevron.is-open { transform: rotate(180deg); }
        .hp-faq-a { font-size:13px; line-height:1.72; color:var(--site-text-muted); padding-bottom:18px; max-width:640px; }
        .hp-faq-contact { text-align:center; margin-top:28px; font-size:12px; color:var(--site-text-soft); }
        .hp-faq-contact a { color:var(--site-text); font-weight:600; }

        .hp-cta-grid {
          display: grid;
          grid-template-columns: 0.9fr 1.1fr;
          gap: 60px;
          align-items: center;
        }
        @media (max-width: 768px) {
          .hp-cta-grid { grid-template-columns: 1fr; }
          .hp-cta-photo { display: none; }
        }
        .hp-cta-photo {
          height: 340px;
          border-radius: 20px;
          overflow: hidden;
          border: 1px solid rgba(255,255,255,0.44);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.88), 0 22px 44px rgba(70,80,92,0.09);
        }
        .hp-cta-photo img { width:100%; height:100%; object-fit:cover; display:block; }

        /* ── INTRO BANNER ── */
        .hp-intro {
          border-bottom: 1px solid var(--site-border-soft);
          background: linear-gradient(180deg, rgba(255,255,255,0.32), rgba(255,255,255,0.10));
          backdrop-filter: blur(18px) saturate(150%);
          -webkit-backdrop-filter: blur(18px) saturate(150%);
        }
        .hp-intro-inner {
          padding: 48px 0 44px;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: 20px;
        }
        .hp-intro-tag {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          color: color-mix(in srgb, var(--page-accent) 62%, var(--site-text));
          padding: 6px 14px;
          border-radius: 999px;
          border: 1px solid color-mix(in srgb, var(--page-accent) 18%, rgba(255,255,255,0.46));
          background:
            linear-gradient(180deg, rgba(255,255,255,0.38), rgba(255,255,255,0.14)),
            linear-gradient(90deg, color-mix(in srgb, var(--page-accent) 12%, transparent), transparent 72%);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.86), 0 10px 18px rgba(84,90,98,0.05);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
        }
        .hp-intro-headline {
          font-size: clamp(13px, 1.6vw, 17px);
          font-weight: 600;
          color: var(--site-text);
          letter-spacing: -0.01em;
          max-width: 560px;
          line-height: 1.45;
        }
        .hp-intro-desc {
          font-size: 13px;
          line-height: 1.72;
          color: var(--site-text-muted);
          max-width: 580px;
        }
        .hp-intro-stats {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 10px 0;
        }
        .hp-intro-stat {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 20px;
          border-radius: 999px;
          border: 1px solid color-mix(in srgb, var(--page-accent) 14%, rgba(255,255,255,0.38));
          background:
            linear-gradient(180deg, rgba(255,255,255,0.30), rgba(255,255,255,0.12)),
            linear-gradient(90deg, color-mix(in srgb, var(--page-accent) 8%, transparent), transparent 70%);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.84), 0 8px 16px rgba(84,90,98,0.04);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
        }
        .hp-intro-stat + .hp-intro-stat {
          border-left: none;
          border-top-left-radius: 0;
          border-bottom-left-radius: 0;
          margin-left: -1px;
        }
        .hp-intro-stat:first-child {
          border-top-right-radius: 0;
          border-bottom-right-radius: 0;
        }
        .hp-intro-stat:not(:first-child):not(:last-child) {
          border-radius: 0;
          border-left: none;
        }
        .hp-intro-stat-num {
          font-size: 18px;
          font-weight: 700;
          color: var(--site-text);
          letter-spacing: -0.02em;
          line-height: 1;
        }
        .hp-intro-stat-label {
          font-size: 11px;
          font-weight: 500;
          color: var(--site-text-soft);
          line-height: 1.3;
          text-align: left;
        }
        .hp-intro-stat-div {
          width: 1px;
          height: 28px;
          background: rgba(29,34,40,0.1);
          align-self: center;
          display: none;
        }
        @media (max-width: 640px) {
          .hp-intro-stats { gap: 8px; }
          .hp-intro-stat { border-radius: 999px !important; border-left: 1px solid color-mix(in srgb, var(--page-accent) 14%, rgba(255,255,255,0.38)) !important; margin-left: 0 !important; }
        }
      `}</style>

      {/* ── INTRO BANNER ── */}
      <div className="hp-intro" style={{ paddingTop: 72 }}>
        <div className="site-container site-container--narrow px-6">
          <div className="hp-intro-inner" data-reveal>

            <span className="hp-intro-tag">
              <span className="site-badge-dot site-pulse-dot" style={{ width: 7, height: 7 }} />
              Home Theater Design Platform
            </span>

            <p className="hp-intro-headline">
              The complete platform for acoustics, planning, and execution —<br className="hidden sm:block" />
              from room physics to a finished design you can build.
            </p>

            <p className="hp-intro-desc">
              Science of Sound brings together a structured knowledge base, guided learning paths,
              precision calculators, and a full room design engine — built on measurement and
              international standards, not guesswork.
            </p>

            <div className="hp-intro-stats">
              {[
                { num: "5",  label: "Learning\nPaths"       },
                { num: "8",  label: "Knowledge\nTopics"     },
                { num: "15", label: "Calculators\n& Tools"  },
                { num: "6",  label: "Design Engine\nSteps"  },
              ].map((s, i, arr) => (
                <div key={s.num} className="hp-intro-stat">
                  <span className="hp-intro-stat-num">{s.num}</span>
                  <span className="hp-intro-stat-label" style={{ whiteSpace: "pre-line" }}>{s.label}</span>
                  {i < arr.length - 1 && <span className="hp-intro-stat-div" />}
                </div>
              ))}
            </div>

          </div>
        </div>
      </div>

      {/* ── HERO ── */}
      <section className="site-hero">
        <div className="site-container site-container--narrow px-6 py-16 md:py-20">
          <div className="hp-hero-grid">

            <div data-reveal="left">
              <p className="site-eyebrow">Science of Sound</p>
              <h1 className="site-title site-title--medium" style={{ marginBottom: 18 }}>
                Home Theater<br />
                <span className="site-title-strong">Design. Done Right.</span>
              </h1>
              <p className="site-copy" style={{ fontSize: 16, maxWidth: 460, marginBottom: 30 }}>
                Measurement-based planning for high-performance private theaters.
                We coordinate room geometry, acoustics, seating, speakers, screen,
                and lighting into one clear design — using physics, not product bias.
              </p>
              <div className="site-button-row">
                <Link href="/engine" className="site-button">Open Design Tool →</Link>
                <Link href="/knowledge" className="site-button--ghost">Explore Platform</Link>
              </div>
            </div>

            <div className="hp-hero-photo" data-reveal="right">
              <img
                src="https://images.unsplash.com/photo-1593359677879-a4bb92f4834d?w=1200&q=80&auto=format&fit=crop"
                alt="Home theater reference design"
                loading="eager"
              />
              <span className="hp-hero-photo-label">Home Theater — Reference Design</span>
            </div>

          </div>
        </div>
      </section>

      {/* ── TRUST STRIP ── */}
      <div className="hp-trust">
        <div className="site-container site-container--narrow px-6">
          <p className="hp-trust-label">Standards & references used across the platform</p>
          <div className="hp-trust-row">
            {["THX", "Dolby Atmos", "CEDIA", "AES", "SMPTE", "ITU-R", "Dirac", "Audyssey"].map((name) => (
              <span key={name} className="hp-trust-item">{name}</span>
            ))}
          </div>
        </div>
      </div>

      {/* ── PLATFORM CAPABILITIES ── */}
      <section className="site-section">
        <div className="site-container site-container--narrow px-6 py-14 md:py-16">

          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between" style={{ marginBottom: 32 }}>
            <div data-reveal="left">
              <p className="site-eyebrow">Platform</p>
              <h2 className="site-title site-title--medium">
                Engineered for<br />
                <span className="site-title-strong">acoustic precision</span>
              </h2>
            </div>
            <div style={{ maxWidth: 340 }} data-reveal="right">
              <p className="site-copy" style={{ fontSize: 14, marginBottom: 16 }}>
                Technical solutions for high-performance private theaters.
                Engineering-led tools for every stage of the design process.
              </p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Link href="/knowledge" className="site-mini-link">Platform</Link>
                <Link href="/engine" className="site-mini-link">Design Tool</Link>
              </div>
            </div>
          </div>

          <div className="hp-cap-grid">
            {CAPABILITIES.map((cap, i) => (
              <Link
                key={cap.title}
                href={cap.href}
                className="site-glass-link"
                data-reveal="scale"
                style={{ padding: 22, borderRadius: 20, transitionDelay: `${i * 0.08}s` }}
              >
                <div className="site-card-kicker">
                  <span className="site-badge-dot site-pulse-dot" style={{ width: 8, height: 8 }} />
                  {cap.cta}
                </div>
                <h3 className="site-card-title" style={{ fontSize: 28 }}>{cap.title}</h3>
                <p className="site-card-copy" style={{ fontSize: 13 }}>{cap.body}</p>
                <div className="hp-cap-photo">
                  <img src={cap.photo} alt={cap.title} loading="lazy" />
                </div>
                <div className="flex flex-wrap gap-2">
                  {cap.tags.map((tag) => (
                    <span key={tag} className="site-chip">{tag}</span>
                  ))}
                </div>
              </Link>
            ))}
          </div>

        </div>
      </section>

      {/* ── DESIGN ENGINE PROCESS ── */}
      <section className="site-section">
        <div className="site-container site-container--narrow px-6 py-14 md:py-16">

          <div style={{ textAlign: "center", marginBottom: 40 }} data-reveal>
            <p className="site-eyebrow">Engineering-led design process</p>
            <h2 className="site-title site-title--medium">
              Precision. Physics.<br />
              <span className="site-title-strong">Proven results.</span>
            </h2>
          </div>

          <div className="hp-process-grid">
            {ENGINE_STEPS.map((step, i) => (
              <div
                key={step.step}
                className="site-glass-card site-glass-card--soft"
                data-reveal="scale"
                style={{ padding: 22, borderRadius: 18, transitionDelay: `${i * 0.07}s` }}
              >
                <div className="site-card-kicker" style={{ marginBottom: 10 }}>
                  <span className="site-badge-dot" style={{ width: 7, height: 7 }} />
                  {step.step}
                </div>
                <div className="site-card-title" style={{ fontSize: 20, marginBottom: 8 }}>{step.title}</div>
                <p className="site-card-copy" style={{ fontSize: 13 }}>{step.body}</p>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* ── INSIGHTS ── */}
      <section className="site-section">
        <div className="site-container site-container--narrow px-6 py-14 md:py-16">

          <div style={{ marginBottom: 32 }} data-reveal="left">
            <p className="site-eyebrow">Technical Insights</p>
            <h2 className="site-title site-title--medium">
              Precision guides.<br />
              <span className="site-title-strong">Measurable results.</span>
            </h2>
          </div>

          <div className="hp-insights-grid">
            {INSIGHTS.map((item) => (
              <div
                key={item.title}
                className={`hp-insight ${item.size === "large" ? "is-large" : "is-small"}`}
                data-reveal
              >
                <div className="hp-insight-bg">
                  <img src={item.photo} alt={item.title} loading="lazy" />
                </div>
                <div className="hp-insight-content">
                  <span className="hp-insight-tag">{item.tag}</span>
                  <div className="hp-insight-title">{item.title}</div>
                  <p className="hp-insight-body">{item.body}</p>
                </div>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="site-section">
        <div className="site-container site-container--narrow px-6 py-14 md:py-16">

          <div style={{ textAlign: "center", marginBottom: 44 }} data-reveal>
            <p className="site-eyebrow">Common questions</p>
            <h2 className="site-title site-title--medium">
              Technical FAQ:<br />
              <span className="site-title-strong">Home Cinema Design</span>
            </h2>
            <p className="site-copy" style={{ fontSize: 14, marginTop: 12 }}>
              Clear, evidence-based answers to key acoustic and cinema engineering questions.
            </p>
          </div>

          <div className="hp-faq-list">
            {FAQS.map((faq, i) => (
              <div key={i} className="hp-faq-item">
                <button
                  className="hp-faq-q"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                >
                  {faq.q}
                  <span className={`hp-faq-chevron ${openFaq === i ? "is-open" : ""}`}>▾</span>
                </button>
                {openFaq === i && <p className="hp-faq-a">{faq.a}</p>}
              </div>
            ))}
          </div>

          <p className="hp-faq-contact">
            Have a technical question?{" "}
            <a href="mailto:studio@scienceofsound.com">Reach out for details.</a>
          </p>

        </div>
      </section>

      {/* ── CTA ── */}
      <section className="site-section">
        <div className="site-container site-container--narrow px-6 py-14 md:py-16">
          <div className="hp-cta-grid" data-reveal>

            <div className="hp-cta-photo">
              <img
                src="https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=800&q=80&auto=format&fit=crop"
                alt="Home theater design session"
                loading="lazy"
              />
            </div>

            <div>
              <p className="site-eyebrow">Start with the design tool</p>
              <h2 className="site-title site-title--medium" style={{ marginBottom: 16 }}>
                Precision design.<br />
                <span className="site-title-strong">Measurable performance.</span>
              </h2>
              <p className="site-copy" style={{ fontSize: 15, maxWidth: 400, marginBottom: 28 }}>
                Jump into room entry, treatment planning, layout decisions, and report
                generation — or explore the knowledge base first if you want more context.
              </p>
              <div className="site-button-row">
                <Link href="/engine" className="site-button">Open Design Tool</Link>
                <Link href="/knowledge" className="site-button--ghost">Explore Platform</Link>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── FOOTER LINKS ── */}
      <section className="site-section">
        <div className="site-container site-container--narrow px-6 py-10">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row" data-reveal>
            <p className="site-copy" style={{ fontSize: 13 }}>Explore other sections</p>
            <div className="site-footer-links">
              {[
                { label: "Knowledge Base", href: "/knowledge" },
                { label: "Learning Paths", href: "/learn" },
                { label: "Resources",      href: "/resources" },
                { label: "Community",      href: "/community" },
                { label: "Reflections",    href: "/reflections" },
              ].map(({ label, href }) => (
                <Link key={href} href={href} className="site-mini-link">{label}</Link>
              ))}
            </div>
          </div>
        </div>
      </section>

    </main>
  )
}
