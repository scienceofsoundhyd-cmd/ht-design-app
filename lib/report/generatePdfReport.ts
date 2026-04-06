import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

// ── Full payload — mirrors everything page.tsx sends ─────────────────────────
export type ConsultationPayload = {
  // Client
  name: string;
  email: string;
  contact?: string;
  company?: string;
  projectRef?: string;
  projectType: string;
  notes: string;
  speakerBrand?: string;
  preparedBy?: string;
  projectDate?: string;    // YYYY-MM-DD, shown on report instead of generation timestamp
  wallConstruction?: string;

  // Unit system
  unitSystem?: string;
  roomColorScheme?: string;

  // Room
  roomWidth: number;
  roomHeight: number;
  roomLength: number;
  roomVolume?: number;

  // Acoustic treatment
  treatmentLevel?: string;
  designIntent?: string;
  acousticDepthFront?: number;
  acousticDepthRear?: number;
  acousticDepthLeft?: number;
  acousticDepthRight?: number;
  acousticDepthCeiling?: number;

  // Acoustic results
  rating: number;
  rt60Seconds: number;
  rt60Sabine?: number;
  rt60Eyring?: number;
  rt60Target?: string;
  rt60Status?: string;
  schroederHz?: number;
  modalRiskLevel?: string;
  clusterSeverityScore: number;

  // Speaker system
  speakerConfig?: string;
  speakerSystem?: string;
  mountType?: string;
  screenPlacement?: string;
  extraSidePairs?: number;
  extraCeilingPairs?: number;

  // Screen / display
  viewingStandard?: string;
  aspectRatio?: string;
  screenDiagonalInches?: number;
  screenWidthM?: number;
  screenHeightM?: number;
  throwRatio?: number;
  throwDistanceM?: number;
  viewingDistanceM?: number;

  // Seating
  seatType?: string;
  rowCount?: number;
  seatsPerRow?: number;
  totalSeats?: number;
  riserStepMm?: number;
  riserRakeDeg?: number;
  sightlineGrade?: string;
  totalRiseM?: number;

  timestamp: string;

  // Material Specification + BOQ
  materialSpecs?: {
    surface: string;
    panelName: string;
    panelType: string;
    nrc: number;
    frame: string;
    layers: { material: string; thickness: string; purpose: string }[];
  }[];
  boqSurfaces?: {
    surface: string;
    coveredAreaM2: number;
    panelCount: number;
    frameLengthM: number;
    insulationAreaM2: number;
  }[];
  boqTotals?: {
    totalPanels: number;
    totalFrameM: number;
    totalInsulationM2: number;
    totalCoveredM2: number;
  };
  boqCoveragePct?: number;
  boqPanelSize?: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function getRatingBand(r: number)    { return r >= 80 ? "EXCELLENT" : r >= 60 ? "GOOD" : r >= 40 ? "FAIR" : "POOR"; }
function getRatingColor(r: number)   { return r >= 80 ? "#1A6B3C" : r >= 60 ? "#2C5F8A" : r >= 40 ? "#8C5A1A" : "#8C1A1A"; }
function getRatingBadgeBg(r: number) { return r >= 80 ? "#EDF7F1" : r >= 60 ? "#EDF3FA" : r >= 40 ? "#FAF2E8" : "#FAE8E8"; }

function getRt60StatusLabel(s?: string) {
  if (s === "optimal")    return "On Target ✓";
  if (s === "overdamped") return "Over-Treated";
  if (s === "tooLive")    return "Under-Treated";
  return s ?? "—";
}

function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
  } catch { return iso; }
}

function fmtM(m?: number, imp?: boolean): string {
  if (m == null) return "—";
  if (imp) {
    const ft  = Math.floor(m * 3.28084);
    const ins = Math.round((m * 3.28084 - ft) * 12);
    return `${ft}′ ${ins}″`;
  }
  return `${m.toFixed(2)} m`;
}

function fmtCm(m?: number): string { return m != null ? `${Math.round(m * 100)} cm` : "—"; }
function fmtIn(m?: number): string { return m != null ? `${Math.round(m * 39.3701)}″` : "—"; }
function fmtNum(n?: number, dp = 2): string { return n != null ? n.toFixed(dp) : "—"; }

