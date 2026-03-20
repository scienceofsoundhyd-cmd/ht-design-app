"use client";

import { useState, useRef, useEffect } from "react";
import { buildScene } from "@/lib/engine/core/sceneBuilder";
import { ViewingStandard } from "@/lib/engine/core/screen";
import { SpeakerSystemType } from "@/lib/engine/core/types";

const VIEWING_STANDARDS: ViewingStandard[] = ["THX", "SMPTE"];
const SYSTEM_TYPES: SpeakerSystemType[] = ["5.1", "7.1", "7.1.4"];

const CANVAS_W = 600;
const CANVAS_H = 480;

export default function DesignEnginePage() {
  const [standard, setStandard] = useState<ViewingStandard>("THX");
  const [systemType, setSystemType] = useState<SpeakerSystemType>("5.1");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const scene = buildScene(standard, systemType);

  const roomW = scene.room.width;
  const roomL = scene.room.length;

  const scaleX = (CANVAS_W - 40) / roomW;
  const scaleY = (CANVAS_H - 40) / roomL;

  function toCanvasX(x: number) {
    return 20 + x * scaleX;
  }

  function toCanvasY(y: number) {
    return 20 + y * scaleY;
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 2;
    ctx.strokeRect(20, 20, CANVAS_W - 40, CANVAS_H - 40);

    for (const obj of scene.objects) {
      if (obj.type === "room") continue;

      if (obj.type === "screen") {
        ctx.fillStyle = "#94a3b8";
        ctx.fillRect(
          toCanvasX(obj.x),
          toCanvasY(obj.y),
          obj.width * scaleX,
          obj.height * scaleY
        );
        ctx.strokeStyle = "#475569";
        ctx.lineWidth = 1;
        ctx.strokeRect(
          toCanvasX(obj.x),
          toCanvasY(obj.y),
          obj.width * scaleX,
          obj.height * scaleY
        );
        ctx.fillStyle = "#1e293b";
        ctx.font = "10px sans-serif";
        ctx.fillText("Screen", toCanvasX(obj.x) + 4, toCanvasY(obj.y) + 14);
      } else if (obj.type === "seat") {
        ctx.fillStyle = "#3b82f6";
        ctx.beginPath();
        ctx.arc(toCanvasX(obj.x), toCanvasY(obj.y), 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#1e293b";
        ctx.font = "10px sans-serif";
        ctx.fillText("Seat", toCanvasX(obj.x) + 10, toCanvasY(obj.y) + 4);
      } else if (obj.type === "speaker") {
        ctx.fillStyle = "#22c55e";
        ctx.beginPath();
        ctx.arc(toCanvasX(obj.x), toCanvasY(obj.y), 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#1e293b";
        ctx.font = "9px sans-serif";
        ctx.fillText(obj.channel, toCanvasX(obj.x) + 8, toCanvasY(obj.y) + 4);
      } else if (obj.type === "subwoofer") {
        ctx.fillStyle = "#f59e0b";
        ctx.beginPath();
        ctx.arc(toCanvasX(obj.x), toCanvasY(obj.y), 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#1e293b";
        ctx.font = "9px sans-serif";
        ctx.fillText("SUB", toCanvasX(obj.x) + 9, toCanvasY(obj.y) + 4);
      }
    }
  }, [scene, scaleX, scaleY]);

  return (
    <main style={{ fontFamily: "sans-serif", padding: "2rem", background: "#f8fafc", minHeight: "100vh" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "1.5rem", color: "#0f172a" }}>
        Acoustic Design Engine
      </h1>

      <div style={{ display: "flex", gap: "1.5rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
        <div>
          <label style={{ fontWeight: 600, marginRight: "0.5rem", color: "#334155" }}>Viewing Standard:</label>
          <select
            value={standard}
            onChange={(e) => setStandard(e.target.value as ViewingStandard)}
            style={{ padding: "0.4rem 0.8rem", borderRadius: "6px", border: "1px solid #cbd5e1" }}
          >
            {VIEWING_STANDARDS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ fontWeight: 600, marginRight: "0.5rem", color: "#334155" }}>Speaker System:</label>
          <select
            value={systemType}
            onChange={(e) => setSystemType(e.target.value as SpeakerSystemType)}
            style={{ padding: "0.4rem 0.8rem", borderRadius: "6px", border: "1px solid #cbd5e1" }}
          >
            {SYSTEM_TYPES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ display: "flex", gap: "2rem", flexWrap: "wrap" }}>
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          style={{ border: "1px solid #cbd5e1", borderRadius: "8px", background: "#fff" }}
        />

        <div style={{ flex: 1, minWidth: "260px", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <section style={{ background: "#fff", borderRadius: "8px", border: "1px solid #e2e8f0", padding: "1rem" }}>
            <h2 style={{ fontWeight: 700, marginBottom: "0.5rem", color: "#0f172a", fontSize: "1rem" }}>Room</h2>
            <p style={{ color: "#475569", margin: 0 }}>
              {scene.room.width}m × {scene.room.length}m × {scene.room.height}m
            </p>
            <p style={{ color: "#475569", margin: "0.25rem 0 0" }}>
              Volume: {(scene.room.width * scene.room.length * scene.room.height).toFixed(2)} m³
            </p>
          </section>

          <section style={{ background: "#fff", borderRadius: "8px", border: "1px solid #e2e8f0", padding: "1rem" }}>
            <h2 style={{ fontWeight: 700, marginBottom: "0.5rem", color: "#0f172a", fontSize: "1rem" }}>
              Schroeder Frequency
            </h2>
            <p style={{ color: "#475569", margin: 0 }}>
              {scene.schroederFrequency.toFixed(1)} Hz
            </p>
          </section>

          <section style={{ background: "#fff", borderRadius: "8px", border: "1px solid #e2e8f0", padding: "1rem" }}>
            <h2 style={{ fontWeight: 700, marginBottom: "0.5rem", color: "#0f172a", fontSize: "1rem" }}>
              Phase Alignments
            </h2>
            {scene.phaseAlignments.map((p) => (
              <div key={p.subId} style={{ marginBottom: "0.5rem", color: "#475569", fontSize: "0.9rem" }}>
                <div><strong>Sub ID:</strong> {p.subId}</div>
                <div><strong>Phase Difference:</strong> {p.phaseDifference.toFixed(1)}°</div>
                <div><strong>Delay Suggestion:</strong> {p.delaySuggestion.toFixed(2)} ms</div>
              </div>
            ))}
          </section>

          <section style={{ background: "#fff", borderRadius: "8px", border: "1px solid #e2e8f0", padding: "1rem" }}>
            <h2 style={{ fontWeight: 700, marginBottom: "0.5rem", color: "#0f172a", fontSize: "1rem" }}>
              Axial Modes (first 12)
            </h2>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
              <thead>
                <tr style={{ background: "#f1f5f9" }}>
                  <th style={{ padding: "4px 8px", textAlign: "left", color: "#334155" }}>Axis</th>
                  <th style={{ padding: "4px 8px", textAlign: "left", color: "#334155" }}>Order</th>
                  <th style={{ padding: "4px 8px", textAlign: "left", color: "#334155" }}>Freq (Hz)</th>
                </tr>
              </thead>
              <tbody>
                {scene.modes.slice(0, 12).map((m, i) => (
                  <tr key={i} style={{ borderTop: "1px solid #e2e8f0" }}>
                    <td style={{ padding: "4px 8px", color: "#64748b" }}>{m.axis}</td>
                    <td style={{ padding: "4px 8px", color: "#64748b" }}>{m.order}</td>
                    <td style={{ padding: "4px 8px", color: "#64748b" }}>{m.frequency.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      </div>
    </main>
  );
}