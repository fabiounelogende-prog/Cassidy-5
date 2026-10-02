const { createCanvas } = require("canvas");
const fs = require("fs-extra");
const path = require("path");

// ---------- Règles ----------
const NAME = "match";
const N = 7, TYPES = 6, COUPS = 15, OBJECTIF = 1500, BONUS = 300;
const EMOJIS = ["🍓", "🍏", "🍊", "🍋", "🍇", "🫐"];
const PAL = [["#ff2e93", "#7c4dff"], ["#00d4ff", "#0057ff"], ["#00ffb3", "#00b0ff"], ["#ffcc33", "#ff6a3d"], ["#c06eff", "#ff6ec7"]];

const rnd = () => Math.floor(Math.random() * TYPES);
const permuter = (b, r1, c1, r2, c2) => { const t = b[r1][c1]; b[r1][c1] = b[r2][c2]; b[r2][c2] = t; };

function theme() {
  const [a, b] = PAL[Math.floor(Math.random() * PAL.length)];
  return { a, b, bg: "#0a0e1a", sub: "#a8b3cf" };
}

// Alignements de 3 fruits ou plus (lignes et colonnes) : liste de séries [[r, c], ...]
function trouver(b) {
  const runs = [];
  for (let a = 0; a < N; a++) for (const h of [true, false]) {
    let i = 0;
    while (i < N) {
      const v = h ? b[a][i] : b[i][a];
      let k = i;
      while (k + 1 < N && (h ? b[a][k + 1] : b[k + 1][a]) === v) k++;
      if (v >= 0 && k - i >= 2) runs.push(Array.from({ length: k - i + 1 }, (_, j) => (h ? [a, i + j] : [i + j, a])));
      i = k + 1;
    }
  }
  return runs;
}

// Les fruits tombent, les cases vides du haut sont remplies au hasard
function chute(b) {
  for (let c = 0; c < N; c++) {
    const col = [];
    for (let r = N - 1; r >= 0; r--) if (b[r][c] >= 0) col.push(b[r][c]);
    for (let r = N - 1, i = 0; r >= 0; r--, i++) b[r][c] = i < col.length ? col[i] : rnd();
  }
}

// Enchaîne les combos : 10 pts par fruit x niveau, +20 par fruit au-delà de 3 dans une série
function resoudre(b) {
  let score = 0, niveau = 0;
  const compte = Array(TYPES).fill(0);
  for (let runs = trouver(b); runs.length; runs = trouver(b)) {
    niveau++;
    const set = new Set();
    runs.forEach((run) => { score += (run.length - 3) * 20 * niveau; run.forEach(([r, c]) => set.add(r * N + c)); });
    set.forEach((k) => { const r = Math.floor(k / N), c = k % N; compte[b[r][c]]++; b[r][c] = -1; });
    score += set.size * 10 * niveau;
    chute(b);
  }
  return { score, niveau, compte };
}

function aCoup(b) {
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) for (const [dr, dc] of [[0, 1], [1, 0]]) {
    const r2 = r + dr, c2 = c + dc;
    if (r2 >= N || c2 >= N) continue;
    permuter(b, r, c, r2, c2);
    const ok = trouver(b).length > 0;
    permuter(b, r, c, r2, c2);
    if (ok) return true;
  }
  return false;
}

// Plateau de départ : aucun alignement, au moins un coup possible
function nouveauPlateau() {
  for (;;) {
    const b = Array.from({ length: N }, () => Array(N).fill(-1));
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      let t;
      do { t = rnd(); } while ((c >= 2 && b[r][c - 1] === t && b[r][c - 2] === t) || (r >= 2 && b[r - 1][c] === t && b[r - 2][c] === t));
      b[r][c] = t;
    }
    if (aCoup(b)) return b;
  }
}

// ---------- Argent et classement ----------
async function gain(usersData, uid, n) {
  try {
    const m = (await usersData.get(uid, "money")) || 0;
    await usersData.set(uid, m + n, "money");
    return true;
  } catch { return false; }
}

