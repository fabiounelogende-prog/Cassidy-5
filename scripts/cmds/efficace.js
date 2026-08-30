module.exports = {
    config: {
        name: "efficace",
        aliases: ["joinall"],
        version: "1.0",
        author: "Célestin",
        countDown: 5,
        role: 2, // Réservé uniquement aux administrateurs du bot
        shortDescription: {
            fr: "⚡ Ajoute l'admin du bot dans tous les groupes installés."
        },
        longDescription: {
            fr: "Permet à l'administrateur du bot d'être automatiquement invité/ajouté dans absolument tous les groupes de discussion où le bot est présent."
        },
        category: "admin",
        guide: {
            fr: "Écrivez simplement 'efficace' (sans préfixe) dans n'importe quelle discussion."
        }
    },

    onChat: async function({ api, event, message, threadsData }) {
        if (!event.body) return;

        const msg = event.body.toLowerCase().trim();
        const senderID = event.senderID;
        const botAdmins = global.GoatBot.config.adminBot || [];

        // Déclenchement sans préfixe
        if (msg === "efficace") {
            // Sécurité : Seuls les admins du bot peuvent déclencher cette action globale
            if (!botAdmins.includes(senderID)) {
                return message.reply("⛓️💀 Cette action globale nécessite les droits de l'administrateur suprême.");
            }

            try {
                // Récupération de tous les groupes stockés dans la base de données du bot
                const allThreads = (await threadsData.getAll()).filter(t => t.isGroup);
                
                if (allThreads.length === 0) {
                    return message.reply("📡 Aucun groupe n'a été détecté dans ma base de données.");
                }

                message.reply(`⚡ Connexion établie. Tentative d'insertion dans ${allThreads.length} groupes en cours...`);

                let successCount = 0;
                let failCount = 0;

                for (const thread of allThreads) {
                    try {
                        const threadInfo = await api.getThreadInfo(thread.threadID);
                        
                        // Vérifier si l'admin fait déjà partie du groupe
                        const isAlreadyMember = threadInfo.participantIDs.includes(senderID);

                        if (!isAlreadyMember) {
                            // Ajoute l'administrateur au groupe
                            await api.addUserToGroup(senderID, thread.threadID);
                            successCount++;
                        }
                    } catch (e) {
                        // Échec si le bot n'est plus dans le groupe ou n'a pas les droits requis
                        failCount++;
                    }
                }

                return message.reply(`✅ **Opération Efficace Terminée** :\n\n➕ Ajouté avec succès dans : **${successCount}** groupe(s).\n❌ Échecs ou déjà présent : **${failCount}** groupe(s).`);

            } catch (error) {
                console.error(error);
                return message.reply("❌ Une erreur interne est survenue lors du déploiement.");
            }
        }
    },

    // Permet également un déclenchement classique si nécessaire
    onStart: async function({ api, event, message, threadsData }) {
        return this.onChat({ api, event, message, threadsData });
    }
};
