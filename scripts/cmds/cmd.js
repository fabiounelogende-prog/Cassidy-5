const axios = require("axios");
const { execSync } = require("child_process");
const fs = require("fs-extra");
const path = require("path");
const cheerio = require("cheerio");

const { configCommands } = global.GoatBot;
const { log } = global.utils;

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

module.exports = {
	config: {
		name: "cmd",
		version: "2.7.0",
		author: "NTKhang x Célestin 🔥",
		countDown: 5,
		role: 2,
		usePrefix: false,
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
			loaded: "✅ | Commande \"%1\" rechargée avec succès !",
			loadedError: "❌ | Échec du chargement de \"%1\"\n%2: %3",
			loadedSuccess: "✅ | Chargement réussi de (%1) commandes !",
			loadedFail: "❌ | Échec pour (%1) commandes\n%2",
			openConsoleToSeeError: "👀 | Ouvrez la console pour plus de détails",
			missingCommandNameUnload: "⚠️ | Veuillez entrer le nom de la commande à décharger",
			unloaded: "✅ | Commande \"%1\" déchargée avec succès !",
			unloadedError: "❌ | Échec du déchargement de \"%1\"\n%2: %3",
			missingUrlCodeOrFileName: "⚠️ | Veuillez entrer l'URL/code et le nom du fichier à installer",
			missingFileNameInstall: "⚠️ | Veuillez entrer le nom du fichier final (ex: aide.js)",
			invalidUrl: "⚠️ | Veuillez entrer une URL valide",
			invalidUrlOrCode: "⚠️ | Impossible de récupérer le code source",
			alreadExist: "⚠️ | Le fichier existe déjà. Réagissez avec un emoji à ce message pour l'écraser.",
			installed: "✅ | Commande \"%1\" installée ! Enregistrée dans %2",
			installedError: "❌ | Échec de l'installation de \"%1\"\n%2: %3"
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
			missingFileNameInstall: "⚠️ | Please enter the file name to save the command (with .js extension)",
			invalidUrl: "⚠️ | Please enter a valid url",
			invalidUrlOrCode: "⚠️ | Unable to get command code",
			alreadExist: "⚠️ | The command file already exists, react to this message to overwrite it.",
			installed: "✅ | Installed command \"%1\" successfully, saved at %2",
			installedError: "❌ | Failed to install command \"%1\" with error\n%2: %3"
		}
	},

	onStart: async ({ args, message, api, threadModel, userModel, dashBoardModel, globalModel, threadsData, usersData, dashBoardData, globalData, event, commandName, getLang }) => {
		
		// ------------------------------------------
		// 1. RECHARGER UNE COMMANDE SPÉCIFIQUE
		// ------------------------------------------
		if (args[0] == "load" && args.length == 2) {
			if (!args[1]) return message.reply(getLang("missingFileName"));
			const infoLoad = loadScripts("cmds", args[1], log, configCommands, api, threadModel, userModel, dashBoardModel, globalModel, threadsData, usersData, dashBoardData, globalData, getLang);
			
			if (infoLoad.status == "success") {
				return message.reply(getLang("loaded", infoLoad.name));
			} else {
				return message.reply(getLang("loadedError", infoLoad.name, infoLoad.error.name, infoLoad.error.message) + "\n\n" + infoLoad.error.stack);
			}
		}
		
		// ------------------------------------------
		// 2. RECHARGER TOUTES LES COMMANDES
		// ------------------------------------------
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
			if (arraySucces.length > 0) msg += getLang("loadedSuccess", arraySucces.length);
			if (arrayFail.length > 0) {
				msg += (msg ? "\n\n" : "") + getLang("loadedFail", arrayFail.length, arrayFail.join("\n")) + "\n" + getLang("openConsoleToSeeError");
			}

			return message.reply(msg);
		}
		
		// ------------------------------------------
		// 3. DÉCHARGER UNE COMMANDE
		// ------------------------------------------
		else if (args[0] == "unload") {
			if (!args[1]) return message.reply(getLang("missingCommandNameUnload"));
			const infoUnload = unloadScripts("cmds", args[1], configCommands, getLang);
			
			if (infoUnload.status == "success") {
				return message.reply(getLang("unloaded", infoUnload.name));
			} else {
				return message.reply(getLang("unloadedError", infoUnload.name, infoUnload.error.name, infoUnload.error.message));
			}
		}
		
		// ------------------------------------------
		// 4. INSTALLER UNE COMMANDE (URL / RAW CODE)
		// ------------------------------------------
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
					return message.reply(getLang("installed", infoLoad.name, path.join(__dirname, fileName).replace(process.cwd(), "")));
				} else {
					return message.reply(getLang("installedError", infoLoad.name, infoLoad.error.name, infoLoad.error.message));
				}
			}
		}
		else message.SyntaxError();
	},

	onReaction: async function ({ Reaction, message, event, api, threadModel, userModel, dashBoardModel, globalModel, threadsData, usersData, dashBoardData, globalData, getLang }) {
		const { author, data: { fileName, rawCode } } = Reaction;
		if (event.userID != author) return;

		const infoLoad = loadScripts("cmds", fileName, log, configCommands, api, threadModel, userModel, dashBoardModel, globalModel, threadsData, usersData, dashBoardData, globalData, getLang, rawCode);
		
		if (infoLoad.status == "success") {
			return message.reply(getLang("installed", infoLoad.name, path.join(__dirname, fileName).replace(process.cwd(), "")));
		} else {
			return message.reply(getLang("installedError", infoLoad.name, infoLoad.error.name, infoLoad.error.message));
		}
	}
};

// ==========================================================
// ⚙️ FONCTIONS SYSTÈME DE CHARGEMENT & DÉCHARGEMENT
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
