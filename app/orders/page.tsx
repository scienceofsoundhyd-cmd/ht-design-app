'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type OrderItem = {
  product_name: string
  quantity: number
  price: number
}

type Order = {
  id: string
  created_at: string
  status: 'processing' | 'shipped' | 'delivered' | 'cancelled'
  total: number
  items: OrderItem[]
  tracking_number?: string | null
}

const STATUS_CONFIG: Record<Order['status'], { label: string; color: string; bg: string; border: string }> = {
  processing: { label:'Processing',  color:'#92400e', bg:'rgba(251,191,36,0.12)',  border:'rgba(251,191,36,0.3)'  },
  shipped:    { label:'Shipped',     color:'#1d4ed8', bg:'rgba(37,99,235,0.10)',   border:'rgba(37,99,235,0.25)'  },
  delivered:  { label:'Delivered',   color:'#166534', bg:'rgba(34,197,94,0.10)',   border:'rgba(34,197,94,0.25)'  },
  cancelled:  { label:'Cancelled',   color:'#991b1b', bg:'rgba(239,68,68,0.08)',   border:'rgba(239,68,68,0.22)'  },
}

export default function OrdersPage() {
  const router = useRouter()
  const [loading, setLoading]   = useState(true)
  const [orders, setOrders]     = useState<Order[]>([])
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.replace('/'); return }
      supabase
        .from('orders')
        .select('id, created_at, status, total, items, tracking_number')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .then(({ data }) => {
          if (data) setOrders(data as Order[])
          setLoading(false)
        })
    })
  }, [router])

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', { day:'numeric', month:'long', year:'numeric' })

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
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        .order-row { transition: background 0.15s; }
        .order-row:hover { background: rgba(29,34,40,0.02) !important; }
      `}</style>

      <div style={{ maxWidth:860, margin:'0 auto', padding:'0 24px 60px' }}>

        {/* Header */}
        <div style={{ marginBottom:28 }}>
          <h1 style={{ fontSize:22, fontWeight:700, color: UI.text, margin:'0 0 4px' }}>Orders</h1>
          <p style={{ fontSize:13, color: UI.muted, margin:0 }}>
            {orders.length === 0 ? 'No orders yet' : `${orders.length} order${orders.length === 1 ? '' : 's'}`}
          </p>
        </div>

        {/* Empty state */}
        {orders.length === 0 && (
          <div style={{ background: UI.card, border:`1px solid ${UI.border}`, borderRadius:16,
            padding:'60px 24px', textAlign:'center', boxShadow:'0 2px 12px rgba(29,34,40,0.07)' }}>
            <div style={{ width:56, height:56, borderRadius:14,
              background:'rgba(37,99,235,0.08)', display:'flex', alignItems:'center',
              justifyContent:'center', margin:'0 auto 16px' }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none"
                stroke="rgba(37,99,235,0.7)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
              </svg>
            </div>
            <p style={{ fontSize:15, fontWeight:600, color: UI.text, margin:'0 0 6px' }}>
              No orders placed yet
            </p>
            <p style={{ fontSize:13, color: UI.muted, margin:0, maxWidth:300, marginLeft:'auto', marginRight:'auto' }}>
              Your order history will appear here once you make a purchase.
            </p>
          </div>
        )}

        {/* Orders list */}
        {orders.length > 0 && (
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {orders.map(order => {
              const status = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.processing
              const isOpen = expanded === order.id
              return (
                <div key={order.id}
                  style={{ background: UI.card, border:`1px solid ${UI.border}`, borderRadius:14,
                    overflow:'hidden', boxShadow:'0 2px 12px rgba(29,34,40,0.07)' }}>

                  {/* Order header row */}
                  <button className="order-row"
                    onClick={() => setExpanded(isOpen ? null : order.id)}
                    style={{ width:'100%', display:'flex', alignItems:'center', gap:16,
                      padding:'16px 18px', background:'transparent', border:'none', cursor:'pointer',
                      textAlign:'left' }}>

                    {/* Order icon */}
                    <div style={{ width:38, height:38, borderRadius:10, flexShrink:0,
                      background:'rgba(37,99,235,0.07)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                        stroke="rgba(37,99,235,0.65)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                        <polyline points="14 2 14 8 20 8"/>
                        <line x1="16" y1="13" x2="8" y2="13"/>
                        <line x1="16" y1="17" x2="8" y2="17"/>
                      </svg>
                    </div>

                    {/* Info */}
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', marginBottom:3 }}>
                        <span style={{ fontSize:13, fontWeight:600, color: UI.text }}>
                          Order #{order.id.slice(0, 8).toUpperCase()}
                        </span>
                        <span style={{ fontSize:11, fontWeight:600, color: status.color,
                          background: status.bg, border:`1px solid ${status.border}`,
                          borderRadius:20, padding:'2px 8px' }}>
                          {status.label}
                        </span>
                      </div>
                      <span style={{ fontSize:12, color: UI.muted }}>{formatDate(order.created_at)}</span>
                    </div>

                    {/* Total + chevron */}
                    <div style={{ display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
                      <span style={{ fontSize:14, fontWeight:700, color: UI.text }}>
                        ${order.total.toFixed(2)}
                      </span>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                        stroke={UI.muted} strokeWidth="2" strokeLinecap="round"
                        style={{ transition:'transform 0.2s', transform: isOpen ? 'rotate(180deg)' : 'none' }}>
                        <polyline points="6 9 12 15 18 9"/>
                      </svg>
                    </div>
                  </button>

                  {/* Expanded details */}
                  {isOpen && (
                    <div style={{ borderTop:`1px solid ${UI.border}`, padding:'16px 18px' }}>
                      {order.tracking_number && (
                        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14,
                          padding:'10px 12px', borderRadius:8,
                          background:'rgba(37,99,235,0.06)', border:'1px solid rgba(37,99,235,0.14)' }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                            stroke={UI.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z"/>
                            <circle cx="12" cy="10" r="3"/>
                          </svg>
                          <span style={{ fontSize:12, color: UI.text }}>
                            Tracking: <strong>{order.tracking_number}</strong>
                          </span>
                        </div>
                      )}

                      {Array.isArray(order.items) && order.items.length > 0 && (
                        <div>
                          <p style={{ fontSize:11, fontWeight:600, color: UI.muted,
                            letterSpacing:'0.06em', textTransform:'uppercase', margin:'0 0 10px' }}>
                            Items
                          </p>
                          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                            {order.items.map((item, i) => (
                              <div key={i} style={{ display:'flex', justifyContent:'space-between',
                                alignItems:'center', padding:'8px 10px', borderRadius:8,
                                background:'rgba(255,255,255,0.55)', border:`1px solid ${UI.border}` }}>
                                <div>
                                  <p style={{ fontSize:13, fontWeight:500, color: UI.text, margin:'0 0 2px' }}>
                                    {item.product_name}
                                  </p>
                                  <p style={{ fontSize:11, color: UI.muted, margin:0 }}>Qty: {item.quantity}</p>
                                </div>
                                <span style={{ fontSize:13, fontWeight:600, color: UI.text }}>
                                  ${(item.price * item.quantity).toFixed(2)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
