"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { useSiteReveal } from "@/hooks/useSiteReveal";

const PAGE_STYLE = { "--page-accent": "#1f9a74" } as CSSProperties;

const FEATURES = [
  {
    num: "01",
    title: "Case Studies",
    desc: "Documented installations with room dimensions, treatment strategy, equipment context, measurements, and lessons learned.",
    tags: ["Before/After", "Measurements", "Lessons Learned"],
  },
  {
    num: "02",
    title: "Problem-Solving Database",
    desc: "Searchable Q&A for common and uncommon acoustic problems across different room constraints.",
    tags: ["Troubleshooting", "Q&A", "Indexed"],
  },
  {
    num: "03",
    title: "User-Submitted Designs",
    desc: "Design Engine exports shared for critique, discussion, and iteration around real rooms.",
    tags: ["Engine Exports", "Design Review", "Discussion"],
  },
  {
    num: "04",
    title: "Build Journals",
    desc: "Long-form build documentation from concept through commissioning as projects evolve.",
    tags: ["Build Logs", "Progress", "Real Builds"],
  },
];

const CASES = [
  {
    label: "12 × 18 ft dedicated room",
    detail: "Concrete slab, 9 ft ceiling, 7.1.4 Atmos",
    tag: "Treatment Heavy",
  },
  {
    label: "Media room conversion",
    detail: "Existing drywall, 8 ft ceiling, living room retrofit",
    tag: "Budget Constrained",
  },
  {
    label: "Basement build",
    detail: "Room-in-room framing, HVAC integration, 5.1 reference theater",
    tag: "New Construction",
  },
];

export default function CommunityPage() {
  useSiteReveal();

  return (
    <main className="site-shell" style={PAGE_STYLE}>
      <section className="site-hero">
        <div className="site-container site-container--narrow px-6 py-18 md:py-22">
          <div data-reveal="left" style={{ maxWidth: 760 }}>
            <p className="site-eyebrow">Section 06</p>
            <h1 className="site-title site-title--medium" style={{ marginBottom: 18 }}>
              Community & <span className="site-title-strong">Case Studies</span>
            </h1>
            <p className="site-copy" style={{ fontSize: 17, maxWidth: 700, marginBottom: 28 }}>
              The practical, human side of home theater work: shared builds, case-based thinking,
              problem solving, and discussion around real rooms.
            </p>
            <div className="site-badge">
              <span className="site-badge-dot" />
              Community platform launching soon
            </div>
          </div>
        </div>
      </section>

      <section className="site-section">
        <div className="site-container site-container--narrow px-6 py-16 md:py-18">
          <div className="site-divider-row" data-reveal>
            <span className="site-divider-label">Platform Features</span>
            <div className="site-divider-line" />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {FEATURES.map((item, index) => (
              <article
                key={item.num}
                data-reveal="scale"
                className="site-glass-card"
                style={{ padding: 22, transitionDelay: `${index * 0.05}s` }}
              >
                <div className="site-card-kicker" style={{ marginBottom: 12 }}>
                  <span className="site-badge-dot site-pulse-dot" style={{ width: 8, height: 8 }} />
                  {item.num}
                </div>
                <h2 className="site-card-title" style={{ fontSize: 36, marginBottom: 10 }}>
                  {item.title}
                </h2>
                <p className="site-card-copy" style={{ fontSize: 14, marginBottom: 16 }}>
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
            <span className="site-divider-label">Preview Case Studies</span>
            <div className="site-divider-line" />
          </div>

          <div className="flex flex-col gap-4">
            {CASES.map((item, index) => (
              <article
                key={item.label}
                data-reveal="left"
                className="site-glass-card site-glass-card--soft"
                style={{ padding: 20, transitionDelay: `${index * 0.05}s` }}
              >
                <div className="flex items-center gap-4">
                  <div
                    className="site-glass-card"
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: 14,
                      flexShrink: 0,
                      background:
                        "linear-gradient(180deg, rgba(255,255,255,0.32), rgba(255,255,255,0.14)), linear-gradient(135deg, rgba(31,154,116,0.16), transparent 64%)",
                    }}
                  />
                  <div style={{ flex: 1 }}>
                    <div className="flex flex-wrap items-center gap-2" style={{ marginBottom: 4 }}>
                      <h2 className="site-card-title" style={{ fontSize: 30 }}>
                        {item.label}
                      </h2>
                      <span className="site-chip">{item.tag}</span>
                    </div>
                    <p className="site-card-copy" style={{ fontSize: 14 }}>
                      {item.detail}
                    </p>
                  </div>
                  <span className="site-badge">Soon</span>
                </div>
              </article>
            ))}
          </div>

          <p className="site-copy" style={{ fontSize: 13, textAlign: "center", marginTop: 24 }} data-reveal>
            More case studies will appear as community members start sharing Design Engine outputs and room journeys.
          </p>
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
                { label: "Design Engine", href: "/engine" },
                { label: "Learning Paths", href: "/learn" },
                { label: "Resources", href: "/resources" },
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
