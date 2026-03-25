import { useState, useEffect, useRef } from "react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

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
  permiso: ["Pasaporte vigente","Foto reciente","Contrato de trabajo","Carta del empleador","Certificado médico","Antecedentes penales","Formulario de solicitud","Comprobante de pago"],
  residencia: ["Pasaporte vigente","Foto reciente","Certificado de nacimiento","Antecedentes penales","Comprobante de ingresos","Seguro médico","Formulario de solicitud","Comprobante de domicilio","Comprobante de pago"],
  contabilidad: ["Registro mercantil","RIF o número fiscal","Estados de cuenta","Facturas del período","Nómina de empleados","Contrato de servicios"],
};

function exportToPDF(client, lang) {
  const t = (es,en) => lang==="es"?es:en;
  const debt = (client.total||0)-(client.paid||0);
  const docs = client.documents||[];
  const required = REQUIRED_DOCS[client.type]||[];
  const docsList = required.map(doc=>{
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
  <div class="field"><div class="field-label">${t("Dirección","Address")}</div><div class="field-value">${client.address||"—"}</div></div>
  <div class="field"><div class="field-label">${t("Entrada Curaçao","Entry")}</div><div class="field-value">${client.entry_date||"—"}</div></div>
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
  const [toast, setToast] = useState(null);
  const [showAI, setShowAI] = useState(false);
  const [aiMsgs, setAiMsgs] = useState([{ role:"assistant", content:"¡Hola! Soy tu asistente CuraManage 🚀\n\nConozco todos tus clientes. Puedo:\n• Actualizar estatus: \"marca a Juan como aprobado\"\n• Registrar pagos: \"agrega pago de ANG 500 a CUR-002\"\n• Redactar cartas y analizar casos\n\n¿Qué necesitas?" }]);
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  // Passport scanner states
  const [passportModal, setPassportModal] = useState(false);
  const [passportScanning, setPassportScanning] = useState(false);
  const [passportPreview, setPassportPreview] = useState(null);
  const [cameraMode, setCameraMode] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const aiRef = useRef(null);
  const passportFileRef = useRef(null);
  const cameraFileRef = useRef(null);

  const t = (es,en) => lang==="es"?es:en;

  function showToast(msg, ok=true) {
    setToast({msg,ok});
    setTimeout(()=>setToast(null),3500);
  }

  async function load() {
    try {
      setLoading(true);
      const data = await db.getAll();
      setClients(data);
    } catch(e) { showToast("Error: "+e.message, false); }
    finally { setLoading(false); }
  }

  useEffect(()=>{ load(); },[]);
  useEffect(()=>{ if(aiRef.current) aiRef.current.scrollTop=aiRef.current.scrollHeight; },[aiMsgs,aiLoading]);

  // Stop camera on unmount
  useEffect(()=>()=>{ if(streamRef.current) streamRef.current.getTracks().forEach(t=>t.stop()); },[]);

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
    else if(days<=7) notifs.push({urgent:true,icon:"⚠️",title:`${c.name} — ${t(`Vence en ${days}d`,`Expires in ${days}d`)}`,sub:`${t("Urgente","Urgent")} · ${c.client_id}`,date:c.expiry,client:c});
    else if(days<=30) notifs.push({urgent:false,icon:"🟡",title:`${c.name}`,sub:`${t(`Vence en ${days} días`,`In ${days} days`)} · ${c.client_id}`,date:c.expiry,client:c});
    const debt=(c.total||0)-(c.paid||0);
    if(debt>0&&debt===c.total) notifs.push({urgent:false,icon:"💰",title:`${c.name}`,sub:`ANG ${debt} ${t("sin pagos","no payments")}`,date:"",client:c});
  });

  const filtered = clients.filter(c=>{
    const q=search.toLowerCase();
    return(!q||c.name.toLowerCase().includes(q)||(c.client_id||"").toLowerCase().includes(q)||(c.email||"").toLowerCase().includes(q))
      &&(!filterType||c.type===filterType)&&(!filterStatus||c.status===filterStatus);
  });

  // ── PASSPORT SCANNER ──────────────────────────────────────────────────────
  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } }
      });
      streamRef.current = stream;
      if(videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraMode(true);
    } catch(e) {
      showToast(t("No se pudo acceder a la cámara","Could not access camera"), false);
    }
  }

  function stopCamera() {
    if(streamRef.current) {
      streamRef.current.getTracks().forEach(t=>t.stop());
      streamRef.current = null;
    }
    setCameraMode(false);
  }

  function capturePhoto() {
    if(!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.95);
    setPassportPreview(dataUrl);
    stopCamera();
  }

  async function handlePassportFile(e) {
    const file = e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = ev => setPassportPreview(ev.target.result);
    reader.readAsDataURL(file);
  }

  async function scanPassport() {
    if(!passportPreview) return;
    setPassportScanning(true);
    try {
      const base64 = passportPreview.split(",")[1];
      const mediaType = passportPreview.startsWith("data:image/png") ? "image/png" : "image/jpeg";
      const res = await fetch("/.netlify/functions/claude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system: "Eres un extractor de datos de pasaportes. Responde SOLO con JSON válido, sin texto adicional, sin markdown.",
          messages: [{
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
              { type: "text", text: `Extrae los datos de este pasaporte y responde SOLO con este JSON exacto (sin texto extra, sin backticks):
{
  "name": "nombre completo en mayúsculas tal como aparece",
  "nationality": "nacionalidad en español",
  "birthdate": "YYYY-MM-DD",
  "passport": "número de pasaporte",
  "expiry": "YYYY-MM-DD fecha de vencimiento del pasaporte",
  "gender": "M o F",
  "birth_country": "país de nacimiento"
}
Si no puedes leer algún campo, ponlo como string vacío "".` }
            ]
          }]
        })
      });
      const data = await res.json();
      const rawText = data.content?.[0]?.text || "{}";
      // Clean and parse JSON
      const cleaned = rawText.replace(/```json|```/g,"").trim();
      const parsed = JSON.parse(cleaned);
      
      // Pre-fill form with passport data
      const nextId = `CUR-${String(clients.length+1).padStart(3,"0")}`;
      setForm({
        client_id: nextId,
        name: parsed.name || "",
        nationality: parsed.nationality || "",
        birthdate: parsed.birthdate || "",
        passport: parsed.passport || "",
        expiry: parsed.expiry || "",
        type: "permiso",
        status: "proceso",
        total: "",
        paid: "0",
        email: "",
        phone: "",
        entry_date: "",
        emergency_contact: "",
        address: "",
        notes: `Pasaporte escaneado el ${new Date().toLocaleDateString("es")}${parsed.gender?` · Género: ${parsed.gender}`:""}`,
        documents: ["Pasaporte vigente"],
      });
      setPassportModal(false);
      setPassportPreview(null);
      setModal({mode:"add"});
      showToast(t("✓ Datos extraídos del pasaporte","✓ Passport data extracted"));
    } catch(e) {
      showToast(t("Error al leer el pasaporte. Intenta de nuevo.","Error reading passport. Try again."), false);
    }
    setPassportScanning(false);
  }

  function openPassportScanner() {
    setPassportModal(true);
    setPassportPreview(null);
    setCameraMode(false);
  }

  function closePassportModal() {
    stopCamera();
    setPassportModal(false);
    setPassportPreview(null);
  }

  // ── CLIENT FORM ───────────────────────────────────────────────────────────
  function openAdd() {
    setForm({
      client_id:`CUR-${String(clients.length+1).padStart(3,"0")}`,
      type:"permiso",status:"proceso",total:"",paid:"0",expiry:"",
      name:"",email:"",phone:"",nationality:"",birthdate:"",
      passport:"",entry_date:"",emergency_contact:"",address:"",notes:"",documents:[]
    });
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
    } catch(e){showToast(t("Error","Error")+": "+e.message,false);}
    setSaving(false);
  }

  async function deleteClient() {
    if(!window.confirm(t("¿Eliminar?","Delete?"))) return;
    try{await db.remove(modal.id);showToast(t("Eliminado","Deleted"));await load();setModal(null);}
    catch{showToast("Error",false);}
  }

  function toggleDoc(doc) {
    const docs=form.documents||[];
    setForm(p=>({...p,documents:docs.includes(doc)?docs.filter(d=>d!==doc):[...docs,doc]}));
  }

  function openGmail(c) {
    const sub=encodeURIComponent(`CuraManage - ${c.client_id} - ${c.name}`);
    const body=encodeURIComponent(`Estimado/a ${c.name},\n\nMe comunico en relación a su trámite.\n\nSaludos,\nCuraManage`);
    window.open(`https://mail.google.com/mail/?view=cm&to=${c.email||""}&su=${sub}&body=${body}`,"_blank");
  }

  // ── AI ────────────────────────────────────────────────────────────────────
  function buildSystemPrompt() {
    const clientList = clients.map(c=>`- ${c.name} | ID:${c.client_id} | tipo:${c.type} | estatus:${c.status} | vence:${c.expiry||"N/A"} | total:${c.total} | pagado:${c.paid} | deuda:${(c.total||0)-(c.paid||0)}`).join("\n");
    return `Eres el asistente IA de CuraManage, sistema de gestión en Curaçao para permisos de trabajo, residencia y contabilidad.

CLIENTES EN EL SISTEMA:
${clientList}

CAPACIDADES - ACTUALIZAR DATOS:
Cuando el usuario pida actualizar algo, agrega al FINAL de tu respuesta:
[ACTION:{"type":"update_status","client_id":"CUR-XXX","value":"proceso|pendiente|aprobado|rechazado"}]
[ACTION:{"type":"add_payment","client_id":"CUR-XXX","amount":500}]
[ACTION:{"type":"update_field","client_id":"CUR-XXX","field":"notes","value":"texto"}]

OTRAS CAPACIDADES:
- Redactar cartas profesionales de permisos o residencia con membrete completo
- Analizar casos y dar recomendaciones
- Responder sobre requisitos en Curaçao
- Recordatorios de pago profesionales

Responde en el idioma del usuario. Sé conciso y útil.`;
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
      let reply=data.content?.[0]?.text||"Error.";
      const actionMatch=reply.match(/\[ACTION:(\{.*?\})\]/);
      if(actionMatch){
        try{
          const action=JSON.parse(actionMatch[1]);
          reply=reply.replace(/\[ACTION:\{.*?\}\]/,"").trim();
          setPendingAction(action);
        }catch{}
      }
      setAiMsgs(p=>[...p,{role:"assistant",content:reply}]);
    } catch{setAiMsgs(p=>[...p,{role:"assistant",content:"Error de conexión."}]);}
    setAiLoading(false);
  }

  useEffect(()=>{
    if(!pendingAction) return;
    const action=pendingAction;
    const client=clients.find(c=>c.client_id===action.client_id);
    if(!client){setPendingAction(null);return;}
    async function execute(){
      try{
        let updateData={};
        if(action.type==="update_status") updateData={status:action.value};
        else if(action.type==="add_payment") updateData={paid:Math.min((client.paid||0)+action.amount,client.total||9999)};
        else if(action.type==="update_field") updateData={[action.field]:action.value};
        await db.update(client.id,updateData);
        await load();
        showToast(`✓ ${t("Actualizado","Updated")}: ${client.name}`);
      }catch{showToast("Error al actualizar",false);}
      setPendingAction(null);
    }
    execute();
  },[pendingAction]);

  function askAbout(c) {
    const debt=(c.total||0)-(c.paid||0);
    const missing=(REQUIRED_DOCS[c.type]||[]).filter(d=>!(c.documents||[]).includes(d));
    setShowAI(true);
    sendAI(`Analiza este caso:\n${c.name} (${c.client_id})\nTipo: ${c.type} | Estatus: ${c.status}\nVence: ${c.expiry||"N/A"} | Deuda: ANG ${debt}\nDocs faltantes: ${missing.length>0?missing.join(", "):"Ninguno"}\nNotas: ${c.notes||"Sin notas"}\nDame análisis y próximos pasos.`);
  }

  // ── STYLES ────────────────────────────────────────────────────────────────
  const css={
    app:{display:"flex",flexDirection:"column",minHeight:"100vh",fontFamily:"'DM Sans',system-ui,sans-serif",background:"#0a0a0f",color:"#f0f0f5",fontSize:14},
    mobileNav:{position:"fixed",bottom:0,left:0,right:0,background:"linear-gradient(180deg,#1a1a2e,#16213e)",borderTop:"1px solid rgba(99,102,241,0.3)",display:"flex",zIndex:50,paddingBottom:"env(safe-area-inset-bottom,0px)"},
    mobileNavItem:(a)=>({flex:1,display:"flex",flexDirection:"column",alignItems:"center",padding:"10px 4px 8px",cursor:"pointer",color:a?"#c084fc":"rgba(255,255,255,0.4)",fontSize:10,fontWeight:a?600:400,gap:4,background:"transparent",border:"none",fontFamily:"inherit",position:"relative"}),
    sidebar:{width:220,minWidth:220,background:"linear-gradient(180deg,#1a1a2e,#16213e)",borderRight:"1px solid rgba(99,102,241,0.2)",display:"flex",flexDirection:"column",flexShrink:0},
    desktopLayout:{display:"flex",flex:1,overflow:"hidden",height:"100vh"},
    logoWrap:{padding:"20px 18px 16px",borderBottom:"1px solid rgba(99,102,241,0.2)"},
    logoTitle:{fontFamily:"'Syne',system-ui,sans-serif",fontWeight:800,fontSize:19,background:"linear-gradient(135deg,#c084fc,#38bdf8)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"},
    logoSub:{fontSize:10,color:"rgba(255,255,255,0.3)",marginTop:2,letterSpacing:"0.1em",textTransform:"uppercase"},
    nav:{flex:1,padding:"12px 8px",display:"flex",flexDirection:"column",gap:3},
    navItem:(a)=>({display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:10,cursor:"pointer",fontSize:13,color:a?"#fff":"rgba(255,255,255,0.5)",fontWeight:a?600:400,background:a?"linear-gradient(135deg,rgba(99,102,241,0.4),rgba(139,92,246,0.3))":"transparent",border:`1px solid ${a?"rgba(99,102,241,0.5)":"transparent"}`,userSelect:"none"}),
    navBadge:{marginLeft:"auto",background:"#f87171",color:"#fff",borderRadius:10,fontSize:10,fontWeight:700,padding:"2px 7px"},
    sideBottom:{padding:"12px 8px",borderTop:"1px solid rgba(99,102,241,0.2)"},
    langToggle:{display:"flex",gap:3,background:"rgba(255,255,255,0.05)",borderRadius:10,padding:3},
    langBtn:(a)=>({flex:1,textAlign:"center",padding:"6px 0",borderRadius:8,fontSize:11,fontWeight:600,cursor:"pointer",color:a?"#fff":"rgba(255,255,255,0.4)",background:a?"linear-gradient(135deg,#6366f1,#8b5cf6)":"transparent"}),
    main:{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"},
    topbar:{padding:"12px 16px",borderBottom:"1px solid rgba(99,102,241,0.15)",background:"rgba(26,26,46,0.95)",display:"flex",alignItems:"center",gap:10,flexShrink:0},
    topbarTitle:{fontFamily:"'Syne',system-ui,sans-serif",fontWeight:700,fontSize:15,flex:1},
    btnPrimary:{padding:"8px 14px",borderRadius:10,fontSize:12,fontWeight:600,cursor:"pointer",background:"linear-gradient(135deg,#6366f1,#8b5cf6)",color:"#fff",border:"none",fontFamily:"inherit",whiteSpace:"nowrap"},
    btnGhost:{padding:"7px 12px",borderRadius:10,fontSize:12,fontWeight:500,cursor:"pointer",background:"rgba(255,255,255,0.05)",color:"rgba(255,255,255,0.6)",border:"1px solid rgba(255,255,255,0.1)",fontFamily:"inherit",whiteSpace:"nowrap"},
    btnDanger:{padding:"7px 12px",borderRadius:10,fontSize:12,fontWeight:500,cursor:"pointer",background:"rgba(248,113,113,0.1)",color:"#f87171",border:"1px solid rgba(248,113,113,0.3)",fontFamily:"inherit"},
    btnSuccess:{padding:"7px 12px",borderRadius:10,fontSize:12,fontWeight:500,cursor:"pointer",background:"rgba(74,222,128,0.1)",color:"#4ade80",border:"1px solid rgba(74,222,128,0.3)",fontFamily:"inherit"},
    btnScan:{padding:"10px 18px",borderRadius:12,fontSize:13,fontWeight:600,cursor:"pointer",background:"linear-gradient(135deg,#f59e0b,#ef4444)",color:"#fff",border:"none",fontFamily:"inherit",display:"flex",alignItems:"center",gap:8},
    content:{flex:1,overflowY:"auto",padding:"16px",WebkitOverflowScrolling:"touch"},
    card:{background:"linear-gradient(135deg,rgba(26,26,46,0.9),rgba(22,33,62,0.9))",border:"1px solid rgba(99,102,241,0.2)",borderRadius:14,padding:"14px 16px"},
    statsGrid:{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10,marginBottom:18},
    statValue:{fontFamily:"'Syne',system-ui,sans-serif",fontSize:22,fontWeight:800,marginTop:4},
    statLabel:{fontSize:10,color:"rgba(255,255,255,0.4)",textTransform:"uppercase",letterSpacing:"0.06em"},
    clientCard:()=>({background:"linear-gradient(135deg,rgba(26,26,46,0.9),rgba(22,33,62,0.9))",border:"1px solid rgba(99,102,241,0.2)",borderRadius:12,padding:"14px 16px",marginBottom:10,cursor:"pointer",transition:"all 0.15s"}),
    badge:(c)=>({display:"inline-block",padding:"2px 8px",borderRadius:20,fontSize:11,fontWeight:600,color:c.color,background:c.bg,whiteSpace:"nowrap",border:`1px solid ${c.color}33`}),
    secHeader:{display:"flex",alignItems:"center",gap:8,marginBottom:14,flexWrap:"wrap"},
    secTitle:{fontFamily:"'Syne',system-ui,sans-serif",fontSize:14,fontWeight:700},
    searchBar:{flex:1,minWidth:120,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(99,102,241,0.3)",borderRadius:10,padding:"8px 12px",fontSize:13,color:"#f0f0f5",fontFamily:"inherit",outline:"none"},
    filterSel:{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(99,102,241,0.3)",borderRadius:10,padding:"7px 10px",fontSize:12,color:"rgba(255,255,255,0.6)",fontFamily:"inherit",outline:"none",cursor:"pointer"},
    aiDrawer:{position:"fixed",bottom:65,left:0,right:0,height:"70vh",background:"linear-gradient(180deg,#1a1a2e,#16213e)",borderTop:"2px solid rgba(99,102,241,0.4)",display:"flex",flexDirection:"column",zIndex:40,transform:showAI?"translateY(0)":"translateY(100%)",transition:"transform 0.3s ease"},
    aiPanel:{width:320,minWidth:320,background:"linear-gradient(180deg,#1a1a2e,#16213e)",borderLeft:"1px solid rgba(99,102,241,0.2)",display:"flex",flexDirection:"column"},
    aiHead:{padding:"12px 16px",borderBottom:"1px solid rgba(99,102,241,0.2)",display:"flex",alignItems:"center",gap:8,background:"rgba(99,102,241,0.08)",flexShrink:0},
    aiMessages:{flex:1,overflowY:"auto",padding:"12px",display:"flex",flexDirection:"column",gap:8,WebkitOverflowScrolling:"touch"},
    aiMsgUser:{alignSelf:"flex-end",background:"linear-gradient(135deg,#6366f1,#8b5cf6)",color:"#fff",padding:"10px 13px",borderRadius:"12px 12px 2px 12px",fontSize:13,lineHeight:1.55,maxWidth:"85%",whiteSpace:"pre-wrap"},
    aiMsgBot:{alignSelf:"flex-start",background:"rgba(255,255,255,0.06)",border:"1px solid rgba(99,102,241,0.2)",padding:"10px 13px",borderRadius:"12px 12px 12px 2px",fontSize:13,lineHeight:1.55,maxWidth:"90%",whiteSpace:"pre-wrap"},
    aiQuick:{padding:"8px 12px",display:"flex",gap:5,flexWrap:"wrap",borderTop:"1px solid rgba(99,102,241,0.15)",flexShrink:0},
    aiQuickBtn:{fontSize:11,padding:"5px 9px",borderRadius:20,border:"1px solid rgba(99,102,241,0.3)",background:"rgba(99,102,241,0.08)",color:"rgba(192,132,252,0.8)",cursor:"pointer",fontFamily:"inherit"},
    aiInputWrap:{padding:"10px 12px",borderTop:"1px solid rgba(99,102,241,0.15)",display:"flex",gap:7,alignItems:"flex-end",flexShrink:0},
    aiTextarea:{flex:1,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(99,102,241,0.3)",borderRadius:10,padding:"9px 12px",fontSize:13,color:"#f0f0f5",fontFamily:"inherit",outline:"none",resize:"none",lineHeight:1.4},
    aiSendBtn:(d)=>({width:40,height:40,borderRadius:10,background:d?"rgba(255,255,255,0.05)":"linear-gradient(135deg,#6366f1,#8b5cf6)",border:"none",color:d?"rgba(255,255,255,0.3)":"#fff",cursor:d?"not-allowed":"pointer",fontSize:18,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}),
    overlay:{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",backdropFilter:"blur(4px)",zIndex:100,display:"flex",alignItems:"flex-end",justifyContent:"center"},
    modal:{background:"linear-gradient(135deg,#1a1a2e,#16213e)",border:"1px solid rgba(99,102,241,0.3)",borderRadius:"20px 20px 0 0",width:"100%",maxWidth:"100%",maxHeight:"92vh",overflowY:"auto",boxShadow:"0 -10px 40px rgba(0,0,0,0.5)"},
    modalHead:{padding:"18px 20px 14px",borderBottom:"1px solid rgba(99,102,241,0.2)",display:"flex",alignItems:"center",background:"rgba(99,102,241,0.08)",position:"sticky",top:0,zIndex:1},
    modalTitle:{fontFamily:"'Syne',system-ui,sans-serif",fontSize:15,fontWeight:700},
    modalClose:{marginLeft:"auto",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",color:"rgba(255,255,255,0.5)",width:32,height:32,borderRadius:8,cursor:"pointer",fontSize:18,display:"flex",alignItems:"center",justifyContent:"center"},
    modalBody:{padding:"18px 20px"},
    formGrid:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12},
    formGroup:(f)=>({gridColumn:f?"1/-1":"auto",display:"flex",flexDirection:"column",gap:5}),
    formLabel:{fontSize:10,color:"rgba(192,132,252,0.7)",textTransform:"uppercase",letterSpacing:"0.08em"},
    formInput:{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(99,102,241,0.3)",borderRadius:10,padding:"11px 14px",fontSize:14,color:"#f0f0f5",fontFamily:"inherit",outline:"none"},
    modalFoot:{padding:"14px 20px 20px",display:"flex",gap:8,justifyContent:"flex-end",flexWrap:"wrap",borderTop:"1px solid rgba(99,102,241,0.15)",position:"sticky",bottom:0,background:"#16213e",zIndex:1},
    toast:(ok)=>({position:"fixed",top:16,left:"50%",transform:"translateX(-50%)",zIndex:300,background:ok?"rgba(74,222,128,0.15)":"rgba(248,113,113,0.15)",border:`1px solid ${ok?"#4ade80":"#f87171"}`,color:ok?"#4ade80":"#f87171",padding:"12px 20px",borderRadius:12,fontSize:13,fontWeight:600,backdropFilter:"blur(10px)",whiteSpace:"nowrap"}),
  };

  function Badge({cfg,lang}){ return <span style={css.badge(cfg)}>{lang==="es"?cfg.label:cfg.labelEn}</span>; }

  function ClientCard({c}){
    const debt=(c.total||0)-(c.paid||0);
    const urgent=c.expiry&&(new Date(c.expiry)-Date.now())<30*86400000&&c.status!=="aprobado";
    const pct=c.total?Math.round((c.paid/c.total)*100):0;
    const col=pct===100?"#4ade80":pct>=50?"#fb923c":"#f87171";
    const missing=(REQUIRED_DOCS[c.type]||[]).filter(d=>!(c.documents||[]).includes(d)).length;
    return(
      <div style={css.clientCard()} onClick={()=>setClientModal(c)}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
          <div>
            <div style={{fontWeight:600,fontSize:15,color:"#c084fc"}}>{c.name}</div>
            <div style={{fontSize:11,color:"rgba(255,255,255,0.35)",marginTop:1}}>{c.client_id}{c.nationality?` · ${c.nationality}`:""}</div>
          </div>
          <Badge cfg={STATUS_CFG[c.status]||{label:c.status,labelEn:c.status,color:"#888",bg:"#222"}} lang={lang}/>
        </div>
        <div style={{display:"flex",gap:6,marginBottom:10,flexWrap:"wrap"}}>
          <Badge cfg={TYPE_CFG[c.type]||{label:c.type,labelEn:c.type,color:"#888",bg:"#222"}} lang={lang}/>
          {c.expiry&&<span style={{fontSize:11,color:urgent?"#f87171":"rgba(255,255,255,0.35)",padding:"2px 8px",borderRadius:20,border:`1px solid ${urgent?"rgba(248,113,113,0.3)":"rgba(255,255,255,0.1)"}`}}>{new Date(c.expiry).toLocaleDateString("es",{day:"2-digit",month:"short",year:"2-digit"})}{urgent?" ⚠":""}</span>}
          {missing>0&&<span style={{fontSize:11,color:"#f87171",padding:"2px 8px",borderRadius:20,border:"1px solid rgba(248,113,113,0.3)"}}>⚠ {missing} docs</span>}
        </div>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{flex:1}}>
            <div style={{height:4,background:"rgba(255,255,255,0.08)",borderRadius:2,overflow:"hidden"}}>
              <div style={{width:`${pct}%`,height:"100%",background:col,borderRadius:2}}/>
            </div>
            <div style={{fontSize:10,color:"rgba(255,255,255,0.3)",marginTop:3}}>{pct}% {t("pagado","paid")} · {debt>0?`ANG ${debt} ${t("pendiente","pending")}`:"✓"}</div>
          </div>
          <div style={{display:"flex",gap:6}}>
            <button onClick={e=>{e.stopPropagation();openEdit(c);}} style={{...css.btnGhost,padding:"5px 10px",fontSize:12}}>✎</button>
            <button onClick={e=>{e.stopPropagation();askAbout(c);}} style={{...css.btnGhost,padding:"5px 10px",fontSize:12}}>✦</button>
          </div>
        </div>
      </div>
    );
  }

  const AI_PANEL=(
    <>
      <div style={css.aiHead}>
        <div style={{width:8,height:8,borderRadius:"50%",background:"#4ade80",boxShadow:"0 0 8px #4ade80"}}/>
        <div style={{fontFamily:"'Syne',system-ui,sans-serif",fontSize:13,fontWeight:700,background:"linear-gradient(135deg,#c084fc,#38bdf8)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>{t("Asistente IA","AI Assistant")}</div>
        <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:10,color:"rgba(255,255,255,0.3)"}}>{clients.length} {t("clientes","clients")}</span>
          <button style={{...css.btnGhost,padding:"4px 8px",fontSize:12}} onClick={()=>setShowAI(false)}>✕</button>
        </div>
      </div>
      <div ref={aiRef} style={css.aiMessages}>
        {aiMsgs.map((m,i)=><div key={i} style={m.role==="user"?css.aiMsgUser:css.aiMsgBot}>{m.content}</div>)}
        {aiLoading&&<div style={{...css.aiMsgBot,padding:"10px 14px"}}><div style={{display:"flex",gap:5}}>{[0,1,2].map(i=><div key={i} style={{width:7,height:7,borderRadius:"50%",background:"rgba(192,132,252,0.5)",animation:`bounce 1.2s infinite ${i*0.2}s`}}/>)}</div></div>}
      </div>
      <div style={css.aiQuick}>
        {[{es:"📋 Deudas pendientes",en:"📋 Pending debts",p:"¿Cuáles clientes tienen deuda pendiente? Dame un resumen con montos."},{es:"⚠ Vencimientos",en:"⚠ Expirations",p:"¿Cuáles clientes tienen trámites que vencen pronto?"},{es:"✉ Carta permiso",en:"✉ Permit letter",p:"Redacta una carta de solicitud de permiso de trabajo para Curaçao con formato profesional."},{es:"💬 Recordatorio pago",en:"💬 Payment reminder",p:"Redacta un recordatorio de pago profesional y amable."}].map((b,i)=>(
          <button key={i} style={css.aiQuickBtn} onClick={()=>sendAI(b.p)}>{lang==="es"?b.es:b.en}</button>
        ))}
      </div>
      <div style={css.aiInputWrap}>
        <textarea id="ai-in" style={css.aiTextarea} value={aiInput} rows={1}
          placeholder={t("Escribe o da un comando...","Type or give a command...")}
          onChange={e=>setAiInput(e.target.value)}
          onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendAI(aiInput);}}}/>
        <button style={css.aiSendBtn(aiLoading||!aiInput.trim())} disabled={aiLoading||!aiInput.trim()} onClick={()=>sendAI(aiInput)}>↑</button>
      </div>
    </>
  );

  const FORM_MODAL=(
    <div style={css.overlay} onClick={e=>{if(e.target===e.currentTarget)setModal(null);}}>
      <div style={css.modal} onClick={e=>e.stopPropagation()}>
        <div style={css.modalHead}>
          <div>
            <div style={css.modalTitle}>{modal?.mode==="add"?t("Nuevo cliente","New client"):t("Editar cliente","Edit client")}</div>
            {modal?.mode==="add"&&<div style={{fontSize:11,color:"rgba(255,255,255,0.35)",marginTop:2}}>{t("Datos extraídos del pasaporte o ingresa manualmente","Passport data or enter manually")}</div>}
          </div>
          <button style={css.modalClose} onClick={()=>setModal(null)}>×</button>
        </div>
        <div style={css.modalBody}>
          <div style={css.formGrid}>
            <div style={{gridColumn:"1/-1",fontSize:10,color:"rgba(192,132,252,0.6)",textTransform:"uppercase",letterSpacing:"0.1em",paddingBottom:6,borderBottom:"1px solid rgba(99,102,241,0.15)"}}>{t("Información personal","Personal info")}</div>
            {[{key:"name",label:t("Nombre completo","Full name"),ph:"JUAN PÉREZ"},{key:"client_id",label:"ID",ph:"CUR-001"},{key:"phone",label:t("Teléfono","Phone"),ph:"+5999..."},{key:"email",label:"Email",ph:"cliente@email.com"},{key:"nationality",label:t("Nacionalidad","Nationality"),ph:"Venezolana"},{key:"birthdate",label:t("Nacimiento","Birthday"),type:"date"},{key:"passport",label:t("N° Pasaporte","Passport No."),ph:"A1234567"},{key:"entry_date",label:t("Entrada Curaçao","Entry"),type:"date"},{key:"address",label:t("Dirección","Address"),ph:"Willemstad..."},{key:"emergency_contact",label:t("Emergencia","Emergency"),ph:"Nombre · tel"}].map(f=>(
              <div key={f.key} style={css.formGroup(false)}>
                <label style={css.formLabel}>{f.label}</label>
                <input style={{...css.formInput,borderColor:f.key==="name"&&form[f.key]?"rgba(74,222,128,0.4)":"rgba(99,102,241,0.3)"}} type={f.type||"text"} placeholder={f.ph||""} value={form[f.key]||""} onChange={e=>setForm(p=>({...p,[f.key]:e.target.value}))}/>
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
            {[{key:"expiry",label:t("Vencimiento","Expiry"),type:"date"},{key:"total",label:t("Total ANG","Total ANG"),type:"number",ph:"0"},{key:"paid",label:t("Pagado ANG","Paid ANG"),type:"number",ph:"0"}].map(f=>(
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
              <div style={{fontSize:10,color:"rgba(192,132,252,0.6)",textTransform:"uppercase",letterSpacing:"0.1em",paddingTop:6,paddingBottom:8,borderBottom:"1px solid rgba(99,102,241,0.15)",marginBottom:10}}>{t("Documentos entregados","Submitted docs")} — {(form.documents||[]).length}/{(REQUIRED_DOCS[form.type||"permiso"]||[]).length}</div>
              {(REQUIRED_DOCS[form.type||"permiso"]||[]).map((doc,i)=>{
                const has=(form.documents||[]).includes(doc);
                return(<div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:8,background:has?"rgba(74,222,128,0.05)":"rgba(248,113,113,0.04)",border:`1px solid ${has?"rgba(74,222,128,0.2)":"rgba(248,113,113,0.15)"}`,marginBottom:7,cursor:"pointer"}} onClick={()=>toggleDoc(doc)}>
                  <span style={{fontSize:16}}>{has?"✅":"⬜"}</span>
                  <span style={{fontSize:13,flex:1}}>{doc}</span>
                  <span style={{fontSize:11,color:has?"#4ade80":"rgba(255,255,255,0.3)"}}>{has?t("✓","✓"):t("Tocar","Tap")}</span>
                </div>);
              })}
            </div>
          </div>
        </div>
        <div style={css.modalFoot}>
          {modal?.mode==="edit"&&<button style={css.btnDanger} onClick={deleteClient}>{t("Eliminar","Delete")}</button>}
          {modal?.mode==="edit"&&<button style={css.btnSuccess} onClick={()=>exportToPDF({...form,total:parseFloat(form.total)||0,paid:parseFloat(form.paid)||0},lang)}>⬇ PDF</button>}
          <button style={css.btnGhost} onClick={()=>setModal(null)}>{t("Cancelar","Cancel")}</button>
          <button style={{...css.btnPrimary,opacity:saving?0.6:1}} onClick={saveClient} disabled={saving}>{saving?"⟳...":modal?.mode==="add"?t("Guardar cliente","Save client"):t("Actualizar","Update")}</button>
        </div>
      </div>
    </div>
  );

  // Dashboard table row
  function DRow({c}){
    const debt=(c.total||0)-(c.paid||0);
    const pct=c.total?Math.round((c.paid/c.total)*100):0;
    const col=pct===100?"#4ade80":pct>=50?"#fb923c":"#f87171";
    const urgent=c.expiry&&(new Date(c.expiry)-Date.now())<30*86400000&&c.status!=="aprobado";
    return(
      <div style={{display:"grid",gridTemplateColumns:"2fr 1.2fr 1.1fr 1fr 80px 80px 110px",borderBottom:"1px solid rgba(99,102,241,0.08)",alignItems:"center",cursor:"pointer",transition:"background 0.1s"}} onMouseEnter={e=>e.currentTarget.style.background="rgba(99,102,241,0.06)"} onMouseLeave={e=>e.currentTarget.style.background="transparent"} onClick={()=>setClientModal(c)}>
        <div style={{padding:"12px 14px"}}><div style={{fontWeight:600,color:"#c084fc",fontSize:13}}>{c.name}</div><div style={{fontSize:11,color:"rgba(255,255,255,0.3)"}}>{c.client_id}{c.nationality?` · ${c.nationality}`:""}</div></div>
        <div style={{padding:"12px 14px"}}><Badge cfg={TYPE_CFG[c.type]||{label:c.type,labelEn:c.type,color:"#888",bg:"#222"}} lang={lang}/></div>
        <div style={{padding:"12px 14px"}}><Badge cfg={STATUS_CFG[c.status]||{label:c.status,labelEn:c.status,color:"#888",bg:"#222"}} lang={lang}/></div>
        <div style={{padding:"12px 14px",fontSize:12,color:urgent?"#f87171":"rgba(255,255,255,0.35)"}}>{c.expiry?new Date(c.expiry).toLocaleDateString("es",{day:"2-digit",month:"short",year:"2-digit"}):"—"}{urgent?" ⚠":""}</div>
        <div style={{padding:"12px 14px"}}><div style={{height:4,background:"rgba(255,255,255,0.08)",borderRadius:2,overflow:"hidden",width:60}}><div style={{width:`${pct}%`,height:"100%",background:col,borderRadius:2}}/></div><div style={{fontSize:10,color:"rgba(255,255,255,0.3)",marginTop:2}}>{pct}%</div></div>
        <div style={{padding:"12px 14px",color:debt<=0?"#4ade80":"#f87171",fontWeight:600,fontSize:13}}>{debt<=0?"✓":`ANG ${debt}`}</div>
        <div style={{padding:"12px 14px",display:"flex",gap:4}}>
          <button onClick={e=>{e.stopPropagation();openEdit(c);}} style={{...css.btnGhost,padding:"3px 7px",fontSize:11}}>✎</button>
          <button onClick={e=>{e.stopPropagation();askAbout(c);}} style={{...css.btnGhost,padding:"3px 7px",fontSize:11}}>✦</button>
          <button onClick={e=>{e.stopPropagation();exportToPDF(c,lang);}} style={{...css.btnGhost,padding:"3px 7px",fontSize:11}}>⬇</button>
        </div>
      </div>
    );
  }

  return(
    <div style={css.app}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600&display=swap');
        @keyframes bounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-5px)}}
        @keyframes glow{0%,100%{opacity:1}50%{opacity:0.4}}
        @keyframes spin{to{transform:rotate(360deg)}}
        *{box-sizing:border-box}
        ::-webkit-scrollbar{width:3px}::-webkit-scrollbar-thumb{background:rgba(99,102,241,0.3);border-radius:3px}
        input[type=date]::-webkit-calendar-picker-indicator{filter:invert(0.5)}
        select option{background:#1a1a2e}
        input:focus,textarea:focus,select:focus{border-color:rgba(99,102,241,0.6)!important;box-shadow:0 0 0 3px rgba(99,102,241,0.1)}
        @media(min-width:768px){.mob{display:none!important}.desk{display:flex!important}}
        @media(max-width:767px){.desk{display:none!important}.mob{display:flex!important}}
      `}</style>

      {/* ── DESKTOP ── */}
      <div className="desk" style={{...css.desktopLayout,display:"flex"}}>
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
            <div style={{fontSize:10,color:"rgba(255,255,255,0.25)",textAlign:"center",marginBottom:8}}>{clients.length} {t("clientes","clients")} · Supabase ✓</div>
            <div style={css.langToggle}>
              <div style={css.langBtn(lang==="es")} onClick={()=>setLang("es")}>ES</div>
              <div style={css.langBtn(lang==="en")} onClick={()=>setLang("en")}>EN</div>
            </div>
          </div>
        </aside>

        <div style={css.main}>
          <div style={css.topbar}>
            <div style={css.topbarTitle}>{({dashboard:t("Panel","Dashboard"),clients:t("Clientes","Clients"),payments:t("Pagos","Payments"),alerts:t("Alertas","Alerts")})[section]}</div>
            {loading&&<span style={{fontSize:11,color:"rgba(192,132,252,0.5)",animation:"glow 1s infinite"}}>⟳</span>}
            <div style={{marginLeft:"auto",display:"flex",gap:8}}>
              <button style={css.btnGhost} onClick={load}>↻</button>
              <button style={{...css.btnGhost,background:"rgba(245,158,11,0.1)",color:"#f59e0b",border:"1px solid rgba(245,158,11,0.3)"}} onClick={openPassportScanner}>📷 {t("Escanear pasaporte","Scan passport")}</button>
              <button style={css.btnGhost} onClick={openAdd}>+ {t("Manual","Manual")}</button>
              <button style={css.btnPrimary} onClick={()=>{setShowAI(!showAI);setTimeout(()=>document.getElementById("ai-in")?.focus(),100);}}>✦ {t("Asistente","Assistant")}</button>
            </div>
          </div>
          <div style={css.content}>
            {section==="dashboard"&&<>
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:20}}>
                {[{label:t("Total clientes","Total clients"),value:clients.length,color:"#c084fc"},{label:t("En proceso","In process"),value:clients.filter(c=>c.status==="proceso").length,color:"#38bdf8"},{label:t("Por cobrar","Outstanding"),value:`ANG ${totalDebt}`,color:"#fb923c"},{label:t("Vencen pronto","Expiring"),value:expiring,color:"#f87171"}].map((s,i)=>(
                  <div key={i} style={{...css.card,borderColor:s.color+"33"}}><div style={css.statLabel}>{s.label}</div><div style={{...css.statValue,color:s.color,fontSize:26}}>{s.value}</div></div>
                ))}
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:14,marginBottom:20}}>
                <div style={css.card}>
                  <div style={{fontSize:11,fontWeight:600,color:"rgba(192,132,252,0.7)",marginBottom:10,textTransform:"uppercase",letterSpacing:"0.07em"}}>{t("Por estatus","By status")}</div>
                  <ResponsiveContainer width="100%" height={130}><PieChart><Pie data={statusData} cx="50%" cy="50%" innerRadius={32} outerRadius={55} paddingAngle={3} dataKey="value">{statusData.map((e,i)=><Cell key={i} fill={e.color} stroke="transparent"/>)}</Pie><Tooltip contentStyle={{background:"#1a1a2e",border:"1px solid rgba(99,102,241,0.3)",borderRadius:8,fontSize:11}}/></PieChart></ResponsiveContainer>
                  <div style={{display:"flex",flexWrap:"wrap",gap:5,marginTop:4}}>{statusData.map((d,i)=><div key={i} style={{fontSize:10,color:d.color,display:"flex",alignItems:"center",gap:3}}><span style={{width:5,height:5,borderRadius:"50%",background:d.color,display:"inline-block"}}/>{d.name}:{d.value}</div>)}</div>
                </div>
                <div style={css.card}>
                  <div style={{fontSize:11,fontWeight:600,color:"rgba(192,132,252,0.7)",marginBottom:10,textTransform:"uppercase",letterSpacing:"0.07em"}}>{t("Por tipo","By type")}</div>
                  <ResponsiveContainer width="100%" height={130}><PieChart><Pie data={typeData} cx="50%" cy="50%" innerRadius={32} outerRadius={55} paddingAngle={3} dataKey="value">{typeData.map((e,i)=><Cell key={i} fill={e.color} stroke="transparent"/>)}</Pie><Tooltip contentStyle={{background:"#1a1a2e",border:"1px solid rgba(99,102,241,0.3)",borderRadius:8,fontSize:11}}/></PieChart></ResponsiveContainer>
                  <div style={{display:"flex",flexWrap:"wrap",gap:5,marginTop:4}}>{typeData.map((d,i)=><div key={i} style={{fontSize:10,color:d.color,display:"flex",alignItems:"center",gap:3}}><span style={{width:5,height:5,borderRadius:"50%",background:d.color,display:"inline-block"}}/>{d.name}:{d.value}</div>)}</div>
                </div>
                <div style={css.card}>
                  <div style={{fontSize:11,fontWeight:600,color:"rgba(192,132,252,0.7)",marginBottom:10,textTransform:"uppercase",letterSpacing:"0.07em"}}>{t("Cobros ANG","Payments ANG")}</div>
                  <ResponsiveContainer width="100%" height={130}><BarChart data={payData} barSize={28}><XAxis dataKey="name" tick={{fontSize:10,fill:"rgba(255,255,255,0.4)"}} axisLine={false} tickLine={false}/><YAxis tick={{fontSize:10,fill:"rgba(255,255,255,0.4)"}} axisLine={false} tickLine={false}/><Tooltip contentStyle={{background:"#1a1a2e",border:"1px solid rgba(99,102,241,0.3)",borderRadius:8,fontSize:11}}/><Bar dataKey="value" radius={[5,5,0,0]}>{payData.map((d,i)=><Cell key={i} fill={d.fill}/>)}</Bar></BarChart></ResponsiveContainer>
                </div>
              </div>
              <div style={css.secHeader}>
                <div style={css.secTitle}>{t("Clientes recientes","Recent clients")}</div>
                <button style={{...css.btnGhost,marginLeft:"auto",fontSize:11}} onClick={()=>setSection("clients")}>{t("Ver todos →","View all →")}</button>
              </div>
              <div style={{...css.card,padding:0,overflow:"hidden"}}>
                <div style={{display:"grid",gridTemplateColumns:"2fr 1.2fr 1.1fr 1fr 80px 80px 110px",borderBottom:"1px solid rgba(99,102,241,0.2)",background:"rgba(99,102,241,0.08)"}}>
                  {[t("Cliente","Client"),t("Tipo","Type"),t("Estatus","Status"),t("Vence","Expires"),t("Pago","Pmt"),t("Deuda","Debt"),""].map((h,i)=><div key={i} style={{padding:"10px 14px",fontSize:10,fontWeight:600,color:"rgba(192,132,252,0.7)",textTransform:"uppercase",letterSpacing:"0.07em"}}>{h}</div>)}
                </div>
                {clients.slice(0,6).map(c=><DRow key={c.id} c={c}/>)}
                {clients.length===0&&<div style={{textAlign:"center",padding:"28px",color:"rgba(255,255,255,0.3)"}}>{t("Sin clientes aún — escanea un pasaporte para empezar 📷","No clients yet — scan a passport to start 📷")}</div>}
              </div>
            </>}
            {section==="clients"&&<>
              <div style={css.secHeader}>
                <div style={css.secTitle}>{t("Todos los clientes","All clients")} <span style={{color:"rgba(255,255,255,0.3)",fontWeight:400}}>({filtered.length})</span></div>
                <input style={css.searchBar} placeholder={t("Buscar...","Search...")} value={search} onChange={e=>setSearch(e.target.value)}/>
                <select style={css.filterSel} value={filterType} onChange={e=>setFilterType(e.target.value)}><option value="">{t("Tipos","Types")}</option><option value="permiso">{t("Permiso","Permit")}</option><option value="residencia">{t("Residencia","Residency")}</option><option value="contabilidad">{t("Contabilidad","Accounting")}</option></select>
                <select style={css.filterSel} value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}><option value="">{t("Todos","All")}</option><option value="proceso">{t("Proceso","Process")}</option><option value="pendiente">{t("Pendiente","Pending")}</option><option value="aprobado">{t("Aprobado","Approved")}</option><option value="rechazado">{t("Rechazado","Rejected")}</option></select>
              </div>
              <div>{filtered.map(c=><ClientCard key={c.id} c={c}/>)}</div>
            </>}
            {section==="payments"&&<>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14,marginBottom:20}}>
                {[{label:t("Total facturado","Billed"),value:`ANG ${totalBilled}`,color:"#c084fc"},{label:t("Cobrado","Collected"),value:`ANG ${totalPaid}`,color:"#4ade80"},{label:t("Por cobrar","Outstanding"),value:`ANG ${totalDebt}`,color:"#f87171"}].map((s,i)=>(
                  <div key={i} style={{...css.card,borderColor:s.color+"33"}}><div style={css.statLabel}>{s.label}</div><div style={{...css.statValue,color:s.color,fontSize:22}}>{s.value}</div></div>
                ))}
              </div>
              <div>{[...clients].sort((a,b)=>((b.total||0)-(b.paid||0))-((a.total||0)-(a.paid||0))).map(c=><ClientCard key={c.id} c={c}/>)}</div>
            </>}
            {section==="alerts"&&<>
              <div style={css.secTitle}>{t("Alertas","Alerts")}</div>
              <div style={{marginTop:14,display:"flex",flexDirection:"column",gap:10}}>
                {notifs.length===0?<div style={{textAlign:"center",padding:"40px",color:"rgba(255,255,255,0.3)"}}>✅ {t("Sin alertas","No alerts")}</div>:notifs.map((n,i)=>(
                  <div key={i} style={{...css.card,borderColor:n.urgent?"rgba(248,113,113,0.3)":"rgba(251,191,36,0.2)",display:"flex",gap:12,cursor:"pointer"}} onClick={()=>n.client&&setClientModal(n.client)}>
                    <div style={{fontSize:20}}>{n.icon}</div>
                    <div style={{flex:1}}><div style={{fontWeight:600,fontSize:13}}>{n.title}</div><div style={{fontSize:12,color:"rgba(255,255,255,0.4)",marginTop:2}}>{n.sub}</div></div>
                    {n.date&&<div style={{fontSize:11,color:"rgba(255,255,255,0.3)"}}>{new Date(n.date).toLocaleDateString("es")}</div>}
                  </div>
                ))}
              </div>
            </>}
          </div>
        </div>
        {showAI&&<div style={css.aiPanel}>{AI_PANEL}</div>}
      </div>

      {/* ── MOBILE ── */}
      <div className="mob" style={{flexDirection:"column",flex:1,paddingBottom:65}}>
        <div style={{...css.topbar,justifyContent:"space-between"}}>
          <div style={css.logoTitle}>CuraManage</div>
          <div style={{display:"flex",gap:8}}>
            {loading&&<span style={{fontSize:11,color:"rgba(192,132,252,0.5)",animation:"glow 1s infinite"}}>⟳</span>}
            <button style={{...css.btnGhost,background:"rgba(245,158,11,0.1)",color:"#f59e0b",border:"1px solid rgba(245,158,11,0.3)",padding:"7px 10px"}} onClick={openPassportScanner}>📷</button>
            <button style={css.btnGhost} onClick={openAdd}>+</button>
            <button style={css.btnPrimary} onClick={()=>setShowAI(!showAI)}>✦</button>
          </div>
        </div>
        <div style={css.content}>
          {section==="dashboard"&&<>
            <div style={css.statsGrid}>
              {[{label:t("Clientes","Clients"),value:clients.length,color:"#c084fc"},{label:t("Por cobrar","Outstanding"),value:`ANG ${totalDebt}`,color:"#fb923c"},{label:t("En proceso","In process"),value:clients.filter(c=>c.status==="proceso").length,color:"#38bdf8"},{label:t("Vencen pronto","Expiring"),value:expiring,color:"#f87171"}].map((s,i)=>(
                <div key={i} style={{...css.card,borderColor:s.color+"33",padding:"12px 14px"}}><div style={{fontSize:10,color:"rgba(255,255,255,0.4)",textTransform:"uppercase"}}>{s.label}</div><div style={{fontFamily:"'Syne',system-ui,sans-serif",fontSize:20,fontWeight:800,color:s.color,marginTop:3}}>{s.value}</div></div>
              ))}
            </div>
            <div style={css.secHeader}>
              <div style={css.secTitle}>{t("Recientes","Recent")}</div>
              <button style={{...css.btnGhost,marginLeft:"auto",fontSize:11}} onClick={()=>setSection("clients")}>{t("Todos →","All →")}</button>
            </div>
            {clients.slice(0,4).map(c=><ClientCard key={c.id} c={c}/>)}
          </>}
          {section==="clients"&&<>
            <div style={{display:"flex",gap:8,marginBottom:10}}>
              <input style={{...css.searchBar,flex:1}} placeholder={t("Buscar...","Search...")} value={search} onChange={e=>setSearch(e.target.value)}/>
            </div>
            <div style={{display:"flex",gap:8,marginBottom:14}}>
              <select style={{...css.filterSel,flex:1}} value={filterType} onChange={e=>setFilterType(e.target.value)}><option value="">{t("Tipos","Types")}</option><option value="permiso">{t("Permiso","Permit")}</option><option value="residencia">Residencia</option><option value="contabilidad">Contabilidad</option></select>
              <select style={{...css.filterSel,flex:1}} value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}><option value="">{t("Todos","All")}</option><option value="proceso">Proceso</option><option value="pendiente">Pendiente</option><option value="aprobado">Aprobado</option><option value="rechazado">Rechazado</option></select>
            </div>
            {filtered.map(c=><ClientCard key={c.id} c={c}/>)}
          </>}
          {section==="payments"&&<>
            <div style={css.statsGrid}>
              {[{label:t("Facturado","Billed"),value:`ANG ${totalBilled}`,color:"#c084fc"},{label:t("Cobrado","Collected"),value:`ANG ${totalPaid}`,color:"#4ade80"}].map((s,i)=>(
                <div key={i} style={{...css.card,borderColor:s.color+"33",padding:"12px 14px"}}><div style={{fontSize:10,color:"rgba(255,255,255,0.4)",textTransform:"uppercase"}}>{s.label}</div><div style={{fontFamily:"'Syne',system-ui,sans-serif",fontSize:18,fontWeight:800,color:s.color,marginTop:3}}>{s.value}</div></div>
              ))}
              <div style={{...css.card,borderColor:"#f87171"+"33",padding:"12px 14px",gridColumn:"1/-1"}}><div style={{fontSize:10,color:"rgba(255,255,255,0.4)",textTransform:"uppercase"}}>{t("Por cobrar","Outstanding")}</div><div style={{fontFamily:"'Syne',system-ui,sans-serif",fontSize:18,fontWeight:800,color:"#f87171",marginTop:3}}>ANG {totalDebt}</div></div>
            </div>
            {[...clients].sort((a,b)=>((b.total||0)-(b.paid||0))-((a.total||0)-(a.paid||0))).map(c=><ClientCard key={c.id} c={c}/>)}
          </>}
          {section==="alerts"&&<>
            {notifs.length===0?<div style={{textAlign:"center",padding:"40px",color:"rgba(255,255,255,0.3)"}}>✅ {t("Sin alertas","No alerts")}</div>:notifs.map((n,i)=>(
              <div key={i} style={{...css.card,borderColor:n.urgent?"rgba(248,113,113,0.3)":"rgba(251,191,36,0.2)",display:"flex",gap:12,marginBottom:10,cursor:"pointer"}} onClick={()=>n.client&&setClientModal(n.client)}>
                <div style={{fontSize:20}}>{n.icon}</div>
                <div><div style={{fontWeight:600,fontSize:13}}>{n.title}</div><div style={{fontSize:12,color:"rgba(255,255,255,0.4)",marginTop:2}}>{n.sub}</div></div>
              </div>
            ))}
          </>}
        </div>
        <nav style={css.mobileNav}>
          {[{key:"dashboard",icon:"⬡",es:"Panel",en:"Home"},{key:"clients",icon:"◈",es:"Clientes",en:"Clients"},{key:"payments",icon:"◇",es:"Pagos",en:"Payments"},{key:"alerts",icon:"◻",es:"Alertas",en:"Alerts",badge:notifs.filter(n=>n.urgent).length}].map(item=>(
            <button key={item.key} style={css.mobileNavItem(section===item.key)} onClick={()=>setSection(item.key)}>
              <span style={{fontSize:20}}>{item.icon}</span>
              <span>{t(item.es,item.en)}</span>
              {item.badge?<span style={{...css.navBadge,position:"absolute",top:6,right:"20%",fontSize:9,padding:"1px 5px"}}>{item.badge}</span>:null}
            </button>
          ))}
          <button style={css.mobileNavItem(false)} onClick={()=>setShowAI(!showAI)}>
            <span style={{fontSize:20}}>✦</span><span>IA</span>
          </button>
        </nav>
        {showAI&&<div style={css.aiDrawer}>{AI_PANEL}</div>}
      </div>

      {/* ── PASSPORT SCANNER MODAL ── */}
      {passportModal&&(
        <div style={css.overlay} onClick={e=>{if(e.target===e.currentTarget)closePassportModal();}}>
          <div style={{...css.modal,maxHeight:"95vh"}} onClick={e=>e.stopPropagation()}>
            <div style={css.modalHead}>
              <div>
                <div style={css.modalTitle}>📷 {t("Escanear pasaporte","Scan passport")}</div>
                <div style={{fontSize:11,color:"rgba(255,255,255,0.35)",marginTop:2}}>{t("Toma foto o sube imagen del pasaporte","Take photo or upload passport image")}</div>
              </div>
              <button style={css.modalClose} onClick={closePassportModal}>×</button>
            </div>
            <div style={{padding:"20px"}}>
              {!passportPreview && !cameraMode && (
                <div>
                  {/* Options */}
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:20}}>
                    <button style={{...css.card,border:"2px dashed rgba(245,158,11,0.4)",background:"rgba(245,158,11,0.05)",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:10,padding:"24px 16px",borderRadius:14}} onClick={startCamera}>
                      <span style={{fontSize:36}}>📷</span>
                      <div style={{fontWeight:600,fontSize:14}}>{t("Tomar foto","Take photo")}</div>
                      <div style={{fontSize:11,color:"rgba(255,255,255,0.4)",textAlign:"center"}}>{t("Usa la cámara de tu dispositivo","Use device camera")}</div>
                    </button>
                    <button style={{...css.card,border:"2px dashed rgba(99,102,241,0.4)",background:"rgba(99,102,241,0.05)",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:10,padding:"24px 16px",borderRadius:14}} onClick={()=>passportFileRef.current?.click()}>
                      <span style={{fontSize:36}}>🗂️</span>
                      <div style={{fontWeight:600,fontSize:14}}>{t("Subir archivo","Upload file")}</div>
                      <div style={{fontSize:11,color:"rgba(255,255,255,0.4)",textAlign:"center"}}>{t("JPG, PNG o PDF del pasaporte","JPG, PNG or PDF of passport")}</div>
                    </button>
                  </div>
                  <input ref={passportFileRef} type="file" accept="image/*,.pdf" style={{display:"none"}} onChange={handlePassportFile}/>
                  <input ref={cameraFileRef} type="file" accept="image/*" capture="environment" style={{display:"none"}} onChange={handlePassportFile}/>
                  <div style={{...css.card,padding:"14px 16px",background:"rgba(99,102,241,0.05)"}}>
                    <div style={{fontSize:12,color:"rgba(192,132,252,0.8)",fontWeight:600,marginBottom:6}}>💡 {t("Consejos para mejor resultado","Tips for best result")}</div>
                    <div style={{fontSize:12,color:"rgba(255,255,255,0.5)",lineHeight:1.6}}>
                      • {t("Asegúrate que el pasaporte esté bien iluminado","Make sure the passport is well lit")}<br/>
                      • {t("Captura la página con la foto y datos","Capture the page with photo and data")}<br/>
                      • {t("Evita reflejos y sombras","Avoid reflections and shadows")}
                    </div>
                  </div>
                </div>
              )}

              {/* Camera view */}
              {cameraMode && !passportPreview && (
                <div>
                  <div style={{position:"relative",borderRadius:14,overflow:"hidden",background:"#000",marginBottom:14}}>
                    <video ref={videoRef} style={{width:"100%",display:"block",maxHeight:"50vh",objectFit:"cover"}} playsInline muted/>
                    {/* Passport overlay guide */}
                    <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",pointerEvents:"none"}}>
                      <div style={{width:"85%",height:"60%",border:"2px solid rgba(245,158,11,0.8)",borderRadius:8,boxShadow:"0 0 0 1000px rgba(0,0,0,0.4)"}}/>
                    </div>
                    <div style={{position:"absolute",bottom:8,left:0,right:0,textAlign:"center",fontSize:12,color:"rgba(255,255,255,0.7)"}}>
                      {t("Alinea el pasaporte dentro del marco","Align passport within frame")}
                    </div>
                  </div>
                  <canvas ref={canvasRef} style={{display:"none"}}/>
                  <div style={{display:"flex",gap:10}}>
                    <button style={{...css.btnGhost,flex:1}} onClick={stopCamera}>{t("Cancelar","Cancel")}</button>
                    <button style={{...css.btnScan,flex:2,justifyContent:"center"}} onClick={capturePhoto}>
                      <span style={{fontSize:18}}>📸</span> {t("Capturar","Capture")}
                    </button>
                  </div>
                </div>
              )}

              {/* Preview & scan */}
              {passportPreview && (
                <div>
                  <div style={{position:"relative",marginBottom:16}}>
                    <img src={passportPreview} alt="Passport" style={{width:"100%",borderRadius:12,border:"1px solid rgba(99,102,241,0.3)",maxHeight:"45vh",objectFit:"contain",background:"#000"}}/>
                    <button style={{position:"absolute",top:8,right:8,...css.btnGhost,padding:"4px 8px",fontSize:12}} onClick={()=>{setPassportPreview(null);setCameraMode(false);}}>✕</button>
                  </div>
                  {passportScanning?(
                    <div style={{...css.card,textAlign:"center",padding:"20px",background:"rgba(99,102,241,0.08)"}}>
                      <div style={{fontSize:24,marginBottom:8,animation:"spin 1s linear infinite",display:"inline-block"}}>⟳</div>
                      <div style={{fontWeight:600,fontSize:14,color:"#c084fc"}}>{t("Extrayendo datos del pasaporte...","Extracting passport data...")}</div>
                      <div style={{fontSize:12,color:"rgba(255,255,255,0.4)",marginTop:4}}>{t("La IA está leyendo la información","AI is reading the information")}</div>
                    </div>
                  ):(
                    <div style={{display:"flex",gap:10}}>
                      <button style={{...css.btnGhost,flex:1}} onClick={()=>setPassportPreview(null)}>{t("Retomar","Retake")}</button>
                      <button style={{...css.btnScan,flex:2,justifyContent:"center"}} onClick={scanPassport}>
                        <span>✦</span> {t("Extraer datos con IA","Extract data with AI")}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── CLIENT FOLDER MODAL ── */}
      {clientModal&&(
        <div style={css.overlay} onClick={e=>{if(e.target===e.currentTarget)setClientModal(null);}}>
          <div style={css.modal} onClick={e=>e.stopPropagation()}>
            <div style={css.modalHead}>
              <div>
                <div style={css.modalTitle}>📁 {clientModal.name}</div>
                <div style={{fontSize:11,color:"rgba(255,255,255,0.35)",marginTop:2}}>{clientModal.client_id} · <span style={{...css.badge(TYPE_CFG[clientModal.type]||{color:"#888",bg:"#222"})}}>{TYPE_CFG[clientModal.type]?.label||clientModal.type}</span></div>
              </div>
              <div style={{marginLeft:"auto",display:"flex",gap:6}}>
                <button style={css.btnSuccess} onClick={()=>exportToPDF(clientModal,lang)}>⬇</button>
                <button style={css.btnGhost} onClick={()=>{setClientModal(null);openGmail(clientModal);}}>✉</button>
                <button style={css.modalClose} onClick={()=>setClientModal(null)}>×</button>
              </div>
            </div>
            <div style={css.modalBody}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
                {[{label:t("Teléfono","Phone"),value:clientModal.phone},{label:t("Nacionalidad","Nationality"),value:clientModal.nationality},{label:t("Nacimiento","Birthday"),value:clientModal.birthdate},{label:t("Pasaporte","Passport"),value:clientModal.passport},{label:t("Entrada Curaçao","Entry Curaçao"),value:clientModal.entry_date},{label:"Email",value:clientModal.email},{label:t("Dirección","Address"),value:clientModal.address,full:true},{label:t("Emergencia","Emergency"),value:clientModal.emergency_contact,full:true}].map((f,i)=>(
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
            <div style={css.modalFoot}>
              <button style={css.btnGhost} onClick={()=>{setClientModal(null);askAbout(clientModal);}}>✦ IA</button>
              <button style={css.btnPrimary} onClick={()=>{setClientModal(null);openEdit(clientModal);}}>✎ {t("Editar","Edit")}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── FORM MODAL ── */}
      {modal && FORM_MODAL}

      {toast&&<div style={css.toast(toast.ok)}>{toast.ok?"✓":"✕"} {toast.msg}</div>}
    </div>
  );
}
