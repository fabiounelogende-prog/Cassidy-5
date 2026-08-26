const { createCanvas, loadImage } = require('canvas');
const fs = require('fs-extra');
const path = require('path');

module.exports = {
  config: {
    name: "help",
    version: "3.5.0",
    author: "YourName",
    countDown: 5,
    role: 0,
    shortDescription: "Menu help avec emojis et style néon",
    longDescription: "Affiche le menu interactif Canvas avec emojis, pagination et mode texte.",
    category: "info",
    guide: "{pn} [page/basic] (ex: {pn} 2 ou {pn} basic)"
  },

  onStart: async function ({ api, event, args, usersData }) {
    const { threadID, messageID, senderID } = event;

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
    const cmdsPerPage = 20;
    const totalPages = Math.ceil(allCommands.length / cmdsPerPage) || 1;

    if (page < 1 || page > totalPages) page = 1;

    const startIdx = (page - 1) * cmdsPerPage;
    const pageCmds = allCommands.slice(startIdx, startIdx + cmdsPerPage);

    // Thème visuel adaptatif
    const randomHex = () => Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
    const theme = isBasicMode ? {
      bg: "#0B0F19",
      accent1: "#3B82F6",
      accent2: "#60A5FA",
      cardBg: "rgba(30, 41, 59, 0.7)",
      textColor: "#F8FAFC",
      subText: "#94A3B8",
      symbol: "⚡"
    } : {
      bg: "#07090E",
      accent1: `#${randomHex()}`,
      accent2: `#${randomHex()}`,
      cardBg: "rgba(255, 255, 255, 0.04)",
      textColor: "#FFFFFF",
      subText: "#A1A1AA",
      symbol: "🔥"
    };

    const canvas = createCanvas(1200, 780);
    const ctx = canvas.getContext('2d');

    // ARRIÈRE-PLAN NÉON
    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // HALOS LUMINEUX (Glow effect)
    const g1 = ctx.createRadialGradient(1000, 100, 20, 1000, 100, 450);
    g1.addColorStop(0, theme.accent1);
    g1.addColorStop(1, 'transparent');
    ctx.fillStyle = g1;
    ctx.globalAlpha = 0.25;
    ctx.beginPath();
    ctx.arc(1000, 100, 450, 0, Math.PI * 2);
    ctx.fill();

    const g2 = ctx.createRadialGradient(200, 700, 20, 200, 700, 400);
    g2.addColorStop(0, theme.accent2);
    g2.addColorStop(1, 'transparent');
    ctx.fillStyle = g2;
    ctx.beginPath();
    ctx.arc(200, 700, 400, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1.0;

    // AVATAR AVEC ANNEAU LUMINEUX
    try {
      const avatarUrl = await usersData.getAvatarUrl(senderID);
      const avatar = await loadImage(avatarUrl);

      ctx.save();
      ctx.beginPath();
      ctx.arc(95, 95, 45, 0, Math.PI * 2, true);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(avatar, 50, 50, 90, 90);
      ctx.restore();

      // Contour Glowing
      ctx.strokeStyle = theme.accent1;
      ctx.shadowColor = theme.accent1;
      ctx.shadowBlur = 15;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(95, 95, 47, 0, Math.PI * 2, true);
      ctx.stroke();
      ctx.shadowBlur = 0; // Reset ombre
    } catch (e) {
      // Fallback
    }

    // EN-TÊTE TYPOGRAPHIQUE AVEC EMOJIS
    ctx.fillStyle = theme.textColor;
    ctx.font = "bold 40px Sans-Serif";
    ctx.fillText("⚡ COMMAND PANEL", 165, 85);

    ctx.fillStyle = theme.accent1;
    ctx.font = "bold 16px Sans-Serif";
    ctx.fillText(`✨ NAVIGATION: PAGE [${page}/${totalPages}]`, 165, 120);

    // LIGNE DE SÉPARATION NÉON
    const lineGrad = ctx.createLinearGradient(45, 155, 1155, 155);
    lineGrad.addColorStop(0, theme.accent1);
    lineGrad.addColorStop(0.5, theme.accent2);
    lineGrad.addColorStop(1, 'transparent');
    ctx.strokeStyle = lineGrad;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(45, 155);
    ctx.lineTo(1155, 155);
    ctx.stroke();

    // COMPTEUR DE COMMANDES
    ctx.fillStyle = theme.subText;
    ctx.font = "bold 16px Sans-Serif";
    ctx.fillText(`📊 TOTAL COMMANDES DISPONIBLES : ${allCommands.length}`, 45, 190);

    // GRILLE DE COMMANDES STYLISÉE (4 Cols x 5 Lignes)
    let x = 45;
    let y = 215;
    let col = 0;

    pageCmds.forEach((cmdName) => {
      // Fond du module
      ctx.fillStyle = theme.cardBg;
      ctx.beginPath();
      ctx.roundRect(x, y, 265, 54, 10);
      ctx.fill();

      // Bordure discrète
      ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Puce d'accentuation / Symbole
      ctx.fillStyle = theme.accent1;
      ctx.font = "bold 14px Sans-Serif";
      ctx.fillText(theme.symbol, x + 12, y + 33);

      // Nom de la commande
      ctx.fillStyle = theme.textColor;
      ctx.font = "bold 15px Sans-Serif";
      ctx.fillText(`/${cmdName}`, x + 35, y + 33);

      col++;
      x += 283;
      if (col === 4) {
        col = 0;
        x = 45;
        y += 68;
      }
    });

    // PIED DE PAGE INTERACTIF
    const nextPg = page + 1 > totalPages ? 1 : page + 1;
    ctx.fillStyle = theme.subText;
    ctx.font = "15px Sans-Serif";
    ctx.fillText(`💡 Astuce : Tapez '/help ${nextPg}' pour voir la suite ou '/help basic' pour le mode rapide.`, 45, 735);

    // GÉNÉRATION DU FICHIER TEMPORAIRE
    const cacheDir = path.join(__dirname, "cache");
    const cachePath = path.join(cacheDir, `help_${senderID}.png`);
    fs.ensureDirSync(cacheDir);

    const buffer = canvas.toBuffer("image/png");
    fs.writeFileSync(cachePath, buffer);

    // VERSION TEXTE OPTIMISÉE POUR SANS-FORFAIT (MODE ZERO DATA)
    let textFallback = `✨ ─── **[ CENTRE D'AIDE ]** ─── ✨\n`;
    textFallback += `📊 Page ${page}/${totalPages} | Total: ${allCommands.length} cmds\n\n`;

    pageCmds.forEach((cmd, idx) => {
      textFallback += `▫️ /${cmd.padEnd(12, ' ')}`;
      if ((idx + 1) % 2 === 0) textFallback += "\n";
    });

    textFallback += `\n\n📌 **Suivant :** Tapez \`/help ${nextPg}\``;

    // Envoi
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
