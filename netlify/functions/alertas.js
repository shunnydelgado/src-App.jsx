const SUPABASE_URL = "https://tfatwczcufvmthuolfjv.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || "sb_publishable_-S2VtEoXw1lbuSXROU4_jw_Q2JDABWP";
const RESEND_KEY = process.env.RESEND_API_KEY;

const RECIPIENTS = [
  { email: "ramiro.olbina@gmail.com", name: "Ramiro", whatsapp: "59995407070" },
  { email: "shunny.delgado@outlook.com", name: "Shunny", whatsapp: "59995162424" },
];

function formatDate(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("es", { day: "2-digit", month: "long", year: "numeric" });
}

function diffDays(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  d.setHours(0,0,0,0);
  const today = new Date();
  today.setHours(0,0,0,0);
  return Math.round((d - today) / 86400000);
}

function waLink(phone, message) {
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

function buildEmailHTML(titulo, alertas, color, recipientName, recipientWa) {
  const rows = alertas.map(a => {
    const waMsg = `🔔 *CuraManage* — ${titulo}\n\n👤 *Cliente:* ${a.cliente}\n📋 ${a.mensaje}\n\nhttps://curamanage.netlify.app`;
    const waUrl = waLink(recipientWa, waMsg);
    return `
    <tr>
      <td style="padding:14px 16px;border-bottom:1px solid #f0f0f0">
        <div style="font-weight:600;color:#1a1a1a;margin-bottom:4px">${a.cliente}</div>
        <div style="font-size:13px;color:#555;line-height:1.5;margin-bottom:10px">${a.mensaje}</div>
        <a href="${waUrl}" style="display:inline-block;background:#25D366;color:#fff;text-decoration:none;padding:6px 14px;border-radius:20px;font-size:12px;font-weight:600">
          💬 Abrir en WhatsApp
        </a>
      </td>
      <td style="padding:14px 16px;border-bottom:1px solid #f0f0f0;text-align:right;vertical-align:top;white-space:nowrap">
        <span style="background:${a.urgente?"#fef2f2":"#fefce8"};color:${a.urgente?"#dc2626":"#ca8a04"};padding:3px 10px;border-radius:20px;font-size:12px;font-weight:600">${a.etiqueta}</span>
      </td>
    </tr>`;
  }).join("");

  const allWaMsg = `🔔 *CuraManage* — ${titulo}\n\n${alertas.map(a=>`👤 ${a.cliente}: ${a.mensaje}`).join("\n\n")}\n\nhttps://curamanage.netlify.app`;
  const allWaUrl = waLink(recipientWa, allWaMsg);

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;background:#f8f8f8;margin:0;padding:20px">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
  <div style="background:linear-gradient(135deg,${color},#8b5cf6);padding:24px 28px">
    <div style="font-size:20px;font-weight:800;color:#fff">CuraManage</div>
    <div style="font-size:12px;color:rgba(255,255,255,0.7);margin-top:2px;text-transform:uppercase;letter-spacing:1px">Curaçao · Gestión Integral</div>
  </div>
  <div style="padding:24px 28px">
    <p style="color:#333;font-size:15px;margin-bottom:4px">Hola ${recipientName},</p>
    <h2 style="color:#1a1a1a;font-size:18px;margin:0 0 16px">${titulo}</h2>
    <table style="width:100%;border-collapse:collapse;border:1px solid #f0f0f0;border-radius:8px;overflow:hidden">
      <thead>
        <tr style="background:#f8f8ff">
          <th style="padding:10px 16px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:${color}">Cliente / Acción</th>
          <th style="padding:10px 16px;text-align:right;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:${color}">Estado</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <div style="margin-top:20px;display:flex;gap:12px;flex-wrap:wrap">
      <a href="https://curamanage.netlify.app" style="display:inline-block;background:${color};color:#fff;text-decoration:none;padding:10px 20px;border-radius:10px;font-size:13px;font-weight:600">
        Abrir CuraManage
      </a>
      <a href="${allWaUrl}" style="display:inline-block;background:#25D366;color:#fff;text-decoration:none;padding:10px 20px;border-radius:10px;font-size:13px;font-weight:600">
        💬 Enviar resumen por WhatsApp
      </a>
    </div>
  </div>
  <div style="padding:14px 28px;background:#f8f8f8;text-align:center;font-size:11px;color:#999;border-top:1px solid #eee">
    CuraManage · Curaçao · ${new Date().getFullYear()} · Alerta automática diaria
  </div>
</div>
</body></html>`;
}

async function sendEmail(recipient, subject, html) {
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "CuraManage Alertas <onboarding@resend.dev>",
        to: [recipient.email],
        subject,
        html,
      }),
    });
    const data = await res.json();
    console.log(`Email → ${recipient.email}:`, data.id || JSON.stringify(data));
  } catch(e) {
    console.error(`Error → ${recipient.email}:`, e.message);
  }
}

async function broadcastEmail(subject, alertas, titulo, color) {
  for (const r of RECIPIENTS) {
    const html = buildEmailHTML(titulo, alertas, color, r.name, r.whatsapp);
    await sendEmail(r, subject, html);
  }
}

exports.handler = async function(event) {
  try {
    console.log("Daily alerts — " + new Date().toISOString());

    const res = await fetch(`${SUPABASE_URL}/rest/v1/clients?select=*`, {
      headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}` }
    });
    const clients = await res.json();
    console.log(`${clients.length} clients`);

    const today = new Date();
    const dayOfMonth = today.getDate();

    const alertasCopy = [];
    const alertasAprobacion = [];
    const alertasOB = [];

    for (const c of clients) {
      if (c.status === "rechazado") continue;

      // Copy cliente — 7 days window
      if (c.fecha_tentativa_copy && !c.fecha_copy_cliente) {
        const days = diffDays(c.fecha_tentativa_copy);
        if (days !== null && days <= 7) {
          alertasCopy.push({
            cliente: `${c.name} (${c.client_id})`,
            mensaje: days < 0
              ? `⚠️ Vencida hace ${Math.abs(days)} día(s). Fecha tentativa: ${formatDate(c.fecha_tentativa_copy)}`
              : days === 0 ? `🔔 HOY es la fecha tentativa del copy cliente`
              : `🎯 En ${days} día(s) — ${formatDate(c.fecha_tentativa_copy)}`,
            etiqueta: days < 0 ? `${Math.abs(days)}d vencida` : days === 0 ? "HOY" : `en ${days}d`,
            urgente: days <= 0,
          });
        }
      }

      // Aprobación — 14 days window
      if (c.fecha_tentativa_aprobacion && c.fecha_copy_cliente && c.status !== "aprobado") {
        const days = diffDays(c.fecha_tentativa_aprobacion);
        if (days !== null && days <= 14) {
          alertasAprobacion.push({
            cliente: `${c.name} (${c.client_id})`,
            mensaje: days < 0
              ? `⚠️ Vencida hace ${Math.abs(days)} día(s). Fecha tentativa: ${formatDate(c.fecha_tentativa_aprobacion)}`
              : days === 0 ? `🔔 HOY es la fecha tentativa de aprobación`
              : `🎯 En ${days} día(s) — ${formatDate(c.fecha_tentativa_aprobacion)}`,
            etiqueta: days < 0 ? `${Math.abs(days)}d vencida` : days === 0 ? "HOY" : `en ${days}d`,
            urgente: days <= 0,
          });
        }
      }

      // OB — día 14 de cada mes
      if (c.declaracion_ob && dayOfMonth === 14) {
        alertasOB.push({
          cliente: `${c.name} (${c.client_id})`,
          mensaje: c.ob_mensaje || `Realizar declaración OB mensual.`,
          etiqueta: "Día 14",
          urgente: true,
        });
      }
    }

    console.log(`Copy:${alertasCopy.length} Apro:${alertasAprobacion.length} OB:${alertasOB.length}`);

    if (alertasCopy.length > 0)
      await broadcastEmail("CuraManage — Revisión copy cliente", alertasCopy, "🎯 Copy cliente pendiente", "#6366f1");

    if (alertasAprobacion.length > 0)
      await broadcastEmail("CuraManage — Seguimiento aprobación", alertasAprobacion, "📋 Seguimiento aprobación permiso", "#8b5cf6");

    if (alertasOB.length > 0)
      await broadcastEmail("CuraManage — Declaraciones OB del mes", alertasOB, "📊 Declaraciones OB — Día 14", "#f59e0b");

    return {
      statusCode: 200,
      body: JSON.stringify({ copy: alertasCopy.length, aprobacion: alertasAprobacion.length, ob: alertasOB.length }),
    };

  } catch(err) {
    console.error("Error:", err.message);
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
