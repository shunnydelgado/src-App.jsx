import { useState, useEffect, useRef } from "react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";

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
  permiso: ["Pasaporte vigente","Foto reciente (pasaporte)","Contrato de trabajo","Carta del empleador","Certificado médico","Antecedentes penales","Formulario de solicitud","Comprobante de pago de tasas"],
  residencia: ["Pasaporte vigente","Foto reciente (pasaporte)","Certificado de nacimiento","Certificado de matrimonio (si aplica)","Antecedentes penales","Comprobante de ingresos","Seguro médico","Formulario de solicitud","Comprobante de domicilio","Comprobante de pago de tasas"],
  contabilidad: ["Registro mercantil","RIF o número fiscal","Estados de cuenta bancarios","Facturas del período","Nómina de empleados","Contrato de servicios"],
};

const COLORS_CHART = ["#c084fc","#34d399","#fbbf24","#38bdf8","#f87171","#fb923c"];

function exportToPDF(client, lang) {
  const t = (es, en) => lang==="es" ? es : en;
  const debt = (client.total||0)-(client.paid||0);
  const docs = client.documents || [];
  const required = REQUIRED_DOCS[client.type] || [];
  const docsList = required.map(doc => {
    const found = docs.includes(doc);
    return `<tr><td style="padding:6px 10px;border-bottom:1px solid #eee">${doc}</td><td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:center;color:${found?"#16a34a":"#dc2626"}">${found?"✓ Entregado":"✗ Pendiente"}</td></tr>`;
  }).join("");
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
  body{font-family:Arial,sans-serif;color:#1a1a1a;margin:0;padding:0}
  .header{background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;padding:32px 40px;display:flex;justify-content:space-between;align-items:center}
  .logo{font-size:26px;font-weight:800}.logo-sub{font-size:10px;color:rgba(255,255,255,0.7);text-transform:uppercase;letter-spacing:2px;margin-top:4px}
  .content{padding:32px 40px}.section{margin-bottom:28px}
  .section-title{font-size:11px;text-transform:uppercase;letter-spacing:2px;color:#6366f1;margin-bottom:14px;padding-bottom:6px;border-bottom:2px solid #f0f0f0}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
  .field{background:#f8f8ff;padding:10px 14px;border-radius:8px;border-left:3px solid #6366f1}
  .field-label{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#888;margin-bottom:3px}
  .field-value{font-size:14px;font-weight:500}
  table{width:100%;border-collapse:collapse}th{background:#f0f0ff;padding:8px 10px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#6366f1}
  .footer{background:#f8f8ff;padding:16px 40px;text-align:center;font-size:11px;color:#888;border-top:2px solid #6366f1}
  @media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}</style></head><body>
  <div class="header"><div><div class="logo">CuraManage</div><div class="logo-sub">Curaçao · Gestión Integral</div></div>
  <div style="text-align:right"><div style="font-size:11px;color:rgba(255,255,255,0.7);margin-bottom:4px">${t("Ficha de cliente","Client file")} · ${new Date().toLocaleDateString("es")}</div><div style="font-size:20px;font-weight:700">${client.client_id||""}</div></div></div>
  <div class="content">
  <div class="section"><div class="section-title">${t("Información personal","Personal information")}</div><div class="grid">
  <div class="field"><div class="field-label">${t("Nombre completo","Full name")}</div><div class="field-value">${client.name||"—"}</div></div>
  <div class="field"><div class="field-label">${t("Nacionalidad","Nationality")}</div><div class="field-value">${client.nationality||"—"}</div></div>
  <div class="field"><div class="field-label">${t("Fecha de nacimiento","Date of birth")}</div><div class="field-value">${client.birthdate||"—"}</div></div>
  <div class="field"><div class="field-label">${t("Pasaporte","Passport")}</div><div class="field-value">${client.passport||"—"}</div></div>
  <div class="field"><div class="field-label">${t("Teléfono","Phone")}</div><div class="field-value">${client.phone||"—"}</div></div>
  <div class="field"><div class="field-label">Email</div><div class="field-value">${client.email||"—"}</div></div>
  <div class="field"><div class="field-label">${t("Dirección","Address")}</div><div class="field-value">${client.address||"—"}</div></div>
  <div class="field"><div class="field-label">${t("Entrada Curaçao","Entry Curaçao")}</div><div class="field-value">${client.entry_date||"—"}</div></div>
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
  </div>
  <div class="footer">CuraManage · Curaçao · ${new Date().getFullYear()} · ${new Date().toLocaleString("es")}</div>
  </body></html>`;
  const win = window.open("", "_blank");
  win.document.write(html);
  win.document.close();
  setTimeout(() => win.print(), 500);
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
  const [clientModal, setClientModal] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [hovered, setHovered] = useState(null);
  const [toast, setToast] = useState(null);
  const [aiMsgs, setAiMsgs] = useState([{ role:"assistant", content:"¡Hola! Soy tu asistente CuraManage.\n\nConozco todos tus clientes y puedo ayudarte a redactar cartas, analizar casos y responder sobre trámites en Curaçao.\n\n¿En qué te ayudo?" }]);
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const aiRef = useRef(null);

  const t = (es, en) => lang==="es" ? es : en;

  function showToast(msg, ok=true) {
    setToast({ msg, ok });
    setTimeout(()=>setToast(null), 3500);
  }

  async function load() {
    try {
      setLoading(true);
      const data = await db.getAll();
      setClients(data);
    } catch(e) {
      showToast("Error: " + e.message, false);
    } finally {
      setLoading(false);
    }
  }

  useEffect(()=>{ load(); }, []);
  useEffect(()=>{ if(aiRef.current) aiRef.current.scrollTop = aiRef.current.scrollHeight; }, [aiMsgs, aiLoading]);

  const totalDebt = clients.reduce((a,c)=>a+Math.max(0,(c.total||0)-(c.paid||0)),0);
  const totalPaid = clients.reduce((a,c)=>a+(c.paid||0),0);
  const totalBilled = clients.reduce((a,c)=>a+(c.total||0),0);
  const expiring = clients.filter(c=>c.expiry&&(new Date(c.expiry)-Date.now())<30*86400000&&c.status!=="aprobado").length;

  // Chart data
  const statusData = Object.entries(STATUS_CFG).map(([key, cfg]) => ({
    name: lang==="es" ? cfg.label : cfg.labelEn,
    value: clients.filter(c=>c.status===key).length,
    color: cfg.color,
  })).filter(d=>d.value>0);

  const typeData = Object.entries(TYPE_CFG).map(([key, cfg]) => ({
    name: lang==="es" ? cfg.label : cfg.labelEn,
    value: clients.filter(c=>c.type===key).length,
    color: cfg.color,
  })).filter(d=>d.value>0);

  const paymentData = [
    { name: t("Cobrado","Collected"), value: totalPaid, fill:"#4ade80" },
    { name: t("Pendiente","Pending"), value: totalDebt, fill:"#f87171" },
  ];

  const notifs = [];
  clients.forEach(c=>{
    if(!c.expiry||c.status==="aprobado") return;
    const days=Math.round((new Date(c.expiry)-Date.now())/86400000);
    if(days<0) notifs.push({urgent:true,icon:"🔴",title:`${c.name} — ${t("Vencido","Expired")}`,sub:`${Math.abs(days)} ${t("días","days")} · ${c.client_id}`,date:c.expiry});
    else if(days<=7) notifs.push({urgent:true,icon:"⚠️",title:`${c.name} — ${t(`Vence en ${days} días`,`Expires in ${days} days`)}`,sub:`${t("Urgente","Urgent")} · ${c.client_id}`,date:c.expiry});
    else if(days<=30) notifs.push({urgent:false,icon:"🟡",title:`${c.name} — ${t("Próximo vencimiento","Upcoming expiry")}`,sub:`${t(`En ${days} días`,`In ${days} days`)} · ${c.client_id}`,date:c.expiry});
    const debt=(c.total||0)-(c.paid||0);
    if(debt>0&&debt===c.total) notifs.push({urgent:false,icon:"💰",title:`${c.name}`,sub:`ANG ${debt} ${t("sin pagos","no payments")}`,date:""});
  });

  const filtered = clients.filter(c=>{
    const q=search.toLowerCase();
    return(!q||c.name.toLowerCase().includes(q)||(c.client_id||"").toLowerCase().includes(q)||(c.email||"").toLowerCase().includes(q))
      &&(!filterType||c.type===filterType)&&(!filterStatus||c.status===filterStatus);
  });

  function openAdd() {
    setForm({client_id:`CUR-${String(clients.length+1).padStart(3,"0")}`,type:"permiso",status:"proceso",total:"",paid:"0",expiry:"",name:"",email:"",phone:"",nationality:"",birthdate:"",passport:"",entry_date:"",emergency_contact:"",address:"",notes:"",documents:[]});
    setModal({mode:"add"});
  }
  function openEdit(c) {
    setForm({...c,total:String(c.total||""),paid:String(c.paid||""),expiry:c.expiry||"",birthdate:c.birthdate||"",entry_date:c.entry_date||"",documents:c.documents||[]});
    setModal({mode:"edit",id:c.id});
  }

  async function saveClient() {
    if(!form.name?.trim()) return;
    setSaving(true);
    const data={client_id:form.client_id,name:form.name,type:form.type,status:form.status,expiry:form.expiry||null,total:parseFloat(form.total)||0,paid:parseFloat(form.paid)||0,email:form.email,notes:form.notes,phone:form.phone,nationality:form.nationality,birthdate:form.birthdate||null,passport:form.passport,entry_date:form.entry_date||null,emergency_contact:form.emergency_contact,address:form.address,documents:form.documents||[]};
    try {
      if(modal.mode==="add"){await db.insert(data);showToast(t("Cliente guardado ✓","Client saved ✓"));}
      else{await db.update(modal.id,data);showToast(t("Actualizado ✓","Updated ✓"));}
      await load(); setModal(null);
    } catch(e){showToast(t("Error al guardar","Error saving")+": "+e.message,false);}
    setSaving(false);
  }

  async function deleteClient() {
    if(!window.confirm(t("¿Eliminar?","Delete?"))) return;
    try{await db.remove(modal.id);showToast(t("Eliminado","Deleted"));await load();setModal(null);}
    catch(e){showToast("Error",false);}
  }

  function toggleDoc(doc) {
    const docs = form.documents||[];
    setForm(p=>({...p,documents:docs.includes(doc)?docs.filter(d=>d!==doc):[...docs,doc]}));
  }

  function openGmail(c) {
    const sub=encodeURIComponent(`CuraManage - ${c.client_id} - ${c.name}`);
    const body=encodeURIComponent(`Estimado/a ${c.name},\n\nMe comunico en relación a su trámite.\n\nSaludos,\nCuraManage`);
    window.open(`https://mail.google.com/mail/?view=cm&to=${c.email||""}&su=${sub}&body=${body}`,"_blank");
  }

  // Build system prompt with client context
  function buildSystemPrompt() {
    const clientSummary = clients.slice(0,20).map(c=>{
      const debt=(c.total||0)-(c.paid||0);
      return `- ${c.name} (${c.client_id}): ${c.type}, ${c.status}, vence: ${c.expiry||"N/A"}, deuda: ANG ${debt}`;
    }).join("\n");
    return `Eres un asistente especializado para CuraManage, empresa de gestión en Curaçao que tramita permisos de trabajo, residencia y lleva contabilidad.

CLIENTES ACTUALES EN EL SISTEMA:
${clientSummary}

Puedes:
1. Redactar cartas y comunicaciones oficiales con formato profesional completo
2. Analizar casos específicos de los clientes listados arriba
3. Responder sobre requisitos de permisos y residencia en Curaçao
4. Redactar recordatorios de pago y correos profesionales
5. Dar recomendaciones sobre casos pendientes o con documentos faltantes

Cuando te pregunten sobre un cliente específico, usa la información del sistema arriba.
Responde en el idioma en que te hablen (español o inglés). Sé profesional y conciso.`;
  }

  async function sendAI(text) {
    if(!text.trim()||aiLoading) return;
    const msg={role:"user",content:text};
    setAiMsgs(p=>[...p,msg]);
    setAiInput("");
    setAiLoading(true);
    try {
      const res=await fetch("/.netlify/functions/claude",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({system:buildSystemPrompt(),max_tokens:1000,messages:[...aiMsgs,msg].slice(-16)})});
      const data=await res.json();
      setAiMsgs(p=>[...p,{role:"assistant",content:data.content?.[0]?.text||"Error."}]);
    } catch{setAiMsgs(p=>[...p,{role:"assistant",content:"Error de conexión."}]);}
    setAiLoading(false);
  }

  function askAbout(c) {
    const debt=(c.total||0)-(c.paid||0);
    const docs=c.documents||[];
    const required=REQUIRED_DOCS[c.type]||[];
    const missing=required.filter(d=>!docs.includes(d));
    sendAI(`Analiza este caso completo:\n\nCliente: ${c.name}\nNacionalidad: ${c.nationality||"N/A"}\nID: ${c.client_id}\nTipo: ${c.type}\nEstatus: ${c.status}\nVencimiento: ${c.expiry||"N/A"}\nTotal: ANG ${c.total||0} · Pagado: ANG ${c.paid||0} · Deuda: ANG ${debt}\nDocumentos faltantes: ${missing.length>0?missing.join(", "):"Ninguno"}\nNotas: ${c.notes||"Sin notas"}\n\nDame análisis detallado y próximos pasos.`);
  }

  // Styles
  const css = {
    app: {display:"flex",height:"100vh",fontFamily:"'DM Sans',system-ui,sans-serif",background:"#0a0a0f",color:"#f0f0f5",overflow:"hidden",fontSize:14},
    sidebar: {width:220,minWidth:220,background:"linear-gradient(180deg,#1a1a2e 0%,#16213e 100%)",borderRight:"1px solid rgba(99,102,241,0.2)",display:"flex",flexDirection:"column"},
    logoWrap: {padding:"24px 20px 18px",borderBottom:"1px solid rgba(99,102,241,0.2)"},
    logoTitle: {fontFamily:"'Syne',system-ui,sans-serif",fontWeight:800,fontSize:20,background:"linear-gradient(135deg,#c084fc,#38bdf8)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"},
    logoSub: {fontSize:10,color:"rgba(255,255,255,0.35)",marginTop:3,letterSpacing:"0.1em",textTransform:"uppercase"},
    nav: {flex:1,padding:"14px 10px",display:"flex",flexDirection:"column",gap:3},
    navItem: (a)=>({display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:10,cursor:"pointer",fontSize:13,color:a?"#fff":"rgba(255,255,255,0.5)",fontWeight:a?600:400,background:a?"linear-gradient(135deg,rgba(99,102,241,0.4),rgba(139,92,246,0.3))":"transparent",border:`1px solid ${a?"rgba(99,102,241,0.5)":"transparent"}`,transition:"all 0.15s",userSelect:"none",boxShadow:a?"0 0 20px rgba(99,102,241,0.2)":"none"}),
    navBadge: {marginLeft:"auto",background:"#f87171",color:"#fff",borderRadius:10,fontSize:10,fontWeight:700,padding:"2px 7px",boxShadow:"0 0 10px rgba(248,113,113,0.5)"},
    sideBottom: {padding:"12px 10px",borderTop:"1px solid rgba(99,102,241,0.2)"},
    langToggle: {display:"flex",gap:3,background:"rgba(255,255,255,0.05)",borderRadius:10,padding:3},
    langBtn: (a)=>({flex:1,textAlign:"center",padding:"6px 0",borderRadius:8,fontSize:11,fontWeight:600,cursor:"pointer",color:a?"#fff":"rgba(255,255,255,0.4)",background:a?"linear-gradient(135deg,#6366f1,#8b5cf6)":"transparent",transition:"all 0.15s"}),
    main: {flex:1,display:"flex",flexDirection:"column",overflow:"hidden"},
    topbar: {padding:"14px 26px",borderBottom:"1px solid rgba(99,102,241,0.15)",background:"rgba(26,26,46,0.8)",backdropFilter:"blur(10px)",display:"flex",alignItems:"center",gap:12},
    topbarTitle: {fontFamily:"'Syne',system-ui,sans-serif",fontWeight:700,fontSize:17},
    btnPrimary: {padding:"8px 18px",borderRadius:10,fontSize:12,fontWeight:600,cursor:"pointer",background:"linear-gradient(135deg,#6366f1,#8b5cf6)",color:"#fff",border:"none",fontFamily:"inherit",boxShadow:"0 4px 15px rgba(99,102,241,0.4)",transition:"all 0.15s"},
    btnGhost: {padding:"8px 14px",borderRadius:10,fontSize:12,fontWeight:500,cursor:"pointer",background:"rgba(255,255,255,0.05)",color:"rgba(255,255,255,0.6)",border:"1px solid rgba(255,255,255,0.1)",fontFamily:"inherit",transition:"all 0.15s"},
    btnDanger: {padding:"8px 14px",borderRadius:10,fontSize:12,fontWeight:500,cursor:"pointer",background:"rgba(248,113,113,0.1)",color:"#f87171",border:"1px solid rgba(248,113,113,0.3)",fontFamily:"inherit"},
    btnSuccess: {padding:"8px 14px",borderRadius:10,fontSize:12,fontWeight:500,cursor:"pointer",background:"rgba(74,222,128,0.1)",color:"#4ade80",border:"1px solid rgba(74,222,128,0.3)",fontFamily:"inherit"},
    content: {flex:1,overflowY:"auto",padding:"24px 26px"},
    card: {background:"linear-gradient(135deg,rgba(26,26,46,0.9),rgba(22,33,62,0.9))",border:"1px solid rgba(99,102,241,0.2)",borderRadius:16,padding:"18px 20px",transition:"all 0.2s"},
    statsGrid: {display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:24},
    statValue: {fontFamily:"'Syne',system-ui,sans-serif",fontSize:28,fontWeight:800,marginTop:6},
    statLabel: {fontSize:11,color:"rgba(255,255,255,0.4)",textTransform:"uppercase",letterSpacing:"0.08em"},
    tableWrap: {background:"linear-gradient(135deg,rgba(26,26,46,0.9),rgba(22,33,62,0.9))",border:"1px solid rgba(99,102,241,0.2)",borderRadius:16,overflow:"hidden"},
    tableHead: {display:"grid",gridTemplateColumns:"2fr 1.3fr 1.1fr 1fr 1fr 1fr 110px",borderBottom:"1px solid rgba(99,102,241,0.2)",background:"rgba(99,102,241,0.08)"},
    th: {padding:"11px 14px",fontSize:10,fontWeight:600,color:"rgba(192,132,252,0.8)",textTransform:"uppercase",letterSpacing:"0.08em"},
    tableRow: (h)=>({display:"grid",gridTemplateColumns:"2fr 1.3fr 1.1fr 1fr 1fr 1fr 110px",borderBottom:"1px solid rgba(99,102,241,0.08)",cursor:"pointer",background:h?"rgba(99,102,241,0.08)":"transparent",transition:"background 0.1s",alignItems:"center"}),
    td: {padding:"13px 14px",fontSize:13},
    badge: (c)=>({display:"inline-block",padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:600,color:c.color,background:c.bg,whiteSpace:"nowrap",border:`1px solid ${c.color}33`}),
    secHeader: {display:"flex",alignItems:"center",gap:10,marginBottom:16},
    secTitle: {fontFamily:"'Syne',system-ui,sans-serif",fontSize:15,fontWeight:700},
    searchBar: {flex:1,maxWidth:280,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(99,102,241,0.3)",borderRadius:10,padding:"8px 14px",fontSize:12,color:"#f0f0f5",fontFamily:"inherit",outline:"none"},
    filterSel: {background:"rgba(255,255,255,0.06)",border:"1px solid rgba(99,102,241,0.3)",borderRadius:10,padding:"8px 12px",fontSize:11,color:"rgba(255,255,255,0.6)",fontFamily:"inherit",outline:"none",cursor:"pointer"},
    aiPanel: {width:340,minWidth:340,background:"linear-gradient(180deg,#1a1a2e,#16213e)",borderLeft:"1px solid rgba(99,102,241,0.2)",display:"flex",flexDirection:"column"},
    aiHead: {padding:"15px 18px",borderBottom:"1px solid rgba(99,102,241,0.2)",display:"flex",alignItems:"center",gap:8,background:"rgba(99,102,241,0.08)"},
    aiMessages: {flex:1,overflowY:"auto",padding:"14px",display:"flex",flexDirection:"column",gap:10},
    aiMsgUser: {alignSelf:"flex-end",background:"linear-gradient(135deg,#6366f1,#8b5cf6)",color:"#fff",padding:"10px 14px",borderRadius:"12px 12px 2px 12px",fontSize:12.5,lineHeight:1.6,maxWidth:"85%",whiteSpace:"pre-wrap",boxShadow:"0 4px 15px rgba(99,102,241,0.3)"},
    aiMsgBot: {alignSelf:"flex-start",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(99,102,241,0.2)",padding:"10px 14px",borderRadius:"12px 12px 12px 2px",fontSize:12.5,lineHeight:1.6,maxWidth:"90%",whiteSpace:"pre-wrap"},
    aiQuick: {padding:"8px 12px",display:"flex",gap:5,flexWrap:"wrap",borderTop:"1px solid rgba(99,102,241,0.15)"},
    aiQuickBtn: {fontSize:11,padding:"5px 10px",borderRadius:20,border:"1px solid rgba(99,102,241,0.3)",background:"rgba(99,102,241,0.08)",color:"rgba(192,132,252,0.8)",cursor:"pointer",fontFamily:"inherit",transition:"all 0.12s"},
    aiInputWrap: {padding:"10px 12px",borderTop:"1px solid rgba(99,102,241,0.15)",display:"flex",gap:7,alignItems:"flex-end"},
    aiTextarea: {flex:1,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(99,102,241,0.3)",borderRadius:10,padding:"9px 12px",fontSize:12.5,color:"#f0f0f5",fontFamily:"inherit",outline:"none",resize:"none",lineHeight:1.4},
    aiSendBtn: (d)=>({width:38,height:38,borderRadius:10,background:d?"rgba(255,255,255,0.05)":"linear-gradient(135deg,#6366f1,#8b5cf6)",border:"none",color:d?"rgba(255,255,255,0.3)":"#fff",cursor:d?"not-allowed":"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,boxShadow:d?"none":"0 4px 15px rgba(99,102,241,0.4)"}),
    overlay: {position:"fixed",inset:0,background:"rgba(0,0,0,0.8)",backdropFilter:"blur(4px)",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center",padding:20},
    modal: {background:"linear-gradient(135deg,#1a1a2e,#16213e)",border:"1px solid rgba(99,102,241,0.3)",borderRadius:20,width:"100%",maxWidth:700,maxHeight:"90vh",overflowY:"auto",boxShadow:"0 25px 50px rgba(0,0,0,0.5)"},
    modalHead: {padding:"22px 26px 18px",borderBottom:"1px solid rgba(99,102,241,0.2)",display:"flex",alignItems:"center",background:"rgba(99,102,241,0.08)"},
    modalTitle: {fontFamily:"'Syne',system-ui,sans-serif",fontSize:16,fontWeight:700},
    modalClose: {marginLeft:"auto",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",color:"rgba(255,255,255,0.5)",width:30,height:30,borderRadius:8,cursor:"pointer",fontSize:18,display:"flex",alignItems:"center",justifyContent:"center"},
    modalBody: {padding:"22px 26px"},
    formGrid: {display:"grid",gridTemplateColumns:"1fr 1fr",gap:14},
    formGroup: (f)=>({gridColumn:f?"1/-1":"auto",display:"flex",flexDirection:"column",gap:5}),
    formLabel: {fontSize:10,color:"rgba(192,132,252,0.7)",textTransform:"uppercase",letterSpacing:"0.08em"},
    formInput: {background:"rgba(255,255,255,0.05)",border:"1px solid rgba(99,102,241,0.3)",borderRadius:10,padding:"10px 14px",fontSize:13,color:"#f0f0f5",fontFamily:"inherit",outline:"none",transition:"border-color 0.15s"},
    modalFoot: {padding:"16px 26px 22px",display:"flex",gap:8,justifyContent:"flex-end",flexWrap:"wrap",borderTop:"1px solid rgba(99,102,241,0.15)"},
    toast: (ok)=>({position:"fixed",bottom:24,right:24,zIndex:200,background:ok?"rgba(74,222,128,0.15)":"rgba(248,113,113,0.15)",border:`1px solid ${ok?"#4ade80":"#f87171"}`,color:ok?"#4ade80":"#f87171",padding:"12px 20px",borderRadius:12,fontSize:13,fontWeight:600,backdropFilter:"blur(10px)",boxShadow:"0 8px 25px rgba(0,0,0,0.3)"}),
  };

  function Badge({cfg,lang}) { return <span style={css.badge(cfg)}>{lang==="es"?cfg.label:cfg.labelEn}</span>; }
  function PayBar({paid,total}) {
    if(!total) return <div style={css.td}>—</div>;
    const pct=Math.round((paid/total)*100);
    const col=pct===100?"#4ade80":pct>=50?"#fb923c":"#f87171";
    return <div style={css.td}><div style={{width:72}}><div style={{height:4,background:"rgba(255,255,255,0.1)",borderRadius:2,overflow:"hidden"}}><div style={{width:`${pct}%`,height:"100%",background:col,borderRadius:2,boxShadow:`0 0 6px ${col}88`}}/></div><div style={{fontSize:10,color:"rgba(255,255,255,0.35)",marginTop:3}}>{pct}%</div></div></div>;
  }
  function DebtCell({paid,total}) {
    const d=(total||0)-(paid||0);
    return <div style={{...css.td,color:d<=0?"#4ade80":"#f87171",fontWeight:600}}>{d<=0?"✓":`ANG ${d}`}</div>;
  }
  function Dots() {
    return <div style={{...css.aiMsgBot,padding:"10px 14px"}}><div style={{display:"flex",gap:5,alignItems:"center"}}>{[0,1,2].map(i=><div key={i} style={{width:7,height:7,borderRadius:"50%",background:"rgba(192,132,252,0.5)",animation:`bounce 1.2s infinite ${i*0.2}s`}}/>)}</div></div>;
  }

  function Row({c}) {
    const h=hovered===c.id;
    const expText=c.expiry?new Date(c.expiry).toLocaleDateString("es",{day:"2-digit",month:"short",year:"2-digit"}):"—";
    const urgent=c.expiry&&(new Date(c.expiry)-Date.now())<30*86400000&&c.status!=="aprobado";
    const docs=c.documents||[];
    const required=REQUIRED_DOCS[c.type]||[];
    const missing=required.filter(d=>!docs.includes(d)).length;
    return(
      <div style={css.tableRow(h)} onMouseEnter={()=>setHovered(c.id)} onMouseLeave={()=>setHovered(null)}>
        <div style={{...css.td,cursor:"pointer"}} onClick={()=>setClientModal(c)}>
          <div style={{fontWeight:600,color:"#c084fc"}}>{c.name}</div>
          <div style={{fontSize:11,color:"rgba(255,255,255,0.35)"}}>{c.client_id}{c.nationality?` · ${c.nationality}`:""}</div>
        </div>
        <div style={css.td}><Badge cfg={TYPE_CFG[c.type]||{label:c.type,labelEn:c.type,color:"#888",bg:"#222"}} lang={lang}/></div>
        <div style={css.td}><Badge cfg={STATUS_CFG[c.status]||{label:c.status,labelEn:c.status,color:"#888",bg:"#222"}} lang={lang}/></div>
        <div style={{...css.td,color:urgent?"#f87171":"rgba(255,255,255,0.35)",fontSize:12,fontWeight:urgent?600:400}}>{expText}{urgent?" ⚠":""}</div>
        <PayBar paid={c.paid} total={c.total}/>
        <DebtCell paid={c.paid} total={c.total}/>
        <div style={css.td}>
          <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
            <button onClick={()=>openEdit(c)} style={{...css.btnGhost,padding:"3px 8px",fontSize:11}} title="Editar">✎</button>
            <button onClick={()=>askAbout(c)} style={{...css.btnGhost,padding:"3px 8px",fontSize:11}} title="IA">✦</button>
            <button onClick={()=>openGmail(c)} style={{...css.btnGhost,padding:"3px 8px",fontSize:11}} title="Gmail">✉</button>
            <button onClick={()=>exportToPDF(c,lang)} style={{...css.btnGhost,padding:"3px 8px",fontSize:11}} title="PDF">⬇</button>
          </div>
          {missing>0&&<div style={{fontSize:10,color:"#f87171",marginTop:3}}>⚠ {missing} {t("doc(s) faltante(s)","doc(s) missing")}</div>}
        </div>
      </div>
    );
  }

  const COLS=[t("Cliente","Client"),t("Tipo","Type"),t("Estatus","Status"),t("Vence","Expires"),t("Pago","Payment"),t("Deuda","Balance"),t("Acciones","Actions")];

  return(
    <div style={css.app}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600&display=swap');
        @keyframes bounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-5px)}}
        @keyframes glow{0%,100%{opacity:1}50%{opacity:0.5}}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:rgba(99,102,241,0.3);border-radius:4px}
        input[type=date]::-webkit-calendar-picker-indicator{filter:invert(0.5)}
        select option{background:#1a1a2e}
        input:focus,textarea:focus,select:focus{border-color:rgba(99,102,241,0.6)!important;box-shadow:0 0 0 3px rgba(99,102,241,0.1)}
      `}</style>

      {/* SIDEBAR */}
      <aside style={css.sidebar}>
        <div style={css.logoWrap}>
          <div style={css.logoTitle}>CuraManage</div>
          <div style={css.logoSub}>Curaçao · Gestión</div>
        </div>
        <nav style={css.nav}>
          {[{key:"dashboard",icon:"⬡",es:"Panel",en:"Dashboard"},{key:"clients",icon:"◈",es:"Clientes",en:"Clients"},{key:"payments",icon:"◇",es:"Pagos",en:"Payments"},{key:"alerts",icon:"◻",es:"Alertas",en:"Alerts",badge:notifs.filter(n=>n.urgent).length}].map(item=>(
            <div key={item.key} style={css.navItem(section===item.key)} onClick={()=>setSection(item.key)}>
              <span style={{fontSize:16,width:20,textAlign:"center"}}>{item.icon}</span>
              <span>{t(item.es,item.en)}</span>
              {item.badge?<span style={css.navBadge}>{item.badge}</span>:null}
            </div>
          ))}
        </nav>
        <div style={css.sideBottom}>
          <div style={{fontSize:11,color:"rgba(255,255,255,0.3)",marginBottom:8,textAlign:"center"}}>{clients.length} {t("clientes","clients")} · Supabase ✓</div>
          <div style={css.langToggle}>
            <div style={css.langBtn(lang==="es")} onClick={()=>setLang("es")}>ES</div>
            <div style={css.langBtn(lang==="en")} onClick={()=>setLang("en")}>EN</div>
          </div>
        </div>
      </aside>

      {/* MAIN */}
      <div style={css.main}>
        <div style={css.topbar}>
          <div style={css.topbarTitle}>{({dashboard:t("Panel","Dashboard"),clients:t("Clientes","Clients"),payments:t("Pagos","Payments"),alerts:t("Alertas","Alerts")})[section]}</div>
          {loading&&<span style={{fontSize:11,color:"rgba(192,132,252,0.6)",animation:"glow 1s infinite"}}>⟳ {t("Sincronizando...","Syncing...")}</span>}
          <div style={{marginLeft:"auto",display:"flex",gap:8}}>
            <button style={css.btnGhost} onClick={load}>↻</button>
            <button style={css.btnGhost} onClick={openAdd}>+ {t("Nuevo cliente","New client")}</button>
            <button style={css.btnPrimary} onClick={()=>document.getElementById("ai-in")?.focus()}>✦ {t("Asistente","Assistant")}</button>
          </div>
        </div>

        <div style={css.content}>

          {/* DASHBOARD */}
          {section==="dashboard"&&<>
            <div style={css.statsGrid}>
              {[
                {label:t("Total clientes","Total clients"),value:clients.length,color:"#c084fc",icon:"◈"},
                {label:t("En proceso","In process"),value:clients.filter(c=>c.status==="proceso").length,color:"#38bdf8",icon:"◇"},
                {label:t("Por cobrar","Outstanding"),value:`ANG ${totalDebt}`,color:"#fb923c",icon:"◻"},
                {label:t("Vencen pronto","Expiring soon"),value:expiring,color:"#f87171",icon:"⚠"},
              ].map((s,i)=>(
                <div key={i} style={{...css.card,borderColor:s.color+"33"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                    <div style={css.statLabel}>{s.label}</div>
                    <div style={{fontSize:20,color:s.color,opacity:0.6}}>{s.icon}</div>
                  </div>
                  <div style={{...css.statValue,color:s.color}}>{s.value}</div>
                </div>
              ))}
            </div>

            {/* Charts */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:14,marginBottom:24}}>
              <div style={css.card}>
                <div style={{fontSize:12,fontWeight:600,color:"rgba(192,132,252,0.8)",marginBottom:12,textTransform:"uppercase",letterSpacing:"0.08em"}}>{t("Por estatus","By status")}</div>
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart><Pie data={statusData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={3} dataKey="value">
                    {statusData.map((entry,i)=><Cell key={i} fill={entry.color} stroke="transparent"/>)}
                  </Pie><Tooltip contentStyle={{background:"#1a1a2e",border:"1px solid rgba(99,102,241,0.3)",borderRadius:8,fontSize:12}}/></PieChart>
                </ResponsiveContainer>
                <div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:4}}>
                  {statusData.map((d,i)=><div key={i} style={{fontSize:10,color:d.color,display:"flex",alignItems:"center",gap:3}}><span style={{width:6,height:6,borderRadius:"50%",background:d.color,display:"inline-block"}}/>{d.name}: {d.value}</div>)}
                </div>
              </div>
              <div style={css.card}>
                <div style={{fontSize:12,fontWeight:600,color:"rgba(192,132,252,0.8)",marginBottom:12,textTransform:"uppercase",letterSpacing:"0.08em"}}>{t("Por tipo","By type")}</div>
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart><Pie data={typeData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={3} dataKey="value">
                    {typeData.map((entry,i)=><Cell key={i} fill={entry.color} stroke="transparent"/>)}
                  </Pie><Tooltip contentStyle={{background:"#1a1a2e",border:"1px solid rgba(99,102,241,0.3)",borderRadius:8,fontSize:12}}/></PieChart>
                </ResponsiveContainer>
                <div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:4}}>
                  {typeData.map((d,i)=><div key={i} style={{fontSize:10,color:d.color,display:"flex",alignItems:"center",gap:3}}><span style={{width:6,height:6,borderRadius:"50%",background:d.color,display:"inline-block"}}/>{d.name}: {d.value}</div>)}
                </div>
              </div>
              <div style={css.card}>
                <div style={{fontSize:12,fontWeight:600,color:"rgba(192,132,252,0.8)",marginBottom:12,textTransform:"uppercase",letterSpacing:"0.08em"}}>{t("Cobros ANG","Payments ANG")}</div>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={paymentData} barSize={32}>
                    <XAxis dataKey="name" tick={{fontSize:10,fill:"rgba(255,255,255,0.4)"}} axisLine={false} tickLine={false}/>
                    <YAxis tick={{fontSize:10,fill:"rgba(255,255,255,0.4)"}} axisLine={false} tickLine={false}/>
                    <Tooltip contentStyle={{background:"#1a1a2e",border:"1px solid rgba(99,102,241,0.3)",borderRadius:8,fontSize:12}}/>
                    <Bar dataKey="value" radius={[6,6,0,0]}>{paymentData.map((d,i)=><Cell key={i} fill={d.fill}/>)}</Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div style={css.secHeader}>
              <div style={css.secTitle}>{t("Clientes recientes","Recent clients")}</div>
              <button style={{...css.btnGhost,marginLeft:"auto",fontSize:11}} onClick={()=>setSection("clients")}>{t("Ver todos →","View all →")}</button>
            </div>
            <div style={css.tableWrap}>
              <div style={css.tableHead}>{COLS.map((h,i)=><div key={i} style={css.th}>{h}</div>)}</div>
              <div>{loading?<div style={{textAlign:"center",padding:"28px 0",color:"rgba(255,255,255,0.3)"}}>⟳</div>:clients.length===0?<div style={{textAlign:"center",padding:"28px 0",color:"rgba(255,255,255,0.3)"}}>{t("Sin clientes aún","No clients yet")}</div>:clients.slice(0,6).map(c=><Row key={c.id} c={c}/>)}</div>
            </div>
          </>}

          {/* CLIENTS */}
          {section==="clients"&&<>
            <div style={css.secHeader}>
              <div style={css.secTitle}>{t("Todos los clientes","All clients")} <span style={{color:"rgba(255,255,255,0.3)",fontWeight:400}}>({filtered.length})</span></div>
              <input style={css.searchBar} placeholder={t("Buscar por nombre, ID...","Search by name, ID...")} value={search} onChange={e=>setSearch(e.target.value)}/>
              <select style={css.filterSel} value={filterType} onChange={e=>setFilterType(e.target.value)}><option value="">{t("Todos los tipos","All types")}</option><option value="permiso">{t("Permiso trabajo","Work permit")}</option><option value="residencia">{t("Residencia","Residency")}</option><option value="contabilidad">{t("Contabilidad","Accounting")}</option></select>
              <select style={css.filterSel} value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}><option value="">{t("Todos","All")}</option><option value="proceso">{t("En proceso","In process")}</option><option value="pendiente">{t("Pendiente","Pending")}</option><option value="aprobado">{t("Aprobado","Approved")}</option><option value="rechazado">{t("Rechazado","Rejected")}</option></select>
            </div>
            <div style={css.tableWrap}>
              <div style={css.tableHead}>{COLS.map((h,i)=><div key={i} style={css.th}>{h}</div>)}</div>
              <div>{loading?<div style={{textAlign:"center",padding:"28px 0",color:"rgba(255,255,255,0.3)"}}>⟳</div>:filtered.length===0?<div style={{textAlign:"center",padding:"28px 0",color:"rgba(255,255,255,0.3)"}}>{t("Sin resultados","No results")}</div>:filtered.map(c=><Row key={c.id} c={c}/>)}</div>
            </div>
          </>}

          {/* PAYMENTS */}
          {section==="payments"&&<>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14,marginBottom:24}}>
              {[{label:t("Total facturado","Total billed"),value:`ANG ${totalBilled}`,color:"#c084fc"},{label:t("Total cobrado","Collected"),value:`ANG ${totalPaid}`,color:"#4ade80"},{label:t("Por cobrar","Outstanding"),value:`ANG ${totalDebt}`,color:"#f87171"}].map((s,i)=>(
                <div key={i} style={{...css.card,borderColor:s.color+"33"}}><div style={css.statLabel}>{s.label}</div><div style={{...css.statValue,color:s.color,fontSize:24}}>{s.value}</div></div>
              ))}
            </div>
            <div style={css.tableWrap}>
              <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr 130px",borderBottom:"1px solid rgba(99,102,241,0.2)",background:"rgba(99,102,241,0.08)"}}>
                {[t("Cliente","Client"),t("Total","Total"),t("Pagado","Paid"),t("Deuda","Balance"),t("Progreso","Progress")].map((h,i)=><div key={i} style={css.th}>{h}</div>)}
              </div>
              {[...clients].sort((a,b)=>((b.total||0)-(b.paid||0))-((a.total||0)-(a.paid||0))).map(c=>{
                const debt=(c.total||0)-(c.paid||0),pct=c.total?Math.round((c.paid/c.total)*100):0,col=pct===100?"#4ade80":pct>=50?"#fb923c":"#f87171";
                return(<div key={c.id} style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr 130px",borderBottom:"1px solid rgba(99,102,241,0.08)",alignItems:"center",cursor:"pointer",transition:"background 0.1s"}} onMouseEnter={e=>e.currentTarget.style.background="rgba(99,102,241,0.06)"} onMouseLeave={e=>e.currentTarget.style.background="transparent"} onClick={()=>openEdit(c)}>
                  <div style={css.td}><div style={{fontWeight:600,color:"#c084fc"}}>{c.name}</div><div style={{fontSize:11,color:"rgba(255,255,255,0.3)"}}>{c.client_id}</div></div>
                  <div style={{...css.td}}>ANG {c.total||0}</div>
                  <div style={{...css.td,color:"#4ade80",fontWeight:500}}>ANG {c.paid||0}</div>
                  <div style={{...css.td,color:debt<=0?"#4ade80":"#f87171",fontWeight:600}}>{debt<=0?"✓":`ANG ${debt}`}</div>
                  <div style={css.td}><div style={{width:90}}><div style={{height:5,background:"rgba(255,255,255,0.08)",borderRadius:3,overflow:"hidden"}}><div style={{width:`${pct}%`,height:"100%",background:col,borderRadius:3,boxShadow:`0 0 6px ${col}88`,transition:"width 0.3s"}}/></div><div style={{fontSize:10,color:"rgba(255,255,255,0.3)",marginTop:3}}>{pct}% {t("pagado","paid")}</div></div></div>
                </div>);
              })}
            </div>
          </>}

          {/* ALERTS */}
          {section==="alerts"&&<>
            <div style={css.secTitle}>{t("Alertas y vencimientos","Alerts & Expirations")}</div>
            <div style={{marginTop:16,display:"flex",flexDirection:"column",gap:10}}>
              {notifs.length===0?<div style={{textAlign:"center",padding:"48px 0",color:"rgba(255,255,255,0.3)"}}>✅ {t("Sin alertas activas","No active alerts")}</div>:notifs.map((n,i)=>(
                <div key={i} style={{...css.card,borderColor:n.urgent?"rgba(248,113,113,0.3)":"rgba(251,191,36,0.3)",background:n.urgent?"rgba(248,113,113,0.05)":"rgba(251,191,36,0.03)",display:"flex",gap:14,alignItems:"flex-start"}}>
                  <div style={{fontSize:20}}>{n.icon}</div>
                  <div style={{flex:1}}><div style={{fontWeight:600,fontSize:13,marginBottom:3}}>{n.title}</div><div style={{fontSize:12,color:"rgba(255,255,255,0.4)"}}>{n.sub}</div></div>
                  {n.date&&<div style={{fontSize:11,color:"rgba(255,255,255,0.3)",whiteSpace:"nowrap"}}>{new Date(n.date).toLocaleDateString("es")}</div>}
                </div>
              ))}
            </div>
          </>}

        </div>
      </div>

      {/* AI PANEL */}
      <div style={css.aiPanel}>
        <div style={css.aiHead}>
          <div style={{width:8,height:8,borderRadius:"50%",background:"#4ade80",boxShadow:"0 0 10px #4ade80",animation:"glow 2s infinite"}}/>
          <div style={{fontFamily:"'Syne',system-ui,sans-serif",fontSize:12,fontWeight:700,background:"linear-gradient(135deg,#c084fc,#38bdf8)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>{t("Asistente IA","AI Assistant")}</div>
          <div style={{marginLeft:"auto",fontSize:10,color:"rgba(255,255,255,0.3)"}}>Gemini · {clients.length} {t("clientes","clients")}</div>
        </div>
        <div ref={aiRef} style={css.aiMessages}>
          {aiMsgs.map((m,i)=><div key={i} style={m.role==="user"?css.aiMsgUser:css.aiMsgBot}>{m.content}</div>)}
          {aiLoading&&<Dots/>}
        </div>
        <div style={css.aiQuick}>
          {[{es:"✉ Carta permiso",en:"✉ Permit letter",p:"Redacta una carta de solicitud de permiso de trabajo para un cliente en Curaçao, con formato profesional completo incluyendo fecha, destinatario y firma."},{es:"📋 Requisitos",en:"📋 Requirements",p:"¿Cuáles son los requisitos completos para residencia en Curaçao en 2025?"},{es:"💬 Recordatorio pago",en:"💬 Payment reminder",p:"Redacta un recordatorio de pago profesional y amable para un cliente con deuda pendiente."},{es:"🔍 Ver clientes",en:"🔍 Show clients",p:"¿Cuáles son los clientes con pagos pendientes o deudas? Dame un resumen."}].map((b,i)=>(
            <button key={i} style={css.aiQuickBtn} onClick={()=>sendAI(b.p)} onMouseEnter={e=>{e.target.style.color="#c084fc";e.target.style.background="rgba(99,102,241,0.15)";}} onMouseLeave={e=>{e.target.style.color="rgba(192,132,252,0.8)";e.target.style.background="rgba(99,102,241,0.08)";}}>
              {lang==="es"?b.es:b.en}
            </button>
          ))}
        </div>
        <div style={css.aiInputWrap}>
          <textarea id="ai-in" style={css.aiTextarea} value={aiInput} rows={1} placeholder={t("Pregunta sobre tus clientes...","Ask about your clients...")} onChange={e=>setAiInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendAI(aiInput);}}}/>
          <button style={css.aiSendBtn(aiLoading||!aiInput.trim())} disabled={aiLoading||!aiInput.trim()} onClick={()=>sendAI(aiInput)}>↑</button>
        </div>
      </div>

      {/* CLIENT FOLDER MODAL */}
      {clientModal&&(
        <div style={css.overlay} onClick={e=>{if(e.target===e.currentTarget)setClientModal(null);}}>
          <div style={{...css.modal,maxWidth:640}} onClick={e=>e.stopPropagation()}>
            <div style={css.modalHead}>
              <div>
                <div style={css.modalTitle}>📁 {clientModal.name}</div>
                <div style={{fontSize:11,color:"rgba(255,255,255,0.35)",marginTop:2}}>{clientModal.client_id} · <Badge cfg={TYPE_CFG[clientModal.type]||{label:clientModal.type,labelEn:clientModal.type,color:"#888",bg:"#222"}} lang={lang}/></div>
              </div>
              <div style={{marginLeft:"auto",display:"flex",gap:8}}>
                <button style={css.btnSuccess} onClick={()=>exportToPDF(clientModal,lang)}>⬇ PDF</button>
                <button style={css.btnGhost} onClick={()=>{setClientModal(null);openGmail(clientModal);}}>✉ Gmail</button>
                <button style={css.modalClose} onClick={()=>setClientModal(null)}>×</button>
              </div>
            </div>
            <div style={{...css.modalBody,display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <div style={{gridColumn:"1/-1",fontSize:10,color:"rgba(192,132,252,0.6)",textTransform:"uppercase",letterSpacing:"0.1em",paddingBottom:6,borderBottom:"1px solid rgba(99,102,241,0.15)"}}>{t("Información personal","Personal info")}</div>
              {[{label:t("Teléfono","Phone"),value:clientModal.phone},{label:t("Nacionalidad","Nationality"),value:clientModal.nationality},{label:t("Fecha nacimiento","Date of birth"),value:clientModal.birthdate},{label:t("Pasaporte","Passport"),value:clientModal.passport},{label:t("Entrada Curaçao","Entry Curaçao"),value:clientModal.entry_date},{label:"Email",value:clientModal.email},{label:t("Dirección","Address"),value:clientModal.address},{label:t("Contacto emergencia","Emergency contact"),value:clientModal.emergency_contact}].map((f,i)=>(
                <div key={i} style={{background:"rgba(255,255,255,0.03)",borderRadius:10,padding:"10px 14px",border:"1px solid rgba(99,102,241,0.15)"}}>
                  <div style={{fontSize:10,color:"rgba(192,132,252,0.5)",textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:3}}>{f.label}</div>
                  <div style={{fontSize:13}}>{f.value||<span style={{color:"rgba(255,255,255,0.2)"}}>—</span>}</div>
                </div>
              ))}
              <div style={{gridColumn:"1/-1",marginTop:8}}>
                <div style={{fontSize:10,color:"rgba(192,132,252,0.6)",textTransform:"uppercase",letterSpacing:"0.1em",paddingBottom:8,borderBottom:"1px solid rgba(99,102,241,0.15)",marginBottom:10}}>{t("Documentos del trámite","Case documents")} — {(clientModal.documents||[]).length}/{(REQUIRED_DOCS[clientModal.type]||[]).length}</div>
                {(REQUIRED_DOCS[clientModal.type]||[]).map((doc,i)=>{
                  const has=(clientModal.documents||[]).includes(doc);
                  return(
                    <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",borderRadius:8,background:has?"rgba(74,222,128,0.05)":"rgba(248,113,113,0.04)",border:`1px solid ${has?"rgba(74,222,128,0.2)":"rgba(248,113,113,0.15)"}`,marginBottom:6}}>
                      <span style={{fontSize:15}}>{has?"✅":"❌"}</span>
                      <span style={{fontSize:13,flex:1}}>{doc}</span>
                      <span style={{fontSize:11,color:has?"#4ade80":"#f87171",fontWeight:600}}>{has?t("Entregado","Submitted"):t("Pendiente","Pending")}</span>
                    </div>
                  );
                })}
              </div>
              {clientModal.notes&&<div style={{gridColumn:"1/-1",background:"rgba(255,255,255,0.03)",borderRadius:10,padding:"12px 14px",border:"1px solid rgba(99,102,241,0.15)"}}>
                <div style={{fontSize:10,color:"rgba(192,132,252,0.5)",textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:4}}>{t("Notas","Notes")}</div>
                <div style={{fontSize:13,lineHeight:1.6}}>{clientModal.notes}</div>
              </div>}
            </div>
            <div style={{...css.modalFoot,justifyContent:"space-between"}}>
              <button style={css.btnGhost} onClick={()=>{setClientModal(null);askAbout(clientModal);}}>✦ {t("Analizar con IA","Analyze with AI")}</button>
              <button style={css.btnPrimary} onClick={()=>{setClientModal(null);openEdit(clientModal);}}>✎ {t("Editar","Edit")}</button>
            </div>
          </div>
        </div>
      )}

      {/* ADD/EDIT MODAL */}
      {modal&&(
        <div style={css.overlay} onClick={e=>{if(e.target===e.currentTarget)setModal(null);}}>
          <div style={css.modal} onClick={e=>e.stopPropagation()}>
            <div style={css.modalHead}>
              <div style={css.modalTitle}>{modal.mode==="add"?t("Nuevo cliente","New client"):t("Editar cliente","Edit client")}</div>
              <button style={css.modalClose} onClick={()=>setModal(null)}>×</button>
            </div>
            <div style={css.modalBody}>
              <div style={css.formGrid}>
                <div style={{gridColumn:"1/-1",fontSize:10,color:"rgba(192,132,252,0.6)",textTransform:"uppercase",letterSpacing:"0.1em",paddingBottom:6,borderBottom:"1px solid rgba(99,102,241,0.15)"}}>{t("Información personal","Personal info")}</div>
                {[{key:"name",label:t("Nombre completo","Full name"),ph:"Juan Pérez"},{key:"client_id",label:t("ID Expediente","File ID"),ph:"CUR-001"},{key:"email",label:"Email",ph:"cliente@email.com"},{key:"phone",label:t("Teléfono","Phone"),ph:"+5999..."},{key:"nationality",label:t("Nacionalidad","Nationality"),ph:"Venezolana"},{key:"birthdate",label:t("Fecha nacimiento","Date of birth"),type:"date"},{key:"passport",label:t("N° Pasaporte","Passport No."),ph:"A1234567"},{key:"entry_date",label:t("Entrada Curaçao","Entry Curaçao"),type:"date"},{key:"address",label:t("Dirección","Address"),ph:"Willemstad..."},{key:"emergency_contact",label:t("Contacto emergencia","Emergency contact"),ph:"Nombre · tel"}].map(f=>(
                  <div key={f.key} style={css.formGroup(false)}>
                    <label style={css.formLabel}>{f.label}</label>
                    <input style={css.formInput} type={f.type||"text"} placeholder={f.ph||""} value={form[f.key]||""} onChange={e=>setForm(p=>({...p,[f.key]:e.target.value}))}/>
                  </div>
                ))}
                <div style={{gridColumn:"1/-1",fontSize:10,color:"rgba(192,132,252,0.6)",textTransform:"uppercase",letterSpacing:"0.1em",paddingTop:8,paddingBottom:6,borderBottom:"1px solid rgba(99,102,241,0.15)"}}>{t("Trámite y pagos","Case & payments")}</div>
                <div style={css.formGroup(false)}>
                  <label style={css.formLabel}>{t("Tipo","Type")}</label>
                  <select style={{...css.formInput,cursor:"pointer"}} value={form.type||"permiso"} onChange={e=>setForm(p=>({...p,type:e.target.value}))}><option value="permiso">{t("Permiso trabajo","Work permit")}</option><option value="residencia">{t("Residencia","Residency")}</option><option value="contabilidad">{t("Contabilidad","Accounting")}</option></select>
                </div>
                <div style={css.formGroup(false)}>
                  <label style={css.formLabel}>{t("Estatus","Status")}</label>
                  <select style={{...css.formInput,cursor:"pointer"}} value={form.status||"proceso"} onChange={e=>setForm(p=>({...p,status:e.target.value}))}><option value="proceso">{t("En proceso","In process")}</option><option value="pendiente">{t("Pendiente","Pending")}</option><option value="aprobado">{t("Aprobado","Approved")}</option><option value="rechazado">{t("Rechazado","Rejected")}</option></select>
                </div>
                {[{key:"expiry",label:t("Fecha vencimiento","Expiry"),type:"date"},{key:"total",label:t("Total (ANG)","Total (ANG)"),type:"number",ph:"0"},{key:"paid",label:t("Pagado (ANG)","Paid (ANG)"),type:"number",ph:"0"}].map(f=>(
                  <div key={f.key} style={css.formGroup(false)}>
                    <label style={css.formLabel}>{f.label}</label>
                    <input style={css.formInput} type={f.type||"text"} placeholder={f.ph||""} value={form[f.key]||""} onChange={e=>setForm(p=>({...p,[f.key]:e.target.value}))}/>
                  </div>
                ))}
                <div style={css.formGroup(true)}>
                  <label style={css.formLabel}>{t("Notas","Notes")}</label>
                  <textarea style={{...css.formInput,resize:"vertical",minHeight:60}} value={form.notes||""} onChange={e=>setForm(p=>({...p,notes:e.target.value}))} placeholder={t("Notas del caso...","Case notes...")}/>
                </div>
                <div style={{gridColumn:"1/-1"}}>
                  <div style={{fontSize:10,color:"rgba(192,132,252,0.6)",textTransform:"uppercase",letterSpacing:"0.1em",paddingTop:8,paddingBottom:8,borderBottom:"1px solid rgba(99,102,241,0.15)",marginBottom:10}}>{t("Documentos entregados","Submitted documents")} — {(form.documents||[]).length}/{(REQUIRED_DOCS[form.type||"permiso"]||[]).length}</div>
                  {(REQUIRED_DOCS[form.type||"permiso"]||[]).map((doc,i)=>{
                    const has=(form.documents||[]).includes(doc);
                    return(
                      <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",borderRadius:8,background:has?"rgba(74,222,128,0.05)":"rgba(248,113,113,0.04)",border:`1px solid ${has?"rgba(74,222,128,0.2)":"rgba(248,113,113,0.15)"}`,marginBottom:6,cursor:"pointer"}} onClick={()=>toggleDoc(doc)}>
                        <span style={{fontSize:15}}>{has?"✅":"⬜"}</span>
                        <span style={{fontSize:13}}>{doc}</span>
                        <span style={{marginLeft:"auto",fontSize:11,color:has?"#4ade80":"rgba(255,255,255,0.3)"}}>{has?t("✓ Entregado","✓ Submitted"):t("Clic para marcar","Click to mark")}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            <div style={css.modalFoot}>
              {modal.mode==="edit"&&<button style={css.btnDanger} onClick={deleteClient}>{t("Eliminar","Delete")}</button>}
              {modal.mode==="edit"&&<button style={css.btnSuccess} onClick={()=>exportToPDF({...form,total:parseFloat(form.total)||0,paid:parseFloat(form.paid)||0},lang)}>⬇ PDF</button>}
              <button style={css.btnGhost} onClick={()=>setModal(null)}>{t("Cancelar","Cancel")}</button>
              <button style={{...css.btnPrimary,opacity:saving?0.6:1}} onClick={saveClient} disabled={saving}>{saving?"⟳...":modal.mode==="add"?t("Guardar cliente","Save client"):t("Actualizar","Update")}</button>
            </div>
          </div>
        </div>
      )}

      {toast&&<div style={css.toast(toast.ok)}>{toast.ok?"✓":"✕"} {toast.msg}</div>}
    </div>
  );
}
