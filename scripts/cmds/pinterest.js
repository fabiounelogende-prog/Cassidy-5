/**
 * @author Célestin
 * @title Pinterest Catalogue Ultra-HD
 * @name pin
 * @class pinterest
 * @version 4.0.0-4HD
 * @description Recherche des images sur Pinterest sous forme de catalogue Canvas bleu & noir HD par Reply.
 * @usage pin [terme]
 * @alt pinterest
 */
const { createCanvas, loadImage } = require("canvas");
const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");

// Utilitaire pour tracer des rectangles arrondis
function drawRoundedRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + width, y, x + width, y + height, radius);
    ctx.arcTo(x + width, y + height, x, y + height, radius);
    ctx.arcTo(x, y + height, x, y, radius);
    ctx.arcTo(x, y, x + width, y, radius);
    ctx.closePath();
}

async function createCatalogueCanvas(imagesUrls, query, page) {
    // Canvas 4HD (Haute Résolution)
    const canvas = createCanvas(1200, 2400);
    const ctx = canvas.getContext("2d");

    // Palette Bleu & Noir
    const COLOR_BG_TOP = "#030712";      // Noir profond
    const COLOR_BG_BOTTOM = "#0B1528";   // Bleu nuit sombre
    const COLOR_CARD = "#111827";        // Anthracite sombre pour les cartes
    const COLOR_CARD_BORDER = "#1E293B"; // Bordure gris-bleu
    const COLOR_CYAN = "#06B6D4";        // Cyan néon
    const COLOR_BLUE = "#3B82F6";        // Bleu électrique
    const COLOR_TEXT_MAIN = "#F8FAFC";   // Blanc pur
    const COLOR_TEXT_SUB = "#94A3B8";    // Gris bleu doux

    // 1. Fond Dégradé Noir -> Bleu Nuit
    const bgGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    bgGrad.addColorStop(0, COLOR_BG_TOP);
    bgGrad.addColorStop(1, COLOR_BG_BOTTOM);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 2. En-tête (Header)
    const headX = 60, headY = 60, headW = 1080, headH = 150;
    ctx.fillStyle = COLOR_CARD;
    drawRoundedRect(ctx, headX, headY, headW, headH, 24);
    ctx.fill();

    ctx.strokeStyle = COLOR_CARD_BORDER;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Ligne décorative Cyan/Bleu
    const lineGrad = ctx.createLinearGradient(headX, 0, headX + headW, 0);
    lineGrad.addColorStop(0, COLOR_CYAN);
    lineGrad.addColorStop(1, COLOR_BLUE);
    ctx.fillStyle = lineGrad;
    drawRoundedRect(ctx, headX, headY, headW, 6, 3);
    ctx.fill();

    // Titre & Recherche
    ctx.fillStyle = COLOR_TEXT_MAIN;
    ctx.font = "bold 40px 'Segoe UI', Roboto, sans-serif";
    ctx.fillText(`📌 PINTEREST CATALOGUE`, headX + 40, headY + 65);

    ctx.fillStyle = COLOR_CYAN;
    ctx.font = "600 24px 'Segoe UI', Roboto, sans-serif";
    ctx.fillText(`Recherche : ${query.toUpperCase()}`, headX + 40, headY + 110);

    // Badge Page
    const pageText = `PAGE ${page} / 3`;
    ctx.font = "bold 20px 'Segoe UI', Roboto, sans-serif";
    const badgeW = ctx.measureText(pageText).width + 30;
    const badgeX = headX + headW - badgeW - 40;
    const badgeY = headY + 48;

    ctx.fillStyle = "#1E293B";
    drawRoundedRect(ctx, badgeX, badgeY, badgeW, 50, 14);
    ctx.fill();

    ctx.fillStyle = COLOR_CYAN;
    ctx.fillText(pageText, badgeX + 15, badgeY + 32);

    // 3. Grille d'images (2 colonnes x 5 lignes)
    const startX = 60, startY = 250;
    const itemWidth = 510, itemHeight = 380;
    const gapX = 60, gapY = 40;

    const loadedImages = await Promise.all(
        imagesUrls.map(url => loadImage(url).catch(() => null))
    );

    for (let i = 0; i < 10; i++) {
        const row = Math.floor(i / 2);
        const col = i % 2;
        const x = startX + col * (itemWidth + gapX);
        const y = startY + row * (itemHeight + gapY);

        ctx.fillStyle = COLOR_CARD;
        drawRoundedRect(ctx, x, y, itemWidth, itemHeight, 20);
        ctx.fill();

        ctx.save();
        drawRoundedRect(ctx, x, y, itemWidth, itemHeight, 20);
        ctx.clip();

        if (loadedImages[i]) {
            const img = loadedImages[i];
            const hRatio = itemWidth / img.width;
            const vRatio = itemHeight / img.height;
            const ratio = Math.max(hRatio, vRatio);
            const centerShift_x = (itemWidth - img.width * ratio) / 2;
            const centerShift_y = (itemHeight - img.height * ratio) / 2;

            ctx.drawImage(img, 0, 0, img.width, img.height, x + centerShift_x, y + centerShift_y, img.width * ratio, img.height * ratio);
        } else {
            ctx.fillStyle = "#0F172A";
            ctx.fillRect(x, y, itemWidth, itemHeight);
            ctx.fillStyle = COLOR_TEXT_SUB;
            ctx.font = "bold 22px 'Segoe UI', Roboto, sans-serif";
            ctx.textAlign = "center";
            ctx.fillText("Image indisponible", x + itemWidth / 2, y + itemHeight / 2);
            ctx.textAlign = "left";
        }
        ctx.restore();

        ctx.strokeStyle = COLOR_CARD_BORDER;
        ctx.lineWidth = 2;
        drawRoundedRect(ctx, x, y, itemWidth, itemHeight, 20);
        ctx.stroke();

        // Pastille Numéro
        const badgeSize = 50;
        const numX = x + 20;
        const numY = y + 20;

        const numGrad = ctx.createLinearGradient(numX, numY, numX + badgeSize, numY + badgeSize);
        numGrad.addColorStop(0, COLOR_CYAN);
        numGrad.addColorStop(1, COLOR_BLUE);

        ctx.fillStyle = numGrad;
        drawRoundedRect(ctx, numX, numY, badgeSize, badgeSize, 12);
        ctx.fill();

        ctx.fillStyle = "#FFFFFF";
        ctx.font = "bold 24px 'Segoe UI', Roboto, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(i + 1), numX + badgeSize / 2, numY + badgeSize / 2);
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
    }

    // 4. Pied de page
    const footY = canvas.height - 70;
    ctx.fillStyle = COLOR_TEXT_SUB;
    ctx.font = "600 22px 'Segoe UI', Roboto, sans-serif";
    ctx.fillText("💬 Répondez [1-10] pour recevoir la photo HD  •  Tapez 'page [2|3]' pour faire défiler", 60, footY);

    const cacheDir = path.join(__dirname, "cache");
    await fs.ensureDir(cacheDir);
    const cachePath = path.join(cacheDir, `pin_cat_${Date.now()}.png`);
    await fs.writeFile(cachePath, canvas.toBuffer("image/png"));
    return cachePath;
}

