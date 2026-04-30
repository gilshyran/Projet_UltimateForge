export class InternalBountyGenerator {
    static generateNPCName(namesData, regionId, cityName) {
        const lang = game.i18n.lang.startsWith('en') ? 'en' : 'fr';
        const getText = (item) => (typeof item === 'object') ? (item[lang] || item.fr || "") : (item || "");

        let npcName = game.i18n.localize("CITYFORGE.Shop.AnonResident");
        try {
            const regionNames = namesData[regionId];
            // On vérifie que la nouvelle structure JSON existe
            if (regionNames && regionNames.characters && regionNames.characters.first_names) {
                const sex = Math.random() > 0.5 ? 'm' : 'f';
                const firstNamesList = regionNames.characters.first_names[sex];

                if (firstNamesList && firstNamesList.length > 0) {
                    const rawFirstName = firstNamesList[Math.floor(Math.random() * firstNamesList.length)];
                    const firstName = getText(rawFirstName);
                    let lastName = "";

                    // On charge les noms de famille au bon endroit
                    if (regionNames.characters.last_names && regionNames.characters.last_names.length > 0) {
                        const rawLastName = regionNames.characters.last_names[Math.floor(Math.random() * regionNames.characters.last_names.length)];
                        lastName = getText(rawLastName);
                        if (lastName.includes("{Lieu}")) lastName = lastName.replace("{Lieu}", cityName || game.i18n.localize("CITYFORGE.Shop.TheRegion"));
                    }

                    npcName = firstName + lastName;
                }
            }
        } catch (e) { console.error(e); }
        return npcName.trim();
    }
    // ATTENTION : J'ai ajouté originTags, traitTags, weather, et timeOfDay à la signature !
    static generateHTML(placeName, type, district, citySize, regionId, cityName, namesData, bountiesData, biome, stateId, govTags, ecoTags, vibeTags, originTags, traitTags, weather, timeTags, currency, factionsStr) {
        const lang = game.i18n.lang.startsWith('en') ? 'en' : 'fr';
        const getText = (item) => (typeof item === 'object') ? (item[lang] || item.fr || "") : (item || "");

        let minNotes = 2, maxNotes = 4, nbBounties = 1;
        if (["Petite Ville", "Grande Cité", "Métropole", "Capitale"].includes(citySize)) {
            minNotes = 3; maxNotes = 6; nbBounties = 2;
        }
        const nbNotes = Math.floor(Math.random() * (maxNotes - minNotes + 1)) + minNotes;

        // NOUVEAU SYSTÈME DE FILTRAGE MULTIDIMENSIONNEL (ET entre les catégories, OU dans la catégorie)
        const filterByTags = (array) => {
            return array.filter(item => {
                // 1. Fallback générique : Si l'objet a un tag "all" global, on le garde.
                if (item.tags && item.tags.includes("all")) return true;

                // Fonction utilitaire pour vérifier l'intersection entre deux tableaux (OU logique interne)
                const intersect = (arr1, arr2) => {
                    if (!arr2 || arr2.length === 0) return false;
                    return arr1.some(r => arr2.includes(r));
                };

                // 2. Vérification par catégorie (ET logique entre les catégories)
                // Si la catégorie existe dans la requête, elle DOIT correspondre à la ville.
                if (item.biome_tags && item.biome_tags.length > 0 && !item.biome_tags.includes(biome)) return false;
                if (item.size_tags && item.size_tags.length > 0 && !item.size_tags.includes(citySize)) return false;
                if (item.weather_tags && item.weather_tags.length > 0 && !item.weather_tags.includes(weather)) return false;
                if (item.time_tags && item.time_tags.length > 0 && !intersect(item.time_tags, timeTags)) return false;
                if (item.state_tags && item.state_tags.length > 0 && !item.state_tags.includes(stateId)) return false;

                if (item.gov_tags && item.gov_tags.length > 0 && !intersect(item.gov_tags, govTags)) return false;
                if (item.eco_tags && item.eco_tags.length > 0 && !intersect(item.eco_tags, ecoTags)) return false;
                if (item.vibe_tags && item.vibe_tags.length > 0 && !intersect(item.vibe_tags, vibeTags)) return false;
                if (item.origin_tags && item.origin_tags.length > 0 && !intersect(item.origin_tags, originTags)) return false;
                if (item.trait_tags && item.trait_tags.length > 0 && !intersect(item.trait_tags, traitTags)) return false;

                // Si toutes les catégories définies ont trouvé une correspondance, c'est valide !
                return true;
            }).sort(() => 0.5 - Math.random());
        };

        let notesHTML = "";
        if (bountiesData.villagerRequests && bountiesData.villagerRequests.length > 0) {
            filterByTags(bountiesData.villagerRequests).slice(0, nbNotes).forEach(reqObj => {
                const author = this.generateNPCName(namesData, regionId, cityName);
                const reqText = getText(reqObj).replace(/{NPC}/g, author).replace(/{Lieu}/g, cityName).replace(/{Currency}/g, currency);
                notesHTML += `
                    <div style="background: #fdf5e6; border: 1px solid #d3bd9a; padding: 10px; margin-bottom: 10px; transform: rotate(${Math.random() * 4 - 2}deg); box-shadow: 2px 2px 5px rgba(0,0,0,0.1);">
                        <p style="font-family: 'Comic Sans MS', cursive, sans-serif; font-size: 0.95em; color: #4a3b2c; margin: 0 0 5px 0;">"${reqText}"</p>
                        <p style="text-align: right; font-size: 0.8em; color: #8b7355; margin: 0; font-style: italic;">- ${game.i18n.localize("CITYFORGE.Bounty.Signed")} : ${author}</p>
                    </div>`;
            });
        }

        const factions = (factionsStr || "").split('|').filter(f => f).map(f => {
            const parts = f.split(':'); return { name: parts[0], score: parseInt(parts[1]) };
        });

        if (factions.length > 0) {
            const f1 = factions[0];
            if (factions.length > 1 && factions[1].score >= 2) {
                notesHTML = `
                    <div style="background: #fdf5e6; border: 1px solid #c0392b; padding: 10px; margin-bottom: 10px; transform: rotate(${Math.random() * 4 - 2}deg); box-shadow: 2px 2px 5px rgba(0,0,0,0.1);">
                        <p style="font-family: 'Comic Sans MS', cursive, sans-serif; font-size: 0.95em; color: #c0392b; margin: 0 0 5px 0; font-weight: bold;">"${lang === 'en' ? 'Citizens! Do not believe the lies of' : 'Citoyens ! Ne croyez pas les mensonges de'} ${factions[1].name}. ${lang === 'en' ? 'Only' : 'Seul'} ${f1.name} ${lang === 'en' ? 'can restore the glory of this city!' : 'peut restaurer la gloire de cette ville !'}"</p>
                        <p style="text-align: right; font-size: 0.8em; color: #c0392b; margin: 0; font-style: italic;">- ${lang === 'en' ? 'Torn propaganda leaflet' : 'Tract de propagande arraché'}</p>
                    </div>` + notesHTML;
            } else if (f1.score >= 4) {
                notesHTML = `
                    <div style="background: #fff; border: 2px solid #2980b9; padding: 10px; margin-bottom: 10px; box-shadow: 2px 2px 5px rgba(0,0,0,0.1);">
                        <p style="font-family: serif; font-size: 1em; color: #2980b9; margin: 0 0 5px 0; font-weight: bold; text-align: center;">${lang === 'en' ? 'OFFICIAL PROCLAMATION' : 'PROCLAMATION OFFICIELLE'}</p>
                        <p style="font-size: 0.9em; color: #333; margin: 0; text-align: justify;">${lang === 'en' ? 'By order of' : 'Par ordre de'} <strong>${f1.name}</strong>, ${lang === 'en' ? 'any act of sedition, whisper of rebellion, or unauthorized gathering shall be punished by capital punishment.' : 'tout acte de sédition, murmure de rébellion ou rassemblement non autorisé sera puni de la peine capitale.'}</p>
                    </div>` + notesHTML;
            }
        }

        let bountiesHTML = "";
        if (bountiesData.bounties && bountiesData.bounties.length > 0) {
            filterByTags(bountiesData.bounties).slice(0, nbBounties).forEach(rawBounty => {
                const targetNPC = this.generateNPCName(namesData, regionId, cityName);
                const bTitle = getText(rawBounty.title).replace(/{NPC}/g, targetNPC).replace(/{Lieu}/g, cityName);
                const bDesc = getText(rawBounty.desc).replace(/{NPC}/g, targetNPC).replace(/{Lieu}/g, cityName);
                const rewardVal = rawBounty.reward || rawBounty.reward_base || (lang === 'en' ? "Negotiable" : "À débattre");
                const rewardDisplay = (typeof rewardVal === 'number') ? `${rewardVal} ${currency}` : rewardVal;

                bountiesHTML += `
                    <div style="background: white; border-left: 4px solid #c0392b; padding: 10px; margin-bottom: 10px; box-shadow: 2px 2px 5px rgba(0,0,0,0.1);">
                        <h4 style="margin:0 0 5px 0; color: #c0392b; text-transform: uppercase;">${bTitle}</h4>
                        <p style="margin:0 0 5px 0; font-size:0.9em; color: #333;">${bDesc}</p>
                        <strong style="color: #27ae60;">${game.i18n.localize("CITYFORGE.Bounty.Reward")} : ${rewardDisplay}</strong>
                    </div>
                `;
            });
        }

        const noNotesMsg = game.i18n.localize("CITYFORGE.Bounty.NoNotes");
        const noBountiesMsg = game.i18n.localize("CITYFORGE.Bounty.NoBounties");

        return `
            <div style="font-family: var(--font-primary);">
                <h2 style="color: #d35400; border-bottom: 2px solid #d35400; margin-bottom: 5px;"><i class="fas fa-bullhorn"></i> ${placeName}</h2>
                <div style="display: flex; gap: 10px; margin-bottom: 15px;">
                    <span style="background: #eee; padding: 4px 8px; border-radius: 4px; font-size: 0.9em;"><strong>${game.i18n.localize("CITYFORGE.Shop.District")} :</strong> ${district}</span>
                    <span style="background: #eee; padding: 4px 8px; border-radius: 4px; font-size: 0.9em;"><strong>Format :</strong> ${game.i18n.localize("CITYFORGE.Bounty.FormatLabel")}</span>
                </div>
                <div style="background: rgba(139, 69, 19, 0.1); padding: 15px; border: 2px solid #8B4513; border-radius: 5px;">
                    <h3 style="color: #8B4513; text-align: center; border-bottom: 1px dashed #8B4513; padding-bottom: 5px; margin-top:0;">${game.i18n.localize("CITYFORGE.Bounty.PublicBoardTitle")}</h3>
                    ${notesHTML || `<p style='font-style:italic; color:#7f8c8d;'>${noNotesMsg}</p>`}
                    <h3 style="color: #c0392b; margin-top: 20px; border-bottom: 2px solid #c0392b; text-align: center;">${game.i18n.localize("CITYFORGE.Bounty.OfficialBountiesTitle")}</h3>
                    ${bountiesHTML || `<p style='font-style:italic; color:#7f8c8d;'>${noBountiesMsg}</p>`}
                </div>
            </div>
        `;
    }
}