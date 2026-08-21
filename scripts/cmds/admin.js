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
// 🎨 ENGIN CANVAS POUR LES ACCÈS ADMIN
// ==========================================
async function generateAdminCanvas(userId, title, subtitle, mainText, themeColor) {
	const width = 900;
	const height = 480;
	const canvas = createCanvas(width, height);
	const ctx = canvas.getContext('2d');

	// 1. Fond dégradé sombre Style Forteresse / Royal Cyber
	let gradient = ctx.createLinearGradient(0, 0, width, height);
	gradient.addColorStop(0, '#0c0514');
	gradient.addColorStop(0.5, '#180a29');
	gradient.addColorStop(1, '#0c0514');
	ctx.fillStyle = gradient;
	ctx.fillRect(0, 0, width, height);

	// 2. Halo lumineux d'arrière-plan
	const glowGrad = ctx.createRadialGradient(190, 240, 20, 190, 240, 250);
	glowGrad.addColorStop(0, 'rgba(255, 255, 255, 0.08)');
	glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
	ctx.fillStyle = glowGrad;
	ctx.fillRect(0, 0, width, height);

	// 3. Cadres doubles gravés de la couleur du thème
	ctx.strokeStyle = themeColor;
	ctx.lineWidth = 4;
	drawRoundedRect(ctx, 25, 25, 850, 430, 12);
	ctx.stroke();

	ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
	ctx.lineWidth = 1;
	drawRoundedRect(ctx, 32, 32, 836, 416, 8);
	ctx.stroke();

	// 4. Séparateurs graphiques
	ctx.fillStyle = themeColor;
	ctx.font = 'bold 16px sans-serif';
	ctx.textAlign = 'left';
	ctx.fillText("✧ ▬▭▬ ▬▬ ✦ ▬▬ ▬▭▬ ✧", 420, 65);
	ctx.fillText("✧ ▬▭▬ ▬▬ ✦ ▬▬ ▬▭▬ ✧", 420, 425);

	// 5. Incrustation de la photo de profil
	const avatarX = 190;
	const avatarY = 240;
	const avatarRadius = 110;

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
		ctx.fillStyle = '#1c0d2e';
		ctx.fillRect(avatarX - avatarRadius, avatarY - avatarRadius, avatarRadius * 2, avatarRadius * 2);
		ctx.fillStyle = themeColor;
		ctx.font = 'bold 60px sans-serif';
		ctx.textAlign = 'center';
		ctx.fillText("👑", avatarX, avatarY + 20);
	}
	ctx.restore();

	// Anneau de sécurité néon
	ctx.strokeStyle = themeColor;
	ctx.lineWidth = 6;
	ctx.beginPath();
	ctx.arc(avatarX, avatarY, avatarRadius + 2, 0, Math.PI * 2);
	ctx.stroke();

	// 6. Écriture des en-têtes système
	ctx.textAlign = 'left';
	ctx.fillStyle = themeColor;
	ctx.font = 'bold 34px sans-serif';
	ctx.fillText(truncateText(ctx, title, 430), 420, 120);

	ctx.fillStyle = '#FFFFFF';
	ctx.font = 'bold 22px sans-serif';
	ctx.fillText(truncateText(ctx, subtitle, 430), 420, 175);

	// Zone d'affichage de la liste ou des UID
	ctx.fillStyle = '#E0E0E0';
	ctx.font = '18px sans-serif';
	
	const lines = mainText.split('\n');
	let y = 220;
	const lineHeight = 28;

	for (let i = 0; i < lines.length; i++) {
		if (y > 390) {
			ctx.fillStyle = themeColor;
			ctx.fillText("• ... et d'autres enregistrements", 420, y);
			break;
		}
		ctx.fillText(truncateText(ctx, lines[i], 430), 420, y);
		y += lineHeight;
	}

	const tmpDir = path.join(__dirname, "cache");
	await fs.ensureDir(tmpDir);
	const imagePath = path.join(tmpDir, `admin_${Date.now()}_${userId}.png`);
	await fs.outputFile(imagePath, canvas.toBuffer('image/png'));
	return imagePath;
}

module.exports = {
	config: {
		name: "admin",
		version: "3.5.0",
		author: "NTKhang + Celestin 👑 (Canvas Edition)",
		countDown: 5,
		role: 2,
		usePrefix: false, // MODE SANS PRÉFIXE ACTIVÉ
		description: {
			en: "Manage admin system with visual cards"
		},
		category: "system"
	},

	langs: {
		en: {
			added: "👑 Accès accordé à %1 élu(s) :\n%2",
			alreadyAdmin: "\n⚠️ Déjà dans l'élite :\n%2",
			missingIdAdd: "⚠️ Donne un UID ou tag",
			removed: "❌ Pouvoir retiré à %1 membre(s) :\n%2",
			notAdmin: "⚠️ Non membre du système :\n%2",
			missingIdRemove: "⚠️ Donne un UID ou tag",
			listAdmin: "👑 Les Boss du Système :\n%1"
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

				const canvasText = getNames.map(i => `• ${i.name}\n  [UID: ${i.uid}]`).join("\n");
				const imagePath = await generateAdminCanvas(uids[0], "👑 ACCÈS SYSTÈME ACCORDÉ", `Élu(s) détecté(s) : ${notAdminIds.length}`, canvasText, "#ffb703");

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

				const canvasText = getNames.map(i => `• ${i.name}\n  [UID: ${i.uid}]`).join("\n");
				const imagePath = await generateAdminCanvas(uids[0], "❌ POUVOIR DESTITUTION", `Statut : ${adminIds.length} révoqué(s)`, canvasText, "#f72585");

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

				const canvasText = getNames.map((i, index) => `${index + 1}. ${i.name} (${i.uid})`).join("\n");
				const imagePath = await generateAdminCanvas(senderID, "🛡️ LISTE DES SOUVERAINS", `Total : ${config.adminBot.length} Administrateurs`, canvasText, "#00f5d4");

				return message.reply({ body: getLang("listAdmin", getNames.map(i => `• ${i.name} (${i.uid})`).join("\n")), attachment: fs.createReadStream(imagePath) }, () => {
					if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
				});
			}

			// ================= DEFAULT =================
			default:
				return message.reply("⚠️ Commande invalide. Options valides : add (-a), remove (-r), list (-l)");
		}
	}
};
		
