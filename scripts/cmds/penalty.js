const { createCanvas, loadImage } = require("canvas");
const fs = require("fs-extra");
const path = require("path");

global.penaltyGames = global.penaltyGames || new Map();

const REAL_ASSETS = {
  stadium:
    "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=1600&auto=format&fit=crop"
};

module.exports = {
  config: {
    name: "penalty",
    version: "7.0.0",
    author: "Célestin Olua",
    countDown: 2,
    role: 0,
    shortDescription: "Penalty PS4 réaliste façon FIFA",
    longDescription:
      "Jeu de penalty avec stade, tribunes, terrain en perspective, gardien, joueur, ballon, HUD et effets visuels façon jeu de football.",
    category: "game",
    guide: "{pn} <distance>\nExemple : {pn} 11"
  },

  onStart: async function ({ api, event, args, usersData }) {
    const { threadID, messageID, senderID } = event;

    let rawDist = args[0] ? String(args[0]).replace(/m/gi, "") : "11";
    let distance = parseInt(rawDist);

    if (isNaN(distance) || distance < 5 || distance > 500) {
      return api.sendMessage(
        "⚠️ Indique une distance entre 5m et 500m.\nExemple : /penalty 11",
        threadID,
        messageID
      );
    }

    global.penaltyGames.set(senderID, {
      step: "WAITING_DIRECTION",
      distance,
      threadID
    });

    const cachePath = await renderRealPS4Screen(
      senderID,
      usersData,
      distance,
      null,
      null,
      "AIMING"
    );

    const msg =
      `⚽ 𝐄𝐀 𝐒𝐏𝐎𝐑𝐓𝐒 𝐅𝐂 — 𝐏𝐄𝐍𝐀𝐋𝐓𝐘\n\n` +
      `📏 Distance : ${distance} mètres\n` +
      `💰 Gain potentiel : ${distance * 250} $\n\n` +
      `🎯 CHOISIS LA DIRECTION DU TIR\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `⬅️ gauche\n` +
      `⬆️ centre\n` +
      `➡️ droite\n\n` +
      `🎮 Réponds simplement avec ta direction.`;

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
            distance
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

    const inputDirection = String(body || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

    const validDirections = ["gauche", "centre", "droite"];

    if (!validDirections.includes(inputDirection)) {
      return api.sendMessage(
        "❌ Direction invalide.\n\n⬅️ gauche\n⬆️ centre\n➡️ droite",
        threadID,
        messageID
      );
    }

    const distance = Number(Reply.distance) || 11;

    const directionsList = ["gauche", "centre", "droite"];

    const keeperChoice =
      directionsList[Math.floor(Math.random() * directionsList.length)];

    /*
     * Plus la distance augmente, plus le tir devient difficile.
     * Cela garde cependant une chance raisonnable de marquer.
     */
    const distanceDifficulty = Math.min(distance / 250, 0.22);

    let isGoal;

    if (inputDirection !== keeperChoice) {
      isGoal = Math.random() > distanceDifficulty;
    } else {
      isGoal = Math.random() > 0.82;
    }

    const prizeMoney = distance * 250;

    if (isGoal) {
      const userData = await usersData.get(senderID);

      await usersData.set(senderID, {
        money: (Number(userData.money) || 0) + prizeMoney
      });
    }

    global.penaltyGames.delete(senderID);

    if (
      global.GoatBot &&
      global.GoatBot.onReply &&
      typeof global.GoatBot.onReply.delete === "function"
    ) {
      global.GoatBot.onReply.delete(Reply.messageID);
    }

    const state = isGoal ? "GOAL" : "SAVED";

    const cachePath = await renderRealPS4Screen(
      senderID,
      usersData,
      distance,
      inputDirection,
      keeperChoice,
      state
    );

    let resultText;

    if (isGoal) {
      resultText =
        `⚽🔥 𝐆𝐎𝐀𝐀𝐀𝐀𝐀𝐋 ! 🔥⚽\n\n` +
        `🏆 ÉNORME PENALTY !\n\n` +
        `📏 Distance : ${distance}m\n` +
        `🎯 Tir : ${inputDirection}\n` +
        `🧤 Gardien : ${keeperChoice}\n` +
        `💰 Gain : +${prizeMoney} $\n\n` +
        `🎮 EA SPORTS FC • PENALTY`;
    } else {
      resultText =
        `🧤💥 𝐏𝐀𝐑𝐀𝐃𝐄 !\n\n` +
        `Le gardien a arrêté ton penalty !\n\n` +
        `📏 Distance : ${distance}m\n` +
        `🎯 Tir : ${inputDirection}\n` +
        `🧤 Arrêt : ${keeperChoice}\n\n` +
        `😈 Retente ta chance !`;
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
   RENDU PRINCIPAL
============================================================ */

async function renderRealPS4Screen(
  senderID,
  usersData,
  distance,
  playerDir,
  keeperDir,
  gameState
) {
  const W = 1280;
  const H = 720;

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  ctx.imageSmoothingEnabled = true;

  drawBackground(ctx, W, H);

  let stadiumLoaded = false;

  try {
    const stadium = await loadImage(REAL_ASSETS.stadium);

    ctx.save();

    ctx.globalAlpha = 0.88;
    ctx.drawImage(stadium, 0, 0, W, 355);

    ctx.restore();

    stadiumLoaded = true;
  } catch (error) {
    stadiumLoaded = false;
  }

  if (!stadiumLoaded) {
    drawDetailedStands(ctx, W, 0, 355);
  }

  drawStadiumLighting(ctx, W, H);

  drawCrowdDetailed(ctx, W, 65, 285);

  drawPitchRealistic(ctx, W, H);

  drawPenaltyArea(ctx, W, H);

  drawGoalRealistic(ctx, W);

  const keeperPose = gameState === "AIMING" ? "ready" : "dive";

  drawGoalkeeperRealistic(
    ctx,
    keeperDir,
    keeperPose,
    gameState
  );

  const shooterPose =
    gameState === "AIMING" ? "approach" : "kick";

  await drawShooterRealistic(
    ctx,
    senderID,
    usersData,
    playerDir,
    shooterPose
  );

  let ballX = 640;
  let ballY = 505;

  if (gameState !== "AIMING") {
    ballY = 315;

    if (playerDir === "gauche") {
      ballX = 480;
    }

    if (playerDir === "centre") {
      ballX = 640;
    }

    if (playerDir === "droite") {
      ballX = 800;
    }

    drawBallTrail(ctx, ballX, ballY);
  }

  drawBallRealistic(ctx, ballX, ballY);

  drawCameraEffects(ctx, W, H);

  drawHUD(ctx, W, H, distance, gameState);

  if (gameState === "GOAL") {
    drawGoalOverlay(ctx, W, H);
  }

  if (gameState === "SAVED") {
    drawSavedOverlay(ctx, W, H);
  }

  const cacheDir = path.join(__dirname, "cache");

  fs.ensureDirSync(cacheDir);

  const cachePath = path.join(
    cacheDir,
    `penalty_${senderID}_${Date.now()}.png`
  );

  fs.writeFileSync(
    cachePath,
    canvas.toBuffer("image/png")
  );

  return cachePath;
}

/* ============================================================
   BACKGROUND
============================================================ */

function drawBackground(ctx, W, H) {
  const sky = ctx.createLinearGradient(0, 0, 0, 380);

  sky.addColorStop(0, "#111827");
  sky.addColorStop(0.45, "#27384d");
  sky.addColorStop(1, "#6d8094");

  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  /*
   * Halo lumineux derrière le stade
   */
  const glow = ctx.createRadialGradient(
    W / 2,
    180,
    20,
    W / 2,
    180,
    500
  );

  glow.addColorStop(0, "rgba(255,255,255,0.30)");
  glow.addColorStop(1, "rgba(255,255,255,0)");

  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, 400);
}

/* ============================================================
   TRIBUNES
============================================================ */

function drawDetailedStands(ctx, W, y, h) {
  const grad = ctx.createLinearGradient(0, y, 0, y + h);

  grad.addColorStop(0, "#161b21");
  grad.addColorStop(1, "#343b43");

  ctx.fillStyle = grad;
  ctx.fillRect(0, y, W, h);

  for (let row = 0; row < 10; row++) {
    const ry = y + 45 + row * 28;

    ctx.fillStyle =
      row % 2 === 0
        ? "#3c444d"
        : "#252c33";

    ctx.fillRect(0, ry, W, 22);
  }

  for (let x = 20; x < W; x += 32) {
    ctx.fillStyle = "#e5e7eb";

    ctx.fillRect(x, 55, 4, 8);
  }
}

/* ============================================================
   PUBLIC
============================================================ */

function drawCrowdDetailed(ctx, W, y, h) {
  const shirts = [
    "#ef4444",
    "#2563eb",
    "#f59e0b",
    "#16a34a",
    "#f8fafc",
    "#7c3aed",
    "#06b6d4",
    "#f97316",
    "#111827"
  ];

  const skins = [
    "#f5cfa8",
    "#e7b27d",
    "#c68642",
    "#8d5524",
    "#ffdbac"
  ];

  let seed = 92731;

  function random() {
    seed =
      (seed * 1664525 + 1013904223) >>> 0;

    return seed / 4294967296;
  }

  for (let row = 0; row < 25; row++) {
    const baseY = y + row * 10;

    for (
      let x = -5;
      x < W + 5;
      x += 10
    ) {
      const px =
        x + (random() - 0.5) * 7;

      const py =
        baseY + (random() - 0.5) * 5;

      const headSize =
        1.6 + random() * 1.5;

      ctx.fillStyle =
        skins[
          Math.floor(
            random() * skins.length
          )
        ];

      ctx.beginPath();

      ctx.arc(
        px,
        py,
        headSize,
        0,
        Math.PI * 2
      );

      ctx.fill();

      ctx.fillStyle =
        shirts[
          Math.floor(
            random() * shirts.length
          )
        ];

      ctx.beginPath();

      ctx.ellipse(
        px,
        py + 4,
        3.5,
        4,
        0,
        0,
        Math.PI * 2
      );

      ctx.fill();

      /*
       * Quelques supporters lèvent les bras
       */
      if (random() > 0.92) {
        ctx.strokeStyle =
          ctx.fillStyle;

        ctx.lineWidth = 1;

        ctx.beginPath();

        ctx.moveTo(px - 2, py + 3);
        ctx.lineTo(px - 6, py - 3);

        ctx.moveTo(px + 2, py + 3);
        ctx.lineTo(px + 6, py - 3);

        ctx.stroke();
      }
    }
  }

  const shade = ctx.createLinearGradient(
    0,
    y,
    0,
    y + h
  );

  shade.addColorStop(
    0,
    "rgba(0,0,0,0.05)"
  );

  shade.addColorStop(
    1,
    "rgba(0,0,0,0.50)"
  );

  ctx.fillStyle = shade;
  ctx.fillRect(0, y, W, h);
}

/* ============================================================
   ÉCLAIRAGE
============================================================ */

function drawStadiumLighting(ctx, W, H) {
  const positions = [
    [100, 40],
    [W - 100, 40],
    [260, 70],
    [W - 260, 70]
  ];

  for (const [x, y] of positions) {
    const glow = ctx.createRadialGradient(
      x,
      y,
      2,
      x,
      y,
      150
    );

    glow.addColorStop(
      0,
      "rgba(255,255,230,0.35)"
    );

    glow.addColorStop(
      1,
      "rgba(255,255,230,0)"
    );

    ctx.fillStyle = glow;

    ctx.beginPath();

    ctx.arc(
      x,
      y,
      150,
      0,
      Math.PI * 2
    );

    ctx.fill();

    ctx.fillStyle = "#fff9d6";

    ctx.beginPath();

    ctx.arc(
      x,
      y,
      7,
      0,
      Math.PI * 2
    );

    ctx.fill();
  }
}

/* ============================================================
   TERRAIN
============================================================ */

function drawPitchRealistic(ctx, W, H) {
  const pitchY = 330;

  const grass = ctx.createLinearGradient(
    0,
    pitchY,
    0,
    H
  );

  grass.addColorStop(
    0,
    "#3fa34d"
  );

  grass.addColorStop(
    0.5,
    "#247a34"
  );

  grass.addColorStop(
    1,
    "#145324"
  );

  ctx.fillStyle = grass;

  ctx.fillRect(
    0,
    pitchY,
    W,
    H - pitchY
  );

  /*
   * Bandes de tonte en perspective
   */
  for (let i = 0; i < 10; i++) {
    const top = pitchY + i * 42;

    ctx.fillStyle =
      i % 2 === 0
        ? "rgba(255,255,255,0.035)"
        : "rgba(0,0,0,0.035)";

    ctx.beginPath();

    ctx.moveTo(
      W / 2 - i * 80,
      top
    );

    ctx.lineTo(
      W / 2 + i * 80,
      top
    );

    ctx.lineTo(
      W,
      top + 42
    );

    ctx.lineTo(
      0,
      top + 42
    );

    ctx.closePath();

    ctx.fill();
  }

  /*
   * Lignes de perspective
   */
  ctx.strokeStyle =
    "rgba(255,255,255,0.75)";

  ctx.lineWidth = 3;

  ctx.beginPath();

  ctx.moveTo(260, H);
  ctx.lineTo(430, 330);

  ctx.moveTo(W - 260, H);
  ctx.lineTo(W - 430, 330);

  ctx.stroke();

  /*
   * Ombre globale du stade
   */
  const shade = ctx.createLinearGradient(
    0,
    pitchY,
    0,
    H
  );

  shade.addColorStop(
    0,
    "rgba(255,255,255,0)"
  );

  shade.addColorStop(
    1,
    "rgba(0,0,0,0.20)"
  );

  ctx.fillStyle = shade;

  ctx.fillRect(
    0,
    pitchY,
    W,
    H - pitchY
  );
}

/* ============================================================
   SURFACE DE RÉPARATION
============================================================ */

function drawPenaltyArea(ctx, W, H) {
  ctx.strokeStyle =
    "rgba(255,255,255,0.85)";

  ctx.lineWidth = 3;

  /*
   * Grande surface
   */
  ctx.beginPath();

  ctx.moveTo(330, 330);
  ctx.lineTo(950, 330);
  ctx.lineTo(1080, H);
  ctx.lineTo(200, H);
  ctx.closePath();

  ctx.stroke();

  /*
   * Petit rectangle
   */
  ctx.beginPath();

  ctx.moveTo(450, 330);
  ctx.lineTo(830, 330);
  ctx.lineTo(900, 570);
  ctx.lineTo(380, 570);
  ctx.closePath();

  ctx.stroke();

  /*
   * Point de penalty
   */
  ctx.fillStyle = "#fff";

  ctx.beginPath();

  ctx.arc(
    640,
    520,
    5,
    0,
    Math.PI * 2
  );

  ctx.fill();

  /*
   * Arc
   */
  ctx.beginPath();

  ctx.arc(
    640,
    520,
    75,
    Math.PI * 1.15,
    Math.PI * 1.85
  );

  ctx.stroke();
}

/* ============================================================
   BUT
============================================================ */

function drawGoalRealistic(ctx, W) {
  const gx = 425;
  const gy = 195;
  const gw = 430;
  const gh = 170;

  /*
   * Ombre du but
   */
  ctx.fillStyle =
    "rgba(0,0,0,0.30)";

  ctx.beginPath();

  ctx.ellipse(
    640,
    gy + gh + 15,
    230,
    25,
    0,
    0,
    Math.PI * 2
  );

  ctx.fill();

  /*
   * Filet arrière
   */
  ctx.strokeStyle =
    "rgba(255,255,255,0.28)";

  ctx.lineWidth = 1;

  for (
    let x = gx;
    x <= gx + gw;
    x += 15
  ) {
    ctx.beginPath();

    ctx.moveTo(x, gy);
    ctx.lineTo(
      x + (x - gx - gw / 2) * 0.25,
      gy + gh
    );

    ctx.stroke();
  }

  for (
    let y = gy;
    y <= gy + gh;
    y += 13
  ) {
    ctx.beginPath();

    ctx.moveTo(gx, y);
    ctx.lineTo(gx + gw, y);

    ctx.stroke();
  }

  /*
   * Cadre
   */
  const metal = ctx.createLinearGradient(
    gx,
    gy,
    gx + gw,
    gy + gh
  );

  metal.addColorStop(
    0,
    "#ffffff"
  );

  metal.addColorStop(
    0.5,
    "#cbd5e1"
  );

  metal.addColorStop(
    1,
    "#ffffff"
  );

  ctx.strokeStyle = metal;

  ctx.lineWidth = 9;

  ctx.strokeRect(
    gx,
    gy,
    gw,
    gh
  );

  /*
   * Reflet
   */
  ctx.strokeStyle =
    "rgba(255,255,255,0.9)";

  ctx.lineWidth = 2;

  ctx.strokeRect(
    gx + 5,
    gy + 5,
    gw - 10,
    gh - 10
  );
}

/* ============================================================
   BRAS / JAMBES
============================================================ */

function drawLimb(
  ctx,
  x1,
  y1,
  x2,
  y2,
  width,
  color
) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.beginPath();

  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);

  ctx.stroke();
}

/* ============================================================
   GARDIEN
============================================================ */

function drawGoalkeeperRealistic(
  ctx,
  dir,
  pose,
  gameState
) {
  let cx = 640;
  let cy = 300;

  if (pose === "dive") {
    if (dir === "gauche") cx = 500;
    if (dir === "droite") cx = 780;
  }

  ctx.save();

  ctx.translate(cx, cy);

  let rotation = 0;

  if (pose === "dive") {
    if (dir === "gauche") {
      rotation = -0.55;
    }

    if (dir === "droite") {
      rotation = 0.55;
    }
  }

  ctx.rotate(rotation);

  /*
   * Ombre
   */
  ctx.fillStyle =
    "rgba(0,0,0,0.25)";

  ctx.beginPath();

  ctx.ellipse(
    0,
    58,
    50,
    10,
    0,
    0,
    Math.PI * 2
  );

  ctx.fill();

  const jersey = "#facc15";
  const jerseyDark = "#ca8a04";
  const shorts = "#111827";
  const skin = "#c68642";
  const socks = "#f8fafc";
  const gloves = "#2563eb";

  /*
   * Jambes
   */
  drawLimb(
    ctx,
    -4,
    30,
    -25,
    67,
    13,
    shorts
  );

  drawLimb(
    ctx,
    4,
    30,
    25,
    67,
    13,
    shorts
  );

  /*
   * Chaussettes
   */
  drawLimb(
    ctx,
    -25,
    64,
    -30,
    86,
    8,
    socks
  );

  drawLimb(
    ctx,
    25,
    64,
    30,
    86,
    8,
    socks
  );

  /*
   * Chaussures
   */
  drawLimb(
    ctx,
    -30,
    86,
    -43,
    88,
    8,
    "#111827"
  );

  drawLimb(
    ctx,
    30,
    86,
    43,
    88,
    8,
    "#111827"
  );

  /*
   * Corps
   */
  ctx.fillStyle = jersey;

  ctx.beginPath();

  ctx.roundRect(
    -24,
    -20,
    48,
    60,
    12
  );

  ctx.fill();

  /*
   * Détails du maillot
   */
  ctx.fillStyle = jerseyDark;

  ctx.fillRect(
    -24,
    0,
    48,
    6
  );

  ctx.fillStyle = "#ffffff";

  ctx.font =
    "bold 12px Arial";

  ctx.textAlign = "center";

  ctx.fillText(
    "01",
    0,
    22
  );

  /*
   * Bras
   */
  if (pose === "ready") {
    drawLimb(
      ctx,
      -20,
      -5,
      -50,
      -30,
      11,
      jersey
    );

    drawLimb(
      ctx,
      20,
      -5,
      50,
      -30,
      11,
      jersey
    );

    drawGlove(
      ctx,
      -54,
      -34,
      gloves
    );

    drawGlove(
      ctx,
      54,
      -34,
      gloves
    );
  } else {
    const side =
      dir === "droite"
        ? 1
        : -1;

    drawLimb(
      ctx,
      0,
      -10,
      side * 62,
      -35,
      11,
      jersey
    );

    drawLimb(
      ctx,
      0,
      -10,
      side * 48,
      20,
      11,
      jersey
    );

    drawGlove(
      ctx,
      side * 68,
      -38,
      gloves
    );

    drawGlove(
      ctx,
      side * 54,
      23,
      gloves
    );
  }

  /*
   * Cou
   */
  ctx.fillStyle = skin;

  ctx.fillRect(
    -7,
    -34,
    14,
    14
  );

  /*
   * Tête
   */
  ctx.beginPath();

  ctx.arc(
    0,
    -48,
    16,
    0,
    Math.PI * 2
  );

  ctx.fill();

  /*
   * Cheveux
   */
  ctx.fillStyle = "#171717";

  ctx.beginPath();

  ctx.arc(
    0,
    -53,
    16,
    Math.PI,
    Math.PI * 2
  );

  ctx.fill();

  /*
   * Yeux
   */
  ctx.fillStyle = "#111";

  ctx.beginPath();
  ctx.arc(-5, -48, 1.5, 0, Math.PI * 2);
  ctx.arc(5, -48, 1.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawGlove(ctx, x, y, color) {
  ctx.fillStyle = color;

  ctx.beginPath();

  ctx.arc(
    x,
    y,
    9,
    0,
    Math.PI * 2
  );

  ctx.fill();

  for (let i = -1; i <= 1; i++) {
    ctx.fillRect(
      x + i * 4,
      y - 10,
      3,
      8
    );
  }
}

/* ============================================================
   TIREUR
============================================================ */

async function drawShooterRealistic(
  ctx,
  senderID,
  usersData,
  dir,
  pose
) {
  const cx = 640;
  const groundY = 555;

  const jersey = "#2563eb";
  const jerseyDark = "#1e3a8a";
  const shorts = "#f8fafc";
  const socks = "#ffffff";
  const skin = "#c68642";

  ctx.save();

  ctx.translate(cx, groundY);

  /*
   * Ombre
   */
  ctx.fillStyle =
    "rgba(0,0,0,0.30)";

  ctx.beginPath();

  ctx.ellipse(
    0,
    8,
    55,
    12,
    0,
    0,
    Math.PI * 2
  );

  ctx.fill();

  /*
   * Jambes
   */
  if (pose === "approach") {
    drawLimb(
      ctx,
      0,
      0,
      12,
      -60,
      17,
      shorts
    );

    drawLimb(
      ctx,
      0,
      -4,
      -35,
      -35,
      17,
      shorts
    );

    drawLimb(
      ctx,
      12,
      -60,
      14,
      -82,
      9,
      socks
    );

    drawLimb(
      ctx,
      -35,
      -35,
      -48,
      -40,
      9,
      socks
    );
  } else {
    let kick = 0;

    if (dir === "gauche") {
      kick = -1;
    }

    if (dir === "droite") {
      kick = 1;
    }

    drawLimb(
      ctx,
      0,
      0,
      -10,
      -62,
      17,
      shorts
    );

    drawLimb(
      ctx,
      0,
      -8,
      kick * 50,
      -35,
      17,
      shorts
    );

    drawLimb(
      ctx,
      -10,
      -62,
      -12,
      -82,
      9,
      socks
    );

    drawLimb(
      ctx,
      kick * 50,
      -35,
      kick * 72,
      -42,
      9,
      socks
    );
  }

  /*
   * Chaussures
   */
  ctx.fillStyle = "#111827";

  ctx.beginPath();

  ctx.ellipse(
    -13,
    -84,
    15,
    7,
    0,
    0,
    Math.PI * 2
  );

  ctx.fill();

  /*
   * Torse
   */
  ctx.fillStyle = jersey;

  ctx.beginPath();

  ctx.roundRect(
    -27,
    -145,
    54,
    85,
    14
  );

  ctx.fill();

  /*
   * Bande du maillot
   */
  ctx.fillStyle = jerseyDark;

  ctx.fillRect(
    -27,
    -90,
    54,
    8
  );

  /*
   * Numéro
   */
  ctx.fillStyle = "#fff";

  ctx.font =
    "bold 22px Arial";

  ctx.textAlign = "center";

  ctx.fillText(
    "10",
    0,
    -105
  );

  /*
   * Bras
   */
  drawLimb(
    ctx,
    -23,
    -125,
    -53,
    -87,
    10,
    jersey
  );

  drawLimb(
    ctx,
    23,
    -125,
    53,
    -87,
    10,
    jersey
  );

  /*
   * Cou
   */
  ctx.fillStyle = skin;

  ctx.fillRect(
    -8,
    -158,
    16,
    18
  );

  /*
   * Avatar
   */
  let avatarDrawn = false;

  try {
    let avatarUrl = null;

    if (
      usersData &&
      typeof usersData.getAvatarUrl === "function"
    ) {
      avatarUrl =
        await usersData.getAvatarUrl(
          senderID
        );
    }

    if (!avatarUrl) {
      avatarUrl =
        `https://graph.facebook.com/${senderID}/picture?height=300&width=300`;
    }

    const avatar =
      await loadImage(avatarUrl);

    ctx.save();

    ctx.beginPath();

    ctx.arc(
      0,
      -176,
      20,
      0,
      Math.PI * 2
    );

    ctx.clip();

    ctx.drawImage(
      avatar,
      -20,
      -196,
      40,
      40
    );

    ctx.restore();

    ctx.strokeStyle = "#f59e0b";
    ctx.lineWidth = 3;

    ctx.beginPath();

    ctx.arc(
      0,
      -176,
      20,
      0,
      Math.PI * 2
    );

    ctx.stroke();

    avatarDrawn = true;
  } catch (error) {
    avatarDrawn = false;
  }

  if (!avatarDrawn) {
    ctx.fillStyle = skin;

    ctx.beginPath();

    ctx.arc(
      0,
      -176,
      19,
      0,
      Math.PI * 2
    );

    ctx.fill();

    ctx.fillStyle = "#111827";

    ctx.beginPath();

    ctx.arc(
      0,
      -182,
      19,
      Math.PI,
      Math.PI * 2
    );

    ctx.fill();
  }

  /*
   * Bras + ballon en mouvement
   */
  ctx.restore();
}