async function enregistrer(usersData, uid, score) {
  try {
    const d = (await usersData.get(uid, "data")) || {};
    if ((d.fruitsBest || 0) >= score) return false;
    d.fruitsBest = score;
    await usersData.set(uid, d, "data");
    return true;
  } catch { return false; }
}

async function classement(usersData) {
  try {
    return (await usersData.getAll())
      .filter((u) => u.data && u.data.fruitsBest > 0)
      .map((u) => ({ id: u.userID, name: u.name || "Joueur", score: u.data.fruitsBest }))
      .sort((a, b) => b.score - a.score);
  } catch { return []; }
}

// ---------- Dessin des fruits ----------
function boule(ctx, x, y, r, c1, c2, c3) {
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r * 1.05);
  g.addColorStop(0, c1);
  g.addColorStop(0.55, c2);
  g.addColorStop(1, c3);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, 7);
  ctx.fill();
}

function brillance(ctx, x, y, rx, ry, rot) {
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, 7);
  ctx.fill();
  ctx.restore();
}

function feuille(ctx, x, y, rx, ry, rot, c) {
  ctx.fillStyle = c || "#3fa21c";
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, 7);
  ctx.fill();
}

function tige(ctx, x1, y1, x2, y2, w, c) {
  ctx.strokeStyle = c || "#5a3a1a";
  ctx.lineWidth = w;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function fraise(ctx, x, y, s) {
  const g = ctx.createRadialGradient(x - s * 0.3, y - s * 0.2, s * 0.1, x, y, s * 1.1);
  g.addColorStop(0, "#ff8a9a");
  g.addColorStop(0.5, "#e8112d");
  g.addColorStop(1, "#8f0a1e");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.95);
  ctx.bezierCurveTo(x - s * 1.25, y + s * 0.2, x - s * 1.0, y - s * 0.7, x, y - s * 0.45);
  ctx.bezierCurveTo(x + s * 1.0, y - s * 0.7, x + s * 1.25, y + s * 0.2, x, y + s * 0.95);
  ctx.fill();
  ctx.fillStyle = "#ffe27a";
  [[-0.5, -0.05], [0, -0.15], [0.5, -0.05], [-0.28, 0.25], [0.28, 0.25], [0, 0.55]].forEach(([dx, dy]) => {
    ctx.beginPath();
    ctx.ellipse(x + s * dx, y + s * dy, s * 0.05, s * 0.08, 0, 0, 7);
    ctx.fill();
  });
  tige(ctx, x, y - s * 0.5, x, y - s * 0.9, s * 0.1, "#2f9e2f");
  [-2, -1, 0, 1, 2].forEach((i) => feuille(ctx, x + i * s * 0.2, y - s * 0.5 + Math.abs(i) * s * 0.04, s * 0.2, s * 0.09, i * 0.5, "#2f9e2f"));
  brillance(ctx, x - s * 0.45, y - s * 0.05, s * 0.1, s * 0.22, 0.4);
}

function pomme(ctx, x, y, s) {
  const g = ctx.createRadialGradient(x - s * 0.3, y - s * 0.3, s * 0.1, x, y, s * 1.1);
  g.addColorStop(0, "#d8ff8a");
  g.addColorStop(0.5, "#6cc72b");
  g.addColorStop(1, "#2f7d12");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x, y - s * 0.55);
  ctx.bezierCurveTo(x + s * 0.35, y - s * 0.95, x + s * 1.1, y - s * 0.5, x + s * 0.85, y + s * 0.25);
  ctx.bezierCurveTo(x + s * 0.7, y + s * 0.85, x + s * 0.3, y + s * 1.0, x, y + s * 0.85);
  ctx.bezierCurveTo(x - s * 0.3, y + s * 1.0, x - s * 0.7, y + s * 0.85, x - s * 0.85, y + s * 0.25);
  ctx.bezierCurveTo(x - s * 1.1, y - s * 0.5, x - s * 0.35, y - s * 0.95, x, y - s * 0.55);
  ctx.fill();
  tige(ctx, x, y - s * 0.5, x + s * 0.08, y - s * 0.95, s * 0.12);
  feuille(ctx, x + s * 0.38, y - s * 0.82, s * 0.3, s * 0.12, -0.5, "#3fa21c");
  brillance(ctx, x - s * 0.45, y - s * 0.1, s * 0.12, s * 0.28, 0.4);
}

