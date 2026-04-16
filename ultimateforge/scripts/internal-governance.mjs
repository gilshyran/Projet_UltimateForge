export class InternalGovernanceGenerator {
    static generateHTML(district, citySize, regionId, cityName, leaderName, leaderTitle, govTags, govBuildingsData) {
        const lang = game.i18n.lang.startsWith('en') ? 'en' : 'fr';
        const getText = (item) => (typeof item === 'object') ? (item[lang] || item.fr || "") : (item || "");
        
        const bTypeObj = govBuildingsData.buildings[citySize] || govBuildingsData.buildings["Village"];
        const buildingNoun = getText(bTypeObj);

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

        let validAmbiances = govBuildingsData.ambiances.filter(a => (a.size_tags.includes("all") || a.size_tags.includes(citySize)) && (a.gov_tags.includes("all") || a.gov_tags.some(t => govTags.includes(t))));
        const preciseAmbiances = validAmbiances.filter(a => !a.gov_tags.includes("all"));
        if (preciseAmbiances.length > 0) validAmbiances = preciseAmbiances;
        if (validAmbiances.length === 0) validAmbiances = govBuildingsData.ambiances.filter(a => a.gov_tags.includes("all"));
        const ambianceText = getText(validAmbiances[Math.floor(Math.random() * validAmbiances.length)].desc);

        let validEvents = govBuildingsData.events.filter(e => (e.size_tags.includes("all") || e.size_tags.includes(citySize)) && (e.gov_tags.includes("all") || e.gov_tags.some(t => govTags.includes(t))));
        const preciseEvents = validEvents.filter(e => !e.gov_tags.includes("all"));
        if (preciseEvents.length > 0) validEvents = preciseEvents;
        if (validEvents.length === 0) validEvents = govBuildingsData.events.filter(e => e.gov_tags.includes("all"));
        const eventText = getText(validEvents[Math.floor(Math.random() * validEvents.length)].desc);

        return `
            <div style="font-family: var(--font-primary);">
                <h2 style="color: #2c3e50; border-bottom: 2px solid #2c3e50; margin-bottom: 5px;">
                    <i class="fas fa-landmark"></i> ${finalBuildingName}
                </h2>
                
                <div style="display: flex; gap: 10px; margin-bottom: 15px; flex-wrap: wrap;">
                    <span style="background: #eee; padding: 4px 8px; border-radius: 4px; font-size: 0.9em;"><strong>${game.i18n.localize("CITYFORGE.Shop.District")} :</strong> ${district}</span>
                    <span style="background: #eee; padding: 4px 8px; border-radius: 4px; font-size: 0.9em;"><strong>${game.i18n.localize("CITYFORGE.NPC.Role")} :</strong> ${leaderName}</span>
                </div>

                <div style="background: rgba(44, 62, 80, 0.05); padding: 15px; border-left: 4px solid #2c3e50; border-radius: 0 5px 5px 0; margin-bottom: 15px;">
                    <h3 style="margin-top: 0; color: #2c3e50;"><i class="fas fa-eye"></i> ${game.i18n.localize("CITYFORGE.GovPOI.AtmosTitle")}</h3>
                    <p style="color: #444; line-height: 1.5; margin-bottom: 0;"><em>${ambianceText}</em></p>
                </div>

                <div style="margin-top: 15px; border: 1px dashed #e74c3c; background: #fdf5e6; padding: 12px; border-radius: 4px;">
                    <h4 style="margin-top: 0; color: #c0392b;"><i class="fas fa-exclamation-circle"></i> ${game.i18n.localize("CITYFORGE.GovPOI.SituationTitle")}</h4>
                    <span style="color: #555;">${eventText}</span>
                </div>
            </div>
        `;
    }
}