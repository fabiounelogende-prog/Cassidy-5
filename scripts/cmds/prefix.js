const { createCanvas, loadImage } = require('@napi-rs/canvas');
const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');

function drawRoundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function truncateText(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  while (ctx.measureText(text + '...').width > maxWidth && text.length > 0) {
    text = text.slice(0, -1);
  }
  return text + '...';
}

// ==========================================
// 🎨 ENGINE CANVAS VIP - PREFIX CARD
// ==========================================
async function generatePrefixCanvas(userId, userName, globalPrefix, threadPrefix) {
  const width = 900;
  const height = 480;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Génération de couleurs néon aléatoires
  const getRandomColor = () => `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`;
  const themeColor = getRandomColor();
  const accentColor = getRandomColor();

  // 1. Fond Cyberpunk Sombre
  const bgGradient = ctx.createLinearGradient(0, 0, width, height);
  bgGradient.addColorStop(0, '#0a0d18');
  bgGradient.addColorStop(0.5, '#121729');
  bgGradient.addColorStop(1, '#0a0d18');
  ctx.fillStyle = bgGradient;
  ctx.fillRect(0, 0, width, height);

  // 2. Halo lumineux diffus
  const glow = ctx.createRadialGradient(200, 240, 20, 200, 240, 350);
  glow.addColorStop(0, themeColor + '35');
  glow.addColorStop(1, 'transparent');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  // 3. Cadre effet verre
  ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
  drawRoundedRect(ctx, 25, 25, width - 50, height - 50, 20);
  ctx.fill();

  ctx.strokeStyle = themeColor;
  ctx.lineWidth = 3;
  drawRoundedRect(ctx, 25, 25, width - 50, height - 50, 20);
  ctx.stroke();

  // 4. Photo de Profil (Avatar User)
  const avatarX = 170;
  const avatarY = 240;
  const avatarRadius = 95;

  ctx.save();
  ctx.beginPath();
  ctx.arc(avatarX, avatarY, avatarRadius, 0, Math.PI * 2, true);
  ctx.closePath();
  ctx.clip();

  const avatarUrl = `https://graph.facebook.com/${userId}/picture?height=500&width=500&access_token=6628568379%7Cc1e620fa708a1d5696fb991c1bde5662`;
  let imgLoaded = false;

  try {
    const res = await axios.get(avatarUrl, { responseType: 'arraybuffer', timeout: 3000 });
    const userAvatar = await loadImage(Buffer.from(res.data));
    ctx.drawImage(userAvatar, avatarX - avatarRadius, avatarY - avatarRadius, avatarRadius * 2, avatarRadius * 2);
    imgLoaded = true;
  } catch (e) {}

  if (!imgLoaded) {
    ctx.fillStyle = '#1c233a';
    ctx.fillRect(avatarX - avatarRadius, avatarY - avatarRadius, avatarRadius * 2, avatarRadius * 2);
    ctx.fillStyle = themeColor;
    ctx.font = 'bold 60px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText("⚡", avatarX, avatarY + 20);
  }
  ctx.restore();

  // Contour lumineux autour de l'avatar
  ctx.strokeStyle = themeColor;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(avatarX, avatarY, avatarRadius + 4, 0, Math.PI * 2);
  ctx.stroke();

  // 5. En-tête Texte
  ctx.textAlign = 'left';
  ctx.fillStyle = themeColor;
  ctx.font = 'bold 34px sans-serif';
  ctx.fillText("SYSTEM PREFIX HUD", 310, 95);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText(`Utilisateur: ${truncateText(ctx, userName, 320)}`, 310, 130);

  // Ligne de séparation
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(310, 150);
  ctx.lineTo(width - 50, 150);
  ctx.stroke();

  // 6. Objet Card 1: Prefix Global
  const cardX = 310;
  const cardW = 530;

  ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
  drawRoundedRect(ctx, cardX, 175, cardW, 75, 12);
  ctx.fill();

  ctx.fillStyle = accentColor;
  drawRoundedRect(ctx, cardX + 8, 187, 6, 51, 3);
  ctx.fill();

  ctx.fillStyle = '#8E9AAF';
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText("PREFIX GLOBAL SYSTEM", cardX + 30, 205);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 26px monospace';
  ctx.fillText(globalPrefix, cardX + 30, 237);

  // 7. Objet Card 2: Prefix Groupe
  ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
  drawRoundedRect(ctx, cardX, 265, cardW, 75, 12);
  ctx.fill();

  ctx.fillStyle = themeColor;
  drawRoundedRect(ctx, cardX + 8, 277, 6, 51, 3);
  ctx.fill();

  ctx.fillStyle = '#8E9AAF';
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText("PREFIX CE GROUPE", cardX + 30, 295);

  ctx.fillStyle = themeColor;
  ctx.font = 'bold 26px monospace';
  ctx.fillText(threadPrefix, cardX + 30, 327);

  // Footer / Astuce
  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.font = 'italic 16px sans-serif';
  ctx.fillText(`Tapez "${threadPrefix}help" pour la liste des commandes.`, cardX, 380);

  // Sauvegarde image
  const tmpDir = path.join(__dirname, "cache");
  await fs.ensureDir(tmpDir);
  const imagePath = path.join(tmpDir, `prefix_${Date.now()}_${userId}.png`);
  await fs.outputFile(imagePath, canvas.toBuffer('image/png'));
  return imagePath;
}

