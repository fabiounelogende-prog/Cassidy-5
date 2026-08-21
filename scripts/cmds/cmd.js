const { createCanvas, loadImage } = require('@napi-rs/canvas');
const axios = require("axios");
const { execSync } = require("child_process");
const fs = require("fs-extra");
const path = require("path");
const cheerio = require("cheerio");

const { configCommands } = global.GoatBot;
const { log, loading, removeHomeDir } = global.utils;

function getDomain(url) {
	const regex = /^(?:https?:\/\/)?(?:[^@\n]+@)?(?:www\.)?([^:/\n]+)/im;
	const match = url.match(regex);
	return match ? match[1] : null;
}

function isURL(str) {
	try {
		new URL(str);
		return true;
	} catch (e) {
		return false;
	}
}

function truncateText(ctx, text, maxWidth) {
	if (ctx.measureText(text).width <= maxWidth) return text;
	while (ctx.measureText(text + '...').width > maxWidth && text.length > 0) {
		text = text.slice(0, -1);
	}
	return text + '...';
}

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

// ==========================================
// 🎨 ENGINE CANVAS POUR BADGES TERMINAL/CMD
// ==========================================
async function generateCmdCanvas(userId, userName, actionTitle, statusText, detailsText, themeColor) {
	const width = 900;
	const height = 450;
	const canvas = createCanvas(width, height);
	const ctx = canvas.getContext('2d');

	// Fond style terminal cyberpunk sombre
	let gradient = ctx.createLinearGradient(0, 0, width, height);
	gradient.addColorStop(0, '#0a0a12');
	gradient.addColorStop(0.5, '#111122');
	gradient.addColorStop(1, '#0a0a12');
	ctx.fillStyle = gradient;
	ctx.fillRect(0, 0, width, height);

	// Grille en arrière-plan style matrice technique
	ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
	ctx.lineWidth = 1;
	for (let i = 0; i < width; i += 40) {
		ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, height); ctx.stroke();
	}
	for (let j = 0; j < height; j += 40) {
		ctx.beginPath(); ctx.moveTo(0, j); ctx.lineTo(width, j); ctx.stroke();
	}

	// Cadres doubles stylisés
	ctx.strokeStyle = themeColor;
	ctx.lineWidth = 4;
	drawRoundedRect(ctx, 25, 25, 850, 400, 12);
	ctx.stroke();

	ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
	ctx.lineWidth = 1;
	drawRoundedRect(ctx, 32, 32, 836, 386, 8);
	ctx.stroke();

	// Décorations graphiques
	ctx.fillStyle = themeColor;
	ctx.font = 'bold 16px sans-serif';
	ctx.textAlign = 'left';
	ctx.fillText("✧ ▬▭▬ ▬▬ ✦ ▬▬ ▬▭▬ ✧", 400, 65);
	ctx.fillText("✧ ▬▭▬ ▬▬ ✦ ▬▬ ▬▭▬ ✧", 400, 395);

	// Photo de profil
	const avatarX = 190;
	const avatarY = 225;
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
		ctx.fillStyle = '#1a1a2e';
		ctx.fillRect(avatarX - avatarRadius, avatarY - avatarRadius, avatarRadius * 2, avatarRadius * 2);
		ctx.fillStyle = themeColor;
		ctx.font = 'bold 60px sans-serif';
		ctx.textAlign = 'center';
		ctx.fillText(userName.charAt(0).toUpperCase() || '👤', avatarX, avatarY + 20);
	}
	ctx.restore();

	// Anneau lumineux
	ctx.strokeStyle = themeColor;
	ctx.lineWidth = 6;
	ctx.beginPath();
	ctx.arc(avatarX, avatarY, avatarRadius + 2, 0, Math.PI * 2);
	ctx.stroke();

	// Textes du statut système
	ctx.textAlign = 'left';
	ctx.fillStyle = themeColor;
	ctx.font = 'bold 36px sans-serif';
	ctx.fillText(actionTitle, 400, 125);

	ctx.fillStyle = '#FFFFFF';
	ctx.font = 'bold 24px sans-serif';
	ctx.fillText(`⚙️ OPÉRATEUR : ${truncateText(ctx, userName, 420)}`, 400, 185);

	ctx.fillStyle = '#FFFFFF';
	ctx.font = '22px sans-serif';
	ctx.fillText(truncateText(ctx, statusText, 420), 400, 245);

	ctx.fillStyle = '#888888';
	ctx.font = 'italic 16px sans-serif';
	ctx.fillText(truncateText(ctx, detailsText, 430), 400, 305);

	ctx.fillStyle = themeColor;
	ctx.font = 'bold 16px sans-serif';
	ctx.fillText("»» SYSTEM KERNEL ONLINE ««", 400, 355);

	const tmpDir = path.join(__dirname, "cache");
	await fs.ensureDir(tmpDir);
	const imagePath = path.join(tmpDir, `cmd_${Date.now()}_${userId}.png`);
	await fs.outputFile(imagePath, canvas.toBuffer('image/png'));
	return imagePath;
}

