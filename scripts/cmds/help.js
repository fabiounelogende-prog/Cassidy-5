const { createCanvas, loadImage } = require("canvas");
const fs = require("fs-extra");
const path = require("path");

const PAL = [["#ff2e93", "#7c4dff"], ["#00d4ff", "#0057ff"], ["#00ffb3", "#00b0ff"], ["#ffcc33", "#ff6a3d"], ["#c06eff", "#ff6ec7"], ["#2bffc9", "#6a5bff"]];
const ROLES = ["Tous les membres", "Admins du groupe", "Admins du bot"];

function theme(basic) {
  const [a, b] = PAL[Math.floor(Math.random() * PAL.length)];
  return basic
    ? { bg: "#0f172a", bg2: "#1e293b", a: "#64748b", b: "#94a3b8", card: "#1e293b", border: "#334155", sub: "#94a3b8", label: "MODE BASIQUE", dim: 0.12 }
    : { bg: "#0a0e1a", bg2: "#140a2e", a, b, card: "rgba(255,255,255,0.05)", border: a, sub: "#a8b3cf", label: "MODE ARCADE", dim: 0.35 };
}

const txt = (v) => (!v ? "" : typeof v === "string" ? v : v.fr || v.en || Object.values(v)[0] || "");

function hex(ctx, x, y, r) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i - Math.PI / 6;
    i ? ctx.lineTo(x + r * Math.cos(a), y + r * Math.sin(a)) : ctx.moveTo(x + r * Math.cos(a), y + r * Math.sin(a));
  }
  ctx.closePath();
}

function nid(ctx, cx, cy, R, r, col) {
  const dx = Math.sqrt(3) * r, n = Math.ceil(R / (1.5 * r)) + 1;
  ctx.save();
  ctx.strokeStyle = col;
  ctx.lineWidth = 1.5;
  for (let j = -n; j <= n; j++) for (let i = -n; i <= n; i++) {
    const x = cx + i * dx + (Math.abs(j) % 2 ? dx / 2 : 0), y = cy + j * 1.5 * r, d = Math.hypot(x - cx, y - cy);
    if (d > R) continue;
    ctx.globalAlpha = 0.3 * (1 - d / R);
    hex(ctx, x, y, r - 2);
    ctx.stroke();
  }
  ctx.restore();
}

function losange(ctx, x, y, t, c) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = c;
  ctx.shadowColor = c;
  ctx.shadowBlur = 10;
  ctx.fillRect(-t / 2, -t / 2, t, t);
  ctx.restore();
}

function barre(ctx, xf, y, page, total, th) {
  if (total > 20) return;
  const gap = 6, w = Math.max(8, Math.min(26, Math.floor((330 - gap * (total - 1)) / total)));
  const x0 = xf - (total * w + (total - 1) * gap);
  ctx.save();
  ctx.fillStyle = th.sub;
  ctx.font = "bold 13px Sans-Serif";
  ctx.textAlign = "right";
  ctx.fillText("PROGRESSION", xf, y - 10);
  ctx.textAlign = "left";
  for (let i = 0; i < total; i++) {
    const x = x0 + i * (w + gap);
    ctx.beginPath();
    ctx.roundRect(x, y, w, 14, 4);
    if (i < page) {
      const g = ctx.createLinearGradient(x, 0, x + w, 0);
      g.addColorStop(0, th.a);
      g.addColorStop(1, th.b);
      ctx.fillStyle = g;
      ctx.shadowColor = th.a;
      ctx.shadowBlur = 8;
      ctx.fill();
      ctx.shadowBlur = 0;
    } else {
      ctx.strokeStyle = th.b;
      ctx.globalAlpha = 0.4;
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }
  ctx.restore();
}

function wrap(ctx, text, w, max) {
  const out = [];
  String(text || "").split("\n").forEach((p) => {
    let l = "";
    p.split(" ").forEach((m) => {
      while (ctx.measureText(m).width > w && m.length > 1) {
        let k = m.length - 1;
        while (k > 1 && ctx.measureText(m.slice(0, k)).width > w) k--;
        if (l) { out.push(l); l = ""; }
        out.push(m.slice(0, k));
        m = m.slice(k);
      }
      const t = l ? l + " " + m : m;
      if (ctx.measureText(t).width > w && l) { out.push(l); l = m; } else l = t;
    });
    out.push(l);
  });
  if (out.length > max) { out.length = max; out[max - 1] = out[max - 1].replace(/.{0,3}$/, "") + "..."; }
  return out;
}

function fit(ctx, t, w, size, min) {
  for (; size > min; size--) {
    ctx.font = `bold ${size}px Sans-Serif`;
    if (ctx.measureText(t).width <= w) return t;
  }
  ctx.font = `bold ${min}px Sans-Serif`;
  if (ctx.measureText(t).width > w) {
    while (t.length > 1 && ctx.measureText(t + "...").width > w) t = t.slice(0, -1);
    t += "...";
  }
  return t;
}

function carte(ctx, x, y, w, h, th) {
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.4)";
  ctx.shadowBlur = 10;
  ctx.fillStyle = th.card;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 12);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = th.border;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 12);
  ctx.stroke();
  const g = ctx.createLinearGradient(0, y + 14, 0, y + h - 14);
  g.addColorStop(0, th.a);
  g.addColorStop(1, th.b);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(x + 12, y + 14, 7, h - 28, 3);
  ctx.fill();
}

