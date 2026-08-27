const { createCanvas, loadImage } = require('@napi-rs/canvas');
const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');

let fonts;
try {
  fonts = require("../../func/font.js");
} catch (error) {}

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

// Tronquer le texte avec des points de suspension si trop long
function truncateText(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let truncated = text;
  while (ctx.measureText(truncated + '...').width > maxWidth && truncated.length > 0) {
    truncated = truncated.slice(0, -1);
  }
  return truncated + '...';
}

// ==========================================
// 🎨 MOTEUR CANVAS : CARTE D'ADIEU CYBER
// ==========================================
async function generateOutCanvas(botID, botName, customReason) {
  const width = 1100;
  const height = 500;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Palette Premium (Rouge / Violet Cyber)
  const primaryColor = "#EF4444";   // Rouge Néon
  const secondaryColor = "#8B5CF6"; // Violet Cyber
  const accentColor = "#F59E0B";    // Ambre/Orange

  // 1. FOND DEGRADÉ PROFOND
  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, '#0D0914');
  bg.addColorStop(0.5, '#1A0B2E');
  bg.addColorStop(1, '#0F172A');
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

  // 2. HALOS NÉONS AMBIANTS (GLOW EFFECTS)
  ctx.save();
  ctx.globalCompositeOperation = 'screen';

  const glow1 = ctx.createRadialGradient(180, 250, 20, 180, 250, 350);
  glow1.addColorStop(0, 'rgba(239, 68, 68, 0.3)');
  glow1.addColorStop(1, 'transparent');
  ctx.fillStyle = glow1; ctx.fillRect(0, 0, width, height);

  const glow2 = ctx.createRadialGradient(900, 250, 20, 900, 250, 350);
  glow2.addColorStop(0, 'rgba(139, 92, 246, 0.3)');
  glow2.addColorStop(1, 'transparent');
  ctx.fillStyle = glow2; ctx.fillRect(0, 0, width, height);

  ctx.restore();

  // 3. PANNEAU EN VERRE TRANSLUCIDE (GLASSMORPHISM)
  ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
  drawRoundedRect(ctx, 35, 35, width - 70, height - 70, 24);
  ctx.fill();

  // Contour néon dégradé
  const borderGrad = ctx.createLinearGradient(0, 0, width, height);
  borderGrad.addColorStop(0, primaryColor);
  borderGrad.addColorStop(0.5, secondaryColor);
  borderGrad.addColorStop(1, accentColor);
  ctx.strokeStyle = borderGrad;
  ctx.lineWidth = 3;
  drawRoundedRect(ctx, 35, 35, width - 70, height - 70, 24);
  ctx.stroke();

  // 4. PHOTO DE PROFIL DU BOT (AVATAR)
  const avatarX = 180;
  const avatarY = 250;
  const avatarRadius = 105;

  // Halo rouge brillant sous l'avatar
  ctx.save();
  ctx.shadowColor = primaryColor;
  ctx.shadowBlur = 40;
  ctx.beginPath();
  ctx.arc(avatarX, avatarY, avatarRadius + 2, 0, Math.PI * 2);
  ctx.fillStyle = primaryColor;
  ctx.fill();
  ctx.restore();

  // Découpage en cercle et chargement de la photo du bot
  ctx.save();
  ctx.beginPath();
  ctx.arc(avatarX, avatarY, avatarRadius, 0, Math.PI * 2);
  ctx.clip();

  const avatarUrl = `https://graph.facebook.com/${botID}/picture?height=500&width=500&access_token=6628568379%7Cc1e620fa708a1d5696fb991c1bde5662`;
  let imgLoaded = false;

  try {
    const res = await axios.get(avatarUrl, { responseType: 'arraybuffer', timeout: 4000 });
    const botAvatar = await loadImage(Buffer.from(res.data));
    ctx.drawImage(botAvatar, avatarX - avatarRadius, avatarY - avatarRadius, avatarRadius * 2, avatarRadius * 2);
    imgLoaded = true;
  } catch (e) {}

  if (!imgLoaded) {
    ctx.fillStyle = '#1E293B';
    ctx.fillRect(avatarX - avatarRadius, avatarY - avatarRadius, avatarRadius * 2, avatarRadius * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 70px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText("🤖", avatarX, avatarY + 25);
  }
  ctx.restore();

  // Anneau néon blanc autour de l'avatar
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(avatarX, avatarY, avatarRadius + 2, 0, Math.PI * 2);
  ctx.stroke();

  // 5. EN-TÊTE & BADGE
  ctx.textAlign = 'left';

  // Badge "SYSTEM LEAVING"
  ctx.fillStyle = 'rgba(239, 68, 68, 0.2)';
  drawRoundedRect(ctx, 330, 65, 220, 32, 8);
  ctx.fill();
  ctx.strokeStyle = primaryColor;
  ctx.lineWidth = 1;
  drawRoundedRect(ctx, 330, 65, 220, 32, 8);
  ctx.stroke();

  ctx.fillStyle = primaryColor;
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText("🚪 BOT DISCONNECT", 345, 86);

  // Nom du Bot
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '900 34px sans-serif';
  ctx.fillText(botName.toUpperCase(), 330, 135);

  // Ligne de séparation dégradée
  const lineGrad = ctx.createLinearGradient(330, 0, width - 70, 0);
  lineGrad.addColorStop(0, primaryColor);
  lineGrad.addColorStop(0.6, secondaryColor);
  lineGrad.addColorStop(1, 'transparent');
  ctx.strokeStyle = lineGrad;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(330, 155);
  ctx.lineTo(width - 80, 155);
  ctx.stroke();

  // 6. ZONE DE MESSAGE D'ADIEU (BULLE MODERNE)
  ctx.fillStyle = 'rgba(2, 6, 23, 0.45)';
  drawRoundedRect(ctx, 330, 175, 700, 220, 16);
  ctx.fill();

  ctx.fillStyle = '#F8FAFC';
  ctx.font = '22px sans-serif';

  const defaultMsg = customReason || "Il est temps pour moi de quitter ce groupe. Merci pour tous ces moments partagés ! À bientôt 👋";
  const rawLines = defaultMsg.split('\n');
  
  let y = 215;
  const lineHeight = 34;
  const maxLineY = 360;

  for (let i = 0; i < rawLines.length; i++) {
    if (y > maxLineY) {
      ctx.fillStyle = accentColor;
      ctx.font = 'italic bold 18px sans-serif';
      ctx.fillText("...", 355, y);
      break;
    }
    const currentLine = rawLines[i];
    if (currentLine.trim().length === 0) {
      y += 18;
      continue;
    }
    ctx.fillText(truncateText(ctx, currentLine, 650), 355, y);
    y += lineHeight;
  }

  // 7. FOOTER WATERMARK
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.font = '13px sans-serif';
  ctx.fillText("LEAVE SYSTEM v2.0 • POWERED BY CANVAS", width - 60, height - 50);

  // Sauvegarde temporaire du Canvas
  const tmpDir = path.join(__dirname, "cache");
  await fs.ensureDir(tmpDir);
  const imagePath = path.join(tmpDir, `out_${Date.now()}.png`);
  await fs.outputFile(imagePath, canvas.toBuffer('image/png'));
  return imagePath;
}