module.exports = {
  config: {
    name: "prefix",
    aliases: [],
    version: "2.0.0",
    author: "Christus + VIP Canvas",
    countDown: 5,
    role: 0,
    description: {
      en: "Consulter ou modifier le préfixe avec une interface visuelle VIP"
    },
    category: "system",
    guide: {
      en: "👋 Options du Préfixe :\n" +
          "╰‣ {pn} <nouveau> : Changer le préfixe du groupe\n" +
          "╰‣ {pn} <nouveau> -g : Changer le préfixe global (Admin)\n" +
          "╰‣ {pn} reset : Réinitialiser le préfixe\n" +
          "╰‣ {pn} refresh : Rafraîchir le cache du préfixe"
    }
  },

  onStart: async function ({ message, role, args, commandName, event, threadsData, usersData }) {
    const globalPrefix = global.GoatBot.config.prefix;
    const userName = await usersData.getName(event.senderID) || "Utilisateur";
    const threadPrefix = await threadsData.get(event.threadID, "data.prefix") || globalPrefix;

    if (!args[0]) {
      const imgPath = await generatePrefixCanvas(event.senderID, userName, globalPrefix, threadPrefix);
      return message.reply({
        body: `👋 Hey ${userName}, voici les détails du préfixe :`,
        attachment: fs.createReadStream(imgPath),
        mentions: [{ id: event.senderID, tag: userName }]
      }, () => {
        if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
      });
    }

    if (args[0] === "reset") {
      await threadsData.set(event.threadID, null, "data.prefix");
      const imgPath = await generatePrefixCanvas(event.senderID, userName, globalPrefix, globalPrefix);
      return message.reply({
        body: `✅ Préfixe de la discussion réinitialisé avec succès !`,
        attachment: fs.createReadStream(imgPath),
        mentions: [{ id: event.senderID, tag: userName }]
      }, () => {
        if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
      });
    }

    if (args[0] === "refresh") {
      try {
        const threadID = event.threadID;
        if (threadsData.cache && threadsData.cache[threadID]) {
          delete threadsData.cache[threadID].data?.prefix;
        }
        const refreshedPrefix = await threadsData.get(threadID, "data.prefix") || globalPrefix;
        const imgPath = await generatePrefixCanvas(event.senderID, userName, globalPrefix, refreshedPrefix);
        return message.reply({
          body: `🔄 Cache du préfixe rafraîchi avec succès !`,
          attachment: fs.createReadStream(imgPath),
          mentions: [{ id: event.senderID, tag: userName }]
        }, () => {
          if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
        });
      } catch (error) {
        return message.reply({
          body: `❌ Impossible de rafraîchir le préfixe !`,
          mentions: [{ id: event.senderID, tag: userName }]
        });
      }
    }

    const newPrefix = args[0];
    const setGlobal = args[1] === "-g";

    if (setGlobal && role < 2) {
      return message.reply({
        body: `⛔ Privilèges Administrateur requis pour modifier le préfixe global !`,
        mentions: [{ id: event.senderID, tag: userName }]
      });
    }

    const currentPrefix = await threadsData.get(event.threadID, "data.prefix") || globalPrefix;
    const confirmMessage = setGlobal
      ? `⚙️ ${userName}, confirmer le changement de préfixe GLOBAL ?\n╭‣ Actuel : ${globalPrefix}\n╰‣ Nouveau : ${newPrefix}\n🤖 Réagissez à ce message pour valider !`
      : `⚙️ ${userName}, confirmer le changement de préfixe DU GROUPE ?\n╭‣ Actuel : ${currentPrefix}\n╰‣ Nouveau : ${newPrefix}\n🤖 Réagissez à ce message pour valider !`;

    return message.reply(confirmMessage, (err, info) => {
      if (err) return;
      global.GoatBot.onReaction.set(info.messageID, {
        author: event.senderID,
        newPrefix,
        setGlobal,
        commandName
      });
    });
  },

  onReaction: async function ({ message, event, Reaction, threadsData, usersData }) {
    const { author, newPrefix, setGlobal } = Reaction;
    if (event.userID !== author) return;
    const userName = await usersData.getName(event.userID) || "Utilisateur";

    if (setGlobal) {
      try {
        global.GoatBot.config.prefix = newPrefix;
        const configPath = global.client.dirConfig || path.join(process.cwd(), "config.json");
        fs.writeFileSync(configPath, JSON.stringify(global.GoatBot.config, null, 2));
        
        const imgPath = await generatePrefixCanvas(event.userID, userName, newPrefix, newPrefix);
        return message.reply({
          body: `✅ Préfixe global mis à jour avec succès : "${newPrefix}"`,
          attachment: fs.createReadStream(imgPath),
          mentions: [{ id: event.userID, tag: userName }]
        }, () => {
          if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
        });
      } catch (error) {
        return message.reply(`❌ Échec lors de la sauvegarde du fichier de configuration.`);
      }
    }

    try {
      await threadsData.set(event.threadID, newPrefix, "data.prefix");
      const globalPrefix = global.GoatBot.config.prefix;
      const imgPath = await generatePrefixCanvas(event.userID, userName, globalPrefix, newPrefix);
      return message.reply({
        body: `✅ Préfixe du groupe mis à jour avec succès : "${newPrefix}"`,
        attachment: fs.createReadStream(imgPath),
        mentions: [{ id: event.userID, tag: userName }]
      }, () => {
        if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
      });
    } catch (error) {
      return message.reply(`❌ Erreur de base de données lors du changement de préfixe.`);
    }
  },

  onChat: async function ({ event, message, threadsData, usersData }) {
    const triggerText = event.body?.toLowerCase().trim();
    if (!triggerText) return;
    const isTrigger = triggerText === "prefix" || triggerText === "ňč" || triggerText === "nøøbcore";
    if (!isTrigger) return;

    const userName = await usersData.getName(event.senderID) || "Utilisateur";
    const globalPrefix = global.GoatBot.config.prefix;
    const threadPrefix = await threadsData.get(event.threadID, "data.prefix") || globalPrefix;

    const imgPath = await generatePrefixCanvas(event.senderID, userName, globalPrefix, threadPrefix);
    return message.reply({
      body: `👋 Hey ${userName}, besoin du préfixe ?`,
      attachment: fs.createReadStream(imgPath),
      mentions: [{ id: event.senderID, tag: userName }]
    }, () => {
      if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
    });
  }
};
                           
