// FLEXIN order relay: website -> /api/order -> Telegram message on the owner's phone.
// Secrets (set in Cloudflare dashboard, never in code): TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
const PRODUCTS = {                       // keep in sync with CONFIG in index.html
  bat:    { name: "Bat T-shirt",    price: 220 },
  spider: { name: "Spider T-shirt", price: 220 }
};
const SIZES = ["S", "M", "L", "XL"];
const clean = (v, n) => String(v ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, n);

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname !== "/api/order") return env.ASSETS.fetch(req);
    if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

    let o;
    try { o = await req.json(); } catch { return json({ ok: false, error: "bad json" }, 400); }

    const phone = clean(o.phone, 14);
    const items = Array.isArray(o.items) ? o.items.slice(0, 20) : [];
    if (!/^01[0-9]{9}$/.test(phone) || !items.length) return json({ ok: false, error: "invalid" }, 400);

    let total = 0;
    const lines = [];
    for (const it of items) {
      const p = PRODUCTS[it.id];
      const qty = Math.min(Math.max(parseInt(it.qty, 10) || 0, 0), 20);
      if (!p || !SIZES.includes(it.size) || !qty) return json({ ok: false, error: "invalid item" }, 400);
      total += p.price * qty;
      lines.push(`• ${p.name} | مقاس ${it.size} | ×${qty} = ${p.price * qty} ج.م`);
    }

    const text = [
      `🛒 طلب جديد #${clean(o.id, 12)}`,
      "━━━━━━━━━━",
      ...lines,
      `المجموع: ${total} ج.م (+ الشحن حسب المحافظة)`,
      "",
      `👤 ${clean(o.name, 60)}`,
      `📞 ${phone}`,
      `💬 https://wa.me/20${phone.slice(1)}`,
      `📍 ${clean(o.gov, 40)}`,
      `🏠 ${clean(o.addr, 250)}`,
      "💵 الدفع عند الاستلام"
    ].join("\n");

    const r = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text, disable_web_page_preview: true })
    });
    return json({ ok: r.ok }, r.ok ? 200 : 502);
  }
};
const json = (d, status = 200) => new Response(JSON.stringify(d), { status, headers: { "content-type": "application/json" } });