/* ============================================================
   BALLON
============================================================ */

function drawBallRealistic(ctx, x, y) {
  /*
   * Ombre
   */
  ctx.fillStyle =
    "rgba(0,0,0,0.35)";

  ctx.beginPath();

  ctx.ellipse(
    x + 5,
    y + 10,
    18,
    6,
    0,
    0,
    Math.PI * 2
  );

  ctx.fill();

  /*
   * Ballon
   */
  const ball = ctx.createRadialGradient(
    x - 5,
    y - 7,
    2,
    x,
    y,
    18
  );

  ball.addColorStop(
    0,
    "#ffffff"
  );

  ball.addColorStop(
    0.75,
    "#e5e7eb"
  );

  ball.addColorStop(
    1,
    "#9ca3af"
  );

  ctx.fillStyle = ball;

  ctx.beginPath();

  ctx.arc(
    x,
    y,
    18,
    0,
    Math.PI * 2
  );

  ctx.fill();

  ctx.strokeStyle = "#111827";

  ctx.lineWidth = 1.5;

  ctx.stroke();

  /*
   * Motif
   */
  ctx.fillStyle = "#111827";

  for (let i = 0; i < 5; i++) {
    const angle =
      (Math.PI * 2 * i) / 5;

    ctx.beginPath();

    ctx.arc(
      x + Math.cos(angle) * 7,
      y + Math.sin(angle) * 7,
      2.5,
      0,
      Math.PI * 2
    );

    ctx.fill();
  }
}

