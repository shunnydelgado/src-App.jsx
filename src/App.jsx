import { useState, useEffect, useRef } from "react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://tfatwczcufvmthuolfjv.supabase.co";
const SUPABASE_KEY = "sb_publishable_-S2VtEoXw1lbuSXROU4_jw_Q2JDABWP";
const ALLOWED_EMAILS = ["maolin503@gmail.com", "ramiro.olbina@gmail.com"];
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

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

const STATUS_CFG = {
  proceso:      { label:"En proceso",    color:"#3b82f6", bg:"#eff6ff", border:"#bfdbfe" },
  copy_cliente: { label:"Copy cliente",  color:"#f59e0b", bg:"#fffbeb", border:"#fde68a" },
  aprobado:     { label:"Aprobado",      color:"#10b981", bg:"#ecfdf5", border:"#a7f3d0" },
  rechazado:    { label:"Rechazado",     color:"#ef4444", bg:"#fef2f2", border:"#fecaca" },
};
const TYPE_CFG = {
  empleado:     { label:"Empleado",        color:"#8b5cf6", bg:"#f5f3ff", border:"#ddd6fe" },
  compania:     { label:"Compañía",        color:"#6366f1", bg:"#f0f0ff", border:"#c7d2fe" },
  union_familiar:{ label:"Unión familiar", color:"#0ea5e9", bg:"#f0f9ff", border:"#bae6fd" },
  rentanier:    { label:"Rentanier",       color:"#10b981", bg:"#ecfdf5", border:"#a7f3d0" },
  residencia:   { label:"Residencia",      color:"#f59e0b", bg:"#fffbeb", border:"#fde68a" },
  contabilidad: { label:"Contabilidad",    color:"#64748b", bg:"#f8fafc", border:"#e2e8f0" },
};
const MODALIDAD_CFG = {
  riba_e_luga:  { label:"Riba e Luga",   color:"#f59e0b", bg:"#fffbeb", border:"#fde68a" },
  convencional: { label:"Convencional",  color:"#6366f1", bg:"#f0f0ff", border:"#c7d2fe" },
};
const REQUIRED_DOCS = {
  empleado:      ["Pasaporte vigente","Foto reciente","Contrato de trabajo","Carta del empleador","Certificado médico","Antecedentes penales","Formulario de solicitud","Comprobante de pago a Migración"],
  compania:      ["Pasaporte vigente","Foto reciente","Registro mercantil","Carta de la compañía","Certificado médico","Antecedentes penales","Formulario de solicitud","Comprobante de pago a Migración"],
  union_familiar:["Pasaporte vigente","Foto reciente","Acta de matrimonio/nacimiento apostillada","Permiso residencia del familiar","Comprobante de ingresos familiar","Certificado médico","Antecedentes penales","Formulario de solicitud","Comprobante de pago a Migración"],
  rentanier:     ["Pasaporte vigente","Foto reciente","Comprobante de ingresos pasivos","Estado de cuenta bancario","Seguro médico","Antecedentes penales","Formulario de solicitud","Comprobante de pago a Migración"],
  residencia:    ["Pasaporte vigente","Foto reciente","Certificado de nacimiento apostillado","Antecedentes penales","Comprobante de ingresos","Seguro médico","Formulario de solicitud","Comprobante de domicilio","Comprobante de pago a Migración"],
  contabilidad:  ["Registro mercantil","RIF o número fiscal","Estados de cuenta","Facturas del período","Nómina de empleados","Contrato de servicios"],
};

function addWeeks(dateStr, weeks) {
  if(!dateStr) return "";
  const d = new Date(dateStr);
  d.setDate(d.getDate() + weeks * 7);
  return d.toISOString().split("T")[0];
}
function addMonths(dateStr, months) {
  if(!dateStr) return "";
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().split("T")[0];
}

function calcVencimiento(fechaAprobacion, duracion) {
  if(!fechaAprobacion || !duracion) return "";
  const meses = { "6m":6, "1y":12, "2y":24, "3y":36 };
  return addMonths(fechaAprobacion, meses[duracion] || 12);
}

