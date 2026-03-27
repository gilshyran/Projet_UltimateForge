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
            
            // --- CORRECTION COMPATIBILITÉ V12 / V13 ---
            let row, col;
            if (canvas.grid.getOffset) {
                // Nouvelle méthode V12+
                const offset = canvas.grid.getOffset({x: targetX, y: targetY});
                row = offset.j; // Dans la V12, j = ligne (row)
                col = offset.i; // Dans la V12, i = colonne (col)
            } else {
                // Ancienne méthode V11
                const gridPos = canvas.grid.grid.getGridPositionFromPixels(targetX, targetY);
                row = gridPos[0];
                col = gridPos[1];
            }
            
            const currentHexId = `hex_${row}_${col}`;
            // ------------------------------------------

            const previousHexId = this.tokenMemory.get(tokenDocument.id);

            if (previousHexId !== currentHexId) {
                this.tokenMemory.set(tokenDocument.id, currentHexId);
                this.triggerExploration(currentHexId, tokenDocument);
            }
        });
    }

    // Fonction utilitaire pour tirer un élément au hasard dans un tableau
    static _getRandom(array) {
        if (!array || array.length === 0) return null;
        return array[Math.floor(Math.random() * array.length)];
    }

    // Chargement des données JSON du thème actif
    static async _loadJourneyData() {
        let basePath = "modules/ultimateforge-core/data/default_fantasy";
        if (game.settings.settings.has("ultimateforge-core.activeThemePath")) {
            basePath = game.settings.get("ultimateforge-core", "activeThemePath");
            if (basePath.endsWith("/")) basePath = basePath.slice(0, -1);
        }

        try {
            if (!this.jfData.environnements) this.jfData.environnements = await fetch(`${basePath}/jf_environnements.json`).then(r => r.json()).catch(() => []);
            if (!this.jfData.decors) this.jfData.decors = await fetch(`${basePath}/jf_decors.json`).then(r => r.json()).catch(() => []);
            if (!this.jfData.evenements) this.jfData.evenements = await fetch(`${basePath}/jf_evenements.json`).then(r => r.json()).catch(() => []);
            if (!this.jfData.motivations) this.jfData.motivations = await fetch(`${basePath}/jf_motivations.json`).then(r => r.json()).catch(() => []);
        } catch(e) {
            console.warn("JourneyForge | Fichiers narratifs introuvables.", e);
        }
    }

    static async triggerExploration(hexId, tokenDocument) {
        
        await this._loadJourneyData();

        const hexData = canvas.scene.getFlag("ultimateforge-hexforge", hexId) || {};
        const region = hexData.region || "Inconnue";
        const biome = hexData.biome || "Plaines";
        const traitId = hexData.trait || "";
        const vibeTags = hexData.vibe_tags || [];
        const ecoTags = hexData.eco_tags || [];
        const weatherId = canvas.scene.weather || "clear";
        const lang = game.i18n.lang.startsWith('en') ? 'en' : 'fr';

        // --- NOUVEAU : DÉTECTION DU MOMENT DE LA JOURNÉE (Directement lié au HUD) ---
        const darkness = canvas.scene.darkness;
        let timeId = "jour";
        if (darkness >= 0.7) timeId = "nuit";
        else if (darkness >= 0.3 && darkness < 0.7) timeId = "crepuscule";

        // --- BLOC 1 : ENVIRONNEMENT ---
        let envText = "Le voyage se poursuit sans encombre.";
        const validEnvs = this.jfData.environnements.filter(e => 
            (!e.biome_tags || e.biome_tags.length === 0 || e.biome_tags.includes(biome) || e.biome_tags.includes("all")) &&
            (!e.weather_tags || e.weather_tags.length === 0 || e.weather_tags.includes(weatherId) || e.weather_tags.includes("all")) &&
            (!e.time_tags || e.time_tags.length === 0 || e.time_tags.includes(timeId) || e.time_tags.includes("all"))
        );
        const selectedEnv = this._getRandom(validEnvs);
        if (selectedEnv) envText = selectedEnv.text[lang] || selectedEnv.text.fr;

        // --- BLOC 2 : DÉCOR (Prend en compte la météo) ---
        let decorText = "";
        let currentStageTags = [];
        if (traitId !== "") {
            const validDecors = this.jfData.decors.filter(d => 
                d.trait_id === traitId && 
                (!d.weather_tags || d.weather_tags.length === 0 || d.weather_tags.includes(weatherId) || d.weather_tags.includes("all"))
            );
            const selectedDecor = this._getRandom(validDecors);
            if (selectedDecor) {
                decorText = selectedDecor.text[lang] || selectedDecor.text.fr;
                currentStageTags = selectedDecor.stage_tags || [];
            }
        }

        // --- BLOC 3 : MOTIVATION (Le Cerveau de l'Événement) ---
        let gmSecret = "Observez la situation. Aucune intention claire ne se détache pour le moment.";
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

        // --- BLOC 4 : ÉVÉNEMENT (L'Habillage pour les Joueurs) ---
        let evtText = "Rien de particulier ne vient troubler votre progression.";
        
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
        const chatContent = `
            <div style="border: 2px solid #3c352b; border-radius: 8px; background: url('ui/parchment.jpg') repeat; color: #111; font-family: var(--font-primary); padding: 0;">
                
                <div style="background: rgba(0,0,0,0.8); padding: 8px; border-bottom: 2px solid #d4af37; border-radius: 6px 6px 0 0; text-align: center;">
                    <h3 style="color: #d4af37; margin: 0; font-family: var(--font-header); text-transform: uppercase;">
                        <i class="fas fa-compass"></i> Événement de Voyage
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
                    <h4 style="margin: 0 0 5px 0; color: #c0392b;"><i class="fas fa-user-secret"></i> Véritable Intention</h4>
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