"use client";

export default function Home() {
  return (
    <div style={{
  minHeight: "100vh",
  backgroundColor: "#F8FAFC",  
  color: "#0F172A",             
  fontFamily: "Inter, Arial, sans-serif"
}}>

      {/* NAVBAR */}
      <header style={{
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  height: "70px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "0 80px",
  backgroundColor: "rgba(248,250,252,0.95)",
  backdropFilter: "blur(10px)",
  borderBottom: "1px solid #CBD5E1",
  zIndex: 100
}}>
        <div style={{ fontSize: "20px", fontWeight: "700" }}>
          Science of Sound
        </div>

        <nav style={{
  display: "flex",
  gap: "32px",
  fontSize: "15px",
  color: "#334155"
}}>
          <span>Design Engine</span>
          <span>Acoustics</span>
          <span>Projects</span>
          <span>Contact</span>
        </nav>
      </header>

      {/* HERO */}
     <section style={{
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  padding: "0 80px",
  paddingTop: "70px",
  backgroundColor: "#F1F5F9"
}}>
        <div style={{ maxWidth: "900px" }}>
          <h1 style={{ fontSize: "52px", marginBottom: "20px" }}>
            Design Your Home Theater<br />
            <span style={{ color: "#38BDF8" }}>the Right Way</span>
          </h1>

          <p style={{
            fontSize: "20px",
            color: "#334155",
            maxWidth: "700px",
            marginBottom: "40px"
          }}>
            A professional home theater design engine that calculates
            screen size, projector feasibility, seating, speakers,
            subwoofers, and acoustic complexity — based on real-world
            constraints, not sales hype.
          </p>

          <a href="/engine">
            <button style={{
              padding: "16px 32px",
              fontSize: "18px",
              fontWeight: "600",
              backgroundColor: "#38BDF8",
              color: "#020617",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer"
            }}>
              Launch Design Engine
            </button>
          </a>
        </div>
      </section>

      {/* WHAT THIS TOOL DOES */}
      <section style={{
  padding: "120px 80px",
  backgroundColor: "#E5E7EB"
}}>
        <h2 style={{
          fontSize: "36px",
          marginBottom: "60px",
          textAlign: "center"
        }}>
          What This Tool Does
        </h2>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "24px"
        }}>
          {[
            ["Screen & Viewing", "Calculates ideal screen size using SMPTE & THX standards."],
            ["Projector Feasibility", "Checks real throw distance and physical fit."],
            ["Speakers & Subwoofers", "Recommends layouts and subwoofer count."],
            ["Acoustic Difficulty", "Predicts treatment complexity in advance."]
          ].map(([title, text]) => (
            <div key={title} style={{
  background: "#F8FAFC",
  padding: "24px",
  borderRadius: "10px",
  border: "1px solid #CBD5E1"
}}>
              <h3>{title}</h3>
              <p style={{ color: "#475569" }}>{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* WHY SCIENCE OF SOUND */}
      <section style={{
  padding: "120px 80px",
  backgroundColor: "#F8FAFC"
}}>
        <h2 style={{
          fontSize: "36px",
          marginBottom: "40px",
          textAlign: "center"
        }}>
          Why Science of Sound
        </h2>

        <p style={{
          maxWidth: "900px",
          margin: "0 auto",
          fontSize: "18px",
          color: "#334155",
          textAlign: "center",
          lineHeight: "1.6"
        }}>
          Science of Sound approaches home theater design as an engineering
          problem — not a sales pitch. Every recommendation is driven by
          room geometry, acoustic behavior, and real installation constraints.
          No exaggerated claims. No brand bias. Just correct design.
        </p>
      </section>

      {/* FOOTER */}
      <footer style={{
  padding: "40px 80px",
  backgroundColor: "#E5E7EB",
  borderTop: "1px solid #CBD5E1"
}}>
        <p style={{ color: "#475569", fontSize: "14px" }}>
          © {new Date().getFullYear()} Science of Sound · Home Theater Acoustics · Hyderabad
        </p>
      </footer>

    </div>
  );
}
