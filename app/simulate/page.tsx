"use client";

import { useState } from "react";
import { runPublicSimulation, PublicSimulationResult } from "../../lib/engine/api/publicSimulation";
import { AcousticResponseChart } from "@/components/engine/AcousticResponseChart";
import { downloadAcousticReport } from "@/lib/report/downloadpdf";

const BG = "#08090B";
const BG_PANEL = "#0F1116";
const BG_INPUT = "#0A0C10";
const BORDER = "rgba(201,168,76,0.12)";
const BORDER_FOCUS = "rgba(201,168,76,0.45)";
const GOLD = "#C9A84C";
const GOLD_BRIGHT = "#F0C96A";
const TEXT_PRIMARY = "rgba(235,225,200,0.92)";
const TEXT_SECONDARY = "rgba(180,170,140,0.6)";
const TEXT_LABEL = "rgba(180,170,140,0.5)";
const ERROR_COLOR = "#E05A5A";
const FONT = "'DM Mono', 'Courier New', monospace";

type FieldDef = {
  key: string;
  label: string;
  hint: string;
  defaultVal: number;
};

const ROOM_FIELDS: FieldDef[] = [
  { key: "roomWidth",  label: "Width",  hint: "metres · X axis", defaultVal: 5.5 },
  { key: "roomHeight", label: "Height", hint: "metres · Y axis", defaultVal: 2.8 },
  { key: "roomLength", label: "Length", hint: "metres · Z axis", defaultVal: 7.2 },
];

const SUB_FIELDS: FieldDef[] = [
  { key: "subX", label: "Sub X", hint: "position · metres", defaultVal: 0.3 },
  { key: "subY", label: "Sub Y", hint: "position · metres", defaultVal: 0.3 },
  { key: "subZ", label: "Sub Z", hint: "position · metres", defaultVal: 0.3 },
];

const SEAT_FIELDS: FieldDef[] = [
  { key: "seatingCenterX", label: "Centre X",   hint: "seating row · metres", defaultVal: 2.75 },
  { key: "seatingY",       label: "Depth Y",    hint: "seating row · metres", defaultVal: 4.8  },
  { key: "earHeight",      label: "Ear Height", hint: "above floor · metres", defaultVal: 1.2  },
];

const ALL_DEFAULTS: Record<string, number> = {};
[...ROOM_FIELDS, ...SUB_FIELDS, ...SEAT_FIELDS].forEach((f) => {
  ALL_DEFAULTS[f.key] = f.defaultVal;
});

const PROJECT_TYPES = ["Home Theater", "Studio", "Living Room", "Other"];

// ─────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────

function InputField({
  field,
  value,
  onChange,
}: {
  field: FieldDef;
  value: number;
  onChange: (key: string, val: number) => void;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      <label
        style={{
          fontFamily: FONT,
          fontSize: "9px",
          letterSpacing: "2px",
          color: focused ? GOLD : TEXT_LABEL,
          textTransform: "uppercase",
          transition: "color 0.2s",
        }}
      >
        {field.label}
      </label>
      <input
        type="number"
        step="0.1"
        value={value}
        onChange={(e) => onChange(field.key, parseFloat(e.target.value) || 0)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          background: BG_INPUT,
          border: `1px solid ${focused ? BORDER_FOCUS : BORDER}`,
          borderRadius: "6px",
          padding: "10px 12px",
          color: TEXT_PRIMARY,
          fontFamily: FONT,
          fontSize: "14px",
          outline: "none",
          width: "100%",
          boxSizing: "border-box",
          transition: "border-color 0.2s, box-shadow 0.2s",
          boxShadow: focused ? `0 0 0 3px rgba(201,168,76,0.07)` : "none",
        }}
      />
      <span style={{ fontFamily: FONT, fontSize: "9px", color: TEXT_LABEL, letterSpacing: "0.5px" }}>
        {field.hint}
      </span>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
      <div
        style={{
          width: "2px",
          height: "16px",
          background: `linear-gradient(180deg, ${GOLD_BRIGHT}, ${GOLD})`,
          borderRadius: "1px",
          flexShrink: 0,
        }}
      />
      <span
        style={{
          fontFamily: FONT,
          fontSize: "9px",
          letterSpacing: "3px",
          color: GOLD,
          textTransform: "uppercase",
          opacity: 0.85,
        }}
      >
        {children}
      </span>
    </div>
  );
}

