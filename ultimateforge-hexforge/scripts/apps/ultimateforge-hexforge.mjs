console.log("UltimateForge | Fichier ultimateforge-hexforge.mjs chargé !");

// =========================================================================
// CLASSE 1 : GESTIONNAIRE DE L'INTERFACE (La fenêtre pop-up)
// =========================================================================
export class HexForgeEditor extends FormApplication {
    
    // MÉMOIRE GLOBALE : Se souvient de la dernière région sélectionnée par le MJ
    static lastRegion = "";

    constructor(hexId, row, col, options = {}) {
        super({}, options);
        this.hexId = hexId;
        this.row = row;
        this.col = col;
        // On initialise avec la mémoire globale
        this.currentRegion = HexForgeEditor.lastRegion;
        this.currentBiome = "";
    }

    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: "hexforge-editor",
            title: "HexForge | Éditeur de Case",
            template: "modules/ultimateforge-hexforge/templates/hexforge-editor.html",
            width: 400,
            height: "auto",
            closeOnSubmit: true
        });
    }

    async getData() {
        const existingData = canvas.scene.getFlag("ultimateforge-hexforge", this.hexId) || {};
        
        if (existingData.region) this.currentRegion = existingData.region;
        if (existingData.biome) this.currentBiome = existingData.biome;

        let basePath = "modules/ultimateforge-core/data/default_fantasy";
        if (game.settings.settings.has("ultimateforge-core.activeThemePath")) {
            basePath = game.settings.get("ultimateforge-core", "activeThemePath");
            if (basePath.endsWith("/")) basePath = basePath.slice(0, -1);
        }
        
        let regions = {}, biomes = {}, states = {}, traits = {}, overlays = {};
        let temperaments = {}, economies = []; // NOUVEAU

        try {
            regions = await fetch(`${basePath}/regions-structure.json`).then(r => r.json());
            biomes = await fetch(`${basePath}/hex_biomes.json`).then(r => r.json());
            states = await fetch(`${basePath}/hex_states.json`).then(r => r.json());
            traits = await fetch(`${basePath}/hex_traits.json`).then(r => r.json());
            overlays = await fetch(`${basePath}/hex_overlays.json`).then(r => r.json());
            temperaments = await fetch(`${basePath}/temperament.json`).then(r => r.json()); // NOUVEAU
            economies = await fetch(`${basePath}/economy.json`).then(r => r.json()); // NOUVEAU
            
            this.overlaysData = overlays.overlays || {};
        } catch(e) {
            console.warn("HexForge | Impossible de lire certains fichiers JSON du thème.", e);
        }

        // EXTRACTION DYNAMIQUE DES TAGS
        const vibeSet = new Set();
        for (const category of Object.values(temperaments)) {
            if (Array.isArray(category)) {
                category.forEach(item => { if (item.output_tags) item.output_tags.forEach(t => vibeSet.add(t)); });
            }
        }
        
        const ecoSet = new Set();
        if (Array.isArray(economies)) {
            economies.forEach(item => { if (item.output_tags) item.output_tags.forEach(t => ecoSet.add(t)); });
        }

        const savedVibes = existingData.vibe_tags || [];
        const savedEcos = existingData.eco_tags || [];

        // Formatage pour l'interface HTML
        const formatLabel = (tag) => tag.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        const vibeTags = Array.from(vibeSet).sort().map(t => ({ value: t, label: formatLabel(t), selected: savedVibes.includes(t) }));
        const ecoTags = Array.from(ecoSet).sort().map(t => ({ value: t, label: formatLabel(t), selected: savedEcos.includes(t) }));

        // Filtrage des overlays
        const filteredOverlays = {};
        for (const [key, overlay] of Object.entries(this.overlaysData)) {
            const matchRegion = !overlay.regions || overlay.regions.includes("all") || overlay.regions.includes(this.currentRegion);
            const matchBiome = !overlay.biomes || overlay.biomes.includes("all") || overlay.biomes.includes(this.currentBiome);
            if (matchRegion && matchBiome) {
                filteredOverlays[key] = overlay;
            }
        }

        return {
            row: this.row,
            col: this.col,
            regions: regions || {},
            biomes: biomes.biomes || {},
            states: states.states || {},
            traits: traits.traits || {},
            overlays: filteredOverlays,
            currentRegion: this.currentRegion,
            currentBiome: this.currentBiome,
            data: existingData,
            vibeTags: vibeTags, // NOUVEAU
            ecoTags: ecoTags    // NOUVEAU
        };
    }

    // NOUVEAU : On écoute les changements dans les menus déroulants en temps réel
    activateListeners(html) {
        super.activateListeners(html);

        // Quand on change la Région
        html.find('#hf-region-select').change(e => {
            this.currentRegion = e.currentTarget.value;
            HexForgeEditor.lastRegion = this.currentRegion; // On sauvegarde dans la mémoire du MJ
            this._updateOverlayOptions(html);
        });

        // Quand on change le Biome
        html.find('#hf-biome-select').change(e => {
            this.currentBiome = e.currentTarget.value;
            this._updateOverlayOptions(html);
        });

        // LE PONT VERS CITYFORGE
        html.find('#hf-btn-cityforge').click(async (e) => {
            e.preventDefault();
            
            // 1. Vérifie que CityForge est bien installé et activé
            if (!game.modules.get("ultimateforge-cityforge")?.active) {
                ui.notifications.error("HexForge | Le module CityForge n'est pas activé !");
                return;
            }

            const existingData = canvas.scene.getFlag("ultimateforge-hexforge", this.hexId) || {};
            let cityDataToLoad = null;

            // 2. Si la case possède déjà un ID de Journal (une ville existe), on la charge !
            if (existingData.cityJournalId) {
                const journal = game.journal.get(existingData.cityJournalId);
                if (journal) {
                    cityDataToLoad = journal.getFlag("ultimateforge-cityforge", "cityData");
                } else {
                    ui.notifications.warn("HexForge | Le journal de la cité est introuvable (peut-être supprimé ?).");
                }
            }

            // 3. On lance CityForge en lui passant l'ADN de la ville (s'il existe) ET l'ID de la case
            if (globalThis.AvantisCityForgeApp) {
                new globalThis.AvantisCityForgeApp({ loadedCityData: cityDataToLoad }, this.hexId).render(true);
                this.close(); // Ferme la pop-up HexForge pour ne pas encombrer l'écran
            } else {
                ui.notifications.warn("L'interface CityForge n'est pas accessible.");
            }
        });
    }

    // Fonction magique qui vide et reremplit la liste des visuels selon la Région/Biome
    _updateOverlayOptions(html) {
        const overlaySelect = html.find('#hf-overlay-select');
        const currentVal = overlaySelect.val(); // Garde la sélection actuelle si possible
        
        overlaySelect.empty();
        overlaySelect.append(`<option value="">-- Aucun visuel --</option>`);
        
        const lang = game.i18n.lang.startsWith('en') ? 'en' : 'fr';

        for (const [key, overlay] of Object.entries(this.overlaysData)) {
            const matchRegion = !overlay.regions || overlay.regions.includes("all") || overlay.regions.includes(this.currentRegion);
            const matchBiome = !overlay.biomes || overlay.biomes.includes("all") || overlay.biomes.includes(this.currentBiome);
            
            if (matchRegion && matchBiome) {
                const name = overlay.name[lang] || overlay.name.fr;
                const selected = (key === currentVal) ? "selected" : "";
                overlaySelect.append(`<option value="${key}" ${selected}>${name}</option>`);
            }
        }
    }

    async _updateObject(event, formData) {

        console.log(`HexForge | Sauvegarde des données pour ${this.hexId} :`, formData);
        // --- NOUVEAU : Formatage strict des tags en Tableaux (Arrays) ---
        if (formData.vibe_tags) {
            formData.vibe_tags = Array.isArray(formData.vibe_tags) ? formData.vibe_tags : [formData.vibe_tags];
        } else {
            formData.vibe_tags = []; // Si rien n'est coché
        }
        
        if (formData.eco_tags) {
            formData.eco_tags = Array.isArray(formData.eco_tags) ? formData.eco_tags : [formData.eco_tags];
        } else {
            formData.eco_tags = [];
        }
        
        
        await canvas.scene.setFlag("ultimateforge-hexforge", this.hexId, formData);
        
        const selectedOverlayKey = formData.overlay;
        const existingTile = canvas.scene.tiles.find(t => t.flags["ultimateforge-hexforge"]?.hexId === this.hexId);

        if (selectedOverlayKey && this.overlaysData[selectedOverlayKey]) {
            const imagePath = this.overlaysData[selectedOverlayKey].path;
            const gridSize = canvas.grid.size; 
            const iconSize = gridSize * 0.8; 
            
            let x, y;
            if (canvas.grid.getTopLeftPoint) {
                // Correction de l'ordre i et j pour la V12
                const point = canvas.grid.getTopLeftPoint({i: this.col, j: this.row});
                x = point.x + (gridSize / 2) - (iconSize / 2);
                y = point.y + (gridSize / 2) - (iconSize / 2);
            } else {
                const pixels = canvas.grid.grid.getPixelsFromGridPosition(this.row, this.col);
                x = pixels[0] + (gridSize / 2) - (iconSize / 2);
                y = pixels[1] + (gridSize / 2) - (iconSize / 2);
            }

            if (existingTile) {
                await existingTile.update({ "texture.src": imagePath });
            } else {
                await canvas.scene.createEmbeddedDocuments("Tile", [{
                    x: x,
                    y: y,
                    width: iconSize,
                    height: iconSize,
                    texture: { src: imagePath },
                    flags: {
                        "ultimateforge-hexforge": { hexId: this.hexId }
                    }
                }]);
            }
        } 
        else if (existingTile) {
            await existingTile.delete();
        }

        ui.notifications.success(`Case [${this.row}, ${this.col}] mise à jour.`);
    }
}


