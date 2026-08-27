const { createCanvas, loadImage } = require('canvas');
const fs = require('fs-extra');
const path = require('path');

const { getTime } = global.utils;

module.exports = {
	config: {
		name: "leave",
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
			leaveType1: "tự rời",
			leaveType2: "bị kick",
			defaultLeaveMessage: "{userName} đã {type} khỏi nhóm"
		},
		en: {
			session1: "morning",
			session2: "noon",
			session3: "afternoon",
			session4: "evening",
			leaveType1: "left",
			leaveType2: "was kicked from",
			defaultLeaveMessage: "{userName} {type} the group"
		}
	},

	onStart: async ({ threadsData, message, event, api, usersData, getLang }) => {
		if (event.logMessageType == "log:unsubscribe") {
			const { threadID } = event;
			const threadData = await threadsData.get(threadID);
			if (!threadData.settings.sendLeaveMessage) return;

			const { leftParticipantFbId } = event.logMessageData;
			if (leftParticipantFbId == api.getCurrentUserID()) return;

			const hours = getTime("HH");
			const threadName = threadData.threadName || "le groupe";
			const userName = await usersData.getName(leftParticipantFbId);
			const leaveType = leftParticipantFbId == event.author ? getLang("leaveType1") : getLang("leaveType2");

			let { leaveMessage = getLang("defaultLeaveMessage") } = threadData.data;

			leaveMessage = leaveMessage
				.replace(/\{userName\}|\{userNameTag\}/g, userName)
				.replace(/\{type\}/g, leaveType)
				.replace(/\{threadName\}|\{boxName\}/g, threadName)
				.replace(/\{time\}/g, hours)
				.replace(/\{session\}/g, hours <= 10 ?
					getLang("session1") : hours <= 12 ?
						getLang("session2") : hours <= 18 ?
							getLang("session3") : getLang("session4")
				);

			// GENERATION DE LA CARTE CANVAS COLORÉE
			const canvasPath = await makeLeaveCard(leftParticipantFbId, userName, leaveType, threadName, usersData);

			const form = {
				body: leaveMessage,
				attachment: fs.createReadStream(canvasPath)
			};

			if (leaveMessage.includes("{userNameTag}")) {
				form.mentions = [{
					id: leftParticipantFbId,
					tag: userName
				}];
			}

			message.send(form, () => {
				if (fs.existsSync(canvasPath)) fs.unlinkSync(canvasPath);
			});
		}
	}
};

// FONCTION DE CREATION DE CARTE AVEC NUANCES DE COULEURS
async function makeLeaveCard(userID, userName, leaveType, groupName, usersData) {
	const canvas = createCanvas(1000, 500);
	const ctx = canvas.getContext('2d');

	// 1. FOND DEGRADÉ COLORÉ (VIOLET / ROUGE / ORANGE)
	const bgGrad = ctx.createLinearGradient(0, 0, 1000, 500);
	bgGrad.addColorStop(0, "#1A0B2E");
	bgGrad.addColorStop(0.5, "#3B0764");
	bgGrad.addColorStop(1, "#881337");
	ctx.fillStyle = bgGrad;
	ctx.fillRect(0, 0, 1000, 500);

	// Bulles de couleurs néon en arrière-plan
	ctx.fillStyle = "rgba(244, 63, 94, 0.2)";
	ctx.beginPath(); ctx.arc(120, 100, 180, 0, Math.PI * 2); ctx.fill();
	ctx.fillStyle = "rgba(168, 85, 247, 0.2)";
	ctx.beginPath(); ctx.arc(880, 400, 220, 0, Math.PI * 2); ctx.fill();

	// Panneau central translucide
	ctx.fillStyle = "rgba(15, 23, 42, 0.65)";
	ctx.roundRect(40, 40, 920, 420, 25);
	ctx.fill();
	ctx.strokeStyle = "rgba(244, 63, 94, 0.3)";
	ctx.lineWidth = 2;
	ctx.stroke();

	// 2. RÉCUPÉRATION AVATAR
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

		// Glow Rouge/Rose autour de la photo de profil
		ctx.save();
		ctx.shadowColor = "#F43F5E";
		ctx.shadowBlur = 30;
		ctx.beginPath();
		ctx.arc(avatarX, avatarY, (avatarSize / 2) + 4, 0, Math.PI * 2);
		ctx.fillStyle = "#F43F5E";
		ctx.fill();
		ctx.restore();

		// Photo découpée
		ctx.save();
		ctx.beginPath();
		ctx.arc(avatarX, avatarY, avatarSize / 2, 0, Math.PI * 2);
		ctx.clip();
		ctx.drawImage(avatarImg, avatarX - (avatarSize / 2), avatarY - (avatarSize / 2), avatarSize, avatarSize);
		ctx.restore();
	} catch (e) {
		ctx.fillStyle = "#E11D48";
		ctx.beginPath();
		ctx.arc(avatarX, avatarY, avatarSize / 2, 0, Math.PI * 2);
		ctx.fill();
	}

	// 3. TEXTES ET TYPOGRAPHIE
	ctx.textAlign = "center";

	// En-tête GOODBYE
	ctx.font = "bold 38px 'Segoe UI', sans-serif";
	ctx.fillStyle = "#FB7185";
	ctx.fillText("GOODBYE!", 500, 300);

	// Nom du membre
	ctx.font = "bold 42px 'Segoe UI', sans-serif";
	ctx.fillStyle = "#FFFFFF";
	const shortName = userName.length > 25 ? userName.substring(0, 25) + "..." : userName;
	ctx.fillText(shortName, 500, 360);

	// Type de départ (Left / Kicked) & Nom du groupe
	ctx.font = "500 22px 'Segoe UI', sans-serif";
	ctx.fillStyle = "#CBD5E1";
	const shortGroup = groupName.length > 30 ? groupName.substring(0, 30) + "..." : groupName;
	ctx.fillText(`${leaveType.toUpperCase()} • ${shortGroup}`, 500, 405);

	// Sauvegarde en cache
	const cacheDir = path.join(__dirname, "cache");
	fs.ensureDirSync(cacheDir);
	const cachePath = path.join(cacheDir, `leave_${userID}.png`);
	const buffer = canvas.toBuffer("image/png");
	fs.writeFileSync(cachePath, buffer);

	return cachePath;
}