function orange(ctx, x, y, s) {
  boule(ctx, x, y + s * 0.05, s * 0.9, "#ffd08a", "#ff8c00", "#bf5200");
  ctx.fillStyle = "rgba(160,70,0,0.35)";
  [[-0.3, -0.1], [0.2, -0.3], [0.35, 0.2], [-0.1, 0.35], [-0.45, 0.25], [0.05, 0]].forEach(([dx, dy]) => {
    ctx.beginPath();
    ctx.arc(x + s * dx, y + s * dy, s * 0.03, 0, 7);
    ctx.fill();
  });
  tige(ctx, x, y - s * 0.82, x, y - s * 0.97, s * 0.08);
  feuille(ctx, x + s * 0.3, y - s * 0.9, s * 0.3, s * 0.12, -0.4);
  brillance(ctx, x - s * 0.35, y - s * 0.3, s * 0.15, s * 0.28, 0.6);
}

function citron(ctx, x, y, s) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.5);
  const g = ctx.createRadialGradient(-s * 0.3, -s * 0.3, s * 0.1, 0, 0, s * 1.1);
  g.addColorStop(0, "#fff9a8");
  g.addColorStop(0.5, "#ffe11a");
  g.addColorStop(1, "#c9a400");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-s * 1.05, 0);
  ctx.quadraticCurveTo(-s * 0.7, -s * 0.8, 0, -s * 0.8);
  ctx.quadraticCurveTo(s * 0.7, -s * 0.8, s * 1.05, 0);
  ctx.quadraticCurveTo(s * 0.7, s * 0.8, 0, s * 0.8);
  ctx.quadraticCurveTo(-s * 0.7, s * 0.8, -s * 1.05, 0);
  ctx.fill();
  ctx.fillStyle = "#c9a400";
  [-1, 1].forEach((d) => { ctx.beginPath(); ctx.arc(d * s * 1.05, 0, s * 0.1, 0, 7); ctx.fill(); });
  brillance(ctx, -s * 0.25, -s * 0.3, s * 0.35, s * 0.12, 0);
  ctx.restore();
  feuille(ctx, x + s * 0.8, y - s * 0.62, s * 0.3, s * 0.12, -0.9);
}

function raisin(ctx, x, y, s) {
  tige(ctx, x, y - s * 0.55, x + s * 0.05, y - s * 0.95, s * 0.1);
  feuille(ctx, x + s * 0.4, y - s * 0.85, s * 0.32, s * 0.13, -0.4);
  [[-0.5, -0.3], [0, -0.3], [0.5, -0.3], [-0.25, 0.15], [0.25, 0.15], [0, 0.6]].forEach(([dx, dy]) => {
    boule(ctx, x + s * dx, y + s * dy, s * 0.3, "#d6a8ff", "#8e3fd1", "#4a1585");
    brillance(ctx, x + s * dx - s * 0.1, y + s * dy - s * 0.1, s * 0.06, s * 0.09, 0.5);
  });
}

