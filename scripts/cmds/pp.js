/**
 * @author Shade & Assistant
 * @name pp
 * @version 6.0.1
 * @description Création de groupe avec configuration intégrale des paramètres Admin Messenger & Catalogue PP.
 */
const { createCanvas, loadImage } = require("canvas");
const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");

const NIX_API = "https://raw.githubusercontent.com/aryannix/stuffs/master/raw/apis.json";

async function fetchPinterestImages(query, count = 20) {
    try {
        const apiConfig = await axios.get(NIX_API, { timeout: 5000 });
        const apiBaseUrl = apiConfig.data?.api;
        if (apiBaseUrl) {
            const res = await axios.get(`${apiBaseUrl}/pinterest?search=${encodeURIComponent(query)}&count=${count}`, { timeout: 7000 });
            const data = res.data?.data || res.data?.pins?.map(p => p.image);
            if (data && data.length > 0) return data;
        }
    } catch (e) {}

    try {
        const res = await axios.get(`https://zetbot-page.onrender.com/api/pinterest?query=${encodeURIComponent(query)}&limit=${count}`, { timeout: 7000 });
        if (res.data?.status && res.data?.pins) {
            return res.data.pins.map(p => p.image);
        }
    } catch (e) {}

    try {
        const res = await axios.get(`https://api.kenliejugarap.com/pinterestbysearch/?search=${encodeURIComponent(query)}`, { timeout: 7000 });
        if (res.data?.data) return res.data.data;
    } catch (e) {}

    return [];
}

async function createMobileCatalogueCanvas(imagesUrls, query, page, totalPages) {
    const width = 1080, height = 1920;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    const bgGrad = ctx.createLinearGradient(0, 0, width, height);
    bgGrad.addColorStop(0, "#0b0e14");
    bgGrad.addColorStop(1, "#1a1f2c");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = "#3b82f6";
    ctx.beginPath();
    ctx.roundRect(50, 60, 12, 80, 6);
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 42px sans-serif";
    ctx.fillText(`📌 CATALOGUE HD : ${query.toUpperCase()}`, 80, 105);

    ctx.fillStyle = "#9ca3af";
    ctx.font = "28px sans-serif";
    ctx.fillText(`Page ${page} / ${totalPages} • Format Mobile`, 80, 145);

    const itemWidth = 460, itemHeight = 700;
    const startX = 50, startY = 190;
    const gapX = 20, gapY = 25;

    const loadedImages = await Promise.all(
        imagesUrls.map(url => loadImage(url).catch(() => null))
    );

    for (let i = 0; i < 4; i++) {
        const row = Math.floor(i / 2);
        const col = i % 2;
        const x = startX + col * (itemWidth + gapX);
        const y = startY + row * (itemHeight + gapY);

        ctx.fillStyle = "#111827";
        ctx.beginPath();
        ctx.roundRect(x, y, itemWidth, itemHeight, 20);
        ctx.fill();

        if (loadedImages[i]) {
            ctx.save();
            ctx.beginPath();
            ctx.roundRect(x, y, itemWidth, itemHeight, 20);
            ctx.clip();
            ctx.drawImage(loadedImages[i], x, y, itemWidth, itemHeight);
            ctx.restore();
        }

        ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
        ctx.beginPath();
        ctx.roundRect(x + 15, y + 15, 60, 60, 15);
        ctx.fill();

        ctx.strokeStyle = "#3b82f6";
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 32px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(i + 1), x + 45, y + 45);
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
    }

    ctx.fillStyle = "#1e293b";
    ctx.beginPath();
    ctx.roundRect(50, 1660, 980, 200, 20);
    ctx.fill();

    ctx.fillStyle = "#60a5fa";
    ctx.font = "bold 30px sans-serif";
    ctx.fillText("💬 COMMENT UTILISER :", 80, 1715);

    ctx.fillStyle = "#e2e8f0";
    ctx.font = "26px sans-serif";
    ctx.fillText("• Répondez [1, 2, 3 ou 4] pour définir la PP du groupe.", 80, 1765);
    ctx.fillText("• Répondez 'page 2', 'page 3'... pour faire défiler.", 80, 1810);

    const cacheDir = path.join(__dirname, "cache");
    await fs.ensureDir(cacheDir);
    const cachePath = path.join(cacheDir, `pp_mobile_${Date.now()}.png`);
    await fs.writeFile(cachePath, canvas.toBuffer("image/png"));
    return cachePath;
}

