const { createCanvas, loadImage } = require('canvas');
const fs = require('fs-extra');
const path = require('path');

module.exports = {
  config: {
    name: "help",
    version: "5.0.0",
    author: "YourName",
    countDown: 5,
    role: 0,
    shortDescription: "Menu help dynamique selon l'humeur du groupe",
    longDescription: "Affiche un poster HD Canvas avec fleurs, avatar, humeur du groupe et emojis adaptatifs.",
    category: "info",
    guide: "{pn} [page/basic]"
  },

  onStart: async function ({ api, event, args, usersData }) {
    const { threadID, messageID, senderID } = event;

    // 1. DÉTECTION DU PRÉFIXE DYNAMIQUE
    const prefix = global.config?.PREFIX || global.GoatBot?.config?.PREFIX || "!";

    let page = 1;
    let isBasicMode = false;

    if (args[0]) {
      if (args[0].toLowerCase() === "basic") {
        isBasicMode = true;
      } else if (!isNaN(args[0])) {
        page = parseInt(args[0]);
      }
    }

    const allCommands = Array.from((global.GoatBot?.commands || new Map()).keys());
    const cmdsPerPage = 16;
    const totalPages = Math.ceil(allCommands.length / cmdsPerPage) || 1;

    if (page < 1 || page > totalPages) page = 1;

    const startIdx = (page - 1) * cmdsPerPage;
    const pageCmds = allCommands.slice(startIdx, startIdx + cmdsPerPage);

    // 2. DÉTECTION DE L'HUMEUR DU GROUPE & THÈMES ADAPTATIFS
    const moods = [
      { name: "JOYEUX", bg: "#091E11", accent1: "#10B981", accent2: "#34D399", cardBg: "rgba(16, 185, 129, 0.1)", emoji: "🌻", symbol: "🌼" },
      { name: "ÉNERGIQUE", bg: "#1A0C03", accent1: "#F97316", accent2: "#FBBF24", cardBg: "rgba(249, 115, 22, 0.1)", emoji: "🔥", symbol: "⚡" },
      { name: "ROMANTIQUE", bg: "#1A0915", accent1: "#EC4899", accent2: "#F472B6", cardBg: "rgba(236, 72, 153, 0.1)", emoji: "🌸", symbol: "🌺" },
      { name: "CYBER/NÉON", bg: "#090514", accent1: "#8B5CF6", accent2: "#C084FC", cardBg: "rgba(139, 92, 246, 0.1)", emoji: "🔮", symbol: "✨" },
      { name: "ZEN", bg: "#081018", accent1: "#06B6D4", accent2: "#38BDF8", cardBg: "rgba(6, 182, 212, 0.1)", emoji: "🍃", symbol: "🌷" }
    ];

    // Choix aléatoire ou basé sur l'heure/l'état du groupe
    const currentMood = isBasicMode 
      ? moods[4] 
      : moods[Math.floor(Math.random() * moods.length)];

    // 3. CRÉATION DU CANEVAS (1200x1500 - FORMAT PHOTO HD)
    const canvas = createCanvas(1200, 1500);
    const ctx = canvas.getContext('2d');
    ctx.textBaseline = "middle";

    // FONCTION : DESSIN DE FLEURS VECTORIELLES DÉTAILLÉES
    function drawDetailedFlower(x, y, radius, petals, color, coreColor) {
      ctx.save();
      ctx.translate(x, y);
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.5;

      for (let i = 0; i < petals; i++) {
        ctx.beginPath();
        ctx.rotate((Math.PI * 2) / petals);
        ctx.ellipse(0, radius, radius / 2.2, radius, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // Cœur de la fleur avec ombre interne
      ctx.beginPath();
      ctx.arc(0, 0, radius / 2.5, 0, Math.PI * 2);
      ctx.fillStyle = coreColor || "#FDE047";
      ctx.globalAlpha = 0.95;
      ctx.fill();
      ctx.restore();
    }

    // A. ARRIÈRE-PLAN
    ctx.fillStyle = currentMood.bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // B. FLEURS EN DÉCORATION D'ARRIÈRE-PLAN
    drawDetailedFlower(1060, 180, 120, 8, currentMood.accent1, "#FEF08A");
    drawDetailedFlower(140, 1360, 140, 8, currentMood.accent2, "#FDE047");
    drawDetailedFlower(1100, 1320, 90, 6, currentMood.accent1, "#FFFFFF");

    // C. HALO DE LUMIÈRE
    const glow = ctx.createRadialGradient(1000, 200, 30, 1000, 200, 650);
    glow.addColorStop(0, currentMood.accent1);
    glow.addColorStop(1, 'transparent');
    ctx.fillStyle = glow;
    ctx.globalAlpha = 0.22;
    ctx.beginPath();
    ctx.arc(1000, 200, 650, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1.0;

    // D. PHOTO DE PROFIL (AVATAR) DE L'UTILISATEUR
    const avatarRadius = 65;
    const avatarX = 120;
    const avatarY = 110;

    try {
      let avatarUrl;
      if (usersData && typeof usersData.getAvatarUrl === 'function') {
        avatarUrl = await usersData.getAvatarUrl(senderID);
      }
      if (!avatarUrl) {
        avatarUrl = `https://graph.facebook.com/${senderID}/picture?height=500&width=500&access_token=6628568379%7Cc1e620fa708a1d5696fb991c1bde5662`;
      }

      const avatar = await loadImage(avatarUrl);

      ctx.save();
      ctx.beginPath();
      ctx.arc(avatarX, avatarY, avatarRadius, 0, Math.PI * 2, true);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(avatar, avatarX - avatarRadius, avatarY - avatarRadius, avatarRadius * 2, avatarRadius * 2);
      ctx.restore();

      // Double contour néon autour de l'avatar
      ctx.strokeStyle = currentMood.accent1;
      ctx.shadowColor = currentMood.accent1;
      ctx.shadowBlur = 20;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(avatarX, avatarY, avatarRadius + 4, 0, Math.PI * 2, true);
      ctx.stroke();
      ctx.shadowBlur = 0;
    } catch (e) {
      drawDetailedFlower(avatarX, avatarY, 50, 6, currentMood.accent1);
    }

    // E. EN-TÊTE & BADGE D'HUMEUR DU GROUPE
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 42px 'Segoe UI', Roboto, sans-serif";
    ctx.fillText("HELP PANEL", 215, 90);

    ctx.fillStyle = currentMood.accent2;
    ctx.font = "bold 20px 'Segoe UI', Roboto, sans-serif";
    ctx.fillText(`${currentMood.emoji} HUMEUR : ${currentMood.name}   •   PREFIX : [ ${prefix} ]`, 215, 135);

    // F. BARRE DE PROGRESSION VISUELLE (PAGINATION)
    const progressWidth = 400;
    const progressHeight = 8;
    const progressX = 60;
    const progressY = 200;

    ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
    ctx.beginPath();
    ctx.roundRect(progressX, progressY, progressWidth, progressHeight, 4);
    ctx.fill();

    const currentProgress = (page / totalPages) * progressWidth;
    ctx.fillStyle = currentMood.accent1;
    ctx.beginPath();
    ctx.roundRect(progressX, progressY, currentProgress, progressHeight, 4);
    ctx.fill();

    ctx.fillStyle = "#A1A1AA";
    ctx.font = "600 18px 'Segoe UI', Roboto, sans-serif";
    ctx.fillText(`Page ${page}/${totalPages} (${allCommands.length} commandes)`, progressX + progressWidth + 20, progressY + 4);

    // G. GRILLE DE COMMANDES (2 COLONNES x 8 LIGNES)
    const cardWidth = 515;
    const cardHeight = 100;
    const gapX = 50;
    const gapY = 20;
    const startX = 60;
    const startY = 245;

    pageCmds.forEach((cmdName, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);

      const x = startX + col * (cardWidth + gapX);
      const y = startY + row * (cardHeight + gapY);

      // Carte avec effet Glassmorphism
      ctx.fillStyle = currentMood.cardBg;
      ctx.beginPath();
      ctx.roundRect(x, y, cardWidth, cardHeight, 16);
      ctx.fill();

      ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Mini-fleur d'accompagnement
      drawDetailedFlower(x + 30, y + cardHeight / 2, 11, 5, currentMood.accent1);

      // Nom de la commande
      ctx.fillStyle = "#FFFFFF";
      ctx.font = "bold 23px 'Segoe UI', Roboto, sans-serif";
      ctx.fillText(`${prefix}${cmdName}`, x + 60, y + cardHeight / 2);
    });

    // H. PIED DE PAGE INTERACTIF
    const nextPg = page + 1 > totalPages ? 1 : page + 1;
    ctx.fillStyle = "#94A3B8";
    ctx.font = "500 20px 'Segoe UI', Roboto, sans-serif";
    ctx.fillText(`${currentMood.symbol} Astuce : Tapez '${prefix}help ${nextPg}' pour naviguer ou '${prefix}help basic'.`, 60, 1450);

    // 4. GÉNÉRATION ET EXPÉDITION DU FICHIER PHOTO HD
    const cacheDir = path.join(__dirname, "cache");
    const cachePath = path.join(cacheDir, `help_${senderID}.png`);
    fs.ensureDirSync(cacheDir);

    const buffer = canvas.toBuffer("image/png");
    fs.writeFileSync(cachePath, buffer);

    // 5. OPTION TEXTE DE SECOURS ENRICHIE (SANS-FORFAIT)
    let textFallback = `${currentMood.emoji} ─── **[ CENTRE D'AIDE - ${currentMood.name} ]** ─── ${currentMood.emoji}\n`;
    textFallback += `📊 Page ${page}/${totalPages} | Total: ${allCommands.length} cmds\n\n`;

    pageCmds.forEach((cmd, idx) => {
      textFallback += `${currentMood.symbol} ${prefix}${cmd.padEnd(14, ' ')}`;
      if ((idx + 1) % 2 === 0) textFallback += "\n";
    });

    textFallback += `\n\n📌 **Suivant :** Tapez \`${prefix}help ${nextPg}\``;

    api.sendMessage(
      {
        body: textFallback,
        attachment: fs.createReadStream(cachePath)
      },
      threadID,
      () => fs.unlinkSync(cachePath),
      messageID
    );
  }
};
