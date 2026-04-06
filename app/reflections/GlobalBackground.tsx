"use client";
import { useEffect, useRef } from "react";

const SHAPE_N = 6000;  // 6000 shape + 240 orbit = 6240 total
const ORBIT_N = 240;
const TOTAL_N  = SHAPE_N + ORBIT_N;
const BUCKETS  = 4;   // reduced for perf at 6000 pts

interface V3  { x:number; y:number; z:number; }
interface Tri { a:number; b:number; c:number; }
interface Scene { pts:V3[]; tris:Tri[]; segs:[number,number][]; rgb:[number,number,number]; tilt:number; }

const lerp  = (a:number,b:number,t:number)=>a+(b-a)*t;
const clamp = (v:number,lo:number,hi:number)=>Math.max(lo,Math.min(hi,v));
function lcg(s0:number){ let s=s0|0; return ()=>{ s=(Math.imul(s,1664525)+1013904223)|0; return (s>>>0)/4294967296; }; }
function rS(b:number,n:number):[number,number][]{ const s:[number,number][]=[];for(let i=0;i<n;i++)s.push([b+i,b+(i+1)%n]);return s; }
function cS(f:number,t:number):[number,number][]{ const s:[number,number][]=[];for(let i=f;i<t;i++)s.push([i,i+1]);return s; }
function triStrip(a:number,b:number,n:number):Tri[]{ const t:Tri[]=[];for(let i=0;i<n;i++){const j=(i+1)%n;t.push({a:a+i,b:b+i,c:a+j},{a:b+i,b:b+j,c:a+j});}return t; }

// ── Nebula cloud layer — soft blue/indigo drifting patches like the reference image ──
interface NebulaBlob { x:number; y:number; rx:number; ry:number; alpha:number; hue:number; driftX:number; driftY:number; }
const NEBULA_BLOBS:NebulaBlob[] = (()=>{
  const r=lcg(42);
  return Array.from({length:14},(_,i)=>({
    x:        r(),
    y:        0.15 + r()*0.70,
    rx:       0.18 + r()*0.32,
    ry:       0.08 + r()*0.18,
    alpha:    0.022 + r()*0.038,
    hue:      200 + r()*40,   // 200–240: blue → indigo
    driftX:   (r()-0.5)*0.000018,
    driftY:   (r()-0.5)*0.000008,
  }));
})();

function drawNebula(ctx:CanvasRenderingContext2D, w:number, h:number, elapsed:number){
  ctx.save();
  for(let i=0;i<NEBULA_BLOBS.length;i++){
    const b=NEBULA_BLOBS[i];
    // Slow drift over time
    const bx=(b.x + b.driftX*elapsed*1000)%1.0;
    const by=(b.y + b.driftY*elapsed*1000)%1.0;
    // Gentle breathe
    const breathe=1 + Math.sin(elapsed*0.09 + i*1.3)*0.12;
    const rx=b.rx*w*breathe, ry=b.ry*h*breathe;
    const grd=ctx.createRadialGradient(bx*w,by*h,0,bx*w,by*h,Math.max(rx,ry));
    grd.addColorStop(0,   `hsla(${b.hue},80%,38%,${b.alpha})`);
    grd.addColorStop(0.35,`hsla(${b.hue},70%,28%,${b.alpha*0.55})`);
    grd.addColorStop(0.70,`hsla(${b.hue},60%,18%,${b.alpha*0.18})`);
    grd.addColorStop(1,   `hsla(${b.hue},50%,10%,0)`);
    ctx.fillStyle=grd;
    ctx.beginPath();
    ctx.ellipse(bx*w, by*h, rx, ry, i*0.4, 0, Math.PI*2);
    ctx.fill();
  }
  ctx.restore();
}
function fibSphere(n:number,rad:number,rng:()=>number):V3[]{
  const pts:V3[]=[];const g=Math.PI*(3-Math.sqrt(5));
  for(let i=0;i<n;i++){const y=1-(i/(n-1))*2,r2=Math.sqrt(1-y*y),th=g*i;pts.push({x:rad*r2*Math.cos(th)+(rng()-0.5)*0.008,y:rad*y+(rng()-0.5)*0.008,z:rad*r2*Math.sin(th)+(rng()-0.5)*0.008});}
  return pts;
}
function pad(pts:V3[],seed:number):V3[]{
  // Polar spread so fill-points cover the full viewport like the galaxy scene.
  // sqrt(r) = uniform-area distribution; radius reaches 2.6 to match galaxy/starfield.
  const r=lcg(seed+9999);const out=[...pts];
  while(out.length<SHAPE_N){
    const ang=r()*Math.PI*2;
    const rad=0.08+Math.sqrt(r())*2.55;
    const vy=(r()-0.5)*1.10;
    out.push({x:rad*Math.cos(ang),y:vy,z:rad*Math.sin(ang)});
  }
  return out.slice(0,SHAPE_N);
}
// Build tube along centers array, appending pts/tris/segs in place
function tube(centers:{x:number;y:number;z:number}[],radius:number,sides:number,rng:()=>number,pts:V3[],tris:Tri[],segs:[number,number][]){
  const rings:number[]=[];
  centers.forEach(({x,y,z},ci)=>{
    const base=pts.length;rings.push(base);
    // Compute a stable ring perpendicular to the spine direction
    let tx=0,ty=1,tz=0;
    if(ci<centers.length-1){const d=centers[ci+1];const dx=d.x-x,dy=d.y-y,dz=d.z-z;const l=Math.sqrt(dx*dx+dy*dy+dz*dz)||1;tx=dx/l;ty=dy/l;tz=dz/l;}
    // Two perpendicular vectors to tangent
    const ax=Math.abs(tx)<0.9?1:0,ay=Math.abs(tx)<0.9?0:1,az=0;
    const ux=ay*tz-az*ty,uy=az*tx-ax*tz,uz=ax*ty-ay*tx;
    const ul=Math.sqrt(ux*ux+uy*uy+uz*uz)||1;
    const vx=ty*uz/ul-tz*uy/ul,vy=tz*ux/ul-tx*uz/ul,vz=tx*uy/ul-ty*ux/ul;
    for(let s=0;s<sides;s++){
      const a=(s/sides)*Math.PI*2,c=Math.cos(a),si2=Math.sin(a),r2=radius*(0.90+rng()*0.18);
      pts.push({x:x+r2*(c*ux/ul+si2*vx),y:y+r2*(c*uy/ul+si2*vy),z:z+r2*(c*uz/ul+si2*vz)});
    }
    segs.push(...rS(base,sides));
    if(ci>0)tris.push(...triStrip(rings[ci-1],rings[ci],sides));
  });
}

// ═══════════ SCENE 0 — GALAXY ═══════════
function buildGalaxy():Scene{
  const r=lcg(7);const pts:V3[]=[],tris:Tri[]=[],segs:[number,number][]=[];
  // Dense ellipsoid core
  for(let i=0;i<1500;i++){
    const phi=Math.acos(1-2*r()),th=r()*Math.PI*2,rr=Math.pow(r(),0.22)*0.42;
    pts.push({x:rr*Math.sin(phi)*Math.cos(th),y:rr*Math.sin(phi)*Math.sin(th)*0.30,z:rr*Math.cos(phi)});
  }
  // 4 spiral arms
  for(let arm=0;arm<4;arm++){
    const off=(arm/4)*Math.PI*2;
    for(let i=0;i<660;i++){
      const t=(i/659)*Math.PI*3.0,rr=0.34+t*0.330,sp=0.018+t*0.038;
      pts.push({x:rr*Math.cos(t+off)+(r()-0.5)*sp,y:(r()-0.5)*0.090,z:rr*Math.sin(t+off)+(r()-0.5)*sp});
    }
  }
  // Wide dust lane
  for(let i=0;i<1260;i++){
    const ang=r()*Math.PI*2,rr=0.28+r()*2.00;
    pts.push({x:rr*Math.cos(ang)+(r()-0.5)*0.06,y:(r()-0.5)*0.060,z:rr*Math.sin(ang)+(r()-0.5)*0.06});
  }
  // Spherical halo
  for(let i=0;i<600;i++){
    const phi=Math.acos(1-2*r()),th=r()*Math.PI*2,rr=1.20+r()*1.30;
    pts.push({x:rr*Math.sin(phi)*Math.cos(th),y:rr*Math.sin(phi)*Math.sin(th)*0.52,z:rr*Math.cos(phi)});
  }
  // 1500+2640+1260+600 = 6000
  return{pts:pad(pts,7),tris:[],segs:[],rgb:[90,140,255],tilt:0.42};
}