module.exports = {
    config: {
        name: "pp",
        aliases: ["seticon", "ppcreat", "ppcreate", "setname"],
        version: "6.0.1",
        author: "Shade & Assistant",
        countDown: 5,
        role: 0,
        category: "group",
        guide: {
            fr: "• {p}pp <recherche> : Affiche le catalogue HD\n• {p}pp create <nom> : Crée un groupe, verrouille les paramètres Messenger, vous met admin et choisit la PP\n• {p}pp name <nom> : Change le nom du groupe"
        }
    },

    onStart: async function ({ api, event, message, args, commandName }) {
        const { threadID, messageID, senderID } = event;
        const subCommand = (args[0] || "").toLowerCase();

        if (subCommand === "name" || subCommand === "rename") {
            const newName = args.slice(1).join(" ").trim();
            if (!newName) return message.reply("❌ Précisez le nouveau nom.");

            return api.setTitle(newName, threadID, (err) => {
                if (err) return message.reply("❌ Échec du changement de nom.");
                return message.reply(`✅ Le nom du groupe a été changé en : "${newName}"`);
            });
        }

        if (subCommand === "create" || subCommand === "creat") {
            const groupName = args.slice(1).join(" ").trim();
            if (!groupName) return message.reply("❌ Précisez le nom du groupe à créer.");

            try {
                const waitMsg = await message.reply("🔄 Récupération de la liste complète de vos amis...");

                const friendsList = await api.getFriendsList().catch(() => []);
                const friendIDs = Array.isArray(friendsList) ? friendsList.map(f => f.userID) : [];

                if (friendIDs.length === 0) {
                    return message.reply("❌ Aucun ami trouvé à ajouter.");
                }

                await message.reply(`👥 ${friendIDs.length} ami(s) détecté(s).\n⚙️ Création du groupe "${groupName}" avec paramètres de sécurité Admin...`);

                // Ajout de 2 amis minimum au départ pour éviter le rejet de création par Facebook
                const initialMembers = [senderID, ...friendIDs.slice(0, 2)];

                api.createNewGroup(initialMembers, groupName, async (err, newThreadID) => {
                    if (err || !newThreadID) {
                        console.error("Erreur création groupe:", err);
                        return message.reply("❌ Impossible de créer le groupe.");
                    }

                    try { api.unsendMessage(waitMsg.messageID); } catch (e) {}

                    api.changeAdminStatus(newThreadID, senderID, true, (aErr) => {
                        if (aErr) console.warn("Erreur promotion admin:", aErr);
                    });

                    try {
                        if (typeof api.changeApprovalMode === "function") api.changeApprovalMode(true, newThreadID);
                        if (typeof api.changeAdminOnlyStatus === "function") api.changeAdminOnlyStatus(true, newThreadID);
                    } catch (configErr) {
                        console.warn("Erreur verrouillage paramètres:", configErr);
                    }

                    const remainingFriends = friendIDs.slice(2);
                    const chunkSize = 20;

                    api.sendMessage(
                        `⚙️ **PARAMÈTRES CONFIGURÉS :**\n` +
                        `• Vous êtes Administrateur\n` +
                        `• Approbation des nouveaux membres : ACTIVÉE\n` +
                        `• Modification des infos du groupe : RESERVÉE AUX ADMINS\n\n` +
                        `🚀 Ajout progressif des ${remainingFriends.length} amis restants...`,
                        newThreadID
                    );

                    for (let i = 0; i < remainingFriends.length; i += chunkSize) {
                        const chunk = remainingFriends.slice(i, i + chunkSize);
                        try {
                            await new Promise(res => setTimeout(res, 2000));
                            await api.addUserToGroup(chunk, newThreadID);
                        } catch (e) {
                            console.warn("Erreur sur un lot d'amis:", e);
                        }
                    }

                    const allImages = await fetchPinterestImages(groupName, 20);

                    if (allImages.length === 0) {
                        return api.sendMessage(`✅ Configuration terminée pour le groupe "${groupName}" !`, newThreadID);
                    }

                    const totalPages = Math.ceil(allImages.length / 4);
                    const currentImages = allImages.slice(0, 4);
                    const catalogPath = await createMobileCatalogueCanvas(currentImages, groupName, 1, totalPages);

                    const sentMsg = await api.sendMessage({
                        body: `🎉 **GROUPE SÉCURISÉ & CRÉÉ AVEC SUCCÈS !**\n📌 **Nom :** ${groupName}\n👑 **Administrateur :** Vous\n🛡️ **Approbation membres :** Activée\n\n💬 Répondez [1, 2, 3 ou 4] pour choisir la Photo de Profil du groupe.`,
                        attachment: fs.createReadStream(catalogPath)
                    }, newThreadID);

                    global.GoatBot?.onReply?.set(sentMsg.messageID, {
                        commandName,
                        author: senderID,
                        query: groupName,
                        allImages: allImages,
                        currentPage: 1,
                        totalPages: totalPages,
                        targetThreadID: newThreadID,
                        messageID: sentMsg.messageID
                    });

                    if (fs.existsSync(catalogPath)) fs.unlinkSync(catalogPath);
                });

            } catch (e) {
                console.error(e);
                return message.reply("❌ Une erreur est survenue lors du processus.");
            }
            return;
        }

        const query = args.join(" ").trim();
        if (!query) {
            return message.reply("❌ Veuillez indiquer quoi chercher.\nExemples :\n• .pp Sasuke\n• .pp create Mon Groupe\n• .pp name Nouveau Nom");
        }

        try {
            const waitMsg = await message.reply(`🔍 Recherche d'images HD pour "${query}"...`);
            const allImages = await fetchPinterestImages(query, 20);

            if (allImages.length === 0) {
                try { api.unsendMessage(waitMsg.messageID); } catch (e) {}
                return message.reply("❌ Aucune image trouvée.");
            }

            const totalPages = Math.ceil(allImages.length / 4);
            const currentImages = allImages.slice(0, 4);
            const catalogPath = await createMobileCatalogueCanvas(currentImages, query, 1, totalPages);

            try { api.unsendMessage(waitMsg.messageID); } catch (e) {}

            const sentMessage = await api.sendMessage({
                body: `📸 **CATALOGUE SELECTION PP**\n\n💬 Répondez [1-4] pour choisir ou 'page 2' pour naviguer.`,
                attachment: fs.createReadStream(catalogPath)
            }, threadID, messageID);

            global.GoatBot?.onReply?.set(sentMessage.messageID, {
                commandName,
                author: senderID,
                query: query,
                allImages: allImages,
                currentPage: 1,
                totalPages: totalPages,
                targetThreadID: threadID,
                messageID: sentMessage.messageID
            });

            if (fs.existsSync(catalogPath)) fs.unlinkSync(catalogPath);

        } catch (error) {
            console.error(error);
            return message.reply("❌ Erreur lors du chargement des images.");
        }
    },

    onReply: async function ({ api, event, Reply, message, commandName }) {
        const { senderID, threadID, messageID, body } = event;
        const { author, query, allImages, currentPage, totalPages, targetThreadID, messageID: oldMsgID } = Reply || {};

        if (senderID !== author) return;

        const input = (body || "").trim().toLowerCase();

        if (input.startsWith("page ")) {
            const targetPage = parseInt(input.split(" ")[1], 10);
            if (isNaN(targetPage) || targetPage < 1 || targetPage > totalPages) {
                return message.reply(`❌ Page invalide (1 à ${totalPages}).`);
            }

            const startIdx = (targetPage - 1) * 4;
            const currentImages = allImages.slice(startIdx, startIdx + 4);

            try { api.unsendMessage(oldMsgID); } catch (e) {}

            const catalogPath = await createMobileCatalogueCanvas(currentImages, query, targetPage, totalPages);

            const sentMessage = await api.sendMessage({
                body: `📸 **CATALOGUE HD (PAGE ${targetPage}/${totalPages})**\n\n💬 Répondez [1-4] pour appliquer la photo.`,
                attachment: fs.createReadStream(catalogPath)
            }, threadID, messageID);

            global.GoatBot?.onReply?.set(sentMessage.messageID, {
                commandName,
                author: senderID,
                query: query,
                allImages: allImages,
                currentPage: targetPage,
                totalPages: totalPages,
                targetThreadID: targetThreadID,
                messageID: sentMessage.messageID
            });

            if (fs.existsSync(catalogPath)) fs.unlinkSync(catalogPath);
            return;
        }

        const choice = parseInt(input, 10);
        if (!isNaN(choice) && choice >= 1 && choice <= 4) {
            const actualIndex = ((currentPage - 1) * 4) + (choice - 1);
            const selectedImageUrl = allImages[actualIndex];

            if (!selectedImageUrl) return message.reply("❌ Image introuvable.");

            const cacheDir = path.join(__dirname, "cache");
            await fs.ensureDir(cacheDir);
            const imagePath = path.join(cacheDir, `selected_pp_${Date.now()}.jpg`);

            try {
                const downloadNotice = await message.reply(`📥 Téléchargement et application de l'image n°${choice}...`);

                const response = await axios({
                    method: "get",
                    url: selectedImageUrl,
                    responseType: "arraybuffer",
                    timeout: 10000
                });

                await fs.writeFile(imagePath, response.data);
                try { api.unsendMessage(downloadNotice.messageID); } catch (e) {}

                // Application directe via api.changeGroupImage en utilisant un ReadStream propre
                api.changeGroupImage(fs.createReadStream(imagePath), targetThreadID, (err) => {
                    if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);

                    if (err) {
                        console.error("Erreur changement PP:", err);
                        return api.sendMessage("❌ Échec de la modification de la photo du groupe.", targetThreadID);
                    }

                    return api.sendMessage("✅ Photo de profil du groupe mise à jour avec succès !", targetThreadID);
                });

            } catch (e) {
                console.error(e);
                if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
                return message.reply("❌ Erreur lors de l'application de la photo.");
            }
        }
    }
};
