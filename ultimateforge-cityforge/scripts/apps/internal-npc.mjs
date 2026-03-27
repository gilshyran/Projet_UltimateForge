export class InternalNpcGenerator {

    static generate(npcName, governanceDesc, citySize, regionId, cityName, race = "Humain", npcsData, leaderTitle = "Dirigeant") {
        
        const lang = game.i18n.lang.startsWith('en') ? 'en' : 'fr';
        // La fonction magique universelle
        const getText = (item) => (typeof item === 'object') ? (item[lang] || item.fr || "") : (item || "");
        
        // 1. Détermination du rang selon la taille de la ville
        let rankKey = "Vétéran";
        if (citySize === "Campement" || citySize === "Hameau") rankKey = "Sbire";
        else if (citySize === "Grande Cité") rankKey = "Élite";
        else if (citySize === "Métropole" || citySize === "Capitale") rankKey = "Boss";

        // 2. Récupération des données du JSON
        const rankData = npcsData.ranks[rankKey];
        const pvi = rankData.pvi;
        const pve = rankData.pve;

        // Tirage aléatoire de l'arme et tenue depuis le JSON
        const randomWeapon = rankData.armes[Math.floor(Math.random() * rankData.armes.length)];
        const randomArmor = rankData.tenues[Math.floor(Math.random() * rankData.tenues.length)];
        const arme = getText(randomWeapon);
        const tenue = getText(randomArmor);

        // Tirage aléatoire de l'histoire et du loot
        const rApp = npcsData.appearances[Math.floor(Math.random() * npcsData.appearances.length)];
        const appearance = getText(rApp);

        const rTrait = npcsData.traits[Math.floor(Math.random() * npcsData.traits.length)];
        const trait = getText(rTrait);

        const rSec = npcsData.secrets[Math.floor(Math.random() * npcsData.secrets.length)];
        const secret = getText(rSec);

        const rLoot = npcsData.loot[Math.floor(Math.random() * npcsData.loot.length)];
        const lootItem = getText(rLoot);

        
        const roleLabel = `${leaderTitle} de ${cityName}`;
        const rankLabel = lang === 'en' ? 'Rank' : 'Rang';
        const raceLabel = lang === 'en' ? 'Race' : 'Race';
        const govLabel = lang === 'en' ? 'Governance Type' : 'Type de Gouvernance';
        const keysLabel = lang === 'en' ? 'Keys to the city' : 'Clés de la ville';

        const html = `
            <div style="font-family: var(--font-primary);">
                <h2 style="color: #2980b9; border-bottom: 2px solid #2980b9;"><i class="fas fa-crown"></i> ${npcName}</h2>
                <div style="display: flex; gap: 10px; margin-bottom: 15px;">
                    <span style="background: #eee; padding: 4px 8px; border-radius: 4px; font-size: 0.9em;"><strong>Rôle :</strong> ${roleLabel}</span>
                    <span style="background: #eee; padding: 4px 8px; border-radius: 4px; font-size: 0.9em;"><strong>${raceLabel} :</strong> ${race}</span>
                    <span style="background: #eee; padding: 4px 8px; border-radius: 4px; font-size: 0.9em;"><strong>${rankLabel} :</strong> ${rankKey.toUpperCase()}</span>
                </div>
                
                <div style="background: rgba(41, 128, 185, 0.1); padding: 10px; border-left: 3px solid #2980b9; margin-bottom: 15px;">
                    <strong>${govLabel} :</strong> ${governanceDesc}
                </div>

                <h3><i class="fas fa-eye"></i> ${lang === 'en' ? 'Profile & Personality' : 'Profil & Personnalité'}</h3>
                <ul>
                    <li><strong>${lang === 'en' ? 'Appearance' : 'Apparence'} :</strong> ${appearance}</li>
                    <li><strong>${lang === 'en' ? 'Character' : 'Caractère'} :</strong> ${trait}</li>
                    <li><strong>${lang === 'en' ? 'Secret / Rumor' : 'Secret / Rumeur'} :</strong> <span style="color:#c0392b;">${secret}</span></li>
                </ul>

                <h3><i class="fas fa-shield-alt"></i> ${lang === 'en' ? 'Equipment & Loot' : 'Équipement & Butin'}</h3>
                <ul>
                    <li><strong>${lang === 'en' ? 'Weapon' : 'Arme'} :</strong> ${arme}</li>
                    <li><strong>${lang === 'en' ? 'Armor' : 'Protection'} :</strong> ${tenue}</li>
                    <li><strong>${lang === 'en' ? 'In pockets' : 'Dans ses poches'} :</strong> ${lootItem}, ${keysLabel}.</li>
                </ul>
            </div>
        `;

        const textBio = `=== PROFIL ===\nRôle : ${roleLabel}\nRace : ${race}\nRang : ${rankKey.toUpperCase()}\nGouvernance : ${governanceDesc}\n\n=== PERSONNALITÉ & SECRET ===\nApparence : ${appearance}\nCaractère : ${trait}\nSecret : ${secret}`;

        return {
            html: html,
            textBio: textBio,
            stats: { rank: rankKey, pvi, pve, appearance, trait },
            items: {
                arme: arme,
                tenue: tenue,
                loot: [lootItem, keysLabel]
            }
        };
    }
}