function getInterpretation(rating: number): string {
  if (rating >= 80)
    return "The analysed configuration demonstrates professional-grade low-frequency consistency. Modal resonances are well-distributed across the listening plane and seat-to-seat variation falls within thresholds acceptable for critical listening environments. No significant corrective intervention is required.";
  if (rating >= 60)
    return "The configuration demonstrates good low-frequency performance with minor modal irregularities. The spatially averaged response is broadly consistent, though localised resonance peaks may be perceptible at specific positions. Targeted treatment or parametric equalisation would bring performance to the excellent band.";
  if (rating >= 40)
    return "A noticeable modal imbalance has been identified. One or more room modes are producing significant spectral colouration within the analysis band. Optimisation of subwoofer placement or room correction DSP is strongly recommended.";
  return "Significant modal issues have been identified. Both spectral flatness and seat-to-seat uniformity are substantially below acceptable thresholds. Professional acoustic calibration, physical room treatment, and a multi-subwoofer strategy are strongly recommended.";
}

const DISCLAIMER_ITEMS: string[] = [
  "Analysis restricted to 30–120 Hz, encompassing the modal region for the specified room volume.",
  "A single subwoofer source with unity gain, zero delay, and positive polarity is assumed.",
  "Surface absorption uses broadband coefficients for a moderately furnished domestic environment.",
  "Five listener positions auto-generated across ±0.6 m around the seating row centre.",
  "Results represent steady-state modal energy distribution; transient effects are not modelled.",
  "Air absorption computed via ISO 9613-1 approximation at 20 °C and 50 % relative humidity.",
];

