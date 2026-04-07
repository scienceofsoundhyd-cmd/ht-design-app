"use client";

import { useState } from "react";
import { useSiteReveal } from "@/hooks/useSiteReveal";

const PROJECTS = [
  {
    id: "p1",
    title: "The Meridian",
    location: "Hyderabad, Telangana",
    year: "2024",
    category: "Dedicated Theater",
    tagline: "A 24-seat private screening room engineered to THX Ultra2 standards.",
    description:
      "Built inside a converted 1,800 sq ft warehouse space, The Meridian features a fully isolated room-within-a-room construction achieving STC 72. The screen wall hosts a 4.5m wide 2.39:1 CinemaScope screen with a 4K laser projector and a 9.4.6 Dolby Atmos speaker array. Acoustic treatment was designed from modal analysis with custom broadband panels and QRD diffusers.",
    specs: [
      { label: "Room Size",     value: "28 × 18 × 11 ft" },
      { label: "Seats",         value: "24 (tiered, 3 rows)" },
      { label: "Screen",        value: '175" 2.39:1 CinemaScope' },
      { label: "Projector",     value: "4K Laser, 25,000 lumens" },
      { label: "Audio",         value: "9.4.6 Dolby Atmos" },
      { label: "SPL Reference", value: "105 dB at MLP" },
      { label: "RT60",          value: "0.28s (500Hz)" },
      { label: "Isolation",     value: "STC 72" },
    ],
    images: [
      { label: "Screen Wall",      color: "#1a1f2e" },
      { label: "Seating & Risers", color: "#22293a" },
      { label: "Treatment Detail", color: "#1e2535" },
      { label: "Projection Booth", color: "#191d2b" },
    ],
    tags: ["THX Ultra2", "Dolby Atmos", "Room-in-Room", "Laser Projection", "Custom Seating"],
  },
  {
    id: "p2",
    title: "Blackwood Estate",
    location: "Mumbai, Maharashtra",
    year: "2023",
    category: "Home Theater",
    tagline: "A family home theater with reference-grade acoustics in a traditional setting.",
    description:
      "Designed within the basement of a 6,000 sq ft residential estate, Blackwood combines a traditional aesthetic with measurement-grade performance. The room uses a distributed bass system with four subwoofers for even LF response, a 140\" AT screen hiding the front three speakers, and integrated smart lighting across three mood scenes. REW-verified target response within ±1.5 dB from 25 Hz to 16 kHz.",
    specs: [
      { label: "Room Size",     value: "20 × 14 × 9.5 ft" },
      { label: "Seats",         value: "10 (2 rows)" },
      { label: "Screen",        value: '140" 16:9 AT screen' },
      { label: "Projector",     value: "4K DLP, 3,500 lumens" },
      { label: "Audio",         value: "7.2.4 Dolby Atmos" },
      { label: "SPL Reference", value: "102 dB at MLP" },
      { label: "Frequency",     value: "±1.5 dB, 25–16k Hz" },
      { label: "Subs",          value: "4× distributed" },
    ],
    images: [
      { label: "Front Stage",     color: "#1f1a2e" },
      { label: "Seating Row",     color: "#251e38" },
      { label: "Side Treatment",  color: "#1d1929" },
      { label: "Control Rack",    color: "#1a1724" },
    ],
    tags: ["Residential", "AT Screen", "4× Subs", "Smart Lighting", "REW Verified"],
  },
  {
    id: "p3",
    title: "Studio Nine",
    location: "Bengaluru, Karnataka",
    year: "2024",
    category: "Screening Room",
    tagline: "A compact professional screening room for a post-production studio.",
    description:
      "Studio Nine is a 12-seat professional screening room built for a boutique post-production house. The design prioritizes flat frequency response, low noise floor (NC-15), and compliance with SMPTE ST 202 screening standards. The room features a 3.0m wide screen, a reference-grade 7.4.4 speaker layout, and an isolation package that prevents bleed from adjacent edit suites.",
    specs: [
      { label: "Room Size",    value: "18 × 13 × 10 ft" },
      { label: "Seats",        value: "12 (2 rows)" },
      { label: "Screen",       value: "118\" 1.85:1" },
      { label: "Standard",     value: "SMPTE ST 202" },
      { label: "Audio",        value: "7.4.4 Atmos" },
      { label: "Noise Floor",  value: "NC-15" },
      { label: "RT60",         value: "0.22s (1kHz)" },
      { label: "Isolation",    value: "STC 65" },
    ],
    images: [
      { label: "Screen & Speakers", color: "#14181f" },
      { label: "Mixing Position",   color: "#191d25" },
      { label: "Rear Treatment",    color: "#161a21" },
      { label: "Ceiling Detail",    color: "#12161c" },
    ],
    tags: ["SMPTE ST 202", "Post-Production", "NC-15", "7.4.4", "Professional"],
  },
  {
    id: "p4",
    title: "The Lakeview",
    location: "Delhi, NCR",
    year: "2023",
    category: "Media Room",
    tagline: "A high-performance media room designed around an open-plan living space.",
    description:
      "Lakeview demonstrates that reference-grade performance is achievable outside a dedicated room. Working within a 22 × 16 ft open-plan living area, the design used strategic furniture placement, hidden acoustic panels behind fabric wall sections, and a tension-fabric ceiling cloud to tame the room without visually dominating the space. Subwoofer placement was optimised via swept sine measurements to minimise bass nulls.",
    specs: [
      { label: "Room Size",  value: "22 × 16 ft open plan" },
      { label: "Screen",     value: '120" ALR 16:9' },
      { label: "Projector",  value: "UST Laser, 3,000 lumens" },
      { label: "Audio",      value: "5.2.2 Atmos" },
      { label: "Subs",       value: "2× optimised placement" },
      { label: "Treatment",  value: "Hidden in-wall panels" },
      { label: "Ceiling",    value: "Fabric diffusion cloud" },
      { label: "Style",      value: "Residential blend" },
    ],
    images: [
      { label: "Living View",      color: "#1e1e2a" },
      { label: "Screen Wall",      color: "#222233" },
      { label: "Ceiling Cloud",    color: "#1c1c28" },
      { label: "Hidden Treatment", color: "#1a1a26" },
    ],
    tags: ["Open Plan", "ALR Screen", "UST Projector", "Hidden Acoustics", "Residential"],
  },
];

