// Netlify runs this automatically after every verified form submission.
// It sends turkey pre-orders, RestroBucks sign-ups and contact messages to the owner's Telegram
// through the CWR orders bot. Needs site env vars TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID
// (comma-separated for several phones; never committed).
// Every submission is also kept in Netlify Forms, so nothing is lost if Telegram fails.
const esc = (s) => String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
const yes = (v) => v !== undefined && v !== null && v !== "" && v !== "false";

const formats = {
  "turkey-preorder": (d) => [
    "🦃 <b>New turkey pre-order</b>",
    "",
    `👤 ${esc(d.name)}`,
    `📞 ${esc(d.phone)}`,
    d.email ? `✉️ ${esc(d.email)}` : null,
    `🍗 <b>${esc(d.legs)} leg(s)</b>, ${esc(d.estimated_total)}`,
    `📅 <b>${esc(d.pickup_day)}</b>, ${esc(d.pickup_time)}`,
    d.notes ? `📝 ${esc(d.notes)}` : null,
    "",
    "Call or text the customer to confirm.",
  ],
  restrobucks: (d) => [
    "🪙 <b>New RestroBucks member</b>",
    "",
    `👤 ${esc(d.first_name)}`,
    d.mobile ? `📞 ${esc(d.mobile)}${yes(d.sms_consent) ? " (OK to text)" : ""}` : null,
    d.email ? `✉️ ${esc(d.email)}${yes(d.email_consent) ? " (OK to email)" : ""}` : null,
    "",
    "Add them in RestroBud and credit the 200 RB$ welcome gift.",
  ],
  contact: (d) => [
    "💬 <b>New website message</b>",
    "",
    `👤 ${esc(d.name)}`,
    d.email ? `✉️ ${esc(d.email)}` : null,
    "",
    esc(d.message),
  ],
};

export const handler = async (event) => {
  const { payload } = JSON.parse(event.body || "{}");
  const format = formats[payload?.form_name];
  if (!format) return { statusCode: 200, body: "ignored" };
  const token = process.env.TELEGRAM_BOT_TOKEN, chats = (process.env.TELEGRAM_CHAT_ID || "").split(",").filter(Boolean);
  if (!token || !chats.length) {
    console.error("TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID not set; submission saved in Netlify Forms only");
    return { statusCode: 200, body: "no telegram config" };
  }
  const text = format(payload.data || {}).filter((l) => l !== null).join("\n").slice(0, 4000);

  for (const chat_id of chats) {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id, text, parse_mode: "HTML", disable_web_page_preview: true }),
    });
    if (!r.ok) console.error("telegram send failed", r.status, await r.text());
  }
  console.log("sent to telegram:", payload.form_name);
  return { statusCode: 200, body: "sent" };
};
