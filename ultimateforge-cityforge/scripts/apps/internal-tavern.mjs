export class InternalTavernGenerator {

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

    // N'oublie pas : le paramètre currency a été ajouté ici !
    static generateHTML(tavernName, tavernType, district, citySize, regionId, cityName, namesData, tavernsData, biome, stateId, priceMult, currency, govTags, ecoTags, vibeTags) {
        
        const lang = game.i18n.lang.startsWith('en') ? 'en' : 'fr';
        const getText = (item) => (typeof item === 'object') ? (item[lang] || item.fr || "") : (item || "");
        const allContextTags = [...govTags, ...ecoTags, ...vibeTags, stateId, biome];
        
        // 1. DÉFINITION DE LA QUALITÉ
        let quality = "moyenne";
        if (tavernType.includes("louche")) quality = "faible";
        if (tavernType.includes("luxueuse")) quality = "elevee";
        const qData = tavernsData.qualities[quality];

        // 2. LE PERSONNEL
        const ownerName = this.generateNPCName(namesData, regionId, cityName);
        const ownerTitle = lang === 'en' ? 'Tavern Keeper' : 'Tavernier';
        const ownerTrait = getText(qData.staff_roles.owner_traits[Math.floor(Math.random() * qData.staff_roles.owner_traits.length)]);

        // 3. GÉNÉRATION DU NOM DYNAMIQUE
        let finalName = tavernName;
        if (tavernName.startsWith("Taverne") && tavernsData.name_parts) {
            const useOwnerName = Math.random() < 0.3; 
            if (useOwnerName) {
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

        // 4. AMBIANCE & CLIENTÈLE
        const quirkText = getText(qData.quirks[Math.floor(Math.random() * qData.quirks.length)]);
        const clientText = getText(qData.clientele[Math.floor(Math.random() * qData.clientele.length)]);

        // 5. LES SERVICES (ET PERSONNEL SPÉCIALISÉ ASSOCIÉ)
        const sShuffled = qData.services.sort(() => 0.5 - Math.random());
        const service1 = sShuffled[0];
        const service2 = sShuffled[1];
        
        let extraStaffFromServices = [];
        if (service1 && service1.trigger_staff) extraStaffFromServices.push(getText(service1.trigger_staff));
        if (service2 && service2.trigger_staff) extraStaffFromServices.push(getText(service2.trigger_staff));

        // 6. CONSTRUCTION DE LA LISTE DU STAFF HTML
        let staffListHTML = `<li><strong><i class="fas fa-user-tie"></i> ${ownerTitle} :</strong> ${ownerName}, ${ownerTrait}</li>`;
        
        qData.staff_roles.others.forEach(staff => {
            const sName = this.generateNPCName(namesData, regionId, cityName);
            staffListHTML += `<li><strong>${getText(staff.role)} :</strong> ${sName}, ${getText(staff.trait)}</li>`;
        });

        extraStaffFromServices.forEach(role => {
            const sName = this.generateNPCName(namesData, regionId, cityName);
            staffListHTML += `<li><strong><i class="fas fa-star"></i> ${role} :</strong> ${sName}, ${lang==='en'?'dedicated to the service.':'dédié(e) au service.'}</li>`;
        });

        if (["Campement", "Hameau", "Village"].includes(citySize)) {
            const stableBoyName = this.generateNPCName(namesData, regionId, cityName);
            const stableBoyTitle = lang === 'en' ? "Stable Boy (Owner's child)" : "Palefrenier (Enfant du patron)";
            staffListHTML += `<li><strong><i class="fas fa-horse"></i> ${stableBoyTitle} :</strong> ${stableBoyName}, ${lang==='en'?"taking care of mounts outside.":"s'occupe des montures à l'extérieur."}</li>`;
        }

        // 7. LES MENUS & BOISSONS (AVEC QUOTAS DYNAMIQUES)
        let nbMeals = 2;
        let nbDrinks = 3;
        if (quality === "faible") { nbMeals = 1; nbDrinks = 2; }
        else if (quality === "elevee") { nbMeals = 3; nbDrinks = 4; }

        const renderItem = (item) => {
            if (!item) return "";
            const name = getText(item);
            const price = Math.max(1, Math.round(item.price * priceMult));
            return `<span>${name}</span> <strong style="color:#d35400; float:right;">${price} ${currency}</strong>`;
        };

        // Repas
        const mShuffled = qData.menus.sort(() => 0.5 - Math.random());
        const selectedMeals = mShuffled.slice(0, Math.min(nbMeals, mShuffled.length));
        let mealsHTML = "";
        selectedMeals.forEach(m => {
            mealsHTML += `<li style="margin-bottom: 5px; border-bottom: 1px dashed #ddd; padding-bottom: 3px;">${renderItem(m)}</li>`;
        });

        // Boissons
        let availableDrinks = [...qData.drinks];
        if (tavernsData.regional_drinks) {
            const localSignatures = tavernsData.regional_drinks.filter(d => d.id_region === regionId);
            if (localSignatures.length > 0) availableDrinks.push(localSignatures[0]);
        }
        const dShuffled = availableDrinks.sort(() => 0.5 - Math.random());
        const selectedDrinks = dShuffled.slice(0, Math.min(nbDrinks, dShuffled.length));
        let drinksHTML = "";
        selectedDrinks.forEach(d => {
            drinksHTML += `<li style="margin-bottom: 5px; border-bottom: 1px dashed #ddd; padding-bottom: 3px;">${renderItem(d)}</li>`;
        });


        // 8. DISCUSSIONS DE COMPTOIR
        let preciseDiscussions = tavernsData.discussions.filter(d => !d.tags.includes("all") && d.tags.some(t => allContextTags.includes(t)));
        let genericDiscussions = tavernsData.discussions.filter(d => d.tags.includes("all"));
        
        preciseDiscussions.sort(() => 0.5 - Math.random());
        genericDiscussions.sort(() => 0.5 - Math.random());
        
        let finalDiscussionsPool = [...preciseDiscussions, ...genericDiscussions];
        let chosenDiscussions = finalDiscussionsPool.slice(0, Math.min(3, finalDiscussionsPool.length));
        
        let discussionsHTML = "";
        chosenDiscussions.forEach(disc => {
            let text = getText(disc.desc);
            text = text.replace(/{NPC1}/g, `<strong>${this.generateNPCName(namesData, regionId, cityName)}</strong>`);
            text = text.replace(/{NPC2}/g, `<strong>${this.generateNPCName(namesData, regionId, cityName)}</strong>`);
            discussionsHTML += `<p style="margin: 0 0 10px 0; font-style: italic; color: #555; padding-bottom: 5px; border-bottom: 1px dashed #f5cba7;">« ${text} »</p>`;
        });

        // 9. ÉVÉNEMENT EN CHAMBRE
        const roomEventText = getText(qData.room_events[Math.floor(Math.random() * qData.room_events.length)]);

        // 10. PRÉSENTATION HTML
        const qColor = quality === "faible" ? "#7f8c8d" : (quality === "elevee" ? "#f39c12" : "#27ae60");
        const qLabel = quality === "faible" ? (lang === 'en' ? "Shady Tavern" : "Taverne Louche") : 
                      (quality === "elevee" ? (lang === 'en' ? "Luxurious Tavern" : "Taverne Luxueuse") : 
                      (lang === 'en' ? "Standard Tavern" : "Auberge Honnête"));

        const mealsTitle = lang === 'en' ? 'Meals' : 'À Manger';
        const drinksTitle = lang === 'en' ? 'Drinks' : 'À Boire';

        return `
            <div style="font-family: var(--font-primary);">
                <h2 style="color: ${qColor}; border-bottom: 2px solid ${qColor}; margin-bottom: 5px;">
                    <i class="fas fa-beer"></i> ${finalName}
                </h2>
                
                <div style="display: flex; gap: 10px; margin-bottom: 15px; flex-wrap: wrap;">
                    <span style="background: #eee; padding: 4px 8px; border-radius: 4px; font-size: 0.9em;"><strong>${lang === 'en' ? 'Quality' : 'Qualité'} :</strong> <span style="color:${qColor}; font-weight:bold;">${qLabel}</span></span>
                    <span style="background: #eee; padding: 4px 8px; border-radius: 4px; font-size: 0.9em;"><strong>${lang === 'en' ? 'District' : 'Quartier'} :</strong> ${district}</span>
                </div>

                <div style="background: rgba(0,0,0,0.03); padding: 15px; border-left: 4px solid ${qColor}; border-radius: 0 5px 5px 0; margin-bottom: 20px;">
                    <p style="margin: 0 0 5px 0; color: #444;"><em>${quirkText}</em></p>
                    <p style="margin: 0; color: #444;"><strong><i class="fas fa-users"></i> ${lang==='en'?'Clientele':'Clientèle'} :</strong> ${clientText}</p>
                </div>

                <h3 style="color: #2c3e50; border-bottom: 1px solid #bdc3c7;"><i class="fas fa-id-badge"></i> ${lang === 'en' ? 'The Staff' : 'L\'Équipe'}</h3>
                <ul style="list-style-type: none; padding-left: 0; margin-bottom: 20px; color: #333;">
                    ${staffListHTML}
                </ul>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
                    <div>
                        <h3 style="color: #2c3e50; border-bottom: 1px solid #bdc3c7; margin-top: 0;"><i class="fas fa-utensils"></i> ${mealsTitle}</h3>
                        <ul style="list-style-type: none; padding-left: 0; margin-top: 5px;">
                            ${mealsHTML}
                        </ul>

                        <h3 style="color: #2c3e50; border-bottom: 1px solid #bdc3c7; margin-top: 15px;"><i class="fas fa-wine-glass-alt"></i> ${drinksTitle}</h3>
                        <ul style="list-style-type: none; padding-left: 0; margin-top: 5px;">
                            ${drinksHTML}
                        </ul>
                    </div>
                    
                    <div>
                        <h3 style="color: #2c3e50; border-bottom: 1px solid #bdc3c7; margin-top: 0;"><i class="fas fa-concierge-bell"></i> ${lang === 'en' ? 'Services' : 'Services'}</h3>
                        <ul style="list-style-type: none; padding-left: 0; margin-top: 5px;">
                            ${service1 ? `<li style="margin-bottom: 5px; border-bottom: 1px dashed #ddd; padding-bottom: 3px;">${renderItem({fr: getText(service1.desc), en: getText(service1.desc), price: service1.price})}</li>` : ''}
                            ${service2 ? `<li style="margin-bottom: 5px; border-bottom: 1px dashed #ddd; padding-bottom: 3px;">${renderItem({fr: getText(service2.desc), en: getText(service2.desc), price: service2.price})}</li>` : ''}
                        </ul>

                        <div style="background: #fdf5e6; border: 1px solid #e67e22; padding: 15px; border-radius: 5px; margin-top: 15px;">
                            <h4 style="margin: 0 0 8px 0; color: #d35400;"><i class="fas fa-comments"></i> ${lang === 'en' ? 'Animated Discussions' : 'Discussions animées'}</h4>
                            ${discussionsHTML}
                        </div>
                    </div>
                </div>

                <div style="background: #f4f6f7; border: 1px solid #bdc3c7; padding: 15px; border-radius: 5px;">
                    <h4 style="margin: 0 0 8px 0; color: #7f8c8d;"><i class="fas fa-bed"></i> ${lang === 'en' ? 'If a room is rented...' : 'Si une chambre est louée...'}</h4>
                    <p style="margin: 0; color: #555;">${roomEventText}</p>
                </div>
            </div>
        `;
    }
}