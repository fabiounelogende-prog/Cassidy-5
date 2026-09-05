const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const TMP_DIR = path.join(__dirname, 'tmp');
if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

// Endpoint IA pour la revue et modification de code
const AI_ENDPOINT = "https://shizuai.vercel.app/chat";

// Stockage temporaire des demandes d'édition / suppression avec expiration
const pendingActions = new Map();

// --- Helper configuration --------------------------------------------------

function getGithubConfig() {
  const config = global.GoatBot?.config;
  if (!config) throw new Error("Config GoatBot introuvable (global.GoatBot.config).");

  const token = config.credentials?.githubToken;
  let repoOwner = config.githubRepository?.repoOwner;
  let repoName = config.githubRepository?.repoName;
  const branch = config.githubRepository?.branch || 'main';

  if (!config.githubRepository?.enable) {
    throw new Error("La fonctionnalité GitHub est désactivée (githubRepository.enable = false).");
  }
  if (!token) throw new Error("Aucun githubToken trouvé dans config.credentials.");

  // Nettoyage au cas où une URL complète a été entrée
  if (repoOwner && repoOwner.includes('github.com')) {
    repoOwner = repoOwner.replace('https://github.com/', '').replace('/', '');
  }
  if (repoName && repoName.includes('github.com')) {
    const parts = repoName.split('/');
    repoName = parts[parts.length - 1];
  }

  if (!repoOwner || !repoName) {
    throw new Error("repoOwner / repoName non configurés dans config.githubRepository.");
  }

  return { token, repoOwner, repoName, branch };
}

function githubClient() {
  const { token } = getGithubConfig();
  return axios.create({
    baseURL: 'https://api.github.com',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    },
    timeout: 20000
  });
}

async function getFileData(targetPath) {
  const { repoOwner, repoName, branch } = getGithubConfig();
  const client = githubClient();
  const { data } = await client.get(
    `/repos/${repoOwner}/${repoName}/contents/${encodeURIComponent(targetPath)}`,
    { params: { ref: branch } }
  );

  if (Array.isArray(data)) throw new Error("Le chemin spécifié est un dossier, pas un fichier.");
  if (data.encoding !== 'base64') throw new Error("Encodage du fichier non supporté.");

  return {
    content: Buffer.from(data.content, 'base64').toString('utf-8'),
    sha: data.sha,
    size: data.size,
    downloadUrl: data.download_url
  };
}

function extractCodeBlock(text) {
  const match = text.match(/```[a-zA-Z0-9]*\n([\s\S]*?)```/);
  return match ? match[1] : null;
}

// --- Fonctions d'action GitHub ----------------------------------------------

async function getRepoInfo() {
  const { repoOwner, repoName } = getGithubConfig();
  const client = githubClient();
  const { data } = await client.get(`/repos/${repoOwner}/${repoName}`);

  return `📦 **Dépôt : ${data.full_name}**\n` +
    `⭐ Stars: ${data.stargazers_count} | 🍴 Forks: ${data.forks_count} | 🐛 Issues: ${data.open_issues_count}\n` +
    `🌿 Branche principale: ${data.default_branch}\n` +
    `🔒 Privé: ${data.private ? 'Oui (Protégé)' : 'Non'}\n` +
    `📝 Description: ${data.description || 'Aucune description'}\n` +
    `🔗 ${data.html_url}`;
}

async function getRateLimitStatus() {
  const client = githubClient();
  const { data } = await client.get('/rate_limit');
  const core = data.resources.core;
  const resetDate = new Date(core.reset * 1000).toLocaleTimeString('fr-FR');
  
  return `📊 **Statut API GitHub**\n` +
    ` • Requêtes restantes : ${core.remaining} / ${core.limit}\n` +
    ` • Réinitialisation à : ${resetDate}`;
}

async function listBranches() {
  const { repoOwner, repoName } = getGithubConfig();
  const client = githubClient();
  const { data } = await client.get(`/repos/${repoOwner}/${repoName}/branches`);
  
  const branches = data.map(b => ` • ${b.name} (${b.commit.sha.slice(0, 7)})`).join('\n');
  return `🌿 **Branches du dépôt :**\n${branches}`;
}

