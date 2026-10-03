const { createCanvas, loadImage } = require("canvas");
const fs = require("fs-extra");
const path = require("path");
const os = require("os");

function teinte(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const c = v => Math.max(0, Math.min(255, Math.round(v * k)));
  return `rgb(${c((n >> 16) & 255)},${c((n >> 8) & 255)},${c(n & 255)})`;
}

function formatDuree(ms) {
  const sec = Math.floor(ms / 1000) % 60;
  const min = Math.floor(ms / 60000) % 60;
  const h = Math.floor(ms / 3600000) % 24;
  const j = Math.floor(ms / 86400000);
  const parts = [];
  if (j) parts.push(`${j}j`);
  if (h || j) parts.push(`${h}h`);
  if (min || h || j) parts.push(`${min}m`);
  parts.push(`${sec}s`);
  return parts.join(" ");
}

function formatOctets(o) {
  return (o / 1024 / 1024).toFixed(1) + " Mo";
}

// ---------- Petites icônes de stats (traits simples) ----------
function iconeHorloge(ctx, cx, cy, s, c) {
  ctx.strokeStyle = c; ctx.lineWidth = 2.2;
  ctx.beginPath(); ctx.arc(cx, cy, s, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx, cy - s * 0.6); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + s * 0.4, cy + s * 0.2); ctx.stroke();
}
function iconeSignal(ctx, cx, cy, s, c) {
  ctx.strokeStyle = c; ctx.lineWidth = 2.2; ctx.lineCap = "round";
  [0.4, 0.65, 0.9].forEach((f, i) => {
    ctx.beginPath();
    ctx.moveTo(cx - s + i * s * 0.6, cy + s);
    ctx.lineTo(cx - s + i * s * 0.6, cy + s - s * 2 * f);
    ctx.stroke();
  });
}
function iconePuce(ctx, cx, cy, s, c) {
  ctx.strokeStyle = c; ctx.lineWidth = 2.2;
  ctx.beginPath(); ctx.roundRect(cx - s * 0.6, cy - s * 0.6, s * 1.2, s * 1.2, 3); ctx.stroke();
  for (let i = -1; i <= 1; i += 2) {
    ctx.beginPath(); ctx.moveTo(cx + i * s * 0.6, cy - s * 0.3); ctx.lineTo(cx + i * s * 0.9, cy - s * 0.3); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + i * s * 0.6, cy + s * 0.3); ctx.lineTo(cx + i * s * 0.9, cy + s * 0.3); ctx.stroke();
  }
}
function iconeJauge(ctx, cx, cy, s, c) {
  ctx.strokeStyle = c; ctx.lineWidth = 2.2;
  ctx.beginPath(); ctx.arc(cx, cy + s * 0.2, s, Math.PI, 0); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx, cy + s * 0.2); ctx.lineTo(cx + s * 0.5, cy - s * 0.4); ctx.stroke();
}
function iconeLoupe(ctx, cx, cy, s, c) {
  ctx.strokeStyle = c; ctx.lineWidth = 2.4; ctx.lineCap = "round";
  ctx.beginPath(); ctx.arc(cx - s * 0.15, cy - s * 0.15, s * 0.65, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx + s * 0.3, cy + s * 0.3); ctx.lineTo(cx + s * 0.75, cy + s * 0.75); ctx.stroke();
}
function pastilleStatut(ctx, cx, cy, r, couleur) {
  ctx.save();
  ctx.shadowColor = couleur; ctx.shadowBlur = 10;
  const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
  g.addColorStop(0, "#ffffff");
  g.addColorStop(0.35, couleur);
  g.addColorStop(1, teinte(couleur, 0.7));
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
function coinOrnement(ctx, x, y, taille, couleur, miroirX, miroirY) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(miroirX ? -1 : 1, miroirY ? -1 : 1);
  ctx.strokeStyle = couleur; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(0, taille); ctx.lineTo(0, 0); ctx.lineTo(taille, 0); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, taille * 0.5); ctx.lineTo(taille * 0.22, taille * 0.22); ctx.lineTo(taille * 0.5, 0);
  ctx.stroke();
  ctx.restore();
}
function particules(ctx, zone, couleur, n) {
  const alea = (() => { let g = 7; return () => (g = (g * 9301 + 49297) % 233280) / 233280; })();
  ctx.fillStyle = couleur;
  for (let i = 0; i < n; i++) {
    ctx.globalAlpha = 0.15 + alea() * 0.2;
    ctx.beginPath();
    ctx.arc(zone.x1 + alea() * (zone.x2 - zone.x1), zone.y1 + alea() * (zone.y2 - zone.y1), 1.4 + alea() * 1.8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

module.exports = {
  config: {
    name: "uptime",
    aliases: ["up", "status"],
    version: "2.0",
    author: "toi",
    countDown: 5,
    role: 0,
    shortDescription: { fr: "Statut visuel du bot (canvas)" },
    longDescription: { fr: "Affiche une carte visuelle avec le temps de fonctionnement et un diagnostic du bot" },
    category: "info",
    guide: { fr: "{pn} : affiche le statut du bot" }
  },

  onStart: async function ({ api, event, usersData }) {
    const { threadID, messageID, senderID } = event;
    const debut = Date.now();

    // --- Vérifications réelles ---
    const resultats = [];
    const verifier = (nom, fn) => {
      try { resultats.push([nom, fn() !== false]); }
      catch { resultats.push([nom, false]); }
    };
    verifier("Commandes chargées", () => (global.GoatBot && global.GoatBot.commands && global.GoatBot.commands.size) > 0);
    verifier("Configuration du bot", () => !!(global.GoatBot && global.GoatBot.config));
    verifier("Envoi de messages", () => typeof api.sendMessage === "function");
    verifier("Lecture du profil", () => typeof api.getUserInfo === "function");
    const toutOk = resultats.every(([, ok]) => ok);

    const ping = Date.now() - debut;
    const dureeBot = formatDuree(process.uptime() * 1000);
    const memoire = formatOctets(process.memoryUsage().heapUsed);
    const charge = os.loadavg()[0].toFixed(2);

    // --- Thème ---
    const PALETTES = [
      { a: "#00e5ff", b: "#2962ff" },
      { a: "#39ff88", b: "#00c2a8" },
      { a: "#ff2e93", b: "#7c4dff" },
      { a: "#ffcc33", b: "#ff6a3d" }
    ];
    const t = PALETTES[Math.floor(Math.random() * PALETTES.length)];
    const accent1 = toutOk ? t.a : "#ff5252";
    const accent2 = toutOk ? t.b : "#b71c1c";

    // --- Canvas ---
    const W = 900, H = 640;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext("2d");

    const fond = ctx.createLinearGradient(0, 0, W, H);
    fond.addColorStop(0, "#0a0e1a");
    fond.addColorStop(1, "#140a2e");
    ctx.fillStyle = fond;
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = "rgba(255,255,255,0.04)";
    ctx.lineWidth = 1;
    for (let gx = 0; gx < W; gx += 36) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke(); }
    for (let gy = 0; gy < H; gy += 36) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke(); }

    ctx.globalAlpha = 0.3;
    const g1 = ctx.createRadialGradient(W, 0, 10, W, 0, 400);
    g1.addColorStop(0, accent1); g1.addColorStop(1, "transparent");
    ctx.fillStyle = g1;
    ctx.beginPath(); ctx.arc(W, 0, 400, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;

    // Cadre
    ctx.strokeStyle = accent1;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect(16, 16, W - 32, H - 32, 16); ctx.stroke();
    ctx.strokeStyle = accent2;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(24, 24, W - 48, H - 48, 12); ctx.stroke();

    [[16, 16, false, false], [W - 16, 16, true, false], [16, H - 16, false, true], [W - 16, H - 16, true, true]]
      .forEach(([cx, cy, mx, my]) => coinOrnement(ctx, cx, cy, 24, accent1, mx, my));

    // Particules décoratives dispersées
    particules(ctx, { x1: 40, y1: 260, x2: W - 40, y2: H - 70 }, accent1, 28);

    // Avatar de l'utilisateur, en haut à droite, dans un cadre hexagonal
    function hexagone(c, x, y, r) {
      c.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i - Math.PI / 6;
        const px = x + r * Math.cos(a), py = y + r * Math.sin(a);
        i === 0 ? c.moveTo(px, py) : c.lineTo(px, py);
      }
      c.closePath();
    }
    try {
      const avatarUrl = usersData && (await usersData.getAvatarUrl(senderID));
      if (avatarUrl) {
        const avatar = await loadImage(avatarUrl);
        const ax = W - 75, ay = 75, ar = 42;
        ctx.save();
        hexagone(ctx, ax, ay, ar);
        ctx.clip();
        ctx.drawImage(avatar, ax - ar, ay - ar, ar * 2, ar * 2);
        ctx.restore();
        const anneau = ctx.createLinearGradient(ax - ar, ay - ar, ax + ar, ay + ar);
        anneau.addColorStop(0, accent1);
        anneau.addColorStop(1, accent2);
        ctx.strokeStyle = anneau; ctx.lineWidth = 3.5;
        hexagone(ctx, ax, ay, ar + 2);
        ctx.stroke();
      }
    } catch (e) {
      // Masqué si la photo ne charge pas
    }

    // En-tête
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 32px Sans-Serif";
    ctx.shadowColor = accent1; ctx.shadowBlur = 16;
    ctx.fillText("STATUT DU BOT", 45, 72);
    ctx.shadowBlur = 0;

    const largeurBadge = toutOk ? 150 : 190;
    const badge = ctx.createLinearGradient(45, 0, 45 + largeurBadge, 0);
    badge.addColorStop(0, accent1); badge.addColorStop(1, accent2);
    ctx.fillStyle = badge;
    ctx.beginPath(); ctx.roundRect(45, 86, largeurBadge, 28, 8); ctx.fill();
    pastilleStatut(ctx, 61, 100, 6, toutOk ? "#ffffff" : "#1a0000");
    ctx.fillStyle = "#0a0e1a";
    ctx.font = "bold 13px Sans-Serif";
    ctx.fillText(toutOk ? "EN LIGNE" : "PROBLÈME DÉTECTÉ", 74, 105);

    // Cartes de statistiques
    const stats = [
      { icone: iconeHorloge, label: "Uptime", valeur: dureeBot },
      { icone: iconeSignal, label: "Ping", valeur: `${ping} ms` },
      { icone: iconePuce, label: "Mémoire", valeur: memoire },
      { icone: iconeJauge, label: "Charge", valeur: charge }
    ];
    let sx = 45, sy = 140;
    const cardW = (W - 90 - 3 * 16) / 4;
    stats.forEach(({ icone, label, valeur }) => {
      ctx.fillStyle = "rgba(255,255,255,0.05)";
      ctx.beginPath(); ctx.roundRect(sx, sy, cardW, 96, 12); ctx.fill();
      ctx.strokeStyle = accent1; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.roundRect(sx, sy, cardW, 96, 12); ctx.stroke();
      icone(ctx, sx + cardW / 2, sy + 32, 13, accent1);
      ctx.fillStyle = "#a8b3cf"; ctx.font = "12px Sans-Serif"; ctx.textAlign = "center";
      ctx.fillText(label, sx + cardW / 2, sy + 60);
      ctx.fillStyle = "#ffffff"; ctx.font = "bold 16px Sans-Serif";
      ctx.fillText(valeur, sx + cardW / 2, sy + 82);
      ctx.textAlign = "left";
      sx += cardW + 16;
    });

    // Ligne de séparation
    ctx.strokeStyle = accent1; ctx.globalAlpha = 0.5; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(45, 258); ctx.lineTo(W - 45, 258); ctx.stroke();
    ctx.globalAlpha = 1;

    // Vérifications (croix / coches)
    ctx.fillStyle = "#ffffff"; ctx.font = "bold 18px Sans-Serif";
    iconeLoupe(ctx, 53, 285, 9, accent1);
    ctx.fillText("Vérifications", 72, 290);

    let vy = 315;
    resultats.forEach(([nom, ok]) => {
      ctx.fillStyle = "rgba(255,255,255,0.04)";
      ctx.beginPath(); ctx.roundRect(45, vy, W - 90, 46, 10); ctx.fill();
      ctx.strokeStyle = ok ? "#2ecc71" : "#ff5252"; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.roundRect(45, vy, W - 90, 46, 10); ctx.stroke();

      // Pastille coche / croix dessinée
      const cx = 72, cy = vy + 23;
      ctx.strokeStyle = ok ? "#2ecc71" : "#ff5252"; ctx.lineWidth = 3; ctx.lineCap = "round";
      ctx.beginPath(); ctx.arc(cx, cy, 13, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath();
      if (ok) {
        ctx.moveTo(cx - 6, cy); ctx.lineTo(cx - 1, cy + 5); ctx.lineTo(cx + 7, cy - 6);
      } else {
        ctx.moveTo(cx - 5, cy - 5); ctx.lineTo(cx + 5, cy + 5);
        ctx.moveTo(cx + 5, cy - 5); ctx.lineTo(cx - 5, cy + 5);
      }
      ctx.stroke();

      ctx.fillStyle = "#ffffff"; ctx.font = "15px Sans-Serif";
      ctx.fillText(nom, 100, vy + 29);
      vy += 54;
    });

    // Pied de page
    ctx.fillStyle = "#6b7aa0"; ctx.font = "13px Sans-Serif";
    ctx.fillText(`Généré le ${new Date().toLocaleString("fr-FR")}`, 45, H - 32);

    // --- Envoi ---
    const cacheDir = path.join(__dirname, "cache");
    const cachePath = path.join(cacheDir, `uptime_${senderID}.png`);
    fs.ensureDirSync(cacheDir);
    fs.writeFileSync(cachePath, canvas.toBuffer("image/png"));

    api.sendMessage(
      { attachment: fs.createReadStream(cachePath) },
      threadID,
      () => fs.unlinkSync(cachePath),
      messageID
    );
  }
};
