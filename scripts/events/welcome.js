const { createCanvas, loadImage } = require('canvas');
const fs = require('fs-extra');
const path = require('path');

const { getTime } = global.utils;
if (!global.temp.welcomeEvent)
	global.temp.welcomeEvent = {};

module.exports = {
	config: {
		name: "welcome",
		version: "2.0.0",
		author: "NTKhang & Celestin",
		category: "events"
	},

	langs: {
		vi: {
			session1: "sáng",
			session2: "trưa",
			session3: "chiều",
			session4: "tối",
			welcomeMessage: "Cảm ơn bạn đã mời tôi vào nhóm!\nPrefix bot: %1\nĐể xem danh sách lệnh hãy nhập: %1help",
			multiple1: "bạn",
			multiple2: "các bạn",
			defaultWelcomeMessage: "Xin chào {userName}.\nChào mừng bạn đến với {boxName}.\nChúc bạn có buổi {session} vui vẻ!"
		},
		en: {
			session1: "morning",
			session2: "noon",
			session3: "afternoon",
			session4: "evening",
			welcomeMessage: "Thank you for inviting me to the group!\nBot prefix: %1\nTo view the list of commands, please enter: %1help",
			multiple1: "you",
			multiple2: "you guys",
			defaultWelcomeMessage: `Hello {userName}.\nWelcome {multiple} to the chat group: {boxName}\nHave a nice {session} 😊`
		}
	},

	onStart: async ({ threadsData, usersData, message, event, api, getLang }) => {
		if (event.logMessageType == "log:subscribe") {
			const hours = getTime("HH");
			const { threadID } = event;
			const { nickNameBot } = global.GoatBot.config;
			const prefix = global.utils.getPrefix(threadID);
			const dataAddedParticipants = event.logMessageData.addedParticipants;

			// Si le nouveau membre est le bot
			if (dataAddedParticipants.some((item) => item.userFbId == api.getCurrentUserID())) {
				if (nickNameBot)
					api.changeNickname(nickNameBot, threadID, api.getCurrentUserID());
				return message.send(getLang("welcomeMessage", prefix));
			}

			if (!global.temp.welcomeEvent[threadID])
				global.temp.welcomeEvent[threadID] = {
					joinTimeout: null,
					dataAddedParticipants: []
				};

			global.temp.welcomeEvent[threadID].dataAddedParticipants.push(...dataAddedParticipants);
			clearTimeout(global.temp.welcomeEvent[threadID].joinTimeout);

			global.temp.welcomeEvent[threadID].joinTimeout = setTimeout(async function () {
				const threadData = await threadsData.get(threadID);
				if (threadData.settings.sendWelcomeMessage == false) return;

				const dataAddedParticipants = global.temp.welcomeEvent[threadID].dataAddedParticipants;
				const dataBanned = threadData.data.banned_ban || [];
				const threadName = threadData.threadName || "le groupe";
				const userName = [], mentions = [];
				let multiple = false;
				let firstUserFbId = dataAddedParticipants[0].userFbId;

				if (dataAddedParticipants.length > 1) multiple = true;

				for (const user of dataAddedParticipants) {
					if (dataBanned.some((item) => item.id == user.userFbId)) continue;
					userName.push(user.fullName);
					mentions.push({
						tag: user.fullName,
						id: user.userFbId
					});
				}

				if (userName.length == 0) return;

				let { welcomeMessage = getLang("defaultWelcomeMessage") } = threadData.data;

				welcomeMessage = welcomeMessage
					.replace(/\{userName\}|\{userNameTag\}/g, userName.join(", "))
					.replace(/\{boxName\}|\{threadName\}/g, threadName)
					.replace(/\{multiple\}/g, multiple ? getLang("multiple2") : getLang("multiple1"))
					.replace(
						/\{session\}/g,
						hours <= 10 ? getLang("session1") : hours <= 12 ? getLang("session2") : hours <= 18 ? getLang("session3") : getLang("session4")
					);

				// GENERATION DU CANVAS
				const canvasPath = await makeWelcomeCard(firstUserFbId, userName.join(", "), threadName, usersData);

				const form = {
					body: welcomeMessage,
					mentions: welcomeMessage.match(/\{userNameTag\}/g) ? mentions : null,
					attachment: fs.createReadStream(canvasPath)
				};

				message.send(form, () => {
					if (fs.existsSync(canvasPath)) fs.unlinkSync(canvasPath);
				});

				delete global.temp.welcomeEvent[threadID];
			}, 1500);
		}
	}
};