module.exports = {
    config: {
        name: "pin",
        aliases: ["pinterest"],
        version: "4.0.0-4HD",
        author: "Célestin",
        countDown: 5,
        role: 0,
        category: "image",
        guide: {
            fr: "{p}{n} <recherche>\nExemple: {p}{n} naruto"
        }
    },

    onStart: async function ({ api, event, message, args, commandName }) {
        const { threadID, messageID, senderID } = event;
        const query = args.join(" ");

        if (!query) {
            return message.reply("❌ Veuillez entrer un mot-clé pour lancer la recherche.");
        }

        const apiUrl = `https://zetbot-page.onrender.com/api/pinterest?query=${encodeURIComponent(query)}&limit=30`;

        try {
            const loadingMsg = await message.reply("🔍 Génération du catalogue HD...");
            const response = await axios.get(apiUrl);

            if (!response.data.status || !response.data.pins || response.data.pins.length === 0) {
                try { api.unsendMessage(loadingMsg.messageID); } catch(e){}
                return message.reply("❌ Aucun résultat trouvé pour cette recherche.");
            }

            const allPins = response.data.pins;
            const pageUrls = allPins.slice(0, 10).map(p => p.image);
            const imgPath = await createCatalogueCanvas(pageUrls, query, 1);

            try { api.unsendMessage(loadingMsg.messageID); } catch(e){}

            const sentMessage = await api.sendMessage({
                body: `📸 **𝖢𝖠𝖳𝖠𝖫𝖮𝖦𝖴𝖤 𝖯𝖨𝖭𝖳𝖤𝖱𝖤𝖲𝖳**\n\n💬 **Instructions :**\n• Répondez avec un chiffre de \`1\` à \`10\` pour recevoir la photo seule en HD.\n• Répondez \`page 2\` ou \`page 3\` pour faire défiler la liste.`,
                attachment: fs.createReadStream(imgPath)
            }, threadID, messageID);

            global.GoatBot?.onReply?.set(sentMessage.messageID, {
                commandName,
                author: senderID,
                query: query,
                allPins: allPins,
                currentPage: 1,
                messageID: sentMessage.messageID
            });

            if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);

        } catch (error) {
            console.error(error);
            return message.reply("❌ Une erreur est survenue lors de la communication avec le serveur.");
        }
    },

    onReply: async function ({ api, event, Reply, message, commandName }) {
        const { senderID, threadID, messageID, body } = event;
        const { author, query, allPins, currentPage, messageID: replyMsgID } = Reply || {};

        if (senderID !== author) return;

        const input = (body || "").trim().toLowerCase();

        // Navigation entre les pages
        if (input.startsWith("page ")) {
            const targetPage = parseInt(input.split(" ")[1], 10);
            if (isNaN(targetPage) || targetPage < 1 || targetPage > 3) {
                return message.reply("❌ Page invalide. Le catalogue comprend les pages 1, 2 et 3.");
            }

            const startIdx = (targetPage - 1) * 10;
            const endIdx = startIdx + 10;
            const pagePins = allPins.slice(startIdx, endIdx);

            if (pagePins.length === 0) {
                return message.reply("❌ Plus aucune image disponible pour cette page.");
            }

            try { api.unsendMessage(replyMsgID); } catch (e) {}

            const pageUrls = pagePins.map(p => p.image);
            const imgPath = await createCatalogueCanvas(pageUrls, query, targetPage);

            const sentMessage = await api.sendMessage({
                body: `📸 **𝖢𝖠𝖳𝖠𝖫𝖮𝖦𝖴𝖤 : 𝖯𝖠𝖦𝖤 ${targetPage}**\n\n• Répondez avec un numéro (1-10) pour extraire l'image.\n• Tapez \`page [numéro]\` pour scroller.`,
                attachment: fs.createReadStream(imgPath)
            }, threadID, messageID);

            global.GoatBot?.onReply?.set(sentMessage.messageID, {
                commandName,
                author: senderID,
                query: query,
                allPins: allPins,
                currentPage: targetPage,
                messageID: sentMessage.messageID
            });

            if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
            return;
        }

        // Téléchargement de l'image sélectionnée
        const selection = parseInt(input, 10);
        if (!isNaN(selection) && selection >= 1 && selection <= 10) {
            const actualIndex = ((currentPage - 1) * 10) + (selection - 1);
            const selectedPin = allPins[actualIndex];

            if (!selectedPin || !selectedPin.image) {
                return message.reply("❌ Données de l'image introuvables.");
            }

            const ext = selectedPin.image.split('.').pop().split('?')[0] || "jpg";
            const cacheDir = path.join(__dirname, "cache");
            await fs.ensureDir(cacheDir);
            const cachePath = path.join(cacheDir, `pin_hd_${Date.now()}.${ext}`);

            try {
                const downloadNotice = await message.reply(`📥 Extraction de l'image HD n°${selection}...`);

                const response = await axios({
                    method: "get",
                    url: selectedPin.image,
                    responseType: "stream"
                });

                const writer = fs.createWriteStream(cachePath);
                response.data.pipe(writer);

                await new Promise((resolve, reject) => {
                    writer.on("finish", resolve);
                    writer.on("error", reject);
                });

                try { api.unsendMessage(downloadNotice.messageID); } catch(e){}

                await api.sendMessage({
                    body: `✨ **𝖨𝖬𝖠𝖦𝖤 𝖤𝖷𝖳𝖱𝖠𝖨𝖳𝖤** ✨\n\n📌 Titre : ${selectedPin.title || "Sans titre"}\n👤 Auteur : ${selectedPin.uploader?.username || "Inconnu"}`,
                    attachment: fs.createReadStream(cachePath)
                }, threadID, () => {
                    if (fs.existsSync(cachePath)) fs.unlinkSync(cachePath);
                }, messageID);

            } catch (e) {
                console.error(e);
                if (fs.existsSync(cachePath)) fs.unlinkSync(cachePath);
                return message.reply("❌ Impossible de récupérer cette image en haute résolution.");
            }
        }
    }
};