async function listFiles(targetPath = '') {
  const { repoOwner, repoName, branch } = getGithubConfig();
  const client = githubClient();
  const { data } = await client.get(
    `/repos/${repoOwner}/${repoName}/contents/${encodeURIComponent(targetPath)}`,
    { params: { ref: branch } }
  );

  if (!Array.isArray(data)) return `📄 ${data.path} (${data.size} octets) — Ce n'est pas un répertoire.`;

  const dirs = data.filter(f => f.type === 'dir').map(f => `📁 ${f.name}/`);
  const files = data.filter(f => f.type === 'file').map(f => `📄 ${f.name} (${f.size} o)`);
  const listing = [...dirs, ...files].join('\n') || '(Répertoire vide)';

  return `📂 **Contenu de "${targetPath || '/'}"** :\n${listing}`;
}

async function readFile(targetPath) {
  if (!targetPath) throw new Error("Veuillez préciser le chemin du fichier.");
  const { content, size } = await getFileData(targetPath);
  const maxLength = 3500;
  const truncated = content.length > maxLength
    ? content.slice(0, maxLength) + `\n\n... [Tronqué, ${content.length - maxLength} caractères restants]`
    : content;

  return `📄 **${targetPath}** (${size} octets) :\n\`\`\`javascript\n${truncated}\n\`\`\``;
}

async function downloadFileAttachment(targetPath) {
  const { content } = await getFileData(targetPath);
  const ext = path.extname(targetPath).replace('.', '') || 'txt';
  const filePath = path.join(TMP_DIR, `${uuidv4()}.${ext}`);
  fs.writeFileSync(filePath, Buffer.from(content, 'utf-8'));
  return filePath;
}

async function listCommits(targetPath = '', limit = 5) {
  const { repoOwner, repoName, branch } = getGithubConfig();
  const client = githubClient();
  const { data } = await client.get(`/repos/${repoOwner}/${repoName}/commits`, {
    params: { sha: branch, path: targetPath || undefined, per_page: limit }
  });

  if (!data.length) return "Aucun commit trouvé.";
  return data.map(c => {
    const date = new Date(c.commit.author.date).toLocaleString('fr-FR');
    const shortSha = c.sha.slice(0, 7);
    const msg = c.commit.message.split('\n')[0];
    return `🔹 \`${shortSha}\` — ${msg}\n   👤 ${c.commit.author.name} — 🕒 ${date}`;
  }).join('\n\n');
}

async function searchCode(query) {
  if (!query) throw new Error("Veuillez préciser un terme de recherche.");
  const { repoOwner, repoName } = getGithubConfig();
  const client = githubClient();
  const { data } = await client.get('/search/code', {
    params: { q: `${query} repo:${repoOwner}/${repoName}` }
  });

  if (!data.items?.length) return "Aucun résultat trouvé.";
  return `🔍 **${data.total_count} résultat(s)** pour "${query}" :\n` +
    data.items.slice(0, 10).map(item => `📄 ${item.path}`).join('\n');
}

async function commitFile(targetPath, newContent, sha, commitMessage) {
  const { repoOwner, repoName, branch } = getGithubConfig();
  const client = githubClient();
  const { data } = await client.put(
    `/repos/${repoOwner}/${repoName}/contents/${encodeURIComponent(targetPath)}`,
    {
      message: commitMessage,
      content: Buffer.from(newContent, 'utf-8').toString('base64'),
      sha: sha || undefined,
      branch
    }
  );
  return data.commit?.html_url;
}

async function deleteFileOnGithub(targetPath, sha, commitMessage) {
  const { repoOwner, repoName, branch } = getGithubConfig();
  const client = githubClient();
  const { data } = await client.delete(
    `/repos/${repoOwner}/${repoName}/contents/${encodeURIComponent(targetPath)}`,
    {
      data: {
        message: commitMessage,
        sha,
        branch
      }
    }
  );
  return data.commit?.html_url;
}

// --- Assistance IA Copilot --------------------------------------------------

async function aiCodeAssist(targetPath, instruction, uid) {
  if (!targetPath) throw new Error("Veuillez donner le chemin d'un fichier.");
  const { content, size } = await getFileData(targetPath);
  const maxCodeLength = 6000;
  const codeSnippet = content.length > maxCodeLength
    ? content.slice(0, maxCodeLength) + '\n... [fichier tronqué]'
    : content;

  const question = instruction?.trim() || "Explique ce que fait ce fichier et propose des améliorations.";
  const prompt = `Tu es un expert en revue de code.
Fichier: ${targetPath} (${size} octets)

\`\`\`
${codeSnippet}
\`\`\`

Instruction: ${question}

Réponds de façon structurée et concise en français.`;

  const { data } = await axios.post(AI_ENDPOINT, { uid, message: prompt }, { timeout: 60000 });
  return data?.reply || "⚠️ L'IA n'a pas pu générer d'analyse.";
}

