const { createCanvas, loadImage } = require('canvas');
const fs = require('fs-extra');
const path = require('path');

const { getStreamsFromAttachment, log } = global.utils;
const mediaTypes = ["photo", 'png', "animated_image", "video", "audio"];

module.exports = {
	config: {
		name: "callad",
		version: "2.0.0",
		author: "NTKhang & Celestin",
		countDown: 5,
		role: 0,
		description: {
			vi: "gửi báo cáo, góp ý, báo lỗi,... của bạn về admin bot",
			en: "send report, feedback, bug,... to admin bot"
		},
		category: "contacts admin",
		guide: {
			vi: "   {pn} <tin nhắn>",
			en: "   {pn} <message>"
		}
	},

	langs: {
		vi: {
			missingMessage: "Vui lòng nhập tin nhắn bạn muốn gửi về admin",
			sendByGroup: "\n- Được gửi từ nhóm: %1\n- Thread ID: %2",
			sendByUser: "\n- Được gửi từ người dùng",
			content: "\n\nNội dung:\n─────────────────\n%1\n─────────────────\nPhản hồi tin nhắn này để gửi tin nhắn về người dùng",
			success: "Đã gửi tin nhắn của bạn về %1 admin thành công!\n%2",
			failed: "Đã có lỗi xảy ra khi gửi tin nhắn của bạn về %1 admin\n%2\nKiểm tra console để biết thêm chi tiết",
			reply: "📍 Phản hồi từ admin %1:\n─────────────────\n%2\n─────────────────\nPhản hồi tin nhắn này để tiếp tục gửi tin nhắn về admin",
			replySuccess: "Đã gửi phản hồi của bạn về admin thành công!",
			feedback: "📝 Phản hồi từ người dùng %1:\n- User ID: %2%3\n\nNội dung:\n─────────────────\n%4\n─────────────────\nPhản hồi tin nhắn này để gửi tin nhắn về người dùng",
			replyUserSuccess: "Đã gửi phản hồi của bạn về người dùng thành công!",
			noAdmin: "Hiện tại bot chưa có admin nào"
		},
		en: {
			missingMessage: "Please enter the message you want to send to admin",
			sendByGroup: "\n- Sent from group: %1\n- Thread ID: %2",
			sendByUser: "\n- Sent from user",
			content: "\n\nContent:\n─────────────────\n%1\n─────────────────\nReply this message to send message to user",
			success: "Sent your message to %1 admin successfully!\n%2",
			failed: "An error occurred while sending your message to %1 admin\n%2\nCheck console for more details",
			reply: "📍 Reply from admin %1:\n─────────────────\n%2\n─────────────────\nReply this message to continue send message to admin",
			replySuccess: "Sent your reply to admin successfully!",
			feedback: "📝 Feedback from user %1:\n- User ID: %2%3\n\nContent:\n─────────────────\n%4\n─────────────────\nReply this message to send message to user",
			replyUserSuccess: "Sent your reply to user successfully!",
			noAdmin: "Bot has no admin at the moment"
		}
	},

	onStart: async function ({ args, message, event, usersData, threadsData, api, commandName, getLang }) {
		const { config } = global.GoatBot;
		if (!args[0])
			return message.reply(getLang("missingMessage"));
		const { senderID, threadID, isGroup } = event;
		if (config.adminBot.length == 0)
			return message.reply(getLang("noAdmin"));

		const senderName = await usersData.getName(senderID);
		const groupName = isGroup ? (await threadsData.get(threadID)).threadName : "Private Chat";
		const userMsg = args.join(" ");

		// Génération de la carte Canvas
		const canvasPath = await createCalladCard({
			title: "📩 REPORT TO ADMIN",
			senderName,
			senderID,
			subTitle: isGroup ? `Group: ${groupName}` : "Direct Message",
			content: userMsg,
			themeColor: "#6366F1", // Indigo
			usersData
		});

		const msgText = "==📨️ CALL ADMIN 📨️=="
			+ `\n- User Name: ${senderName}`
			+ `\n- User ID: ${senderID}`
			+ (isGroup ? getLang("sendByGroup", groupName, threadID) : getLang("sendByUser"))
			+ getLang("content", userMsg);

		const attachments = await getStreamsFromAttachment(
			[...event.attachments, ...(event.messageReply?.attachments || [])]
				.filter(item => mediaTypes.includes(item.type))
		);

		// Ajouter la carte Canvas aux pièces jointes
		if (fs.existsSync(canvasPath)) {
			attachments.unshift(fs.createReadStream(canvasPath));
		}

		const formMessage = {
			body: msgText,
			mentions: [{ id: senderID, tag: senderName }],
			attachment: attachments
		};

		const successIDs = [];
		const failedIDs = [];
		const adminNames = await Promise.all(config.adminBot.map(async item => ({
			id: item,
			name: await usersData.getName(item)
		})));

		for (const uid of config.adminBot) {
			try {
				const messageSend = await api.sendMessage(formMessage, uid);
				successIDs.push(uid);
				global.GoatBot.onReply.set(messageSend.messageID, {
					commandName,
					messageID: messageSend.messageID,
					threadID,
					messageIDSender: event.messageID,
					type: "userCallAdmin"
				});
			}
			catch (err) {
				failedIDs.push({
					adminID: uid,
					error: err
				});
			}
		}

		if (fs.existsSync(canvasPath)) fs.unlinkSync(canvasPath);

		let msg2 = "";
		if (successIDs.length > 0)
			msg2 += getLang("success", successIDs.length,
				adminNames.filter(item => successIDs.includes(item.id)).map(item => ` <@${item.id}> (${item.name})`).join("\n")
			);
		if (failedIDs.length > 0) {
			msg2 += getLang("failed", failedIDs.length,
				failedIDs.map(item => ` <@${item.adminID}> (${adminNames.find(item2 => item2.id == item.adminID)?.name || item.adminID})`).join("\n")
			);
			log.err("CALL ADMIN", failedIDs);
		}

		return message.reply({
			body: msg2,
			mentions: adminNames.map(item => ({
				id: item.id,
				tag: item.name
			}))
		});
	},

	onReply: async ({ args, event, api, message, Reply, usersData, commandName, getLang }) => {
		const { type, threadID, messageIDSender } = Reply;
		const senderName = await usersData.getName(event.senderID);
		const { isGroup } = event;
		const replyMsg = args.join(" ");

		switch (type) {
			case "userCallAdmin": {
				const canvasPath = await createCalladCard({
					title: "👑 ADMIN RESPONSE",
					senderName,
					senderID: event.senderID,
					subTitle: "Official Reply",
					content: replyMsg,
					themeColor: "#10B981", // Emeraude
					usersData
				});

				const attachments = await getStreamsFromAttachment(
					event.attachments.filter(item => mediaTypes.includes(item.type))
				);
				if (fs.existsSync(canvasPath)) {
					attachments.unshift(fs.createReadStream(canvasPath));
				}

				const formMessage = {
					body: getLang("reply", senderName, replyMsg),
					mentions: [{ id: event.senderID, tag: senderName }],
					attachment: attachments
				};

				api.sendMessage(formMessage, threadID, (err, info) => {
					if (fs.existsSync(canvasPath)) fs.unlinkSync(canvasPath);
					if (err) return message.err(err);

					message.reply(getLang("replyUserSuccess"));
					global.GoatBot.onReply.set(info.messageID, {
						commandName,
						messageID: info.messageID,
						messageIDSender: event.messageID,
						threadID: event.threadID,
						type: "adminReply"
					});
				}, messageIDSender);
				break;
			}
			case "adminReply": {
				let sendByGroup = "";
				let groupName = "Private Chat";
				if (isGroup) {
					const threadInfo = await api.getThreadInfo(event.threadID);
					groupName = threadInfo.threadName || "le groupe";
					sendByGroup = getLang("sendByGroup", groupName, event.threadID);
				}

				const canvasPath = await createCalladCard({
					title: "💬 USER FEEDBACK",
					senderName,
					senderID: event.senderID,
					subTitle: isGroup ? `Group: ${groupName}` : "Direct Message",
					content: replyMsg,
					themeColor: "#EC4899", // Rose Neon
					usersData
				});

				const attachments = await getStreamsFromAttachment(
					event.attachments.filter(item => mediaTypes.includes(item.type))
				);
				if (fs.existsSync(canvasPath)) {
					attachments.unshift(fs.createReadStream(canvasPath));
				}

				const formMessage = {
					body: getLang("feedback", senderName, event.senderID, sendByGroup, replyMsg),
					mentions: [{ id: event.senderID, tag: senderName }],
					attachment: attachments
				};

				api.sendMessage(formMessage, threadID, (err, info) => {
					if (fs.existsSync(canvasPath)) fs.unlinkSync(canvasPath);
					if (err) return message.err(err);

					message.reply(getLang("replySuccess"));
					global.GoatBot.onReply.set(info.messageID, {
						commandName,
						messageID: info.messageID,
						messageIDSender: event.messageID,
						threadID: event.threadID,
						type: "userCallAdmin"
					});
				}, messageIDSender);
				break;
			}
			default:
				break;
		}
	}
};

