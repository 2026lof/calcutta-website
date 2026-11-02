// Netlify runs this automatically after every verified form submission.
// It sends each Tandoori Turkey Legs pre-order to the owner's Telegram through the CWR orders bot.
// Needs site env vars TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID (never committed).
// Every order is also kept in Netlify Forms (turkey-preorder), so nothing is lost if Telegram fails.
const esc = (s) => String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);

export const handler = async (event) => {
  const { payload } = JSON.parse(event.body || "{}");
  if (payload?.form_name !== "turkey-preorder") return { statusCode: 200, body: "ignored" };
  const token = process.env.TELEGRAM_BOT_TOKEN, chats = (process.env.TELEGRAM_CHAT_ID || "").split(",").filter(Boolean);
  if (!token || !chats.length) {
    console.error("TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID not set; order saved in Netlify Forms only");
    return { statusCode: 200, body: "no telegram config" };
  }
  const d = payload.data || {};
  const phoneDigits = String(d.phone || "").replace(/[^\d+]/g, "");
  const text = [
    "🦃 <b>New turkey pre-order</b>",
    "",
    `👤 ${esc(d.name)}`,
    `📞 ${esc(d.phone)}${phoneDigits ? ` (tel: ${esc(phoneDigits)})` : ""}`,
    d.email ? `✉️ ${esc(d.email)}` : null,
    `🍗 <b>${esc(d.legs)} leg(s)</b>, ${esc(d.estimated_total)}`,
    `📅 <b>${esc(d.pickup_day)}</b>, ${esc(d.pickup_time)}`,
    d.notes ? `📝 ${esc(d.notes)}` : null,
    "",
    "Call or text the customer to confirm.",
  ].filter((l) => l !== null).join("\n");

  for (const chat_id of chats) {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id, text, parse_mode: "HTML", disable_web_page_preview: true }),
    });
    if (!r.ok) console.error("telegram send failed", r.status, await r.text());
  }
  console.log("turkey order sent to telegram", d.name, d.legs);
  return { statusCode: 200, body: "sent" };
};
