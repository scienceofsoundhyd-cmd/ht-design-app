'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Section = 'profile' | 'password' | 'danger'

export default function AccountPage() {
  const router = useRouter()
  const [loading,    setLoading]    = useState(true)
  const [email,      setEmail]      = useState('')
  const [fullName,   setFullName]   = useState('')
  const [nameVal,    setNameVal]    = useState('')
  const [section,    setSection]    = useState<Section>('profile')

  // password
  const [newPw,      setNewPw]      = useState('')
  const [confirmPw,  setConfirmPw]  = useState('')
  const [showPw,     setShowPw]     = useState(false)

  // feedback
  const [saving,          setSaving]          = useState(false)
  const [msg,             setMsg]             = useState<{text:string; ok:boolean} | null>(null)
  const [deletionDate,    setDeletionDate]    = useState<Date | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.replace('/'); return }
      setEmail(user.email || '')
      const name = user.user_metadata?.full_name || user.email?.split('@')[0] || ''
      setFullName(name); setNameVal(name)
      const scheduled = user.user_metadata?.deletion_scheduled_at
      if (scheduled) setDeletionDate(new Date(scheduled))
      setLoading(false)
    })
  }, [router])

  const flash = (text: string, ok: boolean) => {
    setMsg({ text, ok })
    setTimeout(() => setMsg(null), 4000)
  }

  const saveName = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true)
    const { error } = await supabase.auth.updateUser({ data: { full_name: nameVal.trim() } })
    setSaving(false)
    if (error) flash(error.message, false)
    else { setFullName(nameVal.trim()); flash('Name updated.', true) }
  }

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPw !== confirmPw) { flash('Passwords do not match.', false); return }
    if (newPw.length < 8) { flash('Password must be at least 8 characters.', false); return }
    setSaving(true)
    const { error } = await supabase.auth.updateUser({ password: newPw })
    setSaving(false)
    if (error) flash(error.message, false)
    else { setNewPw(''); setConfirmPw(''); flash('Password updated.', true) }
  }

  const scheduleDelete = async () => {
    if (!confirm('Your account will be scheduled for deletion in 45 days. You can cancel this any time before then. Continue?')) return
    const date = new Date(Date.now() + 45 * 24 * 60 * 60 * 1000)
    const { error } = await supabase.auth.updateUser({ data: { deletion_scheduled_at: date.toISOString() } })
    if (error) { flash(error.message, false); return }
    setDeletionDate(date)
    flash('Account scheduled for deletion in 45 days.', true)
  }

  const cancelDelete = async () => {
    const { error } = await supabase.auth.updateUser({ data: { deletion_scheduled_at: null } })
    if (error) { flash(error.message, false); return }
    setDeletionDate(null)
    flash('Deletion cancelled. Your account is safe.', true)
  }

  const initials = fullName.slice(0, 2).toUpperCase() || '?'

  const UI = {
    bg:      'linear-gradient(145deg, #eef0f3 0%, #d7dade 48%, #e5e7eb 100%)',
    card:    'rgba(255,255,255,0.62)',
    border:  'rgba(29,34,40,0.10)',
    text:    '#1d2228',
    muted:   'rgba(29,34,40,0.52)',
    accent:  '#2563EB',
  }

  const navItems: { id: Section; label: string }[] = [
    { id: 'profile',  label: 'Profile'        },
    { id: 'password', label: 'Password'       },
    { id: 'danger',   label: 'Delete Account' },
  ]

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
        .acc-input { transition: border-color 0.2s, box-shadow 0.2s; }
        .acc-input:focus { border-color: rgba(37,99,235,0.6) !important;
          box-shadow: 0 0 0 3px rgba(37,99,235,0.12); outline: none; }
        .acc-nav-item { transition: background 0.15s, color 0.15s; }
      `}</style>

      <div style={{ maxWidth:860, margin:'0 auto', padding:'0 24px 60px',
        display:'grid', gridTemplateColumns:'200px 1fr', gap:28 }}>

        {/* ── Sidebar ── */}
        <aside>
          {/* Avatar card */}
          <div style={{ background: UI.card, border:`1px solid ${UI.border}`, borderRadius:14,
            padding:'24px 16px', textAlign:'center', marginBottom:14,
            boxShadow:'0 2px 12px rgba(29,34,40,0.07)' }}>
            <div style={{ width:64, height:64, borderRadius:'50%', margin:'0 auto 12px',
              background:'linear-gradient(135deg,#2563EB,#1d4ed8)',
              display:'flex', alignItems:'center', justifyContent:'center',
              boxShadow:'0 4px 16px rgba(37,99,235,0.28)' }}>
              <span style={{ fontSize:22, fontWeight:700, color:'#fff' }}>{initials}</span>
            </div>
            <p style={{ fontSize:13, fontWeight:600, color: UI.text, margin:'0 0 3px',
              wordBreak:'break-word' }}>{fullName}</p>
            <p style={{ fontSize:11, color: UI.muted, margin:0, wordBreak:'break-word' }}>{email}</p>
          </div>

          {/* Nav */}
          <nav style={{ background: UI.card, border:`1px solid ${UI.border}`, borderRadius:14,
            overflow:'hidden', boxShadow:'0 2px 12px rgba(29,34,40,0.07)' }}>
            {navItems.map(({ id, label }, i) => (
              <button key={id} onClick={() => setSection(id)}
                className="acc-nav-item"
                style={{ width:'100%', textAlign:'left', padding:'11px 16px', fontSize:13,
                  fontWeight: section===id ? 600 : 400,
                  color: section===id ? UI.accent : UI.text,
                  background: section===id ? 'rgba(37,99,235,0.07)' : 'transparent',
                  border:'none',
                  borderBottom: i < navItems.length-1 ? `1px solid ${UI.border}` : 'none',
                  cursor:'pointer' }}>
                {label}
              </button>
            ))}
          </nav>
        </aside>

        {/* ── Main ── */}
        <main>
          {/* Flash message */}
          {msg && (
            <div style={{ marginBottom:16, padding:'10px 16px', borderRadius:10, fontSize:13,
              background: msg.ok ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.10)',
              border: `1px solid ${msg.ok ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.25)'}`,
              color: msg.ok ? '#166534' : '#dc2626' }}>
              {msg.text}
            </div>
          )}

          {/* ── Profile ── */}
          {section === 'profile' && (
            <div style={{ background: UI.card, border:`1px solid ${UI.border}`, borderRadius:14,
              padding:'28px 28px', boxShadow:'0 2px 12px rgba(29,34,40,0.07)' }}>
              <h2 style={{ fontSize:16, fontWeight:700, color: UI.text, margin:'0 0 4px' }}>Profile</h2>
              <p style={{ fontSize:13, color: UI.muted, margin:'0 0 24px' }}>Update your display name</p>

              <form onSubmit={saveName} style={{ display:'flex', flexDirection:'column', gap:16 }}>
                <div>
                  <label style={{ display:'block', fontSize:12, fontWeight:500,
                    color: UI.muted, marginBottom:6 }}>Full name</label>
                  <input className="acc-input" type="text" required value={nameVal}
                    onChange={e => setNameVal(e.target.value)}
                    style={{ width:'100%', padding:'9px 12px', borderRadius:8, fontSize:14,
                      border:`1px solid ${UI.border}`, background:'rgba(255,255,255,0.55)',
                      color: UI.text, boxSizing:'border-box' }}/>
                </div>
                <div>
                  <label style={{ display:'block', fontSize:12, fontWeight:500,
                    color: UI.muted, marginBottom:6 }}>Email</label>
                  <input type="email" value={email} disabled
                    style={{ width:'100%', padding:'9px 12px', borderRadius:8, fontSize:14,
                      border:`1px solid ${UI.border}`, background:'rgba(29,34,40,0.04)',
                      color: UI.muted, boxSizing:'border-box', cursor:'not-allowed' }}/>
                  <p style={{ fontSize:11, color: UI.muted, margin:'5px 0 0' }}>
                    Email cannot be changed
                  </p>
                </div>
                <div>
                  <button type="submit" disabled={saving}
                    style={{ padding:'9px 24px', borderRadius:8, fontSize:13, fontWeight:600,
                      color:'#fff', background: saving ? '#1d3a6e' : 'linear-gradient(135deg,#2563EB,#1d4ed8)',
                      border:'none', cursor: saving ? 'not-allowed' : 'pointer',
                      boxShadow:'0 3px 10px rgba(37,99,235,0.28)' }}>
                    {saving ? 'Saving…' : 'Save changes'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ── Password ── */}
          {section === 'password' && (
            <div style={{ background: UI.card, border:`1px solid ${UI.border}`, borderRadius:14,
              padding:'28px 28px', boxShadow:'0 2px 12px rgba(29,34,40,0.07)' }}>
              <h2 style={{ fontSize:16, fontWeight:700, color: UI.text, margin:'0 0 4px' }}>Password</h2>
              <p style={{ fontSize:13, color: UI.muted, margin:'0 0 24px' }}>Set a new password</p>

              <form onSubmit={savePassword} style={{ display:'flex', flexDirection:'column', gap:16 }}>
                {[
                  { label:'New password',     val:newPw,     set:setNewPw     },
                  { label:'Confirm password', val:confirmPw, set:setConfirmPw },
                ].map(({ label, val, set }) => (
                  <div key={label}>
                    <label style={{ display:'block', fontSize:12, fontWeight:500,
                      color: UI.muted, marginBottom:6 }}>{label}</label>
                    <div style={{ position:'relative' }}>
                      <input className="acc-input" type={showPw ? 'text' : 'password'}
                        required minLength={8} value={val} onChange={e => set(e.target.value)}
                        placeholder="Min. 8 characters"
                        style={{ width:'100%', padding:'9px 38px 9px 12px', borderRadius:8, fontSize:14,
                          border:`1px solid ${UI.border}`, background:'rgba(255,255,255,0.55)',
                          color: UI.text, boxSizing:'border-box' }}/>
                      <button type="button" onClick={() => setShowPw(v => !v)}
                        style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)',
                          background:'none', border:'none', cursor:'pointer',
                          color: UI.muted, fontSize:12 }}>
                        {showPw ? 'hide' : 'show'}
                      </button>
                    </div>
                  </div>
                ))}
                <div>
                  <button type="submit" disabled={saving}
                    style={{ padding:'9px 24px', borderRadius:8, fontSize:13, fontWeight:600,
                      color:'#fff', background: saving ? '#1d3a6e' : 'linear-gradient(135deg,#2563EB,#1d4ed8)',
                      border:'none', cursor: saving ? 'not-allowed' : 'pointer',
                      boxShadow:'0 3px 10px rgba(37,99,235,0.28)' }}>
                    {saving ? 'Updating…' : 'Update password'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ── Danger Zone ── */}
          {section === 'danger' && (
            <div style={{ background:'rgba(239,68,68,0.04)', border:'1px solid rgba(239,68,68,0.18)',
              borderRadius:14, padding:'28px 28px', boxShadow:'0 2px 12px rgba(29,34,40,0.07)' }}>
              <h2 style={{ fontSize:16, fontWeight:700, color:'#dc2626', margin:'0 0 4px' }}>Delete Account</h2>
              <p style={{ fontSize:13, color: UI.muted, margin:'0 0 24px' }}>
                Proceed with caution. This action can be cancelled within 45 days.
              </p>

              {deletionDate ? (
                /* ── Deletion scheduled state ── */
                <div style={{ padding:'18px', background:'rgba(239,68,68,0.07)', borderRadius:10,
                  border:'1px solid rgba(239,68,68,0.2)' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                      stroke="#dc2626" strokeWidth="2" strokeLinecap="round">
                      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/>
                      <line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                    <p style={{ fontSize:13, fontWeight:600, color:'#dc2626', margin:0 }}>
                      Account scheduled for deletion
                    </p>
                  </div>
                  <p style={{ fontSize:12, color: UI.muted, margin:'0 0 16px' }}>
                    Your account and all data will be permanently removed on{' '}
                    <strong style={{ color: UI.text }}>
                      {deletionDate.toLocaleDateString('en-US', { day:'numeric', month:'long', year:'numeric' })}
                    </strong>.
                    You can cancel this any time before that date.
                  </p>
                  <button onClick={cancelDelete}
                    style={{ padding:'8px 20px', borderRadius:8, fontSize:12, fontWeight:600,
                      color:'#dc2626', background:'rgba(255,255,255,0.8)',
                      border:'1px solid rgba(220,38,38,0.3)', cursor:'pointer' }}>
                    Cancel deletion
                  </button>
                </div>
              ) : (
                /* ── Request deletion state ── */
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
                  padding:'14px 16px', background:'rgba(255,255,255,0.6)', borderRadius:10,
                  border:'1px solid rgba(239,68,68,0.15)' }}>
                  <div>
                    <p style={{ fontSize:13, fontWeight:600, color: UI.text, margin:'0 0 2px' }}>
                      Request account deletion
                    </p>
                    <p style={{ fontSize:12, color: UI.muted, margin:0 }}>
                      Your account will be held for 45 days, then permanently removed
                    </p>
                  </div>
                  <button onClick={scheduleDelete}
                    style={{ padding:'8px 18px', borderRadius:8, fontSize:12, fontWeight:600,
                      color:'#fff', background:'#dc2626', border:'none', cursor:'pointer',
                      boxShadow:'0 2px 8px rgba(220,38,38,0.3)', flexShrink:0, marginLeft:16 }}>
                    Request deletion
                  </button>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