function myrtille(ctx, x, y, s) {
  [[-0.45, 0.25, 0.5], [0.45, 0.25, 0.5], [0, -0.35, 0.52]].forEach(([dx, dy, r]) => {
    const cx = x + s * dx, cy = y + s * dy;
    boule(ctx, cx, cy, s * r, "#a9bcff", "#3b5bdb", "#16257a");
    ctx.strokeStyle = "#0d1648";
    ctx.lineWidth = s * 0.05;
    ctx.beginPath();
    ctx.arc(cx, cy - s * r * 0.2, s * 0.1, 0, 7);
    ctx.stroke();
    brillance(ctx, cx - s * r * 0.4, cy - s * r * 0.4, s * 0.07, s * 0.12, 0.6);
  });
}

const FRUITS = [fraise, pomme, orange, citron, raisin, myrtille];

// ---------- Dessin des écrans ----------
function base(W, H, th, titre) {
  const canvas = createCanvas(W, H), ctx = canvas.getContext("2d");
  let g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, th.bg);
  g.addColorStop(1, "#140a2e");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "rgba(255,255,255,0.04)";
  ctx.lineWidth = 1;
  for (let i = 0; i < W; i += 40) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, H); ctx.stroke(); }
  for (let i = 0; i < H; i += 40) { ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(W, i); ctx.stroke(); }
  ctx.globalAlpha = 0.3;
  [[W, 0, th.a], [0, H, th.b]].forEach(([x, y, c]) => {
    g = ctx.createRadialGradient(x, y, 10, x, y, 480);
    g.addColorStop(0, c);
    g.addColorStop(1, "transparent");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, 480, 0, 7);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
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
  ctx.textAlign = "center";
  ctx.fillStyle = "#fff";
  ctx.font = "bold 52px Sans-Serif";
  ctx.shadowColor = th.a;
  ctx.shadowBlur = 18;
  ctx.fillText(titre, W / 2, 92);
  ctx.shadowBlur = 0;
  return { canvas, ctx };
}

function stat(ctx, x, y, w, label, valeur, th) {
  ctx.fillStyle = "rgba(255,255,255,0.06)";
  ctx.beginPath();
  ctx.roundRect(x, y, w, 76, 12);
  ctx.fill();
  ctx.strokeStyle = th.a;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = th.sub;
  ctx.font = "bold 14px Sans-Serif";
  ctx.fillText(label, x + w / 2, y + 24);
  ctx.fillStyle = "#fff";
  ctx.font = "bold 36px Sans-Serif";
  ctx.fillText(String(valeur), x + w / 2, y + 62);
}

function dessiner(b, th, titre, score, coups, fin) {
  const W = 820, H = 1090, x0 = 74, y0 = 290, C = 96;
  const { canvas, ctx } = base(W, H, th, "FRUITS MATCH");
  stat(ctx, 60, 118, 220, "SCORE", score, th);
  stat(ctx, 300, 118, 220, "COUPS", coups, th);
  stat(ctx, 540, 118, 220, "OBJECTIF", OBJECTIF, th);
  ctx.fillStyle = th.a;
  ctx.font = "bold 28px Sans-Serif";
  ctx.fillText(titre, W / 2, 240);

  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.beginPath();
  ctx.roundRect(x0 - 8, y0 - 8, N * C + 16, N * C + 16, 18);
  ctx.fill();
  ctx.strokeStyle = th.b;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = th.sub;
  ctx.font = "bold 22px Sans-Serif";
  for (let i = 0; i < N; i++) {
    ctx.fillText(String.fromCharCode(65 + i), x0 + i * C + C / 2, y0 - 16);
    ctx.fillText(String(i + 1), x0 - 36, y0 + i * C + C / 2 + 8);
  }
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    const x = x0 + c * C, y = y0 + r * C;
    ctx.fillStyle = "rgba(255,255,255,0.05)";
    ctx.beginPath();
    ctx.roundRect(x + 4, y + 4, C - 8, C - 8, 14);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    ctx.stroke();
    FRUITS[b[r][c]](ctx, x + C / 2, y + C / 2 + 2, 34);
  }

  ctx.strokeStyle = th.b;
  ctx.globalAlpha = 0.4;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(50, H - 70);
  ctx.lineTo(W - 50, H - 70);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.fillStyle = th.sub;
  ctx.font = "20px Sans-Serif";
  ctx.fillText(fin ? "Relance la commande pour rejouer" : "Réponds avec 2 cases voisines  •  ex : B3 C3", W / 2, H - 38);
  return canvas.toBuffer("image/png");
}