function ImageCarousel({ images }: { images: { label: string; color: string }[] }) {
  const [current, setCurrent] = useState(0);

  return (
    <div style={{ position: "relative", width: "100%", aspectRatio: "16/9", borderRadius: 12, overflow: "hidden" }}>
      {/* Slide */}
      <div style={{
        width: "100%", height: "100%",
        background: images[current].color,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: 10,
        transition: "background 0.4s ease",
      }}>
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none"
          stroke="rgba(255,255,255,0.15)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2"/>
          <line x1="8" y1="21" x2="16" y2="21"/>
          <line x1="12" y1="17" x2="12" y2="21"/>
        </svg>
        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", letterSpacing: "0.06em" }}>
          {images[current].label}
        </span>
      </div>

      {/* Prev / Next */}
      {images.length > 1 && (
        <>
          <button onClick={() => setCurrent(c => (c - 1 + images.length) % images.length)}
            style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)",
              width: 32, height: 32, borderRadius: "50%", border: "none", cursor: "pointer",
              background: "rgba(0,0,0,0.45)", color: "#fff", display: "flex",
              alignItems: "center", justifyContent: "center" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
          <button onClick={() => setCurrent(c => (c + 1) % images.length)}
            style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
              width: 32, height: 32, borderRadius: "50%", border: "none", cursor: "pointer",
              background: "rgba(0,0,0,0.45)", color: "#fff", display: "flex",
              alignItems: "center", justifyContent: "center" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>
        </>
      )}

      {/* Dots */}
      <div style={{ position: "absolute", bottom: 10, left: "50%", transform: "translateX(-50%)",
        display: "flex", gap: 5 }}>
        {images.map((_, i) => (
          <button key={i} onClick={() => setCurrent(i)}
            style={{ width: i === current ? 20 : 6, height: 6,
              borderRadius: 999, border: "none", cursor: "pointer",
              background: i === current ? "#fff" : "rgba(255,255,255,0.35)",
              transition: "all 0.2s", padding: 0 }}/>
        ))}
      </div>

      {/* Counter */}
      <div style={{ position: "absolute", top: 10, right: 12,
        fontSize: 11, color: "rgba(255,255,255,0.5)",
        background: "rgba(0,0,0,0.3)", borderRadius: 20, padding: "3px 8px" }}>
        {current + 1} / {images.length}
      </div>
    </div>
  );
}

