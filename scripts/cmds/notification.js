const { createCanvas, loadImage } = require('@napi-rs/canvas');
const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');

const { getStreamsFromAttachment } = global.utils;

let fonts;
try {
  fonts = require("../../func/font.js");
} catch (error) {}

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
// 🎨 MOTEUR CANVAS CYBER BROADCAST
// ==========================================
async function generateNotificationCanvas(senderID, adminName, messageText) {
  const width = 1000;
  const height = 500;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Couleurs dynamiques aléatoires
  const randomHex = () => Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
  const themeColor = `#${randomHex()}`;
  const secondaryColor = `#${randomHex()}`;

  // 1. Fond sombre dégradé
  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, '#05060a');
  bg.addColorStop(0.5, '#0d101d');
  bg.addColorStop(1, '#05060a');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  // 2. Halo lumineux
  const glow = ctx.createRadialGradient(200, 250, 10, 200, 250, 400);
  glow.addColorStop(0, themeColor + '40');
  glow.addColorStop(1, 'transparent');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  // 3. Cadre style Forteresse Cyber
  ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
  drawRoundedRect(ctx, 25, 25, width - 50, height - 50, 20);
  ctx.fill();

  ctx.strokeStyle = themeColor;
  ctx.lineWidth = 3;
  drawRoundedRect(ctx, 25, 25, width - 50, height - 50, 20);
  ctx.stroke();

  // 4. Photo de Profil (Avatar Admin)
  const avatarX = 180;
  const avatarY = 250;
  const avatarRadius = 105;

  ctx.save();
  ctx.beginPath();
  ctx.arc(avatarX, avatarY, avatarRadius, 0, Math.PI * 2, true);
  ctx.closePath();
  ctx.clip();

  const avatarUrl = `https://graph.facebook.com/${senderID}/picture?height=500&width=500&access_token=6628568379%7Cc1e620fa708a1d5696fb991c1bde5662`;
  let imgLoaded = false;

  try {
    const res = await axios.get(avatarUrl, { responseType: 'arraybuffer', timeout: 3000 });
    const userAvatar = await loadImage(Buffer.from(res.data));
    ctx.drawImage(userAvatar, avatarX - avatarRadius, avatarY - avatarRadius, avatarRadius * 2, avatarRadius * 2);
    imgLoaded = true;
  } catch (e) {}

  if (!imgLoaded) {
    ctx.fillStyle = '#121624';
    ctx.fillRect(avatarX - avatarRadius, avatarY - avatarRadius, avatarRadius * 2, avatarRadius * 2);
    ctx.fillStyle = themeColor;
    ctx.font = 'bold 70px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText("📢", avatarX, avatarY + 25);
  }
  ctx.restore();

  // Anneau néon
  ctx.strokeStyle = themeColor;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(avatarX, avatarY, avatarRadius + 3, 0, Math.PI * 2);
  ctx.stroke();

  // 5. Contenu du Message & Header
  ctx.textAlign = 'left';
  ctx.fillStyle = themeColor;
  ctx.font = 'bold 36px sans-serif';
  ctx.fillText("📢 BROADCAST SYSTEM", 330, 95);

  // Badge d'administrateur
  ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
  drawRoundedRect(ctx, 330, 115, 280, 32, 8);
  ctx.fill();

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText(`EXPÉDITEUR: ${adminName.toUpperCase()}`, 342, 136);

  // Ligne de séparation
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(330, 165);
  ctx.lineTo(width - 50, 165);
  ctx.stroke();

  // Zone de texte du message
  ctx.fillStyle = '#E2E8F0';
  ctx.font = '20px sans-serif';
  
  const rawLines = (messageText || "Annonce officielle de l'administration.").split('\n');
  let y = 205;
  const lineHeight = 30;

  for (let i = 0; i < rawLines.length; i++) {
    if (y > 420) {
      ctx.fillStyle = secondaryColor;
      ctx.fillText("... [voir message complet]", 330, y);
      break;
    }
    ctx.fillText(truncateText(ctx, rawLines[i], 610), 330, y);
    y += lineHeight;
  }

  // Sauvegarde temporaire
  const tmpDir = path.join(__dirname, "cache");
  await fs.ensureDir(tmpDir);
  const imagePath = path.join(tmpDir, `noti_${Date.now()}_${senderID}.png`);
  await fs.outputFile(imagePath, canvas.toBuffer('image/png'));
  return imagePath;
}

