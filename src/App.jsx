import { useState, useEffect, useRef } from "react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

const SUPABASE_URL = "https://tfatwczcufvmthuolfjv.supabase.co";
const SUPABASE_KEY = "sb_publishable_-S2VtEoXw1lbuSXROU4_jw_Q2JDABWP";
const ALLOWED_EMAILS = ["maolin503@gmail.com", "ramiro.olbina@gmail.com"];

async function supabaseReq(method, path, body, token) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    method,
    headers: {
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${token || SUPABASE_KEY}`,
      "Content-Type": "application/json",
      "Prefer": "return=representation",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(text);
  return text ? JSON.parse(text) : [];
}

async function signInWithGoogle() {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(window.location.origin)}`, {
    headers: { "apikey": SUPABASE_KEY }
  });
  // Redirect to Google
  const data = await res.json();
  if (data.url) window.location.href = data.url;
}

async function signInWithGoogleRedirect() {
  window.location.href = `${SUPABASE_URL}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(window.location.origin)}&apikey=${SUPABASE_KEY}`;
}

async function getSession() {
  // Check URL hash for token (after OAuth redirect)
  const hash = window.location.hash;
  if (hash && hash.includes("access_token")) {
    const params = new URLSearchParams(hash.substring(1));
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");
    if (accessToken) {
      localStorage.setItem("cm_access_token", accessToken);
      localStorage.setItem("cm_refresh_token", refreshToken || "");
      window.history.replaceState({}, document.title, window.location.pathname);
      return accessToken;
    }
  }
  return localStorage.getItem("cm_access_token");
}

async function getUserFromToken(token) {
  if (!token) return null;
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${token}` }
    });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

async function signOut() {
  const token = localStorage.getItem("cm_access_token");
  if (token) {
    await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
      method: "POST",
      headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${token}` }
    }).catch(()=>{});
  }
  localStorage.removeItem("cm_access_token");
  localStorage.removeItem("cm_refresh_token");
}

const STATUS_CFG = {
  proceso:   { label:"En proceso",  labelEn:"In process",  color:"#38bdf8", bg:"rgba(56,189,248,0.15)" },
  pendiente: { label:"Pendiente",   labelEn:"Pending",     color:"#fb923c", bg:"rgba(251,146,60,0.15)" },
  aprobado:  { label:"Aprobado",    labelEn:"Approved",    color:"#4ade80", bg:"rgba(74,222,128,0.15)" },
  rechazado: { label:"Rechazado",   labelEn:"Rejected",    color:"#f87171", bg:"rgba(248,113,113,0.15)" },
};
const TYPE_CFG = {
  permiso:      { label:"Permiso trabajo", labelEn:"Work permit",  color:"#c084fc", bg:"rgba(192,132,252,0.15)" },
  residencia:   { label:"Residencia",      labelEn:"Residency",    color:"#34d399", bg:"rgba(52,211,153,0.15)" },
  contabilidad: { label:"Contabilidad",    labelEn:"Accounting",   color:"#fbbf24", bg:"rgba(251,191,36,0.15)" },
};
const REQUIRED_DOCS = {
  permiso: ["Pasaporte vigente","Foto reciente","Contrato de trabajo","Carta del empleador","Certificado médico","Antecedentes penales","Formulario de solicitud","Comprobante de pago"],
  residencia: ["Pasaporte vigente","Foto reciente","Certificado de nacimiento","Antecedentes penales","Comprobante de ingresos","Seguro médico","Formulario de solicitud","Comprobante de domicilio","Comprobante de pago"],
  contabilidad: ["Registro mercantil","RIF o número fiscal","Estados de cuenta","Facturas del período","Nómina de empleados","Contrato de servicios"],
};

async function compressImage(dataUrl, maxWidth=1200, quality=0.85) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let w=img.width, h=img.height;
      if(w>maxWidth){h=Math.round(h*maxWidth/w);w=maxWidth;}
      canvas.width=w; canvas.height=h;
      const ctx=canvas.getContext("2d");
      ctx.fillStyle="#fff"; ctx.fillRect(0,0,w,h);
      ctx.drawImage(img,0,0,w,h);
      resolve(canvas.toDataURL("image/jpeg",quality));
    };
    img.onerror=()=>resolve(dataUrl);
    img.src=dataUrl;
  });
}

function exportToPDF(client, lang) {
  const t=(es,en)=>lang==="es"?es:en;
  const debt=(client.total||0)-(client.paid||0);
  const docs=client.documents||[];
  const required=REQUIRED_DOCS[client.type]||[];
  const docsList=required.map(doc=>{
    const found=docs.includes(doc);
    return `<tr><td style="padding:6px 10px;border-bottom:1px solid #eee">${doc}</td><td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:center;color:${found?"#16a34a":"#dc2626"}">${found?"✓":"✗"}</td></tr>`;
  }).join("");
  const html=`<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
  body{font-family:Arial,sans-serif;color:#1a1a1a;margin:0}
  .header{background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;padding:28px 36px;display:flex;justify-content:space-between;align-items:center}
  .logo{font-size:22px;font-weight:800}.logo-sub{font-size:10px;color:rgba(255,255,255,0.7);text-transform:uppercase;letter-spacing:2px;margin-top:3px}
  .content{padding:28px 36px}.section{margin-bottom:24px}
  .section-title{font-size:11px;text-transform:uppercase;letter-spacing:2px;color:#6366f1;margin-bottom:12px;padding-bottom:5px;border-bottom:2px solid #f0f0f0}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
  .field{background:#f8f8ff;padding:10px 12px;border-radius:8px;border-left:3px solid #6366f1}
  .field-label{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#888;margin-bottom:2px}
  .field-value{font-size:13px;font-weight:500}
  table{width:100%;border-collapse:collapse}th{background:#f0f0ff;padding:7px 10px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#6366f1}
  .footer{background:#f8f8ff;padding:14px 36px;text-align:center;font-size:11px;color:#888;border-top:2px solid #6366f1}
  @media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}</style></head><body>
  <div class="header"><div><div class="logo">CuraManage</div><div class="logo-sub">Curaçao · Gestión Integral</div></div>
  <div style="text-align:right"><div style="font-size:11px;color:rgba(255,255,255,0.7)">${new Date().toLocaleDateString("es")}</div><div style="font-size:18px;font-weight:700">${client.client_id||""}</div></div></div>
  <div class="content">
  <div class="section"><div class="section-title">${t("Información personal","Personal info")}</div><div class="grid">
  <div class="field"><div class="field-label">${t("Nombre","Name")}</div><div class="field-value">${client.name||"—"}</div></div>
  <div class="field"><div class="field-label">${t("Nacionalidad","Nationality")}</div><div class="field-value">${client.nationality||"—"}</div></div>
  <div class="field"><div class="field-label">${t("Nacimiento","Birthday")}</div><div class="field-value">${client.birthdate||"—"}</div></div>
  <div class="field"><div class="field-label">${t("Pasaporte","Passport")}</div><div class="field-value">${client.passport||"—"}</div></div>
  <div class="field"><div class="field-label">${t("Teléfono","Phone")}</div><div class="field-value">${client.phone||"—"}</div></div>
  <div class="field"><div class="field-label">Email</div><div class="field-value">${client.email||"—"}</div></div>
  </div></div>
  <div class="section"><div class="section-title">${t("Trámite","Case")}</div><div class="grid">
  <div class="field"><div class="field-label">${t("Tipo","Type")}</div><div class="field-value">${TYPE_CFG[client.type]?.label||client.type}</div></div>
  <div class="field"><div class="field-label">${t("Estatus","Status")}</div><div class="field-value">${STATUS_CFG[client.status]?.label||client.status}</div></div>
  <div class="field"><div class="field-label">${t("Vencimiento","Expiry")}</div><div class="field-value">${client.expiry||"—"}</div></div>
  <div class="field"><div class="field-label">${t("Notas","Notes")}</div><div class="field-value">${client.notes||"—"}</div></div>
  </div></div>
  <div class="section"><div class="section-title">${t("Pagos","Payments")}</div><div class="grid">
  <div class="field"><div class="field-label">${t("Total","Total")}</div><div class="field-value">ANG ${client.total||0}</div></div>
  <div class="field"><div class="field-label">${t("Pagado","Paid")}</div><div class="field-value" style="color:#16a34a">ANG ${client.paid||0}</div></div>
  <div class="field"><div class="field-label">${t("Saldo","Balance")}</div><div class="field-value" style="color:${debt<=0?"#16a34a":"#dc2626"}">${debt<=0?"✓ Pagado":"ANG "+debt}</div></div>
  </div></div>
  ${required.length>0?`<div class="section"><div class="section-title">${t("Documentos","Documents")}</div>
  <table><thead><tr><th>${t("Documento","Document")}</th><th>${t("Estado","Status")}</th></tr></thead><tbody>${docsList}</tbody></table></div>`:""}
  </div><div class="footer">CuraManage · ${new Date().getFullYear()}</div></body></html>`;
  const win=window.open("","_blank");
  win.document.write(html);
  win.document.close();
  setTimeout(()=>win.print(),500);
}

