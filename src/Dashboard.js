import { useState, useEffect } from "react";

const SUPABASE_URL = "https://jwdecztufhdmzpozxeoe.supabase.co";
const SUPABASE_KEY = "sb_publishable_QsxezHz7a8y8z3ra2FkV6A__d_Xwg6l";

const DASHBOARD_PASSWORD = "dentist123";

function createDB(url, key) {
  const base = url.replace(/\/+$/, "");
  const h = { "Content-Type": "application/json", "apikey": key, "Authorization": `Bearer ${key}` };
  return {
    async get(table, q = "") {
      const r = await fetch(`${base}/rest/v1/${table}?${q}`, { headers: h });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
    async patch(table, id, data) {
      const r = await fetch(`${base}/rest/v1/${table}?id=eq.${id}`, {
        method: "PATCH", headers: { ...h, "Prefer": "return=representation" }, body: JSON.stringify(data)
      });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    }
  };
}

const db = createDB(SUPABASE_URL, SUPABASE_KEY);

const S = {
  wrap: { fontFamily: "'DM Sans','Segoe UI',sans-serif", minHeight: "100vh", background: "#f8fafc" },
  header: { background: "linear-gradient(135deg,#0ea5e9,#14b8a6)", padding: "20px 32px", display: "flex", justifyContent: "space-between", alignItems: "center" },
  card: { background: "#fff", borderRadius: 16, padding: 24, border: "1px solid #e2e8f0", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" },
  badge: (status) => ({
    display: "inline-block", padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700,
    background: status === "confirmed" ? "#dcfce7" : status === "cancelled" ? "#fee2e2" : "#fef9c3",
    color: status === "confirmed" ? "#16a34a" : status === "cancelled" ? "#dc2626" : "#ca8a04",
  }),
};

function LoginScreen({ onLogin }) {
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");

  function handleLogin() {
    if (pass === DASHBOARD_PASSWORD) { onLogin(); }
    else { setErr("Incorrect password. Try again."); }
  }

  return (
    <div style={{ ...S.wrap, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ ...S.card, maxWidth: 380, width: "100%", margin: 20, textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🦷</div>
        <h2 style={{ fontSize: 24, color: "#0f172a", marginBottom: 4 }}>DentaBook Dashboard</h2>
        <p style={{ color: "#64748b", fontSize: 14, marginBottom: 24 }}>Sign in to manage your appointments</p>
        <input type="password" value={pass} onChange={e => setPass(e.target.value)} onKeyDown={e => e.key === "Enter" && handleLogin()}
          placeholder="Enter your password" style={{ width: "100%", border: "1.5px solid #e2e8f0", borderRadius: 10, padding: "12px 14px", fontSize: 14, outline: "none", boxSizing: "border-box", marginBottom: 12 }} />
        {err && <p style={{ color: "#f43f5e", fontSize: 13, marginBottom: 12 }}>⚠️ {err}</p>}
        <button onClick={handleLogin} style={{ width: "100%", background: "linear-gradient(135deg,#0ea5e9,#14b8a6)", color: "#fff", border: "none", borderRadius: 10, padding: "13px", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
          Sign In →
        </button>
        <p style={{ fontSize: 11, color: "#cbd5e1", marginTop: 16 }}>Default password: dentist123</p>
      </div>
    </div>
  );
}

export default function Dashboard({ onBack }) {
  const [loggedIn, setLoggedIn] = useState(false);
  const [bookings, setBookings] = useState([]);
  const [dentists, setDentists] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [cancelling, setCancelling] = useState(null);
  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    if (!loggedIn) return;
    (async () => {
      try {
        const [b, d, s] = await Promise.all([
          db.get("bookings", "select=*&order=booking_date.asc,time_slot.asc"),
          db.get("dentists", "select=*"),
          db.get("services", "select=*"),
        ]);
        setBookings(b); setDentists(d); setServices(s);
      } catch (e) { console.error(e); }
      setLoading(false);
    })();
  }, [loggedIn]);

  async function cancelBooking(id) {
    setCancelling(id);
    try {
      await db.patch("bookings", id, { status: "cancelled" });
      setBookings(bs => bs.map(b => b.id === id ? { ...b, status: "cancelled" } : b));
    } catch (e) { alert("Failed to cancel. Try again."); }
    setCancelling(null);
  }

  if (!loggedIn) return <LoginScreen onLogin={() => setLoggedIn(true)} />;

  const getDentist = (id) => dentists.find(d => d.id === id)?.name || "Unknown";
  const getService = (id) => services.find(s => s.id === id)?.label || id;

  const filtered = bookings.filter(b => {
    const matchSearch = b.patient_name?.toLowerCase().includes(search.toLowerCase()) ||
      b.patient_email?.toLowerCase().includes(search.toLowerCase()) ||
      b.patient_phone?.includes(search);
    const matchFilter = filter === "all" ? true :
      filter === "today" ? b.booking_date === today :
      filter === "upcoming" ? b.booking_date >= today :
      filter === "cancelled" ? b.status === "cancelled" : true;
    return matchSearch && matchFilter;
  });

  const todayCount = bookings.filter(b => b.booking_date === today && b.status === "confirmed").length;
  const upcomingCount = bookings.filter(b => b.booking_date >= today && b.status === "confirmed").length;
  const totalCount = bookings.filter(b => b.status === "confirmed").length;
  const cancelledCount = bookings.filter(b => b.status === "cancelled").length;

  return (
    <div style={S.wrap}>
      {/* Header */}
      <div style={S.header}>
        <div>
          <h1 style={{ color: "#fff", fontSize: 22, fontWeight: 700, margin: 0 }}>🦷 DentaBook Dashboard</h1>
          <p style={{ color: "rgba(255,255,255,0.75)", fontSize: 13, margin: "4px 0 0" }}>Manage your appointments</p>
        </div>
<div style={{ display:"flex", gap:8 }}>
  <button onClick={onBack} style={{ background:"rgba(255,255,255,0.2)", border:"none", borderRadius:8, padding:"8px 16px", color:"#fff", cursor:"pointer", fontSize:13, fontWeight:600 }}>
    ← Booking Widget
  </button>
  <button onClick={() => setLoggedIn(false)} style={{ background:"rgba(255,255,255,0.2)", border:"none", borderRadius:8, padding:"8px 16px", color:"#fff", cursor:"pointer", fontSize:13, fontWeight:600 }}>
    Sign Out
  </button>
</div>
      </div>

      <div style={{ padding: 32 }}>
        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 24 }}>
          {[
            { label: "Today's Appointments", value: todayCount, color: "#0ea5e9", icon: "📅" },
            { label: "Upcoming", value: upcomingCount, color: "#14b8a6", icon: "🗓️" },
            { label: "Total Confirmed", value: totalCount, color: "#8b5cf6", icon: "✅" },
            { label: "Cancelled", value: cancelledCount, color: "#f43f5e", icon: "❌" },
          ].map(stat => (
            <div key={stat.label} style={{ ...S.card, textAlign: "center" }}>
              <div style={{ fontSize: 28 }}>{stat.icon}</div>
              <div style={{ fontSize: 32, fontWeight: 800, color: stat.color, margin: "8px 0 4px" }}>{stat.value}</div>
              <div style={{ fontSize: 12, color: "#94a3b8", fontWeight: 600 }}>{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Filters + Search */}
        <div style={{ ...S.card, marginBottom: 20 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Search by patient name, email or phone..."
              style={{ flex: 1, minWidth: 200, border: "1.5px solid #e2e8f0", borderRadius: 10, padding: "10px 14px", fontSize: 14, outline: "none" }} />
            <div style={{ display: "flex", gap: 8 }}>
              {["all", "today", "upcoming", "cancelled"].map(f => (
                <button key={f} onClick={() => setFilter(f)}
                  style={{ padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, background: filter === f ? "#0ea5e9" : "#f1f5f9", color: filter === f ? "#fff" : "#64748b" }}>
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Bookings Table */}
        <div style={S.card}>
          <h3 style={{ margin: "0 0 16px", color: "#0f172a", fontSize: 16 }}>Appointments ({filtered.length})</h3>
          {loading ? (
            <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>Loading bookings...</div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>No appointments found</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid #f1f5f9" }}>
                    {["Date", "Time", "Patient", "Contact", "Service", "Dentist", "Status", "Action"].map(h => (
                      <th key={h} style={{ padding: "10px 12px", textAlign: "left", color: "#94a3b8", fontWeight: 600, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(b => (
                    <tr key={b.id} style={{ borderBottom: "1px solid #f8fafc", background: b.booking_date === today ? "#f0f9ff" : "transparent" }}>
                      <td style={{ padding: "12px" }}>
                        <span style={{ fontWeight: 600, color: "#0f172a" }}>{new Date(b.booking_date).toLocaleDateString("en-IE", { weekday: "short", month: "short", day: "numeric" })}</span>
                        {b.booking_date === today && <span style={{ marginLeft: 6, fontSize: 10, background: "#0ea5e9", color: "#fff", borderRadius: 4, padding: "2px 6px" }}>TODAY</span>}
                      </td>
                      <td style={{ padding: "12px", fontWeight: 600, color: "#0f172a" }}>{b.time_slot}</td>
                      <td style={{ padding: "12px", fontWeight: 600, color: "#0f172a" }}>{b.patient_name}</td>
                      <td style={{ padding: "12px" }}>
                        <div style={{ color: "#64748b", fontSize: 12 }}>{b.patient_email}</div>
                        <div style={{ color: "#64748b", fontSize: 12 }}>{b.patient_phone}</div>
                      </td>
                      <td style={{ padding: "12px", color: "#64748b" }}>{getService(b.service_id)}</td>
                      <td style={{ padding: "12px", color: "#64748b" }}>{getDentist(b.dentist_id)}</td>
                      <td style={{ padding: "12px" }}><span style={S.badge(b.status)}>{b.status}</span></td>
                      <td style={{ padding: "12px" }}>
                        {b.status === "confirmed" && (
                          <button onClick={() => { if (window.confirm(`Cancel ${b.patient_name}'s appointment?`)) cancelBooking(b.id); }}
                            disabled={cancelling === b.id}
                            style={{ background: "#fff1f2", color: "#f43f5e", border: "1px solid #fecdd3", borderRadius: 6, padding: "5px 10px", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>
                            {cancelling === b.id ? "..." : "Cancel"}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}