const { createCanvas } = require('canvas'); 
const fs = require('fs-extra');
const path = require('path');

module.exports = {
    config: {
        name: "publier",
        version: "1.0.4",
        author: "Celestin",
        countDown: 5,
        role: 2, // Réservé aux administrateurs
        shortDescription: "Publie une Story colorée avec cadre stylisé",
        longDescription: "Publie un texte sur la story du bot avec un dégradé de couleur et des bordures déco",
        category: "admin",
        guide: "{p}publier [votre message]"
    },

    onStart: async function ({ api, event, args }) {
        const texte = args.join(" ");
        if (!texte) return api.sendMessage("Veuillez entrer le texte de la story.", event.threadID, event.messageID);

        try {
            api.sendMessage("Génération de la Story avec cadre...", event.threadID, event.messageID);

            // 1. Dimensions Story (Format vertical 9:16)
            const largeur = 1080;
            const hauteur = 1920;
            const canvas = createCanvas(largeur, hauteur);
            const ctx = canvas.getContext('2d');
            const cheminImage = path.join(__dirname, 'cache', `story_cadre_${event.senderID}.png`);

            // 2. Choix de la couleur selon la longueur du message
            const gradient = ctx.createLinearGradient(0, 0, 0, hauteur);
            if (texte.length < 20) {
                gradient.addColorStop(0, '#8A2387');
                gradient.addColorStop(0.5, '#E94057');
                gradient.addColorStop(1, '#F27121');
            } else if (texte.length >= 20 && texte.length < 60) {
                gradient.addColorStop(0, '#02AAB0');
                gradient.addColorStop(1, '#00CDAC');
            } else {
                gradient.addColorStop(0, '#0f0c1b');
                gradient.addColorStop(1, '#ff0055');
            }
            
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, largeur, hauteur);

            // 3. Style du texte principal
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 50px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.shadowColor = "rgba(0, 0, 0, 0.4)";
            ctx.shadowBlur = 20;

            // Découpage automatique des lignes pour le message
            const maxLargeurTexte = largeur - 160;
            const mots = texte.split(' ');
            let ligne = '';
            let lignes = [];

            for (let n = 0; n < mots.length; n++) {
                let ligneTest = ligne + mots[n] + ' ';
                let metriques = ctx.measureText(ligneTest);
                if (metriques.width > maxLargeurTexte && n > 0) {
                    lignes.push(ligne);
                    ligne = mots[n] + ' ';
                } else {
                    ligne = ligneTest;
                }
            }
            lignes.push(ligne);

            // Calcul de la zone du texte pour placer le cadre autour
            let hauteurLigne = 80; 
            let debutY = hauteur / 2 - ((lignes.length - 1) * hauteurLigne) / 2;
            let finY = debutY + ((lignes.length - 1) * hauteurLigne);

            // 4. Ajout du cadre décoratif (Haut et Bas)
            ctx.font = 'bold 40px Arial';
            const decoration = "✧ ▬▭▬ ▬▭▬ ✦✧✦ ▬▭▬ ▬▭▬ ✧";
            
            // Ligne déco du haut
            ctx.fillText(decoration, largeur / 2, debutY - 120);
            
            // Réinitialisation de la police pour le message principal
            ctx.font = 'bold 50px Arial';
            for (let i = 0; i < lignes.length; i++) {
                ctx.fillText(lignes[i], largeur / 2, debutY + (i * hauteurLigne));
            }

            // Ligne déco du bas
            ctx.font = 'bold 40px Arial';
            ctx.fillText(decoration, largeur / 2, finY + 120);

            // Sauvegarde locale du fichier
            const buffer = canvas.toBuffer('image/png');
            fs.outputFileSync(cheminImage, buffer);

            // 5. Publication
            const fluxImage = fs.createReadStream(cheminImage);

            if (typeof api.publishStory === "function") {
                await api.publishStory({ file: fluxImage });
            } else if (typeof api.uploadStory === "function") {
                await api.uploadStory(fluxImage);
            } else {
                await api.createPost({
                    body: "",
                    attachment: fluxImage
                });
            }

            fs.unlinkSync(cheminImage);
            return api.sendMessage("C'est posté ! Ta story avec son cadre stylé est en ligne. 💎", event.threadID, event.messageID);

        } catch (error) {
            console.error(error);
            return api.sendMessage(`Erreur lors de la publication : ${error.message}`, event.threadID, event.messageID);
        }
    }
};
