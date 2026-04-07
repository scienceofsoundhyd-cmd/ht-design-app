"use client";

import { useState, useEffect } from "react";

const BG_PANEL       = "#0F1116";
const BORDER         = "rgba(201,168,76,0.12)";
const BORDER_FOCUS   = "rgba(201,168,76,0.45)";
const GOLD           = "#C9A84C";
const GOLD_BRIGHT    = "#F0C96A";
const TEXT_PRIMARY   = "rgba(235,225,200,0.92)";
const TEXT_SECONDARY = "rgba(180,170,140,0.6)";
const TEXT_LABEL     = "rgba(180,170,140,0.5)";
const ERROR_COLOR    = "#E05A5A";
const FONT           = "'DM Mono', 'Courier New', monospace";

const PROJECT_TYPES = ["Home Theater", "Studio", "Living Room", "Other"];

type CTAProps = {
  rating: number;
  roomWidth: number;
  roomHeight: number;
  roomLength: number;
  flatnessDb: number;
  uniformityDb: number;
  subX: number;
  subY: number;
  subZ: number;
  seatingCenterX: number;
  seatingY: number;
  earHeight: number;
};

type Grecaptcha = {
  ready: (cb: () => void) => void;
  execute: (siteKey: string, options: { action: string }) => Promise<string>;
};

declare global {
  interface Window {
    grecaptcha?: Grecaptcha;
  }
}

export default function ProfessionalConsultationCTA({
  rating,
  roomWidth,
  roomHeight,
  roomLength,
  flatnessDb,
  uniformityDb,
  subX,
  subY,
  subZ,
  seatingCenterX,
  seatingY,
  earHeight,
}: CTAProps) {
  const [open, setOpen]                 = useState(false);
  const [submitted, setSubmitted]       = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError]   = useState<string | null>(null);
  const [name, setName]                 = useState("");
  const [email, setEmail]               = useState("");
  const [projectType, setProjectType]   = useState(PROJECT_TYPES[0]);
  const [notes, setNotes]               = useState("");
  const [company, setCompany]           = useState("");
  const [formStartTime]                 = useState(() => Date.now());
  const [focusedField, setFocusedField] = useState<string | null>(null);

  useEffect(() => {
    const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
    if (!siteKey || document.querySelector("#recaptcha-script")) return;
    const script  = document.createElement("script");
    script.id     = "recaptcha-script";
    script.src    = `https://www.google.com/recaptcha/api.js?render=${siteKey}`;
    script.async  = true;
    document.head.appendChild(script);
  }, []);

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
      const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;

      if (!siteKey) {
        throw new Error("reCAPTCHA is not configured. Please contact support.");
      }

      if (!window.grecaptcha) {
        throw new Error("Security verification not loaded. Please refresh and try again.");
      }

      const recaptchaToken: string = await new Promise<string>((resolve, reject) => {
        window.grecaptcha!.ready(() => {
          window.grecaptcha!
            .execute(siteKey, { action: "consultation_submit" })
            .then(resolve)
            .catch(() => reject(new Error("Security verification failed. Please try again.")));
        });
      });

      const response = await fetch("/api/consultation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          projectType,
          notes,
          company,
          formStartedAt: formStartTime,
          recaptchaToken,
          roomWidth,
          roomHeight,
          roomLength,
          subX,
          subY,
          subZ,
          seatingCenterX,
          seatingY,
          earHeight,
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

          {/* Honeypot — hidden from real users, visible to bots */}
          <input
            type="text"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            style={{ display: "none" }}
            tabIndex={-1}
            autoComplete="off"
          />

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
              { k: "Rating",     v: `${Math.round(rating)}/100` },
              { k: "Flatness",   v: `${flatnessDb.toFixed(2)} dB` },
              { k: "Uniformity", v: `${uniformityDb.toFixed(2)} dB` },
              { k: "Room",       v: `${roomWidth}×${roomHeight}×${roomLength} m` },
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