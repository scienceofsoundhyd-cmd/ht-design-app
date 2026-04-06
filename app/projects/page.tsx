'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Project = {
  id: string
  name: string
  updated_at: string
  thumbnail_url?: string | null
  room_type?: string | null
}

export default function ProjectsPage() {
  const router = useRouter()
  const [loading, setLoading]   = useState(true)
  const [projects, setProjects] = useState<Project[]>([])
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.replace('/'); return }
      supabase
        .from('user_projects')
        .select('id, name, updated_at, thumbnail_url, room_type')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .then(({ data }) => {
          if (data) setProjects(data)
          setLoading(false)
        })
    })
  }, [router])

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this project? This cannot be undone.')) return
    setDeleting(id)
    await supabase.from('user_projects').delete().eq('id', id)
    setProjects(prev => prev.filter(p => p.id !== id))
    setDeleting(null)
  }

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    const now = new Date()
    const diff = Math.floor((now.getTime() - d.getTime()) / 1000)
    if (diff < 60)  return 'Just now'
    if (diff < 3600) return `${Math.floor(diff/60)}m ago`
    if (diff < 86400) return `${Math.floor(diff/3600)}h ago`
    if (diff < 604800) return `${Math.floor(diff/86400)}d ago`
    return d.toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })
  }

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
        .proj-card { transition: box-shadow 0.2s, transform 0.2s; }
        .proj-card:hover { box-shadow: 0 6px 24px rgba(29,34,40,0.13) !important; transform: translateY(-1px); }
        .proj-del-btn { opacity: 0; transition: opacity 0.15s; }
        .proj-card:hover .proj-del-btn { opacity: 1; }
      `}</style>

      <div style={{ maxWidth:960, margin:'0 auto', padding:'0 24px 60px' }}>

        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
          marginBottom:28 }}>
          <div>
            <h1 style={{ fontSize:22, fontWeight:700, color: UI.text, margin:'0 0 4px' }}>
              My Projects
            </h1>
            <p style={{ fontSize:13, color: UI.muted, margin:0 }}>
              {projects.length === 0
                ? 'No saved projects yet'
                : `${projects.length} saved project${projects.length === 1 ? '' : 's'}`}
            </p>
          </div>
          <Link href="/engine"
            style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 20px',
              borderRadius:9, fontSize:13, fontWeight:600, color:'#fff',
              background:'linear-gradient(135deg,#2563EB,#1d4ed8)',
              textDecoration:'none', boxShadow:'0 3px 10px rgba(37,99,235,0.28)',
              transition:'opacity 0.15s' }}
            onMouseEnter={e => (e.currentTarget.style.opacity='0.88')}
            onMouseLeave={e => (e.currentTarget.style.opacity='1')}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            New Design
          </Link>
        </div>

        {/* Empty state */}
        {projects.length === 0 && (
          <div style={{ background: UI.card, border:`1px solid ${UI.border}`, borderRadius:16,
            padding:'60px 24px', textAlign:'center', boxShadow:'0 2px 12px rgba(29,34,40,0.07)' }}>
            <div style={{ width:56, height:56, borderRadius:14,
              background:'rgba(37,99,235,0.08)', display:'flex', alignItems:'center',
              justifyContent:'center', margin:'0 auto 16px' }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none"
                stroke="rgba(37,99,235,0.7)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" rx="1"/>
                <rect x="14" y="3" width="7" height="7" rx="1"/>
                <rect x="3" y="14" width="7" height="7" rx="1"/>
                <rect x="14" y="14" width="7" height="7" rx="1"/>
              </svg>
            </div>
            <p style={{ fontSize:15, fontWeight:600, color: UI.text, margin:'0 0 6px' }}>
              No designs saved yet
            </p>
            <p style={{ fontSize:13, color: UI.muted, margin:'0 0 24px', maxWidth:320, marginLeft:'auto', marginRight:'auto' }}>
              Open the design tool and save a room layout to see it here.
            </p>
            <Link href="/engine"
              style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'9px 22px',
                borderRadius:9, fontSize:13, fontWeight:600, color:'#fff',
                background:'linear-gradient(135deg,#2563EB,#1d4ed8)',
                textDecoration:'none', boxShadow:'0 3px 10px rgba(37,99,235,0.28)' }}>
              Open Design Tool →
            </Link>
          </div>
        )}

        {/* Project grid */}
        {projects.length > 0 && (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(260px, 1fr))', gap:16 }}>
            {projects.map(project => (
              <div key={project.id} className="proj-card"
                style={{ background: UI.card, border:`1px solid ${UI.border}`, borderRadius:14,
                  overflow:'hidden', boxShadow:'0 2px 12px rgba(29,34,40,0.07)', position:'relative' }}>

                {/* Thumbnail / placeholder */}
                <div style={{ height:140, background:'linear-gradient(135deg,#dde1e8,#c8cdd6)',
                  display:'flex', alignItems:'center', justifyContent:'center', position:'relative' }}>
                  {project.thumbnail_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={project.thumbnail_url} alt={project.name}
                      style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
                  ) : (
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none"
                      stroke="rgba(29,34,40,0.28)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="3" width="20" height="14" rx="2"/>
                      <line x1="8" y1="21" x2="16" y2="21"/>
                      <line x1="12" y1="17" x2="12" y2="21"/>
                    </svg>
                  )}

                  {/* Delete button — appears on hover */}
                  <button className="proj-del-btn"
                    onClick={() => handleDelete(project.id)}
                    disabled={deleting === project.id}
                    style={{ position:'absolute', top:8, right:8, width:28, height:28,
                      borderRadius:'50%', border:'none', cursor:'pointer',
                      background:'rgba(220,38,38,0.88)', color:'#fff',
                      display:'flex', alignItems:'center', justifyContent:'center',
                      boxShadow:'0 2px 6px rgba(0,0,0,0.2)' }}>
                    {deleting === project.id ? (
                      <div style={{ width:12, height:12, borderRadius:'50%',
                        border:'2px solid rgba(255,255,255,0.3)', borderTop:'2px solid #fff',
                        animation:'spin 0.6s linear infinite' }}/>
                    ) : (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
                        <path d="M10 11v6M14 11v6"/>
                      </svg>
                    )}
                  </button>
                </div>

                {/* Info */}
                <div style={{ padding:'14px 16px' }}>
                  <p style={{ fontSize:14, fontWeight:600, color: UI.text, margin:'0 0 4px',
                    whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                    {project.name}
                  </p>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                    {project.room_type && (
                      <span style={{ fontSize:11, color: UI.muted,
                        background:'rgba(29,34,40,0.06)', borderRadius:4,
                        padding:'2px 7px', fontWeight:500 }}>
                        {project.room_type}
                      </span>
                    )}
                    <span style={{ fontSize:11, color: UI.muted, marginLeft:'auto' }}>
                      {formatDate(project.updated_at)}
                    </span>
                  </div>
                </div>

                {/* Open button */}
                <Link href={`/engine?project=${project.id}`}
                  style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6,
                    margin:'0 16px 14px', padding:'8px 0', borderRadius:8, fontSize:12,
                    fontWeight:500, color: UI.accent, textDecoration:'none',
                    background:'rgba(37,99,235,0.07)', border:'1px solid rgba(37,99,235,0.15)',
                    transition:'background 0.15s' }}
                  onMouseEnter={e => (e.currentTarget.style.background='rgba(37,99,235,0.12)')}
                  onMouseLeave={e => (e.currentTarget.style.background='rgba(37,99,235,0.07)')}>
                  Open in Design Tool
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
