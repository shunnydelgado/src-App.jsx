import { useState, useEffect, useRef } from "react";

// ─── SUPABASE CONFIG ───────────────────────────────────────────────────────
const SUPABASE_URL = "https://tfatwczcufvmthuolfjv.supabase.co";
const SUPABASE_KEY = "sb_publishable_-S2VtEoXw1lbuSXROU4_jw_Q2JDABWP";

async function supabaseReq(method, path, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    method,
    headers: {
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      "Prefer": "return=representation",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(text);
  return text ? JSON.parse(text) : [];
}

const db = {
  getAll: () => supabaseReq("GET", "/clients?order=created_at.desc&select=*"),
  insert: (d) => supabaseReq("POST", "/clients", d),
  update: (id, d) => supabaseReq("PATCH", `/clients?id=eq.${id}`, d),
  remove: (id) => supabaseReq("DELETE", `/clients?id=eq.${id}`),
};

// ─── CONFIG ────────────────────────────────────────────────────────────────
const STATUS_CFG = {
  proceso:   { label:"En proceso",  labelEn:"In process",  color:"#5ab4f5", bg:"rgba(90,180,245,0.13)" },
  pendiente: { label:"Pendiente",   labelEn:"Pending",     color:"#f5a623", bg:"rgba(245,166,35,0.13)" },
  aprobado:  { label:"Aprobado",    labelEn:"Approved",    color:"#4cde8f", bg:"rgba(76,222,143,0.13)" },
  rechazado: { label:"Rechazado",   labelEn:"Rejected",    color:"#f06060", bg:"rgba(240,96,96,0.13)" },
};
const TYPE_CFG = {
  permiso:      { label:"Permiso trabajo", labelEn:"Work permit",  color:"#a78bfa", bg:"rgba(167,139,250,0.13)" },
  residencia:   { label:"Residencia",      labelEn:"Residency",    color:"#2dcba0", bg:"rgba(45,203,160,0.13)" },
  contabilidad: { label:"Contabilidad",    labelEn:"Accounting",   color:"#f5a623", bg:"rgba(245,166,35,0.13)" },
};

const SYSTEM_PROMPT = `Eres un asistente especializado para CuraManage, empresa de gestión en Curaçao que tramita permisos de trabajo, residencia y lleva contabilidad.

Puedes:
1. Redactar cartas y comunicaciones oficiales con formato profesional
2. Analizar casos de inmigración y dar recomendaciones
3. Responder sobre requisitos de permisos y residencia en Curaçao
4. Redactar recordatorios de pago y correos a clientes

Responde en el idioma en que te hablen. Sé profesional y conciso.`;

// ─── STYLES ────────────────────────────────────────────────────────────────
const S = {
  app: { display:"flex", height:"100vh", fontFamily:"'DM Sans',system-ui,sans-serif", background:"#0f0f13", color:"#ededea", overflow:"hidden", fontSize:14 },
  sidebar: { width:210, minWidth:210, background:"#141419", borderRight:"1px solid rgba(255,255,255,0.07)", display:"flex", flexDirection:"column" },
  logoWrap: { padding:"22px 18px 16px", borderBottom:"1px solid rgba(255,255,255,0.07)" },
  logoTitle: { fontFamily:"'Syne',system-ui,sans-serif", fontWeight:800, fontSize:17 },
  logoSub: { fontSize:10, color:"#4a4a55", marginTop:3, letterSpacing:"0.1em", textTransform:"uppercase" },
  nav: { flex:1, padding:"12px 8px", display:"flex", flexDirection:"column", gap:2 },
  navItem: (a) => ({ display:"flex", alignItems:"center", gap:9, padding:"9px 11px", borderRadius:8, cursor:"pointer", fontSize:13, color:a?"#ededea":"#7a7a88", fontWeight:a?500:400, background:a?"#1e1e26":"transparent", border:`1px solid ${a?"rgba(255,255,255,0.08)":"transparent"}`, transition:"all 0.12s", userSelect:"none" }),
  navBadge: { marginLeft:"auto", background:"#f06060", color:"#fff", borderRadius:10, fontSize:10, fontWeight:600, padding:"1px 6px" },
  sideBottom: { padding:"12px 8px", borderTop:"1px solid rgba(255,255,255,0.07)" },
  langToggle: { display:"flex", gap:3, background:"#1e1e26", borderRadius:8, padding:3 },
  langBtn: (a) => ({ flex:1, textAlign:"center", padding:"5px 0", borderRadius:6, fontSize:11, fontWeight:500, cursor:"pointer", color:a?"#fff":"#5a5a66", background:a?"#7c6af5":"transparent", transition:"all 0.12s" }),
  main: { flex:1, display:"flex", flexDirection:"column", overflow:"hidden" },
  topbar: { padding:"14px 24px", borderBottom:"1px solid rgba(255,255,255,0.07)", background:"#141419", display:"flex", alignItems:"center", gap:12 },
  topbarTitle: { fontFamily:"'Syne',system-ui,sans-serif", fontWeight:700, fontSize:16 },
  btnPrimary: { padding:"7px 16px", borderRadius:8, fontSize:12, fontWeight:500, cursor:"pointer", background:"#7c6af5", color:"#fff", border:"none", fontFamily:"inherit" },
  btnGhost: { padding:"7px 14px", borderRadius:8, fontSize:12, fontWeight:500, cursor:"pointer", background:"transparent", color:"#7a7a88", border:"1px solid rgba(255,255,255,0.1)", fontFamily:"inherit" },
  btnDanger: { padding:"7px 14px", borderRadius:8, fontSize:12, fontWeight:500, cursor:"pointer", background:"rgba(240,96,96,0.12)", color:"#f06060", border:"1px solid rgba(240,96,96,0.2)", fontFamily:"inherit" },
  content: { flex:1, overflowY:"auto", padding:"22px 24px" },
  statsGrid: { display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:22 },
  statCard: { background:"#141419", border:"1px solid rgba(255,255,255,0.07)", borderRadius:12, padding:"16px 18px" },
  statLabel: { fontSize:10, color:"#4a4a55", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:8 },
  statValue: { fontFamily:"'Syne',system-ui,sans-serif", fontSize:26, fontWeight:700 },
  tableWrap: { background:"#141419", border:"1px solid rgba(255,255,255,0.07)", borderRadius:12, overflow:"hidden" },
  tableHead: { display:"grid", gridTemplateColumns:"2fr 1.3fr 1.1fr 1fr 1fr 1fr 90px", borderBottom:"1px solid rgba(255,255,255,0.07)" },
  th: { padding:"10px 14px", fontSize:10, fontWeight:500, color:"#4a4a55", textTransform:"uppercase", letterSpacing:"0.07em" },
  tableRow: (h) => ({ display:"grid", gridTemplateColumns:"2fr 1.3fr 1.1fr 1fr 1fr 1fr 90px", borderBottom:"1px solid rgba(255,255,255,0.05)", cursor:"pointer", background:h?"#1a1a22":"transparent", transition:"background 0.1s", alignItems:"center" }),
  td: { padding:"12px 14px", fontSize:13 },
  badge: (c) => ({ display:"inline-block", padding:"3px 9px", borderRadius:20, fontSize:11, fontWeight:500, color:c.color, background:c.bg, whiteSpace:"nowrap" }),
  secHeader: { display:"flex", alignItems:"center", gap:10, marginBottom:14 },
  secTitle: { fontFamily:"'Syne',system-ui,sans-serif", fontSize:14, fontWeight:700 },
  searchBar: { flex:1, maxWidth:260, background:"#1e1e26", border:"1px solid rgba(255,255,255,0.08)", borderRadius:8, padding:"7px 12px", fontSize:12, color:"#ededea", fontFamily:"inherit", outline:"none" },
  filterSel: { background:"#1e1e26", border:"1px solid rgba(255,255,255,0.08)", borderRadius:8, padding:"7px 10px", fontSize:11, color:"#8a8a98", fontFamily:"inherit", outline:"none", cursor:"pointer" },
  aiPanel: { width:340, minWidth:340, background:"#141419", borderLeft:"1px solid rgba(255,255,255,0.07)", display:"flex", flexDirection:"column" },
  aiHead: { padding:"14px 18px", borderBottom:"1px solid rgba(255,255,255,0.07)", display:"flex", alignItems:"center", gap:8 },
  aiMessages: { flex:1, overflowY:"auto", padding:"14px", display:"flex", flexDirection:"column", gap:10 },
  aiMsgUser: { alignSelf:"flex-end", background:"#7c6af5", color:"#fff", padding:"10px 13px", borderRadius:"10px 10px 2px 10px", fontSize:12.5, lineHeight:1.55, maxWidth:"85%", whiteSpace:"pre-wrap" },
  aiMsgBot: { alignSelf:"flex-start", background:"#1e1e26", border:"1px solid rgba(255,255,255,0.07)", padding:"10px 13px", borderRadius:"10px 10px 10px 2px", fontSize:12.5, lineHeight:1.55, maxWidth:"90%", whiteSpace:"pre-wrap" },
  aiQuick: { padding:"8px 12px", display:"flex", gap:5, flexWrap:"wrap", borderTop:"1px solid rgba(255,255,255,0.07)" },
  aiQuickBtn: { fontSize:11, padding:"4px 9px", borderRadius:20, border:"1px solid rgba(255,255,255,0.1)", background:"transparent", color:"#7a7a88", cursor:"pointer", fontFamily:"inherit" },
  aiInputWrap: { padding:"10px 12px", borderTop:"1px solid rgba(255,255,255,0.07)", display:"flex", gap:7, alignItems:"flex-end" },
  aiTextarea: { flex:1, background:"#1e1e26", border:"1px solid rgba(255,255,255,0.08)", borderRadius:8, padding:"9px 12px", fontSize:12.5, color:"#ededea", fontFamily:"inherit", outline:"none", resize:"none", lineHeight:1.4 },
  aiSendBtn: (d) => ({ width:36, height:36, borderRadius:8, background:d?"#2a2a35":"#7c6af5", border:"none", color:"#fff", cursor:d?"not-allowed":"pointer", fontSize:16, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }),
  overlay: { position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", zIndex:100, display:"flex", alignItems:"center", justifyContent:"center", padding:20 },
  modal: { background:"#1a1a22", border:"1px solid rgba(255,255,255,0.1)", borderRadius:16, width:"100%", maxWidth:580, maxHeight:"90vh", overflowY:"auto" },
  modalHead: { padding:"20px 24px 16px", borderBottom:"1px solid rgba(255,255,255,0.07)", display:"flex", alignItems:"center" },
  modalTitle: { fontFamily:"'Syne',system-ui,sans-serif", fontSize:15, fontWeight:700 },
  modalClose: { marginLeft:"auto", background:"none", border:"1px solid rgba(255,255,255,0.1)", color:"#7a7a88", width:28, height:28, borderRadius:6, cursor:"pointer", fontSize:16, display:"flex", alignItems:"center", justifyContent:"center" },
  modalBody: { padding:"20px 24px" },
  formGrid: { display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 },
  formGroup: (f) => ({ gridColumn:f?"1/-1":"auto", display:"flex", flexDirection:"column", gap:5 }),
  formLabel: { fontSize:10, color:"#4a4a55", textTransform:"uppercase", letterSpacing:"0.07em" },
  formInput: { background:"#0f0f13", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, padding:"9px 12px", fontSize:13, color:"#ededea", fontFamily:"inherit", outline:"none" },
  modalFoot: { padding:"14px 24px 20px", display:"flex", gap:8, justifyContent:"flex-end" },
  toast: (ok) => ({ position:"fixed", bottom:24, right:24, zIndex:200, background:ok?"#1a3a2a":"#3a1a1a", border:`1px solid ${ok?"#4cde8f":"#f06060"}`, color:ok?"#4cde8f":"#f06060", padding:"12px 20px", borderRadius:10, fontSize:13, fontWeight:500 }),
};

function Badge({ cfg, lang }) {
  return <span style={S.badge(cfg)}>{lang==="es"?cfg.label:cfg.labelEn}</span>;
}
function PayBar({ paid, total }) {
  if (!total) return <div style={S.td}>—</div>;
  const pct = Math.round((paid/total)*100);
  const col = pct===100?"#4cde8f":pct>=50?"#f5a623":"#f06060";
  return <div style={S.td}><div style={{width:72}}><div style={{height:4,background:"#2a2a35",borderRadius:2,overflow:"hidden"}}><div style={{width:`${pct}%`,height:"100%",background:col,borderRadius:2}}/></div><div style={{fontSize:10,color:"#4a4a55",marginTop:3}}>{pct}%</div></div></div>;
}
function DebtCell({ paid, total }) {
  const d = (total||0)-(paid||0);
  return <div style={{...S.td, color:d<=0?"#4cde8f":"#f06060", fontWeight:500}}>{d<=0?"✓":`ANG ${d}`}</div>;
}
function Dots() {
  return <div style={{...S.aiMsgBot,padding:"10px 14px"}}><div style={{display:"flex",gap:4}}>{[0,1,2].map(i=><div key={i} style={{width:6,height:6,borderRadius:"50%",background:"#4a4a55",animation:`bounce 1.2s infinite ${i*0.2}s`}}/>)}</div></div>;
}

export default function CuraManage() {
  const [lang, setLang] = useState("es");
  const [section, setSection] = useState("dashboard");
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [hovered, setHovered] = useState(null);
  const [toast, setToast] = useState(null);
  const [aiMsgs, setAiMsgs] = useState([{ role:"assistant", content:"¡Hola! Soy tu asistente CuraManage.\n\nPuedo redactar cartas, analizar casos y responder sobre trámites en Curaçao.\n\n¿En qué te ayudo?" }]);
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const aiRef = useRef(null);
  const fileRef = useRef(null);
  const [docResult, setDocResult] = useState(null);
  const [docLoading, setDocLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const t = (es, en) => lang==="es" ? es : en;

  function showToast(msg, ok=true) {
    setToast({ msg, ok });
    setTimeout(()=>setToast(null), 3000);
  }

  async function load() {
    try {
      setLoading(true);
      const data = await db.getAll();
      setClients(data);
    } catch(e) {
      showToast("Error conectando a Supabase: " + e.message, false);
    } finally {
      setLoading(false);
    }
  }

  useEffect(()=>{ load(); }, []);
  useEffect(()=>{ if(aiRef.current) aiRef.current.scrollTop = aiRef.current.scrollHeight; }, [aiMsgs, aiLoading]);

  const totalDebt = clients.reduce((a,c)=>a+Math.max(0,(c.total||0)-(c.paid||0)),0);
  const expiring = clients.filter(c=>c.expiry&&(new Date(c.expiry)-Date.now())<30*86400000&&c.status!=="aprobado").length;
  const inProcess = clients.filter(c=>c.status==="proceso").length;

  const notifs = [];
  clients.forEach(c=>{
    if(!c.expiry||c.status==="aprobado") return;
    const days=Math.round((new Date(c.expiry)-Date.now())/86400000);
    if(days<0) notifs.push({urgent:true,icon:"🔴",title:`${c.name} — ${t("Vencido","Expired")}`,sub:`${t("Venció hace","Expired")} ${Math.abs(days)} ${t("días","days")} · ${c.client_id}`,date:c.expiry});
    else if(days<=7) notifs.push({urgent:true,icon:"⚠️",title:`${c.name} — ${t(`Vence en ${days} días`,`Expires in ${days} days`)}`,sub:`${t("Acción urgente","Urgent action")} · ${c.client_id}`,date:c.expiry});
    else if(days<=30) notifs.push({urgent:false,icon:"🟡",title:`${c.name} — ${t("Próximo vencimiento","Upcoming expiry")}`,sub:`${t(`En ${days} días`,`In ${days} days`)} · ${c.client_id}`,date:c.expiry});
    const debt=(c.total||0)-(c.paid||0);
    if(debt>0&&debt===c.total) notifs.push({urgent:false,icon:"💰",title:`${c.name} — ${t("Sin pagos","No payments")}`,sub:`ANG ${debt}`,date:""});
  });

  const filtered = clients.filter(c=>{
    const q=search.toLowerCase();
    return(!q||c.name.toLowerCase().includes(q)||(c.client_id||"").toLowerCase().includes(q)||(c.email||"").toLowerCase().includes(q))
      &&(!filterType||c.type===filterType)&&(!filterStatus||c.status===filterStatus);
  });

  function openAdd() {
    setForm({client_id:`CUR-${String(clients.length+1).padStart(3,"0")}`,type:"permiso",status:"proceso",total:"",paid:"0",expiry:"",name:"",email:"",notes:""});
    setModal({mode:"add"});
  }
  function openEdit(c) {
    setForm({...c,total:String(c.total||""),paid:String(c.paid||""),expiry:c.expiry||""});
    setModal({mode:"edit",id:c.id});
  }

  async function saveClient() {
    if(!form.name?.trim()) return;
    setSaving(true);
    const data={client_id:form.client_id,name:form.name,type:form.type,status:form.status,expiry:form.expiry||null,total:parseFloat(form.total)||0,paid:parseFloat(form.paid)||0,email:form.email,notes:form.notes};
    try {
      if(modal.mode==="add"){await db.insert(data);showToast(t("Cliente guardado en Supabase ✓","Client saved to Supabase ✓"));}
      else{await db.update(modal.id,data);showToast(t("Cliente actualizado ✓","Client updated ✓"));}
      await load();
      setModal(null);
    } catch(e){showToast(t("Error al guardar","Error saving")+": "+e.message,false);}
    setSaving(false);
  }

  async function deleteClient() {
    if(!window.confirm(t("¿Eliminar este cliente?","Delete this client?"))) return;
    try{await db.remove(modal.id);showToast(t("Eliminado","Deleted"));await load();setModal(null);}
    catch(e){showToast(t("Error al eliminar","Error deleting"),false);}
  }

  async function sendAI(text) {
    if(!text.trim()||aiLoading) return;
    const msg={role:"user",content:text};
    setAiMsgs(p=>[...p,msg]);
    setAiInput("");
    setAiLoading(true);
    try {
      const res=await fetch("/.netlify/functions/claude",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1000,system:SYSTEM_PROMPT,messages:[...aiMsgs,msg].slice(-16)})});
      const data=await res.json();
      setAiMsgs(p=>[...p,{role:"assistant",content:data.content?.[0]?.text||"Error."}]);
    } catch{setAiMsgs(p=>[...p,{role:"assistant",content:"Error de conexión."}]);}
    setAiLoading(false);
  }

  function askAbout(c) {
    const debt=(c.total||0)-(c.paid||0);
    sendAI(`Analiza este caso:\n\nCliente: ${c.name}\nID: ${c.client_id}\nTipo: ${c.type}\nEstatus: ${c.status}\nVencimiento: ${c.expiry||"N/A"}\nTotal: ANG ${c.total||0} · Pagado: ANG ${c.paid||0} · Deuda: ANG ${debt}\nNotas: ${c.notes||"Sin notas"}\n\nDame análisis y próximos pasos recomendados.`);
  }

  async function processFile(file) {
    setDocResult(null);setDocLoading(true);
    const reader=new FileReader();
    reader.onload=async(ev)=>{
      const base64=ev.target.result.split(",")[1];
      const isImage=file.type.startsWith("image/"),isPDF=file.type==="application/pdf";
      if(!isImage&&!isPDF){setDocResult({error:"Use PDF o imagen."});setDocLoading(false);return;}
      const content=[isImage?{type:"image",source:{type:"base64",media_type:file.type,data:base64}}:{type:"document",source:{type:"base64",media_type:"application/pdf",data:base64}},{type:"text",text:"Extrae toda la información relevante: nombre, número ID, fechas, tipo de documento. Formato estructurado."}];
      try{const res=await fetch("/.netlify/functions/claude",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1000,messages:[{role:"user",content}]})});const data=await res.json();setDocResult({text:data.content?.[0]?.text||"No se pudo extraer.",filename:file.name});}
      catch{setDocResult({error:"Error al procesar."});}
      setDocLoading(false);
    };
    reader.readAsDataURL(file);
  }

  function Row({c}) {
    const h=hovered===c.id;
    const expText=c.expiry?new Date(c.expiry).toLocaleDateString("es",{day:"2-digit",month:"short",year:"2-digit"}):"—";
    const urgent=c.expiry&&(new Date(c.expiry)-Date.now())<30*86400000&&c.status!=="aprobado";
    return(
      <div style={S.tableRow(h)} onMouseEnter={()=>setHovered(c.id)} onMouseLeave={()=>setHovered(null)} onClick={()=>openEdit(c)}>
        <div style={S.td}><div style={{fontWeight:500}}>{c.name}</div><div style={{fontSize:11,color:"#4a4a55"}}>{c.client_id}</div></div>
        <div style={S.td}><Badge cfg={TYPE_CFG[c.type]||{label:c.type,labelEn:c.type,color:"#888",bg:"#222"}} lang={lang}/></div>
        <div style={S.td}><Badge cfg={STATUS_CFG[c.status]||{label:c.status,labelEn:c.status,color:"#888",bg:"#222"}} lang={lang}/></div>
        <div style={{...S.td,color:urgent?"#f06060":"#6a6a78",fontSize:12}}>{expText}{urgent?" ⚠":""}</div>
        <PayBar paid={c.paid} total={c.total}/>
        <DebtCell paid={c.paid} total={c.total}/>
        <div style={S.td}><div style={{display:"flex",gap:5}}>
          <button onClick={e=>{e.stopPropagation();openEdit(c);}} style={{...S.btnGhost,padding:"4px 8px",fontSize:12}}>✎</button>
          <button onClick={e=>{e.stopPropagation();askAbout(c);}} style={{...S.btnGhost,padding:"4px 8px",fontSize:12}}>✦</button>
        </div></div>
      </div>
    );
  }

  const COLS=[t("Cliente","Client"),t("Tipo","Type"),t("Estatus","Status"),t("Vence","Expires"),t("Pago","Payment"),t("Deuda","Balance"),""];
  const SECTIONS={dashboard:t("Panel","Dashboard"),clients:t("Clientes","Clients"),payments:t("Pagos","Payments"),alerts:t("Alertas","Alerts"),documents:t("Documentos","Documents")};

  return(
    <div style={S.app}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500&display=swap');@keyframes bounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-4px)}}::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:#2a2a35;border-radius:4px}input[type=date]::-webkit-calendar-picker-indicator{filter:invert(0.5)}select option{background:#1e1e26}`}</style>

      {/* SIDEBAR */}
      <aside style={S.sidebar}>
        <div style={S.logoWrap}>
          <div style={S.logoTitle}>CuraManage</div>
          <div style={S.logoSub}>Curaçao · Gestión</div>
        </div>
        <nav style={S.nav}>
          {[{key:"dashboard",icon:"◈",es:"Panel",en:"Dashboard"},{key:"clients",icon:"◻",es:"Clientes",en:"Clients"},{key:"payments",icon:"◈",es:"Pagos",en:"Payments"},{key:"alerts",icon:"◻",es:"Alertas",en:"Alerts",badge:notifs.filter(n=>n.urgent).length},{key:"documents",icon:"◈",es:"Documentos",en:"Documents"}].map(item=>(
            <div key={item.key} style={S.navItem(section===item.key)} onClick={()=>setSection(item.key)}>
              <span style={{fontSize:14,width:18,textAlign:"center"}}>{item.icon}</span>
              <span>{t(item.es,item.en)}</span>
              {item.badge?<span style={S.navBadge}>{item.badge}</span>:null}
            </div>
          ))}
        </nav>
        <div style={S.sideBottom}>
          <div style={S.langToggle}>
            <div style={S.langBtn(lang==="es")} onClick={()=>setLang("es")}>ES</div>
            <div style={S.langBtn(lang==="en")} onClick={()=>setLang("en")}>EN</div>
          </div>
        </div>
      </aside>

      {/* MAIN */}
      <div style={S.main}>
        <div style={S.topbar}>
          <div><span style={S.topbarTitle}>{SECTIONS[section]}</span>{loading&&<span style={{fontSize:11,color:"#4a4a55",marginLeft:8}}>⟳ cargando...</span>}</div>
          <div style={{marginLeft:"auto",display:"flex",gap:8}}>
            <button style={S.btnGhost} onClick={load}>↻ {t("Actualizar","Refresh")}</button>
            <button style={S.btnGhost} onClick={openAdd}>+ {t("Nuevo cliente","New client")}</button>
            <button style={S.btnPrimary} onClick={()=>document.getElementById("ai-in")?.focus()}>✦ {t("Asistente","Assistant")}</button>
          </div>
        </div>

        <div style={S.content}>

          {section==="dashboard"&&<>
            <div style={S.statsGrid}>
              {[{label:t("Total clientes","Total clients"),value:clients.length,color:"#ededea",sub:"Supabase"},{label:t("En proceso","In process"),value:inProcess,color:"#5ab4f5",sub:t("Trámites activos","Active cases")},{label:t("Por cobrar","Outstanding"),value:`ANG ${totalDebt}`,color:"#f5a623",sub:t("Deuda total","Total debt")},{label:t("Vencen pronto","Expiring soon"),value:expiring,color:"#f06060",sub:t("Próx. 30 días","Next 30 days")}].map((s,i)=>(
                <div key={i} style={S.statCard}><div style={S.statLabel}>{s.label}</div><div style={{...S.statValue,color:s.color}}>{s.value}</div><div style={{fontSize:11,color:"#4a4a55",marginTop:4}}>{s.sub}</div></div>
              ))}
            </div>
            <div style={S.secHeader}>
              <div style={S.secTitle}>{t("Clientes recientes","Recent clients")}</div>
              <button style={{...S.btnGhost,marginLeft:"auto",fontSize:11}} onClick={()=>setSection("clients")}>{t("Ver todos →","View all →")}</button>
            </div>
            <div style={S.tableWrap}>
              <div style={S.tableHead}>{COLS.map((h,i)=><div key={i} style={S.th}>{h}</div>)}</div>
              <div>{loading?<div style={{textAlign:"center",padding:"28px 0",color:"#4a4a55"}}>⟳ {t("Cargando desde Supabase...","Loading from Supabase...")}</div>:clients.length===0?<div style={{textAlign:"center",padding:"28px 0",color:"#4a4a55"}}>{t("Sin clientes. Agrega el primero →","No clients yet. Add the first →")}</div>:clients.slice(0,6).map(c=><Row key={c.id} c={c}/>)}</div>
            </div>
          </>}

          {section==="clients"&&<>
            <div style={S.secHeader}>
              <div style={S.secTitle}>{t("Todos los clientes","All clients")} <span style={{color:"#4a4a55",fontWeight:400}}>({filtered.length})</span></div>
              <input style={S.searchBar} placeholder={t("Buscar...","Search...")} value={search} onChange={e=>setSearch(e.target.value)}/>
              <select style={S.filterSel} value={filterType} onChange={e=>setFilterType(e.target.value)}><option value="">{t("Todos los tipos","All types")}</option><option value="permiso">{t("Permiso trabajo","Work permit")}</option><option value="residencia">{t("Residencia","Residency")}</option><option value="contabilidad">{t("Contabilidad","Accounting")}</option></select>
              <select style={S.filterSel} value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}><option value="">{t("Todos","All")}</option><option value="proceso">{t("En proceso","In process")}</option><option value="pendiente">{t("Pendiente","Pending")}</option><option value="aprobado">{t("Aprobado","Approved")}</option><option value="rechazado">{t("Rechazado","Rejected")}</option></select>
            </div>
            <div style={S.tableWrap}>
              <div style={S.tableHead}>{COLS.map((h,i)=><div key={i} style={S.th}>{h}</div>)}</div>
              <div>{loading?<div style={{textAlign:"center",padding:"28px 0",color:"#4a4a55"}}>⟳</div>:filtered.length===0?<div style={{textAlign:"center",padding:"28px 0",color:"#4a4a55"}}>{t("Sin resultados","No results")}</div>:filtered.map(c=><Row key={c.id} c={c}/>)}</div>
            </div>
          </>}

          {section==="payments"&&<>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:20}}>
              {[{label:t("Total facturado","Total billed"),value:`ANG ${clients.reduce((a,c)=>a+(c.total||0),0)}`,color:"#ededea"},{label:t("Total cobrado","Collected"),value:`ANG ${clients.reduce((a,c)=>a+(c.paid||0),0)}`,color:"#4cde8f"},{label:t("Por cobrar","Outstanding"),value:`ANG ${totalDebt}`,color:"#f06060"}].map((s,i)=>(
                <div key={i} style={S.statCard}><div style={S.statLabel}>{s.label}</div><div style={{...S.statValue,color:s.color,fontSize:22}}>{s.value}</div></div>
              ))}
            </div>
            <div style={S.tableWrap}>
              <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr 120px",borderBottom:"1px solid rgba(255,255,255,0.07)"}}>
                {[t("Cliente","Client"),t("Total","Total"),t("Pagado","Paid"),t("Deuda","Balance"),t("Progreso","Progress")].map((h,i)=><div key={i} style={S.th}>{h}</div>)}
              </div>
              {[...clients].sort((a,b)=>((b.total||0)-(b.paid||0))-((a.total||0)-(a.paid||0))).map(c=>{
                const debt=(c.total||0)-(c.paid||0),pct=c.total?Math.round((c.paid/c.total)*100):0,col=pct===100?"#4cde8f":pct>=50?"#f5a623":"#f06060";
                return(<div key={c.id} style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr 120px",borderBottom:"1px solid rgba(255,255,255,0.05)",alignItems:"center",cursor:"pointer"}} onMouseEnter={e=>e.currentTarget.style.background="#1a1a22"} onMouseLeave={e=>e.currentTarget.style.background="transparent"} onClick={()=>openEdit(c)}>
                  <div style={S.td}><div style={{fontWeight:500}}>{c.name}</div><div style={{fontSize:11,color:"#4a4a55"}}>{c.client_id}</div></div>
                  <div style={{...S.td}}>ANG {c.total||0}</div>
                  <div style={{...S.td,color:"#4cde8f"}}>ANG {c.paid||0}</div>
                  <div style={{...S.td,color:debt<=0?"#4cde8f":"#f06060",fontWeight:500}}>{debt<=0?"✓":` ANG ${debt}`}</div>
                  <div style={S.td}><div style={{width:80}}><div style={{height:4,background:"#2a2a35",borderRadius:2,overflow:"hidden"}}><div style={{width:`${pct}%`,height:"100%",background:col,borderRadius:2}}/></div><div style={{fontSize:10,color:"#4a4a55",marginTop:3}}>{pct}%</div></div></div>
                </div>);
              })}
            </div>
          </>}

          {section==="alerts"&&<>
            <div style={S.secTitle}>{t("Alertas y vencimientos","Alerts & Expirations")}</div>
            <div style={{marginTop:14,display:"flex",flexDirection:"column",gap:8}}>
              {notifs.length===0?<div style={{textAlign:"center",padding:"40px 0",color:"#4a4a55"}}>✅ {t("Sin alertas activas","No active alerts")}</div>:notifs.map((n,i)=>(
                <div key={i} style={{background:"#141419",border:`1px solid ${n.urgent?"rgba(240,96,96,0.25)":"rgba(245,166,35,0.2)"}`,borderRadius:12,padding:"14px 16px",display:"flex",gap:12,alignItems:"flex-start"}}>
                  <div style={{fontSize:18}}>{n.icon}</div>
                  <div><div style={{fontWeight:500,fontSize:13,marginBottom:3}}>{n.title}</div><div style={{fontSize:12,color:"#7a7a88"}}>{n.sub}</div></div>
                  {n.date&&<div style={{marginLeft:"auto",fontSize:11,color:"#4a4a55"}}>{new Date(n.date).toLocaleDateString("es")}</div>}
                </div>
              ))}
            </div>
          </>}

          {section==="documents"&&<>
            <div style={{border:`2px dashed ${dragOver?"#7c6af5":"rgba(255,255,255,0.12)"}`,borderRadius:12,padding:"40px 24px",textAlign:"center",cursor:"pointer",background:dragOver?"rgba(124,106,245,0.06)":"transparent",marginBottom:20}}
              onClick={()=>fileRef.current?.click()} onDragOver={e=>{e.preventDefault();setDragOver(true);}} onDragLeave={()=>setDragOver(false)} onDrop={e=>{e.preventDefault();setDragOver(false);const f=e.dataTransfer.files[0];if(f)processFile(f);}}>
              <div style={{fontSize:32,marginBottom:10}}>📄</div>
              <div style={{fontSize:14,fontWeight:500,marginBottom:6}}>{t("Sube un documento para extraer información","Upload a document to extract information")}</div>
              <div style={{fontSize:12,color:"#4a4a55"}}>{t("PDF o imagen · Clic o arrastra aquí","PDF or image · Click or drag here")}</div>
              <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" style={{display:"none"}} onChange={e=>{if(e.target.files[0])processFile(e.target.files[0]);}}/>
            </div>
            {docLoading&&<div style={{textAlign:"center",padding:20,color:"#7a7a88"}}>⟳ {t("Procesando...","Processing...")}</div>}
            {docResult?.error&&<div style={{color:"#f06060",padding:16}}>{docResult.error}</div>}
            {docResult?.text&&<div style={{background:"#141419",border:"1px solid rgba(255,255,255,0.07)",borderRadius:12,padding:20}}><div style={{fontWeight:600,fontSize:12,color:"#7a7a88",marginBottom:12}}>📄 {docResult.filename}</div><div style={{fontSize:13,lineHeight:1.7,whiteSpace:"pre-wrap"}}>{docResult.text}</div><button style={{...S.btnGhost,marginTop:14,fontSize:11}} onClick={()=>sendAI(`Analiza esta información extraída de un documento:\n\n${docResult.text.slice(0,600)}`)}>✦ {t("Analizar con asistente","Analyze with assistant")}</button></div>}
          </>}

        </div>
      </div>

      {/* AI PANEL */}
      <div style={S.aiPanel}>
        <div style={S.aiHead}>
          <div style={{width:7,height:7,borderRadius:"50%",background:"#2dcba0",animation:"bounce 2s infinite"}}/>
          <div style={{fontFamily:"'Syne',system-ui,sans-serif",fontSize:12,fontWeight:700}}>{t("Asistente IA","AI Assistant")}</div>
          <div style={{marginLeft:"auto",fontSize:10,color:"#4a4a55"}}>Claude</div>
        </div>
        <div ref={aiRef} style={S.aiMessages}>
          {aiMsgs.map((m,i)=><div key={i} style={m.role==="user"?S.aiMsgUser:S.aiMsgBot}>{m.content}</div>)}
          {aiLoading&&<Dots/>}
        </div>
        <div style={S.aiQuick}>
          {[{es:"✉ Carta permiso",en:"✉ Permit letter",p:"Redacta una carta de solicitud de permiso de trabajo para un cliente en Curaçao, con formato profesional completo."},{es:"📋 Requisitos",en:"📋 Requirements",p:"¿Cuáles son los requisitos para residencia en Curaçao?"},{es:"💬 Recordatorio pago",en:"💬 Payment reminder",p:"Redacta un recordatorio de pago profesional para un cliente con deuda pendiente."}].map((b,i)=>(
            <button key={i} style={S.aiQuickBtn} onClick={()=>sendAI(b.p)} onMouseEnter={e=>{e.target.style.color="#ededea";e.target.style.background="#1e1e26";}} onMouseLeave={e=>{e.target.style.color="#7a7a88";e.target.style.background="transparent";}}>{lang==="es"?b.es:b.en}</button>
          ))}
        </div>
        <div style={S.aiInputWrap}>
          <textarea id="ai-in" style={S.aiTextarea} value={aiInput} rows={1} placeholder={t("Escribe aquí...","Type here...")} onChange={e=>setAiInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendAI(aiInput);}}}/>
          <button style={S.aiSendBtn(aiLoading||!aiInput.trim())} disabled={aiLoading||!aiInput.trim()} onClick={()=>sendAI(aiInput)}>↑</button>
        </div>
      </div>

      {/* MODAL */}
      {modal&&(
        <div style={S.overlay} onClick={e=>{if(e.target===e.currentTarget)setModal(null);}}>
          <div style={S.modal} onClick={e=>e.stopPropagation()}>
            <div style={S.modalHead}>
              <div style={S.modalTitle}>{modal.mode==="add"?t("Nuevo cliente","New client"):t("Editar cliente","Edit client")}</div>
              <button style={S.modalClose} onClick={()=>setModal(null)}>×</button>
            </div>
            <div style={S.modalBody}>
              <div style={S.formGrid}>
                {[{key:"name",label:t("Nombre completo","Full name"),ph:"Juan Pérez"},{key:"client_id",label:t("ID Expediente","File ID"),ph:"CUR-001"},{key:"email",label:"Email",ph:"cliente@email.com"},{key:"expiry",label:t("Fecha vencimiento","Expiry"),type:"date"},{key:"total",label:t("Total servicio (ANG)","Service total (ANG)"),type:"number",ph:"0"},{key:"paid",label:t("Monto pagado (ANG)","Paid (ANG)"),type:"number",ph:"0"}].map(f=>(
                  <div key={f.key} style={S.formGroup(false)}>
                    <label style={S.formLabel}>{f.label}</label>
                    <input style={S.formInput} type={f.type||"text"} placeholder={f.ph||""} value={form[f.key]||""} onChange={e=>setForm(p=>({...p,[f.key]:e.target.value}))}/>
                  </div>
                ))}
                <div style={S.formGroup(false)}>
                  <label style={S.formLabel}>{t("Tipo","Type")}</label>
                  <select style={{...S.formInput,cursor:"pointer"}} value={form.type||"permiso"} onChange={e=>setForm(p=>({...p,type:e.target.value}))}><option value="permiso">{t("Permiso trabajo","Work permit")}</option><option value="residencia">{t("Residencia","Residency")}</option><option value="contabilidad">{t("Contabilidad","Accounting")}</option></select>
                </div>
                <div style={S.formGroup(false)}>
                  <label style={S.formLabel}>{t("Estatus","Status")}</label>
                  <select style={{...S.formInput,cursor:"pointer"}} value={form.status||"proceso"} onChange={e=>setForm(p=>({...p,status:e.target.value}))}><option value="proceso">{t("En proceso","In process")}</option><option value="pendiente">{t("Pendiente","Pending")}</option><option value="aprobado">{t("Aprobado","Approved")}</option><option value="rechazado">{t("Rechazado","Rejected")}</option></select>
                </div>
                <div style={S.formGroup(true)}>
                  <label style={S.formLabel}>{t("Notas","Notes")}</label>
                  <textarea style={{...S.formInput,resize:"vertical",minHeight:70}} value={form.notes||""} onChange={e=>setForm(p=>({...p,notes:e.target.value}))} placeholder={t("Notas del caso...","Case notes...")}/>
                </div>
              </div>
            </div>
            <div style={S.modalFoot}>
              {modal.mode==="edit"&&<button style={S.btnDanger} onClick={deleteClient}>{t("Eliminar","Delete")}</button>}
              <button style={S.btnGhost} onClick={()=>setModal(null)}>{t("Cancelar","Cancel")}</button>
              <button style={{...S.btnPrimary,opacity:saving?0.6:1}} onClick={saveClient} disabled={saving}>{saving?"⟳...":modal.mode==="add"?t("Guardar","Save"):t("Actualizar","Update")}</button>
            </div>
          </div>
        </div>
      )}

      {toast&&<div style={S.toast(toast.ok)}>{toast.ok?"✓":"✕"} {toast.msg}</div>}
    </div>
  );
}
