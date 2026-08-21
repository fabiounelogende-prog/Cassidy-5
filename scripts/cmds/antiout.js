const fs = require("fs-extra");
const path = require("path");
const axios = require("axios");
const { createCanvas, loadImage } = require("canvas");

module.exports = {
  config: {
    name: "antiout",
    version: "2.5",
    author: "wilfried",
    countDown: 5,
    role: 0,
    shortDescription: "Antiout avec Canvas stylé",
    longDescription: "Réajoute les membres qui quittent, modifie leur surnom et génère une carte Canvas propre.",
    category: "boxchat",
    guide: "{pn} [on | off]",
    envConfig: { deltaNext: 5 }
  },

  onStart: async function({ message, event, threadsData, args }) {
    let antiout = await threadsData.get(event.threadID, "settings.antiout");

    if (antiout === undefined) {
      await threadsData.set(event.threadID, true, "settings.antiout");
      antiout = true;
    }

    if (!["on", "off"].includes(args[0])) {
      return message.reply("Utilise 'on' ou 'off' stp.");
    }

    await threadsData.set(event.threadID, args[0] === "on", "settings.antiout");
    return message.reply(`Antiout ${args[0] === "on" ? "activé ✅" : "désactivé ❌"}.`);
  },

  onEvent: async function({ api, event, threadsData, usersData }) {
    const antiout = await threadsData.get(event.threadID, "settings.antiout");
    if (!antiout || !event.logMessageData?.leftParticipantFbId) return;

    const userId = event.logMessageData.leftParticipantFbId;
    const threadInfo = await api.getThreadInfo(event.threadID);

    if (!threadInfo.participantIDs.includes(userId)) {
      api.addUserToGroup(userId, event.threadID, async (err) => {
        if (err) {
          console.log(`[Antiout] Impossible d'ajouter l'utilisateur ${userId}:`, err);
          return;
        }

        // 1. Récupération du Nom de l'utilisateur
        let userName = "Utilisateur";
        let avatarUrl = `https://graph.facebook.com/${userId}/picture?height=500&width=500&access_token=6628568379%7Cc1e620fa708a1d5696fb991c1bde5662`;

        try {
          const info = await api.getUserInfo(userId);
          if (info[userId] && info[userId].name) {
            userName = info[userId].name;
            if (info[userId].thumbSrc) avatarUrl = info[userId].thumbSrc;
          }
        } catch (e) {
          console.log("[Antiout] Erreur récupération nom :", e);
        }

        // 2. Attribution du Pseudo (avec délai de 2.5s)
        const newNickname = `𝑬́𝒗𝒂𝒅𝒆́ ${userName} ✅`;
        setTimeout(() => {
          api.changeNickname(newNickname, event.threadID, userId, (nickErr) => {
            if (nickErr) {
              console.log("[Antiout] Échec du changement de pseudonyme (Le bot est-il admin ?) :", nickErr);
            }
          });
        }, 2500);

        // 3. Création du visuel Canvas propre
        const cacheDir = path.join(__dirname, "cache");
        const cachePath = path.join(cacheDir, `antiout_${userId}.png`);

        try {
          await fs.ensureDir(cacheDir);

          const canvas = createCanvas(800, 360);
          const ctx = canvas.getContext("2d");

          // Arrière-plan Moderne (Dégradé Sombre Cyber)
          const grad = ctx.createLinearGradient(0, 0, 800, 360);
          grad.addColorStop(0, "#0b0e14");
          grad.addColorStop(0.5, "#1a2332");
          grad.addColorStop(1, "#0d1b2a");
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, 800, 360);

          // Bordure lumineuse (Neon Cyan)
          ctx.strokeStyle = "#00f2fe";
          ctx.lineWidth = 4;
          ctx.strokeRect(10, 10, 780, 340);

          // Téléchargement de l'Avatar
          let avatarImg;
          try {
            const avatarRes = await axios.get(avatarUrl, { responseType: "arraybuffer" });
            avatarImg = await loadImage(Buffer.from(avatarRes.data));
          } catch (imgErr) {
            // Image par défaut si erreur de téléchargement
            const fallbackRes = await axios.get("https://i.imgur.com/2xdwP69.png", { responseType: "arraybuffer" });
            avatarImg = await loadImage(Buffer.from(fallbackRes.data));
          }

          // Cercle Avatar
          ctx.save();
          ctx.beginPath();
          ctx.arc(150, 180, 85, 0, Math.PI * 2, true);
          ctx.closePath();
          ctx.clip();
          ctx.drawImage(avatarImg, 65, 95, 170, 170);
          ctx.restore();

          // Contour Avatar Néon
          ctx.beginPath();
          ctx.arc(150, 180, 85, 0, Math.PI * 2, true);
          ctx.lineWidth = 6;
          ctx.strokeStyle = "#00f2fe";
          ctx.stroke();

          // Textes
          ctx.fillStyle = "#ff4757";
          ctx.font = "bold 32px sans-serif";
          ctx.fillText("🚨 ÉVASION DÉTECTÉE", 270, 120);

          ctx.fillStyle = "#ffffff";
          ctx.font = "bold 26px sans-serif";
          // Découpage si le nom est trop long
          const displayName = userName.length > 20 ? userName.substring(0, 18) + "..." : userName;
          ctx.fillText(`𝑬́𝒗𝒂𝒅𝒆́ : ${displayName} ✅`, 270, 180);

          ctx.fillStyle = "#00f2fe";
          ctx.font = "italic 20px sans-serif";
          ctx.fillText("Retour automatique dans le groupe ! ⛓️", 270, 230);

          // Sauvegarde et envoi
          const buffer = canvas.toBuffer("image/png");
          fs.writeFileSync(cachePath, buffer);

          api.sendMessage(
            {
              body: `💗 ${userName} a essayé de fuir mais l'antiout l'a ramené(e) !`,
              attachment: fs.createReadStream(cachePath)
            },
            event.threadID,
            () => {
              if (fs.existsSync(cachePath)) fs.unlinkSync(cachePath);
            }
          );

        } catch (canvasError) {
          console.log("[Antiout] Erreur génération Canvas :", canvasError);
          if (fs.existsSync(cachePath)) fs.unlinkSync(cachePath);
          api.sendMessage(`💗 ${userName} a été réintégré(e) (Antiout).`, event.threadID);
        }
      });
    }
  }
};
