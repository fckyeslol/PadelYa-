const { chromium } = require("playwright");

// ── Brand system ────────────────────────────────────────────────────────────
const INK = "#0C0B08";
const LIME = "#E9FF47";
const BONE = "#F5F3EC";
const MUTE = "#7d776b";

// Fine film grain (real texture, no glow). feTurbulence -> data URI.
const GRAIN = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='220'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='220' height='220' filter='url(%23n)'/%3E%3C/svg%3E")`;

// Top-down padel court blueprint (thin precise lines).
function court(stroke, w = 360) {
  return `<svg width="${w}" viewBox="0 0 300 200" fill="none" stroke="${stroke}" stroke-width="2" style="display:block">
    <rect x="3" y="3" width="294" height="194" rx="3"/>
    <line x1="150" y1="3" x2="150" y2="197" stroke-width="3"/>
    <line x1="3" y1="58" x2="297" y2="58" stroke-width="1.6"/>
    <line x1="3" y1="142" x2="297" y2="142" stroke-width="1.6"/>
    <line x1="150" y1="58" x2="150" y2="142" stroke-width="1.6"/>
  </svg>`;
}

// Padel ball with the signature curved seam.
function ball(fill, seam, size = 130) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 100 100">
    <circle cx="50" cy="50" r="48" fill="${fill}"/>
    <path d="M22 14 C 44 36, 44 64, 22 86" fill="none" stroke="${seam}" stroke-width="3.5"/>
    <path d="M78 14 C 56 36, 56 64, 78 86" fill="none" stroke="${seam}" stroke-width="3.5"/>
  </svg>`;
}

function wordmark(darkBg) {
  const base = darkBg ? BONE : INK;
  const acc = darkBg ? LIME : INK;
  return `<div style="font-family:'Barlow Condensed';font-weight:900;font-size:34px;letter-spacing:0.01em;text-transform:uppercase;line-height:1;color:${base}">PADEL<span style="color:${acc}">YA!</span></div>`;
}

function kicker(text, darkBg) {
  const col = darkBg ? LIME : INK;
  return `<div style="font-family:'DM Mono',monospace;font-weight:500;font-size:17px;letter-spacing:0.28em;text-transform:uppercase;color:${col};display:flex;align-items:center;gap:10px">
    <span style="width:9px;height:9px;border-radius:50%;background:${col};display:inline-block"></span>${text}</div>`;
}

const FRAME = (inner, bg) => `
<div style="width:1200px;height:628px;background:${bg};position:relative;overflow:hidden;font-family:'Barlow Condensed',sans-serif">
  ${inner}
  <div style="position:absolute;inset:0;background:${GRAIN};background-size:440px 440px;opacity:0.10;mix-blend-mode:overlay;pointer-events:none"></div>
</div>`;

// ── Banner 1 · partido_creado (dark, court blueprint) ───────────────────────
const b1 = FRAME(`
  <div style="position:absolute;right:-70px;bottom:-46px;opacity:0.13">${court(BONE, 620)}</div>
  <div style="position:absolute;top:64px;left:74px;right:74px;display:flex;justify-content:space-between;align-items:center">
    ${wordmark(true)} ${kicker("Publicado", true)}
  </div>
  <div style="position:absolute;left:74px;bottom:96px">
    <div style="font-family:'DM Mono',monospace;font-size:19px;letter-spacing:0.2em;text-transform:uppercase;color:${MUTE};margin-bottom:10px">Tu partido está listo</div>
    <div style="font-weight:900;font-size:158px;line-height:0.8;letter-spacing:-0.03em;text-transform:uppercase;color:${BONE}">PARTIDO<br><span style="color:${LIME}">PUBLICADO</span></div>
  </div>
  <div style="position:absolute;left:74px;bottom:64px;width:0;height:0"></div>
`, INK);

// ── Banner 2 · nuevo_partido (INVERTED lime bg, marketing) ──────────────────
const b2 = FRAME(`
  <div style="position:absolute;right:-60px;top:-60px;opacity:0.16">${court(INK, 560)}</div>
  <div style="position:absolute;right:90px;bottom:80px">${ball(INK, LIME, 188)}</div>
  <div style="position:absolute;top:64px;left:74px;right:74px;display:flex;justify-content:space-between;align-items:center">
    ${wordmark(false)} ${kicker("Juega hoy", false)}
  </div>
  <div style="position:absolute;left:74px;bottom:92px">
    <div style="font-family:'DM Mono',monospace;font-size:19px;letter-spacing:0.2em;text-transform:uppercase;color:rgba(12,11,8,0.6);margin-bottom:10px">Hay cupo en Barranquilla</div>
    <div style="font-weight:900;font-size:168px;line-height:0.78;letter-spacing:-0.03em;text-transform:uppercase;color:${INK}">NUEVO<br>PARTIDO</div>
  </div>
