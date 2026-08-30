const { createCanvas, loadImage } = require("canvas");
const fs = require("fs-extra");
const path = require("path");

global.penaltyGames = global.penaltyGames || new Map();

module.exports = {
  config: {
    name: "penalty",
    version: "10.0.0",
    author: "Célestin Olua",
    countDown: 2,
    role: 0,
    shortDescription: "Simulation de Penalty Retro Arcade",
    longDescription: "Jeu de penalty 2D avec rendu graphique arcade style rétro.",
    category: "game",
    guide: "{pn} <distance>\nExemple : {pn} 11"
  },

  onStart: async function ({ api, event, args }) {
    const { threadID, messageID, senderID } = event;

    let rawDist = args[0] ? String(args[0]).replace(/m/gi, "") : "11";
    let distance = parseInt(rawDist);

    if (isNaN(distance) || distance < 5 || distance > 500) {
      return api.sendMessage(
        "⚠️ Indique une distance valide entre 5m et 500m.\nExemple : /penalty 11",
        threadID,
        messageID
      );
    }

    const windSpeed = Math.floor(Math.random() * 25);
    const windDir = ["NORD", "SUD", "EST", "OUEST"][Math.floor(Math.random() * 4)];
    const pressure = Math.min(100, Math.floor((distance / 11) * 20));

    const gameData = { distance, windSpeed, windDir, pressure };

    global.penaltyGames.set(senderID, {
      step: "WAITING_SHOT",
      gameData,
      threadID
    });

    const cachePath = await renderPenaltyCanvas(senderID, gameData, null, null, "AIMING");

    const msg =
      `⚽ 𝐄𝐀 𝐒𝐏𝐎𝐑𝐓𝐒 𝐅𝐂 — 𝐏𝐄𝐍𝐀𝐋𝐓𝐘 𝐒𝐈𝐌𝐔𝐋𝐀𝐓𝐎𝐑\n\n` +
      `📏 Distance : ${distance} mètres\n` +
      `💨 Vent : ${windSpeed} km/h (${windDir})\n` +
      `🧠 Pression : ${pressure} %\n` +
      `💰 Gain potentiel : ${distance * 300} $\n\n` +
      `🎯 **RÉPONDS AVEC TES CHOIX TACTIQUES**\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `1️⃣ **Direction** : gauche | centre | droite | lucarne_gauche | lucarne_droite\n` +
      `2️⃣ **Puissance** (1 à 100) : ex. 80\n` +
      `3️⃣ **Hauteur** : ras_du_sol | mi-hauteur | lucarne | panenka\n` +
      `4️⃣ **Effet** : brosse | plat | coupe\n` +
      `5️⃣ **Élan** : normal | feinte | rapide\n\n` +
      `👉 *Exemple de réponse* : gauche 80 lucarne brosse feinte`;

    return api.sendMessage(
      {
        body: msg,
        attachment: fs.createReadStream(cachePath)
      },
      threadID,
      (err, info) => {
        if (!err && info) {
          global.GoatBot.onReply.set(info.messageID, {
            commandName: "penalty",
            author: senderID,
            gameData
          });
        }
        safeDelete(cachePath);
      },
      messageID
    );
  },

  onReply: async function ({ api, event, Reply, usersData }) {
    const { threadID, messageID, senderID, body } = event;

    if (senderID !== Reply.author) return;

    const args = String(body || "").trim().toLowerCase().split(/\s+/);

    const inputDir = args[0] || "centre";
    const power = Math.min(100, Math.max(1, parseInt(args[1]) || 50));
    const height = args[2] || "mi-hauteur";
    const spin = args[3] || "plat";
    const runup = args[4] || "normal";

    const validDirs = ["gauche", "centre", "droite", "lucarne_gauche", "lucarne_droite"];
    const validHeights = ["ras_du_sol", "mi-hauteur", "lucarne", "panenka"];

    const selectedDir = validDirs.includes(inputDir) ? inputDir : "centre";
    const selectedHeight = validHeights.includes(height) ? height : "mi-hauteur";

    const gameData = Reply.gameData || { distance: 11, windSpeed: 0, windDir: "NORD", pressure: 20 };
    const { distance, windSpeed, pressure } = gameData;

    const keeperDirs = ["gauche", "centre", "droite", "lucarne_gauche", "lucarne_droite"];
    const keeperChoice = keeperDirs[Math.floor(Math.random() * keeperDirs.length)];

    let missReason = null;
    let isGoal = false;

    if (power > 88 && Math.random() < (power - 80) * 0.04) {
      missReason = "BARRE / AU-DESSUS";
    } else if (distance > 15 && (windSpeed > 15 || pressure > 50) && Math.random() < 0.15) {
      missReason = "POTEAU / À CÔTÉ";
    } else if (runup === "feinte" && Math.random() < 0.25) {
      missReason = "ARRÊTÉ PAR LE GARDIEN";
    } else {
      if (selectedDir !== keeperChoice) {
        if (selectedHeight === "panenka" && keeperChoice === "centre") {
          missReason = "CAPTÉ AU CENTRE";
        } else {
          isGoal = true;
        }
      } else {
        if ((selectedDir.includes("lucarne") || power > 85) && Math.random() > 0.45) {
          isGoal = true;
        } else {
          missReason = "PARADE DU GARDIEN";
        }
      }
    }

    const prizeMoney = distance * 300;

    if (isGoal) {
      const userData = await usersData.get(senderID);
      await usersData.set(senderID, {
        money: (Number(userData.money) || 0) + prizeMoney
      });
    }

    global.penaltyGames.delete(senderID);
    if (global.GoatBot?.onReply?.delete) {
      global.GoatBot.onReply.delete(Reply.messageID);
    }

    const state = isGoal ? "GOAL" : "SAVED";

    const shotDetails = {
      ...gameData,
      dir: selectedDir,
      power,
      height: selectedHeight,
      spin,
      runup,
      keeperChoice,
      missReason
    };

    const cachePath = await renderPenaltyCanvas(senderID, shotDetails, selectedDir, keeperChoice, state);

    let resultText = "";
    if (isGoal) {
      resultText =
        `⚽🔥 𝐆𝐎𝐀𝐀𝐀𝐀𝐀𝐋 ! 🔥⚽\n\n` +
        `🏆 **TIR PARFAIT !**\n` +
        `📏 Distance : ${distance}m\n` +
        `💥 Puissance : ${power} %\n` +
        `🎯 Trajectoire : ${selectedDir} (${selectedHeight})\n` +
        `🧤 Gardien : ${keeperChoice}\n` +
        `💰 Gain : +${prizeMoney} $`;
    } else {
      resultText =
        `💥 𝐓𝐈𝐑 𝐌𝐀𝐍𝐐𝐔𝐄́ / 𝐏𝐀𝐑𝐀𝐃𝐄 !\n\n` +
        `❌ Raison : ${missReason || "Arrêt du gardien"}\n` +
        `📏 Distance : ${distance}m\n` +
        `🎯 Tir : ${selectedDir} | Puissance : ${power}%\n` +
        `🧤 Gardien : ${keeperChoice}`;
    }

    return api.sendMessage(
      {
        body: resultText,
        attachment: fs.createReadStream(cachePath)
      },
      threadID,
      () => safeDelete(cachePath),
      messageID
    );
  }
};

/* ============================================================
   RENDU VISUEL CANVAS (STYLE 2D ARCADE RETRO EXACT)
============================================================ */

async function renderPenaltyCanvas(senderID, shotDetails, playerDir, keeperDir, gameState) {
  const W = 800;
  const H = 600;

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;

  // 1. Arrière-plan : Tribunes / Public
  ctx.fillStyle = "#1e293b";
  ctx.fillRect(0, 0, W, 80);

  // Silhouettes de supporters
  ctx.fillStyle = "#0f172a";
  for (let x = 0; x < W; x += 15) {
    const h = 20 + (x % 7) * 4;
    ctx.beginPath();
    ctx.arc(x + 7, 80 - h, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(x + 3, 80 - h, 8, h);
  }

  // Mur gris sous la tribune
  ctx.fillStyle = "#94a3b8";
  ctx.fillRect(0, 80, W, 30);
  ctx.fillStyle = "#64748b";
  ctx.fillRect(0, 108, W, 2);

  // 2. Terrain / Pelouse à rayures horizontales
  const pitchY = 110;
  const stripeHeight = 45;
  let isDark = false;

  for (let y = pitchY; y < H; y += stripeHeight) {
    ctx.fillStyle = isDark ? "#48bb78" : "#38a169";
    ctx.fillRect(0, y, W, Math.min(stripeHeight, H - y));
    isDark = !isDark;
  }

  // Lignes blanches du terrain
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 4;

  // Ligne de but
  ctx.beginPath();
  ctx.moveTo(50, 210);
  ctx.lineTo(750, 210);
  ctx.stroke();

  // Ligne médiane / Surface
  ctx.beginPath();
  ctx.moveTo(0, 360);
  ctx.lineTo(W, 360);
  ctx.stroke();

  // Demi-cercle de la surface de réparation (bas)
  ctx.beginPath();
  ctx.arc(400, 470, 260, Math.PI * 0.12, Math.PI * 0.88);
  ctx.stroke();

  // 3. Cage de But 2D
  const gx = 140, gy = 20, gw = 520, gh = 190;

  // Filet de but (quadrillage)
  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth = 1;
  for (let x = gx; x <= gx + gw; x += 16) {
    ctx.beginPath();
    ctx.moveTo(x, gy);
    ctx.lineTo(x, gy + gh);
    ctx.stroke();
  }
  for (let y = gy; y <= gy + gh; y += 14) {
    ctx.beginPath();
    ctx.moveTo(gx, y);
    ctx.lineTo(gx + gw, y);
    ctx.stroke();
  }

  // Poteaux & Barre transversale
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 8;
  ctx.strokeRect(gx, gy, gw, gh);

  // Étais arrière du filet
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(gx, gy);
  ctx.lineTo(120, 10);
  ctx.lineTo(120, 210);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(gx + gw, gy);
  ctx.lineTo(680, 10);
  ctx.lineTo(680, 210);
  ctx.stroke();

  // 4. Gardien de But Stylisé
  let kx = 400, ky = 165;

  if (gameState !== "AIMING" && keeperDir) {
    if (keeperDir.includes("gauche")) kx = 260;
    if (keeperDir.includes("droite")) kx = 540;
  }

  drawKeeper(ctx, kx, ky);

  // 5. Tireur (Joueur en bas à gauche)
  drawShooter(ctx, 80, 480);

  // 6. Ballon de football
  let ballX = 400;
  let ballY = 510;

  if (gameState !== "AIMING" && playerDir) {
    if (playerDir.includes("gauche")) ballX = 260;
    if (playerDir === "centre") ballX = 400;
    if (playerDir.includes("droite")) ballX = 540;

    ballY = (shotDetails.height === "lucarne" || playerDir.includes("lucarne")) ? 70 : 170;
  }

  drawBall(ctx, ballX, ballY);

  // 7. Overlay RÉSULTAT OVERLAY ("GOAL!!!" / "MISSED!")
  if (gameState === "GOAL") {
    // Bannière Arc-en-ciel / Gradient
    const banner = ctx.createLinearGradient(0, 180, 0, 310);
    banner.addColorStop(0, "rgba(239, 68, 68, 0.85)");
    banner.addColorStop(0.5, "rgba(245, 158, 11, 0.85)");
    banner.addColorStop(1, "rgba(34, 197, 94, 0.85)");
    ctx.fillStyle = banner;
    ctx.fillRect(0, 180, W, 130);

    // Texte GOAL!!!
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#1d4ed8";
    ctx.lineWidth = 10;
    ctx.font = "900 85px 'Arial Black', Impact, sans-serif";
    ctx.textAlign = "center";
    ctx.strokeText("GOAL!!!", W / 2, 275);
    ctx.fillText("GOAL!!!", W / 2, 275);

    // Confettis
    const colors = ["#ef4444", "#3b82f6", "#eab308", "#10b981", "#ec4899"];
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = colors[i % colors.length];
      ctx.fillRect(
        Math.random() * W,
        180 + Math.random() * 130,
        8 + Math.random() * 8,
        8 + Math.random() * 8
      );
    }
  } else if (gameState === "SAVED") {
    // Bandeau sombre pour l'échec
    ctx.fillStyle = "rgba(15, 23, 42, 0.75)";
    ctx.fillRect(0, 200, W, 110);

    // Texte MISSED!
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 8;
    ctx.font = "900 80px 'Arial Black', Impact, sans-serif";
    ctx.textAlign = "center";
    ctx.strokeText("MISSED!", W / 2, 280);
    ctx.fillText("MISSED!", W / 2, 280);
  }

  const cacheDir = path.join(__dirname, "cache");
  fs.ensureDirSync(cacheDir);
  const cachePath = path.join(cacheDir, `penalty_${senderID}_${Date.now()}.png`);
  fs.writeFileSync(cachePath, canvas.toBuffer("image/png"));

  return cachePath;
}

// Dessin du Gardien Stylisé (Orange/Bleu)
function drawKeeper(ctx, x, y) {
  // Tête (Blond)
  ctx.fillStyle = "#facc15";
  ctx.beginPath();
  ctx.arc(x, y - 22, 11, 0, Math.PI * 2);
  ctx.fill();

  // Corps / Maillot Orange
  ctx.fillStyle = "#f97316";
  ctx.fillRect(x - 16, y - 10, 32, 26);

  // Bras écartés
  ctx.fillRect(x - 28, y - 8, 12, 10);
  ctx.fillRect(x + 16, y - 8, 12, 10);

  // Short Bleu
  ctx.fillStyle = "#2563eb";
  ctx.fillRect(x - 15, y + 16, 14, 14);
  ctx.fillRect(x + 1, y + 16, 14, 14);

  // Chaussettes / Chaussures
  ctx.fillStyle = "#ea580c";
  ctx.fillRect(x - 12, y + 30, 8, 12);
  ctx.fillRect(x + 4, y + 30, 8, 12);
}

// Dessin du Tireur (Noir/Blanc)
function drawShooter(ctx, x, y) {
  // Tête (Blond)
  ctx.fillStyle = "#facc15";
  ctx.beginPath();
  ctx.arc(x + 12, y - 24, 13, 0, Math.PI * 2);
  ctx.fill();

  // Maillot Noir
  ctx.fillStyle = "#0f172a";
  ctx.fillRect(x, y - 10, 24, 30);

  // Short Blanc
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(x, y + 20, 24, 16);

  // Jambes / Chaussettes
  ctx.fillStyle = "#0f172a";
  ctx.fillRect(x + 2, y + 36, 8, 22);
  ctx.fillRect(x + 14, y + 36, 8, 22);
}

// Dessin du Ballon Rétro (Noir et Blanc)
function drawBall(ctx, x, y) {
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(x, y, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Motif pentagone intérieur
  ctx.fillStyle = "#000000";
  ctx.beginPath();
  ctx.arc(x, y, 4, 0, Math.PI * 2);
  ctx.fill();
}

function safeDelete(filePath) {
  try {
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (_) {}
}