// ═══════════ SCENE 1 — DNA DOUBLE HELIX (Life) ═══════════
function buildDNA():Scene{
  const r=lcg(17);const pts:V3[]=[],tris:Tri[]=[],segs:[number,number][]=[];
  const TURNS=9,PPT=32,TH=TURNS*PPT,HEIGHT=1.80,HRADIUS=0.30;
  // Strand A
  const sA:number[]=[];
  for(let i=0;i<TH;i++){
    const t=i/TH,ang=t*TURNS*Math.PI*2,y=-HEIGHT/2+t*HEIGHT;
    sA.push(pts.length);
    pts.push({x:HRADIUS*Math.cos(ang)+(r()-0.5)*0.010,y:y+(r()-0.5)*0.006,z:HRADIUS*Math.sin(ang)+(r()-0.5)*0.010});
  }
  for(let i=0;i<TH-1;i++)segs.push([sA[i],sA[i+1]]);
  // Strand B (offset π)
  const sB:number[]=[];
  for(let i=0;i<TH;i++){
    const t=i/TH,ang=t*TURNS*Math.PI*2+Math.PI,y=-HEIGHT/2+t*HEIGHT;
    sB.push(pts.length);
    pts.push({x:HRADIUS*Math.cos(ang)+(r()-0.5)*0.010,y:y+(r()-0.5)*0.006,z:HRADIUS*Math.sin(ang)+(r()-0.5)*0.010});
  }
  for(let i=0;i<TH-1;i++)segs.push([sB[i],sB[i+1]]);
  // Base pair rungs — connect strands every 4 pts with 3 intermediate pts
  const RSTEP=4,RINT=3;
  for(let i=0;i<TH;i+=RSTEP){
    const pa=pts[sA[i]],pb=pts[sB[i]],rb=pts.length;
    for(let k=1;k<=RINT;k++){const t=k/(RINT+1);pts.push({x:lerp(pa.x,pb.x,t)+(r()-0.5)*0.006,y:lerp(pa.y,pb.y,t),z:lerp(pa.z,pb.z,t)+(r()-0.5)*0.006});}
    segs.push([sA[i],rb]);
    for(let k=0;k<RINT-1;k++)segs.push([rb+k,rb+k+1]);
    segs.push([rb+RINT-1,sB[i]]);
    if(i+RSTEP<TH){tris.push({a:sA[i],b:sA[i+RSTEP],c:rb});tris.push({a:sB[i],b:sB[i+RSTEP],c:rb+RINT-1});}
  }
  // Organic scatter — floating nucleotide cloud
  for(let i=0;i<800;i++){
    const ang=r()*Math.PI*2,h=-HEIGHT/2+r()*HEIGHT,d=0.44+Math.pow(r(),0.7)*0.85;
    pts.push({x:d*Math.cos(ang)+(r()-0.5)*0.06,y:h,z:d*Math.sin(ang)+(r()-0.5)*0.06});
  }
  return{pts:pad(pts,17),tris,segs,rgb:[50,210,130],tilt:0.52};
}

// ═══════════ SCENE 2 — TREE OF LIFE (Evolution of Intelligence) ═══════════
function buildTree():Scene{
  const r=lcg(42);const pts:V3[]=[],tris:Tri[]=[],segs:[number,number][]=[];
  // Grow a branch: returns tip point index
  const branch=(x:number,y:number,z:number,dx:number,dy:number,dz:number,len:number,steps:number,jit:number):number=>{
    const base=pts.length;
    for(let i=0;i<=steps;i++){
      const t=i/steps;
      pts.push({x:x+dx*len*t+(r()-0.5)*jit,y:y+dy*len*t+(r()-0.5)*jit,z:z+dz*len*t+(r()-0.5)*jit});
    }
    for(let i=0;i<steps;i++)segs.push([base+i,base+i+1]);
    return base+steps;
  };
  // Trunk — grows downward
  const t0=branch(0,0.82,0,0,-1,0,1.70,28,0.006);
  const tp0=pts[t0];
  // Level 1: 2 main boughs
  const L1=[{dx:-0.58,dy:-0.76,dz:0.10},{dx:0.58,dy:-0.76,dz:-0.10}];
  L1.forEach(({dx,dy,dz})=>{
    const n=Math.sqrt(dx*dx+dy*dy+dz*dz);
    const t1=branch(tp0.x,tp0.y,tp0.z,dx/n,dy/n,dz/n,0.88,18,0.014);
    const tp1=pts[t1];
    // Level 2: 2 branches each
    [{dx2:-0.42,dz2:0.14},{dx2:0.42,dz2:-0.14}].forEach(({dx2,dz2})=>{
      const dx3=dx/n+dx2,dy3=dy/n-0.06,dz3=dz/n+dz2;
      const n3=Math.sqrt(dx3*dx3+dy3*dy3+dz3*dz3);
      const t2=branch(tp1.x,tp1.y,tp1.z,dx3/n3,dy3/n3,dz3/n3,0.58,14,0.018);
      const tp2=pts[t2];
      // Level 3
      for(let k=0;k<2;k++){
        const off=k===0?0.36:-0.36;
        const dx4=dx3/n3+off,dy4=dy3/n3-0.12,dz4=dz3/n3;
        const n4=Math.sqrt(dx4*dx4+dy4*dy4+dz4*dz4);
        const t3=branch(tp2.x,tp2.y,tp2.z,dx4/n4,dy4/n4,dz4/n4,0.34,9,0.022);
        const tp3=pts[t3];
        // Level 4 leaf sprigs
        for(let m=0;m<4;m++){
          const af=(m/4)*Math.PI*2,ss=0.26+r()*0.10;
          const dx5=Math.cos(af)*0.38+dx4/n4*0.18,dy5=-0.28,dz5=Math.sin(af)*0.38;
          const n5=Math.sqrt(dx5*dx5+dy5*dy5+dz5*dz5);
          branch(tp3.x,tp3.y,tp3.z,dx5/n5,dy5/n5,dz5/n5,ss,5,0.026);
        }
      }
    });
  });
  // Root system — underground spread
  for(let root=0;root<6;root++){
    const ang=(root/6)*Math.PI*2,t4=branch(0,0.84,0,Math.cos(ang)*0.7,0.28,Math.sin(ang)*0.7,0.38,8,0.020);
  }
  // Canopy particle scatter (leaves)
  for(let i=0;i<1800;i++){
    const x=(r()-0.5)*1.50,y=-1.0+r()*1.20,z=(r()-0.5)*1.50;
    pts.push({x:x+(r()-0.5)*0.04,y:y+(r()-0.5)*0.04,z:z+(r()-0.5)*0.04});
  }
  return{pts:pad(pts,42),tris,segs,rgb:[55,185,75],tilt:0.48};
}