// FONCTION DE CRÉATION DE LA CARTE CANVAS
async function createCalladCard({ title, senderName, senderID, subTitle, content, themeColor, usersData }) {
	const canvas = createCanvas(900, 450);
	const ctx = canvas.getContext('2d');

	// Background Sombre Cyber
	const bgGrad = ctx.createLinearGradient(0, 0, 900, 450);
	bgGrad.addColorStop(0, "#0F172A");
	bgGrad.addColorStop(1, "#1E293B");
	ctx.fillStyle = bgGrad;
	ctx.fillRect(0, 0, 900, 450);

	// Effets d'éclat lumineux
	ctx.fillStyle = themeColor;
	ctx.globalAlpha = 0.15;
	ctx.beginPath(); ctx.arc(100, 80, 180, 0, Math.PI * 2); ctx.fill();
	ctx.beginPath(); ctx.arc(800, 370, 200, 0, Math.PI * 2); ctx.fill();
	ctx.globalAlpha = 1.0;

	// Panneau encadré translucide
	ctx.fillStyle = "rgba(15, 23, 42, 0.75)";
	ctx.roundRect(30, 30, 840, 390, 20);
	ctx.fill();

	// Bordure lumineuse du cadre
	ctx.strokeStyle = themeColor;
	ctx.lineWidth = 3;
	ctx.stroke();

	// En-tête (Titre du Message)
	ctx.fillStyle = themeColor;
	ctx.font = "bold 26px 'Segoe UI', sans-serif";
	ctx.fillText(title, 180, 75);

	// Sous-titre / Info provenance
	ctx.fillStyle = "#94A3B8";
	ctx.font = "18px 'Segoe UI', sans-serif";
	ctx.fillText(subTitle, 180, 105);

	// Ligne de séparation
	ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.moveTo(180, 120);
	ctx.lineTo(830, 120);
	ctx.stroke();

	// Récupération Avatar
	let avatarUrl;
	try {
		if (usersData && typeof usersData.getAvatarUrl === 'function') {
			avatarUrl = await usersData.getAvatarUrl(senderID);
		}
	} catch (e) {}
	if (!avatarUrl) {
		avatarUrl = `https://graph.facebook.com/${senderID}/picture?height=200&width=200&access_token=6628568379%7Cc1e620fa708a1d5696fb991c1bde5662`;
	}

	try {
		const avatarImg = await loadImage(avatarUrl);
		
		// Contour Glowing de l'Avatar
		ctx.save();
		ctx.shadowColor = themeColor;
		ctx.shadowBlur = 15;
		ctx.beginPath();
		ctx.arc(95, 95, 45, 0, Math.PI * 2);
		ctx.fillStyle = themeColor;
		ctx.fill();
		ctx.restore();

		// Découpe circulaire
		ctx.save();
		ctx.beginPath();
		ctx.arc(95, 95, 42, 0, Math.PI * 2);
		ctx.clip();
		ctx.drawImage(avatarImg, 53, 53, 84, 84);
		ctx.restore();
	} catch (e) {}

	// Nom de l'expéditeur
	ctx.fillStyle = "#FFFFFF";
	ctx.font = "bold 22px 'Segoe UI', sans-serif";
	ctx.fillText(senderName, 50, 180);

	// Zone du contenu (Boîte de dialogue encadrée)
	ctx.fillStyle = "rgba(30, 41, 59, 0.8)";
	ctx.roundRect(50, 205, 800, 185, 12);
	ctx.fill();
	ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
	ctx.stroke();

	// Formatage du texte du message (Retour à la ligne automatique)
	ctx.fillStyle = "#F1F5F9";
	ctx.font = "20px 'Segoe UI', sans-serif";
	
	const maxLineWidth = 760;
	const words = content.split(' ');
	let line = '';
	let lineY = 245;

	for (let n = 0; n < words.length; n++) {
		let testLine = line + words[n] + ' ';
		let metrics = ctx.measureText(testLine);
		if (metrics.width > maxLineWidth && n > 0) {
			ctx.fillText(line, 70, lineY);
			line = words[n] + ' ';
			lineY += 32;
			if (lineY > 365) {
				ctx.fillText("...", 70, lineY);
				break;
			}
		} else {
			line = testLine;
		}
	}
	if (lineY <= 365) {
		ctx.fillText(line, 70, lineY);
	}

	// Sauvegarde de l'image
	const cacheDir = path.join(__dirname, "cache");
	fs.ensureDirSync(cacheDir);
	const cachePath = path.join(cacheDir, `callad_${Date.now()}.png`);
	fs.writeFileSync(cachePath, canvas.toBuffer("image/png"));

	return cachePath;
	}
							  
