// Liste les groupes où le bot se trouve, avec leur photo, et ajoute l'admin
// dans celui qu'il choisit s'il n'en est pas déjà membre.
// Réservé aux admins du bot : lister tous les groupes + pouvoir s'y ajouter
// est une action sensible, pas réservée aux seuls admins d'un groupe.

const { createCanvas, loadImage } = require("canvas");
const fs = require("fs-extra");
const path = require("path");

function appel(fn, ...args) {
  return new Promise((resolve, reject) => {
    fn(...args, (err, data) => (err ? reject(err) : resolve(data)));
  });
}

function estAdmin(uid) {
  const admins = (global.GoatBot && global.GoatBot.config && global.GoatBot.config.adminBot) || [];
  return admins.map(String).includes(String(uid));
}

function initiales(nom) {
  return (nom || "?").trim().charAt(0).toUpperCase();
}

module.exports = {
  config: {
    name: "joint",
    aliases: ["joindre", "groupes"],
    version: "1.0",
    author: "toi",
    countDown: 15,
    role: 2,
    shortDescription: { fr: "Liste les groupes du bot et rejoins-en un" },
    longDescription: { fr: "Affiche les groupes où le bot est présent avec leur photo, et t'y ajoute si tu n'en fais pas encore partie" },
    category: "owner",
    guide: { fr: "{pn} : affiche la liste, puis réponds avec le numéro du groupe à rejoindre" }
  },

  onStart: async function ({ api, event, message, usersData }) {
    try {
      if (!estAdmin(event.senderID))
        return message.reply("Cette commande est réservée aux administrateurs du bot.");

      const tousLesFils = await appel(api.getThreadList, 100, null, ["INBOX"]);
      const groupes = (tousLesFils || []).filter(t => t.isGroup || t.threadID !== String(event.senderID));

      if (!groupes.length) return message.reply("Le bot n'est dans aucun groupe pour l'instant.");

      // --- Image : grille des groupes avec photo, nom et numéro ---
      const parLigne = 3;
      const cellW = 260, cellH = 150, marge = 24, hautEnTete = 70;
      const lignes = Math.ceil(groupes.length / parLigne);
      const W = marge * 2 + parLigne * cellW;
      const H = hautEnTete + marge + lignes * cellH + marge;

      const canvas = createCanvas(W, H);
      const ctx = canvas.getContext("2d");
      const fond = ctx.createLinearGradient(0, 0, 0, H);
      fond.addColorStop(0, "#0a0e1a");
      fond.addColorStop(1, "#140a2e");
      ctx.fillStyle = fond;
      ctx.fillRect(0, 0, W, H);

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 28px Sans-Serif";
      ctx.fillText(`📂 Groupes du bot (${groupes.length})`, marge, 48);

      for (let i = 0; i < groupes.length; i++) {
        const g = groupes[i];
        const col = i % parLigne, ligne = Math.floor(i / parLigne);
        const x = marge + col * cellW, y = hautEnTete + marge + ligne * cellH;

        ctx.fillStyle = "rgba(255,255,255,0.05)";
        ctx.beginPath();
        ctx.roundRect(x, y, cellW - 14, cellH - 14, 14);
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.12)";
        ctx.lineWidth = 1;
        ctx.stroke();

        const cx = x + 55, cy = y + (cellH - 14) / 2, r = 36;
        try {
          if (!g.imageSrc) throw new Error("pas de photo");
          const img = await loadImage(g.imageSrc);
          ctx.save();
          ctx.beginPath();
          ctx.arc(cx, cy, r, 0, Math.PI * 2);
          ctx.clip();
          ctx.drawImage(img, cx - r, cy - r, r * 2, r * 2);
          ctx.restore();
        } catch {
          ctx.fillStyle = "#394867";
          ctx.beginPath();
          ctx.arc(cx, cy, r, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#ffffff";
          ctx.font = "bold 28px Sans-Serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(initiales(g.name), cx, cy + 2);
          ctx.textAlign = "left";
          ctx.textBaseline = "alphabetic";
        }
        ctx.strokeStyle = "#7c4dff";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(cx, cy, r + 2, 0, Math.PI * 2);
        ctx.stroke();

        // Pastille numéro
        ctx.fillStyle = "#7c4dff";
        ctx.beginPath();
        ctx.arc(x + 24, y + 22, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 14px Sans-Serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(i + 1), x + 24, y + 23);
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";

        // Nom du groupe (tronqué si trop long)
        let nom = g.name || "Groupe sans nom";
        ctx.fillStyle = "#ffffff";
        ctx.font = "15px Sans-Serif";
        while (ctx.measureText(nom).width > cellW - 110 && nom.length > 3) nom = nom.slice(0, -2);
        if (nom !== (g.name || "Groupe sans nom")) nom += "…";
        ctx.fillText(nom, x + 100, y + cy - y + 5);
      }

      const cacheDir = path.join(__dirname, "cache");
      const cachePath = path.join(cacheDir, `joint_${event.senderID}.png`);
      fs.ensureDirSync(cacheDir);
      fs.writeFileSync(cachePath, canvas.toBuffer("image/png"));

      const sent = await message.reply({
        body: "Réponds avec le numéro du groupe que tu veux rejoindre.",
        attachment: fs.createReadStream(cachePath)
      });
      fs.unlink(cachePath, () => {});

      global.GoatBot.onReply.set(sent.messageID, {
        commandName: "joint",
        auteur: event.senderID,
        groupes: groupes.map(g => ({ threadID: g.threadID, name: g.name || "Groupe sans nom", participantIDs: (g.participantIDs || []).map(String) }))
      });
    } catch (e) {
      console.error("Erreur dans la commande joint:", e);
      message.reply("❌ Impossible de récupérer la liste des groupes : " + (e && e.message ? e.message : "erreur inconnue"));
    }
  },

  onReply: async function ({ api, message, event, Reply }) {
    try {
      const data = Reply || global.GoatBot.onReply.get(event.messageReply.messageID);
      if (!data || data.commandName !== "joint") return;
      if (String(event.senderID) !== String(data.auteur)) return;

      const n = parseInt((event.body || "").trim());
      if (!n || n < 1 || n > data.groupes.length)
        return message.reply(`Réponds avec un numéro de 1 à ${data.groupes.length}.`);

      const groupe = data.groupes[n - 1];
      global.GoatBot.onReply.delete(event.messageReply.messageID);

      if (groupe.participantIDs.includes(String(data.auteur)))
        return message.reply(`Tu es déjà dans « ${groupe.name} ».`);

      await appel(api.addUserToGroup, data.auteur, groupe.threadID);
      return message.reply(`✅ Tu as été ajouté au groupe « ${groupe.name} ».`);
    } catch (e) {
      console.error("Erreur dans onReply joint:", e);
      message.reply(
        "❌ Impossible de t'ajouter à ce groupe : " +
        (e && e.message ? e.message : "le bot n'a peut-être pas la permission d'ajouter des membres ici.")
      );
    }
  }
};