// ═══════════ SCENE 3 — HUMAN EYE (Reality & Perception) ═══════════
// XZ-plane flat disc like the galaxy. X wide, Z wide, Y thin.
function buildGrid():Scene{
  const r=lcg(55);const pts:V3[]=[],tris:Tri[]=[],segs:[number,number][]=[];
  const TY=()=>(r()-0.5)*0.072; // thin vertical — galaxy scale

  // Iris rings on XZ plane
  const IRINGS=[{rad:0.055,n:8},{rad:0.120,n:16},{rad:0.195,n:24},{rad:0.275,n:32},{rad:0.365,n:40},{rad:0.460,n:50},{rad:0.565,n:60},{rad:0.680,n:70}];
  IRINGS.forEach(({rad,n})=>{
    const rb=pts.length;
    for(let i=0;i<n;i++){const a=(i/n)*Math.PI*2;pts.push({x:rad*Math.cos(a)+(r()-0.5)*0.006,y:TY(),z:rad*Math.sin(a)+(r()-0.5)*0.006});}
    segs.push(...rS(rb,n));
    for(let i=1;i<n-1;i+=2)tris.push({a:rb,b:rb+i,c:rb+i+1});
  });
  // Radial fibers
  for(let f=0;f<52;f++){
    const ang=(f/52)*Math.PI*2,fb=pts.length;
    for(let k=0;k<=14;k++){const d=0.055+k*(0.625/14);pts.push({x:d*Math.cos(ang)+(r()-0.5)*0.009,y:TY(),z:d*Math.sin(ang)+(r()-0.5)*0.009});}
    segs.push(...cS(fb,fb+14));
  }
  // Pupil
  for(let i=0;i<180;i++){const ang=r()*Math.PI*2,d=Math.sqrt(r())*0.050;pts.push({x:d*Math.cos(ang),y:TY()*0.4,z:d*Math.sin(ang)});}
  // Eyelids — wide in X, curved in Z
  for(let lid=0;lid<2;lid++){
    const sign=lid===0?-1:1;
    for(let track=0;track<3;track++){
      const sc=1.0+track*0.018,eb=pts.length;
      for(let i=0;i<56;i++){const t=i/55,x=(t*2-1)*0.75*sc,z=sign*(0.30*sc)*(1-(t*2-1)**2);pts.push({x:x+(r()-0.5)*0.010,y:TY(),z:z+(r()-0.5)*0.008});}
      segs.push(...cS(eb,eb+55));
      if(track>0)tris.push(...triStrip(eb-56,eb,56));
    }
  }
  // Signal rays
  for(let ray=0;ray<40;ray++){
    const ang=(ray/40)*Math.PI*2,rb=pts.length;
    for(let k=0;k<=16;k++){const d=0.70+k*(0.68/16);pts.push({x:d*Math.cos(ang)+(r()-0.5)*0.020,y:TY(),z:d*Math.sin(ang)*0.82+(r()-0.5)*0.016});}
    segs.push(...cS(rb,rb+16));
  }
  // Sclera
  for(let track=0;track<3;track++){
    const sb=pts.length;
    for(let i=0;i<60;i++){const a=(i/60)*Math.PI*2;pts.push({x:0.80*Math.cos(a)+(r()-0.5)*0.012,y:TY(),z:0.46*Math.sin(a)+(r()-0.5)*0.010});}
    segs.push(...rS(sb,60));if(track>0)tris.push(...triStrip(sb-60,sb,60));
  }
  // Scatter
  for(let i=0;i<1400;i++){const ang=r()*Math.PI*2,d=0.9+r()*1.5;pts.push({x:d*Math.cos(ang)+(r()-0.5)*0.12,y:(r()-0.5)*0.09,z:d*Math.sin(ang)*0.68+(r()-0.5)*0.10});}
  return{pts:pad(pts,55),tris,segs,rgb:[155,195,255],tilt:0.18};
}
// ═══════════ SCENE 4 — DIVINE LIGHT (Religion & Meaning) ═══════════
// Radiant center on XZ plane. Rays spread outward like a galaxy's spiral arms.
// Worshipper figures flat on the disc edge.
function buildReligion():Scene{
  const r=lcg(77);const pts:V3[]=[],tris:Tri[]=[],segs:[number,number][]=[];
  const TY=()=>(r()-0.5)*0.072;

  // Divine source — dense core cluster at center
  const coreB=pts.length;
  for(let i=0;i<100;i++){const ang=r()*Math.PI*2,d=Math.pow(r(),0.5)*0.060;pts.push({x:d*Math.cos(ang)+(r()-0.5)*0.006,y:TY()*0.5,z:d*Math.sin(ang)+(r()-0.5)*0.006});}
  for(let i=1;i<98;i+=2)tris.push({a:coreB,b:coreB+i,c:coreB+i+1});

  // Halo rings around source
  [{rad:0.09,n:16},{rad:0.18,n:26},{rad:0.30,n:38},{rad:0.44,n:52}].forEach(({rad,n})=>{
    const hb=pts.length;
    for(let i=0;i<n;i++){const a=(i/n)*Math.PI*2;pts.push({x:rad*Math.cos(a)+(r()-0.5)*0.008,y:TY(),z:rad*Math.sin(a)+(r()-0.5)*0.006});}
    segs.push(...rS(hb,n));
    for(let i=1;i<n-1;i+=2)tris.push({a:hb,b:hb+i,c:hb+i+1});
  });

  // Light rays — radiate outward on XZ plane (like spiral arms)
  for(let ray=0;ray<32;ray++){
    const ang=(ray/32)*Math.PI*2,rb=pts.length,len=0.55+r()*0.90;
    for(let k=0;k<=22;k++){const d=0.05+k*(len/22);pts.push({x:d*Math.cos(ang)+(r()-0.5)*0.018,y:TY(),z:d*Math.sin(ang)+(r()-0.5)*0.018});}
    segs.push(...cS(rb,rb+22));
    if(ray>0)tris.push({a:rb-23,b:rb,c:rb+11});
  }
  // Secondary shorter rays between main rays
  for(let ray=0;ray<24;ray++){
    const ang=((ray+0.5)/24)*Math.PI*2,rb=pts.length,len=0.30+r()*0.35;
    for(let k=0;k<=14;k++){const d=0.04+k*(len/14);pts.push({x:d*Math.cos(ang)+(r()-0.5)*0.012,y:TY(),z:d*Math.sin(ang)+(r()-0.5)*0.012});}
    segs.push(...cS(rb,rb+14));
  }

  // Human figures — placed radially at outer edge, flat on disc
  for(let fig=0;fig<8;fig++){
    const ang=(fig/8)*Math.PI*2,fx=0.88*Math.cos(ang),fz=0.88*Math.sin(ang);
    const FS=0.06;
    // Head
    const hb=pts.length;
    for(let i=0;i<8;i++){const a=(i/8)*Math.PI*2;pts.push({x:fx+FS*0.5*Math.cos(a),y:TY(),z:fz+FS*0.5*Math.sin(a)});}
    segs.push(...rS(hb,8));
    // Body + arms (radial lines from figure)
    const bb=pts.length;
    for(let k=0;k<=5;k++){const t=k/5;pts.push({x:fx*( 1-t*0.08),y:TY(),z:fz*(1-t*0.08)});}
    segs.push(...cS(bb,bb+5));
    for(let arm=0;arm<2;arm++){
      const aang=ang+(arm===0?Math.PI*0.4:-Math.PI*0.4),ab=pts.length;
      for(let k=0;k<=5;k++){const d=FS*(0.3+k*0.14);pts.push({x:fx+d*Math.cos(aang),y:TY(),z:fz+d*Math.sin(aang)});}
      segs.push(...cS(ab,ab+5));
    }
  }

  // Atmosphere scatter — dense near center, like galaxy core
  for(let i=0;i<2200;i++){
    const ang=r()*Math.PI*2,d=Math.pow(r(),0.45)*1.60;
    pts.push({x:d*Math.cos(ang)+(r()-0.5)*0.08,y:(r()-0.5)*0.072,z:d*Math.sin(ang)+(r()-0.5)*0.08});
  }
  return{pts:pad(pts,77),tris,segs,rgb:[255,200,70],tilt:0.18};
}
// ═══════════ SCENE 5 — MIND OBSERVING ITSELF (Consciousness) ═══════════
// Head circle flat on XZ plane like a galaxy disc. Brain mesh inside.
// Observer node at center with self-referencing connections.
function buildConnectome():Scene{
  const r=lcg(99);const pts:V3[]=[],tris:Tri[]=[],segs:[number,number][]=[];
  const TY=()=>(r()-0.5)*0.072;

  // Head outline — ring on XZ plane
  const HRX=0.44,HRZ=0.52,HN=72;
  for(let track=0;track<3;track++){
    const sc=1+track*0.018,hb=pts.length;
    for(let i=0;i<HN;i++){const a=(i/HN)*Math.PI*2;pts.push({x:HRX*sc*Math.cos(a)+(r()-0.5)*0.010,y:TY(),z:HRZ*sc*Math.sin(a)+(r()-0.5)*0.010});}
    segs.push(...rS(hb,HN));
    if(track>0)tris.push(...triStrip(hb-HN,hb,HN));
  }

  // Brain neural mesh — scattered inside head ellipse
  const BN=130,brainBase=pts.length;
  for(let i=0;i<BN;i++){
    const ang=r()*Math.PI*2,d=Math.pow(r(),0.5)*0.38;
    pts.push({x:HRX*0.82*d*Math.cos(ang)+(r()-0.5)*0.012,y:TY(),z:HRZ*0.78*d*Math.sin(ang)*0.85+(r()-0.5)*0.012});
  }
  // Short neural connections — tighter threshold keeps visual but cuts seg count
  for(let i=0;i<BN;i++){
    for(let j=i+1;j<BN;j++){
      const pi=pts[brainBase+i],pj=pts[brainBase+j];
      const d2=(pi.x-pj.x)**2+(pi.z-pj.z)**2;
      if(d2<0.009&&d2>0.001){segs.push([brainBase+i,brainBase+j]);if(d2<0.005)tris.push({a:brainBase+i,b:brainBase+j,c:brainBase+(i+7)%BN});}
    }
  }

  // Observer node — center ring
  const obsBase=pts.length;
  for(let i=0;i<20;i++){const a=(i/20)*Math.PI*2;pts.push({x:0.040*Math.cos(a),y:TY(),z:0.040*Math.sin(a)});}
  segs.push(...rS(obsBase,20));
  for(let i=1;i<19;i++)tris.push({a:obsBase,b:obsBase+i,c:obsBase+i+1});
  // Self-referencing lines
  for(let i=0;i<BN;i+=5){segs.push([obsBase,brainBase+i]);if(i+10<BN)segs.push([brainBase+i,brainBase+(i+10)%BN]);}

  // Thought clusters — floating around head
  [{x:-0.72,z:-0.30},{x:0.74,z:-0.38},{x:-0.68,z:0.34},{x:0.70,z:0.32}].forEach(({x,z})=>{
    const tb=pts.length;
    for(let i=0;i<55;i++){pts.push({x:x+(r()-0.5)*0.18,y:TY(),z:z+(r()-0.5)*0.14});}
    for(let i=0;i<53;i+=3)segs.push([tb+i,tb+i+1]);
    for(let i=0;i<51;i+=4)tris.push({a:tb+i,b:tb+i+2,c:tb+i+3});
  });

  // Awareness scatter — galaxy-like field
  for(let i=0;i<2400;i++){
    const ang=r()*Math.PI*2,d=0.55+Math.pow(r(),0.45)*1.10;
    pts.push({x:d*Math.sin(ang)*0.88,y:(r()-0.5)*0.075,z:d*Math.cos(ang)*0.88});
  }
  return{pts:pad(pts,99),tris,segs,rgb:[100,155,255],tilt:0.18};
}
// ═══════════ SCENE 6 — RADIAL CIVILIZATION WEB (System View) ═══════════
// 7 rings expanding from center on XZ plane — same flat disc as galaxy.
function buildNested():Scene{
  const r=lcg(33);const pts:V3[]=[],tris:Tri[]=[],segs:[number,number][]=[];
  const TY=()=>(r()-0.5)*0.072;

  const RINGS=[
    {rad:0.00,n:1},{rad:0.18,n:5},{rad:0.34,n:10},{rad:0.52,n:16},
    {rad:0.70,n:24},{rad:0.90,n:36},{rad:1.12,n:52},
  ];
  const ringNodeIdx:number[][]=[];

  RINGS.forEach(({rad,n},ri)=>{
    ringNodeIdx.push([]);
    for(let ni=0;ni<n;ni++){
      const ang=(ni/n)*Math.PI*2;
      const px=rad===0?0:rad*Math.cos(ang)+(r()-0.5)*0.018;
      const pz=rad===0?0:rad*Math.sin(ang)+(r()-0.5)*0.018;
      const idx=pts.length;
      ringNodeIdx[ri].push(idx);
      pts.push({x:px,y:TY(),z:pz});
      // Node cluster — bigger clusters on outer rings
      const clSize=2+ri;
      for(let k=0;k<clSize;k++){
        const ca=r()*Math.PI*2,cd=(0.012+ri*0.009)*r();
        pts.push({x:px+cd*Math.cos(ca)+(r()-0.5)*0.009,y:TY(),z:pz+cd*Math.sin(ca)+(r()-0.5)*0.009});
        segs.push([idx,idx+k+1]);
      }
    }
    // Connect ring nodes in circle
    if(n>1){
      const step=RINGS[ri].n>0?Math.ceil((pts.length-ringNodeIdx[ri][0])/n):1;
      for(let ni=0;ni<n;ni++)segs.push([ringNodeIdx[ri][ni],ringNodeIdx[ri][(ni+1)%n]]);
    }
  });

  // Radial spines — center outward through all rings
  for(let oi=0;oi<RINGS[6].n;oi+=2){
    const ang=(oi/RINGS[6].n)*Math.PI*2,sb=pts.length;
    for(let k=0;k<=28;k++){const d=k*(1.12/28);pts.push({x:d*Math.cos(ang)+(r()-0.5)*0.016,y:TY(),z:d*Math.sin(ang)+(r()-0.5)*0.016});}
    segs.push(...cS(sb,sb+28));
    tris.push({a:sb,b:sb+14,c:sb+28});
  }

  // Cross-ring connections
  for(let ri=0;ri<6;ri++){
    const inner=ringNodeIdx[ri],outer=ringNodeIdx[ri+1];
    for(let ni=0;ni<inner.length;ni++){
      const nearO=Math.round((ni/Math.max(inner.length,1))*outer.length)%outer.length;
      segs.push([inner[ni],outer[nearO]]);
      tris.push({a:inner[ni],b:outer[nearO],c:outer[(nearO+1)%outer.length]});
    }
  }

  // Field scatter — density gradient inward
  for(let i=0;i<2600;i++){
    const ang=r()*Math.PI*2,d=Math.pow(r(),0.5)*1.40;
    pts.push({x:d*Math.cos(ang)+(r()-0.5)*0.08,y:(r()-0.5)*0.072,z:d*Math.sin(ang)+(r()-0.5)*0.08});
  }
  return{pts:pad(pts,33),tris,segs,rgb:[45,210,145],tilt:0.18};
}
// ═══════════ SCENE 7 — STAR FIELD ═══════════
function buildStarField():Scene{
  const r=lcg(111);const pts:V3[]=[],tris:Tri[]=[],segs:[number,number][]=[];
  // Milky Way band 3000 pts
  for(let i=0;i<3000;i++){const x=(r()-0.5)*3.80,yB=(r()-0.5)*0.22,z=-2.20+r()*4.40,tilt=0.52;pts.push({x:x+(r()-0.5)*0.10,y:yB*Math.cos(tilt)-z*0.08*Math.sin(tilt),z:z+yB*0.08*Math.sin(tilt)});}
  // Near stars 600 pts
  for(let i=0;i<600;i++)pts.push({x:(r()-0.5)*1.60,y:(r()-0.5)*1.20,z:-0.30+r()*0.50});
  // Mid-distance 1350 pts
  for(let i=0;i<1350;i++){const phi=Math.acos(1-2*r()),th=r()*Math.PI*2,rr=0.40+r()*1.50;pts.push({x:rr*Math.sin(phi)*Math.cos(th)*1.30,y:rr*Math.sin(phi)*Math.sin(th)*0.88,z:rr*Math.cos(phi)});}
  // Distant 450 pts
  for(let i=0;i<450;i++){const phi=Math.acos(1-2*r()),th=r()*Math.PI*2,rr=1.50+r()*1.10;pts.push({x:rr*Math.sin(phi)*Math.cos(th)*1.10,y:rr*Math.sin(phi)*Math.sin(th)*0.80,z:rr*Math.cos(phi)});}
  // Nebula clusters 4×100 = 400
  [{x:0.80,y:0.40,z:-0.50},{x:-0.90,y:-0.30,z:0.60},{x:0.20,y:-0.70,z:-0.80},{x:-0.50,y:0.60,z:0.30}].forEach(nc=>{
    const nb=pts.length;for(let i=0;i<100;i++)pts.push({x:nc.x+(r()-0.5)*0.30,y:nc.y+(r()-0.5)*0.24,z:nc.z+(r()-0.5)*0.30});
    for(let i=0;i<98;i+=2)tris.push({a:nb+i,b:nb+i+1,c:nb+(i+20)%100});segs.push(...rS(nb,20));
  });
  // Constellation edges 60
  for(let k=0;k<60;k++){const i=1000+Math.floor(r()*200);let bd2=0.08,bj=-1;for(let j=i+1;j<Math.min(i+30,1200);j++){const d2=(pts[i].x-pts[j].x)**2+(pts[i].y-pts[j].y)**2+(pts[i].z-pts[j].z)**2;if(d2<bd2&&d2>0.008){bd2=d2;bj=j;}}if(bj>=0)segs.push([i,bj]);}
  return{pts:pad(pts,111),tris,segs,rgb:[200,100,200],tilt:0.40};
}

