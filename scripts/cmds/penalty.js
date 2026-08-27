const { createCanvas, loadImage } = require("canvas");
const fs = require("fs-extra");
const path = require("path");

global.penaltyGames = global.penaltyGames || new Map();

const REAL_ASSETS = {
  stadium: "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=1600&auto=format&fit=crop"
};

module.exports = {
  config: {
    name: "penalty",
    version: "9.0.0",
    author: "Célestin Olua",
    countDown: 2,
    role: 0,
    shortDescription: "Simulation réaliste de Penalty EA SPORTS FC",
    longDescription: "Jeu de penalty sans profil utilisateur avec paramètres avancés : distance, puissance, hauteur, effet, feinte, vent et précision.",
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

    const windSpeed = Math.floor(Math.random() * 25); // km/h
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

    // Physique du tir
    if (power > 88 && Math.random() < (power - 80) * 0.04) {
      missReason = "BARRE / AU-DESSUS (Trop de puissance)";
    } else if (distance > 15 && (windSpeed > 15 || pressure > 50) && Math.random() < 0.15) {
      missReason = "POTEAU / À CÔTÉ (Déviation par le vent et la pression)";
    } else if (runup === "feinte" && Math.random() < 0.25) {
      missReason = "ARRÊTÉ (Élan feinté anticipé par le gardien)";
    } else {
      if (selectedDir !== keeperChoice) {
        if (selectedHeight === "panenka" && keeperChoice === "centre") {
          missReason = "ARRÊTÉ (Panenka captée au centre)";
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
        `🌀 Effet : ${spin} | Élan : ${runup}\n` +
        `🧤 Gardien parti à : ${keeperChoice}\n` +
        `💰 Gain : +${prizeMoney} $\n\n` +
        `🎮 EA SPORTS FC • PENALTY MASTER`;
    } else {
      resultText =
        `💥 𝐓𝐈𝐑 𝐌𝐀𝐍𝐐𝐔𝐄́ / 𝐏𝐀𝐑𝐀𝐃𝐄 !\n\n` +
        `❌ Résultat : ${missReason || "Arrêt du gardien"}\n` +
        `📏 Distance : ${distance}m\n` +
        `🎯 Tir : ${selectedDir} | Puissance : ${power}%\n` +
        `🧤 Gardien : ${keeperChoice}\n\n` +
        `😈 Ajuste tes paramètres et retente ta chance !`;
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
   RENDU VISUEL CANVAS (UNIQUEMENT LE TERRAIN ET LA CAGE)
============================================================ */

async function renderPenaltyCanvas(senderID, shotDetails, playerDir, keeperDir, gameState) {
  const W = 1280;
  const H = 720;

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = true;

  // Ciel / Arrière-plan
  const sky = ctx.createLinearGradient(0, 0, 0, 380);
  sky.addColorStop(0, "#111827");
  sky.addColorStop(0.5, "#1f2937");
  sky.addColorStop(1, "#374151");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  // Stade
  try {
    const stadium = await loadImage(REAL_ASSETS.stadium);
    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.drawImage(stadium, 0, 0, W, 350);
    ctx.restore();
  } catch (_) {}

  // Projecteurs
  drawLighting(ctx, W);

  // Pelouse
  const pitchY = 330;
  const grass = ctx.createLinearGradient(0, pitchY, 0, H);
  grass.addColorStop(0, "#22c55e");
  grass.addColorStop(0.5, "#16a34a");
  grass.addColorStop(1, "#15803d");
  ctx.fillStyle = grass;
  ctx.fillRect(0, pitchY, W, H - pitchY);

  // Lignes du terrain & Surface de réparation
  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(330, 330);
  ctx.lineTo(950, 330);
  ctx.lineTo(1080, H);
  ctx.lineTo(200, H);
  ctx.closePath();
  ctx.stroke();

  // Point de penalty
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(640, 520, 5, 0, Math.PI * 2);
  ctx.fill();

  // Cage de but
  const gx = 425, gy = 195, gw = 430, gh = 170;
  ctx.strokeStyle = "rgba(255,255,255,0.3)";
  ctx.lineWidth = 1;
  for (let x = gx; x <= gx + gw; x += 15) {
    ctx.beginPath();
    ctx.moveTo(x, gy);
    ctx.lineTo(x, gy + gh);
    ctx.stroke();
  }
  for (let y = gy; y <= gy + gh; y += 13) {
    ctx.beginPath();
    ctx.moveTo(gx, y);
    ctx.lineTo(gx + gw, y);
    ctx.stroke();
  }
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 8;
  ctx.strokeRect(gx, gy, gw, gh);

  // Gardien de but (Stylisé)
  let kx = 640, ky = 295;
  if (gameState !== "AIMING" && keeperDir) {
    if (keeperDir.includes("gauche")) kx = 480;
    if (keeperDir.includes("droite")) kx = 800;
  }
  ctx.fillStyle = "#facc15";
  ctx.beginPath();
  ctx.arc(kx, ky - 25, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(kx - 18, ky - 10, 36, 45);

  // Trajectoire & Ballon
  let ballX = 640;
  let ballY = 520;

  if (gameState !== "AIMING" && playerDir) {
    ballY = (shotDetails.height === "lucarne" || playerDir.includes("lucarne")) ? 220 : 310;
    if (playerDir.includes("gauche")) ballX = 480;
    if (playerDir === "centre") ballX = 640;
    if (playerDir.includes("droite")) ballX = 800;

    // Trait de trajectoire
    ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(640, 520);
    ctx.lineTo(ballX, ballY);
    ctx.stroke();
  }

  // Dessin du Ballon
  const ballGrad = ctx.createRadialGradient(ballX - 3, ballY - 4, 2, ballX, ballY, 14);
  ballGrad.addColorStop(0, "#ffffff");
  ballGrad.addColorStop(1, "#9ca3af");
  ctx.fillStyle = ballGrad;
  ctx.beginPath();
  ctx.arc(ballX, ballY, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 1;
  ctx.stroke();

  // Overlay HUD (Saisie & Mesures)
  ctx.fillStyle = "rgba(0,0,0,0.75)";
  ctx.fillRect(0, 0, W, 60);

  ctx.fillStyle = "#facc15";
  ctx.font = "bold 22px Arial";
  ctx.textAlign = "left";
  ctx.fillText("EA SPORTS FC • SIMULATOR", 30, 38);

  ctx.fillStyle = "#ffffff";
  ctx.font = "14px Arial";
  ctx.textAlign = "right";
  const hudInfo = gameState === "AIMING"
    ? `DISTANCE: ${shotDetails.distance}M  |  VENT: ${shotDetails.windSpeed}KM/H  |  PRESSION: ${shotDetails.pressure}%`
    : `TIR: ${shotDetails.dir.toUpperCase()}  |  FORCE: ${shotDetails.power}%  |  GARDIEN: ${shotDetails.keeperChoice.toUpperCase()}`;
  ctx.fillText(hudInfo, W - 30, 38);

  // Écriture du résultat sur l'image
  if (gameState === "GOAL") {
    ctx.fillStyle = "rgba(34, 197, 94, 0.3)";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 80px Arial";
    ctx.textAlign = "center";
    ctx.fillText("GOAL !", W / 2, H / 2);
  } else if (gameState === "SAVED") {
    ctx.fillStyle = "rgba(239, 68, 68, 0.3)";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 70px Arial";
    ctx.textAlign = "center";
    ctx.fillText("MANQUÉ !", W / 2, H / 2);
  }

  const cacheDir = path.join(__dirname, "cache");
  fs.ensureDirSync(cacheDir);
  const cachePath = path.join(cacheDir, `penalty_${senderID}_${Date.now()}.png`);
  fs.writeFileSync(cachePath, canvas.toBuffer("image/png"));

  return cachePath;
}

function drawLighting(ctx, W) {
  const lights = [150, W - 150];
  for (const x of lights) {
    const glow = ctx.createRadialGradient(x, 50, 5, x, 50, 120);
    glow.addColorStop(0, "rgba(255,255,255,0.4)");
    glow.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, 50, 120, 0, Math.PI * 2);
    ctx.fill();
  }
}

function safeDelete(filePath) {
  try {
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (_) {}
}
