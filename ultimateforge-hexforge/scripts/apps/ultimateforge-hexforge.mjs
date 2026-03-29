const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
console.log("UltimateForge | Fichier ultimateforge-hexforge.mjs chargé (V13 Ready) !");

// =========================================================================
// CLASSE 0 : LA PALETTE D'OUTILS (HUD)
// =========================================================================
export class HexForgeHUD extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = {
        id: "hexforge-hud-app",
        window: { title: "HexForge - Outils", resizable: false },
        position: { width: 300, height: "auto", top: 100, left: 100 },
        classes: ["hexforge-hud-window"]
    };

    static PARTS = {
        main: { template: "modules/ultimateforge-hexforge/templates/hexforge-hud.hbs" }
    };

    async _prepareContext(options) {
        let basePath = "modules/ultimateforge-core/data/default_fantasy";
        if (game.settings.settings.has("ultimateforge-core.activeThemePath")) basePath = game.settings.get("ultimateforge-core", "activeThemePath").replace(/\/$/, "");
        
        let biomes = {};
        let regions = {}; // NOUVEAU
        try { 
            const resBiomes = await fetch(`${basePath}/hex_biomes.json`).then(r => r.json()); 
            biomes = resBiomes.biomes || {}; 
            const resRegions = await fetch(`${basePath}/regions-structure.json`).then(r => r.json());
            regions = resRegions || {}; // NOUVEAU
        } catch(e) {}

        const lang = (game.i18n.language || "fr").startsWith('en') ? 'en' : 'fr';
        
        const biomeList = Object.entries(biomes).map(([id, data]) => ({ id, name: data.name[lang] || data.name.fr }));
        biomeList.sort((a, b) => a.name.localeCompare(b.name));

        const regionList = Object.entries(regions).map(([id, data]) => ({ id, name: data.name[lang] || data.name.fr }));
        regionList.sort((a, b) => a.name.localeCompare(b.name));

        return { biomes: biomeList, regions: regionList };
    }

    _onRender(context, options) {
        super._onRender(context, options);
        const html = $(this.element);

        html.find('#hf-mode-edit').click(() => {
            HexForgeManager.setMode('edit');
            html.find('#hf-mode-edit').css('background', '#2980b9');
            html.find('#hf-mode-brush').css('background', '#34495e');
            html.find('#hf-brush-options').slideUp(200);
        });

        html.find('#hf-mode-brush').click(() => {
            HexForgeManager.setMode('brush');
            html.find('#hf-mode-brush').css('background', '#27ae60');
            html.find('#hf-mode-edit').css('background', '#34495e');
            html.find('#hf-brush-options').slideDown(200);
        });

        // --- AJOUT DE L'ÉCOUTEUR POUR LA RÉGION ---
        html.find('#hf-brush-region').change(e => { 
            HexForgeManager.brushRegion = e.target.value; 
        });

        html.find('#hf-brush-biome').change(e => { 
            HexForgeManager.brushBiome = e.target.value; 
            HexForgeManager.drawHighlights(); 
        });
        html.find('#hf-brush-trait').change(e => { 
            HexForgeManager.brushTrait = e.target.value; 
            HexForgeManager.drawHighlights(); 
        });
    }
}

// =========================================================================
// CLASSE 1 : GESTIONNAIRE DE L'INTERFACE (La fenêtre pop-up V13)
// =========================================================================
export class HexForgeEditor extends HandlebarsApplicationMixin(ApplicationV2) {
    
    static lastRegion = "";

    // MIGRATION V13 : On définit les options ici
    static DEFAULT_OPTIONS = {
        id: "hexforge-editor",
        window: { title: "HexForge | Éditeur de Case", resizable: true },
        position: { width: 420, height: "auto" },
        classes: ["hexforge-editor-window"]
    };

    static PARTS = {
        main: { template: "modules/ultimateforge-hexforge/templates/hexforge-editor.html" }
    };

    // Accesseurs faciles
    get hexId() { return this.options.hexId; }
    get row() { return this.options.row; }
    get col() { return this.options.col; }

