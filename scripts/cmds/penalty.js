const IMG = {
  start: "https://i.ibb.co/gmKRSrJ/Screenshot-208.png",
  save: "https://i.ibb.co/JtsPh4R/Screenshot-205.png",  // arrêt du gardien
  miss: "https://i.ibb.co/7rQyN4y/Screenshot-206.png",  // tir raté
  goal: "https://i.ibb.co/S6y5CKC/Screenshot-210.png"   // but
};

// Probabilité de marquer selon la zone visée (réglable).
// Avec un gain net = mise, toute valeur > 0.5 donne de l'argent gratuit à long terme.
const CHANCES = { gauche: 0.45, milieu: 0.48, droite: 0.40 };
const MISS_RATE = 0.35;      // quand ce n'est pas but : 35% tir raté, 65% arrêt du gardien
const TTL = 2 * 60 * 1000;   // le joueur a 2 minutes pour choisir

const ALIAS = {
  gauche: "gauche", g: "gauche", left: "gauche",
  milieu: "milieu", m: "milieu", centre: "milieu", center: "milieu",
  droite: "droite", d: "droite", right: "droite"
};

async function image(url) {
  try { return await global.utils.getStreamFromURL(url); } catch { return null; }
}
const fmt = n => Number(n).toLocaleString("fr-FR");

module.exports = {
  config: {
    name: "penalty",
    version: "2.0",
    author: "toi",
    countDown: 60,
    role: 0,
    shortDescription: { fr: "Joue aux penaltys et mise ton argent" },
    longDescription: { fr: "Joue aux penaltys et mise ton argent" },
    category: "game",
    guide: { fr: "{pn} <mise | tout>" }
  },

  onStart: async function ({ args, message, event, usersData }) {
    try {
      if (args.length !== 1)
        return message.reply("Veuillez fournir un montant de mise valide.");

      const uid = event.senderID;
      const user = await usersData.get(uid);
      const money = Number(user.money) || 0;
      const arg = args[0].toLowerCase();

      const bet = (arg === "tout" || arg === "all") ? money : Number(arg);

      if (!Number.isInteger(bet) || bet <= 0)
        return message.reply("Veuillez fournir un montant de mise valide.");
      if (bet > money)
        return message.reply("Vous n'avez pas assez d'argent pour placer cette mise.");

      const att = await image(IMG.start);
      const body = `⚽ Penalty ! Mise : ${fmt(bet)}$\nRéponds à ce message avec : gauche, milieu ou droite.`;
      const sent = await message.reply(att ? { body, attachment: att } : body);

      global.GoatBot.onReply.set(sent.messageID, {
        commandName: "penalty",
        messageID: sent.messageID,
        uid,
        bet,
        ts: Date.now()
      });
    } catch (e) {
      console.error("Erreur dans la commande penalty:", e);
      message.reply("Une erreur est survenue.");
    }
  },

  onReply: async function ({ message, event, Reply, usersData }) {
    try {
      if (!Reply || Reply.commandName !== "penalty") return;
      if (Reply.uid !== event.senderID) return; // seul le joueur peut répondre

      if (Date.now() - Reply.ts > TTL) {
        global.GoatBot.onReply.delete(Reply.messageID);
        return message.reply("⏱️ Temps écoulé, ce penalty est annulé. Relance la commande.");
      }

      const choix = ALIAS[String(event.body || "").trim().toLowerCase()];
      if (!choix) return message.reply("Choisis : gauche, milieu ou droite.");

      // on retire le message tout de suite : empêche de rejouer le même penalty plusieurs fois
      global.GoatBot.onReply.delete(Reply.messageID);

      const { uid, bet } = Reply;
      const user = await usersData.get(uid);
      const money = Number(user.money) || 0;
      if (bet > money)
        return message.reply("Tu n'as plus assez d'argent pour cette mise, penalty annulé.");

      let url, texte, newMoney;
      if (Math.random() < CHANCES[choix]) {
        url = IMG.goal;
        newMoney = money + bet;
        texte = `⚽ BUT ! Tu gagnes ${fmt(bet)}$ !\n💰 Solde : ${fmt(newMoney)}$`;
      } else {
        newMoney = money - bet;
        if (Math.random() < MISS_RATE) {
          url = IMG.miss;
          texte = `❌ Tir raté ! Tu perds ${fmt(bet)}$.\n💰 Solde : ${fmt(newMoney)}$`;
        } else {
          url = IMG.save;
          texte = `🧤 Arrêt du gardien ! Tu perds ${fmt(bet)}$.\n💰 Solde : ${fmt(newMoney)}$`;
        }
      }
      await usersData.set(uid, { money: newMoney });

      const att = await image(url);
      return message.reply(att ? { body: texte, attachment: att } : texte);
    } catch (e) {
      console.error("Erreur dans penalty (onReply):", e);
      message.reply("Une erreur est survenue.");
    }
  }
};
