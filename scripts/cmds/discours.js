const { createCanvas, loadImage } = require("canvas");
const fs = require("fs-extra");
const path = require("path");

const NAME = "discours";
const DEST = "1617474426499626";
const MAXL = 14;
const DELAY = 1200;
const ECHO = true; // true = la réponse d'un membre est aussi affichée dans le groupe (tout le monde la voit et peut répondre)
const TZ = "Africa/Kinshasa";
const TTL = 7 * 864e5; // les réponses restent actives 7 jours
const FF = '"DejaVu Sans","Segoe UI",Arial,sans-serif';
const CACHE = path.join(__dirname, "cache");
const STORE = path.join(CACHE, `${NAME}_replies.json`);
const LN = "━━━━━━━━━━━━━━━━━━";
const PIED = "Réponds à ce message, il sera transmis";

// n = discours | r = réponse d'un membre | a = message de l'admin
const PAL = {
  n: [["#ffd166", "#ff6b6b"], ["#f9d423", "#ff4e50"], ["#ffb347", "#ff5e62"]],
  r: [["#00e5ff", "#2979ff"], ["#00f5a0", "#00d9f5"], ["#43e97b", "#38f9d7"]],
  a: [["#ff2e93", "#7c4dff"], ["#c471f5", "#fa71cd"], ["#a18cd1", "#ff8ad8"]]
};

const sleep = ms => new Promise(r => setTimeout(r, ms));
const theme = k => {
  const l = PAL[k] || PAL.n;
  const [a, b] = l[Math.floor(Math.random() * l.length)];
  return { a, b, sub: "#9aa6c7" };
};
const own = id =>
  String(id) == DEST ||
  ((global.GoatBot && global.GoatBot.config && global.GoatBot.config.adminBot) || [])
    .map(String)
    .includes(String(id));
const clean = s =>
  String(s || "").replace(/[\u{1F000}-\u{1FFFF}\u{2190}-\u{2BFF}\uFE0F\u200D]/gu, "").trim();
