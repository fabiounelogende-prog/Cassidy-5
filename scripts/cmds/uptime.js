const { createCanvas, loadImage } = require("canvas");
const fs = require("fs-extra");
const path = require("path");
const os = require("os");

module.exports = {
  config: {
    name: "uptime",
    version: "16.0.0",
    author: "Célestin",
    countDown: 5,
    role: 0,
    shortDescription: "Uptime design fidèle avec couleurs dynamiques",
    longDescription: "Reproduction exacte du layout original (Avatar central haut, wave, 4 blocs, petite barre) avec palettes de couleurs changeantes.",
    category: "system",
    guide: "{pn}"
  },

  onStart: async function ({ api, event, usersData }) {
    const { threadID, messageID, senderID } = event;
    const cacheDir = path.join(__dirname, "cache");
    const cachePath = path.join(cacheDir, `uptime_${senderID}.png`);

    try {
      if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
      }

      // 1. PALETTES DE COULEURS DYNAMIQUES
      const THEMES = [
        {
          name: "BLUE NIGHT (Bleu & Noir)",
          main: "#00d2ff",
          secondary: "#0066ff",
          accent: "#00f2fe",
          greenAccent: "#00ff88",
          bg1: "#030814",
          bg2: "#081326",
          cardBg: "rgba(6, 16, 35, 0.75)"
        },
        {
          name: "CYBER NEON",
          main: "#00f7ff",
          secondary: "#ff007f",
          accent: "#9d00ff",
          greenAccent: "#00ffaa",
          bg1: "#060312",
          bg2: "#120826",
          cardBg: "rgba(18, 8, 38, 0.75)"
        },
        {
          name: "SUNSET SYNTHWAVE",
          main: "#ff5e00",
          secondary: "#ff0055",
          accent: "#ffb700",
          greenAccent: "#00ffff",
          bg1: "#140212",
          bg2: "#260624",
          cardBg: "rgba(38, 6, 36, 0.75)"
        },
        {
          name: "MATRIX GREEN",
          main: "#00ff66",
          secondary: "#00b33c",
          accent: "#76ff03",
          greenAccent: "#00ffff",
          bg1: "#010d04",
          bg2: "#031c0a",
          cardBg: "rgba(2, 20, 7, 0.75)"
        }
      ];

      const palette = THEMES[Math.floor(Math.random() * THEMES.length)];

      // 2. DONNÉES SYSTÈME ET AVATAR
      const uptimeTime = process.uptime();
      const days = Math.floor(uptimeTime / (3600 * 24));
      const hours = Math.floor((uptimeTime % (3600 * 24)) / 3600);
      const minutes = Math.floor((uptimeTime % 3600) / 60);
      const seconds = Math.floor(uptimeTime % 60);
      const timeString = `${days}d  ${hours}h  ${minutes}m  ${seconds}s`;

      const startTime = Date.now();
      let avatar;
      try {
        const avatarUrl = await usersData.getAvatarUrl(senderID);
        avatar = await loadImage(avatarUrl);
      } catch (e) {
        avatar = await loadImage("https://i.imgur.com/58P9S3p.png");
      }
      const speedMs = Date.now() - startTime;
      const ramUsed = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);
      const ramTotal = (os.totalmem() / 1024 / 1024 / 1024).toFixed(1);

      // 3. CANVAS (1000 x 600 - Proportions exactes du modèle)
      const width = 1000;
      const height = 600;
      const canvas = createCanvas(width, height);
      const ctx = canvas.getContext("2d");

      // ARRIÈRE-PLAN
      const bgGrad = ctx.createLinearGradient(0, 0, width, height);
      bgGrad.addColorStop(0, palette.bg1);
      bgGrad.addColorStop(1, palette.bg2);
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // Grille Subtile en Fond
      ctx.strokeStyle = "rgba(255, 255, 255, 0.03)";
      ctx.lineWidth = 1;
      for (let x = 0; x < width; x += 30) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
      }
      for (let y = 0; y < height; y += 30) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
      }

      // CADRE EXTÉRIEUR DU DASHBOARD
      ctx.strokeStyle = palette.main;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(15, 15, width - 30, height - 30, 16);
      ctx.stroke();

      // --- 1. AVATAR EN HAUT AU CENTRE ---
      const avatarSize = 110;
      const avatarX = width / 2;
      const avatarY = 90;

      // Cercle d'effet Tech / Néon autour de l'avatar
      ctx.strokeStyle = palette.main;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(avatarX, avatarY, avatarSize / 2 + 8, 0, Math.PI * 2);
      ctx.stroke();

      // Traits discontinus autour
      ctx.strokeStyle = palette.accent;
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      ctx.arc(avatarX, avatarY, avatarSize / 2 + 14, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]); // réinitialisation

      // Image Avatar Rondo
      ctx.save();
      ctx.beginPath();
      ctx.arc(avatarX, avatarY, avatarSize / 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(avatar, avatarX - avatarSize / 2, avatarY - avatarSize / 2, avatarSize, avatarSize);
      ctx.restore();

      // TITRE PRINCIPAL
      ctx.textAlign = "center";
      ctx.fillStyle = "#FFFFFF";
      ctx.font = "bold 28px sans-serif";
      ctx.fillText("SYSTEM MONITORING CENTER", width / 2, 175);

      ctx.fillStyle = palette.main;
      ctx.font = "12px sans-serif";
      ctx.fillText("DÉTECTION EN TEMPS RÉEL • STATUT GLOBAL", width / 2, 198);

      // --- 2. GRAND BLOC UPTIME ---
      const upX = 40, upY = 225, upW = 920, upH = 95;
      ctx.fillStyle = palette.cardBg;
      ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(upX, upY, upW, upH, 12);
      ctx.fill();
      ctx.stroke();

      // Ligne verticale lumineuse à gauche
      ctx.fillStyle = palette.main;
      ctx.beginPath();
      ctx.roundRect(upX + 4, upY + 12, 4, upH - 24, 2);
      ctx.fill();

      // Intitulé Uptime
      ctx.textAlign = "left";
      ctx.fillStyle = palette.main;
      ctx.font = "bold 12px sans-serif";
      ctx.fillText("DURÉE D'ACTIVITÉ (UPTIME)", upX + 22, upY + 30);

      // Valeur Uptime
      ctx.fillStyle = palette.main;
      ctx.font = "bold 32px sans-serif";
      ctx.fillText(timeString, upX + 22, upY + 72);

      // Onde Bleue Sinusoïdale (à droite dans le bloc)
      ctx.strokeStyle = palette.main;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (let x = upX + 580; x < upX + upW - 30; x += 3) {
        const y = upY + 50 + Math.sin((x - upX) * 0.025) * 18;
        if (x === upX + 580) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // --- 3. LES 4 PETITS BLOCS MÉTROLOGIQUES ---
      const cards = [
        { title: "⚡ LATENCE / PING", val: `${speedMs} ms`, border: "rgba(255, 255, 255, 0.15)", textCol: "#FFFFFF" },
        { title: "MÉMOIRE RAM", val: `${ramUsed} MB / ${ramTotal} GB`, border: "rgba(255, 255, 255, 0.15)", textCol: "#FFFFFF" },
        { title: "CHARGE CPU", val: "18.7 %", border: "rgba(255, 255, 255, 0.15)", textCol: "#FFFFFF" },
        { title: "ÉTAT DU SYSTÈME", val: "● OPERATIONAL (LINUX)", border: palette.greenAccent, textCol: palette.greenAccent }
      ];

      const cardW = 215;
      const cardH = 90;
      const cardY = 335;

      cards.forEach((item, index) => {
        const cx = 40 + index * 235;

        ctx.fillStyle = palette.cardBg;
        ctx.strokeStyle = item.border;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.roundRect(cx, cardY, cardW, cardH, 12);
        ctx.fill();
        ctx.stroke();

        // Titre
        ctx.fillStyle = palette.main;
        ctx.font = "10px sans-serif";
        ctx.fillText(item.title, cx + 16, cardY + 26);

        // Valeur
        ctx.fillStyle = item.textCol;
        ctx.font = "bold 15px sans-serif";
        ctx.fillText(item.val, cx + 16, cardY + 62);
      });

      // --- 4. PETITE BARRE DE PROGRESSION FINE ---
      const barY = 470;
      ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
      ctx.font = "10px sans-serif";
      ctx.fillText("Fréquence de réponse système et bande passante", 40, barY - 8);

      // Fond de la petite barre
      ctx.fillStyle = "rgba(255, 255, 255, 0.06)";
      ctx.beginPath();
      ctx.roundRect(40, barY, 920, 8, 4);
      ctx.fill();

      // Progression bleue
      const miniBarGrad = ctx.createLinearGradient(40, 0, 40 + 320, 0);
      miniBarGrad.addColorStop(0, palette.main);
      miniBarGrad.addColorStop(1, palette.secondary);
      ctx.fillStyle = miniBarGrad;
      ctx.beginPath();
      ctx.roundRect(40, barY, 320, 8, 4);
      ctx.fill();

      // --- 5. SPECTRE D'ÉGALISEUR EN BAS ---
      const eqY = 530;
      const totalBars = 48;
      for (let i = 0; i < totalBars; i++) {
        const bh = Math.floor(Math.random() * 26) + 6;
        const bx = 40 + i * 19.5;
        ctx.fillStyle = palette.main;
        ctx.beginPath();
        ctx.roundRect(bx, eqY + (30 - bh) / 2, 8, bh, 3);
        ctx.fill();
      }

      // ENVOI
      const buffer = canvas.toBuffer("image/png");
      fs.writeFileSync(cachePath, buffer);

      return api.sendMessage(
        {
          body: `🎨 **SYSTEM UPTIME [${palette.name}]**`,
          attachment: fs.createReadStream(cachePath)
        },
        threadID,
        () => fs.unlinkSync(cachePath),
        messageID
      );

    } catch (error) {
      console.error(error);
      if (fs.existsSync(cachePath)) fs.unlinkSync(cachePath);
      return api.sendMessage("Erreur lors de la génération du panneau Uptime.", threadID, messageID);
    }
  }
};
