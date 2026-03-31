export class InternalBountyGenerator {

    static generateNPCName(namesData, regionId, cityName) {
        const lang = game.i18n.lang.startsWith('en') ? 'en' : 'fr';
        const getText = (item) => (typeof item === 'object') ? (item[lang] || item.fr || "") : (item || "");
        
        let npcName = lang === 'en' ? "Anonymous resident" : "Habitant anonyme"; 
        try {
            const regionNames = namesData[regionId];
            if (regionNames && regionNames.characters) {
                const sex = Math.random() > 0.5 ? 'm' : 'f';
                const charData = regionNames.characters[sex];
                
                if (charData && charData.firstnames && charData.firstnames.length > 0) {
                    const rawFirstName = charData.firstnames[Math.floor(Math.random() * charData.firstnames.length)];
                    const firstName = getText(rawFirstName);
                    let lastName = "";
                    
                    if (charData.lastnames && charData.lastnames.length > 0) {
                        const rawLastName = charData.lastnames[Math.floor(Math.random() * charData.lastnames.length)];
                        lastName = getText(rawLastName);
                        if (lastName.includes("{Lieu}")) lastName = lastName.replace("{Lieu}", cityName || (lang === 'en' ? "the region" : "la région"));
                    }
                    
                    npcName = firstName + lastName;
                }
            }
        } catch (e) { console.error(e); }
        return npcName.trim();
    }

    // Ajout des paramètres de contexte !
    static generateHTML(placeName, type, district, citySize, regionId, cityName, namesData, bountiesData, biome, stateId, govTags, ecoTags, vibeTags, currency, factionsStr) {
        
        const lang = game.i18n.lang.startsWith('en') ? 'en' : 'fr';
        const getText = (item) => (typeof item === 'object') ? (item[lang] || item.fr || "") : (item || "");
        const allContextTags = [...govTags, ...ecoTags, ...vibeTags, stateId, biome, citySize];

        // 1. DENSITÉ DU PANNEAU SELON LA TAILLE DE LA VILLE
        let minNotes = 2, maxNotes = 4;
        let nbBounties = 1;
        
        if (["Petite Ville", "Grande Cité", "Métropole", "Capitale"].includes(citySize)) {
            minNotes = 3;
            maxNotes = 6;
            nbBounties = 2;
        }
        const nbNotes = Math.floor(Math.random() * (maxNotes - minNotes + 1)) + minNotes;

        // --- FONCTION DE FILTRAGE PAR TAGS ---
        const filterByTags = (array) => {
            let valid = array.filter(item => {
                if (!item.tags || item.tags.includes("all")) return true;
                return item.tags.some(t => allContextTags.includes(t));
            });
            // Si le filtrage est trop strict, on ajoute les "all" en renfort
            if (valid.length === 0) valid = array.filter(item => !item.tags || item.tags.includes("all"));
            return valid.sort(() => 0.5 - Math.random());
        };

        // 2. GÉNÉRATION DES PETITES ANNONCES (Façon "The Witcher")
        let notesHTML = "";
        if (bountiesData.villagerRequests && bountiesData.villagerRequests.length > 0) {
            const shuffledRequests = filterByTags(bountiesData.villagerRequests).slice(0, nbNotes);
            
            shuffledRequests.forEach(reqObj => {
                const author = this.generateNPCName(namesData, regionId, cityName);
                let reqText = getText(reqObj);
                
                // Remplacement dynamique
                reqText = reqText.replace(/{NPC}/g, author).replace(/{Lieu}/g, cityName).replace(/{Currency}/g, currency);

                // Design The Witcher (Post-it inclinés)
                notesHTML += `
                    <div style="background: #fdf5e6; border: 1px solid #d3bd9a; padding: 10px; margin-bottom: 10px; transform: rotate(${Math.random() * 4 - 2}deg); box-shadow: 2px 2px 5px rgba(0,0,0,0.1);">
                        <p style="font-family: 'Comic Sans MS', cursive, sans-serif; font-size: 0.95em; color: #4a3b2c; margin: 0 0 5px 0;">"${reqText}"</p>
                        <p style="text-align: right; font-size: 0.8em; color: #8b7355; margin: 0; font-style: italic;">- ${lang === 'en' ? 'Signed' : 'Signé'} : ${author}</p>
                    </div>`;
            });
        }

        // --- INJECTION NARRATIVE : PROPAGANDE DE FACTION ---
        const factions = (factionsStr || "").split('|').filter(f => f).map(f => {
            const parts = f.split(':'); return { name: parts[0], score: parseInt(parts[1]) };
        });

        if (factions.length > 0) {
            const f1 = factions[0];
            if (factions.length > 1 && factions[1].score >= 2) {
                const f2 = factions[1];
                notesHTML = `
                    <div style="background: #fdf5e6; border: 1px solid #c0392b; padding: 10px; margin-bottom: 10px; transform: rotate(${Math.random() * 4 - 2}deg); box-shadow: 2px 2px 5px rgba(0,0,0,0.1);">
                        <p style="font-family: 'Comic Sans MS', cursive, sans-serif; font-size: 0.95em; color: #c0392b; margin: 0 0 5px 0; font-weight: bold;">"Citoyens ! Ne croyez pas les mensonges de ${f2.name}. Seul ${f1.name} peut restaurer la gloire de cette ville !"</p>
                        <p style="text-align: right; font-size: 0.8em; color: #c0392b; margin: 0; font-style: italic;">- Tract de propagande arraché</p>
                    </div>` + notesHTML;
            } else if (f1.score >= 4) {
                 notesHTML = `
                    <div style="background: #fff; border: 2px solid #2980b9; padding: 10px; margin-bottom: 10px; box-shadow: 2px 2px 5px rgba(0,0,0,0.1);">
                        <p style="font-family: serif; font-size: 1em; color: #2980b9; margin: 0 0 5px 0; font-weight: bold; text-align: center;">PROCLAMATION OFFICIELLE</p>
                        <p style="font-size: 0.9em; color: #333; margin: 0; text-align: justify;">Par ordre de <strong>${f1.name}</strong>, tout acte de sédition, murmure de rébellion ou rassemblement non autorisé sera puni de la peine capitale.</p>
                    </div>` + notesHTML;
            }
        }

        // 3. GÉNÉRATION DES CONTRATS OFFICIELS (Avis de recherche)
        let bountiesHTML = "";
        if (bountiesData.bounties && bountiesData.bounties.length > 0) {
            const shuffledBounties = filterByTags(bountiesData.bounties).slice(0, nbBounties);

            shuffledBounties.forEach(rawBounty => {
                let bTitle = getText(rawBounty.title);
                let bDesc = getText(rawBounty.desc);
                
                const targetNPC = this.generateNPCName(namesData, regionId, cityName);
                bTitle = bTitle.replace(/{NPC}/g, targetNPC).replace(/{Lieu}/g, cityName);
                bDesc = bDesc.replace(/{NPC}/g, targetNPC).replace(/{Lieu}/g, cityName);

                const rewardVal = rawBounty.reward || rawBounty.reward_base || "À débattre";
                const rewardDisplay = (typeof rewardVal === 'number') ? `${rewardVal} ${currency}` : rewardVal;

                const rewardLabel = lang === 'en' ? 'Reward' : 'Récompense';
                bountiesHTML += `
                    <div style="background: white; border-left: 4px solid #c0392b; padding: 10px; margin-bottom: 10px; box-shadow: 2px 2px 5px rgba(0,0,0,0.1);">
                        <h4 style="margin:0 0 5px 0; color: #c0392b; text-transform: uppercase;">${bTitle}</h4>
                        <p style="margin:0 0 5px 0; font-size:0.9em; color: #333;">${bDesc}</p>
                        <strong style="color: #27ae60;">${rewardLabel} : ${rewardDisplay}</strong>
                    </div>
                `;
            });
        }

        // 4. ASSEMBLAGE DE L'AFFICHAGE FINAL
        const classifiedTitle = lang === 'en' ? '📝 Public Notice Board' : '📝 Panneau d\'Affichage Public';
        const officialTitle = lang === 'en' ? '💀 Official Bounties' : '💀 Avis de Recherche Officiels';
        const formatLabel = lang === 'en' ? "Public Board" : "Panneau d'Affichage";

        const contentHTML = `
            <div style="background: rgba(139, 69, 19, 0.1); padding: 15px; border: 2px solid #8B4513; border-radius: 5px;">
                <h3 style="color: #8B4513; text-align: center; border-bottom: 1px dashed #8B4513; padding-bottom: 5px; margin-top:0;">${classifiedTitle}</h3>
                ${notesHTML || "<p style='font-style:italic; color:#7f8c8d;'>Aucune annonce pour le moment.</p>"}
                <h3 style="color: #c0392b; margin-top: 20px; border-bottom: 2px solid #c0392b; text-align: center;">${officialTitle}</h3>
                ${bountiesHTML || "<p style='font-style:italic; color:#7f8c8d;'>Aucun contrat officiel en cours.</p>"}
            </div>
        `;

        return `
            <div style="font-family: var(--font-primary);">
                <h2 style="color: #d35400; border-bottom: 2px solid #d35400; margin-bottom: 5px;"><i class="fas fa-bullhorn"></i> ${placeName}</h2>
                <div style="display: flex; gap: 10px; margin-bottom: 15px;">
                    <span style="background: #eee; padding: 4px 8px; border-radius: 4px; font-size: 0.9em;"><strong>${lang === 'en' ? 'District' : 'Quartier'} :</strong> ${district}</span>
                    <span style="background: #eee; padding: 4px 8px; border-radius: 4px; font-size: 0.9em;"><strong>Format :</strong> ${formatLabel}</span>
                </div>
                ${contentHTML}
            </div>
        `;
    }
}