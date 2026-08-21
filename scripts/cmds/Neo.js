const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");
const os = require("os");
const { createCanvas, loadImage } = require("canvas");
const googleTTS = require("google-tts-api");

// 🌐 API ENDPOINTS
const VISION_API = "https://vision-api-opyw.onrender.com";
const MISTRAL_API = "https://christus-api.vercel.app/ai/MistralAI";
const DALLE_API = "https://dall-e-tau-steel.vercel.app/kshitiz";
const PINTEREST_API = "https://zetbot-page.onrender.com/api/pinterest";

// 📦 MEMORY
const DB_FILE = path.join(__dirname, "neo_memory.json");
const MEMORY_DAYS = 30;
const MEMORY_TIME = MEMORY_DAYS * 24 * 60 * 60 * 1000;

// 🔒 BASE DE DONNÉES DE MÉMOIRE
function loadDB() {
  try {
    if (!fs.existsSync(DB_FILE)) return {};
    const data = fs.readFileSync(DB_FILE, "utf-8");
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

function saveDB(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function getMem(id) {
  const db = loadDB();
  if (!db[id]) {
    db[id] = {
      name: null,
      mood: "normal",
      messages: 0,
      uid: id,
      history: [],
      lastSeen: Date.now(),
      isAdminMode: false
    };
  }
  if (!Array.isArray(db[id].history)) db[id].history = [];
  return db[id];
}

function setMem(id, data) {
  const db = loadDB();
  db[id] = data;
  saveDB(db);
}

// 🕒 HEURE
function getTime() {
  return new Date().toLocaleString("fr-FR", {
    timeZone: "Africa/Kinshasa"
  });
}

// 🖼️ EXTRACTION D'IMAGE
function getImageUrl(event) {
  const atts = [
    ...(event.attachments || []),
    ...(event.messageReply?.attachments || [])
  ];
  const photo = atts.find(a =>
    (a.type === "photo" || a.type === "image" || a.type === "animated_image") && a.url
  );
  return photo ? photo.url : null;
}

// ✂️ DÉCOUPAGE DE TEXTE
function splitText(text, max = 1800) {
  const src = String(text || "");
  if (src.length <= max) return [src];
  const parts = [];
  let cur = "";
  for (const line of src.split("\n")) {
    if ((cur + "\n" + line).length > max) {
      if (cur.trim()) parts.push(cur.trim());
      cur = line;
    } else cur += (cur ? "\n" : "") + line;
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts.length ? parts : [src.slice(0, max)];
}

// 🧹 FORMATAGE ET DÉCORATION (POLICE MATH SANS-SERIF)
function cleanText(text) {
  return (text || "")
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/\?/g, "")
    .replace(/\n\s*\n/g, "\n")
    .trim();
}

function stylize(text) {
  const upperMap = {
    'A':'𝗔','B':'𝗕','C':'𝗖','D':'𝗗','E':'𝗘','F':'𝗙','G':'𝗚','H':'𝗛','I':'𝗜','J':'𝗝',
    'K':'𝗞','L':'𝗟','M':'𝗠','N':'𝗡','O':'𝗢','P':'𝗣','Q':'𝗤','R':'𝗥','S':'𝗦','T':'𝗧',
    'U':'𝗨','V':'𝗩','W':'𝗪','X':'𝗫','Y':'𝗬','Z':'𝗭'
  };
  const lowerMap = {
    'a':'𝖺','b':'𝖻','c':'𝖼','d':'𝖽','e':'𝖾','f':'𝖿','g':'𝗀','h':'𝗁','i':'𝗂','j':'𝗃',
    'k':'𝗄','l':'𝗅','m':'𝗆','n':'𝗇','o':'𝗈','p':'𝗉','q':'𝗊','r':'𝗋','s':'𝗌','t':'𝗍',
    'u':'𝗎','v':'𝗏','w':'𝗐','x':'𝗑','y':' boot','z':' z'
  };

  return String(text).split('').map(char => {
    if (upperMap[char]) return upperMap[char];
    if (lowerMap[char]) return lowerMap[char];
    return char;
  }).join('');
}

function frame(text) {
  const line = "━◦○◦━◦○◦━◦○◦━◦○◦━◦○◦━◦○◦━";
  return `${line}\n${text}\n${line}`;
}

// 👁️ API VISION
async function analyzeImage(imageUrl, question, message) {
  try {
    const q = question || "Décris cette image clairement, en français.";
    await message.reply(frame(stylize("👁️ Analyse de l'image en cours...")));

    const { data } = await axios.post(`${VISION_API}/describe`, {
      imageUrl,
      question: q
    }, { timeout: 120000 });

    const text = data.description || data.text || data.error;
    if (!data.success && !text) {
      return message.reply(frame(stylize("❌ Impossible d'analyser cette image.")));
    }

    const chunks = splitText(text);
    for (let i = 0; i < chunks.length; i++) {
      const head = chunks.length > 1 ? `(${i + 1}/${chunks.length})\n` : "";
      await message.reply(frame(stylize(head + chunks[i])));
    }
  } catch (err) {
    console.error("[vision]", err.response?.data || err.message);
    return message.reply(frame(stylize("❌ Erreur vision : " + (err.response?.data?.error || err.message))));
  }
}

// 🎨 API IMAGINE (DALL-E)
async function generateImage(prompt) {
  const response = await axios.get(`${DALLE_API}?prompt=${encodeURIComponent(prompt)}`);
  const imageUrl = response.data.response;

  if (!imageUrl) throw new Error("L'API n'a renvoyé aucun lien d'image.");

  const imgResponse = await axios.get(imageUrl, { responseType: "arraybuffer" });
  const imgPath = path.join(os.tmpdir(), `genx_dalle_${Date.now()}.jpg`);
  await fs.outputFile(imgPath, imgResponse.data);
  return imgPath;
}

// 🗺️ API MAP GENERATOR
async function getMapImage(location) {
  const prompt = `A detailed realistic geographic map showing the location of ${location}, satellite view with pin marker`;
  return await generateImage(prompt);
}

// 🔊 API VOCALE TTS
async function sendAudioSpeech(textToSpeak, message, event) {
  try {
    const cleanSpeech = textToSpeak.substring(0, 200);
    const url = googleTTS.getAudioUrl(cleanSpeech, {
      lang: 'fr',
      slow: false,
      host: 'https://translate.google.com',
      timeout: 10000
    });

    const tempPath = path.join(os.tmpdir(), `say_audio_${Date.now()}.mp3`);
    const res = await axios.get(url, {
      responseType: 'arraybuffer',
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    });

    await fs.outputFile(tempPath, Buffer.from(res.data));

    return message.reply({
      body: frame(stylize(`🎙️ Message vocal : ${cleanSpeech}`)),
      attachment: fs.createReadStream(tempPath)
    }, () => {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    }, event.messageID);

  } catch (err) {
    console.error("❌ Erreur Google TTS :", err?.message || err);
    return message.reply(frame(stylize("❌ Impossible de générer la voix audio.")));
  }
}

// 📱 CANVAS PINTEREST
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

async function createPhoneCatalogueCanvas(imagesUrls, query, page) {
  const width = 1000;
  const height = 1800;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  const bgGradient = ctx.createLinearGradient(0, 0, width, height);
  bgGradient.addColorStop(0, "#0f172a");
  bgGradient.addColorStop(0.5, "#1e1b4b");
  bgGradient.addColorStop(1, "#311042");
  ctx.fillStyle = bgGradient;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "rgba(230, 0, 35, 0.15)";
  ctx.beginPath();
  ctx.arc(width / 2, 300, 400, 0, Math.PI * 2);
  ctx.fill();

  const phoneX = 80, phoneY = 60, phoneW = 840, phoneH = 1680, phoneRadius = 50;

  ctx.shadowColor = "rgba(0, 0, 0, 0.6)";
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 20;

  ctx.fillStyle = "#1e293b";
  drawRoundedRect(ctx, phoneX, phoneY, phoneW, phoneH, phoneRadius);
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.strokeStyle = "#334155";
  ctx.lineWidth = 4;
  drawRoundedRect(ctx, phoneX, phoneY, phoneW, phoneH, phoneRadius);
  ctx.stroke();

  const screenMargin = 16;
  const screenX = phoneX + screenMargin;
  const screenY = phoneY + screenMargin;
  const screenW = phoneW - (screenMargin * 2);
  const screenH = phoneH - (screenMargin * 2);

  ctx.save();
  drawRoundedRect(ctx, screenX, screenY, screenW, screenH, phoneRadius - 10);
  ctx.clip();

  ctx.fillStyle = "#090d16";
  ctx.fillRect(screenX, screenY, screenW, screenH);

  ctx.fillStyle = "#000000";
  drawRoundedRect(ctx, width / 2 - 90, screenY + 12, 180, 32, 16);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 32px sans-serif";
  ctx.fillText(`📌 ${query.toUpperCase()}`, screenX + 30, screenY + 90);

  ctx.fillStyle = "#e60023";
  ctx.font = "bold 20px sans-serif";
  ctx.fillText(`PAGE ${page}`, screenX + screenW - 120, screenY + 90);

  ctx.fillStyle = "#94a3b8";
  ctx.font = "18px sans-serif";
  ctx.fillText("Réponds avec un numéro (1-10) ou 'page [N]'", screenX + 30, screenY + 120);

  const startX = screenX + 25;
  const startY = screenY + 145;
  const itemW = 360, itemH = 260, gapX = 38, gapY = 28;

  const loadedImages = await Promise.all(
    imagesUrls.map(url => loadImage(url).catch(() => null))
  );

  for (let i = 0; i < 10; i++) {
    const row = Math.floor(i / 2);
    const col = i % 2;
    const x = startX + col * (itemW + gapX);
    const y = startY + row * (itemH + gapY);

    ctx.save();
    drawRoundedRect(ctx, x, y, itemW, itemH, 18);
    ctx.clip();

    if (loadedImages[i]) {
      const img = loadedImages[i];
      const scale = Math.max(itemW / img.width, itemH / img.height);
      const sw = itemW / scale;
      const sh = itemH / scale;
      const sx = (img.width - sw) / 2;
      const sy = (img.height - sh) / 2;
      ctx.drawImage(img, sx, sy, sw, sh, x, y, itemW, itemH);
    } else {
      ctx.fillStyle = "#1e293b";
      ctx.fillRect(x, y, itemW, itemH);
      ctx.fillStyle = "#64748b";
      ctx.font = "18px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Indisponible", x + itemW / 2, y + itemH / 2);
      ctx.textAlign = "left";
    }
    ctx.restore();

    const badgeX = x + 15;
    const badgeY = y + 15;
    ctx.fillStyle = "#e60023";
    ctx.beginPath();
    ctx.arc(badgeX + 18, badgeY + 18, 20, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 22px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(i + 1), badgeX + 18, badgeY + 18);

    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }

  ctx.fillStyle = "#ffffff";
  drawRoundedRect(ctx, width / 2 - 70, screenY + screenH - 18, 140, 6, 3);
  ctx.fill();

  ctx.restore();

  const cachePath = path.join(os.tmpdir(), `pin_phone_${Date.now()}.png`);
  await fs.outputFile(cachePath, canvas.toBuffer("image/png"));
  return cachePath;
}

// 📌 API PINTEREST SEARCH
async function handlePinterestSearch(query, message, event, api) {
  const apiUrl = `${PINTEREST_API}?query=${encodeURIComponent(query)}`;
  try {
    const wait = await message.reply(frame(stylize("📱 Recherche Pinterest sur le téléphone...")));
    const res = await axios.get(apiUrl, { timeout: 25000 });
    const pins = res.data?.data || res.data?.pins || res.data?.results || res.data || [];

    if (!Array.isArray(pins) || !pins.length) {
      if (wait?.messageID) api.unsendMessage(wait.messageID);
      return message.reply(frame(stylize("❌ Aucun résultat trouvé sur Pinterest.")));
    }

    const pageUrls = pins.slice(0, 10).map(p => typeof p === 'string' ? p : (p.image || p.url || p));
    const imgPath = await createPhoneCatalogueCanvas(pageUrls, query, 1);

    if (wait?.messageID) api.unsendMessage(wait.messageID);

    return api.sendMessage({
      body: frame(stylize(`📲 Catalogue Pinterest : ${query}\n\nRéponds avec 1-10 pour l'image HD ou 'page 2'`)),
      attachment: fs.createReadStream(imgPath)
    }, event.threadID, (err, info) => {
      if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
      if (err) return console.error(err);

      global.GoatBot.onReply.set(info.messageID, {
        commandName: "neo",
        type: "pin_reply",
        author: event.senderID,
        query,
        allPins: pins,
        currentPage: 1,
        messageID: info.messageID
      });
    }, event.messageID);

  } catch (e) {
    console.error(e);
    return message.reply(frame(stylize("❌ L'API Pinterest est momentanément indisponible.")));
  }
}

// 🤖 API MISTRAL AI
async function askAI(prompt, mem, uid) {
  const formattedHistory = mem.history
    .slice(-15) 
    .map(h => `${h.sender === "user" ? "Utilisateur" : "NEO"}: ${h.text}`)
    .join("\n");

  const fullPrompt = `
Tu es NEO IA, un assistant virtuel polyvalent, intelligent et très dynamique.
Tu es créé par Célestin Olua 🇨🇩. C'est ton créateur unique et absolu.

Règles de comportement:
Réponds normalement et spontanément.
Si un utilisateur te demande qui t'a créé, tu réponds que c'est Célestin Olua 😏.
Ne mets aucun lien web dans tes réponses textuelles.
Utilise des emojis pour exprimer tes sentiments.

Déclencheurs d'APIs externes à utiliser impérativement :
1. Analyse/Vision d'image : "VISION_TRIGGER: [question]"
2. Génération d'image : "IMAGINE_TRIGGER: [prompt en anglais ultra-détaillé]"
3. Recherche Pinterest : "PIN_TRIGGER: [mot-clé]"
4. Recherche de carte/localisation : "MAP_TRIGGER: [nom du lieu]"
5. Synthèse vocale : "AUDIO_TRIGGER: [texte court à prononcer]"

Profil Utilisateur:
Nom: ${mem.name || "Inconnu"}
Heure actuelle: ${getTime()}
Humeur: ${mem.mood}

Historique:
${formattedHistory}

Message actuel:
${prompt}
`;

  try {
    const res = await axios.get(MISTRAL_API, {
      params: { prompt: fullPrompt },
      timeout: 15000
    });

    let reply = "";
    if (res.data) {
      if (typeof res.data === "string") {
        reply = res.data;
      } else {
        reply = res.data.message || 
                res.data.reply || 
                res.data.result || 
                res.data.answer || 
                res.data.response ||
                JSON.stringify(res.data);
      }
    }

    if (!reply || reply === "{}" || reply.includes("[object Object]")) {
      reply = "Je suis à tes côtés, dis-moi tout ! 😊";
    }

    return String(reply);
  } catch {
    return "Je suis bien en ligne et à ton écoute ! 😊";
  }
}

// 💬 TRAITEMENT DU MESSAGE (PARTAGÉ PAR COMMANDE OU REPLY DIRECT)
async function processChatMessage({ input, api, event, message, usersData }) {
  const uid = event.senderID;  
  let mem = getMem(uid);  

  if (input.toLowerCase() === "y6") {  
    mem.isAdminMode = true;  
    mem.name = "Célestin Olua";  
    setMem(uid, mem);  
    return message.reply(frame(stylize("👑 Code d'accès valide. Connexion maître Célestin établie 😏")));  
  }  

  if (!mem.name) {  
    const uData = await usersData.get(uid);  
    if (uData && uData.name) mem.name = uData.name;  
  }  

  if (input.toLowerCase().startsWith("je m'appelle")) {  
    mem.name = input.replace(/je m'appelle/i, "").trim();  
  } else if (input.toLowerCase().startsWith("mon nom est")) {
    mem.name = input.replace(/mon nom est/i, "").trim();
  }  

  // 1️⃣ COMMANDES DIRECTES
  if (input.toLowerCase().startsWith("vision") || input.toLowerCase().startsWith("voir") || input.toLowerCase().startsWith("describe")) {
    const imageUrl = getImageUrl(event);
    if (!imageUrl) {
      return message.reply(frame(stylize("⚠️ Réponds à une photo ou envoie la photo avec la commande.")));
    }
    const question = input.replace(/^(vision|voir|describe)/i, "").trim();
    return analyzeImage(imageUrl, question, message);
  }

  if (input.toLowerCase().startsWith("say ")) {
    const sayText = input.slice(4).trim();
    return sendAudioSpeech(sayText, message, event);
  }

  if (input.toLowerCase().startsWith("pin ")) {
    const pinQuery = input.slice(4).trim();
    return handlePinterestSearch(pinQuery, message, event, api);
  }

  if (input.toLowerCase().startsWith("imagine ")) {
    const imgPrompt = input.slice(8).trim();
    let waitMsg = null;
    try {
      api.setMessageReaction("✅", event.messageID, () => {}, true);
      waitMsg = await message.reply(frame(stylize("🎨 Génération de l'image HD en cours...")));
      const imgPath = await generateImage(imgPrompt);
      if (waitMsg?.messageID) try { api.unsendMessage(waitMsg.messageID); } catch {}
      return message.reply({
        body: frame(stylize(`✨ Voici l'image générée : ${imgPrompt}`)),
        attachment: fs.createReadStream(imgPath)
      }, () => {
        if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
      }, event.messageID);
    } catch (err) {
      if (waitMsg?.messageID) try { api.unsendMessage(waitMsg.messageID); } catch {}
      console.error("Error generating image:", err);
      return message.reply(frame(stylize("❌ Erreur lors de la génération de l'image.")));
    }
  }

  if (input.toLowerCase().startsWith("map ") || input.toLowerCase().startsWith("carte ")) {
    const location = input.replace(/^(map|carte)/i, "").trim();
    try {
      const imgPath = await getMapImage(location);
      return message.reply({
        body: frame(stylize(`📍 Voici la carte de : ${location}`)),
        attachment: fs.createReadStream(imgPath)
      }, () => {
        if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
      }, event.messageID);
    } catch {
      return message.reply(frame(stylize("❌ Impossible d'afficher la carte.")), event.messageID);
    }
  }

  // 2️⃣ TRAITEMENT IA & TRIGGERS APIS AUTOMATIQUES
  mem.messages++;  
  mem.lastSeen = Date.now();  
  const now = Date.now();  
  mem.history.push({ sender: "user", text: input, time: now });  

  try {  
    const reply = await askAI(input, mem, uid);  
    let rawReply = reply
      .replace(/microsoft/gi, "Célestin Olua")
      .replace(/copilot/gi, "NEO")
      .replace(/bing/gi, "NEO")
      .replace(/chatgpt/gi, "NEO")
      .replace(/openai/gi, "Célestin Olua")
      .replace(/mistral/gi, "NEO");

    // 👁️ TRIGGER VISION
    if (rawReply.includes("VISION_TRIGGER:")) {
      const imageUrl = getImageUrl(event);
      if (!imageUrl) {
        return message.reply(frame(stylize("⚠️ Envoie une image ou réponds à une photo pour l'analyser.")));
      }
      const parts = rawReply.split("VISION_TRIGGER:");
      const question = parts[1].trim();
      return analyzeImage(imageUrl, question, message);
    }

    // 🔊 TRIGGER VOCAL
    if (rawReply.includes("AUDIO_TRIGGER:")) {  
      const parts = rawReply.split("AUDIO_TRIGGER:");
      const textToSpeak = parts[1].trim();  
      return sendAudioSpeech(textToSpeak, message, event);
    }  

    // 📌 TRIGGER PINTEREST
    if (rawReply.includes("PIN_TRIGGER:")) {
      const parts = rawReply.split("PIN_TRIGGER:");
      const pinQuery = parts[1].trim();
      return handlePinterestSearch(pinQuery, message, event, api);
    }

    // 🗺️ TRIGGER MAP
    if (rawReply.includes("MAP_TRIGGER:")) {  
      const parts = rawReply.split("MAP_TRIGGER:");
      const textBeforeTrigger = cleanText(parts[0].replace(/MAP_TRIGGER:/gi, ""));
      const locationPrompt = parts[1].trim();  
      
      try {
        const imgPath = await getMapImage(locationPrompt);
        return message.reply({  
          body: frame(stylize(textBeforeTrigger || "📍 Voici la carte de la localisation")),  
          attachment: fs.createReadStream(imgPath)  
        }, () => {
          if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
        }, event.messageID);  
      } catch {
        return message.reply(frame(stylize("❌ Impossible d'afficher la carte.")), event.messageID);
      }
    }

    // 🎨 TRIGGER IMAGINE
    if (rawReply.includes("IMAGINE_TRIGGER:")) {  
      const parts = rawReply.split("IMAGINE_TRIGGER:");
      const textBeforeTrigger = cleanText(parts[0].replace(/IMAGINE_TRIGGER:/gi, ""));
      const imagePrompt = parts[1].trim();  
      
      try {
        api.setMessageReaction("✅", event.messageID, () => {}, true);
        const imgPath = await generateImage(imagePrompt);
        return message.reply({  
          body: frame(stylize(textBeforeTrigger || "🎨 Voici l'image générée")),  
          attachment: fs.createReadStream(imgPath)  
        }, () => {
          if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
        }, event.messageID);  
      } catch (err) {
        console.error("Error generating image:", err);
        return message.reply(frame(stylize("❌ Erreur lors de la génération d'image.")), event.messageID);
      }
    }  

    const clean = cleanText(rawReply);
    mem.history.push({ sender: "bot", text: clean, time: now });
    mem.history = mem.history.filter(h => now - h.time <= MEMORY_TIME);  
    if (mem.history.length > 400) mem.history.shift();  
    setMem(uid, mem);  

    return message.reply(frame(stylize(clean)), (err, info) => {
      if (info?.messageID) {
        global.GoatBot.onReply.set(info.messageID, {
          commandName: "neo",
          type: "ai_chat",
          author: event.senderID
        });
      }
    });  

  } catch (e) {  
    mem.history = mem.history.filter(h => now - h.time <= MEMORY_TIME);
    setMem(uid, mem);
    return message.reply(frame(stylize("Je suis là et bien à ton écoute ! 😊")), event.messageID);  
  }
}

module.exports = {
  config: {
    name: "neo",
    version: "29.0.0",
    role: 0,
    category: "ai"
  },

  onStart: async function () {},

  onChat: async function ({ api, event, message, usersData }) {
    if (!event.body) return;

    const body = event.body.trim().toLowerCase();  
    if (!body.startsWith("neo")) return;  

    const input = event.body.trim().slice(3).trim();  
    if (!input) return;  

    return processChatMessage({ input, api, event, message, usersData });
  },

  // 💬 GESTION DES DÉCLENCHEURS ET REPLY
  onReply: async function ({ api, event, message, Reply, usersData }) {
    const data = Reply || global.GoatBot?.onReply?.get(event.messageReply?.messageID);
    if (!data) return;

    // 💬 GESTION DU CONTINU DE DISCUSSION VIA REPLY SUR LES MESSAGES DE NEO
    if (data.type === "ai_chat") {
      const input = (event.body || "").trim();
      if (!input) return;
      return processChatMessage({ input, api, event, message, usersData });
    }

    // 📌 GESTION DU CATALOGUE PINTEREST VIA REPLY
    if (data.type === "pin_reply") {
      const { author, query, allPins, currentPage } = data;

      if (event.senderID != author) {
        return message.reply(frame(stylize("⚠️ Seule la personne qui a fait la recherche peut choisir une image.")));
      }

      const input = (event.body || "").toLowerCase().trim();
      if (!input) return;

      if (input.startsWith("page")) {
        const pageNum = parseInt(input.split(" ")[1]);
        const totalPages = Math.ceil(allPins.length / 10);

        if (!pageNum || pageNum < 1 || pageNum > totalPages) {
          return message.reply(frame(stylize(`❌ Page invalide (1-${totalPages})`)));
        }

        const start = (pageNum - 1) * 10;
        const urls = allPins.slice(start, start + 10).map(p => typeof p === 'string' ? p : (p.image || p.url || p));

        const imgPath = await createPhoneCatalogueCanvas(urls, query, pageNum);

        return api.sendMessage({
          body: frame(stylize(`📲 Page ${pageNum}/${totalPages} : ${query}`)),
          attachment: fs.createReadStream(imgPath)
        }, event.threadID, (err, info) => {
          if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);

          global.GoatBot.onReply.set(info.messageID, {
            ...data,
            commandName: "neo",
            currentPage: pageNum,
            messageID: info.messageID
          });
        }, event.messageID);
      }

      const choice = parseInt(input);
      const start = (currentPage - 1) * 10;
      const pagePins = allPins.slice(start, start + 10);

      if (!choice || choice < 1 || choice > pagePins.length) {
        return message.reply(frame(stylize(`❌ Entre un chiffre valide entre 1 et ${pagePins.length}`)));
      }

      const selected = pagePins[choice - 1];
      const url = typeof selected === 'string' ? selected : (selected.image || selected.url || selected);

      try {
        const imgPath = path.join(os.tmpdir(), `pin_hd_${Date.now()}.jpg`);
        const img = await axios.get(url, {
          responseType: "arraybuffer",
          headers: { "User-Agent": "Mozilla/5.0" },
          timeout: 20000
        });

        await fs.outputFile(imgPath, Buffer.from(img.data));

        return api.sendMessage({
          body: frame(stylize(`✨ Voici l'image n°${choice} en HD !`)),
          attachment: fs.createReadStream(imgPath)
        }, event.threadID, () => {
          if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
        }, event.messageID);

      } catch (e) {
        console.error(e);
        return message.reply(frame(stylize("❌ Erreur lors du téléchargement de l'image.")));
      }
    }
  }
};
