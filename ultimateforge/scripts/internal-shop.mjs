export class InternalShopGenerator {

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

    static generateHTML(shopName, type, district, citySize, regionId, cityName, namesData, shopsData, biome, stateId, priceMult, currency, govTags = [], ecoTags = [], vibeTags = [], weather = "clear") {

        const lang = game.i18n.lang.startsWith('en') ? 'en' : 'fr';
        const getText = (item) => (typeof item === 'object') ? (item[lang] || item.fr || "") : (item || "");

        let shopQualityKey = "Average";
        let nbItems = 5;
        let nbStaff = 1;

        if (citySize === "Campement" || citySize === "Hameau") {
            shopQualityKey = "Poor"; nbItems = 3; nbStaff = 1;
        } else if (citySize === "Grande Cité") {
            shopQualityKey = "Good"; nbItems = 8; nbStaff = 2;
        } else if (citySize === "Métropole" || citySize === "Capitale") {
            shopQualityKey = "Excellent"; nbItems = 12; nbStaff = 3;
        }

        const lootTables = {
            "Poor": { q0: 70, q1: 25, q2: 5, q3: 0, q4: 0 },
            "Average": { q0: 30, q1: 40, q2: 20, q3: 8, q4: 2 },
            "Good": { q0: 10, q1: 30, q2: 35, q3: 20, q4: 5 },
            "Excellent": { q0: 5, q1: 20, q2: 40, q3: 25, q4: 10 }
        };

        let shopKey = type;
        if (type.includes("forgeron")) shopKey = "forge";
        if (type.includes("travailleur_cuir") || type.includes("cuir")) shopKey = "tanneur";
        if (type.includes("cabinet_curiosite") || type.includes("curiosite")) shopKey = "curiosite";
        if (type.includes("marchand_noir")) shopKey = "marche_noir";
        if (type.includes("esoterique") || type.includes("eso")) shopKey = "librairie_esoterique";
        if (type.includes("changeur") || type.includes("usurier")) shopKey = "changeur_monnaie";
        if (type.includes("graveur")) shopKey = "graveur_pierre";

        if (!shopsData[shopKey]) {
            const foundKey = Object.keys(shopsData).find(k => type.includes(k) || k.includes(type));
            shopKey = foundKey ? foundKey : "bazar";
        }

        const fallbackItem = { name: { fr: "Objet générique", en: "Generic item" }, type: { fr: "Inconnu", en: "Unknown" }, price: 0, desc: { fr: "Rupture de stock.", en: "Out of stock." } };
        const shopDb = shopsData[shopKey] || { name: { fr: "Commerce", en: "Shop" }, ambiances: [{ fr: "Une boutique ordinaire.", en: "Ordinary shop." }], items: { q0: [], q1: [fallbackItem], q2: [], q3: [], q4: [] } };

        const sName = getText(shopDb.name);
        const ownerName = this.generateNPCName(namesData, regionId, cityName);

        let dynamicShopName = shopName;
        if (lang === 'en') {
            dynamicShopName = `${ownerName}'s ${sName}`;
        } else {
            const vowels = ['A', 'E', 'I', 'O', 'U', 'Y', 'É', 'È', 'À', 'H'];
            const startsWithVowel = vowels.includes(ownerName.charAt(0).toUpperCase());
            const preposition = startsWithVowel ? "d'" : "de ";
            dynamicShopName = `${sName} ${preposition}${ownerName}`;
        }

        const ambianceObj = shopDb.ambiances[Math.floor(Math.random() * shopDb.ambiances.length)];
        const ambianceText = getText(ambianceObj);

        // --- NOUVEAU FILTRAGE DES HOOKS (RUMEURS DE BOUTIQUE EN CASCADE) ---
        let validHooks = [];
        if (shopDb.hooks && shopDb.hooks.length > 0) {
            
            // ÉTAPE 1 : Filtrage Strict (Le contexte correspond parfaitement)
            const strictHooks = shopDb.hooks.filter(h => {
                if (h.vibe_tags && h.vibe_tags.includes("all")) return true;
                const matchVibe = !h.vibe_tags || h.vibe_tags.length === 0 || h.vibe_tags.some(t => vibeTags.includes(t));
                const matchGov = !h.gov_tags || h.gov_tags.length === 0 || h.gov_tags.some(t => govTags.includes(t));
                const matchEco = !h.eco_tags || h.eco_tags.length === 0 || h.eco_tags.some(t => ecoTags.includes(t));
                const matchBiome = !h.biome_tags || h.biome_tags.length === 0 || h.biome_tags.includes(biome);
                const matchWeather = !h.weather_tags || h.weather_tags.length === 0 || h.weather_tags.includes(weather);
                return matchVibe && matchGov && matchEco && matchBiome && matchWeather;
            });

            if (strictHooks.length > 0) {
                validHooks = strictHooks;
            } else {
                // ÉTAPE 2 : Filtrage Souple (Au moins UN élément du contexte correspond)
                const looseHooks = shopDb.hooks.filter(h => {
                    const matchVibe = h.vibe_tags && h.vibe_tags.some(t => vibeTags.includes(t));
                    const matchGov = h.gov_tags && h.gov_tags.some(t => govTags.includes(t));
                    const matchEco = h.eco_tags && h.eco_tags.some(t => ecoTags.includes(t));
                    const matchBiome = h.biome_tags && h.biome_tags.includes(biome);
                    return matchVibe || matchGov || matchEco || matchBiome;
                });

                if (looseHooks.length > 0) {
                    validHooks = looseHooks;
                } else {
                    // ÉTAPE 3 : Fallback d'ambiance (On prend au hasard pour éviter le silence)
                    validHooks = shopDb.hooks;
                }
            }
        }
        let hookText = validHooks.length > 0 ? getText(validHooks[Math.floor(Math.random() * validHooks.length)].desc) : game.i18n.localize("CITYFORGE.Shop.NoHook");
        // ---------------------------------------------------------

        const ownerLabel = game.i18n.localize("CITYFORGE.Shop.Owner");
        const apprenticeLabel = game.i18n.localize("CITYFORGE.Shop.Apprentice");
        const guardLabel = game.i18n.localize("CITYFORGE.Shop.Guard");

        const staffList = [];
        staffList.push(`<li><strong>${ownerLabel} :</strong> ${ownerName}</li>`);
        if (nbStaff >= 2) staffList.push(`<li><strong>${apprenticeLabel} :</strong> ${this.generateNPCName(namesData, regionId, cityName)}</li>`);
        if (nbStaff >= 3) staffList.push(`<li><strong>${guardLabel} :</strong> ${this.generateNPCName(namesData, regionId, cityName)}</li>`);

        const qualityColors = { q0: "#7f8c8d", q1: "#27ae60", q2: "#2980b9", q3: "#8e44ad", q4: "#f39c12" };
        const qTip = game.i18n.localize("CITYFORGE.Shop.QualityTip");

        let tableHTML = `
            <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.9em; margin-top: 10px;">
                <thead>
                    <tr style="background: rgba(142, 68, 173, 0.2); border-bottom: 2px solid #8e44ad;">
                        <th style="padding: 8px; width: 5%;">Q</th>
                        <th style="padding: 8px; width: 45%;">${game.i18n.localize("CITYFORGE.Shop.ColItem")}</th>
                        <th style="padding: 8px; width: 25%;">${game.i18n.localize("CITYFORGE.Shop.ColCategory")}</th>
                        <th style="padding: 8px; width: 25%; text-align: right;">${game.i18n.localize("CITYFORGE.Shop.ColPrice")}</th>
                    </tr>
                </thead>
                <tbody>
        `;

        for (let i = 0; i < nbItems; i++) {
            let rolledQ = this.rollQuality(lootTables[shopQualityKey]);

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
                        <span style="display:inline-block; width:12px; height:12px; background:${qualityColors[rolledQ]}; border-radius:50%;" title="${qTip} ${rolledQ.toUpperCase()}"></span>
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
        const shopQualityLabel = game.i18n.localize(`CITYFORGE.Shop.Qualities.${shopQualityKey}`);

        return `
            <div style="font-family: var(--font-primary);">
                <h2 style="color: #8e44ad; border-bottom: 2px solid #8e44ad;"><i class="fas fa-store"></i> ${dynamicShopName}</h2>
                <div style="display: flex; gap: 10px; margin-bottom: 15px;">
                    <span style="background: #eee; padding: 4px 8px; border-radius: 4px; font-size: 0.9em;"><strong>${game.i18n.localize("CITYFORGE.Shop.District")} :</strong> ${district}</span>
                    <span style="background: #eee; padding: 4px 8px; border-radius: 4px; font-size: 0.9em;"><strong>${game.i18n.localize("CITYFORGE.Shop.Type")} :</strong> ${sName}</span>
                    <span style="background: #eee; padding: 4px 8px; border-radius: 4px; font-size: 0.9em;"><strong>${game.i18n.localize("CITYFORGE.Shop.Quality")} :</strong> ${shopQualityLabel}</span>
                </div>

                <div style="background: rgba(142, 68, 173, 0.1); padding: 10px; border-radius: 5px; margin-bottom: 15px;">
                    <h3 style="margin-top: 0; color: #8e44ad;"><i class="fas fa-id-badge"></i> ${game.i18n.localize("CITYFORGE.Shop.StaffTitle")}</h3>
                    <ul style="list-style-type: none; padding-left: 0; margin-bottom: 10px;">${staffList.join("")}</ul>
                    <p style="color:#444; margin-top:5px;"><em>${ambianceText}</em></p>
                    
                    <div style="margin-top: 15px; border-left: 3px solid #e67e22; padding-left: 10px; background: #fdf5e6; padding: 10px; border-radius: 4px;">
                        <strong><i class="fas fa-comment-dots"></i> ${game.i18n.format("CITYFORGE.Shop.HookTitle", { name: ownerName })} :</strong><br>
                        <span style="color: #555; font-style: italic;">« ${hookText} »</span>
                    </div>
                </div>

                <h3><i class="fas fa-boxes"></i> ${game.i18n.format("CITYFORGE.Shop.InventoryTitle", { count: nbItems })}</h3>
                <p style="font-size: 0.85em; color: #7f8c8d; margin-top:-5px; margin-bottom: 10px;"><em>${game.i18n.format("CITYFORGE.Shop.PriceDisclaimer", { mult: priceMult })}</em></p>
                ${tableHTML}
            </div>
        `;
    }
}