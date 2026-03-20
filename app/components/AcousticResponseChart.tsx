import React, { useMemo, useRef, useEffect, useState } from "react";

type Props = {
  frequencyResponse: {
    frequencyHz: number;
    averageSplDb: number;
  }[];
  rating: number;
  recommendedMessage: string;
};

const CHART_W = 800;
const CHART_H = 320;
const PAD = { top: 32, right: 40, bottom: 56, left: 64 };
const INNER_W = CHART_W - PAD.left - PAD.right;
const INNER_H = CHART_H - PAD.top - PAD.bottom;

const F_MIN = 20;
const F_MAX = 120;

const GOLD = "#C9A84C";
const GOLD_BRIGHT = "#F0C96A";
const GOLD_DIM = "rgba(201,168,76,0.18)";
const BG_DEEP = "#0A0B0D";
const BG_PANEL = "#111318";
const BG_CHART = "#0D0F14";
const GRID = "rgba(255,255,255,0.045)";
const AXIS_TEXT = "rgba(180,170,140,0.7)";
const LABEL = "rgba(180,170,140,0.45)";

function toX(hz: number): number {
  const t = (Math.log(hz) - Math.log(F_MIN)) / (Math.log(F_MAX) - Math.log(F_MIN));
  return PAD.left + t * INNER_W;
}

function toY(db: number, minDb: number, maxDb: number): number {
  const t = (db - minDb) / (maxDb - minDb);
  return PAD.top + INNER_H - t * INNER_H;
}