const SCENES:Scene[]=[buildGalaxy(),buildDNA(),buildTree(),buildGrid(),buildReligion(),buildConnectome(),buildNested(),buildStarField()];
SCENES.forEach(sc=>{sc.tris=sc.tris.filter(t=>t.a<SHAPE_N&&t.b<SHAPE_N&&t.c<SHAPE_N);sc.segs=sc.segs.filter(([a,b])=>a<SHAPE_N&&b<SHAPE_N);});

// ═══════════ SOLAR SYSTEM — centered, 9 planets ═══════════
const _sRng=lcg(333);

// 9 planets: Mercury→Pluto. sz = base px at 1440px wide screen
const SS_PLANETS=[
  {n:'Mercury',of:0.100,sp:4.147,a0:0.80,sz:5,  cb:[178,168,158] as [number,number,number],ch:[225,218,210] as [number,number,number],cd:[108,98,88]  as [number,number,number],bands:0,ring:false,ringC:null},
  {n:'Venus',  of:0.165,sp:1.621,a0:1.20,sz:9,  cb:[230,205,125] as [number,number,number],ch:[255,242,180] as [number,number,number],cd:[172,152,72]  as [number,number,number],bands:0,ring:false,ringC:null},
  {n:'Earth',  of:0.230,sp:1.000,a0:0.50,sz:10, cb:[52,122,192]  as [number,number,number],ch:[138,180,232] as [number,number,number],cd:[20,70,130]   as [number,number,number],bands:0,ring:false,ringC:null},
  {n:'Mars',   of:0.305,sp:0.531,a0:-0.3,sz:7,  cb:[192,78,48]   as [number,number,number],ch:[232,140,108] as [number,number,number],cd:[135,45,25]   as [number,number,number],bands:0,ring:false,ringC:null},
  {n:'Jupiter',of:0.460,sp:0.084,a0:0.20,sz:28, cb:[200,165,122] as [number,number,number],ch:[230,200,160] as [number,number,number],cd:[148,108,76]   as [number,number,number],bands:8,ring:false,ringC:null},
  {n:'Saturn', of:0.580,sp:0.034,a0:-0.5,sz:22, cb:[210,195,148] as [number,number,number],ch:[240,225,185] as [number,number,number],cd:[158,138,98]   as [number,number,number],bands:6,ring:true, ringC:[205,192,155] as [number,number,number]},
  {n:'Uranus', of:0.700,sp:0.012,a0:0.80,sz:16, cb:[152,218,222] as [number,number,number],ch:[195,242,246] as [number,number,number],cd:[96,170,182]   as [number,number,number],bands:0,ring:true, ringC:[120,195,205] as [number,number,number]},
  {n:'Neptune',of:0.820,sp:0.006,a0:1.50,sz:15, cb:[62,100,212]  as [number,number,number],ch:[118,152,242] as [number,number,number],cd:[36,65,158]    as [number,number,number],bands:0,ring:false,ringC:null},
  {n:'Pluto',  of:0.940,sp:0.004,a0:2.20,sz:3,  cb:[188,170,148] as [number,number,number],ch:[215,200,182] as [number,number,number],cd:[138,118,98]   as [number,number,number],bands:0,ring:false,ringC:null},
];