`, LIME);

// ── Banner 3 · jugador_unido (dark, roster filling + "+1") ──────────────────
function slot(filled, plus) {
  if (plus)
    return `<div style="width:74px;height:74px;border-radius:50%;background:${LIME};display:flex;align-items:center;justify-content:center;font-family:'Barlow Condensed';font-weight:900;font-size:40px;color:${INK}">+1</div>`;
  if (filled)
    return `<div style="width:74px;height:74px;border-radius:50%;background:${LIME}"></div>`;
  return `<div style="width:74px;height:74px;border-radius:50%;border:3px dashed ${MUTE};box-sizing:border-box"></div>`;
}
const b3 = FRAME(`
  <div style="position:absolute;left:-80px;bottom:-50px;opacity:0.11">${court(BONE, 560)}</div>
  <div style="position:absolute;top:64px;left:74px;right:74px;display:flex;justify-content:space-between;align-items:center">
    ${wordmark(true)} ${kicker("Se suma", true)}
  </div>
  <div style="position:absolute;left:74px;top:188px;display:flex;gap:18px">
    ${slot(true)}${slot(true)}${slot(true)}${slot(false, true)}
  </div>
  <div style="position:absolute;left:74px;bottom:90px">
    <div style="font-weight:900;font-size:128px;line-height:0.8;letter-spacing:-0.03em;text-transform:uppercase;color:${BONE}">SE SUMÓ<br><span style="color:${LIME}">UN JUGADOR</span></div>
  </div>
`, INK);

// ── Banner 4 · partido_lleno (dark, scoreboard 4/4) ─────────────────────────
const b4 = FRAME(`
  <div style="position:absolute;right:-70px;top:-40px;opacity:0.12">${court(BONE, 560)}</div>
  <div style="position:absolute;top:64px;left:74px;right:74px;display:flex;justify-content:space-between;align-items:center">
    ${wordmark(true)} ${kicker("Completo", true)}
  </div>
  <div style="position:absolute;right:96px;top:200px;display:flex;flex-direction:column;align-items:center">
    <div style="font-weight:900;font-size:240px;line-height:0.74;letter-spacing:-0.04em;color:${LIME};font-variant-numeric:tabular-nums">4/4</div>
    <div style="display:flex;gap:14px;margin-top:18px">
      ${[0,0,0,0].map(()=>`<span style="width:30px;height:30px;border-radius:50%;background:${LIME}"></span>`).join("")}
    </div>
  </div>
  <div style="position:absolute;left:74px;bottom:96px">
    <div style="font-family:'DM Mono',monospace;font-size:19px;letter-spacing:0.2em;text-transform:uppercase;color:${MUTE};margin-bottom:10px">Cupos llenos</div>
    <div style="font-weight:900;font-size:150px;line-height:0.8;letter-spacing:-0.03em;text-transform:uppercase;color:${BONE}">PARTIDO<br>COMPLETO</div>
  </div>
`, INK);

const BANNERS = [
  ["wa-partido-creado", b1],
  ["wa-nuevo-partido", b2],
  ["wa-jugador-unido", b3],
  ["wa-partido-lleno", b4],
];

const PAGE = (body) => `<!doctype html><html><head><meta charset="utf-8">
<style>@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;800;900&family=DM+Mono:wght@500&display=swap');
*{margin:0;padding:0;box-sizing:border-box}</style></head><body>${body}</body></html>`;

(async () => {
  const browser = await chromium.launch();
  for (const [name, html] of BANNERS) {
    const page = await browser.newPage({ viewport: { width: 1200, height: 628 }, deviceScaleFactor: 2 });
    await page.setContent(PAGE(html), { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(500);
    await page.screenshot({ path: `public/${name}.png` });
    await page.close();
    console.log("wrote public/" + name + ".png");
  }
  await browser.close();
})();