function dessinerTop(liste, th) {
  const W = 820, H = Math.max(620, 260 + Math.max(liste.length, 1) * 82 + 90);
  const { canvas, ctx } = base(W, H, th, "CLASSEMENT");
  ctx.fillStyle = th.sub;
  ctx.font = "22px Sans-Serif";
  ctx.fillText("Meilleurs scores  •  Fruits Match", W / 2, 140);
  if (!liste.length) {
    ctx.fillStyle = "#fff";
    ctx.font = "bold 28px Sans-Serif";
    ctx.fillText("Aucun score pour l'instant", W / 2, 300);
    ctx.fillStyle = th.sub;
    ctx.font = "22px Sans-Serif";
    ctx.fillText("Sois le premier à jouer !", W / 2, 345);
  }
  liste.forEach((u, i) => {
    const y = 190 + i * 82, med = ["#ffd54a", "#cfd8dc", "#e0955a"][i] || th.a;
    ctx.fillStyle = "rgba(255,255,255,0.05)";
    ctx.beginPath();
    ctx.roundRect(60, y, 700, 68, 14);
    ctx.fill();
    ctx.strokeStyle = i < 3 ? med : th.b;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = med;
    ctx.beginPath();
    ctx.arc(110, y + 34, 24, 0, 7);
    ctx.fill();
    ctx.fillStyle = th.bg;
    ctx.font = "bold 24px Sans-Serif";
    ctx.textAlign = "center";
    ctx.fillText(String(i + 1), 110, y + 43);
    ctx.textAlign = "left";
    ctx.fillStyle = "#fff";
    ctx.font = "bold 26px Sans-Serif";
    ctx.fillText(String(u.name).slice(0, 22), 160, y + 43);
    ctx.textAlign = "right";
    ctx.fillStyle = med;
    ctx.font = "bold 28px Sans-Serif";
    ctx.fillText(String(u.score), 730, y + 44);
    ctx.textAlign = "center";
  });
  return canvas.toBuffer("image/png");
}

// ---------- Envoi ----------
async function envoyer(api, threadID, messageID, body, buf, uid, etat) {
  const dir = path.join(__dirname, "cache");
  fs.ensureDirSync(dir);
  const file = path.join(dir, `${NAME}_${uid}_${Date.now()}.png`);
  fs.writeFileSync(file, buf);
  api.sendMessage({ body, attachment: fs.createReadStream(file) }, threadID, (err, info) => {
    try { fs.unlinkSync(file); } catch {}
    if (err || !etat || !info) return;
    global.GoatBot.onReply.set(info.messageID, { commandName: NAME, messageID: info.messageID, author: uid, ...etat });
  }, messageID);
}

