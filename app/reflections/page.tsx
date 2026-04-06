"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import styles from "./reflections.module.css";
import Image from "next/image";
import gsap from "gsap";
import ScrollTrigger from "gsap/ScrollTrigger";
import GlobalBackground from "./GlobalBackground";

// ─────────────────────────────────────────────────────────────────────────────
// WORD-SPLIT — wraps each word for individual GSAP animation
// ─────────────────────────────────────────────────────────────────────────────
function WordSplit({ text, className = "" }: { text: string; className?: string }) {
  return (
    <span className={className}>
      {text.split(" ").map((word, i) => (
        <span key={i} className={styles.word} style={{ display:"inline-block", marginRight:"0.28em" }}>
          {word}
        </span>
      ))}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PHRASE — inline highlighted words, still individually animated by GSAP.
// section: "life"|"evolution"|"reality"|"religion"|"consciousness"|"sysview"|"questions"
// ─────────────────────────────────────────────────────────────────────────────
function Phrase({ text, section }: { text: string; section: string }) {
  return (
    <>
      {text.split(" ").map((word, i) => (
        <span key={i}
          className={`${styles.word} ${styles[`hl-${section}`]}`}
          style={{ display:"inline-block", marginRight:"0.28em" }}>
          {word}
        </span>
      ))}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION CURIOSITY OPENER — one-line per section, rendered as prop
// ─────────────────────────────────────────────────────────────────────────────
function CuriosityLine({ text }: { text: string }) {
  return (
    <div data-anim="curiosity" className={styles["curiosity-line"]}>
      <span className={styles["curiosity-mark"]}>?</span>
      <span className={styles["curiosity-text"]}>{text}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// NAV DOTS
// ─────────────────────────────────────────────────────────────────────────────
const NAV_SECTIONS = [
  { id:"hero",          label:"Observer"      },
  { id:"life",          label:"Life"          },
  { id:"evolution",     label:"Evolution"     },
  { id:"reality",       label:"Reality"       },
  { id:"religion",      label:"Meaning"       },
  { id:"consciousness", label:"Consciousness" },
  { id:"sysview",       label:"System"        },
  { id:"questions",     label:"Questions"     },
];

function NavDots({ active }: { active: number }) {
  return (
    <nav className={styles["nav-dots"]} aria-label="Section navigation">
      {NAV_SECTIONS.map((s, i) => (
        <a key={s.id} href={`#${s.id}`}
          className={`${styles["nav-dot-wrap"]} ${i === active ? styles["nav-dot-active"] : ""}`}
          aria-label={s.label}
          onClick={e => { e.preventDefault(); document.getElementById(s.id)?.scrollIntoView({ behavior:"smooth" }); }}>
          <span className={styles["nav-dot"]} />
          <span className={styles["nav-dot-label"]}>{s.label}</span>
        </a>
      ))}
    </nav>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DIAGRAMS
// ─────────────────────────────────────────────────────────────────────────────

// S01 — Atom orbit widget
function AtomWidget() {
  return (
    <div className={styles["atom-widget"]}>
      <div className={styles["atom-scene"]}>
        <div className={styles["atom-core"]} />
        <div className={styles["atom-pulse"]} />
        <div className={styles["atom-pulse"]} />
        <div className={styles["atom-ring"] + " " + styles["atom-ring-1"]}>
          <div className={styles["atom-electron"]} />
        </div>
        <div className={styles["atom-ring"] + " " + styles["atom-ring-2"]}>
          <div className={styles["atom-electron"]} />
        </div>
        <div className={styles["atom-ring"] + " " + styles["atom-ring-3"]}>
          <div className={styles["atom-electron"]} />
        </div>
      </div>
    </div>
  );
}

// S01 — Life flow
const FLOW_NODES = [
  { label:"Energy Input",      sub:"Thermodynamic gradient" },
  { label:"Matter",            sub:"Atomic structure"       },
  { label:"Self-Organization", sub:"Bounded chemistry"      },
  { label:"Replication",       sub:"Information transfer"   },
  { label:"Adaptation",        sub:"Differential selection" },
  { label:"Consciousness",     sub:"Internal modeling"      },
];
function LifeFlowDiagram() {
  return (
    <div className={styles["flow-diagram"]}>
      {FLOW_NODES.map((node, i) => (
        <div key={node.label} className={styles["flow-node-wrap"]}>
          <div className={styles["flow-node"]}>
            <div className={styles["flow-node-circle"]}>
              <span className={styles["flow-node-index"]}>{String(i+1).padStart(2,"0")}</span>
            </div>
            <div className={styles["flow-node-text"]}>
              <span className={styles["flow-node-label"]}>{node.label}</span>
              <span className={styles["flow-node-sub"]}>{node.sub}</span>
            </div>
          </div>
          {i < FLOW_NODES.length - 1 && (
            <div className={styles["flow-connector"]}>
              <svg width="20" height="28" viewBox="0 0 20 28" style={{display:"block",margin:"0 auto"}}>
                <line x1="10" y1="0" x2="10" y2="20" stroke="#4A7AAA" strokeWidth="1" strokeOpacity="0.5"/>
                <path d="M6 16 L10 22 L14 16" fill="none" stroke="#4A7AAA" strokeWidth="1" strokeOpacity="0.5"/>
                <circle r="3" fill="#7BAAD4" opacity="0.9">
                  <animateMotion dur="1.8s" begin={`${i * 0.30}s`} repeatCount="indefinite"
                    path="M10,2 L10,20"/>
                </circle>
              </svg>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// S02 — Evolution branch
const EVO_NODES = [
  { label:"Biology",     year:"~3.8B BCE",  desc:"Brains built by natural selection"    },
  { label:"Language",    year:"~70,000 BCE", desc:"Knowledge across generations"         },
  { label:"Civilization",year:"~5,000 BCE",  desc:"Written memory, shared institutions"  },
  { label:"Industry",    year:"1760 CE",     desc:"Machines extend physical capacity"    },
  { label:"Digital",     year:"1990 CE",     desc:"Global information access"            },
  { label:"AI",          year:"Present",     desc:"Intelligence outside biology"         },
];
const EVO_POS = [{x:16,y:10},{x:30,y:26},{x:46,y:42},{x:60,y:58},{x:74,y:74},{x:88,y:90}];
function EvoBranchDiagram() {
  const tx = (n:number) => (n/100)*360;
  const ty = (n:number) => (n/100)*360;
  const pathD = EVO_POS.map((p,i) => `${i===0?"M":"L"}${tx(p.x).toFixed(1)},${ty(p.y).toFixed(1)}`).join(" ");
  return (
    <>
      <svg viewBox="0 0 360 360" width="100%" style={{maxWidth:320,display:"block",margin:"0 auto"}}>
        {/* Animated branch spine */}
        <path d={pathD} fill="none" stroke="#4B6A9A" strokeWidth="1.5" strokeOpacity="0.6"
          id="evo-animated-spine" strokeDasharray="900" strokeDashoffset="900"/>
        {EVO_NODES.map((n,i)=>{
          const px=tx(EVO_POS[i].x), py=ty(EVO_POS[i].y);
          return (
            <g key={n.label} data-anim="evo-node">
              <circle cx={px} cy={py} r={10} fill="none" stroke="#6A9ACA" strokeWidth="0.8" strokeOpacity="0.25"/>
              <circle cx={px} cy={py} r={5} fill="#1a2c4a" stroke="#7BAAD4" strokeWidth="1.2"/>
              <text x={px+14} y={py-2} fontSize="12" fill="#D0E4F7" fontFamily="Georgia,serif">{n.label}</text>
              <text x={px+14} y={py+12} fontSize="9" fill="#7BAAD4" fontFamily="sans-serif" letterSpacing="0.05em">{n.year}</text>
              <text x={px+14} y={py+24} fontSize="8" fill="#5a7898" fontFamily="sans-serif" fontStyle="italic">{n.desc}</text>
            </g>
          );
        })}
        {/* Traveling dot along the branch spine */}
        {(() => {
          const pathD = EVO_POS.map((p,i) => `${i===0?"M":"L"}${tx(p.x).toFixed(1)},${ty(p.y).toFixed(1)}`).join(" ");
          return (
            <>
              <path id="evo-spine" d={pathD} fill="none" stroke="none"/>
              <circle r="4" fill="#7BAAD4" opacity="0.85">
                <animateMotion dur="4.2s" repeatCount="indefinite">
                  <mpath href="#evo-spine"/>
                </animateMotion>
              </circle>
              <circle r="2.5" fill="#A8D4F0" opacity="0.6">
                <animateMotion dur="4.2s" begin="0.6s" repeatCount="indefinite">
                  <mpath href="#evo-spine"/>
                </animateMotion>
              </circle>
            </>
          );
        })()}
      </svg>
    </>
  );
}

// S03 — Predictive stack
const PRED_LAYERS = [
  { label:"Sensory Input",       note:"~11M bits/sec received"      },
  { label:"Neural Filtering",    note:"~40 bits/sec reach awareness" },
  { label:"Predictive Modeling", note:"Priors override raw data"    },
  { label:"Contextual Framing",  note:"Memory + emotion applied"    },
  { label:"Perceived World",     note:"A construction, not a copy"  },
];
function PredictiveStack() {
  return (
    <div className={styles["pred-stack"]}>
        <span className={styles["pred-stack-label"]}>How the brain builds reality</span>
        {PRED_LAYERS.map((layer, i) => (
          <div key={layer.label} data-anim="pred-layer" className={styles["pred-layer-wrap"]}>
            <div className={styles["pred-layer"]}>
              <span className={styles["pred-layer-name"]}>{layer.label}</span>
              <span className={styles["pred-layer-note"]}>{layer.note}</span>
            </div>
            {i < PRED_LAYERS.length - 1 && (
              <div className={styles["pred-arrow"]}>
                <svg width="20" height="24" viewBox="0 0 20 24" style={{display:"block",margin:"0 auto"}}>
                  <line x1="10" y1="0" x2="10" y2="16" stroke="#4A7AAA" strokeWidth="1" strokeOpacity="0.5"/>
                  <path d="M6 12 L10 18 L14 12" fill="none" stroke="#4A7AAA" strokeWidth="1" strokeOpacity="0.5"/>
                  <circle r="2.8" fill="#b08ee0" opacity="0.85">
                    <animateMotion dur="2.2s" begin={`${i * 0.44}s`} repeatCount="indefinite"
                      path="M10,1 L10,15"/>
                  </circle>
                </svg>
              </div>
            )}
          </div>
        ))}
    </div>
  );
}

// S04 — Belief map
const BELIEF_ROWS = [
  { q:"Why does anything exist?",  answers:["Divine creation","Eternal cycle","Brute fact","Unknown"]       },
  { q:"What happens when we die?", answers:["Soul persists","Rebirth","Return to matter","Uncertain"]       },
  { q:"How should we live?",       answers:["Divine law","Dharma / duty","Reason & virtue","Self-chosen"]   },
  { q:"What is the self?",         answers:["Unique soul","Illusion","Social construct","Open question"]    },
];
const TRADITION_LABELS = ["Abrahamic","Dharmic","Secular","Philosophy"];
function BeliefMap() {
  return (
    <>
      <p className={styles["belief-map-title"]}>Same questions. Different answers.</p>
      <div className={styles["belief-table"]}>
        <div className={styles["belief-table-head"]}>
          <div className={styles["belief-q-cell"]} />
          {TRADITION_LABELS.map(t=><div key={t} className={styles["belief-t-cell"]}>{t}</div>)}
        </div>
        {BELIEF_ROWS.map((row,i)=>(
          <div key={i} data-anim="belief-row" className={styles["belief-table-row"]}>
            <div className={styles["belief-q-cell"]}>{row.q}</div>
            {row.answers.map((a,j)=><div key={j} className={styles["belief-a-cell"]}>{a}</div>)}
          </div>
        ))}
      </div>
    </>
  );
}

// S05 — Neural spark
function NeuralSpark() {
  return (
    <div className={styles["neural-spark"]}>
      <div className={styles["neural-node"] + " " + styles["neural-node-1"]} />
      <div className={styles["neural-node"] + " " + styles["neural-node-2"]} />
      <div className={styles["neural-node"] + " " + styles["neural-node-3"]} />
    </div>
  );
}

// S05 — Consciousness loop
const LOOP_NODES = [
  { label:"Environment", angle:-90 },
  { label:"Brain",       angle:  0 },
  { label:"Model",       angle: 90 },
  { label:"Self",        angle:180 },
];
const LR=100, LCX=160, LCY=160, LNR=9;
function lnPos(deg:number){const r=(deg*Math.PI)/180;return{x:LCX+LR*Math.cos(r),y:LCY+LR*Math.sin(r)};}
function lnArc(f:number,t:number){
  const sr=(f*Math.PI)/180, er=(t*Math.PI)/180, off=(LNR+5)/LR;
  const sx=LCX+LR*Math.cos(sr+off), sy=LCY+LR*Math.sin(sr+off);
  const ex=LCX+LR*Math.cos(er-off), ey=LCY+LR*Math.sin(er-off);
  return `M${sx.toFixed(1)} ${sy.toFixed(1)} A${LR} ${LR} 0 0 1 ${ex.toFixed(1)} ${ey.toFixed(1)}`;
}
function ConsciousnessLoop() {
  const angles = LOOP_NODES.map(n=>n.angle);
  return (
    <svg viewBox="0 0 320 320" width="100%" style={{maxWidth:300,display:"block",margin:"0 auto"}}>
        <defs>
          <marker id="loop-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0.5 L5,3 L0,5.5" fill="none" stroke="#7BAAD4" strokeWidth="1.2"/>
          </marker>
        </defs>
        <circle cx={LCX} cy={LCY} r={LR} fill="none" stroke="#1a3050" strokeWidth="1" strokeDasharray="4 6"/>
        {angles.map((fromA,i)=>{
          const toA=angles[(i+1)%angles.length]+(i===angles.length-1?360:0);
          return <path key={i} d={lnArc(fromA,toA)} fill="none" stroke="#4A7AAA" strokeWidth="1.5" markerEnd="url(#loop-arrow)"/>;
        })}
        {angles.map((fromA,i)=>{
          const toA=angles[(i+1)%angles.length]+(i===angles.length-1?360:0);
          return (
            <g key={`d${i}`}>
              <path id={`la${i}`} d={lnArc(fromA,toA)} fill="none" stroke="none"/>
              <circle r="3.5" fill="#7BAAD4" opacity="0.9">
                <animateMotion dur="2.8s" begin={`${i*0.7}s`} repeatCount="indefinite">
                  <mpath href={`#la${i}`}/>
                </animateMotion>
              </circle>
            </g>
          );
        })}
        {LOOP_NODES.map(node=>{
          const{x,y}=lnPos(node.angle);
          const lx=LCX+(LR+32)*Math.cos((node.angle*Math.PI)/180);
          const ly=LCY+(LR+32)*Math.sin((node.angle*Math.PI)/180);
          const anchor=node.angle===0?"start":node.angle===180?"end":"middle";
          return (
            <g key={node.label}>
              <circle cx={x} cy={y} r={LNR+5} fill="none" stroke="#4A7AAA" strokeWidth="0.8" opacity="0.3"/>
              <circle cx={x} cy={y} r={LNR} fill="#0e2040" stroke="#7BAAD4" strokeWidth="1.5"/>
              <text x={lx} y={ly} fontSize="11" fontFamily="sans-serif" fill="#A0C4E8"
                textAnchor={anchor} dominantBaseline="middle" letterSpacing="0.04em">{node.label}</text>
            </g>
          );
        })}
        <text x={LCX} y={LCY-5} fontSize="8" fill="#3A6080" textAnchor="middle" fontFamily="sans-serif" letterSpacing="0.1em">PERCEPTION</text>
        <text x={LCX} y={LCY+7} fontSize="8" fill="#3A6080" textAnchor="middle" fontFamily="sans-serif" letterSpacing="0.1em">LOOP</text>
      </svg>
  );
}

// S07 — Animated question mark spiral
function QuestionSpiral() {
  // Spiral arms: 3 concentric arcs growing outward
  const spiralArcs = [
    { r: 38,  sw: 0.8, op: 0.5,  dash: 220,  dur: "8s",  delay: "0s"   },
    { r: 62,  sw: 0.6, op: 0.35, dash: 360,  dur: "13s", delay: "0.4s" },
    { r: 88,  sw: 0.5, op: 0.25, dash: 520,  dur: "19s", delay: "0.8s" },
    { r: 114, sw: 0.4, op: 0.16, dash: 690,  dur: "27s", delay: "1.2s" },
  ];

  // Orbiting dots: [radius, angle-offset, size, speed, color]
  const orbitDots: [number,number,number,string,string][] = [
    [38,  0,   3.2, "5s",  "#7BAAD4"],
    [38,  180, 2.4, "5s",  "#A0C4E8"],
    [62,  60,  2.8, "9s",  "#50d4a0"],
    [62,  240, 2.0, "9s",  "#7BAAD4"],
    [88,  30,  2.4, "14s", "#b070ff"],
    [88,  150, 1.8, "14s", "#7BAAD4"],
    [88,  270, 2.0, "14s", "#50d4a0"],
    [114, 45,  1.6, "21s", "#A0C4E8"],
    [114, 165, 2.0, "21s", "#b070ff"],
    [114, 285, 1.4, "21s", "#7BAAD4"],
  ];

  const CX = 130, CY = 140;

  return (
    <div className={styles["diagram-float"]} style={{ display:"flex", justifyContent:"center", alignItems:"flex-start", paddingTop:24 }}>
      <svg viewBox="0 0 260 280" width="100%" style={{ maxWidth:280, display:"block" }}>
        <defs>
          {orbitDots.map(([r,,,,],i) => (
            <path key={i} id={`orbit-path-${i}`}
              d={`M${CX+r},${CY} a${r},${r} 0 1,1 -0.01,0`}
              fill="none"/>
          ))}
        </defs>

        {/* Concentric spiral rings — dashed, slowly rotating */}
        {spiralArcs.map(({r,sw,op,dash,dur,delay},i)=>(
          <circle key={i} cx={CX} cy={CY} r={r}
            fill="none"
            stroke={i%2===0?"#4A7AAA":"#6A5A9A"}
            strokeWidth={sw}
            strokeOpacity={op}
            strokeDasharray={`${dash*0.62} ${dash*0.38}`}
            style={{ transformOrigin:`${CX}px ${CY}px`, animation:`qs-spin${i%2===0?"":"Rev"} ${dur} linear ${delay} infinite` }}
          />
        ))}

        {/* Orbiting dots */}
        {orbitDots.map(([r,startAng,sz,spd,col],i)=>(
          <circle key={i} r={sz} fill={col} opacity="0.85">
            <animateMotion dur={spd} begin={`${(startAng/360)*parseFloat(spd)}s`} repeatCount="indefinite">
              <mpath href={`#orbit-path-${i}`}/>
            </animateMotion>
          </circle>
        ))}

        {/* Central ? glyph — drawn as SVG path */}
        {/* Arc of the question mark hook */}
        <path
          d="M118,108 C118,88 142,80 148,96 C154,112 134,120 132,138"
          fill="none" stroke="#A0C4E8" strokeWidth="3.5"
          strokeLinecap="round"
          className={styles["qs-stroke"]}
          style={{ strokeDasharray:90, strokeDashoffset:90 }}
        />
        {/* Dot beneath */}
        <circle cx={CX+2} cy={152} r={4} fill="#A0C4E8" opacity="0"
          className={styles["qs-dot"]}
        />

        {/* Faint label */}
        <text x={CX} y={230} textAnchor="middle"
          fontSize="8" fill="rgba(160,196,232,0.3)"
          fontFamily="sans-serif" letterSpacing="0.18em">
          STILL OPEN
        </text>
      </svg>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────────────────────
export default function ReflectionsPage() {
  const containerRef = useRef<HTMLDivElement|null>(null);
  const [activeSection, setActiveSection] = useState(0);

  useEffect(() => {
    const obs = NAV_SECTIONS.map((s,i) => {
      const el = document.getElementById(s.id);
      if (!el) return null;
      const o = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting) setActiveSection(i); },
        { threshold: 0.3 }
      );
      o.observe(el);
      return o;
    });
    return () => obs.forEach(o=>o?.disconnect());
  }, []);

  useLayoutEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
  }, []);

  // ── GSAP animations ─────────────────────────────────────────────────────────
  useLayoutEffect(() => {
    // Step 1: immediately hide all animated elements before first paint
    gsap.set("#hero h1", { opacity: 0, y: 50 });
    gsap.set("[data-anim='hero-label']", { opacity: 0, x: -30 });
    gsap.set("#hero [data-anim='hero-meta'] > *", { opacity: 0, y: 14 });
    gsap.set("#hero p", { opacity: 0, y: 28 });

    const allTargets = [
      "[data-anim='curiosity']",
      "[data-anim='header']",
      "[data-anim='body'] p",
      "[data-anim='stat']",
      "[data-anim='pred-layer']",
      "[data-anim='belief-row']",
      "[data-anim='god-block']",
      "[data-anim='c-line']",
      "[data-anim='sysview-row']",
      "[data-anim='q-item']",
      "[data-anim='closing']",
      "[data-anim='evo-node']",
    ];
    allTargets.forEach(t => gsap.set(t, { opacity: 0 }));
    gsap.set("#evo-animated-spine", { strokeDashoffset: 900 });
    gsap.set(".qs-stroke", { strokeDashoffset: 90 });
    gsap.set(".qs-dot", { opacity: 0 });

    // Step 2: hero fires on load
    const tl = gsap.timeline({ delay: 0.15 });
    tl.to("[data-anim='hero-label']", { opacity: 1, x: 0, duration: 0.6, ease: "power3.out" })
      .to("#hero h1", { opacity: 1, y: 0, duration: 1.0, ease: "power4.out" }, "-=0.4")
      .to("#hero p", { opacity: 1, y: 0, duration: 0.7, ease: "power3.out", stagger: 0.18 }, "-=0.5")
      .to("#hero [data-anim='hero-meta'] > *", { opacity: 1, y: 0, duration: 0.5, ease: "power2.out", stagger: 0.1 }, "-=0.3");

    // Step 3: per-section scroll reveals
    const sections: [string, gsap.TweenVars, gsap.TweenVars, string][] = [
      // [sectionId, fromVars, toVars, targets]
    ];

    const reveal = (
      trigger: string,
      targets: string,
      from: gsap.TweenVars,
      to: gsap.TweenVars,
      start = "top 75%"
    ) => {
      gsap.to(targets, {
        ...to,
        scrollTrigger: { trigger, start, toggleActions: "play none none none" },
      });
      // already set to "from" state above
    };

    const up = (trigger: string, targets: string, delay = 0, stagger = 0.13) =>
      gsap.to(`${trigger} ${targets}`, {
        opacity: 1, y: 0,
        duration: 0.85, ease: "power3.out", delay, stagger,
        scrollTrigger: { trigger, start: "top 75%", toggleActions: "play none none none" },
      });
    const left = (trigger: string, targets: string, delay = 0, stagger = 0.11) =>
      gsap.to(`${trigger} ${targets}`, {
        opacity: 1, x: 0,
        duration: 0.75, ease: "power3.out", delay, stagger,
        scrollTrigger: { trigger, start: "top 75%", toggleActions: "play none none none" },
      });
    const right = (trigger: string, targets: string, delay = 0, stagger = 0.11) =>
      gsap.to(`${trigger} ${targets}`, {
        opacity: 1, x: 0,
        duration: 0.75, ease: "power3.out", delay, stagger,
        scrollTrigger: { trigger, start: "top 75%", toggleActions: "play none none none" },
      });
    // Diagram panels: fire when section is 50% into viewport — pure horizontal slide from right
    const diagram = (trigger: string) =>
      gsap.fromTo(`${trigger} [data-anim='diagram']`,
        { opacity: 0, x: 72 },
        {
          opacity: 1, x: 0,
          duration: 0.75, ease: "power3.out",
          scrollTrigger: { trigger, start: "top 50%", toggleActions: "play none none none" },
        }
      );

    // Set additional from states needed per section
    gsap.set("[data-anim='curiosity']",   { x: -50 });
    gsap.set("[data-anim='header']",      { y: 40 });
    gsap.set("[data-anim='body'] p",      { y: 36 });
    gsap.set("[data-anim='stat']",        { y: 30, scale: 0.8 });
    gsap.set("[data-anim='pred-layer']",  { x: 50 });
    gsap.set("[data-anim='belief-row']",  { y: 24 });
    gsap.set("[data-anim='god-block']",   { y: 32 });
    gsap.set("[data-anim='c-line']",      { x: -44 });
    gsap.set("[data-anim='sysview-row']", { x: -50 });
    gsap.set("[data-anim='q-item']",      { y: 30 });
    gsap.set("[data-anim='closing']",     { y: 28 });
    gsap.set("[data-anim='evo-node']",    { scale: 0 });

    // ── S01 LIFE ──────────────────────────────────────────────────────────────
    left("#life",  "[data-anim='curiosity']", 0);
    up(  "#life",  "[data-anim='header']",    0.15);
    up(  "#life",  "[data-anim='body'] p",    0.35, 0.16);
    gsap.to("#life [data-anim='stat']", {
      opacity: 1, y: 0, scale: 1,
      duration: 0.65, ease: "back.out(1.6)", stagger: 0.14, delay: 0.55,
      scrollTrigger: { trigger: "#life", start: "top 75%", toggleActions: "play none none none" },
    });
    diagram("#life");

    // ── S02 EVOLUTION ─────────────────────────────────────────────────────────
    left("#evolution", "[data-anim='curiosity']", 0);
    up(  "#evolution", "[data-anim='header']",    0.15);
    up(  "#evolution", "[data-anim='body'] p",    0.35, 0.16);
    diagram("#evolution");
    gsap.to("#evo-animated-spine", {
      strokeDashoffset: 0, duration: 2.0, ease: "power2.inOut",
      scrollTrigger: { trigger: "#evolution", start: "top 50%", toggleActions: "play none none none" },
    });
    gsap.to("[data-anim='evo-node']", {
      opacity: 1, scale: 1,
      duration: 0.45, ease: "back.out(2.5)", stagger: 0.22, delay: 0.2,
      scrollTrigger: { trigger: "#evolution", start: "top 50%", toggleActions: "play none none none" },
    });

    // ── S03 REALITY ───────────────────────────────────────────────────────────
    left("#reality", "[data-anim='curiosity']", 0);
    up(  "#reality", "[data-anim='header']",    0.15);
    up(  "#reality", "[data-anim='body'] p",    0.35, 0.16);
    diagram("#reality");
    gsap.to("#reality [data-anim='pred-layer']", {
      opacity: 1, x: 0,
      duration: 0.55, ease: "power3.out", stagger: 0.11, delay: 0.15,
      scrollTrigger: { trigger: "#reality", start: "top 50%", toggleActions: "play none none none" },
    });

    // ── S04 RELIGION ──────────────────────────────────────────────────────────
    left("#religion", "[data-anim='curiosity']", 0);
    up(  "#religion", "[data-anim='header']",    0.15);
    up(  "#religion", "[data-anim='body'] p",    0.35, 0.16);
    diagram("#religion");
    gsap.to("#religion [data-anim='belief-row']", {
      opacity: 1, y: 0,
      duration: 0.55, ease: "power3.out", stagger: 0.1, delay: 0.15,
      scrollTrigger: { trigger: "#religion", start: "top 50%", toggleActions: "play none none none" },
    });
    up("#religion", "[data-anim='god-block']", 0.55);

    // ── S05 CONSCIOUSNESS ─────────────────────────────────────────────────────
    left("#consciousness", "[data-anim='curiosity']", 0);
    up(  "#consciousness", "[data-anim='header']",    0.15);
    gsap.to("#consciousness [data-anim='c-line']", {
      opacity: 1, x: 0,
      duration: 0.6, ease: "power3.out", stagger: 0.3, delay: 0.2,
      scrollTrigger: { trigger: "#consciousness", start: "top 75%", toggleActions: "play none none none" },
    });
    up("#consciousness", "[data-anim='body'] p", 0.5, 0.15);
    diagram("#consciousness");

    // ── S06 SYSVIEW ───────────────────────────────────────────────────────────
    left("#sysview", "[data-anim='curiosity']", 0);
    up(  "#sysview", "[data-anim='header']",    0.15);
    up(  "#sysview", "[data-anim='body'] p",    0.35, 0.16);
    diagram("#sysview");
    gsap.to("#sysview [data-anim='sysview-row']", {
      opacity: 1, x: 0,
      duration: 0.55, ease: "power3.out", stagger: 0.10, delay: 0.15,
      scrollTrigger: { trigger: "#sysview", start: "top 50%", toggleActions: "play none none none" },
    });

    // ── S07 QUESTIONS ─────────────────────────────────────────────────────────
    left("#questions", "[data-anim='curiosity']", 0);
    up(  "#questions", "[data-anim='header']",    0.15);
    gsap.to("#questions [data-anim='q-item']", {
      opacity: 1, y: 0,
      duration: 0.55, ease: "power3.out", stagger: 0.08,
      scrollTrigger: { trigger: "#questions", start: "top 75%", toggleActions: "play none none none" },
    });
    up("#questions", "[data-anim='closing']", 0.1);
    gsap.fromTo("#questions [data-anim='diagram']",
      { opacity: 0, x: 72 },
      {
        opacity: 1, x: 0,
        duration: 0.75, ease: "power3.out",
        scrollTrigger: { trigger: "#questions", start: "top 50%", toggleActions: "play none none none" },
      }
    );
    gsap.to("#questions .qs-stroke", {
      strokeDashoffset: 0,
      duration: 1.4, ease: "power2.inOut", delay: 0.3,
      scrollTrigger: { trigger: "#questions", start: "top 50%", toggleActions: "play none none none" },
    });
    gsap.to("#questions .qs-dot", {
      opacity: 1,
      duration: 0.5, ease: "power2.out", delay: 1.4,
      scrollTrigger: { trigger: "#questions", start: "top 50%", toggleActions: "play none none none" },
    });

    return () => { ScrollTrigger.getAll().forEach(t => t.kill()); };
  }, []);

  useEffect(() => {
    const cards = document.querySelectorAll<HTMLElement>(`.${styles["expand-card"]}`);
    const onClick = (e:Event) => {
      const card = e.currentTarget as HTMLElement;
      const wasOpen = card.classList.contains(styles.open);
      cards.forEach(c=>c.classList.remove(styles.open));
      if (!wasOpen) card.classList.add(styles.open);
    };
    cards.forEach(c=>c.addEventListener("click",onClick));
    return () => cards.forEach(c=>c.removeEventListener("click",onClick));
  }, []);

  return (
    <div className={styles.root} ref={containerRef}>
      <GlobalBackground />
      <NavDots active={activeSection} />

      {/* content-wrap: mask fades text at top/bottom. Canvas at z:0 sits outside, always clear. */}
      <div className={styles["content-wrap"]}>
      <section id="hero" className={`${styles["cin-section"]} ${styles.hero}`}>
        <div className={styles["cin-hero-split"]}>

          {/* ── LEFT — original intro text + personal details mixed ── */}
          <div className={styles["hero-text-side"]}>

            <span data-anim="hero-label" className={styles["hero-eyebrow"]}>
              Thinking out loud
            </span>

            <h1 data-anim="hero-title" className={styles["hero-title"]}>
              Reflections
            </h1>

            <div className={styles["hero-rule"]} />

            {/* Identity line — natural, not a label */}
            <p className={styles["hero-who"]}>
              <span className={styles["hero-who-name"]}>human reflections by Naveen</span>
              <span className={styles["hero-who-sep"]}>—</span>
              <span className={styles["hero-who-role"]}>engineering systems and exploring the science of how they behave</span>
            </p>

            <div data-anim="body" className={`${styles["word-block"]} ${styles["hero-body"]}`}>
              <p>
                <WordSplit text="Some questions just won't leave me alone. Where does life actually come from? What is my brain doing right now? Why do all of us — across every culture — keep reaching for the same big answers? I don't have the answers. But I can't stop thinking about them either." />
              </p>
              <p>
                <WordSplit text="This space reflects a personal curiosity — about how systems work, how things are formed, and the deeper questions surrounding life and existence. This isn't a textbook. It's more like — what if we just sat with the hard questions for a while? What if not knowing was okay, and the asking was the point?" />
              </p>
              <p>
                <WordSplit text="I work in engineering, so I like thinking in systems. But some systems are so big and strange that you can't really solve them — you can only try to see them a little more clearly." />
              </p>
            </div>

            <blockquote data-anim="hero-quote" className={styles["hero-quote"]}>
              "Most things become clear when you stop accepting them as they are and start asking why."
            </blockquote>

            <div className={styles["hero-meta"]} data-anim="hero-meta">
              <div className={styles["hero-meta-item"]}>
                <span className={styles["hero-meta-label"]}>Location</span>
                <span className={styles["hero-meta-value"]}>Earth</span>
              </div>
              <div className={styles["hero-meta-dot"]} />
              <div className={styles["hero-meta-item"]}>
                <span className={styles["hero-meta-label"]}>Time</span>
                <span className={styles["hero-meta-value"]}>~13.8B years post-origin</span>
              </div>
              <div className={styles["hero-meta-dot"]} />
              <div className={styles["hero-meta-item"]}>
                <span className={styles["hero-meta-label"]}>Mode</span>
                <span className={styles["hero-meta-value"]}>Observing</span>
              </div>
            </div>

          </div>

          {/* ── RIGHT — portrait blended, thoughts floating ── */}
          <div className={styles["hero-portrait-side"]}>
            <div className={styles["hero-portrait-frame"]}>
              <Image src="/images/naveen-portrait.png" alt="Naveen Chaganti" fill priority
                sizes="520px"
                style={{ objectFit:"cover", objectPosition:"center 15%",
                  filter:"grayscale(100%) brightness(0.52) contrast(0.88)" }}/>
              <div className={styles["hero-portrait-blend"]} />
            </div>

            <div className={styles["hero-float-notes"]}>
              <span className={`${styles["hfn"]} ${styles["hfn-1"]}`}>how does matter become mind?</span>
              <span className={`${styles["hfn"]} ${styles["hfn-2"]}`}>why does anything exist at all</span>
              <span className={`${styles["hfn"]} ${styles["hfn-3"]}`}>the observer & the observed</span>
              <span className={`${styles["hfn"]} ${styles["hfn-4"]}`}>systems all the way down</span>
            </div>
          </div>

        </div>

        <div className={styles["scroll-indicator"]}>
          <div className={styles["scroll-line"]} />
          <span className={styles["scroll-text"]}>Scroll</span>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          SECTION 01 — What Is Life?
      ══════════════════════════════════════════════ */}
      <section id="life" className={styles["cin-section"]}>
        <span className={styles["section-index"]}>01</span>
        <div className={styles["cin-layout"]}>
          <div className={styles["cin-text-col"]}>
            <CuriosityLine text="How does something dead become something alive?" />
            <div data-anim="header" className={styles["cin-header"]}>
              <span className={styles["section-label"]}>Section 01</span>
              <h2 className={styles["section-title"]}>What Even Is Life?</h2>
              <p className={styles["section-subtitle"]}>When did chemistry turn into something alive?</p>
              <span className={styles["gold-line"]} />
            </div>
            <div data-anim="body" className={styles["word-block"]}>
              <p><WordSplit text="Think about this — the atoms in your hand were made inside a star that exploded billions of years ago. Those same atoms are now reading this sentence. At some point, they became 'alive.' What actually changed?" /></p>
              <p><WordSplit text="Life is basically matter that keeps itself together by constantly burning through energy. Not magic. Just chemistry that got very, very good at not falling apart. " /><Phrase text="At some point, molecules started copying themselves." section="life" /><WordSplit text=" That's the moment — that tiny crossing point from chemistry to biology. No special laws. Just the right conditions and enough time." /></p>
              <p><WordSplit text="And then selection takes over. No plan, no goal. Just — what works gets to stick around. What doesn't, disappears. Do that for 3.8 billion years and you get eyes, immune systems, and a brain strange enough to wonder about all of this." /></p>
            </div>
            <div className={styles["cin-stats"]}>
              <div data-anim="stat" className={styles["cin-stat"]}>
                <span className={styles["stat-number"]} data-value="3800">3.8B</span>
                <span className={styles["stat-label"]}>years of evolution</span>
              </div>
              <div data-anim="stat" className={styles["cin-stat"]}>
                <span className={styles["stat-number"]} data-value="8700000">~8.7M</span>
                <span className={styles["stat-label"]}>estimated species</span>
              </div>
              <div data-anim="stat" className={styles["cin-stat"]}>
                <span className={styles["stat-number"]} data-value="37">37T</span>
                <span className={styles["stat-label"]}>cells in your body</span>
              </div>
            </div>
          </div>
          <div data-anim="diagram" className={styles["diagram-float"]} style={{display:"flex",flexDirection:"column",alignItems:"center"}}>
            <AtomWidget />
            <LifeFlowDiagram />
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          SECTION 02 — Evolution of Intelligence
      ══════════════════════════════════════════════ */}
      <section id="evolution" className={styles["cin-section"]}>
        <span className={styles["section-index"]}>02</span>
        <div className={styles["cin-layout"]}>
          <div className={styles["cin-text-col"]}>
            <CuriosityLine text="Why does each generation seem to know more than the last?" />
            <div data-anim="header" className={styles["cin-header"]}>
              <span className={styles["section-label"]}>Section 02</span>
              <h2 className={styles["section-title"]}>Getting Smarter, Together</h2>
              <p className={styles["section-subtitle"]}>How we've been building on each other for thousands of years</p>
              <span className={styles["gold-line"]} />
            </div>
            <div data-anim="body" className={styles["word-block"]}>
              <p><WordSplit text="Here's something that fascinates me. Every new thing we invent builds on the last one. Writing didn't replace memory — it extended it. Machines didn't replace muscle — they multiplied it. And notice the speed — biology took billions of years, language took thousands, the internet reshaped everything in a couple of decades." /></p>
              <p><WordSplit text="But here's the thing that keeps me up at night: " /><Phrase text="more information hasn't automatically made us wiser." section="evolution" /><WordSplit text=" We have access to nearly all of human knowledge on a device in our pocket. And yet — we're still confused. Still arguing. Knowing and understanding are not the same thing." /></p>
              <p><WordSplit text="AI is just the newest layer. But it's the first one we actually designed — it didn't grow out of evolution. Whether that makes it fundamentally different, or just another step, I honestly don't know yet." /></p>
              <p><Phrase text="Maybe what comes next isn't a new tool at all." section="evolution" /><WordSplit text=" Maybe it's a new way of thinking together — something we don't even have a word for yet." /></p>
            </div>
          </div>
          <div data-anim="diagram" className={styles["diagram-float"]}><EvoBranchDiagram /></div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          SECTION 03 — Reality & Perception
      ══════════════════════════════════════════════ */}
      <section id="reality" className={styles["cin-section"]}>
        <span className={styles["section-index"]}>03</span>
        <div className={styles["cin-layout"]}>
          <div className={styles["cin-text-col"]}>
            <CuriosityLine text="What if everything you see is just your brain's best guess?" />
            <div data-anim="header" className={styles["cin-header"]}>
              <span className={styles["section-label"]}>Section 03</span>
              <h2 className={styles["section-title"]}>You're Not Seeing Reality</h2>
              <p className={styles["section-subtitle"]}>Your brain is making most of it up — and doing a great job</p>
              <span className={styles["gold-line"]} />
            </div>
            <div data-anim="body" className={styles["word-block"]}>
              <p><Phrase text="Every second, your eyes, ears, and skin send about 11 million bits of information to your brain. Your brain consciously uses about 40 of them." section="reality" /><WordSplit text=" The rest gets filtered, predicted, filled in. You're not watching the world — you're watching your brain's best guess at it." /></p>
              <p><WordSplit text="There's this thing called the hollow mask illusion. If you paint a face on the inside of a mask — the concave side — and spin it, the face still looks like it's bulging outward. Your brain has seen so many real faces that it just overrides what your eyes are actually seeing. Your assumption wins over reality." /></p>
              <p><WordSplit text="So here's what gets me — no two people have ever had the exact same experiences. Which means no two people are ever really seeing the same thing, even when they're standing in the same room. " /><Phrase text="Your history, your feelings, your culture — they're not separate from how you see. They're built into it." section="reality" /></p>
            </div>
            <blockquote className={`${styles["cin-quote"]} ${styles["cin-quote"] /* glitch applied in CSS */}`}>
              <WordSplit text="You don't see the world. You see your version of it." />
            </blockquote>
          </div>
          <div data-anim="diagram" className={styles["diagram-float"]}><PredictiveStack /></div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          SECTION 04 — Religion & Meaning
      ══════════════════════════════════════════════ */}
      <section id="religion" className={styles["cin-section"]}>
        <span className={styles["section-index"]}>04</span>
        <div className={styles["cin-layout"]}>
          <div className={styles["cin-text-col"]}>
            <CuriosityLine text="Why do humans everywhere keep reaching for the same answers?" />
            <div data-anim="header" className={styles["cin-header"]}>
              <span className={styles["section-label"]}>Section 04</span>
              <h2 className={styles["section-title"]}>The Search for Meaning</h2>
              <p className={styles["section-subtitle"]}>Why we can't stop asking 'why'</p>
              <span className={styles["gold-line"]} />
            </div>
            <div data-anim="body" className={styles["word-block"]}>
              <p><WordSplit text="Every culture — and I mean every single one we've ever found — had some form of religion. Cultures that never met each other built the same basic shape: how we got here, how to live, what happens when we die, who belongs. That's not a coincidence. That's something about us." /></p>
              <p><WordSplit text="I'll be honest — I'm skeptical of the literal explanations. But " /><Phrase text="the needs underneath them? Those are real." section="religion" /><WordSplit text=" The need to belong. To feel like your life matters. To have something to say when someone you love dies. Those don't go away when you stop believing a specific story. They just go looking for a different container." /></p>
              <p><WordSplit text="Even people who reject religion end up building the same structure around something else — a political movement, a philosophy, a team. " /><Phrase text="The content changes. What's underneath stays the same." section="religion" /></p>
            </div>

            {/* Questions About God — calm, philosophical */}
            <div data-anim="god-block" className={styles["religion-god-block"]}>
              <span className={styles["god-block-label"]}>Something I keep wondering about</span>
              <div className={`${styles["word-block"]}`}>
                <p><WordSplit text="If something created all of this — would it really favor one group of people over another? Would it need us to praise it? Would it care which language we used to pray, or which century we were born in?" /></p>
                <p><WordSplit text="I ask those not to be provocative. I ask because they feel genuinely important. And honestly — 'I don't know' is the answer I have the most respect for. More than confident yes, more than confident no." /></p>
              </div>
            </div>
          </div>
          <div data-anim="diagram" className={styles["diagram-float"]}><BeliefMap /></div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          SECTION 05 — Consciousness
      ══════════════════════════════════════════════ */}
      <section id="consciousness" className={styles["cin-section"]}>
        <span className={styles["section-index"]}>05</span>
        <div className={styles["cin-layout-top"]}>
          <div className={styles["cin-text-col"]}>
            <CuriosityLine text="Why does it feel like something to be you?" />
            <div data-anim="header" className={styles["cin-header"]}>
              <span className={styles["section-label"]}>Section 05</span>
              <h2 className={styles["section-title"]}>Consciousness</h2>
              <p className={styles["section-subtitle"]}>The one question science keeps running into a wall on</p>
              <span className={styles["gold-line"]} />
            </div>

            <NeuralSpark />
            <div className={styles["c-lines-compact"]}>
              {[
                <>Matter <span className={styles["c-line-em"]}>organized itself.</span></>,
                <>Systems started <span className={styles["c-line-em"]}>building models of the world.</span></>,
                <>Those models became <span className={styles["c-line-em"]}>aware of themselves.</span></>,
                <>Now the model <span className={styles["c-line-em"]}>is asking what it is.</span></>,
              ].map((line, i) => (
                <div key={i} data-anim="c-line" className={styles["c-line"]}>{line}</div>
              ))}
              <p data-anim="c-line" className={styles["consciousness-footnote"]}>
                Why any of it feels like something — nobody really knows.
              </p>
            </div>

            <div data-anim="body" className={styles["word-block"]}>
              <p><WordSplit text="We're pretty good at tracking what the brain does. We can watch it light up, measure the signals, map which part fires when. " /><Phrase text="What we can't explain is why any of it feels like something." section="consciousness" /><WordSplit text=" Why isn't it all just happening in the dark?" /></p>
              <p><WordSplit text="Here's a thought experiment I love: imagine a scientist named Mary who knows everything about color — every wavelength, every neural response — but she's lived her whole life in a black-and-white room. The day she walks outside and sees red for the first time — does she learn something new?" /></p>
              <p><WordSplit text="If yes, then no amount of brain science fully captures the experience of being you. That gap — between the mechanics and the feeling — is what philosophers call the hard problem. And honestly, it's hard." /></p>
              <p><WordSplit text="Some people say consciousness is an illusion your brain constructs. Others say anything complex enough eventually becomes conscious. Others say it's as basic as gravity — built into the fabric of things. All three positions are serious. None of them are settled." /></p>
              <p><Phrase text="The weird part is: the thing trying to understand consciousness is consciousness itself." section="consciousness" /><WordSplit text=" I'm not sure if that makes it impossible — or if it's the most important clue we have." /></p>
            </div>
          </div>
          <div data-anim="diagram" className={styles["diagram-float"]}><ConsciousnessLoop /></div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          SECTION 06 — System View
      ══════════════════════════════════════════════ */}
      <section id="sysview" className={styles["cin-section"]}>
        <span className={styles["section-index"]}>06</span>
        <div className={styles["cin-layout"]}>
          <div className={styles["cin-text-col"]}>
            <CuriosityLine text="What if you could see the whole thing from above?" />
            <div data-anim="header" className={styles["cin-header"]}>
              <span className={styles["section-label"]}>Section 06</span>
              <h2 className={styles["section-title"]}>System View</h2>
              <p className={styles["section-subtitle"]}>Zooming all the way out on what we are</p>
              <span className={styles["gold-line"]} />
            </div>
            <div data-anim="body" className={styles["word-block"]}>
              <p><WordSplit text="Zoom way out — like, all the way out. What do you see? Matter first. Then chemistry organizing itself. Then biology. Then a brain that can model things. Then a mind that knows it's a mind. " /><Phrase text="Each layer runs on the one below it." section="sysview" /><WordSplit text=" Chemistry doesn't stop existing when biology shows up. Biology doesn't disappear when thought appears. It all stacks." /></p>
              <p><WordSplit text="And here's the part that kind of blows my mind — the system has started building tools that do what brains do. We're externalizing thinking. The thing observing the world is now building other things to help it observe." /></p>
              <p><WordSplit text="Is there a layer 7? Maybe. If there is, I think it's the moment the system gets deliberate about itself — not just adapting blindly, " /><Phrase text="but actually choosing where it's going." section="sysview" /><WordSplit text=" Who gets to make that choice is probably the most important question of our lifetime." /></p>
            </div>
          </div>

          <div data-anim="diagram" className={styles["diagram-float"]}>
            <div className={styles["sysview-chain"]}>
              {[
                { term:"Matter",                  sub:"Particles · Forces · Energy",         indent:false },
                { term:"Self-Organizing Systems", sub:"Chemistry · Replication",             indent:true  },
                { term:"Biological Complexity",   sub:"Cells · Evolution · Brains",          indent:true  },
                { term:"Neural Modeling",         sub:"Prediction · Memory · Language",      indent:true  },
                { term:"Reflective Awareness",    sub:"Consciousness · Reason · Culture",    indent:true  },
                { term:"Externalized Cognition",  sub:"Writing · Networks · AI",             indent:true  },
                { term:"Layer 7 — ?",             sub:"Unknown. In progress.",               indent:true, dim:true },
              ].map((row,i)=>(
                <div key={i} data-anim="sysview-row" className={`${styles["sysview-row"]}${row.indent?` ${styles["sysview-row-indent"]}`:""}`}
                  style={row.dim?{opacity:0.38}:{}}>
                  {row.indent && <span className={styles["sysview-arrow"]}>→</span>}
                  <div>
                    <div className={styles["sysview-term"]}>{row.term}</div>
                    <div className={styles["sysview-sub"]}>{row.sub}</div>
                  </div>
                  {i < 6 && (
                    <svg className={styles["sysview-pulse"]} width="16" height="16" viewBox="0 0 16 16">
                      <circle cx="8" cy="8" r="2.5" fill="#45d291" opacity="0">
                        <animate attributeName="opacity" values="0;0.8;0" dur="2.4s"
                          begin={`${i * 0.34}s`} repeatCount="indefinite"/>
                        <animate attributeName="r" values="2.5;4;2.5" dur="2.4s"
                          begin={`${i * 0.34}s`} repeatCount="indefinite"/>
                      </circle>
                    </svg>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          SECTION 07 — Open Questions
      ══════════════════════════════════════════════ */}
      <section id="questions" className={styles["cin-section"]}>
        <span className={styles["section-index"]}>07</span>
        <div className={styles["cin-layout"]}>
          {/* LEFT — text */}
          <div className={styles["cin-text-col"]}>
            <CuriosityLine text="What questions never actually go away?" />
            <div data-anim="header" className={styles["cin-header"]}>
              <span className={styles["section-label"]}>Section 07</span>
              <h2 className={styles["section-title"]}>Open Questions</h2>
              <p className={styles["section-subtitle"]}>The ones I can't stop thinking about</p>
              <span className={styles["gold-line"]} />
            </div>

            {/* Universe questions */}
            <p className={styles["q-group-label"]}>About the universe</p>
            <ul className={styles["questions-list"]}>
              {[
                "Why is there anything at all? Why not just... nothing?",
                "What was happening before the Big Bang — or does 'before' even make sense here?",
                "Where did matter actually come from in the first place?",
                "Is the universe random, or is there a pattern underneath we just haven't found?",
                "Why does math work so perfectly to describe physical reality?",
                "Is anyone else out there?",
              ].map((q,i) => (
                <li key={i} data-anim="q-item" className={styles["q-item"]}>
                  <span className={styles["q-number"]}>{String(i+1).padStart(2,"0")}</span>
                  <span className={styles["q-text"]}>{q}</span>
                </li>
              ))}
            </ul>

            {/* God questions */}
            <p className={styles["q-group-label"]}>About a creator</p>
            <ul className={styles["questions-list"]}>
              {[
                "If something created all of this, why would it stay hidden?",
                "Would it really care which religion you were born into, or which century?",
                "Would a creator need praise from the things it made?",
                "Is the universe everything — or is there something outside it?",
              ].map((q,i) => (
                <li key={i} data-anim="q-item" className={styles["q-item"]}>
                  <span className={styles["q-number"]}>{String(i+1).padStart(2,"0")}</span>
                  <span className={styles["q-text"]}>{q}</span>
                </li>
              ))}
            </ul>

            {/* Consciousness questions */}
            <p className={styles["q-group-label"]}>About the mind</p>
            <ul className={styles["questions-list"]}>
              {[
                "Could a rock have some tiny, basic form of experience — or is that absurd?",
                "Is the universe itself a kind of computation running on something we can't see?",
                "When the brain stops — does the experience stop too?",
              ].map((q,i) => (
                <li key={i} data-anim="q-item" className={styles["q-item"]}>
                  <span className={styles["q-number"]}>{String(i+1).padStart(2,"0")}</span>
                  <span className={styles["q-text"]}>{q}</span>
                </li>
              ))}
            </ul>

            <div data-anim="closing" className={`${styles["word-block"]} ${styles["cin-closing"]}`}>
              <p><WordSplit text="That last one is the one I come back to most. All the other questions are about things out there — structure, scale, origin. But " /><Phrase text="whether experience ends is a question about what I actually am." section="questions" /><WordSplit text=" Every tradition in human history has tried to answer it. None have. I find that both terrifying and oddly comforting." /></p>
              <p className={`${styles["closing-line"]} ${styles["closing-cursor"]}`}><WordSplit text="Still thinking." /></p>
            </div>
          </div>

          {/* RIGHT — animated question spiral */}
          <div data-anim="diagram" className={styles["diagram-float"]} style={{ position:"sticky", top:"20vh" }}>
            <QuestionSpiral />
          </div>
        </div>
      </section>

      {/* EPIGRAM + SIGNATURE */}
      <div className={styles["page-epigram"]}>
        <div className={styles["page-epigram-rule"]} />
        <p className={styles["page-epigram-text"]}>
          No final answers. Just honest questions, kept open.
        </p>
        <div className={styles["page-epigram-rule"]} />
        <p className={styles["page-signature"]}>— Naveen</p>
        <p className={styles["page-signature-sub"]}>Observing life, systems, and the universe.</p>
      </div>

      </div>{/* end content-wrap */}
    </div>
  );
}