const JUP_BANDS:[[number,number,number],[number,number,number],[number,number,number],[number,number,number]]=[
  [222,185,142],[182,145,105],[238,205,165],[168,130,95]
];
const SAT_BANDS:[[number,number,number],[number,number,number],[number,number,number]]=[
  [232,215,168],[198,178,130],[245,228,188]
];

function drawPlanet(
  ctx:CanvasRenderingContext2D,px:number,py:number,pr:number,
  cb:[number,number,number],ch:[number,number,number],cd:[number,number,number],
  alpha:number
){
  // 1 gradient for atmosphere glow (was 4) — solid disc + highlight spot
  const ag=ctx.createRadialGradient(px,py,pr*0.8,px,py,pr*3.0);
  ag.addColorStop(0,`rgba(${cb[0]},${cb[1]},${cb[2]},${(alpha*0.18).toFixed(3)})`);
  ag.addColorStop(1,'rgba(0,0,0,0)');
  ctx.beginPath();ctx.arc(px,py,pr*3.0,0,Math.PI*2);ctx.fillStyle=ag;ctx.fill();
  // Solid disc
  ctx.beginPath();ctx.arc(px,py,pr,0,Math.PI*2);
  ctx.fillStyle=`rgba(${cb[0]},${cb[1]},${cb[2]},${alpha.toFixed(3)})`;ctx.fill();
  // Lit-side highlight — simple lighter arc, no gradient
  ctx.beginPath();ctx.arc(px-pr*0.3,py-pr*0.3,pr*0.42,0,Math.PI*2);
  ctx.fillStyle=`rgba(${ch[0]},${ch[1]},${ch[2]},${(alpha*0.45).toFixed(3)})`;ctx.fill();
}

function drawBands(ctx:CanvasRenderingContext2D,px:number,py:number,pr:number,cols:[number,number,number][],alpha:number){
  ctx.save();ctx.beginPath();ctx.arc(px,py,pr,0,Math.PI*2);ctx.clip();
  const n=cols.length*2;
  for(let i=0;i<n;i++){
    const y0=py-pr+i*(pr*2/n),bh=pr*2/n,c=cols[i%cols.length];
    const ba=i%3===0?0.42:0.26;
    ctx.fillStyle=`rgba(${c[0]},${c[1]},${c[2]},${(alpha*ba).toFixed(3)})`;
    ctx.fillRect(px-pr,y0,pr*2,bh);
  }
  ctx.restore();
}