module.exports = {
  config: {
    name: "notification",
    aliases: ["notify", "noti"],
    version: "4.0",
    author: "Christus + Canvas VIP",
    countDown: 5,
    role: 4,
    description: "📢 Envoie une notification visuelle Canvas à tous les groupes",
    category: "owner",
    guide: {
      fr: "{pn} <message> [-a] [-p]\n   -a : mentionner tous les membres\n   -p : épingler le message"
    },
    envConfig: {
      delayPerGroup: 250,
      maxRetries: 2,
      batchSize: 10
    }
  },

  onStart: async function ({ message, api, event, args, commandName, envCommands, threadsData }) {
    const { delayPerGroup, maxRetries, batchSize } = envCommands[commandName];
    const startTime = Date.now();

    const { cleanMessage, options } = this.parseArgs(args);

    if (!cleanMessage && (!event.attachments || event.attachments.length === 0)) {
      const msg = "📢 Notification\n━━━━━━━━━━━━━━━━━━\n❌ Veuillez entrer un message ou joindre un média.";
      return message.reply(fonts?.bold ? fonts.bold(msg) : msg);
    }

    const adminName = (await api.getUserInfo(event.senderID))[event.senderID]?.name || "Administrateur";
    const prepared = await this.prepareMessage({ event, message: cleanMessage, options, adminName });

    const allThreads = await this.getActiveThreads(threadsData, api);
    if (!allThreads.length) {
      return message.reply("❌ Aucun groupe actif trouvé.");
    }

    // Génération de la carte d'aperçu
    const canvasImagePath = await generateNotificationCanvas(event.senderID, adminName, cleanMessage);

    const confirmMsg = `📢 **ENVOI BROADCAST CANVAS**\n━━━━━━━━━━━━━━━━━━\n➜ ${allThreads.length} groupe(s) ciblé(s)\n➜ Délai : ${delayPerGroup} ms par groupe\n➜ Options : ${options.tagAll ? "Tag All" : "Standard"} ${options.pin ? "+ Épinglage" : ""}\n➜ Expéditeur : ${adminName}\n\n✅ **Répondez "oui" pour confirmer l'envoi.**`;

    const replyMsg = await message.reply({
      body: fonts?.bold ? fonts.bold(confirmMsg) : confirmMsg,
      attachment: fs.createReadStream(canvasImagePath)
    });

    if (fs.existsSync(canvasImagePath)) fs.unlinkSync(canvasImagePath);

    global.GoatBot.onReply.set(replyMsg.messageID, {
      commandName: this.config.name,
      author: event.senderID,
      type: "confirm_notification",
      prepared,
      allThreads,
      delayPerGroup,
      maxRetries,
      batchSize,
      startTime,
      adminId: event.senderID,
      adminName,
      messageID: replyMsg.messageID,
      cleanMessage
    });

    setTimeout(() => {
      const data = global.GoatBot.onReply.get(replyMsg.messageID);
      if (data && data.author === event.senderID) {
        message.reply("⏰ Temps écoulé, envoi annulé.");
        global.GoatBot.onReply.delete(replyMsg.messageID);
        message.unsend(replyMsg.messageID).catch(() => {});
      }
    }, 30000);
  },

  onReply: async function ({ message, event, Reply, api }) {
    if (Reply.author !== event.senderID) return;
    if (event.body.trim().toLowerCase() !== "oui") {
      return message.reply("❌ Envoi annulé.");
    }

    const { prepared, allThreads, delayPerGroup, maxRetries, batchSize, startTime, adminId, adminName, messageID, cleanMessage } = Reply;
    message.unsend(messageID).catch(() => {});
    global.GoatBot.onReply.delete(messageID);

    await message.reply(fonts?.bold ? fonts.bold(`📢 Transmission de l'annonce Canvas à ${allThreads.length} groupes...`) : `📢 Transmission de l'annonce Canvas à ${allThreads.length} groupes...`);

    // Génération de la carte finale pour la diffusion globale
    const canvasImagePath = await generateNotificationCanvas(adminId, adminName, cleanMessage);

    const results = await this.sendBulkNotifications({
      api,
      threads: allThreads,
      baseMessage: prepared,
      options: prepared.options,
      adminId,
      adminName,
      delayPerGroup,
      maxRetries,
      batchSize,
      canvasImagePath
    });

    if (fs.existsSync(canvasImagePath)) fs.unlinkSync(canvasImagePath);

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
    const resultMsg = `📢 **RAPPORT DE DIFFUSION**\n━━━━━━━━━━━━━━━━━━\n✅ Réussis : ${results.success.length}\n❌ Échecs : ${results.failed.length}\n⏱️ Temps total : ${totalTime}s`;
    message.reply(fonts?.bold ? fonts.bold(resultMsg) : resultMsg);
  },

  parseArgs(args) {
    const options = { tagAll: false, pin: false };
    const messageParts = [];

    for (const arg of args) {
      if (arg.startsWith("-")) {
        if (arg === "-a" || arg === "--all") options.tagAll = true;
        else if (arg === "-p" || arg === "--pin") options.pin = true;
        else messageParts.push(arg);
      } else messageParts.push(arg);
    }

    return {
      cleanMessage: messageParts.join(" "),
      options
    };
  },

  async prepareMessage({ event, message, options, adminName }) {
    const title = "𝐍𝐎𝐓𝐈𝐅𝐈𝐂𝐀𝐓𝐈𝐎𝐍 𝐃𝐄 𝐋'𝐀𝐃𝐌𝐈𝐍𝐈𝐒𝐓𝐑𝐀𝐓𝐄𝐔𝐑";
    let body = `📢 ${title}\n━━━━━━━━━━━━━━━━━━\nFrom : ${adminName}\n\n💬 :\n${message || ""}\n\n`;
    const attachments = [
      ...(event.attachments || []),
      ...(event.messageReply?.attachments || [])
    ].filter(item =>
      ["photo", "png", "animated_image", "video", "audio"].includes(item.type)
    );

    return {
      bodyTemplate: body,
      rawAttachments: attachments,
      options
    };
  },

  async getActiveThreads(threadsData, api) {
    const allThreads = await threadsData.getAll();
    const botID = api.getCurrentUserID();
    return allThreads.filter(t =>
      t.isGroup && t.members?.some(m => m.userID === botID && m.inGroup)
    );
  },

  async sendBulkNotifications({ api, threads, baseMessage, options, adminId, adminName, delayPerGroup, maxRetries, batchSize, canvasImagePath }) {
    const results = { success: [], failed: [] };

    for (let i = 0; i < threads.length; i += batchSize) {
      const batch = threads.slice(i, i + batchSize);

      for (const thread of batch) {
        try {
          let groupName = thread.threadName;
          if (!groupName) {
            const info = await api.getThreadInfo(thread.threadID);
            groupName = info.threadName || "Groupe inconnu";
          }

          let personalizedBody = `${baseMessage.bodyTemplate}\n🏷️ Groupe : ${groupName}\n🔗 ID : ${thread.threadID}\n\n`;
          
          const membersData = thread.members || (await api.getThreadInfo(thread.threadID)).userInfo;
          const res = await this.sendWithRetry({
            api,
            threadID: thread.threadID,
            body: personalizedBody,
            rawAttachments: baseMessage.rawAttachments,
            options,
            membersData,
            adminId,
            adminName,
            maxRetries,
            canvasImagePath
          });

          if (res.success) results.success.push(thread.threadID);
          else results.failed.push(thread.threadID);

          await this.delay(delayPerGroup);
        } catch {
          results.failed.push(thread.threadID);
        }
      }

      if (i + batchSize < threads.length) await this.delay(1000);
    }

    return results;
  },

  async sendWithRetry({ api, threadID, body, rawAttachments, options, membersData, adminId, adminName, maxRetries, canvasImagePath }) {
    let lastError;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        let finalBody = body;
        const mentions = [];

        const adminTag = adminName;
        if (finalBody.includes(adminName)) {
          const index = finalBody.indexOf(adminName);
          finalBody = finalBody.replace(adminName, adminTag);
          mentions.push({ id: adminId, tag: adminTag, fromIndex: index });
        }

        const formSend = { body: finalBody, mentions, attachment: [] };

        // Ajout de la carte Canvas générée
        if (canvasImagePath && fs.existsSync(canvasImagePath)) {
          formSend.attachment.push(fs.createReadStream(canvasImagePath));
        }

        // Ajout des autres médias joints
        if (rawAttachments?.length) {
          const mediaStreams = await getStreamsFromAttachment(rawAttachments);
          formSend.attachment.push(...(Array.isArray(mediaStreams) ? mediaStreams : [mediaStreams]));
        }

        if (options.tagAll && membersData) {
          const botID = api.getCurrentUserID();
          let offset = formSend.body.length;

          const ids = membersData
            .filter(m => m.userID !== botID && m.userID !== adminId && m.inGroup)
            .map(m => m.userID);

          for (const id of ids) {
            const userName = membersData.find(m => m.userID === id)?.name || id;
            const tagText = userName;
            formSend.body += tagText;
            mentions.push({ tag: tagText, id, fromIndex: offset });
            offset += tagText.length;
          }
        }

        const info = await api.sendMessage(formSend, threadID);

        if (options.pin && info?.messageID) {
          try {
            await api.pinMessage(info.messageID, threadID);
          } catch {}
        }

        return { success: true };
      } catch (err) {
        lastError = err;
        if (attempt < maxRetries) await this.delay(1000 * (attempt + 1));
      }
    }

    return { success: false, error: lastError?.message };
  },

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
};
        