function info(ctx, x, y, w, th, t, v) {
  carte(ctx, x, y, w, 84, th);
  ctx.fillStyle = th.a;
  ctx.font = "bold 14px Sans-Serif";
  ctx.fillText(t, x + 34, y + 30);
  ctx.fillStyle = "#fff";
  ctx.fillText(fit(ctx, String(v), w - 56, 24, 13), x + 34, y + 62);
}

function bloc(ctx, y, h, t, lignes, taille, pas, th) {
  carte(ctx, 50, y, 1100, h, th);
  ctx.fillStyle = th.a;
  ctx.font = "bold 14px Sans-Serif";
  ctx.fillText(t, 84, y + 34);
  ctx.fillStyle = "#fff";
  ctx.font = `${taille}px Sans-Serif`;
  lignes.forEach((l, i) => ctx.fillText(l, 84, y + 70 + i * pas));
}

function pied(ctx, W, H, th, t) {
  ctx.strokeStyle = th.b;
  ctx.globalAlpha = 0.4;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(50, H - 70);
  ctx.lineTo(W - 50, H - 70);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.fillStyle = th.sub;
  ctx.font = "18px Sans-Serif";
  ctx.fillText(t, 50, H - 38);
}

// Fond, décor, cadre, avatar et en-tête communs au menu et au détail
async function base(W, H, th, titre, sous, usersData, uid) {
  const canvas = createCanvas(W, H), ctx = canvas.getContext("2d");
  let g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, th.bg);
  g.addColorStop(1, th.bg2);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "rgba(255,255,255,0.04)";
  ctx.lineWidth = 1;
  for (let i = 0; i < W; i += 40) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, H); ctx.stroke(); }
  for (let i = 0; i < H; i += 40) { ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(W, i); ctx.stroke(); }
  ctx.globalAlpha = th.dim;
  [[W, 0, 520, th.a], [0, H, 480, th.b]].forEach(([x, y, r, c]) => {
    g = ctx.createRadialGradient(x, y, 10, x, y, r);
    g.addColorStop(0, c);
    g.addColorStop(1, "transparent");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, 7);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
  nid(ctx, W, 0, 380, 26, th.a);
  nid(ctx, 0, H, 380, 26, th.b);
  ctx.strokeStyle = th.a;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(18, 18, W - 36, H - 36, 18);
  ctx.stroke();
  ctx.strokeStyle = th.b;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(26, 26, W - 52, H - 52, 14);
  ctx.stroke();
  try {
    const img = await loadImage(await usersData.getAvatarUrl(uid));
    ctx.save();
    hex(ctx, 95, 95, 48);
    ctx.clip();
    ctx.drawImage(img, 47, 47, 96, 96);
    ctx.restore();
    g = ctx.createLinearGradient(47, 47, 143, 143);
    g.addColorStop(0, th.a);
    g.addColorStop(1, th.b);
    ctx.strokeStyle = g;
    ctx.lineWidth = 4;
    hex(ctx, 95, 95, 50);
    ctx.stroke();
  } catch {}
  ctx.fillStyle = "#fff";
  ctx.font = "bold 44px Sans-Serif";
  ctx.shadowColor = th.a;
  ctx.shadowBlur = th.dim > 0.2 ? 18 : 0;
  ctx.fillText(titre, 175, 78);
  ctx.shadowBlur = 0;
  g = ctx.createLinearGradient(175, 0, 355, 0);
  g.addColorStop(0, th.a);
  g.addColorStop(1, th.b);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.roundRect(175, 92, 180, 30, 8);
  ctx.fill();
  ctx.fillStyle = th.bg;
  ctx.font = "bold 14px Sans-Serif";
  ctx.fillText(th.label, 191, 113);
  ctx.fillStyle = th.sub;
  ctx.font = "20px Sans-Serif";
  ctx.fillText(sous, 50, 185);
  ctx.strokeStyle = th.a;
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(50, 200);
  ctx.lineTo(W - 50, 200);
  ctx.stroke();
  ctx.globalAlpha = 1;
  losange(ctx, 50, 200, 10, th.a);
  losange(ctx, W - 50, 200, 10, th.b);
  return { canvas, ctx };
}

