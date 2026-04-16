export class InternalTavernGenerator {
    
    // 1. GÉNÉRATION DES NOMS DE PNJ (CORRIGÉ : "first_names" et "last_names")
    static generateNPCName(namesData, regionId, cityName) {
        const lang = game.i18n.lang.startsWith('en') ? 'en' : 'fr';
        const getText = (item) => (typeof item === 'object') ? (item[lang] || item.fr || "") : (item || "");

        let npcName = game.i18n.localize("CITYFORGE.Shop.AnonResident");
        try {
            const regionNames = namesData[regionId];
            if (regionNames && regionNames.characters && regionNames.characters.first_names) {
                const sex = Math.random() > 0.5 ? 'm' : 'f';
                const firstNamesList = regionNames.characters.first_names[sex];

                if (firstNamesList && firstNamesList.length > 0) {
                    const rawFirstName = firstNamesList[Math.floor(Math.random() * firstNamesList.length)];
                    const firstName = getText(rawFirstName);
                    let lastName = "";

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

    // 2. GÉNÉRATION DE L'AUBERGE ET DU HTML
    static generateHTML(tavernName, tavernType, district, citySize, regionId, cityName, namesData, tavernsData, biome, stateId, priceMult, currency, govTags, ecoTags, vibeTags, factionsStr, weather = "clear") {
        const lang = game.i18n.lang.startsWith('en') ? 'en' : 'fr';
        const getText = (item) => (typeof item === 'object') ? (item[lang] || item.fr || "") : (item || "");

        // --- QUALITÉ ET NOM ---
        let quality = "moyenne";
        if (tavernType.includes("louche")) quality = "faible";
        if (tavernType.includes("luxueuse")) quality = "elevee";
        const qData = tavernsData.qualities[quality];

        const ownerName = this.generateNPCName(namesData, regionId, cityName);
        const ownerTrait = getText(qData.staff_roles.owner_traits[Math.floor(Math.random() * qData.staff_roles.owner_traits.length)]);

        let finalName = tavernName;
        if (tavernName.startsWith("Taverne") && tavernsData.name_parts) {
            if (Math.random() < 0.3) {
                const ownerPrefixes = lang === 'en'
                    ? [`${ownerName}'s Tavern`, `${ownerName}'s Inn`, `At ${ownerName}'s`, `The ${ownerName} Rest`]
                    : [`Chez ${ownerName}`, `La Taverne de ${ownerName}`, `L'Auberge de ${ownerName}`, `Le Relais de ${ownerName}`];
                finalName = ownerPrefixes[Math.floor(Math.random() * ownerPrefixes.length)];
            } else {
                const nounObj = tavernsData.name_parts.nouns[Math.floor(Math.random() * tavernsData.name_parts.nouns.length)];
                const adjObj = tavernsData.name_parts.adjectives[Math.floor(Math.random() * tavernsData.name_parts.adjectives.length)];
                finalName = lang === 'en' ? `The ${getText(adjObj)} ${getText(nounObj)}` : `Le ${getText(nounObj)} ${getText(adjObj)}`;
            }
        }

        const quirkText = getText(qData.quirks[Math.floor(Math.random() * qData.quirks.length)]);
        const clientText = getText(qData.clientele[Math.floor(Math.random() * qData.clientele.length)]);

        // --- SERVICES ET PERSONNEL ---
        const sShuffled = qData.services.sort(() => 0.5 - Math.random());
        const service1 = sShuffled[0], service2 = sShuffled[1];
        let extraStaffFromServices = [];
        if (service1 && service1.trigger_staff) extraStaffFromServices.push(getText(service1.trigger_staff));
        if (service2 && service2.trigger_staff) extraStaffFromServices.push(getText(service2.trigger_staff));

        let staffListHTML = `<li><strong><i class="fas fa-user-tie"></i> ${game.i18n.localize("CITYFORGE.Tavern.OwnerTitle")} :</strong> ${ownerName}, ${ownerTrait}</li>`;
        qData.staff_roles.others.forEach(staff => {
            staffListHTML += `<li><strong>${getText(staff.role)} :</strong> ${this.generateNPCName(namesData, regionId, cityName)}, ${getText(staff.trait)}</li>`;
        });

        extraStaffFromServices.forEach(role => {
            staffListHTML += `<li><strong><i class="fas fa-star"></i> ${role} :</strong> ${this.generateNPCName(namesData, regionId, cityName)}, ${game.i18n.localize("CITYFORGE.Tavern.Dedicated")}</li>`;
        });

        if (["Campement", "Hameau", "Village"].includes(citySize)) {
            staffListHTML += `<li><strong><i class="fas fa-horse"></i> ${game.i18n.localize("CITYFORGE.Tavern.StableBoy")} :</strong> ${this.generateNPCName(namesData, regionId, cityName)}, ${game.i18n.localize("CITYFORGE.Tavern.StableTask")}</li>`;
        }

        // --- MENUS ET BOISSONS ---
        let nbMeals = quality === "faible" ? 1 : (quality === "elevee" ? 3 : 2);
        let nbDrinks = quality === "faible" ? 2 : (quality === "elevee" ? 4 : 3);

        const renderItem = (item) => {
            if (!item) return "";
            return `<span>${getText(item)}</span> <strong class="cf-poi-menu-price">${Math.max(1, Math.round(item.price * priceMult))} ${currency}</strong>`;
        };

        let mealsHTML = qData.menus.sort(() => 0.5 - Math.random()).slice(0, Math.min(nbMeals, qData.menus.length))
            .map(m => `<li>${renderItem(m)}</li>`).join("");

        let availableDrinks = [...qData.drinks];
        if (tavernsData.regional_drinks) {
            const localSigs = tavernsData.regional_drinks.filter(d => d.id_region === regionId);
            if (localSigs.length > 0) availableDrinks.push(localSigs[0]);
        }
        let drinksHTML = availableDrinks.sort(() => 0.5 - Math.random()).slice(0, Math.min(nbDrinks, availableDrinks.length))
            .map(d => `<li>${renderItem(d)}</li>`).join("");

        // --- GESTION DES FACTIONS (Pour le Tag-Clash) ---
        const factions = (factionsStr || "").split('|').filter(f => f).map(f => {
            const parts = f.split(':'); return { name: parts[0], score: parseInt(parts[1]) };
        });

        // --- FILTRAGE DATA-DRIVEN DES DISCUSSIONS ET TENSIONS ---
        let chosenDiscussions = [];

        // 1. LA RUMEUR DE L'OMBRE (Si une Faction 2 est présente)
        if (factions.length > 1) {
            const fac2 = factions[1];
            // On cherche une tension adaptée au niveau d'influence de la Faction 2
            let validTensions = (tavernsData.tensions || []).filter(t => {
                const min = t.min_score || 1;
                const max = t.max_score || 5;
                return fac2.score >= min && fac2.score <= max;
            });

            if (validTensions.length > 0) {
                let tensionObj = validTensions[Math.floor(Math.random() * validTensions.length)];
                // On ajoute un marqueur visuel (une icône d'éclair) pour montrer que c'est une tension
                tensionObj.isTension = true; 
                chosenDiscussions.push(tensionObj);
            }
        }

        // 2. LES RUMEURS CLASSIQUES
        let validDiscussions = tavernsData.discussions.filter(d => {
            const frText = d.desc.fr || "";
            if (frText.includes("{Faction1}") && factions.length === 0) return false;
            // On retire Faction2 des rumeurs classiques pour la réserver aux Tensions
            if (frText.includes("{Faction2}")) return false; 

            const isGeneric = d.vibe_tags && d.vibe_tags.includes("all");
            if (isGeneric) return true;

            const matchVibe = !d.vibe_tags || d.vibe_tags.length === 0 || d.vibe_tags.some(t => vibeTags.includes(t));
            const matchGov = !d.gov_tags || d.gov_tags.length === 0 || d.gov_tags.some(t => govTags.includes(t));
            const matchEco = !d.eco_tags || d.eco_tags.length === 0 || d.eco_tags.some(t => ecoTags.includes(t));
            const matchBiome = !d.biome_tags || d.biome_tags.length === 0 || d.biome_tags.includes(biome);
            const matchWeather = !d.weather_tags || d.weather_tags.length === 0 || d.weather_tags.includes(weather);

            return matchVibe && matchGov && matchEco && matchBiome && matchWeather;
        });

        let preciseDiscussions = validDiscussions.filter(d => !d.vibe_tags || !d.vibe_tags.includes("all"));
        let genericDiscussions = validDiscussions.filter(d => d.vibe_tags && d.vibe_tags.includes("all"));

        let finalDiscussionsPool = [...preciseDiscussions.sort(() => 0.5 - Math.random()), ...genericDiscussions.sort(() => 0.5 - Math.random())];
        
        // On comble pour arriver à 3 rumeurs maximum
        const needed = 3 - chosenDiscussions.length;
        chosenDiscussions = chosenDiscussions.concat(finalDiscussionsPool.slice(0, needed));

        // --- REMPLACEMENT DES BALISES DYNAMIQUES ---
        let discussionsHTML = chosenDiscussions.map(disc => {
            let text = getText(disc.desc)
                .replace(/{NPC1}/g, `<strong class="cf-npc-highlight">${this.generateNPCName(namesData, regionId, cityName)}</strong>`)
                .replace(/{NPC2}/g, `<strong class="cf-npc-highlight">${this.generateNPCName(namesData, regionId, cityName)}</strong>`);

            if (factions.length > 0) text = text.replace(/{Faction1}/g, `<strong class="cf-faction1-highlight">${factions[0].name}</strong>`);
            if (factions.length > 1) text = text.replace(/{Faction2}/g, `<strong class="cf-faction2-highlight">${factions[1].name}</strong>`);

            // Si c'est une tension, on met une icône d'alerte rouge devant !
            const icon = disc.isTension ? `<i class="fas fa-bolt" style="color:#c0392b; margin-right:5px;" title="Tension Politique"></i>` : ``;
            return `<p class="cf-tavern-rumor">${icon}« ${text} »</p>`;
        }).join("");

        const roomEventText = getText(qData.room_events[Math.floor(Math.random() * qData.room_events.length)]);
        const qLabel = game.i18n.localize(`CITYFORGE.Tavern.Quality.${quality === 'faible' ? 'Poor' : (quality === 'elevee' ? 'Good' : 'Average')}`);

        // --- STRUCTURE HTML ÉPURÉE DE TOUT STYLE INLINE ---
        return `
            <div style="font-family: var(--font-primary);">
                <h2 class="cf-poi-title cf-quality-${quality}"><i class="fas fa-beer"></i> ${finalName}</h2>
                
                <div class="cf-poi-tags">
                    <span class="cf-poi-tag"><strong>${game.i18n.localize("CITYFORGE.Shop.Quality")} :</strong> <span class="cf-quality-${quality}">${qLabel}</span></span>
                    <span class="cf-poi-tag"><strong>${game.i18n.localize("CITYFORGE.Shop.District")} :</strong> ${district}</span>
                </div>
                
                <div class="cf-poi-info-box cf-quality-border-${quality}">
                    <p style="margin: 0 0 5px 0; color: #444;"><em>${quirkText}</em></p>
                    <p style="margin: 0; color: #444;"><strong><i class="fas fa-users"></i> ${game.i18n.localize("CITYFORGE.Tavern.Clientele")} :</strong> ${clientText}</p>
                </div>
                
                <h3 class="cf-poi-section-title"><i class="fas fa-id-badge"></i> ${game.i18n.localize("CITYFORGE.Shop.StaffTitle")}</h3>
                <ul class="cf-poi-staff-list">${staffListHTML}</ul>
                
                <div class="cf-grid-2">
                    <div>
                        <h3 class="cf-poi-section-title"><i class="fas fa-utensils"></i> ${game.i18n.localize("CITYFORGE.Tavern.MealsTitle")}</h3>
                        <ul class="cf-poi-menu-list">${mealsHTML}</ul>
                        
                        <h3 class="cf-poi-section-title"><i class="fas fa-wine-glass-alt"></i> ${game.i18n.localize("CITYFORGE.Tavern.DrinksTitle")}</h3>
                        <ul class="cf-poi-menu-list">${drinksHTML}</ul>
                    </div>
                    <div>
                        <h3 class="cf-poi-section-title"><i class="fas fa-concierge-bell"></i> ${game.i18n.localize("CITYFORGE.Tavern.ServicesTitle")}</h3>
                        <ul class="cf-poi-menu-list">
                            ${service1 ? `<li>${renderItem({ fr: getText(service1.desc), en: getText(service1.desc), price: service1.price })}</li>` : ''}
                            ${service2 ? `<li>${renderItem({ fr: getText(service2.desc), en: getText(service2.desc), price: service2.price })}</li>` : ''}
                        </ul>
                        
                        <div class="cf-tavern-discussions-box">
                            <h4 class="cf-tavern-discussions-title"><i class="fas fa-comments"></i> ${game.i18n.localize("CITYFORGE.Tavern.DiscussionsTitle")}</h4>
                            ${discussionsHTML}
                        </div>
                    </div>
                </div>
                
                <div class="cf-tavern-room-event">
                    <h4><i class="fas fa-bed"></i> ${game.i18n.localize("CITYFORGE.Tavern.RoomEventTitle")}</h4>
                    <p style="margin: 0; color: #555;">${roomEventText}</p>
                </div>
            </div>
        `;
    }
}