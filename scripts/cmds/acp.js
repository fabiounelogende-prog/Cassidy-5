const moment = require("moment-timezone");
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');

let fonts;
try {
  fonts = require('../../func/font.js');
} catch (e) {}

// Utilitaire pour tracer un rectangle à coins arrondis
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

// Tronquer proprement le texte
function truncateText(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let truncated = text;
  while (ctx.measureText(truncated + '...').width > maxWidth && truncated.length > 0) {
    truncated = truncated.slice(0, -1);
  }
  return truncated + '...';
}

// ==========================================
// 🎨 MOTEUR CANVAS : CARTE DES DEMANDES
// ==========================================
async function generateRequestsCanvas(requestsList) {
  // On limite à 6 cartes maximum sur l'image pour garder un rendu ultra propre
  const displayList = requestsList.slice(0, 6);
  
  const width = 1000;
  const headerHeight = 130;
  const cardHeight = 100;
  const gap = 15;
  const height = headerHeight + (displayList.length * (cardHeight + gap)) + 60;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Palette Cyber
  const primaryColor = "#3B82F6";   // Bleu Cyber
  const secondaryColor = "#8B5CF6"; // Violet
  const accentColor = "#10B981";    // Émeraude

  // 1. FOND DEGRADÉ PROFOND
  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, '#0B0F19');
  bg.addColorStop(0.5, '#111827');
  bg.addColorStop(1, '#1E1035');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  // Motif de grille futuriste
  ctx.strokeStyle = "rgba(255, 255, 255, 0.03)";
  ctx.lineWidth = 1;
  for (let x = 0; x < width; x += 40) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
  }
  for (let y = 0; y < height; y += 40) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
  }

  // 2. EN-TÊTE
  ctx.fillStyle = 'rgba(17, 24, 39, 0.8)';
  drawRoundedRect(ctx, 30, 25, width - 60, 80, 16);
  ctx.fill();
  
  ctx.strokeStyle = primaryColor;
  ctx.lineWidth = 2;
  drawRoundedRect(ctx, 30, 25, width - 60, 80, 16);
  ctx.stroke();

  // Titre & Badge
  ctx.fillStyle = primaryColor;
  ctx.font = 'bold 14px sans-serif';
  ctx.fillText("👥 FRIEND REQUEST MANAGER", 55, 52);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '900 24px sans-serif';
  ctx.fillText(`DEMANDES D'AMITIÉ EN ATTENTE (${requestsList.length})`, 55, 82);

  // 3. CARTES DES UTILISATEURS
  let startY = headerHeight;

  for (let i = 0; i < displayList.length; i++) {
    const userNode = displayList[i].node;
    const indexStr = `#${i + 1}`;

    // Fond de la carte de l'utilisateur (Glassmorphism)
    ctx.fillStyle = 'rgba(31, 41, 55, 0.6)';
    drawRoundedRect(ctx, 30, startY, width - 60, cardHeight, 16);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    drawRoundedRect(ctx, 30, startY, width - 60, cardHeight, 16);
    ctx.stroke();

    // Index (#1, #2, etc.)
    ctx.fillStyle = secondaryColor;
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(indexStr, 70, startY + 58);

    // Photo de profil
    const avatarX = 140;
    const avatarY = startY + 50;
    const avatarRadius = 35;

    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarX, avatarY, avatarRadius, 0, Math.PI * 2);
    ctx.clip();

    const avatarUrl = `https://graph.facebook.com/${userNode.id}/picture?height=300&width=300&access_token=6628568379%7Cc1e620fa708a1d5696fb991c1bde5662`;
    let loaded = false;

    try {
      const res = await axios.get(avatarUrl, { responseType: 'arraybuffer', timeout: 3000 });
      const img = await loadImage(Buffer.from(res.data));
      ctx.drawImage(img, avatarX - avatarRadius, avatarY - avatarRadius, avatarRadius * 2, avatarRadius * 2);
      loaded = true;
    } catch (e) {}

    if (!loaded) {
      ctx.fillStyle = '#374151';
      ctx.fillRect(avatarX - avatarRadius, avatarY - avatarRadius, avatarRadius * 2, avatarRadius * 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 24px sans-serif';
      ctx.fillText("👤", avatarX, avatarY + 8);
    }
    ctx.restore();

    // Anneau autour de la photo
    ctx.strokeStyle = primaryColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(avatarX, avatarY, avatarRadius, 0, Math.PI * 2);
    ctx.stroke();

    // Informations utilisateur
    ctx.textAlign = 'left';
    
    // Nom
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText(truncateText(ctx, userNode.name, 400), 200, startY + 43);

    // ID Facebook
    ctx.fillStyle = '#9CA3AF';
    ctx.font = '14px monospace';
    ctx.fillText(`ID: ${userNode.id}`, 200, startY + 68);

    // Date/Heure
    const timeStr = moment(displayList[i].time * 1000).tz("Asia/Manila").format("DD/MM/YYYY HH:mm");
    ctx.textAlign = 'right';
    ctx.fillStyle = accentColor;
    ctx.font = '13px sans-serif';
    ctx.fillText(`📅 ${timeStr}`, width - 60, startY + 55);

    startY += cardHeight + gap;
  }

  // Watermark
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.font = '12px sans-serif';
  ctx.fillText("FRIEND REQUEST SYSTEM • CANVAS VIP", width / 2, height - 20);

  // Sauvegarde temporaire
  const tmpDir = path.join(__dirname, "cache");
  await fs.ensureDir(tmpDir);
  const imagePath = path.join(tmpDir, `req_${Date.now()}.png`);
  await fs.outputFile(imagePath, canvas.toBuffer('image/png'));
  return imagePath;
}