    async _prepareContext(options) {
        const existingData = canvas.scene.getFlag("ultimateforge-hexforge", this.hexId) || {};
        
        this.currentRegion = existingData.region || HexForgeEditor.lastRegion;
        this.currentBiome = existingData.biome || "";

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

        const lang = (game.i18n.language || "fr").startsWith('en') ? 'en' : 'fr';

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

        // EXTRACTION DYNAMIQUE DES TAGS
        const vibeSet = new Set();
        for (const category of Object.values(temperaments)) {
            if (Array.isArray(category)) category.forEach(item => { if (item.output_tags) item.output_tags.forEach(t => vibeSet.add(t)); });
        }
        
        const ecoSet = new Set();
        if (Array.isArray(economies)) economies.forEach(item => { if (item.output_tags) item.output_tags.forEach(t => ecoSet.add(t)); });

        const savedVibes = existingData.vibe_tags || [];
        const savedEcos = existingData.eco_tags || [];

        const formatLabel = (tag) => tag.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        const vibeTags = Array.from(vibeSet).sort().map(t => ({ value: t, label: formatLabel(t), selected: savedVibes.includes(t) }));
        const ecoTags = Array.from(ecoSet).sort().map(t => ({ value: t, label: formatLabel(t), selected: savedEcos.includes(t) }));

        const filteredOverlays = {};
        for (const [key, overlay] of Object.entries(this.overlaysData)) {
            const matchRegion = !overlay.regions || overlay.regions.includes("all") || overlay.regions.includes(this.currentRegion);
            const matchBiome = !overlay.biomes || overlay.biomes.includes("all") || overlay.biomes.includes(this.currentBiome);
            if (matchRegion && matchBiome) filteredOverlays[key] = overlay;
        }

        return {
            row: this.row, col: this.col,
            regions: regions || {},
            biomes: biomes.biomes || {},
            states: states.states || {},
            traitsGroups: formattedTraits,
            overlays: filteredOverlays,
            currentRegion: this.currentRegion,
            currentBiome: this.currentBiome,
            data: existingData,
            vibeTags: vibeTags, ecoTags: ecoTags    
        };
    }

