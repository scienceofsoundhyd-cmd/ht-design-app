'use client'
import { useState } from 'react'
import Link from 'next/link'

type Category = 'all' | 'acoustic' | 'speakers' | 'electronics' | 'lighting'

const CATEGORIES: { id: Category; label: string }[] = [
  { id: 'all',         label: 'All Products'   },
  { id: 'acoustic',    label: 'Acoustic'       },
  { id: 'speakers',    label: 'Speakers'       },
  { id: 'electronics', label: 'Electronics'    },
  { id: 'lighting',    label: 'Lighting'       },
]

type Product = {
  id: string
  name: string
  price: number
  originalPrice?: number
  category: Exclude<Category, 'all'>
  badge?: string
  description: string
  specs: string[]
}

const PRODUCTS: Product[] = [
  {
    id: 'p1',
    name: 'Bass Trap Corner Panel',
    price: 89,
    category: 'acoustic',
    badge: 'Best Seller',
    description: 'High-density rockwool core with fabric wrap. Targets low-frequency buildup in room corners.',
    specs: ['12" × 12" × 48"', '4lb/ft³ density', 'NRC 0.95', 'Fire rated'],
  },
  {
    id: 'p2',
    name: 'Broadband Absorber Panel',
    price: 64,
    originalPrice: 79,
    category: 'acoustic',
    badge: 'Sale',
    description: 'Studio-grade acoustic panel. Controls mid and high-frequency reflections effectively.',
    specs: ['24" × 48" × 2"', '2lb/ft³ density', 'NRC 0.85', 'Custom colors'],
  },
  {
    id: 'p3',
    name: 'Quadratic Diffuser QRD-7',
    price: 149,
    category: 'acoustic',
    description: 'Mathematically designed quadratic residue diffuser for even sound scattering across a wide bandwidth.',
    specs: ['24" × 24"', '7-well design', '500Hz–8kHz', 'MDF construction'],
  },
  {
    id: 'p4',
    name: 'LCR Speaker Package',
    price: 2499,
    category: 'speakers',
    badge: 'New',
    description: 'Matched left, center, right speaker set. Timbre-matched for seamless front soundstage.',
    specs: ['3-way design', '100W RMS', '8Ω impedance', 'THX Select certified'],
  },
  {
    id: 'p5',
    name: 'Atmos Ceiling Speaker Pair',
    price: 699,
    category: 'speakers',
    description: 'In-ceiling speakers optimized for Dolby Atmos height channels with wide dispersion.',
    specs: ['6.5" woofer', '1" tweeter', '8Ω impedance', 'Paintable grille'],
  },
  {
    id: 'p6',
    name: 'Powered Subwoofer 15"',
    price: 1199,
    originalPrice: 1399,
    category: 'speakers',
    badge: 'Sale',
    description: 'Sealed-box 15" powered subwoofer with built-in DSP room correction and app control.',
    specs: ['15" long-throw driver', '500W RMS amp', '18–200Hz', 'DSP EQ built-in'],
  },
  {
    id: 'p7',
    name: 'AV Processor 9.4.6',
    price: 3499,
    category: 'electronics',
    badge: 'Featured',
    description: 'Reference-grade AV processor with Auro-3D, Dolby Atmos, and DTS:X Pro decoding.',
    specs: ['9.4.6 processing', 'Dirac Live', '4K/120Hz passthrough', 'HDMI 2.1'],
  },
  {
    id: 'p8',
    name: 'Multi-Channel Amplifier 7ch',
    price: 1899,
    category: 'electronics',
    description: '7-channel class AB amplifier with audiophile-grade components and balanced XLR inputs.',
    specs: ['7 × 200W @ 8Ω', 'THD < 0.003%', 'XLR + RCA inputs', '19" rack mount'],
  },
  {
    id: 'p9',
    name: 'Bias Lighting Kit',
    price: 129,
    category: 'lighting',
    badge: 'New',
    description: 'Adjustable color-temperature LED bias lighting strip for behind-screen installation.',
    specs: ['RGBW LED', '6500K max', 'App controlled', 'CRI > 95'],
  },
  {
    id: 'p10',
    name: 'Motorized Blackout Blinds',
    price: 449,
    category: 'lighting',
    description: 'Motorized blackout roller blinds with home automation integration and quiet operation.',
    specs: ['0.1% light block', 'Quiet motor', 'Z-Wave + Zigbee', 'Custom sizing'],
  },
]