async function compressImage(dataUrl, maxWidth=800, quality=0.82) {
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

async function uploadPhoto(file, clientId) {
  const ext = file.name.split(".").pop();
  const path = `${clientId}-${Date.now()}.${ext}`;
  const { data, error } = await supabase.storage.from("client-photos").upload(path, file, { upsert:true, contentType:file.type });
  if(error) throw error;
  const { data: urlData } = supabase.storage.from("client-photos").getPublicUrl(path);
  return urlData.publicUrl;
}

function exportToPDF(client) {
  const debt=(client.total||0)-(client.paid||0);
  const docs=client.documents||[];
  const required=REQUIRED_DOCS[client.type]||[];
  const docsList=required.map(doc=>{
    const found=docs.includes(doc);
    return `<tr><td style="padding:6px 10px;border-bottom:1px solid #f0f0f0">${doc}</td><td style="padding:6px 10px;border-bottom:1px solid #f0f0f0;text-align:center;color:${found?"#10b981":"#ef4444"}">${found?"✓":"✗"}</td></tr>`;
  }).join("");
  const html=`<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
  body{font-family:'Segoe UI',Arial,sans-serif;color:#1e293b;margin:0;background:#fff}
  .header{background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;padding:28px 36px;display:flex;justify-content:space-between;align-items:center}
  .logo{font-size:22px;font-weight:800}.logo-sub{font-size:10px;color:rgba(255,255,255,0.7);text-transform:uppercase;letter-spacing:2px;margin-top:3px}
  .content{padding:28px 36px}.section{margin-bottom:24px}
  .section-title{font-size:10px;text-transform:uppercase;letter-spacing:2px;color:#6366f1;margin-bottom:12px;padding-bottom:5px;border-bottom:2px solid #f1f5f9;font-weight:700}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
  .field{background:#f8fafc;padding:10px 12px;border-radius:8px;border-left:3px solid #6366f1}
  .field-label{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;margin-bottom:2px}
  .field-value{font-size:13px;font-weight:500;color:#1e293b}
  table{width:100%;border-collapse:collapse}th{background:#f8fafc;padding:7px 10px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#6366f1}
  .footer{background:#f8fafc;padding:14px 36px;text-align:center;font-size:11px;color:#94a3b8;border-top:1px solid #e2e8f0}
  @media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}</style></head><body>
  <div class="header"><div><div class="logo">CuraManage</div><div class="logo-sub">Curaçao · Gestión Integral</div></div>
  <div style="text-align:right"><div style="font-size:11px;color:rgba(255,255,255,0.7)">${new Date().toLocaleDateString("es")}</div><div style="font-size:18px;font-weight:700">${client.client_id||""}</div></div></div>
  <div class="content">
  ${client.photo_url?`<div style="text-align:center;margin-bottom:16px"><img src="${client.photo_url}" style="width:80px;height:80px;border-radius:50%;object-fit:cover;border:3px solid #6366f1"/></div>`:""}
  <div class="section"><div class="section-title">Información personal</div><div class="grid">
  <div class="field"><div class="field-label">Nombre</div><div class="field-value">${client.name||"—"}</div></div>
  <div class="field"><div class="field-label">Nacionalidad</div><div class="field-value">${client.nationality||"—"}</div></div>
  <div class="field"><div class="field-label">Nacimiento</div><div class="field-value">${client.birthdate||"—"}</div></div>
  <div class="field"><div class="field-label">Pasaporte</div><div class="field-value">${client.passport||"—"}</div></div>
  <div class="field"><div class="field-label">Teléfono</div><div class="field-value">${client.phone||"—"}</div></div>
  <div class="field"><div class="field-label">Email</div><div class="field-value">${client.email||"—"}</div></div>
  ${client.referido?`<div class="field" style="grid-column:1/-1"><div class="field-label">Referido por</div><div class="field-value">${client.referido}</div></div>`:""}
  </div></div>
  ${client.caso_descripcion?`<div class="section"><div class="section-title">Descripción del caso</div><div class="field" style="border-left-color:#8b5cf6"><div class="field-value" style="white-space:pre-wrap">${client.caso_descripcion}</div></div></div>`:""}
  <div class="section"><div class="section-title">Trámite</div><div class="grid">
  <div class="field"><div class="field-label">Tipo</div><div class="field-value">${TYPE_CFG[client.type]?.label||client.type}</div></div>
  <div class="field"><div class="field-label">Estatus</div><div class="field-value">${STATUS_CFG[client.status]?.label||client.status}</div></div>
  <div class="field"><div class="field-label">Vencimiento</div><div class="field-value">${client.expiry||"—"}</div></div>
  <div class="field"><div class="field-label">Notas</div><div class="field-value">${client.notes||"—"}</div></div>
  </div></div>
  <div class="section"><div class="section-title">Pagos</div><div class="grid">
  <div class="field"><div class="field-label">Total</div><div class="field-value">ANG ${client.total||0}</div></div>
  <div class="field"><div class="field-label">Pagado</div><div class="field-value" style="color:#10b981">ANG ${client.paid||0}</div></div>
  <div class="field"><div class="field-label">Saldo</div><div class="field-value" style="color:${debt<=0?"#10b981":"#ef4444"}">${debt<=0?"✓ Pagado":"ANG "+debt}</div></div>
  </div></div>
  ${required.length>0?`<div class="section"><div class="section-title">Documentos</div>
  <table><thead><tr><th>Documento</th><th>Estado</th></tr></thead><tbody>${docsList}</tbody></table></div>`:""}
  </div><div class="footer">CuraManage · Curaçao · ${new Date().getFullYear()}</div></body></html>`;
  const win=window.open("","_blank");
  win.document.write(html);
  win.document.close();
  setTimeout(()=>win.print(),500);
}

// ── LOGIN ─────────────────────────────────────────────────────────────────────
function LoginScreen() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  async function handleLogin() {
    setLoading(true); setError("");
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider:"google",
        options:{ redirectTo:"https://curamanage.netlify.app" }
      });
      if(error) throw error;
    } catch(e) { setError("Error al iniciar sesión. Intenta de nuevo."); setLoading(false); }
  }
  return(
    <div style={{minHeight:"100vh",background:"linear-gradient(135deg,#f8fafc 0%,#f1f5f9 100%)",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Plus Jakarta Sans',system-ui,sans-serif",padding:20}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Fraunces:wght@700;800&display=swap');
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
      `}</style>
      <div style={{width:"100%",maxWidth:420,animation:"fadeUp 0.5s ease"}}>
        <div style={{textAlign:"center",marginBottom:36}}>
          <div style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:56,height:56,background:"linear-gradient(135deg,#6366f1,#8b5cf6)",borderRadius:16,marginBottom:16,boxShadow:"0 8px 24px rgba(99,102,241,0.3)"}}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </div>
          <div style={{fontFamily:"'Fraunces',serif",fontWeight:800,fontSize:32,color:"#1e293b",marginBottom:6}}>CuraManage</div>
          <div style={{fontSize:13,color:"#94a3b8",letterSpacing:"0.05em"}}>Gestión Integral · Curaçao</div>
        </div>
        <div style={{background:"#fff",borderRadius:20,padding:"32px",boxShadow:"0 4px 6px -1px rgba(0,0,0,0.05),0 20px 40px -8px rgba(0,0,0,0.08)",border:"1px solid #f1f5f9"}}>
          <div style={{marginBottom:24}}>
            <div style={{fontSize:18,fontWeight:700,color:"#1e293b",marginBottom:6}}>Bienvenida de nuevo</div>
            <div style={{fontSize:14,color:"#64748b",lineHeight:1.6}}>Inicia sesión con tu cuenta de Google para acceder al sistema.</div>
          </div>
          {error&&<div style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:10,padding:"10px 14px",fontSize:13,color:"#ef4444",marginBottom:16}}>{error}</div>}
          <button onClick={handleLogin} disabled={loading} style={{width:"100%",padding:"13px 20px",borderRadius:12,fontSize:14,fontWeight:600,cursor:loading?"not-allowed":"pointer",background:loading?"#f8fafc":"#fff",color:"#1e293b",border:"1.5px solid #e2e8f0",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:12,transition:"all 0.15s",boxShadow:loading?"none":"0 1px 3px rgba(0,0,0,0.08)"}}>
            {loading?<span style={{fontSize:18,animation:"spin 1s linear infinite",display:"inline-block",color:"#6366f1"}}>⟳</span>:<svg width="20" height="20" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>}
            {loading?"Iniciando sesión...":"Continuar con Google"}
          </button>
          <div style={{marginTop:16,padding:"12px 14px",background:"#f8fafc",borderRadius:10,border:"1px solid #e2e8f0"}}>
            <div style={{fontSize:12,color:"#94a3b8",textAlign:"center"}}>🔒 Solo usuarios autorizados pueden acceder</div>
          </div>
        </div>
        <div style={{textAlign:"center",marginTop:20,fontSize:12,color:"#cbd5e1"}}>CuraManage © {new Date().getFullYear()}</div>
      </div>
    </div>
  );
}

function UnauthorizedScreen({email, onSignOut}) {
  return(
    <div style={{minHeight:"100vh",background:"#f8fafc",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Plus Jakarta Sans',system-ui,sans-serif",padding:20}}>
      <div style={{background:"#fff",borderRadius:20,padding:40,textAlign:"center",maxWidth:380,boxShadow:"0 4px 24px rgba(0,0,0,0.08)"}}>
        <div style={{fontSize:48,marginBottom:16}}>🚫</div>
        <div style={{fontSize:20,fontWeight:700,color:"#1e293b",marginBottom:8}}>Acceso no autorizado</div>
        <div style={{fontSize:14,color:"#64748b",marginBottom:24}}>La cuenta <strong style={{color:"#ef4444"}}>{email}</strong> no tiene acceso.</div>
        <button onClick={onSignOut} style={{padding:"10px 20px",borderRadius:10,fontSize:13,fontWeight:600,cursor:"pointer",background:"#fef2f2",color:"#ef4444",border:"1px solid #fecaca",fontFamily:"inherit"}}>Cerrar sesión</button>
      </div>
    </div>
  );
}

// ── MAIN APP ──────────────────────────────────────────────────────────────────
export default function CuraManage() {
  const [authState, setAuthState] = useState("loading");
  const [currentUser, setCurrentUser] = useState(null);
  const [accessToken, setAccessToken] = useState(null);
  const [section, setSection] = useState("dashboard");
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterModalidad, setFilterModalidad] = useState("");
  const [modal, setModal] = useState(null);
  const [clientModal, setClientModal] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [toast, setToast] = useState(null);
  const [showAI, setShowAI] = useState(false);
  const [photoViewer, setPhotoViewer] = useState(null);
  const [aiMsgs, setAiMsgs] = useState([{role:"assistant",content:"¡Hola! Soy tu asistente CuraManage.\n\nConozco todos tus clientes. Puedo:\n• Actualizar estatus: \"marca a Juan como aprobado\"\n• Registrar pagos: \"agrega pago de ANG 500 a CUR-002\"\n• Redactar cartas y analizar casos\n\n¿Qué necesitas?"}]);
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [passportModal, setPassportModal] = useState(false);
  const [migrationModal, setMigrationModal] = useState(null);
  const [migrationResult, setMigrationResult] = useState(null);
  const [migrationLoading, setMigrationLoading] = useState(false);
  const [migrationPrograma, setMigrationPrograma] = useState("permiso_trabajo");
  const [passportPreview, setPassportPreview] = useState(null);
  const [scanStep, setScanStep] = useState("choose");
  const aiRef = useRef(null);
  const fileInputRef = useRef(null);
  const photoInputRef = useRef(null);

  // AUTH
  useEffect(()=>{
    supabase.auth.getSession().then(({data:{session}})=>{
      if(session?.user){ setCurrentUser(session.user); setAccessToken(session.access_token); setAuthState(ALLOWED_EMAILS.includes(session.user.email)?"app":"unauthorized"); }
      else setAuthState("login");
    });
    const {data:{subscription}}=supabase.auth.onAuthStateChange((event,session)=>{
      if(session?.user){ setCurrentUser(session.user); setAccessToken(session.access_token); setAuthState(ALLOWED_EMAILS.includes(session.user.email)?"app":"unauthorized"); }
      else { setAuthState("login"); setCurrentUser(null); setAccessToken(null); }
    });
    return ()=>subscription.unsubscribe();
  },[]);

  function showToast(msg,ok=true){setToast({msg,ok});setTimeout(()=>setToast(null),4000);}
  async function handleSignOut(){await supabase.auth.signOut();setCurrentUser(null);setAccessToken(null);setAuthState("login");}

  async function load(){
    try{setLoading(true);const data=await supabaseReq("GET","/clients?order=created_at.desc&select=*",null,accessToken);setClients(data);}
    catch(e){showToast("Error: "+e.message,false);}finally{setLoading(false);}
  }
  useEffect(()=>{if(authState==="app")load();},[authState]);
  useEffect(()=>{if(aiRef.current)aiRef.current.scrollTop=aiRef.current.scrollHeight;},[aiMsgs,aiLoading]);

  const totalDebt=clients.reduce((a,c)=>a+Math.max(0,(c.total||0)-(c.paid||0)),0);
  const totalPaid=clients.reduce((a,c)=>a+(c.paid||0),0);
  const totalBilled=clients.reduce((a,c)=>a+(c.total||0),0);
  const expiring=clients.filter(c=>c.expiry&&(new Date(c.expiry)-Date.now())<30*86400000&&c.status!=="aprobado").length;
  const statusData=Object.entries(STATUS_CFG).map(([k,v])=>({name:v.label,value:clients.filter(c=>c.status===k).length,color:v.color})).filter(d=>d.value>0);
  const typeData=Object.entries(TYPE_CFG).map(([k,v])=>({name:v.label,value:clients.filter(c=>c.type===k).length,color:v.color})).filter(d=>d.value>0);
  const payData=[{name:"Cobrado",value:totalPaid,fill:"#10b981"},{name:"Pendiente",value:totalDebt,fill:"#f87171"}];

  const notifs=[];
  clients.forEach(c=>{
    if(c.status==="rechazado") return;
    if(c.expiry&&c.status!=="aprobado"){
      const days=Math.round((new Date(c.expiry)-Date.now())/86400000);
      if(days<0) notifs.push({urgent:true,icon:"🔴",title:`${c.name} — Vencido`,sub:`${Math.abs(days)} días · ${c.client_id}`,client:c});
      else if(days<=7) notifs.push({urgent:true,icon:"⚠️",title:`${c.name} — Vence en ${days}d`,sub:`Urgente · ${c.client_id}`,client:c});
      else if(days<=30) notifs.push({urgent:false,icon:"🟡",title:`${c.name}`,sub:`Vence en ${days} días · ${c.client_id}`,client:c});
    }
    const debt=(c.total||0)-(c.paid||0);
    if(debt>0&&debt===c.total) notifs.push({urgent:false,icon:"💰",title:`${c.name}`,sub:`ANG ${debt} sin pagos`,client:c});
    if(c.fecha_tentativa_copy&&!c.fecha_copy_cliente){
      const days=Math.round((new Date(c.fecha_tentativa_copy)-Date.now())/86400000);
      if(days<=7) notifs.push({urgent:days<=0,icon:"🎯",title:`${c.name} — Copy cliente`,sub:days<=0?`Vencida hace ${Math.abs(days)}d`:`En ${days} días`,client:c});
    }
    if(c.fecha_tentativa_aprobacion&&c.fecha_copy_cliente&&c.status!=="aprobado"){
      const days=Math.round((new Date(c.fecha_tentativa_aprobacion)-Date.now())/86400000);
      if(days<=14) notifs.push({urgent:days<=0,icon:"📋",title:`${c.name} — Aprobación`,sub:days<=0?`Vencida hace ${Math.abs(days)}d`:`En ${days} días`,client:c});
    }
    // Renewal alarm - 4 months before expiry
    if(c.expiry&&c.status==="aprobado"){
      const daysToExpiry=Math.round((new Date(c.expiry)-Date.now())/86400000);
      if(daysToExpiry<=120&&daysToExpiry>0) notifs.push({urgent:daysToExpiry<=30,icon:"🔄",title:`${c.name} — Renovar permiso`,sub:`Vence en ${daysToExpiry} días · ${c.client_id}`,client:c});
      else if(daysToExpiry<=0) notifs.push({urgent:true,icon:"🔴",title:`${c.name} — Permiso vencido`,sub:`Vencido hace ${Math.abs(daysToExpiry)} días · ${c.client_id}`,client:c});
    }
  });

  const filtered=clients.filter(c=>{
    const q=search.toLowerCase();
    return(!q||c.name.toLowerCase().includes(q)||(c.client_id||"").toLowerCase().includes(q)||(c.email||"").toLowerCase().includes(q))
      &&(!filterType||c.type===filterType)
      &&(!filterStatus||c.status===filterStatus)
      &&(!filterModalidad||c.modalidad===filterModalidad);
  });

  // PHOTO
  async function handlePhotoUpload(e){
    const file=e.target.files[0]; if(!file) return;
    setUploadingPhoto(true);
    try{ const url=await uploadPhoto(file,form.client_id||`temp-${Date.now()}`); setForm(p=>({...p,photo_url:url})); showToast("Foto cargada ✓"); }
    catch(e){ showToast("Error: "+e.message,false); }
    setUploadingPhoto(false); e.target.value="";
  }

  // PASSPORT
  async function handleFileUpload(e){
    const file=e.target.files[0]; if(!file) return; e.target.value="";
    if(file.type==="application/pdf"||file.name.toLowerCase().endsWith(".pdf")){
      setScanStep("scanning");
      try{
        const ab=await file.arrayBuffer(); const bytes=new Uint8Array(ab);
        let bin=""; for(let i=0;i<bytes.byteLength;i+=8192) bin+=String.fromCharCode(...bytes.subarray(i,i+8192));
        const b64=btoa(bin);
        const res=await fetch("/.netlify/functions/openai",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({mode:"passport_scan",image:b64,isPDF:true})});
        const data=await res.json(); const raw=data.content?.[0]?.text||"{}";
        let parsed={}; try{const m=raw.replace(/```json|```/g,"").trim().match(/\{[\s\S]*\}/);if(m)parsed=JSON.parse(m[0]);}catch{}
        if(!parsed.name&&!parsed.passport) throw new Error("No se pudieron extraer datos.");
        setForm({...emptyForm(),client_id:`CUR-${String(clients.length+1).padStart(3,"0")}`,name:parsed.name||"",nationality:parsed.nationality||"",birthdate:parsed.birthdate||"",passport:parsed.passport||"",notes:`Escaneado ${new Date().toLocaleDateString("es")}. Pasaporte vence: ${parsed.expiry||"N/A"}`,documents:["Pasaporte vigente"]});
        closePassportModal(); setModal({mode:"add"}); showToast("✓ Datos extraídos");
      }catch(err){showToast(err.message,false);setScanStep("choose");}
      return;
    }
    const reader=new FileReader();
    reader.onload=ev=>{setPassportPreview(ev.target.result);setScanStep("preview");};
    reader.readAsDataURL(file);
  }

  async function scanPassport(){
    if(!passportPreview) return; setScanStep("scanning");
    try{
      const compressed=await compressImage(passportPreview,800,0.65);
      const res=await fetch("/.netlify/functions/openai",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({mode:"passport_scan",image:compressed})});
      const data=await res.json(); const raw=data.content?.[0]?.text||"{}";
      let parsed={}; try{const m=raw.replace(/```json|```/g,"").trim().match(/\{[\s\S]*\}/);if(m)parsed=JSON.parse(m[0]);}catch{}
      if(!parsed.name&&!parsed.passport) throw new Error("No se pudieron extraer datos.");
      setForm({...emptyForm(),client_id:`CUR-${String(clients.length+1).padStart(3,"0")}`,name:parsed.name||"",nationality:parsed.nationality||"",birthdate:parsed.birthdate||"",passport:parsed.passport||"",notes:`Escaneado ${new Date().toLocaleDateString("es")}`,documents:["Pasaporte vigente"]});
      closePassportModal(); setModal({mode:"add"}); showToast("✓ Datos extraídos");
    }catch(e){showToast(e.message,false);setScanStep("preview");}
  }

  const PROGRAMAS = {
    "riba_e_luga": "Riba e Luga",
    "permiso_trabajo": "Permiso de Trabajo",
    "permiso_residencia": "Permiso de Residencia",
    "reunificacion_familiar": "Reunificación Familiar",
  };

  async function checkMigration(client, programa) {
    setMigrationModal(client);
    setMigrationResult(null);
    setMigrationLoading(true);
    setMigrationPrograma(programa);
    try {
      const res = await fetch("/.netlify/functions/openai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "migration_check", client, programa }),
      });
      const data = await res.json();
      const raw = data.content?.[0]?.text || "{}";
      const cleaned = raw.replace(/```json|```/g, "").trim();
      const match = cleaned.match(/\{[\s\S]*\}/);
      const parsed = match ? JSON.parse(match[0]) : {};
      setMigrationResult(parsed);
    } catch(e) {
      showToast("Error: " + e.message, false);
    }
    setMigrationLoading(false);
  }

  function openPassportModal(){setPassportModal(true);setPassportPreview(null);setScanStep("choose");}
  function closePassportModal(){setPassportModal(false);setPassportPreview(null);setScanStep("choose");}

  // FORM
  function emptyForm(){return{client_id:`CUR-${String(clients.length+1).padStart(3,"0")}`,type:"empleado",status:"proceso",modalidad:"convencional",duracion_permiso:"1y",total:"",paid:"0",expiry:"",fecha_vencimiento_real:"",name:"",email:"",phone:"",nationality:"",birthdate:"",passport:"",entry_date:"",emergency_contact:"",address:"",notes:"",documents:[],referido:"",caso_descripcion:"",photo_url:"",fecha_solicitud:"",fecha_copy_cliente:"",fecha_tentativa_copy:"",fecha_tentativa_aprobacion:"",declaracion_ob:false,ob_mensaje:""};}
  function openAdd(){setForm(emptyForm());setModal({mode:"add"});}
  function openEdit(c){setForm({...c,total:String(c.total||""),paid:String(c.paid||""),expiry:c.expiry||"",fecha_vencimiento_real:c.fecha_vencimiento_real||"",birthdate:c.birthdate||"",entry_date:c.entry_date||"",documents:c.documents||[],referido:c.referido||"",caso_descripcion:c.caso_descripcion||"",photo_url:c.photo_url||"",fecha_solicitud:c.fecha_solicitud||"",fecha_copy_cliente:c.fecha_copy_cliente||"",fecha_tentativa_copy:c.fecha_tentativa_copy||"",fecha_tentativa_aprobacion:c.fecha_tentativa_aprobacion||"",declaracion_ob:c.declaracion_ob||false,ob_mensaje:c.ob_mensaje||"",modalidad:c.modalidad||"convencional",duracion_permiso:c.duracion_permiso||"1y"});setModal({mode:"edit",id:c.id});}

  async function saveClient(){
    if(!form.name?.trim()){showToast("Nombre requerido",false);return;}
    setSaving(true);
    // Auto-calculate vencimiento when approved
    let fechaVencimientoReal = form.fecha_vencimiento_real||null;
    if(form.status==="aprobado" && form.fecha_tentativa_aprobacion && form.duracion_permiso && !fechaVencimientoReal) {
      fechaVencimientoReal = calcVencimiento(form.fecha_tentativa_aprobacion, form.duracion_permiso);
    }
    const data={client_id:form.client_id,name:form.name,type:form.type,status:form.status,modalidad:form.modalidad||"convencional",duracion_permiso:form.duracion_permiso||null,expiry:form.status==="aprobado"?(fechaVencimientoReal||form.expiry||null):form.expiry||null,fecha_vencimiento_real:fechaVencimientoReal,total:parseFloat(form.total)||0,paid:parseFloat(form.paid)||0,email:form.email,notes:form.notes,phone:form.phone,nationality:form.nationality,birthdate:form.birthdate||null,passport:form.passport,entry_date:form.entry_date||null,emergency_contact:form.emergency_contact,address:form.address,documents:form.documents||[],referido:form.referido||null,caso_descripcion:form.caso_descripcion||null,photo_url:form.photo_url||null,fecha_solicitud:form.fecha_solicitud||null,fecha_copy_cliente:form.fecha_copy_cliente||null,fecha_tentativa_copy:form.fecha_tentativa_copy||null,fecha_tentativa_aprobacion:form.fecha_tentativa_aprobacion||null,declaracion_ob:form.declaracion_ob||false,ob_mensaje:form.ob_mensaje||null};
    try{
      if(modal.mode==="add"){await supabaseReq("POST","/clients",data,accessToken);showToast("Cliente guardado ✓");}
      else{await supabaseReq("PATCH",`/clients?id=eq.${modal.id}`,data,accessToken);showToast("Actualizado ✓");}
      await load();setModal(null);
    }catch(e){showToast("Error: "+e.message,false);}
    setSaving(false);
  }

  async function deleteClient(){
    if(!window.confirm("¿Eliminar este cliente?")) return;
    try{await supabaseReq("DELETE",`/clients?id=eq.${modal.id}`,null,accessToken);showToast("Eliminado");await load();setModal(null);}
    catch{showToast("Error",false);}
  }

  function toggleDoc(doc){const docs=form.documents||[];setForm(p=>({...p,documents:docs.includes(doc)?docs.filter(d=>d!==doc):[...docs,doc]}));}
  function openGmail(c){window.open(`https://mail.google.com/mail/?view=cm&to=${c.email||""}&su=${encodeURIComponent(`CuraManage - ${c.client_id} - ${c.name}`)}&body=${encodeURIComponent(`Estimado/a ${c.name},\n\nMe comunico en relación a su trámite.\n\nSaludos,\nCuraManage`)}`,"_blank");}

  // AI
  function buildSP(){
    const list=clients.map(c=>`- ${c.name} | ${c.client_id} | ${c.type} | ${c.status} | deuda:ANG ${(c.total||0)-(c.paid||0)}`).join("\n");
    return `Eres el asistente IA de CuraManage, Curaçao.\nCLIENTES:\n${list}\nACCIONES:\n[ACTION:{"type":"update_status","client_id":"CUR-XXX","value":"proceso|pendiente|aprobado|rechazado"}]\n[ACTION:{"type":"add_payment","client_id":"CUR-XXX","amount":500}]`;
  }
  async function sendAI(text){
    if(!text.trim()||aiLoading) return;
    const msg={role:"user",content:text};
    setAiMsgs(p=>[...p,msg]);setAiInput("");setAiLoading(true);
    try{
      const res=await fetch("/.netlify/functions/claude",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({system:buildSP(),max_tokens:1000,messages:[...aiMsgs,msg].slice(-16)})});
      const data=await res.json(); let reply=data.content?.[0]?.text||"Error.";
      const m=reply.match(/\[ACTION:(\{.*?\})\]/);
      if(m){try{const a=JSON.parse(m[1]);reply=reply.replace(/\[ACTION:\{.*?\}\]/,"").trim();setPendingAction(a);}catch{}}
      setAiMsgs(p=>[...p,{role:"assistant",content:reply}]);
    }catch{setAiMsgs(p=>[...p,{role:"assistant",content:"Error de conexión."}]);}
    setAiLoading(false);
  }
  useEffect(()=>{
    if(!pendingAction) return;
    const action=pendingAction; const client=clients.find(c=>c.client_id===action.client_id);
    if(!client){setPendingAction(null);return;}
    async function execute(){
      try{
        let upd={};
        if(action.type==="update_status") upd={status:action.value};
        else if(action.type==="add_payment") upd={paid:Math.min((client.paid||0)+action.amount,client.total||9999)};
        await supabaseReq("PATCH",`/clients?id=eq.${client.id}`,upd,accessToken);
        await load();showToast(`✓ ${client.name} actualizado`);
      }catch{showToast("Error",false);}
      setPendingAction(null);
    }
    execute();
  },[pendingAction]);

  function askAbout(c){
    const debt=(c.total||0)-(c.paid||0);
    const missing=(REQUIRED_DOCS[c.type]||[]).filter(d=>!(c.documents||[]).includes(d));
    setShowAI(true);
    sendAI(`Analiza: ${c.name} (${c.client_id})\nTipo: ${c.type} | Estatus: ${c.status}\nDeuda: ANG ${debt}\nDocs faltantes: ${missing.length>0?missing.join(", "):"Ninguno"}\nCaso: ${c.caso_descripcion||"Sin descripción"}`);
  }

  // DOCUMENTS
  const [clientDocs, setClientDocs] = useState([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [uploadingDocs, setUploadingDocs] = useState(false);
  const docsInputRef = useRef(null);
  const folderInputRef = useRef(null);
  const [folderModal, setFolderModal] = useState(false);
  const [folderFiles, setFolderFiles] = useState([]);
  const [folderClientId, setFolderClientId] = useState("");
  const [importingFolder, setImportingFolder] = useState(false);

  async function handleFolderImport(e) {
    const files = Array.from(e.target.files);
    if(files.length === 0) return;
    e.target.value = "";
    setFolderFiles(files);
    setFolderClientId("");
    setFolderModal(true);
  }

  async function importFolderToClient() {
    if(!folderClientId) { showToast("Selecciona un cliente", false); return; }
    const client = clients.find(c => c.id === folderClientId);
    if(!client) return;
    setImportingFolder(true);
    await uploadClientDocs(folderFiles, folderClientId);
    setImportingFolder(false);
    setFolderModal(false);
    setFolderFiles([]);
    showToast(`${folderFiles.length} archivos importados a ${client.name} ✓`);
  }

  async function loadClientDocs(clientId) {
    setDocsLoading(true);
    try {
      const res = await supabaseReq("GET", `/client_documents?client_id=eq.${clientId}&order=created_at.desc&select=*`, null, accessToken);
      setClientDocs(res);
    } catch(e) { console.error(e); }
    setDocsLoading(false);
  }

  async function uploadClientDocs(files, clientId) {
    setUploadingDocs(true);
    let uploaded = 0;
    for(const file of files) {
      try {
        const ext = file.name.split(".").pop();
        const path = `${clientId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g,"_")}`;
        const { error } = await supabase.storage.from("client-photos").upload(path, file, { upsert:true, contentType:file.type });
        if(error) throw error;
        const { data: urlData } = supabase.storage.from("client-photos").getPublicUrl(path);
        await supabaseReq("POST", "/client_documents", {
          client_id: clientId,
          name: file.name,
          url: urlData.publicUrl,
          type: file.type,
          size: file.size,
        }, accessToken);
        uploaded++;
      } catch(e) { console.error("Error uploading", file.name, e.message); }
    }
    showToast(`${uploaded} archivo(s) subido(s) ✓`);
    await loadClientDocs(clientId);
    setUploadingDocs(false);
  }

  async function deleteClientDoc(docId, clientId) {
    if(!window.confirm("¿Eliminar este documento?")) return;
    try {
      await supabaseReq("DELETE", `/client_documents?id=eq.${docId}`, null, accessToken);
      await loadClientDocs(clientId);
      showToast("Documento eliminado");
    } catch(e) { showToast("Error", false); }
  }

  function getFileIcon(type) {
    if(!type) return "📄";
    if(type.includes("pdf")) return "📕";
    if(type.includes("image")) return "🖼️";
    if(type.includes("word")) return "📘";
    if(type.includes("excel") || type.includes("spreadsheet")) return "📗";
    return "📄";
  }

  function formatFileSize(bytes) {
    if(!bytes) return "";
    if(bytes < 1024) return bytes + " B";
    if(bytes < 1024*1024) return Math.round(bytes/1024) + " KB";
    return (bytes/(1024*1024)).toFixed(1) + " MB";
  }

  // AVATAR
  function Avatar({url,name,size=40,clickable=false}){
    const initials=(name||"?").split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase();
    const style={width:size,height:size,borderRadius:"50%",flexShrink:0,cursor:clickable&&url?"zoom-in":"default"};
    if(url) return <img src={url} onClick={clickable?()=>setPhotoViewer(url):undefined} style={{...style,objectFit:"cover",border:"2px solid #e2e8f0"}} alt={name}/>;
    return <div style={{...style,background:"linear-gradient(135deg,#6366f1,#8b5cf6)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:size*0.35,fontWeight:700,color:"#fff",border:"2px solid #e2e8f0"}}>{initials}</div>;
  }

  // ── STYLES ─────────────────────────────────────────────────────────────────
  const S={
    // Layout
    page:{fontFamily:"'Plus Jakarta Sans',system-ui,sans-serif",background:"#f1f5f9",color:"#1e293b",fontSize:14,minHeight:"100vh"},
    sidebar:{width:240,minWidth:240,background:"#fff",borderRight:"1px solid #e2e8f0",display:"flex",flexDirection:"column",flexShrink:0,height:"100vh"},
    content:{maxWidth:1100,margin:"0 auto",padding:"24px 24px"},
    contentMobile:{padding:"14px"},
    // Nav
    navItem:(a)=>({display:"flex",alignItems:"center",gap:10,padding:"9px 12px",borderRadius:10,cursor:"pointer",fontSize:13,color:a?"#6366f1":"#64748b",fontWeight:a?600:500,background:a?"#f0f0ff":"transparent",transition:"all 0.12s",userSelect:"none",margin:"1px 8px"}),
    navBadge:{marginLeft:"auto",background:"#ef4444",color:"#fff",borderRadius:20,fontSize:10,fontWeight:700,padding:"2px 7px"},
    // Buttons
    btnP:{padding:"9px 16px",borderRadius:10,fontSize:13,fontWeight:600,cursor:"pointer",background:"#6366f1",color:"#fff",border:"none",fontFamily:"inherit",transition:"all 0.15s"},
    btnG:{padding:"8px 14px",borderRadius:10,fontSize:13,fontWeight:500,cursor:"pointer",background:"#fff",color:"#64748b",border:"1px solid #e2e8f0",fontFamily:"inherit",transition:"all 0.15s"},
    btnD:{padding:"8px 14px",borderRadius:10,fontSize:12,cursor:"pointer",background:"#fef2f2",color:"#ef4444",border:"1px solid #fecaca",fontFamily:"inherit",fontWeight:500},
    btnS:{padding:"8px 14px",borderRadius:10,fontSize:12,cursor:"pointer",background:"#ecfdf5",color:"#10b981",border:"1px solid #a7f3d0",fontFamily:"inherit",fontWeight:500},
    // Cards
    card:{background:"#fff",border:"1px solid #e2e8f0",borderRadius:16,padding:"20px",boxShadow:"0 1px 3px rgba(0,0,0,0.04)"},
    cardSm:{background:"#fff",border:"1px solid #e2e8f0",borderRadius:12,padding:"14px 16px",boxShadow:"0 1px 3px rgba(0,0,0,0.04)"},
    // Badge
    badge:(cfg)=>({display:"inline-flex",alignItems:"center",padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:600,color:cfg.color,background:cfg.bg,border:`1px solid ${cfg.border}`,whiteSpace:"nowrap"}),
    // Form
    input:{background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:10,padding:"10px 14px",fontSize:14,color:"#1e293b",fontFamily:"inherit",outline:"none",width:"100%",transition:"border-color 0.15s"},
    fLabel:{fontSize:11,color:"#64748b",textTransform:"uppercase",letterSpacing:"0.07em",display:"block",marginBottom:5,fontWeight:600},
    // Modal
    overlay:{position:"fixed",inset:0,background:"rgba(15,23,42,0.4)",backdropFilter:"blur(4px)",zIndex:100,display:"flex",alignItems:"flex-end",justifyContent:"center"},
    modal:{background:"#fff",borderRadius:"20px 20px 0 0",width:"100%",maxHeight:"94vh",overflowY:"auto",boxShadow:"0 -4px 32px rgba(0,0,0,0.12)"},
    mHead:{padding:"18px 20px 14px",borderBottom:"1px solid #f1f5f9",display:"flex",alignItems:"center",position:"sticky",top:0,background:"#fff",zIndex:1},
    mClose:{marginLeft:"auto",background:"#f8fafc",border:"1px solid #e2e8f0",color:"#64748b",width:32,height:32,borderRadius:8,cursor:"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center"},
    mFoot:{padding:"14px 20px 20px",display:"flex",gap:8,justifyContent:"flex-end",flexWrap:"wrap",borderTop:"1px solid #f1f5f9",position:"sticky",bottom:0,background:"#fff",zIndex:1},
    // AI
    aiPanel:{width:340,minWidth:340,background:"#fff",borderLeft:"1px solid #e2e8f0",display:"flex",flexDirection:"column",height:"100vh"},
    aiDrawer:{position:"fixed",bottom:65,left:0,right:0,height:"72vh",background:"#fff",borderTop:"1px solid #e2e8f0",display:"flex",flexDirection:"column",zIndex:40,transform:showAI?"translateY(0)":"translateY(100%)",transition:"transform 0.3s ease",boxShadow:"0 -4px 20px rgba(0,0,0,0.1)"},
    aiMsg:(u)=>({alignSelf:u?"flex-end":"flex-start",background:u?"#6366f1":"#f8fafc",border:u?"none":"1px solid #e2e8f0",padding:"10px 13px",borderRadius:u?"14px 14px 2px 14px":"14px 14px 14px 2px",fontSize:13,lineHeight:1.55,maxWidth:"90%",whiteSpace:"pre-wrap",color:u?"#fff":"#1e293b"}),
    // Topbar
    topbar:{background:"#fff",borderBottom:"1px solid #e2e8f0",padding:"12px 24px",display:"flex",alignItems:"center",gap:12,flexShrink:0},
    // Mobile nav
    mobileNav:{position:"fixed",bottom:0,left:0,right:0,background:"#fff",borderTop:"1px solid #e2e8f0",display:"flex",zIndex:50,boxShadow:"0 -2px 10px rgba(0,0,0,0.06)"},
    mNavBtn:(a)=>({flex:1,display:"flex",flexDirection:"column",alignItems:"center",padding:"10px 4px 8px",cursor:"pointer",color:a?"#6366f1":"#94a3b8",fontSize:10,fontWeight:a?600:400,gap:3,background:"transparent",border:"none",fontFamily:"inherit",position:"relative"}),
    // Toast
    toast:(ok)=>({position:"fixed",top:20,left:"50%",transform:"translateX(-50%)",zIndex:300,background:ok?"#ecfdf5":"#fef2f2",border:`1px solid ${ok?"#a7f3d0":"#fecaca"}`,color:ok?"#059669":"#ef4444",padding:"12px 20px",borderRadius:12,fontSize:13,fontWeight:600,boxShadow:"0 4px 12px rgba(0,0,0,0.1)",whiteSpace:"nowrap",maxWidth:"90vw",textAlign:"center"}),
    // Section header
    secTitle:{fontFamily:"'Fraunces',serif",fontSize:18,fontWeight:700,color:"#1e293b"},
  };

  function Badge({cfg}){return <span style={S.badge(cfg)}>{cfg.label}</span>;}

  // CLIENT CARD
  function ClientCard({c}){
    const debt=(c.total||0)-(c.paid||0);
    const urgent=c.expiry&&(new Date(c.expiry)-Date.now())<30*86400000&&c.status!=="aprobado";
    const pct=c.total?Math.round((c.paid/c.total)*100):0;
    const pcol=pct===100?"#10b981":pct>=50?"#f59e0b":"#ef4444";
    const missing=(REQUIRED_DOCS[c.type]||[]).filter(d=>!(c.documents||[]).includes(d)).length;
    const hasCopy=!!c.fecha_copy_cliente;
    const isApproved=c.status==="aprobado";
    const showTimeline=!!(c.fecha_tentativa_copy||c.fecha_copy_cliente||c.fecha_tentativa_aprobacion);

    return(
      <div style={{...S.card,marginBottom:10,cursor:"pointer",transition:"box-shadow 0.15s,transform 0.15s"}}
        onClick={()=>{setClientModal(c);loadClientDocs(c.id);}}
        onMouseEnter={e=>{e.currentTarget.style.boxShadow="0 4px 16px rgba(0,0,0,0.08)";e.currentTarget.style.transform="translateY(-1px)";}}
        onMouseLeave={e=>{e.currentTarget.style.boxShadow="0 1px 3px rgba(0,0,0,0.04)";e.currentTarget.style.transform="translateY(0)";}}>
        <div style={{display:"flex",gap:12,alignItems:"flex-start",marginBottom:12}}>
          <Avatar url={c.photo_url} name={c.name} size={44}/>
          <div style={{flex:1,minWidth:0}}>
            <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:8}}>
              <div>
                <div style={{fontWeight:700,fontSize:15,color:"#1e293b",marginBottom:2}}>{c.name}</div>
                <div style={{fontSize:12,color:"#94a3b8"}}>{c.client_id}{c.nationality?` · ${c.nationality}`:""}</div>
              </div>
              <Badge cfg={STATUS_CFG[c.status]||{label:c.status,color:"#64748b",bg:"#f8fafc",border:"#e2e8f0"}}/>
            </div>
          </div>
        </div>

        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:12}}>
          <Badge cfg={TYPE_CFG[c.type]||{label:c.type,color:"#64748b",bg:"#f8fafc",border:"#e2e8f0"}}/>
          {c.modalidad&&c.type!=="contabilidad"&&<span style={{fontSize:11,color:MODALIDAD_CFG[c.modalidad]?.color||"#6366f1",padding:"3px 8px",borderRadius:20,background:MODALIDAD_CFG[c.modalidad]?.bg||"#f0f0ff",border:`1px solid ${MODALIDAD_CFG[c.modalidad]?.border||"#c7d2fe"}`}}>{c.modalidad==="riba_e_luga"?"🏝️ Riba e Luga":"📋 Convencional"}</span>}
          {c.referido&&<span style={{fontSize:11,color:"#f59e0b",padding:"3px 8px",borderRadius:20,background:"#fffbeb",border:"1px solid #fde68a"}}>👤 {c.referido}</span>}
          {c.expiry&&<span style={{fontSize:11,color:urgent?"#ef4444":"#64748b",padding:"3px 8px",borderRadius:20,background:urgent?"#fef2f2":"#f8fafc",border:`1px solid ${urgent?"#fecaca":"#e2e8f0"}`}}>{new Date(c.expiry).toLocaleDateString("es",{day:"2-digit",month:"short",year:"2-digit"})}{urgent?" ⚠":""}</span>}
          {missing>0&&<span style={{fontSize:11,color:"#ef4444",padding:"3px 8px",borderRadius:20,background:"#fef2f2",border:"1px solid #fecaca"}}>⚠ {missing} docs</span>}
          {c.declaracion_ob&&<span style={{fontSize:11,color:"#f59e0b",padding:"3px 8px",borderRadius:20,background:"#fffbeb",border:"1px solid #fde68a"}}>📊 OB</span>}
        </div>

        {c.caso_descripcion&&<div style={{fontSize:12,color:"#64748b",marginBottom:12,lineHeight:1.5,overflow:"hidden",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",background:"#f8fafc",padding:"8px 10px",borderRadius:8,borderLeft:"3px solid #e2e8f0"}}>{c.caso_descripcion}</div>}

        {/* TIMELINE */}
        {showTimeline&&<div style={{background:"#f8fafc",borderRadius:10,padding:"10px 12px",marginBottom:12,border:"1px solid #e2e8f0"}}>
          <div style={{fontSize:10,color:"#94a3b8",textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:8,fontWeight:600}}>Progreso del trámite</div>
          <div style={{display:"flex",alignItems:"flex-start"}}>
            {[
              {icon:hasCopy?"✅":"🎯",label:"Copy cliente",sublabel:hasCopy?"Completado":"Tentativa",date:hasCopy?c.fecha_copy_cliente:c.fecha_tentativa_copy,done:hasCopy,active:!hasCopy},
              {icon:isApproved?"✅":hasCopy?"🎯":"🔒",label:"Aprobación",sublabel:isApproved?"Completado":hasCopy?"Tentativa":"Pendiente",date:c.fecha_tentativa_aprobacion,done:isApproved,active:hasCopy&&!isApproved},
            ].map((s,i)=>(
              <div key={i} style={{display:"flex",alignItems:"flex-start",flex:1}}>
                <div style={{display:"flex",flexDirection:"column",alignItems:"center",flex:1}}>
                  <div style={{width:30,height:30,borderRadius:"50%",
                    background:s.done?"#ecfdf5":s.active?"#f0f0ff":"#f8fafc",
                    border:`2px solid ${s.done?"#10b981":s.active?"#6366f1":"#e2e8f0"}`,
                    display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,marginBottom:4}}>{s.icon}</div>
                  <div style={{fontSize:11,fontWeight:600,color:s.done?"#10b981":s.active?"#6366f1":"#94a3b8",textAlign:"center"}}>{s.label}</div>
                  <div style={{fontSize:10,color:"#94a3b8",textAlign:"center",marginTop:1}}>{s.sublabel}</div>
                  <div style={{fontSize:10,fontWeight:600,marginTop:3,textAlign:"center",color:s.done?"#10b981":s.active?"#6366f1":"#cbd5e1",background:s.done?"#ecfdf5":s.active?"#f0f0ff":"#f8fafc",padding:"2px 7px",borderRadius:6}}>
                    {s.date?new Date(s.date).toLocaleDateString("es",{day:"2-digit",month:"short",year:"2-digit"}):"Sin fecha"}
                  </div>
                </div>
                {i===0&&<div style={{height:2,flex:"0 0 20px",background:hasCopy?"#10b981":"#e2e8f0",marginTop:15}}/>}
              </div>
            ))}
          </div>
        </div>}

        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{flex:1}}>
            <div style={{height:5,background:"#f1f5f9",borderRadius:3,overflow:"hidden",marginBottom:4}}>
              <div style={{width:`${pct}%`,height:"100%",background:pcol,borderRadius:3,transition:"width 0.3s"}}/>
            </div>
            <div style={{fontSize:11,color:"#94a3b8"}}>{pct}% pagado · {debt>0?`ANG ${debt} pendiente`:"✓ al día"}</div>
          </div>
          <div style={{display:"flex",gap:6}} onClick={e=>e.stopPropagation()}>
            <button onClick={()=>openEdit(c)} style={{...S.btnG,padding:"6px 10px",fontSize:12,minWidth:34,display:"flex",alignItems:"center",justifyContent:"center"}}>✎</button>
            <button onClick={()=>askAbout(c)} style={{...S.btnG,padding:"6px 10px",fontSize:12,minWidth:34,display:"flex",alignItems:"center",justifyContent:"center",color:"#6366f1",borderColor:"#c7d2fe"}}>✦</button>
            <button onClick={()=>checkMigration(c,"permiso_trabajo")} style={{...S.btnG,padding:"6px 10px",fontSize:12,minWidth:34,display:"flex",alignItems:"center",justifyContent:"center",color:"#10b981",borderColor:"#a7f3d0"}} title="Revisar documentos migratorios">🛂</button>
          </div>
        </div>
      </div>
    );
  }

  // DESKTOP TABLE ROW
  function DRow({c}){
    const debt=(c.total||0)-(c.paid||0);
    const pct=c.total?Math.round((c.paid/c.total)*100):0;
    const pcol=pct===100?"#10b981":pct>=50?"#f59e0b":"#ef4444";
    const urgent=c.expiry&&(new Date(c.expiry)-Date.now())<30*86400000&&c.status!=="aprobado";
    return(
      <tr style={{cursor:"pointer",transition:"background 0.1s"}}
        onMouseEnter={e=>e.currentTarget.style.background="#f8fafc"}
        onMouseLeave={e=>e.currentTarget.style.background="transparent"}
        onClick={()=>{setClientModal(c);loadClientDocs(c.id);}}>
        <td style={{padding:"12px 16px",borderBottom:"1px solid #f1f5f9"}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <Avatar url={c.photo_url} name={c.name} size={34}/>
            <div>
              <div style={{fontWeight:600,fontSize:13,color:"#1e293b"}}>{c.name}</div>
              <div style={{fontSize:11,color:"#94a3b8"}}>{c.client_id}{c.nationality?` · ${c.nationality}`:""}</div>
            </div>
          </div>
        </td>
        <td style={{padding:"12px 16px",borderBottom:"1px solid #f1f5f9"}}><Badge cfg={TYPE_CFG[c.type]||{label:c.type,color:"#64748b",bg:"#f8fafc",border:"#e2e8f0"}}/></td>
        <td style={{padding:"12px 16px",borderBottom:"1px solid #f1f5f9"}}><Badge cfg={STATUS_CFG[c.status]||{label:c.status,color:"#64748b",bg:"#f8fafc",border:"#e2e8f0"}}/></td>
        <td style={{padding:"12px 16px",borderBottom:"1px solid #f1f5f9",fontSize:12,color:urgent?"#ef4444":"#64748b"}}>{c.expiry?new Date(c.expiry).toLocaleDateString("es",{day:"2-digit",month:"short",year:"2-digit"}):"—"}{urgent?" ⚠":""}</td>
        <td style={{padding:"12px 16px",borderBottom:"1px solid #f1f5f9"}}>
          <div style={{width:80}}>
            <div style={{height:4,background:"#f1f5f9",borderRadius:2,overflow:"hidden",marginBottom:3}}>
              <div style={{width:`${pct}%`,height:"100%",background:pcol,borderRadius:2}}/>
            </div>
            <div style={{fontSize:10,color:"#94a3b8"}}>{pct}%</div>
          </div>
        </td>
        <td style={{padding:"12px 16px",borderBottom:"1px solid #f1f5f9",fontWeight:600,fontSize:13,color:debt<=0?"#10b981":"#ef4444"}}>{debt<=0?"✓":`ANG ${debt}`}</td>
        <td style={{padding:"12px 16px",borderBottom:"1px solid #f1f5f9"}} onClick={e=>e.stopPropagation()}>
          <div style={{display:"flex",gap:4}}>
            <button onClick={()=>openEdit(c)} style={{...S.btnG,padding:"4px 8px",fontSize:11}}>✎</button>
            <button onClick={()=>askAbout(c)} style={{...S.btnG,padding:"4px 8px",fontSize:11,color:"#6366f1"}}>✦</button>
            <button onClick={()=>exportToPDF(c)} style={{...S.btnG,padding:"4px 8px",fontSize:11}}>⬇</button>
          </div>
        </td>
      </tr>
    );
  }

  const AI_PANEL=(
    <>
      <div style={{padding:"14px 16px",borderBottom:"1px solid #f1f5f9",display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
        <div style={{width:8,height:8,borderRadius:"50%",background:"#10b981",boxShadow:"0 0 6px #10b981"}}/>
        <div style={{fontFamily:"'Fraunces',serif",fontSize:14,fontWeight:700,color:"#1e293b"}}>Asistente IA</div>
        <div style={{marginLeft:"auto",fontSize:11,color:"#94a3b8"}}>{clients.length} clientes</div>
        <button style={{...S.btnG,padding:"4px 8px",fontSize:12,marginLeft:4}} onClick={()=>setShowAI(false)}>✕</button>
      </div>
      <div ref={aiRef} style={{flex:1,overflowY:"auto",padding:"12px",display:"flex",flexDirection:"column",gap:8,WebkitOverflowScrolling:"touch"}}>
        {aiMsgs.map((m,i)=><div key={i} style={S.aiMsg(m.role==="user")}>{m.content}</div>)}
        {aiLoading&&<div style={{...S.aiMsg(false),padding:"12px 14px"}}><div style={{display:"flex",gap:5}}>{[0,1,2].map(i=><div key={i} style={{width:7,height:7,borderRadius:"50%",background:"#94a3b8",animation:`bounce 1.2s infinite ${i*0.2}s`}}/>)}</div></div>}
      </div>
      <div style={{padding:"8px 12px",display:"flex",gap:5,flexWrap:"wrap",borderTop:"1px solid #f1f5f9",flexShrink:0}}>
        {["📋 Deudas pendientes","⚠ Vencimientos","✉ Carta permiso","💬 Recordatorio pago"].map((b,i)=>(
          <button key={i} style={{fontSize:11,padding:"5px 9px",borderRadius:20,border:"1px solid #e2e8f0",background:"#f8fafc",color:"#6366f1",cursor:"pointer",fontFamily:"inherit",fontWeight:500}} onClick={()=>sendAI(b)}>{b}</button>
        ))}
      </div>
      <div style={{padding:"10px 12px",borderTop:"1px solid #f1f5f9",display:"flex",gap:7,alignItems:"flex-end",flexShrink:0}}>
        <textarea style={{flex:1,background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:10,padding:"9px 12px",fontSize:13,color:"#1e293b",fontFamily:"inherit",outline:"none",resize:"none",lineHeight:1.4}} value={aiInput} rows={1} placeholder="Escribe o da un comando..." onChange={e=>setAiInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendAI(aiInput);}}}/>
        <button style={{width:38,height:38,borderRadius:10,background:aiLoading||!aiInput.trim()?"#f8fafc":"#6366f1",border:`1px solid ${aiLoading||!aiInput.trim()?"#e2e8f0":"#6366f1"}`,color:aiLoading||!aiInput.trim()?"#94a3b8":"#fff",cursor:aiLoading||!aiInput.trim()?"not-allowed":"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}} disabled={aiLoading||!aiInput.trim()} onClick={()=>sendAI(aiInput)}>↑</button>
      </div>
    </>
  );

  const PASSPORT_MODAL=passportModal&&(
    <div style={S.overlay} onClick={e=>{if(e.target===e.currentTarget)closePassportModal();}}>
      <div style={{...S.modal,maxHeight:"96vh"}} onClick={e=>e.stopPropagation()}>
        <div style={S.mHead}>
          <div style={{fontFamily:"'Fraunces',serif",fontSize:16,fontWeight:700}}>📷 Escanear pasaporte</div>
          <button style={S.mClose} onClick={closePassportModal}>✕</button>
        </div>
        <div style={{padding:"20px"}}>
          {scanStep==="choose"&&(
            <div>
              <button style={{background:"#f8fafc",border:"2px dashed #c7d2fe",borderRadius:16,cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:12,padding:"36px 20px",width:"100%",marginBottom:16,fontFamily:"inherit"}} onClick={()=>fileInputRef.current?.click()}>
                <span style={{fontSize:48}}>🗂️</span>
                <div style={{fontWeight:700,fontSize:16,color:"#1e293b"}}>Seleccionar archivo</div>
                <div style={{fontSize:13,color:"#94a3b8"}}>Foto JPG/PNG o PDF del pasaporte</div>
              </button>
              <input ref={fileInputRef} type="file" accept="image/*,.pdf" style={{display:"none"}} onChange={handleFileUpload}/>
            </div>
          )}
          {scanStep==="preview"&&passportPreview&&(
            <div>
              <div style={{position:"relative",marginBottom:16,borderRadius:12,overflow:"hidden",border:"1px solid #e2e8f0",background:"#000",lineHeight:0}}>
                <img src={passportPreview} alt="Passport" style={{width:"100%",maxHeight:"48vh",objectFit:"contain",display:"block"}}/>
                <button style={{position:"absolute",top:10,right:10,...S.btnG,padding:"5px 10px",fontSize:12}} onClick={()=>setScanStep("choose")}>✕</button>
              </div>
              <div style={{display:"flex",gap:12}}>
                <button style={{...S.btnG,flex:1,padding:"12px"}} onClick={()=>setScanStep("choose")}>← Cambiar</button>
                <button style={{flex:2,padding:"13px",borderRadius:10,fontSize:14,fontWeight:700,cursor:"pointer",background:"#6366f1",color:"#fff",border:"none",fontFamily:"inherit"}} onClick={scanPassport}>🔍 Extraer datos</button>
              </div>
            </div>
          )}
          {scanStep==="scanning"&&(
            <div style={{textAlign:"center",padding:"40px 20px"}}>
              <div style={{fontSize:48,marginBottom:16,animation:"spin 1.5s linear infinite",display:"inline-block",color:"#6366f1"}}>⟳</div>
              <div style={{fontFamily:"'Fraunces',serif",fontWeight:700,fontSize:18,color:"#1e293b",marginBottom:8}}>Analizando documento...</div>
              <div style={{fontSize:13,color:"#64748b"}}>Puede tardar 5-15 segundos.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const CLIENT_FOLDER=clientModal&&(
    <div style={S.overlay} onClick={e=>{if(e.target===e.currentTarget)setClientModal(null);}}>
      <div style={S.modal} onClick={e=>e.stopPropagation()}>
        <div style={S.mHead}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <Avatar url={clientModal.photo_url} name={clientModal.name} size={44} clickable={true}/>
            <div>
              <div style={{fontFamily:"'Fraunces',serif",fontSize:16,fontWeight:700,color:"#1e293b"}}>{clientModal.name}</div>
              <div style={{fontSize:12,color:"#94a3b8",marginTop:1}}>{clientModal.client_id}</div>
            </div>
          </div>
          <div style={{marginLeft:"auto",display:"flex",gap:6}}>
            <button style={S.btnS} onClick={()=>exportToPDF(clientModal)}>⬇ PDF</button>
            <button style={S.btnG} onClick={()=>{setClientModal(null);openGmail(clientModal);}}>✉</button>
            <button style={S.mClose} onClick={()=>{setClientModal(null);setClientDocs([]);}}>✕</button>
          </div>
        </div>
        <div style={{padding:"18px 20px"}}>
          {/* Modalidad badge in folder */}
          {clientModal.modalidad&&clientModal.type!=="contabilidad"&&<div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
            <span style={{fontSize:12,fontWeight:600,color:MODALIDAD_CFG[clientModal.modalidad]?.color||"#6366f1",padding:"4px 12px",borderRadius:20,background:MODALIDAD_CFG[clientModal.modalidad]?.bg||"#f0f0ff",border:`1px solid ${MODALIDAD_CFG[clientModal.modalidad]?.border||"#c7d2fe"}`}}>
              {clientModal.modalidad==="riba_e_luga"?"🏝️ Riba e Luga":"📋 Convencional"}
            </span>
            {clientModal.duracion_permiso&&<span style={{fontSize:12,fontWeight:600,color:"#6366f1",padding:"4px 12px",borderRadius:20,background:"#f0f0ff",border:"1px solid #c7d2fe"}}>
              ⏱️ {{"6m":"6 meses","1y":"1 año","2y":"2 años","3y":"3 años"}[clientModal.duracion_permiso]||clientModal.duracion_permiso}
            </span>}
            {clientModal.fecha_vencimiento_real&&<span style={{fontSize:12,fontWeight:600,color:"#10b981",padding:"4px 12px",borderRadius:20,background:"#ecfdf5",border:"1px solid #a7f3d0"}}>
              📅 Vence: {new Date(clientModal.fecha_vencimiento_real).toLocaleDateString("es",{day:"2-digit",month:"short",year:"numeric"})}
            </span>}
          </div>}
          {clientModal.declaracion_ob&&<div style={{background:"#fffbeb",border:"1px solid #fde68a",borderRadius:12,padding:"12px 14px",marginBottom:12}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:clientModal.ob_mensaje?6:0}}>
              <span>📊</span><div style={{fontSize:13,fontWeight:600,color:"#f59e0b"}}>Declaración OB mensual activa</div>
              <span style={{marginLeft:"auto",fontSize:11,color:"#f59e0b",background:"#fffbeb",padding:"2px 8px",borderRadius:10,border:"1px solid #fde68a"}}>Día 14</span>
            </div>
            {clientModal.ob_mensaje&&<div style={{fontSize:13,color:"#92400e",lineHeight:1.5}}>{clientModal.ob_mensaje}</div>}
          </div>}
          {clientModal.referido&&<div style={{background:"#fffbeb",border:"1px solid #fde68a",borderRadius:12,padding:"10px 14px",marginBottom:12}}>
            <div style={{fontSize:11,color:"#f59e0b",textTransform:"uppercase",marginBottom:2,fontWeight:600}}>Referido por</div>
            <div style={{fontSize:13,fontWeight:500}}>{clientModal.referido}</div>
          </div>}
          {clientModal.caso_descripcion&&<div style={{background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:12,padding:"12px 14px",marginBottom:12,borderLeft:"3px solid #6366f1"}}>
            <div style={{fontSize:11,color:"#6366f1",textTransform:"uppercase",marginBottom:6,fontWeight:600}}>Descripción del caso</div>
            <div style={{fontSize:13,lineHeight:1.6,color:"#475569",whiteSpace:"pre-wrap"}}>{clientModal.caso_descripcion}</div>
          </div>}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
            {[{label:"Teléfono",value:clientModal.phone},{label:"Nacionalidad",value:clientModal.nationality},{label:"Nacimiento",value:clientModal.birthdate},{label:"Pasaporte",value:clientModal.passport},{label:"Entrada Curaçao",value:clientModal.entry_date},{label:"Email",value:clientModal.email},{label:"📅 Fecha solicitud",value:clientModal.fecha_solicitud},{label:"🎯 Tentativa copy",value:clientModal.fecha_tentativa_copy},{label:"✅ Copy cliente",value:clientModal.fecha_copy_cliente},{label:"🎯 Tentativa aprobación",value:clientModal.fecha_tentativa_aprobacion},{label:"Dirección",value:clientModal.address,full:true},{label:"Emergencia",value:clientModal.emergency_contact,full:true}].filter(f=>f.value).map((f,i)=>(
              <div key={i} style={{gridColumn:f.full?"1/-1":"auto",background:"#f8fafc",borderRadius:10,padding:"10px 12px",border:"1px solid #e2e8f0"}}>
                <div style={{fontSize:10,color:"#94a3b8",textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:2,fontWeight:600}}>{f.label}</div>
                <div style={{fontSize:13,color:"#1e293b",fontWeight:500}}>{f.value}</div>
              </div>
            ))}
          </div>
          <div style={{fontSize:11,fontWeight:700,color:"#64748b",textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:10}}>Documentos — {(clientModal.documents||[]).length}/{(REQUIRED_DOCS[clientModal.type]||[]).length}</div>
          {(REQUIRED_DOCS[clientModal.type]||[]).map((doc,i)=>{
            const has=(clientModal.documents||[]).includes(doc);
            return(<div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",borderRadius:8,background:has?"#ecfdf5":"#fef2f2",border:`1px solid ${has?"#a7f3d0":"#fecaca"}`,marginBottom:6}}>
              <span style={{fontSize:14}}>{has?"✅":"❌"}</span>
              <span style={{fontSize:13,flex:1,color:"#1e293b"}}>{doc}</span>
              <span style={{fontSize:11,color:has?"#10b981":"#ef4444",fontWeight:600}}>{has?"✓":"Falta"}</span>
            </div>);
          })}
          {clientModal.notes&&<div style={{background:"#f8fafc",borderRadius:10,padding:"12px",border:"1px solid #e2e8f0",marginTop:12}}>
            <div style={{fontSize:10,color:"#94a3b8",textTransform:"uppercase",fontWeight:600,marginBottom:4}}>Notas</div>
            <div style={{fontSize:13,lineHeight:1.6,color:"#475569"}}>{clientModal.notes}</div>
          </div>}

          {/* EXPEDIENTE DIGITAL */}
          <div style={{marginTop:16}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
              <div style={{fontSize:11,fontWeight:700,color:"#64748b",textTransform:"uppercase",letterSpacing:"0.07em"}}>
                📁 Expediente Digital {clientDocs.length>0&&<span style={{color:"#6366f1"}}>({clientDocs.length})</span>}
              </div>
              <button style={{...S.btnP,padding:"6px 12px",fontSize:12}} onClick={()=>docsInputRef.current?.click()} disabled={uploadingDocs}>
                {uploadingDocs?"Subiendo...":"+ Agregar archivos"}
              </button>
              <input ref={docsInputRef} type="file" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" style={{display:"none"}}
                onChange={e=>{ if(e.target.files.length>0){ uploadClientDocs(Array.from(e.target.files),clientModal.id); e.target.value=""; }}}/>
            </div>

            {docsLoading&&<div style={{textAlign:"center",padding:"20px",color:"#94a3b8",fontSize:13}}>Cargando documentos...</div>}

            {!docsLoading&&clientDocs.length===0&&(
              <div style={{background:"#f8fafc",border:"2px dashed #e2e8f0",borderRadius:12,padding:"24px",textAlign:"center",cursor:"pointer"}} onClick={()=>docsInputRef.current?.click()}>
                <div style={{fontSize:32,marginBottom:8}}>📂</div>
                <div style={{fontSize:13,fontWeight:600,color:"#64748b",marginBottom:4}}>Sin documentos aún</div>
                <div style={{fontSize:12,color:"#94a3b8"}}>Toca para subir archivos (PDF, imágenes, Word, Excel)</div>
              </div>
            )}

            {!docsLoading&&clientDocs.length>0&&(
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {clientDocs.map(doc=>(
                  <div key={doc.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",background:"#f8fafc",borderRadius:10,border:"1px solid #e2e8f0"}}>
                    <span style={{fontSize:22,flexShrink:0}}>{getFileIcon(doc.type)}</span>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:13,fontWeight:500,color:"#1e293b",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{doc.name}</div>
                      <div style={{fontSize:11,color:"#94a3b8",marginTop:1}}>{formatFileSize(doc.size)} · {new Date(doc.created_at).toLocaleDateString("es",{day:"2-digit",month:"short",year:"numeric"})}</div>
                    </div>
                    <div style={{display:"flex",gap:6,flexShrink:0}}>
                      <a href={doc.url} target="_blank" rel="noreferrer" style={{...S.btnG,padding:"5px 10px",fontSize:12,textDecoration:"none",display:"flex",alignItems:"center"}} onClick={e=>e.stopPropagation()}>👁️</a>
                      <a href={doc.url} download={doc.name} style={{...S.btnS,padding:"5px 10px",fontSize:12,textDecoration:"none",display:"flex",alignItems:"center"}} onClick={e=>e.stopPropagation()}>⬇</a>
                      <button style={{...S.btnD,padding:"5px 10px",fontSize:12}} onClick={e=>{e.stopPropagation();deleteClientDoc(doc.id,clientModal.id);}}>✕</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div style={S.mFoot}>
          <button style={S.btnG} onClick={()=>{setClientModal(null);setClientDocs([]);askAbout(clientModal);}}>✦ Analizar con IA</button>
          <button style={S.btnP} onClick={()=>{setClientModal(null);setClientDocs([]);openEdit(clientModal);}}>✎ Editar</button>
        </div>
      </div>
    </div>
  );

  const FORM_MODAL=modal&&(
    <div style={S.overlay} onClick={e=>{if(e.target===e.currentTarget)setModal(null);}}>
      <div style={S.modal} onClick={e=>e.stopPropagation()}>
        <div style={S.mHead}>
          <div style={{fontFamily:"'Fraunces',serif",fontSize:16,fontWeight:700}}>{modal.mode==="add"?"Nuevo cliente":"Editar cliente"}</div>
          <button style={S.mClose} onClick={()=>setModal(null)}>✕</button>
        </div>
        <div style={{padding:"18px 20px"}}>
          {/* PHOTO */}
          <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:20,padding:"16px",background:"#f8fafc",borderRadius:12,border:"1px solid #e2e8f0"}}>
            <Avatar url={form.photo_url} name={form.name||"?"} size={60}/>
            <div>
              <div style={{fontSize:13,fontWeight:600,color:"#1e293b",marginBottom:6}}>Foto del cliente</div>
              <button style={{...S.btnG,fontSize:12}} onClick={()=>photoInputRef.current?.click()} disabled={uploadingPhoto}>
                {uploadingPhoto?"Subiendo...":"📷 Subir foto"}
              </button>
              <input ref={photoInputRef} type="file" accept="image/*" style={{display:"none"}} onChange={handlePhotoUpload}/>
              {form.photo_url&&<button style={{...S.btnD,fontSize:11,padding:"4px 8px",marginLeft:6}} onClick={()=>setForm(p=>({...p,photo_url:""}))}>✕</button>}
            </div>
          </div>

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            <div style={{gridColumn:"1/-1",paddingBottom:8,borderBottom:"1px solid #f1f5f9",marginBottom:4}}>
              <div style={{fontSize:11,color:"#94a3b8",textTransform:"uppercase",letterSpacing:"0.08em",fontWeight:600}}>Información personal</div>
            </div>
            {[{key:"name",label:"Nombre completo",ph:"JUAN PÉREZ"},{key:"client_id",label:"ID",ph:"CUR-001"},{key:"phone",label:"Teléfono",ph:"+5999..."},{key:"email",label:"Email",ph:"cliente@email.com"},{key:"nationality",label:"Nacionalidad",ph:"Venezolana"},{key:"birthdate",label:"Nacimiento",type:"date"},{key:"passport",label:"N° Pasaporte",ph:"A1234567"},{key:"entry_date",label:"Entrada Curaçao",type:"date"},{key:"address",label:"Dirección",ph:"Willemstad..."},{key:"emergency_contact",label:"Emergencia",ph:"Nombre · tel"}].map(f=>(
              <div key={f.key}>
                <label style={S.fLabel}>{f.label}</label>
                <input style={S.input} type={f.type||"text"} placeholder={f.ph||""} value={form[f.key]||""} onChange={e=>setForm(p=>({...p,[f.key]:e.target.value}))}/>
              </div>
            ))}
            <div style={{gridColumn:"1/-1"}}>
              <label style={S.fLabel}>👤 Referido por / Cómo llegó</label>
              <input style={S.input} type="text" placeholder="Ej: Instagram, Referido por María López..." value={form.referido||""} onChange={e=>setForm(p=>({...p,referido:e.target.value}))}/>
            </div>
            <div style={{gridColumn:"1/-1"}}>
              <label style={S.fLabel}>📋 Descripción del caso</label>
              <textarea style={{...S.input,resize:"vertical",minHeight:90,lineHeight:1.6}} value={form.caso_descripcion||""} onChange={e=>setForm(p=>({...p,caso_descripcion:e.target.value}))} placeholder="Situación del cliente, antecedentes, detalles importantes..."/>
            </div>

            <div style={{gridColumn:"1/-1",paddingBottom:8,borderBottom:"1px solid #f1f5f9",marginBottom:4,marginTop:8}}>
              <div style={{fontSize:11,color:"#94a3b8",textTransform:"uppercase",letterSpacing:"0.08em",fontWeight:600}}>Trámite y pagos</div>
            </div>
            {/* MODALIDAD - Riba e Luga o Convencional */}
            {(form.type!=="contabilidad")&&<div style={{gridColumn:"1/-1"}}>
              <label style={S.fLabel}>Modalidad del trámite</label>
              <div style={{display:"flex",gap:10}}>
                {[{val:"convencional",label:"Convencional",icon:"📋"},{val:"riba_e_luga",label:"Riba e Luga",icon:"🏝️"}].map(opt=>(
                  <div key={opt.val} style={{flex:1,padding:"12px 16px",borderRadius:10,border:`2px solid ${form.modalidad===opt.val?"#6366f1":"#e2e8f0"}`,background:form.modalidad===opt.val?"#f0f0ff":"#fff",cursor:"pointer",display:"flex",alignItems:"center",gap:8,transition:"all 0.15s"}} onClick={()=>setForm(p=>({...p,modalidad:opt.val}))}>
                    <span style={{fontSize:18}}>{opt.icon}</span>
                    <div>
                      <div style={{fontSize:13,fontWeight:600,color:form.modalidad===opt.val?"#6366f1":"#1e293b"}}>{opt.label}</div>
                    </div>
                    {form.modalidad===opt.val&&<span style={{marginLeft:"auto",color:"#6366f1",fontSize:16}}>✓</span>}
                  </div>
                ))}
              </div>
            </div>}
            <div>
              <label style={S.fLabel}>Tipo de permiso</label>
              <select style={{...S.input,cursor:"pointer"}} value={form.type||"empleado"} onChange={e=>setForm(p=>({...p,type:e.target.value}))}>
                <option value="empleado">Empleado</option>
                <option value="compania">Compañía</option>
                <option value="union_familiar">Unión familiar</option>
                <option value="rentanier">Rentanier</option>
                <option value="residencia">Residencia</option>
                <option value="contabilidad">Contabilidad</option>
              </select>
            </div>
            <div>
              <label style={S.fLabel}>Estatus</label>
              <select style={{...S.input,cursor:"pointer"}} value={form.status||"proceso"} onChange={e=>{
                const newStatus = e.target.value;
                // Auto-calc vencimiento when approved
                let updates = {status: newStatus};
                if(newStatus==="aprobado" && form.fecha_tentativa_aprobacion && form.duracion_permiso) {
                  const venc = calcVencimiento(form.fecha_tentativa_aprobacion, form.duracion_permiso);
                  updates.fecha_vencimiento_real = venc;
                  updates.expiry = venc;
                }
                setForm(p=>({...p,...updates}));
              }}>
                <option value="proceso">En proceso</option>
                <option value="copy_cliente">Copy cliente</option>
                <option value="aprobado">Aprobado</option>
                <option value="rechazado">Rechazado</option>
              </select>
            </div>
            {/* Duración del permiso */}
            {form.type!=="contabilidad"&&<div>
              <label style={S.fLabel}>Duración del permiso</label>
              <select style={{...S.input,cursor:"pointer"}} value={form.duracion_permiso||"1y"} onChange={e=>{
                const dur = e.target.value;
                let updates = {duracion_permiso: dur};
                if(form.status==="aprobado" && form.fecha_tentativa_aprobacion) {
                  const venc = calcVencimiento(form.fecha_tentativa_aprobacion, dur);
                  updates.fecha_vencimiento_real = venc;
                  updates.expiry = venc;
                }
                setForm(p=>({...p,...updates}));
              }}>
                <option value="6m">6 meses</option>
                <option value="1y">1 año</option>
                <option value="2y">2 años</option>
                <option value="3y">3 años</option>
              </select>
            </div>}
            {/* Fecha vencimiento real - shown when approved */}
            {form.status==="aprobado"&&<div>
              <label style={S.fLabel}>📅 Fecha vencimiento real</label>
              <input style={{...S.input,borderColor:"#a7f3d0",background:"#ecfdf5"}} type="date" value={form.fecha_vencimiento_real||form.expiry||""} onChange={e=>setForm(p=>({...p,fecha_vencimiento_real:e.target.value,expiry:e.target.value}))}/>
            </div>}
            <div>
              <label style={S.fLabel}>Vencimiento permiso</label>
              <input style={S.input} type="date" value={form.expiry||""} onChange={e=>setForm(p=>({...p,expiry:e.target.value}))}/>
            </div>
            <div>
              <label style={S.fLabel}>📅 Fecha solicitud permiso</label>
              <input style={S.input} type="date" value={form.fecha_solicitud||""} onChange={e=>{const v=e.target.value;setForm(p=>({...p,fecha_solicitud:v,fecha_tentativa_copy:addWeeks(v,8)}));}}/>
            </div>
            <div>
              <label style={S.fLabel}>🎯 Tentativa copy <span style={{color:"#6366f1",fontSize:9,fontWeight:400}}>AUTO +8 sem</span></label>
              <input style={{...S.input,borderColor:form.fecha_tentativa_copy?"#c7d2fe":undefined}} type="date" value={form.fecha_tentativa_copy||""} onChange={e=>setForm(p=>({...p,fecha_tentativa_copy:e.target.value}))}/>
            </div>
            <div>
              <label style={S.fLabel}>✅ Fecha real copy cliente</label>
              <input style={S.input} type="date" value={form.fecha_copy_cliente||""} onChange={e=>{const v=e.target.value;setForm(p=>({...p,fecha_copy_cliente:v,fecha_tentativa_aprobacion:addMonths(v,4)}));}}/>
            </div>
            <div>
              <label style={S.fLabel}>🎯 Tentativa aprobación <span style={{color:"#6366f1",fontSize:9,fontWeight:400}}>AUTO +4 meses</span></label>
              <input style={{...S.input,borderColor:form.fecha_tentativa_aprobacion?"#c7d2fe":undefined}} type="date" value={form.fecha_tentativa_aprobacion||""} onChange={e=>setForm(p=>({...p,fecha_tentativa_aprobacion:e.target.value}))}/>
            </div>
            {[{key:"total",label:"Total ANG",type:"number",ph:"0"},{key:"paid",label:"Pagado ANG",type:"number",ph:"0"}].map(f=>(
              <div key={f.key}>
                <label style={S.fLabel}>{f.label}</label>
                <input style={S.input} type={f.type} placeholder={f.ph} value={form[f.key]||""} onChange={e=>setForm(p=>({...p,[f.key]:e.target.value}))}/>
              </div>
            ))}
            <div style={{gridColumn:"1/-1"}}>
              <label style={S.fLabel}>Notas internas</label>
              <textarea style={{...S.input,resize:"vertical",minHeight:60}} value={form.notes||""} onChange={e=>setForm(p=>({...p,notes:e.target.value}))} placeholder="Notas del expediente..."/>
            </div>

            {/* OB */}
            <div style={{gridColumn:"1/-1"}}>
              <div style={{background:"#fffbeb",border:"1px solid #fde68a",borderRadius:12,padding:"14px 16px"}}>
                <div style={{display:"flex",alignItems:"center",gap:12,cursor:"pointer",marginBottom:form.declaracion_ob?12:0}} onClick={()=>setForm(p=>({...p,declaracion_ob:!p.declaracion_ob}))}>
                  <div style={{width:22,height:22,borderRadius:6,background:form.declaracion_ob?"#f59e0b":"#fff",border:`2px solid ${form.declaracion_ob?"#f59e0b":"#fde68a"}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,color:"#fff",flexShrink:0}}>{form.declaracion_ob&&"✓"}</div>
                  <div>
                    <div style={{fontSize:13,fontWeight:600,color:form.declaracion_ob?"#f59e0b":"#92400e"}}>📊 Declaración OB mensual</div>
                    <div style={{fontSize:11,color:"#b45309"}}>Activa recordatorio el día 14 de cada mes</div>
                  </div>
                </div>
                {form.declaracion_ob&&<div>
                  <label style={{...S.fLabel,color:"#b45309"}}>Mensaje personalizado</label>
                  <textarea style={{...S.input,minHeight:70,fontSize:13,background:"#fff",borderColor:"#fde68a"}} value={form.ob_mensaje||""} onChange={e=>setForm(p=>({...p,ob_mensaje:e.target.value}))} placeholder="Ej: Declarar ventas de empresa XYZ, incluir facturas..."/>
                </div>}
              </div>
            </div>

            {/* DOCS */}
            <div style={{gridColumn:"1/-1"}}>
              <div style={{fontSize:11,color:"#94a3b8",textTransform:"uppercase",letterSpacing:"0.08em",fontWeight:600,paddingBottom:8,borderBottom:"1px solid #f1f5f9",marginBottom:10}}>
                Documentos entregados — {(form.documents||[]).length}/{(REQUIRED_DOCS[form.type||"permiso"]||[]).length}
              </div>
              {(REQUIRED_DOCS[form.type||"permiso"]||[]).map((doc,i)=>{
                const has=(form.documents||[]).includes(doc);
                return(<div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:8,background:has?"#ecfdf5":"#fef2f2",border:`1px solid ${has?"#a7f3d0":"#fecaca"}`,marginBottom:7,cursor:"pointer"}} onClick={()=>toggleDoc(doc)}>
                  <span style={{fontSize:16}}>{has?"✅":"⬜"}</span>
                  <span style={{fontSize:13,flex:1,color:"#1e293b"}}>{doc}</span>
                  <span style={{fontSize:11,color:has?"#10b981":"#94a3b8",fontWeight:500}}>{has?"✓ Entregado":"Tocar para marcar"}</span>
                </div>);
              })}
            </div>
          </div>
        </div>
        <div style={S.mFoot}>
          {modal.mode==="edit"&&<button style={S.btnD} onClick={deleteClient}>Eliminar</button>}
          {modal.mode==="edit"&&<button style={S.btnS} onClick={()=>exportToPDF({...form,total:parseFloat(form.total)||0,paid:parseFloat(form.paid)||0})}>⬇ PDF</button>}
          <button style={S.btnG} onClick={()=>setModal(null)}>Cancelar</button>
          <button style={{...S.btnP,opacity:saving?0.6:1}} onClick={saveClient} disabled={saving}>{saving?"Guardando...":modal.mode==="add"?"Guardar cliente":"Actualizar"}</button>
        </div>
      </div>
    </div>
  );

  const NAV=[{key:"dashboard",icon:"▦",label:"Panel"},{key:"clients",icon:"◈",label:"Clientes"},{key:"payments",icon:"◇",label:"Pagos"},{key:"alerts",icon:"◻",label:"Alertas",badge:notifs.filter(n=>n.urgent).length}];

  // AUTH STATES
  if(authState==="loading") return(
    <div style={{minHeight:"100vh",background:"#f8fafc",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Plus Jakarta Sans',system-ui,sans-serif"}}>
      <div style={{textAlign:"center"}}>
        <div style={{fontFamily:"'Fraunces',serif",fontWeight:800,fontSize:28,color:"#6366f1",marginBottom:16}}>CuraManage</div>
        <div style={{fontSize:22,animation:"spin 1s linear infinite",display:"inline-block",color:"#6366f1"}}>⟳</div>
      </div>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
  if(authState==="login") return <LoginScreen/>;
  if(authState==="unauthorized") return <UnauthorizedScreen email={currentUser?.email} onSignOut={handleSignOut}/>;

  return(
    <div style={S.page}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        @keyframes bounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-4px)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        *{box-sizing:border-box}
        ::-webkit-scrollbar{width:4px;height:4px}::-webkit-scrollbar-thumb{background:#e2e8f0;border-radius:4px}
        input[type=date]::-webkit-calendar-picker-indicator{filter:none;cursor:pointer}
        select option{background:#fff;color:#1e293b}
        input:focus,textarea:focus,select:focus{border-color:#6366f1!important;box-shadow:0 0 0 3px rgba(99,102,241,0.1)!important;outline:none}
        button:active{opacity:0.85;transform:scale(0.98)}
        @media(min-width:768px){.mob{display:none!important}.desk{display:flex!important}}
        @media(max-width:767px){.desk{display:none!important}.mob{display:flex!important}}
      `}</style>

      {/* ══ DESKTOP ══ */}
      <div className="desk" style={{display:"flex",height:"100vh",overflow:"hidden"}}>
        {/* Sidebar */}
        <aside style={S.sidebar}>
          <div style={{padding:"20px 16px 16px",borderBottom:"1px solid #f1f5f9"}}>
            <div style={{fontFamily:"'Fraunces',serif",fontWeight:800,fontSize:20,color:"#6366f1"}}>CuraManage</div>
            <div style={{fontSize:10,color:"#94a3b8",marginTop:2,letterSpacing:"0.08em",textTransform:"uppercase"}}>Curaçao · Gestión</div>
          </div>
          <nav style={{flex:1,padding:"10px 0",display:"flex",flexDirection:"column",gap:1}}>
            {NAV.map(item=>(
              <div key={item.key} style={S.navItem(section===item.key)} onClick={()=>setSection(item.key)}>
                <span style={{fontSize:15,width:20,textAlign:"center",opacity:0.7}}>{item.icon}</span>
                <span>{item.label}</span>
                {item.badge?<span style={S.navBadge}>{item.badge}</span>:null}
              </div>
            ))}
          </nav>
          <div style={{padding:"12px 16px",borderTop:"1px solid #f1f5f9"}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12,padding:"10px 12px",background:"#f8fafc",borderRadius:10,border:"1px solid #e2e8f0"}}>
              <Avatar url={currentUser?.user_metadata?.avatar_url} name={currentUser?.email} size={32}/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:12,fontWeight:600,color:"#1e293b",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{currentUser?.user_metadata?.full_name||currentUser?.email}</div>
                <div style={{fontSize:10,color:"#94a3b8"}}>Administrador</div>
              </div>
            </div>
            <div style={{fontSize:10,color:"#cbd5e1",textAlign:"center",marginBottom:8}}>{clients.length} clientes · Supabase ✓</div>
            <button onClick={handleSignOut} style={{width:"100%",padding:"7px",borderRadius:8,fontSize:11,cursor:"pointer",background:"#fef2f2",color:"#ef4444",border:"1px solid #fecaca",fontFamily:"inherit",fontWeight:500}}>Cerrar sesión</button>
          </div>
        </aside>

        {/* Main */}
        <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",background:"#f1f5f9"}}>
          {/* Topbar */}
          <div style={S.topbar}>
            <div style={{fontFamily:"'Fraunces',serif",fontWeight:700,fontSize:18,color:"#1e293b",flex:1}}>
              {({dashboard:"Panel",clients:"Clientes",payments:"Pagos",alerts:"Alertas"})[section]}
            </div>
            {loading&&<span style={{fontSize:12,color:"#94a3b8",animation:"spin 1s linear infinite",display:"inline-block"}}>⟳</span>}
            <div style={{display:"flex",gap:8}}>
              <button style={S.btnG} onClick={load} title="Recargar">↻</button>
              <button style={{...S.btnG,color:"#f59e0b",borderColor:"#fde68a",background:"#fffbeb"}} onClick={openPassportModal}>📷 Escanear</button>
              <button style={S.btnG} onClick={openAdd}>+ Nuevo cliente</button>
              <button style={{...S.btnG,color:"#10b981",borderColor:"#a7f3d0",background:"#ecfdf5"}} onClick={()=>folderInputRef.current?.click()}>📂 Importar carpeta</button>
              <input ref={folderInputRef} type="file" multiple webkitdirectory="" style={{display:"none"}} onChange={handleFolderImport}/>
              <button style={S.btnP} onClick={()=>setShowAI(!showAI)}>✦ Asistente IA</button>
            </div>
          </div>

          {/* Content — centered with max-width */}
          <div style={{flex:1,overflowY:"auto"}}>
            <div style={S.content}>

              {section==="dashboard"&&<div style={{animation:"fadeIn 0.3s ease"}}>
                {/* Stats */}
                <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:16,marginBottom:24}}>
                  {[
                    {label:"Total clientes",value:clients.length,color:"#6366f1",bg:"#f0f0ff",icon:"◈"},
                    {label:"En proceso",value:clients.filter(c=>c.status==="proceso").length,color:"#3b82f6",bg:"#eff6ff",icon:"⟳"},
                    {label:"Por cobrar",value:`ANG ${totalDebt}`,color:"#f59e0b",bg:"#fffbeb",icon:"◇"},
                    {label:"Vencen pronto",value:expiring,color:"#ef4444",bg:"#fef2f2",icon:"⚠"},
                  ].map((s,i)=>(
                    <div key={i} style={{...S.card,borderTop:`3px solid ${s.color}`}}>
                      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:8}}>
                        <div style={{fontSize:11,color:"#94a3b8",textTransform:"uppercase",letterSpacing:"0.06em",fontWeight:600}}>{s.label}</div>
                        <div style={{width:32,height:32,borderRadius:8,background:s.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,color:s.color}}>{s.icon}</div>
                      </div>
                      <div style={{fontFamily:"'Fraunces',serif",fontSize:28,fontWeight:800,color:s.color}}>{s.value}</div>
                    </div>
                  ))}
                </div>

                {/* Charts */}
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:16,marginBottom:24}}>
                  {[{title:"Por estatus",data:statusData},{title:"Por tipo",data:typeData}].map((ch,ci)=>(
                    <div key={ci} style={S.card}>
                      <div style={{fontSize:12,fontWeight:700,color:"#64748b",textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:12}}>{ch.title}</div>
                      <ResponsiveContainer width="100%" height={130}><PieChart><Pie data={ch.data} cx="50%" cy="50%" innerRadius={30} outerRadius={52} paddingAngle={3} dataKey="value">{ch.data.map((e,i)=><Cell key={i} fill={e.color} stroke="transparent"/>)}</Pie><Tooltip contentStyle={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:8,fontSize:12,boxShadow:"0 4px 12px rgba(0,0,0,0.08)"}}/></PieChart></ResponsiveContainer>
                      <div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:6}}>{ch.data.map((d,i)=><div key={i} style={{fontSize:11,color:d.color,display:"flex",alignItems:"center",gap:4,background:d.color+"15",padding:"2px 8px",borderRadius:20}}><span style={{width:6,height:6,borderRadius:"50%",background:d.color,display:"inline-block"}}/>{d.name}: {d.value}</div>)}</div>
                    </div>
                  ))}
                  <div style={S.card}>
                    <div style={{fontSize:12,fontWeight:700,color:"#64748b",textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:12}}>Cobros ANG</div>
                    <ResponsiveContainer width="100%" height={130}><BarChart data={payData} barSize={28}><XAxis dataKey="name" tick={{fontSize:11,fill:"#94a3b8"}} axisLine={false} tickLine={false}/><YAxis tick={{fontSize:11,fill:"#94a3b8"}} axisLine={false} tickLine={false}/><Tooltip contentStyle={{background:"#fff",border:"1px solid #e2e8f0",borderRadius:8,fontSize:12}}/><Bar dataKey="value" radius={[6,6,0,0]}>{payData.map((d,i)=><Cell key={i} fill={d.fill}/>)}</Bar></BarChart></ResponsiveContainer>
                  </div>
                </div>

                {/* Recent clients table */}
                <div style={{...S.card,padding:0,overflow:"hidden"}}>
                  <div style={{display:"flex",alignItems:"center",padding:"16px 20px",borderBottom:"1px solid #f1f5f9"}}>
                    <div style={S.secTitle}>Clientes recientes</div>
                    <button style={{...S.btnG,marginLeft:"auto",fontSize:12}} onClick={()=>setSection("clients")}>Ver todos →</button>
                  </div>
                  <table style={{width:"100%",borderCollapse:"collapse"}}>
                    <thead><tr style={{background:"#f8fafc"}}>
                      {["Cliente","Tipo","Estatus","Vence","Pago","Deuda",""].map((h,i)=><th key={i} style={{padding:"10px 16px",textAlign:"left",fontSize:10,fontWeight:700,color:"#94a3b8",textTransform:"uppercase",letterSpacing:"0.07em"}}>{h}</th>)}
                    </tr></thead>
                    <tbody>{clients.length===0?<tr><td colSpan={7} style={{textAlign:"center",padding:"32px",color:"#94a3b8",fontSize:13}}>Sin clientes aún — agrega tu primero</td></tr>:clients.slice(0,6).map(c=><DRow key={c.id} c={c}/>)}</tbody>
                  </table>
                </div>
              </div>}

              {section==="clients"&&<div style={{animation:"fadeIn 0.3s ease"}}>
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16,flexWrap:"wrap"}}>
                  <div style={S.secTitle}>Todos los clientes <span style={{fontFamily:"inherit",fontSize:14,color:"#94a3b8",fontWeight:400}}>({filtered.length})</span></div>
                  <input style={{...S.input,maxWidth:220,flex:"none"}} placeholder="Buscar nombre, ID..." value={search} onChange={e=>setSearch(e.target.value)}/>
                  <select style={{...S.input,width:"auto",cursor:"pointer"}} value={filterType} onChange={e=>setFilterType(e.target.value)}>
                    <option value="">Todos los tipos</option>
                    <option value="empleado">Empleado</option>
                    <option value="compania">Compañía</option>
                    <option value="union_familiar">Unión familiar</option>
                    <option value="rentanier">Rentanier</option>
                    <option value="residencia">Residencia</option>
                    <option value="contabilidad">Contabilidad</option>
                  </select>
                  <select style={{...S.input,width:"auto",cursor:"pointer"}} value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}>
                    <option value="">Todos los estatus</option>
                    <option value="proceso">En proceso</option>
                    <option value="copy_cliente">Copy cliente</option>
                    <option value="aprobado">Aprobado</option>
                    <option value="rechazado">Rechazado</option>
                  </select>
                  <select style={{...S.input,width:"auto",cursor:"pointer"}} value={filterModalidad} onChange={e=>setFilterModalidad(e.target.value)}>
                    <option value="">Todas las modalidades</option>
                    <option value="riba_e_luga">🏝️ Riba e Luga</option>
                    <option value="convencional">📋 Convencional</option>
                  </select>
                </div>
                {filtered.length===0?<div style={{...S.card,textAlign:"center",padding:"48px",color:"#94a3b8"}}>Sin resultados</div>:filtered.map(c=><ClientCard key={c.id} c={c}/>)}
              </div>}

              {section==="payments"&&<div style={{animation:"fadeIn 0.3s ease"}}>
                <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:16,marginBottom:24}}>
                  {[{label:"Total facturado",value:`ANG ${totalBilled}`,color:"#6366f1",bg:"#f0f0ff"},{label:"Total cobrado",value:`ANG ${totalPaid}`,color:"#10b981",bg:"#ecfdf5"},{label:"Por cobrar",value:`ANG ${totalDebt}`,color:"#ef4444",bg:"#fef2f2"}].map((s,i)=>(
                    <div key={i} style={{...S.card,borderTop:`3px solid ${s.color}`}}>
                      <div style={{fontSize:11,color:"#94a3b8",textTransform:"uppercase",letterSpacing:"0.06em",fontWeight:600,marginBottom:6}}>{s.label}</div>
                      <div style={{fontFamily:"'Fraunces',serif",fontSize:26,fontWeight:800,color:s.color}}>{s.value}</div>
                    </div>
                  ))}
                </div>
                {[...clients].sort((a,b)=>((b.total||0)-(b.paid||0))-((a.total||0)-(a.paid||0))).map(c=><ClientCard key={c.id} c={c}/>)}
              </div>}

              {section==="alerts"&&<div style={{animation:"fadeIn 0.3s ease"}}>
                {notifs.length===0?<div style={{...S.card,textAlign:"center",padding:"60px"}}>
                  <div style={{fontSize:40,marginBottom:12}}>✅</div>
                  <div style={{fontSize:15,fontWeight:600,color:"#1e293b",marginBottom:4}}>Todo al día</div>
                  <div style={{fontSize:13,color:"#94a3b8"}}>No hay alertas activas en este momento</div>
                </div>:notifs.map((n,i)=>(
                  <div key={i} style={{...S.card,marginBottom:10,display:"flex",gap:14,alignItems:"flex-start",cursor:"pointer",borderLeft:`4px solid ${n.urgent?"#ef4444":"#f59e0b"}`,transition:"box-shadow 0.15s"}}
                    onMouseEnter={e=>e.currentTarget.style.boxShadow="0 4px 16px rgba(0,0,0,0.08)"}
                    onMouseLeave={e=>e.currentTarget.style.boxShadow="0 1px 3px rgba(0,0,0,0.04)"}
                    onClick={()=>n.client&&setClientModal(n.client)}>
                    {n.client&&<Avatar url={n.client.photo_url} name={n.client.name} size={38}/>}
                    <div style={{flex:1}}>
                      <div style={{fontWeight:600,fontSize:14,color:"#1e293b",marginBottom:2}}>{n.icon} {n.title}</div>
                      <div style={{fontSize:12,color:"#64748b"}}>{n.sub}</div>
                    </div>
                    {n.urgent&&<span style={{background:"#fef2f2",color:"#ef4444",fontSize:11,fontWeight:600,padding:"3px 10px",borderRadius:20,border:"1px solid #fecaca",whiteSpace:"nowrap"}}>Urgente</span>}
                  </div>
                ))}
              </div>}

            </div>
          </div>
        </div>

        {/* AI Panel */}
        {showAI&&<div style={S.aiPanel}>{AI_PANEL}</div>}
      </div>

      {/* ══ MOBILE ══ */}
      <div className="mob" style={{flexDirection:"column",flex:1,paddingBottom:65,background:"#f1f5f9"}}>
        <div style={{...S.topbar,justifyContent:"space-between"}}>
          <div style={{fontFamily:"'Fraunces',serif",fontWeight:800,fontSize:18,color:"#6366f1"}}>CuraManage</div>
          <div style={{display:"flex",gap:7,alignItems:"center"}}>
            {loading&&<span style={{fontSize:12,color:"#94a3b8",animation:"spin 1s linear infinite",display:"inline-block"}}>⟳</span>}
            <button style={{...S.btnG,color:"#f59e0b",borderColor:"#fde68a",background:"#fffbeb",padding:"8px 10px",fontSize:15}} onClick={openPassportModal}>📷</button>
            <button style={{...S.btnG,padding:"8px 12px",fontSize:15}} onClick={openAdd}>+</button>
            <button style={{...S.btnG,color:"#10b981",borderColor:"#a7f3d0",background:"#ecfdf5",padding:"8px 10px",fontSize:15}} onClick={()=>folderInputRef.current?.click()}>📂</button>
            <button style={{...S.btnP,padding:"8px 12px"}} onClick={()=>setShowAI(!showAI)}>✦</button>
          </div>
        </div>
        <div style={{flex:1,overflowY:"auto",padding:"14px",WebkitOverflowScrolling:"touch"}}>
          {section==="dashboard"&&<>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
              {[{label:"Clientes",value:clients.length,color:"#6366f1"},{label:"Por cobrar",value:`ANG ${totalDebt}`,color:"#f59e0b"},{label:"En proceso",value:clients.filter(c=>c.status==="proceso").length,color:"#3b82f6"},{label:"Vencen",value:expiring,color:"#ef4444"}].map((s,i)=>(
                <div key={i} style={{...S.cardSm,borderTop:`3px solid ${s.color}`}}>
                  <div style={{fontSize:10,color:"#94a3b8",textTransform:"uppercase",fontWeight:600,marginBottom:4}}>{s.label}</div>
                  <div style={{fontFamily:"'Fraunces',serif",fontSize:22,fontWeight:800,color:s.color}}>{s.value}</div>
                </div>
              ))}
            </div>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
              <div style={{...S.secTitle,fontSize:15}}>Recientes</div>
              <button style={{...S.btnG,marginLeft:"auto",fontSize:11}} onClick={()=>setSection("clients")}>Todos →</button>
            </div>
            {clients.slice(0,5).map(c=><ClientCard key={c.id} c={c}/>)}
            {/* Mobile user info */}
            <div style={{...S.cardSm,display:"flex",alignItems:"center",gap:10,marginTop:12}}>
              <Avatar url={currentUser?.user_metadata?.avatar_url} name={currentUser?.email} size={32}/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:12,fontWeight:600,color:"#1e293b",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{currentUser?.user_metadata?.full_name||currentUser?.email}</div>
              </div>
              <button onClick={handleSignOut} style={{...S.btnD,fontSize:11,padding:"5px 10px"}}>Salir</button>
            </div>
          </>}
          {section==="clients"&&<>
            <div style={{display:"flex",gap:8,marginBottom:10}}><input style={{...S.input}} placeholder="Buscar..." value={search} onChange={e=>setSearch(e.target.value)}/></div>
            <div style={{display:"flex",gap:8,marginBottom:14}}>
              <select style={{...S.input,flex:1,cursor:"pointer"}} value={filterType} onChange={e=>setFilterType(e.target.value)}>
                <option value="">Tipos</option>
                <option value="empleado">Empleado</option>
                <option value="compania">Compañía</option>
                <option value="union_familiar">Unión familiar</option>
                <option value="rentanier">Rentanier</option>
                <option value="residencia">Residencia</option>
                <option value="contabilidad">Contabilidad</option>
              </select>
              <select style={{...S.input,flex:1,cursor:"pointer"}} value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}>
                <option value="">Estatus</option>
                <option value="proceso">En proceso</option>
                <option value="copy_cliente">Copy cliente</option>
                <option value="aprobado">Aprobado</option>
                <option value="rechazado">Rechazado</option>
              </select>
            </div>
            <div style={{display:"flex",gap:8,marginBottom:10}}>
              <select style={{...S.input,flex:1,cursor:"pointer"}} value={filterModalidad} onChange={e=>setFilterModalidad(e.target.value)}>
                <option value="">Modalidad</option>
                <option value="riba_e_luga">🏝️ Riba e Luga</option>
                <option value="convencional">📋 Convencional</option>
              </select>
            </div>
            {filtered.map(c=><ClientCard key={c.id} c={c}/>)}
          </>}
          {section==="payments"&&<>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
              {[{label:"Facturado",value:`ANG ${totalBilled}`,color:"#6366f1"},{label:"Cobrado",value:`ANG ${totalPaid}`,color:"#10b981"},{label:"Por cobrar",value:`ANG ${totalDebt}`,color:"#ef4444",full:true}].map((s,i)=>(
                <div key={i} style={{...S.cardSm,borderTop:`3px solid ${s.color}`,gridColumn:s.full?"1/-1":"auto"}}>
                  <div style={{fontSize:10,color:"#94a3b8",textTransform:"uppercase",fontWeight:600,marginBottom:4}}>{s.label}</div>
                  <div style={{fontFamily:"'Fraunces',serif",fontSize:20,fontWeight:800,color:s.color}}>{s.value}</div>
                </div>
              ))}
            </div>
            {[...clients].sort((a,b)=>((b.total||0)-(b.paid||0))-((a.total||0)-(a.paid||0))).map(c=><ClientCard key={c.id} c={c}/>)}
          </>}
          {section==="alerts"&&<>
            {notifs.length===0?<div style={{...S.card,textAlign:"center",padding:"40px"}}>
              <div style={{fontSize:32,marginBottom:8}}>✅</div>
              <div style={{fontSize:14,fontWeight:600,color:"#1e293b"}}>Sin alertas activas</div>
            </div>:notifs.map((n,i)=>(
              <div key={i} style={{...S.cardSm,marginBottom:10,display:"flex",gap:12,cursor:"pointer",borderLeft:`3px solid ${n.urgent?"#ef4444":"#f59e0b"}`}} onClick={()=>n.client&&setClientModal(n.client)}>
                {n.client&&<Avatar url={n.client.photo_url} name={n.client.name} size={36}/>}
                <div><div style={{fontWeight:600,fontSize:13,color:"#1e293b"}}>{n.icon} {n.title}</div><div style={{fontSize:12,color:"#64748b",marginTop:2}}>{n.sub}</div></div>
              </div>
            ))}
          </>}
        </div>
        <nav style={S.mobileNav}>
          {NAV.map(item=>(
            <button key={item.key} style={S.mNavBtn(section===item.key)} onClick={()=>setSection(item.key)}>
              <span style={{fontSize:20}}>{item.icon}</span>
              <span>{item.label}</span>
              {item.badge?<span style={{...S.navBadge,position:"absolute",top:6,right:"18%",fontSize:9,padding:"1px 5px"}}>{item.badge}</span>:null}
            </button>
          ))}
          <button style={S.mNavBtn(false)} onClick={()=>setShowAI(!showAI)}>
            <span style={{fontSize:20}}>✦</span><span>IA</span>
          </button>
        </nav>
        {showAI&&<div style={S.aiDrawer}>{AI_PANEL}</div>}
      </div>

      {/* MODALS */}
      {PASSPORT_MODAL}
      {CLIENT_FOLDER}
      {FORM_MODAL}

      {/* PHOTO VIEWER */}
      {photoViewer&&(
        <div style={{position:"fixed",inset:0,background:"rgba(15,23,42,0.9)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:20,cursor:"zoom-out"}} onClick={()=>setPhotoViewer(null)}>
          <div style={{position:"relative"}}>
            <img src={photoViewer} style={{maxWidth:"90vw",maxHeight:"85vh",objectFit:"contain",borderRadius:12,boxShadow:"0 25px 50px rgba(0,0,0,0.5)"}} alt="Foto cliente"/>
            <button onClick={()=>setPhotoViewer(null)} style={{position:"absolute",top:-14,right:-14,width:32,height:32,borderRadius:"50%",background:"#fff",border:"none",color:"#1e293b",fontSize:16,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 2px 8px rgba(0,0,0,0.2)"}}>✕</button>
          </div>
        </div>
      )}

      {/* FOLDER IMPORT MODAL */}
      {folderModal&&(
        <div style={{position:"fixed",inset:0,background:"rgba(15,23,42,0.5)",backdropFilter:"blur(4px)",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center",padding:"20px"}} onClick={e=>{if(e.target===e.currentTarget){setFolderModal(false);setFolderFiles([]);}}}>
          <div style={{background:"#fff",borderRadius:20,width:"100%",maxWidth:440,maxHeight:"90vh",overflowY:"auto",boxShadow:"0 20px 60px rgba(0,0,0,0.15)",display:"flex",flexDirection:"column"}} onClick={e=>e.stopPropagation()}>
            {/* Header */}
            <div style={{padding:"18px 20px 14px",borderBottom:"1px solid #f1f5f9",display:"flex",alignItems:"center"}}>
              <div>
                <div style={{fontFamily:"'Fraunces',serif",fontSize:16,fontWeight:700,color:"#1e293b"}}>📂 Importar archivos</div>
                <div style={{fontSize:12,color:"#94a3b8",marginTop:1}}>{folderFiles.length} archivo(s) seleccionado(s)</div>
              </div>
              <button style={S.mClose} onClick={()=>{setFolderModal(false);setFolderFiles([]);setFolderClientId("");}}>✕</button>
            </div>

            <div style={{padding:"16px 20px",flex:1,overflowY:"auto"}}>
              {/* Client selector */}
              <div style={{marginBottom:12}}>
                <label style={S.fLabel}>¿A qué cliente pertenecen?</label>
                <select style={{...S.input,cursor:"pointer",marginBottom:8}} value={folderClientId} onChange={e=>setFolderClientId(e.target.value)}>
                  <option value="">Selecciona un cliente...</option>
                  {[...clients].sort((a,b)=>a.name.localeCompare(b.name)).map(c=>(
                    <option key={c.id} value={c.id}>{c.name} · {c.client_id}</option>
                  ))}
                </select>
                {/* Create new client option */}
                <button style={{width:"100%",padding:"9px",borderRadius:10,fontSize:12,fontWeight:600,cursor:"pointer",background:"#f0f0ff",color:"#6366f1",border:"1px dashed #c7d2fe",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:6}} onClick={()=>{setFolderModal(false);openAdd();showToast("Guarda el cliente y luego importa los archivos desde su expediente");}}> 
                  + Crear nuevo cliente
                </button>
              </div>

              {/* Files preview */}
              <div style={{fontSize:11,color:"#94a3b8",textTransform:"uppercase",fontWeight:600,marginBottom:8}}>Archivos ({folderFiles.length})</div>
              <div style={{maxHeight:200,overflowY:"auto",display:"flex",flexDirection:"column",gap:5,marginBottom:12}}>
                {folderFiles.slice(0,30).map((f,i)=>(
                  <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 10px",background:"#f8fafc",borderRadius:8,border:"1px solid #e2e8f0"}}>
                    <span style={{fontSize:16,flexShrink:0}}>{f.type.includes("pdf")?"📕":f.type.includes("image")?"🖼️":"📄"}</span>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:12,fontWeight:500,color:"#1e293b",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{f.name}</div>
                      <div style={{fontSize:10,color:"#94a3b8"}}>{Math.round(f.size/1024)} KB</div>
                    </div>
                  </div>
                ))}
                {folderFiles.length>30&&<div style={{fontSize:12,color:"#94a3b8",textAlign:"center",padding:"6px",background:"#f8fafc",borderRadius:8}}>...y {folderFiles.length-30} archivos más</div>}
              </div>

              {importingFolder&&<div style={{textAlign:"center",padding:"14px",background:"#f0f0ff",borderRadius:10}}>
                <div style={{fontSize:22,animation:"spin 1s linear infinite",display:"inline-block",color:"#6366f1"}}>⟳</div>
                <div style={{fontSize:13,color:"#6366f1",marginTop:6}}>Importando archivos...</div>
              </div>}
            </div>

            {/* Footer */}
            <div style={{padding:"12px 20px 16px",borderTop:"1px solid #f1f5f9",display:"flex",gap:8}}>
              <button style={{...S.btnG,flex:1}} onClick={()=>{setFolderModal(false);setFolderFiles([]);setFolderClientId("");}}>Cancelar</button>
              <button style={{...S.btnP,flex:2,opacity:!folderClientId||importingFolder?0.5:1}} onClick={importFolderToClient} disabled={!folderClientId||importingFolder}>
                {importingFolder?"Importando...":"📂 Importar al expediente"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MIGRATION AGENT MODAL */}
      {migrationModal&&(
        <div style={S.overlay} onClick={e=>{if(e.target===e.currentTarget){setMigrationModal(null);setMigrationResult(null);}}}>
          <div style={S.modal} onClick={e=>e.stopPropagation()}>
            <div style={S.mHead}>
              <div>
                <div style={{fontFamily:"'Fraunces',serif",fontSize:16,fontWeight:700}}>🛂 Agente Migratorio</div>
                <div style={{fontSize:12,color:"#94a3b8",marginTop:1}}>{migrationModal.name}</div>
              </div>
              <button style={S.mClose} onClick={()=>{setMigrationModal(null);setMigrationResult(null);}}>✕</button>
            </div>
            <div style={{padding:"16px 20px"}}>
              {/* Programa selector */}
              <div style={{marginBottom:16}}>
                <label style={S.fLabel}>Programa migratorio</label>
                <select style={{...S.input,cursor:"pointer"}} value={migrationPrograma} onChange={e=>{setMigrationPrograma(e.target.value);setMigrationResult(null);}}>
                  <option value="permiso_trabajo">Permiso de Trabajo</option>
                  <option value="riba_e_luga">Riba e Luga</option>
                  <option value="permiso_residencia">Permiso de Residencia</option>
                  <option value="reunificacion_familiar">Reunificación Familiar</option>
                </select>
              </div>
              <button style={{...S.btnP,width:"100%",padding:"12px",marginBottom:16,fontSize:14}} onClick={()=>checkMigration(migrationModal,migrationPrograma)} disabled={migrationLoading}>
                {migrationLoading?"🔍 Analizando expediente...":"🔍 Revisar documentos"}
              </button>

              {migrationLoading&&(
                <div style={{textAlign:"center",padding:"32px"}}>
                  <div style={{fontSize:40,animation:"spin 1.5s linear infinite",display:"inline-block",color:"#6366f1"}}>⟳</div>
                  <div style={{fontSize:14,color:"#64748b",marginTop:12}}>Analizando expediente con IA...</div>
                </div>
              )}

              {migrationResult&&!migrationLoading&&(
                <div style={{animation:"fadeIn 0.3s ease"}}>
                  {/* Progress bar */}
                  <div style={{...S.cardSm,marginBottom:12,borderTop:`3px solid ${migrationResult.listo_para_presentar?"#10b981":"#f59e0b"}`}}>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
                      <div style={{fontSize:13,fontWeight:700,color:"#1e293b"}}>Expediente completado</div>
                      <div style={{fontFamily:"'Fraunces',serif",fontSize:22,fontWeight:800,color:migrationResult.listo_para_presentar?"#10b981":"#f59e0b"}}>{migrationResult.porcentaje_completado}%</div>
                    </div>
                    <div style={{height:8,background:"#f1f5f9",borderRadius:4,overflow:"hidden"}}>
                      <div style={{width:`${migrationResult.porcentaje_completado}%`,height:"100%",background:migrationResult.listo_para_presentar?"#10b981":"#f59e0b",borderRadius:4,transition:"width 0.5s"}}/>
                    </div>
                    <div style={{fontSize:12,color:"#64748b",marginTop:6}}>{migrationResult.listo_para_presentar?"✅ Listo para presentar":"⏳ Expediente incompleto"}</div>
                  </div>

                  {/* Summary */}
                  {migrationResult.resumen&&<div style={{background:"#f0f9ff",border:"1px solid #bae6fd",borderRadius:10,padding:"12px 14px",marginBottom:12}}>
                    <div style={{fontSize:11,color:"#0ea5e9",textTransform:"uppercase",fontWeight:700,marginBottom:4}}>Análisis</div>
                    <div style={{fontSize:13,color:"#0c4a6e",lineHeight:1.6}}>{migrationResult.resumen}</div>
                  </div>}

                  {/* Missing docs */}
                  {migrationResult.documentos_faltantes?.length>0&&<div style={{marginBottom:12}}>
                    <div style={{fontSize:12,fontWeight:700,color:"#ef4444",textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:8}}>❌ Documentos faltantes</div>
                    {migrationResult.documentos_faltantes.map((doc,i)=>(
                      <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",background:"#fef2f2",border:"1px solid #fecaca",borderRadius:8,marginBottom:6}}>
                        <span style={{color:"#ef4444"}}>✗</span>
                        <span style={{fontSize:13,color:"#1e293b"}}>{doc}</span>
                      </div>
                    ))}
                  </div>}

                  {/* Complete docs */}
                  {migrationResult.documentos_completos?.length>0&&<div style={{marginBottom:12}}>
                    <div style={{fontSize:12,fontWeight:700,color:"#10b981",textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:8}}>✅ Documentos completos</div>
                    {migrationResult.documentos_completos.map((doc,i)=>(
                      <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",background:"#ecfdf5",border:"1px solid #a7f3d0",borderRadius:8,marginBottom:6}}>
                        <span style={{color:"#10b981"}}>✓</span>
                        <span style={{fontSize:13,color:"#1e293b"}}>{doc}</span>
                      </div>
                    ))}
                  </div>}

                  {/* Urgent actions */}
                  {migrationResult.acciones_urgentes?.length>0&&<div style={{background:"#fffbeb",border:"1px solid #fde68a",borderRadius:10,padding:"12px 14px",marginBottom:12}}>
                    <div style={{fontSize:11,color:"#f59e0b",textTransform:"uppercase",fontWeight:700,marginBottom:8}}>⚡ Acciones urgentes</div>
                    {migrationResult.acciones_urgentes.map((accion,i)=>(
                      <div key={i} style={{fontSize:13,color:"#92400e",marginBottom:4}}>• {accion}</div>
                    ))}
                  </div>}

                  {/* Recommendations */}
                  {migrationResult.recomendaciones?.length>0&&<div style={{background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:10,padding:"12px 14px"}}>
                    <div style={{fontSize:11,color:"#64748b",textTransform:"uppercase",fontWeight:700,marginBottom:8}}>💡 Recomendaciones</div>
                    {migrationResult.recomendaciones.map((rec,i)=>(
                      <div key={i} style={{fontSize:13,color:"#475569",marginBottom:4}}>• {rec}</div>
                    ))}
                  </div>}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {toast&&<div style={S.toast(toast.ok)}>{toast.ok?"✓":"✕"} {toast.msg}</div>}
    </div>
  );
}