export default function OurProjectsPage() {
  useSiteReveal();

  return (
    <main className="site-shell">
      <style>{`
        .spec-row:nth-child(even) { background: rgba(29,34,40,0.03); }
      `}</style>

      {/* Hero */}
      <section className="site-hero">
        <div className="site-container site-container--narrow px-6 py-18 md:py-22">
          <div data-reveal="left" style={{ maxWidth: 760 }}>
            <p className="site-eyebrow">Portfolio</p>
            <h1 className="site-title site-title--medium" style={{ marginBottom: 18 }}>
              Our <span className="site-title-strong">Projects</span>
            </h1>
            <p className="site-copy" style={{ fontSize: 17, maxWidth: 660, marginBottom: 0 }}>
              A selection of home theaters, screening rooms, and media rooms designed and delivered
              by the Science of Sound team — each one measured, verified, and built to a standard.
            </p>
          </div>
        </div>
      </section>

      {/* Projects */}
      <section className="site-section">
        <div className="site-container site-container--narrow px-6 pb-20">

          <div style={{ display: "flex", flexDirection: "column", gap: 64 }}>
            {PROJECTS.map((project, index) => (
              <article key={project.id} data-reveal="scale"
                style={{ transitionDelay: `${index * 0.05}s` }}>

                {/* Divider */}
                <div className="site-divider-row" style={{ marginBottom: 28 }}>
                  <span className="site-divider-label">{String(index + 1).padStart(2, "0")}</span>
                  <div className="site-divider-line" />
                </div>

                {/* Two-column layout */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 36,
                  alignItems: "start" }}
                  className="our-proj-grid">
                  <style>{`
                    @media (max-width: 768px) {
                      .our-proj-grid { grid-template-columns: 1fr !important; }
                    }
                  `}</style>

                  {/* Left — image carousel */}
                  <div>
                    <ImageCarousel images={project.images} />

                    {/* Tags below image */}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 14 }}>
                      {project.tags.map(tag => (
                        <span key={tag} className="site-chip">{tag}</span>
                      ))}
                    </div>
                  </div>

                  {/* Right — info */}
                  <div>
                    {/* Header */}
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em",
                          color: "rgba(29,34,40,0.45)", textTransform: "uppercase" }}>
                          {project.category}
                        </span>
                        <span style={{ width: 3, height: 3, borderRadius: "50%",
                          background: "rgba(29,34,40,0.25)", display: "inline-block" }}/>
                        <span style={{ fontSize: 11, color: "rgba(29,34,40,0.45)" }}>
                          {project.location}
                        </span>
                        <span style={{ width: 3, height: 3, borderRadius: "50%",
                          background: "rgba(29,34,40,0.25)", display: "inline-block" }}/>
                        <span style={{ fontSize: 11, color: "rgba(29,34,40,0.45)" }}>
                          {project.year}
                        </span>
                      </div>
                      <h2 style={{ fontSize: 32, fontWeight: 700, color: "#1d2228",
                        margin: "0 0 8px", lineHeight: 1.1 }}>
                        {project.title}
                      </h2>
                      <p style={{ fontSize: 14, color: "rgba(29,34,40,0.65)", margin: 0,
                        fontStyle: "italic" }}>
                        {project.tagline}
                      </p>
                    </div>

                    {/* Description */}
                    <p style={{ fontSize: 13, color: "rgba(29,34,40,0.70)", lineHeight: 1.7,
                      marginBottom: 20 }}>
                      {project.description}
                    </p>

                    {/* Specs table */}
                    <div style={{ borderRadius: 10, overflow: "hidden",
                      border: "1px solid rgba(29,34,40,0.09)" }}>
                      {project.specs.map((spec, i) => (
                        <div key={i} className="spec-row"
                          style={{ display: "flex", justifyContent: "space-between",
                            alignItems: "center", padding: "8px 12px",
                            borderBottom: i < project.specs.length - 1
                              ? "1px solid rgba(29,34,40,0.07)" : "none" }}>
                          <span style={{ fontSize: 11, fontWeight: 600,
                            color: "rgba(29,34,40,0.45)", textTransform: "uppercase",
                            letterSpacing: "0.05em" }}>
                            {spec.label}
                          </span>
                          <span style={{ fontSize: 12, fontWeight: 500, color: "#1d2228" }}>
                            {spec.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="site-section">
        <div className="site-container site-container--narrow px-6 py-12">
          <div className="site-glass-card site-glass-card--soft" data-reveal
            style={{ padding: "40px 32px", textAlign: "center" }}>
            <p className="site-eyebrow" style={{ marginBottom: 12 }}>Start Your Project</p>
            <h2 className="site-card-title" style={{ fontSize: 36, marginBottom: 12 }}>
              Ready to design your theater?
            </h2>
            <p className="site-card-copy" style={{ fontSize: 14, maxWidth: 480,
              margin: "0 auto 24px" }}>
              Use our design tool to plan your room, or get in touch to discuss a custom project.
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              <a href="/engine"
                style={{ padding: "10px 28px", borderRadius: 8, fontSize: 13, fontWeight: 600,
                  color: "#fff", background: "linear-gradient(135deg,#2563EB,#1d4ed8)",
                  textDecoration: "none", boxShadow: "0 3px 10px rgba(37,99,235,0.28)" }}>
                Open Design Tool →
              </a>
              <a href="/community"
                style={{ padding: "10px 28px", borderRadius: 8, fontSize: 13, fontWeight: 500,
                  color: "#1d2228", background: "rgba(255,255,255,0.7)",
                  border: "1px solid rgba(29,34,40,0.15)", textDecoration: "none" }}>
                Get in Touch
              </a>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