export default function ProductsPage() {
  const [activeCategory, setActiveCategory] = useState<Category>('all')
  const [cart, setCart]   = useState<Set<string>>(new Set())

  const filtered = activeCategory === 'all'
    ? PRODUCTS
    : PRODUCTS.filter(p => p.category === activeCategory)

  const handleAddToCart = (id: string) => {
    setCart(prev => new Set([...prev, id]))
  }

  const UI = {
    bg:     'linear-gradient(145deg, #eef0f3 0%, #d7dade 48%, #e5e7eb 100%)',
    card:   'rgba(255,255,255,0.62)',
    border: 'rgba(29,34,40,0.10)',
    text:   '#1d2228',
    muted:  'rgba(29,34,40,0.52)',
    accent: '#2563EB',
  }

  const BADGE_STYLE: Record<string, { color: string; bg: string; border: string }> = {
    'Best Seller': { color:'#166534', bg:'rgba(34,197,94,0.12)',  border:'rgba(34,197,94,0.3)'  },
    'Sale':        { color:'#991b1b', bg:'rgba(239,68,68,0.10)',  border:'rgba(239,68,68,0.25)' },
    'New':         { color:'#1d4ed8', bg:'rgba(37,99,235,0.10)', border:'rgba(37,99,235,0.25)' },
    'Featured':    { color:'#92400e', bg:'rgba(251,191,36,0.14)', border:'rgba(251,191,36,0.35)'},
  }

  return (
    <div style={{ minHeight:'100vh', background: UI.bg, paddingTop:88 }}>
      <style>{`
        .prod-card { transition: box-shadow 0.2s, transform 0.2s; }
        .prod-card:hover { box-shadow: 0 8px 28px rgba(29,34,40,0.14) !important; transform: translateY(-2px); }
        .cat-btn { transition: all 0.15s; }
      `}</style>

      <div style={{ maxWidth:1060, margin:'0 auto', padding:'0 24px 60px' }}>

        {/* Header */}
        <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between',
          marginBottom:28, flexWrap:'wrap', gap:12 }}>
          <div>
            <h1 style={{ fontSize:22, fontWeight:700, color: UI.text, margin:'0 0 4px' }}>Products</h1>
            <p style={{ fontSize:13, color: UI.muted, margin:0 }}>
              Acoustic treatment, speakers, electronics, and lighting for high-performance theaters.
            </p>
          </div>
          <Link href="/cart"
            style={{ display:'flex', alignItems:'center', gap:7, padding:'8px 16px',
              borderRadius:9, fontSize:13, fontWeight:500, color: UI.text,
              background: UI.card, border:`1px solid ${UI.border}`,
              textDecoration:'none', boxShadow:'0 2px 8px rgba(29,34,40,0.07)' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
              <line x1="3" y1="6" x2="21" y2="6"/>
              <path d="M16 10a4 4 0 01-8 0"/>
            </svg>
            View Cart
            {cart.size > 0 && (
              <span style={{ minWidth:18, height:18, borderRadius:999, background: UI.accent,
                color:'#fff', fontSize:10, fontWeight:700, display:'flex',
                alignItems:'center', justifyContent:'center', padding:'0 4px' }}>
                {cart.size}
              </span>
            )}
          </Link>
        </div>

        {/* Category filter */}
        <div style={{ display:'flex', gap:8, marginBottom:24, flexWrap:'wrap' }}>
          {CATEGORIES.map(({ id, label }) => (
            <button key={id} className="cat-btn"
              onClick={() => setActiveCategory(id)}
              style={{
                padding:'6px 16px', borderRadius:999, fontSize:12, fontWeight:500,
                cursor:'pointer', border:`1px solid ${activeCategory === id ? UI.accent : UI.border}`,
                background: activeCategory === id ? UI.accent : 'rgba(255,255,255,0.55)',
                color: activeCategory === id ? '#fff' : UI.text,
                boxShadow: activeCategory === id ? '0 2px 8px rgba(37,99,235,0.25)' : 'none',
              }}>
              {label}
            </button>
          ))}
        </div>

        {/* Product grid */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))', gap:16 }}>
          {filtered.map(product => {
            const badge = product.badge ? BADGE_STYLE[product.badge] : null
            const added = cart.has(product.id)
            return (
              <div key={product.id} className="prod-card"
                style={{ background: UI.card, border:`1px solid ${UI.border}`, borderRadius:14,
                  overflow:'hidden', boxShadow:'0 2px 12px rgba(29,34,40,0.07)',
                  display:'flex', flexDirection:'column' }}>

                {/* Product image placeholder */}
                <div style={{ height:160, background:'linear-gradient(135deg,#dde1e8,#c8cdd6)',
                  display:'flex', alignItems:'center', justifyContent:'center', position:'relative' }}>
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none"
                    stroke="rgba(29,34,40,0.22)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="3" width="20" height="14" rx="2"/>
                    <line x1="8" y1="21" x2="16" y2="21"/>
                    <line x1="12" y1="17" x2="12" y2="21"/>
                  </svg>
                  {badge && (
                    <span style={{ position:'absolute', top:10, left:10,
                      fontSize:10, fontWeight:700, letterSpacing:'0.04em',
                      color: badge.color, background: badge.bg, border:`1px solid ${badge.border}`,
                      borderRadius:20, padding:'3px 9px' }}>
                      {product.badge}
                    </span>
                  )}
                </div>

                {/* Info */}
                <div style={{ padding:'16px 16px 0', flex:1 }}>
                  <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between',
                    gap:8, marginBottom:6 }}>
                    <p style={{ fontSize:14, fontWeight:700, color: UI.text, margin:0, lineHeight:1.3 }}>
                      {product.name}
                    </p>
                    <div style={{ flexShrink:0, textAlign:'right' }}>
                      <span style={{ fontSize:15, fontWeight:700, color: UI.text }}>
                        ${product.price.toLocaleString()}
                      </span>
                      {product.originalPrice && (
                        <span style={{ display:'block', fontSize:11, color: UI.muted,
                          textDecoration:'line-through' }}>
                          ${product.originalPrice.toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <p style={{ fontSize:12, color: UI.muted, margin:'0 0 10px', lineHeight:1.5 }}>
                    {product.description}
                  </p>

                  {/* Specs */}
                  <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginBottom:14 }}>
                    {product.specs.map(spec => (
                      <span key={spec} style={{ fontSize:10, fontWeight:500, color: UI.muted,
                        background:'rgba(29,34,40,0.05)', border:`1px solid ${UI.border}`,
                        borderRadius:4, padding:'2px 7px' }}>
                        {spec}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Add to cart */}
                <div style={{ padding:'0 16px 16px' }}>
                  <button onClick={() => handleAddToCart(product.id)}
                    style={{ width:'100%', padding:'9px 0', borderRadius:8, fontSize:12,
                      fontWeight:600, cursor:'pointer', border:'none', transition:'all 0.15s',
                      color: added ? '#166534' : '#fff',
                      background: added
                        ? 'rgba(34,197,94,0.12)'
                        : 'linear-gradient(135deg,#2563EB,#1d4ed8)',
                      boxShadow: added ? 'none' : '0 3px 10px rgba(37,99,235,0.25)',
                      ...(added ? { border:'1px solid rgba(34,197,94,0.3)' } : {}),
                    }}>
                    {added ? '✓ Added to Cart' : 'Add to Cart'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
