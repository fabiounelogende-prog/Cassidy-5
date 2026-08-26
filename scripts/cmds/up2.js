const { createCanvas, loadImage } = require('canvas');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

module.exports = {
  config: {
    name: "up2",
    version: "5.0.0",
    author: "Celestin",
    countDown: 5,
    role: 0,
    shortDescription: "Affiche l'uptime et les métriques système",
    longDescription: "Génère une carte de statut système avec avatar au centre et thème Lion Gold.",
    category: "system",
    guide: "{pn}"
  },

  onStart: async function ({ api, event, usersData }) {
    const { threadID, messageID, senderID } = event;
    const prefix = global.config?.PREFIX || global.GoatBot?.config?.PREFIX || "!";

    // CALCULS DES 20 MÉTRIQUES
    const uptimeSeconds = process.uptime();
    const days = Math.floor(uptimeSeconds / (3600 * 24));
    const hours = Math.floor((uptimeSeconds % (3600 * 24)) / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);
    const seconds = Math.floor(uptimeSeconds % 60);

    const sysUptime = os.uptime();
    const sysDays = Math.floor(sysUptime / (3600 * 24));
    const sysHours = Math.floor((sysUptime % (3600 * 24)) / 3600);

    const totalMem = (os.totalmem() / 1024 / 1024).toFixed(0);
    const freeMem = (os.freemem() / 1024 / 1024).toFixed(0);
    const usedMem = (totalMem - freeMem).toFixed(0);
    const ramPercent = ((usedMem / totalMem) * 100).toFixed(1);

    const cpu = os.cpus();
    const cpuSpeed = cpu[0] ? `${cpu[0].speed} MHz` : "N/A";
    const cpuCores = cpu.length;

    const memoryUsage = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);
    const rssUsage = (process.memoryUsage().rss / 1024 / 1024).toFixed(1);
    const ping = Date.now() - (event.timestamp || Date.now());

    // CANEVAS PAYSAGE FLUIDE (1000 x 600)
    const canvas = createCanvas(1000, 600);
    const ctx = canvas.getContext('2d');
    ctx.textBaseline = "middle";

    const theme = {
      bg: "#0B0603",
      gold: "#F59E0B",
      amber: "#D97706",
      brown: "#321404",
      cardBg: "rgba(22, 11, 4, 0.85)",
      borderColor: "rgba(245, 158, 11, 0.4)",
      textColor: "#FFFFFF",
      subText: "#9CA3AF"
    };

    // 1. FOND PRINCIPAL
    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Halo lumineux central
    const bgGlow = ctx.createRadialGradient(500, 300, 10, 500, 300, 400);
    bgGlow.addColorStop(0, theme.amber);
    bgGlow.addColorStop(0.6, theme.brown);
    bgGlow.addColorStop(1, "transparent");
    ctx.fillStyle = bgGlow;
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.arc(500, 300, 400, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1.0;

    // 2. TÊTE DE LION DESSINÉE EN VECTORIEL EN HAUT (AUCUN EMOJI COMPRESSÉ)
    function drawLionHead(x, y) {
      ctx.save();
      ctx.translate(x, y);

      // Crinière à rayons or
      ctx.strokeStyle = theme.gold;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.5;
      for (let i = 0; i < 16; i++) {
        ctx.rotate((Math.PI * 2) / 16);
        ctx.beginPath();
        ctx.moveTo(0, 20);
        ctx.lineTo(0, 40);
        ctx.stroke();
      }

      // Visage de lion avec gueule ouverte
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = theme.amber;
      ctx.beginPath();
      ctx.moveTo(-18, -15);
      ctx.lineTo(0, -28);
      ctx.lineTo(18, -15);
      ctx.lineTo(10, 15);
      ctx.lineTo(0, 25); // Gueule ouverte
      ctx.lineTo(-10, 15);
      ctx.closePath();
      ctx.fill();

      // Crocs
      ctx.fillStyle = "#FFFFFF";
      ctx.beginPath();
      ctx.moveTo(-4, 8); ctx.lineTo(-2, 14); ctx.lineTo(0, 8);
      ctx.moveTo(0, 8); ctx.lineTo(2, 14); ctx.lineTo(4, 8);
      ctx.fill();

      ctx.restore();
    }

    drawLionHead(500, 38);

    // TITRE PRINCIPAL
    ctx.textAlign = "center";
    ctx.fillStyle = theme.textColor;
    ctx.font = "bold 26px 'Segoe UI', Roboto, sans-serif";
    ctx.fillText("LION KINGDOM SYSTEM", 500, 78);

    // 3. PHOTO DE L'UTILISATEUR (AU MILIEU EXACT DE L'IMAGE)
    const avatarRadius = 65;
    const avatarX = 500;
    const avatarY = 300;

    try {
      let avatarUrl;
      if (usersData && typeof usersData.getAvatarUrl === 'function') {
        avatarUrl = await usersData.getAvatarUrl(senderID);
      }
      if (!avatarUrl) {
        avatarUrl = `https://graph.facebook.com/${senderID}/picture?height=400&width=400&access_token=6628568379%7Cc1e620fa708a1d5696fb991c1bde5662`;
      }

      const avatar = await loadImage(avatarUrl);
      ctx.save();
      ctx.beginPath();
      ctx.arc(avatarX, avatarY, avatarRadius, 0, Math.PI * 2, true);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(avatar, avatarX - avatarRadius, avatarY - avatarRadius, avatarRadius * 2, avatarRadius * 2);
      ctx.restore();

      // Contour Or & Neon
      ctx.strokeStyle = theme.gold;
      ctx.shadowColor = theme.gold;
      ctx.shadowBlur = 20;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(avatarX, avatarY, avatarRadius + 3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
    } catch (e) {}

    // 4. LES 20 FONCTIONS SYSTÈME (10 À GAUCHE, 10 À DROITE DE L'AVATAR)
    const functionsList = [
      { label: "Bot Uptime", val: `${days}d ${hours}h ${minutes}m` },
      { label: "OS Uptime", val: `${sysDays}d ${sysHours}h` },
      { label: "RAM Utilisée", val: `${usedMem} MB` },
      { label: "RAM Totale", val: `${totalMem} MB` },
      { label: "RAM %", val: `${ramPercent}%` },
      { label: "Heap Node", val: `${memoryUsage} MB` },
      { label: "RSS Mémoire", val: `${rssUsage} MB` },
      { label: "Latence Ping", val: `${ping < 0 ? 12 : ping} ms` },
      { label: "Cœurs CPU", val: `${cpuCores} Coeurs` },
      { label: "Vitesse CPU", val: cpuSpeed },
      { label: "Plateforme", val: os.platform() },
      { label: "Architecture", val: os.arch() },
      { label: "Version Node", val: process.version },
      { label: "Type OS", val: os.type() },
      { label: "Release OS", val: os.release() },
      { label: "Nom Hôte", val: os.hostname() },
      { label: "Répertoire", val: process.cwd().split('/').pop() || "Root" },
      { label: "PID Process", val: process.pid.toString() },
      { label: "Préfixe Bot", val: prefix },
      { label: "Statut", val: "Actif" }
    ];

    let startXLeft = 30;
    let startXRight = 610;
    let startY = 115;
    let boxWidth = 360;
    let boxHeight = 34;
    let gapY = 40;

    functionsList.forEach((item, index) => {
      const isRight = index >= 10;
      const x = isRight ? startXRight : startXLeft;
      const y = startY + ((index % 10) * gapY);

      // Fond du module
      ctx.fillStyle = theme.cardBg;
      ctx.beginPath();
      ctx.roundRect(x, y, boxWidth, boxHeight, 8);
      ctx.fill();

      ctx.strokeStyle = theme.borderColor;
      ctx.lineWidth = 1;
      ctx.stroke();

      // Texte Intitulé
      ctx.textAlign = "left";
      ctx.fillStyle = theme.gold;
      ctx.font = "bold 13px 'Segoe UI', Roboto, sans-serif";
      ctx.fillText(item.label, x + 12, y + boxHeight / 2);

      // Texte Valeur
      ctx.textAlign = "right";
      ctx.fillStyle = theme.textColor;
      ctx.font = "bold 13px 'Segoe UI', Roboto, sans-serif";
      ctx.fillText(item.val, x + boxWidth - 12, y + boxHeight / 2);
    });

    // 5. NOM DU CRÉATEUR EN BAS
    ctx.textAlign = "center";
    ctx.fillStyle = theme.gold;
    ctx.font = "bold 18px 'Segoe UI', Roboto, sans-serif";
    ctx.fillText("CRÉATEUR : CELESTIN", 500, 560);

    // ENVOI
    const cacheDir = path.join(__dirname, "cache");
    const cachePath = path.join(cacheDir, `up_${senderID}.png`);
    fs.ensureDirSync(cacheDir);

    const buffer = canvas.toBuffer("image/png");
    fs.writeFileSync(cachePath, buffer);

    const textMsg = `📌 **[ UPTIME SYSTEM ]**\n\n` +
      `⏱️ **Uptime :** ${days}d ${hours}h ${minutes}m ${seconds}s\n` +
      `💾 **RAM :** ${usedMem}/${totalMem} MB (${ramPercent}%)\n` +
      `📶 **Ping :** ${ping < 0 ? 12 : ping} ms\n` +
      `👑 **Créateur :** Celestin`;

    api.sendMessage(
      {
        body: textMsg,
        attachment: fs.createReadStream(cachePath)
      },
      threadID,
      () => fs.unlinkSync(cachePath),
      messageID
    );
  }
};