function drawSolarSystem(ctx:CanvasRenderingContext2D,w:number,h:number,elapsed:number,collapseT:number,alpha:number){
  if(alpha<0.01) return;
  const cE=collapseT*collapseT*(3-2*collapseT);
  const rScale=1-cE, spinBoost=1+cE*11;

  // ── Layout: Sun at CENTER, all 9 orbits fit within viewport ──
  const sunX=w*0.50;
  const sunY=h*0.50;
  // Sun radius — visible but not dominating (scales with screen)
  const sunR=Math.min(w,h)*0.032*(1-cE*0.45);

  // Orbit plane: flat perspective ellipses rotated slightly
  // FLAT controls how "tilted" the plane looks (0.38 = moderate 3D perspective)
  const TILT=0.18;   // radians CCW rotation of whole system
  const FLAT=0.38;   // b/a ratio: 1=circle, 0=flat line

  // maxOrb: outermost orbit (Pluto of=0.940) must stay inside viewport with margin
  const margin=Math.max(sunR*1.8, 22);
  const maxOrb=Math.max(1, Math.min(w*0.50, h*0.50/FLAT)*0.88*rScale - margin);

  const orbPos=(frac:number,th:number):[number,number]=>{
    const a=Math.max(0, frac*maxOrb), b=Math.max(0, a*FLAT);
    const cosT=Math.cos(TILT),sinT=Math.sin(TILT);
    return[sunX+a*Math.cos(th)*cosT - b*Math.sin(th)*sinT,
           sunY+a*Math.cos(th)*sinT + b*Math.sin(th)*cosT];
  };

  // ── 1. Orbit lines — clear, slightly glowing ──
  SS_PLANETS.forEach((p,pi)=>{
    const a=Math.max(0.1, p.of*maxOrb), b=Math.max(0.1, a*FLAT);
    if(a<1) return; // skip if collapsed too small
    // Subtle glow pass (wider, very faint)
    ctx.beginPath();ctx.ellipse(sunX,sunY,a,b,TILT,0,Math.PI*2);
    ctx.strokeStyle=`rgba(160,200,255,${(alpha*0.06).toFixed(3)})`;ctx.lineWidth=3;ctx.stroke();
    // Main orbit line
    ctx.beginPath();ctx.ellipse(sunX,sunY,a,b,TILT,0,Math.PI*2);
    // Slight colour tint per planet family
    const orbitCol=pi<4?'180,210,255':pi<8?'210,220,255':'220,200,255';
    ctx.strokeStyle=`rgba(${orbitCol},${(alpha*0.22).toFixed(3)})`;
    ctx.lineWidth=0.85;ctx.stroke();
  });

  // ── 3. Planets ──
  const sc=Math.min(w,h)/900; // size scale based on screen size
  const planetData=SS_PLANETS.map(p=>{
    const th=p.a0+elapsed*p.sp*spinBoost;
    const[px,py]=orbPos(p.of,th);
    return{...p,px,py,th,pR:Math.max(2,p.sz*sc*(1-cE*0.55))};
  });

  // Painter's sort: bottom (higher py) rendered last = on top
  planetData.sort((a,b)=>a.py-b.py);

  planetData.forEach(p=>{
    const{px,py,pR}=p;
    if(pR<0.8) return;

    // Saturn back ring
    if(p.n==='Saturn'&&p.ring){
      const rf=FLAT*0.76,rBands=[
        {ri:pR*1.20,ro:pR*1.52,op:0.48,c:[185,172,138] as [number,number,number]},
        {ri:pR*1.55,ro:pR*2.10,op:0.82,c:[215,200,158] as [number,number,number]},
        {ri:pR*2.14,ro:pR*2.30,op:0.22,c:[128,118,98]  as [number,number,number]},
        {ri:pR*2.33,ro:pR*2.70,op:0.60,c:[205,188,150] as [number,number,number]},
      ];
      rBands.forEach(rb=>{
        ctx.beginPath();ctx.ellipse(px,py,rb.ro,rb.ro*rf,TILT,Math.PI,Math.PI*2);
        ctx.strokeStyle=`rgba(${rb.c[0]},${rb.c[1]},${rb.c[2]},${(alpha*rb.op).toFixed(3)})`;
        ctx.lineWidth=Math.max(1,rb.ro-rb.ri);ctx.stroke();
      });
    }
    // Uranus back ring
    if(p.n==='Uranus'&&p.ring){
      ctx.beginPath();ctx.ellipse(px,py,pR*2.0,pR*2.0*FLAT*0.80,TILT+0.4,Math.PI,Math.PI*2);
      ctx.strokeStyle=`rgba(120,195,205,${(alpha*0.38).toFixed(3)})`;ctx.lineWidth=pR*0.30;ctx.stroke();
    }

    // Planet disc
    drawPlanet(ctx,px,py,pR,p.cb,p.ch,p.cd,alpha);

    // Bands
    if(p.n==='Jupiter') drawBands(ctx,px,py,pR,JUP_BANDS as any,alpha);
    if(p.n==='Saturn')  drawBands(ctx,px,py,pR,SAT_BANDS as any,alpha);

    // Earth: clouds + moon
    if(p.n==='Earth'){
      ctx.save();ctx.beginPath();ctx.arc(px,py,pR,0,Math.PI*2);ctx.clip();
      // Cloud bands
      ctx.fillStyle=`rgba(255,255,255,${(alpha*0.12).toFixed(3)})`;
      ctx.fillRect(px-pR,py-pR*0.38,pR*2,pR*0.28);
      ctx.fillStyle=`rgba(255,255,255,${(alpha*0.07).toFixed(3)})`;
      ctx.fillRect(px-pR,py+pR*0.18,pR*2,pR*0.16);
      ctx.restore();
      // Moon
      const ma=p.th*13.37,md=pR*3.4;
      const mx=px+Math.cos(ma)*md,my=py+Math.sin(ma)*md*FLAT;
      const moonR=Math.max(1.2,pR*0.27);
      const mg=ctx.createRadialGradient(mx-moonR*0.3,my-moonR*0.3,0,mx,my,moonR);
      mg.addColorStop(0,`rgba(225,225,235,${alpha.toFixed(3)})`);
      mg.addColorStop(1,`rgba(160,160,170,${(alpha*0.9).toFixed(3)})`);
      ctx.beginPath();ctx.arc(mx,my,moonR,0,Math.PI*2);ctx.fillStyle=mg;ctx.fill();
    }

    // Saturn front ring
    if(p.n==='Saturn'&&p.ring){
      const rf=FLAT*0.76,rBands=[
        {ri:pR*1.20,ro:pR*1.52,op:0.48,c:[185,172,138] as [number,number,number]},
        {ri:pR*1.55,ro:pR*2.10,op:0.82,c:[215,200,158] as [number,number,number]},
        {ri:pR*2.14,ro:pR*2.30,op:0.22,c:[128,118,98]  as [number,number,number]},
        {ri:pR*2.33,ro:pR*2.70,op:0.60,c:[205,188,150] as [number,number,number]},
      ];
      rBands.forEach(rb=>{
        ctx.beginPath();ctx.ellipse(px,py,rb.ro,rb.ro*rf,TILT,0,Math.PI);
        ctx.strokeStyle=`rgba(${rb.c[0]},${rb.c[1]},${rb.c[2]},${(alpha*rb.op).toFixed(3)})`;
        ctx.lineWidth=Math.max(1,rb.ro-rb.ri);ctx.stroke();
      });
    }
    // Uranus front ring
    if(p.n==='Uranus'&&p.ring){
      ctx.beginPath();ctx.ellipse(px,py,pR*2.0,pR*2.0*FLAT*0.80,TILT+0.4,0,Math.PI);
      ctx.strokeStyle=`rgba(120,195,205,${(alpha*0.38).toFixed(3)})`;ctx.lineWidth=pR*0.30;ctx.stroke();
    }
  });

  // ── 6. Sun — drawn on top of inner-orbit planets ──
  // Solar flare / corona ray lines
  if(cE<0.75){
    const nRays=16, cA=alpha*(1-cE*1.3)*0.22;
    for(let i=0;i<nRays;i++){
      const ang=(i/nRays)*Math.PI*2+elapsed*0.04;
      const len=sunR*(1.18+0.14*Math.sin(elapsed*2.2+i*0.8));
      ctx.beginPath();
      ctx.moveTo(sunX+Math.cos(ang)*sunR*0.88,sunY+Math.sin(ang)*sunR*0.88);
      ctx.lineTo(sunX+Math.cos(ang)*len,      sunY+Math.sin(ang)*len);
      ctx.strokeStyle=`rgba(255,240,80,${cA.toFixed(3)})`;ctx.lineWidth=2.2;ctx.stroke();
    }
  }
  // Outer diffuse corona — bright yellow-white
  [[sunR*5.0,0.55],[sunR*3.2,0.38],[sunR*1.9,0.28]].forEach(([rad,op])=>{
    const cg=ctx.createRadialGradient(sunX,sunY,sunR*0.55,sunX,sunY,rad as number);
    cg.addColorStop(0,  `rgba(255,252,180,${(alpha*(op as number)).toFixed(3)})`);
    cg.addColorStop(0.35,`rgba(255,235,80, ${(alpha*(op as number)*0.40).toFixed(3)})`);
    cg.addColorStop(1,  'rgba(255,210,20,0)');
    ctx.beginPath();ctx.arc(sunX,sunY,rad as number,0,Math.PI*2);ctx.fillStyle=cg;ctx.fill();
  });
  // Sun disc — single bright yellow
  ctx.beginPath();ctx.arc(sunX,sunY,sunR,0,Math.PI*2);
  ctx.fillStyle=`rgba(255,225,0,${alpha.toFixed(3)})`;ctx.fill();

  // ── 7. Collapse flash ──
  if(collapseT>0.85){
    const fl=(collapseT-0.85)/0.15;
    const fg=ctx.createRadialGradient(sunX,sunY,0,sunX,sunY,Math.max(w,h)*0.55*fl);
    fg.addColorStop(0,`rgba(255,255,255,${(fl*0.55).toFixed(3)})`);
    fg.addColorStop(0.3,`rgba(255,220,120,${(fl*0.22).toFixed(3)})`);
    fg.addColorStop(1,'rgba(255,180,60,0)');
    ctx.beginPath();ctx.arc(sunX,sunY,Math.max(w,h)*0.55*fl,0,Math.PI*2);ctx.fillStyle=fg;ctx.fill();
  }
}

