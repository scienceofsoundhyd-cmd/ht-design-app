"use client";

import { useState } from "react";
import type { CSSProperties } from "react";
import Link from "next/link";
import { useSiteReveal } from "@/hooks/useSiteReveal";

const PAGE_STYLE = { "--page-accent": "#6f63ff" } as CSSProperties;

const PATHS = [
  {
    num: "01",
    level: "Foundation",
    title: "Home Theater Foundation",
    duration: "~2–3 hours",
    desc: "Understand acoustics, speakers, display, and how those systems interact before moving deeper.",
    modules: ["Fundamentals", "Acoustics", "5.1 / 7.1", "Speaker Placement", "Screen Sizing", "Checklist"],
  },
  {
    num: "02",
    level: "Intermediate",
    title: "Acoustic Treatment Specialist",
    duration: "~5–7 hours",
    desc: "Room modes, RT60, bass traps, diffusion, and REW workflow with a treatment-plan assessment.",
    modules: ["Physics", "Room Modes", "Absorption", "Bass Traps", "Diffusion", "REW"],
  },
  {
    num: "03",
    level: "Intermediate",
    title: "Speaker & Calibration Expert",
    duration: "~4–6 hours",
    desc: "Speaker technology, surround geometry, subwoofer integration, room correction, and advanced EQ.",
    modules: ["Speaker Tech", "Geometry", "Subwoofers", "Correction", "Calibration", "EQ"],
  },
  {
    num: "04",
    level: "Advanced",
    title: "Installation Professional",
    duration: "~4–5 hours",
    desc: "Cabling, in-wall work, projector setup, rack design, electrical planning, and long-term serviceability.",
    modules: ["Cable Types", "In-Wall", "Projectors", "Rack Design", "Power", "Troubleshooting"],
  },
  {
    num: "05",
    level: "Master",
    title: "Master Home Theater Designer",
    duration: "~8–10 hours",
    desc: "Integrate room design, isolation, video calibration, networking, power, and project management.",
    modules: ["Integrated Design", "Isolation", "Video", "Control", "Power", "Project Management"],
  },
];

const TOPICS = [
  {
    num: "3.1",
    title: "Acoustics & Room Treatment",
    desc: "Modal resonances, standing waves, RT60, Schroeder frequency, flutter echo, bass traps, broadband absorbers, diffusers, and treatment layout from physics to execution.",
    tags: ["Room Modes", "RT60", "Bass Traps", "Diffusion", "Schroeder"],
  },
  {
    num: "3.2",
    title: "Speaker Systems & Placement",
    desc: "Loudspeaker design, crossovers, polar response, surround geometry, Atmos angles, subwoofer placement, and boundary interaction in real rooms.",
    tags: ["Crossovers", "Polar", "Atmos", "Subwoofers", "Geometry"],
  },
  {
    num: "3.3",
    title: "Display Technology & Screen Placement",
    desc: "Projectors, flat panels, throw ratios, screen gain, ALR screens, HDR formats, aspect ratios, and viewing-distance decisions for theater spaces.",
    tags: ["Projectors", "Throw Ratio", "Screen Gain", "HDR", "ALR"],
  },
  {
    num: "3.4",
    title: "Audio Processing & Calibration",
    desc: "AVRs, processors, DSP chains, room correction, manual calibration, SPL metering, and reference-level standards for serious systems.",
    tags: ["Dirac", "Audyssey", "ARC", "Reference", "SPL"],
  },
  {
    num: "3.5",
    title: "Installation & Cabling",
    desc: "Cable types, in-wall routing, conduit planning, mounting, rack design, power conditioning, and sequencing details that affect final quality.",
    tags: ["Cable Types", "In-Wall", "Rack Design", "Power", "Trade Sequence"],
  },
  {
    num: "3.6",
    title: "Seating & Room Design",
    desc: "Seating layout geometry, row pitch, riser height, sightlines, acoustic impact, and multi-row design for practical home theater rooms.",
    tags: ["Row Pitch", "Risers", "Sightlines", "Multi-Row", "Seating"],
  },
  {
    num: "3.7",
    title: "Room Correction & Tuning",
    desc: "REW workflow, frequency response reading, waterfall plots, EQ strategy, multi-sub blending, time alignment, and iterative tuning methodology.",
    tags: ["REW", "Waterfall", "EQ", "Alignment", "Multi-Sub"],
  },
  {
    num: "3.8",
    title: "Advanced Topics",
    desc: "Dedicated-room construction, isolation, STC and NRC, light control, HVAC noise, networking, control systems, and verification-grade measurement.",
    tags: ["Isolation", "STC / NRC", "Light Control", "HVAC", "Control"],
  },
];

type Tab = "paths" | "knowledge";

