const { createCanvas, loadImage } = require('canvas');
const fs = require('fs-extra');
const path = require('path');

module.exports = {
  config: {
    name: "help",
    version: "15.0.1-FLORAL-COLOR",
    author: "Célestin",
    countDown: 3,
    role: 0,
    shortDescription: "Menu help dynamique et floral par page",
    longDescription: "Affiche un menu Canvas HD élégant avec des thèmes de couleurs chauds/sakura et des motifs floraux générés automatiquement.",
    category: "info",
    guide: "{pn} [page | commande]"
  },

  onStart: async function ({ api, event, args, usersData }) {
    const { threadID, messageID, senderID } = event;
    const prefix = global.config?.PREFIX || global.GoatBot?.config?.PREFIX || "!";
    const commandsMap = global.GoatBot?.commands || new Map();
    const allCommands = Array.from(commandsMap.keys());

    // 1. PALETTES DE COULEURS (Sans Vert ni Bleu Pur)
    const COLOR_PALETTES = [
      { // Theme 1 : Sakura Pink / Rose Floral
        bgTop: "#1A0F1A", bgBottom: "#2A1428", cardBg: "rgba(45, 20, 42, 0.85)", cardBorder: "#6B2D5C",
        accentStart: "#F472B6", accentEnd: "#FB7185", textMain: "#FFF1F2", textSub: "#D4A5B8",
        badgeBg: "rgba(244, 114, 182, 0.18)", badgeText: "#F472B6", flowerPetal: "rgba(244, 114, 182, 0.25)", flowerCenter: "#FBBF24"
      },
      { // Theme 2 : Sunset Warm / Orange & Magenta
        bgTop: "#180C0E", bgBottom: "#2B1117", cardBg: "rgba(50, 20, 28, 0.85)", cardBorder: "#682735",
        accentStart: "#FF512F", accentEnd: "#DD2476", textMain: "#FFF5F5", textSub: "#C98C96",
        badgeBg: "rgba(255, 81, 47, 0.18)", badgeText: "#FF758C", flowerPetal: "rgba(255, 81, 47, 0.22)", flowerCenter: "#FFD166"
      },
      { // Theme 3 : Violet Néon & Orchidée
        bgTop: "#120B1C", bgBottom: "#211033", cardBg: "rgba(38, 20, 58, 0.85)", cardBorder: "#552A80",
        accentStart: "#A855F7", accentEnd: "#EC4899", textMain: "#FAF5FF", textSub: "#B28ECB",
        badgeBg: "rgba(168, 85, 247, 0.18)", badgeText: "#C084FC", flowerPetal: "rgba(168, 85, 247, 0.22)", flowerCenter: "#F472B6"
      },
      { // Theme 4 : Rouge Rubis & Pêche
        bgTop: "#1C0A0E", bgBottom: "#301117", cardBg: "rgba(56, 18, 26, 0.85)", cardBorder: "#782A3A",
        accentStart: "#E11D48", accentEnd: "#FB923C", textMain: "#FFF1F2", textSub: "#CF8C98",
        badgeBg: "rgba(225, 29, 72, 0.18)", badgeText: "#FDA4AF", flowerPetal: "rgba(225, 29, 72, 0.22)", flowerCenter: "#FACC15"
      },
      { // Theme 5 : Ambre Doré & Corail
        bgTop: "#1C120C", bgBottom: "#331E12", cardBg: "rgba(58, 32, 18, 0.85)", cardBorder: "#7A4526",
        accentStart: "#F59E0B", accentEnd: "#F43F5E", textMain: "#FEF3C7", textSub: "#CBB09A",
        badgeBg: "rgba(245, 158, 11, 0.18)", badgeText: "#FBBF24", flowerPetal: "rgba(245, 158, 11, 0.22)", flowerCenter: "#FB7185"
      }
    ];

    function drawRoundedRect(ctx, x, y, width, height, radius) {
      ctx.beginPath();
      ctx.roundRect(x, y, width, height, radius);
      ctx.closePath();
    }

    function drawFlower(ctx, x, y, size, petalColor, centerColor) {
      ctx.save();
      ctx.translate(x, y);
      const petals = 5;
      ctx.fillStyle = petalColor;

      for (let i = 0; i < petals; i++) {
        ctx.beginPath();
        ctx.rotate((Math.PI * 2) / petals);
        ctx.ellipse(0, size * 0.6, size * 0.4, size * 0.7, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = centerColor;
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    let userName = "Utilisateur";
    let avatarUrl = `https://graph.facebook.com/${senderID}/picture?height=500&width=500&access_token=6628568379%7Cc1e620fa708a1d5696fb991c1bde5662`;

    try {
      if (usersData && typeof usersData.getName === 'function') {
        userName = (await usersData.getName(senderID)) || userName;
      }
      if (usersData && typeof usersData.getAvatarUrl === 'function') {
        const customUrl = await usersData.getAvatarUrl(senderID);
        if (customUrl) avatarUrl = customUrl;
      }
    } catch (e) {}

    // ----------------------------------------------------
    // 2. MODE DÉTAILS DE COMMANDE
    // ----------------------------------------------------
    if (args[0] && isNaN(args[0]) && args[0].toLowerCase() !== "basic") {
      const commandName = args[0].toLowerCase();
      const command = commandsMap.get(commandName);

      if (!command) {
        return api.sendMessage(`⚠️ La commande "${commandName}" n'existe pas.`, threadID, messageID);
      }

      const colorIndex = commandName.length % COLOR_PALETTES.length;
      const PALETTE = COLOR_PALETTES[colorIndex];
      const cmdConfig = command.config || {};

      const canvas = createCanvas(1200, 850);
      const ctx = canvas.getContext('2d');

      const bgGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
      bgGrad.addColorStop(0, PALETTE.bgTop);
      bgGrad.addColorStop(1, PALETTE.bgBottom);
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      drawFlower(ctx, 1100, 100, 45, PALETTE.flowerPetal, PALETTE.flowerCenter);
      drawFlower(ctx, 80, 780, 55, PALETTE.flowerPetal, PALETTE.flowerCenter);

      const boxX = 60, boxY = 60, boxW = 1080, boxH = 730;
      ctx.fillStyle = PALETTE.cardBg;
      drawRoundedRect(ctx, boxX, boxY, boxW, boxH, 20);
      ctx.fill();
      ctx.strokeStyle = PALETTE.cardBorder;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = PALETTE.badgeText;
      ctx.font = "bold 16px 'Segoe UI', Roboto, sans-serif";
      ctx.fillText("DETAILS DE LA COMMANDE", boxX + 50, boxY + 65);

      ctx.fillStyle = PALETTE.textMain;
      ctx.font = "bold 38px 'Segoe UI', Roboto, sans-serif";
      ctx.fillText(`${prefix}${commandName}`, boxX + 50, boxY + 115);

      // CORRECTION DU GUIDE (Sécurité objet multilingue ou string)
      let rawGuide = cmdConfig.guide;
      if (typeof rawGuide === 'object' && rawGuide !== null) {
        rawGuide = rawGuide.fr || rawGuide.en || Object.values(rawGuide)[0] || "{pn}";
      }
      if (typeof rawGuide !== 'string') rawGuide = "{pn}";

      const guideFormatted = rawGuide.replace(/\{pn\}|\{p\}\{n\}/g, `${prefix}${commandName}`);

      const labels = [
        { label: "Module", val: cmdConfig.name || commandName },
        { label: "Version", val: cmdConfig.version || "1.0.0" },
        { label: "Auteur", val: cmdConfig.author || "Anonyme" },
        { label: "Accès", val: cmdConfig.role === 1 ? "Admin Groupe" : cmdConfig.role === 2 ? "Admin Bot" : "Tous les membres" },
        { label: "Catégorie", val: (cmdConfig.category || "Général").toUpperCase() },
        { label: "Description", val: cmdConfig.longDescription || cmdConfig.shortDescription || "Aucune description fournie." },
        { label: "Usage", val: guideFormatted }
      ];

      let currY = boxY + 180;
      labels.forEach((item) => {
        ctx.fillStyle = PALETTE.textSub;
        ctx.font = "600 15px 'Segoe UI', Roboto, sans-serif";
        ctx.fillText(item.label.toUpperCase(), boxX + 50, currY);

        ctx.fillStyle = PALETTE.textMain;
        ctx.font = "18px 'Segoe UI', Roboto, sans-serif";
        const textVal = item.val.length > 70 ? item.val.substring(0, 70) + "..." : item.val;
        ctx.fillText(textVal, boxX + 220, currY);
        currY += 60;
      });

      const cacheDir = path.join(__dirname, "cache");
      const cachePath = path.join(cacheDir, `help_${commandName}_${senderID}.png`);
      fs.ensureDirSync(cacheDir);
      fs.writeFileSync(cachePath, canvas.toBuffer("image/png"));

      return api.sendMessage(
        { body: `📌 Détails de la commande **${commandName.toUpperCase()}**`, attachment: fs.createReadStream(cachePath) },
        threadID,
        () => fs.unlinkSync(cachePath),
        messageID
      );
    }

    // ----------------------------------------------------
    // 3. MODE MENU PRINCIPAL (AVEC COULEUR & FLEURS AUTO)
    // ----------------------------------------------------
    let page = 1;
    if (args[0] && !isNaN(args[0])) page = parseInt(args[0]);

    const cmdsPerPage = 16;
    const totalPages = Math.ceil(allCommands.length / cmdsPerPage) || 1;
    if (page < 1 || page > totalPages) page = 1;

    const colorIndex = (page - 1) % COLOR_PALETTES.length;
    const PALETTE = COLOR_PALETTES[colorIndex];

    const startIdx = (page - 1) * cmdsPerPage;
    const pageCmds = allCommands.slice(startIdx, startIdx + cmdsPerPage);

    const canvas = createCanvas(1200, 1450);
    const ctx = canvas.getContext('2d');

    const bgGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    bgGrad.addColorStop(0, PALETTE.bgTop);
    bgGrad.addColorStop(1, PALETTE.bgBottom);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    drawFlower(ctx, 1120, 90, 50, PALETTE.flowerPetal, PALETTE.flowerCenter);
    drawFlower(ctx, 80, 1380, 60, PALETTE.flowerPetal, PALETTE.flowerCenter);
    drawFlower(ctx, 1140, 1360, 40, PALETTE.flowerPetal, PALETTE.flowerCenter);

    const headX = 60, headY = 60, headW = 1080, headH = 110;
    ctx.fillStyle = PALETTE.cardBg;
    drawRoundedRect(ctx, headX, headY, headW, headH, 18);
    ctx.fill();
    ctx.strokeStyle = PALETTE.cardBorder;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    const avatarSize = 64;
    const avatarX = headX + 25;
    const avatarY = headY + (headH - avatarSize) / 2;

    try {
      const avatarImg = await loadImage(avatarUrl);
      ctx.save();
      ctx.beginPath();
      ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(avatarImg, avatarX, avatarY, avatarSize, avatarSize);
      ctx.restore();

      const ringGrad = ctx.createLinearGradient(avatarX, avatarY, avatarX + avatarSize, avatarY + avatarSize);
      ringGrad.addColorStop(0, PALETTE.accentStart);
      ringGrad.addColorStop(1, PALETTE.accentEnd);
      ctx.strokeStyle = ringGrad;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2 + 2, 0, Math.PI * 2);
      ctx.stroke();
    } catch (e) {}

    ctx.fillStyle = PALETTE.textMain;
    ctx.font = "bold 24px 'Segoe UI', Roboto, sans-serif";
    ctx.fillText(userName, headX + 105, headY + 45);

    ctx.fillStyle = PALETTE.textSub;
    ctx.font = "14px 'Segoe UI', Roboto, sans-serif";
    ctx.fillText(`PREFIX: ${prefix}   •   ID: ${senderID}`, headX + 105, headY + 75);

    const progressWidth = 400, progressHeight = 6, progressX = 60, progressY = 195;
    ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
    drawRoundedRect(ctx, progressX, progressY, progressWidth, progressHeight, 3);
    ctx.fill();

    const activeProgressWidth = Math.max((page / totalPages) * progressWidth, 12);
    const progressGrad = ctx.createLinearGradient(progressX, 0, progressX + progressWidth, 0);
    progressGrad.addColorStop(0, PALETTE.accentStart);
    progressGrad.addColorStop(1, PALETTE.accentEnd);

    ctx.fillStyle = progressGrad;
    drawRoundedRect(ctx, progressX, progressY, activeProgressWidth, progressHeight, 3);
    ctx.fill();

    ctx.fillStyle = PALETTE.textSub;
    ctx.font = "600 14px 'Segoe UI', Roboto, sans-serif";
    ctx.fillText(`PAGE ${page} / ${totalPages}  (${allCommands.length} COMMANDES)`, progressX + progressWidth + 20, progressY + 6);

    const cardWidth = 525, cardHeight = 85, gapX = 30, gapY = 16, startX = 60, startY = 225;

    pageCmds.forEach((cmdName, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = startX + col * (cardWidth + gapX);
      const y = startY + row * (cardHeight + gapY);

      const cmdObj = commandsMap.get(cmdName);
      const category = (cmdObj?.config?.category || "Général").toUpperCase();

      ctx.fillStyle = PALETTE.cardBg;
      drawRoundedRect(ctx, x, y, cardWidth, cardHeight, 14);
      ctx.fill();

      ctx.strokeStyle = PALETTE.cardBorder;
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = PALETTE.textMain;
      ctx.font = "bold 20px 'Segoe UI', Roboto, sans-serif";
      ctx.fillText(`${prefix}${cmdName}`, x + 25, y + 48);

      ctx.font = "bold 11px 'Segoe UI', Roboto, sans-serif";
      const categoryText = category.length > 14 ? category.substring(0, 11) + "..." : category;
      const textMetrics = ctx.measureText(categoryText);
      const badgeWidth = textMetrics.width + 24;
      const badgeHeight = 26;
      const badgeX = x + cardWidth - badgeWidth - 20;
      const badgeY = y + (cardHeight - badgeHeight) / 2;

      ctx.fillStyle = PALETTE.badgeBg;
      drawRoundedRect(ctx, badgeX, badgeY, badgeWidth, badgeHeight, 6);
      ctx.fill();

      ctx.fillStyle = PALETTE.badgeText;
      ctx.fillText(categoryText, badgeX + 12, badgeY + 17);
    });

    const nextPg = page + 1 > totalPages ? 1 : page + 1;
    ctx.fillStyle = PALETTE.textSub;
    ctx.font = "14px 'Segoe UI', Roboto, sans-serif";
    ctx.fillText(`💡 Tape ${prefix}help ${nextPg} pour la page suivante (avec un nouveau thème floral !)`, 160, 1400);

    const cacheDir = path.join(__dirname, "cache");
    const cachePath = path.join(cacheDir, `help_page_${page}_${senderID}.png`);
    fs.ensureDirSync(cacheDir);
    fs.writeFileSync(cachePath, canvas.toBuffer("image/png"));

    api.sendMessage(
      {
        body: `📜 **MENU DES COMMANDES** (Page ${page}/${totalPages})`,
        attachment: fs.createReadStream(cachePath)
      },
      threadID,
      () => fs.unlinkSync(cachePath),
      messageID
    );
  }
};
