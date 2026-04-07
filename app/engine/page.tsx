"use client"

import { createRoom } from "@/lib/engine/core"
import React, { useState, useRef, useEffect, useMemo } from "react"
import { buildScene } from "@/lib/engine/core/sceneBuilder"
import { ViewingStandard } from "@/lib/engine/core/screen"
import { SceneObject } from "@/lib/engine/core/types"
import { LCRMode, SurroundMode, CeilingCount } from "@/lib/engine/core/sceneBuilder"
import { analyzeRoomAcoustics } from "@/lib/engine/acoustics/acousticOrchestrator"
import { computePanelLayout } from "@/lib/engine/acoustics/panelEngine"
import { feetInchesToMeters, metersToFeetInches } from "@/lib/engine/core/units"
import { validateRoomDimensions } from "@/lib/engine/validation/roomConstraints"
import TheatreView3D from "@/components/engine/TheatreView3D"

const WALL_MATERIAL_COEFF: Record<string, { wall: number; ceiling: number; floor: number }> = {
  drywall:  { wall: 0.05, ceiling: 0.05, floor: 0.02  },
  masonry:  { wall: 0.025, ceiling: 0.025, floor: 0.018 },
  timber:   { wall: 0.10, ceiling: 0.08, floor: 0.08  },
}

// Floor type absorption coefficients — independent of wall construction
type FloorType = 'carpet' | 'hardwood' | 'hard'
const FLOOR_MATERIAL_COEFF: Record<FloorType, { alpha: number; label: string }> = {
  carpet:   { alpha: 0.30, label: 'Carpet' },
  hardwood: { alpha: 0.10, label: 'Hardwood / Wooden Floor' },
  hard:     { alpha: 0.02, label: 'Tile / Stone / Concrete' },
}

const RT60_TARGETS: Record<string, { min: number; max: number; label: string }> = {
  performance: { min: 0.20, max: 0.40, label: "Performance — Accuracy & Control"   },  // max absorption for speech/detail clarity
  balanced:    { min: 0.25, max: 0.50, label: "Balanced — Reference Home Theater"  },  // THX spec for small theatres
  luxury:      { min: 0.30, max: 0.55, label: "Luxury — Visual & Experiential"     },  // wider window for warmth + aesthetics
}

// Panel NRC values — based on real manufacturer specs (ISO 354)
// These represent the panel MATERIAL absorption, NOT the effective room absorption.
// Effective absorption = coverage × panelNRC + (1 - coverage) × bareWall
//
// Coverage is the fraction of wall area covered by panels. For Studio level,
// coverage scales with room volume (larger rooms need proportionally more)
// via getCoverage(level, volumeM3).
const TREATMENT_BASE: Record<string, { floor: number; panelNRC: number; coverage: number }> = {
  basic:  { floor: 0.05, panelNRC: 0.55, coverage: 0.40 },  // Basic  — 2" PU foam (NRC 0.55), first-reflection point coverage
  medium: { floor: 0.06, panelNRC: 0.86, coverage: 0.40 },  // Medium — 2" Owens Corning 703 (NRC 0.86–1.00), reflection + rear wall
  high:   { floor: 0.08, panelNRC: 0.95, coverage: 0.35 },  // High   — 3" Rockwool/mineral wool (NRC 0.95), full perimeter (vol-scaled)
}

// Studio coverage scales with room volume — small rooms need less panel area
// to achieve the same RT60 as large rooms.
// Formula: clamp(0.20 + vol/500, 0.25, 0.45) — verified across 46–173 m³ rooms.
function getCoverage(level: string, volumeM3: number): number {
  const base = TREATMENT_BASE[level] ?? TREATMENT_BASE.basic
  if (level === 'high') {
    return Math.min(0.45, Math.max(0.25, 0.20 + volumeM3 / 500))
  }
  return base.coverage
}

// Design intent modifies how much of the covered area is absorptive vs reflective/diffusive.
// Luxury uses more premium diffusion panels (scatter without absorbing), reducing effective NRC.
// Performance uses 100% absorptive panels for maximum RT60 reduction.
const INTENT_ABSORPTION_FACTOR: Record<string, number> = {
  performance: 1.00,  // 100% absorptive — maximum damping, accuracy-first
  balanced:    0.88,  // 88% absorptive, 12% reflective/diffusive — cinematic reference
  luxury:      0.75,  // 75% absorptive, 25% diffusive — aesthetics + warmth
}

// ── Material specification per treatment level + design intent + surface ──────
// NRC = Noise Reduction Coefficient (500–1000 Hz average, per ISO 354)
//
// Panel construction layers (inside → outside):
//   1. Frame    — structural support (pine / plywood / aluminium)
//   2. Fill     — insulation core (polywool / rockwool / glasswool)
//   3. Cover    — rigid face (perforated ply / woodwool board)
//   4. Finish   — visible surface (PU foam + breathable fabric / PET panel / wood slats / laminate)
//
// Panel types:
//   Absorber  — fill + perf ply + PU foam + breathable fabric (or PET panel)
//   Diffuser  — fill backing + wooden slats or skyline profile
//   Reflector — solid wood/MDF + laminate/veneer with reflective polish
//   Bass trap — deep fill (150–200mm) in corners + breathable fabric

type PanelType = 'absorber' | 'diffuser' | 'reflector' | 'bastrap' | 'bare' | 'floor'

type LayerSpec = {
  material: string    // e.g. "Rockwool", "Perforated Ply"
  thickness: string   // e.g. "50mm", "6mm"
  purpose: string     // e.g. "insulation fill", "acoustic cover"
}

type MatSpec = {
  name: string        // panel display name
  panelType: PanelType
  spec: string        // one-line summary for compact display
  nrc: number
  color: string
  frame: string       // frame material + size
  layers: LayerSpec[] // construction layers inside → outside
}

type SurfaceKey = 'front' | 'rear' | 'sides' | 'ceiling' | 'floor' | 'bastrap'

// Frame specs per treatment level
// Max panel depth per surface (metres) — 2' front, 12" rear, 10" sides, 18" ceiling
const DEPTH_MAX: { front: number; rear: number; left: number; right: number; ceiling: number; [k: string]: number } = { front: 0.6096, rear: 0.3048, left: 0.2540, right: 0.2540, ceiling: 0.4572 }

// Default depths per treatment level (metres) — single source of truth
const DEPTH_DEFAULTS: Record<string, { front: number; rear: number; left: number; right: number; ceiling: number }> = {
  basic:  { front: 0.1270, rear: 0.1016, left: 0.0762, right: 0.0762, ceiling: 0      },
  medium: { front: 0.1524, rear: 0.1270, left: 0.1016, right: 0.1016, ceiling: 0.1016 },
  high:   { front: 0.2032, rear: 0.1524, left: 0.1270, right: 0.1270, ceiling: 0.2032 },
}

// ── Shared absorption + Eyring RT60 computation ──────────────────────────
// Single source of truth — used by computedAbsorption, liveRT60, and auto engine.
type AbsCoeffs = { floor: number; ceiling: number; frontWall: number; rearWall: number; leftWall: number; rightWall: number }
type DepthInputs = { front: number; rear: number; left: number; right: number; ceiling: number }

function computeAbsorptionCoeffs(
  treatLvl: string, designInt: string, wallConst: string,
  depths: DepthInputs, roomW: number, roomH: number, roomL: number,
  floorConst: string = 'carpet'
): AbsCoeffs {
  const base   = TREATMENT_BASE[treatLvl] ?? TREATMENT_BASE.basic
  const mc     = WALL_MATERIAL_COEFF[wallConst] ?? WALL_MATERIAL_COEFF.drywall
  const floorAlpha = FLOOR_MATERIAL_COEFF[floorConst as FloorType]?.alpha ?? mc.floor
  const intent = INTENT_ABSORPTION_FACTOR[designInt] ?? INTENT_ABSORPTION_FACTOR.balanced
  const clamp  = (v: number) => Math.min(0.99, Math.max(0.01, v))
  const effectivePanelNRC = base.panelNRC * intent + base.panelNRC * 0.15 * (1 - intent)
  const vol = roomW * roomH * roomL
  const cov = getCoverage(treatLvl, vol)
  const wallAlpha = (bareAlpha: number) =>
    cov * effectivePanelNRC + (1 - cov) * bareAlpha
  const depthBoost = (depth: number, maxDepth: number, maxBoost: number) =>
    maxDepth > 0 ? (depth / maxDepth) * maxBoost * cov : 0
  return {
    floor:     clamp(floorAlpha + (base.floor - 0.02)),
    ceiling:   treatLvl === 'basic'
      ? clamp(mc.ceiling + 0.03)
      : clamp(wallAlpha(mc.ceiling) + depthBoost(depths.ceiling, 0.4572, 0.15)),
    frontWall: clamp(wallAlpha(mc.wall) + depthBoost(depths.front, 0.6096, 0.18)),
    rearWall:  clamp(wallAlpha(mc.wall) + depthBoost(depths.rear,  0.3048, 0.14)),
    leftWall:  clamp(wallAlpha(mc.wall) + depthBoost(depths.left,  0.2540, 0.10)),
    rightWall: clamp(wallAlpha(mc.wall) + depthBoost(depths.right, 0.2540, 0.10)),
  }
}

function computeEyringRT60(abs: AbsCoeffs, w: number, h: number, l: number): number {
  const vol = w * h * l
  const A = w * l * abs.floor + w * l * abs.ceiling
          + w * h * abs.frontWall + w * h * abs.rearWall
          + h * l * abs.leftWall + h * l * abs.rightWall
  const S = 2 * (w * l + w * h + h * l)
  const alphaAvg = Math.min(0.99, A / S)
  return (0.161 * vol) / (-S * Math.log(1 - alphaAvg))
}

const FRAME_SPEC: Record<string, string> = {
  basic:  'Pine wood 50×50mm',
  medium: 'Plywood 50×50mm',
  high:   'Aluminium 50×50mm',
}

const MATERIAL_SPEC: Record<string, Record<string, Record<SurfaceKey, MatSpec>>> = {
  // _bare kept as internal getMaterial fallback (not a UI-selectable level)
  none: {
    _all: {
      front:   { name: 'Bare Wall',      panelType: 'bare', spec: 'Light grey paint',      nrc: 0.05, color: '#c8cacc', frame: '—', layers: [] },
      rear:    { name: 'Bare Wall',      panelType: 'bare', spec: 'Light grey paint',      nrc: 0.05, color: '#c8cacc', frame: '—', layers: [] },
      sides:   { name: 'Bare Wall',      panelType: 'bare', spec: 'Light grey paint',      nrc: 0.05, color: '#c8cacc', frame: '—', layers: [] },
      ceiling: { name: 'Bare Ceiling',   panelType: 'bare', spec: 'White paint / plaster', nrc: 0.04, color: '#d9dadb', frame: '—', layers: [] },
      floor:   { name: 'Concrete Floor', panelType: 'floor', spec: 'Bare slab',            nrc: 0.02, color: '#a0a4a8', frame: '—', layers: [] },
      bastrap: { name: '—',              panelType: 'bare', spec: 'No treatment',          nrc: 0.00, color: '#8a9ab0', frame: '—', layers: [] },
    },
  },
  // ──────────────────────── BASIC — Entry level control (Pine frame) ────────────────────────
  basic: {
    performance: {
      front:   { name: 'Absorber — PU Foam',  panelType: 'absorber', spec: 'PU foam 50mm + breathable fabric', nrc: 0.55, color: '#4a6fa5', frame: FRAME_SPEC.basic, layers: [
        { material: 'PU Foam',          thickness: '50mm', purpose: 'insulation fill' },
        { material: 'Perforated Ply',   thickness: '6mm',  purpose: 'acoustic cover' },
        { material: 'PU Foam backing',  thickness: '10mm', purpose: 'damping layer' },
        { material: 'Breathable Fabric', thickness: '—',   purpose: 'finish surface' },
      ]},
      rear:    { name: 'Absorber — PU Foam',  panelType: 'absorber', spec: 'PU foam 50mm + breathable fabric', nrc: 0.55, color: '#4a6fa5', frame: FRAME_SPEC.basic, layers: [
        { material: 'PU Foam',          thickness: '50mm', purpose: 'insulation fill' },
        { material: 'Perforated Ply',   thickness: '6mm',  purpose: 'acoustic cover' },
        { material: 'PU Foam backing',  thickness: '10mm', purpose: 'damping layer' },
        { material: 'Breathable Fabric', thickness: '—',   purpose: 'finish surface' },
      ]},
      sides:   { name: 'Absorber — PET Panel', panelType: 'absorber', spec: 'PET 25mm recycled fibre', nrc: 0.62, color: '#5a7fb5', frame: FRAME_SPEC.basic, layers: [
        { material: 'PET Acoustic Panel', thickness: '25mm', purpose: 'insulation + finish' },
        { material: 'Perforated Ply',     thickness: '6mm',  purpose: 'acoustic cover' },
        { material: 'PU Foam backing',    thickness: '10mm', purpose: 'damping layer' },
        { material: 'Breathable Fabric',  thickness: '—',    purpose: 'finish surface' },
      ]},
      ceiling: { name: 'Gypsum Slab',  panelType: 'bare',     spec: 'POP/plasterboard 12mm',  nrc: 0.08, color: '#8a9ab0', frame: '—', layers: [] },
      floor:   { name: 'Carpet Tile',  panelType: 'floor',    spec: 'Loop pile 6mm',           nrc: 0.30, color: '#606878', frame: '—', layers: [] },
      bastrap: { name: '—',            panelType: 'bare',     spec: 'Not included at Basic',   nrc: 0.00, color: '#8a9ab0', frame: '—', layers: [] },
    },
    balanced: {
      front:   { name: 'Absorber — PU Foam',   panelType: 'absorber', spec: 'PU foam 50mm + breathable fabric', nrc: 0.55, color: '#4a6fa5', frame: FRAME_SPEC.basic, layers: [
        { material: 'PU Foam', thickness: '50mm', purpose: 'insulation fill' },
        { material: 'Perforated Ply', thickness: '6mm', purpose: 'acoustic cover' },
        { material: 'PU Foam backing', thickness: '10mm', purpose: 'damping layer' },
        { material: 'Breathable Fabric', thickness: '—', purpose: 'finish surface' },
      ]},
      rear:    { name: 'Absorber — PET Panel',  panelType: 'absorber', spec: 'PET 25mm recycled fibre', nrc: 0.62, color: '#5a7fb5', frame: FRAME_SPEC.basic, layers: [
        { material: 'PET Acoustic Panel', thickness: '25mm', purpose: 'insulation + finish' },
        { material: 'Perforated Ply', thickness: '6mm', purpose: 'acoustic cover' },
        { material: 'PU Foam backing', thickness: '10mm', purpose: 'damping layer' },
        { material: 'Breathable Fabric', thickness: '—', purpose: 'finish surface' },
      ]},
      sides:   { name: 'Absorber — PET Panel',  panelType: 'absorber', spec: 'PET 25mm recycled fibre', nrc: 0.62, color: '#5a7fb5', frame: FRAME_SPEC.basic, layers: [
        { material: 'PET Acoustic Panel', thickness: '25mm', purpose: 'insulation + finish' },
        { material: 'Perforated Ply', thickness: '6mm', purpose: 'acoustic cover' },
        { material: 'PU Foam backing', thickness: '10mm', purpose: 'damping layer' },
        { material: 'Breathable Fabric', thickness: '—', purpose: 'finish surface' },
      ]},
      ceiling: { name: 'Gypsum Slab',  panelType: 'bare',  spec: 'POP/plasterboard 12mm',  nrc: 0.08, color: '#8a9ab0', frame: '—', layers: [] },
      floor:   { name: 'Carpet Tile',  panelType: 'floor', spec: 'Loop pile 6mm',           nrc: 0.30, color: '#606878', frame: '—', layers: [] },
      bastrap: { name: '—',            panelType: 'bare',  spec: 'Not included at Basic',   nrc: 0.00, color: '#8a9ab0', frame: '—', layers: [] },
    },
    luxury: {
      front:   { name: 'Absorber — PET Panel', panelType: 'absorber', spec: 'PET 25mm + breathable fabric', nrc: 0.62, color: '#5a7fb5', frame: FRAME_SPEC.basic, layers: [
        { material: 'PET Acoustic Panel', thickness: '25mm', purpose: 'insulation + finish' },
        { material: 'Perforated Ply', thickness: '6mm', purpose: 'acoustic cover' },
        { material: 'PU Foam backing', thickness: '10mm', purpose: 'damping layer' },
        { material: 'Breathable Fabric', thickness: '—', purpose: 'finish surface' },
      ]},
      rear:    { name: 'Absorber — PET Panel', panelType: 'absorber', spec: 'PET 25mm + breathable fabric', nrc: 0.62, color: '#5a7fb5', frame: FRAME_SPEC.basic, layers: [
        { material: 'PET Acoustic Panel', thickness: '25mm', purpose: 'insulation + finish' },
        { material: 'Perforated Ply', thickness: '6mm', purpose: 'acoustic cover' },
        { material: 'PU Foam backing', thickness: '10mm', purpose: 'damping layer' },
        { material: 'Breathable Fabric', thickness: '—', purpose: 'finish surface' },
      ]},
      sides:   { name: 'Absorber — PET Panel', panelType: 'absorber', spec: 'PET 25mm + breathable fabric', nrc: 0.62, color: '#5a7fb5', frame: FRAME_SPEC.basic, layers: [
        { material: 'PET Acoustic Panel', thickness: '25mm', purpose: 'insulation + finish' },
        { material: 'Perforated Ply', thickness: '6mm', purpose: 'acoustic cover' },
        { material: 'PU Foam backing', thickness: '10mm', purpose: 'damping layer' },
        { material: 'Breathable Fabric', thickness: '—', purpose: 'finish surface' },
      ]},
      ceiling: { name: 'Gypsum Slab',  panelType: 'bare',  spec: 'POP/plasterboard 12mm',  nrc: 0.08, color: '#8a9ab0', frame: '—', layers: [] },
      floor:   { name: 'Carpet Tile',  panelType: 'floor', spec: 'Loop pile 6mm',           nrc: 0.30, color: '#606878', frame: '—', layers: [] },
      bastrap: { name: '—',            panelType: 'bare',  spec: 'Not included at Basic',   nrc: 0.00, color: '#8a9ab0', frame: '—', layers: [] },
    },
  },
  // ──────────────────────── MEDIUM — Reference home theater (Plywood frame) ────────────────────────
  medium: {
    performance: {
      front:   { name: 'Absorber — Rockwool',  panelType: 'absorber', spec: 'Rockwool 50mm + perf ply + fabric', nrc: 0.85, color: '#2563EB', frame: FRAME_SPEC.medium, layers: [
        { material: 'Rockwool', thickness: '50mm', purpose: 'insulation fill' },
        { material: 'Perforated Ply', thickness: '6mm', purpose: 'acoustic cover' },
        { material: 'PU Foam backing', thickness: '10mm', purpose: 'damping layer' },
        { material: 'Breathable Fabric', thickness: '—', purpose: 'finish surface' },
      ]},
      rear:    { name: 'Absorber — Rockwool',  panelType: 'absorber', spec: 'Rockwool 50mm + perf ply + fabric', nrc: 0.85, color: '#2563EB', frame: FRAME_SPEC.medium, layers: [
        { material: 'Rockwool', thickness: '50mm', purpose: 'insulation fill' },
        { material: 'Perforated Ply', thickness: '6mm', purpose: 'acoustic cover' },
        { material: 'PU Foam backing', thickness: '10mm', purpose: 'damping layer' },
        { material: 'Breathable Fabric', thickness: '—', purpose: 'finish surface' },
      ]},
      sides:   { name: 'Absorber + Reflector', panelType: 'absorber', spec: 'Rockwool 50mm + MDF reflector zones', nrc: 0.82, color: '#2563EB', frame: FRAME_SPEC.medium, layers: [
        { material: 'Rockwool', thickness: '50mm', purpose: 'insulation fill' },
        { material: 'Perforated Ply', thickness: '6mm', purpose: 'acoustic cover (absorber zones)' },
        { material: 'MDF Panel', thickness: '9mm', purpose: 'reflector zones — laminate finish' },
        { material: 'Breathable Fabric', thickness: '—', purpose: 'finish on absorber zones' },
      ]},
      ceiling: { name: 'Absorber — Glasswool', panelType: 'absorber', spec: 'Glasswool 50mm suspended cloud', nrc: 0.80, color: '#3b82f6', frame: FRAME_SPEC.medium, layers: [
        { material: 'Glasswool', thickness: '50mm', purpose: 'insulation fill' },
        { material: 'Perforated Ply', thickness: '6mm', purpose: 'acoustic cover' },
        { material: 'PU Foam backing', thickness: '10mm', purpose: 'damping layer' },
        { material: 'Breathable Fabric', thickness: '—', purpose: 'finish surface' },
      ]},
      floor:   { name: 'Carpet Tile', panelType: 'floor', spec: 'Cut pile 8mm', nrc: 0.35, color: '#606878', frame: '—', layers: [] },
      bastrap: { name: '—',           panelType: 'bare',  spec: 'Not included at Medium', nrc: 0.00, color: '#8a9ab0', frame: '—', layers: [] },
    },
    balanced: {
      front:   { name: 'Absorber — Glasswool', panelType: 'absorber', spec: 'Glasswool 50mm + perf ply + fabric', nrc: 0.80, color: '#3b82f6', frame: FRAME_SPEC.medium, layers: [
        { material: 'Glasswool', thickness: '50mm', purpose: 'insulation fill' },
        { material: 'Perforated Ply', thickness: '6mm', purpose: 'acoustic cover' },
        { material: 'PU Foam backing', thickness: '10mm', purpose: 'damping layer' },
        { material: 'Breathable Fabric', thickness: '—', purpose: 'finish surface' },
      ]},
      rear:    { name: 'Diffuser — Skyline', panelType: 'diffuser', spec: 'MDF skyline profile + Glasswool backing', nrc: 0.65, color: '#8b5cf6', frame: FRAME_SPEC.medium, layers: [
        { material: 'Glasswool', thickness: '50mm', purpose: 'insulation backing' },
        { material: 'MDF Skyline Profile', thickness: '40–120mm', purpose: 'diffusion surface' },
      ]},
      sides:   { name: 'Absorber — Rockwool', panelType: 'absorber', spec: 'Rockwool 50mm + perf ply + fabric', nrc: 0.82, color: '#2563EB', frame: FRAME_SPEC.medium, layers: [
        { material: 'Rockwool', thickness: '50mm', purpose: 'insulation fill' },
        { material: 'Perforated Ply', thickness: '6mm', purpose: 'acoustic cover' },
        { material: 'PU Foam backing', thickness: '10mm', purpose: 'damping layer' },
        { material: 'Breathable Fabric', thickness: '—', purpose: 'finish surface' },
      ]},
      ceiling: { name: 'Absorber — Glasswool', panelType: 'absorber', spec: 'Glasswool 50mm suspended cloud', nrc: 0.80, color: '#3b82f6', frame: FRAME_SPEC.medium, layers: [
        { material: 'Glasswool', thickness: '50mm', purpose: 'insulation fill' },
        { material: 'Perforated Ply', thickness: '6mm', purpose: 'acoustic cover' },
        { material: 'PU Foam backing', thickness: '10mm', purpose: 'damping layer' },
        { material: 'Breathable Fabric', thickness: '—', purpose: 'finish surface' },
      ]},
      floor:   { name: 'Carpet Tile', panelType: 'floor', spec: 'Cut pile 8mm', nrc: 0.35, color: '#606878', frame: '—', layers: [] },
      bastrap: { name: '—',           panelType: 'bare',  spec: 'Not included at Medium', nrc: 0.00, color: '#8a9ab0', frame: '—', layers: [] },
    },
    luxury: {
      front:   { name: 'Absorber — Rockwool', panelType: 'absorber', spec: 'Rockwool 50mm + perf ply + fabric', nrc: 0.85, color: '#2563EB', frame: FRAME_SPEC.medium, layers: [
        { material: 'Rockwool', thickness: '50mm', purpose: 'insulation fill' },
        { material: 'Perforated Ply', thickness: '6mm', purpose: 'acoustic cover' },
        { material: 'PU Foam backing', thickness: '10mm', purpose: 'damping layer' },
        { material: 'Breathable Fabric', thickness: '—', purpose: 'finish surface' },
      ]},
      rear:    { name: 'Diffuser — Skyline', panelType: 'diffuser', spec: 'MDF skyline + Rockwool backing', nrc: 0.65, color: '#8b5cf6', frame: FRAME_SPEC.medium, layers: [
        { material: 'Rockwool', thickness: '50mm', purpose: 'insulation backing' },
        { material: 'MDF Skyline Profile', thickness: '40–120mm', purpose: 'diffusion surface' },
      ]},
      sides:   { name: 'Absorber — Wood Wool', panelType: 'absorber', spec: 'Wood wool 25mm decorative', nrc: 0.60, color: '#b45309', frame: FRAME_SPEC.medium, layers: [
        { material: 'Glasswool', thickness: '25mm', purpose: 'insulation fill' },
        { material: 'Wood Wool Board', thickness: '25mm', purpose: 'acoustic cover + decorative finish' },
      ]},
      ceiling: { name: 'Absorber — Rockwool', panelType: 'absorber', spec: 'Rockwool 50mm suspended cloud', nrc: 0.85, color: '#2563EB', frame: FRAME_SPEC.medium, layers: [
        { material: 'Rockwool', thickness: '50mm', purpose: 'insulation fill' },
        { material: 'Perforated Ply', thickness: '6mm', purpose: 'acoustic cover' },
        { material: 'PU Foam backing', thickness: '10mm', purpose: 'damping layer' },
        { material: 'Breathable Fabric', thickness: '—', purpose: 'finish surface' },
      ]},
      floor:   { name: 'Carpet Premium', panelType: 'floor', spec: 'Cut pile 10mm premium', nrc: 0.38, color: '#606878', frame: '—', layers: [] },
      bastrap: { name: '—',              panelType: 'bare',  spec: 'Not included at Medium', nrc: 0.00, color: '#8a9ab0', frame: '—', layers: [] },
    },
  },
  // ──────────────────────── HIGH — Studio / Cinema grade (Aluminium frame) ────────────────────────
  high: {
    performance: {
      front:   { name: 'Absorber — Polywool', panelType: 'absorber', spec: 'Polywool 75mm + woodwool + fabric', nrc: 0.98, color: '#1d4ed8', frame: FRAME_SPEC.high, layers: [
        { material: 'Polywool', thickness: '75mm', purpose: 'premium insulation fill' },
        { material: 'Wood Wool Board', thickness: '25mm', purpose: 'acoustic cover' },
        { material: 'PU Foam backing', thickness: '10mm', purpose: 'damping layer' },
        { material: 'Breathable Fabric', thickness: '—', purpose: 'premium finish' },
      ]},
      rear:    { name: 'Absorber — Polywool', panelType: 'absorber', spec: 'Polywool 75mm + woodwool + fabric', nrc: 0.98, color: '#1d4ed8', frame: FRAME_SPEC.high, layers: [
        { material: 'Polywool', thickness: '75mm', purpose: 'premium insulation fill' },
        { material: 'Wood Wool Board', thickness: '25mm', purpose: 'acoustic cover' },
        { material: 'PU Foam backing', thickness: '10mm', purpose: 'damping layer' },
        { material: 'Breathable Fabric', thickness: '—', purpose: 'premium finish' },
      ]},
      sides:   { name: 'Absorber + Reflector', panelType: 'absorber', spec: 'Polywool 75mm + reflector zones', nrc: 0.95, color: '#1d4ed8', frame: FRAME_SPEC.high, layers: [
        { material: 'Polywool', thickness: '75mm', purpose: 'premium insulation fill' },
        { material: 'Wood Wool Board', thickness: '25mm', purpose: 'acoustic cover (absorber zones)' },
        { material: 'Veneer Panel', thickness: '9mm', purpose: 'reflector zones — polished finish' },
        { material: 'Breathable Fabric', thickness: '—', purpose: 'finish on absorber zones' },
      ]},
      ceiling: { name: 'Absorber — Polywool', panelType: 'absorber', spec: 'Polywool 75mm suspended cloud', nrc: 0.98, color: '#1d4ed8', frame: FRAME_SPEC.high, layers: [
        { material: 'Polywool', thickness: '75mm', purpose: 'premium insulation fill' },
        { material: 'Wood Wool Board', thickness: '25mm', purpose: 'acoustic cover' },
        { material: 'PU Foam backing', thickness: '10mm', purpose: 'damping layer' },
        { material: 'Breathable Fabric', thickness: '—', purpose: 'premium finish' },
      ]},
      floor:   { name: 'Carpet Premium', panelType: 'floor', spec: 'Thick pile 12mm + underlay', nrc: 0.45, color: '#606878', frame: '—', layers: [] },
      bastrap: { name: 'Bass Trap — Polywool', panelType: 'bastrap', spec: '200mm corner fill, λ/4 ≈ 40Hz', nrc: 0.99, color: '#ef4444', frame: FRAME_SPEC.high, layers: [
        { material: 'Polywool', thickness: '200mm', purpose: 'deep corner fill — low-frequency absorption' },
        { material: 'Breathable Fabric', thickness: '—', purpose: 'finish wrap' },
      ]},
    },
    balanced: {
      front:   { name: 'Absorber — Polywool', panelType: 'absorber', spec: 'Polywool 75mm + woodwool + fabric', nrc: 0.98, color: '#1d4ed8', frame: FRAME_SPEC.high, layers: [
        { material: 'Polywool', thickness: '75mm', purpose: 'premium insulation fill' },
        { material: 'Wood Wool Board', thickness: '25mm', purpose: 'acoustic cover' },
        { material: 'PU Foam backing', thickness: '10mm', purpose: 'damping layer' },
        { material: 'Breathable Fabric', thickness: '—', purpose: 'premium finish' },
      ]},
      rear:    { name: 'Diffuser — Skyline', panelType: 'diffuser', spec: 'MDF skyline + Polywool backing', nrc: 0.70, color: '#8b5cf6', frame: FRAME_SPEC.high, layers: [
        { material: 'Polywool', thickness: '75mm', purpose: 'insulation backing' },
        { material: 'MDF Skyline Profile', thickness: '40–120mm', purpose: 'premium diffusion surface' },
      ]},
      sides:   { name: 'Absorber — Rockwool', panelType: 'absorber', spec: 'Rockwool 75mm + woodwool + fabric', nrc: 0.92, color: '#2563EB', frame: FRAME_SPEC.high, layers: [
        { material: 'Rockwool', thickness: '75mm', purpose: 'insulation fill' },
        { material: 'Wood Wool Board', thickness: '25mm', purpose: 'acoustic cover' },
        { material: 'PU Foam backing', thickness: '10mm', purpose: 'damping layer' },
        { material: 'Breathable Fabric', thickness: '—', purpose: 'premium finish' },
      ]},
      ceiling: { name: 'Absorber — Polywool', panelType: 'absorber', spec: 'Polywool 75mm suspended cloud', nrc: 0.98, color: '#1d4ed8', frame: FRAME_SPEC.high, layers: [
        { material: 'Polywool', thickness: '75mm', purpose: 'premium insulation fill' },
        { material: 'Wood Wool Board', thickness: '25mm', purpose: 'acoustic cover' },
        { material: 'PU Foam backing', thickness: '10mm', purpose: 'damping layer' },
        { material: 'Breathable Fabric', thickness: '—', purpose: 'premium finish' },
      ]},
      floor:   { name: 'Carpet Premium', panelType: 'floor', spec: 'Thick pile 12mm + underlay', nrc: 0.45, color: '#606878', frame: '—', layers: [] },
      bastrap: { name: 'Bass Trap — Rockwool', panelType: 'bastrap', spec: '150mm corner fill, λ/4 ≈ 57Hz', nrc: 0.95, color: '#ef4444', frame: FRAME_SPEC.high, layers: [
        { material: 'Rockwool', thickness: '150mm', purpose: 'corner fill — low-frequency absorption' },
        { material: 'Breathable Fabric', thickness: '—', purpose: 'finish wrap' },
      ]},
    },
    luxury: {
      front:   { name: 'Absorber — Polywool', panelType: 'absorber', spec: 'Polywool 75mm + woodwool + fabric', nrc: 0.98, color: '#1d4ed8', frame: FRAME_SPEC.high, layers: [
        { material: 'Polywool', thickness: '75mm', purpose: 'premium insulation fill' },
        { material: 'Wood Wool Board', thickness: '25mm', purpose: 'acoustic cover' },
        { material: 'PU Foam backing', thickness: '10mm', purpose: 'damping layer' },
        { material: 'Breathable Fabric', thickness: '—', purpose: 'premium finish' },
      ]},
      rear:    { name: 'Diffuser — Skyline', panelType: 'diffuser', spec: 'Premium MDF skyline + Polywool', nrc: 0.70, color: '#8b5cf6', frame: FRAME_SPEC.high, layers: [
        { material: 'Polywool', thickness: '75mm', purpose: 'insulation backing' },
        { material: 'MDF Skyline Profile', thickness: '40–120mm', purpose: 'premium diffusion surface' },
      ]},
      sides:   { name: 'Absorber — Wood Wool', panelType: 'absorber', spec: 'Wood wool 50mm premium decorative', nrc: 0.72, color: '#b45309', frame: FRAME_SPEC.high, layers: [
        { material: 'Polywool', thickness: '50mm', purpose: 'insulation fill' },
        { material: 'Wood Wool Board', thickness: '50mm', purpose: 'acoustic cover + decorative finish' },
      ]},
      ceiling: { name: 'Absorber — Polywool', panelType: 'absorber', spec: 'Polywool 75mm suspended cloud', nrc: 0.98, color: '#1d4ed8', frame: FRAME_SPEC.high, layers: [
        { material: 'Polywool', thickness: '75mm', purpose: 'premium insulation fill' },
        { material: 'Wood Wool Board', thickness: '25mm', purpose: 'acoustic cover' },
        { material: 'PU Foam backing', thickness: '10mm', purpose: 'damping layer' },
        { material: 'Breathable Fabric', thickness: '—', purpose: 'premium finish' },
      ]},
      floor:   { name: 'Carpet Premium', panelType: 'floor', spec: 'Thick pile 12mm + underlay', nrc: 0.45, color: '#606878', frame: '—', layers: [] },
      bastrap: { name: 'Bass Trap — Polywool', panelType: 'bastrap', spec: '200mm corner fill, λ/4 ≈ 40Hz', nrc: 0.99, color: '#ef4444', frame: FRAME_SPEC.high, layers: [
        { material: 'Polywool', thickness: '200mm', purpose: 'deep corner fill — low-frequency absorption' },
        { material: 'Breathable Fabric', thickness: '—', purpose: 'finish wrap' },
      ]},
    },
  },
}

// Helper to get material spec for current level + intent + surface
function getMaterial(level: string, intent: string, surface: SurfaceKey): MatSpec {
  const lvl = MATERIAL_SPEC[level]
  if (!lvl) return MATERIAL_SPEC.none._all[surface]
  // Prefer exact intent match → first available intent → _all → bare fallback
  const byIntent = lvl[intent]
    ?? lvl['_all']
    ?? lvl[Object.keys(lvl)[0]]
  return byIntent?.[surface] ?? MATERIAL_SPEC.none._all[surface]
}