export default function LearnPage() {
  useSiteReveal();
  const [tab, setTab] = useState<Tab>("paths");

  return (
    <main className="site-shell" style={PAGE_STYLE}>
      <section className="site-hero">
        <div className="site-container site-container--narrow px-6 py-18 md:py-22">
          <div data-reveal="left" style={{ maxWidth: 760 }}>
            <p className="site-eyebrow">Section 04</p>
            <h1 className="site-title site-title--medium" style={{ marginBottom: 18 }}>
              Learn <span className="site-title-strong">& Reference</span>
            </h1>
            <p className="site-copy" style={{ fontSize: 17, maxWidth: 680, marginBottom: 28 }}>
              Structured learning paths to build skill progressively, plus a reference knowledge base
              covering every aspect of home theater design.
            </p>
            <div className="site-badge">
              <span className="site-badge-dot" />
              Curriculum in development
            </div>
          </div>
        </div>
      </section>

      {/* Tab switcher */}
      <section className="site-section">
        <div className="site-container site-container--narrow px-6 pt-4 pb-0">
          <div style={{ display: "flex", gap: 0, borderBottom: "1px solid rgba(29,34,40,0.10)", marginBottom: 32 }}>
            {([
              { id: "paths",     label: "Learning Paths"  },
              { id: "knowledge", label: "Knowledge Base"  },
            ] as { id: Tab; label: string }[]).map(({ id, label }) => (
              <button key={id} onClick={() => setTab(id)}
                style={{
                  padding: "10px 24px", fontSize: 13, fontWeight: 500,
                  background: "transparent", border: "none", cursor: "pointer",
                  color: tab === id ? "#1d2228" : "rgba(29,34,40,0.45)",
                  borderBottom: tab === id ? "2px solid #6f63ff" : "2px solid transparent",
                  marginBottom: -1, transition: "all 0.15s",
                }}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Learning Paths */}
      {tab === "paths" && (
        <section className="site-section">
          <div className="site-container site-container--narrow px-6 pb-16 md:pb-18">
            <div className="flex flex-col gap-4">
              {PATHS.map((path, index) => (
                <article
                  key={path.num}
                  data-reveal="scale"
                  className="site-glass-card site-glass-card--soft"
                  style={{ padding: 24, transitionDelay: `${index * 0.05}s` }}
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div style={{ flex: 1 }}>
                      <div className="flex flex-wrap items-center gap-2" style={{ marginBottom: 12 }}>
                        <span className="site-card-kicker">
                          <span className="site-badge-dot site-pulse-dot" style={{ width: 8, height: 8 }} />
                          {path.num}
                        </span>
                        <span className="site-chip">{path.level}</span>
                        <span className="site-copy" style={{ fontSize: 12 }}>{path.duration}</span>
                      </div>
                      <h2 className="site-card-title" style={{ fontSize: 38, marginBottom: 10 }}>
                        {path.title}
                      </h2>
                      <p className="site-card-copy" style={{ fontSize: 14, marginBottom: 16, maxWidth: 760 }}>
                        {path.desc}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {path.modules.map((module) => (
                          <span key={module} className="site-chip">{module}</span>
                        ))}
                      </div>
                    </div>
                    <div className="site-badge" style={{ alignSelf: "flex-start" }}>
                      <span className="site-badge-dot" />
                      Coming Soon
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Knowledge Base */}
      {tab === "knowledge" && (
        <section className="site-section">
          <div className="site-container site-container--narrow px-6 pb-16 md:pb-18">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {TOPICS.map((topic, index) => (
                <article
                  key={topic.num}
                  data-reveal="scale"
                  className="site-glass-card site-glass-card--soft"
                  style={{ padding: 22, transitionDelay: `${index * 0.05}s` }}
                >
                  <div className="flex items-start justify-between gap-3" style={{ marginBottom: 12 }}>
                    <div className="site-card-kicker">
                      <span className="site-badge-dot site-pulse-dot" style={{ width: 8, height: 8 }} />
                      {topic.num}
                    </div>
                    <span className="site-chip">Soon</span>
                  </div>
                  <h2 className="site-card-title" style={{ fontSize: 36, marginBottom: 10 }}>
                    {topic.title}
                  </h2>
                  <p className="site-card-copy" style={{ fontSize: 14, marginBottom: 16 }}>
                    {topic.desc}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {topic.tags.map((tag) => (
                      <span key={tag} className="site-chip">{tag}</span>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="site-section">
        <div className="site-container site-container--narrow px-6 py-10">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row" data-reveal>
            <p className="site-copy" style={{ fontSize: 13 }}>Explore other sections</p>
            <div className="site-footer-links">
              {[
                { label: "Design Engine", href: "/engine"    },
                { label: "Resources",     href: "/resources" },
                { label: "Community",     href: "/community" },
              ].map(({ label, href }) => (
                <Link key={href} href={href} className="site-mini-link">{label}</Link>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
