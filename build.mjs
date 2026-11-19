// Builds the Guides section, the delivery page, sitemap.xml and robots.txt for calcuttawrapandroll.com.
// Netlify runs it on every deploy (netlify.toml), and a weekly build hook (Tuesdays 9 AM, from Paro)
// re-runs it so the next approved article goes live on its date without anyone pushing anything.
//
// Articles live in guides-src/*.html: a JSON header in an HTML comment, then the article body.
//   approved: false  -> never published (the owner hasn't signed off yet)
//   date             -> published on or after this day (New York time)
//   check: [...]     -> owner questions, shown only in the preview
// Preview every draft (nothing is published):  node build.mjs --preview   (writes ./preview/)
import fs from "fs";
import path from "path";

const SITE = "https://calcuttawrapandroll.com";
const ROOT = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const PREVIEW = process.argv.includes("--preview");
const OUT = PREVIEW ? path.join(ROOT, "preview") : ROOT;
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const nice = (d) => new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

function read(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith(".html")).map((f) => {
    const raw = fs.readFileSync(path.join(dir, f), "utf8");
    const m = raw.match(/^<!--\s*(\{[\s\S]*?\})\s*-->\s*/);
    if (!m) throw new Error(`${f}: missing JSON header`);
    return { ...JSON.parse(m[1]), body: raw.slice(m[0].length), file: f };
  });
}

const RESTAURANT = {
  "@type": "Restaurant", "@id": `${SITE}/#restaurant`, name: "Calcutta Wrap & Roll", url: SITE,
  telephone: "+1-914-591-2222", servesCuisine: ["Indian", "Bengali", "South Indian"], priceRange: "$$",
  address: { "@type": "PostalAddress", streetAddress: "465 Ashford Ave", addressLocality: "Ardsley", addressRegion: "NY", postalCode: "10502", addressCountry: "US" },
};

const page = ({ title, description, canonical, image, body, jsonld, noindex }) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  <link rel="canonical" href="${canonical}">
  ${noindex ? `<meta name="robots" content="noindex">` : ""}
  <meta property="og:type" content="article">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:url" content="${canonical}">
  ${image ? `<meta property="og:image" content="${SITE}/${image}">` : ""}
  <link rel="icon" href="/favicon.ico" sizes="48x48">
  <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">
  <meta name="theme-color" content="#e3120b">
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/legal.css">
  <link rel="stylesheet" href="/guides.css">
  ${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld)}</script>` : ""}
</head>
<body>
  <header>
    <div class="nav">
      <a class="brand" href="/"><img src="/images/logo.png" alt="Calcutta Wrap & Roll logo">Calcutta Wrap &amp; Roll</a>
      <span class="nav-right"><a href="/guides">Guides</a><a class="order-btn" href="/order" target="_blank" rel="noopener">Order online</a></span>
    </div>
  </header>
  <main class="guide">
${body}
  </main>
  <footer>
    <div class="foot">
      <div>© 2026 Calcutta Wrap &amp; Roll · 465 Ashford Ave, Ardsley, NY 10502 · <a href="tel:+19145912222">(914) 591-2222</a></div>
      <div><a href="/guides">Guides</a> · <a href="/delivery">Delivery area</a> · <a href="/privacy.html">Privacy</a></div>
    </div>
  </footer>
</body>
</html>
`;

const cta = `
    <aside class="cta">
      <div><strong>Hungry?</strong> Order for pickup or delivery, or call us for catering.</div>
      <div class="cta-btns"><a class="order-btn" href="/order" target="_blank" rel="noopener">Order online</a><a class="ghost-btn" href="tel:+19145912222">(914) 591-2222</a></div>
    </aside>`;

const all = read(path.join(ROOT, "guides-src"));
const live = all.filter((a) => PREVIEW || (a.approved && a.date <= today)).sort((a, b) => b.date.localeCompare(a.date));
const pages = read(path.join(ROOT, "pages-src")); // evergreen pages such as /delivery