module.exports = {
  config: {
    name: "accept",
    aliases: ['acp'],
    version: "2.0",
    author: "Christus",
    countDown: 15,
    role: 3,
    shortDescription: "Accept or delete friend requests",
    longDescription: "View and manage incoming friend requests with Canvas interface",
    category: "Utility",
  },

  onReply: async function ({ message, Reply, event, api }) {
    const { author, listRequest, messageID } = Reply;
    if (author !== event.senderID) return;
    const args = event.body.replace(/ +/g, " ").toLowerCase().split(" ");

    clearTimeout(Reply.unsendTimeout);

    const form = {
      av: api.getCurrentUserID(),
      fb_api_caller_class: "RelayModern",
      variables: {
        input: {
          source: "friends_tab",
          actor_id: api.getCurrentUserID(),
          client_mutation_id: Math.round(Math.random() * 19).toString()
        },
        scale: 3,
        refresh_num: 0
      }
    };

    const success = [];
    const failed = [];

    if (args[0] === "add") {
      form.fb_api_req_friendly_name = "FriendingCometFriendRequestConfirmMutation";
      form.doc_id = "3147613905362928";
    }
    else if (args[0] === "del") {
      form.fb_api_req_friendly_name = "FriendingCometFriendRequestDeleteMutation";
      form.doc_id = "4108254489275063";
    }
    else {
      return api.sendMessage(`⚠️ ${fonts?.bold ? fonts.bold("Invalid Syntax") : "Invalid Syntax"}\nUse: add/del <number/all>`, event.threadID, event.messageID);
    }

    let targetIDs = args.slice(1);
    if (args[1] === "all") {
      targetIDs = [];
      const lengthList = listRequest.length;
      for (let i = 1; i <= lengthList; i++) targetIDs.push(i);
    }

    const newTargetIDs = [];
    const promiseFriends = [];

    for (const stt of targetIDs) {
      const u = listRequest[parseInt(stt) - 1];
      if (!u) {
        failed.push(`STT ${stt} not found`);
        continue;
      }
      form.variables.input.friend_requester_id = u.node.id;
      form.variables = JSON.stringify(form.variables);
      newTargetIDs.push(u);
      promiseFriends.push(api.httpPost("https://www.facebook.com/api/graphql/", form));
      form.variables = JSON.parse(form.variables);
    }

    const lengthTarget = newTargetIDs.length;
    for (let i = 0; i < lengthTarget; i++) {
      try {
        const friendRequest = await promiseFriends[i];
        if (JSON.parse(friendRequest).errors) {
          failed.push(newTargetIDs[i].node.name);
        } else {
          success.push(newTargetIDs[i].node.name);
        }
      } catch (e) {
        failed.push(newTargetIDs[i].node.name);
      }
    }

    let resultMsg = `✨ ${fonts?.bold ? fonts.bold("REQUEST PROCESSED") : "REQUEST PROCESSED"}\n━━━━━━━━━━━━━━━━━━\n`;
    if (success.length > 0) {
      resultMsg += `✅ Successfully ${args[0] === 'add' ? 'accepted' : 'deleted'}:\n`;
      resultMsg += success.map(name => `┣ ${name}`).join("\n") + "\n\n";
    }
    if (failed.length > 0) {
      resultMsg += `❌ Failed/Errors:\n`;
      resultMsg += failed.map(name => `┗ ${name}`).join("\n");
    }

    api.sendMessage(resultMsg, event.threadID, event.messageID);
    api.unsendMessage(messageID);
  },

  onStart: async function ({ event, api, commandName }) {
    const form = {
      av: api.getCurrentUserID(),
      fb_api_req_friendly_name: "FriendingCometFriendRequestsRootQueryRelayPreloader",
      fb_api_caller_class: "RelayModern",
      doc_id: "4499164963466303",
      variables: JSON.stringify({ input: { scale: 3 } })
    };

    try {
      const response = await api.httpPost("https://www.facebook.com/api/graphql/", form);
      const listRequest = JSON.parse(response).data.viewer.friending_possibilities.edges;
      
      if (!listRequest || listRequest.length === 0) {
        return api.sendMessage("📭 Aucune demande d'ami en attente.", event.threadID, event.messageID);
      }

      // Génération du visuel Canvas avec les photos de profil
      let canvasImagePath = null;
      try {
        canvasImagePath = await generateRequestsCanvas(listRequest);
      } catch (e) {
        console.error("Canvas Error:", e);
      }

      let msg = `📥 **LISTE DES DEMANDES D'AMI** (${listRequest.length})\n━━━━━━━━━━━━━━━━━━\n`;
      let i = 0;
      for (const user of listRequest) {
        i++;
        const timeStr = moment(user.time * 1000).tz("Asia/Manila").format("DD/MM/YYYY HH:mm");
        msg += `${i}. **${user.node.name}**\n🆔 ${user.node.id} | 📅 ${timeStr}\n`;
      }

      msg += `\n💡 **Répondez :** add/del <numéro/all>`;

      const sendOptions = { body: fonts?.bold ? fonts.bold(msg) : msg };
      if (canvasImagePath && fs.existsSync(canvasImagePath)) {
        sendOptions.attachment = fs.createReadStream(canvasImagePath);
      }

      api.sendMessage(sendOptions, event.threadID, (e, info) => {
        if (canvasImagePath && fs.existsSync(canvasImagePath)) {
          fs.unlinkSync(canvasImagePath);
        }

        global.GoatBot.onReply.set(info.messageID, {
          commandName,
          messageID: info.messageID,
          listRequest,
          author: event.senderID,
          unsendTimeout: setTimeout(() => {
            api.unsendMessage(info.messageID);
          }, this.config.countDown * 1000)
        });
      }, event.messageID);

    } catch (err) {
      console.error(err);
      api.sendMessage("❌ Erreur lors de la récupération des demandes d'amis.", event.threadID, event.messageID);
    }
  }
};
      