async function menu({ list, all, page, total, prefix, th, usersData, uid }) {
  const W = 1200, rows = Math.ceil(list.length / 4) || 1, H = Math.max(820, 222 + rows * 98 + 130);
  const { canvas, ctx } = await base(W, H, th, "CENTRE D'AIDE", `Total : ${all} commandes  •  Page ${page}/${total}`, usersData, uid);
  barre(ctx, 1150, 105, page, total, th);
  list.forEach((n, i) => {
    const x = 50 + (i % 4) * 278, y = 222 + Math.floor(i / 4) * 98;
    carte(ctx, x, y, 258, 80, th);
    ctx.fillStyle = "#fff";
    ctx.fillText(fit(ctx, prefix + n, 210, 24, 12), x + 34, y + 48);
  });
  pied(ctx, W, H, th, `${prefix}help [page]  •  ${prefix}help [commande] pour les détails (ex : ${prefix}help art)`);
  return canvas.toBuffer("image/png");
}

async function detail({ c, desc, g, al, role, prefix, th, usersData, uid }) {
  const W = 1200, m = createCanvas(1, 1).getContext("2d");
  m.font = "24px Sans-Serif";
  const L1 = wrap(m, desc, 1040, 5);
  m.font = "22px Sans-Serif";
  const L2 = wrap(m, g, 1040, 7);
  const h1 = 64 + L1.length * 32, h2 = 64 + L2.length * 30, y4 = 540, y5 = y4 + h1 + 20;
  const H = Math.max(700, y5 + h2 + 110);
  const { canvas, ctx } = await base(W, H, th, "DÉTAIL DE LA COMMANDE", "Informations et utilisation", usersData, uid);
  carte(ctx, 50, 222, 1100, 90, th);
  ctx.fillStyle = "#fff";
  ctx.fillText(fit(ctx, prefix + c.name, 840, 44, 20), 84, 282);
  const p = ctx.createLinearGradient(970, 0, 1120, 0);
  p.addColorStop(0, th.a);
  p.addColorStop(1, th.b);
  ctx.fillStyle = p;
  ctx.beginPath();
  ctx.roundRect(970, 247, 150, 40, 10);
  ctx.fill();
  ctx.fillStyle = th.bg;
  ctx.font = "bold 22px Sans-Serif";
  ctx.textAlign = "center";
  ctx.fillText(`v${c.version || "?"}`, 1045, 275);
  ctx.textAlign = "left";
  [["CRÉATEUR", c.author || "Inconnu"], ["CATÉGORIE", c.category || "Aucune"], ["RÔLE", role], ["DÉLAI", `${c.countDown ?? 1} s`]]
    .forEach(([t, v], i) => info(ctx, 50 + i * 278, 332, 258, th, t, v));
  info(ctx, 50, 436, 1100, th, "ALIAS", al);
  bloc(ctx, y4, h1, "DESCRIPTION", L1, 24, 32, th);
  bloc(ctx, y5, h2, "UTILISATION", L2, 22, 30, th);
  pied(ctx, W, H, th, `Tapez '${prefix}help' pour revenir au menu`);
  return canvas.toBuffer("image/png");
}

