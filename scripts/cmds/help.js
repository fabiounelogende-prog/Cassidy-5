const { createCanvas, loadImage } = require('canvas');
const fs = require('fs-extra');
const path = require('path');

module.exports = {
  config: {
    name: "help",
    version: "7.0.0",
    author: "YourName",
    countDown: 3,
    role: 0,
    shortDescription: "Menu d'aide Canvas interactif et complet",
    longDescription: "Menu help haute résolution avec filtre par mot-clé, profil utilisateur, détails des rôles et fallback sans forfait.",
    category: "info",
    guide: "{pn} [page / nom_commande / mot_clé]"
  },

  onStart: async function ({ api, event, args, usersData }) {
    const { threadID, messageID, senderID } = event;

    // 1. Chargement sécurisé de toutes les commandes
    const commandsMap = global.GoatBot?.commands || new Map();
    let commandList = [];

    commandsMap.forEach((cmd, name) => {
      const cfg = cmd.config || {};
      commandList.push({
        name: name,
        description: cfg.shortDescription || cfg.longDescription || "Aucune description disponible",
        category: cfg.category || "GÉNÉRAL",
        role: cfg.role || 0,
        countDown: cfg.countDown || 0,
        guide: cfg.guide || ""
      });
    });

    const inputArg = args[0] ? args[0].toLowerCase() : null;

    // 2. CAS 1 : Recherche d'une commande spécifique (/help <nom_commande>)
    if (inputArg && isNaN(inputArg)) {
      const exactCmd = commandList.find(c => c.name.toLowerCase() === inputArg);

      if (exactCmd) {
        const roleLabel = exactCmd.role === 1 ? "Admin Groupe" : exactCmd.role === 2 ? "Admin Bot" : "Tous les membres";
        const detailMsg = 
          `📖 **INFORMATIONS SUR /${exactCmd.name.toUpperCase()}**\n` +
          `──────────────────\n` +
          `📝 **Description:** ${exactCmd.description}\n` +
          `🏷️ **Catégorie:** ${exactCmd.category.toUpperCase()}\n` +
          `🔐 **Permission:** ${roleLabel}\n` +
          `⏱️ **Attente (Cooldown):** ${exactCmd.countDown} seconde(s)\n` +
          `💡 **Utilisation:** ${exactCmd.guide ? exactCmd.guide.replace(/\{pn\}/g, "/" + exactCmd.name) : "/" + exactCmd.name}`;

        return api.sendMessage(detailMsg, threadID, messageID);
      }

      // Si ce n'est pas un nom exact, on filtre la liste par mot-clé
      const filtered = commandList.filter(c => 
        c.name.toLowerCase().includes(inputArg) || 
        c.category.toLowerCase().includes(inputArg) ||
        c.description.toLowerCase().includes(inputArg)
      );

      if (filtered.length > 0) {
        commandList = filtered;
      }
    }

    // 3. CAS 2 : Menu Général avec Pagination
    let page = 1;
    if (inputArg && !isNaN(inputArg)) page = parseInt(inputArg);

    const itemsPerPage = 10; // 10 cartes aérées par image
    const totalPages = Math.ceil(commandList.length / itemsPerPage) || 1;
    if (page < 1 || page > totalPages) page = 1;

    const displayCmds = commandList.slice((page - 1) * itemsPerPage, page * itemsPerPage);

    // 4. Génération de couleurs dynamiques et fluides
    const randomHex = () => Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
    const colorPrimary = `#${randomHex()}`;
    const colorSecondary = `#${randomHex()}`;

    // Dimensions Canvas
    const canvasWidth = 950;
    const canvasHeight = 1150;
    const canvas = createCanvas(canvasWidth, canvasHeight);
    const ctx = canvas.getContext('2d');

    // ARRIÈRE-PLAN
    const bgGradient = ctx.createLinearGradient(0, 0, 0, canvasHeight);
    bgGradient.addColorStop(0, "#0a0c14");
    bgGradient.addColorStop(1, "#121624");
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // EFFETS NÉON EN ARRIÈRE-PLAN
    const g1 = ctx.createRadialGradient(canvasWidth, 0, 20, canvasWidth, 0, 650);
    g1.addColorStop(0, colorPrimary);
    g1.addColorStop(1, 'transparent');
    ctx.fillStyle = g1;
    ctx.globalAlpha = 0.25;
    ctx.beginPath();
    ctx.arc(canvasWidth, 0, 650, 0, Math.PI * 2);
    ctx.fill();

    const g2 = ctx.createRadialGradient(0, canvasHeight, 20, 0, canvasHeight, 550);
    g2.addColorStop(0, colorSecondary);
    g2.addColorStop(1, 'transparent');
    ctx.fillStyle = g2;
    ctx.beginPath();
    ctx.arc(0, canvasHeight, 550, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1.0;

    // 5. PHOTO DE PROFIL UTILISATEUR
    try {
      const avatarUrl = await usersData.getAvatarUrl(senderID);
      if (avatarUrl) {
        const avatar = await loadImage(avatarUrl);
        ctx.save();
        ctx.beginPath();
        ctx.arc(90, 90, 48, 0, Math.PI * 2, true);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(avatar, 42, 42, 96, 96);
        ctx.restore();

        // Cerclage dynamique
        ctx.strokeStyle = colorPrimary;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(90, 90, 50, 0, Math.PI * 2, true);
        ctx.stroke();
      }
    } catch (err) {
      // Pas de crash si l'avatar est indisponible
    }

    // 6. EN-TÊTE
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 36px Sans-Serif";
    ctx.fillText("CENTRE D'AIDE", 165, 80);

    ctx.fillStyle = colorPrimary;
    ctx.font = "bold 16px Sans-Serif";
    ctx.fillText(`${commandList.length} COMMANDES • PAGE ${page}/${totalPages}`, 165, 110);

    // Ligne décorative
    ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(40, 160);
    ctx.lineTo(canvasWidth - 40, 160);
    ctx.stroke();

    // 7. CARTES DE COMMANDES (2 Colonnes x 5 Lignes)
    let x = 40;
    let y = 185;
    let col = 0;
    const cardWidth = 425;
    const cardHeight = 150;

    displayCmds.forEach((item) => {
      // Fond de la carte
      ctx.fillStyle = "rgba(255, 255, 255, 0.04)";
      ctx.beginPath();
      ctx.roundRect(x, y, cardWidth, cardHeight, 18);
      ctx.fill();

      // Bordure subtile
      ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Accent latéral
      ctx.fillStyle = colorSecondary;
      ctx.beginPath();
      ctx.roundRect(x + 6, y + 20, 6, 110, 3);
      ctx.fill();

      // Nom de la commande
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 22px Sans-Serif";
      ctx.fillText(`/${item.name}`, x + 28, y + 45);

      // Badge de Catégorie & Cooldown
      ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
      ctx.beginPath();
      ctx.roundRect(x + 28, y + 58, 110, 22, 6);
      ctx.fill();

      ctx.fillStyle = colorPrimary;
      ctx.font = "bold 11px Sans-Serif";
      const catText = item.category.length > 12 ? item.category.substring(0, 10) + ".." : item.category;
      ctx.fillText(catText.toUpperCase(), x + 36, y + 73);

      // Description courte
      ctx.fillStyle = "#a0a5b5";
      ctx.font = "14px Sans-Serif";
      let desc = item.description;
      if (desc.length > 45) desc = desc.substring(0, 42) + "...";
      ctx.fillText(desc, x + 28, y + 115);

      col++;
      x += cardWidth + 20;
      if (col === 2) {
        col = 0;
        x = 40;
        y += cardHeight + 25;
      }
    });

    // 8. PIED DE PAGE
    ctx.fillStyle = "#70758a";
    ctx.font = "15px Sans-Serif";
    ctx.fillText(`💡 Tapez '/help ${page + 1 > totalPages ? 1 : page + 1}' pour voir la suite ou '/help [nom]' pour les détails.`, 40, canvasHeight - 35);

    // 9. ENVOI DE L'IMAGE & TEXTE FALLBACK
    const cacheDir = path.join(__dirname, "cache");
    const cachePath = path.join(cacheDir, `help_${senderID}_${Date.now()}.png`);
    fs.ensureDirSync(cacheDir);

    const buffer = canvas.toBuffer("image/png");
    fs.writeFileSync(cachePath, buffer);

    // Formatage texte sans forfait (Zero Data)
    let textFallback = `📌 **LISTE DES COMMANDES (Page ${page}/${totalPages})**\n`;
    textFallback += `───────────\n`;
    displayCmds.forEach((item) => {
      textFallback += `🔹 **/${item.name}** : ${item.description}\n`;
    });
    textFallback += `\n➡️ *Tapez '/help ${page + 1 > totalPages ? 1 : page + 1}' pour la page suivante.*`;

    api.sendMessage(
      {
        body: textFallback,
        attachment: fs.createReadStream(cachePath)
      },
      threadID,
      (err) => {
        // Nettoyage sécurisé du fichier temporaire
        if (fs.existsSync(cachePath)) {
          fs.unlinkSync(cachePath);
        }
      },
      messageID
    );
  }
};
        
