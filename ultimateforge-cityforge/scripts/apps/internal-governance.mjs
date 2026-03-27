export class InternalGovernanceGenerator {

    static generateHTML(district, citySize, regionId, cityName, leaderName, leaderTitle, govTags, govBuildingsData) {
        
        const lang = game.i18n.lang.startsWith('en') ? 'en' : 'fr';
        // NOUVEAU : La fonction magique universelle
        const getText = (item) => (typeof item === 'object') ? (item[lang] || item.fr || "") : (item || "");
        
        // 1. DÉFINIR LE NOM DU BÂTIMENT SELON LA TAILLE DE LA VILLE
        const bTypeObj = govBuildingsData.buildings[citySize] || govBuildingsData.buildings["Village"];
        const buildingNoun = getText(bTypeObj);

        // 2. GESTION DE LA GRAMMAIRE
        let formattedTitle = leaderTitle;
        if (lang === 'fr') {
            let lowerTitle = leaderTitle.toLowerCase();
            if (lowerTitle.startsWith("le ")) formattedTitle = "du " + leaderTitle.substring(3);
            else if (lowerTitle.startsWith("la ")) formattedTitle = "de la " + leaderTitle.substring(3);
            else if (lowerTitle.startsWith("l'")) formattedTitle = "de l'" + leaderTitle.substring(2);
            else if (lowerTitle.startsWith("les ")) formattedTitle = "des " + leaderTitle.substring(4);
            else formattedTitle = "de " + leaderTitle;
        } else {
            formattedTitle = `of ${leaderTitle}`;
        }

        const finalBuildingName = `${buildingNoun} ${formattedTitle}`;

        // 3. FILTRAGE DE L'AMBIANCE
        let validAmbiances = govBuildingsData.ambiances.filter(a => {
            const matchSize = a.size_tags.includes("all") || a.size_tags.includes(citySize);
            const matchGov = a.gov_tags.includes("all") || a.gov_tags.some(t => govTags.includes(t));
            return matchSize && matchGov;
        });

        const preciseAmbiances = validAmbiances.filter(a => !a.gov_tags.includes("all"));
        if (preciseAmbiances.length > 0) validAmbiances = preciseAmbiances;
        if (validAmbiances.length === 0) validAmbiances = govBuildingsData.ambiances.filter(a => a.gov_tags.includes("all"));

        const selectedAmbiance = validAmbiances[Math.floor(Math.random() * validAmbiances.length)];
        const ambianceText = getText(selectedAmbiance.desc); // UTILISATION DE GETTEXT


        // 4. FILTRAGE DE L'ÉVÉNEMENT EN COURS
        let validEvents = govBuildingsData.events.filter(e => {
            const matchSize = e.size_tags.includes("all") || e.size_tags.includes(citySize);
            const matchGov = e.gov_tags.includes("all") || e.gov_tags.some(t => govTags.includes(t));
            return matchSize && matchGov;
        });

        const preciseEvents = validEvents.filter(e => !e.gov_tags.includes("all"));
        if (preciseEvents.length > 0) validEvents = preciseEvents;
        if (validEvents.length === 0) validEvents = govBuildingsData.events.filter(e => e.gov_tags.includes("all"));

        const selectedEvent = validEvents[Math.floor(Math.random() * validEvents.length)];
        const eventText = getText(selectedEvent.desc); // UTILISATION DE GETTEXT


        // 5. RENDU HTML
        return `
            <div style="font-family: var(--font-primary);">
                <h2 style="color: #2c3e50; border-bottom: 2px solid #2c3e50; margin-bottom: 5px;">
                    <i class="fas fa-landmark"></i> ${finalBuildingName}
                </h2>
                
                <div style="display: flex; gap: 10px; margin-bottom: 15px; flex-wrap: wrap;">
                    <span style="background: #eee; padding: 4px 8px; border-radius: 4px; font-size: 0.9em;"><strong>${lang === 'en' ? 'District' : 'Quartier'} :</strong> ${district}</span>
                    <span style="background: #eee; padding: 4px 8px; border-radius: 4px; font-size: 0.9em;"><strong>${lang === 'en' ? 'Leader' : 'Dirigeant'} :</strong> ${leaderName}</span>
                </div>

                <div style="background: rgba(44, 62, 80, 0.05); padding: 15px; border-left: 4px solid #2c3e50; border-radius: 0 5px 5px 0; margin-bottom: 15px;">
                    <h3 style="margin-top: 0; color: #2c3e50;"><i class="fas fa-eye"></i> ${lang === 'en' ? 'Atmosphere & Appearance' : 'Apparence & Atmosphère'}</h3>
                    <p style="color: #444; line-height: 1.5; margin-bottom: 0;"><em>${ambianceText}</em></p>
                </div>

                <div style="margin-top: 15px; border: 1px dashed #e74c3c; background: #fdf5e6; padding: 12px; border-radius: 4px;">
                    <h4 style="margin-top: 0; color: #c0392b;"><i class="fas fa-exclamation-circle"></i> ${lang === 'en' ? 'Current Situation' : 'Situation Actuelle'}</h4>
                    <span style="color: #555;">${eventText}</span>
                </div>
            </div>
        `;
    }
}