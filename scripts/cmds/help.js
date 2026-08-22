const { createCanvas, loadImage } = require('canvas');
const fs = require('fs-extra');
const path = require('path');

module.exports = {
  config: {
    name: "help",
    version: "8.0.0",
    author: "YourName",
    countDown: 3,
    role: 0,
    shortDescription: "Menu help Ultra-Design VIP avec badges d'objets",
    longDescription: "Menu visuel haute définition présentant les commandes et leurs métadonnées sous forme d'objets.",
    category: "info",
    guide: "{pn} [page / commande]"
  },

  onStart: async function ({ api, event, args, usersData }) {
    const { threadID, messageID, senderID } = event;

    // 1. Extraction et structuration des objets commandes
    const commandsMap = global.GoatBot?.commands || new Map();
    let commandList = [];

    commandsMap.forEach((cmd, name) => {
      const cfg = cmd.config || {};
      commandList.push({
        name: name,
        description: cfg.shortDescription || cfg.longDescription || "Pas de description",
        category: (cfg.category || "General").toUpperCase(),
        role: cfg.role || 0,
        countDown: cfg.countDown || 0,
        guide: cfg.guide || ""
      });
    });

    const inputArg = args[0] ? args[0].toLowerCase() : null;

    // Vue détaillée d'un objet commande
    if (inputArg && isNaN(inputArg)) {
      const cmd = commandList.find(c => c.name.toLowerCase() === inputArg);
      if (cmd) {
        const roleText = cmd.role === 1 ? "👑 Admin Groupe" : cmd.role === 2 ? "⚡ Admin Bot" : "👥 Tous";
        const msg = 
          `📦 **OBJET COMMANDE : /${cmd.name.toUpperCase()}**\n` +
          `━━━━━━━━━━━━━━━━━━\n` +
          `📝 **Description :** ${cmd.description}\n` +
          `🏷️ **Catégorie :** ${cmd.category}\n` +
          `🔐 **Accès :** ${roleText}\n` +
          `⏱️ **Cooldown :** ${cmd.countDown}s\n` +
          `💡 **Usage :** ${cmd.guide ? cmd.guide.replace(/\{pn\}/g, "/" + cmd.name) : "/" + cmd.name}`;
        return api.sendMessage(msg, threadID, messageID);
      }
    }

    // 2. Pagination
    let page = 1;
    if (inputArg && !isNaN(inputArg)) page = parseInt(inputArg);

    const itemsPerPage = 8; // 8 cartes spacieuses pour un visuel hyper propre
    const totalPages = Math.ceil(commandList.length / itemsPerPage) || 1;
    if (page < 1 || page > totalPages) page = 1;

    const displayCmds = commandList.slice((page - 1) * itemsPerPage, page * itemsPerPage);

    // 3. Couleurs aléatoires harmonieuses
    const randomHex = () => Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
    const colorPrimary = `#${randomHex()}`;
    const colorSecondary = `#${randomHex()}`;

    // Dimensions Canvas HD
    const width = 1000;
    const height = 1250;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // ARRIÈRE-PLAN GRADIENT SOMBRE
    const bg = ctx.createLinearGradient(0, 0, width, height);
    bg.addColorStop(0, '#090a10');
    bg.addColorStop(1, '#121526');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    // EFFETS NÉON FLUMINEUX (AURORA EFFECT)
    const blur1 = ctx.createRadialGradient(850, 150, 20, 850, 150, 500);
    blur1.addColorStop(0, colorPrimary);
    blur1.addColorStop(1, 'transparent');
    ctx.fillStyle = blur1;
    ctx.globalAlpha = 0.35;
    ctx.beginPath(); ctx.arc(850, 150, 500, 0, Math.PI * 2); ctx.fill();

    const blur2 = ctx.createRadialGradient(150, 1100, 20, 150, 1100, 500);
    blur2.addColorStop(0, colorSecondary);
    blur2.addColorStop(1, 'transparent');
    ctx.fillStyle = blur2;
    ctx.beginPath(); ctx.arc(150, 1100, 500, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1.0;

    // 4. AVATAR USER
    try {
      const avatarUrl = await usersData.getAvatarUrl(senderID);
      if (avatarUrl) {
        const avatar = await loadImage(avatarUrl);
        ctx.save();
        ctx.beginPath();
        ctx.arc(100, 100, 50, 0, Math.PI * 2, true);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(avatar, 50, 50, 100, 100);
        ctx.restore();

        ctx.strokeStyle = colorPrimary;
        ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(100, 100, 52, 0, Math.PI * 2, true); ctx.stroke();
      }
    } catch (e) {}

    // 5. EN-TÊTE
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 42px Sans-Serif";
    ctx.fillText("CENTRE D'AIDE", 180, 95);

    ctx.fillStyle = colorPrimary;
    ctx.font = "bold 18px Sans-Serif";
    ctx.fillText(`TOTAL : ${commandList.length} COMMANDES  •  PAGE ${page}/${totalPages}`, 180, 128);

    // Ligne Néon
    ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(50, 175); ctx.lineTo(width - 50, 175); ctx.stroke();

    // 6. AFFICHAGE DES OBJETS COMMANDES (Cartes Glassmorphism)
    let y = 205;

    displayCmds.forEach((cmd) => {
      const cardX = 50;
      const cardW = width - 100;
      const cardH = 105;

      // Fond de la carte
      ctx.fillStyle = "rgba(255, 255, 255, 0.04)";
      ctx.beginPath(); ctx.roundRect(cardX, y, cardW, cardH, 16); ctx.fill();

      // Contour Lumineux
      ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
      ctx.lineWidth = 1; ctx.stroke();

      // Barre Latérale
      ctx.fillStyle = colorPrimary;
      ctx.beginPath(); ctx.roundRect(cardX + 8, y + 15, 6, 75, 3); ctx.fill();

      // Nom de la commande
      ctx.fillStyle = "#FFFFFF";
      ctx.font = "bold 24px Sans-Serif";
      ctx.fillText(`/${cmd.name}`, cardX + 32, y + 42);

      // Description
      ctx.fillStyle = "#A0A5B5";
      ctx.font = "15px Sans-Serif";
      let desc = cmd.description;
      if (desc.length > 60) desc = desc.substring(0, 57) + "...";
      ctx.fillText(desc, cardX + 32, y + 78);

      // --- BADGES D'OBJETS (METADATA) ---
      // Badge Catégorie
      ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
      ctx.beginPath(); ctx.roundRect(cardX + cardW - 270, y + 22, 120, 26, 8); ctx.fill();
      ctx.fillStyle = colorSecondary;
      ctx.font = "bold 12px Sans-Serif";
      ctx.fillText(cmd.category, cardX + cardW - 258, y + 39);

      // Badge Cooldown
      ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
      ctx.beginPath(); ctx.roundRect(cardX + cardW - 140, y + 22, 60, 26, 8); ctx.fill();
      ctx.fillStyle = "#FFFFFF";
      ctx.font = "12px Sans-Serif";
      ctx.fillText(`⏱️ ${cmd.countDown}s`, cardX + cardW - 132, y + 39);

      // Badge Role
      const roleBadgeColor = cmd.role === 1 ? "#FFB800" : cmd.role === 2 ? "#FF4757" : "#2ED573";
      const roleText = cmd.role === 1 ? "ADMIN" : cmd.role === 2 ? "OWNER" : "ALL";
      ctx.fillStyle = roleBadgeColor;
      ctx.beginPath(); ctx.roundRect(cardX + cardW - 70, y + 22, 55, 26, 8); ctx.fill();
      ctx.fillStyle = "#000000";
      ctx.font = "bold 11px Sans-Serif";
      ctx.fillText(roleText, cardX + cardW - 58, y + 39);

      y += cardH + 18;
    });

    // 7. FOOTER
    ctx.fillStyle = "#70758A";
    ctx.font = "16px Sans-Serif";
    ctx.fillText(`Tapez '/help ${page + 1 > totalPages ? 1 : page + 1}' pour changer de page • '/help [nom]' pour les détails.`, 50, height - 35);

    // 8. ENVOI
    const cacheDir = path.join(__dirname, "cache");
    const cachePath = path.join(cacheDir, `help_${senderID}_${Date.now()}.png`);
    fs.ensureDirSync(cacheDir);

    const buffer = canvas.toBuffer("image/png");
    fs.writeFileSync(cachePath, buffer);

    // Fallback texte propre (Sans forfait)
    let textFallback = `✨ **MENU COMMANDES (Page ${page}/${totalPages})**\n━━━━━━━━━━━━━━━━━━\n`;
    displayCmds.forEach((c) => {
      textFallback += `🔹 **/${c.name}** [${c.category}] : ${c.description}\n`;
    });
    textFallback += `\n➡️ *Suivant : /help ${page + 1 > totalPages ? 1 : page + 1}*`;

    api.sendMessage(
      {
        body: textFallback,
        attachment: fs.createReadStream(cachePath)
      },
      threadID,
      () => { if (fs.existsSync(cachePath)) fs.unlinkSync(cachePath); },
      messageID
    );
  }
};