module.exports = {
  config: {
    name: "match",
    aliases: ["fruits", "match3", "fruitmatch"],
    version: "1.0.0",
    author: "YourName",
    countDown: 5,
    role: 0,
    shortDescription: "Jeu des fruits : aligne 3 fruits ou plus",
    longDescription: `Échange 2 fruits voisins pour aligner 3 fruits identiques ou plus. ${COUPS} coups pour atteindre ${OBJECTIF} points. Combos, gains d'argent et classement (match top).`,
    category: "game",
    guide: "{pn} : nouvelle partie\n{pn} top : classement\nRéponds à l'image avec 2 cases voisines, ex : B3 C3"
  },

  onStart: async function ({ api, event, args, usersData }) {
    const { threadID, messageID, senderID } = event;
    const th = theme();

    if ((args[0] || "").toLowerCase() === "top") {
      const liste = (await classement(usersData)).slice(0, 10);
      return envoyer(api, threadID, messageID, "🏆 CLASSEMENT FRUITS MATCH", dessinerTop(liste, th), senderID, null);
    }

    const board = nouveauPlateau();
    const body =
      `🍓🍏🍊🍋🍇🫐 FRUITS MATCH\n\n` +
      `🎯 Atteins ${OBJECTIF} points en ${COUPS} coups.\n` +
      `👉 Réponds à l'image avec 2 cases voisines pour les échanger.\n` +
      `Exemple : B3 C3 (colonne lettre + ligne chiffre)\n` +
      `🔥 Les combos en chaîne rapportent plus de points !`;
    await envoyer(api, threadID, messageID, body, dessiner(board, th, "À TOI DE JOUER", 0, COUPS, false), senderID, { board, score: 0, coups: COUPS, th });
  },

  onReply: async function ({ api, event, Reply, usersData }) {
    const { threadID, messageID, senderID, body } = event;
    if (senderID !== Reply.author) return;

    const m = [...String(body || "").toUpperCase().matchAll(/([A-G])\s*([1-7])/g)];
    if (m.length < 2) return api.sendMessage("⚠️ Écris deux cases voisines, par exemple : B3 C3", threadID, messageID);
    const c1 = m[0][1].charCodeAt(0) - 65, r1 = +m[0][2] - 1, c2 = m[1][1].charCodeAt(0) - 65, r2 = +m[1][2] - 1;
    if (Math.abs(c1 - c2) + Math.abs(r1 - r2) !== 1) return api.sendMessage("⚠️ Les deux cases doivent être voisines (côte à côte ou l'une au-dessus de l'autre).", threadID, messageID);

    let b = Reply.board.map((l) => l.slice());
    permuter(b, r1, c1, r2, c2);
    if (!trouver(b).length) return api.sendMessage("❌ Ce coup ne crée aucun alignement de 3. Essaie un autre échange (le coup n'est pas perdu).", threadID, messageID);

    global.GoatBot.onReply.delete(Reply.messageID);
    const res = resoudre(b), th = Reply.th;
    const score = Reply.score + res.score, coups = Reply.coups - 1;
    let melange = false;
    if (coups > 0 && !aCoup(b)) { b = nouveauPlateau(); melange = true; }

    const fruits = res.compte.map((n, i) => (n ? `${EMOJIS[i]}×${n}` : "")).filter(Boolean).join("  ");
    let msg = `✅ +${res.score} pts${res.niveau > 1 ? `  🔥 Combo ×${res.niveau}` : ""}\n${fruits}\n\n⭐ Score : ${score}/${OBJECTIF}  •  🎯 Coups restants : ${coups}`;
    if (melange) msg += "\n🔀 Plus aucun coup possible : plateau mélangé !";

    const fin = coups <= 0;
    let titre = "À TOI DE JOUER";
    if (fin) {
      const reussi = score >= OBJECTIF, total = Math.floor(score / 2) + (reussi ? BONUS : 0);
      const ok = await gain(usersData, senderID, total);
      const record = await enregistrer(usersData, senderID, score);
      const rang = (await classement(usersData)).findIndex((u) => u.id === senderID) + 1;
      titre = reussi ? "OBJECTIF ATTEINT !" : "PARTIE TERMINÉE";
      msg += `\n\n${reussi ? "🏆 Objectif atteint !" : "🏁 Partie terminée."} Score final : ${score}${record ? "  🆕 Record !" : ""}` +
        (ok ? `\n💰 +${total}` : "") + (rang ? `\n🥇 Classement : #${rang}` : "") +
        "\n🔁 Relance la commande pour rejouer (« top » pour le classement).";
    }

    await envoyer(api, threadID, messageID, msg, dessiner(b, th, titre, score, coups, fin), senderID,
      fin ? null : { board: b, score, coups, th });
  }
};