function drawBallTrail(ctx, x, y) {
  const gradient =
    ctx.createLinearGradient(
      x,
      y,
      640,
      500
    );

  gradient.addColorStop(
    0,
    "rgba(255,255,255,0)"
  );

  gradient.addColorStop(
    1,
    "rgba(255,255,255,0.25)"
  );

  ctx.strokeStyle = gradient;

  ctx.lineWidth = 5;

  ctx.beginPath();

  ctx.moveTo(x, y);
  ctx.lineTo(640, 500);

  ctx.stroke();
}

/* ============================================================
   HUD
============================================================ */

function drawHUD(
  ctx,
  W,
  H,
  distance,
  state
) {
  /*
   * Barre supérieure
   */
  ctx.fillStyle =
    "rgba(5,10,18,0.82)";

  ctx.fillRect(
    0,
    0,
    W,
    72
  );

  /*
   * Logo
   */
  ctx.fillStyle = "#fff";

  ctx.font =
    "bold 25px Arial";

  ctx.textAlign = "left";

  ctx.fillText(
    "EA SPORTS FC",
    35,
    45
  );

  /*
   * Score
   */
  ctx.textAlign = "center";

  ctx.fillStyle = "#facc15";

  ctx.font =
    "bold 20px Arial";

  ctx.fillText(
    "PENALTY SHOOTOUT",
    W / 2,
    30
  );

  ctx.fillStyle = "#fff";

  ctx.font =
    "bold 14px Arial";

  ctx.fillText(
    state === "AIMING"
      ? "CHOISISSEZ LA DIRECTION"
      : state === "GOAL"
        ? "BUT !"
        : "ARRÊT DU GARDIEN",
    W / 2,
    52
  );

  /*
   * Distance
   */
  ctx.textAlign = "right";

  ctx.fillStyle = "#fff";

  ctx.font =
    "bold 18px Arial";

  ctx.fillText(
    `${distance} M`,
    W - 35,
    35
  );

  ctx.font =
    "12px Arial";

  ctx.fillStyle =
    "rgba(255,255,255,0.7)";

  ctx.fillText(
    "PENALTY",
    W - 35,
    54
  );

  /*
   * Barre inférieure
   */
  ctx.fillStyle =
    "rgba(3,7,18,0.92)";

  ctx.fillRect(
    0,
    H - 68,
    W,
    68
  );

  ctx.textAlign = "center";

  ctx.fillStyle = "#facc15";

  ctx.font =
    "bold 16px Arial";

  ctx.fillText(
    "⚽ PENALTY • EA SPORTS FC • CÉLESTIN OLUА",
    W / 2,
    H - 38
  );

  ctx.fillStyle =
    "rgba(255,255,255,0.65)";

  ctx.font =
    "12px Arial";

  ctx.fillText(
    "STADIUM MODE • PS4 STYLE",
    W / 2,
    H - 18
  );
}