// ── LOGIN SCREEN ─────────────────────────────────────────────────────────────
function LoginScreen({onLogin}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleGoogleLogin() {
    setLoading(true);
    setError("");
    try {
      await signInWithGoogleRedirect();
    } catch(e) {
      setError("Error al iniciar sesión. Intenta de nuevo.");
      setLoading(false);
    }
  }

  return(
    <div style={{minHeight:"100vh",background:"#0a0a0f",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'DM Sans',system-ui,sans-serif",padding:20}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600&display=swap');`}</style>
      <div style={{width:"100%",maxWidth:400}}>
        {/* Logo */}
        <div style={{textAlign:"center",marginBottom:40}}>
          <div style={{fontFamily:"'Syne',system-ui,sans-serif",fontWeight:800,fontSize:36,background:"linear-gradient(135deg,#c084fc,#38bdf8)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",marginBottom:8}}>
            CuraManage
          </div>
          <div style={{fontSize:13,color:"rgba(255,255,255,0.4)",letterSpacing:"0.15em",textTransform:"uppercase"}}>
            Curaçao · Gestión Integral
          </div>
        </div>

        {/* Card */}
        <div style={{background:"linear-gradient(135deg,rgba(26,26,46,0.95),rgba(22,33,62,0.95))",border:"1px solid rgba(99,102,241,0.3)",borderRadius:20,padding:"36px 32px",boxShadow:"0 25px 50px rgba(0,0,0,0.5)"}}>
          <div style={{textAlign:"center",marginBottom:28}}>
            <div style={{fontSize:16,fontWeight:600,color:"#f0f0f5",marginBottom:8}}>Bienvenida 👋</div>
            <div style={{fontSize:13,color:"rgba(255,255,255,0.45)",lineHeight:1.6}}>
              Inicia sesión con tu cuenta de Google para acceder al sistema
            </div>
          </div>

          {error&&<div style={{background:"rgba(248,113,113,0.1)",border:"1px solid rgba(248,113,113,0.3)",borderRadius:10,padding:"10px 14px",fontSize:12,color:"#f87171",marginBottom:16,textAlign:"center"}}>{error}</div>}

          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            style={{width:"100%",padding:"14px 20px",borderRadius:12,fontSize:14,fontWeight:600,cursor:loading?"not-allowed":"pointer",background:loading?"rgba(255,255,255,0.05)":"#fff",color:loading?"rgba(255,255,255,0.3)":"#1a1a1a",border:"none",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:12,transition:"all 0.2s",boxShadow:loading?"none":"0 4px 15px rgba(0,0,0,0.3)"}}>
            {loading?(
              <span style={{fontSize:18,animation:"spin 1s linear infinite",display:"inline-block"}}>⟳</span>
            ):(
              <svg width="20" height="20" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
            )}
            {loading?"Iniciando sesión...":"Continuar con Google"}
          </button>

          <div style={{marginTop:20,padding:"12px 14px",background:"rgba(99,102,241,0.08)",borderRadius:10,border:"1px solid rgba(99,102,241,0.2)"}}>
            <div style={{fontSize:11,color:"rgba(255,255,255,0.4)",textAlign:"center",lineHeight:1.6}}>
              🔒 Solo usuarios autorizados pueden acceder.<br/>
              Los datos están protegidos con cifrado SSL.
            </div>
          </div>
        </div>

        <div style={{textAlign:"center",marginTop:20,fontSize:11,color:"rgba(255,255,255,0.2)"}}>
          CuraManage © {new Date().getFullYear()} · Todos los derechos reservados
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// ── UNAUTHORIZED SCREEN ───────────────────────────────────────────────────────
function UnauthorizedScreen({email, onSignOut}) {
  return(
    <div style={{minHeight:"100vh",background:"#0a0a0f",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'DM Sans',system-ui,sans-serif",padding:20}}>
      <div style={{width:"100%",maxWidth:400,textAlign:"center"}}>
        <div style={{fontSize:52,marginBottom:16}}>🚫</div>
        <div style={{fontFamily:"'Syne',system-ui,sans-serif",fontWeight:700,fontSize:22,color:"#f0f0f5",marginBottom:8}}>Acceso no autorizado</div>
        <div style={{fontSize:13,color:"rgba(255,255,255,0.45)",marginBottom:8}}>La cuenta <strong style={{color:"#f87171"}}>{email}</strong> no tiene acceso a este sistema.</div>
        <div style={{fontSize:12,color:"rgba(255,255,255,0.3)",marginBottom:28}}>Contacta al administrador si crees que esto es un error.</div>
        <button onClick={onSignOut} style={{padding:"12px 24px",borderRadius:12,fontSize:13,fontWeight:600,cursor:"pointer",background:"rgba(248,113,113,0.1)",color:"#f87171",border:"1px solid rgba(248,113,113,0.3)",fontFamily:"inherit"}}>
          Cerrar sesión e intentar con otra cuenta
        </button>
      </div>
    </div>
  );
}

// ── MAIN APP ─────────────────────────────────────────────────────────────────
export default function CuraManage() {
  const [authState, setAuthState] = useState("loading"); // loading | login | unauthorized | app
  const [currentUser, setCurrentUser] = useState(null);
  const [accessToken, setAccessToken] = useState(null);
  const [lang, setLang] = useState("es");
  const [section, setSection] = useState("dashboard");
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [modal, setModal] = useState(null);
  const [clientModal, setClientModal] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [showAI, setShowAI] = useState(false);
  const [aiMsgs, setAiMsgs] = useState([{ role:"assistant", content:"¡Hola! Soy tu asistente CuraManage 🚀\n\nConozco todos tus clientes. Puedo:\n• Actualizar estatus: \"marca a Juan como aprobado\"\n• Registrar pagos: \"agrega pago de ANG 500 a CUR-002\"\n• Redactar cartas y analizar casos\n\n¿Qué necesitas?" }]);
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [passportModal, setPassportModal] = useState(false);
  const [passportPreview, setPassportPreview] = useState(null);
  const [scanStep, setScanStep] = useState("choose");
  const canvasRef = useRef(null);
  const aiRef = useRef(null);
  const fileInputRef = useRef(null);

  const t = (es,en) => lang==="es"?es:en;

  // ── AUTH ──────────────────────────────────────────────────────────────────
  useEffect(()=>{
    async function checkAuth() {
      const token = await getSession();
      if (!token) { setAuthState("login"); return; }
      const user = await getUserFromToken(token);
      if (!user) { setAuthState("login"); return; }
      setCurrentUser(user);
      setAccessToken(token);
      // Check if email is authorized
      if (!ALLOWED_EMAILS.includes(user.email)) {
        setAuthState("unauthorized");
        return;
      }
      setAuthState("app");
    }
    checkAuth();
  },[]);

  async function handleSignOut() {
    await signOut();
    setCurrentUser(null);
    setAccessToken(null);
    setAuthState("login");
  }

  function showToast(msg, ok=true) {
    setToast({msg,ok});
    setTimeout(()=>setToast(null),4000);
  }

  async function load() {
    try {
      setLoading(true);
      const data = await supabaseReq("GET", "/clients?order=created_at.desc&select=*", null, accessToken);
      setClients(data);
    } catch(e) { showToast("Error: "+e.message, false); }
    finally { setLoading(false); }
  }

  useEffect(()=>{ if(authState==="app") load(); },[authState]);
  useEffect(()=>{ if(aiRef.current) aiRef.current.scrollTop=aiRef.current.scrollHeight; },[aiMsgs,aiLoading]);

  const totalDebt = clients.reduce((a,c)=>a+Math.max(0,(c.total||0)-(c.paid||0)),0);
  const totalPaid = clients.reduce((a,c)=>a+(c.paid||0),0);
  const totalBilled = clients.reduce((a,c)=>a+(c.total||0),0);
  const expiring = clients.filter(c=>c.expiry&&(new Date(c.expiry)-Date.now())<30*86400000&&c.status!=="aprobado").length;
  const statusData = Object.entries(STATUS_CFG).map(([k,v])=>({name:lang==="es"?v.label:v.labelEn,value:clients.filter(c=>c.status===k).length,color:v.color})).filter(d=>d.value>0);
  const typeData = Object.entries(TYPE_CFG).map(([k,v])=>({name:lang==="es"?v.label:v.labelEn,value:clients.filter(c=>c.type===k).length,color:v.color})).filter(d=>d.value>0);
  const payData = [{name:t("Cobrado","Collected"),value:totalPaid,fill:"#4ade80"},{name:t("Pendiente","Pending"),value:totalDebt,fill:"#f87171"}];

  const notifs = [];
  clients.forEach(c=>{
    if(!c.expiry||c.status==="aprobado") return;
    const days=Math.round((new Date(c.expiry)-Date.now())/86400000);
    if(days<0) notifs.push({urgent:true,icon:"🔴",title:`${c.name} — ${t("Vencido","Expired")}`,sub:`${Math.abs(days)} ${t("días","days")} · ${c.client_id}`,date:c.expiry,client:c});
    else if(days<=7) notifs.push({urgent:true,icon:"⚠️",title:`${c.name} — ${t(`Vence en ${days}d`,`Exp. in ${days}d`)}`,sub:`${t("Urgente","Urgent")} · ${c.client_id}`,date:c.expiry,client:c});
    else if(days<=30) notifs.push({urgent:false,icon:"🟡",title:`${c.name}`,sub:`${t(`Vence en ${days} días`,`In ${days} days`)} · ${c.client_id}`,date:c.expiry,client:c});
    const debt=(c.total||0)-(c.paid||0);
    if(debt>0&&debt===c.total) notifs.push({urgent:false,icon:"💰",title:`${c.name}`,sub:`ANG ${debt} ${t("sin pagos","no payments")}`,date:"",client:c});
  });

  const filtered = clients.filter(c=>{
    const q=search.toLowerCase();
    return(!q||c.name.toLowerCase().includes(q)||(c.client_id||"").toLowerCase().includes(q)||(c.email||"").toLowerCase().includes(q))
      &&(!filterType||c.type===filterType)&&(!filterStatus||c.status===filterStatus);
  });

  // ── PASSPORT ──────────────────────────────────────────────────────────────
  async function handleFileUpload(e) {
    const file=e.target.files[0]; if(!file) return;
    e.target.value="";
    if(file.type==="application/pdf"||file.name.toLowerCase().endsWith(".pdf")) {
      setScanStep("scanning");
      try {
        const arrayBuffer=await file.arrayBuffer();
        const bytes=new Uint8Array(arrayBuffer);
        let binary="";
        const chunkSize=8192;
        for(let i=0;i<bytes.byteLength;i+=chunkSize) binary+=String.fromCharCode(...bytes.subarray(i,i+chunkSize));
        const base64pdf=btoa(binary);
        const res=await fetch("/.netlify/functions/claude",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({mode:"passport_scan",image:base64pdf,isPDF:true})});
        const data=await res.json();
        const rawText=data.content?.[0]?.text||"{}";
        let parsed={};
        try{const cleaned=rawText.replace(/```json|```/g,"").trim();const match=cleaned.match(/\{[\s\S]*\}/);if(match)parsed=JSON.parse(match[0]);}catch{}
        if(!parsed.name&&!parsed.passport) throw new Error(t("No se pudieron extraer datos. Intenta con una imagen JPG.","Could not extract data. Try a JPG."));
        const nextId=`CUR-${String(clients.length+1).padStart(3,"0")}`;
        setForm({client_id:nextId,name:parsed.name||"",nationality:parsed.nationality||"",birthdate:parsed.birthdate||"",passport:parsed.passport||"",expiry:"",type:"permiso",status:"proceso",total:"",paid:"0",email:"",phone:"",entry_date:"",emergency_contact:"",address:"",notes:`Escaneado ${new Date().toLocaleDateString("es")}. Pasaporte vence: ${parsed.expiry||"N/A"}${parsed.gender?` · ${parsed.gender}`:""}`,documents:["Pasaporte vigente"]});
        closePassportModal(); setModal({mode:"add"});
        showToast(t("✓ Datos extraídos","✓ Data extracted"));
      } catch(err){showToast(err.message,false);setScanStep("choose");}
      return;
    }
    const reader=new FileReader();
    reader.onload=ev=>{setPassportPreview(ev.target.result);setScanStep("preview");};
    reader.readAsDataURL(file);
  }

  async function scanPassport() {
    if(!passportPreview) return;
    setScanStep("scanning");
    try {
      const compressed=await compressImage(passportPreview,800,0.65);
      const res=await fetch("/.netlify/functions/claude",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({mode:"passport_scan",image:compressed})});
      const data=await res.json();
      const rawText=data.content?.[0]?.text||"{}";
      let parsed={};
      try{const cleaned=rawText.replace(/```json|```/g,"").trim();const match=cleaned.match(/\{[\s\S]*\}/);if(match)parsed=JSON.parse(match[0]);}catch{}
      if(!parsed.name&&!parsed.passport) throw new Error(t("No se pudieron extraer datos.","Could not extract data."));
      const nextId=`CUR-${String(clients.length+1).padStart(3,"0")}`;
      setForm({client_id:nextId,name:parsed.name||"",nationality:parsed.nationality||"",birthdate:parsed.birthdate||"",passport:parsed.passport||"",expiry:"",type:"permiso",status:"proceso",total:"",paid:"0",email:"",phone:"",entry_date:"",emergency_contact:"",address:"",notes:`Escaneado ${new Date().toLocaleDateString("es")}. Pasaporte vence: ${parsed.expiry||"N/A"}`,documents:["Pasaporte vigente"]});
      closePassportModal(); setModal({mode:"add"});
      showToast(t("✓ Datos extraídos","✓ Data extracted"));
    } catch(e){showToast(e.message,false);setScanStep("preview");}
  }

  function openPassportModal(){setPassportModal(true);setPassportPreview(null);setScanStep("choose");}
  function closePassportModal(){setPassportModal(false);setPassportPreview(null);setScanStep("choose");}

  // ── FORM ──────────────────────────────────────────────────────────────────
  function openAdd(){setForm({client_id:`CUR-${String(clients.length+1).padStart(3,"0")}`,type:"permiso",status:"proceso",total:"",paid:"0",expiry:"",name:"",email:"",phone:"",nationality:"",birthdate:"",passport:"",entry_date:"",emergency_contact:"",address:"",notes:"",documents:[]});setModal({mode:"add"});}
  function openEdit(c){setForm({...c,total:String(c.total||""),paid:String(c.paid||""),expiry:c.expiry||"",birthdate:c.birthdate||"",entry_date:c.entry_date||"",documents:c.documents||[]});setModal({mode:"edit",id:c.id});}

  async function saveClient(){
    if(!form.name?.trim()){showToast(t("Nombre requerido","Name required"),false);return;}
    setSaving(true);
    const data={client_id:form.client_id,name:form.name,type:form.type,status:form.status,expiry:form.expiry||null,total:parseFloat(form.total)||0,paid:parseFloat(form.paid)||0,email:form.email,notes:form.notes,phone:form.phone,nationality:form.nationality,birthdate:form.birthdate||null,passport:form.passport,entry_date:form.entry_date||null,emergency_contact:form.emergency_contact,address:form.address,documents:form.documents||[]};
    try{
      if(modal.mode==="add"){await supabaseReq("POST","/clients",data,accessToken);showToast(t("Cliente guardado ✓","Client saved ✓"));}
      else{await supabaseReq("PATCH",`/clients?id=eq.${modal.id}`,data,accessToken);showToast(t("Actualizado ✓","Updated ✓"));}
      await load();setModal(null);
    }catch(e){showToast("Error: "+e.message,false);}
    setSaving(false);
  }

  async function deleteClient(){
    if(!window.confirm(t("¿Eliminar?","Delete?"))) return;
    try{await supabaseReq("DELETE",`/clients?id=eq.${modal.id}`,null,accessToken);showToast(t("Eliminado","Deleted"));await load();setModal(null);}
    catch{showToast("Error",false);}
  }

  function toggleDoc(doc){const docs=form.documents||[];setForm(p=>({...p,documents:docs.includes(doc)?docs.filter(d=>d!==doc):[...docs,doc]}));}
  function openGmail(c){const sub=encodeURIComponent(`CuraManage - ${c.client_id} - ${c.name}`);const body=encodeURIComponent(`Estimado/a ${c.name},\n\nMe comunico en relación a su trámite.\n\nSaludos,\nCuraManage`);window.open(`https://mail.google.com/mail/?view=cm&to=${c.email||""}&su=${sub}&body=${body}`,"_blank");}

  // ── AI ────────────────────────────────────────────────────────────────────
  function buildSystemPrompt(){
    const list=clients.map(c=>`- ${c.name} | ${c.client_id} | ${c.type} | ${c.status} | vence:${c.expiry||"N/A"} | deuda:ANG ${(c.total||0)-(c.paid||0)}`).join("\n");
    return `Eres el asistente IA de CuraManage, Curaçao. Gestión de permisos de trabajo, residencia y contabilidad.\n\nCLIENTES:\n${list}\n\nACCIONES:\n[ACTION:{"type":"update_status","client_id":"CUR-XXX","value":"proceso|pendiente|aprobado|rechazado"}]\n[ACTION:{"type":"add_payment","client_id":"CUR-XXX","amount":500}]\n\nResponde en el idioma del usuario. Conciso y profesional.`;
  }

  async function sendAI(text){
    if(!text.trim()||aiLoading) return;
    const msg={role:"user",content:text};
    setAiMsgs(p=>[...p,msg]);setAiInput("");setAiLoading(true);
    try{
      const res=await fetch("/.netlify/functions/claude",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({system:buildSystemPrompt(),max_tokens:1000,messages:[...aiMsgs,msg].slice(-16)})});
      const data=await res.json();
      let reply=data.content?.[0]?.text||"Error.";
      const m=reply.match(/\[ACTION:(\{.*?\})\]/);
      if(m){try{const a=JSON.parse(m[1]);reply=reply.replace(/\[ACTION:\{.*?\}\]/,"").trim();setPendingAction(a);}catch{}}
      setAiMsgs(p=>[...p,{role:"assistant",content:reply}]);
    }catch{setAiMsgs(p=>[...p,{role:"assistant",content:"Error de conexión."}]);}
    setAiLoading(false);
  }

  useEffect(()=>{
    if(!pendingAction) return;
    const action=pendingAction;
    const client=clients.find(c=>c.client_id===action.client_id);
    if(!client){setPendingAction(null);return;}
    async function execute(){
      try{
        let upd={};
        if(action.type==="update_status") upd={status:action.value};
        else if(action.type==="add_payment") upd={paid:Math.min((client.paid||0)+action.amount,client.total||9999)};
        await supabaseReq("PATCH",`/clients?id=eq.${client.id}`,upd,accessToken);
        await load();showToast(`✓ ${client.name} ${t("actualizado","updated")}`);
      }catch{showToast("Error",false);}
      setPendingAction(null);
    }
    execute();
  },[pendingAction]);

  function askAbout(c){
    const debt=(c.total||0)-(c.paid||0);
    const missing=(REQUIRED_DOCS[c.type]||[]).filter(d=>!(c.documents||[]).includes(d));
    setShowAI(true);
    sendAI(`Analiza: ${c.name} (${c.client_id})\nTipo: ${c.type} | Estatus: ${c.status}\nVence: ${c.expiry||"N/A"} | Deuda: ANG ${debt}\nDocs faltantes: ${missing.length>0?missing.join(", "):"Ninguno"}\nNotas: ${c.notes||"—"}\nAnálisis y próximos pasos.`);
  }

  // ── STYLES ────────────────────────────────────────────────────────────────
  const C={
    app:{fontFamily:"'DM Sans',system-ui,sans-serif",background:"#0a0a0f",color:"#f0f0f5",fontSize:14,minHeight:"100vh"},
    sidebar:{width:220,minWidth:220,background:"linear-gradient(180deg,#1a1a2e,#16213e)",borderRight:"1px solid rgba(99,102,241,0.2)",display:"flex",flexDirection:"column",flexShrink:0,height:"100vh"},
    navItem:(a)=>({display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:10,cursor:"pointer",fontSize:13,color:a?"#fff":"rgba(255,255,255,0.5)",fontWeight:a?600:400,background:a?"linear-gradient(135deg,rgba(99,102,241,0.4),rgba(139,92,246,0.3))":"transparent",border:`1px solid ${a?"rgba(99,102,241,0.5)":"transparent"}`,userSelect:"none",transition:"all 0.12s"}),
    navBadge:{marginLeft:"auto",background:"#f87171",color:"#fff",borderRadius:10,fontSize:10,fontWeight:700,padding:"2px 7px"},
    langBtn:(a)=>({flex:1,textAlign:"center",padding:"6px 0",borderRadius:8,fontSize:11,fontWeight:600,cursor:"pointer",color:a?"#fff":"rgba(255,255,255,0.4)",background:a?"linear-gradient(135deg,#6366f1,#8b5cf6)":"transparent"}),
    topbar:{padding:"12px 16px",borderBottom:"1px solid rgba(99,102,241,0.15)",background:"rgba(26,26,46,0.98)",display:"flex",alignItems:"center",gap:10,flexShrink:0},
    btnP:{padding:"8px 14px",borderRadius:10,fontSize:12,fontWeight:600,cursor:"pointer",background:"linear-gradient(135deg,#6366f1,#8b5cf6)",color:"#fff",border:"none",fontFamily:"inherit"},
    btnG:{padding:"7px 12px",borderRadius:10,fontSize:12,fontWeight:500,cursor:"pointer",background:"rgba(255,255,255,0.05)",color:"rgba(255,255,255,0.6)",border:"1px solid rgba(255,255,255,0.1)",fontFamily:"inherit"},
    btnD:{padding:"7px 12px",borderRadius:10,fontSize:12,cursor:"pointer",background:"rgba(248,113,113,0.1)",color:"#f87171",border:"1px solid rgba(248,113,113,0.3)",fontFamily:"inherit",fontWeight:500},
    btnS:{padding:"7px 12px",borderRadius:10,fontSize:12,cursor:"pointer",background:"rgba(74,222,128,0.1)",color:"#4ade80",border:"1px solid rgba(74,222,128,0.3)",fontFamily:"inherit",fontWeight:500},
    card:{background:"linear-gradient(135deg,rgba(26,26,46,0.9),rgba(22,33,62,0.9))",border:"1px solid rgba(99,102,241,0.2)",borderRadius:14,padding:"14px 16px"},
    badge:(c)=>({display:"inline-block",padding:"2px 8px",borderRadius:20,fontSize:11,fontWeight:600,color:c.color,background:c.bg,whiteSpace:"nowrap",border:`1px solid ${c.color}33`}),
    input:{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(99,102,241,0.3)",borderRadius:10,padding:"11px 14px",fontSize:14,color:"#f0f0f5",fontFamily:"inherit",outline:"none",width:"100%"},
    searchBar:{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(99,102,241,0.3)",borderRadius:10,padding:"8px 12px",fontSize:13,color:"#f0f0f5",fontFamily:"inherit",outline:"none",flex:1,minWidth:100},
    filterSel:{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(99,102,241,0.3)",borderRadius:10,padding:"7px 10px",fontSize:12,color:"rgba(255,255,255,0.6)",fontFamily:"inherit",outline:"none",cursor:"pointer"},
    overlay:{position:"fixed",inset:0,background:"rgba(0,0,0,0.88)",backdropFilter:"blur(6px)",zIndex:100,display:"flex",alignItems:"flex-end",justifyContent:"center"},
    modal:{background:"linear-gradient(135deg,#1a1a2e,#16213e)",border:"1px solid rgba(99,102,241,0.35)",borderRadius:"20px 20px 0 0",width:"100%",maxHeight:"94vh",overflowY:"auto"},
    mHead:{padding:"18px 20px 14px",borderBottom:"1px solid rgba(99,102,241,0.2)",display:"flex",alignItems:"center",background:"rgba(99,102,241,0.08)",position:"sticky",top:0,zIndex:1},
    mClose:{marginLeft:"auto",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",color:"rgba(255,255,255,0.5)",width:32,height:32,borderRadius:8,cursor:"pointer",fontSize:18,display:"flex",alignItems:"center",justifyContent:"center"},
    mFoot:{padding:"14px 20px 20px",display:"flex",gap:8,justifyContent:"flex-end",flexWrap:"wrap",borderTop:"1px solid rgba(99,102,241,0.15)",position:"sticky",bottom:0,background:"#16213e",zIndex:1},
    fLabel:{fontSize:10,color:"rgba(192,132,252,0.7)",textTransform:"uppercase",letterSpacing:"0.08em",display:"block",marginBottom:5},
    aiPanel:{width:320,minWidth:320,background:"linear-gradient(180deg,#1a1a2e,#16213e)",borderLeft:"1px solid rgba(99,102,241,0.2)",display:"flex",flexDirection:"column",height:"100vh"},
    aiDrawer:{position:"fixed",bottom:65,left:0,right:0,height:"72vh",background:"linear-gradient(180deg,#1a1a2e,#16213e)",borderTop:"2px solid rgba(99,102,241,0.4)",display:"flex",flexDirection:"column",zIndex:40,transform:showAI?"translateY(0)":"translateY(100%)",transition:"transform 0.3s ease"},
    aiMsg:(u)=>({alignSelf:u?"flex-end":"flex-start",background:u?"linear-gradient(135deg,#6366f1,#8b5cf6)":"rgba(255,255,255,0.06)",border:u?"none":"1px solid rgba(99,102,241,0.2)",padding:"10px 13px",borderRadius:u?"12px 12px 2px 12px":"12px 12px 12px 2px",fontSize:13,lineHeight:1.55,maxWidth:"90%",whiteSpace:"pre-wrap",color:u?"#fff":"#f0f0f5"}),
    mobileNav:{position:"fixed",bottom:0,left:0,right:0,background:"linear-gradient(180deg,#1a1a2e,#16213e)",borderTop:"1px solid rgba(99,102,241,0.3)",display:"flex",zIndex:50},
    mNavBtn:(a)=>({flex:1,display:"flex",flexDirection:"column",alignItems:"center",padding:"10px 4px 8px",cursor:"pointer",color:a?"#c084fc":"rgba(255,255,255,0.4)",fontSize:10,fontWeight:a?600:400,gap:3,background:"transparent",border:"none",fontFamily:"inherit",position:"relative"}),
    toast:(ok)=>({position:"fixed",top:16,left:"50%",transform:"translateX(-50%)",zIndex:300,background:ok?"rgba(74,222,128,0.15)":"rgba(248,113,113,0.15)",border:`1px solid ${ok?"#4ade80":"#f87171"}`,color:ok?"#4ade80":"#f87171",padding:"12px 20px",borderRadius:12,fontSize:13,fontWeight:600,backdropFilter:"blur(10px)",whiteSpace:"nowrap",maxWidth:"90vw",textAlign:"center"}),
  };

  function Badge({cfg}){return <span style={C.badge(cfg)}>{lang==="es"?cfg.label:cfg.labelEn}</span>;}

  function ClientCard({c}){
    const debt=(c.total||0)-(c.paid||0);
    const urgent=c.expiry&&(new Date(c.expiry)-Date.now())<30*86400000&&c.status!=="aprobado";
    const pct=c.total?Math.round((c.paid/c.total)*100):0;
    const col=pct===100?"#4ade80":pct>=50?"#fb923c":"#f87171";
    const missing=(REQUIRED_DOCS[c.type]||[]).filter(d=>!(c.documents||[]).includes(d)).length;
    return(
      <div style={{...C.card,marginBottom:10,cursor:"pointer"}} onClick={()=>setClientModal(c)}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
          <div><div style={{fontWeight:600,fontSize:15,color:"#c084fc"}}>{c.name}</div><div style={{fontSize:11,color:"rgba(255,255,255,0.35)",marginTop:1}}>{c.client_id}{c.nationality?` · ${c.nationality}`:""}</div></div>
          <Badge cfg={STATUS_CFG[c.status]||{label:c.status,labelEn:c.status,color:"#888",bg:"#222"}}/>
        </div>
        <div style={{display:"flex",gap:6,marginBottom:10,flexWrap:"wrap"}}>
          <Badge cfg={TYPE_CFG[c.type]||{label:c.type,labelEn:c.type,color:"#888",bg:"#222"}}/>
          {c.expiry&&<span style={{fontSize:11,color:urgent?"#f87171":"rgba(255,255,255,0.35)",padding:"2px 8px",borderRadius:20,border:`1px solid ${urgent?"rgba(248,113,113,0.3)":"rgba(255,255,255,0.1)"}`}}>{new Date(c.expiry).toLocaleDateString("es",{day:"2-digit",month:"short",year:"2-digit"})}{urgent?" ⚠":""}</span>}
          {missing>0&&<span style={{fontSize:11,color:"#f87171",padding:"2px 8px",borderRadius:20,border:"1px solid rgba(248,113,113,0.3)"}}>⚠ {missing} docs</span>}
        </div>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{flex:1}}>
            <div style={{height:4,background:"rgba(255,255,255,0.08)",borderRadius:2,overflow:"hidden"}}><div style={{width:`${pct}%`,height:"100%",background:col,borderRadius:2,transition:"width 0.3s"}}/></div>
            <div style={{fontSize:10,color:"rgba(255,255,255,0.3)",marginTop:3}}>{pct}% {t("pagado","paid")} · {debt>0?`ANG ${debt} ${t("pendiente","pending")}`:"✓ al día"}</div>
          </div>
          <div style={{display:"flex",gap:6}} onClick={e=>e.stopPropagation()}>
            <button onClick={()=>openEdit(c)} style={{...C.btnG,padding:"5px 10px",fontSize:12}}>✎</button>
            <button onClick={()=>askAbout(c)} style={{...C.btnG,padding:"5px 10px",fontSize:12}}>✦</button>
          </div>
        </div>
      </div>
    );
  }

  function DRow({c}){
    const debt=(c.total||0)-(c.paid||0);
    const pct=c.total?Math.round((c.paid/c.total)*100):0;
    const col=pct===100?"#4ade80":pct>=50?"#fb923c":"#f87171";
    const urgent=c.expiry&&(new Date(c.expiry)-Date.now())<30*86400000&&c.status!=="aprobado";
    return(
      <div style={{display:"grid",gridTemplateColumns:"2fr 1.2fr 1.1fr 1fr 70px 80px 100px",borderBottom:"1px solid rgba(99,102,241,0.08)",alignItems:"center",transition:"background 0.1s",cursor:"pointer"}} onMouseEnter={e=>e.currentTarget.style.background="rgba(99,102,241,0.06)"} onMouseLeave={e=>e.currentTarget.style.background="transparent"} onClick={()=>setClientModal(c)}>
        <div style={{padding:"11px 14px"}}><div style={{fontWeight:600,color:"#c084fc",fontSize:13}}>{c.name}</div><div style={{fontSize:11,color:"rgba(255,255,255,0.3)"}}>{c.client_id}{c.nationality?` · ${c.nationality}`:""}</div></div>
        <div style={{padding:"11px 14px"}}><Badge cfg={TYPE_CFG[c.type]||{label:c.type,labelEn:c.type,color:"#888",bg:"#222"}}/></div>
        <div style={{padding:"11px 14px"}}><Badge cfg={STATUS_CFG[c.status]||{label:c.status,labelEn:c.status,color:"#888",bg:"#222"}}/></div>
        <div style={{padding:"11px 14px",fontSize:12,color:urgent?"#f87171":"rgba(255,255,255,0.35)"}}>{c.expiry?new Date(c.expiry).toLocaleDateString("es",{day:"2-digit",month:"short",year:"2-digit"}):"—"}{urgent?" ⚠":""}</div>
        <div style={{padding:"11px 14px"}}><div style={{height:4,background:"rgba(255,255,255,0.08)",borderRadius:2,overflow:"hidden",width:54}}><div style={{width:`${pct}%`,height:"100%",background:col,borderRadius:2}}/></div><div style={{fontSize:10,color:"rgba(255,255,255,0.3)",marginTop:2}}>{pct}%</div></div>
        <div style={{padding:"11px 14px",color:debt<=0?"#4ade80":"#f87171",fontWeight:600,fontSize:13}}>{debt<=0?"✓":`ANG ${debt}`}</div>
        <div style={{padding:"11px 14px",display:"flex",gap:4}} onClick={e=>e.stopPropagation()}>
          <button onClick={()=>openEdit(c)} style={{...C.btnG,padding:"3px 7px",fontSize:11}}>✎</button>
          <button onClick={()=>askAbout(c)} style={{...C.btnG,padding:"3px 7px",fontSize:11}}>✦</button>
          <button onClick={()=>exportToPDF(c,lang)} style={{...C.btnG,padding:"3px 7px",fontSize:11}}>⬇</button>
        </div>
      </div>
    );
  }

  const AI_PANEL=(
    <>
      <div style={{padding:"12px 16px",borderBottom:"1px solid rgba(99,102,241,0.2)",display:"flex",alignItems:"center",gap:8,background:"rgba(99,102,241,0.08)",flexShrink:0}}>
        <div style={{width:8,height:8,borderRadius:"50%",background:"#4ade80",boxShadow:"0 0 8px #4ade80"}}/>
        <div style={{fontFamily:"'Syne',system-ui,sans-serif",fontSize:13,fontWeight:700,background:"linear-gradient(135deg,#c084fc,#38bdf8)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>{t("Asistente IA","AI Assistant")}</div>
        <div style={{marginLeft:"auto",fontSize:10,color:"rgba(255,255,255,0.3)"}}>{clients.length} {t("clientes","clients")}</div>
        <button style={{...C.btnG,padding:"4px 8px",fontSize:12,marginLeft:4}} onClick={()=>setShowAI(false)}>✕</button>
      </div>
      <div ref={aiRef} style={{flex:1,overflowY:"auto",padding:"12px",display:"flex",flexDirection:"column",gap:8,WebkitOverflowScrolling:"touch"}}>
        {aiMsgs.map((m,i)=><div key={i} style={C.aiMsg(m.role==="user")}>{m.content}</div>)}
        {aiLoading&&<div style={{...C.aiMsg(false),padding:"10px 14px"}}><div style={{display:"flex",gap:5}}>{[0,1,2].map(i=><div key={i} style={{width:7,height:7,borderRadius:"50%",background:"rgba(192,132,252,0.5)",animation:`bounce 1.2s infinite ${i*0.2}s`}}/>)}</div></div>}
      </div>
      <div style={{padding:"8px 12px",display:"flex",gap:5,flexWrap:"wrap",borderTop:"1px solid rgba(99,102,241,0.15)",flexShrink:0}}>
        {[{es:"📋 Deudas",p:"¿Cuáles clientes tienen deuda pendiente?"},{es:"⚠ Vencimientos",p:"¿Cuáles trámites vencen pronto?"},{es:"✉ Carta permiso",p:"Redacta carta de permiso de trabajo para Curaçao."},{es:"💬 Recordatorio",p:"Redacta recordatorio de pago profesional."}].map((b,i)=>(
          <button key={i} style={{fontSize:11,padding:"5px 9px",borderRadius:20,border:"1px solid rgba(99,102,241,0.3)",background:"rgba(99,102,241,0.08)",color:"rgba(192,132,252,0.8)",cursor:"pointer",fontFamily:"inherit"}} onClick={()=>sendAI(b.p)}>{b.es}</button>
        ))}
      </div>
      <div style={{padding:"10px 12px",borderTop:"1px solid rgba(99,102,241,0.15)",display:"flex",gap:7,alignItems:"flex-end",flexShrink:0}}>
        <textarea id="ai-in" style={{flex:1,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(99,102,241,0.3)",borderRadius:10,padding:"9px 12px",fontSize:13,color:"#f0f0f5",fontFamily:"inherit",outline:"none",resize:"none",lineHeight:1.4}} value={aiInput} rows={1} placeholder={t("Escribe o da un comando...","Type or give a command...")} onChange={e=>setAiInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendAI(aiInput);}}}/>
        <button style={{width:40,height:40,borderRadius:10,background:aiLoading||!aiInput.trim()?"rgba(255,255,255,0.05)":"linear-gradient(135deg,#6366f1,#8b5cf6)",border:"none",color:aiLoading||!aiInput.trim()?"rgba(255,255,255,0.3)":"#fff",cursor:aiLoading||!aiInput.trim()?"not-allowed":"pointer",fontSize:18,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}} disabled={aiLoading||!aiInput.trim()} onClick={()=>sendAI(aiInput)}>↑</button>
      </div>
    </>
  );

  const PASSPORT_MODAL=passportModal&&(
    <div style={C.overlay} onClick={e=>{if(e.target===e.currentTarget)closePassportModal();}}>
      <div style={{...C.modal,maxHeight:"96vh"}} onClick={e=>e.stopPropagation()}>
        <div style={C.mHead}>
          <div><div style={{fontFamily:"'Syne',system-ui,sans-serif",fontSize:15,fontWeight:700}}>📷 {t("Escanear pasaporte","Scan passport")}</div></div>
          <button style={C.mClose} onClick={closePassportModal}>×</button>
        </div>
        <div style={{padding:"20px"}}>
          {scanStep==="choose"&&(
            <div>
              <button style={{...C.card,border:"2px dashed rgba(99,102,241,0.5)",background:"rgba(99,102,241,0.06)",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:14,padding:"36px 20px",borderRadius:16,width:"100%",marginBottom:20}} onClick={()=>fileInputRef.current?.click()}>
                <span style={{fontSize:56}}>🗂️</span>
                <div style={{fontWeight:700,fontSize:17}}>{t("Seleccionar archivo","Select file")}</div>
                <div style={{fontSize:13,color:"rgba(255,255,255,0.5)",textAlign:"center"}}>{t("Foto JPG/PNG o PDF del pasaporte","Passport JPG/PNG photo or PDF")}</div>
              </button>
              <input ref={fileInputRef} type="file" accept="image/*,.pdf" style={{display:"none"}} onChange={handleFileUpload}/>
            </div>
          )}
          {scanStep==="preview"&&passportPreview&&(
            <div>
              <div style={{position:"relative",marginBottom:16,borderRadius:14,overflow:"hidden",border:"2px solid rgba(99,102,241,0.4)",background:"#000",lineHeight:0}}>
                <img src={passportPreview} alt="Passport" style={{width:"100%",maxHeight:"48vh",objectFit:"contain",display:"block"}}/>
                <button style={{position:"absolute",top:10,right:10,...C.btnG,padding:"5px 10px",fontSize:12}} onClick={()=>setScanStep("choose")}>✕</button>
              </div>
              <div style={{display:"flex",gap:12}}>
                <button style={{...C.btnG,flex:1,padding:"12px",justifyContent:"center",display:"flex"}} onClick={()=>setScanStep("choose")}>← {t("Cambiar","Change")}</button>
                <button style={{flex:2,padding:"14px",borderRadius:12,fontSize:14,fontWeight:700,cursor:"pointer",background:"linear-gradient(135deg,#f59e0b,#ef4444)",color:"#fff",border:"none",fontFamily:"inherit"}} onClick={scanPassport}>🔍 {t("Extraer datos","Extract data")}</button>
              </div>
            </div>
          )}
          {scanStep==="scanning"&&(
            <div style={{textAlign:"center",padding:"30px 20px"}}>
              <div style={{fontSize:52,marginBottom:16,animation:"spin 1.5s linear infinite",display:"inline-block"}}>⟳</div>
              <div style={{fontFamily:"'Syne',system-ui,sans-serif",fontWeight:700,fontSize:18,color:"#c084fc",marginBottom:8}}>{t("Analizando documento...","Analyzing document...")}</div>
              <div style={{fontSize:13,color:"rgba(255,255,255,0.45)"}}>{t("Puede tardar 5-15 segundos.","May take 5-15 seconds.")}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const CLIENT_FOLDER=clientModal&&(
    <div style={C.overlay} onClick={e=>{if(e.target===e.currentTarget)setClientModal(null);}}>
      <div style={C.modal} onClick={e=>e.stopPropagation()}>
        <div style={C.mHead}>
          <div><div style={{fontFamily:"'Syne',system-ui,sans-serif",fontSize:15,fontWeight:700}}>📁 {clientModal.name}</div><div style={{fontSize:11,color:"rgba(255,255,255,0.35)",marginTop:2}}>{clientModal.client_id}</div></div>
          <div style={{marginLeft:"auto",display:"flex",gap:6}}>
            <button style={C.btnS} onClick={()=>exportToPDF(clientModal,lang)}>⬇</button>
            <button style={C.btnG} onClick={()=>{setClientModal(null);openGmail(clientModal);}}>✉</button>
            <button style={C.mClose} onClick={()=>setClientModal(null)}>×</button>
          </div>
        </div>
        <div style={{padding:"18px 20px"}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
            {[{label:t("Teléfono","Phone"),value:clientModal.phone},{label:t("Nacionalidad","Nationality"),value:clientModal.nationality},{label:t("Nacimiento","Birthday"),value:clientModal.birthdate},{label:t("Pasaporte","Passport"),value:clientModal.passport},{label:t("Entrada Curaçao","Entry"),value:clientModal.entry_date},{label:"Email",value:clientModal.email},{label:t("Dirección","Address"),value:clientModal.address,full:true},{label:t("Emergencia","Emergency"),value:clientModal.emergency_contact,full:true}].map((f,i)=>(
              <div key={i} style={{gridColumn:f.full?"1/-1":"auto",background:"rgba(255,255,255,0.03)",borderRadius:10,padding:"10px 12px",border:"1px solid rgba(99,102,241,0.15)"}}>
                <div style={{fontSize:10,color:"rgba(192,132,252,0.5)",textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:2}}>{f.label}</div>
                <div style={{fontSize:13}}>{f.value||<span style={{color:"rgba(255,255,255,0.2)"}}>—</span>}</div>
              </div>
            ))}
          </div>
          <div style={{fontSize:11,fontWeight:600,color:"rgba(192,132,252,0.6)",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:10}}>{t("Documentos","Documents")} — {(clientModal.documents||[]).length}/{(REQUIRED_DOCS[clientModal.type]||[]).length}</div>
          {(REQUIRED_DOCS[clientModal.type]||[]).map((doc,i)=>{
            const has=(clientModal.documents||[]).includes(doc);
            return(<div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",borderRadius:8,background:has?"rgba(74,222,128,0.05)":"rgba(248,113,113,0.04)",border:`1px solid ${has?"rgba(74,222,128,0.2)":"rgba(248,113,113,0.15)"}`,marginBottom:6}}>
              <span>{has?"✅":"❌"}</span><span style={{fontSize:13,flex:1}}>{doc}</span>
              <span style={{fontSize:11,color:has?"#4ade80":"#f87171",fontWeight:600}}>{has?"✓":t("Falta","Missing")}</span>
            </div>);
          })}
          {clientModal.notes&&<div style={{background:"rgba(255,255,255,0.03)",borderRadius:10,padding:"12px",border:"1px solid rgba(99,102,241,0.15)",marginTop:12}}>
            <div style={{fontSize:10,color:"rgba(192,132,252,0.5)",textTransform:"uppercase",marginBottom:4}}>{t("Notas","Notes")}</div>
            <div style={{fontSize:13,lineHeight:1.6}}>{clientModal.notes}</div>
          </div>}
        </div>
        <div style={C.mFoot}>
          <button style={C.btnG} onClick={()=>{setClientModal(null);askAbout(clientModal);}}>✦ IA</button>
          <button style={C.btnP} onClick={()=>{setClientModal(null);openEdit(clientModal);}}>✎ {t("Editar","Edit")}</button>
        </div>
      </div>
    </div>
  );

  const FORM_MODAL=modal&&(
    <div style={C.overlay} onClick={e=>{if(e.target===e.currentTarget)setModal(null);}}>
      <div style={C.modal} onClick={e=>e.stopPropagation()}>
        <div style={C.mHead}>
          <div><div style={{fontFamily:"'Syne',system-ui,sans-serif",fontSize:15,fontWeight:700}}>{modal.mode==="add"?t("Nuevo cliente","New client"):t("Editar cliente","Edit client")}</div></div>
          <button style={C.mClose} onClick={()=>setModal(null)}>×</button>
        </div>
        <div style={{padding:"18px 20px"}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div style={{gridColumn:"1/-1",fontSize:10,color:"rgba(192,132,252,0.6)",textTransform:"uppercase",letterSpacing:"0.1em",paddingBottom:6,borderBottom:"1px solid rgba(99,102,241,0.15)"}}>{t("Información personal","Personal info")}</div>
            {[{key:"name",label:t("Nombre completo","Full name"),ph:"JUAN PÉREZ"},{key:"client_id",label:"ID",ph:"CUR-001"},{key:"phone",label:t("Teléfono","Phone"),ph:"+5999..."},{key:"email",label:"Email",ph:"cliente@email.com"},{key:"nationality",label:t("Nacionalidad","Nationality"),ph:"Venezolana"},{key:"birthdate",label:t("Nacimiento","Birthday"),type:"date"},{key:"passport",label:t("N° Pasaporte","Passport No."),ph:"A1234567"},{key:"entry_date",label:t("Entrada Curaçao","Entry Curaçao"),type:"date"},{key:"address",label:t("Dirección","Address"),ph:"Willemstad..."},{key:"emergency_contact",label:t("Emergencia","Emergency"),ph:"Nombre · tel"}].map(f=>(
              <div key={f.key}>
                <label style={C.fLabel}>{f.label}</label>
                <input style={C.input} type={f.type||"text"} placeholder={f.ph||""} value={form[f.key]||""} onChange={e=>setForm(p=>({...p,[f.key]:e.target.value}))}/>
              </div>
            ))}
            <div style={{gridColumn:"1/-1",fontSize:10,color:"rgba(192,132,252,0.6)",textTransform:"uppercase",letterSpacing:"0.1em",paddingTop:8,paddingBottom:6,borderBottom:"1px solid rgba(99,102,241,0.15)"}}>{t("Trámite y pagos","Case & payments")}</div>
            <div>
              <label style={C.fLabel}>{t("Tipo","Type")}</label>
              <select style={{...C.input,cursor:"pointer"}} value={form.type||"permiso"} onChange={e=>setForm(p=>({...p,type:e.target.value}))}><option value="permiso">{t("Permiso trabajo","Work permit")}</option><option value="residencia">{t("Residencia","Residency")}</option><option value="contabilidad">{t("Contabilidad","Accounting")}</option></select>
            </div>
            <div>
              <label style={C.fLabel}>{t("Estatus","Status")}</label>
              <select style={{...C.input,cursor:"pointer"}} value={form.status||"proceso"} onChange={e=>setForm(p=>({...p,status:e.target.value}))}><option value="proceso">{t("En proceso","In process")}</option><option value="pendiente">{t("Pendiente","Pending")}</option><option value="aprobado">{t("Aprobado","Approved")}</option><option value="rechazado">{t("Rechazado","Rejected")}</option></select>
            </div>
            {[{key:"expiry",label:t("Vencimiento permiso","Permit expiry"),type:"date"},{key:"total",label:t("Total ANG","Total ANG"),type:"number",ph:"0"},{key:"paid",label:t("Pagado ANG","Paid ANG"),type:"number",ph:"0"}].map(f=>(
              <div key={f.key}>
                <label style={C.fLabel}>{f.label}</label>
                <input style={C.input} type={f.type||"text"} placeholder={f.ph||""} value={form[f.key]||""} onChange={e=>setForm(p=>({...p,[f.key]:e.target.value}))}/>
              </div>
            ))}
            <div style={{gridColumn:"1/-1"}}>
              <label style={C.fLabel}>{t("Notas","Notes")}</label>
              <textarea style={{...C.input,resize:"vertical",minHeight:60}} value={form.notes||""} onChange={e=>setForm(p=>({...p,notes:e.target.value}))} placeholder={t("Notas del caso...","Case notes...")}/>
            </div>
            <div style={{gridColumn:"1/-1"}}>
              <div style={{fontSize:10,color:"rgba(192,132,252,0.6)",textTransform:"uppercase",letterSpacing:"0.1em",paddingTop:6,paddingBottom:8,borderBottom:"1px solid rgba(99,102,241,0.15)",marginBottom:10}}>{t("Documentos entregados","Submitted docs")} — {(form.documents||[]).length}/{(REQUIRED_DOCS[form.type||"permiso"]||[]).length}</div>
              {(REQUIRED_DOCS[form.type||"permiso"]||[]).map((doc,i)=>{
                const has=(form.documents||[]).includes(doc);
                return(<div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:8,background:has?"rgba(74,222,128,0.05)":"rgba(248,113,113,0.04)",border:`1px solid ${has?"rgba(74,222,128,0.2)":"rgba(248,113,113,0.15)"}`,marginBottom:7,cursor:"pointer"}} onClick={()=>toggleDoc(doc)}>
                  <span style={{fontSize:16}}>{has?"✅":"⬜"}</span>
                  <span style={{fontSize:13,flex:1}}>{doc}</span>
                  <span style={{fontSize:11,color:has?"#4ade80":"rgba(255,255,255,0.3)"}}>{has?"✓":t("Tocar","Tap")}</span>
                </div>);
              })}
            </div>
          </div>
        </div>
        <div style={C.mFoot}>
          {modal.mode==="edit"&&<button style={C.btnD} onClick={deleteClient}>{t("Eliminar","Delete")}</button>}
          {modal.mode==="edit"&&<button style={C.btnS} onClick={()=>exportToPDF({...form,total:parseFloat(form.total)||0,paid:parseFloat(form.paid)||0},lang)}>⬇ PDF</button>}
          <button style={C.btnG} onClick={()=>setModal(null)}>{t("Cancelar","Cancel")}</button>
          <button style={{...C.btnP,opacity:saving?0.6:1}} onClick={saveClient} disabled={saving}>{saving?"⟳...":modal.mode==="add"?t("Guardar cliente","Save client"):t("Actualizar","Update")}</button>
        </div>
      </div>
    </div>
  );

  const NAV=[{key:"dashboard",icon:"⬡",es:"Panel",en:"Dashboard"},{key:"clients",icon:"◈",es:"Clientes",en:"Clients"},{key:"payments",icon:"◇",es:"Pagos",en:"Payments"},{key:"alerts",icon:"◻",es:"Alertas",en:"Alerts",badge:notifs.filter(n=>n.urgent).length}];

  // ── AUTH STATES ───────────────────────────────────────────────────────────
  if(authState==="loading") return(
    <div style={{minHeight:"100vh",background:"#0a0a0f",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'DM Sans',system-ui,sans-serif"}}>
      <div style={{textAlign:"center"}}>
        <div style={{fontFamily:"'Syne',system-ui,sans-serif",fontWeight:800,fontSize:28,background:"linear-gradient(135deg,#c084fc,#38bdf8)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",marginBottom:16}}>CuraManage</div>
        <div style={{fontSize:24,animation:"spin 1s linear infinite",display:"inline-block",color:"#c084fc"}}>⟳</div>
      </div>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600&display=swap');@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
  if(authState==="login") return <LoginScreen onLogin={()=>setAuthState("app")}/>;
  if(authState==="unauthorized") return <UnauthorizedScreen email={currentUser?.email} onSignOut={handleSignOut}/>;

  return(
    <div style={C.app}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600&display=swap');
        @keyframes bounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-5px)}}
        @keyframes glow{0%,100%{opacity:1}50%{opacity:0.35}}
        @keyframes spin{to{transform:rotate(360deg)}}
        *{box-sizing:border-box}
        ::-webkit-scrollbar{width:3px;height:3px}::-webkit-scrollbar-thumb{background:rgba(99,102,241,0.3);border-radius:3px}
        input[type=date]::-webkit-calendar-picker-indicator{filter:invert(0.5)}
        select option{background:#1a1a2e}
        input:focus,textarea:focus,select:focus{border-color:rgba(99,102,241,0.6)!important;box-shadow:0 0 0 3px rgba(99,102,241,0.1)}
        button:active{opacity:0.8;transform:scale(0.97)}
        @media(min-width:768px){.mob{display:none!important}.desk{display:flex!important}}
        @media(max-width:767px){.desk{display:none!important}.mob{display:flex!important}}
      `}</style>

      {/* DESKTOP */}
      <div className="desk" style={{display:"flex",height:"100vh",overflow:"hidden"}}>
        <aside style={C.sidebar}>
          <div style={{padding:"20px 18px 16px",borderBottom:"1px solid rgba(99,102,241,0.2)"}}>
            <div style={{fontFamily:"'Syne',system-ui,sans-serif",fontWeight:800,fontSize:19,background:"linear-gradient(135deg,#c084fc,#38bdf8)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>CuraManage</div>
            <div style={{fontSize:10,color:"rgba(255,255,255,0.3)",marginTop:2,letterSpacing:"0.1em",textTransform:"uppercase"}}>Curaçao · Gestión</div>
          </div>
          <nav style={{flex:1,padding:"12px 8px",display:"flex",flexDirection:"column",gap:3}}>
            {NAV.map(item=>(
              <div key={item.key} style={C.navItem(section===item.key)} onClick={()=>setSection(item.key)}>
                <span style={{fontSize:16,width:20,textAlign:"center"}}>{item.icon}</span>
                <span>{t(item.es,item.en)}</span>
                {item.badge?<span style={C.navBadge}>{item.badge}</span>:null}
              </div>
            ))}
          </nav>
          {/* User info + logout */}
          <div style={{padding:"12px 8px",borderTop:"1px solid rgba(99,102,241,0.2)"}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10,padding:"8px 10px",background:"rgba(99,102,241,0.08)",borderRadius:10,border:"1px solid rgba(99,102,241,0.2)"}}>
              <div style={{width:28,height:28,borderRadius:"50%",background:"linear-gradient(135deg,#6366f1,#8b5cf6)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:"#fff",flexShrink:0}}>
                {currentUser?.email?.charAt(0).toUpperCase()}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:11,fontWeight:600,color:"#f0f0f5",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{currentUser?.email}</div>
                <div style={{fontSize:10,color:"rgba(255,255,255,0.35)"}}>Admin</div>
              </div>
            </div>
            <div style={{fontSize:10,color:"rgba(255,255,255,0.25)",textAlign:"center",marginBottom:8}}>{clients.length} {t("clientes","clients")} · Supabase ✓</div>
            <div style={{display:"flex",gap:3,background:"rgba(255,255,255,0.05)",borderRadius:10,padding:3,marginBottom:8}}>
              <div style={C.langBtn(lang==="es")} onClick={()=>setLang("es")}>ES</div>
              <div style={C.langBtn(lang==="en")} onClick={()=>setLang("en")}>EN</div>
            </div>
            <button onClick={handleSignOut} style={{width:"100%",padding:"7px",borderRadius:8,fontSize:11,cursor:"pointer",background:"rgba(248,113,113,0.08)",color:"rgba(248,113,113,0.7)",border:"1px solid rgba(248,113,113,0.2)",fontFamily:"inherit"}}>
              {t("Cerrar sesión","Sign out")}
            </button>
          </div>
        </aside>

        <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
          <div style={C.topbar}>
            <div style={{fontFamily:"'Syne',system-ui,sans-serif",fontWeight:700,fontSize:15,flex:1}}>{({dashboard:t("Panel","Dashboard"),clients:t("Clientes","Clients"),payments:t("Pagos","Payments"),alerts:t("Alertas","Alerts")})[section]}</div>
            {loading&&<span style={{fontSize:11,color:"rgba(192,132,252,0.5)",animation:"glow 1s infinite"}}>⟳</span>}
            <div style={{display:"flex",gap:8}}>
              <button style={C.btnG} onClick={load}>↻</button>
              <button style={{...C.btnG,background:"rgba(245,158,11,0.08)",color:"#f59e0b",border:"1px solid rgba(245,158,11,0.3)"}} onClick={openPassportModal}>📷 {t("Escanear","Scan")}</button>
              <button style={C.btnG} onClick={openAdd}>+ {t("Nuevo","New")}</button>
              <button style={C.btnP} onClick={()=>setShowAI(!showAI)}>✦ IA</button>
            </div>
          </div>

          <div style={{flex:1,overflowY:"auto",padding:"16px 20px"}}>
            {section==="dashboard"&&<>
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:20}}>
                {[{label:t("Total clientes","Total clients"),value:clients.length,color:"#c084fc"},{label:t("En proceso","In process"),value:clients.filter(c=>c.status==="proceso").length,color:"#38bdf8"},{label:t("Por cobrar","Outstanding"),value:`ANG ${totalDebt}`,color:"#fb923c"},{label:t("Vencen pronto","Expiring"),value:expiring,color:"#f87171"}].map((s,i)=>(
                  <div key={i} style={{...C.card,borderColor:s.color+"33"}}><div style={{fontSize:10,color:"rgba(255,255,255,0.4)",textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:4}}>{s.label}</div><div style={{fontFamily:"'Syne',system-ui,sans-serif",fontSize:26,fontWeight:800,color:s.color}}>{s.value}</div></div>
                ))}
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:14,marginBottom:20}}>
                {[{title:t("Por estatus","By status"),data:statusData},{title:t("Por tipo","By type"),data:typeData}].map((ch,ci)=>(
                  <div key={ci} style={C.card}>
                    <div style={{fontSize:11,fontWeight:600,color:"rgba(192,132,252,0.7)",marginBottom:10,textTransform:"uppercase",letterSpacing:"0.07em"}}>{ch.title}</div>
                    <ResponsiveContainer width="100%" height={120}><PieChart><Pie data={ch.data} cx="50%" cy="50%" innerRadius={28} outerRadius={50} paddingAngle={3} dataKey="value">{ch.data.map((e,i)=><Cell key={i} fill={e.color} stroke="transparent"/>)}</Pie><Tooltip contentStyle={{background:"#1a1a2e",border:"1px solid rgba(99,102,241,0.3)",borderRadius:8,fontSize:11}}/></PieChart></ResponsiveContainer>
                    <div style={{display:"flex",flexWrap:"wrap",gap:5,marginTop:4}}>{ch.data.map((d,i)=><div key={i} style={{fontSize:10,color:d.color,display:"flex",alignItems:"center",gap:3}}><span style={{width:5,height:5,borderRadius:"50%",background:d.color,display:"inline-block"}}/>{d.name}:{d.value}</div>)}</div>
                  </div>
                ))}
                <div style={C.card}>
                  <div style={{fontSize:11,fontWeight:600,color:"rgba(192,132,252,0.7)",marginBottom:10,textTransform:"uppercase",letterSpacing:"0.07em"}}>{t("Cobros ANG","Payments ANG")}</div>
                  <ResponsiveContainer width="100%" height={120}><BarChart data={payData} barSize={26}><XAxis dataKey="name" tick={{fontSize:10,fill:"rgba(255,255,255,0.4)"}} axisLine={false} tickLine={false}/><YAxis tick={{fontSize:10,fill:"rgba(255,255,255,0.4)"}} axisLine={false} tickLine={false}/><Tooltip contentStyle={{background:"#1a1a2e",border:"1px solid rgba(99,102,241,0.3)",borderRadius:8,fontSize:11}}/><Bar dataKey="value" radius={[5,5,0,0]}>{payData.map((d,i)=><Cell key={i} fill={d.fill}/>)}</Bar></BarChart></ResponsiveContainer>
                </div>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}>
                <div style={{fontFamily:"'Syne',system-ui,sans-serif",fontSize:14,fontWeight:700}}>{t("Clientes recientes","Recent clients")}</div>
                <button style={{...C.btnG,marginLeft:"auto",fontSize:11}} onClick={()=>setSection("clients")}>{t("Ver todos →","View all →")}</button>
              </div>
              <div style={{...C.card,padding:0,overflow:"hidden"}}>
                <div style={{display:"grid",gridTemplateColumns:"2fr 1.2fr 1.1fr 1fr 70px 80px 100px",borderBottom:"1px solid rgba(99,102,241,0.2)",background:"rgba(99,102,241,0.08)"}}>
                  {[t("Cliente","Client"),t("Tipo","Type"),t("Estatus","Status"),t("Vence","Expires"),t("Pago","Pmt"),t("Deuda","Debt"),""].map((h,i)=><div key={i} style={{padding:"10px 14px",fontSize:10,fontWeight:600,color:"rgba(192,132,252,0.7)",textTransform:"uppercase",letterSpacing:"0.07em"}}>{h}</div>)}
                </div>
                {clients.length===0?<div style={{textAlign:"center",padding:"28px",color:"rgba(255,255,255,0.3)"}}>{t("Sin clientes aún","No clients yet")}</div>:clients.slice(0,6).map(c=><DRow key={c.id} c={c}/>)}
              </div>
            </>}
            {section==="clients"&&<>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14,flexWrap:"wrap"}}>
                <div style={{fontFamily:"'Syne',system-ui,sans-serif",fontSize:14,fontWeight:700}}>{t("Todos los clientes","All clients")} <span style={{color:"rgba(255,255,255,0.3)",fontWeight:400}}>({filtered.length})</span></div>
                <input style={{...C.searchBar,maxWidth:240}} placeholder={t("Buscar...","Search...")} value={search} onChange={e=>setSearch(e.target.value)}/>
                <select style={C.filterSel} value={filterType} onChange={e=>setFilterType(e.target.value)}><option value="">Tipos</option><option value="permiso">Permiso</option><option value="residencia">Residencia</option><option value="contabilidad">Contabilidad</option></select>
                <select style={C.filterSel} value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}><option value="">Todos</option><option value="proceso">Proceso</option><option value="pendiente">Pendiente</option><option value="aprobado">Aprobado</option><option value="rechazado">Rechazado</option></select>
              </div>
              {filtered.length===0?<div style={{textAlign:"center",padding:"40px",color:"rgba(255,255,255,0.3)"}}>{t("Sin resultados","No results")}</div>:filtered.map(c=><ClientCard key={c.id} c={c}/>)}
            </>}
            {section==="payments"&&<>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14,marginBottom:20}}>
                {[{label:t("Facturado","Billed"),value:`ANG ${totalBilled}`,color:"#c084fc"},{label:t("Cobrado","Collected"),value:`ANG ${totalPaid}`,color:"#4ade80"},{label:t("Por cobrar","Outstanding"),value:`ANG ${totalDebt}`,color:"#f87171"}].map((s,i)=>(
                  <div key={i} style={{...C.card,borderColor:s.color+"33"}}><div style={{fontSize:10,color:"rgba(255,255,255,0.4)",textTransform:"uppercase",marginBottom:4}}>{s.label}</div><div style={{fontFamily:"'Syne',system-ui,sans-serif",fontSize:22,fontWeight:800,color:s.color}}>{s.value}</div></div>
                ))}
              </div>
              {[...clients].sort((a,b)=>((b.total||0)-(b.paid||0))-((a.total||0)-(a.paid||0))).map(c=><ClientCard key={c.id} c={c}/>)}
            </>}
            {section==="alerts"&&<>
              {notifs.length===0?<div style={{textAlign:"center",padding:"48px",color:"rgba(255,255,255,0.3)"}}>✅ {t("Sin alertas","No alerts")}</div>:notifs.map((n,i)=>(
                <div key={i} style={{...C.card,borderColor:n.urgent?"rgba(248,113,113,0.3)":"rgba(251,191,36,0.2)",display:"flex",gap:12,marginBottom:10,cursor:"pointer"}} onClick={()=>n.client&&setClientModal(n.client)}>
                  <div style={{fontSize:20}}>{n.icon}</div>
                  <div style={{flex:1}}><div style={{fontWeight:600,fontSize:13}}>{n.title}</div><div style={{fontSize:12,color:"rgba(255,255,255,0.4)",marginTop:2}}>{n.sub}</div></div>
                  {n.date&&<div style={{fontSize:11,color:"rgba(255,255,255,0.3)"}}>{new Date(n.date).toLocaleDateString("es")}</div>}
                </div>
              ))}
            </>}
          </div>
        </div>
        {showAI&&<div style={C.aiPanel}>{AI_PANEL}</div>}
      </div>

      {/* MOBILE */}
      <div className="mob" style={{flexDirection:"column",flex:1,paddingBottom:65}}>
        <div style={{...C.topbar,justifyContent:"space-between"}}>
          <div style={{fontFamily:"'Syne',system-ui,sans-serif",fontWeight:800,fontSize:16,background:"linear-gradient(135deg,#c084fc,#38bdf8)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>CuraManage</div>
          <div style={{display:"flex",gap:7}}>
            {loading&&<span style={{fontSize:11,color:"rgba(192,132,252,0.5)",animation:"glow 1s infinite",alignSelf:"center"}}>⟳</span>}
            <button style={{...C.btnG,background:"rgba(245,158,11,0.08)",color:"#f59e0b",border:"1px solid rgba(245,158,11,0.3)",padding:"8px 12px",fontSize:16}} onClick={openPassportModal}>📷</button>
            <button style={{...C.btnG,padding:"8px 12px",fontSize:15}} onClick={openAdd}>+</button>
            <button style={{...C.btnP,padding:"8px 14px"}} onClick={()=>setShowAI(!showAI)}>✦</button>
          </div>
        </div>
        <div style={{flex:1,overflowY:"auto",padding:"14px",WebkitOverflowScrolling:"touch"}}>
          {section==="dashboard"&&<>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
              {[{label:t("Clientes","Clients"),value:clients.length,color:"#c084fc"},{label:t("Por cobrar","Outstanding"),value:`ANG ${totalDebt}`,color:"#fb923c"},{label:t("En proceso","In process"),value:clients.filter(c=>c.status==="proceso").length,color:"#38bdf8"},{label:t("Vencen","Expiring"),value:expiring,color:"#f87171"}].map((s,i)=>(
                <div key={i} style={{...C.card,borderColor:s.color+"33",padding:"12px 14px"}}><div style={{fontSize:10,color:"rgba(255,255,255,0.4)",textTransform:"uppercase"}}>{s.label}</div><div style={{fontFamily:"'Syne',system-ui,sans-serif",fontSize:20,fontWeight:800,color:s.color,marginTop:3}}>{s.value}</div></div>
              ))}
            </div>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
              <div style={{fontFamily:"'Syne',system-ui,sans-serif",fontSize:13,fontWeight:700}}>{t("Recientes","Recent")}</div>
              <button style={{...C.btnG,marginLeft:"auto",fontSize:11}} onClick={()=>setSection("clients")}>{t("Todos →","All →")}</button>
            </div>
            {clients.slice(0,5).map(c=><ClientCard key={c.id} c={c}/>)}
          </>}
          {section==="clients"&&<>
            <div style={{display:"flex",gap:8,marginBottom:10}}><input style={C.searchBar} placeholder={t("Buscar...","Search...")} value={search} onChange={e=>setSearch(e.target.value)}/></div>
            <div style={{display:"flex",gap:8,marginBottom:14}}>
              <select style={{...C.filterSel,flex:1}} value={filterType} onChange={e=>setFilterType(e.target.value)}><option value="">Tipos</option><option value="permiso">Permiso</option><option value="residencia">Residencia</option><option value="contabilidad">Contabilidad</option></select>
              <select style={{...C.filterSel,flex:1}} value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}><option value="">Todos</option><option value="proceso">Proceso</option><option value="pendiente">Pendiente</option><option value="aprobado">Aprobado</option><option value="rechazado">Rechazado</option></select>
            </div>
            {filtered.map(c=><ClientCard key={c.id} c={c}/>)}
          </>}
          {section==="payments"&&<>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
              {[{label:t("Facturado","Billed"),value:`ANG ${totalBilled}`,color:"#c084fc"},{label:t("Cobrado","Collected"),value:`ANG ${totalPaid}`,color:"#4ade80"},{label:t("Por cobrar","Outstanding"),value:`ANG ${totalDebt}`,color:"#f87171",full:true}].map((s,i)=>(
                <div key={i} style={{...C.card,borderColor:s.color+"33",padding:"12px 14px",gridColumn:s.full?"1/-1":"auto"}}><div style={{fontSize:10,color:"rgba(255,255,255,0.4)",textTransform:"uppercase"}}>{s.label}</div><div style={{fontFamily:"'Syne',system-ui,sans-serif",fontSize:18,fontWeight:800,color:s.color,marginTop:3}}>{s.value}</div></div>
              ))}
            </div>
            {[...clients].sort((a,b)=>((b.total||0)-(b.paid||0))-((a.total||0)-(a.paid||0))).map(c=><ClientCard key={c.id} c={c}/>)}
          </>}
          {section==="alerts"&&<>
            {notifs.length===0?<div style={{textAlign:"center",padding:"40px",color:"rgba(255,255,255,0.3)"}}>✅ {t("Sin alertas","No alerts")}</div>:notifs.map((n,i)=>(
              <div key={i} style={{...C.card,borderColor:n.urgent?"rgba(248,113,113,0.3)":"rgba(251,191,36,0.2)",display:"flex",gap:12,marginBottom:10,cursor:"pointer"}} onClick={()=>n.client&&setClientModal(n.client)}>
                <div style={{fontSize:20}}>{n.icon}</div>
                <div><div style={{fontWeight:600,fontSize:13}}>{n.title}</div><div style={{fontSize:12,color:"rgba(255,255,255,0.4)",marginTop:2}}>{n.sub}</div></div>
              </div>
            ))}
          </>}
        </div>
        <nav style={C.mobileNav}>
          {NAV.map(item=>(
            <button key={item.key} style={C.mNavBtn(section===item.key)} onClick={()=>setSection(item.key)}>
              <span style={{fontSize:20}}>{item.icon}</span>
              <span>{t(item.es,item.en)}</span>
              {item.badge?<span style={{...C.navBadge,position:"absolute",top:6,right:"18%",fontSize:9,padding:"1px 5px"}}>{item.badge}</span>:null}
            </button>
          ))}
          <button style={C.mNavBtn(false)} onClick={()=>setShowAI(!showAI)}>
            <span style={{fontSize:20}}>✦</span><span>IA</span>
          </button>
        </nav>
        {showAI&&<div style={C.aiDrawer}>{AI_PANEL}</div>}
      </div>

      {PASSPORT_MODAL}
      {CLIENT_FOLDER}
      {FORM_MODAL}
      {toast&&<div style={C.toast(toast.ok)}>{toast.ok?"✓":"✕"} {toast.msg}</div>}
    </div>
  );
}