module.exports = {
	config: {
		name: "cmd",
		version: "2.6.0",
		author: "NTKhang x Célestin 🔥",
		countDown: 5,
		role: 2,
		usePrefix: false, // MODE SANS PRÉFIXE ACTIVÉ
		description: {
			vi: "Quản lý các tệp lệnh của bạn",
			en: "Manage your command files"
		},
		category: "owner",
		guide: {
			en: "   {pn} load <command file name>" + "\n   {pn} loadAll" + "\n   {pn} unload <command file name>" + "\n   {pn} install <url> <command file name>"
		}
	},

	langs: {
		fr: {
			missingFileName: "⚠️ | Veuillez entrer le nom du fichier de commande à recharger",
			loaded: "✅ | Commande \"%1\" chargée avec succès !",
			loadedError: "❌ | Échec du chargement de \"%1\"\n%2: %3",
			loadedSuccess: "✅ | Chargement réussi de (%1) commandes !",
			loadedFail: "❌ | Échec pour (%1) commandes\n%2",
			openConsoleToSeeError: "👀 | Ouvrez la console pour plus de détails",
			missingCommandNameUnload: "⚠️ | Veuillez entrer le nom de la commande à décharger",
			unloaded: "✅ | Commande \"%1\" déchargée avec succès !",
			unloadedError: "❌ | Échec du déchargement de \"%1\" avec l'erreur\n%2: %3",
			missingUrlCodeOrFileName: "⚠️ | Veuillez entrer l'URL/code et le nom du fichier à installer",
			missingUrlOrCode: "⚠️ | Veuillez entrer l'URL ou le code du fichier",
			missingFileNameInstall: "⚠️ | Veuillez entrer le nom du fichier final (ex: aide.js)",
			invalidUrl: "⚠️ | Veuillez entrer une URL valide",
			invalidUrlOrCode: "⚠️ | Impossible de récupérer le code source",
			alreadExist: "⚠️ | Le fichier existe déjà. Voulez-vous l'écraser ? Réagissez avec un emoji pour confirmer.",
			installed: "✅ | Commande \"%1\" installée ! Enregistrée dans %2",
			installedError: "❌ | Échec de l'installation de \"%1\"\n%2: %3",
			missingFile: "⚠️ | Fichier de commande \"%1\" introuvable",
			invalidFileName: "⚠️ | Nom de fichier invalide",
			unloadedFile: "✅ | Commande \"%1\" déchargée"
		},
		en: {
			missingFileName: "⚠️ | Please enter the command name you want to reload",
			loaded: "✅ | Loaded command \"%1\" successfully",
			loadedError: "❌ | Failed to load command \"%1\" with error\n%2: %3",
			loadedSuccess: "✅ | Loaded successfully (%1) command",
			loadedFail: "❌ | Failed to load (%1) command\n%2",
			openConsoleToSeeError: "👀 | Open console to see error details",
			missingCommandNameUnload: "⚠️ | Please enter the command name you want to unload",
			unloaded: "✅ | Unloaded command \"%1\" successfully",
			unloadedError: "❌ | Failed to unload command \"%1\" with error\n%2: %3",
			missingUrlCodeOrFileName: "⚠️ | Please enter the url or code and command file name you want to install",
			missingUrlOrCode: "⚠️ | Please enter the url or code of the command file you want to install",
			missingFileNameInstall: "⚠️ | Please enter the file name to save the command (with .js extension)",
			invalidUrl: "⚠️ | Please enter a valid url",
			invalidUrlOrCode: "⚠️ | Unable to get command code",
			alreadExist: "⚠️ | The command file already exists, are you sure you want to overwrite the old command file?\nReact to this message to continue",
			installed: "✅ | Installed command \"%1\" successfully, the command file is saved at %2",
			installedError: "❌ | Failed to install command \"%1\" with error\n%2: %3",
			missingFile: "⚠️ | Command file \"%1\" not found",
			invalidFileName: "⚠️ | Invalid command file name",
			unloadedFile: "✅ | Unloaded command \"%1\""
		}
	},

	onStart: async ({ args, message, api, threadModel, userModel, dashBoardModel, globalModel, threadsData, usersData, dashBoardData, globalData, event, commandName, getLang }) => {
		const senderID = event.senderID;
		let senderName = "Opérateur";
		try {
			senderName = await usersData.getName(senderID);
		} catch (e) {}

		// ==========================================
		// CASE 1 : LOAD SINGLE SCRIPT
		// ==========================================
		if (args[0] == "load" && args.length == 2) {
			if (!args[1]) return message.reply(getLang("missingFileName"));
			const infoLoad = loadScripts("cmds", args[1], log, configCommands, api, threadModel, userModel, dashBoardModel, globalModel, threadsData, usersData, dashBoardData, globalData, getLang);
			
			if (infoLoad.status == "success") {
				const imagePath = await generateCmdCanvas(senderID, senderName, "⚡ SYSTEM RELOAD", `✓ Cmd [${infoLoad.name}] active`, `Path: /scripts/cmds/${infoLoad.name}.js`, "#00f5d4");
				message.reply({ body: getLang("loaded", infoLoad.name), attachment: fs.createReadStream(imagePath) }, () => {
					if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
				});
			} else {
				const imagePath = await generateCmdCanvas(senderID, senderName, "❌ RELOAD FAILED", `× Error in [${infoLoad.name}]`, infoLoad.error.message, "#f72585");
				message.reply({ body: getLang("loadedError", infoLoad.name, infoLoad.error.name, infoLoad.error.message) + "\n" + infoLoad.error.stack, attachment: fs.createReadStream(imagePath) }, () => {
					if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
				});
			}
		}
		
		// ==========================================
		// CASE 2 : LOAD ALL SCRIPTS
		// ==========================================
		else if ((args[0] || "").toLowerCase() == "loadall" || (args[0] == "load" && args.length > 2)) {
			const fileNeedToLoad = args[0].toLowerCase() == "loadall" ?
				fs.readdirSync(__dirname).filter(file => file.endsWith(".js") && !file.match(/(eg)\.js$/g) && (process.env.NODE_ENV == "development" ? true : !file.match(/(dev)\.js$/g)) && !configCommands.commandUnload?.includes(file)).map(item => item.split(".")[0]) :
				args.slice(1);
			
			const arraySucces = [];
			const arrayFail = [];

			for (const fileName of fileNeedToLoad) {
				const infoLoad = loadScripts("cmds", fileName, log, configCommands, api, threadModel, userModel, dashBoardModel, globalModel, threadsData, usersData, dashBoardData, globalData, getLang);
				if (infoLoad.status == "success") arraySucces.push(fileName);
				else arrayFail.push(` ❗ ${fileName} => ${infoLoad.error.name}: ${infoLoad.error.message}`);
			}

			let msg = "";
			let themeColor = "#00f5d4";
			if (arraySucces.length > 0) msg += getLang("loadedSuccess", arraySucces.length);
			if (arrayFail.length > 0) {
				msg += (msg ? "\n" : "") + getLang("loadedFail", arrayFail.length, arrayFail.join("\n")) + "\n" + getLang("openConsoleToSeeError");
				themeColor = "#f72585";
			}

			const imagePath = await generateCmdCanvas(senderID, senderName, "🔮 GLOBAL CORE LOAD", `Success: ${arraySucces.length} | Fails: ${arrayFail.length}`, "Full stack operations re-loaded", themeColor);
			message.reply({ body: msg, attachment: fs.createReadStream(imagePath) }, () => {
				if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
			});
		}
		
		// ==========================================
		// CASE 3 : UNLOAD SCRIPT
		// ==========================================
		else if (args[0] == "unload") {
			if (!args[1]) return message.reply(getLang("missingCommandNameUnload"));
			const infoUnload = unloadScripts("cmds", args[1], configCommands, getLang);
			
			if (infoUnload.status == "success") {
				const imagePath = await generateCmdCanvas(senderID, senderName, "📦 KERNEL UNLOAD", `✕ [${infoUnload.name}] disabled`, "Module cut off from memory stream", "#ffb703");
				message.reply({ body: getLang("unloaded", infoUnload.name), attachment: fs.createReadStream(imagePath) }, () => {
					if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
				});
			} else {
				const imagePath = await generateCmdCanvas(senderID, senderName, "❌ UNLOAD ERROR", "Execution block failed", infoUnload.error.message, "#f72585");
				message.reply({ body: getLang("unloadedError", infoUnload.name, infoUnload.error.name, infoUnload.error.message), attachment: fs.createReadStream(imagePath) }, () => {
					if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
				});
			}
		}
		
		// ==========================================
		// CASE 4 : INSTALL SCRIPT (URL / RAW CODE)
		// ==========================================
		else if (args[0] == "install") {
			let url = args[1];
			let fileName = args[2];
			let rawCode;

			if (!url || !fileName) return message.reply(getLang("missingUrlCodeOrFileName"));
			if (url.endsWith(".js") && !isURL(url)) {
				const tmp = fileName; fileName = url; url = tmp;
			}

			if (url.match(/(https?:\/\/(?:www\.|(?!www)))/)) {
				if (!fileName || !fileName.endsWith(".js")) return message.reply(getLang("missingFileNameInstall"));
				const domain = getDomain(url);
				if (!domain) return message.reply(getLang("invalidUrl"));

				if (domain == "pastebin.com") {
					const regex = /https:\/\/pastebin\.com\/(?!raw\/)(.*)/;
					if (url.match(regex)) url = url.replace(regex, "https://pastebin.com/raw/$1");
					if (url.endsWith("/")) url = url.slice(0, -1);
				}
				else if (domain == "github.com") {
					const regex = /https:\/\/github\.com\/(.*)\/blob\/(.*)/;
					if (url.match(regex)) url = url.replace(regex, "https://raw.githubusercontent.com/$1/$2");
				}

				rawCode = (await axios.get(url)).data;
				if (domain == "savetext.net") {
					const $ = cheerio.load(rawCode);
					rawCode = $("#content").text();
				}
			}
			else {
				if (args[args.length - 1].endsWith(".js")) {
					fileName = args[args.length - 1];
					rawCode = event.body.slice(event.body.indexOf('install') + 7, event.body.indexOf(fileName) - 1);
				}
				else if (args[1].endsWith(".js")) {
					fileName = args[1];
					rawCode = event.body.slice(event.body.indexOf(fileName) + fileName.length + 1);
				}
				else return message.reply(getLang("missingFileNameInstall"));
			}

			if (!rawCode) return message.reply(getLang("invalidUrlOrCode"));

			if (fs.existsSync(path.join(__dirname, fileName))) {
				return message.reply(getLang("alreadExist"), (err, info) => {
					global.GoatBot.onReaction.set(info.messageID, {
						commandName, messageID: info.messageID, type: "install", author: event.senderID, data: { fileName, rawCode }
					});
				});
			} else {
				const infoLoad = loadScripts("cmds", fileName, log, configCommands, api, threadModel, userModel, dashBoardModel, globalModel, threadsData, usersData, dashBoardData, globalData, getLang, rawCode);
				if (infoLoad.status == "success") {
					const imagePath = await generateCmdCanvas(senderID, senderName, "📥 NET INSTALLATION", `✓ Setup [${infoLoad.name}] Done`, `Saved locally into system cluster`, "#72efdd");
					message.reply({ body: getLang("installed", infoLoad.name, path.join(__dirname, fileName).replace(process.cwd(), "")), attachment: fs.createReadStream(imagePath) }, () => {
						if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
					});
				} else {
					const imagePath = await generateCmdCanvas(senderID, senderName, "❌ INSTALL ERROR", "Compilation process crashed", infoLoad.error.message, "#f72585");
					message.reply({ body: getLang("installedError", infoLoad.name, infoLoad.error.name, infoLoad.error.message), attachment: fs.createReadStream(imagePath) }, () => {
						if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
					});
				}
			}
		}
		else message.SyntaxError();
	},

	onReaction: async function ({ Reaction, message, event, api, threadModel, userModel, dashBoardModel, globalModel, threadsData, usersData, dashBoardData, globalData, getLang }) {
		const { author, data: { fileName, rawCode } } = Reaction;
		if (event.userID != author) return;
		
		let senderName = "Opérateur";
		try {
			senderName = await usersData.getName(author);
		} catch (e) {}

		const infoLoad = loadScripts("cmds", fileName, log, configCommands, api, threadModel, userModel, dashBoardModel, globalModel, threadsData, usersData, dashBoardData, globalData, getLang, rawCode);
		
		if (infoLoad.status == "success") {
			const imagePath = await generateCmdCanvas(author, senderName, "📝 OVERWRITE SUCCESS", `✓ Overwrote [${infoLoad.name}]`, "Old memory fragments deleted", "#72efdd");
			message.reply({ body: getLang("installed", infoLoad.name, path.join(__dirname, fileName).replace(process.cwd(), "")), attachment: fs.createReadStream(imagePath) }, () => {
				if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
			});
		} else {
			const imagePath = await generateCmdCanvas(author, senderName, "❌ OVERWRITE ERROR", "Failed to force rewrite injection", infoLoad.error.message, "#f72585");
			message.reply({ body: getLang("installedError", infoLoad.name, infoLoad.error.name, infoLoad.error.message), attachment: fs.createReadStream(imagePath) }, () => {
				if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
			});
		}
	}
};

