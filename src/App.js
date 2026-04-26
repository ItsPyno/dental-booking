import { useState, useEffect } from "react";
import Dashboard from "./Dashboard";

const SUPABASE_URL = "https://jwdecztufhdmzpozxeoe.supabase.co";
const SUPABASE_KEY = "sb_publishable_QsxezHz7a8y8z3ra2FkV6A__d_Xwg6l";

function createSupabase(url, key) {
  const cleanUrl = url.replace(/\/+$/, "");
  const headers = {
    "Content-Type": "application/json",
    "apikey": key,
    "Authorization": `Bearer ${key}`,
  };
  return {
    async select(table, query = "") {
      const res = await fetch(`${cleanUrl}/rest/v1/${table}?${query}`, { headers });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    async insert(table, data) {
      const res = await fetch(`${cleanUrl}/rest/v1/${table}`, {
        method: "POST",
        headers: { ...headers, "Prefer": "return=representation" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  };
}

const db = createSupabase(SUPABASE_URL, SUPABASE_KEY);

const ALL_SLOTS = [];
for (let h = 9; h <= 16; h++) {
  for (let m of [0, 30]) {
    ALL_SLOTS.push(`${h > 12 ? h - 12 : h}:${m === 0 ? "00" : "30"} ${h >= 12 ? "PM" : "AM"}`);
  }
}
ALL_SLOTS.push("5:00 PM");

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAYS = ["Su","Mo","Tu","We","Th","Fr","Sa"];

function getDaysInMonth(y, m) { return new Date(y, m + 1, 0).getDate(); }
function getFirstDay(y, m) { return new Date(y, m, 1).getDay(); }
function toDateStr(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
}

const widgetWrap = {
  fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
  maxWidth: 480, margin: "0 auto", background: "#fff",
  borderRadius: 20, boxShadow: "0 20px 60px rgba(0,0,0,0.12)",
  overflow: "hidden", border: "1px solid #f1f5f9",
};
const primaryBtn = {
  width: "100%", background: "linear-gradient(135deg, #0ea5e9, #14b8a6)",
  color: "#fff", border: "none", borderRadius: 12, padding: "14px",
  fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
};
const inputStyle = {
  width: "100%", border: "1.5px solid #e2e8f0", borderRadius: 10,
  padding: "10px 14px", fontSize: 14, outline: "none", boxSizing: "border-box", fontFamily: "inherit",
};
const navBtnStyle = {
  background: "none", border: "1px solid #e2e8f0", borderRadius: 8,
  width: 32, height: 32, cursor: "pointer", fontSize: 18, color: "#64748b",
};

const STEPS = ["Service","Dentist","Date","Time","Your Info","Confirm"];

export default function App() {
  const [showDashboard, setShowDashboard] = useState(false);
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState({ service: null, dentist: null, date: null, time: null });
  const [form, setForm] = useState({ name: "", email: "", phone: "", notes: "" });
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [services, setServices] = useState([]);
  const [dentists, setDentists] = useState([]);
  const [takenSlots, setTakenSlots] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [booked, setBooked] = useState(false);
  const [bookingError, setBookingError] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState("");
  const [symptomInput, setSymptomInput] = useState("");
  const today = new Date();

  useEffect(() => {
    (async () => {
      try {
        const [svcs, dents] = await Promise.all([
          db.select("services", "select=*&is_active=eq.true&order=label.asc"),
          db.select("dentists", "select=*&is_active=eq.true&order=name.asc"),
        ]);
        setServices(svcs); setDentists(dents);
      } catch(e) { console.error(e); }
      setLoadingData(false);
    })();
  }, []);

  useEffect(() => {
    if (!selected.date) return;
    (async () => {
      setLoadingSlots(true);
      try {
        let q = `select=time_slot&booking_date=eq.${toDateStr(selected.date)}&status=eq.confirmed`;
        if (selected.dentist && selected.dentist !== "any") q += `&dentist_id=eq.${selected.dentist}`;
        const data = await db.select("bookings", q);
        setTakenSlots(data.map(b => b.time_slot));
      } catch { setTakenSlots([]); }
      setLoadingSlots(false);
    })();
  }, [selected.date, selected.dentist]);

  const slots = ALL_SLOTS.map(t => ({ time: t, available: !takenSlots.includes(t) }));

  async function handleAiTriage() {
    if (!symptomInput.trim()) return;
    setAiLoading(true);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514", max_tokens: 200,
          messages: [{ role: "user", content: `Dental patient says: "${symptomInput}". Recommend ONE of: ${services.map(s => s.label).join(", ")}. Reply in 1-2 friendly sentences.` }]
        })
      });
      const d = await res.json();
      setAiSuggestion(d.content[0].text);
    } catch { setAiSuggestion("We recommend booking a General Checkup so our team can assess your needs."); }
    setAiLoading(false);
  }

  async function handleConfirm() {
    setSubmitting(true); setBookingError("");
    try {
      const dentistId = selected.dentist !== "any" ? selected.dentist : dentists[0]?.id;
      await db.insert("bookings", {
        dentist_id: dentistId, service_id: selected.service,
        booking_date: toDateStr(selected.date), time_slot: selected.time,
        patient_name: form.name, patient_email: form.email,
        patient_phone: form.phone, notes: form.notes || null, status: "confirmed",
      });
      setBooked(true);
    } catch(e) {
      setBookingError((e.message||"").includes("unique")
        ? "That slot was just taken. Please go back and choose another time."
        : "Something went wrong. Please try again.");
    }
    setSubmitting(false);
  }

  function reset() {
    setBooked(false); setStep(0);
    setSelected({ service: null, dentist: null, date: null, time: null });
    setForm({ name: "", email: "", phone: "", notes: "" });
    setAiSuggestion(""); setSymptomInput(""); setBookingError("");
  }

  function renderCalendar() {
    const dim = getDaysInMonth(calYear, calMonth);
    const fd = getFirstDay(calYear, calMonth);
    const cells = [...Array(fd).fill(null), ...Array.from({length: dim}, (_, i) => i + 1)];
    return (
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <button style={navBtnStyle} onClick={() => calMonth === 0 ? (setCalMonth(11), setCalYear(y => y-1)) : setCalMonth(m => m-1)}>‹</button>
          <span style={{ fontWeight: 700, fontSize: 15, color: "#0f172a" }}>{MONTHS[calMonth]} {calYear}</span>
          <button style={navBtnStyle} onClick={() => calMonth === 11 ? (setCalMonth(0), setCalYear(y => y+1)) : setCalMonth(m => m+1)}>›</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4 }}>
          {DAYS.map(d => <div key={d} style={{ textAlign: "center", fontSize: 11, fontWeight: 600, color: "#94a3b8", paddingBottom: 6 }}>{d}</div>)}
          {cells.map((day, i) => {
            if (!day) return <div key={`e${i}`}/>;
            const dt = new Date(calYear, calMonth, day);
            const isPast = dt < new Date(today.getFullYear(), today.getMonth(), today.getDate());
            const isWeekend = dt.getDay() % 6 === 0;
            const isToday = day === today.getDate() && calMonth === today.getMonth() && calYear === today.getFullYear();
            const isSel = selected.date?.getDate() === day && selected.date?.getMonth() === calMonth && selected.date?.getFullYear() === calYear;
            const disabled = isPast || isWeekend;
            return (
              <button key={day} disabled={disabled}
                onClick={() => { setSelected(s => ({...s, date: dt, time: null})); setTakenSlots([]); }}
                style={{ border: "none", borderRadius: 8, padding: "8px 0", cursor: disabled ? "not-allowed" : "pointer", fontSize: 13, fontWeight: isSel ? 700 : 500, background: isSel ? "#0ea5e9" : isToday ? "#e0f2fe" : "transparent", color: disabled ? "#cbd5e1" : isSel ? "#fff" : "#0f172a" }}>
                {day}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (showDashboard) return <Dashboard onBack={() => setShowDashboard(false)} />;

  if (booked) {
    const svc = services.find(s => s.id === selected.service);
    const dent = dentists.find(d => d.id === selected.dentist) || dentists[0];
    return (
      <div style={{ minHeight: "100vh", background: "#f0f9ff", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <div style={widgetWrap}>
          <div style={{ textAlign: "center", padding: "48px 28px" }}>
            <div style={{ width: 72, height: 72, borderRadius: "50%", background: "linear-gradient(135deg,#0ea5e9,#14b8a6)", margin: "0 auto 24px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, color: "#fff" }}>✓</div>
            <h2 style={{ fontSize: 26, color: "#0f172a", margin: "0 0 8px" }}>You're All Set!</h2>
            <p style={{ color: "#64748b", marginBottom: 24, lineHeight: 1.6 }}>Booking saved. Confirmation sent to <strong>{form.email}</strong>.</p>
            <div style={{ background: "#f8fafc", borderRadius: 12, padding: 20, textAlign: "left", border: "1px solid #e2e8f0" }}>
              {[["Service", svc?.label], ["Dentist", dent?.name||"First Available"], ["Date", selected.date?.toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"})], ["Time", selected.time]].map(([k,v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #f1f5f9", fontSize: 14 }}>
                  <span style={{ color: "#94a3b8", fontWeight: 500 }}>{k}</span>
                  <span style={{ color: "#0f172a", fontWeight: 600 }}>{v}</span>
                </div>
              ))}
            </div>
            <button onClick={reset} style={{ ...primaryBtn, marginTop: 24 }}>Book Another Appointment</button>
          </div>
        </div>
      </div>
    );
  }

  if (loadingData) {
    return (
      <div style={{ minHeight: "100vh", background: "#f0f9ff", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={widgetWrap}>
          <div style={{ background: "linear-gradient(135deg,#0ea5e9,#14b8a6)", padding: "24px 28px" }}>
            <h1 style={{ color: "#fff", fontSize: 22, fontWeight: 700 }}>🦷 Book Appointment</h1>
          </div>
          <div style={{ padding: 40, textAlign: "center" }}>
            <div style={{ width: 36, height: 36, border: "3px solid #e2e8f0", borderTop: "3px solid #0ea5e9", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 16px" }}/>
            <p style={{ color: "#94a3b8" }}>Loading from Supabase...</p>
          </div>
        </div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f0f9ff", display: "flex", flexDirection: "column", alignItems: "center", padding: 20 }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ width: "100%", maxWidth: 480, textAlign: "right", marginBottom: 8 }}>
        <button onClick={() => setShowDashboard(true)} style={{ background: "none", border: "none", color: "#94a3b8", fontSize: 12, cursor: "pointer", textDecoration: "underline" }}>
          Dentist Login →
        </button>
      </div>
      <div style={widgetWrap}>
        <div style={{ background: "linear-gradient(135deg,#0ea5e9,#14b8a6)", padding: "24px 28px 20px" }}>
          <h1 style={{ color: "#fff", fontSize: 22, fontWeight: 700, display: "flex", alignItems: "center", gap: 10 }}>🦷 Book Appointment</h1>
          <p style={{ color: "rgba(255,255,255,0.75)", fontSize: 13, marginTop: 4 }}>Live availability · Powered by Supabase</p>
        </div>
        <div style={{ display: "flex", padding: "16px 28px 0" }}>
          {STEPS.map((s, i) => (
            <div key={s} style={{ flex: 1, display: "flex", alignItems: "center" }}>
              <div style={{ textAlign: "center", flex: 1 }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", margin: "0 auto 4px", background: i <= step ? "#0ea5e9" : "#e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: i <= step ? "#fff" : "#94a3b8" }}>
                  {i < step ? "✓" : i+1}
                </div>
                <div style={{ fontSize: 10, color: i === step ? "#0ea5e9" : "#94a3b8", fontWeight: i === step ? 700 : 400, whiteSpace: "nowrap" }}>{s}</div>
              </div>
              {i < STEPS.length-1 && <div style={{ height: 2, flex: 0.5, background: i < step ? "#0ea5e9" : "#e2e8f0", marginBottom: 18 }}/>}
            </div>
          ))}
        </div>
        <div style={{ padding: "20px 28px 28px" }}>
          {step === 0 && (
            <div>
              <div style={{ background: "linear-gradient(135deg,#f0f9ff,#f0fdf4)", border: "1px solid #bae6fd", borderRadius: 12, padding: 16, marginBottom: 20 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: "#0369a1", margin: "0 0 8px" }}>✦ Not sure what you need?</p>
                <div style={{ display: "flex", gap: 8 }}>
                  <input value={symptomInput} onChange={e => setSymptomInput(e.target.value)} onKeyDown={e => e.key === "Enter" && handleAiTriage()} placeholder="Describe your concern..." style={{ ...inputStyle, border: "1px solid #bae6fd" }}/>
                  <button onClick={handleAiTriage} disabled={aiLoading} style={{ background: "#0ea5e9", color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, cursor: "pointer", fontWeight: 600, whiteSpace: "nowrap" }}>
                    {aiLoading ? "..." : "Ask AI"}
                  </button>
                </div>
                {aiSuggestion && <p style={{ fontSize: 13, color: "#0369a1", marginTop: 10, marginBottom: 0, padding: "10px 12px", background: "#fff", borderRadius: 8, border: "1px solid #bae6fd" }}>💡 {aiSuggestion}</p>}
              </div>
              <p style={{ fontSize: 13, color: "#64748b", marginBottom: 14, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Select a Service</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {services.map(svc => (
                  <button key={svc.id} onClick={() => { setSelected(s => ({...s, service: svc.id})); setStep(1); }}
                    style={{ border: `2px solid ${selected.service === svc.id ? svc.color : "#e2e8f0"}`, borderRadius: 12, padding: "14px 12px", background: selected.service === svc.id ? `${svc.color}18` : "#fff", cursor: "pointer", textAlign: "left" }}>
                    <div style={{ fontSize: 20, color: svc.color, marginBottom: 4 }}>{svc.icon}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{svc.label}</div>
                    <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{svc.duration_minutes} min</div>
                  </button>
                ))}
              </div>
            </div>
          )}
          {step === 1 && (
            <div>
              <p style={{ fontSize: 13, color: "#64748b", marginBottom: 14, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Choose Your Dentist</p>
              {dentists.map(d => (
                <button key={d.id} onClick={() => { setSelected(s => ({...s, dentist: d.id})); setStep(2); }}
                  style={{ width: "100%", border: `2px solid ${selected.dentist === d.id ? "#0ea5e9" : "#e2e8f0"}`, borderRadius: 12, padding: "16px", background: selected.dentist === d.id ? "#f0f9ff" : "#fff", cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 14, marginBottom: 10 }}>
                  <div style={{ width: 48, height: 48, borderRadius: "50%", background: "linear-gradient(135deg,#0ea5e9,#14b8a6)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 15, flexShrink: 0 }}>{d.avatar_initials}</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: "#0f172a" }}>{d.name}</div>
                    <div style={{ fontSize: 12, color: "#64748b" }}>{d.specialty}</div>
                  </div>
                </button>
              ))}
              <button onClick={() => { setSelected(s => ({...s, dentist: "any"})); setStep(2); }}
                style={{ width: "100%", border: "2px dashed #e2e8f0", borderRadius: 12, padding: "14px", background: "#fafafa", cursor: "pointer", color: "#64748b", fontSize: 13, fontWeight: 600 }}>
                No preference — first available
              </button>
            </div>
          )}
          {step === 2 && (
            <div>
              <p style={{ fontSize: 13, color: "#64748b", marginBottom: 14, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Pick a Date</p>
              {renderCalendar()}
              <button disabled={!selected.date} onClick={() => setStep(3)} style={{ ...primaryBtn, marginTop: 20, opacity: selected.date ? 1 : 0.4 }}>See Available Times →</button>
            </div>
          )}
          {step === 3 && (
            <div>
              <p style={{ fontSize: 13, color: "#64748b", marginBottom: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Available Times</p>
              <p style={{ fontSize: 12, color: "#94a3b8", marginBottom: 14 }}>{selected.date?.toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"})}</p>
              {loadingSlots ? (
                <div style={{ textAlign: "center", padding: 24 }}>
                  <div style={{ width: 28, height: 28, border: "3px solid #e2e8f0", borderTop: "3px solid #0ea5e9", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 10px" }}/>
                  <p style={{ color: "#94a3b8", fontSize: 13 }}>Checking live availability...</p>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
                  {slots.map(slot => (
                    <button key={slot.time} disabled={!slot.available} onClick={() => setSelected(s => ({...s, time: slot.time}))}
                      style={{ border: `2px solid ${selected.time === slot.time ? "#0ea5e9" : slot.available ? "#e2e8f0" : "#f1f5f9"}`, borderRadius: 10, padding: "10px 0", fontSize: 13, fontWeight: 600, background: selected.time === slot.time ? "#0ea5e9" : slot.available ? "#fff" : "#f8fafc", color: selected.time === slot.time ? "#fff" : slot.available ? "#0f172a" : "#cbd5e1", cursor: slot.available ? "pointer" : "not-allowed" }}>
                      {slot.time}{!slot.available && <div style={{ fontSize: 9, marginTop: 2 }}>Booked</div>}
                    </button>
                  ))}
                </div>
              )}
              <button disabled={!selected.time} onClick={() => setStep(4)} style={{ ...primaryBtn, marginTop: 20, opacity: selected.time ? 1 : 0.4 }}>Continue →</button>
            </div>
          )}
          {step === 4 && (
            <div>
              <p style={{ fontSize: 13, color: "#64748b", marginBottom: 16, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Your Details</p>
              {[{key:"name",label:"Full Name",placeholder:"Jane Smith",type:"text"},{key:"email",label:"Email",placeholder:"jane@email.com",type:"email"},{key:"phone",label:"Phone",placeholder:"+353 87 000 0000",type:"tel"}].map(f => (
                <div key={f.key} style={{ marginBottom: 14 }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6 }}>{f.label}</label>
                  <input type={f.type} value={form[f.key]} onChange={e => setForm(p => ({...p, [f.key]: e.target.value}))} placeholder={f.placeholder} style={inputStyle}/>
                </div>
              ))}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6 }}>Notes (optional)</label>
                <textarea value={form.notes} onChange={e => setForm(p => ({...p, notes: e.target.value}))} placeholder="Allergies, concerns..." rows={3} style={{ ...inputStyle, resize: "none" }}/>
              </div>
              <button disabled={!form.name||!form.email||!form.phone} onClick={() => setStep(5)} style={{ ...primaryBtn, opacity: form.name&&form.email&&form.phone ? 1 : 0.4 }}>Review Booking →</button>
            </div>
          )}
          {step === 5 && (
            <div>
              <p style={{ fontSize: 13, color: "#64748b", marginBottom: 16, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Confirm Your Booking</p>
              <div style={{ background: "#f8fafc", borderRadius: 14, padding: 20, border: "1px solid #e2e8f0", marginBottom: 20 }}>
                {[["Service",services.find(s=>s.id===selected.service)?.label],["Dentist",dentists.find(d=>d.id===selected.dentist)?.name||"First Available"],["Date",selected.date?.toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"})],["Time",selected.time],["Name",form.name],["Email",form.email],["Phone",form.phone]].map(([k,v]) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #f1f5f9", fontSize: 13 }}>
                    <span style={{ color: "#94a3b8", fontWeight: 500 }}>{k}</span>
                    <span style={{ color: "#0f172a", fontWeight: 600, textAlign: "right", maxWidth: "60%" }}>{v}</span>
                  </div>
                ))}
              </div>
              {bookingError && <p style={{ fontSize: 13, color: "#f43f5e", background: "#fff1f2", border: "1px solid #fecdd3", borderRadius: 8, padding: "10px 12px", marginBottom: 14 }}>⚠️ {bookingError}</p>}
              <p style={{ fontSize: 12, color: "#94a3b8", marginBottom: 16, lineHeight: 1.5 }}>Cancel or reschedule up to 24 hours before your appointment.</p>
              <button onClick={handleConfirm} disabled={submitting} style={{ ...primaryBtn, opacity: submitting ? 0.7 : 1 }}>
                {submitting ? "Saving..." : "✓ Confirm Appointment"}
              </button>
            </div>
          )}
          {step > 0 && <button onClick={() => setStep(s => s-1)} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 13, marginTop: 14, padding: 0 }}>← Back</button>}
        </div>
        <div style={{ borderTop: "1px solid #f1f5f9", padding: "12px 28px", display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontSize: 11, color: "#cbd5e1" }}>🔒 Secure booking</span>
          <span style={{ fontSize: 11, color: "#cbd5e1" }}>Powered by DentaBook AI</span>
        </div>
      </div>
    </div>
  );
}