async function aiCodeEdit(targetPath, instruction, uid) {
  if (!targetPath) throw new Error("Spécifiez le chemin du fichier à modifier.");
  if (!instruction) throw new Error("Précisez l'instruction de modification.");

  const { content, sha, size } = await getFileData(targetPath);
  if (content.length > 15000) {
    throw new Error("Fichier trop volumineux (>15000 caractères) pour édition IA.");
  }

  const prompt = `Tu es un développeur expert. MODIFIE ce fichier de code.
Fichier "${targetPath}" (${size} octets):

\`\`\`
${content}
\`\`\`

Instruction: ${instruction}

Réponds EXCLUSIVEMENT avec le code complet révisé, dans un bloc de code (\`\`\` ... \`\`\`), sans aucun texte avant ou après.`;

  const { data } = await axios.post(AI_ENDPOINT, { uid, message: prompt }, { timeout: 90000 });
  const newContent = extractCodeBlock(data?.reply || "");

  if (!newContent || newContent.trim().length < 5) {
    throw new Error("L'IA n'a pas retourné de code valide.");
  }

  return { newContent, sha, originalContent: content };
}

// --- Export du Module GoatBot ------------------------------------------------

module.exports = {
  config: {
    name: 'Assistant',
    aliases: ['gh', 'repo'],
    version: '1.5.0',
    author: 'Christus',
    role: 2, // Strictement réservé aux Administrateurs Bot (Privé)
    category: 'admin',
    longDescription: {
      en: 'Private GitHub repository management tool with AI integration.',
      fr: 'Outil d\'administration privée de dépôt GitHub avec assistant IA.'
    },
    guide: {
      fr: `{pn} info — Informations privées du dépôt
{pn} status — Quota de l'API GitHub
{pn} branches — Liste des branches
{pn} list [dossier] — Explorer l'arborescence
{pn} read <fichier> — Afficher le contenu
{pn} download <fichier> — Télécharger le fichier
{pn} create <chemin> <contenu> — Créer un fichier
{pn} delete <chemin> — Supprimer un fichier
{pn} commits [fichier] — Historique des commits
{pn} search <mot-clé> — Rechercher dans le code
{pn} ai <fichier> [question] — Demander une analyse IA
{pn} edit <fichier> <consigne> — Modifier un fichier via IA`
    }
  },

  onStart: async function ({ api, event, args, message }) {
    const sub = (args[0] || '').toLowerCase();
    const rest = args.slice(1).join(' ').trim();

    try {
      let result;

      switch (sub) {
        case 'info':
          result = await getRepoInfo();
          break;

        case 'status':
          result = await getRateLimitStatus();
          break;

        case 'branches':
          result = await listBranches();
          break;

        case 'list':
        case 'ls':
          result = await listFiles(rest);
          break;

        case 'read':
        case 'cat':
          result = await readFile(rest);
          break;

        case 'download':
        case 'dl': {
          if (!rest) return message.reply("⚠️ Spécifiez le fichier à télécharger.");
          const filePath = await downloadFileAttachment(rest);
          await message.reply({ body: `📥 Fichier : ${rest}`, attachment: fs.createReadStream(filePath) });
          setTimeout(() => fs.removeSync(filePath), 10000);
          return;
        }

        case 'create':
        case 'touch': {
          const [filePath, ...contentParts] = rest.split(' ');
          const initialContent = contentParts.join(' ') || '// Fichier créé via le Bot';
          if (!filePath) return message.reply("⚠️ Précisez le chemin du fichier.");

          api.setMessageReaction("⏳", event.messageID, () => {}, true);
          const commitUrl = await commitFile(filePath, initialContent, null, `Create ${filePath}`);
          api.setMessageReaction("✅", event.messageID, () => {}, true);
          return message.reply(`✅ Fichier privé créé : "${filePath}"\n🔗 ${commitUrl}`);
        }

        case 'delete':
        case 'rm': {
          if (!rest) return message.reply("⚠️ Précisez le fichier à supprimer.");
          const { sha } = await getFileData(rest);

          const sentMsg = await message.reply(
            `⚠️ **ATTENTION :** Voulez-vous vraiment supprimer le fichier privé "${rest}" ?\n\n` +
            `👉 Répondez "**confirm**" pour valider ou "**cancel**" pour annuler.`
          );

          pendingActions.set(sentMsg.messageID, {
            type: 'DELETE',
            path: rest,
            sha,
            author: event.senderID
          });

          global.GoatBot.onReply.set(sentMsg.messageID, {
            commandName: 'github',
            messageID: sentMsg.messageID,
            author: event.senderID
          });
          return;
        }

        case 'commits':
        case 'log':
          result = await listCommits(rest);
          break;

        case 'search':
        case 'find':
          result = await searchCode(rest);
          break;

        case 'ai':
        case 'copilot': {
          const [filePath, ...questionParts] = rest.split(' ');
          api.setMessageReaction("🤖", event.messageID, () => {}, true);
          const answer = await aiCodeAssist(filePath, questionParts.join(' '), event.senderID);
          result = `🤖 **Analyse IA pour "${filePath}" :**\n\n${answer}`;
          break;
        }

        case 'edit':
        case 'modify': {
          const [filePath, ...instrParts] = rest.split(' ');
          const instruction = instrParts.join(' ');
          api.setMessageReaction("🛠️", event.messageID, () => {}, true);

          const { newContent, sha, originalContent } = await aiCodeEdit(filePath, instruction, event.senderID);

          const preview = newContent.length > 2500
            ? newContent.slice(0, 2500) + '\n... [Aperçu tronqué]'
            : newContent;

          const sentMsg = await message.reply(
            `🛠️ **Modification proposée pour "${filePath}"**\n` +
            `Taille : ${originalContent.length} → ${newContent.length} caractères.\n\n` +
            `\`\`\`javascript\n${preview}\n\`\`\`\n\n` +
            `✅ Répondez "**confirm**" pour commiter sur GitHub.\n❌ Répondez "**cancel**" pour annuler.`
          );

          pendingActions.set(sentMsg.messageID, {
            type: 'EDIT',
            path: filePath,
            newContent,
            sha,
            instruction,
            author: event.senderID
          });

          global.GoatBot.onReply.set(sentMsg.messageID, {
            commandName: 'github',
            messageID: sentMsg.messageID,
            author: event.senderID
          });
          return;
        }

        default:
          result = "❓ Sous-commande inconnue. Options réservées aux Admins :\n" +
            "• info, status, branches, list, read, download, create, delete, commits, search, ai, edit.";
      }

      return message.reply(result);

    } catch (error) {
      console.error('❌ GitHub Command Error:', error.response?.data || error.message);
      return message.reply(`❌ Erreur : ${error.message}`);
    }
  },

  onReply: async function ({ api, event, Reply, message }) {
    if (event.senderID !== Reply.author) return;

    const action = pendingActions.get(Reply.messageID);
    if (!action) return;

    const answer = event.body?.trim().toLowerCase();

    if (['cancel', 'annuler', 'non', 'no'].includes(answer)) {
      pendingActions.delete(Reply.messageID);
      global.GoatBot.onReply.delete(Reply.messageID);
      return message.reply("❌ Action annulée.");
    }

    if (!['confirm', 'confirmer', 'oui', 'yes', 'ok'].includes(answer)) {
      return message.reply('👉 Répondez par "**confirm**" pour exécuter ou "**cancel**" pour annuler.');
    }

    try {
      api.setMessageReaction("⏳", event.messageID, () => {}, true);

      if (action.type === 'EDIT') {
        const commitMsg = `AI Edit: ${action.instruction || action.path}`.slice(0, 150);
        const commitUrl = await commitFile(action.path, action.newContent, action.sha, commitMsg);

        api.setMessageReaction("✅", event.messageID, () => {}, true);
        message.reply(`✅ Modification envoyée sur GitHub avec succès !\n🔗 ${commitUrl || ''}`);
      } 
      else if (action.type === 'DELETE') {
        const commitMsg = `Delete: ${action.path} via Bot`;
        const commitUrl = await deleteFileOnGithub(action.path, action.sha, commitMsg);

        api.setMessageReaction("🗑️", event.messageID, () => {}, true);
        message.reply(`🗑️ Fichier "${action.path}" supprimé du dépôt distant.\n🔗 ${commitUrl || ''}`);
      }

    } catch (error) {
      console.error('❌ Action Error:', error.response?.data || error.message);
      api.setMessageReaction("❌", event.messageID, () => {}, true);
      message.reply(`❌ Échec de l'opération : ${error.message}`);
    } finally {
      pendingActions.delete(Reply.messageID);
      global.GoatBot.onReply.delete(Reply.messageID);
    }
  }
};
