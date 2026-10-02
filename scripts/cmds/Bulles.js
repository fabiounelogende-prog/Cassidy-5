const { createCanvas, loadImage } = require("canvas");
const fs = require("fs-extra");
const path = require("path");

// ---------- Règles ----------
const NAME = "bulles";
const N = 6, TOT = N * N, MAUVAISES = 4, DOREES = 4, PIECE = 25, GAIN_DUEL = 200;
const PAL = [["#ff2e93", "#7c4dff"], ["#00d4ff", "#0057ff"], ["#00ffb3", "#00b0ff"], ["#ffcc33", "#ff6a3d"], ["#c06eff", "#ff6ec7"]];

function theme() {
  const [a, b] = PAL[Math.floor(Math.random() * PAL.length)];
  return { a, b, bg: "#0a0e1a", sub: "#a8b3cf" };
}

const shuffle = (a) => {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};

// type : 0 bulle normale, 1 bulle piégée (duel), 2 bulle dorée (solo)
function creer(duel) {
  const type = Array(TOT).fill(0);
  shuffle([...Array(TOT).keys()]).slice(0, duel ? MAUVAISES : DOREES).forEach((i) => { type[i] = duel ? 1 : 2; });
  return { type, popped: Array(TOT).fill(false) };
}

const coord = (i) => String.fromCharCode(65 + (i % N)) + (Math.floor(i / N) + 1);

async function gain(usersData, uid, n) {
  try {
    const m = (await usersData.get(uid, "money")) || 0;
    await usersData.set(uid, m + n, "money");
    return true;
  } catch { return false; }
}

async function nom(usersData, uid) {
  try { return (await usersData.getName(uid)) || "Joueur"; } catch { return "Joueur"; }
}

async function photo(usersData, uid) {
  try { return await loadImage(await usersData.getAvatarUrl(uid)); } catch { return null; }
}

// ---------- Dessin ----------
function hex(ctx, x, y, r) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i - Math.PI / 6;
    i ? ctx.lineTo(x + r * Math.cos(a), y + r * Math.sin(a)) : ctx.moveTo(x + r * Math.cos(a), y + r * Math.sin(a));
  }
  ctx.closePath();
}

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
  ctx.font = "bold 46px Sans-Serif";
  ctx.shadowColor = th.a;
  ctx.shadowBlur = 18;
  ctx.fillText(titre, W / 2, 88);
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

// Photo du joueur dans un cadre hexagonal (lumineux si c'est son tour)
function avatar(ctx, img, x, y, r, col, actif) {
  ctx.save();
  hex(ctx, x, y, r);
  ctx.clip();
  if (img) ctx.drawImage(img, x - r, y - r, r * 2, r * 2);
  else {
    ctx.fillStyle = "#222b40";
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
    ctx.fillStyle = "#a8b3cf";
    ctx.font = "bold 48px Sans-Serif";
    ctx.fillText("?", x, y + 16);
  }
  ctx.restore();
  ctx.save();
  ctx.strokeStyle = col;
  ctx.lineWidth = actif ? 7 : 3;
  ctx.shadowColor = col;
  ctx.shadowBlur = actif ? 24 : 0;
  ctx.globalAlpha = actif ? 1 : 0.6;
  hex(ctx, x, y, r + 3);
  ctx.stroke();
  ctx.restore();
}

function couronne(ctx, x, y) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = "#ffd54a";
  ctx.shadowColor = "#ffd54a";
  ctx.shadowBlur = 16;
  ctx.beginPath();
  ctx.moveTo(-26, 0); ctx.lineTo(-26, -24); ctx.lineTo(-13, -10); ctx.lineTo(0, -30);
  ctx.lineTo(13, -10); ctx.lineTo(26, -24); ctx.lineTo(26, 0);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function perdu(ctx, x, y, r) {
  ctx.save();
  hex(ctx, x, y, r);
  ctx.fillStyle = "rgba(255,59,48,0.5)";
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = "#fff";
  ctx.font = "bold 40px Sans-Serif";
  ctx.fillText("KO", x, y + 14);
}