// ── Styles ────────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  page: {
    backgroundColor: "#FFFFFF",
    paddingTop: 48, paddingBottom: 52,
    paddingLeft: 56, paddingRight: 56,
    fontFamily: "Helvetica",
  },
  topBar:    { backgroundColor: "#2C4A7C", height: 4, marginBottom: 28, borderRadius: 2 },
  bottomBar: { backgroundColor: "#2C4A7C", height: 2, marginTop: 20, borderRadius: 1, opacity: 0.3 },

  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 22 },
  headerLeft: { flex: 1 },
  headerRight: { alignItems: "flex-end" },
  eyebrow:   { fontSize: 8, letterSpacing: 2, color: "#2C4A7C", textTransform: "uppercase", marginBottom: 5 },
  title:     { fontSize: 20, color: "#1A1A1A", marginBottom: 3, fontFamily: "Helvetica-Bold" },
  subtitle:  { fontSize: 10, color: "#777777" },
  dateLabel: { fontSize: 8, letterSpacing: 1, color: "#AAAAAA", textTransform: "uppercase", marginBottom: 3 },
  dateValue: { fontSize: 10, color: "#444444", fontFamily: "Helvetica-Bold" },

  rule: { borderBottomWidth: 1, borderBottomColor: "#E0DDD8", marginBottom: 20 },

  sectionBlock:  { marginBottom: 22 },
  sectionHeader: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  sectionBar:    { width: 3, height: 13, backgroundColor: "#2C4A7C", borderRadius: 2, marginRight: 9 },
  sectionTitle:  { fontSize: 8, letterSpacing: 2.5, color: "#2C4A7C", textTransform: "uppercase", fontFamily: "Helvetica-Bold" },

  // Two-column grid for sections
  twoCol:       { flexDirection: "row", gap: 14 },
  colLeft:      { flex: 1 },
  colRight:     { flex: 1 },

  tableRow:    { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#F0EDE8", paddingVertical: 7, paddingHorizontal: 9 },
  tableRowAlt: { backgroundColor: "#FAF9F7" },
  tableLabel:  { flex: 1, fontSize: 9, color: "#777777", textTransform: "uppercase", letterSpacing: 0.4 },
  tableValue:  { fontSize: 10, color: "#1A1A1A", fontFamily: "Helvetica-Bold" },
  tableUnit:   { fontSize: 8, color: "#AAAAAA", marginLeft: 3 },
  valueRow:    { flexDirection: "row", alignItems: "baseline" },

  // Rating badge + metrics panel
  ratingRow:   { flexDirection: "row", gap: 14, marginBottom: 4 },
  ratingBadge: { width: 90, borderRadius: 6, paddingVertical: 16, paddingHorizontal: 10, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  ratingNumber:{ fontSize: 36, fontFamily: "Helvetica-Bold", lineHeight: 1, letterSpacing: -1 },
  ratingDenom: { fontSize: 8, color: "#AAAAAA", marginTop: 3 },
  ratingBand:  { fontSize: 7, fontFamily: "Helvetica-Bold", letterSpacing: 1.5, textTransform: "uppercase", marginTop: 7 },
  metricsPanel:{ flex: 1, borderWidth: 1, borderColor: "#E8E4DC", borderRadius: 6, overflow: "hidden" },
  metricRow:   { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#F0EDE8", paddingVertical: 7, paddingHorizontal: 10, alignItems: "center" },
  metricRowHL: { backgroundColor: "#EDF3FA" },
  metricLabel: { flex: 1, fontSize: 9, color: "#777777", textTransform: "uppercase", letterSpacing: 0.4 },
  metricLabelHL: { color: "#2C4A7C", fontFamily: "Helvetica-Bold" },
  metricValue: { fontSize: 11, fontFamily: "Helvetica-Bold", color: "#1A1A1A" },
  metricValueHL: { fontSize: 13, color: "#2C4A7C" },
  metricUnit:  { fontSize: 8, color: "#AAAAAA", marginLeft: 2 },

  interpretationText: { fontSize: 10, color: "#444444", lineHeight: 1.7, letterSpacing: 0.1 },

  advisoryBox:   { backgroundColor: "#FFFDF5", borderLeftWidth: 3, borderLeftColor: "#C9A84C", borderWidth: 1, borderColor: "#E8DFC0", borderRadius: 4, padding: 14, marginTop: 4 },
  advisoryLabel: { fontSize: 7, letterSpacing: 2, color: "#8C6D2E", textTransform: "uppercase", marginBottom: 6, fontFamily: "Helvetica-Bold" },
  advisoryText:  { fontSize: 10, color: "#5C4010", lineHeight: 1.6 },

  notesBox:  { backgroundColor: "#FAF9F7", borderWidth: 1, borderColor: "#E0DDD8", borderRadius: 4, padding: 12, marginTop: 4 },
  notesText: { fontSize: 10, color: "#444444", lineHeight: 1.6 },

  disclaimerBox:  { backgroundColor: "#F7F5F0", borderWidth: 1, borderColor: "#E0DDD8", borderRadius: 4, padding: 12, marginTop: 4 },
  disclaimerItem: { flexDirection: "row", marginBottom: 5, gap: 7 },
  disclaimerIndex:{ fontSize: 8, color: "#AAAAAA", width: 15 },
  disclaimerText: { flex: 1, fontSize: 8, color: "#777777", lineHeight: 1.5 },

  footer:           { marginTop: 28, borderTopWidth: 1, borderTopColor: "#E0DDD8", paddingTop: 14, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  footerLeft:       {},
  footerEngine:     { fontSize: 9, color: "#444444", fontFamily: "Helvetica-Bold", marginBottom: 3 },
  footerSub:        { fontSize: 8, color: "#AAAAAA", letterSpacing: 0.3 },
  footerRight:      { alignItems: "flex-end" },
  footerDisclaimer: { fontSize: 8, color: "#BBBBBB", textAlign: "right", lineHeight: 1.5 },

  // Status pill
  pillRow:    { flexDirection: "row", alignItems: "center", gap: 6 },
  pillGreen:  { backgroundColor: "#EDF7F1", borderRadius: 3, paddingHorizontal: 6, paddingVertical: 2 },
  pillAmber:  { backgroundColor: "#FAF2E8", borderRadius: 3, paddingHorizontal: 6, paddingVertical: 2 },
  pillRed:    { backgroundColor: "#FAE8E8", borderRadius: 3, paddingHorizontal: 6, paddingVertical: 2 },
  pillText:   { fontSize: 9, fontFamily: "Helvetica-Bold" },

  // Page 2+ header
  page2Header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  page2Title:  { fontSize: 10, color: "#2C4A7C", fontFamily: "Helvetica-Bold", letterSpacing: 1, textTransform: "uppercase" },
  page2Sub:    { fontSize: 9, color: "#AAAAAA" },

  // BOQ / Material table styles
  matSurface:   { marginBottom: 12 },
  matSurfHead:  { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  matSurfName:  { fontSize: 10, color: "#1A1A1A", fontFamily: "Helvetica-Bold" },
  matBadge:     { fontSize: 7, fontFamily: "Helvetica-Bold", letterSpacing: 1, textTransform: "uppercase", borderRadius: 2, paddingHorizontal: 4, paddingVertical: 1 },
  matNrc:       { fontSize: 8, color: "#2C4A7C", fontFamily: "Helvetica-Bold", marginLeft: "auto" },
  matFrame:     { fontSize: 8, color: "#777777", marginBottom: 2, paddingLeft: 8 },
  matLayer:     { flexDirection: "row", paddingLeft: 8, paddingVertical: 1.5 },
  matLayerText: { fontSize: 8, color: "#444444" },
  matLayerDim:  { fontSize: 8, color: "#AAAAAA", marginLeft: 4 },
  matLayerPurp: { fontSize: 8, color: "#999999", marginLeft: 4 },

  boqHeader:    { flexDirection: "row", backgroundColor: "#2C4A7C", borderRadius: 3, paddingVertical: 5, paddingHorizontal: 8, marginBottom: 2 },
  boqHeaderCell:{ fontSize: 7, color: "#FFFFFF", fontFamily: "Helvetica-Bold", letterSpacing: 0.3, textTransform: "uppercase" },
  boqRow:       { flexDirection: "row", paddingVertical: 5, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: "#F0EDE8" },
  boqCell:      { fontSize: 9, color: "#1A1A1A" },
  boqCellBold:  { fontSize: 9, color: "#1A1A1A", fontFamily: "Helvetica-Bold" },
  boqTotalRow:  { flexDirection: "row", paddingVertical: 6, paddingHorizontal: 8, backgroundColor: "#EDF3FA", borderRadius: 3, marginTop: 2 },
  boqTotalCell: { fontSize: 9, color: "#2C4A7C", fontFamily: "Helvetica-Bold" },
});

// ── Row builders ──────────────────────────────────────────────────────────────
type Row = { label: string; value: string };
const R = (label: string, value: string): Row => ({ label, value });

function mkRows(rows: Row[], startIdx = 0) {
  return rows.map((row, i) =>
    React.createElement(
      View,
      { key: row.label, style: (i + startIdx) % 2 === 1 ? [S.tableRow, S.tableRowAlt] : [S.tableRow] },
      React.createElement(Text, { style: S.tableLabel }, row.label),
      React.createElement(Text, { style: S.tableValue }, row.value),
    )
  );
}

function sectionHead(title: string) {
  return React.createElement(
    View, { style: S.sectionHeader },
    React.createElement(View, { style: S.sectionBar }),
    React.createElement(Text, { style: S.sectionTitle }, title),
  );
}

// ── Document builder ──────────────────────────────────────────────────────────
export function buildDocument(p: ConsultationPayload): React.ReactElement<React.ComponentProps<typeof Document>> {
  const imp            = p.unitSystem === "imperial";
  const ratingColor    = getRatingColor(p.rating);
  const band           = getRatingBand(p.rating);
  const badgeBg        = getRatingBadgeBg(p.rating);
  const borderColor    = ratingColor + "30";
  const interpretation = getInterpretation(p.rating);
  const formattedDate  = formatTimestamp(p.timestamp);

  // ── Page 1 data ────────────────────────────────────────────────────────────
  const clientRows: Row[] = [
    R("Name",              p.name),
    ...(p.company      ? [R("Company",        p.company)]                          : []),
    R("Email",             p.email),
    ...(p.contact      ? [R("Contact",        p.contact)]                          : []),
    R("Project Type",      p.projectType),
    ...(p.projectRef   ? [R("Project Ref",    p.projectRef)]                       : []),
    ...(p.preparedBy    ? [R("Prepared By",      p.preparedBy)]                        : []),
    R("Date",              p.projectDate ? formatTimestamp(p.projectDate) : formattedDate),
    ...(p.speakerBrand ? [R("Speaker Brand",  p.speakerBrand)]                     : []),
  ];

  const roomRows: Row[] = [
    R("Length",     imp ? fmtM(p.roomLength, true) : `${p.roomLength.toFixed(2)} m`),
    R("Width",      imp ? fmtM(p.roomWidth, true)  : `${p.roomWidth.toFixed(2)} m`),
    R("Height",     imp ? fmtM(p.roomHeight, true) : `${p.roomHeight.toFixed(2)} m`),
    R("Volume", (() => {
      const vol = p.roomVolume ?? p.roomWidth * p.roomHeight * p.roomLength;
      const volStr = imp ? `${(vol * 35.3147).toFixed(0)} ft³` : `${vol.toFixed(1)} m³`;
      const lStr = imp ? fmtM(p.roomLength, true) : `${p.roomLength.toFixed(2)} m`;
      const wStr = imp ? fmtM(p.roomWidth,  true) : `${p.roomWidth.toFixed(2)} m`;
      const hStr = imp ? fmtM(p.roomHeight, true) : `${p.roomHeight.toFixed(2)} m`;
      return `${volStr}  (${lStr} × ${wStr} × ${hStr})`;
    })()),
    ...(p.wallConstruction ? [R("Wall Construction", p.wallConstruction)] : []),
    ...(p.unitSystem ? [R("Unit System", p.unitSystem === "imperial" ? "Imperial" : "Metric")] : []),
    ...(p.roomColorScheme ? [R("Room Colour", ({ obsidian: "Acoustic Black", navy: "Midnight Velvet", slate: "Slate Stone", charcoal: "Carbon Felt" } as Record<string,string>)[p.roomColorScheme] ?? p.roomColorScheme)] : []),
  ];

  const acousticMetrics = [
    { label: "RT60 Duration",    value: `${fmtNum(p.rt60Seconds)} s`,    highlight: false },
    { label: "Sabine RT60",      value: `${fmtNum(p.rt60Sabine)} s`,     highlight: false },
    { label: "Eyring RT60",      value: `${fmtNum(p.rt60Eyring)} s`,     highlight: false },
    { label: "RT60 Target",      value: p.rt60Target ?? "—",              highlight: false },
    { label: "RT60 Status",      value: getRt60StatusLabel(p.rt60Status), highlight: false },
    { label: "Schroeder Freq.",  value: p.schroederHz != null ? `${p.schroederHz.toFixed(0)} Hz` : "—", highlight: false },
    { label: "Modal Risk",       value: p.modalRiskLevel ?? "—",          highlight: false },
    { label: "Cluster Severity", value: `${Math.round(p.clusterSeverityScore)} / 100`, highlight: false },
    { label: "Overall Rating",   value: `${Math.round(p.rating)} / 100`, highlight: true  },
  ];

  // ── Page 2 data ────────────────────────────────────────────────────────────
  const treatmentRows: Row[] = [
    R("Treatment Level",  p.treatmentLevel ?? "—"),
    R("Design Intent",    p.designIntent ?? "—"),
    R("Front Depth",      imp ? fmtIn(p.acousticDepthFront)   : fmtCm(p.acousticDepthFront)),
    R("Rear Depth",       imp ? fmtIn(p.acousticDepthRear)    : fmtCm(p.acousticDepthRear)),
    R("Side Depth",       imp ? fmtIn(p.acousticDepthLeft)    : fmtCm(p.acousticDepthLeft)),
    R("Ceiling Depth",    imp ? fmtIn(p.acousticDepthCeiling) : fmtCm(p.acousticDepthCeiling)),
  ];

  const speakerRows: Row[] = [
    R("Configuration",    p.speakerConfig ?? "—"),
    R("Speaker System",   p.speakerSystem ?? "—"),
    R("Mount Type",       p.mountType ?? "—"),
    R("Screen Placement", p.screenPlacement ?? "—"),
    R("Extra Side Pairs", p.extraSidePairs != null ? String(p.extraSidePairs) : "—"),
    R("Extra Ceiling Pairs", p.extraCeilingPairs != null ? String(p.extraCeilingPairs) : "—"),
  ];

  const screenRows: Row[] = [
    R("Viewing Standard",   p.viewingStandard ?? "—"),
    R("Aspect Ratio",       p.aspectRatio ?? "—"),
    R("Screen Diagonal",    p.screenDiagonalInches != null ? `${p.screenDiagonalInches}″` : "—"),
    R("Screen Width",       imp ? fmtIn(p.screenWidthM)  : fmtCm(p.screenWidthM)),
    R("Screen Height",      imp ? fmtIn(p.screenHeightM) : fmtCm(p.screenHeightM)),
    R("Throw Ratio",        p.throwRatio != null ? p.throwRatio.toFixed(2) : "—"),
    R("Throw Distance",     imp ? fmtM(p.throwDistanceM, true) : fmtM(p.throwDistanceM)),
    R("Viewing Distance",   imp ? fmtM(p.viewingDistanceM, true) : fmtM(p.viewingDistanceM)),
  ];

  const seatingRows: Row[] = [
    R("Seat Type",        p.seatType ?? "—"),
    R("Rows",             p.rowCount != null ? String(p.rowCount) : "—"),
    R("Seats per Row",    p.seatsPerRow != null ? String(p.seatsPerRow) : "—"),
    R("Total Seats",      p.totalSeats != null ? String(p.totalSeats) : "—"),
    R("Riser Step",       p.riserStepMm != null ? `${Math.round(p.riserStepMm)} mm` : "—"),
    R("Rake Angle",       p.riserRakeDeg != null ? `${p.riserRakeDeg.toFixed(1)}°` : "—"),
    R("Sightline Grade",  p.sightlineGrade ?? "—"),
    R("Total Rise",       imp ? fmtIn(p.totalRiseM) : fmtCm(p.totalRiseM)),
  ];

  // ── Page 1 ─────────────────────────────────────────────────────────────────
  const page1 = React.createElement(
    Page, { size: "A4" as const, style: S.page },

    React.createElement(View, { style: S.topBar }),

    // Header
    React.createElement(View, { style: S.headerRow },
      React.createElement(View, { style: S.headerLeft },
        React.createElement(Text, { style: S.eyebrow },  "Science of Sound"),
        React.createElement(Text, { style: S.title },    "Acoustic Performance Report"),
        React.createElement(Text, { style: S.subtitle }, "Full Design Analysis — Modal · Acoustic · AV · Seating"),
      ),
      React.createElement(View, { style: S.headerRight },
        React.createElement(Text, { style: S.dateLabel }, "Date Generated"),
        React.createElement(Text, { style: S.dateValue }, formattedDate),
      ),
    ),

    React.createElement(View, { style: S.rule }),

    // 01 — Client
    React.createElement(View, { style: S.sectionBlock },
      sectionHead("01 — Client Information"),
      ...mkRows(clientRows),
    ),

    // 02 — Room
    React.createElement(View, { style: S.sectionBlock },
      sectionHead("02 — Room Specification"),
      ...mkRows(roomRows),
    ),

    // 03 — Acoustic Performance
    React.createElement(View, { style: S.sectionBlock },
      sectionHead("03 — Acoustic Performance"),
      React.createElement(View, { style: S.ratingRow },
        // Rating badge
        React.createElement(View, { style: [S.ratingBadge, { backgroundColor: badgeBg, borderColor }] },
          React.createElement(Text, { style: [S.ratingNumber, { color: ratingColor }] }, String(Math.round(p.rating))),
          React.createElement(Text, { style: S.ratingDenom }, "/ 100"),
          React.createElement(Text, { style: [S.ratingBand, { color: ratingColor }] }, band),
        ),
        // Metrics panel
        React.createElement(View, { style: S.metricsPanel },
          ...acousticMetrics.map(m =>
            React.createElement(View, { key: m.label, style: m.highlight ? [S.metricRow, S.metricRowHL] : [S.metricRow] },
              React.createElement(Text, { style: m.highlight ? [S.metricLabel, S.metricLabelHL] : [S.metricLabel] }, m.label),
              React.createElement(Text, { style: m.highlight ? [S.metricValue, S.metricValueHL] : [S.metricValue] }, m.value),
            )
          ),
        ),
      ),
    ),

    // 04 — Technical Interpretation
    React.createElement(View, { style: S.sectionBlock },
      sectionHead("04 — Technical Interpretation"),
      React.createElement(Text, { style: S.interpretationText }, interpretation),
    ),

    // Footer
    React.createElement(View, { style: S.footer },
      React.createElement(View, { style: S.footerLeft },
        React.createElement(Text, { style: S.footerEngine }, "Generated by Science of Sound Acoustic Engine"),
        React.createElement(Text, { style: S.footerSub },    "Physics-grade modal simulation · Engine V2"),
      ),
      React.createElement(View, { style: S.footerRight },
        React.createElement(Text, { style: S.footerDisclaimer }, `Page 1 of ${p.materialSpecs ? 3 : 2} · For professional use only.`),
      ),
    ),

    React.createElement(View, { style: S.bottomBar }),
  );

  // ── Page 2 ─────────────────────────────────────────────────────────────────
  const page2 = React.createElement(
    Page, { size: "A4" as const, style: S.page },

    React.createElement(View, { style: S.topBar }),

    // Page 2 header
    React.createElement(View, { style: S.page2Header },
      React.createElement(Text, { style: S.page2Title }, "Science of Sound — Full Design Specification"),
      React.createElement(Text, { style: S.page2Sub },   formattedDate),
    ),

    React.createElement(View, { style: S.rule }),

    // Two-column: Treatment + Speakers
    React.createElement(View, { style: [S.twoCol, S.sectionBlock] },
      React.createElement(View, { style: S.colLeft },
        sectionHead("05 — Acoustic Treatment"),
        ...mkRows(treatmentRows),
      ),
      React.createElement(View, { style: S.colRight },
        sectionHead("06 — Speaker Configuration"),
        ...mkRows(speakerRows),
      ),
    ),

    // Two-column: Screen + Seating
    React.createElement(View, { style: [S.twoCol, S.sectionBlock] },
      React.createElement(View, { style: S.colLeft },
        sectionHead("07 — Screen & Display"),
        ...mkRows(screenRows),
      ),
      React.createElement(View, { style: S.colRight },
        sectionHead("08 — Seating Layout"),
        ...mkRows(seatingRows),
      ),
    ),

    // Advisory
    React.createElement(View, { style: S.sectionBlock },
      sectionHead("09 — Advisory Recommendation"),
      React.createElement(View, { style: S.advisoryBox },
        React.createElement(Text, { style: S.advisoryLabel }, "Recommended Action"),
        React.createElement(Text, { style: S.advisoryText },
          p.rating >= 80
            ? "Configuration is performing at professional grade. Maintain current treatment and subwoofer placement. Periodic calibration with REW or similar is recommended to verify as the room ages."
            : p.rating >= 60
            ? "Performance is good. Consider targeted bass trapping at primary room corners and parametric EQ on the subwoofer to address any residual modal peaks identified during measurement."
            : "Room treatment and subwoofer placement require optimisation. A multi-subwoofer strategy with DSP delay alignment is recommended. Professional site measurement with REW followed by calibration is strongly advised before sign-off."
        ),
      ),
    ),

    // Notes (conditional)
    ...(p.notes ? [
      React.createElement(View, { key: "notes", style: S.sectionBlock },
        sectionHead("10 — Client Notes"),
        React.createElement(View, { style: S.notesBox },
          React.createElement(Text, { style: S.notesText }, p.notes),
        ),
      ),
    ] : []),

    // Simulation Assumptions
    React.createElement(View, { style: S.sectionBlock },
      sectionHead("Simulation Assumptions"),
      React.createElement(View, { style: S.disclaimerBox },
        ...DISCLAIMER_ITEMS.map((item, i) =>
          React.createElement(View, { key: String(i), style: S.disclaimerItem },
            React.createElement(Text, { style: S.disclaimerIndex }, String(i + 1).padStart(2, "0")),
            React.createElement(Text, { style: S.disclaimerText },  item),
          )
        ),
      ),
    ),

    // Footer
    React.createElement(View, { style: S.footer },
      React.createElement(View, { style: S.footerLeft },
        React.createElement(Text, { style: S.footerEngine }, "Generated by Science of Sound Acoustic Engine"),
        React.createElement(Text, { style: S.footerSub },    "Physics-grade modal simulation · Engine V2"),
      ),
      React.createElement(View, { style: S.footerRight },
        React.createElement(Text, { style: S.footerDisclaimer }, `Page 2 of ${p.materialSpecs ? 3 : 2} · Results are simulation estimates only.`),
      ),
    ),

    React.createElement(View, { style: S.bottomBar }),
  );

  // ── Page 3 — Material Specification + BOQ Appendix (conditional) ───────────
  const page3 = (p.materialSpecs && p.boqSurfaces && p.boqTotals) ? React.createElement(
    Page, { size: "A4" as const, style: S.page },

    React.createElement(View, { style: S.topBar }),

    React.createElement(View, { style: S.page2Header },
      React.createElement(Text, { style: S.page2Title }, "Material Specification & Bill of Quantities"),
      React.createElement(Text, { style: S.page2Sub }, formattedDate),
    ),

    React.createElement(View, { style: S.rule }),

    // Material Specification — per surface with layer stack
    React.createElement(View, { style: S.sectionBlock },
      sectionHead("Material Specification — Construction Stack"),
      ...p.materialSpecs.map((mat, i) => {
        const badgeColors: Record<string, { bg: string; fg: string }> = {
          absorber: { bg: "#E8F0FE", fg: "#2C4A7C" },
          diffuser: { bg: "#F3E8FE", fg: "#6B21A8" },
          reflector: { bg: "#FEF3E2", fg: "#92400E" },
          bastrap: { bg: "#FEE2E2", fg: "#991B1B" },
          bare: { bg: "#F0EDE8", fg: "#777777" },
          floor: { bg: "#F0EDE8", fg: "#555555" },
        };
        const bc = badgeColors[mat.panelType] ?? badgeColors.bare;
        return React.createElement(View, { key: String(i), style: S.matSurface },
          // Surface header
          React.createElement(View, { style: S.matSurfHead },
            React.createElement(Text, { style: S.matSurfName }, mat.surface),
            React.createElement(Text, { style: [S.matBadge, { backgroundColor: bc.bg, color: bc.fg }] }, mat.panelType.toUpperCase()),
            React.createElement(Text, { style: S.matNrc }, mat.nrc > 0 ? `NRC ${mat.nrc.toFixed(2)}` : ""),
          ),
          // Panel name
          React.createElement(Text, { style: { fontSize: 9, color: "#444444", marginBottom: 2 } }, mat.panelName),
          // Frame
          ...(mat.frame !== "—" ? [
            React.createElement(Text, { key: "frame", style: S.matFrame }, `Frame: ${mat.frame}`),
          ] : []),
          // Layers
          ...mat.layers.map((layer, j) =>
            React.createElement(View, { key: String(j), style: S.matLayer },
              React.createElement(Text, { style: S.matLayerText }, `${j === mat.layers.length - 1 ? "└" : "├"} ${layer.material}`),
              React.createElement(Text, { style: S.matLayerDim }, layer.thickness),
              React.createElement(Text, { style: S.matLayerPurp }, `— ${layer.purpose}`),
            )
          ),
        );
      }),
    ),

    React.createElement(View, { style: S.rule }),

    // BOQ Table
    React.createElement(View, { style: S.sectionBlock },
      sectionHead("Bill of Quantities"),
      React.createElement(Text, { style: { fontSize: 8, color: "#777777", marginBottom: 6 } },
        `Panel size: ${p.boqPanelSize ?? "2\' × 2\'"} · Coverage: ${p.boqCoveragePct ?? 0}%`
      ),
      // Table header
      React.createElement(View, { style: S.boqHeader },
        React.createElement(Text, { style: [S.boqHeaderCell, { flex: 2 }] }, "Surface"),
        React.createElement(Text, { style: [S.boqHeaderCell, { flex: 1, textAlign: "right" }] }, "Area m²"),
        React.createElement(Text, { style: [S.boqHeaderCell, { flex: 1, textAlign: "right" }] }, "Panels"),
        React.createElement(Text, { style: [S.boqHeaderCell, { flex: 1, textAlign: "right" }] }, "Frame m"),
        React.createElement(Text, { style: [S.boqHeaderCell, { flex: 1, textAlign: "right" }] }, "Insul. m²"),
      ),
      // Data rows
      ...p.boqSurfaces.map((row, i) =>
        React.createElement(View, { key: String(i), style: [S.boqRow, ...(i % 2 === 1 ? [S.tableRowAlt] : [])] },
          React.createElement(Text, { style: [S.boqCell, { flex: 2 }] }, row.surface),
          React.createElement(Text, { style: [S.boqCell, { flex: 1, textAlign: "right" }] }, row.coveredAreaM2.toFixed(1)),
          React.createElement(Text, { style: [S.boqCellBold, { flex: 1, textAlign: "right" }] }, row.panelCount > 0 ? String(row.panelCount) : "—"),
          React.createElement(Text, { style: [S.boqCell, { flex: 1, textAlign: "right" }] }, row.frameLengthM > 0 ? row.frameLengthM.toFixed(1) : "—"),
          React.createElement(Text, { style: [S.boqCell, { flex: 1, textAlign: "right" }] }, row.insulationAreaM2 > 0 ? row.insulationAreaM2.toFixed(1) : "—"),
        )
      ),
      // Totals row
      React.createElement(View, { style: S.boqTotalRow },
        React.createElement(Text, { style: [S.boqTotalCell, { flex: 2 }] }, "TOTAL"),
        React.createElement(Text, { style: [S.boqTotalCell, { flex: 1, textAlign: "right" }] }, p.boqTotals.totalCoveredM2.toFixed(1)),
        React.createElement(Text, { style: [S.boqTotalCell, { flex: 1, textAlign: "right" }] }, String(p.boqTotals.totalPanels)),
        React.createElement(Text, { style: [S.boqTotalCell, { flex: 1, textAlign: "right" }] }, p.boqTotals.totalFrameM.toFixed(1)),
        React.createElement(Text, { style: [S.boqTotalCell, { flex: 1, textAlign: "right" }] }, p.boqTotals.totalInsulationM2.toFixed(1)),
      ),
    ),

    // Footer
    React.createElement(View, { style: S.footer },
      React.createElement(View, { style: S.footerLeft },
        React.createElement(Text, { style: S.footerEngine }, "Generated by Science of Sound Acoustic Engine"),
        React.createElement(Text, { style: S.footerSub },    "Material specification for procurement · Engine V2"),
      ),
      React.createElement(View, { style: S.footerRight },
        React.createElement(Text, { style: S.footerDisclaimer }, "Page 3 of 3 · BOQ is an estimate — verify on site."),
      ),
    ),

    React.createElement(View, { style: S.bottomBar }),
  ) : null;

  return React.createElement(
    Document,
    { title: "Acoustic Performance Report", author: "Science of Sound" },
    page1,
    page2,
    ...(page3 ? [page3] : []),
  ) as React.ReactElement<React.ComponentProps<typeof Document>>;
}

export function AcousticReportDocument({ p }: { p: ConsultationPayload }) {
  return buildDocument(p);
}