function buildPath(
  points: { frequencyHz: number; averageSplDb: number }[],
  minDb: number,
  maxDb: number
): string {
  const filtered = points.filter(
    (p) => p.frequencyHz >= F_MIN && p.frequencyHz <= F_MAX
  );
  if (filtered.length === 0) return "";
  return filtered
    .map((p, i) => {
      const x = toX(p.frequencyHz);
      const y = toY(p.averageSplDb, minDb, maxDb);
      return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
}

function buildAreaPath(
  points: { frequencyHz: number; averageSplDb: number }[],
  minDb: number,
  maxDb: number
): string {
  const filtered = points.filter(
    (p) => p.frequencyHz >= F_MIN && p.frequencyHz <= F_MAX
  );
  if (filtered.length === 0) return "";
  const line = filtered
    .map((p, i) => {
      const x = toX(p.frequencyHz);
      const y = toY(p.averageSplDb, minDb, maxDb);
      return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
  const lastX = toX(filtered[filtered.length - 1].frequencyHz).toFixed(2);
  const firstX = toX(filtered[0].frequencyHz).toFixed(2);
  const bottom = (PAD.top + INNER_H).toFixed(2);
  return `${line} L${lastX},${bottom} L${firstX},${bottom} Z`;
}

const F_TICKS = [20, 30, 40, 50, 60, 80, 100, 120];

function RatingArc({ rating, animate }: { rating: number; animate: boolean }) {
  const r = 64;
  const stroke = 6;
  const cx = 90;
  const cy = 90;
  const circumference = 2 * Math.PI * r;
  const arcFraction = 0.75;
  const dashArray = arcFraction * circumference;
  const dashOffset = dashArray - (animate ? rating / 100 : 0) * dashArray;
  const rotation = 135;

  const color =
    rating >= 80
      ? "#6EE7A0"
      : rating >= 60
      ? GOLD_BRIGHT
      : rating >= 40
      ? "#F09C4A"
      : "#E05A5A";

  return (
    <svg
      width={180}
      height={180}
      viewBox="0 0 180 180"
      style={{ display: "block", flexShrink: 0 }}
    >
      <defs>
        <filter id="arcglow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Track */}
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke="rgba(255,255,255,0.05)"
        strokeWidth={stroke}
        strokeDasharray={`${dashArray} ${circumference}`}
        strokeDashoffset={0}
        strokeLinecap="round"
        transform={`rotate(${rotation} ${cx} ${cy})`}
      />

      {/* Active arc */}
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeDasharray={`${dashArray} ${circumference}`}
        strokeDashoffset={dashOffset}
        strokeLinecap="round"
        transform={`rotate(${rotation} ${cx} ${cy})`}
        filter="url(#arcglow)"
        style={{
          transition: animate ? "stroke-dashoffset 1.4s cubic-bezier(0.4,0,0.2,1)" : "none",
        }}
      />

      {/* Inner circle */}
      <circle cx={cx} cy={cy} r={52} fill="rgba(0,0,0,0.35)" />

      {/* Rating number */}
      <text
        x={cx}
        y={cy - 6}
        textAnchor="middle"
        dominantBaseline="middle"
        style={{
          fontFamily: "'DM Mono', 'Courier New', monospace",
          fontSize: "32px",
          fontWeight: 600,
          fill: color,
          letterSpacing: "-1px",
        }}
      >
        {Math.round(rating)}
      </text>
      <text
        x={cx}
        y={cy + 22}
        textAnchor="middle"
        style={{
          fontFamily: "'DM Mono', 'Courier New', monospace",
          fontSize: "10px",
          fill: LABEL,
          letterSpacing: "2px",
          textTransform: "uppercase",
        }}
      >
        / 100
      </text>
    </svg>
  );
}

export function AcousticResponseChart({
  frequencyResponse,
  rating,
  recommendedMessage,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [pathLen, setPathLen] = useState(0);
  const pathRef = useRef<SVGPathElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (pathRef.current) {
      setPathLen(pathRef.current.getTotalLength());
    }
  }, [frequencyResponse]);

  const filtered = useMemo(
    () => frequencyResponse.filter((p) => p.frequencyHz >= F_MIN && p.frequencyHz <= F_MAX),
    [frequencyResponse]
  );

  const { minDb, maxDb } = useMemo(() => {
    if (filtered.length === 0) return { minDb: -40, maxDb: 0 };
    const vals = filtered.map((p) => p.averageSplDb);
    const lo = Math.min(...vals);
    const hi = Math.max(...vals);
    const pad = (hi - lo) * 0.18 + 2;
    return { minDb: lo - pad, maxDb: hi + pad };
  }, [filtered]);

  const dbTicks = useMemo(() => {
    const range = maxDb - minDb;
    const step = range > 20 ? 10 : range > 10 ? 5 : 2;
    const ticks: number[] = [];
    const start = Math.ceil(minDb / step) * step;
    for (let v = start; v <= maxDb; v += step) ticks.push(v);
    return ticks;
  }, [minDb, maxDb]);

  const linePath = useMemo(
    () => buildPath(filtered, minDb, maxDb),
    [filtered, minDb, maxDb]
  );
  const areaPath = useMemo(
    () => buildAreaPath(filtered, minDb, maxDb),
    [filtered, minDb, maxDb]
  );

  const ratingColor =
    rating >= 80
      ? "#6EE7A0"
      : rating >= 60
      ? GOLD_BRIGHT
      : rating >= 40
      ? "#F09C4A"
      : "#E05A5A";

  const ratingLabel =
    rating >= 80
      ? "EXCELLENT"
      : rating >= 60
      ? "GOOD"
      : rating >= 40
      ? "FAIR"
      : "POOR";

  return (
    <div
      style={{
        background: BG_DEEP,
        borderRadius: "16px",
        padding: "0",
        fontFamily: "'DM Mono', 'Courier New', monospace",
        overflow: "hidden",
        boxShadow:
          "0 0 0 1px rgba(201,168,76,0.12), 0 32px 80px rgba(0,0,0,0.7), 0 0 120px rgba(201,168,76,0.03)",
        position: "relative",
        maxWidth: "900px",
        width: "100%",
      }}
    >
      {/* Grain overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E")`,
          opacity: 0.6,
          pointerEvents: "none",
          zIndex: 1,
          borderRadius: "16px",
        }}
      />

      {/* Header bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "20px 28px 18px",
          borderBottom: `1px solid rgba(201,168,76,0.1)`,
          position: "relative",
          zIndex: 2,
        }}
      >
        <div>
          <div
            style={{
              fontSize: "10px",
              letterSpacing: "3px",
              color: GOLD,
              opacity: 0.7,
              marginBottom: "4px",
              textTransform: "uppercase",
            }}
          >
            Modal Pressure Analysis
          </div>
          <div
            style={{
              fontSize: "17px",
              fontWeight: 600,
              color: "rgba(240,230,200,0.92)",
              letterSpacing: "0.3px",
            }}
          >
            Low-Frequency Response Analysis
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            background: "rgba(255,255,255,0.03)",
            border: `1px solid rgba(201,168,76,0.15)`,
            borderRadius: "6px",
            padding: "6px 14px",
          }}
        >
          <div
            style={{
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              background: ratingColor,
              boxShadow: `0 0 8px ${ratingColor}`,
              animation: mounted ? "pulse 2s ease-in-out infinite" : "none",
            }}
          />
          <span style={{ fontSize: "10px", letterSpacing: "2px", color: ratingColor }}>
            {ratingLabel}
          </span>
        </div>
      </div>

      {/* Main content */}
      <div
        style={{
          display: "flex",
          gap: 0,
          position: "relative",
          zIndex: 2,
        }}
      >
        {/* Chart area */}
        <div
          style={{
            flex: 1,
            padding: "24px 0 24px 0",
            minWidth: 0,
            overflowX: "auto",
          }}
        >
          <svg
            viewBox={`0 0 ${CHART_W} ${CHART_H}`}
            preserveAspectRatio="xMidYMid meet"
            style={{ width: "100%", display: "block" }}
          >
            <defs>
              <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={GOLD} stopOpacity="0.22" />
                <stop offset="100%" stopColor={GOLD} stopOpacity="0" />
              </linearGradient>
              <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={GOLD_DIM} />
                <stop offset="30%" stopColor={GOLD} />
                <stop offset="70%" stopColor={GOLD_BRIGHT} />
                <stop offset="100%" stopColor={GOLD} />
              </linearGradient>
              <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3.5" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <filter id="softglow" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="8" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                </feMerge>
              </filter>
              <clipPath id="chartClip">
                <rect
                  x={PAD.left}
                  y={PAD.top}
                  width={INNER_W}
                  height={INNER_H}
                />
              </clipPath>
            </defs>

            {/* Chart background */}
            <rect
              x={PAD.left}
              y={PAD.top}
              width={INNER_W}
              height={INNER_H}
              fill={BG_CHART}
              rx={4}
            />

            {/* Horizontal grid + dB labels */}
            {dbTicks.map((db) => {
              const y = toY(db, minDb, maxDb);
              if (y < PAD.top || y > PAD.top + INNER_H) return null;
              return (
                <g key={db}>
                  <line
                    x1={PAD.left}
                    y1={y}
                    x2={PAD.left + INNER_W}
                    y2={y}
                    stroke={GRID}
                    strokeWidth={1}
                  />
                  <text
                    x={PAD.left - 10}
                    y={y}
                    textAnchor="end"
                    dominantBaseline="middle"
                    style={{ fontSize: "10px", fill: AXIS_TEXT, fontFamily: "inherit" }}
                  >
                    {db > 0 ? `+${db}` : db}
                  </text>
                </g>
              );
            })}

            {/* Vertical grid + Hz labels */}
            {F_TICKS.map((hz) => {
              const x = toX(hz);
              return (
                <g key={hz}>
                  <line
                    x1={x}
                    y1={PAD.top}
                    x2={x}
                    y2={PAD.top + INNER_H}
                    stroke={hz === 80 ? "rgba(201,168,76,0.1)" : GRID}
                    strokeWidth={1}
                    strokeDasharray={hz === 80 ? "4 4" : undefined}
                  />
                  <text
                    x={x}
                    y={PAD.top + INNER_H + 18}
                    textAnchor="middle"
                    style={{ fontSize: "10px", fill: AXIS_TEXT, fontFamily: "inherit" }}
                  >
                    {hz}
                  </text>
                </g>
              );
            })}

            {/* Axis labels */}
            <text
              x={PAD.left + INNER_W / 2}
              y={CHART_H - 4}
              textAnchor="middle"
              style={{ fontSize: "10px", fill: LABEL, letterSpacing: "2px", fontFamily: "inherit" }}
            >
              FREQUENCY — Hz
            </text>
            <text
              x={14}
              y={PAD.top + INNER_H / 2}
              textAnchor="middle"
              transform={`rotate(-90, 14, ${PAD.top + INNER_H / 2})`}
              style={{ fontSize: "10px", fill: LABEL, letterSpacing: "2px", fontFamily: "inherit" }}
            >
              SPL — dB
            </text>

            {/* Chart border */}
            <rect
              x={PAD.left}
              y={PAD.top}
              width={INNER_W}
              height={INNER_H}
              fill="none"
              stroke="rgba(201,168,76,0.14)"
              strokeWidth={1}
              rx={4}
            />

            {/* Area fill */}
            <path
              d={areaPath}
              fill="url(#areaGrad)"
              clipPath="url(#chartClip)"
            />

            {/* Glow pass */}
            <path
              d={linePath}
              fill="none"
              stroke={GOLD}
              strokeWidth={6}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.25}
              filter="url(#softglow)"
              clipPath="url(#chartClip)"
            />

            {/* Main line with draw animation */}
            <path
              ref={pathRef}
              d={linePath}
              fill="none"
              stroke="url(#lineGrad)"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              filter="url(#glow)"
              clipPath="url(#chartClip)"
              style={
                pathLen > 0 && mounted
                  ? {
                      strokeDasharray: pathLen,
                      strokeDashoffset: 0,
                      animation: `drawLine 1.6s cubic-bezier(0.4,0,0.2,1) forwards`,
                    }
                  : pathLen > 0
                  ? {
                      strokeDasharray: pathLen,
                      strokeDashoffset: pathLen,
                    }
                  : {}
              }
            />

            {/* Zero dB reference line */}
            {0 >= minDb && 0 <= maxDb && (
              <line
                x1={PAD.left}
                y1={toY(0, minDb, maxDb)}
                x2={PAD.left + INNER_W}
                y2={toY(0, minDb, maxDb)}
                stroke={`rgba(201,168,76,0.25)`}
                strokeWidth={1}
                strokeDasharray="6 4"
              />
            )}
          </svg>
        </div>

        {/* Right panel — rating */}
        <div
          style={{
            width: "200px",
            flexShrink: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px 16px",
            borderLeft: "1px solid rgba(201,168,76,0.1)",
            gap: "12px",
          }}
        >
          <div
            style={{
              fontSize: "9px",
              letterSpacing: "2.5px",
              color: LABEL,
              textTransform: "uppercase",
              textAlign: "center",
            }}
          >
            Uniformity Score
          </div>
          <RatingArc rating={rating} animate={mounted} />
          <div
            style={{
              fontSize: "9px",
              letterSpacing: "2px",
              color: ratingColor,
              textTransform: "uppercase",
              textAlign: "center",
              opacity: 0.9,
            }}
          >
            {ratingLabel}
          </div>
        </div>
      </div>

      {/* Footer — recommended message */}
      <div
        style={{
          borderTop: "1px solid rgba(201,168,76,0.08)",
          padding: "14px 28px",
          display: "flex",
          alignItems: "center",
          gap: "12px",
          position: "relative",
          zIndex: 2,
        }}
      >
        <div
          style={{
            width: "3px",
            height: "32px",
            borderRadius: "2px",
            background: `linear-gradient(180deg, ${ratingColor}, transparent)`,
            flexShrink: 0,
          }}
        />
        <div>
          <div
            style={{
              fontSize: "9px",
              letterSpacing: "2px",
              color: LABEL,
              marginBottom: "4px",
              textTransform: "uppercase",
            }}
          >
            Diagnostic
          </div>
          <div
            style={{
              fontSize: "13px",
              color: "rgba(220,210,185,0.85)",
              lineHeight: 1.5,
              letterSpacing: "0.1px",
            }}
          >
            {recommendedMessage}
          </div>
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500;600&display=swap');

        @keyframes drawLine {
          from { stroke-dashoffset: ${pathLen}; }
          to   { stroke-dashoffset: 0; }
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.35; }
        }
      `}</style>
    </div>
  );
}