const { createCanvas, loadImage } = require('@napi-rs/canvas');
const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
const { writeFileSync } = require("fs-extra");

const { config } = global.GoatBot;

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
// 🎨 ENGINE CANVAS VIP - OBJECTS EDITION
// ==========================================
async function generateAdminCanvas(userId, title, subtitle, itemsList, themeColor) {
	const width = 1000;
	const height = 550;
	const canvas = createCanvas(width, height);
	const ctx = canvas.getContext('2d');

	// 1. Fond Cyberpunk Sombre
	const bgGradient = ctx.createLinearGradient(0, 0, width, height);
	bgGradient.addColorStop(0, '#06070c');
	bgGradient.addColorStop(0.5, '#0f121e');
	bgGradient.addColorStop(1, '#06070c');
	ctx.fillStyle = bgGradient;
	ctx.fillRect(0, 0, width, height);

	// 2. Halo d'ambiance dynamique
	const glow = ctx.createRadialGradient(200, 275, 20, 200, 275, 300);
	glow.addColorStop(0, themeColor + '33'); // Opacité à 20%
	glow.addColorStop(1, 'transparent');
	ctx.fillStyle = glow;
	ctx.fillRect(0, 0, width, height);

	// 3. Cadre principal Glassmorphism
	ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
	drawRoundedRect(ctx, 30, 30, width - 60, height - 60, 20);
	ctx.fill();

	ctx.strokeStyle = themeColor;
	ctx.lineWidth = 3;
	drawRoundedRect(ctx, 30, 30, width - 60, height - 60, 20);
	ctx.stroke();

	ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
	ctx.lineWidth = 1;
	drawRoundedRect(ctx, 40, 40, width - 80, height - 80, 15);
	ctx.stroke();

	// 4. Photo de Profil (Avatar)
	const avatarX = 180;
	const avatarY = 250;
	const avatarRadius = 100;

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
		ctx.fillStyle = '#141824';
		ctx.fillRect(avatarX - avatarRadius, avatarY - avatarRadius, avatarRadius * 2, avatarRadius * 2);
		ctx.fillStyle = themeColor;
		ctx.font = 'bold 70px sans-serif';
		ctx.textAlign = 'center';
		ctx.fillText("👑", avatarX, avatarY + 25);
	}
	ctx.restore();

	// Contour de l'avatar
	ctx.strokeStyle = themeColor;
	ctx.lineWidth = 5;
	ctx.beginPath();
	ctx.arc(avatarX, avatarY, avatarRadius + 4, 0, Math.PI * 2);
	ctx.stroke();

	// 5. Textes de Header
	ctx.textAlign = 'left';
	ctx.fillStyle = themeColor;
	ctx.font = 'bold 36px sans-serif';
	ctx.fillText(truncateText(ctx, title, 550), 340, 105);

	ctx.fillStyle = '#FFFFFF';
	ctx.font = 'bold 20px sans-serif';
	ctx.fillText(truncateText(ctx, subtitle, 550), 340, 145);

	// Ligne de séparation
	ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
	ctx.lineWidth = 2;
	ctx.beginPath();
	ctx.moveTo(340, 165);
	ctx.lineTo(width - 60, 165);
	ctx.stroke();

	// 6. Rendu des OBJETS (Badges Administrateurs)
	let startY = 190;
	const cardX = 340;
	const cardW = 590;
	const cardH = 65;

	for (let i = 0; i < Math.min(itemsList.length, 4); i++) {
		const item = itemsList[i];

		// Carte d'objet
		ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
		drawRoundedRect(ctx, cardX, startY, cardW, cardH, 12);
		ctx.fill();

		ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
		ctx.lineWidth = 1;
		ctx.stroke();

		// Badge latéral de statut
		ctx.fillStyle = themeColor;
		drawRoundedRect(ctx, cardX + 6, startY + 10, 5, 45, 3);
		ctx.fill();

		// Nom de l'utilisateur
		ctx.fillStyle = '#FFFFFF';
		ctx.font = 'bold 18px sans-serif';
		ctx.fillText(truncateText(ctx, item.name, 320), cardX + 25, startY + 30);

		// Badge UID (Objet)
		ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
		drawRoundedRect(ctx, cardX + 370, startY + 18, 200, 28, 8);
		ctx.fill();

		ctx.fillStyle = '#A0A5B5';
		ctx.font = '13px monospace';
		ctx.fillText(`UID: ${item.uid}`, cardX + 382, startY + 36);

		startY += cardH + 12;
	}

	if (itemsList.length > 4) {
		ctx.fillStyle = themeColor;
		ctx.font = 'bold 15px sans-serif';
		ctx.fillText(`+ ${itemsList.length - 4} autre(s) enregistrement(s) dans la base...`, cardX, startY + 15);
	}

	// 7. Sauvegarde dans le cache
	const tmpDir = path.join(__dirname, "cache");
	await fs.ensureDir(tmpDir);
	const imagePath = path.join(tmpDir, `admin_${Date.now()}_${userId}.png`);
	await fs.outputFile(imagePath, canvas.toBuffer('image/png'));
	return imagePath;
}