    _onRender(context, options) {
        super._onRender(context, options);
        const html = $(this.element);

        html.find('#hf-region-select').change(e => {
            this.currentRegion = e.currentTarget.value;
            HexForgeEditor.lastRegion = this.currentRegion;
            this._updateOverlayOptions(html);
        });

        html.find('#hf-biome-select').change(e => {
            this.currentBiome = e.currentTarget.value;
            this._updateOverlayOptions(html);
        });

        const traitSelect = html.find('#hf-trait-select');
        const cfContainer = html.find('#hf-cityforge-container');
        const cfLabel = html.find('#hf-cityforge-label');
        const cfBtn = html.find('#hf-btn-cityforge');
        const hasCity = cfBtn.data('has-city') === true;

        const updateCityForgeButton = () => {
            const selectedOption = traitSelect.find('option:selected');
            const category = selectedOption.data('category');

            if (!category || category === 'geography') {
                cfContainer.hide();
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
        updateCityForgeButton();

        // MIGRATION V13 : On intercepte la soumission du bouton Sauvegarder
        html.find('button[type="submit"]').click(async (e) => {
            e.preventDefault();
            await this._saveData(html, true);
        });

        // LE PONT VERS CITYFORGE
        html.find('#hf-btn-cityforge').click(async (e) => {
            e.preventDefault();
            
            // On sauvegarde l'ADN de la case sans fermer la fenêtre
            await this._saveData(html, false);
            
            if (!game.modules.get("ultimateforge-cityforge")?.active) {
                ui.notifications.error("HexForge | Le module CityForge n'est pas activé !");
                this.close();
                return;
            }

            const existingData = canvas.scene.getFlag("ultimateforge-hexforge", this.hexId) || {};
            let cityDataToLoad = null;

            if (existingData.cityJournalId) {
                const journal = game.journal.get(existingData.cityJournalId);
                if (journal) cityDataToLoad = journal.getFlag("ultimateforge-cityforge", "cityData");
            }

            const selectedOption = traitSelect.find('option:selected');
            const category = selectedOption.data('category');
            const traitId = selectedOption.val();

            if (globalThis.AvantisCityForgeApp) {
                if (category === 'isolated') {
                    if (!existingData.cityJournalId) {
                        if (globalThis.AvantisCityForgeApp.generateIsolatedPlaceJournal) {
                            ui.notifications.info("CityForge | Génération du lieu isolé en cours...");
                            await globalThis.AvantisCityForgeApp.generateIsolatedPlaceJournal(this.hexId, traitId, this.currentRegion, this.currentBiome);
                            this.close();
                            return; 
                        }
                    } else {
                        const journal = game.journal.get(existingData.cityJournalId);
                        if (journal) {
                            journal.sheet.render(true);
                            this.close();
                            return;
                        } else {
                            ui.notifications.warn("HexForge | Le journal de ce lieu est introuvable.");
                        }
                    }
                }
                
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

        // RASER LE LIEU
        html.find('#hf-btn-unlink').click(async (e) => {
            e.preventDefault();
            const confirm = await Dialog.confirm({
                title: "Raser le lieu",
                content: "<p>Voulez-vous vraiment effacer ce lieu de la carte ? Le journal sera conservé, mais la case sera <strong>réduite en ruines</strong>.</p>",
                yes: () => true, no: () => false, defaultYes: false
            });

            if (confirm) {
                await canvas.scene.setFlag("ultimateforge-hexforge", this.hexId, { 
                    "-=cityJournalId": null,
                    "-=trait": null,
                    "overlay": "ruines_cite"
                });
                
                const existingTile = canvas.scene.tiles.find(t => t.flags["ultimateforge-hexforge"]?.hexId === this.hexId);
                let ruinsPath = "modules/ultimateforge-core/data/default_fantasy/assets/ruins_city.png";
                if (this.overlaysData && this.overlaysData["ruines_cite"]) ruinsPath = this.overlaysData["ruines_cite"].path; 
                
                if (existingTile) await existingTile.update({ "texture.src": ruinsPath });

                ui.notifications.success("HexForge | Le lieu a été effacé et réduit en ruines.");
                this.render({force: true}); 
            }
        });

        html.find('#hf-brush-region').change(e => { 
            HexForgeManager.brushRegion = e.target.value; 
        });
        html.find('#hf-brush-biome').change(e => { 
            HexForgeManager.brushBiome = e.target.value; 
            HexForgeManager.drawHighlights(); 
        });
        html.find('#hf-brush-trait').change(e => { 
            HexForgeManager.brushTrait = e.target.value; 
            HexForgeManager.drawHighlights(); 
        });
    }

    _updateOverlayOptions(html) {
        const overlaySelect = html.find('#hf-overlay-select');
        const currentVal = overlaySelect.val(); 
        
        overlaySelect.empty();
        overlaySelect.append(`<option value="">-- Aucun visuel --</option>`);
        
        const lang = (game.i18n.language || "fr").startsWith('en') ? 'en' : 'fr';

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

    // MIGRATION V13 : Fonction de sauvegarde manuelle remplaçant _updateObject
    async _saveData(html, closeAfter = true) {
        const formData = {
            region: html.find('[name="region"]').val(),
            biome: html.find('[name="biome"]').val(),
            state: html.find('[name="state"]').val(),
            trait: html.find('[name="trait"]').val(),
            overlay: html.find('[name="overlay"]').val()
        };

        formData.vibe_tags = [];
        html.find('input[name="vibe_tags"]:checked').each(function() { formData.vibe_tags.push($(this).val()); });
        
        formData.eco_tags = [];
        html.find('input[name="eco_tags"]:checked').each(function() { formData.eco_tags.push($(this).val()); });
        
        await canvas.scene.setFlag("ultimateforge-hexforge", this.hexId, formData);
        
        const selectedOverlayKey = formData.overlay;
        const existingTile = canvas.scene.tiles.find(t => t.flags["ultimateforge-hexforge"]?.hexId === this.hexId);

        if (selectedOverlayKey && this.overlaysData[selectedOverlayKey]) {
            const imagePath = this.overlaysData[selectedOverlayKey].path;
            const gridSize = canvas.grid.size; 
            const iconSize = gridSize * 0.8; 
            
            let x, y;
            if (canvas.grid.getTopLeftPoint) {
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
                    x: x, y: y, width: iconSize, height: iconSize,
                    texture: { src: imagePath },
                    flags: { "ultimateforge-hexforge": { hexId: this.hexId } }
                }]);
            }
        } 
        else if (existingTile) {
            await existingTile.delete();
        }

        ui.notifications.success(`HexForge | Case [${this.row}, ${this.col}] sauvegardée.`);
        if (closeAfter) this.close();
    }
}


// =========================================================================
// CLASSE 2 : GESTIONNAIRE DES CLICS & DU BOUCLIER INVISIBLE
// =========================================================================
export class HexForgeManager {

    static isToolActive = false;
    static currentMode = 'edit'; 
    static brushRegion = "";
    static brushBiome = "";
    static brushTrait = "";
    static hudInstance = null;
    
    static isDragging = false; 
    static lastPaintedHex = null; 
    
    static highlightGraphics = null; 
    static shieldLayer = null;       

    static init() {
        game.ultimateforge = game.ultimateforge || {};
        game.ultimateforge.isHexForgeActive = () => HexForgeManager.isToolActive;

        game.ultimateforge.toggleHexForge = () => {
            HexForgeManager.isToolActive = !HexForgeManager.isToolActive;
            
            if (HexForgeManager.isToolActive) {
                if (!HexForgeManager.hudInstance) HexForgeManager.hudInstance = new HexForgeHUD();
                HexForgeManager.hudInstance.render({force: true});
                HexForgeManager.initGraphics();
            } else {
                if (HexForgeManager.hudInstance) {
                    HexForgeManager.hudInstance.close();
                    HexForgeManager.hudInstance = null;
                }
                HexForgeManager.destroyGraphics();
            }
            return HexForgeManager.isToolActive;
        };

        Hooks.on('canvasReady', () => {
            if (HexForgeManager.isToolActive) {
                HexForgeManager.initGraphics();
            }

            canvas.stage.on('pointerdown', (event) => {
                if (!HexForgeManager.isToolActive || HexForgeManager.currentMode !== 'edit' || event.data.button !== 0) return;
                HexForgeManager._handleEditClick(event);
            });
        });

        Hooks.on("updateScene", (scene, data) => {
            if (HexForgeManager.isToolActive && data.flags && data.flags["ultimateforge-hexforge"]) {
                HexForgeManager.drawHighlights();
            }
        });
    }

    // =========================================================================
    // CRÉATION DU BOUCLIER INVISIBLE ET DE L'AURA (COMPATIBLE V13)
    // =========================================================================
    static initGraphics() {
        HexForgeManager.destroyGraphics();

        // 1. Le calque d'Aura (Accroché à canvas.controls pour être au-dessus de tout)
        HexForgeManager.highlightGraphics = new PIXI.Graphics();
        HexForgeManager.highlightGraphics.zIndex = 9999; 
        
        if (canvas.controls) {
            canvas.controls.addChild(HexForgeManager.highlightGraphics);
        } else {
            canvas.stage.addChild(HexForgeManager.highlightGraphics);
        }

        // 2. Le Bouclier Invisible (Pour bloquer la sélection Foundry)
        HexForgeManager.shieldLayer = new PIXI.Graphics();
        HexForgeManager.shieldLayer.hitArea = new PIXI.Rectangle(-10000, -10000, 50000, 50000);
        HexForgeManager.shieldLayer.eventMode = 'static'; 
        HexForgeManager.shieldLayer.interactive = true; 
        HexForgeManager.shieldLayer.cursor = 'crosshair'; 
        HexForgeManager.shieldLayer.zIndex = 10000;
        
        HexForgeManager.shieldLayer.on('pointerdown', (e) => {
            if (e.data.button !== 0) return;
            e.stopPropagation(); 
            HexForgeManager.isDragging = true;
            HexForgeManager._handleBrushPaint(e);
        });
        HexForgeManager.shieldLayer.on('pointermove', (e) => {
            if (!HexForgeManager.isDragging) return;
            HexForgeManager._handleBrushPaint(e);
        });
        HexForgeManager.shieldLayer.on('pointerup', () => HexForgeManager.isDragging = false);
        HexForgeManager.shieldLayer.on('pointerupoutside', () => HexForgeManager.isDragging = false);

        HexForgeManager.setMode(HexForgeManager.currentMode);
    }

    static destroyGraphics() {
        if (HexForgeManager.highlightGraphics && !HexForgeManager.highlightGraphics.destroyed) {
            HexForgeManager.highlightGraphics.destroy();
        }
        if (HexForgeManager.shieldLayer && !HexForgeManager.shieldLayer.destroyed) {
            HexForgeManager.shieldLayer.destroy();
        }
        HexForgeManager.highlightGraphics = null;
        HexForgeManager.shieldLayer = null;
        HexForgeManager.isDragging = false;
    }

    static setMode(mode) {
        HexForgeManager.currentMode = mode;
        if (HexForgeManager.shieldLayer) {
            if (mode === 'brush') {
                canvas.stage.addChild(HexForgeManager.shieldLayer);
                HexForgeManager.drawHighlights();
            } else {
                if (HexForgeManager.shieldLayer.parent) HexForgeManager.shieldLayer.parent.removeChild(HexForgeManager.shieldLayer);
                if (HexForgeManager.highlightGraphics) HexForgeManager.highlightGraphics.clear();
            }
        }
    }

    static _getHexIdFromEvent(event) {
        const position = event.data.getLocalPosition(canvas.app.stage);
        let row, col;
        if (canvas.grid.getOffset) {
            const offset = canvas.grid.getOffset({x: position.x, y: position.y});
            row = offset.j; col = offset.i;
        } else {
            const gridPos = canvas.grid.grid.getGridPositionFromPixels(position.x, position.y);
            row = gridPos[0]; col = gridPos[1];
        }
        return { id: `hex_${row}_${col}`, row, col };
    }

    static _handleEditClick(event) {
        const hex = HexForgeManager._getHexIdFromEvent(event);
        new HexForgeEditor({ hexId: hex.id, row: hex.row, col: hex.col }).render({force: true});
    }

    static async _handleBrushPaint(event) {
        const hex = HexForgeManager._getHexIdFromEvent(event);
        
        if (HexForgeManager.lastPaintedHex === hex.id) return;
        HexForgeManager.lastPaintedHex = hex.id;

        // On vérifie si l'un des trois pinceaux a une valeur
        if (!HexForgeManager.brushRegion && !HexForgeManager.brushBiome && !HexForgeManager.brushTrait) return; 

        let updates = {};
        
        // --- PEINTURE DE LA RÉGION ---
        if (HexForgeManager.brushRegion === "none") {
            updates["-=region"] = null; // Gomme
        } else if (HexForgeManager.brushRegion) {
            updates["region"] = HexForgeManager.brushRegion;
        }

        // --- PEINTURE DU BIOME ---
        if (HexForgeManager.brushBiome === "none") {
            updates["-=biome"] = null; // Gomme
        } else if (HexForgeManager.brushBiome) {
            updates["biome"] = HexForgeManager.brushBiome;
        }

        // --- PEINTURE DU TRAIT ---
        if (HexForgeManager.brushTrait === "none") {
            updates["-=trait"] = null; // Gomme
        } else if (HexForgeManager.brushTrait) {
            updates["trait"] = HexForgeManager.brushTrait;
        }
        
        // Application de la mise à jour sur les flags de la scène
        if (Object.keys(updates).length > 0) {
            await canvas.scene.setFlag("ultimateforge-hexforge", hex.id, updates);
        }
    }

    // =========================================================================
    // DESSIN DES AURAS SUR LA CARTE (Méthode Géométrique Absolue)
    // =========================================================================
    static drawHighlights() {
        if (!canvas.ready || !this.highlightGraphics) return;
        this.highlightGraphics.clear();

        // On affiche le calque global uniquement si on est en mode Pinceau
        if (this.currentMode !== 'brush' || !this.isToolActive) return;

        const colorMap = {
            "Plaines": 0x2ecc71, "Forêt": 0x229954, "Collines": 0xd4ac0d, "Montagne": 0x7f8c8d,
            "Littoral": 0xf1c40f, "Marais": 0x8e44ad, "Désert": 0xe67e22, "Arctique": 0xecf0f1,
            "Jungle": 0x117a65, "Taïga": 0x1abc9c, "Aquatique": 0x3498db, "Sub-aquatique": 0x2980b9,
            "Outreterre": 0x34495e, "route_pavee": 0xbdc3c7, "chemin_terre": 0xa67c00,
            "riviere": 0x3498db, "lac": 0x2980b9, "faille": 0x1c2833, "grotte": 0x2c3e50
        };

        const allHexes = canvas.scene.flags?.["ultimateforge-hexforge"] || {};
        
        for (const [hexId, hexData] of Object.entries(allHexes)) {
            if (!hexData) continue;

            const bColor = colorMap[hexData.biome];
            const tColor = colorMap[hexData.trait];

            if (!bColor && !tColor) continue;

            const fillColor = bColor || 0x000000;
            const fillAlpha = bColor ? 0.45 : 0.0; 
            const lineColor = tColor || bColor || 0xFFFFFF;
            const lineAlpha = tColor ? 0.9 : 0.3; 
            const lineWidth = tColor ? 5 : 2;     

            this.highlightGraphics.beginFill(fillColor, fillAlpha);
            this.highlightGraphics.lineStyle(lineWidth, lineColor, lineAlpha);

            const parts = hexId.split('_');
            if (parts.length !== 3) continue;
            const row = parseInt(parts[1]);
            const col = parseInt(parts[2]);

            // 1. Récupération de l'origine de la case
            const pt = canvas.grid.getTopLeftPoint({i: col, j: row});
            
            // 2. Récupération des dimensions de la case
            const width = canvas.grid.sizeX || canvas.grid.w;
            const height = canvas.grid.sizeY || canvas.grid.h;
            
            // 3. Calcul du centre exact
            const cx = pt.x + (width / 2);
            const cy = pt.y + (height / 2);
            const w = width / 2;
            const h = height / 2;

            // 4. Dessin mathématique de l'hexagone selon l'orientation de la grille
            const gridType = canvas.scene.grid.type;
            let points = [];

            if (gridType === 2 || gridType === 3) {
                // Hexagone "Pointy-topped" (Pointes en haut et en bas)
                points = [
                    cx, cy - h,
                    cx + w, cy - h/2,
                    cx + w, cy + h/2,
                    cx, cy + h,
                    cx - w, cy + h/2,
                    cx - w, cy - h/2
                ];
            } else if (gridType === 4 || gridType === 5) {
                // Hexagone "Flat-topped" (Bords plats en haut et en bas)
                points = [
                    cx - w/2, cy - h,
                    cx + w/2, cy - h,
                    cx + w, cy,
                    cx + w/2, cy + h,
                    cx - w/2, cy + h,
                    cx - w, cy
                ];
            } else {
                // Fallback (Grille carrée)
                points = [
                    pt.x, pt.y,
                    pt.x + width, pt.y,
                    pt.x + width, pt.y + height,
                    pt.x, pt.y + height
                ];
            }

            // Dessin
            this.highlightGraphics.drawPolygon(points);
            this.highlightGraphics.endFill();
        }
    }
}

Hooks.once('init', () => {
    HexForgeManager.init();
});