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
        let temperaments = {}, economies = []; 

        try {
            regions = await fetch(`${basePath}/regions-structure.json`).then(r => r.json());
            biomes = await fetch(`${basePath}/hex_biomes.json`).then(r => r.json());
            states = await fetch(`${basePath}/hex_states.json`).then(r => r.json());
            traits = await fetch(`${basePath}/hex_traits.json`).then(r => r.json());
            overlays = await fetch(`${basePath}/hex_overlays.json`).then(r => r.json());
            temperaments = await fetch(`${basePath}/temperament.json`).then(r => r.json()); 
            economies = await fetch(`${basePath}/economy.json`).then(r => r.json()); 
            
            this.overlaysData = overlays.overlays || {};
        } catch(e) {
            console.warn("HexForge | Impossible de lire certains fichiers JSON du thème.", e);
        }

        const lang = game.i18n.lang.startsWith('en') ? 'en' : 'fr';

        // LECTURE DES TRAITS GROUPÉS
        const formattedTraits = [];
        if (traits) {
            for (const [catKey, catData] of Object.entries(traits)) {
                if (!catData.traits) continue;
                const group = {
                    label: catData.label[lang] || catData.label.fr,
                    category: catKey,
                    items: []
                };
                for (const [traitId, traitData] of Object.entries(catData.traits)) {
                    group.items.push({
                        id: traitId,
                        name: traitData.name[lang] || traitData.name.fr,
                        selected: existingData.trait === traitId
                    });
                }
                formattedTraits.push(group);
            }
        }

        // EXTRACTION DYNAMIQUE DES TAGS (Vibe & Eco)
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
            traitsGroups: formattedTraits, // NOUVEAU : Les traits sont maintenant groupés
            overlays: filteredOverlays,
            currentRegion: this.currentRegion,
            currentBiome: this.currentBiome,
            data: existingData,
            vibeTags: vibeTags, 
            ecoTags: ecoTags    
        };
    }

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

        // NOUVEAU : GESTION DYNAMIQUE DU BOUTON CITYFORGE / LIEUX ISOLÉS
        const traitSelect = html.find('#hf-trait-select');
        const cfContainer = html.find('#hf-cityforge-container');
        const cfLabel = html.find('#hf-cityforge-label');
        const cfBtn = html.find('#hf-btn-cityforge');
        const hasCity = cfBtn.data('has-city') === true;

        const updateCityForgeButton = () => {
            const selectedOption = traitSelect.find('option:selected');
            const category = selectedOption.data('category');

            if (!category || category === 'geography') {
                cfContainer.hide(); // On cache le bouton pour les rivières, ruines, etc.
            } else {
                cfContainer.show();
                if (hasCity) {
                    cfLabel.html('<i class="fas fa-door-open"></i> Accès au Lieu');
                    cfBtn.html('<i class="fas fa-book-reader"></i> Ouvrir le Journal du Lieu');
                    cfBtn.css({'background': 'linear-gradient(to bottom, #27ae60, #2ecc71)', 'box-shadow': '0 0 8px rgba(39, 174, 96, 0.5)'});
                } else if (category === 'isolated') {
                    cfLabel.html('<i class="fas fa-home"></i> Micro-Hub (Lieu Isolé)');
                    cfBtn.html('<i class="fas fa-hammer"></i> Générer le Lieu Isolé');
                    cfBtn.css({'background': 'linear-gradient(to bottom, #2980b9, #3498db)', 'box-shadow': 'none'});
                } else if (category === 'settlements') {
                    cfLabel.html('<i class="fas fa-city"></i> Agglomération (CityForge)');
                    cfBtn.html('<i class="fas fa-hammer"></i> Fonder la Cité');
                    cfBtn.css({'background': 'linear-gradient(to bottom, #2c3e50, #34495e)', 'box-shadow': 'none'});
                }
            }
        };

        traitSelect.change(updateCityForgeButton);
        updateCityForgeButton(); // Déclenchement à l'ouverture de la fenêtre

        // LE PONT VERS CITYFORGE (Le clic sur le bouton)
        html.find('#hf-btn-cityforge').click(async (e) => {
            e.preventDefault();
            
            // 1. SAUVEGARDE FORCÉE ET INVISIBLE
            // On enregistre le Biome, Trait, Région sur la case AVANT de faire quoi que ce soit d'autre
            await this.submit({ preventClose: true });
            
            if (!game.modules.get("ultimateforge-cityforge")?.active) {
                ui.notifications.error("HexForge | Le module CityForge n'est pas activé !");
                this.close();
                return;
            }

            // Maintenant, la case est à jour ! On peut lire son ADN sereinement.
            const existingData = canvas.scene.getFlag("ultimateforge-hexforge", this.hexId) || {};
            let cityDataToLoad = null;

            if (existingData.cityJournalId) {
                const journal = game.journal.get(existingData.cityJournalId);
                if (journal) {
                    cityDataToLoad = journal.getFlag("ultimateforge-cityforge", "cityData");
                }
            }

            const selectedOption = traitSelect.find('option:selected');
            const category = selectedOption.data('category');
            const traitId = selectedOption.val();

            if (globalThis.AvantisCityForgeApp) {
                // LOGIQUE POUR LES LIEUX ISOLÉS
                if (category === 'isolated') {
                    if (!existingData.cityJournalId) {
                        // Pas encore généré : on lance le Générateur Fantôme
                        if (globalThis.AvantisCityForgeApp.generateIsolatedPlaceJournal) {
                            ui.notifications.info("CityForge | Génération du lieu isolé en cours...");
                            await globalThis.AvantisCityForgeApp.generateIsolatedPlaceJournal(this.hexId, traitId, this.currentRegion, this.currentBiome);
                            this.close();
                            return; 
                        }
                    } else {
                        // Déjà généré : on ouvre directement le Journal Foundry !
                        const journal = game.journal.get(existingData.cityJournalId);
                        if (journal) {
                            journal.sheet.render(true);
                            this.close();
                            return;
                        } else {
                            ui.notifications.warn("HexForge | Le journal de ce lieu est introuvable (peut-être supprimé ?).");
                        }
                    }
                }
                
                // LOGIQUE POUR LES VILLES (Settlements) : Comportement classique
                new globalThis.AvantisCityForgeApp({ 
                    loadedCityData: cityDataToLoad,
                    traitCategory: category,
                    traitId: traitId
                }, this.hexId).render({force: true}); 
                this.close(); 
            } else {
                ui.notifications.warn("L'interface CityForge n'est pas accessible.");
                this.close();
            }
        });

        // ====================================================================
        // NOUVEAU : DÉTRUIRE LE LIEN ET TRANSFORMER EN RUINES (V13)
        // ====================================================================
        html.find('#hf-btn-unlink').click(async (e) => {
            e.preventDefault();
            
            const confirm = await Dialog.confirm({
                title: "Raser le lieu",
                content: "<p>Voulez-vous vraiment effacer ce lieu de la carte ? Le journal sera conservé dans vos archives, mais la case sera <strong>réduite en ruines</strong>.</p>",
                yes: () => true,
                no: () => false,
                defaultYes: false
            });

            if (confirm) {
                // 1. Mise à jour de l'ADN de la case : on supprime le journal et le trait, on force l'overlay
                await canvas.scene.setFlag("ultimateforge-hexforge", this.hexId, { 
                    "-=cityJournalId": null,
                    "-=trait": null,
                    "overlay": "ruines_cite"
                });
                
                // 2. Mise à jour VISUELLE de la carte en direct (Remplacement de l'image)
                const existingTile = canvas.scene.tiles.find(t => t.flags["ultimateforge-hexforge"]?.hexId === this.hexId);
                let ruinsPath = "modules/ultimateforge-core/data/default_fantasy/assets/ruins_city.png"; // Sécurité par défaut
                
                if (this.overlaysData && this.overlaysData["ruines_cite"]) {
                    ruinsPath = this.overlaysData["ruines_cite"].path; // Chemin depuis ton JSON
                }
                
                if (existingTile) {
                    await existingTile.update({ "texture.src": ruinsPath });
                }

                ui.notifications.success("HexForge | Le lieu a été effacé et réduit en ruines.");
                this.render(false); // Relance l'interface
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
        
        // --- Formatage strict des tags en Tableaux (Arrays) ---
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