// ==========================================================
// ⚙️ FONCTIONS SYSTEME INTERNES POUR CHARGEMENT & UNLOAD
// ==========================================================
const packageAlready = [];

function loadScripts(folder, fileName, log, configCommands, api, threadModel, userModel, dashBoardModel, globalModel, threadsData, usersData, dashBoardData, globalData, getLang, rawCode) {
	try {
		if (rawCode) {
			if (fileName.endsWith(".js")) fileName = fileName.slice(0, -3);
			fs.writeFileSync(path.normalize(`${process.cwd()}/scripts/${folder}/${fileName}.js`), rawCode);
		}
		const regExpCheckPackage = /require(\s+|)\((\s+|)[`'"]([^`'"]+)[`'"]/g;
		const { GoatBot } = global;
		let setMap = folder == "cmds" ? "commands" : "eventCommands";
		
		let pathCommand = path.normalize(process.cwd() + `/scripts/${folder}/${fileName}.js`);
		if (!fs.existsSync(pathCommand)) pathCommand = path.normalize(process.cwd() + `/scripts/${folder}/${fileName}`);

		const contentFile = fs.readFileSync(pathCommand, "utf8");
		let allPackage = contentFile.match(regExpCheckPackage);
		if (allPackage) {
			allPackage = allPackage
				.map(p => p.match(/[`'"]([^`'"]+)[`'"]/)[1])
				.filter(p => p.indexOf("/") !== 0 && p.indexOf("./") !== 0 && p.indexOf("../") !== 0 && p.indexOf(__dirname) !== 0);
			for (let packageName of allPackage) {
				if (packageName.startsWith('@')) packageName = packageName.split('/').slice(0, 2).join('/');
				else packageName = packageName.split('/')[0];

				if (!packageAlready.includes(packageName)) {
					packageAlready.push(packageName);
					if (!fs.existsSync(`${process.cwd()}/node_modules/${packageName}`)) {
						try {
							execSync(`npm install ${packageName} --save`, { stdio: "pipe" });
						} catch (error) {
							throw new Error(`Can't install package ${packageName}`);
						}
					}
				}
			}
		}

		delete require.cache[require.resolve(pathCommand)];

		const command = require(pathCommand);
		command.location = pathCommand;
		const configCommand = command.config;
		if (!configCommand || typeof configCommand != "object") throw new Error("config of command must be an object");
		const scriptName = configCommand.name;

		GoatBot[setMap].set(scriptName, command);
		return { status: "success", name: scriptName };
	} catch (error) {
		return { status: "failed", name: fileName, error };
	}
}

function unloadScripts(folder, fileName, configCommands, getLang) {
	try {
		const { GoatBot } = global;
		let setMap = folder == "cmds" ? "commands" : "eventCommands";
		
		let pathCommand = path.normalize(process.cwd() + `/scripts/${folder}/${fileName}.js`);
		if (!fs.existsSync(pathCommand)) pathCommand = path.normalize(process.cwd() + `/scripts/${folder}/${fileName}`);

		if (!fs.existsSync(pathCommand)) throw new Error(`File ${fileName} does not exist`);

		const command = require(pathCommand);
		const commandName = command.config.name;

		GoatBot[setMap].delete(commandName);
		delete require.cache[require.resolve(pathCommand)];

		return { status: "success", name: commandName };
	} catch (error) {
		return { status: "failed", name: fileName, error };
	}
}