// ═══════════ RENDERER — perf-optimised ═══════════
// Path2D pool — lazy init inside drawMesh so SSR (Node.js) never sees Path2D
let _triPaths:Path2D[]|null=null;
function getTriPaths():Path2D[]{
  if(!_triPaths)_triPaths=Array.from({length:BUCKETS},()=>new Path2D());
  return _triPaths;
}

function drawMesh(ctx:CanvasRenderingContext2D,scA:Scene,scB:Scene,morphT:number,proj:Float32Array){
  const eased=morphT<0.5?4*morphT**3:1-(-2*morphT+2)**3/2;
  // Dots and lines always fully visible — alpha never changes
  const aA=morphT>0.97?0:1-eased;
  const aB=morphT<0.03?0:eased;
  const[rA,gA,bA]=scA.rgb,[rB,gB,bB]=scB.rgb;
  const R=(rA+(rB-rA)*eased+0.5)|0,G=(gA+(gB-gA)*eased+0.5)|0,B2=(bA+(bB-bA)*eased+0.5)|0;

  const drawTris=(tris:Tri[],alpha:number)=>{
    if(alpha<0.06||!tris.length) return;
    // Reset pooled paths (lazy-inited, SSR-safe)
    const tp=getTriPaths();
    for(let k=0;k<BUCKETS;k++) tp[k]=new Path2D();
    for(let k=0;k<tris.length;k++){
      const{a,b,c}=tris[k],ai=a*3,bi=b*3,ci=c*3;
      const ax=proj[ai],ay=proj[ai+1],bx=proj[bi],by=proj[bi+1],cx2=proj[ci],cy2=proj[ci+1];
      if(Math.abs((bx-ax)*(cy2-ay)-(cx2-ax)*(by-ay))<0.4) continue;
      const avgZ=(proj[ai+2]+proj[bi+2]+proj[ci+2])/3;
      const bucket=clamp(((avgZ+1.2)*0.42*BUCKETS)|0,0,BUCKETS-1);
      const p=tp[bucket];p.moveTo(ax,ay);p.lineTo(bx,by);p.lineTo(cx2,cy2);p.closePath();
    }
    for(let k=0;k<BUCKETS;k++){
      const br=0.028+(k/(BUCKETS-1))*0.32;
      const f=`rgba(${R},${G},${B2},${Math.min(br*alpha,0.40).toFixed(3)})`;
      ctx.fillStyle=f;ctx.fill(tp[k]);ctx.strokeStyle=f;ctx.lineWidth=0.20;ctx.stroke(tp[k]);
    }
  };
  // Skip triangle fill during morph — segs+dots still render. Saves ~60% draw cost.
  const inTransition=morphT>0.04&&morphT<0.96;
  if(!inTransition){
    if(aA>0.012) drawTris(scA.tris,aA);
    if(aB>0.012) drawTris(scB.tris,aB);
  }

  const drawSegs=(segs:[number,number][],alpha:number)=>{
    if(alpha<0.06||!segs.length) return;
    ctx.beginPath();ctx.strokeStyle=`rgba(${R},${G},${B2},${(alpha*0.46).toFixed(3)})`;ctx.lineWidth=0.48;
    for(let k=0;k<segs.length;k++){const[a,b2]=segs[k];ctx.moveTo(proj[a*3],proj[a*3+1]);ctx.lineTo(proj[b2*3],proj[b2*3+1]);}
    ctx.stroke();
  };
  if(aA>0.012) drawSegs(scA.segs,aA);
  if(aB>0.012) drawSegs(scB.segs,aB);

  // Dots — depth-scaled size. Outer fill points are smaller but still visible.
  ctx.fillStyle=`rgba(${R},${G},${B2},0.13)`;
  for(let i=0;i<TOTAL_N;i+=3){
    const sx=proj[i*3],sy=proj[i*3+1],d=proj[i*3+2];
    const sz=clamp(0.8+(d+1.2)*0.50,0.8,2.2);
    ctx.fillRect(sx-sz,sy-sz,sz*2,sz*2);
  }
  // Bright star points — white-blue, varying size, occasional large glow stars
  for(let i=0;i<TOTAL_N;i+=2){
    const sx=proj[i*3],sy=proj[i*3+1],d=proj[i*3+2];
    const sz=clamp(0.22+(d+1.2)*0.20,0.22,0.85);
    ctx.fillStyle='rgba(220,238,255,0.82)';
    ctx.fillRect(sx-sz,sy-sz,sz*2,sz*2);
  }
}