/* ============================================================
   EFFETS CAMÉRA
============================================================ */

function drawCameraEffects(ctx, W, H) {
  /*
   * Vignette
   */
  const vignette =
    ctx.createRadialGradient(
      W / 2,
      H / 2,
      180,
      W / 2,
      H / 2,
      700
    );

  vignette.addColorStop(
    0,
    "rgba(0,0,0,0)"
  );

  vignette.addColorStop(
    1,
    "rgba(0,0,0,0.48)"
  );

  ctx.fillStyle = vignette;

  ctx.fillRect(
    0,
    0,
    W,
    H
  );

  /*
   * Lignes de scan légères
   */
  ctx.globalAlpha = 0.025;

  ctx.strokeStyle = "#fff";

  ctx.lineWidth = 1;

  for (
    let y = 0;
    y < H;
    y += 5
  ) {
    ctx.beginPath();

    ctx.moveTo(0, y);
    ctx.lineTo(W, y);

    ctx.stroke();
  }

  ctx.globalAlpha = 1;
}

/* ============================================================
   OVERLAY GOAL
============================================================ */

function drawGoalOverlay(ctx, W, H) {
  ctx.save();

  ctx.fillStyle =
    "rgba(22,163,74,0.12)";

  ctx.fillRect(
    0,
    0,
    W,
    H
  );

  ctx.textAlign = "center";

  ctx.shadowColor =
    "rgba(0,0,0,0.65)";

  ctx.shadowBlur = 15;

  ctx.fillStyle = "#fff";

  ctx.font =
    "bold 78px Arial";

  ctx.fillText(
    "GOAL!",
    W / 2,
    170
  );

  ctx.font =
    "bold 24px Arial";

  ctx.fillStyle = "#facc15";

  ctx.fillText(
    "QUEL TIR !",
    W / 2,
    210
  );

  ctx.restore();
}

/* ============================================================
   OVERLAY SAVE
============================================================ */

function drawSavedOverlay(ctx, W, H) {
  ctx.save();

  ctx.fillStyle =
    "rgba(220,38,38,0.10)";

  ctx.fillRect(
    0,
    0,
    W,
    H
  );

  ctx.textAlign = "center";

  ctx.shadowColor =
    "rgba(0,0,0,0.75)";

  ctx.shadowBlur = 15;

  ctx.fillStyle = "#fff";

  ctx.font =
    "bold 62px Arial";

  ctx.fillText(
    "SAVED!",
    W / 2,
    170
  );

  ctx.font =
    "bold 22px Arial";

  ctx.fillStyle = "#f87171";

  ctx.fillText(
    "PARADE DU GARDIEN",
    W / 2,
    207
  );

  ctx.restore();
}

/* ============================================================
   UTILITAIRE
============================================================ */

function safeDelete(filePath) {
  try {
    if (
      filePath &&
      fs.existsSync(filePath)
    ) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    // Ignore les erreurs de suppression du cache
  }
  }