fs.mkdirSync(path.join(OUT, "guides"), { recursive: true });
for (const a of live) {
  const url = `${SITE}/guides/${a.slug}`;
  const faq = (a.faq || []).length ? `
    <section class="faq"><h2>Questions we get a lot</h2>
${a.faq.map(([q, ans]) => `      <details><summary>${esc(q)}</summary><p>${ans}</p></details>`).join("\n")}
    </section>` : "";
  const checks = PREVIEW && (a.check || []).length ? `
    <aside class="owner-check"><strong>For the owner to confirm before this goes live${a.approved ? "" : " (draft, not approved yet)"}:</strong><ul>${a.check.map((c) => `<li>${esc(c)}</li>`).join("")}</ul></aside>` : "";
  const body = `    <p class="crumbs"><a href="/">Home</a> › <a href="/guides">Guides</a></p>${checks}
    <article>
      <h1>${esc(a.title)}</h1>
      <p class="meta">${nice(a.date)} · Calcutta Wrap &amp; Roll, Ardsley NY</p>
      ${a.image ? `<img class="hero-img" src="/${a.image}" alt="${esc(a.imageAlt || a.title)}" width="1200" height="800">` : ""}
${a.body.trim()}
    </article>${faq}${cta}`;
  const jsonld = { "@context": "https://schema.org", "@graph": [
    { "@type": "Article", headline: a.title, description: a.description, datePublished: a.date, dateModified: a.updated || a.date,
      mainEntityOfPage: url, ...(a.image && { image: `${SITE}/${a.image}` }),
      author: { "@id": `${SITE}/#restaurant` }, publisher: { "@id": `${SITE}/#restaurant` } },
    RESTAURANT,
    ...((a.faq || []).length ? [{ "@type": "FAQPage", mainEntity: a.faq.map(([q, ans]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: ans.replace(/<[^>]+>/g, "") } })) }] : []),
  ] };
  fs.writeFileSync(path.join(OUT, "guides", `${a.slug}.html`), page({ title: `${a.title} | Calcutta Wrap & Roll`, description: a.description, canonical: url, image: a.image, body, jsonld, noindex: PREVIEW }));
}

// Guides index.
const cards = live.map((a) => `      <a class="card" href="/guides/${a.slug}">${a.image ? `<img src="/${a.image}" alt="" loading="lazy">` : ""}<span class="card-date">${nice(a.date)}${PREVIEW && !a.approved ? " · DRAFT" : ""}</span><strong>${esc(a.title)}</strong><span>${esc(a.description)}</span></a>`).join("\n");
fs.writeFileSync(path.join(OUT, "guides", "index.html"), page({
  title: "Guides: Indian food, catering and takeout in Westchester | Calcutta Wrap & Roll",
  description: "Tips from our Ardsley kitchen: Indian catering, kathi rolls, dosas, vegan and gluten-free picks, and what to order for every occasion.",
  canonical: `${SITE}/guides`, noindex: PREVIEW || !live.length, // an empty index stays out of Google
  body: `    <h1>Guides from our kitchen</h1>
    <p class="lead">Cooking Calcutta street food and Indian classics in Ardsley since 2010. Here's what we've learned about ordering well, feeding a crowd and finding your new favorite dish.</p>
    <div class="cards">
${cards || "      <p>New guides are on the way.</p>"}
    </div>${cta}`,
  jsonld: { "@context": "https://schema.org", ...RESTAURANT },
}));

// Evergreen pages (e.g. pages-src/delivery.html -> /delivery).
for (const p of pages) {
  fs.writeFileSync(path.join(OUT, `${p.slug}.html`), page({ title: p.title, description: p.description, canonical: `${SITE}/${p.slug}`, image: p.image, noindex: PREVIEW,
    body: `    <article>\n      <h1>${esc(p.h1 || p.title)}</h1>\n${p.body.trim()}\n    </article>${cta}`,
    jsonld: { "@context": "https://schema.org", ...RESTAURANT, ...(p.jsonld || {}) } }));
}

if (!PREVIEW) {
  const urls = [["/", today], ...(live.length ? [["/guides", live[0].date]] : []), ...pages.map((p) => [`/${p.slug}`, p.updated || today]),
    ["/turkey", "2026-11-02"], ...live.map((a) => [`/guides/${a.slug}`, a.updated || a.date])];
  fs.writeFileSync(path.join(OUT, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(([u, d]) => `  <url><loc>${SITE}${u === "/" ? "/" : u}</loc><lastmod>${d}</lastmod></url>`).join("\n")}
</urlset>
`);
  fs.writeFileSync(path.join(OUT, "robots.txt"), `User-agent: *\nAllow: /\nDisallow: /preview/\n\nSitemap: ${SITE}/sitemap.xml\n`);
}
console.log(`${PREVIEW ? "PREVIEW" : "Built"}: ${live.length} guide(s) of ${all.length}, ${pages.length} page(s); today ${today}`);