// ═══════════ COMPONENT ═══════════
export default function GlobalBackground(){
  const canvasRef=useRef<HTMLCanvasElement|null>(null);
  useEffect(()=>{
    const canvas=canvasRef.current;if(!canvas)return;
    const ctx=canvas.getContext('2d',{alpha:false});if(!ctx)return;
    let w=0,h=0,dpr=1,raf=0;
    const T0=performance.now();
    let bgGrad:CanvasGradient|null=null;
    let scrollRaw=0,scrollSmooth=0;
    let scrollSection=0;   // hard-snap integer — which section the user is IN right now
    let lastFrame=0;

    const buildBG=()=>{bgGrad=ctx.createRadialGradient(w*0.42,h*0.44,0,w*0.5,h*0.5,Math.max(w,h)*0.82);bgGrad.addColorStop(0,'#03080f');bgGrad.addColorStop(0.30,'#02060b');bgGrad.addColorStop(0.65,'#010407');bgGrad.addColorStop(1.0,'#010203');};
    const resize=()=>{dpr=Math.min(window.devicePixelRatio||1,1.0);w=window.innerWidth;h=window.innerHeight;canvas.width=(w*dpr)|0;canvas.height=(h*dpr)|0;canvas.style.width=w+'px';canvas.style.height=h+'px';ctx.scale(dpr,dpr);buildBG();};
    resize();window.addEventListener('resize',resize,{passive:true});
    // Section offsets cached — scroll handler does zero DOM reads, zero reflow
    const SECTION_IDS=['hero','life','evolution','reality','religion','consciousness','sysview','questions'];
    const NS_S=SECTION_IDS.length;
    let secTops:number[]=new Array(NS_S).fill(0);
    const cacheSectionTops=()=>{secTops=SECTION_IDS.map(id=>document.getElementById(id)?.offsetTop??0);};
    cacheSectionTops();
    setTimeout(cacheSectionTops,600);
    window.addEventListener('resize',cacheSectionTops,{passive:true});

    const onScroll=()=>{
      const sy=window.scrollY,vh=window.innerHeight;
      let sec=0,prog=0;
      for(let i=NS_S-1;i>=0;i--){
        if(sy+vh*0.40>=secTops[i]){
          sec=i;
          if(i<NS_S-1){const secH=Math.max(1,secTops[i+1]-secTops[i]);prog=clamp((sy+vh*0.40-secTops[i])/secH,0,1);}
          break;
        }
      }
      scrollSection=sec;
      scrollRaw=(sec+prog)/(NS_S-1);
    };
    window.addEventListener('scroll',onScroll,{passive:true});

    const rng=lcg(88);
    const orbAngles=new Float32Array(ORBIT_N).map((_,i)=>(i/ORBIT_N)*Math.PI*2);
    const orbSpeeds=new Float32Array(ORBIT_N).map(()=>0.042+rng()*0.076);
    const orbRadii=new Float32Array(ORBIT_N).map(()=>0.98+rng()*0.44);
    const orbIncs=new Float32Array(ORBIT_N).map(()=>(rng()-0.5)*1.0);
    const proj=new Float32Array(TOTAL_N*3);
    const ROT_SPEED_BASE=0.10,FOV=3.2;

    // Scroll-reactive rotation state
    let rotAccum=0;           // accumulated rotation angle
    let lastScrollY=window.scrollY;
    let scrollVel=0;          // px/ms raw scroll speed
    let scrollVelSmooth=0;    // smoothed for rotation boost
    // At 4px/ms scroll speed: 4x base rotation speed (moderate)
    const SCROLL_BOOST_MAX=2.5;  // moderate: 2.5x max rotation at fast scroll
    const SCROLL_BOOST_SENSITIVITY=0.012;

    const frame=(now:number)=>{
      if(document.hidden){raf=requestAnimationFrame(frame);return;}
      // Frame-time guard: never run faster than 71fps, avoids spiral on 144hz monitors
      if(now-lastFrame<20){raf=requestAnimationFrame(frame);return;}
      const dt=clamp(now-lastFrame,1,50);
      lastFrame=now;
      const elapsed=(now-T0)*0.001;

      // Track scroll velocity
      const currentScrollY=window.scrollY;
      const rawVel=Math.abs(currentScrollY-lastScrollY)/dt;
      lastScrollY=currentScrollY;
      scrollVel+=(rawVel-scrollVel)*0.35;
      scrollVelSmooth+=(scrollVel-scrollVelSmooth)*0.08;

      // Scroll-reactive rotation: baseline + boost, decays organically when stopped
      const scrollBoost=clamp(scrollVelSmooth*SCROLL_BOOST_SENSITIVITY,0,SCROLL_BOOST_MAX);
      const rotSpeed=ROT_SPEED_BASE*(1+scrollBoost);
      rotAccum+=rotSpeed*(dt/1000);

      scrollSmooth+=(scrollRaw-scrollSmooth)*0.12;
      const sp=clamp(scrollSmooth,0,0.9999),NS=SCENES.length,raw=sp*(NS-1);
      const fi=raw|0,ti=fi+1<NS?fi+1:NS-1;
      const tRaw=raw-fi; // 0..1 progress through current section

      // ── Smooth full-section morph — quintic ease across entire tRaw 0→1 ──
      // No frozen hold regions; background continuously and smoothly transitions.
      // Quintic (smootherstep): starts slow, accelerates, decelerates — zero jerk at ends.
      const morphT = tRaw < 0 ? 0 : tRaw > 1 ? 1
        : tRaw * tRaw * tRaw * (tRaw * (tRaw * 6 - 15) + 10);
      const scA=SCENES[fi],scB=SCENES[ti];
      const tilt=lerp(scA.tilt,scB.tilt,morphT),rotY=rotAccum;
      const cY=Math.cos(rotY),sY=Math.sin(rotY),cT=Math.cos(tilt),sT=Math.sin(tilt);
      const sq=(w<h?w:h)*0.80,half=sq*0.5,cx2=w*0.5,cy2=h*0.5;

      const pA=scA.pts,pB=scB.pts;
      for(let i=0;i<SHAPE_N;i++){
        const a=pA[i],b=pB[i],mx=a.x+(b.x-a.x)*morphT,my=a.y+(b.y-a.y)*morphT,mz=a.z+(b.z-a.z)*morphT;
        const rx=mx*cY+mz*sY,rz=-mx*sY+mz*cY,ry2=my*cT-rz*sT,rz2=my*sT+rz*cT,d=FOV/(FOV+rz2);
        proj[i*3]=cx2+rx*half*d;proj[i*3+1]=cy2+ry2*half*d;proj[i*3+2]=rz2;
      }
      for(let i=0;i<ORBIT_N;i++) orbAngles[i]+=orbSpeeds[i]*0.008;
      for(let i=0;i<ORBIT_N;i++){
        const idx=SHAPE_N+i,ang=orbAngles[i],rad=orbRadii[i],inc=orbIncs[i];
        const ox=Math.cos(ang)*rad*Math.cos(inc),oy=Math.sin(inc)*rad*0.7,oz=Math.sin(ang)*rad*Math.cos(inc);
        const rx=ox*cY+oz*sY,rz=-ox*sY+oz*cY,ry2=oy*cT-rz*sT,rz2=oy*sT+rz*cT,d=FOV/(FOV+rz2);
        proj[idx*3]=cx2+rx*half*d;proj[idx*3+1]=cy2+ry2*half*d;proj[idx*3+2]=rz2;
      }

      if(bgGrad)ctx.fillStyle=bgGrad;else ctx.fillStyle='#020609';
      ctx.fillRect(0,0,w,h);
      drawNebula(ctx,w,h,elapsed);
      drawMesh(ctx,scA,scB,morphT,proj);

      // ── Overlays: use scrollSection (hard snap) not smoothed fi ──
      // Solar system: ONLY while user is on hero section (0). Hard off the instant they leave.
      if(scrollSection===0){
        const collapseT=clamp(morphT*1.4,0,1);
        const solarAlpha=clamp(1-morphT*1.4,0,1);
        drawSolarSystem(ctx,w,h,elapsed,collapseT,solarAlpha);
      }
      // Section 1 (Life/Tree): particle cloud morphs into tree shape — no overlay

      // Orbital fragment triangles
      const[rA2,gA2,bA2]=scA.rgb,[rB2,gB2,bB2]=scB.rgb;
      const ea2=morphT<0.5?4*morphT**3:1-(-2*morphT+2)**3/2;
      const fR=(rA2+(rB2-rA2)*ea2+0.5)|0,fG=(gA2+(gB2-gA2)*ea2+0.5)|0,fB2=(bA2+(bB2-bA2)*ea2+0.5)|0;
      ctx.beginPath();ctx.fillStyle=`rgba(${fR},${fG},${fB2},0.11)`;
      for(let i=0;i<ORBIT_N;i+=4){
        const idx=(SHAPE_N+i)*3,sx=proj[idx],sy=proj[idx+1];
        const ts=half*0.008+Math.sin(elapsed*0.75+i)*half*0.003;
        ctx.moveTo(sx,sy-ts);ctx.lineTo(sx+ts*0.86,sy+ts*0.5);ctx.lineTo(sx-ts*0.86,sy+ts*0.5);ctx.closePath();
      }
      ctx.fill();

      raf=requestAnimationFrame(frame);
    };
    raf=requestAnimationFrame(frame);
    return()=>{cancelAnimationFrame(raf);window.removeEventListener('resize',resize);window.removeEventListener('scroll',onScroll);};
  },[]);
  return <canvas ref={canvasRef} style={{position:'fixed',inset:0,pointerEvents:'none',zIndex:0}} aria-hidden="true"/>;
}