module.exports = {
	config: {
		name: "admin",
		version: "4.0.0",
		author: "NTKhang + Celestin 👑 (Object Canvas VIP)",
		countDown: 5,
		role: 2,
		usePrefix: false,
		description: {
			en: "Gérer le système administrateur sous forme de cartes d'objets VIP"
		},
		category: "system"
	},

	langs: {
		en: {
			added: "👑 Accès accordé à %1 membre(s) :\n%2",
			alreadyAdmin: "\n⚠️ Déjà présent dans la liste :\n%2",
			missingIdAdd: "⚠️ Indique un UID ou identifie un utilisateur par tag.",
			removed: "❌ Rôle révoqué pour %1 membre(s) :\n%2",
			notAdmin: "⚠️ Non répertorié dans les administrateurs :\n%2",
			missingIdRemove: "⚠️ Indique un UID ou identifie un utilisateur par tag.",
			listAdmin: "👑 **PANNEAU DES ADMINISTRATEURS DU BOT**\n%1"
		}
	},

	onStart: async function ({ message, args, usersData, event, getLang }) {
		const senderID = event.senderID;

		switch (args[0]) {

			// ================= ADD =================
			case "add":
			case "-a": {
				if (!args[1]) return message.reply(getLang("missingIdAdd"));

				let uids = [];
				if (Object.keys(event.mentions).length > 0)
					uids = Object.keys(event.mentions);
				else if (event.messageReply)
					uids.push(event.messageReply.senderID);
				else
					uids = args.filter(arg => !isNaN(arg));

				if (uids.length == 0) return message.reply(getLang("missingIdAdd"));

				const notAdminIds = [];
				const adminIds = [];

				for (const uid of uids) {
					if (config.adminBot.includes(uid)) adminIds.push(uid);
					else notAdminIds.push(uid);
				}

				config.adminBot.push(...notAdminIds);
				writeFileSync(global.client.dirConfig, JSON.stringify(config, null, 2));

				const getNames = await Promise.all(
					uids.map(uid => usersData.getName(uid).then(name => ({ uid, name })).catch(() => ({ uid, name: "Utilisateur" })))
				);

				const imagePath = await generateAdminCanvas(uids[0], "👑 ACCÈS PRIVILÉGIÉ ACCORDÉ", `Mise à jour : +${notAdminIds.length} nouvel administrateur`, getNames, "#FFB703");

				let replyText = (notAdminIds.length > 0 ? getLang("added", notAdminIds.length, getNames.map(i => `• ${i.name} (${i.uid})`).join("\n")) : "") +
					(adminIds.length > 0 ? getLang("alreadyAdmin", adminIds.length, adminIds.map(uid => `• ${uid}`).join("\n")) : "");

				return message.reply({ body: replyText, attachment: fs.createReadStream(imagePath) }, () => {
					if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
				});
			}

			// ================= REMOVE =================
			case "remove":
			case "-r": {
				if (!args[1]) return message.reply(getLang("missingIdRemove"));

				let uids = [];
				if (Object.keys(event.mentions).length > 0)
					uids = Object.keys(event.mentions);
				else if (event.messageReply)
					uids.push(event.messageReply.senderID);
				else
					uids = args.filter(arg => !isNaN(arg));

				if (uids.length == 0) return message.reply(getLang("missingIdRemove"));

				const notAdminIds = [];
				const adminIds = [];

				for (const uid of uids) {
					if (config.adminBot.includes(uid)) adminIds.push(uid);
					else notAdminIds.push(uid);
				}

				for (const uid of adminIds)
					config.adminBot.splice(config.adminBot.indexOf(uid), 1);

				writeFileSync(global.client.dirConfig, JSON.stringify(config, null, 2));

				const getNames = await Promise.all(
					adminIds.map(uid => usersData.getName(uid).then(name => ({ uid, name })).catch(() => ({ uid, name: "Utilisateur" })))
				);

				const imagePath = await generateAdminCanvas(uids[0], "❌ RÉVOCATION DU STATUT", `Mise à jour : -${adminIds.length} administrateur(s)`, getNames, "#FF0055");

				let replyText = (adminIds.length > 0 ? getLang("removed", adminIds.length, getNames.map(i => `• ${i.name} (${i.uid})`).join("\n")) : "") +
					(notAdminIds.length > 0 ? getLang("notAdmin", notAdminIds.length, notAdminIds.map(uid => `• ${uid}`).join("\n")) : "");

				return message.reply({ body: replyText, attachment: fs.createReadStream(imagePath) }, () => {
					if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
				});
			}

			// ================= LIST =================
			case "list":
			case "-l": {
				const getNames = await Promise.all(
					config.adminBot.map(uid => usersData.getName(uid).then(name => ({ uid, name })).catch(() => ({ uid, name: "Utilisateur" })))
				);

				const imagePath = await generateAdminCanvas(senderID, "🛡️ REGISTRE DES ADMINISTRATEURS", `Effectif total : ${config.adminBot.length} membres`, getNames, "#00F5D4");

				return message.reply({ body: getLang("listAdmin", getNames.map((i, index) => `${index + 1}. ${i.name} (${i.uid})`).join("\n")), attachment: fs.createReadStream(imagePath) }, () => {
					if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
				});
			}

			// ================= DEFAULT =================
			default:
				return message.reply("⚠️ Syntaxe incorrecte. Commandes acceptées : admin add (-a), admin remove (-r), admin list (-l)");
		}
	}
};
