'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type CartItem = {
  id: string
  product_name: string
  product_image?: string | null
  price: number
  quantity: number
  variant?: string | null
}

export default function CartPage() {
  const router = useRouter()
  const [loading, setLoading]   = useState(true)
  const [items, setItems]       = useState<CartItem[]>([])
  const [updating, setUpdating] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.replace('/'); return }
      supabase
        .from('cart_items')
        .select('id, product_name, product_image, price, quantity, variant')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .then(({ data }) => {
          if (data) setItems(data)
          setLoading(false)
        })
    })
  }, [router])

  const updateQty = async (id: string, qty: number) => {
    if (qty < 1) { removeItem(id); return }
    setUpdating(id)
    await supabase.from('cart_items').update({ quantity: qty }).eq('id', id)
    setItems(prev => prev.map(item => item.id === id ? { ...item, quantity: qty } : item))
    setUpdating(null)
  }

  const removeItem = async (id: string) => {
    setUpdating(id)
    await supabase.from('cart_items').delete().eq('id', id)
    setItems(prev => prev.filter(item => item.id !== id))
    setUpdating(null)
  }

  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0)

  const UI = {
    bg:     'linear-gradient(145deg, #eef0f3 0%, #d7dade 48%, #e5e7eb 100%)',
    card:   'rgba(255,255,255,0.62)',
    border: 'rgba(29,34,40,0.10)',
    text:   '#1d2228',
    muted:  'rgba(29,34,40,0.52)',
    accent: '#2563EB',
  }

  if (loading) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center',
      background: UI.bg }}>
      <div style={{ width:36, height:36, borderRadius:'50%',
        border:`3px solid rgba(37,99,235,0.2)`, borderTop:`3px solid ${UI.accent}`,
        animation:'spin 0.8s linear infinite' }}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <div style={{ minHeight:'100vh', background: UI.bg, paddingTop:88 }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      <div style={{ maxWidth:860, margin:'0 auto', padding:'0 24px 60px' }}>

        {/* Header */}
        <div style={{ marginBottom:28 }}>
          <h1 style={{ fontSize:22, fontWeight:700, color: UI.text, margin:'0 0 4px' }}>Cart</h1>
          <p style={{ fontSize:13, color: UI.muted, margin:0 }}>
            {items.length === 0 ? 'Your cart is empty' : `${items.length} item${items.length === 1 ? '' : 's'}`}
          </p>
        </div>

        {/* Empty state */}
        {items.length === 0 && (
          <div style={{ background: UI.card, border:`1px solid ${UI.border}`, borderRadius:16,
            padding:'60px 24px', textAlign:'center', boxShadow:'0 2px 12px rgba(29,34,40,0.07)' }}>
            <div style={{ width:56, height:56, borderRadius:14,
              background:'rgba(37,99,235,0.08)', display:'flex', alignItems:'center',
              justifyContent:'center', margin:'0 auto 16px' }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none"
                stroke="rgba(37,99,235,0.7)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
                <line x1="3" y1="6" x2="21" y2="6"/>
                <path d="M16 10a4 4 0 01-8 0"/>
              </svg>
            </div>
            <p style={{ fontSize:15, fontWeight:600, color: UI.text, margin:'0 0 6px' }}>
              Nothing in your cart
            </p>
            <p style={{ fontSize:13, color: UI.muted, margin:'0 0 24px', maxWidth:300, marginLeft:'auto', marginRight:'auto' }}>
              Browse our products and add items to get started.
            </p>
            <Link href="/resources"
              style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'9px 22px',
                borderRadius:9, fontSize:13, fontWeight:600, color:'#fff',
                background:'linear-gradient(135deg,#2563EB,#1d4ed8)',
                textDecoration:'none', boxShadow:'0 3px 10px rgba(37,99,235,0.28)' }}>
              Browse Products →
            </Link>
          </div>
        )}

        {/* Cart layout */}
        {items.length > 0 && (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 300px', gap:20, alignItems:'start' }}>

            {/* Items */}
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {items.map(item => (
                <div key={item.id}
                  style={{ background: UI.card, border:`1px solid ${UI.border}`, borderRadius:14,
                    padding:'16px', display:'flex', gap:16, alignItems:'center',
                    boxShadow:'0 2px 12px rgba(29,34,40,0.07)',
                    opacity: updating === item.id ? 0.6 : 1, transition:'opacity 0.15s' }}>

                  {/* Image */}
                  <div style={{ width:72, height:72, borderRadius:10, flexShrink:0,
                    background:'linear-gradient(135deg,#dde1e8,#c8cdd6)',
                    display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden' }}>
                    {item.product_image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.product_image} alt={item.product_name}
                        style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
                    ) : (
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
                        stroke="rgba(29,34,40,0.28)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="3" width="20" height="14" rx="2"/>
                        <line x1="8" y1="21" x2="16" y2="21"/>
                        <line x1="12" y1="17" x2="12" y2="21"/>
                      </svg>
                    )}
                  </div>

                  {/* Info */}
                  <div style={{ flex:1, minWidth:0 }}>
                    <p style={{ fontSize:14, fontWeight:600, color: UI.text, margin:'0 0 3px',
                      whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                      {item.product_name}
                    </p>
                    {item.variant && (
                      <p style={{ fontSize:12, color: UI.muted, margin:'0 0 8px' }}>{item.variant}</p>
                    )}
                    {/* Qty controls */}
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:0, borderRadius:7,
                        border:`1px solid ${UI.border}`, overflow:'hidden', background:'rgba(255,255,255,0.6)' }}>
                        {[-1, null, 1].map((delta, idx) => (
                          delta === null ? (
                            <span key="qty" style={{ padding:'4px 12px', fontSize:13, fontWeight:600,
                              color: UI.text, minWidth:28, textAlign:'center' }}>
                              {item.quantity}
                            </span>
                          ) : (
                            <button key={idx} onClick={() => updateQty(item.id, item.quantity + delta)}
                              style={{ width:28, height:28, border:'none', cursor:'pointer',
                                background:'transparent', color: UI.muted, fontSize:16, lineHeight:1,
                                display:'flex', alignItems:'center', justifyContent:'center' }}>
                              {delta === -1 ? '−' : '+'}
                            </button>
                          )
                        ))}
                      </div>
                      <button onClick={() => removeItem(item.id)}
                        style={{ background:'none', border:'none', cursor:'pointer', padding:'4px 6px',
                          fontSize:12, color:'rgba(220,38,38,0.7)',
                          display:'flex', alignItems:'center', gap:4 }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6"/>
                          <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
                          <path d="M10 11v6M14 11v6"/>
                        </svg>
                        Remove
                      </button>
                    </div>
                  </div>

                  {/* Price */}
                  <p style={{ fontSize:15, fontWeight:700, color: UI.text, flexShrink:0 }}>
                    ${(item.price * item.quantity).toFixed(2)}
                  </p>
                </div>
              ))}
            </div>

            {/* Order summary */}
            <div style={{ background: UI.card, border:`1px solid ${UI.border}`, borderRadius:14,
              padding:'20px', boxShadow:'0 2px 12px rgba(29,34,40,0.07)' }}>
              <h2 style={{ fontSize:15, fontWeight:700, color: UI.text, margin:'0 0 16px' }}>
                Order Summary
              </h2>
              <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:16 }}>
                <div style={{ display:'flex', justifyContent:'space-between' }}>
                  <span style={{ fontSize:13, color: UI.muted }}>Subtotal</span>
                  <span style={{ fontSize:13, fontWeight:500, color: UI.text }}>${subtotal.toFixed(2)}</span>
                </div>
                <div style={{ display:'flex', justifyContent:'space-between' }}>
                  <span style={{ fontSize:13, color: UI.muted }}>Shipping</span>
                  <span style={{ fontSize:13, color: UI.muted }}>Calculated at checkout</span>
                </div>
                <div style={{ height:1, background: UI.border, margin:'4px 0' }}/>
                <div style={{ display:'flex', justifyContent:'space-between' }}>
                  <span style={{ fontSize:14, fontWeight:700, color: UI.text }}>Total</span>
                  <span style={{ fontSize:14, fontWeight:700, color: UI.text }}>${subtotal.toFixed(2)}</span>
                </div>
              </div>
              <button
                style={{ width:'100%', padding:'10px 0', borderRadius:9, fontSize:13, fontWeight:600,
                  color:'#fff', background:'linear-gradient(135deg,#2563EB,#1d4ed8)',
                  border:'none', cursor:'pointer', boxShadow:'0 3px 10px rgba(37,99,235,0.28)' }}>
                Proceed to Checkout
              </button>
              <p style={{ fontSize:11, color: UI.muted, textAlign:'center', margin:'10px 0 0' }}>
                Secure checkout coming soon
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
