import React from "react";

type Props = {
  room: {
    width: number;
    height: number;
    length: number;
    volume: number;
  };
  flatnessDb: number;
  uniformityDb: number;
  combinedScore: number;
  rating: number;
  recommendedMessage: string;
};

const FONT_SERIF = "'Georgia', 'Times New Roman', serif";
const FONT_MONO = "'Courier New', 'Lucida Console', monospace";
const FONT_SANS = "'Helvetica Neue', 'Arial', sans-serif";

const INK = "#1A1A1A";
const INK_MID = "#444444";
const INK_LIGHT = "#777777";
const INK_FAINT = "#AAAAAA";
const RULE = "#D8D4CC";
const RULE_DARK = "#B8B4AC";
const BG_PAGE = "#FFFFFF";
const BG_TABLE_HEAD = "#F4F2EE";
const BG_TABLE_ALT = "#FAF9F7";
const BG_ADVISORY = "#F7F5F0";
const ACCENT = "#2C4A7C";
const ACCENT_LIGHT = "#E8EDF5";
const GOLD = "#8C6D2E";
const GOLD_LIGHT = "#F5EDD8";

const RATING_COLORS: Record<string, string> = {
  excellent: "#1A6B3C",
  good: "#2C5F8A",
  fair: "#8C5A1A",
  poor: "#8C1A1A",
};
const RATING_BG: Record<string, string> = {
  excellent: "#EDF7F1",
  good: "#EDF3FA",
  fair: "#FAF2E8",
  poor: "#FAE8E8",
};

function getRatingBand(rating: number): "excellent" | "good" | "fair" | "poor" {
  if (rating >= 80) return "excellent";
  if (rating >= 60) return "good";
  if (rating >= 40) return "fair";
  return "poor";
}

function getRatingLabel(rating: number): string {
  if (rating >= 80) return "EXCELLENT";
  if (rating >= 60) return "GOOD";
  if (rating >= 40) return "FAIR";
  return "POOR";
}

function getInterpretationParagraph(rating: number): string {
  if (rating >= 80) {
    return "The analysed room and subwoofer configuration demonstrates professional-grade low-frequency consistency. Modal resonances are well-distributed across the listening plane, and seat-to-seat variation falls within the threshold considered acceptable for critical listening environments, including mastering studios and high-performance home theatre installations. The spatially averaged frequency response exhibits minimal deviation from flatness within the 30–120 Hz band, indicating that standing wave interference is either well-controlled by the room geometry, the source placement, or both. No significant corrective intervention is required; minor equalisation may be applied optionally to address residual spectral tilt.";
  }
  if (rating >= 60) {
    return "The configuration demonstrates good low-frequency performance with minor modal irregularities that fall within acceptable limits for most high-quality listening environments. The spatially averaged response is broadly consistent, though localised resonance peaks or troughs may be perceptible at specific listening positions or narrow frequency bands. The seat-to-seat variation index suggests that most positions in the listening row will experience a similar tonal balance, with occasional outliers near room boundaries. Targeted acoustic treatment, subwoofer repositioning, or parametric equalisation at the identified modal frequencies would bring performance to the excellent band.";
  }
  if (rating >= 40) {
    return "A noticeable modal imbalance has been identified in the analysed configuration. The flatness and uniformity metrics indicate that one or more room modes are producing significant spectral colouration within the 30–120 Hz band, and that the pressure distribution across the listening plane is uneven to a degree likely to be audible as tonal inconsistency between seats. Rooms in this performance band typically exhibit one or two axial mode clusters with elevated severity scores that concentrate most of the problematic energy. Optimisation of subwoofer placement, introduction of broadband bass absorption at identified pressure antinodes, or application of a dedicated room correction DSP system is strongly recommended.";
  }
  return "The analysis has identified significant modal issues within the room and configuration under evaluation. Both spectral flatness and seat-to-seat uniformity are substantially below acceptable thresholds, indicating that standing wave resonances are dominating the low-frequency response in a way that will produce severe tonal colouration, extended bass decay, and large variations in perceived bass level between listening positions. This level of modal severity is typically associated with unfavourable room aspect ratios, first-reflection modal clustering, or subwoofer placement at high-pressure positions for multiple problem modes simultaneously. Professional acoustic calibration, physical room treatment, and a multi-subwoofer strategy with optimised delay and gain alignment are strongly recommended before this space is used for critical listening or client-facing work.";
}

function fmt(n: number, dec = 2): string {
  return n.toFixed(dec);
}