function FieldGroup({
  fields,
  values,
  onChange,
}: {
  fields: FieldDef[];
  values: Record<string, number>;
  onChange: (key: string, val: number) => void;
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px" }}>
      {fields.map((f) => (
        <InputField key={f.key} field={f} value={values[f.key]} onChange={onChange} />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// CTA Component
// ─────────────────────────────────────────────

type CTAProps = {
  rating: number;
  roomWidth: number;
  roomHeight: number;
  roomLength: number;
  flatnessDb: number;
  uniformityDb: number;
};

function ProfessionalConsultationCTA({
  rating,
  roomWidth,
  roomHeight,
  roomLength,
  flatnessDb,
  uniformityDb,
}: CTAProps) {
  const [open, setOpen]               = useState(false);
  const [submitted, setSubmitted]     = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [name, setName]               = useState("");
  const [email, setEmail]             = useState("");
  const [projectType, setProjectType] = useState(PROJECT_TYPES[0]);
  const [notes, setNotes]             = useState("");
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const isStrong    = rating >= 80;
  const accentColor = isStrong ? GOLD : GOLD_BRIGHT;

  const headlineText = isStrong
    ? "Room performance is strong. Optional professional optimisation available."
    : "Modal imbalance detected. Professional optimisation recommended.";

  const buttonText = isStrong
    ? "Request Expert Review"
    : "Request Professional Modal Optimisation";

  async function handleSubmit() {
    setSubmitError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/consultation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          projectType,
          notes,
          rating,
          flatnessDb,
          uniformityDb,
          roomWidth,
          roomHeight,
          roomLength,
          timestamp: new Date().toISOString(),
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error ?? "Submission failed. Please try again.");
      }

      setSubmitted(true);
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "An unexpected error occurred. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const inputStyle = (field: string): React.CSSProperties => ({
    background: "#08090B",
    border: `1px solid ${focusedField === field ? BORDER_FOCUS : BORDER}`,
    borderRadius: "6px",
    padding: "10px 12px",
    color: TEXT_PRIMARY,
    fontFamily: FONT,
    fontSize: "13px",
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
    transition: "border-color 0.2s, box-shadow 0.2s",
    boxShadow: focusedField === field ? `0 0 0 3px rgba(201,168,76,0.07)` : "none",
  });

  const labelStyle: React.CSSProperties = {
    fontFamily: FONT,
    fontSize: "9px",
    letterSpacing: "2px",
    color: TEXT_LABEL,
    textTransform: "uppercase",
    display: "block",
    marginBottom: "6px",
  };

  const submitDisabled = !name || !email || isSubmitting;

  return (
    <div
      style={{
        marginTop: "20px",
        background: BG_PANEL,
        border: `1px solid ${BORDER}`,
        borderLeft: `3px solid ${accentColor}`,
        borderRadius: "12px",
        overflow: "hidden",
        boxShadow: isStrong
          ? "none"
          : `0 0 40px rgba(201,168,76,0.06), 0 8px 32px rgba(0,0,0,0.4)`,
      }}
    >
      {/* Header row */}
      <div
        style={{
          padding: "22px 28px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "24px",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: "14px", flex: 1 }}>
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "8px",
              background: `rgba(201,168,76,${isStrong ? "0.08" : "0.14"})`,
              border: `1px solid rgba(201,168,76,${isStrong ? "0.15" : "0.25"})`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              marginTop: "2px",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="6.5" stroke={accentColor} strokeWidth="1.2" />
              <path
                d="M8 5v3.5M8 10.5v.5"
                stroke={accentColor}
                strokeWidth="1.4"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <div>
            <div
              style={{
                fontFamily: FONT,
                fontSize: "9px",
                letterSpacing: "2.5px",
                color: accentColor,
                textTransform: "uppercase",
                marginBottom: "6px",
                opacity: 0.85,
              }}
            >
              {isStrong ? "Professional Services" : "Optimisation Required"}
            </div>
            <div
              style={{
                fontFamily: FONT,
                fontSize: "13px",
                color: TEXT_PRIMARY,
                lineHeight: 1.55,
                maxWidth: "520px",
              }}
            >
              {headlineText}
            </div>
          </div>
        </div>

        {!submitted && (
          <button
            onClick={() => setOpen((v) => !v)}
            style={{
              background: open
                ? "transparent"
                : isStrong
                ? "rgba(201,168,76,0.1)"
                : `linear-gradient(135deg, ${GOLD}, ${GOLD_BRIGHT})`,
              border: open
                ? `1px solid ${BORDER}`
                : isStrong
                ? `1px solid rgba(201,168,76,0.3)`
                : "none",
              borderRadius: "8px",
              padding: "11px 22px",
              color: open ? TEXT_SECONDARY : isStrong ? GOLD : "#0A0B0D",
              fontFamily: FONT,
              fontSize: "10px",
              fontWeight: 600,
              letterSpacing: "1.5px",
              cursor: "pointer",
              textTransform: "uppercase",
              transition: "all 0.2s",
              whiteSpace: "nowrap",
              boxShadow: open || isStrong ? "none" : `0 4px 20px rgba(201,168,76,0.28)`,
              flexShrink: 0,
            }}
          >
            {open ? "Collapse" : buttonText}
          </button>
        )}
      </div>

      {/* Expandable form */}
      {open && !submitted && (
        <div
          style={{
            borderTop: `1px solid ${BORDER}`,
            padding: "28px 28px 32px",
            animation: "fadeUp 0.3s ease forwards",
          }}
        >
          <div
            style={{
              fontFamily: FONT,
              fontSize: "9px",
              letterSpacing: "2px",
              color: GOLD,
              textTransform: "uppercase",
              marginBottom: "24px",
              opacity: 0.7,
            }}
          >
            Consultation Request
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "18px",
              marginBottom: "18px",
            }}
          >
            {/* Name */}
            <div>
              <label style={labelStyle}>Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onFocus={() => setFocusedField("name")}
                onBlur={() => setFocusedField(null)}
                placeholder="Your name"
                style={{ ...inputStyle("name"), color: name ? TEXT_PRIMARY : TEXT_LABEL }}
              />
            </div>

            {/* Email */}
            <div>
              <label style={labelStyle}>Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onFocus={() => setFocusedField("email")}
                onBlur={() => setFocusedField(null)}
                placeholder="you@domain.com"
                style={{ ...inputStyle("email"), color: email ? TEXT_PRIMARY : TEXT_LABEL }}
              />
            </div>
          </div>

          {/* Project type */}
          <div style={{ marginBottom: "18px" }}>
            <label style={labelStyle}>Project Type</label>
            <select
              value={projectType}
              onChange={(e) => setProjectType(e.target.value)}
              onFocus={() => setFocusedField("project")}
              onBlur={() => setFocusedField(null)}
              style={{
                ...inputStyle("project"),
                appearance: "none",
                WebkitAppearance: "none",
                cursor: "pointer",
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23C9A84C' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
                backgroundRepeat: "no-repeat",
                backgroundPosition: "right 12px center",
                paddingRight: "36px",
              }}
            >
              {PROJECT_TYPES.map((t) => (
                <option key={t} value={t} style={{ background: "#0F1116", color: TEXT_PRIMARY }}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div style={{ marginBottom: "24px" }}>
            <label style={labelStyle}>Project Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onFocus={() => setFocusedField("notes")}
              onBlur={() => setFocusedField(null)}
              placeholder="Describe your project, goals, or any specific concerns..."
              rows={4}
              style={{
                ...inputStyle("notes"),
                resize: "vertical",
                lineHeight: 1.6,
                color: notes ? TEXT_PRIMARY : TEXT_LABEL,
              }}
            />
          </div>

          {/* Simulation summary */}
          <div
            style={{
              background: "rgba(201,168,76,0.04)",
              border: `1px solid ${BORDER}`,
              borderRadius: "8px",
              padding: "14px 16px",
              marginBottom: "24px",
              display: "flex",
              gap: "24px",
              flexWrap: "wrap",
            }}
          >
            <div style={{ fontFamily: FONT, fontSize: "9px", color: TEXT_LABEL, letterSpacing: "1px" }}>
              Attached simulation data:
            </div>
            {[
              { k: "Rating",    v: `${Math.round(rating)}/100` },
              { k: "Flatness",  v: `${flatnessDb.toFixed(2)} dB` },
              { k: "Uniformity",v: `${uniformityDb.toFixed(2)} dB` },
              { k: "Room",      v: `${roomWidth}×${roomHeight}×${roomLength} m` },
            ].map((item) => (
              <div key={item.k} style={{ display: "flex", gap: "6px", alignItems: "baseline" }}>
                <span style={{ fontFamily: FONT, fontSize: "9px", color: TEXT_LABEL, letterSpacing: "1px" }}>
                  {item.k}:
                </span>
                <span style={{ fontFamily: FONT, fontSize: "11px", color: GOLD_BRIGHT }}>
                  {item.v}
                </span>
              </div>
            ))}
          </div>

          {/* Submit row */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "10px" }}>
            {submitError && (
              <div
                style={{
                  width: "100%",
                  background: "rgba(224,90,90,0.08)",
                  border: `1px solid rgba(224,90,90,0.25)`,
                  borderRadius: "6px",
                  padding: "10px 14px",
                  fontFamily: FONT,
                  fontSize: "11px",
                  color: ERROR_COLOR,
                  letterSpacing: "0.3px",
                }}
              >
                ⚠ {submitError}
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={submitDisabled}
              style={{
                background: submitDisabled
                  ? "rgba(201,168,76,0.08)"
                  : `linear-gradient(135deg, ${GOLD}, ${GOLD_BRIGHT})`,
                border: "none",
                borderRadius: "8px",
                padding: "12px 32px",
                color: submitDisabled ? TEXT_LABEL : "#0A0B0D",
                fontFamily: FONT,
                fontSize: "10px",
                fontWeight: 600,
                letterSpacing: "2px",
                cursor: submitDisabled ? "not-allowed" : "pointer",
                textTransform: "uppercase",
                transition: "all 0.2s",
                boxShadow: submitDisabled ? "none" : `0 4px 20px rgba(201,168,76,0.28)`,
                display: "flex",
                alignItems: "center",
                gap: "8px",
                minWidth: "180px",
                justifyContent: "center",
              }}
            >
              {isSubmitting ? (
                <>
                  <span
                    style={{
                      display: "inline-block",
                      width: "10px",
                      height: "10px",
                      border: `2px solid rgba(201,168,76,0.4)`,
                      borderTopColor: GOLD,
                      borderRadius: "50%",
                      animation: "spin 0.7s linear infinite",
                    }}
                  />
                  Sending…
                </>
              ) : (
                "Submit Request"
              )}
            </button>
          </div>
        </div>
      )}

      {/* Success state */}
      {submitted && (
        <div
          style={{
            borderTop: `1px solid ${BORDER}`,
            padding: "28px",
            display: "flex",
            alignItems: "center",
            gap: "16px",
            animation: "fadeUp 0.3s ease forwards",
          }}
        >
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "50%",
              background: "rgba(110,231,160,0.12)",
              border: "1px solid rgba(110,231,160,0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M2.5 7L5.5 10L11.5 4"
                stroke="#6EE7A0"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div>
            <div style={{ fontFamily: FONT, fontSize: "12px", color: "#6EE7A0", marginBottom: "4px" }}>
              Request submitted successfully.
            </div>
            <div style={{ fontFamily: FONT, fontSize: "10px", color: TEXT_LABEL }}>
              Your simulation data has been logged. A specialist will be in contact shortly.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────

export default function SimulatePage() {
  const [values, setValues]   = useState<Record<string, number>>(ALL_DEFAULTS);
  const [result, setResult]   = useState<PublicSimulationResult | null>(null);
  const [error, setError]     = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  function handleChange(key: string, val: number) {
    setValues((prev) => ({ ...prev, [key]: val }));
  }

  function handleRun() {
    setError(null);
    setRunning(true);
    setResult(null);
    try {
      const res = runPublicSimulation(
        values.roomWidth,
        values.roomHeight,
        values.roomLength,
        [{ x: values.subX, y: values.subY, z: values.subZ }],
        values.seatingCenterX,
        values.seatingY,
        values.earHeight
      );
      setResult(res);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Simulation failed. Check your input values."
      );
    } finally {
      setRunning(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: BG,
        fontFamily: FONT,
        color: TEXT_PRIMARY,
        padding: "0 0 80px",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500;600&display=swap');
        * { box-sizing: border-box; }
        input[type=number]::-webkit-inner-spin-button,
        input[type=number]::-webkit-outer-spin-button { opacity: 0.3; }
        input[type=number] { -moz-appearance: textfield; }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.35; }
        }
      `}</style>

      {/* Top bar */}
      <div
        style={{
          borderBottom: `1px solid ${BORDER}`,
          padding: "0 40px",
          height: "60px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "rgba(10,11,14,0.9)",
          backdropFilter: "blur(12px)",
          position: "sticky",
          top: 0,
          zIndex: 100,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            style={{
              width: "28px",
              height: "28px",
              borderRadius: "6px",
              border: `1px solid ${BORDER}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(201,168,76,0.07)",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M1 10 Q3.5 2 7 7 Q10.5 12 13 4"
                stroke={GOLD}
                strokeWidth="1.5"
                strokeLinecap="round"
                fill="none"
              />
            </svg>
          </div>
          <span style={{ fontSize: "12px", letterSpacing: "1px", color: TEXT_PRIMARY, fontWeight: 500 }}>
            ACOUSTIC ENGINE
          </span>
        </div>
        <span style={{ fontSize: "9px", letterSpacing: "2px", color: TEXT_LABEL }}>
          MODAL SIMULATION v4.2
        </span>
      </div>

      {/* Hero */}
      <div
        style={{
          textAlign: "center",
          padding: "64px 24px 48px",
          maxWidth: "680px",
          margin: "0 auto",
        }}
      >
        <div
          style={{
            display: "inline-block",
            fontSize: "9px",
            letterSpacing: "3px",
            color: GOLD,
            background: "rgba(201,168,76,0.08)",
            border: `1px solid rgba(201,168,76,0.15)`,
            borderRadius: "20px",
            padding: "5px 14px",
            marginBottom: "24px",
            textTransform: "uppercase",
          }}
        >
          Phase 44 · Public Demo
        </div>
        <h1
          style={{
            fontSize: "clamp(24px, 4vw, 38px)",
            fontWeight: 600,
            color: TEXT_PRIMARY,
            letterSpacing: "-0.5px",
            margin: "0 0 16px",
            lineHeight: 1.25,
          }}
        >
          Room Acoustic Simulator
        </h1>
        <p
          style={{
            fontSize: "13px",
            color: TEXT_SECONDARY,
            lineHeight: 1.7,
            margin: 0,
            letterSpacing: "0.2px",
          }}
        >
          Configure your room dimensions and subwoofer placement to compute a
          physics-grade modal frequency response and spatial uniformity score.
        </p>
      </div>

      {/* Input panel */}
      <div style={{ maxWidth: "820px", margin: "0 auto", padding: "0 24px" }}>
        <div
          style={{
            background: BG_PANEL,
            border: `1px solid ${BORDER}`,
            borderRadius: "14px",
            overflow: "hidden",
            boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
          }}
        >
          <div style={{ padding: "28px 28px 24px", borderBottom: `1px solid ${BORDER}` }}>
            <SectionLabel>Room Dimensions</SectionLabel>
            <FieldGroup fields={ROOM_FIELDS} values={values} onChange={handleChange} />
          </div>
          <div style={{ padding: "28px 28px 24px", borderBottom: `1px solid ${BORDER}` }}>
            <SectionLabel>Subwoofer Position</SectionLabel>
            <FieldGroup fields={SUB_FIELDS} values={values} onChange={handleChange} />
          </div>
          <div style={{ padding: "28px 28px 24px" }}>
            <SectionLabel>Listening Position</SectionLabel>
            <FieldGroup fields={SEAT_FIELDS} values={values} onChange={handleChange} />
          </div>

          <div
            style={{
              padding: "20px 28px 28px",
              display: "flex",
              justifyContent: "flex-end",
              alignItems: "center",
              gap: "16px",
              borderTop: `1px solid ${BORDER}`,
            }}
          >
            {error && (
              <span style={{ fontSize: "11px", color: ERROR_COLOR, letterSpacing: "0.3px", flex: 1 }}>
                ⚠ {error}
              </span>
            )}
            <button
              onClick={handleRun}
              disabled={running}
              style={{
                background: running
                  ? "rgba(201,168,76,0.12)"
                  : `linear-gradient(135deg, ${GOLD}, ${GOLD_BRIGHT})`,
                border: "none",
                borderRadius: "8px",
                padding: "12px 32px",
                color: running ? GOLD : "#0A0B0D",
                fontFamily: FONT,
                fontSize: "11px",
                fontWeight: 600,
                letterSpacing: "2px",
                cursor: running ? "not-allowed" : "pointer",
                textTransform: "uppercase",
                transition: "all 0.2s",
                boxShadow: running ? "none" : `0 4px 24px rgba(201,168,76,0.3)`,
                minWidth: "180px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
              }}
            >
              {running ? (
                <>
                  <span
                    style={{
                      display: "inline-block",
                      width: "10px",
                      height: "10px",
                      border: `2px solid ${GOLD}`,
                      borderTopColor: "transparent",
                      borderRadius: "50%",
                      animation: "spin 0.7s linear infinite",
                    }}
                  />
                  Computing…
                </>
              ) : (
                "Run Simulation"
              )}
            </button>
          </div>
        </div>

        {/* Result */}
        {result && (
          <div
            style={{
              marginTop: "40px",
              animation: "fadeUp 0.5s cubic-bezier(0.4,0,0.2,1) forwards",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: "12px",
                marginBottom: "16px",
              }}
            >
              {[
                { label: "Flatness",   value: `${result.flatnessDb.toFixed(2)} dB`,  hint: "response deviation"     },
                { label: "Uniformity", value: `${result.uniformityDb.toFixed(2)} dB`, hint: "seat-to-seat variation" },
                { label: "Combined",   value: result.combinedScore.toFixed(3),         hint: "lower = better"         },
              ].map((stat) => (
                <div
                  key={stat.label}
                  style={{
                    background: BG_PANEL,
                    border: `1px solid ${BORDER}`,
                    borderRadius: "10px",
                    padding: "16px 20px",
                  }}
                >
                  <div
                    style={{
                      fontSize: "9px",
                      letterSpacing: "2px",
                      color: TEXT_LABEL,
                      textTransform: "uppercase",
                      marginBottom: "8px",
                    }}
                  >
                    {stat.label}
                  </div>
                  <div
                    style={{
                      fontSize: "22px",
                      fontWeight: 600,
                      color: GOLD_BRIGHT,
                      letterSpacing: "-0.5px",
                      marginBottom: "4px",
                    }}
                  >
                    {stat.value}
                  </div>
                  <div style={{ fontSize: "9px", color: TEXT_LABEL }}>{stat.hint}</div>
                </div>
              ))}
            </div>

            <AcousticResponseChart
              frequencyResponse={result.frequencyResponse}
              rating={result.rating}
              recommendedMessage={result.recommendedMessage}
            />

            <ProfessionalConsultationCTA
              rating={result.rating}
              roomWidth={values.roomWidth}
              roomHeight={values.roomHeight}
              roomLength={values.roomLength}
              flatnessDb={result.flatnessDb}
              uniformityDb={result.uniformityDb}
            />
          </div>
        )}
      </div>
    </div>
  );
}