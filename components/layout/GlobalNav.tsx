"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useAuth } from "@/components/layout/AuthProvider"
import { supabase } from "@/lib/supabase"

const NAV_LINKS = [
  { label: "Home",         href: "/"             },
  { label: "Learn",        href: "/learn"        },
  { label: "Resources",    href: "/resources"    },
  { label: "Products",     href: "/products"     },
  { label: "Our Projects", href: "/our-projects" },
  { label: "Community",    href: "/community"    },
]

const SEARCH_INDEX = [
  { label: "Home",        href: "/",            desc: "Start here"                 },
  { label: "Learn",       href: "/learn",       desc: "Learning paths & knowledge base" },
  { label: "Resources",   href: "/resources",   desc: "Tools, charts & references" },
  { label: "Products",     href: "/products",     desc: "Shop acoustic products"         },
  { label: "Our Projects", href: "/our-projects", desc: "Portfolio of completed theaters" },
  { label: "Community",   href: "/community",    desc: "Forum and discussions"          },
  { label: "Reflections", href: "/reflections", desc: "Immersive experience"        },
  { label: "Design Now",  href: "/engine",      desc: "Home theater design tool"   },
]

export default function GlobalNav() {
  const pathname  = usePathname()
  const [openForPath, setOpenForPath] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [searchOpen, setSearchOpen] = useState(false)
  const [userPanelOpen, setUserPanelOpen] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)
  const userPanelRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const open = openForPath === pathname
  const { user, signOut } = useAuth()

  // Inline auth form state
  const [authTab,      setAuthTab]      = useState<"in"|"up">("in")
  const [authEmail,    setAuthEmail]    = useState("")
  const [authPassword, setAuthPassword] = useState("")
  const [authName,     setAuthName]     = useState("")
  const [authLoading,  setAuthLoading]  = useState(false)
  const [authError,    setAuthError]    = useState("")
  const [authSuccess,  setAuthSuccess]  = useState("")

  const resetAuthForm = () => {
    setAuthEmail(""); setAuthPassword(""); setAuthName("")
    setAuthError(""); setAuthSuccess(""); setAuthLoading(false)
  }

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault(); setAuthLoading(true); setAuthError("")
    const { error } = await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword })
    if (error) { setAuthError("Invalid email or password."); setAuthLoading(false); return }
    setUserPanelOpen(false); resetAuthForm(); router.refresh()
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault(); setAuthLoading(true); setAuthError("")
    const { error } = await supabase.auth.signUp({
      email: authEmail, password: authPassword,
      options: { data: { full_name: authName.trim() } }
    })
    if (error) { setAuthError(error.message); setAuthLoading(false); return }
    setAuthLoading(false)
    setAuthSuccess("Check your email for a verification link.")
  }

  const searchResults = search.trim().length > 0
    ? SEARCH_INDEX.filter(item =>
        item.label.toLowerCase().includes(search.toLowerCase()) ||
        item.desc.toLowerCase().includes(search.toLowerCase())
      )
    : []

  /* close search dropdown and user panel on outside click */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false)
      }
      if (userPanelRef.current && !userPanelRef.current.contains(e.target as Node)) {
        setUserPanelOpen(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])
  const isIsolated = pathname === "/engine" || pathname.startsWith("/reflections")

  /* ── clean up any GSAP / reflections body styles on navigation ── */
  useEffect(() => {
    setOpenForPath(null)
    document.body.style.overflow = ""
    document.body.style.overflowX = ""
    document.documentElement.style.overflow = ""
    document.body.style.background = ""
    document.body.style.backgroundColor = ""
    document.documentElement.style.background = ""
    document.documentElement.style.backgroundColor = ""
    if (typeof window !== "undefined") { window.scrollTo(0, 0) }
  }, [pathname])

  if (isIsolated) return null

  /* ── styling tokens ── */
  const textCol    = "#1d2228"
  const mutedCol   = "rgba(29,34,40,0.56)"
  const dividerCol = "rgba(29,34,40,0.10)"
  const logoBg     = "transparent"
  const logoText   = "#1d2228"
  const loginBdr   = "rgba(29,34,40,0.16)"
  const toolShadow = "0 10px 24px rgba(40,40,40,0.12)"
  const toolBg     = "linear-gradient(135deg, rgba(24,24,24,0.96), rgba(58,58,58,0.92))"
  const activeNavBg   = "rgba(29,34,40,0.06)"
  const activeNavText = "#1d2228"
  const drawerOverlay = "rgba(220,224,229,0.46)"
  const drawerBg      = "rgba(248,249,251,0.84)"
  const drawerBorder  = "1px solid rgba(29,34,40,0.08)"
  const drawerText    = "#1d2228"
  const drawerActive  = "#1d2228"
  const drawerLoginBorder = "rgba(29,34,40,0.18)"
  const rowDivider    = "rgba(29,34,40,0.07)"

  return (
    <>
      <style>{`
        .gnav-text { transition: color 0.35s ease; }
        .gnav-search:focus { outline: none; }
        @keyframes nav-ping { 75%,100% { transform:scale(1.8); opacity:0; } }
      `}</style>

      <header className="gnav-root fixed top-0 left-0 right-0 z-50">

        {/* ── Desktop Two-Row Layout ── */}
        <div className="hidden md:flex px-6 items-center justify-between"
          style={{ height: 72, position:"relative", zIndex:1 }}>

          {/* Logo — vertically centered across both rows */}
          <Link href="/" className="flex items-center gap-3 select-none flex-shrink-0 h-full">
            <div className="gnav-text flex items-center justify-center rounded"
              style={{ width:64, height:"100%", background: logoBg, flexShrink:0,
                transition:"background 0.35s ease" }}>
              <span style={{ fontFamily:"Georgia, serif", fontSize:36, fontWeight:400,
                letterSpacing:"-0.01em", lineHeight:1,
                color: logoText, transition:"color 0.35s ease" }}>
                S<span style={{ color:"#2563EB" }}>|</span>S
              </span>
            </div>
            <span className="gnav-text" style={{ fontFamily:"system-ui,-apple-system,sans-serif",
              fontSize:19, fontWeight:600, letterSpacing:"0.04em", color: textCol }}>
              Science of Sound
            </span>
          </Link>

          {/* Right side — two stacked rows */}
          <div className="flex flex-col justify-center gap-1.5 h-full" style={{ paddingTop: 4, paddingBottom: 2 }}>

            {/* Row 1 right — Search + Reflections + Login */}
            <div className="flex items-center justify-end gap-3">

            {/* Search bar */}
            <div ref={searchRef} style={{ position:"relative" }}>
              <div className="flex items-center gap-2 px-3 rounded-lg border"
                style={{ height:30, borderColor: loginBdr,
                  background:"rgba(255,255,255,0.55)", backdropFilter:"blur(8px)" }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                  stroke={mutedCol} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="7"/>
                  <line x1="16.5" y1="16.5" x2="22" y2="22"/>
                </svg>
                <input
                  className="gnav-search bg-transparent text-xs"
                  style={{ width:180, color: textCol, caretColor: textCol }}
                  placeholder="Quick search…"
                  value={search}
                  onFocus={() => setSearchOpen(true)}
                  onChange={e => { setSearch(e.target.value); setSearchOpen(true) }}
                  onKeyDown={e => {
                    if (e.key === "Enter" && searchResults.length > 0) {
                      router.push(searchResults[0].href)
                      setSearch("")
                      setSearchOpen(false)
                    }
                    if (e.key === "Escape") {
                      setSearch("")
                      setSearchOpen(false)
                    }
                  }}
                />
                {search && (
                  <button onClick={() => { setSearch(""); setSearchOpen(false) }}
                    style={{ color: mutedCol, fontSize:14, lineHeight:1, background:"none", border:"none", cursor:"pointer" }}>
                    ×
                  </button>
                )}
              </div>

              {/* Dropdown results */}
              {searchOpen && searchResults.length > 0 && (
                <div style={{
                  position:"absolute", top:"calc(100% + 6px)", left:0, minWidth:240,
                  background:"rgba(248,249,251,0.97)", borderRadius:10,
                  border:"1px solid rgba(29,34,40,0.10)",
                  boxShadow:"0 8px 32px rgba(29,34,40,0.12)",
                  backdropFilter:"blur(16px)", overflow:"hidden", zIndex:9999,
                }}>
                  {searchResults.map(item => (
                    <Link key={item.href} href={item.href}
                      onClick={() => { setSearch(""); setSearchOpen(false) }}
                      style={{ display:"flex", flexDirection:"column", gap:2,
                        padding:"10px 14px", borderBottom:"1px solid rgba(29,34,40,0.06)",
                        textDecoration:"none", transition:"background 0.15s" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "rgba(29,34,40,0.04)")}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                      <span style={{ fontSize:13, fontWeight:600, color: textCol }}>{item.label}</span>
                      <span style={{ fontSize:11, color: mutedCol }}>{item.desc}</span>
                    </Link>
                  ))}
                </div>
              )}

              {/* No results */}
              {searchOpen && search.trim().length > 0 && searchResults.length === 0 && (
                <div style={{
                  position:"absolute", top:"calc(100% + 6px)", left:0, minWidth:240,
                  background:"rgba(248,249,251,0.97)", borderRadius:10,
                  border:"1px solid rgba(29,34,40,0.10)",
                  boxShadow:"0 8px 32px rgba(29,34,40,0.12)",
                  backdropFilter:"blur(16px)", padding:"12px 14px", zIndex:9999,
                }}>
                  <span style={{ fontSize:12, color: mutedCol }}>No results for "{search}"</span>
                </div>
              )}
            </div>

            {/* Reflections */}
            <Link href="/reflections"
              className="flex items-center justify-center gap-1.5 rounded-lg text-xs font-medium"
              style={{
                width: 110, height: 30,
                background: "rgba(29,34,40,0.07)",
                color: "rgba(29,34,40,0.65)",
                border: "1px solid rgba(29,34,40,0.13)",
                letterSpacing: "0.04em",
                backdropFilter: "blur(8px)",
                WebkitBackdropFilter: "blur(8px)",
              }}>
              <span style={{ fontSize:10, opacity:0.6 }}>✦</span>
              Reflections
            </Link>

            {/* User account button + floating panel */}
            <div ref={userPanelRef} style={{ position:"relative", zIndex:10 }}>
              <button
                onClick={() => setUserPanelOpen(v => !v)}
                className="gnav-text flex items-center justify-center rounded-full border cursor-pointer"
                title={user ? user.email || "Account" : "Sign in"}
                style={{ width: 30, height: 30,
                  borderColor: user ? "rgba(29,34,40,0.20)" : "rgba(29,34,40,0.13)",
                  background: user ? "rgba(29,34,40,0.07)" : "rgba(29,34,40,0.04)",
                  color: "rgba(29,34,40,0.55)", flexShrink:0,
                  transition:"all 0.2s ease" }}>
                {user ? (
                  <span style={{ fontSize:13, fontWeight:600, color:"rgba(29,34,40,0.65)", letterSpacing:"-0.02em" }}>
                    {(user.user_metadata?.full_name || user.email || "U").slice(0,2).toUpperCase()}
                  </span>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="8" r="4"/>
                    <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
                  </svg>
                )}
              </button>

              {/* Floating panel */}
              {userPanelOpen && (
                <div style={{
                  position:"absolute", top:"calc(100% + 10px)", right:0,
                  width:320, borderRadius:16,
                  background:"rgba(235,238,243,0.97)",
                  border:"1px solid rgba(29,34,40,0.10)",
                  boxShadow:"0 8px 40px rgba(29,34,40,0.18), 0 0 0 0.5px rgba(255,255,255,0.6) inset",
                  backdropFilter:"blur(20px)",
                  WebkitBackdropFilter:"blur(20px)",
                  overflow:"hidden",
                  zIndex:9999,
                }}>
                  {user ? (
                    /* ── Logged in panel ── */
                    <>
                      {/* Email + close */}
                      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
                        padding:"14px 16px 12px", borderBottom:"1px solid rgba(29,34,40,0.08)" }}>
                        <span style={{ fontSize:12, color:"rgba(29,34,40,0.56)" }}>{user.email}</span>
                        <button onClick={() => setUserPanelOpen(false)}
                          style={{ background:"none", border:"none", cursor:"pointer", color:"rgba(29,34,40,0.4)",
                            fontSize:18, lineHeight:1, padding:"0 2px" }}>×</button>
                      </div>

                      {/* Avatar + name + manage */}
                      <div style={{ padding:"20px 16px 16px", display:"flex", flexDirection:"column",
                        alignItems:"center", gap:10 }}>
                        <div style={{ position:"relative" }}>
                          <div style={{ width:64, height:64, borderRadius:"50%",
                            background:"linear-gradient(135deg,#2563EB,#1d4ed8)",
                            display:"flex", alignItems:"center", justifyContent:"center",
                            boxShadow:"0 4px 16px rgba(37,99,235,0.3)" }}>
                            <span style={{ fontSize:22, fontWeight:600, color:"#fff", letterSpacing:"-0.02em" }}>
                              {(user.user_metadata?.full_name || user.email || "U").slice(0,2).toUpperCase()}
                            </span>
                          </div>
                        </div>
                        <p style={{ fontSize:16, fontWeight:600, color:"#1d2228", margin:0 }}>
                          Hi, {user.user_metadata?.full_name || (user.email?.split("@")[0]) || "User"}!
                        </p>
                        <Link href="/account" onClick={() => setUserPanelOpen(false)}
                          style={{ display:"block", textAlign:"center", padding:"8px 28px",
                            borderRadius:999, fontSize:13, fontWeight:500,
                            color:"#1d2228", border:"1px solid rgba(29,34,40,0.22)",
                            background:"rgba(255,255,255,0.7)", textDecoration:"none",
                            transition:"background 0.15s" }}
                          onMouseEnter={e => (e.currentTarget.style.background="rgba(255,255,255,0.9)")}
                          onMouseLeave={e => (e.currentTarget.style.background="rgba(255,255,255,0.7)")}>
                          Manage Account
                        </Link>
                      </div>

                      {/* Action cards */}
                      <div style={{ margin:"0 12px 12px", borderRadius:12, overflow:"hidden",
                        background:"rgba(255,255,255,0.72)", border:"1px solid rgba(29,34,40,0.07)" }}>
                        {[
                          { label:"My Projects", icon:<><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>, href:"/projects" },
                          { label:"Cart",        icon:<><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></>,              href:"/cart" },
                          { label:"Orders",      icon:<><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></>, href:"/orders" },
                        ].map(({ label, icon, href }, i, arr) => (
                          <Link key={href} href={href} onClick={() => setUserPanelOpen(false)}
                            style={{ display:"flex", alignItems:"center", gap:12, padding:"11px 14px",
                              borderBottom: i < arr.length-1 ? "1px solid rgba(29,34,40,0.06)" : "none",
                              textDecoration:"none", color:"#1d2228", transition:"background 0.15s" }}
                            onMouseEnter={e => (e.currentTarget.style.background="rgba(29,34,40,0.04)")}
                            onMouseLeave={e => (e.currentTarget.style.background="transparent")}>
                            <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
                              stroke="rgba(29,34,40,0.55)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                              {icon}
                            </svg>
                            <span style={{ fontSize:13, fontWeight:500 }}>{label}</span>
                            <svg style={{ marginLeft:"auto" }} width="14" height="14" viewBox="0 0 24 24" fill="none"
                              stroke="rgba(29,34,40,0.28)" strokeWidth="2" strokeLinecap="round">
                              <polyline points="9 18 15 12 9 6"/>
                            </svg>
                          </Link>
                        ))}
                      </div>

                      {/* Sign out */}
                      <div style={{ margin:"0 12px 12px", borderRadius:12, overflow:"hidden",
                        background:"rgba(255,255,255,0.72)", border:"1px solid rgba(29,34,40,0.07)" }}>
                        <button onClick={() => { setUserPanelOpen(false); signOut() }}
                          style={{ width:"100%", display:"flex", alignItems:"center", gap:12,
                            padding:"11px 14px", background:"transparent", border:"none",
                            cursor:"pointer", color:"#1d2228", transition:"background 0.15s", textAlign:"left" }}
                          onMouseEnter={e => (e.currentTarget.style.background="rgba(29,34,40,0.04)")}
                          onMouseLeave={e => (e.currentTarget.style.background="transparent")}>
                          <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
                            stroke="rgba(29,34,40,0.55)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
                          </svg>
                          <span style={{ fontSize:13, fontWeight:500 }}>Sign out</span>
                        </button>
                      </div>
                    </>
                  ) : (
                    /* ── Logged out panel — inline auth form ── */
                    <>
                      {/* Logo + tabs */}
                      <div style={{ padding:"18px 18px 0", textAlign:"center" }}>
                        <span style={{ fontFamily:"Georgia,serif", fontSize:26, fontWeight:400,
                          color:"rgba(29,34,40,0.58)", letterSpacing:"-0.01em" }}>
                          S<span style={{ color:"#2563EB" }}>|</span>S
                        </span>
                        <p style={{ fontSize:13, fontWeight:600, color:"#1d2228", margin:"6px 0 14px" }}>
                          Science of Sound
                        </p>
                        {/* Tabs */}
                        <div style={{ display:"flex", borderBottom:"1px solid rgba(29,34,40,0.08)", marginBottom:16 }}>
                          {(["in","up"] as const).map(t => (
                            <button key={t} onClick={() => { setAuthTab(t); resetAuthForm() }}
                              style={{ flex:1, paddingBottom:10, fontSize:12, fontWeight:500,
                                background:"transparent", border:"none", cursor:"pointer",
                                color: authTab===t ? "#1d2228" : "rgba(29,34,40,0.45)",
                                borderBottom: authTab===t ? "2px solid #2563EB" : "2px solid transparent",
                                transition:"all 0.15s" }}>
                              {t==="in" ? "Sign In" : "Sign Up"}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Form */}
                      <form onSubmit={authTab==="in" ? handleSignIn : handleSignUp}
                        style={{ padding:"0 18px 18px", display:"flex", flexDirection:"column", gap:9 }}>
                        {authTab==="up" && (
                          <input type="text" required placeholder="Full name" value={authName}
                            onChange={e => setAuthName(e.target.value)}
                            style={{ width:"100%", padding:"8px 10px", borderRadius:7, fontSize:12,
                              border:"1px solid rgba(29,34,40,0.13)", background:"rgba(255,255,255,0.55)",
                              color:"#1d2228", outline:"none", boxSizing:"border-box" }}/>
                        )}
                        <input type="email" required placeholder="Email" value={authEmail}
                          onChange={e => setAuthEmail(e.target.value)}
                          style={{ width:"100%", padding:"8px 10px", borderRadius:7, fontSize:12,
                            border:"1px solid rgba(29,34,40,0.13)", background:"rgba(255,255,255,0.55)",
                            color:"#1d2228", outline:"none", boxSizing:"border-box" }}/>
                        <input type="password" required placeholder="Password" value={authPassword}
                          onChange={e => setAuthPassword(e.target.value)}
                          style={{ width:"100%", padding:"8px 10px", borderRadius:7, fontSize:12,
                            border:"1px solid rgba(29,34,40,0.13)", background:"rgba(255,255,255,0.55)",
                            color:"#1d2228", outline:"none", boxSizing:"border-box" }}/>

                        {authError && (
                          <p style={{ fontSize:11, color:"#ef4444", margin:0, textAlign:"center" }}>{authError}</p>
                        )}
                        {authSuccess && (
                          <p style={{ fontSize:11, color:"#16a34a", margin:0, textAlign:"center" }}>{authSuccess}</p>
                        )}

                        <button type="submit" disabled={authLoading}
                          style={{ width:"100%", padding:"9px 0", borderRadius:7, fontSize:13,
                            fontWeight:600, color:"#fff",
                            background: authLoading ? "#1d3a6e" : "linear-gradient(135deg,#2563EB,#1d4ed8)",
                            border:"none", cursor: authLoading ? "not-allowed" : "pointer",
                            boxShadow:"0 3px 10px rgba(37,99,235,0.28)", transition:"opacity 0.15s" }}>
                          {authLoading ? "Please wait…" : authTab==="in" ? "Sign In" : "Create account"}
                        </button>
                      </form>
                    </>
                  )}
                </div>
              )}
            </div>
            </div>

            {/* Row 2 right — Nav links */}
            <div className="flex items-center justify-end gap-1">

          {NAV_LINKS.map(({ label, href }) => {
            const active = href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/")
            return (
              <Link key={href} href={href}
                className="gnav-text px-3 py-1 rounded-lg text-xs font-medium"
                style={{
                  background:     active ? activeNavBg   : "transparent",
                  color:          active ? activeNavText : textCol,
                  fontWeight:     active ? 600 : 400,
                  letterSpacing:  "0.03em",
                  backdropFilter: active ? "blur(14px)" : undefined,
                  transition:     "background 0.2s, color 0.35s ease",
                }}>
                {label}
              </Link>
            )
          })}

          <div className="gnav-text" style={{ width:1, height:16, background: dividerCol, margin:"0 6px",
            transition:"background 0.35s ease" }}/>

          {/* Design Now */}
          <Link href="/engine"
            className="flex items-center justify-center gap-1.5 rounded-lg text-xs font-medium"
            style={{
              width: 130, height: 30,
              background: "rgba(29,34,40,0.07)",
              color: "rgba(29,34,40,0.65)",
              border: "1px solid rgba(29,34,40,0.13)",
              letterSpacing: "0.04em",
              fontSize: 13,
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
            }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="rgba(29,34,40,0.55)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
              style={{ opacity:0.9 }}>
              {/* Compass — pivot circle + two legs */}
              <circle cx="12" cy="5" r="1.4"/>
              <line x1="10.8" y1="6.2" x2="7" y2="20"/>
              <line x1="13.2" y1="6.2" x2="17" y2="20"/>
              <line x1="8.5"  y1="13" x2="15.5" y2="13"/>
              {/* Ruler — horizontal at bottom */}
              <rect x="2" y="21" width="20" height="2.5" rx="0.5"/>
              <line x1="5"  y1="21" x2="5"  y2="22.2"/>
              <line x1="8"  y1="21" x2="8"  y2="22.8"/>
              <line x1="11" y1="21" x2="11" y2="22.2"/>
              <line x1="14" y1="21" x2="14" y2="22.8"/>
              <line x1="17" y1="21" x2="17" y2="22.2"/>
              <line x1="20" y1="21" x2="20" y2="22.8"/>
            </svg>
            Design Now →
          </Link>
            </div>
          </div>
        </div>

        {/* ── Mobile Row — Logo + Hamburger ── */}
        <div className="md:hidden flex items-center justify-between px-4"
          style={{ height: 60, position:"relative", zIndex:1 }}>
          <Link href="/" className="flex items-center gap-2 select-none">
            <div className="flex items-center justify-center"
              style={{ width:48, height:48 }}>
              <span style={{ fontFamily:"Georgia, serif", fontSize:24, fontWeight:400,
                letterSpacing:"-0.01em", color: logoText }}>
                S<span style={{ color:"#2563EB" }}>|</span>S
              </span>
            </div>
            <span style={{ fontFamily:"system-ui,-apple-system,sans-serif",
              fontSize:14, fontWeight:600, letterSpacing:"0.04em", color: textCol }}>
              Science of Sound
            </span>
          </Link>
          <button className="w-8 h-8 flex flex-col items-center justify-center gap-1.5"
            onClick={() => setOpenForPath(v => v === pathname ? null : pathname)} aria-label="Menu">
            {[0,1,2].map(i => (
              <span key={i} className="gnav-text block w-5 h-px"
                style={{ background: textCol, transition:"background 0.35s ease" }}/>
            ))}
          </button>
        </div>

      </header>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 md:hidden" onClick={() => setOpenForPath(null)}>
          <div className="absolute inset-0" style={{ background: drawerOverlay }}/>
          <nav className="absolute top-14 left-0 right-0 shadow-xl"
            style={{ background: drawerBg, borderBottom: drawerBorder,
              backdropFilter:"blur(16px)", WebkitBackdropFilter:"blur(16px)" }}
            onClick={e => e.stopPropagation()}>

            {/* Mobile search */}
            <div className="px-6 pt-4 pb-2">
              <div className="flex items-center gap-2 px-3 rounded-lg border"
                style={{ height:38, borderColor:"rgba(29,34,40,0.14)",
                  background:"rgba(255,255,255,0.6)" }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                  stroke={mutedCol} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="7"/>
                  <line x1="16.5" y1="16.5" x2="22" y2="22"/>
                </svg>
                <input className="gnav-search bg-transparent text-sm flex-1"
                  style={{ color: textCol }}
                  placeholder="Quick search…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
            </div>

            {NAV_LINKS.map(({ label, href }) => {
              const active = href === "/" ? pathname === "/" : pathname.startsWith(href)
              return (
                <Link key={href} href={href}
                  className="block px-6 py-3.5 text-sm border-b"
                  style={{ borderColor:"rgba(29,34,40,0.08)",
                    color: active ? drawerActive : drawerText, fontWeight: active ? 600 : 400 }}>
                  {label}
                </Link>
              )
            })}

            <div className="flex gap-3 px-6 py-4">
              <Link href="/engine" className="flex-1 text-center py-2.5 rounded-lg text-sm font-semibold"
                style={{ background: toolBg, color:"#fff" }}>
                Design Now →
              </Link>
              <Link href="/login" className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border"
                style={{ borderColor: drawerLoginBorder, color: drawerText }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="8" r="4"/>
                  <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
                </svg>
                Login
              </Link>
            </div>

            <div className="px-6 pb-5">
              <Link href="/reflections"
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg text-sm font-medium"
                style={{
                  background:"linear-gradient(135deg, rgba(10,18,35,0.92), rgba(20,35,65,0.88))",
                  color:"#9DAFC8",
                  border:"1px solid rgba(100,140,220,0.22)",
                  letterSpacing:"0.04em",
                }}>
                <span style={{ fontSize:11, opacity:0.7 }}>✦</span>
                Reflections
              </Link>
            </div>
          </nav>
        </div>
      )}

    </>
  )
}