function today(): string {
  const d = new Date();
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function HRule({ style }: { style?: React.CSSProperties }) {
  return (
    <div
      style={{
        borderBottom: `1px solid ${RULE_DARK}`,
        margin: "28px 0",
        ...style,
      }}
    />
  );
}

function SectionTitle({
  number,
  children,
}: {
  number: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: "14px", marginBottom: "18px" }}>
      <span
        style={{
          fontFamily: FONT_MONO,
          fontSize: "10px",
          color: INK_FAINT,
          letterSpacing: "1px",
          flexShrink: 0,
        }}
      >
        {number}
      </span>
      <span
        style={{
          fontFamily: FONT_SANS,
          fontSize: "11px",
          fontWeight: 700,
          letterSpacing: "2.5px",
          color: ACCENT,
          textTransform: "uppercase",
        }}
      >
        {children}
      </span>
      <div style={{ flex: 1, borderBottom: `1px solid ${RULE}`, marginBottom: "3px" }} />
    </div>
  );
}

function MetricRow({
  label,
  value,
  unit,
  note,
  highlight,
}: {
  label: string;
  value: string;
  unit?: string;
  note?: string;
  highlight?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        padding: "10px 14px",
        background: highlight ? ACCENT_LIGHT : "transparent",
        borderRadius: "4px",
        borderBottom: `1px solid ${RULE}`,
      }}
    >
      <div style={{ flex: 1 }}>
        <span
          style={{
            fontFamily: FONT_SANS,
            fontSize: "12px",
            color: highlight ? ACCENT : INK_MID,
            fontWeight: highlight ? 600 : 400,
          }}
        >
          {label}
        </span>
        {note && (
          <span
            style={{
              fontFamily: FONT_MONO,
              fontSize: "9px",
              color: INK_FAINT,
              marginLeft: "10px",
              letterSpacing: "0.5px",
            }}
          >
            {note}
          </span>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: "4px" }}>
        <span
          style={{
            fontFamily: FONT_MONO,
            fontSize: highlight ? "16px" : "14px",
            fontWeight: highlight ? 700 : 500,
            color: highlight ? ACCENT : INK,
            letterSpacing: "-0.3px",
          }}
        >
          {value}
        </span>
        {unit && (
          <span
            style={{
              fontFamily: FONT_MONO,
              fontSize: "10px",
              color: INK_FAINT,
            }}
          >
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}

export function AcousticReport({
  room,
  flatnessDb,
  uniformityDb,
  combinedScore,
  rating,
  recommendedMessage,
}: Props) {
  const band = getRatingBand(rating);
  const bandLabel = getRatingLabel(rating);
  const interpretation = getInterpretationParagraph(rating);
  const ratingColor = RATING_COLORS[band];
  const ratingBg = RATING_BG[band];

  return (
    <div
      style={{
        background: BG_PAGE,
        maxWidth: "800px",
        margin: "0 auto",
        padding: "64px 72px",
        fontFamily: FONT_SANS,
        color: INK,
        lineHeight: 1.6,
        position: "relative",
      }}
    >
      {/* Watermark stripe */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "5px",
          background: `linear-gradient(90deg, ${ACCENT} 0%, #4A7CC4 60%, ${ACCENT} 100%)`,
        }}
      />

      {/* ── HEADER ── */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: "40px",
          paddingTop: "12px",
        }}
      >
        <div>
          <div
            style={{
              fontFamily: FONT_MONO,
              fontSize: "9px",
              letterSpacing: "3px",
              color: ACCENT,
              textTransform: "uppercase",
              marginBottom: "8px",
            }}
          >
            Science of Sound
          </div>
          <h1
            style={{
              fontFamily: FONT_SERIF,
              fontSize: "26px",
              fontWeight: 400,
              color: INK,
              margin: "0 0 6px",
              letterSpacing: "-0.3px",
              lineHeight: 1.2,
            }}
          >
            Acoustic Performance Report
          </h1>
          <div
            style={{
              fontFamily: FONT_SANS,
              fontSize: "13px",
              color: INK_LIGHT,
              letterSpacing: "0.2px",
            }}
          >
            Modal Analysis — Low-Frequency Response
          </div>
        </div>

        <div style={{ textAlign: "right", paddingTop: "4px" }}>
          <div
            style={{
              fontFamily: FONT_MONO,
              fontSize: "9px",
              color: INK_FAINT,
              letterSpacing: "1px",
              marginBottom: "4px",
              textTransform: "uppercase",
            }}
          >
            Date Generated
          </div>
          <div
            style={{
              fontFamily: FONT_SANS,
              fontSize: "12px",
              color: INK_MID,
            }}
          >
            {today()}
          </div>
          <div
            style={{
              marginTop: "12px",
              display: "inline-flex",
              alignItems: "center",
              gap: "7px",
              background: ratingBg,
              border: `1px solid ${ratingColor}30`,
              borderRadius: "4px",
              padding: "5px 12px",
            }}
          >
            <div
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                background: ratingColor,
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontFamily: FONT_MONO,
                fontSize: "9px",
                letterSpacing: "2px",
                color: ratingColor,
                fontWeight: 700,
              }}
            >
              {bandLabel}
            </span>
          </div>
        </div>
      </div>

      <HRule style={{ margin: "0 0 36px" }} />

      {/* ── SECTION 1: ROOM SUMMARY ── */}
      <div style={{ marginBottom: "36px" }}>
        <SectionTitle number="01">Room Specification</SectionTitle>

        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontFamily: FONT_SANS,
            fontSize: "12px",
          }}
        >
          <thead>
            <tr style={{ background: BG_TABLE_HEAD }}>
              {["Dimension", "Value", "Unit"].map((h) => (
                <th
                  key={h}
                  style={{
                    textAlign: "left",
                    padding: "9px 14px",
                    fontWeight: 600,
                    fontSize: "10px",
                    letterSpacing: "1.5px",
                    textTransform: "uppercase",
                    color: INK_MID,
                    borderBottom: `1px solid ${RULE_DARK}`,
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              { dim: "Width", val: fmt(room.width, 2), unit: "m" },
              { dim: "Height", val: fmt(room.height, 2), unit: "m" },
              { dim: "Length", val: fmt(room.length, 2), unit: "m" },
              { dim: "Volume", val: fmt(room.volume, 3), unit: "m³" },
            ].map((row, i) => (
              <tr
                key={row.dim}
                style={{ background: i % 2 === 1 ? BG_TABLE_ALT : BG_PAGE }}
              >
                <td
                  style={{
                    padding: "9px 14px",
                    color: INK_MID,
                    borderBottom: `1px solid ${RULE}`,
                  }}
                >
                  {row.dim}
                </td>
                <td
                  style={{
                    padding: "9px 14px",
                    fontFamily: FONT_MONO,
                    fontWeight: 600,
                    color: INK,
                    borderBottom: `1px solid ${RULE}`,
                    letterSpacing: "0.3px",
                  }}
                >
                  {row.val}
                </td>
                <td
                  style={{
                    padding: "9px 14px",
                    fontFamily: FONT_MONO,
                    fontSize: "10px",
                    color: INK_FAINT,
                    borderBottom: `1px solid ${RULE}`,
                  }}
                >
                  {row.unit}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── SECTION 2: PERFORMANCE METRICS ── */}
      <div style={{ marginBottom: "36px" }}>
        <SectionTitle number="02">Performance Metrics</SectionTitle>

        <div style={{ display: "flex", gap: "24px", marginBottom: "16px" }}>
          {/* Numeric rating badge */}
          <div
            style={{
              flexShrink: 0,
              width: "110px",
              background: ratingBg,
              border: `1px solid ${ratingColor}25`,
              borderRadius: "8px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "20px 12px",
            }}
          >
            <div
              style={{
                fontFamily: FONT_MONO,
                fontSize: "42px",
                fontWeight: 700,
                color: ratingColor,
                lineHeight: 1,
                letterSpacing: "-2px",
              }}
            >
              {Math.round(rating)}
            </div>
            <div
              style={{
                fontFamily: FONT_MONO,
                fontSize: "9px",
                color: ratingColor,
                letterSpacing: "1.5px",
                opacity: 0.7,
                marginTop: "4px",
              }}
            >
              / 100
            </div>
            <div
              style={{
                fontFamily: FONT_SANS,
                fontSize: "9px",
                fontWeight: 700,
                letterSpacing: "1.5px",
                color: ratingColor,
                textTransform: "uppercase",
                marginTop: "10px",
              }}
            >
              {bandLabel}
            </div>
          </div>

          {/* Metrics list */}
          <div style={{ flex: 1 }}>
            <MetricRow
              label="Spectral Flatness"
              value={fmt(flatnessDb)}
              unit="dB"
              note="std. deviation of averaged SPL"
            />
            <MetricRow
              label="Spatial Uniformity"
              value={fmt(uniformityDb)}
              unit="dB"
              note="mean seat-to-seat deviation"
            />
            <MetricRow
              label="Combined Score"
              value={fmt(combinedScore, 4)}
              note="lower is better"
            />
            <MetricRow
              label="Overall Rating"
              value={Math.round(rating).toString()}
              unit="/ 100"
              note="0–100 scale"
              highlight
            />
          </div>
        </div>
      </div>

      {/* ── SECTION 3: INTERPRETATION ── */}
      <div style={{ marginBottom: "36px" }}>
        <SectionTitle number="03">Technical Interpretation</SectionTitle>
        <p
          style={{
            fontFamily: FONT_SERIF,
            fontSize: "13.5px",
            color: INK_MID,
            lineHeight: 1.85,
            margin: 0,
            letterSpacing: "0.1px",
          }}
        >
          {interpretation}
        </p>
      </div>

      {/* ── SECTION 4: RECOMMENDATION ── */}
      <div style={{ marginBottom: "36px" }}>
        <SectionTitle number="04">Advisory Recommendation</SectionTitle>

        <div
          style={{
            background: GOLD_LIGHT,
            border: `1px solid ${GOLD}40`,
            borderLeft: `4px solid ${GOLD}`,
            borderRadius: "4px",
            padding: "20px 22px",
          }}
        >
          <div
            style={{
              fontFamily: FONT_MONO,
              fontSize: "9px",
              letterSpacing: "2px",
              color: GOLD,
              textTransform: "uppercase",
              marginBottom: "10px",
            }}
          >
            Recommended Action
          </div>
          <p
            style={{
              fontFamily: FONT_SANS,
              fontSize: "14px",
              color: "#5C4010",
              margin: 0,
              lineHeight: 1.65,
              fontWeight: 500,
            }}
          >
            {recommendedMessage}
          </p>
        </div>
      </div>

      {/* ── SECTION 5: SIMULATION NOTES ── */}
      <div style={{ marginBottom: "48px" }}>
        <SectionTitle number="05">Simulation Assumptions</SectionTitle>
        <div
          style={{
            background: BG_ADVISORY,
            border: `1px solid ${RULE}`,
            borderRadius: "4px",
            padding: "18px 20px",
          }}
        >
          {[
            "Analysis is restricted to 30–120 Hz, encompassing the modal region for the specified room volume.",
            "A single subwoofer source with unity gain, zero delay, and positive polarity is assumed.",
            "Surface absorption uses broadband coefficients representative of a moderately furnished domestic environment.",
            "Five listener positions are auto-generated across ±0.6 m around the seating row centre.",
            "The modal model is physically accurate below the Schroeder frequency; above this threshold, diffuse-field statistics apply.",
            "Air absorption is computed using the ISO 9613-1 approximation at 20°C and 50% relative humidity.",
            "Results represent steady-state modal energy distribution and do not account for transient or time-domain effects.",
          ].map((note, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                gap: "12px",
                marginBottom: i < 6 ? "10px" : 0,
              }}
            >
              <span
                style={{
                  fontFamily: FONT_MONO,
                  fontSize: "9px",
                  color: INK_FAINT,
                  flexShrink: 0,
                  paddingTop: "2px",
                }}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <span
                style={{
                  fontFamily: FONT_SANS,
                  fontSize: "11.5px",
                  color: INK_LIGHT,
                  lineHeight: 1.6,
                }}
              >
                {note}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── FOOTER ── */}
      <div
        style={{
          borderTop: `1px solid ${RULE_DARK}`,
          paddingTop: "22px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
        }}
      >
        <div>
          <div
            style={{
              fontFamily: FONT_MONO,
              fontSize: "10px",
              color: INK_MID,
              letterSpacing: "0.5px",
              marginBottom: "4px",
            }}
          >
            Generated by Science of Sound Acoustic Engine
          </div>
          <div
            style={{
              fontFamily: FONT_MONO,
              fontSize: "9px",
              color: INK_FAINT,
              letterSpacing: "0.3px",
            }}
          >
            Physics-grade modal simulation · Phase 45 · v4.2
          </div>
        </div>
        <div
          style={{
            fontFamily: FONT_MONO,
            fontSize: "9px",
            color: INK_FAINT,
            textAlign: "right",
            lineHeight: 1.6,
          }}
        >
          <div>For professional use only.</div>
          <div>Results are simulation estimates only.</div>
        </div>
      </div>

      {/* Bottom accent bar */}
      <div
        style={{
          marginTop: "28px",
          height: "2px",
          background: `linear-gradient(90deg, ${ACCENT} 0%, transparent 100%)`,
          opacity: 0.3,
        }}
      />

      <style>{`
        @media print {
          body { margin: 0; }
          @page { size: A4; margin: 0; }
        }
      `}</style>
    </div>
  );
}