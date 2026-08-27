const { createCanvas, loadImage } = require('@napi-rs/canvas');
const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');

const { getStreamsFromAttachment } = global.utils;

let fonts;
try {
  fonts = require("../../func/font.js");
} catch (error) {}

// Utilitaire de dessin d'un rectangle à coins arrondis
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

// Tronquer proprement le texte si la ligne déborde
function truncateText(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let truncated = text;
  while (ctx.measureText(truncated + '...').width > maxWidth && truncated.length > 0) {
    truncated = truncated.slice(0, -1);
  }
  return truncated + '...';
}

// ==========================================
// 🎨 MOTEUR CANVAS CYBER/GLASS DESIGN
// ==========================================
async function generateNotificationCanvas(senderID, adminName, messageText, groupImageUrl = null) {
  const width = 1100;
  const height = 550;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Palette Premium
  const primaryColor = "#F43F5E";   // Rose Néon
  const secondaryColor = "#8B5CF6"; // Violet Cyber
  const accentColor = "#06B6D4";    // Cyan

  // 1. FOND DEGRADÉ PROFOND
  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, '#090D16');
  bg.addColorStop(0.5, '#0F172A');
  bg.addColorStop(1, '#1E1035');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  // Motif de grille futuriste (Grid lines)
  ctx.strokeStyle = "rgba(255, 255, 255, 0.03)";
  ctx.lineWidth = 1;
  for (let x = 0; x < width; x += 40) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
  }
  for (let y = 0; y < height; y += 40) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
  }

  // 2. HALOS NÉONS AMBIANTS (GLOW EFFECTS)
  ctx.save();
  ctx.globalCompositeOperation = 'screen';

  const glow1 = ctx.createRadialGradient(150, 150, 20, 150, 150, 350);
  glow1.addColorStop(0, 'rgba(244, 63, 94, 0.25)');
  glow1.addColorStop(1, 'transparent');
  ctx.fillStyle = glow1; ctx.fillRect(0, 0, width, height);

  const glow2 = ctx.createRadialGradient(950, 400, 20, 950, 400, 350);
  glow2.addColorStop(0, 'rgba(139, 92, 246, 0.25)');
  glow2.addColorStop(1, 'transparent');
  ctx.fillStyle = glow2; ctx.fillRect(0, 0, width, height);

  ctx.restore();

  // 3. PANNEAU EN VERRE TRANSLUCIDE (GLASSMORPHISM)
  ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
  drawRoundedRect(ctx, 35, 35, width - 70, height - 70, 24);
  ctx.fill();

  // Contour lumineux dégradé
  const borderGrad = ctx.createLinearGradient(0, 0, width, height);
  borderGrad.addColorStop(0, primaryColor);
  borderGrad.addColorStop(0.5, secondaryColor);
  borderGrad.addColorStop(1, accentColor);
  ctx.strokeStyle = borderGrad;
  ctx.lineWidth = 3;
  drawRoundedRect(ctx, 35, 35, width - 70, height - 70, 24);
  ctx.stroke();

  // 4. PHOTO DE PROFIL D'ADMINISTRATEUR (AVATAR)
  const avatarX = 175;
  const avatarY = 275;
  const avatarRadius = 100;

  // Ombre portée sous l'avatar
  ctx.save();
  ctx.shadowColor = primaryColor;
  ctx.shadowBlur = 35;
  ctx.beginPath();
  ctx.arc(avatarX, avatarY, avatarRadius + 2, 0, Math.PI * 2);
  ctx.fillStyle = primaryColor;
  ctx.fill();
  ctx.restore();

  // Avatar découpé en cercle
  ctx.save();
  ctx.beginPath();
  ctx.arc(avatarX, avatarY, avatarRadius, 0, Math.PI * 2);
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
    ctx.fillStyle = '#1E293B';
    ctx.fillRect(avatarX - avatarRadius, avatarY - avatarRadius, avatarRadius * 2, avatarRadius * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 60px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText("📢", avatarX, avatarY + 20);
  }
  ctx.restore();

  // Double Anneau Cyber
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(avatarX, avatarY, avatarRadius + 2, 0, Math.PI * 2);
  ctx.stroke();

  // 5. PHOTO DU GROUPE (EN HAUT À DROITE SI DISPONIBLE)
  if (groupImageUrl) {
    const groupImgX = width - 155;
    const groupImgY = 65;
    const groupImgSize = 80;

    ctx.save();
    drawRoundedRect(ctx, groupImgX, groupImgY, groupImgSize, groupImgSize, 16);
    ctx.clip();

    try {
      const gRes = await axios.get(groupImageUrl, { responseType: 'arraybuffer', timeout: 3000 });
      const groupImg = await loadImage(Buffer.from(gRes.data));
      ctx.drawImage(groupImg, groupImgX, groupImgY, groupImgSize, groupImgSize);
    } catch (e) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.fillRect(groupImgX, groupImgY, groupImgSize, groupImgSize);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '30px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText("👥", groupImgX + 40, groupImgY + 50);
    }
    ctx.restore();

    // Bordure néon de l'image du groupe
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 2;
    drawRoundedRect(ctx, groupImgX, groupImgY, groupImgSize, groupImgSize, 16);
    ctx.stroke();
  }

  // 6. EN-TÊTE & BADGE
  ctx.textAlign = 'left';

  // Badge "OFFICIAL ANNOUNCEMENT"
  ctx.fillStyle = 'rgba(244, 63, 94, 0.2)';
  drawRoundedRect(ctx, 320, 75, 260, 32, 8);
  ctx.fill();
  ctx.strokeStyle = primaryColor;
  ctx.lineWidth = 1;
  drawRoundedRect(ctx, 320, 75, 260, 32, 8);
  ctx.stroke();

  ctx.fillStyle = primaryColor;
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText("🔴 OFFICIAL ANNOUNCEMENT", 335, 96);

  // Nom de l'expéditeur / Titre
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '900 32px sans-serif';
  ctx.fillText(adminName.toUpperCase(), 320, 142);

  // Séparateur Lumineux
  const lineGrad = ctx.createLinearGradient(320, 0, width - 70, 0);
  lineGrad.addColorStop(0, primaryColor);
  lineGrad.addColorStop(0.6, secondaryColor);
  lineGrad.addColorStop(1, 'transparent');
  ctx.strokeStyle = lineGrad;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(320, 160);
  ctx.lineTo(width - 80, 160);
  ctx.stroke();

  // 7. ZONE DE MESSAGE (BULLE MODERNE)
  ctx.fillStyle = 'rgba(2, 6, 23, 0.4)';
  drawRoundedRect(ctx, 320, 180, 700, 280, 16);
  ctx.fill();

  ctx.fillStyle = '#F8FAFC';
  ctx.font = '21px sans-serif';

  const rawLines = (messageText || "Annonce officielle du système.").split('\n');
  let y = 222;
  const lineHeight = 34;
  const maxLineY = 420;

  for (let i = 0; i < rawLines.length; i++) {
    if (y > maxLineY) {
      ctx.fillStyle = accentColor;
      ctx.font = 'italic bold 18px sans-serif';
      ctx.fillText("💬 [Message complet ci-dessous...]", 345, y);
      break;
    }
    const currentLine = rawLines[i];
    if (currentLine.trim().length === 0) {
      y += 18;
      continue;
    }
    ctx.fillText(truncateText(ctx, currentLine, 650), 345, y);
    y += lineHeight;
  }

  // 8. FOOTER WATERMARK
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.font = '13px sans-serif';
  ctx.fillText("BROADCAST SYSTEM v4.0 • POWERED BY CANVAS VIP", width - 60, height - 50);

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
    version: "4.1.0",
    author: "Christus & Celestin",
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
    
    // Récupération de la photo du groupe actuel pour l'aperçu
    let currentGroupImage = null;
    try {
      const threadInfo = await api.getThreadInfo(event.threadID);
      currentGroupImage = threadInfo.imageSrc || threadInfo.thumbSrc || null;
    } catch (e) {}

    const prepared = await this.prepareMessage({ event, message: cleanMessage, options, adminName });

    const allThreads = await this.getActiveThreads(threadsData, api);
    if (!allThreads.length) {
      return message.reply("❌ Aucun groupe actif trouvé.");
    }

    // Génération de la carte d'aperçu Canvas
    const canvasImagePath = await generateNotificationCanvas(event.senderID, adminName, cleanMessage, currentGroupImage);

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
      cleanMessage
    });

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

  async sendBulkNotifications({ api, threads, baseMessage, options, adminId, adminName, delayPerGroup, maxRetries, batchSize, cleanMessage }) {
    const results = { success: [], failed: [] };

    for (let i = 0; i < threads.length; i += batchSize) {
      const batch = threads.slice(i, i + batchSize);

      for (const thread of batch) {
        let canvasImagePath = null;
        try {
          let groupName = thread.threadName;
          let groupImage = null;

          try {
            const info = await api.getThreadInfo(thread.threadID);
            groupName = groupName || info.threadName || "Groupe inconnu";
            groupImage = info.imageSrc || info.thumbSrc || null;
          } catch (e) {}

          // Génération dynamique du Canvas pour chaque groupe avec sa propre photo de groupe
          canvasImagePath = await generateNotificationCanvas(adminId, adminName, cleanMessage, groupImage);

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
        } finally {
          if (canvasImagePath && fs.existsSync(canvasImagePath)) {
            fs.unlinkSync(canvasImagePath);
          }
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

        if (canvasImagePath && fs.existsSync(canvasImagePath)) {
          formSend.attachment.push(fs.createReadStream(canvasImagePath));
        }

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
  