const li = async u => { try { return u ? await loadImage(u) : null; } catch { return null; } };
const nom = async (u, id) => { try { return (await u.getName(id)) || "Inconnu"; } catch { return "Inconnu"; } };
const photo = async (u, id) => { try { return await li(await u.getAvatarUrl(id)); } catch { return null; } };
async function infoG(td, tid) {
  let g = {};
  try { g = (await td.get(tid)) || {}; } catch {}
  return { n: g.threadName || "Groupe sans nom", im: await li(g.imageSrc) };
}
const date = () => new Date().toLocaleString("fr-FR", { timeZone: TZ, dateStyle: "full", timeStyle: "short" });
const dshort = () =>
  new Date().toLocaleString("fr-FR", { timeZone: TZ, day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

// ---------- Mémoire des réponses (survit au redémarrage) ----------
const saved = {};
function restore() {
  try {
    const j = fs.readJsonSync(STORE);
    const now = Date.now();
    for (const [k, v] of Object.entries(j)) {
      if (now - v.ts < TTL) {
        saved[k] = v;
        global.GoatBot.onReply.set(k, v);
      }
    }
  } catch {}
}
function persist() {
  try {
    const now = Date.now();
    const e = Object.entries(saved)
      .filter(([, v]) => now - v.ts < TTL)
      .sort((a, b) => b[1].ts - a[1].ts)
      .slice(0, 500);
    const o = Object.fromEntries(e);
    for (const k of Object.keys(saved)) if (!o[k]) delete saved[k];
    fs.ensureDirSync(CACHE);
    fs.writeJsonSync(STORE, o);
  } catch {}
}

// ---------- Dessin ----------
// roundRect natif absent sur beaucoup de versions de "canvas" -> c'était la cause du blocage
function rr(x, X, Y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  x.beginPath();
  x.moveTo(X + r, Y);
  x.arcTo(X + w, Y, X + w, Y + h, r);
  x.arcTo(X + w, Y + h, X, Y + h, r);
  x.arcTo(X, Y + h, X, Y, r);
  x.arcTo(X, Y, X + w, Y, r);
  x.closePath();
}
const lg = (x, x0, y0, x1, y1, a, b) => {
  const g = x.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, a);
  g.addColorStop(1, b);
  return g;
};
function wrap(x, t, w) {
  const o = [];
  for (const p of String(t).split("\n")) {
    let l = "";
    for (const wd of p.split(" ")) {
      const c = l ? l + " " + wd : wd;
      if (x.measureText(c).width <= w) { l = c; continue; }
      if (l) o.push(l);
      l = wd;
      while (x.measureText(l).width > w) {
        let i = l.length;
        while (i > 1 && x.measureText(l.slice(0, i)).width > w) i--;
        o.push(l.slice(0, i));
        l = l.slice(i);
      }
    }
    o.push(l);
  }
  return o;
}
function circ(x, img, X, Y, r, txt) {
  x.save();
  x.beginPath();
  x.arc(X, Y, r, 0, Math.PI * 2);
  x.closePath();
  x.clip();
  if (img) x.drawImage(img, X - r, Y - r, r * 2, r * 2);
  else {
    x.fillStyle = "#242b45";
    x.fillRect(X - r, Y - r, r * 2, r * 2);
    x.fillStyle = "#c9d1ee";
    x.font = `bold ${r}px ${FF}`;
    x.textAlign = "center";
    x.fillText((clean(txt)[0] || "?").toUpperCase(), X, Y + r * 0.35);
  }
  x.restore();
}
function ring(x, X, Y, r, th, w) {
  x.save();
  x.strokeStyle = lg(x, X - r, Y - r, X + r, Y + r, th.a, th.b);
  x.lineWidth = w;
  x.shadowColor = th.a;
  x.shadowBlur = 16;
  x.beginPath();
  x.arc(X, Y, r, 0, Math.PI * 2);
  x.stroke();
  x.restore();
}
function spW(x, t, sp) {
  let w = 0;
  for (const ch of t) w += x.measureText(ch).width + sp;
  return w - sp;
}
function spaced(x, t, X, Y, sp) {
  x.textAlign = "left";
  for (const ch of t) { x.fillText(ch, X, Y); X += x.measureText(ch).width + sp; }
}
function pill(x, X, Y, h, txt, size, sp, th, filled) {
  x.font = `bold ${size}px ${FF}`;
  const w = spW(x, txt, sp) + h;
  if (filled) x.fillStyle = lg(x, X, Y, X + w, Y, th.a, th.b);
  else { x.strokeStyle = th.a; x.lineWidth = 2; }
  rr(x, X, Y, w, h, h / 2);
  filled ? x.fill() : x.stroke();
  x.fillStyle = filled ? "#0b1020" : th.a;
  spaced(x, txt, X + h / 2, Y + h / 2 + size * 0.35, sp);
  return w;
}

// o : titre, badge, nom, img, texte, gl, grp, imgG, pied, th
function carte(o) {
  const th = o.th, W = 840, P = 64, IN = W - 2 * P;
  const m = createCanvas(10, 10).getContext("2d");
  m.font = `30px ${FF}`;
  let L = wrap(m, clean(o.texte) || "...", IN - 70);
  if (L.length > MAXL) {
    L = L.slice(0, MAXL);
    L[MAXL - 1] = L[MAXL - 1].replace(/.{0,2}$/, "") + "…";
  }
  const LH = 46, y0 = 285, bh = L.length * LH + 48, y3 = y0 + bh + 36, H = y3 + 170;
  const c = createCanvas(W, H), x = c.getContext("2d");

  // fond
  x.save();
  rr(x, 0, 0, W, H, 32);
  x.clip();
  x.fillStyle = lg(x, 0, 0, W, H, "#0a0e1f", "#161339");
  x.fillRect(0, 0, W, H);
  [[0, 0, th.a], [W, H, th.b]].forEach(([a, b, col]) => {
    const g = x.createRadialGradient(a, b, 10, a, b, 560);
    g.addColorStop(0, col + "55");
    g.addColorStop(1, col + "00");
    x.fillStyle = g;
    x.fillRect(0, 0, W, H);
  });
  x.fillStyle = "rgba(255,255,255,0.05)";
  for (let i = 20; i < W; i += 30) for (let j = 20; j < H; j += 30) x.fillRect(i, j, 2, 2);
  x.fillStyle = lg(x, 0, 0, W, 0, th.a, th.b);
  x.fillRect(0, 0, W, 8);
  x.restore();
  x.strokeStyle = "rgba(255,255,255,0.14)";
  x.lineWidth = 2;
  rr(x, 1, 1, W - 2, H - 2, 32);
  x.stroke();

  // en-tête
  pill(x, P, 34, 34, clean(o.titre).toUpperCase(), 14, 3, th, true);
  x.fillStyle = th.sub;
  x.font = `15px ${FF}`;
  x.textAlign = "right";
  x.fillText(dshort(), W - P, 57);

  // profil
  circ(x, o.img, P + 60, 160, 52, o.nom);
  ring(x, P + 60, 160, 60, th, 4);
  x.textAlign = "left";
  x.fillStyle = "#fff";
  x.font = `bold 38px ${FF}`;
  x.fillText(clean(o.nom).slice(0, 22) || "Inconnu", P + 142, 152);
  pill(x, P + 142, 170, 30, o.badge, 13, 2.5, th, false);
  x.strokeStyle = "rgba(255,255,255,0.1)";
  x.lineWidth = 1;
  x.beginPath();
  x.moveTo(P, 248);
  x.lineTo(W - P, 248);
  x.stroke();

  // message
  x.fillStyle = "rgba(255,255,255,0.05)";
  rr(x, P, y0, IN, bh, 24);
  x.fill();
  x.strokeStyle = "rgba(255,255,255,0.09)";
  x.stroke();
  x.save();
  x.globalAlpha = 0.18;
  x.fillStyle = th.a;
  x.font = `bold 150px ${FF}`;
  x.textAlign = "right";
  x.fillText("\u201D", P + IN - 20, y0 + 130);
  x.restore();
  x.fillStyle = lg(x, 0, y0, 0, y0 + bh, th.a, th.b);
  rr(x, P, y0 + 16, 6, bh - 32, 3);
  x.fill();
  x.fillStyle = "#f1f4ff";
  x.font = `30px ${FF}`;
  x.textAlign = "left";
  L.forEach((l, i) => x.fillText(l, P + 34, y0 + 58 + i * LH));

  // groupe
  x.fillStyle = "rgba(255,255,255,0.05)";
  rr(x, P, y3, IN, 90, 45);
  x.fill();
  x.strokeStyle = "rgba(255,255,255,0.09)";
  x.lineWidth = 1;
  x.stroke();
  circ(x, o.imgG, P + 48, y3 + 45, 30, o.grp);
  ring(x, P + 48, y3 + 45, 34, th, 2.5);
  x.fillStyle = th.sub;
  x.font = `bold 13px ${FF}`;
  spaced(x, o.gl, P + 98, y3 + 36, 2.5);
  x.fillStyle = "#fff";
  x.font = `bold 26px ${FF}`;
  x.textAlign = "left";
  x.fillText(clean(o.grp).slice(0, 28) || "Groupe", P + 98, y3 + 68);
  x.textAlign = "center";
  x.fillStyle = th.sub;
  x.font = `16px ${FF}`;
  x.fillText(o.pied, W / 2, y3 + 90 + 46);
  return c.toBuffer("image/png");
}
// ne plante jamais : en cas d'erreur on envoie juste le texte
const carteSure = o => { try { return carte(o); } catch (e) { console.error("[discours] carte:", e.message); return null; } };

// ---------- Envoi ----------
function envoi(api, tid, body, buf, data, plus = []) {
  return new Promise(res => {
    let f = null, att = [];
    try {
      if (buf) {
        fs.ensureDirSync(CACHE);
        f = path.join(CACHE, `${NAME}_${Date.now()}_${Math.floor(Math.random() * 1e6)}.png`);
        fs.writeFileSync(f, buf);
        att.push(fs.createReadStream(f));
      }
    } catch {}
    att = att.concat(plus);
    const msg = att.length ? { body, attachment: att } : { body };
    api.sendMessage(msg, tid, (err, info) => {
      if (f) try { fs.unlinkSync(f); } catch {}
      if (err) console.error("[discours] envoi:", err.message || err);
      if (!err && info && info.messageID && data) {
        const v = { commandName: NAME, messageID: info.messageID, ts: Date.now(), ...data };
        global.GoatBot.onReply.set(info.messageID, v);
        saved[info.messageID] = v;
        persist();
      }
      res(!err);
    });
  });
}
// 1er essai avec image, sinon repli en texte seul
async function envoiSur(api, tid, body, buf, data, plus) {
  if (await envoi(api, tid, body, buf, data, plus)) return true;
  return envoi(api, tid, body, null, data);
}
async function flux(atts) {
  const out = [];
  for (const a of (atts || []).slice(0, 4)) {
    try {
      const u = a.url || a.previewUrl;
      if (u) out.push(await global.utils.getStreamFromURL(u));
    } catch {}
  }
  return out;
}
const decor = (t, nm, gn, titre, ic) =>
  `${LN}\n📢  ${titre}\n${LN}\n\n❝ ${t} ❞\n\n${ic} ${nm}\n📍 ${gn}\n🕐 ${date()}\n\n${LN}\n💬 Réponds à ce message, il sera transmis.`;

module.exports = {
  config: {
    name: "discours",
    aliases: ["notif", "notification", "annonce", "broadcast"],
    version: "3.0.0",
    author: "YourName",
    countDown: 5,
    role: 0,
    shortDescription: "Discours officiel envoyé dans tous les groupes",
    longDescription:
      "L'admin envoie un discours (carte avec sa photo et le nom/photo du groupe) dans tous les groupes du bot. Tout le monde peut répondre : la réponse est transmise.",
    category: "admin",
    guide: "{pn} <message> : envoyer un discours dans tous les groupes (admin)\nN'importe qui peut répondre au message : le bot transmet la réponse."
  },

  // recharge les messages "répondables" après un redémarrage du bot
  onLoad: function () { restore(); },

  onStart: async function ({ api, event, usersData, threadsData }) {
    const { threadID: tid, messageID: mid, senderID: id } = event;
    if (!own(id)) return api.sendMessage("⛔ Commande réservée à l'administrateur.", tid, mid);
    const texte = String(event.body || "").replace(/^\S+\s*/, "").trim();
    if (!texte) return api.sendMessage("📢 Écris ton discours :\ndiscours <message>", tid, mid);

    const th = theme("n"), nm = await nom(usersData, id), img = await photo(usersData, id);
    const bot = String(api.getCurrentUserID());
    let all = [];
    try {
      const seen = new Set();
      all = (await threadsData.getAll()).filter(t =>
        t.isGroup && t.threadID && !seen.has(t.threadID) && seen.add(t.threadID) &&
        (!t.members || !t.members.length || t.members.some(m => String(m.userID) == bot && m.inGroup !== false))
      );
    } catch {}
    if (!all.length) return api.sendMessage("⚠️ Aucun groupe trouvé.", tid, mid);

    api.sendMessage(`📢 Envoi du discours dans ${all.length} groupe(s)...`, tid, mid);
    let ok = 0, ko = 0;
    for (const g of all) {
      try {
        const gn = g.threadName || "Groupe sans nom";
        const buf = carteSure({
          th, titre: "Discours officiel", badge: "ADMINISTRATEUR", nom: nm, img, texte,
          gl: "ENVOYÉ DANS LE GROUPE", grp: gn, imgG: await li(g.imageSrc), pied: PIED
        });
        (await envoiSur(api, g.threadID, decor(texte, nm, gn, "𝗗𝗜𝗦𝗖𝗢𝗨𝗥𝗦 𝗢𝗙𝗙𝗜𝗖𝗜𝗘𝗟", "👑"), buf, { t: "n" })) ? ok++ : ko++;
      } catch { ko++; }
      await sleep(DELAY);
    }
    api.sendMessage(`✅ Discours envoyé : ${ok} groupe(s)\n❌ Échecs : ${ko}`, tid, mid);
  },

  onReply: async function ({ api, event, Reply: R, usersData, threadsData }) {
    const { threadID: tid, senderID: id, messageID: mid } = event;
    try {
      if (String(id) == String(api.getCurrentUserID()) || Date.now() - R.ts > TTL) return;
      const texte = String(event.body || "").trim();
      const atts = event.attachments || [];
      if (!texte && !atts.length) return;

      const adm = own(id), nm = await nom(usersData, id), img = await photo(usersData, id);
      const t = texte || "[pièce jointe]";
      const plus = await flux(atts), nf = atts.length - plus.length;
      let ok = false;

      if (R.t == "n") {
        // réponse à un discours -> transmise à l'admin
        const g = await infoG(threadsData, tid);
        const buf = carteSure({
          th: theme(adm ? "a" : "r"), titre: "Réponse reçue", badge: adm ? "ADMINISTRATEUR" : "MEMBRE",
          nom: nm, img, texte: t, gl: "DEPUIS LE GROUPE", grp: g.n, imgG: g.im, pied: PIED
        });
        ok = await envoiSur(
          api, DEST,
          `${LN}\n📩  RÉPONSE REÇUE\n${LN}\n\n💬 ${t}\n\n👤 ${nm} (${id})\n📍 ${g.n} (${tid})` +
            `${plus.length ? `\n📎 ${plus.length} pièce(s) jointe(s) transférée(s)` : ""}` +
            `${nf > 0 ? `\n📎 ${nf} pièce(s) jointe(s) non transférée(s)` : ""}` +
            `\n\n${LN}\n↩️ Réponds à ce message pour répondre dans ce groupe.`,
          buf, { t: "r", tid }, plus
        );
        // tout le monde peut répondre : la réponse est aussi republiée dans le groupe
        if (ECHO && String(tid) != DEST) {
          const gb = carteSure({
            th: theme(adm ? "a" : "r"), titre: adm ? "Message de l'admin" : "Réponse",
            badge: adm ? "ADMINISTRATEUR" : "MEMBRE", nom: nm, img, texte: t,
            gl: "DANS LE GROUPE", grp: g.n, imgG: g.im, pied: PIED
          });
          await envoiSur(
            api, tid,
            decor(t, nm, g.n, adm ? "𝗠𝗘𝗦𝗦𝗔𝗚𝗘 𝗗𝗘 𝗟'𝗔𝗗𝗠𝗜𝗡" : "𝗥𝗘́𝗣𝗢𝗡𝗦𝗘", adm ? "👑" : "👤"),
            gb, { t: "n" }, await flux(atts)
          );
        }
      } else if (R.t == "r") {
        // réponse de l'admin -> renvoyée dans le groupe d'origine
        const g = await infoG(threadsData, R.tid);
        const buf = carteSure({
          th: theme(adm ? "a" : "r"), titre: adm ? "Message de l'admin" : "Réponse",
          badge: adm ? "ADMINISTRATEUR" : "MEMBRE", nom: nm, img, texte: t,
          gl: "ENVOYÉ DANS LE GROUPE", grp: g.n, imgG: g.im, pied: PIED
        });
        ok = await envoiSur(
          api, R.tid,
          decor(t, nm, g.n, adm ? "𝗠𝗘𝗦𝗦𝗔𝗚𝗘 𝗗𝗘 𝗟'𝗔𝗗𝗠𝗜𝗡" : "𝗥𝗘́𝗣𝗢𝗡𝗦𝗘", adm ? "👑" : "👤"),
          buf, { t: "n" }, plus
        );
      }
      try { api.setMessageReaction(ok ? "✅" : "❌", mid, () => {}, true); } catch {}
    } catch (e) {
      console.error("[discours] onReply:", e);
      try { api.setMessageReaction("❌", mid, () => {}, true); } catch {}
    }
  }
};
