export class InternalNpcGenerator {
    static generate(npcName, governanceDesc, citySize, regionId, cityName, race = "Humain", npcsData, leaderTitle = "Dirigeant") {
        const lang = game.i18n.lang.startsWith('en') ? 'en' : 'fr';
        const getText = (item) => (typeof item === 'object') ? (item[lang] || item.fr || "") : (item || "");
        
        let rankKey = "Vétéran";
        if (citySize === "Campement" || citySize === "Hameau") rankKey = "Sbire";
        else if (citySize === "Grande Cité") rankKey = "Élite";
        else if (citySize === "Métropole" || citySize === "Capitale") rankKey = "Boss";

        const rankData = npcsData.ranks[rankKey];
        const pvi = rankData.pvi;
        const pve = rankData.pve;

        const arme = getText(rankData.armes[Math.floor(Math.random() * rankData.armes.length)]);
        const tenue = getText(rankData.tenues[Math.floor(Math.random() * rankData.tenues.length)]);
        const appearance = getText(npcsData.appearances[Math.floor(Math.random() * npcsData.appearances.length)]);
        const trait = getText(npcsData.traits[Math.floor(Math.random() * npcsData.traits.length)]);
        const secret = getText(npcsData.secrets[Math.floor(Math.random() * npcsData.secrets.length)]);
        const lootItem = getText(npcsData.loot[Math.floor(Math.random() * npcsData.loot.length)]);

        const roleLabel = `${leaderTitle} ${lang === 'en' ? 'of' : 'de'} ${cityName}`;
        const keysLabel = game.i18n.localize("CITYFORGE.NPC.Keys");

        const html = `
            <div style="font-family: var(--font-primary);">
                <h2 style="color: #2980b9; border-bottom: 2px solid #2980b9;"><i class="fas fa-crown"></i> ${npcName}</h2>
                <div style="display: flex; gap: 10px; margin-bottom: 15px;">
                    <span style="background: #eee; padding: 4px 8px; border-radius: 4px; font-size: 0.9em;"><strong>${game.i18n.localize("CITYFORGE.NPC.Role")} :</strong> ${roleLabel}</span>
                    <span style="background: #eee; padding: 4px 8px; border-radius: 4px; font-size: 0.9em;"><strong>${game.i18n.localize("CITYFORGE.NPC.Race")} :</strong> ${race}</span>
                    <span style="background: #eee; padding: 4px 8px; border-radius: 4px; font-size: 0.9em;"><strong>${game.i18n.localize("CITYFORGE.NPC.Rank")} :</strong> ${rankKey.toUpperCase()}</span>
                </div>
                
                <div style="background: rgba(41, 128, 185, 0.1); padding: 10px; border-left: 3px solid #2980b9; margin-bottom: 15px;">
                    <strong>${game.i18n.localize("CITYFORGE.NPC.GovType")} :</strong> ${governanceDesc}
                </div>

                <h3><i class="fas fa-eye"></i> ${game.i18n.localize("CITYFORGE.NPC.ProfileTitle")}</h3>
                <ul>
                    <li><strong>${game.i18n.localize("CITYFORGE.NPC.Appearance")} :</strong> ${appearance}</li>
                    <li><strong>${game.i18n.localize("CITYFORGE.NPC.Character")} :</strong> ${trait}</li>
                    <li><strong>${game.i18n.localize("CITYFORGE.NPC.Secret")} :</strong> <span style="color:#c0392b;">${secret}</span></li>
                </ul>

                <h3><i class="fas fa-shield-alt"></i> ${game.i18n.localize("CITYFORGE.NPC.LootTitle")}</h3>
                <ul>
                    <li><strong>${game.i18n.localize("CITYFORGE.NPC.Weapon")} :</strong> ${arme}</li>
                    <li><strong>${game.i18n.localize("CITYFORGE.NPC.Armor")} :</strong> ${tenue}</li>
                    <li><strong>${game.i18n.localize("CITYFORGE.NPC.Pockets")} :</strong> ${lootItem}, ${keysLabel}.</li>
                </ul>
            </div>
        `;

        const textBio = `=== PROFIL ===\nRôle : ${roleLabel}\nRace : ${race}\nRang : ${rankKey.toUpperCase()}\nGouvernance : ${governanceDesc}\n\n=== PERSONNALITÉ & SECRET ===\nApparence : ${appearance}\nCaractère : ${trait}\nSecret : ${secret}`;

        return { html, textBio, stats: { rank: rankKey, pvi, pve, appearance, trait }, items: { arme, tenue, loot: [lootItem, keysLabel] } };
    }
}