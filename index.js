/**
 * @author NTKhang
 * ! The source code is written by NTKhang, please don't change the author's name everywhere. Thank you for using
 * ! Official source code: https://github.com/ntkhang03/Goat-Bot-V2
 * ! If you do not download the source code from the above address, you are using an unknown version and at risk of having your account hacked
 *
 * English:
 * ! Please do not change the below code, it is very important for the project.
 * It is my motivation to maintain and develop the project for free.
 * ! If you change it, you will be banned forever
 * Thank you for using
 *
 * Vietnamese:
 * ! Vui lòng không thay đổi mã bên dưới, nó rất quan trọng đối với dự án.
 * Nó là động lực để tôi duy trì và phát triển dự án miễn phí.
 * ! Nếu thay đổi nó, bạn sẽ bị cấm vĩnh viễn
 * Cảm ơn bạn đã sử dụng
 */

const { spawn } = require("child_process");
const http = require("http");
const crypto = require("crypto");
const log = require("./logger/log.js");

// Port HTTP pour Keep-Alive (Render, Replit, Heroku, etc.)
const PORT = process.env.PORT || 3000;

/**
 * Fonction de vérification de la signature HMAC transmise par GitHub
 */
function verifySignature(bodyText, signature, secret) {
	if (!secret) return true;
	if (!signature) return false;
	const hmac = crypto.createHmac("sha256", secret);
	const digest = "sha256=" + hmac.update(bodyText).digest("hex");
	return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
}

// Création du serveur HTTP intégrant la route Webhook GitHub
http.createServer((req, res) => {
	// 1. Route Webhook GitHub
	if (req.method === "POST" && req.url === "/github-webhook") {
		let body = "";

		req.on("data", chunk => {
			body += chunk.toString();
		});

		req.on("end", async () => {
			try {
				const config = global.GoatBot?.config;
				const webhookSecret = config?.credentials?.githubWebhookSecret || "";
				const signature = req.headers["x-hub-signature-256"];

				// Contrôle de sécurité HMAC
				if (webhookSecret && !verifySignature(body, signature, webhookSecret)) {
					log.err("[WEBHOOK]", "Signature GitHub invalide ! Request rejetée.");
					res.writeHead(401, { "Content-Type": "text/plain" });
					return res.end("Unauthorized");
				}

				const event = req.headers["x-github-event"];
				const payload = JSON.parse(body || "{}");
				const api = global.GoatBot?.api;
				const adminIds = config?.adminBot || [];

				if (api && adminIds.length > 0) {
					let message = "";

					// Traitement de l'événement PUSH (Commits)
					if (event === "push") {
						const repoName = payload.repository?.full_name;
						const pusher = payload.pusher?.name;
						const branch = payload.ref?.replace("refs/heads/", "");
						const commits = payload.commits || [];

						if (commits.length > 0) {
							message = `🚀 **Nouveau Push GitHub !**\n` +
								`📦 **Dépôt :** ${repoName}\n` +
								`🌿 **Branche :** ${branch}\n` +
								`👤 **Auteur :** ${pusher}\n\n` +
								`📝 **Commits (${commits.length}) :**\n`;

							commits.forEach(c => {
								const shortSha = c.id.slice(0, 7);
								const line = c.message.split("\n")[0];
								message += ` • \`${shortSha}\` - ${line}\n`;
							});
						}
					} 
					// Traitement des Pull Requests
					else if (event === "pull_request") {
						const action = payload.action;
						const pr = payload.pull_request;
						message = `🔀 **Pull Request [${action.toUpperCase()}]**\n` +
							`📦 **Dépôt :** ${payload.repository?.full_name}\n` +
							`📌 **Titre :** ${pr.title}\n` +
							`👤 **Par :** ${pr.user.login}\n` +
							`🔗 ${pr.html_url}`;
					}
					// Traitement des Issues
					else if (event === "issues") {
						const action = payload.action;
						const issue = payload.issue;
						message = `🐛 **Issue GitHub [${action.toUpperCase()}]**\n` +
							`📦 **Dépôt :** ${payload.repository?.full_name}\n` +
							`📌 **Titre :** #${issue.number} - ${issue.title}\n` +
							`👤 **Par :** ${issue.user.login}\n` +
							`🔗 ${issue.html_url}`;
					}

					// Notification des administrateurs
					if (message) {
						for (const adminId of adminIds) {
							await api.sendMessage(message, adminId).catch(() => {});
						}
					}
				}

				res.writeHead(200, { "Content-Type": "text/plain" });
				res.end("Webhook processed");
			} catch (err) {
				log.err("[WEBHOOK]", `Erreur de traitement: ${err.message}`);
				res.writeHead(500, { "Content-Type": "text/plain" });
				res.end("Internal Error");
			}
		});
		return;
	}

	// 2. Route Keep-Alive standard pour Render/Heroku
	res.writeHead(200, { "Content-Type": "text/plain" });
	res.end("Bot is running");
}).listen(PORT, "0.0.0.0", () => {
	console.log(`[KEEP-ALIVE & WEBHOOK] HTTP server listening on 0.0.0.0:${PORT}`);
}).on("error", (err) => {
	console.error("[KEEP-ALIVE] Failed to bind port:", err.message);
});

function startProject() {
	const child = spawn("node", ["Goat.js"], {
		cwd: __dirname,
		stdio: "inherit",
		shell: true
	});

	child.on("close", (code) => {
		if (code == 2) {
			log.info("Restarting Project...");
			startProject();
		}
	});
}

startProject();
