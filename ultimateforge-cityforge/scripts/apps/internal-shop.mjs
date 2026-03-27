export class InternalShopGenerator {

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

    static rollQuality(qualityTable) {
        let totalWeight = 0;
        for (let key in qualityTable) totalWeight += qualityTable[key];
        let random = Math.floor(Math.random() * totalWeight);
        for (let key in qualityTable) {
            random -= qualityTable[key];
            if (random < 0) return key;
        }
        return "q1"; 
    }

    static generateHTML(shopName, type, district, citySize, regionId, cityName, namesData, shopsData, biome, stateId, priceMult, currency) {
        
        const lang = game.i18n.lang.startsWith('en') ? 'en' : 'fr';
        const getText = (item) => (typeof item === 'object') ? (item[lang] || item.fr || "") : (item || "");
        
        let shopQualityLabel = "Moyenne";
        let nbItems = 5;
        let nbStaff = 1;

        // 1. QUALITÉ SELON LA TAILLE DE LA VILLE
        if (citySize === "Campement" || citySize === "Hameau") {
            shopQualityLabel = "Précaire"; nbItems = 3; nbStaff = 1;
        } else if (citySize === "Grande Cité") {
            shopQualityLabel = "Très bonne"; nbItems = 8; nbStaff = 2;
        } else if (citySize === "Métropole" || citySize === "Capitale") {
            shopQualityLabel = "Excellente"; nbItems = 12; nbStaff = 3;
        }

        const lootTables = {
            "Précaire":   { q0: 70, q1: 25, q2: 5,  q3: 0,  q4: 0 },
            "Moyenne":    { q0: 30, q1: 40, q2: 20, q3: 8,  q4: 2 },
            "Très bonne": { q0: 10, q1: 30, q2: 35, q3: 20, q4: 5 },
            "Excellente": { q0: 5,  q1: 20, q2: 40, q3: 25, q4: 10 }
        };

        // 2. CORRECTION DES NOMS DE BOUTIQUES
        let shopKey = type;
        
        // On fait le lien entre les mots de districts.json et les clés de shops_loot.json
        if (type.includes("forgeron")) shopKey = "forge";
        if (type.includes("travailleur_cuir") || type.includes("cuir")) shopKey = "tanneur";
        if (type.includes("cabinet_curiosite") || type.includes("curiosite")) shopKey = "curiosite";
        if (type.includes("marchand_noir")) shopKey = "marche_noir"; // <-- La correction est là !
        if (type.includes("esoterique") || type.includes("eso")) shopKey = "librairie_esoterique";
        if (type.includes("changeur") || type.includes("usurier")) shopKey = "changeur_monnaie";
        if (type.includes("graveur")) shopKey = "graveur_pierre";
        
        // Sécurité ultime si la clé n'est pas trouvée directement
        if (!shopsData[shopKey]) {
            const foundKey = Object.keys(shopsData).find(k => type.includes(k) || k.includes(type));
            shopKey = foundKey ? foundKey : "bazar"; // Si vraiment on ne trouve rien, on met Bazar
        }

        const fallbackItem = { name: { fr: "Objet générique", en: "Generic item" }, type: { fr: "Inconnu", en: "Unknown" }, price: 0, desc: { fr: "Rupture de stock.", en: "Out of stock." } };
        const shopDb = shopsData[shopKey] || { name: {fr: "Commerce", en: "Shop"}, ambiances: [{fr: "Une boutique ordinaire.", en:"Ordinary shop."}], items: { q0:[], q1:[fallbackItem], q2:[], q3:[], q4:[] } };
        
        const sName = getText(shopDb.name);

        // 3. GÉNÉRATION DU PROPRIÉTAIRE ET DU NOM DYNAMIQUE DE LA BOUTIQUE
        const ownerName = this.generateNPCName(namesData, regionId, cityName);
        
        let dynamicShopName = shopName;
        // On construit un nom stylé : "Forge de Boran" ou "Boran's Forge"
        if (lang === 'en') {
            dynamicShopName = `${ownerName}'s ${sName}`;
        } else {
            const vowels = ['A', 'E', 'I', 'O', 'U', 'Y', 'É', 'È', 'À', 'H'];
            const startsWithVowel = vowels.includes(ownerName.charAt(0).toUpperCase());
            const preposition = startsWithVowel ? "d'" : "de ";
            dynamicShopName = `${sName} ${preposition}${ownerName}`;
        }

        // 4. AMBIANCE ET REQUÊTES (Humeur du marchand)
        const ambianceObj = shopDb.ambiances[Math.floor(Math.random() * shopDb.ambiances.length)];
        const ambianceText = getText(ambianceObj);

        let validHooks = [];
        if (shopDb.hooks && shopDb.hooks.length > 0) {
            validHooks = shopDb.hooks.filter(h => {
                const matchState = !h.states || h.states.includes("all") || h.states.includes(stateId);
                const matchBiome = !h.biomes || h.biomes.includes("all") || h.biomes.includes(biome);
                return matchState && matchBiome;
            });
        }

        let hookText = "";
        if (validHooks.length > 0) {
            const hookObj = validHooks[Math.floor(Math.random() * validHooks.length)];
            hookText = getText(hookObj.desc);
        } else {
            hookText = lang === 'en' ? "The merchant has nothing special to ask for today." : "Le marchand n'a rien de spécial à demander aujourd'hui.";
        }

        // 5. GÉNÉRATION DU PERSONNEL
        const ownerLabel = lang === 'en' ? 'Owner' : 'Propriétaire';
        const staffList = [];
        staffList.push(`<li><strong>${ownerLabel} :</strong> ${ownerName}</li>`);
        if (nbStaff >= 2) staffList.push(`<li><strong>${lang === 'en' ? 'Apprentice' : 'Apprenti'} :</strong> ${this.generateNPCName(namesData, regionId, cityName)}</li>`);
        if (nbStaff >= 3) staffList.push(`<li><strong>${lang === 'en' ? 'Guard' : 'Garde'} :</strong> ${this.generateNPCName(namesData, regionId, cityName)}</li>`);

        const qualityColors = { q0: "#7f8c8d", q1: "#27ae60", q2: "#2980b9", q3: "#8e44ad", q4: "#f39c12" };
        
        // 6. CRÉATION DU TABLEAU D'INVENTAIRE
        let tableHTML = `
            <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.9em; margin-top: 10px;">
                <thead>
                    <tr style="background: rgba(142, 68, 173, 0.2); border-bottom: 2px solid #8e44ad;">
                        <th style="padding: 8px; width: 5%;">Q</th>
                        <th style="padding: 8px; width: 45%;">${lang === 'en' ? 'Item & Description' : 'Objet & Description'}</th>
                        <th style="padding: 8px; width: 25%;">${lang === 'en' ? 'Category' : 'Catégorie'}</th>
                        <th style="padding: 8px; width: 25%; text-align: right;">${lang === 'en' ? 'Price' : 'Prix'}</th>
                    </tr>
                </thead>
                <tbody>
        `;

        for (let i = 0; i < nbItems; i++) {
            let rolledQ = this.rollQuality(lootTables[shopQualityLabel]);
            
            while (!shopDb.items[rolledQ] || shopDb.items[rolledQ].length === 0) {
                let qNum = parseInt(rolledQ.replace('q', ''));
                if (qNum >= 4) { rolledQ = "q1"; break; } 
                rolledQ = `q${qNum + 1}`;
            }

            const itemArray = shopDb.items[rolledQ] && shopDb.items[rolledQ].length > 0 ? shopDb.items[rolledQ] : [fallbackItem];
            const randomItem = itemArray[Math.floor(Math.random() * itemArray.length)];
            
            const iName = getText(randomItem.name);
            const iDesc = getText(randomItem.desc);
            const iType = getText(randomItem.type);
            
            const finalPrice = Math.max(1, Math.round(randomItem.price * priceMult));

            tableHTML += `
                <tr style="border-bottom: 1px solid rgba(0,0,0,0.1);">
                    <td style="padding: 8px; text-align: center;">
                        <span style="display:inline-block; width:12px; height:12px; background:${qualityColors[rolledQ]}; border-radius:50%;" title="Qualité ${rolledQ.toUpperCase()}"></span>
                    </td>
                    <td style="padding: 8px;">
                        <strong>${iName}</strong><br>
                        <span style="font-size: 0.85em; color: #555; font-style: italic;">${iDesc}</span>
                    </td>
                    <td style="padding: 8px; color: #2c3e50;">${iType}</td>
                    <td style="padding: 8px; text-align: right; font-weight: bold; color: #d35400;">${finalPrice} ${currency}</td>
                </tr>
            `;
        }

        tableHTML += `</tbody></table>`;

        return `
            <div style="font-family: var(--font-primary);">
                <h2 style="color: #8e44ad; border-bottom: 2px solid #8e44ad;"><i class="fas fa-store"></i> ${dynamicShopName}</h2>
                <div style="display: flex; gap: 10px; margin-bottom: 15px;">
                    <span style="background: #eee; padding: 4px 8px; border-radius: 4px; font-size: 0.9em;"><strong>Quartier :</strong> ${district}</span>
                    <span style="background: #eee; padding: 4px 8px; border-radius: 4px; font-size: 0.9em;"><strong>Type :</strong> ${sName}</span>
                    <span style="background: #eee; padding: 4px 8px; border-radius: 4px; font-size: 0.9em;"><strong>Qualité :</strong> ${shopQualityLabel}</span>
                </div>

                <div style="background: rgba(142, 68, 173, 0.1); padding: 10px; border-radius: 5px; margin-bottom: 15px;">
                    <h3 style="margin-top: 0; color: #8e44ad;"><i class="fas fa-id-badge"></i> Le Personnel</h3>
                    <ul style="list-style-type: none; padding-left: 0; margin-bottom: 10px;">${staffList.join("")}</ul>
                    <p style="color:#444; margin-top:5px;"><em>${ambianceText}</em></p>
                    
                    <div style="margin-top: 15px; border-left: 3px solid #e67e22; padding-left: 10px; background: #fdf5e6; padding: 10px; border-radius: 4px;">
                        <strong><i class="fas fa-comment-dots"></i> Humeur & Requête de ${ownerName} :</strong><br>
                        <span style="color: #555; font-style: italic;">« ${hookText} »</span>
                    </div>
                </div>

                <h3><i class="fas fa-boxes"></i> Inventaire Disponible (${nbItems} objets tirés)</h3>
                <p style="font-size: 0.85em; color: #7f8c8d; margin-top:-5px; margin-bottom: 10px;"><em>* Les prix tiennent compte de la conjoncture locale (Multiplicateur : x${priceMult})</em></p>
                ${tableHTML}
            </div>
        `;
    }
}