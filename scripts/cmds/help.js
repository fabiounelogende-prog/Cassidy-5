const { createCanvas, loadImage } = require('canvas');
const fs = require('fs-extra');
const path = require('path');

module.exports = {
  config: {
    name: "help",
    version: "6.0.0-DANGER",
    author: "YourName",
    countDown: 5,
    role: 0,
    shortDescription: "Menu help Cyber-Futuriste & Ultra Dangereux",
    longDescription: "Affiche un poster HD Canvas aux effets néon, viseurs tactiques, humeur sombre et esthétique cyberpunk.",
    category: "info",
    guide: "{pn} [page/basic]"
  },

  onStart: async function ({ api, event, args, usersData }) {
    const { threadID, messageID, senderID } = event;

    // 1. PRÉFIXE DYNAMIQUE & DÉTECTION
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

    // 2. THÈMES CYBERPUNK & DANGEREUX
    const moods = [
      { name: "CYBER HACKER", bg: "#030712", accent1: "#22C55E", accent2: "#4ADE80", cardBg: "rgba(34, 197, 94, 0.08)", emoji: "☣️", symbol: "⚡" },
      { name: "CRITICAL DANGER", bg: "#0C0202", accent1: "#EF4444", accent2: "#F87171", cardBg: "rgba(239, 68, 68, 0.08)", emoji: "⚠️", symbol: "🔥" },
      { name: "OVERDRIVE NEON", bg: "#090014", accent1: "#D946EF", accent2: "#E879F9", cardBg: "rgba(217, 70, 239, 0.08)", emoji: "🔮", symbol: "💥" },
      { name: "VOID PROTOCOL", bg: "#020617", accent1: "#3B82F6", accent2: "#60A5FA", cardBg: "rgba(59, 130, 246, 0.08)", emoji: "🌀", symbol: "👁️" },
      { name: "NITRO FURY", bg: "#0A0A00", accent1: "#EAB308", accent2: "#FACC15", cardBg: "rgba(234, 179, 8, 0.08)", emoji: "☢️", symbol: "☠️" }
    ];

    const currentMood = isBasicMode 
      ? moods[1] 
      : moods[Math.floor(Math.random() * moods.length)];

    // 3. CANVAS HD (1200x1500)
    const canvas = createCanvas(1200, 1500);
    const ctx = canvas.getContext('2d');
    ctx.textBaseline = "middle";

    // FONCTION : DESSIN DE VISEUR TACTIQUE (CROSSHAIR / OCTOGONE)
    function drawTacticalTarget(x, y, radius, color) {
      ctx.save();
      ctx.translate(x, y);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.6;

      // Octogone externe
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const angle = (Math.PI / 4) * i;
        const px = radius * Math.cos(angle);
        const py = radius * Math.sin(angle);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();

      // Viseur au centre
      ctx.beginPath();
      ctx.moveTo(-radius - 10, 0); ctx.lineTo(radius + 10, 0);
      ctx.moveTo(0, -radius - 10); ctx.lineTo(0, radius + 10);
      ctx.stroke();

      ctx.restore();
    }

    // A. ARRIÈRE-PLAN SOMBRE AVEC GRILLE TECH
    ctx.fillStyle = currentMood.bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Dessin de la grille Cyber
    ctx.strokeStyle = "rgba(255, 255, 255, 0.03)";
    ctx.lineWidth = 1;
    for (let x = 0; x < canvas.width; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += 40) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
    }

    // B. ÉLÉMENTS TACTIQUES EN DECORATION
    drawTacticalTarget(1100, 150, 90, currentMood.accent1);
    drawTacticalTarget(100, 1380, 110, currentMood.accent2);
    drawTacticalTarget(1120, 1350, 70, currentMood.accent1);

    // C. HALO NEON MÉNACE
    const glow = ctx.createRadialGradient(600, 750, 100, 600, 750, 800);
    glow.addColorStop(0, currentMood.accent1);
    glow.addColorStop(1, 'transparent');
    ctx.fillStyle = glow;
    ctx.globalAlpha = 0.12;
    ctx.beginPath();
    ctx.arc(600, 750, 800, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1.0;

    // D. AVATAR STYLISÉ (CADRE CYBER CUT)
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

      // Contour Hexagonal NÉON
      ctx.strokeStyle = currentMood.accent1;
      ctx.shadowColor = currentMood.accent1;
      ctx.shadowBlur = 25;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(avatarX, avatarY, avatarRadius + 6, 0, Math.PI * 2, true);
      ctx.stroke();
      ctx.shadowBlur = 0;
    } catch (e) {
      drawTacticalTarget(avatarX, avatarY, 45, currentMood.accent1);
    }

    // E. EN-TÊTE FUTURISTE
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "900 44px 'Segoe UI', Roboto, sans-serif";
    ctx.fillText("SYSTEM COMMANDS", 215, 85);

    ctx.fillStyle = currentMood.accent1;
    ctx.font = "bold 20px 'Segoe UI', Roboto, sans-serif";
    ctx.fillText(`${currentMood.emoji} MODE : ${currentMood.name}   |   PREFIX : [ ${prefix} ]`, 215, 130);

    // F. BARRE DE PROGRESSION TACTIQUE
    const progressWidth = 450;
    const progressHeight = 10;
    const progressX = 60;
    const progressY = 200;

    ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
    ctx.fillRect(progressX, progressY, progressWidth, progressHeight);

    const currentProgress = (page / totalPages) * progressWidth;
    ctx.fillStyle = currentMood.accent1;
    ctx.shadowColor = currentMood.accent1;
    ctx.shadowBlur = 10;
    ctx.fillRect(progressX, progressY, currentProgress, progressHeight);
    ctx.shadowBlur = 0;

    ctx.fillStyle = "#64748B";
    ctx.font = "bold 18px 'Segoe UI', Roboto, sans-serif";
    ctx.fillText(`PAGE // 0${page} - 0${totalPages} [TOTAL: ${allCommands.length}]`, progressX + progressWidth + 25, progressY + 5);

    // G. GRILLE DE CARTE STYLISÉE CYBER (2 COLONNES x 8 LIGNES)
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

      // Fond de carte sombre avec bordure néon
      ctx.fillStyle = currentMood.cardBg;
      ctx.beginPath();
      
      // Dessin d'une carte avec coin coupé (Cyber shape)
      const cut = 15;
      ctx.moveTo(x + cut, y);
      ctx.lineTo(x + cardWidth, y);
      ctx.lineTo(x + cardWidth, y + cardHeight - cut);
      ctx.lineTo(x + cardWidth - cut, y + cardHeight);
      ctx.lineTo(x, y + cardHeight);
      ctx.lineTo(x, y + cut);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Indicateur latéral lumineux
      ctx.fillStyle = currentMood.accent1;
      ctx.fillRect(x, y + 20, 4, cardHeight - 40);

      // Nom de la commande
      ctx.fillStyle = "#FFFFFF";
      ctx.font = "bold 23px 'Segoe UI', Roboto, sans-serif";
      ctx.fillText(`${prefix}${cmdName.toUpperCase()}`, x + 35, y + cardHeight / 2);

      // Symbole d'avertissement tactique
      ctx.fillStyle = currentMood.accent2;
      ctx.font = "16px 'Segoe UI', Roboto, sans-serif";
      ctx.fillText(currentMood.symbol, x + cardWidth - 35, y + cardHeight / 2);
    });

    // H. PIED DE PAGE INTERACTIF
    const nextPg = page + 1 > totalPages ? 1 : page + 1;
    ctx.fillStyle = "#64748B";
    ctx.font = "bold 18px 'Segoe UI', Roboto, sans-serif";
    ctx.fillText(`[!] TAPES '${prefix}help ${nextPg}' POUR ACCÉDER AUX AUTRES DONNÉES DU SYSTÈME.`, 60, 1450);

    // 4. SAUVEGARDE & EXPÉDITION
    const cacheDir = path.join(__dirname, "cache");
    const cachePath = path.join(cacheDir, `help_${senderID}.png`);
    fs.ensureDirSync(cacheDir);

    const buffer = canvas.toBuffer("image/png");
    fs.writeFileSync(cachePath, buffer);

    // 5. TEXTE DE SECOURS (STYLE CONSOLE D'AIDE)
    let textFallback = `${currentMood.emoji} ━━━ [ SYSTEM ACCESS - ${currentMood.name} ] ━━━ ${currentMood.emoji}\n`;
    textFallback += `⚡ LEVEL: Page ${page}/${totalPages} | Modules: ${allCommands.length}\n\n`;

    pageCmds.forEach((cmd, idx) => {
      textFallback += `> ${prefix}${cmd.toUpperCase().padEnd(14, ' ')}`;
      if ((idx + 1) % 2 === 0) textFallback += "\n";
    });

    textFallback += `\n\n⚠️ **NEXT EXECUTION:** \`${prefix}help ${nextPg}\``;

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
