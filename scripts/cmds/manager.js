/**
 * @author Célestin
 * @name manager
 * @version 6.0.0
 * @description Modération et gestion à distance des membres et des paramètres du groupe.
 */

module.exports = {
    config: {
        name: "manager",
        aliases: ["groupmanager", "kickremote", "gadmin"],
        version: "6.0.0",
        author: "Célestin",
        countDown: 5,
        role: 2, // Réservé à l'administrateur du bot
        category: "admin",
        guide: {
            fr: "• {p}manager : Modération à distance (expulsion ciblée, gestion du nom et des paramètres)."
        }
    },

    onStart: async function ({ api, event, message, commandName }) {
        const { senderID } = event;

        try {
            const inboxList = await api.getThreadList(50, null, ["INBOX"]);
            const groupList = inboxList.filter(group => group.isGroup && group.isSubscribed);

            if (groupList.length === 0) {
                return message.reply("❌ Le bot ne fait partie d'aucun groupe actuellement.");
            }

            let msg = "🛠️ **MODÉRATION DE GROUPE À DISTANCE** 🛠️\n\n";
            groupList.forEach((group, index) => {
                msg += `${index + 1}. **${group.name || "Sans nom"}**\n` +
                       `   🆔 TID : \`${group.threadID}\`\n\n`;
            });

            msg += "💬 Répondez avec le **NUMÉRO** du groupe à administrer.";

            const sentMsg = await message.reply(msg);

            global.GoatBot?.onReply?.set(sentMsg.messageID, {
                commandName,
                author: senderID,
                step: "SELECT_GROUP",
                groupList: groupList
            });

        } catch (error) {
            console.error(error);
            return message.reply("❌ Erreur lors de la récupération de la liste des groupes.");
        }
    },

    onReply: async function ({ api, event, Reply, message, commandName }) {
        const { senderID, body } = event;
        const { author, step, groupList, selectedGroup, membersList } = Reply || {};

        if (senderID !== author) return;

        const input = (body || "").trim();

        // -------------------------------------------------------------
        // ÉTAPE 1 : SELECTION DU GROUPE
        // -------------------------------------------------------------
        if (step === "SELECT_GROUP") {
            const choice = parseInt(input, 10);
            if (isNaN(choice) || choice < 1 || choice > groupList.length) {
                return message.reply(`❌ Choisissez un numéro valide entre 1 et ${groupList.length}.`);
            }

            const group = groupList[choice - 1];

            let msg = `⚙️ **PANNEAU DU GROUPE : ${group.name || "Sans nom"}**\n\n` +
                   `1. 👥 **EXPULSER UN MEMBRE À DISTANCE**\n` +
                   `2. 👻 **RENDRE LE NOM INVISIBLE**\n` +
                   `3. ✏️ **CHANGER LE NOM**\n` +
                   `4. 👍 **RÉINITIALISER L'ÉMOJI**\n\n` +
                   `💬 Répondez par 1, 2, 3 ou 4.`;

            const sentMsg = await message.reply(msg);

            global.GoatBot?.onReply?.set(sentMsg.messageID, {
                commandName,
                author: senderID,
                step: "SELECT_ACTION",
                selectedGroup: group
            });
            return;
        }

        // -------------------------------------------------------------
        // ÉTAPE 2 : SÉLECTION DE L'ACTION
        // -------------------------------------------------------------
        if (step === "SELECT_ACTION") {
            const choice = parseInt(input, 10);

            // OPTION 1 : LISTER ET EXPULSER UN MEMBRE
            if (choice === 1) {
                try {
                    const threadInfo = await api.getThreadInfo(selectedGroup.threadID);
                    const userInfoList = await api.getUserInfo(threadInfo.participantIDs);

                    const members = threadInfo.participantIDs.map((id, index) => {
                        const name = userInfoList[id]?.name || "Utilisateur Facebook";
                        const isAdmin = threadInfo.adminIDs?.some(a => a.id === id);
                        return { index: index + 1, id, name, isAdmin };
                    });

                    let msg = `👥 **LISTE DES MEMBRES (${selectedGroup.name || "Sans nom"})**\n\n`;
                    members.forEach(m => {
                        msg += `${m.index}. ${m.name} ${m.isAdmin ? "👑 (Admin)" : ""}\n`;
                    });

                    msg += "\n💬 Répondez avec le **NUMÉRO** de la personne à expulser (Ex: `2`).";

                    const sentMsg = await message.reply(msg);

                    global.GoatBot?.onReply?.set(sentMsg.messageID, {
                        commandName,
                        author: senderID,
                        step: "CONFIRM_KICK_USER",
                        selectedGroup: selectedGroup,
                        membersList: members
                    });

                } catch (e) {
                    console.error(e);
                    return message.reply("❌ Impossible de charger la liste des membres.");
                }
                return;
            }

            // OPTION 2 : RENDRE LE NOM INVISIBLE
            if (choice === 2) {
                const invisibleName = "⠀"; // Caractère Braille invisible (U+2800)
                return api.setTitle(invisibleName, selectedGroup.threadID, (err) => {
                    if (err) return message.reply("❌ Échec lors du changement de nom.");
                    return message.reply(`✅ Nom du groupe effacé (rendu invisible).`);
                });
            }

            // OPTION 3 : CHANGER LE NOM
            if (choice === 3) {
                const sentMsg = await message.reply("✏️ Saisissez le nouveau nom :");
                global.GoatBot?.onReply?.set(sentMsg.messageID, {
                    commandName,
                    author: senderID,
                    step: "INPUT_NEW_NAME",
                    selectedGroup: selectedGroup
                });
                return;
            }

            // OPTION 4 : RÉINITIALISER L'ÉMOJI
            if (choice === 4) {
                const setEmoji = api.changeThreadEmoji || api.changeGroupEmoji;
                if (typeof setEmoji !== "function") return message.reply("❌ Fonction émoji indisponible.");

                return setEmoji("👍", selectedGroup.threadID, (err) => {
                    if (err) return message.reply("❌ Échec lors de la réinitialisation de l'émoji.");
                    return message.reply("✅ Émoji réinitialisé sur 👍.");
                });
            }

            return message.reply("❌ Choisissez entre 1, 2, 3 ou 4.");
        }

        // -------------------------------------------------------------
        // ÉTAPE 3A : EXPULSION CIBLÉE DU MEMBRE
        // -------------------------------------------------------------
        if (step === "CONFIRM_KICK_USER") {
            const memberIndex = parseInt(input, 10);
            if (isNaN(memberIndex)) return message.reply("❌ Veuillez saisir un numéro valide.");

            const targetUser = membersList.find(m => m.index === memberIndex);
            if (!targetUser) return message.reply("❌ Numéro introuvable dans la liste.");

            return api.removeUserFromGroup(targetUser.id, selectedGroup.threadID, (err) => {
                if (err) return message.reply(`❌ Impossible d'expulser **${targetUser.name}** (Droits insuffisants du bot).`);
                return message.reply(`✅ **${targetUser.name}** a été expulsé(e) du groupe.`);
            });
        }

        // -------------------------------------------------------------
        // ÉTAPE 3B : CHANGEMENT DE NOM
        // -------------------------------------------------------------
        if (step === "INPUT_NEW_NAME") {
            if (!input) return message.reply("❌ Le nom ne peut pas être vide.");

            return api.setTitle(input, selectedGroup.threadID, (err) => {
                if (err) return message.reply("❌ Échec de la modification du nom.");
                return message.reply(`✅ Le nom du groupe a été modifié en : **"${input}"**`);
            });
        }
    }
};
