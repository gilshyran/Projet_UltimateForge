console.log("UltimateForge | Chargement du Moteur Narratif JourneyForge...");

export class JourneyForgeRadar {

    static tokenMemory = new Map();
    static jfData = {}; // Cache pour les données JSON

    static init() {
        Hooks.on("updateToken", (tokenDocument, change, options, userId) => {
            if (!game.user.isGM) return;
            if (!game.ultimateforge || !game.ultimateforge.explorationActive) return;
            if (change.x === undefined && change.y === undefined) return;

            const newX = change.x !== undefined ? change.x : tokenDocument.x;
            const newY = change.y !== undefined ? change.y : tokenDocument.y;

            const targetX = newX + (canvas.grid.size / 2);
            const targetY = newY + (canvas.grid.size / 2);

            let row, col;
            if (canvas.grid.getOffset) {
                const offset = canvas.grid.getOffset({ x: targetX, y: targetY });
                row = offset.j;
                col = offset.i;
            } else {
                const gridPos = canvas.grid.grid.getGridPositionFromPixels(targetX, targetY);
                row = gridPos[0];
                col = gridPos[1];
            }

            const currentHexId = `hex_${row}_${col}`;

            const previousHexId = this.tokenMemory.get(tokenDocument.id);

            if (previousHexId !== currentHexId) {
                this.tokenMemory.set(tokenDocument.id, currentHexId);
                this.triggerExploration(currentHexId, tokenDocument);
            }
        });
    }

    static _getRandom(array) {
        if (!array || array.length === 0) return null;
        return array[Math.floor(Math.random() * array.length)];
    }

    static async _loadJourneyData() {
        let basePath = "modules/ultimateforge/data/default_fantasy";
        if (game.settings.settings.has("ultimateforge.activeThemePath")) {
            basePath = game.settings.get("ultimateforge", "activeThemePath");
            if (basePath.endsWith("/")) basePath = basePath.slice(0, -1);
        }

        try {
            if (!this.jfData.environnements) this.jfData.environnements = await fetch(`${basePath}/jf_environnements.json`).then(r => r.json()).catch(() => []);
            if (!this.jfData.decors) this.jfData.decors = await fetch(`${basePath}/jf_decors.json`).then(r => r.json()).catch(() => []);
            if (!this.jfData.evenements) this.jfData.evenements = await fetch(`${basePath}/jf_evenements.json`).then(r => r.json()).catch(() => []);
            if (!this.jfData.motivations) this.jfData.motivations = await fetch(`${basePath}/jf_motivations.json`).then(r => r.json()).catch(() => []);
        } catch (e) {
            console.warn("JourneyForge | Fichiers narratifs introuvables.", e);
        }
    }

