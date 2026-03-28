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
        try { const res = await fetch(`${basePath}/hex_biomes.json`).then(r => r.json()); biomes = res.biomes || {}; } catch(e) {}

        const lang = (game.i18n.language || "fr").startsWith('en') ? 'en' : 'fr';
        const biomeList = Object.entries(biomes).map(([id, data]) => ({ id, name: data.name[lang] || data.name.fr }));
        biomeList.sort((a, b) => a.name.localeCompare(b.name));

        return { biomes: biomeList };
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

        // 1. Le calque pour dessiner l'Aura
        HexForgeManager.highlightGraphics = new PIXI.Graphics();
        HexForgeManager.highlightGraphics.zIndex = 500; 
        
        // On l'accroche au calque principal de la scène pour être sûr qu'il soit visible
        if (canvas.primary) {
            canvas.primary.addChild(HexForgeManager.highlightGraphics);
        } else {
            canvas.stage.addChild(HexForgeManager.highlightGraphics);
        }

        // 2. Le Bouclier Invisible (Pour bloquer la sélection Foundry)
        HexForgeManager.shieldLayer = new PIXI.Graphics();
        HexForgeManager.shieldLayer.hitArea = new PIXI.Rectangle(0, 0, canvas.dimensions.width, canvas.dimensions.height);
        HexForgeManager.shieldLayer.eventMode = 'static'; 
        HexForgeManager.shieldLayer.interactive = true; 
        
        // CORRECTION : Retour au Viseur (Crosshair)
        HexForgeManager.shieldLayer.cursor = 'crosshair'; 
        HexForgeManager.shieldLayer.zIndex = 1000;
        
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

        if (!HexForgeManager.brushBiome && !HexForgeManager.brushTrait) return; 

        let updates = {};
        if (HexForgeManager.brushBiome) updates["biome"] = HexForgeManager.brushBiome;
        if (HexForgeManager.brushTrait) updates["trait"] = HexForgeManager.brushTrait;
        
        await canvas.scene.setFlag("ultimateforge-hexforge", hex.id, updates);
    }

    // =========================================================================
    // DESSIN DES AURAS SUR LA CARTE (Correction Forme V13)
    // =========================================================================
    static drawHighlights() {
        if (!canvas.ready || !this.highlightGraphics) return;
        this.highlightGraphics.clear();

        if (this.currentMode !== 'brush' || !this.isToolActive) return;

        let targetKey = "";
        let targetValue = "";
        if (this.brushBiome) { targetKey = "biome"; targetValue = this.brushBiome; }
        else if (this.brushTrait) { targetKey = "trait"; targetValue = this.brushTrait; }
        else return;

        const allHexes = canvas.scene.getFlag("ultimateforge-hexforge") || {};
        
        this.highlightGraphics.beginFill(0x27ae60, 0.6); 
        this.highlightGraphics.lineStyle(3, 0x2ecc71, 1); 

        for (const [hexId, hexData] of Object.entries(allHexes)) {
            if (hexData && hexData[targetKey] === targetValue) {
                const parts = hexId.split('_');
                if (parts.length !== 3) continue;
                const row = parseInt(parts[1]);
                const col = parseInt(parts[2]);

                let ptX, ptY;
                if (canvas.grid.getTopLeftPoint) { 
                    const pt = canvas.grid.getTopLeftPoint({i: col, j: row});
                    ptX = pt.x; ptY = pt.y;
                } else { 
                    const arr = canvas.grid.grid.getPixelsFromGridPosition(row, col);
                    ptX = arr[0]; ptY = arr[1];
                }

                // CORRECTION V13 : On utilise la propriété "shape" et non la fonction "getShape()"
                if (canvas.grid.shape) { 
                    const poly = canvas.grid.shape;
                    const shifted = [];
                    for(let i=0; i < poly.points.length; i+=2) {
                        shifted.push(poly.points[i] + ptX, poly.points[i+1] + ptY);
                    }
                    this.highlightGraphics.drawPolygon(shifted);
                } else if (canvas.grid.grid?.getPolygon) { 
                    const poly = canvas.grid.grid.getPolygon(ptX, ptY, canvas.grid.w, canvas.grid.h);
                    this.highlightGraphics.drawPolygon(poly);
                }
            }
        }
        this.highlightGraphics.endFill();
    }
}

Hooks.once('init', () => {
    HexForgeManager.init();
});