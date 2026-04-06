"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { useSiteReveal } from "@/app/components/useSiteReveal";

const PAGE_STYLE = { "--page-accent": "#d1964f" } as CSSProperties;

const CALCULATORS = [
  { num: "01", title: "Room Mode Calculator", desc: "Axial, tangential, and oblique mode analysis for rectangular rooms.", tags: ["Modes", "Resonance", "Dimensions"] },
  { num: "02", title: "RT60 Calculator", desc: "Reverberation time by band using Sabine and Eyring formulas.", tags: ["Acoustics", "Treatment", "Sabine"] },
  { num: "03", title: "Schroeder Frequency", desc: "Find the transition point between modal and statistical room behavior.", tags: ["Modes", "Low Freq", "RT60"] },
  { num: "04", title: "Absorption Coverage", desc: "Estimate the treatment area needed to reach a target RT60.", tags: ["Coverage", "RT60", "Treatment"] },
  { num: "05", title: "Speaker Angle Calculator", desc: "Placement geometry for LCR, surrounds, and height channels.", tags: ["Surround", "Atmos", "Geometry"] },
  { num: "06", title: "Subwoofer Optimizer", desc: "Null prediction and suggested sub placement around the listening seat.", tags: ["Sub", "Bass", "Placement"] },
  { num: "07", title: "Viewing Distance", desc: "Recommended seating range for screen size and resolution standard.", tags: ["Display", "Seating", "SMPTE"] },
  { num: "08", title: "Throw Distance", desc: "Projector placement from screen size and throw-ratio spec.", tags: ["Projection", "Throw Ratio", "Placement"] },
  { num: "09", title: "Delay Calculator", desc: "Time-align speaker arrays and correct lip-sync offset for video.", tags: ["Sync", "Delay", "Calibration"] },
  { num: "10", title: "Crossover Frequency", desc: "Guide optimal crossover points between subwoofer and mains by driver size.", tags: ["Crossover", "Sub", "Bass"] },
  { num: "11", title: "Speaker Wire Gauge", desc: "Minimum AWG recommendation by run length, power draw, and impedance.", tags: ["Wiring", "Gauge", "AWG"] },
  { num: "12", title: "HDMI Cable Length", desc: "Maximum passive cable length for 4K/8K HDR and bandwidth grade.", tags: ["HDMI", "4K", "Signal"] },
  { num: "13", title: "Circuit Load Calculator", desc: "Verify breaker and outlet capacity for AV equipment and amplifiers.", tags: ["Power", "Electrical", "Load"] },
  { num: "14", title: "Bass Trap Volume", desc: "Estimate required absorption volume for targeted low-frequency control.", tags: ["Bass Trap", "Treatment", "Low Freq"] },
  { num: "15", title: "SPL Budget", desc: "Predict maximum clean SPL from amplifier power and speaker sensitivity.", tags: ["SPL", "Amplifier", "Sensitivity"] },
];

const STANDARDS = [
  { title: "THX Reference Levels", org: "THX Ltd", desc: "Reference SPL, geometry, and performance guidelines." },
  { title: "Dolby Atmos Home Guidelines", org: "Dolby", desc: "Speaker placement, angle ranges, and system requirements." },
  { title: "SMPTE ST 2084", org: "SMPTE", desc: "Perceptual quantizer and HDR display behavior." },
  { title: "AES69 Room Acoustics", org: "AES", desc: "Measurement standards for small-room acoustic analysis." },
  { title: "CEDIA ESC-R1", org: "CEDIA", desc: "Recommended practice for home theater design and installation." },
  { title: "ITU-R BS.1116", org: "ITU", desc: "Subjective evaluation methods for multichannel audio." },
];

export default function ResourcesPage() {
  useSiteReveal();

  return (
    <main className="site-shell" style={PAGE_STYLE}>
      <section className="site-hero">
        <div className="site-container site-container--narrow px-6 py-18 md:py-22">
          <div data-reveal="left" style={{ maxWidth: 780 }}>
            <p className="site-eyebrow">Section 05</p>
            <h1 className="site-title site-title--medium" style={{ marginBottom: 18 }}>
              Technical <span className="site-title-strong">Resources</span>
            </h1>
            <p className="site-copy" style={{ fontSize: 17, maxWidth: 720, marginBottom: 28 }}>
              Calculators, standards, and reference material for acoustics, layout, calibration,
              installation, and decision validation.
            </p>
            <div className="site-button-row">
              <div className="site-badge">
                <span className="site-badge-dot" />
                Calculators in development
              </div>
              <Link href="/engine" className="site-button">
                Open Design Engine
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="site-section">
        <div className="site-container site-container--narrow px-6 py-16 md:py-18">
          <div className="site-divider-row" data-reveal>
            <span className="site-divider-label">Calculators</span>
            <div className="site-divider-line" />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {CALCULATORS.map((item, index) => (
              <article
                key={item.num}
                data-reveal="scale"
                className="site-glass-card site-glass-card--soft"
                style={{ padding: 22, transitionDelay: `${index * 0.05}s` }}
              >
                <div className="flex items-start justify-between gap-3" style={{ marginBottom: 10 }}>
                  <div className="site-card-kicker">
                    <span className="site-badge-dot site-pulse-dot" style={{ width: 8, height: 8 }} />
                    {item.num}
                  </div>
                  <span className="site-chip">Soon</span>
                </div>
                <h2 className="site-card-title" style={{ fontSize: 34, marginBottom: 8 }}>
                  {item.title}
                </h2>
                <p className="site-card-copy" style={{ fontSize: 14, marginBottom: 14 }}>
                  {item.desc}
                </p>
                <div className="flex flex-wrap gap-2">
                  {item.tags.map((tag) => (
                    <span key={tag} className="site-chip">
                      {tag}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="site-section">
        <div className="site-container site-container--narrow px-6 py-16">
          <div className="site-divider-row" data-reveal>
            <span className="site-divider-label">Standards & References</span>
            <div className="site-divider-line" />
          </div>

          <div className="flex flex-col gap-4">
            {STANDARDS.map((item, index) => (
              <article
                key={item.title}
                data-reveal="left"
                className="site-glass-card"
                style={{ padding: 22, transitionDelay: `${index * 0.05}s` }}
              >
                <div className="flex flex-wrap items-center gap-3" style={{ marginBottom: 8 }}>
                  <h2 className="site-card-title" style={{ fontSize: 32 }}>
                    {item.title}
                  </h2>
                  <span className="site-chip">{item.org}</span>
                </div>
                <p className="site-card-copy" style={{ fontSize: 14 }}>
                  {item.desc}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="site-section">
        <div className="site-container site-container--narrow px-6 py-10">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row" data-reveal>
            <p className="site-copy" style={{ fontSize: 13 }}>
              Explore other sections
            </p>
            <div className="site-footer-links">
              {[
                { label: "Knowledge Base", href: "/knowledge" },
                { label: "Learning Paths", href: "/learn" },
                { label: "Community", href: "/community" },
                { label: "Design Engine", href: "/engine" },
              ].map(({ label, href }) => (
                <Link key={href} href={href} className="site-mini-link">
                  {label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
