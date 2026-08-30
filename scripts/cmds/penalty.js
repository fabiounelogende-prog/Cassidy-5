const { createCanvas, loadImage } = require("canvas");
const fs = require("fs-extra");
const path = require("path");

global.penaltyGames = global.penaltyGames || new Map();

// URLs des éléments photo-réalistes (libres de droits / hébergés)
const ASSETS = {
  stadium: "https://i.ibb.co/L97q09C/stadium-hd.jpg", // Stade pro nuit
  keeperCenter: "https://i.ibb.co/3pYfvhG/keeper-center.png", // Vrai gardien au centre
  keeperLeft: "https://i.ibb.co/30ZJ9Zz/keeper-left.png", // Vrai gardien plonge à gauche
  keeperRight: "https://i.ibb.co/XzYw230/keeper-right.png", // Vrai gardien plonge à droite
  ball: "https://i.ibb.co/0QkXN3v/ball-hd.png" // Vrai ballon de foot FIFA
};

module.exports = {
  config: {
    name: "penalty",
    version: "12.0.0",
    author: "Célestin Olua",
    countDown: 2,
    role: 0,
    shortDescription: "Simulation de Penalty Photo-Réaliste EA Sports",
    longDescription: "Jeu de penalty Ultra-HD utilisant des images photo-réalistes de gardiens et de stades.",
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
      `⚽ 𝐄𝐀 𝐒𝐏𝐎𝐑𝐓𝐒 𝐅𝐂 — 𝐏𝐄𝐍𝐀𝐋𝐓𝐘 𝐑𝐄́𝐀𝐋𝐈𝐒𝐓𝐄\n\n` +
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
   RENDU VISUEL ULTRA PHOTO-RÉALISTE (COMPOSITION D'IMAGES)
============================================================ */

async function renderPenaltyCanvas(senderID, shotDetails, playerDir, keeperDir, gameState) {
  const W = 1000;
  const H = 600;

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  // 1. Fond : Stade Réel HD
  try {
    const bgImage = await loadImage(ASSETS.stadium);
    ctx.drawImage(bgImage, 0, 0, W, H);
  } catch (_) {
    // Fallback fond sombre si indisponible
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, W, H);
  }

  // 2. Chargement du Vrai Gardien selon l'action
  let keeperUrl = ASSETS.keeperCenter;
  let kx = 380, ky = 180, kw = 240, kh = 260; // Dimensions/Positions du gardien

  if (gameState !== "AIMING" && keeperDir) {
    if (keeperDir.includes("gauche")) {
      keeperUrl = ASSETS.keeperLeft;
      kx = 160; ky = 200; kw = 300; kh = 220; // Plonge à gauche
    } else if (keeperDir.includes("droite")) {
      keeperUrl = ASSETS.keeperRight;
      kx = 540; ky = 200; kw = 300; kh = 220; // Plonge à droite
    }
  }

  try {
    const keeperImg = await loadImage(keeperUrl);
    ctx.drawImage(keeperImg, kx, ky, kw, kh);
  } catch (_) {}

  // 3. Avatar du Tireur (Utilisateur Facebook)
  const shooterX = 180;
  const shooterY = H - 120;

  try {
    const avatarUrl = `https://graph.facebook.com/${senderID}/picture?height=300&width=300&access_token=6628568379%7Cc1e620fa708a51564e1d4016e7f86f2b`;
    const userAvatar = await loadImage(avatarUrl);

    // Ombre sous le tireur
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.beginPath();
    ctx.ellipse(shooterX, shooterY + 45, 45, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    // Photo de profil circulaire du joueur
    ctx.save();
    ctx.beginPath();
    ctx.arc(shooterX, shooterY, 45, 0, Math.PI * 2);
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#3b82f6";
    ctx.stroke();
    ctx.clip();
    ctx.drawImage(userAvatar, shooterX - 45, shooterY - 45, 90, 90);
    ctx.restore();
  } catch (_) {}

  // 4. Ballon de Foot Réel HD
  let ballX = W / 2;
  let ballY = H - 100;
  let ballSize = 38;

  if (gameState !== "AIMING" && playerDir) {
    if (playerDir.includes("gauche")) ballX = 260;
    if (playerDir === "centre") ballX = W / 2;
    if (playerDir.includes("droite")) ballX = 740;

    if (shotDetails.height === "ras_du_sol") ballY = 380;
    else if (shotDetails.height === "mi-hauteur") ballY = 280;
    else if (shotDetails.height === "lucarne" || playerDir.includes("lucarne")) ballY = 190;
    else if (shotDetails.height === "panenka") ballY = 260;

    ballSize = 26; // Réduction pour la perspective

    // Trajectoire lumineuse du tir
    ctx.strokeStyle = "rgba(250, 204, 21, 0.7)";
    ctx.lineWidth = 4;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.moveTo(W / 2, H - 100);
    ctx.lineTo(ballX, ballY);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Ombre du ballon
  ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
  ctx.beginPath();
  ctx.ellipse(ballX, ballY + ballSize / 2 + 2, ballSize / 2, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  try {
    const ballImg = await loadImage(ASSETS.ball);
    ctx.drawImage(ballImg, ballX - ballSize / 2, ballY - ballSize / 2, ballSize, ballSize);
  } catch (_) {}

  // 5. Overlay Résultats
  if (gameState === "GOAL") {
    drawBanner(ctx, W, "⚽ GOAL !!!", "#16a34a", "#22c55e");
  } else if (gameState === "SAVED") {
    drawBanner(ctx, W, "💥 PARADE DU GARDIEN !", "#dc2626", "#ef4444");
  }

  const cacheDir = path.join(__dirname, "cache");
  fs.ensureDirSync(cacheDir);
  const cachePath = path.join(cacheDir, `penalty_${senderID}_${Date.now()}.png`);
  fs.writeFileSync(cachePath, canvas.toBuffer("image/png"));

  return cachePath;
}

function drawBanner(ctx, W, text, col1, col2) {
  const grad = ctx.createLinearGradient(0, 220, 0, 310);
  grad.addColorStop(0, col1);
  grad.addColorStop(1, col2);

  ctx.fillStyle = grad;
  ctx.fillRect(0, 220, W, 90);

  ctx.fillStyle = "#ffffff";
  ctx.font = "900 50px 'Arial Black', Impact, sans-serif";
  ctx.textAlign = "center";
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = 6;
  ctx.strokeText(text, W / 2, 285);
  ctx.fillText(text, W / 2, 285);
}

function safeDelete(filePath) {
  try {
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (_) {}
}
