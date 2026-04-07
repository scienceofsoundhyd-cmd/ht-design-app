"use client"

import { useState, type CSSProperties } from "react"
import Link from "next/link"
import { useSiteReveal } from "@/hooks/useSiteReveal"

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

const DIFFERENTIATORS = [
  {
    icon: "◈",
    title: "Measurement-based design",
    body: "Every recommendation is grounded in room physics and measurable acoustic targets — not opinion or product bias.",
  },
  {
    icon: "⊕",
    title: "Standards-referenced",
    body: "Dolby Atmos, THX, SMPTE, AES, ITU-R — we apply the same references used by professional cinema engineers worldwide.",
  },
  {
    icon: "◎",
    title: "End-to-end platform",
    body: "From first principles to a finished room — knowledge, calculators, learning paths, and a full design engine in one place.",
  },
  {
    icon: "◉",
    title: "Hyderabad's dedicated studio",
    body: "A specialist practice focused exclusively on home cinema acoustics and design — not a general AV retailer.",
  },
]

const TESTIMONIALS = [
  {
    quote: "The Design Engine walked me through every decision — room dimensions, speaker positions, screen sizing. I finally understood why each choice mattered.",
    name: "Ravi K.",
    role: "Home Theater Enthusiast, Hyderabad",
    initials: "RK",
  },
  {
    quote: "The knowledge base reads like a proper engineering reference, not marketing copy. It completely changed how I approach acoustic decisions in my projects.",
    name: "Priya M.",
    role: "Architect, Bengaluru",
    initials: "PM",
  },
  {
    quote: "We used Science of Sound to validate our cinema room before construction. The acoustic calculations alone saved us from several expensive mistakes.",
    name: "Suresh D.",
    role: "Interior Designer, Chennai",
    initials: "SD",
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
          height: 148px;
          border-radius: 14px;
          overflow: hidden;
          border: 1px solid rgba(29,34,40,0.06);
          margin-bottom: 14px;
        }
        .hp-cap-photo img { width:100%; height:100%; object-fit:cover; display:block; }

        .hp-process-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 14px;
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
          grid-template-columns: 1fr 1fr;
          gap: 52px;
          align-items: center;
        }
        @media (max-width: 768px) {
          .hp-cta-grid { grid-template-columns: 1fr; }
          .hp-cta-photo { display: none; }
        }
        .hp-cta-photo {
          height: 380px;
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

        /* ── DIFFERENTIATORS ── */
        .hp-diff-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 14px;
        }
        @media (max-width: 900px) { .hp-diff-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 600px) { .hp-diff-grid { grid-template-columns: 1fr; } }
        .hp-diff-icon {
          font-size: 22px;
          margin-bottom: 14px;
          display: block;
          color: color-mix(in srgb, var(--page-accent) 70%, var(--site-text));
        }
        .hp-diff-title {
          font-size: 15px;
          font-weight: 600;
          color: var(--site-text);
          letter-spacing: -0.015em;
          margin-bottom: 8px;
          line-height: 1.3;
        }
        .hp-diff-body { font-size: 13px; line-height: 1.7; color: var(--site-text-muted); }

        /* ── TESTIMONIALS ── */
        .hp-testimonials-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 14px;
        }
        @media (max-width: 900px) { .hp-testimonials-grid { grid-template-columns: 1fr 1fr; } }
        @media (max-width: 600px) { .hp-testimonials-grid { grid-template-columns: 1fr; } }
        .hp-testimonial-inner {
          display: flex;
          flex-direction: column;
          height: 100%;
          padding: 24px;
          border-radius: 20px;
        }
        .hp-testimonial-stars {
          display: flex;
          gap: 3px;
          margin-bottom: 14px;
        }
        .hp-testimonial-star { font-size: 13px; color: color-mix(in srgb, var(--page-accent) 60%, #f59e0b); }
        .hp-testimonial-quote {
          font-size: 14px;
          line-height: 1.72;
          color: var(--site-text-muted);
          flex: 1;
          font-style: italic;
          margin-bottom: 20px;
        }
        .hp-testimonial-author { display: flex; align-items: center; gap: 12px; }
        .hp-testimonial-avatar {
          width: 38px; height: 38px; border-radius: 999px; flex-shrink: 0;
          background: linear-gradient(135deg,
            color-mix(in srgb, var(--page-accent) 28%, #fff),
            color-mix(in srgb, var(--page-accent) 48%, #dde2e8));
          border: 1px solid rgba(255,255,255,0.6);
          display: flex; align-items: center; justify-content: center;
          font-size: 11px; font-weight: 700;
          color: color-mix(in srgb, var(--page-accent) 80%, #1d2228);
        }
        .hp-testimonial-name { font-size: 13px; font-weight: 600; color: var(--site-text); line-height: 1.2; }
        .hp-testimonial-role { font-size: 11px; color: var(--site-text-soft); margin-top: 2px; }

        /* ── FOOTER ── */
        .hp-footer {
          border-top: 1px solid var(--site-border-soft);
          background: linear-gradient(180deg, rgba(255,255,255,0.18), rgba(255,255,255,0.08));
          backdrop-filter: blur(20px) saturate(155%);
          -webkit-backdrop-filter: blur(20px) saturate(155%);
        }
        .hp-footer-main {
          display: grid;
          grid-template-columns: 1.7fr 1fr 1fr;
          gap: 56px;
          padding: 56px 0 44px;
        }
        @media (max-width: 900px) { .hp-footer-main { grid-template-columns: 1fr 1fr; gap: 36px; padding: 40px 0 32px; } }
        @media (max-width: 600px) { .hp-footer-main { grid-template-columns: 1fr; gap: 28px; padding: 36px 0 28px; } }
        .hp-footer-logo-row {
          display: flex; align-items: center; gap: 10px; margin-bottom: 12px;
        }
        .hp-footer-logo-mark {
          font-family: Georgia, serif; font-size: 16px; font-weight: 700;
          color: var(--site-text); letter-spacing: -0.01em;
        }
        .hp-footer-brand-name {
          font-size: 14px; font-weight: 600; color: var(--site-text); letter-spacing: 0.01em;
        }
        .hp-footer-brand-sub {
          font-size: 9px; letter-spacing: 0.14em; text-transform: uppercase;
          color: var(--site-text-soft); margin-top: 1px;
        }
        .hp-footer-tagline {
          font-size: 12.5px; line-height: 1.68; color: var(--site-text-soft);
          max-width: 290px; margin-bottom: 22px;
        }
        .hp-footer-social { display: flex; gap: 9px; margin-bottom: 22px; }
        .hp-footer-social-link {
          width: 34px; height: 34px; border-radius: 9px;
          display: flex; align-items: center; justify-content: center;
          background: linear-gradient(180deg, rgba(255,255,255,0.34), rgba(255,255,255,0.14));
          border: 1px solid rgba(255,255,255,0.46);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.84);
          backdrop-filter: blur(12px);
          color: var(--site-text-muted);
          text-decoration: none;
          transition: transform 0.18s ease, color 0.18s ease, border-color 0.18s ease;
        }
        .hp-footer-social-link:hover {
          transform: translateY(-2px);
          color: var(--site-text);
          border-color: rgba(255,255,255,0.62);
        }
        .hp-footer-contact-row {
          display: flex; flex-direction: column; gap: 6px; margin-top: 2px;
        }
        .hp-footer-contact-item {
          display: flex; align-items: flex-start; gap: 8px;
          font-size: 12px; color: var(--site-text-soft); line-height: 1.55;
        }
        .hp-footer-contact-icon { flex-shrink: 0; margin-top: 1px; opacity: 0.6; font-size: 13px; }
        .hp-footer-col-label {
          font-size: 10px; font-weight: 700; letter-spacing: 0.18em;
          text-transform: uppercase; color: var(--site-text-soft);
          margin-bottom: 16px;
        }
        .hp-footer-col-links { display: flex; flex-direction: column; gap: 11px; }
        .hp-footer-col-link {
          font-size: 13px; color: var(--site-text-muted); text-decoration: none;
          transition: color 0.16s ease;
        }
        .hp-footer-col-link:hover { color: var(--site-text); }
        .hp-footer-bottom {
          border-top: 1px solid var(--site-border-soft);
          padding: 20px 0 26px;
          display: flex; flex-wrap: wrap; align-items: flex-start;
          justify-content: space-between; gap: 12px;
        }
        .hp-footer-copy { font-size: 11px; color: var(--site-text-soft); line-height: 1.65; }
        .hp-footer-copy a { color: var(--site-text-muted); text-decoration: underline; text-underline-offset: 2px; }
        .hp-footer-disclaimer {
          font-size: 10.5px; color: rgba(29,34,40,0.38); max-width: 460px;
          line-height: 1.65; text-align: right;
        }
        @media (max-width: 640px) { .hp-footer-disclaimer { text-align: left; max-width: 100%; } }
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

          <div style={{ textAlign: "center", marginBottom: 40 }} data-reveal>
            <p className="site-eyebrow">Platform</p>
            <h2 className="site-title site-title--medium">
              Engineered for<br />
              <span className="site-title-strong">acoustic precision</span>
            </h2>
            <p className="site-copy" style={{ fontSize: 14, maxWidth: 500, margin: "14px auto 0" }}>
              Technical solutions for high-performance private theaters —
              engineering-led tools for every stage of the design process.
            </p>
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
                {/* Photo at top for clean visual hierarchy */}
                <div className="hp-cap-photo">
                  <img src={cap.photo} alt={cap.title} loading="lazy" />
                </div>
                <div className="site-card-kicker">
                  <span className="site-badge-dot site-pulse-dot" style={{ width: 8, height: 8 }} />
                  {cap.cta}
                </div>
                <h3 className="site-card-title" style={{ fontSize: 24, marginBottom: 6 }}>{cap.title}</h3>
                <p className="site-card-copy" style={{ fontSize: 13, flex: 1 }}>{cap.body}</p>
                <div className="flex flex-wrap gap-2" style={{ marginTop: 12 }}>
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

          <div style={{ textAlign: "center", marginBottom: 36 }} data-reveal>
            <p className="site-eyebrow">Technical Insights</p>
            <h2 className="site-title site-title--medium">
              Precision guides.<br />
              <span className="site-title-strong">Measurable results.</span>
            </h2>
            <p className="site-copy" style={{ fontSize: 14, maxWidth: 480, margin: "14px auto 0" }}>
              Knowledge, learning, and tools working together — every section of the platform supports better design decisions.
            </p>
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

      {/* ── WHY SCIENCE OF SOUND ── */}
      <section className="site-section">
        <div className="site-container site-container--narrow px-6 py-14 md:py-16">

          <div style={{ textAlign: "center", marginBottom: 40 }} data-reveal>
            <p className="site-eyebrow">Why Science of Sound</p>
            <h2 className="site-title site-title--medium">
              Physics-first.<br />
              <span className="site-title-strong">No guesswork.</span>
            </h2>
            <p className="site-copy" style={{ fontSize: 14, maxWidth: 480, margin: "14px auto 0" }}>
              Four principles that define every decision we make — from the knowledge base to the design engine.
            </p>
          </div>

          <div className="hp-diff-grid">
            {DIFFERENTIATORS.map((d, i) => (
              <div
                key={d.title}
                className="site-glass-card site-glass-card--soft"
                data-reveal="scale"
                style={{ padding: 24, borderRadius: 20, transitionDelay: `${i * 0.07}s` }}
              >
                <span className="hp-diff-icon">{d.icon}</span>
                <div className="hp-diff-title">{d.title}</div>
                <p className="hp-diff-body">{d.body}</p>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section className="site-section">
        <div className="site-container site-container--narrow px-6 py-14 md:py-16">

          <div style={{ textAlign: "center", marginBottom: 36 }} data-reveal>
            <p className="site-eyebrow">What our users say</p>
            <h2 className="site-title site-title--medium">
              Trusted by designers,<br />
              <span className="site-title-strong">engineers & enthusiasts.</span>
            </h2>
            <p className="site-copy" style={{ fontSize: 14, maxWidth: 460, margin: "14px auto 0" }}>
              From enthusiasts planning their first room to professionals validating a full build.
            </p>
          </div>

          <div className="hp-testimonials-grid">
            {TESTIMONIALS.map((t, i) => (
              <div
                key={t.name}
                className="site-glass-card"
                data-reveal="scale"
                style={{ transitionDelay: `${i * 0.09}s`, borderRadius: 20 }}
              >
                <div className="hp-testimonial-inner">
                  <div className="hp-testimonial-stars">
                    {[...Array(5)].map((_, s) => (
                      <span key={s} className="hp-testimonial-star">★</span>
                    ))}
                  </div>
                  <p className="hp-testimonial-quote">"{t.quote}"</p>
                  <div className="hp-testimonial-author">
                    <div className="hp-testimonial-avatar">{t.initials}</div>
                    <div>
                      <div className="hp-testimonial-name">{t.name}</div>
                      <div className="hp-testimonial-role">{t.role}</div>
                    </div>
                  </div>
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
            <a href="mailto:scienceofsoundhyd@gmail.com">Reach out for details.</a>
          </p>

        </div>
      </section>

      {/* ── CTA ── */}
      <section className="site-section">
        <div className="site-container site-container--narrow px-6 py-14 md:py-16">
          <div className="hp-cta-grid" data-reveal>

            {/* Text first — reads left-to-right naturally */}
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
                <Link href="/engine" className="site-button">Open Design Tool →</Link>
                <Link href="/knowledge" className="site-button--ghost">Explore Platform</Link>
              </div>
            </div>

            {/* Photo right — supports the text */}
            <div className="hp-cta-photo">
              <img
                src="https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=800&q=80&auto=format&fit=crop"
                alt="Home theater design session"
                loading="lazy"
              />
            </div>

          </div>
        </div>
      </section>

      {/* ── FULL FOOTER ── */}
      <footer className="hp-footer">
        <div className="site-container site-container--narrow px-6">

          <div className="hp-footer-main">

            {/* Brand column */}
            <div>
              <div className="hp-footer-logo-row">
                <div style={{
                  width: 40, height: 40, borderRadius: 10, display: "flex",
                  alignItems: "center", justifyContent: "center",
                  background: "linear-gradient(180deg,rgba(255,255,255,0.34),rgba(255,255,255,0.14))",
                  border: "1px solid rgba(255,255,255,0.46)",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.84)",
                }}>
                  <span style={{ fontFamily:"Georgia,serif", fontSize:15, fontWeight:700, color:"#1d2228" }}>
                    S<span style={{ color:"#2563EB" }}>|</span>S
                  </span>
                </div>
                <div>
                  <div className="hp-footer-brand-name">Science of Sound</div>
                  <div className="hp-footer-brand-sub">Home Theater Design</div>
                </div>
              </div>

              <p className="hp-footer-tagline">
                Measurement-based home theater design for high-performance private cinemas.
                Built on physics, international standards, and engineering — not guesswork.
              </p>

              {/* Social icons */}
              <div className="hp-footer-social">
                {/* Instagram */}
                <a href="https://instagram.com" target="_blank" rel="noopener noreferrer"
                  className="hp-footer-social-link" aria-label="Instagram">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
                    <circle cx="12" cy="12" r="4"/>
                    <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" stroke="none"/>
                  </svg>
                </a>
                {/* YouTube */}
                <a href="https://youtube.com" target="_blank" rel="noopener noreferrer"
                  className="hp-footer-social-link" aria-label="YouTube">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22.54 6.42A2.78 2.78 0 0 0 20.6 4.47C18.88 4 12 4 12 4s-6.88 0-8.6.47A2.78 2.78 0 0 0 1.46 6.42 29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58A2.78 2.78 0 0 0 3.4 19.53C5.12 20 12 20 12 20s6.88 0 8.6-.47a2.78 2.78 0 0 0 1.94-1.95A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z"/>
                    <polygon points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02" fill="currentColor" stroke="none"/>
                  </svg>
                </a>
                {/* LinkedIn */}
                <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer"
                  className="hp-footer-social-link" aria-label="LinkedIn">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/>
                    <rect x="2" y="9" width="4" height="12"/>
                    <circle cx="4" cy="4" r="2"/>
                  </svg>
                </a>
              </div>

              {/* Contact info */}
              <div className="hp-footer-contact-row">
                <div className="hp-footer-contact-item">
                  <span className="hp-footer-contact-icon">📍</span>
                  <span>Hyderabad, Telangana, India</span>
                </div>
                <div className="hp-footer-contact-item">
                  <span className="hp-footer-contact-icon">✉</span>
                  <a href="mailto:scienceofsoundhyd@gmail.com"
                    style={{ color:"inherit", textDecoration:"underline", textUnderlineOffset:2 }}>
                    scienceofsoundhyd@gmail.com
                  </a>
                </div>
              </div>
            </div>

            {/* Platform links */}
            <div>
              <p className="hp-footer-col-label">Platform</p>
              <div className="hp-footer-col-links">
                {[
                  { label: "Home",          href: "/"            },
                  { label: "Knowledge Base", href: "/knowledge"   },
                  { label: "Learning Paths", href: "/learn"       },
                  { label: "Resources",      href: "/resources"   },
                  { label: "Community",      href: "/community"   },
                  { label: "Design Engine",  href: "/engine"      },
                  { label: "Reflections",    href: "/reflections" },
                ].map(({ label, href }) => (
                  <Link key={href} href={href} className="hp-footer-col-link">{label}</Link>
                ))}
              </div>
            </div>

            {/* About / Company */}
            <div>
              <p className="hp-footer-col-label">Company</p>
              <div className="hp-footer-col-links" style={{ marginBottom: 28 }}>
                {[
                  { label: "About Us",      href: "#" },
                  { label: "Our Projects",  href: "/our-projects" },
                  { label: "Community",     href: "/community" },
                  { label: "Login",         href: "/login" },
                ].map(({ label, href }) => (
                  <Link key={href} href={href} className="hp-footer-col-link">{label}</Link>
                ))}
              </div>

              <p className="hp-footer-col-label" style={{ marginTop: 8 }}>Contact</p>
              <div className="hp-footer-contact-row">
                <div className="hp-footer-contact-item">
                  <span style={{ fontSize:11 }}>Design consultations, project briefings,<br />and technical questions welcome.</span>
                </div>
                <div className="hp-footer-contact-item" style={{ marginTop: 4 }}>
                  <a href="mailto:scienceofsoundhyd@gmail.com"
                    style={{ fontSize:12, color:"var(--site-text)", fontWeight:600, textDecoration:"underline", textUnderlineOffset:2 }}>
                    Email us →
                  </a>
                </div>
              </div>
            </div>

          </div>{/* end hp-footer-main */}

          {/* Bottom bar — copyright + disclaimer */}
          <div className="hp-footer-bottom">
            <div className="hp-footer-copy">
              © {new Date().getFullYear()} Science of Sound. All rights reserved.<br />
              Made with care in <span style={{ fontWeight:600 }}>Hyderabad, India</span>.
            </div>
            <p className="hp-footer-disclaimer">
              Content on this platform is for informational and educational purposes only.
              Some links may be affiliate links — we may earn a small commission at no extra cost to you.
              Product recommendations are based on technical merit, not sponsorship.
            </p>
          </div>

        </div>
      </footer>

    </main>
  )
}