module.exports = {
  config: {
    name: "help",
    version: "5.1.0",
    author: "YourName",
    countDown: 5,
    role: 0,
    shortDescription: "Menu help Canvas et détail d'une commande",
    longDescription: "Menu paginé en image, ou détails d'une commande (ex : help art).",
    category: "info",
    guide: "{pn} [page | basic | commande] (ex: {pn} 2, {pn} art)"
  },

  onStart: async function ({ api, event, args, usersData, threadsData }) {
    const { threadID, messageID, senderID: uid } = event;
    const G = global.GoatBot || {};
    let prefix = G.config?.prefix || "/";
    try { prefix = (await threadsData.get(threadID))?.data?.prefix || prefix; } catch {}
    const cmds = G.commands || new Map();
    const a0 = (args[0] || "").toLowerCase();
    const th = theme(a0 === "basic" || (args[1] || "").toLowerCase() === "basic");

    const send = async (body, draw) => {
      let file = null;
      try {
        const dir = path.join(__dirname, "cache");
        fs.ensureDirSync(dir);
        file = path.join(dir, `help_${uid}.png`);
        fs.writeFileSync(file, await draw());
      } catch { file = null; }
      api.sendMessage(
        file ? { body, attachment: fs.createReadStream(file) } : body,
        threadID,
        () => { try { file && fs.unlinkSync(file); } catch {} },
        messageID
      );
    };

    // Détail d'une commande : help art
    if (a0 && isNaN(a0) && a0 !== "basic") {
      const cmd = cmds.get(a0) || cmds.get(G.aliases?.get(a0));
      if (!cmd) return api.sendMessage(`❌ La commande "${a0}" n'existe pas.\n💡 Tapez ${prefix}help pour voir la liste.`, threadID, messageID);
      const c = cmd.config || {};
      const desc = txt(c.longDescription) || txt(c.description) || txt(c.shortDescription) || "Aucune description.";
      let g = c.guide;
      g = (Array.isArray(g) ? g.join("\n") : txt(g) || "{pn}").replace(/\{pn\}/g, prefix + c.name).replace(/\{p\}/g, prefix);
      const al = c.aliases?.length ? c.aliases.join(", ") : "Aucun";
      const role = ROLES[c.role] || "Accès spécial";
      const body =
        `╭─── 📘 COMMANDE ───╮\n🔹 Nom : ${prefix}${c.name}\n📝 Description : ${desc}\n👤 Créateur : ${c.author || "Inconnu"}\n` +
        `🏷️ Version : ${c.version || "?"}\n📂 Catégorie : ${c.category || "Aucune"}\n🔐 Rôle : ${role}\n` +
        `⏱️ Délai : ${c.countDown ?? 1}s\n🔁 Alias : ${al}\n╰──────────────╯\n\n📖 Utilisation :\n${g}`;
      return send(body, () => detail({ c, desc, g, al, role, prefix, th, usersData, uid }));
    }

    // Menu paginé
    const names = [...cmds.keys()], per = 20, total = Math.ceil(names.length / per) || 1;
    let page = parseInt(a0) || 1;
    if (page < 1 || page > total) page = 1;
    const list = names.slice((page - 1) * per, page * per), next = page + 1 > total ? 1 : page + 1;
    const body =
      `📖 MENU SANS FORFAIT (Page ${page}/${total})\n\n` +
      list.map((n, i) => `• ${prefix}${n} ` + ((i + 1) % 3 === 0 ? "\n" : "")).join("") +
      `\n\n📌 Tapez '${prefix}help ${next}' pour la page suivante.\n🔎 Tapez '${prefix}help art' pour les détails d'une commande.`;
    return send(body, () => menu({ list, all: names.length, page, total, prefix, th, usersData, uid }));
  }
};