    static async triggerExploration(hexId, tokenDocument) {

        await this._loadJourneyData();

        const hexData = canvas.scene.getFlag("ultimateforge", hexId) || {};
        const region = hexData.region || game.i18n.localize("JOURNEYFORGE.Defaults.UnknownRegion");
        const biome = hexData.biome || game.i18n.localize("JOURNEYFORGE.Defaults.PlainsBiome");

        const vibeTags = hexData.vibe_tags || [];
        const ecoTags = hexData.eco_tags || [];
        let rawWeather = canvas.scene.weather || canvas.scene.environment?.weather || "clear";
            if (rawWeather === "autumnLeaves") rawWeather = "leaves";
        const weatherId = rawWeather === "" ? "clear" : rawWeather;
        const lang = String(game.i18n.lang).startsWith('en') ? 'en' : 'fr';

        const darkness = canvas.scene.environment?.darknessLevel ?? 0;
        let timeId = "jour";
        if (darkness >= 0.7) timeId = "nuit";
        else if (darkness >= 0.3 && darkness < 0.7) timeId = "crepuscule";

        // --- BLOC 1 : ENVIRONNEMENT ---
        let envText = game.i18n.localize("JOURNEYFORGE.Defaults.EnvText");
        const validEnvs = this.jfData.environnements.filter(e =>
            (!e.biome_tags || e.biome_tags.length === 0 || e.biome_tags.includes(biome) || e.biome_tags.includes("all")) &&
            (!e.weather_tags || e.weather_tags.length === 0 || e.weather_tags.includes(weatherId) || e.weather_tags.includes("all")) &&
            (!e.time_tags || e.time_tags.length === 0 || e.time_tags.includes(timeId) || e.time_tags.includes("all"))
        );
        const selectedEnv = this._getRandom(validEnvs);
        if (selectedEnv) envText = selectedEnv.text[lang] || selectedEnv.text.fr;

        // --- BLOC 2 : DÉCOR (Prend en compte la météo, la géographie et l'occupation) ---
        let decorText = "";
        let currentStageTags = [];

        // Priorité absolue à la Civilisation (Occupation / CityForge)
        let activeTraits = [];
        if (hexData.cityJournalId || hexData.occupation) {
            if (hexData.cityJournalId) activeTraits.push("approche_ville");
            if (hexData.occupation) activeTraits.push(hexData.occupation);
        } else if (hexData.trait) {
            activeTraits.push(hexData.trait);
        }

        if (activeTraits.length > 0) {
            const validDecors = this.jfData.decors.filter(d =>
                d.trait_tags && d.trait_tags.some(t => activeTraits.includes(t)) &&
                (!d.weather_tags || d.weather_tags.length === 0 || d.weather_tags.includes(weatherId) || d.weather_tags.includes("all"))
            );

            const selectedDecor = this._getRandom(validDecors);
            if (selectedDecor) {
                decorText = selectedDecor.text[lang] || selectedDecor.text.fr;
                currentStageTags = selectedDecor.stage_tags || [];
            }
        } else {
            // FIX : Si la case est vide (aucun trait), on force le tag "isole" 
            // pour déclencher les événements de nature sauvage !
            currentStageTags = ["isole"];
        }

        // --- BLOC 3 : MOTIVATION ---
        let gmSecret = game.i18n.localize("JOURNEYFORGE.Defaults.GMSecret");
        let currentMotivTags = [];

        const validMotivs = this.jfData.motivations.filter(m => {
            const matchStage = !m.require_stage_tags || m.require_stage_tags.length === 0 || m.require_stage_tags.some(t => currentStageTags.includes(t));
            const matchVibe = !m.require_vibe_tags || m.require_vibe_tags.length === 0 || m.require_vibe_tags.some(t => vibeTags.includes(t));
            const matchEco = !m.require_eco_tags || m.require_eco_tags.length === 0 || m.require_eco_tags.some(t => ecoTags.includes(t));
            return matchStage && matchVibe && matchEco;
        });

        const selectedMotiv = this._getRandom(validMotivs);
        if (selectedMotiv) {
            gmSecret = selectedMotiv.secret_mj[lang] || selectedMotiv.secret_mj.fr;
            currentMotivTags = selectedMotiv.output_tags || [];
        }

        // --- BLOC 4 : ÉVÉNEMENT ---
        let evtText = game.i18n.localize("JOURNEYFORGE.Defaults.EventText");

        const validEvts = this.jfData.evenements.filter(evt => {
            const matchStage = !evt.require_stage_tags || evt.require_stage_tags.length === 0 || evt.require_stage_tags.some(t => currentStageTags.includes(t));
            const matchVibe = !evt.require_vibe_tags || evt.require_vibe_tags.length === 0 || evt.require_vibe_tags.some(t => vibeTags.includes(t));
            const matchEco = !evt.require_eco_tags || evt.require_eco_tags.length === 0 || evt.require_eco_tags.some(t => ecoTags.includes(t));
            const matchMotiv = !evt.require_motiv_tags || evt.require_motiv_tags.length === 0 || evt.require_motiv_tags.some(t => currentMotivTags.includes(t));
            return matchStage && matchVibe && matchEco && matchMotiv;
        });

        const selectedEvt = this._getRandom(validEvts);
        if (selectedEvt) evtText = selectedEvt.text[lang] || selectedEvt.text.fr;

        // --- FORMATAGE DU CHAT ---
        const eventTitle = game.i18n.localize("JOURNEYFORGE.Chat.EventTitle");
        const trueIntentionTitle = game.i18n.localize("JOURNEYFORGE.Chat.TrueIntention");

        const chatContent = `
            <div style="border: 2px solid #3c352b; border-radius: 8px; background: url('modules/ultimateforge/ui/parchment.webp') repeat; color: #111; font-family: var(--font-primary); padding: 0;">
                
                <div style="background: rgba(0,0,0,0.8); padding: 8px; border-bottom: 2px solid #d4af37; border-radius: 6px 6px 0 0; text-align: center;">
                    <h3 style="color: #d4af37; margin: 0; font-family: var(--font-header); text-transform: uppercase;">
                        <i class="fas fa-compass"></i> ${eventTitle}
                    </h3>
                    <div style="color: #aaa; font-size: 0.85em; margin-top: 4px;">
                        ${tokenDocument.name} | ${region} | ${biome}
                    </div>
                </div>

                <div style="padding: 12px; font-size: 1.05em; line-height: 1.4; text-align: justify;">
                    <p style="margin-top: 0;"><em>${envText}</em></p>
                    ${decorText ? `<p style="color: #2c3e50;">${decorText}</p>` : ''}
                    <p><strong>${evtText}</strong></p>
                </div>

                <div style="background: rgba(192, 57, 43, 0.1); border-top: 1px solid #c0392b; padding: 10px; border-radius: 0 0 6px 6px;">
                    <h4 style="margin: 0 0 5px 0; color: #c0392b;"><i class="fas fa-user-secret"></i> ${trueIntentionTitle}</h4>
                    <p style="margin: 0; font-size: 0.9em; font-style: italic; color: #555;">${gmSecret}</p>
                </div>
            </div>
        `;

        ChatMessage.create({
            speaker: { alias: "JourneyForge" },
            content: chatContent,
            whisper: ChatMessage.getWhisperRecipients("GM")
        });
    }
}

Hooks.once('ready', () => {
    JourneyForgeRadar.init();
});