// =========================================================================
// CLASSE 2 : GESTIONNAIRE DES CLICS (Connecté au HUD)
// =========================================================================
export class HexForgeManager {

    static isToolActive = false;

    static init() {
        // On crée un pont global pour que le HUD puisse allumer/éteindre HexForge
        game.ultimateforge = game.ultimateforge || {};
        
        game.ultimateforge.isHexForgeActive = () => HexForgeManager.isToolActive;

        game.ultimateforge.toggleHexForge = () => {
            HexForgeManager.isToolActive = !HexForgeManager.isToolActive;
            return HexForgeManager.isToolActive;
        };

        // On écoute les clics sur la carte
        Hooks.on('canvasReady', () => {
            canvas.stage.on('pointerdown', (event) => HexForgeManager._onCanvasClick(event));
        });
    }

    static _onCanvasClick(event) {
        if (!this.isToolActive || event.data.originalEvent.button !== 0) return;

        const position = event.data.getLocalPosition(canvas.app.stage);
        
        // --- CORRECTION COMPATIBILITÉ V12 / V13 ---
        let row, col;
        if (canvas.grid.getOffset) {
            const offset = canvas.grid.getOffset({x: position.x, y: position.y});
            row = offset.j;
            col = offset.i;
        } else {
            const gridPos = canvas.grid.grid.getGridPositionFromPixels(position.x, position.y);
            row = gridPos[0];
            col = gridPos[1];
        }
        
        const hexId = `hex_${row}_${col}`;
        // ------------------------------------------

        new HexForgeEditor(hexId, row, col).render(true);
    }
}

Hooks.once('init', () => {
    HexForgeManager.init();
});