function bulle(ctx, x, y, r, type, popped, revele, th) {
  if (popped) {
    if (type === 1) {
      ctx.save();
      ctx.translate(x, y);
      const g = ctx.createRadialGradient(0, 0, 4, 0, 0, r);
      g.addColorStop(0, "#ffe27a");
      g.addColorStop(1, "#ff3b30");
      ctx.fillStyle = g;
      ctx.shadowColor = "#ff3b30";
      ctx.shadowBlur = 14;
      ctx.beginPath();
      for (let i = 0; i < 16; i++) {
        const a = (Math.PI * i) / 8, rr = i % 2 ? r * 0.55 : r;
        i ? ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = "#fff";
      ctx.font = "bold 34px Sans-Serif";
      ctx.fillText("!", x, y + 12);
      return;
    }
    // Bulle éclatée : aplatie, avec de petits plis (ou une pièce si dorée)
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.beginPath();
    ctx.arc(x, y, r, 0, 7);
    ctx.fill();
    ctx.strokeStyle = type === 2 ? "#ffd54a" : "rgba(255,255,255,0.18)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, r * 0.8, 0, 7);
    ctx.stroke();
    if (type === 2) {
      ctx.fillStyle = "#ffd54a";
      ctx.font = "bold 26px Sans-Serif";
      ctx.fillText("+" + PIECE, x, y + 9);
    } else {
      ctx.strokeStyle = "rgba(255,255,255,0.22)";
      ctx.lineWidth = 2;
      for (let i = 0; i < 5; i++) {
        const a = (Math.PI * 2 * i) / 5;
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(a) * r * 0.15, y + Math.sin(a) * r * 0.15);
        ctx.lineTo(x + Math.cos(a) * r * 0.45, y + Math.sin(a) * r * 0.45);
        ctx.stroke();
      }
    }
    return;
  }
  // Bulle intacte, translucide (ou piège révélé en fin de duel)
  ctx.save();
  ctx.globalAlpha = 0.4;
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
  g.addColorStop(0, "#ffffff");
  g.addColorStop(0.5, revele ? "#ff3b30" : th.a);
  g.addColorStop(1, revele ? "#8f0a1e" : th.b);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, 7);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = revele ? "#ff3b30" : th.a;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, 7);
  ctx.stroke();
  ctx.save();
  ctx.globalAlpha = 0.65;
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.ellipse(x - r * 0.35, y - r * 0.4, r * 0.22, r * 0.12, -0.6, 0, 7);
  ctx.fill();
  ctx.restore();
  if (revele) {
    ctx.fillStyle = "#ff3b30";
    ctx.font = "bold 30px Sans-Serif";
    ctx.fillText("!", x, y + 11);
  }
}

function dessiner(S, th, titre, fin, perdant) {
  const W = 800, H = 1100, x0 = 100, y0 = 360, C = 100, duel = S.mode === "duel";
  const { canvas, ctx } = base(W, H, th, "BULLES ANTI-STRESS");
  const px = [160, 640], cols = [th.a, th.b];

  avatar(ctx, S.imgs[0], px[0], 185, 62, cols[0], !fin && S.tour === 0);
  if (duel) {
    avatar(ctx, S.imgs[1], px[1], 185, 62, cols[1], !fin && S.tour === 1);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 54px Sans-Serif";
    ctx.fillText("VS", 400, 205);
    if (fin) {
      couronne(ctx, px[1 - perdant], 185 - 62 - 14);
      perdu(ctx, px[perdant], 185, 62);
    }
  } else {
    const n = S.popped.filter(Boolean).length, pieces = S.popped.filter((p, i) => p && S.type[i] === 2).length;
    stat(ctx, 290, 135, 200, "ÉCLATÉES", `${n}/${TOT}`, th);
    stat(ctx, 510, 135, 200, "PIÈCES", pieces * PIECE, th);
  }
  ctx.fillStyle = "#fff";
  ctx.font = "bold 24px Sans-Serif";
  S.names.forEach((nm, i) => ctx.fillText(String(nm).slice(0, 14), px[i], 272));
  ctx.fillStyle = th.a;
  ctx.font = "bold 28px Sans-Serif";
  ctx.fillText(titre, W / 2, 318);

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
    ctx.fillText(String.fromCharCode(65 + i), x0 + i * C + C / 2, y0 - 18);
    ctx.fillText(String(i + 1), x0 - 38, y0 + i * C + C / 2 + 8);
  }
  for (let i = 0; i < TOT; i++) {
    bulle(ctx, x0 + (i % N) * C + C / 2, y0 + Math.floor(i / N) * C + C / 2, 38, S.type[i], S.popped[i], fin && duel && S.type[i] === 1 && !S.popped[i], th);
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
  ctx.fillText(fin ? "Relance la commande pour rejouer" : duel ? "Réponds avec UNE case  •  ex : B3" : "Réponds avec une ou plusieurs cases  •  ex : B3 D5 A1", W / 2, H - 38);
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
    global.GoatBot.onReply.set(info.messageID, { commandName: NAME, messageID: info.messageID, ...etat });
  }, messageID);
}

