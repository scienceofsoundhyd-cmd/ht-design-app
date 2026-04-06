'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'

type Tab        = 'signin' | 'signup' | 'forgot'
type SignupStep = 'details' | 'verify'

const Logo = () => (
  <div className="mb-10 text-center flex flex-col items-center">
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=GFS+Didot&family=Montserrat:wght@200;300&display=swap');
      @keyframes sos-s-in  { 0%{opacity:0;transform:translateY(-18px) scale(0.9)} 100%{opacity:1;transform:translateY(0) scale(1)} }
      @keyframes sos-s-glow{ 0%,100%{filter:drop-shadow(0 0 2px rgba(79,124,255,0.08))} 50%{filter:drop-shadow(0 0 12px rgba(79,124,255,0.18))} }
      @keyframes sos-ln-in { 0%{stroke-dashoffset:145;opacity:0} 100%{stroke-dashoffset:0;opacity:1} }
      @keyframes sos-ln-p  { 0%,100%{opacity:0.5} 50%{opacity:1} }
      @keyframes sos-wm-in { 0%{opacity:0;letter-spacing:1px} 100%{opacity:1;letter-spacing:6px} }
      @keyframes card-in   { 0%{opacity:0;transform:translateY(24px)} 100%{opacity:1;transform:translateY(0)} }
      @keyframes float-1   { 0%,100%{transform:translateY(0) translateX(0);opacity:0.3} 50%{transform:translateY(-30px) translateX(10px);opacity:0.6} }
      @keyframes float-2   { 0%,100%{transform:translateY(0) translateX(0);opacity:0.2} 50%{transform:translateY(-20px) translateX(-15px);opacity:0.5} }
      @keyframes float-3   { 0%,100%{transform:translateY(0) translateX(0);opacity:0.15} 50%{transform:translateY(-40px) translateX(5px);opacity:0.4} }
      .sos-s-l  { animation: sos-s-in 0.9s 0.0s cubic-bezier(.22,1,.36,1) both, sos-s-glow 3s 1.2s ease-in-out infinite; }
      .sos-s-r  { animation: sos-s-in 0.9s 0.12s cubic-bezier(.22,1,.36,1) both, sos-s-glow 3s 1.6s ease-in-out infinite; }
      .sos-ln   { stroke-dasharray:145; animation: sos-ln-in 0.7s 0.35s ease-out both, sos-ln-p 3s 1.5s ease-in-out infinite; }
      .sos-wm   { animation: sos-wm-in 1.1s 0.6s cubic-bezier(.22,1,.36,1) both; }
      .auth-card{ animation: card-in 0.7s 0.7s cubic-bezier(.22,1,.36,1) both; }
      .auth-input:focus { border-color:rgba(96,165,250,0.8)!important; box-shadow:0 0 0 3px rgba(59,130,246,0.15),0 0 12px rgba(96,165,250,0.1); outline:none; }
      .auth-input { transition:border-color 0.2s,box-shadow 0.2s; }
      .auth-btn { transition:transform 0.15s,box-shadow 0.15s; }
      .auth-btn:hover:not(:disabled) { transform:translateY(-1px); box-shadow:0 6px 20px rgba(37,99,235,0.4); }
      .auth-btn:active:not(:disabled) { transform:translateY(0); }
      .auth-tab { transition:color 0.2s,border-color 0.2s; }
      .p1{animation:float-1 6s 0s ease-in-out infinite}
      .p2{animation:float-2 8s 1s ease-in-out infinite}
      .p3{animation:float-3 7s 2s ease-in-out infinite}
      .p4{animation:float-1 9s 3s ease-in-out infinite}
      .p5{animation:float-2 5s 0.5s ease-in-out infinite}
      .eye-btn { background:none; border:none; cursor:pointer; padding:0; display:flex; align-items:center; }
    `}</style>
    <svg width="260" height="130" viewBox="0 0 260 130" xmlns="http://www.w3.org/2000/svg">
      <line className="sos-ln" x1="130" y1="0" x2="130" y2="130" stroke="rgba(108,124,148,0.65)" strokeWidth="1"/>
      <text className="sos-s-l" x="75" y="96" textAnchor="middle" fontFamily="'GFS Didot','Didot','Bodoni MT',Georgia,serif" fontSize="100" fontWeight="400" fill="rgba(29,34,40,0.58)">S</text>
      <text className="sos-s-r" x="185" y="96" textAnchor="middle" fontFamily="'GFS Didot','Didot','Bodoni MT',Georgia,serif" fontSize="100" fontWeight="400" fill="rgba(29,34,40,0.58)">S</text>
      <text className="sos-wm" x="130" y="60" textAnchor="middle" fontFamily="'Montserrat','Helvetica Neue',Arial,sans-serif" fontSize="9.5" fontWeight="400" fill="#1d2228" letterSpacing="7" opacity="1">SCIENCE OF SOUND</text>
    </svg>
  </div>
)

const UI = {
  text: "#1d2228",
  muted: "#647083",
  soft: "#8b96a5",
  accent: "#4f7cff",
  accentSoft: "#7aa7ff",
}

const inputStyle = { background:'rgba(255,255,255,0.34)', border:'1px solid rgba(29,34,40,0.12)', color:UI.text }
const labelStyle = { color:UI.muted }
const errorStyle = { background:'rgba(239,68,68,0.10)', border:'1px solid rgba(239,68,68,0.25)', color:'#fca5a5' }
const successStyle={ background:'rgba(34,197,94,0.10)', border:'1px solid rgba(34,197,94,0.25)', color:'#166534' }

const EyeIcon = ({ show }: { show: boolean }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(100,112,131,0.76)" strokeWidth="2" strokeLinecap="round">
    {show
      ? <><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></>
      : <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>
    }
  </svg>
)

export default function AuthPage() {
  const [tab,          setTab]          = useState<Tab>('signin')
  const [siEmail,      setSiEmail]      = useState('')
  const [siPassword,   setSiPassword]   = useState('')
  const [siShowPw,     setSiShowPw]     = useState(false)
  const [siRemember,   setSiRemember]   = useState(false)
  const [siLoading,    setSiLoading]    = useState(false)
  const [siError,      setSiError]      = useState('')
  const [suName,       setSuName]       = useState('')
  const [suEmail,      setSuEmail]      = useState('')
  const [suPassword,   setSuPassword]   = useState('')
  const [suShowPw,     setSuShowPw]     = useState(false)
  const [suTerms,      setSuTerms]      = useState(false)
  const [showInvite,   setShowInvite]   = useState(false)
  const [inviteCode,   setInviteCode]   = useState('')
  const [suLoading,    setSuLoading]    = useState(false)
  const [suError,      setSuError]      = useState('')
  const [signupStep,   setSignupStep]   = useState<SignupStep>('details')
  const [otp,          setOtp]          = useState('')
  const [otpLoading,   setOtpLoading]   = useState(false)
  const [otpError,     setOtpError]     = useState('')
  const [otpSuccess,   setOtpSuccess]   = useState('')
  const [resending,    setResending]    = useState(false)
  const [fgEmail,      setFgEmail]      = useState('')
  const [fgLoading,    setFgLoading]    = useState(false)
  const [fgMsg,        setFgMsg]        = useState('')
  const [fgError,      setFgError]      = useState('')

  const switchTab = (t: Tab) => { setTab(t); setSiError(''); setSuError(''); setFgMsg(''); setFgError('') }

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault(); setSiLoading(true); setSiError('')
    const { error } = await supabase.auth.signInWithPassword({ email: siEmail, password: siPassword })
    if (error) { setSiError('Invalid email or password.'); setSiLoading(false); return }
    window.location.href = '/'
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault(); setSuLoading(true); setSuError('')
    if (!suTerms) { setSuError('Please accept the terms to continue.'); setSuLoading(false); return }
    if (inviteCode.trim()) {
      const { data: tok } = await supabase.from('invite_tokens').select('id,expires_at').eq('token', inviteCode.trim()).single()
      if (!tok) { setSuError('Invalid invite code.'); setSuLoading(false); return }
      if (new Date(tok.expires_at) < new Date()) { setSuError('Invite code expired.'); setSuLoading(false); return }
    }
    const { error } = await supabase.auth.signUp({
      email: suEmail, password: suPassword,
      options: { data: { full_name: suName.trim() } }
    })
    if (error) { setSuError(error.message); setSuLoading(false); return }
    setSuLoading(false); setSignupStep('verify')
  }

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault(); setOtpLoading(true); setOtpError(''); setOtpSuccess('')
    const { data, error } = await supabase.auth.verifyOtp({ email: suEmail, token: otp.trim(), type: 'signup' })
    if (error) { setOtpError('Incorrect code. Check your email and try again.'); setOtpLoading(false); return }
    if (inviteCode.trim() && data.user)
      await supabase.from('user_profiles').update({ plan: 'pro' }).eq('id', data.user.id)
    window.location.href = '/'
  }

  const handleResendOtp = async () => {
    setResending(true); setOtpError(''); setOtpSuccess('')
    const { error } = await supabase.auth.resend({ type: 'signup', email: suEmail })
    setResending(false)
    if (error) setOtpError('Failed to resend. Try again shortly.')
    else setOtpSuccess('New code sent — check your inbox.')
  }

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault(); setFgLoading(true); setFgMsg(''); setFgError('')
    const { error } = await supabase.auth.resetPasswordForEmail(fgEmail, {
      redirectTo: `${window.location.origin}/reset-password`
    })
    setFgLoading(false)
    if (error) setFgError('Could not send reset email. Please try again.')
    else setFgMsg('Reset link sent — check your inbox.')
  }

  const pwStrength = (pw: string) => {
    if (!pw) return null
    if (pw.length < 6) return { label: 'Too short', color: '#ef4444', w: '25%' }
    if (pw.length < 8)  return { label: 'Weak', color: '#f97316', w: '45%' }
    if (!/[A-Z]/.test(pw) || !/[0-9]/.test(pw)) return { label: 'Fair', color: '#eab308', w: '65%' }
    return { label: 'Strong', color: '#22c55e', w: '100%' }
  }
  const strength = pwStrength(suPassword)

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 relative overflow-hidden"
      style={{ background: 'linear-gradient(145deg, #eef0f3 0%, #d7dade 48%, #e5e7eb 100%)' }}>

      {/* Ambient particles */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="p1 absolute w-1 h-1 rounded-full" style={{ background:UI.accent, top:'15%', left:'12%', boxShadow:'0 0 8px 2px rgba(79,124,255,0.3)' }}/>
        <div className="p2 absolute w-1.5 h-1.5 rounded-full" style={{ background:UI.accentSoft, top:'70%', left:'8%', boxShadow:'0 0 10px 3px rgba(122,167,255,0.22)' }}/>
        <div className="p3 absolute w-1 h-1 rounded-full" style={{ background:'#9acfd2', top:'30%', right:'10%', boxShadow:'0 0 8px 2px rgba(154,207,210,0.22)' }}/>
        <div className="p4 absolute w-2 h-2 rounded-full" style={{ background:'#5d87ff', top:'80%', right:'15%', boxShadow:'0 0 12px 4px rgba(93,135,255,0.22)' }}/>
        <div className="p5 absolute w-1 h-1 rounded-full" style={{ background:UI.accentSoft, top:'50%', left:'20%', boxShadow:'0 0 8px 2px rgba(122,167,255,0.18)' }}/>
        <div className="absolute rounded-full" style={{ width:400, height:400, background:'radial-gradient(circle, rgba(79,124,255,0.08) 0%, transparent 70%)', top:'-100px', left:'-100px' }}/>
        <div className="absolute rounded-full" style={{ width:300, height:300, background:'radial-gradient(circle, rgba(107,184,191,0.06) 0%, transparent 70%)', bottom:'0', right:'-50px' }}/>
      </div>

      <Logo />

      <div className="auth-card w-full max-w-sm rounded-2xl overflow-hidden relative"
        style={{ background:'rgba(255,255,255,0.34)', border:'1px solid rgba(255,255,255,0.42)', backdropFilter:'blur(18px)', boxShadow:'0 24px 64px rgba(70,78,88,0.12),0 0 0 0.5px rgba(255,255,255,0.3) inset' }}>

        <div className="absolute top-0 left-0 right-0 h-px" style={{ background:'linear-gradient(90deg,transparent,rgba(79,124,255,0.28),transparent)' }}/>

        {/* Tabs */}
        {signupStep === 'details' && tab !== 'forgot' && (
          <div className="flex border-b" style={{ borderColor:'rgba(29,34,40,0.08)' }}>
            {(['signin','signup'] as Tab[]).map(t => (
              <button key={t} onClick={() => switchTab(t)}
                className="auth-tab flex-1 py-3.5 text-sm font-medium"
                style={{ color:tab===t?UI.text:UI.soft, borderBottom:tab===t?`2px solid ${UI.accent}`:'2px solid transparent', background:'transparent' }}>
                {t === 'signin' ? 'Sign In' : 'Sign Up'}
              </button>
            ))}
          </div>
        )}

        {/* Forgot password header */}
        {tab === 'forgot' && (
          <div className="flex items-center gap-2 px-8 pt-6 pb-2">
            <button onClick={() => switchTab('signin')} className="text-xs" style={{ color:UI.soft }}>← Back</button>
            <span className="text-sm font-medium" style={{ color:UI.text }}>Reset password</span>
          </div>
        )}

        <div className="px-8 py-7">

          {/* ── SIGN IN ── */}
          {tab === 'signin' && (
            <form onSubmit={handleSignIn} className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Email address</label>
                <input type="email" required value={siEmail} onChange={e => setSiEmail(e.target.value)}
                  placeholder="you@example.com" className="auth-input w-full px-3.5 py-2.5 rounded-lg text-sm" style={inputStyle}/>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Password</label>
                <div className="relative">
                  <input type={siShowPw ? 'text' : 'password'} required value={siPassword} onChange={e => setSiPassword(e.target.value)}
                    placeholder="••••••••" className="auth-input w-full px-3.5 py-2.5 pr-10 rounded-lg text-sm" style={inputStyle}/>
                  <button type="button" className="eye-btn absolute right-3 top-1/2 -translate-y-1/2" onClick={() => setSiShowPw(v => !v)}>
                    <EyeIcon show={siShowPw}/>
                  </button>
                </div>
              </div>

              {/* Remember me + Forgot password */}
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={siRemember} onChange={e => setSiRemember(e.target.checked)}
                    className="w-3.5 h-3.5 rounded accent-blue-500"/>
                  <span className="text-xs" style={{ color:UI.muted }}>Remember me</span>
                </label>
                <button type="button" onClick={() => switchTab('forgot')}
                  className="text-xs font-medium transition-colors" style={{ color:UI.accent }}>
                  Forgot password?
                </button>
              </div>

              {siError && <div className="rounded-lg px-3.5 py-2.5 text-xs" style={errorStyle}>{siError}</div>}
              <button type="submit" disabled={siLoading} className="auth-btn w-full py-2.5 rounded-lg text-sm font-semibold"
                style={{ background:siLoading?'#1d3a6e':'linear-gradient(135deg,#2563EB,#1d4ed8)', color:siLoading?'#6b8dc4':'#fff', cursor:siLoading?'not-allowed':'pointer' }}>
                {siLoading ? 'Signing in…' : 'Sign in'}
              </button>
            </form>
          )}

          {/* ── SIGN UP ── */}
          {tab === 'signup' && signupStep === 'details' && (
            <form onSubmit={handleSignUp} className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Full name</label>
                <input type="text" required value={suName} onChange={e => setSuName(e.target.value)}
                  placeholder="Your name" className="auth-input w-full px-3.5 py-2.5 rounded-lg text-sm" style={inputStyle}/>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Email address</label>
                <input type="email" required value={suEmail} onChange={e => setSuEmail(e.target.value)}
                  placeholder="you@example.com" className="auth-input w-full px-3.5 py-2.5 rounded-lg text-sm" style={inputStyle}/>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Password</label>
                <div className="relative">
                  <input type={suShowPw ? 'text' : 'password'} required minLength={8} value={suPassword} onChange={e => setSuPassword(e.target.value)}
                    placeholder="Min. 8 characters" className="auth-input w-full px-3.5 py-2.5 pr-10 rounded-lg text-sm" style={inputStyle}/>
                  <button type="button" className="eye-btn absolute right-3 top-1/2 -translate-y-1/2" onClick={() => setSuShowPw(v => !v)}>
                    <EyeIcon show={suShowPw}/>
                  </button>
                </div>
                {strength && (
                  <div className="mt-1.5">
                    <div className="h-0.5 rounded-full w-full" style={{ background:'rgba(29,34,40,0.08)' }}>
                      <div className="h-0.5 rounded-full transition-all duration-300" style={{ width:strength.w, background:strength.color }}/>
                    </div>
                    <span className="text-[10px]" style={{ color:strength.color }}>{strength.label}</span>
                  </div>
                )}
              </div>

              {/* Invite code */}
              <div>
                <button type="button" onClick={() => setShowInvite(v => !v)}
                  className="text-xs font-medium transition-colors" style={{ color:showInvite?UI.accent:UI.soft }}>
                  {showInvite ? '− Hide invite code' : '+ Have an invite code?'}
                </button>
                {showInvite && (
                  <div className="mt-2">
                    <input type="text" value={inviteCode} onChange={e => setInviteCode(e.target.value)}
                      placeholder="Enter your invite code"
                      className="auth-input w-full px-3.5 py-2.5 rounded-lg text-sm font-mono" style={inputStyle}/>
                    <p className="text-[10px] mt-1" style={{ color:UI.soft }}>Invite codes unlock Pro access instantly</p>
                  </div>
                )}
              </div>

              {/* Terms */}
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input type="checkbox" checked={suTerms} onChange={e => setSuTerms(e.target.checked)}
                  className="w-3.5 h-3.5 mt-0.5 rounded accent-blue-500 shrink-0"/>
                <span className="text-xs leading-relaxed" style={{ color:UI.muted }}>
                  I agree to the{' '}
                  <span className="font-medium" style={{ color:UI.accent }}>Terms of Service</span>{' '}
                  and{' '}
                  <span className="font-medium" style={{ color:UI.accent }}>Privacy Policy</span>
                </span>
              </label>

              {suError && <div className="rounded-lg px-3.5 py-2.5 text-xs" style={errorStyle}>{suError}</div>}
              <button type="submit" disabled={suLoading} className="auth-btn w-full py-2.5 rounded-lg text-sm font-semibold"
                style={{ background:suLoading?'#1d3a6e':'linear-gradient(135deg,#2563EB,#1d4ed8)', color:suLoading?'#6b8dc4':'#fff', cursor:suLoading?'not-allowed':'pointer' }}>
                {suLoading ? 'Creating account…' : 'Create account'}
              </button>
              <p className="text-[10px] text-center" style={{ color:UI.soft }}>A verification code will be sent to your email</p>
            </form>
          )}

          {/* ── OTP VERIFY ── */}
          {tab === 'signup' && signupStep === 'verify' && (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="text-center mb-2">
                <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3"
                  style={{ background:'rgba(37,99,235,0.15)', border:'1px solid rgba(96,165,250,0.3)', boxShadow:'0 0 16px rgba(59,130,246,0.2)' }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                    <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" stroke={UI.accent} strokeWidth="1.8" strokeLinecap="round"/>
                  </svg>
                </div>
                <h3 className="text-sm font-semibold" style={{ color:UI.text }}>Check your email</h3>
                <p className="text-xs mt-1" style={{ color:UI.muted }}>
                  We sent a 6-digit code to<br/>
                  <span style={{ color:UI.accent }}>{suEmail}</span>
                </p>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Verification code</label>
                <input type="text" inputMode="numeric" maxLength={6} required
                  value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g,'').slice(0,6))}
                  placeholder="000000"
                  className="auth-input w-full px-3.5 py-3 rounded-lg text-xl text-center font-mono tracking-[0.5em]"
                  style={inputStyle}/>
              </div>
              {otpError   && <div className="rounded-lg px-3.5 py-2.5 text-xs" style={errorStyle}>{otpError}</div>}
              {otpSuccess && <div className="rounded-lg px-3.5 py-2.5 text-xs" style={successStyle}>{otpSuccess}</div>}
              <button type="submit" disabled={otpLoading || otp.length < 6} className="auth-btn w-full py-2.5 rounded-lg text-sm font-semibold"
                style={{ background:(otpLoading||otp.length<6)?'#1d3a6e':'linear-gradient(135deg,#2563EB,#1d4ed8)', color:(otpLoading||otp.length<6)?'#6b8dc4':'#fff', cursor:(otpLoading||otp.length<6)?'not-allowed':'pointer' }}>
                {otpLoading ? 'Verifying…' : 'Verify & continue'}
              </button>
              <div className="flex items-center justify-between pt-1">
                <button type="button" onClick={() => { setSignupStep('details'); setOtp(''); setOtpError('') }}
                  className="text-xs" style={{ color:UI.soft }}>← Go back</button>
                <button type="button" onClick={handleResendOtp} disabled={resending}
                  className="text-xs font-medium" style={{ color:resending?UI.soft:UI.accent }}>
                  {resending ? 'Sending…' : 'Resend code'}
                </button>
              </div>
            </form>
          )}

          {/* ── FORGOT PASSWORD ── */}
          {tab === 'forgot' && (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <p className="text-xs" style={{ color:UI.muted }}>
                Enter your email and we&apos;ll send you a link to reset your password.
              </p>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={labelStyle}>Email address</label>
                <input type="email" required value={fgEmail} onChange={e => setFgEmail(e.target.value)}
                  placeholder="you@example.com" className="auth-input w-full px-3.5 py-2.5 rounded-lg text-sm" style={inputStyle}/>
              </div>
              {fgError && <div className="rounded-lg px-3.5 py-2.5 text-xs" style={errorStyle}>{fgError}</div>}
              {fgMsg   && <div className="rounded-lg px-3.5 py-2.5 text-xs" style={successStyle}>{fgMsg}</div>}
              <button type="submit" disabled={fgLoading} className="auth-btn w-full py-2.5 rounded-lg text-sm font-semibold"
                style={{ background:fgLoading?'#1d3a6e':'linear-gradient(135deg,#2563EB,#1d4ed8)', color:fgLoading?'#6b8dc4':'#fff', cursor:fgLoading?'not-allowed':'pointer' }}>
                {fgLoading ? 'Sending…' : 'Send reset link'}
              </button>
            </form>
          )}

        </div>
      </div>

      <p className="mt-6 text-xs" style={{ color:UI.soft }}>
        Science of Sound · Acoustic Design Platform
      </p>
    </div>
  )
}