module.exports = {
  config: {
    name: "out",
    aliases: ["leave", "quitter"],
    version: "2.0.0",
    author: "Christus",
    countDown: 5,
    role: 2, // Accessible aux Admins du bot / Admin du groupe
    description: "🚪 Le bot affiche sa photo avec un message stylé puis quitte le groupe",
    category: "admin",
    guide: {
      fr: "{pn} [raison ou message optionnel]"
    }
  },

  onStart: async function ({ message, api, event, args }) {
    const botID = api.getCurrentUserID();
    const reason = args.join(" ");

    // Récupérer le nom du bot
    let botName = "BOT ASSISTANT";
    try {
      const botInfo = await api.getUserInfo(botID);
      botName = botInfo[botID]?.name || botName;
    } catch (e) {}

    // Message texte d'accompagnement
    const notifyMsg = "👋 **DÉCONNEXION DU BOT**\n━━━━━━━━━━━━━━━━━━\nMerci à tous ! Je quitte ce groupe maintenant.";
    
    // Génération du visuel Canvas
    let imagePath;
    try {
      imagePath = await generateOutCanvas(botID, botName, reason);
    } catch (e) {
      console.error(e);
    }

    // Préparation de l'envoi
    const sendData = {
      body: fonts?.bold ? fonts.bold(notifyMsg) : notifyMsg
    };

    if (imagePath && fs.existsSync(imagePath)) {
      sendData.attachment = fs.createReadStream(imagePath);
    }

    // Envoie l'image puis quitte le groupe
    await message.send(sendData);

    // Suppression du fichier temporaire
    if (imagePath && fs.existsSync(imagePath)) {
      fs.unlinkSync(imagePath);
    }

    // Petit délai pour s'assurer que le message est bien transmis avant le départ
    setTimeout(() => {
      api.removeUserFromGroup(botID, event.threadID, (err) => {
        if (err) {
          message.reply("❌ Impossible de quitter le groupe automatiquement.");
        }
      });
    }, 1500);
  }
};