module.exports = {
  config: {
    name: "bulles",
    aliases: ["pop", "bubble", "bubbles", "antistress2"],
    version: "1.0.0",
    author: "YourName",
    countDown: 5,
    role: 0,
    shortDescription: "Jeu anti-stress : éclate des bulles (solo ou duel)",
    longDescription: `Solo : éclate les bulles pour te détendre, ${DOREES} bulles dorées donnent ${PIECE} pièces. Duel : à tour de rôle, celui qui éclate une bulle piégée perd (+${GAIN_DUEL} pour le gagnant). Avec la photo des joueurs.`,
    category: "game",
    guide: "{pn} : jouer seul\n{pn} @membre : duel (ou en répondant à son message)\nRéponds à l'image avec une case, ex : B3"
  },

  onStart: async function ({ api, event, usersData }) {
    const { threadID, messageID, senderID, mentions, messageReply } = event;
    const th = theme();
    const opp = Object.keys(mentions || {})[0] || (messageReply && messageReply.senderID);
    if (opp && opp === senderID) return api.sendMessage("⚠️ Tu ne peux pas te défier toi-même. Lance la commande sans mention pour jouer seul.", threadID, messageID);
    if (opp && typeof api.getCurrentUserID === "function" && opp === api.getCurrentUserID()) return api.sendMessage("⚠️ Le bot ne joue pas, défie un membre du groupe !", threadID, messageID);

    const duel = !!opp, players = duel ? [senderID, opp] : [senderID];
    const names = await Promise.all(players.map((u) => nom(usersData, u)));
    const imgs = await Promise.all(players.map((u) => photo(usersData, u)));
    const S = { mode: duel ? "duel" : "solo", ...creer(duel), players, names, imgs, tour: 0, th };

    const body = duel
      ? `🫧 BULLES ANTI-STRESS — DUEL\n\n⚔️ ${names[0]} VS ${names[1]}\n💣 ${MAUVAISES} bulles piégées sont cachées parmi ${TOT}.\n👉 À tour de rôle, éclatez UNE bulle (ex : B3).\n💥 Celui qui éclate une bulle piégée perd !\n\n🎯 ${names[0]}, tu commences !`
      : `🫧 BULLES ANTI-STRESS\n\nRespire et éclate les bulles à ton rythme. 🧘\n👉 Réponds avec une ou plusieurs cases (ex : B3 D5 A1).\n✨ ${DOREES} bulles dorées sont cachées : +${PIECE} 💰 chacune.`;
    await envoyer(api, threadID, messageID, body, dessiner(S, th, duel ? `AU TOUR DE ${String(names[0]).toUpperCase()}` : "DÉTENDS-TOI", false), senderID, S);
  },

  onReply: async function ({ api, event, Reply: S, usersData }) {
    const { threadID, messageID, senderID, body } = event;
    const duel = S.mode === "duel";
    if (!S.players.includes(senderID)) return;
    if (senderID !== S.players[S.tour]) return api.sendMessage(`⏳ Ce n'est pas ton tour, c'est à ${S.names[S.tour]} de jouer.`, threadID, messageID);

    const m = [...String(body || "").toUpperCase().matchAll(/([A-F])\s*([1-6])/g)];
    if (!m.length) return api.sendMessage("⚠️ Écris une case, par exemple : B3", threadID, messageID);
    const libres = [...new Set(m.map((x) => (+x[2] - 1) * N + (x[1].charCodeAt(0) - 65)))].filter((i) => !S.popped[i]);
    if (!libres.length) return api.sendMessage("⚠️ Cette bulle est déjà éclatée, choisis-en une autre.", threadID, messageID);
    const choisies = duel ? libres.slice(0, 1) : libres;

    global.GoatBot.onReply.delete(S.messageID);
    const popped = S.popped.slice();
    let pieces = 0, perdant = -1;
    choisies.forEach((i) => {
      popped[i] = true;
      if (S.type[i] === 2) pieces++;
      if (S.type[i] === 1) perdant = S.tour;
    });
    const noms = choisies.map(coord).join(" ");
    const etat = { ...S, popped, tour: duel && perdant < 0 ? 1 - S.tour : S.tour };
    const restantes = popped.filter((p) => !p).length;
    let msg, titre, fin = false;

    if (duel && perdant >= 0) {
      const g = 1 - perdant, ok = await gain(usersData, S.players[g], GAIN_DUEL);
      fin = true;
      titre = "BOUM !";
      msg = `💥 BOUM ! ${S.names[perdant]} a éclaté une bulle piégée (${noms}) !\n🏆 ${S.names[g]} gagne le duel !${ok ? ` +${GAIN_DUEL} 💰` : ""}\n🔁 Relancez la commande pour une revanche.`;
    } else if (duel) {
      titre = `AU TOUR DE ${String(S.names[etat.tour]).toUpperCase()}`;
      msg = `🫧 Pop ! ${S.names[S.tour]} éclate ${noms} : rien d'explosif.\n🎯 Au tour de ${S.names[etat.tour]} (${restantes} bulles restantes).`;
    } else {
      if (pieces) await gain(usersData, senderID, pieces * PIECE);
      fin = restantes === 0;
      titre = fin ? "ZEN ATTEINT !" : "DÉTENDS-TOI";
      msg = `🫧 ${"pop ".repeat(Math.min(choisies.length, 8)).trim()} !` +
        (pieces ? `\n🪙 Bulle dorée ! +${pieces * PIECE} 💰` : "") +
        `\n🧘 ${TOT - restantes}/${TOT} bulles éclatées` +
        (fin ? "\n🌿 Toutes les bulles sont éclatées, quelle détente !\n🔁 Relance la commande pour une nouvelle feuille." : "");
    }

    await envoyer(api, threadID, messageID, msg, dessiner(etat, S.th, titre, fin, perdant), senderID, fin ? null : etat);
  }
};