// FONCTION CANVAS DÉCORATIVE
async function makeWelcomeCard(userID, userName, groupName, usersData) {
	const canvas = createCanvas(1000, 500);
	const ctx = canvas.getContext('2d');

	// 1. FOND DEGRADÉ CYBER / NEON
	const bgGrad = ctx.createLinearGradient(0, 0, 1000, 500);
	bgGrad.addColorStop(0, "#0F172A");
	bgGrad.addColorStop(0.5, "#1E1B4B");
	bgGrad.addColorStop(1, "#311042");
	ctx.fillStyle = bgGrad;
	ctx.fillRect(0, 0, 1000, 500);

	// Cercles décoratifs en arrière-plan
	ctx.fillStyle = "rgba(139, 92, 246, 0.15)";
	ctx.beginPath(); ctx.arc(150, 80, 200, 0, Math.PI * 2); ctx.fill();
	ctx.fillStyle = "rgba(236, 72, 153, 0.15)";
	ctx.beginPath(); ctx.arc(850, 420, 250, 0, Math.PI * 2); ctx.fill();

	// Cadre intérieur translucide
	ctx.fillStyle = "rgba(15, 23, 42, 0.6)";
	ctx.roundRect(40, 40, 920, 420, 25);
	ctx.fill();
	ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
	ctx.lineWidth = 2;
	ctx.stroke();

	// 2. RECUPERATION ET AFFICHAGE AVATAR
	let avatarUrl;
	try {
		if (usersData && typeof usersData.getAvatarUrl === 'function') {
			avatarUrl = await usersData.getAvatarUrl(userID);
		}
	} catch (e) {}
	if (!avatarUrl) {
		avatarUrl = `https://graph.facebook.com/${userID}/picture?height=400&width=400&access_token=6628568379%7Cc1e620fa708a1d5696fb991c1bde5662`;
	}

	const avatarSize = 180;
	const avatarX = 500;
	const avatarY = 160;

	try {
		const avatarImg = await loadImage(avatarUrl);

		// Glow autour de l'avatar
		ctx.save();
		ctx.shadowColor = "#EC4899";
		ctx.shadowBlur = 25;
		ctx.beginPath();
		ctx.arc(avatarX, avatarY, (avatarSize / 2) + 4, 0, Math.PI * 2);
		ctx.fillStyle = "#EC4899";
		ctx.fill();
		ctx.restore();

		// Découpe circulaire de l'avatar
		ctx.save();
		ctx.beginPath();
		ctx.arc(avatarX, avatarY, avatarSize / 2, 0, Math.PI * 2);
		ctx.clip();
		ctx.drawImage(avatarImg, avatarX - (avatarSize / 2), avatarY - (avatarSize / 2), avatarSize, avatarSize);
		ctx.restore();
	} catch (e) {
		// Fallback si l'avatar échoue
		ctx.fillStyle = "#8B5CF6";
		ctx.beginPath();
		ctx.arc(avatarX, avatarY, avatarSize / 2, 0, Math.PI * 2);
		ctx.fill();
	}

	// 3. TEXTES TYPOGRAPHIQUES
	ctx.textAlign = "center";

	// Message WELCOME
	ctx.font = "bold 38px 'Segoe UI', sans-serif";
	ctx.fillStyle = "#F472B6";
	ctx.fillText("WELCOME TO THE GROUP", 500, 300);

	// Nom de l'utilisateur
	ctx.font = "bold 44px 'Segoe UI', sans-serif";
	ctx.fillStyle = "#FFFFFF";
	const shortName = userName.length > 25 ? userName.substring(0, 25) + "..." : userName;
	ctx.fillText(shortName, 500, 360);

	// Nom du groupe
	ctx.font = "500 24px 'Segoe UI', sans-serif";
	ctx.fillStyle = "#9CA3AF";
	const shortGroup = groupName.length > 35 ? groupName.substring(0, 35) + "..." : groupName;
	ctx.fillText(`Group: ${shortGroup}`, 500, 405);

	// Sauvegarde temporaire du Canvas
	const cacheDir = path.join(__dirname, "cache");
	fs.ensureDirSync(cacheDir);
	const cachePath = path.join(cacheDir, `welcome_${userID}.png`);
	const buffer = canvas.toBuffer("image/png");
	fs.writeFileSync(cachePath, buffer);

	return cachePath;
}