// ── Account Menu Component ────────────────────────────────────────────────────
function AccountMenu() {
  const [open, setOpen]         = useState(false)
  const [userEmail, setEmail]   = useState('')
  const [userName, setName]     = useState('')
  const [userPlan, setPlan]     = useState('free')
  const [isAdmin, setIsAdmin]   = useState(false)

  useEffect(() => {
    import('@/lib/supabase').then(({ supabase }) => {
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (!user) return
        setEmail(user.email ?? '')
        setName(user.user_metadata?.full_name ?? '')
        supabase.from('user_profiles').select('plan,is_admin').eq('id', user.id).single()
          .then(({ data }) => {
            setPlan(data?.plan ?? 'free')
            setIsAdmin(data?.is_admin ?? false)
          })
      })
    })
  }, [])

  return (
    <div className="relative">
      <button onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition"
        style={{ background: "#d0d2d4", border: "1px solid #8a9ab0", color: "#202b40" }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
        </svg>
        Account
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M6 9l6 6 6-6"/>
        </svg>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)}/>
          <div className="absolute right-0 mt-1.5 w-60 rounded-xl z-50 overflow-hidden"
            style={{ background: '#dfe1e3', border: '1.5px solid #8a9ab0', boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}>
            {/* User info */}
            <div className="px-4 py-3 border-b" style={{ borderColor: '#b8bfc9' }}>
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-semibold truncate" style={{ color: '#202b40' }}>
                  {userName || 'My Account'}
                </p>
                <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold ml-2 shrink-0"
                  style={{ background: userPlan === 'pro' ? 'rgba(34,197,94,0.15)' : 'rgba(100,116,139,0.12)', color: userPlan === 'pro' ? '#16a34a' : '#64748b' }}>
                  {userPlan.toUpperCase()}
                </span>
              </div>
              <p className="text-[10px] truncate" style={{ color: '#6b7a90' }}>{userEmail || '—'}</p>
              {isAdmin && (
                <p className="text-[9px] mt-0.5 font-semibold" style={{ color: '#2563EB' }}>Administrator</p>
              )}
            </div>
            {/* Actions */}
            <div className="p-1.5">
              <button onClick={async () => {
                  const { supabase } = await import('@/lib/supabase')
                  await supabase.auth.signOut()
                  window.location.href = '/login'
                }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition"
                style={{ color: '#ef4444' }}
                onMouseEnter={e => (e.currentTarget.style.background='rgba(239,68,68,0.08)')}
                onMouseLeave={e => (e.currentTarget.style.background='transparent')}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
                Sign out
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default function EngineV2() {

  // Hard limits (in meters)
  const LIMITS = {
    length: 24.384,  // 80 ft
    width:  15.240,  // 50 ft
    height:  6.096,  // 20 ft
  }

  const MIN_LIMITS = {
    length: 3.6576,  // 12 ft — matches validator minimum
    width:  3.048,   // 10 ft — matches validator minimum
    height: 2.4384,  // 8 ft  — matches validator minimum
  }

  const clampValue = (value: number, max: number, min = 0): number => {
    return Math.max(min, Math.min(value, max))
  }

  const updateMetricDimension = (
    key: "length" | "width" | "height",
    value: number,
    enforceMin = false
  ): void => {
    // During typing (enforceMin=false): allow any value down to 0 so user can delete freely
    // On blur (enforceMin=true): snap up to MIN_LIMITS if value is below threshold
    const min = enforceMin ? MIN_LIMITS[key] : 0
    const clamped = value === 0 ? 0 : clampValue(value, LIMITS[key], min)
    setMetricDimensions(prev => ({ ...prev, [key]: clamped }))
    const feetInches = metersToFeetInches(clamped)
    setImperialDimensions(prev => ({
      ...prev,
      [key + "Feet"]: feetInches.feet,
      [key + "Inches"]: feetInches.inches
    }))
  }

  const updateImperialDimension = (
    key: "length" | "width" | "height",
    feet: number,
    inches: number,
    enforceMin = false
  ): void => {
    const clampedFeet   = Math.max(0, feet)
    const clampedInches = Math.max(0, Math.min(inches, 11))
    const totalFeet     = clampedFeet + Math.floor(clampedInches / 12)
    const normInches    = clampedInches % 12
    const meters        = feetInchesToMeters(totalFeet, normInches)
    const min = enforceMin ? MIN_LIMITS[key] : 0
    const clamped = meters === 0 ? 0 : clampValue(meters, LIMITS[key], min)
    setMetricDimensions(prev => ({ ...prev, [key]: clamped }))
    const synced = metersToFeetInches(clamped)
    setImperialDimensions(prev => ({
      ...prev,
      [key + "Feet"]: synced.feet,
      [key + "Inches"]: synced.inches
    }))
  }

  const [standard, setStandard] = useState<ViewingStandard>("THX")
  const [lcrMode,      setLcrMode]      = useState<LCRMode>("lcr")
  const [surroundMode, setSurroundMode] = useState<SurroundMode>("side_rear")
  const [ceilingCount, setCeilingCount] = useState<CeilingCount>(0)
  const speakerConfigEdited = useRef(false)

  type UnitSystem = "metric" | "imperial"
  const [unitSystem, setUnitSystem] = useState<UnitSystem>("metric")

  const [metricDimensions, setMetricDimensions] = useState({ width: 0, height: 0, length: 0 })
  const [imperialDimensions, setImperialDimensions] = useState({
    widthFeet: 0, widthInches: 0,
    heightFeet: 0, heightInches: 0,
    lengthFeet: 0, lengthInches: 0
  })

  type TreatmentLevel = "basic" | "medium" | "high"
  type DesignIntent = "performance" | "balanced" | "luxury"

  const [treatmentLevel, setTreatmentLevel] = useState<TreatmentLevel>("basic")
  const [designIntent, setDesignIntent] = useState<DesignIntent>("balanced")
  const [roomColorScheme, setRoomColorScheme] = useState<string>("obsidian")
  const [sideLinked, setSideLinked] = useState<boolean>(true)
  const [acousticDepthMeters, setAcousticDepthMeters] = useState({
    front: 0, rear: 0, left: 0, right: 0, ceiling: 0
  })

  // Deferred values — inputs stay instant, heavy physics chain defers until browser idle
  const [clientInfo, setClientInfo] = useState({
    name: "", email: "", company: "", projectRef: "", location: "",
    projectType: "Home Theater", notes: "",

    projectDate: new Date().toISOString().slice(0, 10),   // YYYY-MM-DD, defaults to today
  })

  // Auto-fill client email from logged-in Supabase user
  const fillEmailFromAccount = () => {
    import('@/lib/supabase').then(({ supabase }) => {
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (!user) return
        setClientInfo(prev => ({ ...prev, email: prev.email || user.email || '' }))
      })
    })
  }
  useEffect(() => { fillEmailFromAccount() }, [])

  const [mountType, setMountType] = useState<"inWall" | "onWall">("onWall")
  const [screenPlacement, setScreenPlacement] = useState<"behindScreen" | "besideScreen">("behindScreen")

  // NOTE: extraSidePairs / extraCeilingPairs are now auto-derived from room physics
  // (see maxExtraSidePairs / maxExtraCeilingPairs below). State retained only for SVG render compat.
  const [extraSidePairs, setExtraSidePairs] = useState<number>(0)
  const [extraCeilingPairs, setExtraCeilingPairs] = useState<number>(0)

  const [seatType, setSeatType] = useState<"standard" | "luxury">("standard")
  const rowPitchFt = 4  // derived from riser depth — kept for snapshot shape, never mutated
  const [rowCount, setRowCount] = useState<number>(1)
  const [primaryRow, setPrimaryRow] = useState<number>(0)
  const [rightPanelTab, setRightPanelTab] = useState<"acoustics"|"seating"|"screen"|"engineering"|"suggestions"|"lighting">("suggestions")
  const [seatsPerRow, setSeatsPerRow] = useState<number>(3)
  const [sightlineGrade, setSightlineGrade] = useState<"economy"|"standard"|"luxury"|"reference">("standard")
  const [firstRowOffsetM, setFirstRowOffsetM] = useState<number>(0)
  const [aisleConfig, setAisleConfig] = useState<"none"|"center"|"left"|"right"|"both">("none")
  const [aisleWidthM, setAisleWidthM] = useState<number>(0.6096)  // 2ft default (fixed)
  const [widerBackRow, setWiderBackRow] = useState<boolean>(false)
  const [riserOverrideMm, setRiserOverrideMm] = useState<number | null>(152.4)
  const [seatWidthMm, setSeatWidthMm] = useState<number>(610)
  // ── Seat dimension overrides (inches) — null = use base for seat type ──
  const [seatWidthOverrideIn, setSeatWidthOverrideIn] = useState<number | null>(null)
  const [seatDepthOverrideIn, setSeatDepthOverrideIn] = useState<number | null>(null)
  const [riserDepthOverrideIn, setRiserDepthOverrideIn] = useState<number | null>(null)
  const [aspectRatioMode, setAspectRatioMode] = useState<"16:9" | "2.35:1" | "4:3" | "custom">("16:9")
  const [customAspectWidth, setCustomAspectWidth] = useState<number>(2.0)
  const [customAspectHeight, setCustomAspectHeight] = useState<number>(1.0)
  const [screenDiagonalInches, setScreenDiagonalInches] = useState<number>(100)
  const [throwRatio, setThrowRatio] = useState<number>(1.4)
  const [screenBottomFromFloor, setScreenBottomFromFloor] = useState<number>(0.609)  // 24" — equipment rack clearance
  const [displayType, setDisplayType] = useState<"projector" | "display">("projector")
  const [screenType, setScreenType] = useState<"fixed" | "motorized" | "retractable">("fixed")
  const [wallConstruction, setWallConstruction] = useState<"drywall" | "masonry" | "timber">("drywall")
  const [floorType, setFloorType] = useState<FloorType>("carpet")
  const [screenGain, setScreenGain] = useState<number>(1.0)

  const [subCount, setSubCount] = useState<number>(1)
  const [subPlacement, setSubPlacement] = useState<"frontWall" | "frontCorners" | "distributed" | "haas">("frontWall")
  const [subType, setSubType] = useState<"sealed" | "ported">("sealed")
  const [speakerBrand, setSpeakerBrand] = useState<string>("")

  // ── Lighting Design state ──────────────────────────────────────────────
  type LightingZone = { enabled: boolean; fixtureType: string; colorTempK: number; dimmable: boolean }
  type LightingSceneValues = { screenWash: number; ceilingCove: number; aisleStep: number; wallSconces: number; starCeiling: number; entryFoyer: number; equipmentRack: number }
  type LightingAutomationConfig = { projectorSync: boolean; playPauseSync: boolean; occupancySensor: boolean; scheduleEnabled: boolean }

  const [lightingZones, setLightingZones] = useState<Record<string, LightingZone>>({
    screenWash:    { enabled: false, fixtureType: "ledStrip", colorTempK: 6500, dimmable: true },
    ceilingCove:   { enabled: false, fixtureType: "ledStrip", colorTempK: 3000, dimmable: true },
    aisleStep:     { enabled: false, fixtureType: "ledStep", colorTempK: 2700, dimmable: true },
    wallSconces:   { enabled: false, fixtureType: "sconce", colorTempK: 3000, dimmable: true },
    starCeiling:   { enabled: false, fixtureType: "fiberOptic", colorTempK: 4000, dimmable: false },
    entryFoyer:    { enabled: false, fixtureType: "downlight", colorTempK: 3000, dimmable: true },
    equipmentRack: { enabled: false, fixtureType: "ledStrip", colorTempK: 4000, dimmable: false },
  })
  const [lightingScenes, setLightingScenes] = useState<Record<string, LightingSceneValues>>({
    movie:        { screenWash: 5, ceilingCove: 0, aisleStep: 10, wallSconces: 0, starCeiling: 30, entryFoyer: 0, equipmentRack: 20 },
    intermission: { screenWash: 40, ceilingCove: 60, aisleStep: 50, wallSconces: 80, starCeiling: 50, entryFoyer: 80, equipmentRack: 40 },
    welcome:      { screenWash: 80, ceilingCove: 80, aisleStep: 70, wallSconces: 100, starCeiling: 60, entryFoyer: 100, equipmentRack: 60 },
    cleanup:      { screenWash: 100, ceilingCove: 100, aisleStep: 100, wallSconces: 100, starCeiling: 0, entryFoyer: 100, equipmentRack: 100 },
  })
  const [lightingAutomation, setLightingAutomation] = useState<LightingAutomationConfig>({
    projectorSync: false, playPauseSync: false, occupancySensor: false, scheduleEnabled: false,
  })
  const [activeScene, setActiveScene] = useState<"movie" | "intermission" | "welcome" | "cleanup">("movie")

  const [isExporting, setIsExporting] = useState(false)
  const [view3D, setView3D] = useState<boolean>(true)
  const [viewPreset, setViewPreset] = useState<{ name: string; seq: number }>({ name: '', seq: 0 })
  const goToView = (name: string) => setViewPreset(p => ({ name, seq: p.seq + 1 }))

  // ── Apply Gate ────────────────────────────────────────────────────────────
  // appliedRef holds a committed snapshot of all "heavy" inputs.
  // Heavy useMemos only recompute when commitToken increments (Apply pressed).
  // isDirty goes true whenever any input changes after the last Apply.
  type AppliedSnapshot = {
    unitSystem: "metric" | "imperial"
    metricDimensions: { width: number; height: number; length: number }
    imperialDimensions: { widthFeet: number; widthInches: number; heightFeet: number; heightInches: number; lengthFeet: number; lengthInches: number }
    treatmentLevel: TreatmentLevel; designIntent: DesignIntent
    acousticDepthMeters: { front: number; rear: number; left: number; right: number; ceiling: number }
    wallConstruction: "drywall" | "masonry" | "timber"
    floorType: FloorType
    aspectRatioMode: "16:9" | "2.35:1" | "4:3" | "custom"; customAspectWidth: number; customAspectHeight: number
    screenDiagonalInches: number; throwRatio: number; screenBottomFromFloor: number; displayType: "projector" | "display"
    standard: ViewingStandard; lcrMode: LCRMode; surroundMode: SurroundMode; ceilingCount: CeilingCount
    mountType: "inWall" | "onWall"; screenPlacement: "behindScreen" | "besideScreen"
    extraSidePairs: number; extraCeilingPairs: number
    rowCount: number; seatsPerRow: number; rowPitchFt: number; sightlineGrade: "economy" | "standard" | "luxury" | "reference"
    firstRowOffsetM: number; aisleConfig: "none" | "center" | "left" | "right" | "both"; aisleWidthM: number
    widerBackRow: boolean; riserOverrideMm: number | null; seatWidthMm: number
    seatWidthOverrideIn: number | null; seatDepthOverrideIn: number | null; riserDepthOverrideIn: number | null
    seatType: "standard" | "luxury"; primaryRow: number
    subCount: number; subPlacement: "frontWall" | "frontCorners" | "distributed" | "haas"; subType: "sealed" | "ported"
  }

  const appliedRef = useRef<AppliedSnapshot>({
    unitSystem, metricDimensions, imperialDimensions,
    treatmentLevel, designIntent, acousticDepthMeters, wallConstruction, floorType,
    aspectRatioMode, customAspectWidth, customAspectHeight,
    screenDiagonalInches, throwRatio, screenBottomFromFloor, displayType,
    standard, lcrMode, surroundMode, ceilingCount, mountType, screenPlacement,
    extraSidePairs, extraCeilingPairs,
    rowCount, seatsPerRow, rowPitchFt, sightlineGrade, firstRowOffsetM,
    aisleConfig, aisleWidthM, widerBackRow, riserOverrideMm, seatWidthMm,
    seatWidthOverrideIn, seatDepthOverrideIn, riserDepthOverrideIn,
    seatType, primaryRow, subCount, subPlacement, subType,
  })

  const [commitToken, setCommitToken] = useState(0)
  const [isDirty, setIsDirty] = useState(false)
  const [unlockedLevel, setUnlockedLevel] = useState(2) // 2=Client+Room always visible, 3-8 unlock progressively
  const mountedForDirty = useRef(false)

  // Stable dirty-tracking key — always exactly 1 dep, immune to array-size hot-reload errors
  const dirtyKey = JSON.stringify([
    unitSystem, metricDimensions, imperialDimensions,
    treatmentLevel, designIntent, acousticDepthMeters, wallConstruction, floorType,
    aspectRatioMode, customAspectWidth, customAspectHeight,
    screenDiagonalInches, throwRatio, screenBottomFromFloor, displayType,
    standard, lcrMode, surroundMode, ceilingCount, mountType, screenPlacement,
    extraSidePairs, extraCeilingPairs,
    rowCount, seatsPerRow, rowPitchFt, sightlineGrade, firstRowOffsetM,
    aisleConfig, aisleWidthM, widerBackRow, riserOverrideMm, seatWidthMm,
    seatWidthOverrideIn, seatDepthOverrideIn, riserDepthOverrideIn,
    seatType, primaryRow, subCount, subPlacement, subType,
  ])

  useEffect(() => {
    if (!mountedForDirty.current) { mountedForDirty.current = true; return }
    setIsDirty(true)
  }, [dirtyKey])

  const handleApply = () => {
    appliedRef.current = {
      unitSystem, metricDimensions, imperialDimensions,
      treatmentLevel, designIntent, acousticDepthMeters, wallConstruction, floorType,
      aspectRatioMode, customAspectWidth, customAspectHeight,
      screenDiagonalInches, throwRatio, screenBottomFromFloor, displayType,
      standard, lcrMode, surroundMode, ceilingCount, mountType, screenPlacement,
      extraSidePairs, extraCeilingPairs,
      rowCount, seatsPerRow, rowPitchFt, sightlineGrade, firstRowOffsetM,
      aisleConfig, aisleWidthM, widerBackRow, riserOverrideMm, seatWidthMm,
      seatType, primaryRow, subCount, subPlacement, subType,
      seatWidthOverrideIn, seatDepthOverrideIn, riserDepthOverrideIn,
    }
    setCommitToken(t => t + 1)
    setIsDirty(false)
    // Progressive unlock — room must be valid to unlock Acoustic (level 3),
    // then each subsequent Apply advances one level regardless of changes.
    // NOTE: We validate directly from live input state here because the
    // roomValidation memo (which depends on commitToken → clampedRoom)
    // won't recompute until the next render, causing a stale-read on first click.
    const liveDims = unitSystem === "metric"
      ? { width: metricDimensions.width, length: metricDimensions.length, height: metricDimensions.height }
      : {
          width:  feetInchesToMeters(imperialDimensions.widthFeet,  imperialDimensions.widthInches),
          height: feetInchesToMeters(imperialDimensions.heightFeet, imperialDimensions.heightInches),
          length: feetInchesToMeters(imperialDimensions.lengthFeet, imperialDimensions.lengthInches),
        }
    const liveValid = validateRoomDimensions(liveDims, unitSystem).valid
    setUnlockedLevel(prev => {
      if (prev >= 8) return 8
      if (prev === 2) return liveValid ? 3 : 2
      return prev + 1
    })
  }

    const roomInMeters = useMemo(() => {
    const a = appliedRef.current
    if (a.unitSystem === "metric") return a.metricDimensions
    return {
      width:  feetInchesToMeters(a.imperialDimensions.widthFeet,  a.imperialDimensions.widthInches),
      height: feetInchesToMeters(a.imperialDimensions.heightFeet, a.imperialDimensions.heightInches),
      length: feetInchesToMeters(a.imperialDimensions.lengthFeet, a.imperialDimensions.lengthInches),
    }
  }, [commitToken]) // eslint-disable-line react-hooks/exhaustive-deps

  const clampedRoom = useMemo(() => ({
    length: clampValue(roomInMeters.length, LIMITS.length),
    width: clampValue(roomInMeters.width, LIMITS.width),
    height: clampValue(roomInMeters.height, LIMITS.height)
  }), [roomInMeters]) // eslint-disable-line react-hooks/exhaustive-deps

  const updateDepth = (
    key: "front" | "rear" | "left" | "right" | "ceiling",
    valueMeters: number
  ) => {
    const maxM = DEPTH_MAX[key] ?? 0.6096
    const clamped = Math.min(maxM, Math.max(0, valueMeters))
    setAcousticDepthMeters(prev => {
      if (sideLinked && (key === "left" || key === "right")) {
        return { ...prev, left: clamped, right: clamped }
      }
      return { ...prev, [key]: clamped }
    })
  }

  const usableRoom = useMemo(() => {
    const d = appliedRef.current.acousticDepthMeters
    return {
      length: Math.max(0, clampedRoom.length - d.front - d.rear),
      width:  Math.max(0, clampedRoom.width  - d.left  - d.right),
      height: Math.max(0, clampedRoom.height - d.ceiling),
    }
  }, [clampedRoom, commitToken]) // eslint-disable-line react-hooks/exhaustive-deps

  const geometryValid =
    usableRoom.length > 1.5 &&
    usableRoom.width > 1.5 &&
    usableRoom.height > 2

  const roomValidation = useMemo(() => {
    return validateRoomDimensions(
      { width: clampedRoom.width, length: clampedRoom.length, height: clampedRoom.height },
      unitSystem
    )
  }, [clampedRoom, unitSystem])


  const roomVolume = useMemo(() => {
    return clampedRoom.width * clampedRoom.length * clampedRoom.height
  }, [clampedRoom])
  // ── Room ratio quality — used in Room Summary badge ───────────────────────
  const roomRatio = useMemo(() => {
    if (!roomValidation.valid) return null
    const { width, length, height } = clampedRoom

    // ── ITU/EBU acoustic ratio standard ──────────────────────────────────────
    // Normalise to height = 1. Good HT ratios: Lx/H and Ly/H should not be
    // integer or simple-fraction multiples of each other (avoids axial mode stacking).
    // Recommended ranges (ITU-R BS.1116, EBU Tech 3276, Bolt 1946):
    //   L/H ∈ [1.1 … 3.0],  W/H ∈ [1.1 … 2.2],  L/W ∈ [1.0 … 2.5]
    // Additional checks:
    //   - Near-square floor (L/W < 1.05) → strong lateral modes
    //   - Any two dims within 5% of an integer multiple → mode clustering

    const lh = length / height
    const wh = width  / height
    const lw = length / width

    // Range check
    const lhOk = lh >= 1.1 && lh <= 3.0
    const whOk = wh >= 1.1 && wh <= 2.2
    const lwOk = lw >= 1.0 && lw <= 2.5

    // Near-square floor
    const nearSquare = Math.abs(length - width) / Math.max(length, width) < 0.05

    // Integer-multiple check — any ratio within 4% of a whole number (2× or 3×) is a risk
    const isNearInt = (r: number) => {
      const rounded = Math.round(r)
      return rounded >= 2 && Math.abs(r - rounded) / rounded < 0.04
    }
    const modeRisk = isNearInt(lh) || isNearInt(wh) || isNearInt(lw)

    const allInRange = lhOk && whOk && lwOk
    const status = nearSquare || modeRisk ? "caution"
      : allInRange ? "good"
      : "acceptable"

    const label = nearSquare     ? "Near-square — strong lateral modes"
      : modeRisk                 ? "Dimension multiple — mode stacking risk"
      : allInRange               ? "Good ratio (ITU/EBU)"
      : !lhOk                    ? `L/H ${lh.toFixed(2)} out of range`
      : !whOk                    ? `W/H ${wh.toFixed(2)} out of range`
      : !lwOk                    ? `L/W ${lw.toFixed(2)} out of range`
      : "Acceptable ratio"

    return { status, label, lh, wh, lw }
  }, [clampedRoom, roomValidation.valid])

  // ── Auto-recommendation: pre-fills all 4 sections based on room ────────────
  const autoRecommended = useMemo((): { lcr: LCRMode; surrounds: SurroundMode; ceilingCount: CeilingCount; extraSidePairs: number; extraCeilingPairs: number; subCount?: number; mountType?: "inWall" | "onWall"; screenPlacement?: "behindScreen" | "besideScreen" } => {
    const vol = roomVolume
    const h   = clampedRoom.height
    // Must match the Auto button logic exactly — single source of truth
    type Cfg = { sm: SurroundMode; cc: CeilingCount; es: number; ec: number; sc: number }
    const cfg: Cfg =
      vol >= 150 && h >= 4.0 ? { sm: "side_rear", cc: 6, es: 2, ec: 0, sc: 4 }
      : vol >= 100 && h >= 3.5 ? { sm: "side_rear", cc: 6, es: 1, ec: 0, sc: 2 }
      : vol >= 70  && h >= 3.0 ? { sm: "side_rear", cc: 4, es: 1, ec: 0, sc: 2 }
      : vol >= 45  && h >= 2.7 ? { sm: "side_rear", cc: 4, es: 0, ec: 0, sc: 2 }
      : vol >= 30  && h >= 2.5 ? { sm: "side_rear", cc: 2, es: 0, ec: 0, sc: 2 }
      : vol >= 20              ? { sm: "side_rear", cc: 0, es: 0, ec: 0, sc: 1 }
      : { sm: "side", cc: 0, es: 0, ec: 0, sc: 1 }
    return { lcr: "lcr", surrounds: cfg.sm, ceilingCount: cfg.cc, extraSidePairs: cfg.es, extraCeilingPairs: cfg.ec, subCount: cfg.sc, mountType: "onWall", screenPlacement: "behindScreen" }
  }, [roomVolume, clampedRoom.height])

  // Apply recommendation only on first valid room entry — not on subsequent edits
  useEffect(() => {
    if (speakerConfigEdited.current) return
    setLcrMode(autoRecommended.lcr)
    setSurroundMode(autoRecommended.surrounds)
    setCeilingCount(autoRecommended.ceilingCount)
    setExtraSidePairs(autoRecommended.extraSidePairs)
    setExtraCeilingPairs(autoRecommended.extraCeilingPairs)
  }, [autoRecommended])

  // ── Config notation: beds.subs.ceiling (actual speaker counts) ──────────────
  // LCR is now always fixed (standard for HT). beds = 3 LCR + surrounds + extras.
  const configNotation = useMemo(() => {
    const baseBeds  = surroundMode === "none" ? 3 : surroundMode === "side" ? 5 : 7
    const totalBeds = baseBeds + extraSidePairs * 2
    const totalCeil = ceilingCount + extraCeilingPairs * 2
    const base = totalCeil > 0 ? `${totalBeds}.${subCount}.${totalCeil}` : `${totalBeds}.${subCount}`
    const extras: string[] = []
    if (extraSidePairs > 0) extras.push(`+${extraSidePairs * 2}S`)
    if (extraCeilingPairs > 0) extras.push(`+${extraCeilingPairs * 2}OH`)
    return extras.length > 0 ? `${base} (${extras.join(" ")})` : base
  }, [surroundMode, ceilingCount, subCount, extraSidePairs, extraCeilingPairs])

  const bedCount = surroundMode === "none" ? 3 : surroundMode === "side" ? 5 + extraSidePairs * 2 : 7 + extraSidePairs * 2
  const speakerSystemType = ceilingCount >= 4 ? "Dolby Atmos Reference" : ceilingCount === 2 ? "Dolby Atmos" : bedCount >= 6 ? "Surround Extended" : bedCount >= 5 ? "Surround" : bedCount >= 3 ? "LCR Stereo" : "Stereo"

  const EXTENDED_THRESHOLD_M = 7.62  // 25 ft — triggers extended coverage for genuinely long rooms

  const showExtendedSides   = clampedRoom.length > EXTENDED_THRESHOLD_M && surroundMode !== "none"
  const maxExtraSidePairs   = showExtendedSides
    ? Math.min(3, Math.max(1, Math.floor((clampedRoom.length - EXTENDED_THRESHOLD_M) / 3) + 1))
    : 0

  const showExtendedCeiling = clampedRoom.length > EXTENDED_THRESHOLD_M && clampedRoom.height >= 2.7 && ceilingCount > 0
  const maxExtraCeilingPairs = showExtendedCeiling
    ? Math.min(3, Math.max(1, Math.floor((clampedRoom.length - EXTENDED_THRESHOLD_M) / 4) + 1))
    : 0

  const roomSurfaceData = useMemo(() => {
    if (!roomValidation.valid) return null
    const { length, width, height } = clampedRoom
    const floorArea = length * width
    const ceilingArea = floorArea
    const frontWall = width * height
    const rearWall = frontWall
    const leftWall = length * height
    const rightWall = leftWall
    return {
      floorArea, ceilingArea, frontWall, rearWall, leftWall, rightWall,
      totalSurface: floorArea + ceilingArea + frontWall + rearWall + leftWall + rightWall
    }
  }, [clampedRoom, roomValidation.valid])

  const displayUnitArea = unitSystem === "metric" ? "m²" : "ft²"
  const convertArea = (areaM2: number): number =>
    unitSystem === "metric" ? areaM2 : areaM2 * 10.7639

  const screenAspectRatio = useMemo(() => {
    const a = appliedRef.current
    if (a.aspectRatioMode === "16:9")   return 16 / 9
    if (a.aspectRatioMode === "2.35:1") return 2.35
    if (a.aspectRatioMode === "4:3")    return 4 / 3
    return a.customAspectWidth / (a.customAspectHeight || 1)
  }, [commitToken]) // eslint-disable-line react-hooks/exhaustive-deps

  const diagonalToWidthMeters = (diagonalInches: number, ar: number): number => {
    const widthInches = diagonalInches * ar / Math.sqrt(ar * ar + 1)
    return widthInches * 0.0254
  }

  const screenWidthMeters = useMemo(() => {
    return diagonalToWidthMeters(appliedRef.current.screenDiagonalInches, screenAspectRatio)
  }, [screenAspectRatio, commitToken]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── C-value sightline system constants ──────────────────────────────────
  // C_VALUES — module scope

  // ── Seating calculations ──
  const seatingCalcs = useMemo(() => {
    const a = appliedRef.current
    const degreesToRadians = (deg: number) => (deg * Math.PI) / 180

    // ── Seat specs — base dims with user-adjustable overrides via seatWidthMm / riserOverrideMm ──
    // Theater:   W=24" ±5", D=26" ±5", riser depth=48" (42"–54"), riser height auto ±2"
    // Recliner:  W=36" ±5", D=69" ±5", riser depth=72" (72"–84"), riser height auto ±2"
    const SEAT_BASE = {
      standard: { widthIn: 24, depthIn: 26, riserDepthIn: 48 },
      luxury:   { widthIn: 36, depthIn: 69, riserDepthIn: 72 },
    }
    const base = SEAT_BASE[a.seatType] ?? SEAT_BASE.standard
    // User overrides stored in state (inches). If null, use base.
    const seatWidthIn    = a.seatWidthOverrideIn  ?? base.widthIn
    const seatDepthIn    = a.seatDepthOverrideIn   ?? base.depthIn
    const riserDepthIn   = a.riserDepthOverrideIn  ?? base.riserDepthIn

    const inToM = (inches: number) => inches * 0.0254
    const SEAT_WIDTH     = inToM(seatWidthIn)
    const ROW_DEPTH      = inToM(riserDepthIn)
    const SIDE_CLEARANCE = 0.3
    const EQUIPMENT_DEPTH = 0.6096  // 2' equipment space at front wall

    let viewingDistance = 0
    switch (a.standard) {
      case "SMPTE":    viewingDistance = screenWidthMeters / (2 * Math.tan(degreesToRadians(15))); break
      case "THX":      viewingDistance = screenWidthMeters / (2 * Math.tan(degreesToRadians(20))); break
      case "IMMERSIVE":viewingDistance = screenWidthMeters / (2 * Math.tan(degreesToRadians(25))); break
    }

    // ── Back-wall-first seating model ──────────────────────────────────────
    // Rows pack from the REAR wall forward. The remaining space in front of
    // the front row is the front clearance. We hard-block if front clearance < 6'.
    const MIN_FRONT_CLEARANCE_M = 1.8288  // 6 ft hard minimum
    const seatingZoneDepth = Math.max(0, usableRoom.length - EQUIPMENT_DEPTH)
    // Max rows by length: pack from back, ensure front row leaves ≥ 6' to screen wall
    const maxRowsByLength = Math.max(1, Math.floor((seatingZoneDepth - MIN_FRONT_CLEARANCE_M) / ROW_DEPTH))

    // ── Riser height — default 6", user adjusts 4"–12" ────────────────
    const autoRiserHeightMm = 152.4  // 6 inches in millimetres
    const minRiserHeightMm = 101.6  // 4 inches
    const maxRiserHeightMm = 304.8  // 12 inches
    const riserMm = a.riserOverrideMm !== null
      ? Math.max(minRiserHeightMm, Math.min(maxRiserHeightMm, a.riserOverrideMm))
      : autoRiserHeightMm
    const riserStepM  = riserMm / 1000
    const riserBelowGrade = a.riserOverrideMm !== null && a.riserOverrideMm < autoRiserHeightMm
    const rakeDeg    = Math.atan2(riserStepM, ROW_DEPTH) * (180 / Math.PI)

    const maxRowsByHeight = riserStepM > 0
      ? Math.max(1, Math.floor((usableRoom.height - 1.65) / riserStepM) + 1)
      : maxRowsByLength
    const maxRows  = Math.max(1, Math.min(maxRowsByLength, maxRowsByHeight))
    const limitingFactor: "length" | "ceiling" = maxRowsByHeight < maxRowsByLength ? "ceiling" : "length"

    const usableWidth = Math.max(0, usableRoom.width - 2 * SIDE_CLEARANCE)
    const maxSeats    = Math.max(1, Math.floor(usableWidth / SEAT_WIDTH))

    // ── Aisle — fixed 24" (610mm) width, extra leftover space added ───────
    // Back row (furthest from screen) never has aisle — full seat width used.
    const FIXED_AISLE_W  = 0.6096  // 24" fixed
    const aisleCount     = a.aisleConfig === "none" ? 0 : a.aisleConfig === "both" ? 2 : 1
    const totalAisleW    = aisleCount * FIXED_AISLE_W
    const seatingWidthForSeats = Math.max(0, usableWidth - totalAisleW)
    const maxSeatsWithAisle = aisleCount > 0 ? Math.max(1, Math.floor(seatingWidthForSeats / SEAT_WIDTH)) : maxSeats
    const aisleSeatsLost = maxSeats - maxSeatsWithAisle
    // Extra space after arranging seats goes to aisle
    const seatsRowWidth  = maxSeatsWithAisle * SEAT_WIDTH
    const aisleActualW   = aisleCount > 0 ? Math.max(FIXED_AISLE_W, (usableWidth - seatsRowWidth) / aisleCount) : 0
    const maxSeatsBackRow = maxSeats  // back row = no aisle, full width

    const clampedRowCount    = Math.min(a.rowCount, maxRows)
    const clampedSeatsPerRow = Math.min(a.seatsPerRow, maxSeatsWithAisle)
    const backRowSeats       = Math.min(a.seatsPerRow, maxSeatsBackRow)

    // ── Spatial layout — rows from back wall forward ──────────────────────
    const seatingZoneUsed    = clampedRowCount * ROW_DEPTH
    const frontClearance     = Math.max(0, seatingZoneDepth - seatingZoneUsed)
    const frontClearanceSafe = frontClearance >= MIN_FRONT_CLEARANCE_M
    const rearClearanceM     = 0  // back row is against rear wall (after panels)

    const totalRiseM         = (clampedRowCount - 1) * riserStepM
    const lastRowEyeHeightM  = 1.2 + totalRiseM  // back row (highest) eye height
    const headroomM          = usableRoom.height - lastRowEyeHeightM
    const headroomStatus     = headroomM >= 0.45 ? "good" : headroomM >= 0.15 ? "tight" : "low"
    const screenTopH         = a.screenBottomFromFloor + (screenWidthMeters / (screenAspectRatio || 1.778))
    const firstRowAngle      = frontClearance > 0 ? Math.atan2(screenTopH - 1.2, frontClearance) * (180 / Math.PI) : 90
    const viewingComfort     = firstRowAngle >= 30 ? "good" : firstRowAngle >= 15 ? "acceptable" : "steep"
    const seatingWidthUsed   = clampedSeatsPerRow * SEAT_WIDTH + 2 * SIDE_CLEARANCE

    // ── Per-row analysis — Row 1 = back row (against rear wall), counts forward ──
    const SCREEN_BOTTOM_H = a.screenBottomFromFloor
    const rowAnalysis = Array.from({ length: clampedRowCount }, (_, i) => {
      // i=0 is BACK row (highest riser, against rear wall), i=last is FRONT row (floor level)
      const rowNum         = i + 1
      const risersFromFront= clampedRowCount - 1 - i   // front row = 0 risers, back = max
      const floorRise      = risersFromFront * riserStepM
      const eyeHeight      = 1.2 + floorRise
      const distFromScreen = frontClearance + (clampedRowCount - 1 - i) * ROW_DEPTH + EQUIPMENT_DEPTH
      const vertAngleDeg   = Math.atan2(eyeHeight - SCREEN_BOTTOM_H, distFromScreen) * (180 / Math.PI)
      const cValueMet      = risersFromFront === 0 ? true : floorRise >= (risersFromFront * riserStepM)
      const sightlineStatus = vertAngleDeg >= 5 ? "clear" : vertAngleDeg >= 0 ? "marginal" : "blocked"
      return { rowNum, riserIndex: risersFromFront, floorRise, eyeHeight, distFromScreen, vertAngleDeg, sightlineStatus, cValueMet }
    })

    // Suggested rows = rows that still leave ≥ viewing distance for front row
    const suggestedMaxRows = viewingDistance > 0
      ? Math.max(1, Math.floor((seatingZoneDepth - Math.max(MIN_FRONT_CLEARANCE_M, viewingDistance)) / ROW_DEPTH))
      : maxRows
    const optimalRows  = Math.min(maxRows, Math.max(1, suggestedMaxRows))
    const optimalSeats = Math.min(maxSeatsWithAisle, Math.max(1, Math.floor(seatingWidthForSeats / SEAT_WIDTH)))

    return {
      rowDepth: ROW_DEPTH, seatWidth: SEAT_WIDTH, seatDepthM: inToM(seatDepthIn),
      usableLength: usableRoom.length, usableWidth,
      maxRows, maxRowsByLength, maxRowsByHeight, limitingFactor,
      maxSeats, maxSeatsWithAisle, maxSeatsBackRow, aisleSeatsLost, backRowSeats,
      aisleActualW,
      viewingDistance, frontClearance, frontClearanceSafe,
      physicsMinFrontClearance: MIN_FRONT_CLEARANCE_M,
      hardMinM: MIN_FRONT_CLEARANCE_M, hardMaxM: seatingZoneDepth,
      seatingZoneDepth, seatingZoneUsed, rearClearanceM, seatingWidthUsed,
      rowCount: clampedRowCount, seatsPerRow: clampedSeatsPerRow,
      riserStepM, riserMm, riserBelowGrade, cValueMm: autoRiserHeightMm, rakeDeg,
      autoRiserHeightMm,
      totalRiseM, lastRowEyeHeightM, headroomM, headroomStatus,
      rowAnalysis, optimalRows, optimalSeats, viewingComfort, firstRowAngle,
      seatWidthIn, seatDepthIn, riserDepthIn,
      baseWidthIn: base.widthIn, baseDepthIn: base.depthIn, baseRiserDepthIn: base.riserDepthIn,
    }
  }, [clampedRoom, usableRoom, screenWidthMeters, screenAspectRatio, commitToken]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (rowCount > seatingCalcs.maxRows) setRowCount(seatingCalcs.maxRows)
  }, [seatingCalcs.maxRows, rowCount])

  useEffect(() => {
    if (seatsPerRow > seatingCalcs.maxSeatsWithAisle) setSeatsPerRow(seatingCalcs.maxSeatsWithAisle)
  }, [seatingCalcs.maxSeatsWithAisle, seatsPerRow])

  // ── Auto-set depth minimums when treatment level changes ──────────────────
  // When treatment level or wall construction changes, set depths to the
  // level-appropriate defaults (scaled by wall material).
  // Direct replacement — switching from Studio → Basic MUST lower depths,
  // not keep Studio values via Math.max (which caused "room over-treated").
  const prevTreatmentRef = useRef(treatmentLevel)
  useEffect(() => {
    const mc = WALL_MATERIAL_COEFF[wallConstruction] ?? WALL_MATERIAL_COEFF.drywall
    const ws = mc.wall <= 0.03 ? 1.20 : mc.wall >= 0.08 ? 0.85 : 1.0
    const raw = DEPTH_DEFAULTS[treatmentLevel] ?? DEPTH_DEFAULTS.basic
    const d   = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, v * ws])) as typeof raw
    const levelChanged = prevTreatmentRef.current !== treatmentLevel
    prevTreatmentRef.current = treatmentLevel
    if (levelChanged) {
      // Level changed — replace depths entirely so downgrade actually lowers them
      setAcousticDepthMeters({ front: d.front, rear: d.rear, left: d.left, right: d.right, ceiling: d.ceiling })
    } else {
      // Only wall construction changed — raise to minimum if needed, don't disrupt user tweaks
      setAcousticDepthMeters(prev => ({
        front:   Math.max(prev.front,   d.front),
        rear:    Math.max(prev.rear,    d.rear),
        left:    Math.max(prev.left,    d.left),
        right:   Math.max(prev.right,   d.right),
        ceiling: Math.max(prev.ceiling, d.ceiling),
      }))
    }
  }, [treatmentLevel, wallConstruction])


  // Extra pairs: clamp to max when room shrinks; reset to 0 when section disabled
  useEffect(() => {
    if (!showExtendedSides) setExtraSidePairs(0)
    else setExtraSidePairs(prev => Math.min(prev, maxExtraSidePairs))
  }, [showExtendedSides, maxExtraSidePairs])

  useEffect(() => {
    if (!showExtendedCeiling) setExtraCeilingPairs(0)
    else setExtraCeilingPairs(prev => Math.min(prev, maxExtraCeilingPairs))
  }, [showExtendedCeiling, maxExtraCeilingPairs])

  // ── Seat type → width sync: switching to luxury defaults wider, standard defaults narrower ──
  const prevSeatTypeRef = useRef(seatType)
  useEffect(() => {
    if (prevSeatTypeRef.current === seatType) return
    prevSeatTypeRef.current = seatType
    // Reset dimension overrides when seat type changes — user starts fresh from new base
    setSeatWidthOverrideIn(null)
    setSeatDepthOverrideIn(null)
    setRiserDepthOverrideIn(null)
    setRiserOverrideMm(152.4)
    setSeatWidthMm(seatType === "luxury" ? 914 : 610)
  }, [seatType])

  const screenHeight = useMemo(() => screenWidthMeters / screenAspectRatio, [screenWidthMeters, screenAspectRatio])

  const screenFitValidation = useMemo(() => {
    // Side clearance: besideScreen needs ~0.45 m each side for L/R speakers + masking border.
    // behindScreen: speakers fire through screen so only masking border (~0.15 m) needed each side.
    const SIDE_CLEARANCE   = screenPlacement === "besideScreen" ? 0.45 : 0.15
    const CEILING_CLEARANCE = 0.05   // 2" top gap only — screen bottom is user-controlled
    const maxWidth  = usableRoom.width  - (2 * SIDE_CLEARANCE)
    // Height budget: from screen bottom up to ceiling minus clearance
    const maxHeight = usableRoom.height - screenBottomFromFloor - CEILING_CLEARANCE
    return {
      fitsWidth:          screenWidthMeters <= maxWidth,
      fitsHeight:         screenHeight      <= maxHeight,
      fits:               screenWidthMeters <= maxWidth && screenHeight <= maxHeight,
      maxScreenWidth:     maxWidth,
      maxScreenHeight:    maxHeight,
      sideCleared:        SIDE_CLEARANCE,
      clampedScreenWidth: Math.min(screenWidthMeters, maxWidth)
    }
  }, [usableRoom, screenWidthMeters, screenHeight, screenPlacement, screenBottomFromFloor])

  const throwDistance = useMemo(() => screenWidthMeters * throwRatio, [screenWidthMeters, throwRatio])

  const throwValidation = useMemo(() => ({
    fits:         throwDistance <= usableRoom.length - 0.3,   // 0.3 m projector mount clearance behind throw point
    throwDistance,
    maxThrow:     usableRoom.length - 0.3
  }), [usableRoom, throwDistance])

  // Mid-frequency (500–1000 Hz) absorption coefficients per bare wall material.
  // These affect RT60 directly: concrete rooms ring longer than timber rooms.
  // Floor uses structural floor material (concrete slab vs timber subfloor).
  // WALL_MATERIAL_COEFF — module scope

  // ── Coverage-based absorption model ──────────────────────────────────────
  // Effective wall α = coverage × (panelNRC × intentFactor) + (1 - coverage) × bareWallα
  // Depth adds a small boost on top (deeper panels absorb more low-mid frequencies).
  // This ensures Standard/Studio don't over-treat: coverage limits how much wall
  // is actually treated, and intent further scales absorptive vs diffusive panels.
  const computedAbsorption = useMemo(() => {
    const a = appliedRef.current
    return computeAbsorptionCoeffs(
      a.treatmentLevel, a.designIntent, a.wallConstruction,
      a.acousticDepthMeters, clampedRoom.width, clampedRoom.height, clampedRoom.length,
      a.floorType
    )
  }, [commitToken]) // eslint-disable-line react-hooks/exhaustive-deps

  const acousticResult = useMemo(() => {
    if (!roomValidation.valid) return null
    const roomModel = createRoom(clampedRoom.width, clampedRoom.height, clampedRoom.length)
    return analyzeRoomAcoustics(roomModel, computedAbsorption)
  }, [clampedRoom, roomValidation.valid, computedAbsorption])

  const isRoomValid = roomValidation.valid

  // committed — frozen snapshot of appliedRef, only updates on Apply press
  // Must be defined before rt60Target which reads committed.designIntent
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const committed = useMemo(() => ({ ...appliedRef.current }), [commitToken])

  // rt60Target for UI display — uses committed designIntent so label matches rt60Status judgement
  const rt60Target     = RT60_TARGETS[committed.designIntent] ?? RT60_TARGETS.balanced
  const targetRT60Min  = rt60Target.min
  const targetRT60Max  = rt60Target.max

  const panelLayout = useMemo(() => {
    const a = committed
    const rt60 = RT60_TARGETS[a.designIntent] ?? RT60_TARGETS.balanced
    const clampedPrimaryRow = Math.max(0, Math.min(a.primaryRow, seatingCalcs.rowCount - 1))
    return computePanelLayout({
      room:            clampedRoom,
      acousticDepths:  a.acousticDepthMeters,
      treatmentLevel:  a.treatmentLevel,
      designIntent:    a.designIntent,
      computedRT60:    acousticResult?.rt60Seconds ?? null,
      targetRT60:      { min: rt60.min, max: rt60.max },
      primaryRow:      clampedPrimaryRow,
      seatingRowCount: seatingCalcs.rowCount,
      rowPitchM:       seatingCalcs.rowDepth,
      frontClearance:  seatingCalcs.frontClearance,
      usableWidth:     seatingCalcs.usableWidth,
      screenWidth:     screenWidthMeters,
      screenHeight:    screenHeight,
      screenBottomFromFloor: a.screenBottomFromFloor,
      mountType:       a.mountType,
    })
  }, [committed, clampedRoom, acousticResult, seatingCalcs, screenWidthMeters, screenHeight])

  // rt60Status reads committed designIntent's target — not live.
  // Live designIntent only controls UI labels; committed controls what was actually applied.
  const rt60Status = useMemo(() => {
    if (!acousticResult) return null
    const committedTarget = RT60_TARGETS[committed.designIntent] ?? RT60_TARGETS.balanced
    const rt = acousticResult.rt60Seconds
    if (rt < committedTarget.min) return "overdamped"
    if (rt > committedTarget.max) return "tooLive"
    return "optimal"
  }, [acousticResult, committed])

  // ── BOQ (Bill of Quantities) Calculator ──
  // Computes per-surface: total area, panel count (2'×2' = 0.6096m), frame linear metres,
  // insulation fill area, and coverage area for material ordering.
  const boqData = useMemo(() => {
    const a = committed
    const r = clampedRoom
    const roomVol = r.width * r.height * r.length
    const cov = getCoverage(a.treatmentLevel, roomVol)
    const PANEL_SIZE = 0.6096 // 2 feet in metres

    type BOQSurface = {
      surface: string
      totalAreaM2: number
      coveredAreaM2: number
      panelCount: number
      frameLengthM: number
      insulationAreaM2: number
      mat: MatSpec
    }

    const surfaceDefs: { key: SurfaceKey; label: string; areaM2: number }[] = [
      { key: 'front',   label: 'Front Wall',  areaM2: r.width * r.height },
      { key: 'rear',    label: 'Rear Wall',   areaM2: r.width * r.height },
      { key: 'sides',   label: 'Side Walls',  areaM2: r.height * r.length * 2 },
      { key: 'ceiling', label: 'Ceiling',      areaM2: r.width * r.length },
      { key: 'floor',   label: 'Floor',        areaM2: r.width * r.length },
    ]

    const surfaces: BOQSurface[] = surfaceDefs.map(({ key, label, areaM2 }) => {
      const mat = getMaterial(a.treatmentLevel, a.designIntent, key)
      const isTreated = mat.panelType !== 'bare' && mat.panelType !== 'floor' && mat.layers.length > 0
      const covArea = isTreated ? areaM2 * cov : (key === 'floor' ? areaM2 : 0)
      const panels = isTreated ? Math.ceil(covArea / (PANEL_SIZE * PANEL_SIZE)) : 0
      // Each 2'×2' panel frame = 4 × 0.6096m perimeter
      const frameLen = panels * 4 * PANEL_SIZE
      // Insulation fill = same area as panels (1 batt per panel)
      const insArea = isTreated ? covArea : 0
      return { surface: label, totalAreaM2: areaM2, coveredAreaM2: covArea, panelCount: panels, frameLengthM: frameLen, insulationAreaM2: insArea, mat }
    })

    // Bass trap (high only) — corner fills
    let basTrapEntry: BOQSurface | null = null
    if (a.treatmentLevel === 'high') {
      const mat = getMaterial('high', a.designIntent, 'bastrap')
      // 4 vertical corners × room height
      const trapLengthM = 4 * r.height
      const trapAreaM2 = trapLengthM * 0.2 // ~200mm deep triangular fill ≈ 0.2m effective width
      basTrapEntry = {
        surface: 'Bass Traps (corners)',
        totalAreaM2: trapAreaM2,
        coveredAreaM2: trapAreaM2,
        panelCount: Math.ceil(trapLengthM / PANEL_SIZE),
        frameLengthM: 0, // corner fills typically don't use frames
        insulationAreaM2: trapAreaM2,
        mat,
      }
    }

    const allSurfaces = basTrapEntry ? [...surfaces, basTrapEntry] : surfaces

    const totals = {
      totalPanels: allSurfaces.reduce((s, e) => s + e.panelCount, 0),
      totalFrameM: allSurfaces.reduce((s, e) => s + e.frameLengthM, 0),
      totalInsulationM2: allSurfaces.reduce((s, e) => s + e.insulationAreaM2, 0),
      totalCoveredM2: allSurfaces.reduce((s, e) => s + e.coveredAreaM2, 0),
    }

    return { surfaces: allSurfaces, totals, coveragePct: Math.round(cov * 100), panelSizeLabel: "2' × 2' (610 × 610 mm)" }
  }, [committed, clampedRoom])

  // ── Live RT60 preview — updates instantly as user moves depth sliders ──
  // Uses current (uncommitted) values with the same coverage-based model
  // as computedAbsorption so the preview matches what Apply will produce.
  const liveRT60 = useMemo(() => {
    if (!roomValidation.valid) return null
    const abs = computeAbsorptionCoeffs(
      treatmentLevel, designIntent, wallConstruction,
      acousticDepthMeters, clampedRoom.width, clampedRoom.height, clampedRoom.length,
      floorType
    )
    return computeEyringRT60(abs, clampedRoom.width, clampedRoom.height, clampedRoom.length)
  }, [roomValidation.valid, treatmentLevel, designIntent, wallConstruction, floorType, acousticDepthMeters, clampedRoom])

  const liveRT60Target = RT60_TARGETS[designIntent] ?? RT60_TARGETS.balanced
  const liveRT60Status = liveRT60 === null ? null
    : liveRT60 < liveRT60Target.min ? "overdamped"
    : liveRT60 > liveRT60Target.max ? "tooLive"
    : "optimal"

  const worstCluster       = acousticResult?.worstCluster ?? null
  const clusterSeverityScore = worstCluster?.severityScore ?? 0
  const clusterRiskPercent   = Math.min(clusterSeverityScore, 100)

  const scene = useMemo(() => buildScene(
    appliedRef.current.standard,
    { lcr: appliedRef.current.lcrMode, surrounds: appliedRef.current.surroundMode, ceilingCount: appliedRef.current.ceilingCount },
    appliedRef.current.mountType,
    appliedRef.current.screenPlacement,
    {
      rowCount: seatingCalcs.rowCount,
      seatsPerRow: seatingCalcs.seatsPerRow,
      riserHeight: seatingCalcs.riserStepM,
      seatType: appliedRef.current.seatType,
      rowPitchM: seatingCalcs.rowDepth,
      frontClearance: seatingCalcs.frontClearance,
      primaryRow: Math.max(0, Math.min(committed.primaryRow, seatingCalcs.rowCount - 1)),
    },
    {
      screenWidthMeters: Math.min(screenWidthMeters, screenFitValidation.clampedScreenWidth),
      screenHeight,
      throwDistance,
      aspectRatioMode: (appliedRef.current.aspectRatioMode === "4:3" ? "custom" : appliedRef.current.aspectRatioMode) as "16:9" | "2.35:1" | "custom"
    },
    {
      width:  clampedRoom.width,
      length: clampedRoom.length,
      height: clampedRoom.height,
    },
    {
      count:     appliedRef.current.subCount,
      placement: appliedRef.current.subPlacement,
      enclosure: appliedRef.current.subType,
    }
  ), [seatingCalcs, screenWidthMeters, screenFitValidation.clampedScreenWidth,
      screenHeight, throwDistance, clampedRoom, committed])

  const BASE_SCALE = 60
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const svgRef = useRef<SVGSVGElement | null>(null)
  const isDragging = useRef(false)
  const lastMouse = useRef({ x: 0, y: 0 })

  const fitToRoom = () => {
    const svg = svgRef.current
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    const room = scene.room
    const roomWidthPx  = room.width  * BASE_SCALE
    const roomHeightPx = room.length * BASE_SCALE
    const padding = 80
    const scaleX  = (rect.width  - padding) / roomWidthPx
    const scaleY  = (rect.height - padding) / roomHeightPx
    const newScale = Math.min(scaleX, scaleY)
    setScale(newScale)
    setOffset({
      x: rect.width  / 2 - (roomWidthPx  * newScale) / 2,
      y: rect.height / 2 - (roomHeightPx * newScale) / 2
    })
  }

  useEffect(() => {
    setTimeout(() => fitToRoom(), 50)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [standard, lcrMode, surroundMode, ceilingCount, mountType, screenPlacement, seatingCalcs.rowCount, seatingCalcs.seatsPerRow, clampedRoom])

  const resetView = () => { setScale(1); setOffset({ x: 0, y: 0 }) }

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const zoomIntensity = 0.0015
    const delta = -e.deltaY
    const newScale = scale * (1 + delta * zoomIntensity)
    if (newScale < 0.2 || newScale > 5) return
    const svg = svgRef.current
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top
    const dx = mouseX - offset.x
    const dy = mouseY - offset.y
    const scaleRatio = newScale / scale
    setScale(newScale)
    setOffset({ x: mouseX - dx * scaleRatio, y: mouseY - dy * scaleRatio })
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true
    lastMouse.current = { x: e.clientX, y: e.clientY }
  }
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current) return
    const dx = e.clientX - lastMouse.current.x
    const dy = e.clientY - lastMouse.current.y
    setOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }))
    lastMouse.current = { x: e.clientX, y: e.clientY }
  }
  const handleMouseUp = () => { isDragging.current = false }

  // scene.listeners[0] is the primary row centre seat (set by primaryRow in buildScene)
  const primarySeat = scene.listeners[0] ?? scene.objects.find(o => o.type === "seat")
  const listenerX = (primarySeat?.x ?? 0) * BASE_SCALE
  const listenerY = (primarySeat?.y ?? 0) * BASE_SCALE

  // Azimuth from primary listener to speaker.
  // SVG Y axis is inverted: screen is at top (y≈0), rear at bottom (y=roomL).
  // Forward direction = screen = negative SVG-Y relative to listener.
  // atan2(dx, -dy_svg) → 0° straight ahead, +90° right, -90° left (standard azimuth).
  function calculateAngle(speakerX: number, speakerY: number) {
    const dx  =  speakerX - listenerX          // positive = speaker is to the right
    const dy  = -(speakerY - listenerY)        // invert SVG Y so forward = positive
    return (Math.atan2(dx, dy) * (180 / Math.PI)).toFixed(1)
  }

  // ── Shared format helpers ──────────────────────────────────────────────
  const fmtM = (m: number) =>
    unitSystem === "imperial" ? `${(m * 3.28084).toFixed(1)} ft` : `${m.toFixed(2)} m`

  // Screen dimensions: always in inches (imperial) or cm (metric) — never ft/m
  const fmtScreenDim = (m: number) =>
    unitSystem === "imperial" ? `${(m * 39.3701).toFixed(1)}"` : `${(m * 100).toFixed(1)} cm`


  // ── hFOV / targetAngle — needed at component scope (used in Stage 4 IIFE and right panel screen tab) ──
  const hFOV = seatingCalcs.viewingDistance > 0
    ? 2 * Math.atan(screenWidthMeters / (2 * seatingCalcs.viewingDistance)) * (180 / Math.PI)
    : 0
  const targetAngle = ({ SMPTE: 30, THX: 40, IMMERSIVE: 50 } as Record<string, number>)[standard] ?? 40

  // ==============================
  // RENDER
  // ==============================

  return (
    <div className="flex flex-col h-screen text-[#202b40]" style={{ background: "#d9dadb" }}>
      {/* STICKY TOP HEADER */}
      <header className="sticky top-0 z-50 h-[60px] flex items-center justify-between px-8" style={{ background: "#d9dadb", borderBottom: "2px solid #8a9ab0" }}>
        <div className="flex items-center gap-3">
          <style>{`
            @import url('https://fonts.googleapis.com/css2?family=GFS+Didot&display=swap');
            @keyframes sectionSlideIn {
              from { opacity: 0; transform: translateY(-10px); max-height: 0; }
              to   { opacity: 1; transform: translateY(0);     max-height: 4000px; }
            }
            @keyframes hdr-s-glow {              0%,100% { filter: drop-shadow(0 0 1px rgba(32,43,64,0.2)); }
              50%      { filter: drop-shadow(0 0 5px rgba(37,99,235,0.2)); }
            }
            @keyframes hdr-ln-p { 0%,100%{opacity:0.4} 50%{opacity:0.8} }
            .hdr-s-l { animation: hdr-s-glow 3s 0.5s ease-in-out infinite; }
            .hdr-s-r { animation: hdr-s-glow 3s 1s ease-in-out infinite; }
            .hdr-ln  { animation: hdr-ln-p 3s 1s ease-in-out infinite; }
          `}</style>
          {/* S|S mark — compact, no wordmark inside */}
          <svg width="52" height="38" viewBox="0 0 52 38" xmlns="http://www.w3.org/2000/svg">
            <line className="hdr-ln" x1="26" y1="0" x2="26" y2="38"
              stroke="rgba(32,43,64,0.45)" strokeWidth="0.7"/>
            <text className="hdr-s-l" x="13" y="30" textAnchor="middle"
              fontFamily="'GFS Didot','Didot',Georgia,serif"
              fontSize="32" fontWeight="400" fill="rgba(32,43,64,0.82)">S</text>
            <text className="hdr-s-r" x="39" y="30" textAnchor="middle"
              fontFamily="'GFS Didot','Didot',Georgia,serif"
              fontSize="32" fontWeight="400" fill="rgba(32,43,64,0.82)">S</text>
          </svg>
          {/* Science of Sound text beside the mark */}
          <span style={{
            fontFamily: "'Montserrat','Helvetica Neue',Arial,sans-serif",
            fontSize: '11px', fontWeight: 400, letterSpacing: '0.18em',
            textTransform: 'uppercase', color: '#202b40',
          }}>Hometheater design engine by Science of Sound</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Apply button */}
          <button
            onClick={handleApply}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={{
              background: isDirty ? "#2563EB" : "#d0d2d4",
              color:      isDirty ? "#ffffff"  : "#202b40",
              border:     isDirty ? "1px solid #2563EB" : "1px solid #8a9ab0",
              boxShadow:  isDirty ? "0 0 0 2px rgba(37,99,235,0.18)" : "none",
              cursor:     isDirty ? "pointer" : "default",
            }}
          >
            {isDirty && <span className="w-1.5 h-1.5 rounded-full bg-white opacity-90 shrink-0" />}
            Apply
          </button>
          <button
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition"
            style={{ background: "#d0d2d4", border: "1px solid #8a9ab0", color: "#202b40" }}
            onClick={() => {
              setUnitSystem("metric")
              setMetricDimensions({ width: 0, height: 0, length: 0 })
              setImperialDimensions({ widthFeet: 0, widthInches: 0, heightFeet: 0, heightInches: 0, lengthFeet: 0, lengthInches: 0 })
              setTreatmentLevel("basic"); setDesignIntent("balanced"); setRoomColorScheme("obsidian"); setSideLinked(true)
              setAcousticDepthMeters({ front: 0, rear: 0, left: 0, right: 0, ceiling: 0 })
              setLcrMode("lcr"); setSurroundMode("side_rear"); setCeilingCount(0); setMountType("onWall"); setScreenPlacement("behindScreen"); speakerConfigEdited.current = false
              setExtraSidePairs(0); setExtraCeilingPairs(0); setSeatType("standard")
              setRowCount(1); setSeatsPerRow(3); setSightlineGrade("standard"); setStandard("THX")
              setFirstRowOffsetM(0); setAisleConfig("none"); setAisleWidthM(0.6096); setWiderBackRow(false); setRiserOverrideMm(152.4); setSeatWidthMm(650)
              setSeatWidthOverrideIn(null); setSeatDepthOverrideIn(null); setRiserDepthOverrideIn(null)
              setAspectRatioMode("16:9"); setCustomAspectWidth(2.0); setCustomAspectHeight(1.0)
              setScreenDiagonalInches(100); setThrowRatio(1.4); setScreenBottomFromFloor(0.609)
              setDisplayType("projector"); setScreenType("fixed")
              setSubCount(1); setSubPlacement("frontWall"); setSubType("sealed"); setSpeakerBrand("")
              setClientInfo({ name: "", email: "", company: "", projectRef: "", location: "", projectType: "Home Theater", notes: "", projectDate: new Date().toISOString().slice(0, 10) })
              setWallConstruction("drywall"); setFloorType("carpet"); setScreenGain(1.0)
              setLightingZones({
                screenWash: { enabled: false, fixtureType: "ledStrip", colorTempK: 6500, dimmable: true },
                ceilingCove: { enabled: false, fixtureType: "ledStrip", colorTempK: 3000, dimmable: true },
                aisleStep: { enabled: false, fixtureType: "ledStep", colorTempK: 2700, dimmable: true },
                wallSconces: { enabled: false, fixtureType: "sconce", colorTempK: 3000, dimmable: true },
                starCeiling: { enabled: false, fixtureType: "fiberOptic", colorTempK: 4000, dimmable: false },
                entryFoyer: { enabled: false, fixtureType: "downlight", colorTempK: 3000, dimmable: true },
                equipmentRack: { enabled: false, fixtureType: "ledStrip", colorTempK: 4000, dimmable: false },
              })
              setLightingScenes({
                movie: { screenWash: 5, ceilingCove: 0, aisleStep: 10, wallSconces: 0, starCeiling: 30, entryFoyer: 0, equipmentRack: 20 },
                intermission: { screenWash: 40, ceilingCove: 60, aisleStep: 50, wallSconces: 80, starCeiling: 50, entryFoyer: 80, equipmentRack: 40 },
                welcome: { screenWash: 80, ceilingCove: 80, aisleStep: 70, wallSconces: 100, starCeiling: 60, entryFoyer: 100, equipmentRack: 60 },
                cleanup: { screenWash: 100, ceilingCove: 100, aisleStep: 100, wallSconces: 100, starCeiling: 0, entryFoyer: 100, equipmentRack: 100 },
              })
              setLightingAutomation({ projectorSync: false, playPauseSync: false, occupancySensor: false, scheduleEnabled: false })
              setActiveScene("movie")
              setScale(1); setOffset({ x: 0, y: 0 })
              setUnlockedLevel(2)
              fillEmailFromAccount()
            }}
          >Reset</button>
          <button
            onClick={async () => {
              if (!acousticResult) { alert("Please enter valid room dimensions to generate a report"); return }
              if (!clientInfo.name || clientInfo.name.trim().length === 0) { alert("Please enter a project name"); return }
              if (!clientInfo.email || clientInfo.email.trim().length === 0) { alert("Please enter a client email address"); return }
              if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientInfo.email.trim())) { alert("Please enter a valid client email address"); return }
              setIsExporting(true)
              try {
                const payload = {
                  name: clientInfo.name.trim(), email: clientInfo.email.trim(),
                  company: clientInfo.company || "", location: clientInfo.location || "",
                  projectRef: clientInfo.projectRef || "", projectType: clientInfo.projectType || "Home Theater",
                  notes: clientInfo.notes || "",
                  projectDate: clientInfo.projectDate || new Date().toISOString().slice(0, 10),
                  wallConstruction: committed.wallConstruction,
                  unitSystem, roomColorScheme,
                  roomWidth: clampedRoom.width, roomHeight: clampedRoom.height, roomLength: clampedRoom.length,
                  roomVolume: parseFloat(roomVolume.toFixed(2)),
                  treatmentLevel: committed.treatmentLevel,
                  designIntent:   committed.designIntent,
                  acousticDepthFront:   committed.acousticDepthMeters.front,
                  acousticDepthRear:    committed.acousticDepthMeters.rear,
                  acousticDepthLeft:    committed.acousticDepthMeters.left,
                  acousticDepthRight:   committed.acousticDepthMeters.right,
                  acousticDepthCeiling: committed.acousticDepthMeters.ceiling,
                  rating: acousticResult.acousticScore, rt60Seconds: acousticResult.rt60Seconds,
                  rt60Sabine: acousticResult.rt60SabineSeconds, rt60Eyring: acousticResult.rt60EyringSeconds,
                  rt60Target: `${targetRT60Min}–${targetRT60Max} s (${rt60Target.label})`,
                  rt60Status: rt60Status ?? "unknown",
                  schroederHz: parseFloat(acousticResult.schroederFrequencyHz.toFixed(1)),
                  modalRiskLevel: acousticResult.modalRiskLevel, clusterSeverityScore,
                  panelDiagnostics: panelLayout.diagnostics,
                  // Acoustic treatment detail for PDF
                  treatmentSummary: {
                    level:  committed.treatmentLevel,
                    intent: committed.designIntent,
                    hasBassTraps:  committed.treatmentLevel === 'high',
                    hasReflectors: committed.treatmentLevel === 'medium' || committed.treatmentLevel === 'high',
                    rearDiffuserType: (committed.treatmentLevel === 'medium' || committed.treatmentLevel === 'high')
                      ? (committed.designIntent === 'balanced' || committed.designIntent === 'luxury' ? 'skyline' : 'slatted')
                      : 'absorber',
                    depths: {
                      front:   parseFloat(committed.acousticDepthMeters.front.toFixed(3)),
                      rear:    parseFloat(committed.acousticDepthMeters.rear.toFixed(3)),
                      left:    parseFloat(committed.acousticDepthMeters.left.toFixed(3)),
                      right:   parseFloat(committed.acousticDepthMeters.right.toFixed(3)),
                      ceiling: parseFloat(committed.acousticDepthMeters.ceiling.toFixed(3)),
                    },
                    rt60Seconds:  acousticResult.rt60Seconds,
                    rt60Target:   `${targetRT60Min}–${targetRT60Max} s`,
                    rt60Status:   rt60Status ?? 'unknown',
                    acousticScore: acousticResult.acousticScore,
                    modalRiskLevel: acousticResult.modalRiskLevel,
                    trapLegCm: parseFloat((panelLayout.diagnostics.trapLegM * 100).toFixed(1)),
                    sbirHz:    panelLayout.diagnostics.sbirFreqHz,
                    frpPoints: {
                      leftZ:    panelLayout.diagnostics.frpLeftZ,
                      rightZ:   panelLayout.diagnostics.frpRightZ,
                      ceilingZ: panelLayout.diagnostics.frpCeilingZ,
                    },
                  },
                  speakerConfig: configNotation, speakerSystem: configNotation, speakerBrand,
                  lcrMode: committed.lcrMode, surroundMode: committed.surroundMode, ceilingCount: committed.ceilingCount,
                  displayType: committed.displayType, screenType, screenGain,
                  subCount: committed.subCount, subPlacement: committed.subPlacement, subType: committed.subType as string,
                  mountType: committed.mountType, screenPlacement: committed.screenPlacement,
                  extraSidePairs: committed.extraSidePairs,
                  extraCeilingPairs: committed.extraCeilingPairs,
                  viewingStandard: committed.standard,
                  aspectRatio: committed.aspectRatioMode,
                  screenDiagonalInches: committed.screenDiagonalInches,
                  screenWidthM: parseFloat(screenWidthMeters.toFixed(3)),
                  screenHeightM: parseFloat(screenHeight.toFixed(3)),
                  throwRatio: committed.throwRatio,
                  throwDistanceM: parseFloat(throwDistance.toFixed(3)),
                  viewingDistanceM: parseFloat(seatingCalcs.viewingDistance.toFixed(3)),
                  seatType: committed.seatType,
                  seatWidthMm: committed.seatWidthMm,
                  primaryRow: committed.primaryRow,
                  aisleConfig: committed.aisleConfig,
                  aisleWidthM: committed.aisleWidthM,
                  widerBackRow: committed.widerBackRow,
                  rowCount: seatingCalcs.rowCount, seatsPerRow: seatingCalcs.seatsPerRow,
                  totalSeats: seatingCalcs.rowCount * seatingCalcs.seatsPerRow,
                  riserStepMm: seatingCalcs.riserMm,
                  riserRakeDeg: parseFloat(seatingCalcs.rakeDeg.toFixed(2)),
                  sightlineGrade, totalRiseM: parseFloat(seatingCalcs.totalRiseM.toFixed(3)),
                  // Material Specification + BOQ for PDF Page 3
                  materialSpecs: (() => {
                    const surfaces: { key: SurfaceKey; label: string }[] = [
                      { key: 'front', label: 'Front Wall' },
                      { key: 'rear', label: 'Rear Wall' },
                      { key: 'sides', label: 'Side Walls' },
                      { key: 'ceiling', label: 'Ceiling' },
                      { key: 'floor', label: 'Floor' },
                      ...(committed.treatmentLevel === 'high' ? [{ key: 'bastrap' as const, label: 'Bass Traps' }] : []),
                    ]
                    return surfaces.map(({ key, label }) => {
                      const m = getMaterial(committed.treatmentLevel, committed.designIntent, key)
                      return {
                        surface: label,
                        panelName: m.name,
                        panelType: m.panelType,
                        nrc: m.nrc,
                        frame: m.frame,
                        layers: m.layers.map(l => ({ material: l.material, thickness: l.thickness, purpose: l.purpose })),
                      }
                    })
                  })(),
                  boqSurfaces: boqData.surfaces.map(s => ({
                    surface: s.surface,
                    coveredAreaM2: parseFloat(s.coveredAreaM2.toFixed(1)),
                    panelCount: s.panelCount,
                    frameLengthM: parseFloat(s.frameLengthM.toFixed(1)),
                    insulationAreaM2: parseFloat(s.insulationAreaM2.toFixed(1)),
                  })),
                  boqTotals: {
                    totalPanels: boqData.totals.totalPanels,
                    totalFrameM: parseFloat(boqData.totals.totalFrameM.toFixed(1)),
                    totalInsulationM2: parseFloat(boqData.totals.totalInsulationM2.toFixed(1)),
                    totalCoveredM2: parseFloat(boqData.totals.totalCoveredM2.toFixed(1)),
                  },
                  boqCoveragePct: boqData.coveragePct,
                  boqPanelSize: boqData.panelSizeLabel,
                  timestamp: new Date().toISOString()
                }
                const response = await fetch("/api/consultation", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(payload)
                })
                if (!response.ok) { setIsExporting(false); alert("Email sending failed."); return }
                const blob = await response.blob()
                const url = window.URL.createObjectURL(blob)
                const a = document.createElement("a")
                a.href = url; a.download = "Acoustic_Report.pdf"
                document.body.appendChild(a); a.click(); a.remove()
                window.URL.revokeObjectURL(url)
                setIsExporting(false)
              } catch (err) {
                console.error("Export failed:", err)
                setIsExporting(false)
                alert("An error occurred. Please try again.")
              }
            }}
            disabled={isExporting}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: "#d0d2d4", border: "1px solid #8a9ab0", color: "#202b40" }}
          >
            {isExporting ? "Exporting..." : "Export"}
          </button>
          <AccountMenu />
        </div>
      </header>

      {/* MAIN LAYOUT */}
      <div className="flex-1 flex flex-col lg:grid lg:grid-cols-[320px_1fr_360px] overflow-hidden gap-0" style={{ background: "#d9dadb" }}>

        {/* LEFT SIDEBAR */}
        <div className="border-b lg:border-b-0 lg:border-r-0 p-6 overflow-y-auto order-1 lg:order-none" style={{ background: "#d9dadb", borderRight: "3px solid #8a9ab0" }}>
          <div className="flex flex-col gap-6">

            {/* ── CLIENT & PROJECT ── */}
            <div className="rounded-xl p-4" style={{ background: "#dfe1e3", border: "1.5px solid #8a9ab0" }}>
              <div className="flex items-center justify-between mb-3">
                <label className="text-[11px] font-bold text-[#202b40] uppercase tracking-widest pl-2 border-l-2 border-[#2563EB]">Client & Project</label>
                <span className="text-[10px] text-[#202b40] leading-relaxed"><span className="text-amber-400">*</span> required for export</span>
              </div>
              <div className="space-y-3">

                {/* Project Name + Company */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-[#6b7a90] block mb-1">Project Name <span className="text-amber-400">*</span></label>
                    <input type="text" placeholder="e.g. Home Cinema" maxLength={60} value={clientInfo.name}
                      onChange={(e) => setClientInfo(prev => ({ ...prev, name: e.target.value.replace(/[<>";\/\*]/g, "").slice(0, 60) }))}
                      className={`w-full px-2 py-1.5 border rounded text-sm text-[#202b40] placeholder-[#94A3B8] focus:outline-none transition ${
                        clientInfo.name.trim().length === 0 ? "border-slate-300 focus:border-[#2563EB]" : "border-[#2563EB]/40 focus:border-[#2563EB]"
                      }`}
                      style={{ background: "#d9dadb" }}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-[#6b7a90] block mb-1">Company</label>
                    <input type="text" placeholder="Optional" maxLength={60} value={clientInfo.company}
                      onChange={(e) => setClientInfo(prev => ({ ...prev, company: e.target.value.replace(/[<>";\/\*]/g, "").slice(0, 60) }))}
                      className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm text-[#202b40] placeholder-[#94A3B8] focus:border-[#2563EB] focus:outline-none transition"
                      style={{ background: "#d9dadb" }}
                    />
                  </div>
                </div>

                {/* Client Email — auto-filled from account */}
                <div>
                  <label className="text-[10px] text-[#6b7a90] block mb-1">Client Email <span className="text-amber-400">*</span></label>
                  <input type="email" placeholder="client@example.com" maxLength={100} value={clientInfo.email}
                    onChange={(e) => setClientInfo(prev => ({ ...prev, email: e.target.value.replace(/[<>";\*]/g, "").slice(0, 100) }))}
                    className={`w-full px-2 py-1.5 border rounded text-sm text-[#202b40] placeholder-[#94A3B8] focus:outline-none transition ${
                      clientInfo.email.length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientInfo.email)
                        ? "border-amber-500/60 focus:border-amber-400"
                        : clientInfo.email.length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientInfo.email)
                        ? "border-[#2563EB]/40 focus:border-[#2563EB]"
                        : "border-slate-300 focus:border-[#2563EB]"
                    }`}
                    style={{ background: "#d9dadb" }}
                  />
                  {clientInfo.email.length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientInfo.email) && (
                    <p className="text-xs text-amber-400 mt-1">Enter a valid email address</p>
                  )}
                </div>

                {/* Location + Project Type */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-[#6b7a90] block mb-1">Location</label>
                    <input type="text" placeholder="City, Country" maxLength={60} value={clientInfo.location}
                      onChange={(e) => setClientInfo(prev => ({ ...prev, location: e.target.value.replace(/[<>";\/\*]/g, "").slice(0, 60) }))}
                      className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm text-[#202b40] placeholder-[#94A3B8] focus:border-[#2563EB] focus:outline-none transition"
                      style={{ background: "#d9dadb" }}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-[#6b7a90] block mb-1">Project Type</label>
                    <select value={clientInfo.projectType}
                      onChange={(e) => setClientInfo(prev => ({ ...prev, projectType: e.target.value }))}
                      className="w-full px-2 py-1.5 border border-slate-300 rounded text-[#202b40] text-sm focus:border-[#2563EB] focus:outline-none transition"
                      style={{ background: "#d9dadb" }}
                    >
                      <option value="Home Theater">Home Theater</option>
                      <option value="Media Room">Media Room</option>
                      <option value="Private Cinema">Private Cinema</option>
                      <option value="Commercial">Commercial</option>
                    </select>
                  </div>
                </div>

                {/* Project Reference — auto format HT-YYYY-MM-DD-001 */}
                <div>
                  <label className="text-[10px] text-[#6b7a90] block mb-1">Project Reference</label>
                  <div className="flex gap-1">
                    <input type="text" placeholder="HT-YYYY-MM-DD-001" maxLength={40} value={clientInfo.projectRef}
                      onChange={(e) => setClientInfo(prev => ({ ...prev, projectRef: e.target.value.replace(/[<>";\/]/g, "").slice(0, 40) }))}
                      className="flex-1 min-w-0 px-2 py-1.5 border border-slate-300 rounded text-sm text-[#202b40] placeholder-[#94A3B8] focus:border-[#2563EB] focus:outline-none font-mono transition"
                      style={{ background: "#d9dadb" }}
                    />
                    <button title="Auto-generate reference"
                      onClick={() => {
                        const now = new Date()
                        const yyyy = now.getFullYear()
                        const mm   = String(now.getMonth() + 1).padStart(2, "0")
                        const dd   = String(now.getDate()).padStart(2, "0")
                        const seq  = String(Math.floor(Math.random() * 900) + 100)
                        setClientInfo(prev => ({
                          ...prev,
                          projectRef: `HT-${yyyy}-${mm}-${dd}-${seq}`,
                          projectDate: `${yyyy}-${mm}-${dd}`,
                        }))
                      }}
                      className="px-2 py-1.5 rounded text-xs font-medium transition shrink-0"
                      style={{ background: "#B8C4D6", color: "#202b40", border: "1px solid #8FA3BC" }}
                    >Auto</button>
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-[10px] text-[#6b7a90]">Notes</label>
                    <span className={`text-[10px] leading-relaxed ${500 - clientInfo.notes.length < 50 ? "text-amber-400" : "text-[#6b7a90]"}`}>
                      {500 - clientInfo.notes.length} remaining
                    </span>
                  </div>
                  <textarea
                    placeholder="Room access constraints, budget notes, installation preferences..."
                    maxLength={500} value={clientInfo.notes}
                    onChange={(e) => setClientInfo(prev => ({ ...prev, notes: e.target.value.replace(/[<>";\/\*]/g, "").slice(0, 500) }))}
                    className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm text-[#202b40] placeholder-[#94A3B8] focus:border-[#2563EB] focus:outline-none transition resize-none"
                    style={{ background: "#d9dadb" }} rows={3}
                  />
                </div>

              </div>

            </div>


            {/* ── STAGE 1 — ROOM SETUP (merged card) ── */}
            <div className="rounded-xl p-4" style={{ background: "#dfe1e3", border: "1.5px solid #8a9ab0" }}>
              <label className="text-[11px] font-bold text-[#202b40] uppercase tracking-widest block mb-4 pl-2 border-l-2 border-[#2563EB]">Room Setup</label>


              {/* ① Wall Construction */}
              <div className="mb-3">
                <label className="text-[11px] font-semibold text-[#2563EB] block mb-2">Wall Construction</label>
                <select value={wallConstruction} onChange={(e) => setWallConstruction(e.target.value as typeof wallConstruction)}
                  className="w-full px-3 py-2 border border-slate-300 rounded text-sm text-[#202b40] focus:border-[#2563EB] focus:outline-none transition"
                  style={{ background: "#d9dadb" }}
                >
                  <option value="drywall">Drywall / Plasterboard</option>
                  <option value="masonry">Concrete / Brick / Masonry</option>
                  <option value="timber">Timber / Wood Frame</option>
                </select>
              </div>

              {/* ② Floor Type */}
              <div className="mb-3">
                <label className="text-[11px] font-semibold text-[#2563EB] block mb-2">Floor Type</label>
                <select value={floorType} onChange={(e) => setFloorType(e.target.value as FloorType)}
                  className="w-full px-3 py-2 border border-slate-300 rounded text-sm text-[#202b40] focus:border-[#2563EB] focus:outline-none transition"
                  style={{ background: "#d9dadb" }}
                >
                  <option value="carpet">Carpet</option>
                  <option value="hardwood">Hardwood / Wooden Floor</option>
                  <option value="hard">Tile / Stone / Concrete</option>
                </select>
              </div>

              <div className="my-4" style={{ borderTop: "1px solid #b8bfc9" }} />

              {/* ③ Unit System */}
              <div className="flex gap-2 mb-3">
                {(["metric", "imperial"] as const).map(u => (
                  <button key={u} onClick={() => setUnitSystem(u)}
                    className="flex-1 py-2 text-xs rounded-lg font-medium transition"
                    style={unitSystem === u
                      ? { background: "#2563EB", color: "#ffffff" }
                      : { background: "#B8C4D6", border: "1px solid #8FA3BC", color: "#202b40" }}>
                    {u === "metric" ? "Metric" : "Imperial"}
                  </button>
                ))}
              </div>

              {/* ④ Measurement guidance note */}
              <p className="text-[10px] text-[#6b7a90] mb-3 leading-relaxed px-1">Measure internal dimensions from finished wall to finished wall at floor level.</p>

              {/* ⑤ Dimension inputs */}
              <div className="mb-4">
                <div className="space-y-3">
                  {[
                    { key: "length", label: "Length", hint: unitSystem === "metric" ? "3 – 24.4 m" : "10 – 80 ft" },
                    { key: "width",  label: "Width",  hint: unitSystem === "metric" ? "3 – 15.2 m" : "10 – 50 ft" },
                    { key: "height", label: "Height", hint: unitSystem === "metric" ? "2.4 – 6.1 m" : "8 – 20 ft"  },
                  ].map(({ key, label, hint }) => {
                    const mVal = metricDimensions[key as "length"|"width"|"height"]
                    const toFtIn = (m: number) => { const ti = Math.round(m * 39.3701); const ft = Math.floor(ti / 12); const ins = ti % 12; return `${ft}'${ins}"` }
                    const toM   = (m: number) => `${m.toFixed(2)} m`
                    const secondary = mVal > 0
                      ? (unitSystem === "metric" ? toFtIn(mVal) : toM(mVal))
                      : null
                    return (
                      <div key={key}>
                        <div className="flex justify-between items-center mb-1">
                          <label className="text-xs font-medium text-[#202b40]">{label}</label>
                          <div className="flex items-center gap-2">
                            {secondary && <span className="text-[10px] text-[#8a9ab0]">{secondary}</span>}
                            <span className="text-[10px] text-[#8a9ab0]">{hint}</span>
                          </div>
                        </div>
                        {unitSystem === "metric" ? (
                          <div className="relative">
                            <input type="number" step="0.1" min="0"
                              placeholder={key === "length" ? "e.g. 7.5" : key === "width" ? "e.g. 5.0" : "e.g. 3.0"}
                              value={metricDimensions[key as "length"|"width"|"height"] || ""}
                              onChange={(e) => { const r = e.target.value; updateMetricDimension(key as "length"|"width"|"height", r === "" ? 0 : parseFloat(r)) }}
                              onBlur={(e) => { updateMetricDimension(key as "length"|"width"|"height", e.target.value === "" ? 0 : parseFloat(e.target.value) || 0, true) }}
                              className={`w-full pl-3 pr-10 py-2.5 border rounded-lg text-[#202b40] text-sm transition focus:outline-none focus:border-[#2563EB] ${
                                mVal > 0 ? "border-[#2563EB]/40" : "border-slate-300"
                              }`}
                              style={{ background: "#d9dadb" }}
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-[#6b7a90]">m</span>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <div className="flex-1 relative">
                              <input type="number" step="1" min="0"
                                value={(imperialDimensions as Record<string, number>)[`${key}Feet`] || ""}
                                onChange={(e) => updateImperialDimension(key as "length"|"width"|"height", parseFloat(e.target.value)||0, (imperialDimensions as Record<string, number>)[`${key}Inches`])}
                                onBlur={(e) => updateImperialDimension(key as "length"|"width"|"height", parseFloat(e.target.value)||0, (imperialDimensions as Record<string, number>)[`${key}Inches`], true)}
                                className="w-full pl-3 pr-10 py-2.5 border border-slate-300 rounded-lg text-[#202b40] text-sm focus:border-[#2563EB] focus:outline-none"
                                style={{ background: "#d9dadb" }}
                              />
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-[#6b7a90]">ft</span>
                            </div>
                            <div className="w-20 relative">
                              <input type="number" step="1" min="0" max="11"
                                value={(imperialDimensions as Record<string, number>)[`${key}Inches`] || ""}
                                onChange={(e) => updateImperialDimension(key as "length"|"width"|"height", (imperialDimensions as Record<string, number>)[`${key}Feet`], parseFloat(e.target.value)||0)}
                                onBlur={(e) => updateImperialDimension(key as "length"|"width"|"height", (imperialDimensions as Record<string, number>)[`${key}Feet`], parseFloat(e.target.value)||0, true)}
                                className="w-full pl-3 pr-8 py-2.5 border border-slate-300 rounded-lg text-[#202b40] text-sm focus:border-[#2563EB] focus:outline-none"
                                style={{ background: "#d9dadb" }}
                              />
                              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-medium text-[#6b7a90]">in</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

                {/* Live room shape preview + volume */}
                {(() => {
                  // Derive which fields are missing for inline guidance
                  const l = metricDimensions.length
                  const w = metricDimensions.width
                  const h = metricDimensions.height
                  const missing = [
                    l === 0 && 'Length',
                    w === 0 && 'Width',
                    h === 0 && 'Height',
                  ].filter(Boolean) as string[]

                  if (!roomValidation.valid) {
                    return (
                      <div className="mt-4 rounded-lg px-3 py-2.5" style={{ background: "#d0d2d4", border: "1px solid #b8bfc9" }}>
                        <p className="text-[10px] text-[#8a9ab0]">
                          {missing.length > 0
                            ? `Enter ${missing.join(', ')} to see room preview`
                            : 'Dimensions out of range — check min/max limits above'}
                        </p>
                      </div>
                    )
                  }
                  return (
                  <div className="mt-4 rounded-lg p-3" style={{ background: "#d0d2d4", border: "1px solid #b8bfc9" }}>
                    <div className="flex items-center gap-3">
                      {/* SVG top-down room preview */}
                      <div className="shrink-0">
                        {(() => {
                          const svgW = 90, svgH = 68
                          const maxD = Math.max(clampedRoom.length, clampedRoom.width, 0.01)
                          const rW = (clampedRoom.width  / maxD) * (svgW - 20)
                          const rH = (clampedRoom.length / maxD) * (svgH - 20)
                          const x  = (svgW - rW) / 2
                          const y  = (svgH - rH) / 2 + 2
                          const fmtDim = (m: number) => unitSystem === "imperial" ? `${Math.floor(m*3.28084)}'${Math.round((m*3.28084%1)*12)}"` : `${m.toFixed(1)}m`
                          return (
                            <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`} xmlns="http://www.w3.org/2000/svg">
                              <rect x={x} y={y} width={rW} height={rH}
                                fill="rgba(37,99,235,0.08)" stroke="#2563EB" strokeWidth="1.2" rx="2"/>
                              {/* Screen wall — front wall highlighted */}
                              <line x1={x} y1={y} x2={x+rW} y2={y}
                                stroke="#2563EB" strokeWidth="2.5" strokeLinecap="round"/>
                              {/* Screen wall label */}
                              <text x={x + rW / 2} y={y + 7} textAnchor="middle" fontSize="5" fill="#2563EB" fontWeight="600">SCREEN</text>
                              {/* Width label — top */}
                              <text x={svgW/2} y={y - 3} textAnchor="middle" fontSize="6" fill="#6b7a90" fontWeight="500">{fmtDim(clampedRoom.width)}</text>
                              {/* Length label — left side */}
                              <text x={x - 4} y={y + rH/2} textAnchor="middle" fontSize="6" fill="#6b7a90" fontWeight="500" transform={`rotate(-90,${x-4},${y + rH/2})`}>{fmtDim(clampedRoom.length)}</text>
                              {/* Height label — bottom right */}
                              <text x={x + rW + 2} y={y + rH + 4} textAnchor="start" fontSize="5" fill="#8a9ab0">H: {fmtDim(clampedRoom.height)}</text>
                            </svg>
                          )
                        })()}
                      </div>
                      {/* Volume + ratio */}
                      <div className="flex-1 space-y-1.5">
                        <div>
                          <p className="text-[10px] text-[#6b7a90]">Volume</p>
                          <p className="text-sm font-semibold text-[#202b40]">
                            {unitSystem === "imperial"
                              ? `${(roomVolume * 35.3147).toFixed(0)} ft³`
                              : `${roomVolume.toFixed(1)} m³`}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] text-[#6b7a90]">Ratio quality</p>
                          <p className={`text-xs font-semibold ${
                            roomRatio?.status === "good" ? "text-emerald-500"
                            : roomRatio?.status === "caution" ? "text-amber-500"
                            : roomRatio?.status === "acceptable" ? "text-[#60A5FA]"
                            : "text-red-400"
                          }`}>{roomRatio?.label ?? ''}</p>
                          {roomRatio && (
                            <p className="text-[9px] text-[#8a9ab0] mt-0.5 font-mono">
                              L/H {roomRatio.lh.toFixed(2)} · W/H {roomRatio.wh.toFixed(2)} · L/W {roomRatio.lw.toFixed(2)}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  )
                })()}


            </div>


              {/* ── ACOUSTIC TREATMENT — unlocks after room Apply ── */}
              {unlockedLevel >= 3 && (
              <div style={{ animation: 'sectionSlideIn 0.35s ease-out' }}>
              <div className={`rounded-xl p-4 transition-opacity ${!isRoomValid ? "opacity-40 pointer-events-none select-none" : ""}`} style={{ background: "#dfe1e3", border: "1.5px solid #8a9ab0" }}>
                <div className="flex items-center justify-between mb-4">
                  <label className="text-[11px] font-bold text-[#202b40] uppercase tracking-widest pl-2 border-l-2 border-[#2563EB]">Acoustic Treatment</label>
                  <button
                    onClick={() => {
                      const vol  = roomVolume
                      const h    = clampedRoom.height
                      const w    = clampedRoom.width
                      const l    = clampedRoom.length
                      const rat  = roomRatio?.status ?? 'caution'
                      const mc   = WALL_MATERIAL_COEFF[wallConstruction] ?? WALL_MATERIAL_COEFF.drywall

                      // ── Step 1: Base level from room volume ──────────────────────────
                      const LEVELS: TreatmentLevel[] = ['basic','medium','high']
                      const baseLevel: TreatmentLevel =
                        vol < 35 ? 'basic'
                        : vol < 80 ? 'medium'
                        : 'high'

                      // ── Step 2: Wall material modifier ──────────────────────────────
                      const wallModifier =
                        mc.wall <= 0.03 ? +1   // concrete / brick — very hard, needs more
                        : mc.wall >= 0.08 ? -1  // timber — naturally absorptive, can reduce
                        : 0                     // drywall / mixed — baseline, no change

                      const baseIdx     = LEVELS.indexOf(baseLevel)
                      const adjustedIdx = Math.max(0, Math.min(2, baseIdx + wallModifier))
                      const autoLevel   = LEVELS[adjustedIdx] as TreatmentLevel

                      // ── Step 3: Depth scale — volume + wall hardness ─────────────────
                      const volScale  = Math.min(1.2, Math.max(0.8, vol / 70))
                      const wallScale = mc.wall <= 0.03 ? 1.20 : mc.wall >= 0.08 ? 0.85 : 1.0
                      const sf = volScale * wallScale

                      // Scale module-level DEPTH_DEFAULTS by room/wall factor, clamped to DEPTH_MAX
                      const DEPTH: Record<string, { front: number; rear: number; left: number; right: number; ceiling: number }> = Object.fromEntries(
                        Object.entries(DEPTH_DEFAULTS).map(([lvl, d]) => [
                          lvl,
                          Object.fromEntries(Object.entries(d).map(([k, v]) => [
                            k, Math.min(DEPTH_MAX[k] ?? 0.6096, v * sf)
                          ])) as typeof d,
                        ])
                      ) as typeof DEPTH_DEFAULTS

                      // ── Step 4: Design intent ────────────────────────────────────────
                      type DI = 'performance'|'balanced'|'luxury'
                      const autoIntent: DI =
                        rat === 'caution' || vol < 40 ? 'performance'
                        : h >= 3.5 && vol > 100        ? 'luxury'   // very large, tall rooms → luxury
                        : h >= 3.0 && vol > 60         ? 'balanced'
                        : 'balanced'

                      const target = RT60_TARGETS[autoIntent]

                      // ── Step 5: RT60 feedback loop — iteratively adjust depths ───────
                      // Uses shared computeAbsorptionCoeffs + computeEyringRT60 functions.
                      // Runs up to 8 iterations, scaling all depths by a correction factor
                      // until RT60 lands inside the target range (or convergence stalls).
                      // Auto engine uses tighter max depths than manual sliders to keep
                      // recommendations conservative (user can always push further manually).
                      const MAX_D = { front: 0.2540, rear: 0.2032, left: 0.1778, right: 0.1778, ceiling: 0.3048 }
                      const computeInlineRT60 = (depths: typeof DEPTH.none) => {
                        const abs = computeAbsorptionCoeffs(autoLevel, autoIntent, wallConstruction, depths, w, h, l, floorType)
                        return computeEyringRT60(abs, w, h, l)
                      }

                      let d = { ...DEPTH[autoLevel] }
                      const targetMid = (target.min + target.max) / 2
                      let prevRT60 = Infinity
                      for (let i = 0; i < 8; i++) {
                        const rt60 = computeInlineRT60(d)
                        if (rt60 >= target.min && rt60 <= target.max) break // in range
                        // Early exit: if converged within 0.01s of previous iteration, stop
                        if (Math.abs(rt60 - prevRT60) < 0.01) break
                        prevRT60 = rt60
                        // Scale factor: if RT60 is too low (over-treated), reduce depths
                        // if RT60 is too high (under-treated), increase depths
                        // Use sqrt for gentle convergence to avoid oscillation
                        const ratio = rt60 / targetMid
                        const correction = ratio < 1
                          ? 1 + (1 - ratio) * 0.4  // under-target → increase depths gently
                          : 1 - (ratio - 1) * 0.4  // over-target → decrease depths gently
                        const clampedCorrection = Math.max(0.5, Math.min(1.5, correction))
                        d = {
                          front:   Math.min(MAX_D.front,   Math.max(0, d.front   * clampedCorrection)),
                          rear:    Math.min(MAX_D.rear,    Math.max(0, d.rear    * clampedCorrection)),
                          left:    Math.min(MAX_D.left,    Math.max(0, d.left    * clampedCorrection)),
                          right:   Math.min(MAX_D.right,   Math.max(0, d.right   * clampedCorrection)),
                          ceiling: Math.min(MAX_D.ceiling,  Math.max(0, d.ceiling * clampedCorrection)),
                        }
                      }

                      setTreatmentLevel(autoLevel)
                      setDesignIntent(autoIntent)
                      setSideLinked(true)
                      setAcousticDepthMeters({ front: d.front, rear: d.rear, left: d.left, right: d.right, ceiling: d.ceiling })
                    }}
                    className="text-[10px] px-2 py-0.5 rounded font-medium transition"
                    style={{ background: "#d9dadb", border: "1px solid #2563EB", color: "#2563EB" }}
                    title="Auto-recommend treatment level, design intent and depths from room"
                  >Auto</button>
                </div>

                <div className="mb-4">
                  <label className="text-[11px] font-semibold text-[#2563EB] block mb-2">Treatment Level</label>
                  <select value={treatmentLevel} onChange={(e) => setTreatmentLevel(e.target.value as TreatmentLevel)}
                    className="w-full px-3 py-2 border border-slate-300 rounded text-sm text-[#202b40] focus:border-[#2563EB] focus:outline-none transition"
                    style={{ background: "#d9dadb" }}>
                    <option value="basic">Basic — Entry level control</option>
                    <option value="medium">Medium — Reference home theater</option>
                    <option value="high">High — Studio / Cinema grade</option>
                  </select>
                </div>

                <div className="mb-3">
                  <label className="text-[11px] font-semibold text-[#2563EB] block mb-2">Design Intent</label>
                  <select value={designIntent} onChange={(e) => setDesignIntent(e.target.value as DesignIntent)}
                    className="w-full px-3 py-2 border border-slate-300 rounded text-sm text-[#202b40] focus:border-[#2563EB] focus:outline-none transition"
                    style={{ background: "#d9dadb" }}>
                    <option value="performance">Performance — Accuracy &amp; control</option>
                    <option value="balanced">Balanced — Performance + aesthetics</option>
                    <option value="luxury">Luxury — Visual &amp; experiential focus</option>
                  </select>
                </div>
                {/* Depth Controls */}
                {(() => {
                  const MAX    = DEPTH_MAX
                  const STEP   = unitSystem === "imperial" ? 0.0127 : 0.01
                  const toDisp = (m: number) => unitSystem === "imperial" ? Math.round(m * 39.3701) : Math.round(m * 100)
                  const unit   = unitSystem === "imperial" ? '"' : "cm"

                  const mcLive    = WALL_MATERIAL_COEFF[wallConstruction] ?? WALL_MATERIAL_COEFF.drywall
                  const wallScale = mcLive.wall <= 0.03 ? 1.20 : mcLive.wall >= 0.08 ? 0.85 : 1.0
                  const rawDef    = DEPTH_DEFAULTS[treatmentLevel] ?? DEPTH_DEFAULTS.basic
                  const levelDef  = Object.fromEntries(
                    Object.entries(rawDef).map(([k, v]) => [k, v * wallScale])
                  )

                  const liveLength = unitSystem === "metric"
                    ? metricDimensions.length
                    : feetInchesToMeters(imperialDimensions.lengthFeet, imperialDimensions.lengthInches)
                  const liveWidth  = unitSystem === "metric"
                    ? metricDimensions.width
                    : feetInchesToMeters(imperialDimensions.widthFeet, imperialDimensions.widthInches)
                  const tooDeepLength = acousticDepthMeters.front + acousticDepthMeters.rear >= liveLength - 0.5
                  const tooDeepWidth  = acousticDepthMeters.left  + acousticDepthMeters.right >= liveWidth  - 0.5

                  // Slider accent color driven by live RT60 status — gives instant feedback
                  const rt60AccentOk   = "#2563EB"  // blue = in range
                  const rt60AccentOver = "#ef4444"  // red = over-treated
                  const rt60AccentLive = "#f59e0b"  // amber = under-treated

                  // Inline row renderer — NOT a React component (avoids remount on every render)
                  type DepthKey = "front" | "rear" | "left" | "right" | "ceiling"
                  const renderRow = (label: string, k: DepthKey, disabled = false) => {
                    const val     = toDisp(acousticDepthMeters[k])
                    const maxM    = MAX[k]
                    const depthV  = acousticDepthMeters[k]
                    const minM    = levelDef[k] ?? 0
                    const minPct  = Math.min(100, (minM / maxM) * 100)
                    const atMin   = depthV < minM - 0.001
                    // Color slider by RT60 status: red if over-treated, amber if under, blue if optimal
                    const barCol  = disabled ? "#b8bfc9"
                      : depthV === 0 ? "#8a9ab0"
                      : atMin ? "#f59e0b"
                      : liveRT60Status === 'overdamped' ? rt60AccentOver
                      : liveRT60Status === 'tooLive' ? rt60AccentLive
                      : rt60AccentOk
                    return (
                      <div key={k} className={`py-1 ${disabled ? "opacity-40" : ""}`}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-[#202b40]">{label}</span>
                            {disabled && <span className="text-[9px] text-[#8a9ab0]">no effect at Basic</span>}
                            {!disabled && atMin && <span className="text-[8px] text-[#f59e0b]">below minimum</span>}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button disabled={disabled}
                              onClick={() => updateDepth(k, Math.max(0, depthV - STEP))}
                              className="w-5 h-5 rounded text-xs font-bold flex items-center justify-center transition disabled:cursor-not-allowed"
                              style={{ background: "#B8C4D6", color: "#202b40", border: "1px solid #8FA3BC" }}>−</button>
                            <span className="text-xs font-mono text-[#202b40] w-10 text-right">{val}{unit}</span>
                            <button disabled={disabled}
                              onClick={() => updateDepth(k, Math.min(maxM, depthV + STEP))}
                              className="w-5 h-5 rounded text-xs font-bold flex items-center justify-center disabled:cursor-not-allowed"
                              style={{ background: "#2563EB", color: "#ffffff" }}>+</button>
                          </div>
                        </div>
                        <div className="relative mb-1">
                          <input
                            type="range" min={0} max={maxM} step={STEP}
                            value={depthV}
                            disabled={disabled}
                            onChange={(e) => updateDepth(k, parseFloat(e.target.value))}
                            className="w-full cursor-pointer disabled:cursor-not-allowed"
                            style={{ accentColor: barCol }}
                          />
                          {/* Level minimum marker */}
                          {!disabled && minM > 0 && (
                            <div className="absolute w-0.5 h-3 rounded-full pointer-events-none"
                              style={{ left: `${minPct}%`, top: '50%', transform: 'translateY(-50%)', background: "#60A5FA", opacity: 0.7 }} />
                          )}
                        </div>
                      </div>
                    )
                  }

                  return (
                    <div className="space-y-0.5">
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-[11px] font-semibold text-[#2563EB]">Panel Depth</label>
                        {(tooDeepLength || tooDeepWidth) && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                            style={{ background: "rgba(239,68,68,0.10)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.28)" }}>
                            ⚠ Depth conflict
                          </span>
                        )}
                      </div>
                      <>
                        {renderRow("Front Wall", "front")}
                        {renderRow("Rear Wall",  "rear")}
                        <div className="flex items-center justify-between mt-1 mb-0.5">
                          <span className="text-xs text-[#202b40]">Side Walls</span>
                          <button
                            onClick={() => setSideLinked(v => !v)}
                            className="text-[9px] px-1.5 py-0.5 rounded font-medium transition"
                            style={{ background: sideLinked ? "rgba(37,99,235,0.10)" : "#d0d2d4", color: sideLinked ? "#2563EB" : "#8a9ab0", border: `1px solid ${sideLinked ? "rgba(37,99,235,0.3)" : "#8a9ab0"}` }}
                          >{sideLinked ? "⇔ Linked" : "Unlinked"}</button>
                        </div>
                        {renderRow("Left Wall",  "left")}
                        {!sideLinked && renderRow("Right Wall", "right")}
                        {renderRow("Ceiling", "ceiling", treatmentLevel === "basic")}
                      </>

                      {/* ── Live RT60 Preview ── */}
                      {liveRT60 !== null && (
                        <div className="mt-2 px-2 py-1.5 rounded flex items-center justify-between"
                          style={{
                            background: liveRT60Status === 'optimal' ? 'rgba(37,99,235,0.06)'
                              : liveRT60Status === 'overdamped' ? 'rgba(239,68,68,0.06)'
                              : 'rgba(245,158,11,0.06)',
                            border: `1px solid ${
                              liveRT60Status === 'optimal' ? 'rgba(37,99,235,0.18)'
                              : liveRT60Status === 'overdamped' ? 'rgba(239,68,68,0.18)'
                              : 'rgba(245,158,11,0.18)'
                            }`
                          }}>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] uppercase tracking-wide font-semibold"
                              style={{ color: liveRT60Status === 'optimal' ? '#2563EB' : liveRT60Status === 'overdamped' ? '#ef4444' : '#f59e0b' }}>
                              RT60 Preview
                            </span>
                            <span className="text-[10px] font-mono font-bold"
                              style={{ color: liveRT60Status === 'optimal' ? '#60A5FA' : liveRT60Status === 'overdamped' ? '#ef4444' : '#f59e0b' }}>
                              {liveRT60.toFixed(2)}s
                            </span>
                          </div>
                          <span className="text-[9px]"
                            style={{ color: liveRT60Status === 'optimal' ? '#60A5FA' : liveRT60Status === 'overdamped' ? '#ef4444' : '#f59e0b' }}>
                            {liveRT60Status === 'optimal' ? '✓ On target' : liveRT60Status === 'overdamped' ? '⚠ Over-treated' : '⚠ Under-treated'}
                            <span className="text-[#8a9ab0] ml-1">({liveRT60Target.min}–{liveRT60Target.max}s)</span>
                          </span>
                        </div>
                      )}
                    </div>
                  )
                })()}


                {/* ── Treatment Map (floor-plan only) ── */}
                {roomValidation.valid && (() => {
                  const isBasic    = treatmentLevel === 'basic'
                  const isStandard = treatmentLevel === 'medium'
                  const isStudio   = treatmentLevel === 'high'

                  // ── Live room dimensions (same approach as depth conflict) ──────────
                  const liveL = unitSystem === "metric"
                    ? metricDimensions.length
                    : feetInchesToMeters(imperialDimensions.lengthFeet, imperialDimensions.lengthInches)
                  const liveW = unitSystem === "metric"
                    ? metricDimensions.width
                    : feetInchesToMeters(imperialDimensions.widthFeet, imperialDimensions.widthInches)
                  const safeL = Math.max(liveL, 0.01)
                  const safeW = Math.max(liveW, 0.01)

                  // ── SVG layout — matches Room Setup proportions exactly ────────────
                  const PAD   = 20
                  const SVG_W = 220
                  const maxD  = Math.max(safeL, safeW)
                  const rW    = (safeW / maxD) * (SVG_W - PAD * 2)
                  const rH    = (safeL / maxD) * (SVG_W - PAD * 2) * 0.7
                  const SVG_H = Math.round(rH + PAD * 2 + 12) // +12 for REAR label
                  const rX    = (SVG_W - rW) / 2
                  const rY    = PAD

                  // ── Panel thicknesses — true to scale: 1 SVG px = 1 real metre ──────
                  // No multiplier — panels occupy the same % of SVG as they do of real room
                  const pxPerM = (SVG_W - PAD * 2) / maxD
                  const fThk = Math.max(2, acousticDepthMeters.front   * pxPerM)
                  const rThk = Math.max(2, acousticDepthMeters.rear    * pxPerM)
                  const sThk = Math.max(2, acousticDepthMeters.left    * pxPerM)
                  const cThk = isBasic ? 0 : Math.max(0, acousticDepthMeters.ceiling * pxPerM)

                  // ── Acoustic geometry — FRP from panelLayout for accuracy ─────────
                  // frpLeftZ is the Z distance from screen wall to first reflection point
                  // Map it to SVG Y: rY + (frpZ / safeL) * rH
                  const frpZ     = panelLayout.diagnostics.frpLeftZ > 0
                    ? panelLayout.diagnostics.frpLeftZ
                    : seatingCalcs.frontClearance * 0.6   // fallback if not yet computed
                  const refZ     = rY + (frpZ / safeL) * rH
                  const refH     = Math.max(6, (rH - fThk - rThk) * 0.18)
                  const listenerY = rY + (panelLayout.diagnostics.listenerZ > 0
                    ? (panelLayout.diagnostics.listenerZ / safeL) * rH
                    : fThk + (rH - fThk - rThk) * 0.56)

                  // ── Colours — exact app palette ───────────────────────────────────
                  const absorberFill = '#8a9ab0'
                  const ceilingFill  = '#818CF8'   // matches frosted cloud fill
                  const reflFill     = '#2563EB'
                  const trapFill     = '#202b40'

                  // ── Dimension label in header ─────────────────────────────────────
                  const dimLabel = unitSystem === "imperial"
                    ? `${(liveL * 3.28084).toFixed(1)} × ${(liveW * 3.28084).toFixed(1)} ft`
                    : `${liveL.toFixed(1)} × ${liveW.toFixed(1)} m`

                  return (
                    <div className="mt-3 rounded-lg overflow-hidden" style={{ border: '1px solid #b8bfc9' }}>
                      <div className="px-3 py-2.5" style={{ background: '#d0d2d4' }}>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-[10px] font-semibold text-[#202b40] uppercase tracking-widest">Treatment Map</p>
                          <span className="text-[9px] text-[#8a9ab0] font-mono">{dimLabel}</span>
                        </div>

                        {/* Map left, details right */}
                        <div className="flex gap-3 items-start">

                        {/* LEFT — SVG floor plan */}
                        <div className="shrink-0" style={{ width: "52%" }}>
                        <svg width="100%" height={SVG_H} viewBox={`0 0 ${SVG_W} ${SVG_H}`} xmlns="http://www.w3.org/2000/svg">

                          {/* ── Room outline — same style as Room Setup ── */}
                          <rect x={rX} y={rY} width={rW} height={rH}
                            fill="rgba(37,99,235,0.06)" stroke="#2563EB" strokeWidth="1.2" rx="2"/>

                          {/* ── Screen wall — thick blue line matching Room Setup ── */}
                          <line x1={rX} y1={rY} x2={rX+rW} y2={rY}
                            stroke="#2563EB" strokeWidth="3" strokeLinecap="round"/>

                          {/* ── Front wall absorber ── */}
                          <rect x={rX+1} y={rY+1} width={rW-2} height={fThk-1}
                            fill={absorberFill} opacity="0.75" rx="1"/>
                          {/* Screen indicator line inside front panel */}
                          <line x1={rX+rW*0.22} y1={rY+fThk*0.55} x2={rX+rW*0.78} y2={rY+fThk*0.55}
                            stroke="#202b40" strokeWidth="1.5" strokeLinecap="round" opacity="0.5"/>

                          {/* ── Rear wall absorber ── */}
                          <rect x={rX+1} y={rY+rH-rThk} width={rW-2} height={rThk-1}
                            fill={absorberFill} opacity="0.75" rx="1"/>
                          {/* Rear diffuser hash — Standard/Studio */}
                          {(isStandard||isStudio) && Array.from({length:10}).map((_,i)=>(
                            <line key={i}
                              x1={rX+2+i*(rW/10)} y1={rY+rH-rThk+1}
                              x2={rX+2+i*(rW/10)+rThk*0.8} y2={rY+rH-2}
                              stroke="#202b40" strokeWidth="0.6" opacity="0.4"/>
                          ))}

                          {/* ── Side wall absorbers ── */}
                          <rect x={rX+1} y={rY+1} width={sThk-1} height={rH-2}
                            fill={absorberFill} opacity="0.75" rx="1"/>
                          <rect x={rX+rW-sThk} y={rY+1} width={sThk-1} height={rH-2}
                            fill={absorberFill} opacity="0.75" rx="1"/>

                          {/* ── Ceiling cloud — Standard/Studio: frosted panel floating above room ── */}
                          {(isStandard||isStudio) && cThk > 0 && (
                            <>
                              {/* Solid frosted fill — like a suspended ceiling cloud */}
                              <rect x={rX+sThk+2} y={rY+fThk+1} width={rW-sThk*2-4} height={Math.max(3, cThk)}
                                fill="#818CF8" opacity="0.22" rx="1"/>
                              {/* Visible border to define the cloud edge */}
                              <rect x={rX+sThk+2} y={rY+fThk+1} width={rW-sThk*2-4} height={Math.max(3, cThk)}
                                fill="none" stroke="#818CF8" strokeWidth="1" opacity="0.7" rx="1"/>
                            </>
                          )}

                          {/* ── Reflectors — flush with absorber surface, facing inward ──
                               In real life: MDF/wood panel mounted ON the absorber face
                               at the first reflection point. In plan view: thin strip
                               right at the inner edge of the side wall absorber.        */}
                          {(isStandard||isStudio) && (
                            <>
                              {/* Left reflector — on face of left absorber */}
                              <rect
                                x={rX+sThk-1} y={refZ}
                                width={4} height={refH}
                                fill={reflFill} opacity="0.95" rx="0.5"/>
                              {/* Right reflector — on face of right absorber */}
                              <rect
                                x={rX+rW-sThk-3} y={refZ}
                                width={4} height={refH}
                                fill={reflFill} opacity="0.95" rx="0.5"/>
                            </>
                          )}

                          {/* ── Bass traps — Studio: corner panels spanning both walls ──
                               Real life: thick broadband absorber fills the 90° corner,
                               covering the junction of side + front/rear wall.
                               Triangle legs = side depth + front/rear depth so the trap
                               visually "owns" the full corner area.                      */}
                          {isStudio && (() => {
                            const tx = sThk + fThk + 4  // front-left / front-right corners
                            const tb = sThk + rThk + 4  // rear-left / rear-rear corners
                            return [
                              // front-left
                              { tx: rX,      ty: rY,      pts: `0,0 ${tx},0 0,${tx}` },
                              // front-right
                              { tx: rX+rW,   ty: rY,      pts: `0,0 -${tx},0 0,${tx}` },
                              // rear-left
                              { tx: rX,      ty: rY+rH,   pts: `0,0 ${tb},0 0,-${tb}` },
                              // rear-right
                              { tx: rX+rW,   ty: rY+rH,   pts: `0,0 -${tb},0 0,-${tb}` },
                            ].map((c,i) => (
                              <g key={i} transform={`translate(${c.tx},${c.ty})`}>
                                <polygon points={c.pts} fill={trapFill} opacity="0.85"/>
                              </g>
                            ))
                          })()}

                          {/* ── Listener position dot ── */}
                          <circle cx={rX+rW/2} cy={listenerY} r="3"
                            fill="none" stroke="#202b40" strokeWidth="1.2"/>
                          <circle cx={rX+rW/2} cy={listenerY} r="1.1"
                            fill="#202b40"/>

                          {/* ── Dimension labels outside — matching Room Setup ── */}
                          <text x={rX+rW/2} y={rY-5} textAnchor="middle" fontSize="7" fill="#6b7a90">W</text>
                          <text x={rX-6} y={rY+rH/2} textAnchor="middle" fontSize="7" fill="#6b7a90"
                            transform={`rotate(-90,${rX-6},${rY+rH/2})`}>L</text>
                          <text x={rX+rW/2} y={rY+6} textAnchor="middle" fontSize="5" fill="#2563EB" fontWeight="600" letterSpacing="0.8">SCREEN</text>
                          <text x={rX+rW/2} y={rY+rH+10} textAnchor="middle" fontSize="5.5" fill="#8a9ab0" letterSpacing="1">REAR</text>

                        </svg>
                        </div>{/* end left SVG */}

                        {/* RIGHT — legend + details */}
                        <div className="flex-1 flex flex-col gap-2 pt-0.5">

                          {/* Legend */}
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1">
                              <div className="w-2 h-2 rounded-sm shrink-0" style={{ background: absorberFill }}/>
                              <span className="text-[9px] text-[#6b7a90]">Absorber</span>
                            </div>
                            {(isStandard||isStudio) && (
                              <div className="flex items-center gap-1">
                                <div className="w-2 h-2 rounded-sm shrink-0" style={{ background: reflFill }}/>
                                <span className="text-[9px] text-[#6b7a90]">Reflector</span>
                              </div>
                            )}
                            {(isStandard||isStudio) && cThk > 0 && (
                              <div className="flex items-center gap-1">
                                <div className="w-2 h-2 rounded-sm shrink-0" style={{ background: ceilingFill }}/>
                                <span className="text-[9px] text-[#6b7a90]">Ceiling cloud</span>
                              </div>
                            )}
                            {isStudio && (
                              <div className="flex items-center gap-1">
                                <div className="w-2 h-2 rounded-sm shrink-0" style={{ background: trapFill }}/>
                                <span className="text-[9px] text-[#6b7a90]">Bass trap</span>
                              </div>
                            )}
                            {(isStandard||isStudio) && (
                              <span className="text-[9px] text-[#6b7a90]">⟊ hash = diffuser</span>
                            )}
                          </div>

                          {/* Depth summary */}
                          <div className="pt-1.5" style={{ borderTop: '1px solid #b8bfc9' }}>
                            {[
                              { label: 'Front', v: acousticDepthMeters.front },
                              { label: 'Rear',  v: acousticDepthMeters.rear  },
                              { label: 'Side',  v: acousticDepthMeters.left  },
                              ...(acousticDepthMeters.ceiling > 0 ? [{ label: 'Ceil', v: acousticDepthMeters.ceiling }] : []),
                            ].map(({ label, v }) => (
                              <div key={label} className="flex justify-between text-[9px] mb-0.5">
                                <span className="text-[#8a9ab0]">{label}</span>
                                <span className="font-mono text-[#202b40]">
                                  {unitSystem === 'imperial' ? `${Math.round(v * 39.3701)}"` : `${Math.round(v * 100)}cm`}
                                </span>
                              </div>
                            ))}
                          </div>

                          {/* FRP position */}
                          {panelLayout.diagnostics.frpLeftZ > 0 && (
                            <div className="pt-1.5" style={{ borderTop: '1px solid #b8bfc9' }}>
                              <p className="text-[9px] text-[#8a9ab0] mb-0.5">FRP from screen</p>
                              <p className="text-[9px] font-mono text-[#202b40]">
                                {unitSystem === 'imperial'
                                  ? `${(panelLayout.diagnostics.frpLeftZ * 3.28084).toFixed(1)} ft`
                                  : `${panelLayout.diagnostics.frpLeftZ.toFixed(2)} m`}
                              </p>
                            </div>
                          )}

                        </div>{/* end right details */}
                        </div>{/* end flex row */}
                      </div>
                    </div>
                  )
                })()}

              </div>
              </div>
              )}

              {/* ── SEATING — unlocks after acoustic Apply ── */}
              {unlockedLevel >= 4 && (
              <div style={{ animation: 'sectionSlideIn 0.35s ease-out' }}>
              <div className={`rounded-xl p-4 transition-opacity ${(!isRoomValid || !geometryValid) ? "opacity-40 pointer-events-none select-none" : ""}`} style={{ background: "#dfe1e3", border: "1.5px solid #8a9ab0" }}>
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-[11px] font-bold text-[#202b40] uppercase tracking-widest pl-2 border-l-2 border-[#2563EB]">Seating</label>
                    <button
                      onClick={() => {
                        setSeatType("standard")
                        setSeatWidthOverrideIn(null)
                        setSeatDepthOverrideIn(null)
                        setRiserDepthOverrideIn(null)
                        setRiserOverrideMm(null)
                        setRowCount(seatingCalcs.optimalRows)
                        setSeatsPerRow(seatingCalcs.optimalSeats)
                        setAisleConfig("none")
                      }}
                      className="text-[10px] px-2 py-0.5 rounded font-medium transition"
                      style={{ background: "#d9dadb", border: "1px solid #2563EB", color: "#2563EB" }}
                      title={`Auto: ${seatingCalcs.optimalRows} rows × ${seatingCalcs.optimalSeats} seats`}
                    >Auto</button>
                  </div>

                  {(() => {
                    // Stepper helper — clamps value within min/max, returns new value
                    const stepVal = (current: number, delta: number, min: number, max: number) =>
                      Math.max(min, Math.min(max, current + delta))

                    // Dimension ranges per seat type
                    const dimRanges = seatType === "standard"
                      ? { wMin: 19, wMax: 29, dMin: 21, dMax: 31, rMin: 42, rMax: 54 }  // ±5" on seat, ±6" on riser
                      : { wMin: 31, wMax: 41, dMin: 64, dMax: 74, rMin: 72, rMax: 84 }   // ±5" on seat, +12" on riser (can't go below 72")

                    const seatBase = seatType === "standard"
                      ? { widthIn: 24, depthIn: 26, riserDepthIn: 48 }
                      : { widthIn: 36, depthIn: 69, riserDepthIn: 72 }

                    const currentSeatWidthIn = seatWidthOverrideIn ?? seatBase.widthIn
                    const currentSeatDepthIn = seatDepthOverrideIn ?? seatBase.depthIn
                    const currentRiserDepthIn = riserDepthOverrideIn ?? seatBase.riserDepthIn

                    // Riser height range: 4"–12", default 6"
                    const autoRH = 6
                    const rhMin = 4
                    const rhMax = 12
                    const currentRH = riserOverrideMm !== null ? Math.round(riserOverrideMm / 25.4) : autoRH

                    return (
                      <div className="space-y-3">

                        {/* ── Seat Type ── */}
                        <div>
                          <label className="text-[11px] font-semibold text-[#2563EB] block mb-2">Seat Type</label>
                          <div className="flex rounded overflow-hidden" style={{ border: "1px solid #8a9ab0" }}>
                            {([
                              { key: "standard", label: "Theater" },
                              { key: "luxury",   label: "Recliner" },
                            ] as const).map(({ key, label }, i) => (
                              <button key={key} onClick={() => setSeatType(key)}
                                className="flex-1 py-1.5 text-xs transition-all"
                                style={{
                                  background: seatType === key ? "#202b40" : "#d9dadb",
                                  color:      seatType === key ? "#ffffff"  : "#202b40",
                                  borderRight: i === 0 ? "1px solid #8a9ab0" : "none",
                                  fontWeight:  seatType === key ? 600 : 400,
                                }}
                              >{label}</button>
                            ))}
                          </div>
                          <p className="text-[10px] text-[#6b7a90] mt-1 leading-relaxed">
                            {seatType === "standard"
                              ? "Standard theater chair — fixed back, compact footprint"
                              : "Full recliner — power recline, wider arms, deeper riser required"}
                          </p>
                        </div>

                        {/* ── Seat Dimensions ── */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <label className="text-[11px] font-semibold text-[#2563EB]">Seat Dimensions</label>
                            {(seatWidthOverrideIn !== null || seatDepthOverrideIn !== null || riserDepthOverrideIn !== null || riserOverrideMm !== null) && (
                              <button onClick={() => {
                                setSeatWidthOverrideIn(null); setSeatDepthOverrideIn(null)
                                setRiserDepthOverrideIn(null); setRiserOverrideMm(null)
                              }}
                                className="text-[10px] underline" style={{ color: "#60A5FA" }}
                              >Reset</button>
                            )}
                          </div>
                          <div className="grid grid-cols-4 gap-1.5">
                            {([
                              { label: "Seat W",  value: currentSeatWidthIn,  min: dimRanges.wMin, max: dimRanges.wMax,
                                set: (v: number) => setSeatWidthOverrideIn(v === seatBase.widthIn ? null : v) },
                              { label: "Seat D",  value: currentSeatDepthIn,  min: dimRanges.dMin, max: dimRanges.dMax,
                                set: (v: number) => setSeatDepthOverrideIn(v === seatBase.depthIn ? null : v) },
                              { label: "Riser D", value: currentRiserDepthIn, min: dimRanges.rMin, max: dimRanges.rMax,
                                set: (v: number) => setRiserDepthOverrideIn(v === seatBase.riserDepthIn ? null : v) },
                              { label: "Riser H", value: currentRH,           min: rhMin,          max: rhMax,
                                set: (v: number) => setRiserOverrideMm(v === autoRH ? null : v * 25.4) },
                            ] as const).map(({ label, value, min, max, set }) => (
                              <div key={label} className="rounded px-1.5 py-2 flex flex-col items-center gap-1"
                                style={{ background: "#d9dadb", border: "1px solid #8a9ab0" }}>
                                <span className="text-[9px] font-semibold text-center leading-tight" style={{ color: "#202b40" }}>{label}</span>
                                <button onClick={() => set(stepVal(value, 1, min, max))} disabled={value >= max}
                                  className="w-full h-6 rounded font-bold transition-opacity disabled:opacity-40 flex items-center justify-center text-sm"
                                  style={{ background: "#8a9ab0", color: "#fff", border: "1px solid #8a9ab0" }}>+</button>
                                <div className="w-full h-6 flex items-center justify-center rounded font-mono font-bold"
                                  style={{ background: "#fff", border: "1px solid #8a9ab0", color: "#202b40", fontSize: 11 }}>{value}&quot;</div>
                                <button onClick={() => set(stepVal(value, -1, min, max))} disabled={value <= min}
                                  className="w-full h-6 rounded font-bold transition-opacity disabled:opacity-40 flex items-center justify-center text-sm"
                                  style={{ background: "#8a9ab0", color: "#fff", border: "1px solid #8a9ab0" }}>−</button>
                              </div>
                            ))}
                          </div>
                          <p className="text-[10px] text-[#6b7a90] mt-1 leading-relaxed">
                            Riser height default is 6&quot; — user-adjustable between 4&quot; and 12&quot;
                          </p>
                        </div>

                        {/* ── Aisle — 3-stop custom track ── */}
                        <div>
                          <label className="text-[11px] font-semibold text-[#2563EB] block mb-2">Aisle</label>

                          {/* Custom 3-stop track */}
                          {(() => {
                            const stops = [
                              { id: "left"   as const, label: "Left"   },
                              { id: "center" as const, label: "Center" },
                              { id: "right"  as const, label: "Right"  },
                            ]
                            const handleDot = (id: "left"|"center"|"right") => {
                              if (aisleConfig === "both") {
                                // deselect one side
                                setAisleConfig(id === "left" ? "right" : id === "right" ? "left" : "center")
                              } else if (aisleConfig === id) {
                                setAisleConfig("none")
                              } else {
                                setAisleConfig(id)
                              }
                            }
                            const isActive = (id: "left"|"center"|"right") =>
                              aisleConfig === id || (aisleConfig === "both" && (id === "left" || id === "right"))

                            return (
                              <div>
                                {/* Track with dots */}
                                <div className="relative flex items-center mb-1" style={{ height: 24 }}>
                                  {/* Track line */}
                                  <div className="absolute w-full rounded-full" style={{ height: 4, background: "#c0c8d4", top: 10 }}/>
                                  {/* Active fill segments */}
                                  {aisleConfig === "both" && (
                                    <>
                                      <div className="absolute rounded-full" style={{ height: 4, top: 10, left: 0, width: "16.67%", background: "#2563EB" }}/>
                                      <div className="absolute rounded-full" style={{ height: 4, top: 10, right: 0, width: "16.67%", background: "#2563EB" }}/>
                                    </>
                                  )}
                                  {aisleConfig === "left" && (
                                    <div className="absolute rounded-full" style={{ height: 4, top: 10, left: 0, width: "16.67%", background: "#2563EB" }}/>
                                  )}
                                  {aisleConfig === "right" && (
                                    <div className="absolute rounded-full" style={{ height: 4, top: 10, right: 0, width: "16.67%", background: "#2563EB" }}/>
                                  )}
                                  {aisleConfig === "center" && (
                                    <div className="absolute rounded-full" style={{ height: 4, top: 10, left: "calc(50% - 8%)", width: "16%", background: "#2563EB" }}/>
                                  )}
                                  {/* Dots at each stop */}
                                  {stops.map(({ id }, si) => {
                                    const active = isActive(id)
                                    const xPct = si === 0 ? "0%" : si === 1 ? "50%" : "100%"
                                    return (
                                      <button
                                        key={id}
                                        onClick={() => handleDot(id)}
                                        className="absolute flex items-center justify-center transition-all"
                                        style={{
                                          width: 16, height: 16,
                                          borderRadius: "50%",
                                          background: active ? "#2563EB" : "#d9dadb",
                                          border: `2px solid ${active ? "#2563EB" : "#8a9ab0"}`,
                                          top: 4,
                                          left: xPct,
                                          transform: "translateX(-50%)",
                                          boxShadow: active ? "0 0 0 3px rgba(37,99,235,0.18)" : "none",
                                        }}
                                      />
                                    )
                                  })}
                                </div>
                                {/* Labels */}
                                <div className="flex justify-between mb-2">
                                  {stops.map(({ id, label }) => (
                                    <span key={id} className="text-[10px] font-semibold"
                                      style={{ color: isActive(id) ? "#2563EB" : "#8a9ab0" }}>{label}</span>
                                  ))}
                                </div>

                                {/* Both L+R checkbox */}
                                {(aisleConfig === "left" || aisleConfig === "right" || aisleConfig === "both") && (
                                  <label className="flex items-center gap-2 cursor-pointer select-none mb-1">
                                    <input type="checkbox"
                                      checked={aisleConfig === "both"}
                                      onChange={() => setAisleConfig(aisleConfig === "both" ? "left" : "both")}
                                      className="accent-[#2563EB] w-3.5 h-3.5"
                                    />
                                    <span className="text-xs text-[#202b40]">Both Left &amp; Right</span>
                                  </label>
                                )}

                                {aisleConfig !== "none" && (
                                  <p className="text-[10px] text-[#6b7a90] mt-1 leading-relaxed">
                                    24&quot; base + {unitSystem === "imperial"
                                      ? `${Math.round((seatingCalcs.aisleActualW - 0.6096) * 39.3701)}&quot; extra`
                                      : `${Math.round((seatingCalcs.aisleActualW - 0.6096) * 100)} cm extra`} from leftover
                                    {aisleConfig === "both" && " (each side)"}{" "}— back row always full width
                                  </p>
                                )}
                              </div>
                            )
                          })()}
                        </div>

                        {/* ── Rows ── */}
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <label className="text-[11px] font-semibold text-[#2563EB]">Rows</label>
                            <span className="text-xs font-semibold" style={{ color: "#60A5FA" }}>
                              {seatingCalcs.rowCount} of {seatingCalcs.maxRows} max
                            </span>
                          </div>
                          <input type="range" min="1" max={Math.max(1, seatingCalcs.maxRows)} value={rowCount}
                            onChange={(e) => {
                              const n = parseInt(e.target.value)
                              setRowCount(n)
                              if (primaryRow >= n) setPrimaryRow(n - 1)
                            }}
                            className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-[#2563EB]"
                            style={{ background: "#8FA3BC" }}
                          />
                          <div className="flex justify-between text-[10px] mt-0.5" style={{ color: "#8a9ab0" }}>
                            <span>1</span><span>{seatingCalcs.maxRows}</span>
                          </div>
                          {seatingCalcs.rowCount > seatingCalcs.optimalRows && (
                            <p className="text-[10px] text-amber-500 mt-1">
                              Exceeds suggested {seatingCalcs.optimalRows} row{seatingCalcs.optimalRows > 1 ? "s" : ""} — front row may be too close
                            </p>
                          )}
                          {seatingCalcs.limitingFactor === "ceiling" && (
                            <p className="text-[10px] text-amber-500 mt-1">Ceiling height limits rows — reduce riser height to fit more</p>
                          )}
                        </div>

                        {/* ── Seats per Row ── */}
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <label className="text-[11px] font-semibold text-[#2563EB]">Seats per Row</label>
                            <span className="text-xs font-semibold" style={{ color: "#60A5FA" }}>
                              {seatingCalcs.seatsPerRow} of {seatingCalcs.maxSeatsWithAisle} max
                            </span>
                          </div>
                          <input type="range" min="1" max={Math.max(1, seatingCalcs.maxSeatsWithAisle)} value={seatsPerRow}
                            onChange={(e) => setSeatsPerRow(parseInt(e.target.value))}
                            className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-[#2563EB]"
                            style={{ background: "#8FA3BC" }}
                          />
                          <div className="flex justify-between text-[10px] mt-0.5" style={{ color: "#8a9ab0" }}>
                            <span>1</span><span>{seatingCalcs.maxSeatsWithAisle}</span>
                          </div>
                        </div>

                        {/* ── Seating Map — full room + treatment + seats ── */}
                        {(() => {
                          // ── Full room dimensions (same coordinate system as treatment map) ──
                          const safeL  = Math.max(clampedRoom.length, 0.01)
                          const safeW  = Math.max(clampedRoom.width,  0.01)
                          const PAD    = 20
                          const SVG_W  = 220
                          const maxD   = Math.max(safeL, safeW)
                          const rW     = (safeW / maxD) * (SVG_W - PAD * 2)
                          const rH     = (safeL / maxD) * (SVG_W - PAD * 2) * 0.7
                          const SVG_H  = Math.round(rH + PAD * 2 + 14)
                          const rX     = (SVG_W - rW) / 2
                          const rY     = PAD
                          const pxPerM = (SVG_W - PAD * 2) / maxD

                          // ── Treatment panel thicknesses (px) — same as treatment map ──
                          const fThk = Math.max(2, acousticDepthMeters.front   * pxPerM)
                          const rThk = Math.max(2, acousticDepthMeters.rear    * pxPerM)
                          const sThk = Math.max(2, acousticDepthMeters.left    * pxPerM)
                          const isBasicT    = treatmentLevel === 'basic'
                          const isStandardT = treatmentLevel === 'medium'
                          const isStudioT   = treatmentLevel === 'high'
                          const cThk = isBasicT ? 0 : Math.max(0, acousticDepthMeters.ceiling * pxPerM)

                          // FRP reflector Z position
                          const frpZ  = panelLayout.diagnostics.frpLeftZ > 0
                            ? panelLayout.diagnostics.frpLeftZ
                            : seatingCalcs.frontClearance * 0.6
                          const refZ  = rY + ((acousticDepthMeters.front + frpZ) / safeL) * rH
                          const refH  = Math.max(5, (rH - fThk - rThk) * 0.15)

                          // ── Colours — exact app palette ──
                          const absorberFill = '#8a9ab0'
                          const ceilingFill  = '#818CF8'
                          const reflFill     = '#2563EB'
                          const trapFill     = '#202b40'

                          // ── Seating geometry in FULL room coordinates ──
                          const EQUIP_M  = 0.6096  // equipment zone depth (m) from inner face of front panel
                          const nRows    = seatingCalcs.rowCount
                          const nSeats   = seatingCalcs.seatsPerRow
                          const rowDep   = seatingCalcs.rowDepth
                          const frontCl  = seatingCalcs.frontClearance

                          // Z = distance from screen wall (full room)
                          // Front edge of row r (r=0 = back row, r=nRows-1 = front row):
                          //   Z_front(r) = fThkM + EQUIP_M + frontCl + (nRows-1-r)*rowDep
                          const fThkM = acousticDepthMeters.front
                          const rowFrontY = (r: number) => {
                            const z = fThkM + EQUIP_M + frontCl + (nRows - 1 - r) * rowDep
                            return rY + (z / safeL) * rH
                          }
                          const rowH_px = Math.max(2.5, (rowDep / safeL) * rH * 0.82)

                          // Usable width (px) — between side panels
                          const usableX  = rX + sThk
                          const usableWpx = rW - 2 * sThk

                          // Seat & aisle widths in px — using actual computed values
                          const seatW_px  = Math.max(2, Math.min(16, seatingCalcs.seatWidth * pxPerM))
                          const aisleW_px = aisleConfig !== "none"
                            ? Math.max(3, seatingCalcs.aisleActualW * pxPerM) : 0
                          const totalAi   = aisleConfig === "both" ? 2 : aisleConfig !== "none" ? 1 : 0

                          // Build seat X positions (centred within usable area, aisle gaps placed accurately)
                          const buildXs = (n: number): number[] => {
                            const totalSeatW = n * seatW_px + Math.max(0, n - 1) * 0.8
                            const totalW = totalSeatW + totalAi * aisleW_px
                            const startX = usableX + (usableWpx - totalW) / 2
                            if (aisleConfig === "center") {
                              const half = Math.floor(n / 2)
                              const xs: number[] = []
                              for (let i = 0; i < half; i++) xs.push(startX + i * (seatW_px + 0.8))
                              for (let i = half; i < n; i++) xs.push(startX + half * (seatW_px + 0.8) + aisleW_px + (i - half) * (seatW_px + 0.8))
                              return xs
                            } else if (aisleConfig === "both") {
                              return Array.from({ length: n }, (_, i) => startX + aisleW_px + i * (seatW_px + 0.8))
                            } else if (aisleConfig === "left") {
                              return Array.from({ length: n }, (_, i) => startX + aisleW_px + i * (seatW_px + 0.8))
                            } else if (aisleConfig === "right") {
                              return Array.from({ length: n }, (_, i) => startX + i * (seatW_px + 0.8))
                            } else {
                              return Array.from({ length: n }, (_, i) => startX + i * (seatW_px + 0.8))
                            }
                          }
                          const normalXs = buildXs(nSeats)

                          // Back row (r=0) — wider when widerBackRow (spans full usable width, no aisle)
                          const backN   = widerBackRow && nRows > 1 ? seatingCalcs.backRowSeats : nSeats
                          const backSW  = backN > 0 ? Math.max(2, (usableWpx - (backN - 1) * 0.8) / backN) : seatW_px
                          const backXs  = Array.from({ length: backN }, (_, s) => usableX + s * (backSW + 0.8))

                          // Primary listening position dot
                          const priZ   = fThkM + EQUIP_M + frontCl + (nRows - 1 - primaryRow) * rowDep + rowDep * 0.5
                          const priY   = rY + (priZ / safeL) * rH
                          const priX   = rX + rW / 2

                          // Stats
                          const total     = nRows * nSeats + (widerBackRow && nRows > 1 ? backN - nSeats : 0)
                          const frontDist = unitSystem === "imperial"
                            ? `${(frontCl * 3.28084).toFixed(1)} ft`
                            : `${frontCl.toFixed(2)} m`
                          const dimLabel  = unitSystem === "imperial"
                            ? `${(safeL * 3.28084).toFixed(1)} × ${(safeW * 3.28084).toFixed(1)} ft`
                            : `${safeL.toFixed(1)} × ${safeW.toFixed(1)} m`

                          return (
                            <div className="mt-1 rounded-lg overflow-hidden" style={{ border: "1px solid #b8bfc9" }}>
                              <div className="px-3 py-2.5" style={{ background: "#d0d2d4" }}>
                                {/* Header */}
                                <div className="flex items-center justify-between mb-2">
                                  <p className="text-[10px] font-semibold text-[#202b40] uppercase tracking-widest">Seating Map</p>
                                  <span className="text-[9px] text-[#8a9ab0] font-mono">{dimLabel}</span>
                                </div>

                                <div className="flex gap-3 items-start">

                                  {/* LEFT — SVG floor plan */}
                                  <div className="shrink-0" style={{ width: "54%" }}>
                                  <svg width="100%" height={SVG_H} viewBox={`0 0 ${SVG_W} ${SVG_H}`} xmlns="http://www.w3.org/2000/svg">

                                    {/* ── Room outline ── */}
                                    <rect x={rX} y={rY} width={rW} height={rH}
                                      fill="rgba(37,99,235,0.06)" stroke="#2563EB" strokeWidth="1.2" rx="2"/>

                                    {/* ── Screen wall ── */}
                                    <line x1={rX} y1={rY} x2={rX + rW} y2={rY}
                                      stroke="#2563EB" strokeWidth="3" strokeLinecap="round"/>

                                    {/* ── Front wall absorber ── */}
                                    <rect x={rX + 1} y={rY + 1} width={rW - 2} height={fThk - 1}
                                      fill={absorberFill} opacity="0.75" rx="1"/>
                                    <line x1={rX + rW * 0.22} y1={rY + fThk * 0.55}
                                          x2={rX + rW * 0.78} y2={rY + fThk * 0.55}
                                      stroke="#202b40" strokeWidth="1.5" strokeLinecap="round" opacity="0.5"/>

                                    {/* ── Rear wall absorber ── */}
                                    <rect x={rX + 1} y={rY + rH - rThk} width={rW - 2} height={rThk - 1}
                                      fill={absorberFill} opacity="0.75" rx="1"/>
                                    {(isStandardT || isStudioT) && Array.from({ length: 10 }).map((_, i) => (
                                      <line key={i}
                                        x1={rX + 2 + i * (rW / 10)} y1={rY + rH - rThk + 1}
                                        x2={rX + 2 + i * (rW / 10) + rThk * 0.8} y2={rY + rH - 2}
                                        stroke="#202b40" strokeWidth="0.6" opacity="0.4"/>
                                    ))}

                                    {/* ── Side wall absorbers ── */}
                                    <rect x={rX + 1} y={rY + 1} width={sThk - 1} height={rH - 2}
                                      fill={absorberFill} opacity="0.75" rx="1"/>
                                    <rect x={rX + rW - sThk} y={rY + 1} width={sThk - 1} height={rH - 2}
                                      fill={absorberFill} opacity="0.75" rx="1"/>

                                    {/* ── Ceiling cloud — Standard/Studio ── */}
                                    {(isStandardT || isStudioT) && cThk > 0 && (
                                      <>
                                        <rect x={rX + sThk + 2} y={rY + fThk + 1}
                                          width={rW - sThk * 2 - 4} height={Math.max(3, cThk)}
                                          fill={ceilingFill} opacity="0.22" rx="1"/>
                                        <rect x={rX + sThk + 2} y={rY + fThk + 1}
                                          width={rW - sThk * 2 - 4} height={Math.max(3, cThk)}
                                          fill="none" stroke={ceilingFill} strokeWidth="1" opacity="0.7" rx="1"/>
                                      </>
                                    )}

                                    {/* ── Reflectors at FRP (Standard/Studio) ── */}
                                    {(isStandardT || isStudioT) && (
                                      <>
                                        <rect x={rX + sThk - 1} y={refZ} width={4} height={refH}
                                          fill={reflFill} opacity="0.95" rx="0.5"/>
                                        <rect x={rX + rW - sThk - 3} y={refZ} width={4} height={refH}
                                          fill={reflFill} opacity="0.95" rx="0.5"/>
                                      </>
                                    )}

                                    {/* ── Bass traps — Studio ── */}
                                    {isStudioT && (() => {
                                      const tx = sThk + fThk + 4
                                      const tb = sThk + rThk + 4
                                      return [
                                        { tx: rX,      ty: rY,      pts: `0,0 ${tx},0 0,${tx}` },
                                        { tx: rX + rW, ty: rY,      pts: `0,0 -${tx},0 0,${tx}` },
                                        { tx: rX,      ty: rY + rH, pts: `0,0 ${tb},0 0,-${tb}` },
                                        { tx: rX + rW, ty: rY + rH, pts: `0,0 -${tb},0 0,-${tb}` },
                                      ].map((c, i) => (
                                        <g key={i} transform={`translate(${c.tx},${c.ty})`}>
                                          <polygon points={c.pts} fill={trapFill} opacity="0.85"/>
                                        </g>
                                      ))
                                    })()}

                                    {/* ── Equipment + front clearance zone (light fill) ── */}
                                    {(() => {
                                      const equipY  = rY + fThk
                                      const clearH  = Math.max(2, ((EQUIP_M + frontCl) / safeL) * rH)
                                      return (
                                        <rect x={rX + sThk} y={equipY}
                                          width={rW - 2 * sThk} height={clearH}
                                          fill="rgba(37,99,235,0.10)" rx="1"/>
                                      )
                                    })()}

                                    {/* ── Seat rows ── */}
                                    {Array.from({ length: nRows }, (_, r) => {
                                      const isBackRow = r === 0
                                      const n   = isBackRow && widerBackRow && nRows > 1 ? backN  : nSeats
                                      const sw  = isBackRow && widerBackRow && nRows > 1 ? backSW : seatW_px
                                      const xs  = isBackRow && widerBackRow && nRows > 1 ? backXs : normalXs
                                      const yT  = rowFrontY(r)
                                      const pri = r === primaryRow
                                      return (
                                        <g key={r}>
                                          {Array.from({ length: n }, (_, s) => (
                                            <rect key={s}
                                              x={xs[s] ?? usableX} y={yT}
                                              width={sw} height={rowH_px}
                                              rx={1}
                                              fill={pri ? "#2563EB" : "#5a7fa8"}
                                              opacity={pri ? 0.92 : 0.65}
                                            />
                                          ))}
                                        </g>
                                      )
                                    })}

                                    {/* ── Primary listener dot ── */}
                                    <circle cx={priX} cy={priY} r="3.5"
                                      fill="none" stroke="#202b40" strokeWidth="1.2"/>
                                    <circle cx={priX} cy={priY} r="1.3" fill="#202b40"/>

                                    {/* ── Labels — same as treatment map ── */}
                                    <text x={rX + rW / 2} y={rY + 6} textAnchor="middle" fontSize="5" fill="#2563EB" fontWeight="600" letterSpacing="0.8">SCREEN</text>
                                    <text x={rX + rW / 2} y={rY + rH + 10} textAnchor="middle" fontSize="5.5" fill="#8a9ab0" letterSpacing="1">REAR</text>
                                    <text x={rX + rW / 2} y={rY - 5} textAnchor="middle" fontSize="7" fill="#6b7a90">W</text>
                                    <text x={rX - 6} y={rY + rH / 2} textAnchor="middle" fontSize="7" fill="#6b7a90"
                                      transform={`rotate(-90,${rX - 6},${rY + rH / 2})`}>L</text>

                                  </svg>
                                  </div>

                                  {/* RIGHT — stats + legend */}
                                  <div className="flex-1 flex flex-col gap-1.5 pt-0.5">

                                    {/* Stats */}
                                    {[
                                      { label: "Rows",       v: String(nRows)  },
                                      { label: "Per Row",    v: String(nSeats) },
                                      { label: "Total",      v: String(total)  },
                                      { label: "Front Dist", v: frontDist      },
                                    ].map(({ label, v }) => (
                                      <div key={label} className="flex justify-between text-[9px]">
                                        <span style={{ color: "#8a9ab0" }}>{label}</span>
                                        <span className="font-mono font-semibold" style={{ color: "#202b40" }}>{v}</span>
                                      </div>
                                    ))}

                                    {/* Legend */}
                                    <div className="flex flex-col gap-1 pt-1.5" style={{ borderTop: "1px solid #b8bfc9" }}>
                                      <div className="flex items-center gap-1">
                                        <div className="w-2 h-2 rounded-sm shrink-0" style={{ background: absorberFill }}/>
                                        <span className="text-[9px]" style={{ color: "#6b7a90" }}>Absorber</span>
                                      </div>
                                      {(isStandardT || isStudioT) && (
                                        <div className="flex items-center gap-1">
                                          <div className="w-2 h-2 rounded-sm shrink-0" style={{ background: reflFill }}/>
                                          <span className="text-[9px]" style={{ color: "#6b7a90" }}>Reflector</span>
                                        </div>
                                      )}
                                      {isStudioT && (
                                        <div className="flex items-center gap-1">
                                          <div className="w-2 h-2 rounded-sm shrink-0" style={{ background: trapFill }}/>
                                          <span className="text-[9px]" style={{ color: "#6b7a90" }}>Bass trap</span>
                                        </div>
                                      )}
                                      <div className="flex items-center gap-1">
                                        <div className="w-2 h-2 rounded-sm shrink-0" style={{ background: "#2563EB", opacity: 0.9 }}/>
                                        <span className="text-[9px]" style={{ color: "#6b7a90" }}>Primary row</span>
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <div className="w-2 h-2 rounded-sm shrink-0" style={{ background: "#5a7fa8", opacity: 0.65 }}/>
                                        <span className="text-[9px]" style={{ color: "#6b7a90" }}>Other rows</span>
                                      </div>
                                    </div>

                                    {/* Warnings */}
                                    {(!seatingCalcs.frontClearanceSafe || seatingCalcs.headroomStatus !== "good") && (
                                      <div className="pt-1 space-y-0.5">
                                        {!seatingCalcs.frontClearanceSafe && (
                                          <p className="text-[9px] text-amber-500">⚠ Front &lt;6&apos; min</p>
                                        )}
                                        {seatingCalcs.headroomStatus === "tight" && (
                                          <p className="text-[9px] text-amber-500">⚠ Headroom tight</p>
                                        )}
                                        {seatingCalcs.headroomStatus === "low" && (
                                          <p className="text-[9px] text-amber-500">⚠ Headroom low</p>
                                        )}
                                      </div>
                                    )}

                                  </div>
                                </div>
                              </div>
                            </div>
                          )
                        })()}

                      </div>
                    )
                  })()}
              </div>
              </div>
              )}

              {/* ── SPEAKER LAYOUT — unlocks after seating Apply ── */}
              {unlockedLevel >= 5 && (
<div style={{ animation: 'sectionSlideIn 0.35s ease-out' }}>
<div className={`rounded-xl p-4 transition-opacity ${!isRoomValid ? "opacity-40 pointer-events-none select-none" : ""}`} style={{ background: "#dfe1e3", border: "1.5px solid #8a9ab0" }}>
  <div className="flex items-center justify-between mb-4">
    <label className="text-[11px] font-bold text-[#202b40] uppercase tracking-widest pl-2 border-l-2 border-[#2563EB]">Speaker Layout</label>
    <button
      onClick={() => {
        setMountType(autoRecommended.mountType ?? "onWall")
        setScreenPlacement(autoRecommended.screenPlacement ?? "behindScreen")
        setSurroundMode(autoRecommended.surrounds)
        setCeilingCount(autoRecommended.ceilingCount)
        setExtraSidePairs(autoRecommended.extraSidePairs)
        setExtraCeilingPairs(autoRecommended.extraCeilingPairs)
        setPrimaryRow(0)
        setSubCount(autoRecommended.subCount ?? 1)
        speakerConfigEdited.current = true
      }}
      className="text-[10px] px-2 py-0.5 rounded font-medium transition"
      style={{ background: "#d9dadb", border: "1px solid #2563EB", color: "#2563EB" }}
    >Auto</button>
  </div>

  <div className="space-y-3">

    {/* Mount Type */}
    <div>
      <label className="text-[11px] font-semibold text-[#2563EB] block mb-2">Mount Type</label>
      <div className="flex rounded overflow-hidden" style={{ border: "1px solid #8a9ab0" }}>
        {([
          { key: "inWall", label: "In-Wall" },
          { key: "onWall", label: "On-Wall" },
        ] as const).map(({ key, label }, i) => (
          <button key={key} onClick={() => { setMountType(key as "inWall" | "onWall"); speakerConfigEdited.current = true }}
            className="flex-1 py-1.5 text-xs transition-all"
            style={{
              background: mountType === key ? "#202b40" : "#d9dadb",
              color:      mountType === key ? "#ffffff"  : "#202b40",
              borderRight: i === 0 ? "1px solid #8a9ab0" : "none",
              fontWeight:  mountType === key ? 600 : 400,
            }}
          >{label}</button>
        ))}
      </div>
      <p className="text-[10px] text-[#6b7a90] mt-1 leading-relaxed">
        {mountType === "inWall" ? "Flush-mounted inside acoustic cavity — cleaner look, requires wall depth" : "Surface-mounted on wall brackets — easier install, protrudes into room"}
      </p>
    </div>

    {/* LCR Placement */}
    <div>
      <label className="text-[11px] font-semibold text-[#2563EB] block mb-2">LCR Placement</label>
      <div className="flex rounded overflow-hidden" style={{ border: "1px solid #8a9ab0" }}>
        {([
          { key: "behindScreen", label: "Behind Screen" },
          { key: "besideScreen", label: "Beside Screen" },
        ] as const).map(({ key, label }, i) => (
          <button key={key} onClick={() => { setScreenPlacement(key as "behindScreen" | "besideScreen"); speakerConfigEdited.current = true }}
            className="flex-1 py-1.5 text-xs transition-all"
            style={{
              background: screenPlacement === key ? "#202b40" : "#d9dadb",
              color:      screenPlacement === key ? "#ffffff"  : "#202b40",
              borderRight: i === 0 ? "1px solid #8a9ab0" : "none",
              fontWeight:  screenPlacement === key ? 600 : 400,
            }}
          >{label}</button>
        ))}
      </div>
      <p className="text-[10px] text-[#6b7a90] mt-1 leading-relaxed">
        {screenPlacement === "behindScreen"
          ? "Acoustically transparent screen — speakers fire through fabric. Best for large rooms with projector"
          : "Speakers flanking screen — visible placement. Required for flat-panel displays"}
      </p>
    </div>

    {/* Surrounds */}
    <div>
      <label className="text-[11px] font-semibold text-[#2563EB] block mb-2">Surrounds</label>
      <div className="flex rounded overflow-hidden" style={{ border: "1px solid #8a9ab0" }}>
        {([
          { key: "none",      label: "None" },
          { key: "side",      label: "Side Only" },
          { key: "side_rear", label: "Side + Rear" },
        ] as const).map(({ key, label }, i, arr) => (
          <button key={key} onClick={() => { setSurroundMode(key as SurroundMode); speakerConfigEdited.current = true }}
            className="flex-1 py-1.5 text-xs transition-all"
            style={{
              background: surroundMode === key ? "#202b40" : "#d9dadb",
              color:      surroundMode === key ? "#ffffff"  : "#202b40",
              borderRight: i < arr.length - 1 ? "1px solid #8a9ab0" : "none",
              fontWeight:  surroundMode === key ? 600 : 400,
            }}
          >{label}</button>
        ))}
      </div>
      <p className="text-[10px] text-[#6b7a90] mt-1 leading-relaxed">
        {surroundMode === "none" && "Front-only (stereo or 3.x) — no immersive surround envelope"}
        {surroundMode === "side" && "Side surrounds at listener position — 5.x configuration"}
        {surroundMode === "side_rear" && "Side + rear surrounds — full 7.x immersive envelope"}
      </p>
    </div>

    {/* Front Wide Surrounds — only if surrounds enabled and room qualifies */}
    {surroundMode !== "none" && showExtendedSides && (
    <div>
      <label className="text-[11px] font-semibold text-[#2563EB] block mb-2">Front Wide Surrounds</label>
      <div className="flex rounded overflow-hidden" style={{ border: "1px solid #8a9ab0" }}>
        {Array.from({ length: maxExtraSidePairs + 1 }, (_, n) => (
          <button key={n} onClick={() => { setExtraSidePairs(n); speakerConfigEdited.current = true }}
            className="flex-1 py-1.5 text-xs transition-all"
            style={{
              background: extraSidePairs === n ? "#202b40" : "#d9dadb",
              color:      extraSidePairs === n ? "#ffffff"  : "#202b40",
              borderRight: n < maxExtraSidePairs ? "1px solid #8a9ab0" : "none",
              fontWeight:  extraSidePairs === n ? 600 : 400,
            }}
          >{n === 0 ? "None" : `${n} pair${n > 1 ? "s" : ""}`}</button>
        ))}
      </div>
      <p className="text-[10px] text-[#6b7a90] mt-1 leading-relaxed">
        Extra side pairs for rooms longer than {unitSystem === "imperial" ? "25 ft" : "7.6 m"} — fills surround gap in large spaces
      </p>
    </div>
    )}

    {/* Atmos Overhead */}
    <div>
      <label className="text-[11px] font-semibold text-[#2563EB] block mb-2">Overhead (Atmos)</label>
      <div className="flex rounded overflow-hidden" style={{ border: "1px solid #8a9ab0" }}>
        {([0, 2, 4, 6] as CeilingCount[]).map((n, i, arr) => (
          <button key={n} onClick={() => { setCeilingCount(n); speakerConfigEdited.current = true }}
            className="flex-1 py-1.5 text-xs transition-all"
            style={{
              background: ceilingCount === n ? "#202b40" : "#d9dadb",
              color:      ceilingCount === n ? "#ffffff"  : "#202b40",
              borderRight: i < arr.length - 1 ? "1px solid #8a9ab0" : "none",
              fontWeight:  ceilingCount === n ? 600 : 400,
            }}
          >{n === 0 ? "None" : `${n}`}</button>
        ))}
      </div>
      <p className="text-[10px] text-[#6b7a90] mt-1 leading-relaxed">
        {ceilingCount === 0 && "No height channels — 2D surround only"}
        {ceilingCount === 2 && "2 ceiling speakers — basic Atmos height layer"}
        {ceilingCount === 4 && "4 ceiling speakers — front + rear Atmos pairs"}
        {ceilingCount === 6 && "6 ceiling speakers — full Atmos canopy (front + mid + rear)"}
      </p>
      {ceilingCount >= 2 && clampedRoom.height < 2.4 && (
        <p className="text-[10px] text-amber-500 mt-1">Ceiling height below 2.4 m — Atmos effect may be limited</p>
      )}
      {ceilingCount >= 4 && clampedRoom.height < 2.7 && clampedRoom.height >= 2.4 && (
        <p className="text-[10px] text-amber-500 mt-1">4+ speakers recommended for ceilings above 2.7 m</p>
      )}
      {ceilingCount === 6 && clampedRoom.height < 3.5 && clampedRoom.height >= 2.7 && (
        <p className="text-[10px] text-amber-500 mt-1">6 speakers ideal for ceilings above 3.5 m</p>
      )}
    </div>

    {/* Extended Atmos — only if ceiling > 0 and room qualifies */}
    {ceilingCount > 0 && showExtendedCeiling && (
    <div>
      <label className="text-[11px] font-semibold text-[#2563EB] block mb-2">Extended Atmos</label>
      <div className="flex rounded overflow-hidden" style={{ border: "1px solid #8a9ab0" }}>
        {Array.from({ length: maxExtraCeilingPairs + 1 }, (_, n) => (
          <button key={n} onClick={() => { setExtraCeilingPairs(n); speakerConfigEdited.current = true }}
            className="flex-1 py-1.5 text-xs transition-all"
            style={{
              background: extraCeilingPairs === n ? "#202b40" : "#d9dadb",
              color:      extraCeilingPairs === n ? "#ffffff"  : "#202b40",
              borderRight: n < maxExtraCeilingPairs ? "1px solid #8a9ab0" : "none",
              fontWeight:  extraCeilingPairs === n ? 600 : 400,
            }}
          >{n === 0 ? "None" : `${n} pair${n > 1 ? "s" : ""}`}</button>
        ))}
      </div>
      <p className="text-[10px] text-[#6b7a90] mt-1 leading-relaxed">
        Extra ceiling pairs for long rooms — extends overhead coverage beyond primary zone
      </p>
    </div>
    )}

    {/* Primary Listening Row */}
    <div>
      <label className="text-[11px] font-semibold text-[#2563EB] block mb-2">Primary Listening Row</label>
      {seatingCalcs.rowCount > 1 ? (
        <div className="flex rounded overflow-hidden" style={{ border: "1px solid #8a9ab0" }}>
          {Array.from({ length: seatingCalcs.rowCount }, (_, i) => (
            <button key={i} onClick={() => setPrimaryRow(i)}
              className="flex-1 py-1.5 text-xs transition-all"
              style={{
                background: primaryRow === i ? "#202b40" : "#d9dadb",
                color:      primaryRow === i ? "#ffffff"  : "#202b40",
                borderRight: i < seatingCalcs.rowCount - 1 ? "1px solid #8a9ab0" : "none",
                fontWeight:  primaryRow === i ? 600 : 400,
              }}
            >Row {i + 1}</button>
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-2 px-3 py-2 rounded" style={{ background: "#d9dadb", border: "1px solid #8a9ab0" }}>
          <span className="text-xs font-semibold text-[#2563EB]">Row 1</span>
          <span className="text-[10px] text-[#202b40]">— single row</span>
        </div>
      )}
      <p className="text-[10px] text-[#6b7a90] mt-1 leading-relaxed">
        Reference position for speaker aiming, acoustic calibration, and Atmos rendering
      </p>
    </div>

    {/* Subwoofer Count */}
    <div>
      <label className="text-[11px] font-semibold text-[#2563EB] block mb-2">Subwoofers</label>
      <div className="flex rounded overflow-hidden" style={{ border: "1px solid #8a9ab0" }}>
        {([1, 2, 3, 4] as const).map((n, i, arr) => (
          <button key={n} onClick={() => setSubCount(n)}
            className="flex-1 py-1.5 text-xs transition-all"
            style={{
              background: subCount === n ? "#202b40" : "#d9dadb",
              color:      subCount === n ? "#ffffff"  : "#202b40",
              borderRight: i < arr.length - 1 ? "1px solid #8a9ab0" : "none",
              fontWeight:  subCount === n ? 600 : 400,
            }}
          >{n}</button>
        ))}
      </div>
      <p className="text-[10px] text-[#6b7a90] mt-1 leading-relaxed">
        {subCount === 1 && "Single sub — adequate for small rooms, may have uneven bass"}
        {subCount === 2 && "Dual subs — cancels front-back mode, smoother bass response"}
        {subCount === 3 && "Triple subs — asymmetric placement for mode cancellation"}
        {subCount === 4 && "Quad subs — maximum smoothness, distributed bass array"}
      </p>
    </div>

    {/* Sub Enclosure */}
    <div>
      <label className="text-[11px] font-semibold text-[#2563EB] block mb-2">Sub Enclosure</label>
      <div className="flex rounded overflow-hidden" style={{ border: "1px solid #8a9ab0" }}>
        {([
          { key: "sealed", label: "Sealed" },
          { key: "ported", label: "Ported" },
        ] as const).map(({ key, label }, i) => (
          <button key={key} onClick={() => setSubType(key as "sealed" | "ported")}
            className="flex-1 py-1.5 text-xs transition-all"
            style={{
              background: subType === key ? "#202b40" : "#d9dadb",
              color:      subType === key ? "#ffffff"  : "#202b40",
              borderRight: i === 0 ? "1px solid #8a9ab0" : "none",
              fontWeight:  subType === key ? 600 : 400,
            }}
          >{label}</button>
        ))}
      </div>
      <p className="text-[10px] text-[#6b7a90] mt-1 leading-relaxed">
        {subType === "sealed" ? "Sealed (acoustic suspension) — tight, accurate bass with gentle rolloff. Best for music and dialogue" : "Ported (bass reflex) — deeper extension with higher output. Best for cinematic impact"}
      </p>
    </div>

    {/* Sub Placement */}
    <div>
      <label className="text-[11px] font-semibold text-[#2563EB] block mb-2">Sub Placement</label>
      {subCount <= 2 ? (
        <div className="flex rounded overflow-hidden" style={{ border: "1px solid #8a9ab0" }}>
          {([
            { key: "frontWall", label: "Front Wall" },
            { key: "frontCorners", label: "Front Corners" },
            ...(subCount === 2 ? [{ key: "haas", label: "Front + Rear" }] : []),
          ] as { key: string; label: string }[]).map(({ key, label }, i, arr) => (
            <button key={key} onClick={() => setSubPlacement(key as typeof subPlacement)}
              className="flex-1 py-1.5 text-xs transition-all"
              style={{
                background: subPlacement === key ? "#202b40" : "#d9dadb",
                color:      subPlacement === key ? "#ffffff"  : "#202b40",
                borderRight: i < arr.length - 1 ? "1px solid #8a9ab0" : "none",
                fontWeight:  subPlacement === key ? 600 : 400,
              }}
            >{label}</button>
          ))}
        </div>
      ) : (
        <div className="px-3 py-2 rounded text-xs text-[#202b40]" style={{ background: "#d9dadb", border: "1px solid #8a9ab0" }}>
          Distributed placement — {subCount} subs positioned for maximum mode cancellation
        </div>
      )}
      <p className="text-[10px] text-[#6b7a90] mt-1 leading-relaxed">
        {subCount <= 2 && subPlacement === "frontWall" && "Centered on front wall — simple, good coupling"}
        {subCount <= 2 && subPlacement === "frontCorners" && "Front corner loading — maximum output, room gain boost"}
        {subCount <= 2 && subPlacement === "haas" && "One front, one rear — cancels primary length mode"}
        {subCount > 2 && "Optimal positions auto-calculated for room dimensions"}
      </p>
    </div>

    {/* Config Summary */}
    <div className="rounded px-3 py-2.5" style={{ background: "#202b40" }}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono font-bold text-[#60A5FA]">{configNotation}</span>
        <span className="text-[10px] text-[#8a9ab0]">{bedCount + ceilingCount + (extraSidePairs * 2) + (extraCeilingPairs * 2)} ch + {subCount} sub</span>
      </div>
      <div className="flex items-center justify-between mt-1">
        <span className="text-[10px] text-[#8a9ab0]">{speakerSystemType}</span>
        {(() => {
          const certBadge = ceilingCount >= 4 ? "Dolby Atmos" : ceilingCount === 2 ? "Dolby Atmos Basic" : bedCount >= 6 ? "Dolby Surround" : bedCount >= 3 ? "Dolby Digital" : "Stereo"
          return <span className="text-[10px] font-medium text-[#60A5FA]">{certBadge}</span>
        })()}
      </div>
    </div>

  </div>
</div>
</div>
)}

              {/* ── SCREEN PREFERENCES — unlocks after speaker Apply ── */}
              {unlockedLevel >= 6 && (
              <div style={{ animation: 'sectionSlideIn 0.35s ease-out' }}>
              <div className={`rounded-xl p-4 transition-opacity ${(!isRoomValid || !geometryValid) ? "opacity-40 pointer-events-none select-none" : ""}`} style={{ background: "#dfe1e3", border: "1.5px solid #8a9ab0" }}>
                  <div className="flex items-center justify-between mb-4">
                    <label className="text-[11px] font-bold text-[#202b40] uppercase tracking-widest pl-2 border-l-2 border-[#2563EB]">Screen Preferences</label>
                    <button
                      onClick={() => {
                        // Optimal diagonal: use selected viewing standard's FOV angle
                        const stdAngle = ({ SMPTE: 30, THX: 40, IMMERSIVE: 50 } as Record<string, number>)[standard] ?? 40
                        const viewDist = seatingCalcs.viewingDistance > 0 ? seatingCalcs.viewingDistance : 3.0
                        const optWidthM = 2 * viewDist * Math.tan((stdAngle * Math.PI / 180) / 2)
                        const maxW = screenFitValidation.maxScreenWidth
                        const targetW = Math.min(optWidthM, maxW)
                        // Convert to diagonal using current aspect ratio (not hardcoded 16:9)
                        const ar = aspectRatioMode === "16:9" ? 16/9
                          : aspectRatioMode === "2.35:1" ? 2.35
                          : aspectRatioMode === "4:3" ? 4/3
                          : customAspectWidth / (customAspectHeight || 1)
                        const diagM = targetW * Math.sqrt(1 + 1/(ar*ar))
                        const diagIn = Math.round(diagM * 39.3701 / 10) * 10
                        // Throw ratio: standard 1.4 for projector, skip for flat panel
                        if (displayType === "projector") setThrowRatio(1.4)
                        // Screen bottom: account for center channel clearance with besideScreen/onWall
                        const needsCenterClearance = screenPlacement === "besideScreen" || mountType === "onWall"
                        const autoBottom = needsCenterClearance ? Math.max(0.609, 0.40) : 0.609
                        setScreenDiagonalInches(Math.max(72, Math.min(200, diagIn)))
                        setScreenBottomFromFloor(autoBottom)
                      }}
                      className="text-[10px] px-2 py-0.5 rounded font-medium transition"
                      style={{ background: "#d9dadb", border: "1px solid #2563EB", color: "#2563EB" }}
                      title="Auto-set screen size based on 40° SMPTE viewing angle at primary row"
                    >Auto</button>
                  </div>

                  {(() => {
                    const DIAGONAL_SIZES = [72, 92, 100, 110, 120, 135, 150, 165, 180, 200]
                    const diagWidthM = (d: number) => diagonalToWidthMeters(d, screenAspectRatio)
                    const diagFits   = (d: number) => diagWidthM(d) <= screenFitValidation.maxScreenWidth
                    const autoRecDiag = DIAGONAL_SIZES.filter(d => diagFits(d)).slice(-1)[0] ?? DIAGONAL_SIZES[0]

                    const lensType = (() => {
                      if (throwRatio < 0.8)  return { label: "Ultra Short Throw (UST)", color: "text-purple-400" }
                      if (throwRatio < 1.3)  return { label: "Short Throw",             color: "text-blue-400"   }
                      if (throwRatio < 2.0)  return { label: "Standard Throw",          color: "text-[#60A5FA]"  }
                      return                        { label: "Long Throw",               color: "text-amber-400"  }
                    })()

                    // screenTypeNote for description line (Fix 2+3)
                    const screenTypeNote: Record<string, string> = {
                      fixed:       "Fixed frame — zero back-wall clearance needed, no mechanism",
                      motorized:   "Motorized — leave 0.1–0.15 m behind screen for roll tube and housing",
                      retractable: "Retractable — ceiling recess or pelmet box required, ~0.2 m depth above screen",
                    }

                    return (
                      <div className="space-y-4">

                        {/* Display Type — projector vs flat panel */}
                        <div>
                          <label className="text-[11px] font-semibold text-[#2563EB] block mb-2">Display Type</label>
                          <div className="flex gap-2">
                            {(["projector", "display"] as const).map(d => (
                              <button key={d} onClick={() => setDisplayType(d)}
                                className="flex-1 px-3 py-2 text-xs rounded transition font-normal"
                                style={displayType === d
                                  ? { background: "#2563EB", color: "#ffffff", border: "1px solid #2563EB" }
                                  : { background: "#B8C4D6", border: "1px solid #8FA3BC", color: "#202b40" }}
                              >
                                {d === "projector" ? "Projector" : "Flat Panel Display"}
                              </button>
                            ))}
                          </div>
                          <p className="text-[10px] text-[#202b40] leading-relaxed mt-1.5">
                            {displayType === "projector"
                              ? "Throw distance and lens placement apply — projector positioned at rear of seating zone"
                              : "Zero throw — display mounts flush to front wall, no projection clearance needed"}
                          </p>
                        </div>

                        {/* Screen Type — projector only */}
                        {displayType === "projector" && (
                        <div>
                          <label className="text-[11px] font-semibold text-[#2563EB] block mb-2">Screen Type</label>
                          <div className="flex gap-2">
                            {(["fixed", "motorized", "retractable"] as const).map(t => (
                              <button key={t} onClick={() => setScreenType(t)}
                                className="flex-1 px-2 py-2 text-xs rounded transition font-normal capitalize"
                                style={screenType === t
                                  ? { background: "#2563EB", color: "#ffffff", border: "1px solid #2563EB" }
                                  : { background: "#B8C4D6", border: "1px solid #8FA3BC", color: "#202b40" }}
                              >
                                {t === "fixed" ? "Fixed Frame" : t === "motorized" ? "Motorized" : "Retractable"}
                              </button>
                            ))}
                          </div>
                          <p className="text-[10px] text-[#202b40] mt-1.5 leading-relaxed">
                            {screenTypeNote[screenType]}
                          </p>
                        </div>
                        )}
                        <div>
                          <label className="text-[11px] font-semibold text-[#2563EB] block mb-2">Viewing Standard</label>
                          <div className="flex rounded overflow-hidden" style={{ border: "1px solid #8a9ab0" }}>
                            {([
                              { id: "SMPTE",    label: "SMPTE 30°"  },
                              { id: "THX",      label: "THX 40°"    },
                              { id: "IMMERSIVE",label: "Max 50°+"   },
                            ] as const).map(({ id, label }, i) => (
                              <button key={id} onClick={() => setStandard(id as ViewingStandard)}
                                className="flex-1 py-1.5 text-xs transition-all"
                                style={{
                                  background:  standard === id ? "#202b40" : "#d9dadb",
                                  color:       standard === id ? "#ffffff"  : "#202b40",
                                  borderRight: i < 2 ? "1px solid #8a9ab0" : "none",
                                  fontWeight:  standard === id ? 600 : 400,
                                }}
                              >{label}</button>
                            ))}
                          </div>
                          <p className="text-[10px] text-[#202b40] mt-1.5 leading-relaxed">
                            {standard === "SMPTE"     && "30° horizontal FOV — conservative, comfortable for long sessions"}
                            {standard === "THX"       && "40° horizontal FOV — reference standard for dedicated home theatres"}
                            {standard === "IMMERSIVE" && "50°+ horizontal FOV — maximum immersion, front-row cinema feel"}
                          </p>
                        </div>

                        {/* Aspect Ratio */}
                        <div>
                          <label className="text-[11px] font-semibold text-[#2563EB] block mb-2">Aspect Ratio</label>
                          <div className="flex rounded overflow-hidden" style={{ border: "1px solid #8a9ab0" }}>
                            {([
                              { id: "16:9",   label: "16:9"    },
                              { id: "2.35:1", label: "2.35:1"  },
                              { id: "4:3",    label: "4:3"     },
                              { id: "custom", label: "Custom"  },
                            ] as const).map(({ id, label }, i) => (
                              <button key={id} onClick={() => setAspectRatioMode(id as "16:9" | "2.35:1" | "4:3" | "custom")}
                                className="flex-1 py-1.5 text-xs transition-all"
                                style={{
                                  background:  aspectRatioMode === id ? "#202b40" : "#d9dadb",
                                  color:       aspectRatioMode === id ? "#ffffff"  : "#202b40",
                                  borderRight: i < 3 ? "1px solid #8a9ab0" : "none",
                                  fontWeight:  aspectRatioMode === id ? 600 : 400,
                                }}
                              >{label}</button>
                            ))}
                          </div>
                          <p className="text-[10px] text-[#202b40] mt-1.5 leading-relaxed">
                            {aspectRatioMode === "16:9"   && "Standard widescreen — streaming, UHD Blu-ray"}
                            {aspectRatioMode === "2.35:1" && "CinemaScope anamorphic — cinematic film format"}
                            {aspectRatioMode === "4:3"    && "Classic / legacy — older content and presentations"}
                            {aspectRatioMode === "custom" && "Enter width and height ratio values below"}
                          </p>
                        </div>

                        {aspectRatioMode === "custom" && (
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[10px] text-[#6b7a90] block mb-1">Width ratio</label>
                              <input type="number" step="0.1" min="0.5" max="10" value={customAspectWidth}
                                onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) setCustomAspectWidth(v) }}
                                onBlur={(e) => { const v = parseFloat(e.target.value); setCustomAspectWidth(isNaN(v) || v < 0.5 ? 1 : Math.min(10, v)) }}
                                className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm text-[#202b40] focus:border-[#2563EB] focus:outline-none"
                                style={{ background: "#d9dadb" }}
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-[#6b7a90] block mb-1">Height ratio</label>
                              <input type="number" step="0.1" min="0.5" max="10" value={customAspectHeight}
                                onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) setCustomAspectHeight(v) }}
                                onBlur={(e) => { const v = parseFloat(e.target.value); setCustomAspectHeight(isNaN(v) || v < 0.5 ? 1 : Math.min(10, v)) }}
                                className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm text-[#202b40] focus:border-[#2563EB] focus:outline-none"
                                style={{ background: "#d9dadb" }}
                              />
                            </div>
                          </div>
                        )}

                        {/* Screen Bottom Height */}
                        {(() => {
                          const CENTER_CH_CLEARANCE = 0.35
                          const needsCenterSpace = screenPlacement === "besideScreen" || mountType === "onWall"
                          const centerFits = !needsCenterSpace || screenBottomFromFloor >= CENTER_CH_CLEARANCE
                          // Range: 24"–60" (0.6096–1.524 m)
                          const recMinM = needsCenterSpace ? Math.max(0.6096, CENTER_CH_CLEARANCE + 0.05) : 0.6096
                          const recMaxM = 1.016  // 40" standard rec max
                          const hardMinM = 0.6096  // 24"
                          const hardMaxM = 1.524   // 60"
                          const inRange = screenBottomFromFloor >= recMinM && screenBottomFromFloor <= recMaxM

                          // Format always in inches or cm — never feet or metres
                          const fmtFloor = (m: number) =>
                            unitSystem === "imperial"
                              ? `${Math.round(m * 39.3701)}"`
                              : `${Math.round(m * 100)} cm`

                          const stepM    = unitSystem === "imperial" ? 0.0254 : 0.05
                          const dispVal  = unitSystem === "imperial"
                            ? Math.round(screenBottomFromFloor * 39.3701)
                            : Math.round(screenBottomFromFloor * 100)
                          const dispMin  = unitSystem === "imperial" ? 24 : 60
                          const dispMax  = unitSystem === "imperial" ? 60 : 152
                          const dispUnit = unitSystem === "imperial" ? "″" : "cm"
                          const recMinDisp = unitSystem === "imperial" ? Math.round(recMinM * 39.3701) : Math.round(recMinM * 100)
                          const recMaxDisp = unitSystem === "imperial" ? Math.round(recMaxM * 39.3701) : Math.round(recMaxM * 100)

                          return (
                            <div>
                              <div className="flex items-center justify-between mb-1.5">
                                <label className="text-xs text-[#202b40]">Screen Bottom from Floor</label>
                                <span className={`text-xs ${inRange ? "text-[#60A5FA]" : "text-amber-400"}`}>
                                  rec {recMinDisp}–{recMaxDisp}{dispUnit}
                                </span>
                              </div>
                              {/* Range slider */}
                              <input type="range"
                                min={hardMinM} max={hardMaxM} step={stepM}
                                value={screenBottomFromFloor}
                                onChange={(e) => setScreenBottomFromFloor(parseFloat(e.target.value))}
                                className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-[#2563EB] mb-2"
                                style={{ background: "#8FA3BC" }}
                              />
                              {/* Number input fine-tune */}
                              <div className="flex items-center gap-2">
                                <input type="number"
                                  step={unitSystem === "imperial" ? 1 : 1}
                                  min={dispMin} max={dispMax}
                                  value={dispVal}
                                  onChange={(e) => {
                                    const v = parseInt(e.target.value)
                                    if (isNaN(v)) return
                                    const m = unitSystem === "imperial" ? v / 39.3701 : v / 100
                                    setScreenBottomFromFloor(Math.max(hardMinM, Math.min(hardMaxM, m)))
                                  }}
                                  className={`flex-1 px-2 py-1.5 border rounded text-sm text-[#202b40] transition focus:outline-none focus:border-[#2563EB] ${
                                    !inRange ? "border-amber-500/40" : "border-[#2563EB]/40"
                                  }`}
                                  style={{ background: "#d9dadb" }}
                                />
                                <span className="text-xs text-[#202b40] w-8">{dispUnit}</span>
                              </div>
                              <p className="text-[10px] text-[#202b40] leading-relaxed mt-1">
                                Bottom {fmtFloor(screenBottomFromFloor)} — top of screen at {fmtFloor(screenBottomFromFloor + screenHeight)}
                                {unitSystem === "imperial"
                                  ? ` (ceiling: ${Math.round(usableRoom.height * 39.3701)}")`
                                  : ` (ceiling: ${Math.round(usableRoom.height * 100)} cm)`}
                              </p>
                              {!centerFits && (
                                <p className="text-xs text-amber-400 mt-1">
                                  ⚠ Center channel needs {fmtFloor(CENTER_CH_CLEARANCE)}+ below screen — raise screen bottom or switch to Behind Screen placement
                                </p>
                              )}
                              {inRange && needsCenterSpace && centerFits && (
                                <p className="text-xs text-[#60A5FA]/70 mt-1">
                                  Center channel clearance ✓ ({fmtFloor(screenBottomFromFloor)} available)
                                </p>
                              )}
                            </div>
                          )
                        })()}

                        {/* Screen Size — Diagonal Selector */}
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <label className="text-xs text-[#202b40]">Screen Size (Diagonal)</label>
                            <span className="text-[10px] text-[#202b40] leading-relaxed">Auto rec: {autoRecDiag}″</span>
                          </div>
                          <select value={screenDiagonalInches}
                            onChange={(e) => setScreenDiagonalInches(parseInt(e.target.value) || 100)}
                            className="w-full px-3 py-2 border border-slate-300 rounded text-sm text-[#202b40] focus:border-[#2563EB] focus:outline-none transition"
                            style={{ background: "#d9dadb" }}
                          >
                            {DIAGONAL_SIZES.map(d => {
                              const fits  = diagFits(d)
                              const isRec = d === autoRecDiag
                              const note  = !fits  ? "Not suitable for room"
                                : isRec             ? "Auto Recommended"
                                : d <= 85           ? "Compact — close seating"
                                : d <= 110          ? "Standard home theater"
                                : d <= 135          ? "Large format — immersive"
                                : d <= 165          ? "Cinema-scale — THX+ recommended"
                                :                     "Mega screen — reference room only"
                              return (
                                <option key={d} value={d}>
                                  {d}″ — {note}
                                </option>
                              )
                            })}
                          </select>

                          {/* Selected size detail in inches/cm only */}
                          <div className="flex items-center justify-between mt-1.5 text-xs">
                            <span className="text-[#202b40]">
                              {unitSystem === "imperial"
                                ? `${(screenWidthMeters * 39.3701).toFixed(1)}″ W × ${(screenHeight * 39.3701).toFixed(1)}″ H (${aspectRatioMode})`
                                : `${(screenWidthMeters * 100).toFixed(0)} cm W × ${(screenHeight * 100).toFixed(0)} cm H (${aspectRatioMode})`}
                            </span>
                            {!screenFitValidation.fits
                              ? <span className="text-amber-400">exceeds room</span>
                              : <span className="text-[#60A5FA]">fits room</span>}
                          </div>
                        </div>

                        {/* Throw Ratio — projector only */}
                        {displayType === "projector" ? (
                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <label className="text-xs text-[#202b40]">Throw Ratio</label>
                              <span className={`text-xs font-medium ${lensType.color}`}>{lensType.label}</span>
                            </div>
                            {/* Range slider for exploration */}
                            <input type="range" min="0.4" max="3.0" step="0.05" value={throwRatio}
                              onChange={(e) => setThrowRatio(parseFloat(e.target.value))}
                              className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-[#2563EB] mb-2"
                              style={{ background: "#8FA3BC" }}
                            />
                            <div className="flex justify-between text-[10px] text-[#202b40] mb-2 -mt-1">
                              <span>0.4 UST</span><span>1.4 Std</span><span>3.0 Long</span>
                            </div>
                            <input type="number" step="0.05" min="0.4" max="3.0" value={throwRatio}
                              onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) setThrowRatio(v) }}
                              onBlur={(e) => { const v = parseFloat(e.target.value); setThrowRatio(isNaN(v) ? 1.4 : Math.max(0.4, Math.min(3.0, v))) }}
                              className={`w-full px-2 py-1.5 border rounded text-sm text-[#202b40] transition focus:outline-none focus:border-[#2563EB] ${
                                !throwValidation.fits || throwRatio < 0.4 || throwRatio > 3.0 ? "border-amber-500/40" : "border-slate-300"
                              }`}
                              style={{ background: "#d9dadb" }}
                            />
                            <p className="text-[10px] text-[#202b40] leading-relaxed mt-1">
                              {throwRatio < 0.4 || throwRatio > 3.0
                                ? "Out of range — valid range is 0.4 – 3.0"
                                : `Projector must be ${fmtM(throwDistance)} from screen — plus 0.3 m mount clearance behind`}
                            </p>
                            <p className="text-[10px] text-[#202b40] leading-relaxed mt-1">
                              Lens shift assumed zero — if your projector has vertical lens shift, mounting height may vary.
                            </p>
                            {/* UST + non-fixed screen warning */}
                            {throwRatio < 0.8 && screenType !== "fixed" && (
                              <p className="text-xs text-amber-400 mt-1">
                                ⚠ Ultra Short Throw projectors require a fixed-frame screen — motorized / retractable screens are incompatible with UST optics
                              </p>
                            )}
                            {/* Throw point inside seating zone */}
                            {throwValidation.fits && throwDistance < seatingCalcs.frontClearance + seatingCalcs.seatingZoneUsed && throwDistance > seatingCalcs.frontClearance && (
                              <p className="text-xs text-amber-400 mt-1">
                                ⚠ Projector position ({fmtM(throwDistance)} from screen) falls inside the seating zone — use a ceiling mount above the seating area or choose a shorter throw ratio
                              </p>
                            )}
                          </div>
                        ) : (
                          <div className="rounded px-3 py-2.5" style={{ background: "#dfe1e3", border: "1.5px solid #8a9ab0" }}>
                            <p className="text-xs text-[#202b40] font-semibold mb-1">Flat Panel — No Throw</p>
                            <p className="text-[10px] text-[#202b40] leading-relaxed">
                              Display mounts flush to front wall. No projector clearance needed — seating distance is set by viewing angle standard only.
                            </p>
                          </div>
                        )}

                        {/* Screen Gain */}
                        <div>
                          <label className="text-[11px] font-semibold text-[#2563EB] block mb-2">Screen Gain</label>
                          <div className="flex gap-2">
                            {([
                              { val: 1.0, label: "1.0 Matte", note: "Widest viewing angle" },
                              { val: 1.3, label: "1.3 Grey", note: "Ambient light rejection" },
                              { val: 0.8, label: "0.8 AT", note: "Acoustically transparent" },
                            ]).map(g => (
                              <button key={g.val} onClick={() => setScreenGain(g.val)}
                                className="flex-1 py-2 text-xs rounded transition text-center"
                                style={screenGain === g.val
                                  ? { background: "#2563EB", color: "#fff", border: "1px solid #2563EB" }
                                  : { background: "#B8C4D6", border: "1px solid #8FA3BC", color: "#202b40" }}
                              >
                                <div className="font-semibold">{g.label}</div>
                                <div className="opacity-70 text-[10px] mt-0.5">{g.note}</div>
                              </button>
                            ))}
                          </div>
                          {screenGain === 0.8 && screenPlacement !== "besideScreen" && (
                            <p className="text-[10px] text-[#202b40] leading-relaxed mt-1">AT screens require speakers positioned directly behind the screen surface</p>
                          )}
                          {screenGain === 0.8 && screenPlacement === "besideScreen" && (
                            <p className="text-[10px] text-amber-400 leading-relaxed mt-1">⚠ AT screen requires speakers behind the screen — incompatible with Beside Screen placement</p>
                          )}
                        </div>

                        {!screenFitValidation.fits && (
                          <p className="text-xs text-amber-400 mt-2">Screen size exceeds available wall space — choose a smaller size</p>
                        )}
                        {!throwValidation.fits && displayType === "projector" && (
                          <p className="text-xs text-amber-400 mt-1">Projector needs {fmtM(throwDistance)} — only {fmtM(throwValidation.maxThrow)} available</p>
                        )}
                      </div>
                    )
                  })()}
              </div>
              </div>
              )}

              {/* ── LIGHTING DESIGN — unlocks after screen Apply ── */}
              {unlockedLevel >= 7 && (
<div style={{ animation: 'sectionSlideIn 0.35s ease-out' }}>
<div className={`rounded-xl p-4 transition-opacity ${!isRoomValid ? "opacity-40 pointer-events-none select-none" : ""}`} style={{ background: "#dfe1e3", border: "1.5px solid #8a9ab0" }}>
  <div className="flex items-center justify-between mb-4">
    <label className="text-[11px] font-bold text-[#202b40] uppercase tracking-widest pl-2 border-l-2 border-[#2563EB]">Lighting Design</label>
    <button
      onClick={() => {
        setLightingZones({
          screenWash:   { enabled: true, fixtureType: "ledStrip", colorTempK: 6500, dimmable: true },
          ceilingCove:  { enabled: true, fixtureType: "ledStrip", colorTempK: 3000, dimmable: true },
          aisleStep:    { enabled: true, fixtureType: "ledStep", colorTempK: 2700, dimmable: true },
          wallSconces:  { enabled: false, fixtureType: "sconce", colorTempK: 3000, dimmable: true },
          starCeiling:  { enabled: false, fixtureType: "fiberOptic", colorTempK: 4000, dimmable: false },
          entryFoyer:   { enabled: true, fixtureType: "downlight", colorTempK: 3000, dimmable: true },
          equipmentRack:{ enabled: true, fixtureType: "ledStrip", colorTempK: 4000, dimmable: false },
        })
        setLightingScenes({
          movie:        { screenWash: 5, ceilingCove: 0, aisleStep: 10, wallSconces: 0, starCeiling: 30, entryFoyer: 0, equipmentRack: 20 },
          intermission: { screenWash: 40, ceilingCove: 60, aisleStep: 50, wallSconces: 80, starCeiling: 50, entryFoyer: 80, equipmentRack: 40 },
          welcome:      { screenWash: 80, ceilingCove: 80, aisleStep: 70, wallSconces: 100, starCeiling: 60, entryFoyer: 100, equipmentRack: 60 },
          cleanup:      { screenWash: 100, ceilingCove: 100, aisleStep: 100, wallSconces: 100, starCeiling: 0, entryFoyer: 100, equipmentRack: 100 },
        })
        setLightingAutomation({ projectorSync: true, playPauseSync: true, occupancySensor: false, scheduleEnabled: false })
      }}
      className="text-[10px] px-2 py-0.5 rounded font-medium transition"
      style={{ background: "#d9dadb", border: "1px solid #2563EB", color: "#2563EB" }}
    >Auto</button>
  </div>

  <div className="space-y-3">

    {/* Zone Toggles */}
    <div>
      <label className="text-[11px] font-semibold text-[#2563EB] block mb-2">Lighting Zones</label>
      <div className="space-y-1.5">
        {([
          { key: "screenWash",    label: "Screen Wall Wash",  desc: "Bias lighting behind screen — reduces eye strain, enhances perceived contrast" },
          { key: "ceilingCove",   label: "Ceiling Cove",      desc: "Indirect uplighting in ceiling perimeter — ambient glow without screen glare" },
          { key: "aisleStep",     label: "Aisle / Step Lights", desc: "Low-level pathway lighting for safety — recessed into risers or floor" },
          { key: "wallSconces",   label: "Wall Sconces",      desc: "Decorative side-wall fixtures — adds architectural character" },
          { key: "starCeiling",   label: "Star Ceiling",      desc: "Fiber optic or LED starfield — premium immersive ceiling effect" },
          { key: "entryFoyer",    label: "Entry / Foyer",     desc: "Transition lighting at room entrance — sets mood before entering" },
          { key: "equipmentRack", label: "Equipment Rack",    desc: "Task lighting for AV rack area — service access without full room lights" },
        ] as const).map(({ key, label, desc }) => (
          <label key={key} className="flex items-start gap-2 cursor-pointer select-none py-1">
            <input type="checkbox"
              checked={lightingZones[key as keyof typeof lightingZones]?.enabled ?? false}
              onChange={() => setLightingZones(prev => ({
                ...prev,
                [key]: { ...prev[key as keyof typeof prev], enabled: !prev[key as keyof typeof prev]?.enabled }
              }))}
              className="accent-[#2563EB] w-3.5 h-3.5 mt-0.5 shrink-0"
            />
            <div>
              <span className="text-xs text-[#202b40] font-medium">{label}</span>
              <p className="text-[10px] text-[#6b7a90] leading-relaxed">{desc}</p>
            </div>
          </label>
        ))}
      </div>
    </div>

    {/* Fixture Details for Enabled Zones */}
    {Object.entries(lightingZones).filter(([, z]) => z?.enabled).length > 0 && (
    <div>
      <label className="text-[11px] font-semibold text-[#2563EB] block mb-2">Fixture Configuration</label>
      <div className="space-y-2">
        {Object.entries(lightingZones).filter(([, z]) => z?.enabled).map(([key, zone]) => {
          const zoneLabels: Record<string, string> = {
            screenWash: "Screen Wall Wash", ceilingCove: "Ceiling Cove", aisleStep: "Aisle / Step",
            wallSconces: "Wall Sconces", starCeiling: "Star Ceiling", entryFoyer: "Entry / Foyer", equipmentRack: "Equipment Rack"
          }
          const fixtureOptions = key === "starCeiling"
            ? [{ key: "fiberOptic", label: "Fiber Optic" }, { key: "ledPanel", label: "LED Panel" }]
            : key === "wallSconces"
            ? [{ key: "sconce", label: "Sconce" }, { key: "spotlight", label: "Spotlight" }]
            : key === "aisleStep"
            ? [{ key: "ledStep", label: "LED Step" }, { key: "recessed", label: "Recessed" }]
            : [{ key: "ledStrip", label: "LED Strip" }, { key: "downlight", label: "Downlight" }]
          return (
            <div key={key} className="rounded px-3 py-2" style={{ background: "#d9dadb", border: "1px solid #8a9ab0" }}>
              <span className="text-[10px] font-semibold text-[#202b40] block mb-1.5">{zoneLabels[key] || key}</span>
              <div className="grid grid-cols-2 gap-2">
                {/* Fixture Type */}
                <div>
                  <span className="text-[10px] text-[#6b7a90] block mb-1">Fixture</span>
                  <div className="flex rounded overflow-hidden" style={{ border: "1px solid #8a9ab0" }}>
                    {fixtureOptions.map(({ key: fk, label: fl }, i) => (
                      <button key={fk} onClick={() => setLightingZones(prev => ({
                        ...prev,
                        [key]: { ...prev[key as keyof typeof prev], fixtureType: fk }
                      }))}
                        className="flex-1 py-1 text-[10px] transition-all"
                        style={{
                          background: zone?.fixtureType === fk ? "#202b40" : "#d9dadb",
                          color:      zone?.fixtureType === fk ? "#ffffff"  : "#202b40",
                          borderRight: i === 0 ? "1px solid #8a9ab0" : "none",
                          fontWeight:  zone?.fixtureType === fk ? 600 : 400,
                        }}
                      >{fl}</button>
                    ))}
                  </div>
                </div>
                {/* Color Temperature */}
                <div>
                  <span className="text-[10px] text-[#6b7a90] block mb-1">Color Temp</span>
                  <div className="flex rounded overflow-hidden" style={{ border: "1px solid #8a9ab0" }}>
                    {([2700, 3000, 4000, 6500] as const).map((t, i, arr) => (
                      <button key={t} onClick={() => setLightingZones(prev => ({
                        ...prev,
                        [key]: { ...prev[key as keyof typeof prev], colorTempK: t }
                      }))}
                        className="flex-1 py-1 text-[10px] transition-all"
                        style={{
                          background: zone?.colorTempK === t ? "#202b40" : "#d9dadb",
                          color:      zone?.colorTempK === t ? "#ffffff"  : "#202b40",
                          borderRight: i < arr.length - 1 ? "1px solid #8a9ab0" : "none",
                          fontWeight:  zone?.colorTempK === t ? 600 : 400,
                        }}
                      >{t >= 1000 ? `${(t/1000).toFixed(t % 1000 === 0 ? 0 : 1)}K` : t}</button>
                    ))}
                  </div>
                </div>
              </div>
              {/* Dimmable toggle */}
              <label className="flex items-center gap-2 mt-1.5 cursor-pointer select-none">
                <input type="checkbox"
                  checked={zone?.dimmable ?? false}
                  onChange={() => setLightingZones(prev => ({
                    ...prev,
                    [key]: { ...prev[key as keyof typeof prev], dimmable: !prev[key as keyof typeof prev]?.dimmable }
                  }))}
                  className="accent-[#2563EB] w-3 h-3"
                />
                <span className="text-[10px] text-[#202b40]">Dimmable</span>
              </label>
            </div>
          )
        })}
      </div>
    </div>
    )}

    {/* 3D Preview Scene Selector */}
    <div className="mb-3">
      <label className="text-[11px] font-semibold text-[#2563EB] block mb-2">3D Preview Scene</label>
      <div className="flex rounded overflow-hidden" style={{ border: "1px solid #8a9ab0" }}>
        {(["movie", "intermission", "welcome", "cleanup"] as const).map(s => (
          <button key={s} onClick={() => setActiveScene(s)}
            className="flex-1 py-1.5 text-[10px] font-medium transition-colors"
            style={{
              background: activeScene === s ? "#202b40" : "#d9dadb",
              color: activeScene === s ? "#fff" : "#202b40",
              borderRight: s !== "cleanup" ? "1px solid #8a9ab0" : "none",
            }}
          >{s.charAt(0).toUpperCase() + s.slice(1)}</button>
        ))}
      </div>
      <p className="text-[10px] text-[#6b7a90] mt-1">Controls which lighting scene is shown in the 3D view</p>
    </div>

    {/* Lighting Scenes */}
    <div>
      <label className="text-[11px] font-semibold text-[#2563EB] block mb-2">Scene Presets</label>
      <div className="space-y-2">
        {([
          { key: "movie",        label: "Movie",        icon: "🎬", desc: "Lights down — minimal bias lighting, step lights at 10%" },
          { key: "intermission", label: "Intermission", icon: "⏸",  desc: "Partial lights — comfortable level for breaks" },
          { key: "welcome",      label: "Welcome",      icon: "👋", desc: "Full ambience — all zones at high levels for guest entry" },
          { key: "cleanup",      label: "Cleanup",      icon: "🧹", desc: "All lights 100% — full visibility for maintenance" },
        ] as const).map(({ key, label, icon, desc }) => (
          <div key={key} className="rounded px-3 py-2" style={{ background: "#d9dadb", border: "1px solid #8a9ab0" }}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm">{icon}</span>
              <span className="text-xs font-semibold text-[#202b40]">{label}</span>
            </div>
            <p className="text-[10px] text-[#6b7a90] leading-relaxed">{desc}</p>
            <div className="grid grid-cols-4 gap-1 mt-1.5">
              {Object.entries(lightingZones).filter(([, z]) => z?.enabled).slice(0, 4).map(([zKey]) => {
                const sceneVal = lightingScenes[key as keyof typeof lightingScenes]?.[zKey as keyof typeof lightingScenes["movie"]] ?? 0
                const shortLabels: Record<string, string> = {
                  screenWash: "Screen", ceilingCove: "Cove", aisleStep: "Aisle",
                  wallSconces: "Sconce", starCeiling: "Stars", entryFoyer: "Entry", equipmentRack: "Rack"
                }
                return (
                  <div key={zKey} className="text-center">
                    <span className="text-[9px] text-[#6b7a90] block">{shortLabels[zKey] || zKey}</span>
                    <input type="range" min="0" max="100" step="5" value={sceneVal}
                      onChange={(e) => setLightingScenes(prev => ({
                        ...prev,
                        [key]: { ...prev[key as keyof typeof prev], [zKey]: parseInt(e.target.value) }
                      }))}
                      className="w-full h-1.5 rounded-lg appearance-none cursor-pointer accent-[#2563EB]"
                      style={{ background: "#8FA3BC" }}
                    />
                    <span className="text-[9px] text-[#60A5FA] font-mono">{sceneVal}%</span>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>

    {/* Automation */}
    <div>
      <label className="text-[11px] font-semibold text-[#2563EB] block mb-2">Automation</label>
      <div className="space-y-1.5">
        {([
          { key: "projectorSync",  label: "Projector Power Sync",     desc: "Auto-dim to Movie scene when projector turns on" },
          { key: "playPauseSync",  label: "Play / Pause Sync",        desc: "Raise lights on pause, dim on play — via CEC or IP control" },
          { key: "occupancySensor",label: "Occupancy Sensor",         desc: "Fade to Welcome scene on room entry, off after timeout" },
          { key: "scheduleEnabled",label: "Time-Based Schedule",      desc: "Automatic scene changes based on time of day" },
        ] as const).map(({ key, label, desc }) => (
          <label key={key} className="flex items-start gap-2 cursor-pointer select-none py-1">
            <input type="checkbox"
              checked={lightingAutomation[key as keyof typeof lightingAutomation] ?? false}
              onChange={() => setLightingAutomation(prev => ({
                ...prev,
                [key]: !prev[key as keyof typeof prev]
              }))}
              className="accent-[#2563EB] w-3.5 h-3.5 mt-0.5 shrink-0"
            />
            <div>
              <span className="text-xs text-[#202b40] font-medium">{label}</span>
              <p className="text-[10px] text-[#6b7a90] leading-relaxed">{desc}</p>
            </div>
          </label>
        ))}
      </div>
    </div>

  </div>
</div>
</div>
)}

          </div>
        </div>

        {/* CENTER WORKSPACE */}
        <div className="flex flex-col overflow-hidden order-2 lg:order-none" style={{ background: "#d9dadb" }}>

          <div className="sticky top-[60px] z-40 px-6 py-3 flex items-center gap-4" style={{ background: "#d9dadb", borderBottom: "2px solid #8a9ab0" }}>
            <div className="flex items-center gap-2 w-32 shrink-0">
              {!view3D ? (
                <>
                  <span className="text-xs text-[#202b40]">Zoom:</span>
                  <span className="text-sm font-mono text-[#202b40]">{(scale * 100).toFixed(0)}%</span>
                </>
              ) : (
                <span className="text-xs text-[#202b40] select-none">Drag · Scroll · 360°</span>
              )}
            </div>
            <div className="flex-1" />
            {!view3D && (
              <>
                <button onClick={resetView} className="px-3 py-1 text-xs text-[#202b40] hover:text-[#202b40] transition">Reset</button>
                <button onClick={fitToRoom}  className="px-3 py-1 text-xs text-[#202b40] hover:text-[#202b40] transition">Fit</button>
              </>
            )}
            {view3D && (
              <div className="flex items-center gap-1 flex-wrap">
{(['Screen','Left','Right','Back','Ceiling','Floor'] as const).map(v => (
                  <button
                    key={v}
                    onClick={() => goToView(v.toLowerCase())}
                    className="px-2 py-0.5 text-xs rounded border border-slate-300 text-[#202b40] hover:text-[#202b40] hover:bg-white/[0.04] hover:border-slate-300 transition"
                  >{v}</button>
                ))}
              </div>
            )}
            {view3D && (
              <div className="flex items-center gap-1.5" title="3D room colour">
                {([
                  { id: "obsidian", bg: "#111418" },
                  { id: "navy",     bg: "#0c1a35" },
                  { id: "slate",    bg: "#2c3640" },
                  { id: "charcoal", bg: "#252525" },
                ] as const).map(({ id, bg }) => (
                  <button
                    key={id}
                    title={{ obsidian: "Acoustic Black", navy: "Midnight Velvet", slate: "Slate Stone", charcoal: "Carbon Felt" }[id]}
                    onClick={() => setRoomColorScheme(id)}
                    className="w-5 h-5 rounded-sm transition"
                    style={{
                      background: bg,
                      border: roomColorScheme === id ? "2px solid #2563EB" : "2px solid transparent",
                      outline: roomColorScheme === id ? "1px solid #60A5FA" : "none",
                      outlineOffset: "1px",
                    }}
                  />
                ))}
              </div>
            )}

            <div className="flex rounded overflow-hidden" style={{ border: "1.5px solid #8a9ab0" }}>
              {(["2D", "3D"] as const).map(v => (
                <button key={v} onClick={() => setView3D(v === "3D")}
                  className="px-3 py-1 text-xs transition font-medium"
                  style={view3D === (v === "3D")
                    ? { background: "#2563EB", color: "#fff" }
                    : { background: "#d9dadb", color: "#202b40" }}
                >{v}</button>
              ))}
            </div>
          </div>

          {scene.phaseAlignments.length > 0 && (
            <div className="px-6 py-2 text-xs" style={{ background: "#d9dadb", borderBottom: "2px solid #8a9ab0" }}>
              <span className="text-[#202b40] font-semibold block mb-1">Sub phase alignment</span>
              <div className="flex flex-wrap gap-x-4 gap-y-0.5">
                {scene.phaseAlignments.map(p => (
                  <span key={p.subId} className="font-mono text-[#60A5FA]">
                    {p.subId}: {p.phaseDifference.toFixed(1)}° — {p.delaySuggestion.toFixed(1)} ms
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="flex-1 overflow-hidden rounded-none" style={{ background: "#d9dadb" }}>
            {!isRoomValid && (
              <div className="flex flex-col items-center justify-center h-full gap-3 select-none" style={{ minHeight: 320 }}>
                <div className="text-4xl opacity-30">📐</div>
                <p className="text-sm text-[#202b40] font-medium">Enter room dimensions to preview</p>
                <p className="text-[11px] text-[#202b40]">Width · Length · Ceiling Height</p>
              </div>
            )}
            {isRoomValid && view3D && (
              <TheatreView3D
                room={clampedRoom}
                acousticDepths={committed.acousticDepthMeters}
                panelLayout={panelLayout}
                screenWidth={Math.min(screenWidthMeters, screenFitValidation.clampedScreenWidth)}
                screenHeight={screenHeight}
                screenBottomFromFloor={committed.screenBottomFromFloor}
                displayType={committed.displayType}
                throwDistance={throwDistance}
                mountType={committed.mountType}
                screenPlacement={committed.screenPlacement}
                speakers={scene.speakers}
                viewPreset={viewPreset}
                extraSidePairs={committed.extraSidePairs}
                extraCeilingPairs={committed.extraCeilingPairs}
                subCount={committed.subCount}
                subPlacement={committed.subPlacement}
                subEnclosure={committed.subType}
                seatingRowCount={seatingCalcs.rowCount}
                seatsPerRow={seatingCalcs.seatsPerRow}
                riserStepM={seatingCalcs.riserStepM}
                frontClearance={seatingCalcs.frontClearance}
                rowPitchM={seatingCalcs.rowDepth}
                primaryRow={Math.max(0, Math.min(committed.primaryRow, seatingCalcs.rowCount - 1))}
                usableWidth={seatingCalcs.usableWidth}
                designIntent={committed.designIntent}
                treatmentLevel={committed.treatmentLevel}
                roomColorScheme={roomColorScheme}
                wallConstruction={committed.wallConstruction}
                aisleConfig={committed.aisleConfig}
                aisleWidthM={committed.aisleWidthM}
                lightingZones={lightingZones}
                lightingSceneBrightness={lightingScenes[activeScene]}
              />
            )}
            {isRoomValid && !view3D && (
            <svg
              ref={svgRef}
              width="100%" height="100%"
              style={{ background: "#d9dadb", cursor: isDragging.current ? "grabbing" : "grab" }}
              onWheel={handleWheel}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              <g transform={`translate(${offset.x}, ${offset.y}) scale(${scale})`}>
                <rect x={0} y={0}
                  width={scene.room.width * BASE_SCALE}
                  height={scene.room.length * BASE_SCALE}
                  fill="#E2E8F0" stroke="#2A3A52" strokeWidth={2}
                />

                {scene.objects.map((obj: SceneObject, idx: number) => {
                  const x = obj.x * BASE_SCALE
                  const y = obj.y * BASE_SCALE

                  if (obj.type === "seat") {
                    return <circle key={idx} cx={x} cy={y} r={8} fill="#202b40" opacity={0.8} />
                  }

                  if (obj.type === "speaker") {
                    const ch = (obj.channel || "").toUpperCase()
                    const speakerColor = (() => {
                      if (["FL","FR","C","L","R"].includes(ch))                                    return "#00D9FF"
                      if (["SL","SR","RL","RR","BL","BR","SBL","SBR"].includes(ch))               return "#60A5FA"
                      if (/^T(FL|FR|ML|MR|RL|RR)$/.test(ch))                                      return "#34D399"
                      return "#202b40"
                    })()
                    return (
                      <g key={idx}>
                        <rect x={x - 6} y={y - 6} width={12} height={12} fill={speakerColor} opacity={0.9} />
                        <text x={x} y={y + 20} textAnchor="middle" fontSize={10} fill={speakerColor} pointerEvents="none">
                          {ch}
                        </text>
                      </g>
                    )
                  }

                  if (obj.type === "subwoofer") {
                    return (
                      <g key={idx}>
                        <rect x={x - 8} y={y - 8} width={16} height={16} fill="#FBBF24" opacity={0.9} rx={2} />
                        <text x={x} y={y + 22} textAnchor="middle" fontSize={10} fill="#FBBF24" pointerEvents="none">SUB</text>
                      </g>
                    )
                  }

                  if (obj.type === "screen") {
                    const w = (obj.width ?? 3) * BASE_SCALE
                    const h = (obj.height ?? 1.5) * BASE_SCALE
                    return (
                      <rect key={idx}
                        x={x - w / 2} y={y} width={w} height={h}
                        fill="none" stroke="#4a7f7e" strokeWidth={3} opacity={0.7}
                      />
                    )
                  }
                  return null
                })}

                {/* Extended side surrounds — auto-calculated (maxExtraSidePairs) */}
                {extraSidePairs > 0 && (() => {
                  const roomW  = scene.room.width  * BASE_SCALE
                  const pZ     = (scene.listeners[0]?.y ?? scene.room.length * 0.45) * BASE_SCALE  // primary listener Y in SVG
                  const rearY  = (scene.room.length - (committed.acousticDepthMeters.rear)) * BASE_SCALE
                  const slX    = (committed.acousticDepthMeters.left  + 0.19) * BASE_SCALE
                  const srX    = roomW - (committed.acousticDepthMeters.right + 0.19) * BASE_SCALE
                  const nodes: React.ReactNode[] = []
                  for (let i = 0; i < extraSidePairs; i++) {
                    const frac = extraSidePairs === 1 ? 0.65 : 0.45 + (i / (extraSidePairs - 1)) * 0.45
                    const yPos = pZ + frac * (rearY - pZ)
                    nodes.push(
                      <g key={`xsl-${i}`}>
                        <rect x={slX - 6} y={yPos - 5} width={10} height={10} fill="#818CF8" opacity={0.85} />
                        <text x={slX - 10} y={yPos + 4} textAnchor="end" fontSize={8} fill="#818CF8" pointerEvents="none">SL{i+2}</text>
                      </g>,
                      <g key={`xsr-${i}`}>
                        <rect x={srX - 4} y={yPos - 5} width={10} height={10} fill="#818CF8" opacity={0.85} />
                        <text x={srX + 10} y={yPos + 4} textAnchor="start" fontSize={8} fill="#818CF8" pointerEvents="none">SR{i+2}</text>
                      </g>
                    )
                  }
                  return nodes
                })()}

                {/* Extended ceiling / Atmos — auto-calculated (maxExtraCeilingPairs) */}
                {extraCeilingPairs > 0 && (() => {
                  const uzStart = committed.acousticDepthMeters.front * BASE_SCALE + 3
                  const uzEnd   = (scene.room.length - committed.acousticDepthMeters.rear) * BASE_SCALE - 3
                  const nodes: React.ReactNode[] = []
                  const roomW = scene.room.width * BASE_SCALE
                  for (let i = 0; i < extraCeilingPairs; i++) {
                    const frac  = extraCeilingPairs === 1 ? 0.50 : 0.20 + (i / (extraCeilingPairs - 1)) * 0.60
                    const yPos  = uzStart + frac * (uzEnd - uzStart)
                    const xFrac = 0.22 + (i / Math.max(1, extraCeilingPairs - 1)) * 0.06
                    const xL    = roomW * xFrac
                    const xR    = roomW * (1 - xFrac)
                    nodes.push(
                      <g key={`xatl-${i}`}>
                        <circle cx={xL} cy={yPos} r={6} fill="none" stroke="#34D399" strokeWidth={1.5} strokeDasharray="3,2" opacity={0.8} />
                        <text x={xL} y={yPos + 14} textAnchor="middle" fontSize={8} fill="#34D399" pointerEvents="none">ATL{i+1}</text>
                      </g>,
                      <g key={`xatr-${i}`}>
                        <circle cx={xR} cy={yPos} r={6} fill="none" stroke="#34D399" strokeWidth={1.5} strokeDasharray="3,2" opacity={0.8} />
                        <text x={xR} y={yPos + 14} textAnchor="middle" fontSize={8} fill="#34D399" pointerEvents="none">ATR{i+1}</text>
                      </g>
                    )
                  }
                  return nodes
                })()}

                {/* ── 2D Treatment Overlays (from panelLayout) ── */}
                {isRoomValid && (() => {
                  const BS = BASE_SCALE
                  const RW = scene.room.width  * BS
                  const RL = scene.room.length * BS
                  const traps  = panelLayout.traps
                  const panels = panelLayout.panels
                  const leg = traps[0]?.leg ?? 0
                  const nodes: React.ReactNode[] = []

                  // Bass trap triangles — 4 corners
                  if (leg > 0.01) {
                    const L2 = leg * BS
                    nodes.push(
                      <polygon key="trap-FL" points={`0,0 ${L2},0 0,${L2}`}
                        fill="#3B4A6B" opacity={0.55} />,
                      <polygon key="trap-FR" points={`${RW},0 ${RW-L2},0 ${RW},${L2}`}
                        fill="#3B4A6B" opacity={0.55} />,
                      <polygon key="trap-RL" points={`0,${RL} ${L2},${RL} 0,${RL-L2}`}
                        fill="#3B4A6B" opacity={0.55} />,
                      <polygon key="trap-RR" points={`${RW},${RL} ${RW-L2},${RL} ${RW},${RL-L2}`}
                        fill="#3B4A6B" opacity={0.55} />
                    )
                  }

                  // Panel zones
                  for (const panel of panels) {
                    const { surface, type, zone } = panel
                    const isDiffuser = type !== 'absorber'
                    const fillColor  = isDiffuser ? '#34D399' : '#60A5FA'
                    const fillOp     = isDiffuser ? 0.45 : 0.38
                    const minDepthPx = Math.max(4, zone.depth * BS)

                    if (surface === 'front') {
                      // Thin band at top (y=0), width spans zone.u → zone.u+zone.uw
                      nodes.push(
                        <rect key={`p-${panel.id}`}
                          x={zone.u * BS} y={0}
                          width={zone.uw * BS} height={minDepthPx}
                          fill={fillColor} opacity={fillOp} />
                      )
                    }
                    else if (surface === 'rear') {
                      const isDiff = isDiffuser
                      const fillR = isDiff ? '#34D399' : '#60A5FA'
                      nodes.push(
                        <rect key={`p-${panel.id}`}
                          x={zone.u * BS} y={RL - minDepthPx}
                          width={zone.uw * BS} height={minDepthPx}
                          fill={fillR} opacity={isDiff ? 0.55 : 0.38}
                        />,
                        // Diffuser hatch lines
                        ...(isDiff ? Array.from({ length: Math.ceil(zone.uw * BS / 6) }, (_, i) => (
                          <line key={`ph-${panel.id}-${i}`}
                            x1={zone.u * BS + i * 6} y1={RL - minDepthPx}
                            x2={zone.u * BS + i * 6} y2={RL}
                            stroke="#34D399" strokeWidth={1} opacity={0.6} />
                        )) : [])
                      )
                    }
                    else if (surface === 'left') {
                      // zone.u = world Z start, zone.uw = length along Z, thin left strip
                      nodes.push(
                        <rect key={`p-${panel.id}`}
                          x={0} y={zone.u * BS}
                          width={minDepthPx} height={zone.uw * BS}
                          fill={fillColor} opacity={fillOp} />
                      )
                    }
                    else if (surface === 'right') {
                      nodes.push(
                        <rect key={`p-${panel.id}`}
                          x={RW - minDepthPx} y={zone.u * BS}
                          width={minDepthPx} height={zone.uw * BS}
                          fill={fillColor} opacity={fillOp} />
                      )
                    }
                    else if (surface === 'ceiling') {
                      // Top-down ceiling cloud — frosted panel floating above room
                      // zone.u = worldX, zone.v = worldZ, zone.uw = W, zone.vh = L
                      nodes.push(
                        <rect key={`p-${panel.id}-fill`}
                          x={zone.u * BS} y={zone.v * BS}
                          width={zone.uw * BS} height={zone.vh * BS}
                          fill="#818CF8" opacity={0.18} />,
                        <rect key={`p-${panel.id}`}
                          x={zone.u * BS} y={zone.v * BS}
                          width={zone.uw * BS} height={zone.vh * BS}
                          fill="none" stroke="#818CF8" strokeWidth={1.5}
                          strokeDasharray="5,3" opacity={0.75} />,
                        <text key={`pl-${panel.id}`}
                          x={zone.u * BS + zone.uw * BS / 2}
                          y={zone.v * BS + zone.vh * BS / 2}
                          textAnchor="middle" fontSize={8} fill="#818CF8" opacity={0.9}
                          pointerEvents="none">cloud</text>
                      )
                    }
                  }

                  return <>{nodes}</>
                })()}

                {/* Speaker lines from primary seat */}
                {primarySeat &&
                  scene.objects
                    .filter(o => o.type === "speaker" && !/^T(FL|FR|ML|MR|RL|RR)$/i.test(o.channel ?? ""))
                    .map((speaker, idx) => {
                      const sx = speaker.x * BASE_SCALE
                      const sy = speaker.y * BASE_SCALE
                      const alpha = calculateAngle(sx, sy)
                      return (
                        <g key={idx}>
                          <line x1={listenerX} y1={listenerY} x2={sx} y2={sy}
                            stroke="#2A3A52" strokeWidth={0.5} opacity={0.6} strokeDasharray="2,2"
                          />
                          <text x={(listenerX + sx) / 2} y={(listenerY + sy) / 2 - 5}
                            fontSize={9} fill="#202b40" pointerEvents="none">
                            {alpha}°
                          </text>
                        </g>
                      )
                    })}
              </g>

              {/* ── 2D Legend (fixed position, outside transform) ── */}
              <g transform="translate(12, 12)">
                {[
                  { color: "#00D9FF", shape: "rect", label: "LCR"         },
                  { color: "#60A5FA", shape: "rect", label: "Surrounds"   },
                  { color: "#34D399", shape: "circle", label: "Overhead"  },
                  { color: "#FBBF24", shape: "rect", label: "Sub (SUB)"  },
                  { color: "#818CF8", shape: "rect", label: "Extra Surr." },
                  { color: "#60A5FA", shape: "panel", label: "Treatment"  },
                  { color: "#3B4A6B", shape: "panel", label: "Bass Traps" },
                  { color: "#818CF8", shape: "cloud", label: "Ceiling Cloud"},
                ].map(({ color, shape, label }, i) => (
                  <g key={label} transform={`translate(0, ${i * 16})`}>
                    {shape === "circle"
                      ? <circle cx={5} cy={5} r={4} fill="none" stroke={color} strokeWidth={1.5} strokeDasharray="3,2" />
                      : shape === "cloud"
                      ? <><rect x={1} y={1} width={8} height={8} fill={color} opacity={0.18} /><rect x={1} y={1} width={8} height={8} fill="none" stroke={color} strokeWidth={1} strokeDasharray="3,2" opacity={0.75}/></>
                      : shape === "panel"
                      ? <rect x={1} y={1} width={8} height={8} fill={color} opacity={0.45} />
                      : <rect x={1} y={1} width={8} height={8} fill={color} opacity={0.85} />
                    }
                    <text x={14} y={9} fontSize={9} fill={color} opacity={0.9}>{label}</text>
                  </g>
                ))}
              </g>

              {/* ── Room dimension labels (fixed bottom-left, outside transform) ── */}
              {isRoomValid && (() => {
                const W = scene.room.width
                const L = scene.room.length
                const labelW = unitSystem === "imperial"
                  ? `${(W * 3.28084).toFixed(1)} ft`
                  : `${W.toFixed(2)} m`
                const labelL = unitSystem === "imperial"
                  ? `${(L * 3.28084).toFixed(1)} ft`
                  : `${L.toFixed(2)} m`
                return (
                  <g>
                    <text x="50%" y="98%" textAnchor="middle" fontSize={10} fill="#202b40" opacity={0.6} pointerEvents="none">
                      W {labelW} × L {labelL}
                    </text>
                  </g>
                )
              })()}

            </svg>
            )}
          </div>
        </div>

        {/* RIGHT SIDEBAR */}
        <div className="border-b lg:border-b-0 lg:border-l-0 overflow-y-auto order-3 lg:order-none max-h-[70vh] lg:max-h-full" style={{ background: "#d9dadb", borderLeft: "3px solid #8a9ab0" }}>

          {/* Tab bar */}
          <div className="sticky top-0 z-10 flex" style={{ background: "#d9dadb", borderBottom: "2px solid #8a9ab0" }}>
            {(["suggestions","acoustics","seating","screen","engineering"] as const).map(tab => (
              <button key={tab} onClick={() => setRightPanelTab(tab)}
                className="flex-1 py-2.5 text-xs font-semibold capitalize transition"
                style={rightPanelTab === tab
                  ? { color: "#60A5FA", borderBottom: "2px solid #2563EB" }
                  : { color: "#202b40", borderBottom: "2px solid transparent" }}
              >
                {tab === "suggestions" ? "Advice" : tab === "acoustics" ? "Acoustics" : tab === "screen" ? "Screen" : tab === "seating" ? "Seating" : "Room"}
              </button>
            ))}
          </div>

          <div className="p-4 space-y-3">

            {/* ── ACOUSTICS TAB ── */}
            {rightPanelTab === "acoustics" && (!acousticResult ? (
              <div className="text-xs text-[#202b40] text-center py-12">Enter room dimensions to see analysis</div>
            ) : (
              <>
                {/* RT60 Status */}
                <div className={`rounded border px-3 py-2.5 space-y-1.5 ${
                  rt60Status === "optimal" ? "border-[#2563EB]/20" : "border-amber-500/20"
                }`} style={{ background: rt60Status === "optimal" ? "rgba(37,99,235,0.05)" : "rgba(245,158,11,0.05)" }}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[11px] font-semibold text-[#2563EB] uppercase tracking-wide">RT60 Outcome</span>
                    <span className={`font-mono font-bold ${rt60Status === "optimal" ? "text-[#60A5FA]" : "text-amber-400"}`}>
                      {acousticResult.rt60Seconds.toFixed(2)} s
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-[#202b40]">Target ({rt60Target.label})</span>
                    <span className="text-[#202b40]">{targetRT60Min}–{targetRT60Max} s</span>
                  </div>
                  <div className="text-xs pt-1 border-t border-white/[0.05]">
                    {rt60Status === "optimal"    && <span className="text-[#60A5FA]">✓ On target</span>}
                    {rt60Status === "overdamped" && <span className="text-amber-400">Over-treated — reduce depth</span>}
                    {rt60Status === "tooLive"    && <span className="text-amber-400">Under-treated — increase depth</span>}
                  </div>
                </div>

                {/* Wall Construction Impact */}
                {(() => {
                  const mc     = WALL_MATERIAL_COEFF[committed.wallConstruction] ?? WALL_MATERIAL_COEFF.drywall
                  const labels: Record<string, string> = {
                    drywall:  'Drywall / Plasterboard',
                    masonry:  'Concrete / Brick / Masonry',
                    timber:   'Timber / Wood Frame',
                  }
                  // Contextual note based on hardness
                  const note =
                    mc.wall <= 0.03 ? 'Very hard surfaces — low natural absorption. Treatment must compensate for full room reflectivity.'
                    : mc.wall >= 0.08 ? 'Naturally absorptive structure — reduces treatment demand. Auto accounts for this.'
                    : 'Moderate base absorption — standard treatment sizing applies.'
                  const noteColor =
                    mc.wall <= 0.03 ? '#f59e0b'
                    : mc.wall >= 0.08 ? '#34D399'
                    : '#8a9ab0'
                  const rows = [
                    { label: 'Walls',   val: mc.wall    },
                    { label: 'Ceiling', val: mc.ceiling },
                    { label: 'Floor',   val: mc.floor   },
                  ]
                  return (
                    <div className="rounded px-3 py-2.5" style={{ background: "#dfe1e3", border: "1.5px solid #8a9ab0" }}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-semibold text-[#2563EB] uppercase tracking-wide">Wall Construction</span>
                        <span className="text-[10px] font-medium text-[#202b40]">{labels[committed.wallConstruction]}</span>
                      </div>
                      <div className="space-y-1.5 mb-2">
                        {rows.map(({ label, val }) => (
                          <div key={label} className="flex items-center gap-2">
                            <span className="text-[10px] text-[#6b7a90] w-12 shrink-0">{label}</span>
                            <div className="flex-1 h-1 rounded-full" style={{ background: '#b8bfc9' }}>
                              <div className="h-full rounded-full" style={{
                                width: `${Math.min(100, (val / 0.12) * 100)}%`,
                                background: val <= 0.03 ? '#f59e0b' : val >= 0.08 ? '#34D399' : '#60A5FA'
                              }}/>
                            </div>
                            <span className="text-[10px] font-mono text-[#202b40] w-8 text-right shrink-0">
                              {val.toFixed(3)}
                            </span>
                          </div>
                        ))}
                      </div>
                      <p className="text-[9px] leading-relaxed" style={{ color: noteColor }}>{note}</p>
                    </div>
                  )
                })()}
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded px-3 py-2" style={{ background: "#dfe1e3", border: "1.5px solid #8a9ab0" }}>
                    <div className="text-xs text-[#202b40]">Acoustic Score</div>
                    <div className="text-lg font-semibold text-[#202b40]">{acousticResult.acousticScore}</div>
                    <div className="text-[10px] text-[#202b40] leading-relaxed">/ 100</div>
                  </div>
                  <div className="rounded px-3 py-2" style={{ background: "#dfe1e3", border: "1.5px solid #8a9ab0" }}>
                    <div className="text-xs text-[#202b40]">Schroeder</div>
                    <div className="text-lg font-semibold text-[#202b40]">{acousticResult.schroederFrequencyHz.toFixed(0)}</div>
                    <div className="text-[10px] text-[#202b40] leading-relaxed">Hz</div>
                  </div>
                </div>

                {/* Modal Intelligence */}
                <div className="rounded px-3 py-2.5" style={{ background: "#dfe1e3", border: "1.5px solid #8a9ab0" }}>
                  <div className="text-xs text-[#202b40] mb-2">Modal Analysis</div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-[#202b40]">Risk</span>
                    <span className="text-[#202b40] capitalize">{acousticResult.modalRiskLevel}</span>
                  </div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-[#202b40]">Modes evaluated</span>
                    <span className="text-[#60A5FA]">{acousticResult.modeCount}</span>
                  </div>
                  {worstCluster && (
                    <>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-[#202b40]">Worst cluster</span>
                        <span className="text-[#60A5FA]">{worstCluster.centerFrequencyHz?.toFixed(0)} Hz</span>
                      </div>
                      <div className="w-full h-1.5 rounded overflow-hidden mt-2" style={{ background: "#c4c6c8" }}>
                        <div className="h-full bg-gradient-to-r from-green-400 via-yellow-400 to-red-500"
                          style={{ width: `${clusterRiskPercent}%` }} />
                      </div>
                    </>
                  )}
                  {!worstCluster && <span className="text-xs text-green-400">No critical clustering</span>}
                </div>

                {/* Treatment Recommendation */}
                <div className="rounded px-3 py-2.5" style={{ background: "#dfe1e3", border: "1.5px solid #8a9ab0" }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-[#202b40]">Treatment Priority</span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                      acousticResult.recommendedTreatment.priority === "critical" ? "text-red-500 bg-red-500/10" :
                      acousticResult.recommendedTreatment.priority === "high"     ? "text-orange-400 bg-orange-400/10" :
                      acousticResult.recommendedTreatment.priority === "moderate" ? "text-yellow-400 bg-yellow-400/10" :
                      "text-green-400 bg-green-400/10"
                    }`}>
                      {acousticResult.recommendedTreatment.priority.charAt(0).toUpperCase() + acousticResult.recommendedTreatment.priority.slice(1)}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 mb-2">
                    {acousticResult.recommendedTreatment.bassTrapRequired   && <div className="text-xs text-green-400">✓ Bass Traps</div>}
                    {acousticResult.recommendedTreatment.broadbandRequired  && <div className="text-xs text-green-400">✓ Broadband</div>}
                    {acousticResult.recommendedTreatment.diffusionRequired  && <div className="text-xs text-green-400">✓ Diffusion</div>}
                    {acousticResult.recommendedTreatment.ceilingCloudRequired && <div className="text-xs text-green-400">✓ Ceiling Cloud</div>}
                  </div>
                  <p className="text-[10px] text-[#202b40] leading-relaxed">{acousticResult.recommendedTreatment.explanation}</p>
                </div>

                {/* Material Specification — Full Construction Stack */}
                <div className="rounded px-3 py-2.5 space-y-2.5" style={{ background: "#dfe1e3", border: "1.5px solid #8a9ab0" }}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-[11px] font-semibold text-[#2563EB]">
                      Materials — {committed.treatmentLevel.charAt(0).toUpperCase()+committed.treatmentLevel.slice(1)} · {committed.designIntent.charAt(0).toUpperCase()+committed.designIntent.slice(1)}
                    </div>
                    <div className="text-[9px] text-[#6b7a90] font-medium">
                      Frame: {FRAME_SPEC[committed.treatmentLevel] ?? '—'}
                    </div>
                  </div>

                  {([...(['front','rear','sides','ceiling','floor'] as const), ...(committed.treatmentLevel === 'high' ? ['bastrap' as const] : [])]).map(s => {
                    const m = getMaterial(committed.treatmentLevel, committed.designIntent, s)
                    const PANEL_BADGE: Record<string, { label: string; bg: string; fg: string }> = {
                      absorber:  { label: 'ABS', bg: '#2563EB20', fg: '#2563EB' },
                      diffuser:  { label: 'DIF', bg: '#8b5cf620', fg: '#8b5cf6' },
                      reflector: { label: 'REF', bg: '#b4530920', fg: '#b45309' },
                      bastrap:   { label: 'TRAP', bg: '#ef444420', fg: '#ef4444' },
                      bare:      { label: 'BARE', bg: '#8a9ab020', fg: '#8a9ab0' },
                      floor:     { label: 'FLR', bg: '#60687820', fg: '#606878' },
                    }
                    const badge = PANEL_BADGE[m.panelType] ?? PANEL_BADGE.bare
                    const surfLabel = s === 'bastrap' ? 'Traps' : s.charAt(0).toUpperCase() + s.slice(1)
                    return (
                      <div key={s} className="pb-2 border-b border-slate-300/40 last:border-0 last:pb-0">
                        {/* Header row: surface, badge, NRC */}
                        <div className="flex items-center justify-between gap-1.5 mb-0.5">
                          <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-sm shrink-0" style={{ background: m.color }}/>
                            <span className="text-[10px] font-bold text-[#202b40]">{surfLabel}</span>
                            <span className="text-[8px] font-bold px-1 py-px rounded" style={{ background: badge.bg, color: badge.fg }}>{badge.label}</span>
                          </div>
                          {m.nrc > 0 && (
                            <span className="text-[9px] font-mono font-bold shrink-0" style={{ color: m.color }}>NRC {m.nrc.toFixed(2)}</span>
                          )}
                        </div>
                        {/* Panel name */}
                        <p className="text-[10px] font-medium text-[#202b40] ml-3.5">{m.name}</p>
                        {/* Frame + Layer stack */}
                        {m.layers.length > 0 ? (
                          <div className="ml-3.5 mt-1 space-y-0.5">
                            {m.frame !== '—' && (
                              <div className="flex items-start gap-1.5 text-[9px]">
                                <span className="text-[#8a9ab0] shrink-0 w-[10px] text-center">┌</span>
                                <span className="text-[#2563EB] font-semibold">Frame:</span>
                                <span className="text-[#202b40]">{m.frame}</span>
                              </div>
                            )}
                            {m.layers.map((layer, i) => (
                              <div key={i} className="flex items-start gap-1.5 text-[9px]">
                                <span className="text-[#8a9ab0] shrink-0 w-[10px] text-center">{i === m.layers.length - 1 ? '└' : '├'}</span>
                                <span className="text-[#202b40]">
                                  <span className="font-semibold">{layer.material}</span>
                                  <span className="text-[#6b7a90]"> {layer.thickness}</span>
                                  <span className="text-[#8a9ab0]"> — {layer.purpose}</span>
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[9px] text-[#6b7a90] ml-3.5">{m.spec}</p>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* BOQ — Bill of Quantities */}
                {(
                <div className="rounded px-3 py-2.5 space-y-2" style={{ background: "#dfe1e3", border: "1.5px solid #8a9ab0" }}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-[11px] font-semibold text-[#2563EB]">Bill of Quantities</div>
                    <span className="text-[9px] text-[#6b7a90]">Panel: {boqData.panelSizeLabel} · Coverage: {boqData.coveragePct}%</span>
                  </div>

                  {/* Per-surface table */}
                  <div className="space-y-0">
                    {/* Header */}
                    <div className="grid grid-cols-[1fr_50px_40px_52px] gap-1 text-[8px] font-bold text-[#6b7a90] uppercase tracking-wide pb-0.5 border-b border-slate-300/50">
                      <span>Surface</span>
                      <span className="text-right">Area m²</span>
                      <span className="text-right">Panels</span>
                      <span className="text-right">Frame m</span>
                    </div>
                    {boqData.surfaces.map((row, i) => (
                      <div key={i} className="grid grid-cols-[1fr_50px_40px_52px] gap-1 text-[9px] py-0.5 border-b border-slate-200/30 last:border-0">
                        <span className="text-[#202b40] font-medium truncate">{row.surface}</span>
                        <span className="text-right font-mono text-[#202b40]">{row.coveredAreaM2.toFixed(1)}</span>
                        <span className="text-right font-mono text-[#2563EB] font-semibold">{row.panelCount > 0 ? row.panelCount : '—'}</span>
                        <span className="text-right font-mono text-[#202b40]">{row.frameLengthM > 0 ? row.frameLengthM.toFixed(1) : '—'}</span>
                      </div>
                    ))}
                  </div>

                  {/* Totals */}
                  <div className="pt-1 border-t border-slate-400/40 space-y-0.5">
                    <div className="flex justify-between text-[10px] font-bold text-[#202b40]">
                      <span>Total Panels</span>
                      <span className="font-mono text-[#2563EB]">{boqData.totals.totalPanels}</span>
                    </div>
                    <div className="flex justify-between text-[9px] text-[#202b40]">
                      <span>Frame Material (linear)</span>
                      <span className="font-mono">{boqData.totals.totalFrameM.toFixed(1)} m</span>
                    </div>
                    <div className="flex justify-between text-[9px] text-[#202b40]">
                      <span>Insulation Fill Area</span>
                      <span className="font-mono">{boqData.totals.totalInsulationM2.toFixed(1)} m²</span>
                    </div>
                    <div className="flex justify-between text-[9px] text-[#202b40]">
                      <span>Treated Surface Area</span>
                      <span className="font-mono">{boqData.totals.totalCoveredM2.toFixed(1)} m²</span>
                    </div>
                  </div>
                </div>
                )}

                {/* Panel Engine Diagnostics */}
                <div className="rounded px-3 py-2.5 space-y-2" style={{ background: "#dfe1e3", border: "1.5px solid #8a9ab0" }}>
                  <div className="text-[11px] font-semibold text-[#2563EB] mb-1">Panel Layout — Calculated Values</div>

                  {/* Bass trap */}
                  <div className="flex justify-between text-xs border-b border-slate-100 pb-1.5">
                    <span className="text-[#202b40]">Bass trap leg</span>
                    <span className="font-mono text-[#2563EB] font-semibold">
                      {unitSystem === "imperial"
                        ? `${(panelLayout.diagnostics.trapLegM * 39.3701).toFixed(1)}"`
                        : `${(panelLayout.diagnostics.trapLegM * 100).toFixed(0)} cm`}
                    </span>
                  </div>
                  <div className="text-xs text-[#202b40] -mt-1 pb-1.5 border-b border-slate-100">
                    λ/4 at {(343 / (4 * panelLayout.diagnostics.trapLegM)).toFixed(0)} Hz — lowest axial mode
                  </div>

                  {/* SBIR */}
                  <div className="flex justify-between text-xs">
                    <span className="text-[#202b40]">SBIR first notch</span>
                    <span className="font-mono text-[#2563EB] font-semibold">{panelLayout.diagnostics.sbirFreqHz} Hz</span>
                  </div>


                  {/* First reflection points */}
                  <div className="text-xs text-[#202b40] mt-1">First Reflection Points</div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs pb-1.5 border-b border-slate-100">
                    <span className="text-[#202b40]">Left wall</span>
                    <span className="font-mono text-[#202b40]">
                      {unitSystem === "imperial" ? `${(panelLayout.diagnostics.frpLeftZ * 3.28084).toFixed(2)} ft` : `${panelLayout.diagnostics.frpLeftZ.toFixed(2)} m`}
                    </span>
                    <span className="text-[#202b40]">Right wall</span>
                    <span className="font-mono text-[#202b40]">
                      {unitSystem === "imperial" ? `${(panelLayout.diagnostics.frpRightZ * 3.28084).toFixed(2)} ft` : `${panelLayout.diagnostics.frpRightZ.toFixed(2)} m`}
                    </span>
                    <span className="text-[#202b40]">Ceiling</span>
                    <span className="font-mono text-[#202b40]">
                      {unitSystem === "imperial" ? `${(panelLayout.diagnostics.frpCeilingZ * 3.28084).toFixed(2)} ft` : `${panelLayout.diagnostics.frpCeilingZ.toFixed(2)} m`}
                    </span>
                    <span className="text-[#202b40]">Listener Z</span>
                    <span className="font-mono text-[#60A5FA]">
                      {unitSystem === "imperial" ? `${(panelLayout.diagnostics.listenerZ * 3.28084).toFixed(2)} ft` : `${panelLayout.diagnostics.listenerZ.toFixed(2)} m`}
                    </span>
                  </div>

                  {/* Coverage per surface */}
                  <div className="text-xs text-[#202b40]">Coverage per Surface</div>
                  {(["front","rear","left","right","ceiling"] as const).map(s => {
                    const pct = Math.round((panelLayout.diagnostics.coveragePerSurface[s] ?? 0) * 100)
                    return (
                      <div key={s} className="flex items-center gap-2 text-xs">
                        <span className="text-[#202b40] capitalize w-12">{s}</span>
                        <div className="flex-1 h-1.5 rounded overflow-hidden" style={{ background: "#c4c6c8" }}>
                          <div className="h-full rounded transition-all"
                            style={{
                              width: `${pct}%`,
                              background: pct > 70 ? "#2563EB" : pct > 35 ? "#60A5FA" : "#202b40"
                            }} />
                        </div>
                        <span className="font-mono text-[#202b40] w-8 text-right">{pct}%</span>
                      </div>
                    )
                  })}

                  {/* RT60 ratio */}
                  <div className="flex justify-between text-xs pt-1 border-t border-slate-100">
                    <span className="text-[#202b40]">RT60 ratio</span>
                    <span className={`font-mono font-semibold ${
                      panelLayout.diagnostics.rt60Ratio > 1.05 ? "text-amber-400" :
                      panelLayout.diagnostics.rt60Ratio < 0.85 ? "text-blue-400" : "text-green-400"
                    }`}>
                      {panelLayout.diagnostics.rt60Ratio.toFixed(2)}
                      {panelLayout.diagnostics.rt60Ratio > 1.05 ? " ↑" : panelLayout.diagnostics.rt60Ratio < 0.85 ? " ↓" : " ✓"}
                    </span>
                  </div>
                </div>
              </>
            ))}

            {/* ── SCREEN TAB ── */}
            {rightPanelTab === "screen" && (!geometryValid ? (
              <div className="text-xs text-[#202b40] text-center py-12">Complete room setup first</div>
            ) : (
              <>
                <div className="rounded px-3 py-2.5" style={{ background: "#dfe1e3", border: "1.5px solid #8a9ab0" }}>
                  <div className="text-[11px] font-semibold text-[#2563EB] mb-2">Screen Geometry</div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-[#202b40]">Screen Size</span>
                      <span className="text-[#60A5FA] font-semibold">{committed.screenDiagonalInches}&quot;</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-[#202b40]">Width × Height</span>
                      <span className="text-[#60A5FA]">
                        {unitSystem === "imperial"
                          ? `${(screenWidthMeters * 39.3701).toFixed(1)}" × ${(screenHeight * 39.3701).toFixed(1)}"`
                          : `${(screenWidthMeters * 100).toFixed(0)} × ${(screenHeight * 100).toFixed(0)} cm`}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-[#202b40]">Max Available Width</span>
                      <span className={screenFitValidation.fitsWidth ? "text-[#202b40]" : "text-amber-400"}>
                        {unitSystem === "imperial"
                          ? `${(screenFitValidation.maxScreenWidth * 39.3701).toFixed(1)}"`
                          : `${(screenFitValidation.maxScreenWidth * 100).toFixed(0)} cm`}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-[#202b40]">Screen Bottom</span>
                      <span className="text-[#60A5FA]">
                        {unitSystem === "imperial"
                          ? `${Math.round(committed.screenBottomFromFloor * 39.3701)}"`
                          : `${Math.round(committed.screenBottomFromFloor * 100)} cm`}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-[#202b40]">Screen Top</span>
                      <span className={committed.screenBottomFromFloor + screenHeight <= usableRoom.height - 0.05 ? "text-[#60A5FA]" : "text-amber-400"}>
                        {unitSystem === "imperial"
                          ? `${Math.round((committed.screenBottomFromFloor + screenHeight) * 39.3701)}"`
                          : `${Math.round((committed.screenBottomFromFloor + screenHeight) * 100)} cm`}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs pt-1.5 border-t border-white/[0.05]">
                      <span className="text-[#202b40]">Ideal Viewing Distance</span>
                      <span className="text-[#60A5FA]">{unitSystem === "imperial"
                        ? `${Math.floor(seatingCalcs.viewingDistance * 3.28084)}'${Math.round((seatingCalcs.viewingDistance * 3.28084 % 1) * 12)}"`
                        : `${seatingCalcs.viewingDistance.toFixed(2)} m`}
                      </span>
                    </div>
                    {displayType === "projector" && (
                      <div className="flex justify-between text-xs">
                        <span className="text-[#202b40]">Throw Distance</span>
                        <span className={throwValidation.fits ? "text-[#60A5FA]" : "text-amber-400"}>
                          {unitSystem === "imperial"
                            ? `${Math.floor(throwDistance * 3.28084)}'${Math.round((throwDistance * 3.28084 % 1) * 12)}"`
                            : `${throwDistance.toFixed(2)} m`}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between text-xs">
                      <span className="text-[#202b40]">FOV at Front Row</span>
                      <span className={Math.abs(hFOV - targetAngle) <= 5 ? "text-[#60A5FA]" : "text-amber-400"}>
                        {hFOV.toFixed(1)}° {Math.abs(hFOV - targetAngle) <= 5 ? "✓" : `(target ${targetAngle}°)`}
                      </span>
                    </div>
                  </div>
                </div>
                {!screenFitValidation.fits && (
                  <p className="text-xs text-amber-400">Screen exceeds available wall space — choose a smaller size</p>
                )}
                {!throwValidation.fits && displayType === "projector" && (
                  <p className="text-xs text-amber-400">Projector throw exceeds room — reduce throw ratio or screen size</p>
                )}
              </>
            ))}

            {/* ── SEATING TAB ── */}
            {rightPanelTab === "seating" && (!geometryValid ? (
              <div className="text-xs text-[#202b40] text-center py-12">Complete room setup first</div>
            ) : (
              <>
                {/* Summary card */}
                <div className="rounded border border-[#2563EB]/20 px-3 py-2.5" style={{ background: "rgba(37,99,235,0.07)" }}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-[#202b40] font-semibold">Layout</span>
                    <span className="text-sm font-bold text-[#60A5FA]">
                      {seatingCalcs.rowCount} × {seatingCalcs.seatsPerRow}{widerBackRow && seatingCalcs.rowCount > 1 ? ` + ${seatingCalcs.backRowSeats}` : ""} seats
                    </span>
                  </div>
                  <div className="text-[10px] text-[#202b40] leading-relaxed">
                    Max {seatingCalcs.maxRows} rows × {seatingCalcs.maxSeatsWithAisle} seats
                  </div>
                </div>

                {/* Engineering detail */}
                <div className="rounded px-3 py-2.5" style={{ background: "#dfe1e3", border: "1.5px solid #8a9ab0" }}>
                  <div className="text-[11px] font-semibold text-[#2563EB] mb-2">Dimensions</div>
                  {[
                    { label: "First Row from Screen", val: (() => { const m = seatingCalcs.frontClearance; return unitSystem === "imperial" ? `${Math.floor(m*3.28084)}'${Math.round((m*3.28084%1)*12)}"` : `${m.toFixed(2)} m` })() },
                    { label: "Rear Clearance", val: (() => { const m = seatingCalcs.rearClearanceM; return unitSystem === "imperial" ? `${Math.floor(m*3.28084)}'${Math.round((m*3.28084%1)*12)}"` : `${m.toFixed(2)} m` })(), warn: seatingCalcs.rearClearanceM < 0.5 },
                    { label: "Total Platform Rise", val: (() => { const m = seatingCalcs.totalRiseM; return unitSystem === "imperial" ? `${Math.round(m*39.3701)}"` : `${(m*1000).toFixed(0)} mm` })(), warn: seatingCalcs.totalRiseM > 1.2 },
                    { label: "Back Row Eye Height", val: (() => { const m = seatingCalcs.lastRowEyeHeightM; return unitSystem === "imperial" ? `${Math.floor(m*3.28084)}'${Math.round((m*3.28084%1)*12)}"` : `${m.toFixed(2)} m` })() },
                    { label: "Headroom at Back", val: (() => { const m = seatingCalcs.headroomM; return unitSystem === "imperial" ? `${Math.round(m*39.3701)}"` : `${(m*100).toFixed(0)} cm` })(), warn: seatingCalcs.headroomM < 0.45 },
                  ].map(({ label, val, warn }) => (
                    <div key={label} className="flex justify-between text-xs mb-1.5">
                      <span className="text-[#202b40]">{label}</span>
                      <span className={warn ? "text-amber-400 font-semibold" : "text-[#60A5FA]"}>{val}</span>
                    </div>
                  ))}
                  {seatingCalcs.totalRiseM > 1.2 && (
                    <p className="text-xs text-amber-400 mt-1 pt-1 border-t border-white/[0.05]">Rise exceeds 1.2 m — structural platform required</p>
                  )}
                </div>

                {/* Per-row view quality */}
                {seatingCalcs.rowAnalysis.length > 0 && (
                  <div className="rounded overflow-hidden" style={{ background: "#dfe1e3", border: "1.5px solid #8a9ab0" }}>
                    <div className="px-3 py-2 border-b border-white/[0.05] flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-[#2563EB]">View Quality per Row</span>
                      <span className="text-[10px] text-[#202b40] leading-relaxed">R1 = back</span>
                    </div>
                    <div className="px-3 py-2 space-y-1">
                      <div className="flex text-xs text-[#202b40] border-b border-white/[0.04] pb-1 mb-1">
                        <span className="w-8">Row</span>
                        <span className="flex-1">Eye Ht</span>
                        <span className="flex-1">Distance</span>
                        <span className="w-14 text-right">View</span>
                      </div>
                      {seatingCalcs.rowAnalysis.map((r) => {
                        const fmtD2 = (m: number) => unitSystem === "imperial"
                          ? `${Math.floor(m*3.28084)}'${Math.round((m*3.28084%1)*12)}"`
                          : `${m.toFixed(1)} m`
                        return (
                          <div key={r.rowNum} className="flex text-xs items-center">
                            <span className="w-8 text-[#202b40] font-medium">R{r.rowNum}</span>
                            <span className="flex-1 text-[#60A5FA]">{fmtD2(r.eyeHeight)}</span>
                            <span className="flex-1 text-[#202b40]">{fmtD2(r.distFromScreen)}</span>
                            <span className={`w-14 text-right font-semibold ${r.sightlineStatus === "clear" ? "text-[#60A5FA]" : r.sightlineStatus === "marginal" ? "text-amber-400" : "text-red-400"}`}>
                              {r.sightlineStatus === "clear" ? "Clear" : r.sightlineStatus === "marginal" ? "Marginal" : "Blocked"}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </>
            ))}

            {/* ── ENGINEERING / ROOM TAB ── */}
            {rightPanelTab === "engineering" && (!roomValidation.valid ? (
              <div className="text-xs text-[#202b40] text-center py-12">Enter valid room dimensions first</div>
            ) : (
              <>
                {/* Room Ratio */}
                <div className="rounded px-3 py-2.5 mb-3" style={{ background: "#dfe1e3", border: "1.5px solid #8a9ab0" }}>
                  <div className="flex items-center justify-between">
                    <div className="text-[11px] font-semibold text-[#2563EB]">Room Ratio</div>
                    <span className={`text-xs font-semibold ${
                      roomRatio?.status === "good" ? "text-emerald-500"
                      : roomRatio?.status === "acceptable" ? "text-amber-500"
                      : "text-red-400"
                    }`}>{roomRatio?.label ?? ''}</span>
                  </div>
                  <p className="text-[10px] mt-1 text-[#6b7a90]">
                    {unitSystem === "imperial"
                      ? `${(clampedRoom.length * 3.28084).toFixed(1)} × ${(clampedRoom.width * 3.28084).toFixed(1)} × ${(clampedRoom.height * 3.28084).toFixed(1)} ft`
                      : `${clampedRoom.length.toFixed(2)} × ${clampedRoom.width.toFixed(2)} × ${clampedRoom.height.toFixed(2)} m`}
                  </p>
                </div>

                {/* Room Summary */}
                <div className="rounded px-3 py-2.5" style={{ background: "#dfe1e3", border: "1.5px solid #8a9ab0" }}>
                  <div className="text-[11px] font-semibold text-[#2563EB] mb-2">Room Dimensions</div>
                  <div className="space-y-1">
                    {[
                      { label: "Length", m: clampedRoom.length },
                      { label: "Width",  m: clampedRoom.width  },
                      { label: "Height", m: clampedRoom.height },
                    ].map(({ label, m }) => (
                      <div key={label} className="flex justify-between text-xs">
                        <span className="text-[#202b40]">{label}</span>
                        <span className="text-[#60A5FA]">
                          {unitSystem === "imperial"
                            ? (() => { const ti = m * 39.3701; return `${Math.floor(ti/12)}'${Math.round(ti%12)}"` })()
                            : `${m.toFixed(2)} m`}
                        </span>
                      </div>
                    ))}
                    <div className="flex justify-between text-xs pt-1 border-t border-white/[0.05]">
                      <span className="text-[#202b40]">Volume</span>
                      <span className="text-[#60A5FA] font-semibold">
                        {unitSystem === "imperial"
                          ? `${(roomVolume * 35.3147).toFixed(0)} ft³`
                          : `${roomVolume.toFixed(1)} m³`}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Usable Room */}
                <div className="rounded px-3 py-2.5" style={{ background: "#dfe1e3", border: "1.5px solid #8a9ab0" }}>
                  <div className="text-[11px] font-semibold text-[#2563EB] mb-2">Usable Room (after treatment)</div>
                  <div className="space-y-1">
                    {[
                      { label: "Length", m: usableRoom.length },
                      { label: "Width",  m: usableRoom.width  },
                      { label: "Height", m: usableRoom.height },
                    ].map(({ label, m }) => (
                      <div key={label} className="flex justify-between text-xs">
                        <span className="text-[#202b40]">{label}</span>
                        <span className="text-[#60A5FA]">
                          {unitSystem === "imperial"
                            ? (() => { const ti = m * 39.3701; return `${Math.floor(ti/12)}'${Math.round(ti%12)}"` })()
                            : `${m.toFixed(2)} m`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Surface Areas */}
                {roomSurfaceData && (
                  <div className="rounded px-3 py-2.5" style={{ background: "#dfe1e3", border: "1.5px solid #8a9ab0" }}>
                    <div className="text-[11px] font-semibold text-[#2563EB] mb-2">Surface Areas</div>
                    <div className="space-y-1">
                      {[
                        { label: "Floor",       v: roomSurfaceData.floorArea },
                        { label: "Ceiling",     v: roomSurfaceData.ceilingArea },
                        { label: "Front Wall",  v: roomSurfaceData.frontWall },
                        { label: "Rear Wall",   v: roomSurfaceData.rearWall },
                        { label: "Left Wall",   v: roomSurfaceData.leftWall },
                        { label: "Right Wall",  v: roomSurfaceData.rightWall },
                      ].map(({ label, v }) => (
                        <div key={label} className="flex justify-between text-xs">
                          <span className="text-[#202b40]">{label}</span>
                          <span className="text-[#60A5FA]">{convertArea(v).toFixed(1)} {displayUnitArea}</span>
                        </div>
                      ))}
                      <div className="flex justify-between text-xs pt-1 border-t border-white/[0.05] font-semibold">
                        <span className="text-[#202b40]">Total</span>
                        <span className="text-[#60A5FA]">{convertArea(roomSurfaceData.totalSurface).toFixed(1)} {displayUnitArea}</span>
                      </div>
                    </div>
                  </div>
                )}


              </>
            ))}

            {/* ── SUGGESTIONS TAB ── */}
            {rightPanelTab === "suggestions" && (() => {
              if (!isRoomValid) return (
                <div className="text-xs text-[#202b40] text-center py-12">Enter valid room dimensions first</div>
              )

              type Advisory = { id: string; level: "critical" | "warn" | "info"; category: "Acoustic" | "Speaker" | "Screen"; title: string; detail: string }
              const advisories: Advisory[] = []

              // ── TREATMENT + INTENT descriptions (info level, Acoustic category) ──
              const treatmentDesc: Record<string, string> = {
                basic:  "Wall absorbers at first-reflection zones — entry level control",
                medium: "Absorbers + reflector panels, ceiling cloud — reference home theater",
                high:   "Full treatment, rear diffusers & corner bass traps — studio / cinema grade",
              }
              const intentDesc: Record<string, string> = {
                performance: `Max absorptive — accuracy & control, RT60 ${RT60_TARGETS.performance.min}–${RT60_TARGETS.performance.max} s`,
                balanced:    `Absorbers + diffusion mix — performance + aesthetics, RT60 ${RT60_TARGETS.balanced.min}–${RT60_TARGETS.balanced.max} s`,
                luxury:      `More diffuse, premium materials — visual & experiential focus, RT60 ${RT60_TARGETS.luxury.min}–${RT60_TARGETS.luxury.max} s`,
              }
              if (treatmentDesc[treatmentLevel])
                advisories.push({ id: "treatment-desc", level: "info", category: "Acoustic",
                  title: `Treatment: ${treatmentLevel.charAt(0).toUpperCase() + treatmentLevel.slice(1)}`,
                  detail: treatmentDesc[treatmentLevel] })
              if (intentDesc[designIntent])
                advisories.push({ id: "intent-desc", level: "info", category: "Acoustic",
                  title: `Design Intent: ${designIntent.charAt(0).toUpperCase() + designIntent.slice(1)}`,
                  detail: intentDesc[designIntent] })

              // ── ACOUSTIC ──
              // SBIR: informational only. Pushing the notch below 80 Hz needs >90 cm of panel depth
              // (not achievable in a home theatre). Address via DSP/EQ, not panel thickness.
              const sbirFreqDisplay = panelLayout.diagnostics.sbirFreqHz
              if (sbirFreqDisplay > 0)
                advisories.push({ id: "sbir", level: "info", category: "Acoustic",
                  title: `SBIR notch at ${sbirFreqDisplay} Hz`,
                  detail: "Speaker boundary interference at this frequency. Caused by front wall proximity — address with DSP/EQ, not panel depth." })
              const tooDeepL2 = acousticDepthMeters.front + acousticDepthMeters.rear >= clampedRoom.length - 0.5
              const tooDeepW2 = acousticDepthMeters.left + acousticDepthMeters.right >= clampedRoom.width - 0.5
              if (tooDeepL2) advisories.push({ id: "deep-len", level: "critical", category: "Acoustic", title: "Front + rear depth conflict", detail: "Less than 0.5 m of live room length remaining. Reduce panel depths or use a deeper room." })
              if (tooDeepW2) advisories.push({ id: "deep-wid", level: "critical", category: "Acoustic", title: "Side depth conflict", detail: "Less than 0.5 m of live room width remaining. Reduce side panel depths." })
              const committedRt60Target = RT60_TARGETS[committed.designIntent] ?? RT60_TARGETS.balanced
              if (rt60Status === "overdamped") advisories.push({ id: "rt60-over", level: "warn", category: "Acoustic", title: "Room over-treated",
                detail: `RT60 ${acousticResult?.rt60Seconds.toFixed(2)} s is below the ${committedRt60Target.min}–${committedRt60Target.max} s target for ${committed.designIntent} intent. Try reducing panel depths, switching to a less absorptive design intent (e.g. Balanced or Luxury), or dropping one treatment level.` })
              if (rt60Status === "tooLive" && committed.treatmentLevel === "basic") {
                advisories.push({ id: "rt60-live-basic", level: "info", category: "Acoustic", title: "Basic treatment — limited RT60 control",
                  detail: `RT60 ${acousticResult?.rt60Seconds.toFixed(2)} s is above the ${committedRt60Target.min}–${committedRt60Target.max} s target. Basic treatment (NRC 0.55) covers first reflection points but may not fully achieve RT60 targets in this room volume. Upgrade to Medium for professional-grade absorption.` })
              } else if (rt60Status === "tooLive") {
                advisories.push({ id: "rt60-live", level: "warn", category: "Acoustic", title: "Room under-treated",
                  detail: `RT60 ${acousticResult?.rt60Seconds.toFixed(2)} s is above the ${committedRt60Target.min}–${committedRt60Target.max} s target for ${committed.designIntent} intent. Increase panel depth or upgrade treatment level. Check wall construction — hard surfaces (concrete/brick) need deeper panels to compensate.` })
              }

              // ── SPEAKER ──
              if (ceilingCount === 6 && clampedRoom.height < 3.5)
                advisories.push({ id: "ceil6h", level: "warn", category: "Speaker", title: "Ceiling too low for 6 overhead",
                  detail: `Current: ${unitSystem === "imperial" ? `${(clampedRoom.height * 3.28084).toFixed(1)} ft` : `${clampedRoom.height.toFixed(1)} m`} — minimum 3.5 m (11.5 ft) recommended for 6-channel overhead.` })
              if (ceilingCount === 4 && clampedRoom.height < 2.7)
                advisories.push({ id: "ceil4h", level: "warn", category: "Speaker", title: "Ceiling low for 4 overhead",
                  detail: `Current: ${unitSystem === "imperial" ? `${(clampedRoom.height * 3.28084).toFixed(1)} ft` : `${clampedRoom.height.toFixed(1)} m`} — 2.7 m (8.9 ft) recommended for 4-channel overhead.` })
              if (ceilingCount === 2 && clampedRoom.height < 2.4)
                advisories.push({ id: "ceil2h", level: "warn", category: "Speaker", title: "Ceiling borderline for 2 overhead",
                  detail: `Current: ${unitSystem === "imperial" ? `${(clampedRoom.height * 3.28084).toFixed(1)} ft` : `${clampedRoom.height.toFixed(1)} m`} — 2.4 m (7.9 ft) is the practical minimum.` })
              if (mountType === "inWall" && acousticDepthMeters.left < 0.125)
                advisories.push({ id: "inwall-side", level: "warn", category: "Speaker", title: "Side depth too shallow for in-wall",
                  detail: `Increase side depth to ≥${unitSystem === "imperial" ? '5"' : "12.5 cm"} to accommodate in-wall driver cavity.` })
              if (screenPlacement === "besideScreen" && usableRoom.width < 4.5)
                advisories.push({ id: "beside-narrow", level: "critical", category: "Speaker", title: "Room too narrow for Beside Screen",
                  detail: `Usable width: ${unitSystem === "imperial" ? `${(usableRoom.width * 3.28084).toFixed(1)} ft` : `${usableRoom.width.toFixed(1)} m`} — 4.5 m (14.8 ft) needed for L/R speaker clearance.` })
              const areaM2 = clampedRoom.length * clampedRoom.width
              if (subCount >= 3 && areaM2 < 30)
                advisories.push({ id: "sub-small", level: "warn", category: "Speaker", title: `${subCount} subs may worsen modal distribution`,
                  detail: `Room area ${unitSystem === "imperial" ? `${(areaM2 * 10.7639).toFixed(0)} ft²` : `${areaM2.toFixed(0)} m²`} — multiple subs can excite standing waves in small rooms. Consider 2.` })
              if ((subPlacement === "frontCorners" || subPlacement === "haas") && subType === "ported")
                advisories.push({ id: "ported-boundary", level: "warn", category: "Speaker", title: "Ported sub at boundary",
                  detail: "Boundary placement + ported enclosure reinforces room modes. Switch to sealed for tighter low-end control." })

              // ── SCREEN ──
              if (!screenFitValidation.fitsWidth)
                advisories.push({ id: "scr-wide", level: "critical", category: "Screen", title: "Screen wider than available wall",
                  detail: `Screen ${fmtScreenDim(screenWidthMeters)} wide — max available: ${fmtScreenDim(screenFitValidation.maxScreenWidth)}. Reduce diagonal or switch to Beside Screen.` })
              if (!throwValidation.fits && displayType === "projector")
                advisories.push({ id: "throw-short", level: "critical", category: "Screen", title: "Throw distance exceeds room depth",
                  detail: `Needs ${fmtM(throwDistance)} — only ${fmtM(throwValidation.maxThrow)} available. Use a shorter throw lens ratio.` })

              // ── Auto-recommendations ──
              const rec = autoRecommended
              const recBaseBeds = rec.surrounds === "side_rear" ? 7 : rec.surrounds === "side" ? 5 : 3
              const recTotalBeds = recBaseBeds + rec.extraSidePairs * 2
              const recTotalCeil = rec.ceilingCount + rec.extraCeilingPairs * 2
              const recLabel = `${rec.lcr.toUpperCase()} · ${rec.surrounds === "side_rear" ? "Side + Rear" : rec.surrounds === "side" ? "Side only" : "No surrounds"} · ${rec.ceilingCount > 0 ? `${recTotalCeil} OH` : "No overhead"}${rec.extraSidePairs > 0 ? ` · +${rec.extraSidePairs * 2} Wide` : ""}`
              const recDiffers = rec.lcr !== lcrMode || rec.surrounds !== surroundMode || rec.ceilingCount !== ceilingCount || rec.extraSidePairs !== extraSidePairs || rec.extraCeilingPairs !== extraCeilingPairs
              const recNotation = recTotalCeil > 0
                ? `${recTotalBeds}.1.${recTotalCeil}`
                : `${recTotalBeds}.1`

              // ── Sort: critical → warn → info ──
              const order = { critical: 0, warn: 1, info: 2 }
              advisories.sort((a, b) => order[a.level] - order[b.level])

              // Group by category
              const cats = ["Acoustic", "Speaker", "Screen"] as const
              const catColors: Record<string, string> = { Acoustic: "#818CF8", Speaker: "#60A5FA", Screen: "#34D399" }
              const levelIcon = (lvl: string) => lvl === "critical" ? "●" : lvl === "warn" ? "◐" : "○"
              const levelColor = (lvl: string) =>
                lvl === "critical" ? "#ef4444" : lvl === "warn" ? "#f59e0b" : "#60A5FA"

              // What's committed vs live
              const liveNotation = configNotation
              const appliedNotation = (() => {
                const a = committed
                const baseBeds = a.surroundMode === "side_rear" ? 7 : a.surroundMode === "side" ? 5 : 3
                const totalBeds = baseBeds + (a.extraSidePairs ?? 0) * 2
                const totalCeil = a.ceilingCount + (a.extraCeilingPairs ?? 0) * 2
                const base = totalCeil > 0 ? `${totalBeds}.${a.subCount}.${totalCeil}` : `${totalBeds}.${a.subCount}`
                const extras: string[] = []
                if ((a.extraSidePairs ?? 0) > 0) extras.push(`+${(a.extraSidePairs ?? 0) * 2}S`)
                if ((a.extraCeilingPairs ?? 0) > 0) extras.push(`+${(a.extraCeilingPairs ?? 0) * 2}OH`)
                return extras.length > 0 ? `${base} (${extras.join(" ")})` : base
              })()
              const hasDirty = isDirty

              return (
                <div className="space-y-3">

                  {/* ── Config Status ── */}
                  <div className="rounded-lg px-3 py-3" style={{ background: "#dfe1e3", border: "1.5px solid #8a9ab0" }}>
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-[#4a5a72] mb-2.5">Config Status</div>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-[#6b7a90]">Live (editing)</span>
                        <span className="text-xs font-mono font-semibold" style={{ color: "#60A5FA" }}>{liveNotation}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-[#6b7a90]">Applied to engine</span>
                        <span className="text-xs font-mono font-semibold" style={{ color: hasDirty ? "#f59e0b" : "#60A5FA" }}>{appliedNotation}</span>
                      </div>
                      {hasDirty && (
                        <div className="rounded px-2 py-1.5 mt-1" style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.22)" }}>
                          <p className="text-[10px] leading-relaxed" style={{ color: "#f59e0b" }}>Changes pending — press <span className="font-semibold">Apply</span> to update acoustics and 3D view</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ── Auto-recommendation ── */}
                  <div className="rounded-lg px-3 py-3" style={{ background: "#dfe1e3", border: "1.5px solid #8a9ab0" }}>
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-[#4a5a72] mb-2">Recommended for this room</div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="text-xs font-semibold text-[#202b40]">{recNotation}</p>
                        <p className="text-[10px] text-[#6b7a90] mt-0.5 leading-relaxed">{recLabel}</p>
                        <p className="text-[10px] text-[#6b7a90] mt-1">
                          {unitSystem === "imperial"
                            ? `${(roomVolume * 35.3147).toFixed(0)} ft³ · ${(clampedRoom.height * 3.28084).toFixed(1)} ft ceiling`
                            : `${roomVolume.toFixed(1)} m³ · ${clampedRoom.height.toFixed(1)} m ceiling`}
                        </p>
                      </div>
                      <div className="shrink-0">
                        {recDiffers
                          ? <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ background: "rgba(96,165,250,0.12)", color: "#60A5FA", border: "1px solid rgba(96,165,250,0.25)" }}>Differs from current</span>
                          : <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ background: "rgba(52,211,153,0.12)", color: "#34D399", border: "1px solid rgba(52,211,153,0.25)" }}>Matches ✓</span>
                        }
                      </div>
                    </div>
                  </div>

                  {/* ── Advisories ── */}
                  {advisories.length === 0 ? (
                    <div className="rounded-lg px-3 py-6 text-center" style={{ background: "#dfe1e3", border: "1.5px solid #8a9ab0" }}>
                      <div className="text-lg mb-1 text-[#34D399]">✓</div>
                      <p className="text-xs font-semibold text-[#202b40]">No issues found</p>
                      <p className="text-[10px] text-[#6b7a90] mt-1">All settings are within recommended ranges</p>
                    </div>
                  ) : (
                    <div className="rounded-lg overflow-hidden" style={{ border: "1.5px solid #8a9ab0" }}>
                      <div className="px-3 py-2" style={{ background: "#dfe1e3", borderBottom: "1px solid #b8bfc9" }}>
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-[#4a5a72]">
                          {advisories.length} issue{advisories.length !== 1 ? "s" : ""} · {advisories.filter(a => a.level === "critical").length > 0 ? `${advisories.filter(a => a.level === "critical").length} critical` : "no critical"}
                        </span>
                      </div>
                      <div className="divide-y" style={{ borderColor: "#b8bfc9" }}>
                        {cats.map(cat => {
                          const catAdvs = advisories.filter(a => a.category === cat)
                          if (catAdvs.length === 0) return null
                          return (
                            <div key={cat} style={{ background: "#dfe1e3" }}>
                              <div className="px-3 py-1.5" style={{ borderBottom: "1px solid #b8bfc9", background: "rgba(0,0,0,0.03)" }}>
                                <span className="text-[10px] font-semibold" style={{ color: catColors[cat] }}>{cat}</span>
                              </div>
                              <div className="space-y-0">
                                {catAdvs.map((adv, i) => (
                                  <div key={adv.id} className="px-3 py-2.5" style={{ borderTop: i > 0 ? "1px solid #b8bfc9" : undefined }}>
                                    <div className="flex items-start gap-2">
                                      <span className="text-[10px] mt-0.5 shrink-0" style={{ color: levelColor(adv.level) }}>{levelIcon(adv.level)}</span>
                                      <div>
                                        <p className="text-xs font-semibold text-[#202b40] leading-snug">{adv.title}</p>
                                        <p className="text-[10px] text-[#6b7a90] mt-0.5 leading-relaxed">{adv.detail}</p>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )
            })()}

          </div>
        </div>
      </div>
    </div>
  )
}