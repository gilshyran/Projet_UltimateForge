const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
console.log("UltimateForge | Fichier ultimateforge.mjs chargé (V13 Ready) !");

// =========================================================================
// CLASSE 0 : LA PALETTE D'OUTILS (HUD)
// =========================================================================
export class HexForgeHUD extends HandlebarsApplicationMixin(ApplicationV2) {
    static DEFAULT_OPTIONS = {
        id: "hexforge-hud-app",
        window: { title: "HEXFORGE.HUD.WindowTitle", resizable: false },
        position: { width: 300, height: "auto", top: 100, left: 100 },
        classes: ["hexforge-hud-window"]
    };

    static PARTS = {
        main: { template: "modules/ultimateforge/templates/hexforge-hud.hbs" }
    };

    async _prepareContext(options) {
        let basePath = "modules/ultimateforge/data/default_fantasy";
        if (game.settings.settings.has("ultimateforge.activeThemePath")) basePath = game.settings.get("ultimateforge", "activeThemePath").replace(/\/$/, "");
        
        let biomes = {};
        let regions = {}; 
        try { 
            const resBiomes = await fetch(`${basePath}/hex_biomes.json`).then(r => r.json()); 
            biomes = resBiomes.biomes || {}; 
            const resRegions = await fetch(`${basePath}/regions-structure.json`).then(r => r.json());
            regions = resRegions || {}; 
        } catch(e) {}

        const lang = String(game.i18n.lang).startsWith('en') ? 'en' : 'fr';
        
        const biomeList = Object.entries(biomes).map(([id, data]) => ({ id, name: data.name[lang] || data.name.fr || id }));
        biomeList.sort((a, b) => a.name.localeCompare(b.name));

        const regionList = Object.entries(regions).map(([id, data]) => ({ id, name: data.name[lang] || data.name.fr || id }));
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

    // --- NOUVEAU : GESTION DE LA FERMETURE DE LA FENÊTRE ---
    _onClose(options) {
        super._onClose(options);
        
        // Si la propriété est toujours active, cela signifie que le MJ a fermé via la croix (X)
        if (HexForgeManager.isToolActive) {
            HexForgeManager.isToolActive = false;
            HexForgeManager.hudInstance = null;
            HexForgeManager.destroyGraphics();
            
            // On désactive visuellement le bouton dans le menu principal UltimateForge (s'il est ouvert)
            const mainHudImg = $('#uf-btn-hexforge img');
            if (mainHudImg.length) {
                mainHudImg.css({ 'transform': 'scale(1)', 'filter': 'none' });
            }
            
            const msg = game.i18n.localize("ULTIMATEFORGE.HUD.Notifications.HexForgeInactive");
            ui.notifications.info(msg !== "ULTIMATEFORGE.HUD.Notifications.HexForgeInactive" ? msg : "HexForge désactivé.");
        }
    }
}

// =========================================================================
// CLASSE 1 : GESTIONNAIRE DE L'INTERFACE (La fenêtre pop-up V13)
// =========================================================================
export class HexForgeEditor extends HandlebarsApplicationMixin(ApplicationV2) {
    
    static lastRegion = "";

    static DEFAULT_OPTIONS = {
        id: "hexforge-editor",
        window: { title: "HEXFORGE.Editor.WindowTitle", resizable: true },
        position: { width: 420, height: "auto" },
        classes: ["hexforge-editor-window"]
    };

    static PARTS = {
        main: { template: "modules/ultimateforge/templates/hexforge-editor.html" }
    };

    get hexId() { return this.options.hexId; }
    get row() { return this.options.row; }
    get col() { return this.options.col; }

    async _prepareContext(options) {
        const existingData = canvas.scene.getFlag("ultimateforge", this.hexId) || {};
        
        this.currentRegion = existingData.region || HexForgeEditor.lastRegion;
        this.currentBiome = existingData.biome || "";

        let basePath = "modules/ultimateforge/data/default_fantasy";
        if (game.settings.settings.has("ultimateforge.activeThemePath")) {
            basePath = game.settings.get("ultimateforge", "activeThemePath");
            if (basePath.endsWith("/")) basePath = basePath.slice(0, -1);
        }
        
        let regions = {}, biomes = {}, states = {}, traits = {}, overlays = {};
        let temperaments = {}, economies = [], tagsDictionary = null; 

        try {
            regions = await fetch(`${basePath}/regions-structure.json`).then(r => r.json());
            biomes = await fetch(`${basePath}/hex_biomes.json`).then(r => r.json());
            states = await fetch(`${basePath}/hex_states.json`).then(r => r.json());
            traits = await fetch(`${basePath}/hex_traits.json`).then(r => r.json());
            overlays = await fetch(`${basePath}/hex_overlays.json`).then(r => r.json());
            temperaments = await fetch(`${basePath}/temperament.json`).then(r => r.json()); 
            economies = await fetch(`${basePath}/economy.json`).then(r => r.json()); 
            tagsDictionary = await fetch(`${basePath}/tags_dictionary.json`).then(r => r.json()).catch(() => null);
            
            this.overlaysData = overlays.overlays || {};
        } catch(e) {
            console.warn("HexForge | Impossible de lire certains fichiers JSON du thème.", e);
        }

        const lang = String(game.i18n.lang).startsWith('en') ? 'en' : 'fr';

        const geoTraits = [];
        const occTraits = [];

        if (traits) {
            if (traits.geography && traits.geography.traits) {
                for (const [traitId, traitData] of Object.entries(traits.geography.traits)) {
                    geoTraits.push({
                        id: traitId,
                        name: traitData.name[lang] || traitData.name.fr || traitId,
                        selected: existingData.trait === traitId
                    });
                }
            }

            for (const catKey of ['isolated', 'settlements']) {
                if (traits[catKey] && traits[catKey].traits) {
                    const group = {
                        label: traits[catKey].label[lang] || traits[catKey].label.fr || catKey,
                        category: catKey,
                        items: []
                    };
                    for (const [occId, occData] of Object.entries(traits[catKey].traits)) {
                        group.items.push({
                            id: occId,
                            name: occData.name[lang] || occData.name.fr || occId,
                            selected: existingData.occupation === occId
                        });
                    }
                    occTraits.push(group);
                }
            }
        }

        const vibeSet = new Set();
        for (const category of Object.values(temperaments)) {
            if (Array.isArray(category)) category.forEach(item => { if (item.output_tags) item.output_tags.forEach(t => vibeSet.add(t)); });
        }
        
        const ecoSet = new Set();
        if (Array.isArray(economies)) economies.forEach(item => { if (item.output_tags) item.output_tags.forEach(t => ecoSet.add(t)); });

        const savedVibes = existingData.vibe_tags || [];
        const savedEcos = existingData.eco_tags || [];

        const formatLabel = (tag) => {
            if (tagsDictionary && tagsDictionary.tags && tagsDictionary.tags[tag]) {
                return tagsDictionary.tags[tag][lang] || tagsDictionary.tags[tag].fr || tag;
            }
            return tag.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        };

        const vibeTags = Array.from(vibeSet).sort().map(t => ({ value: t, label: formatLabel(t), selected: savedVibes.includes(t) }));
        const ecoTags = Array.from(ecoSet).sort().map(t => ({ value: t, label: formatLabel(t), selected: savedEcos.includes(t) }));

        const translatedRegions = {};
        for (const [key, val] of Object.entries(regions)) { translatedRegions[key] = { name: val.name[lang] || val.name.fr || key }; }

        const translatedBiomes = {};
        for (const [key, val] of Object.entries(biomes.biomes || {})) { translatedBiomes[key] = { name: val.name[lang] || val.name.fr || key }; }
        
        const translatedStates = {};
        for (const [key, val] of Object.entries(states.states || {})) { translatedStates[key] = { name: val.name[lang] || val.name.fr || key }; }

        const filteredOverlays = {};
        for (const [key, overlay] of Object.entries(this.overlaysData)) {
            const matchRegion = !overlay.regions || overlay.regions.includes("all") || overlay.regions.includes(this.currentRegion);
            const matchBiome = !overlay.biomes || overlay.biomes.includes("all") || overlay.biomes.includes(this.currentBiome);
            if (matchRegion && matchBiome) {
                filteredOverlays[key] = { name: overlay.name[lang] || overlay.name.fr || key };
            }
        }

        return {
            row: this.row, col: this.col,
            regions: translatedRegions,
            biomes: translatedBiomes,
            states: translatedStates,
            geoTraits: geoTraits,
            occTraits: occTraits,
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
            this._autoSelectOverlay(html);
        });

        html.find('#hf-biome-select').change(e => {
            this.currentBiome = e.currentTarget.value;
            this._updateOverlayOptions(html);
            this._autoSelectOverlay(html);
        });

        const occSelect = html.find('#hf-occupation-select');
        const traitSelect = html.find('#hf-trait-select');
        
        const cfContainer = html.find('#hf-cityforge-container');
        const cfLabel = html.find('#hf-cityforge-label');
        const cfBtn = html.find('#hf-btn-cityforge');
        const hasCity = cfBtn.data('has-city') === true;

        const updateCityForgeButton = () => {
            const selectedOption = occSelect.find('option:selected');
            const category = selectedOption.data('category');

            if (!category) {
                cfContainer.hide();
            } else {
                cfContainer.show();
                if (hasCity) {
                    cfLabel.html('<i class="fas fa-door-open"></i> ' + game.i18n.localize("HEXFORGE.Editor.AccessPlace"));
                    cfBtn.html('<i class="fas fa-book-reader"></i> ' + game.i18n.localize("HEXFORGE.Editor.OpenJournal"));
                    cfBtn.css({'background': 'linear-gradient(to bottom, #27ae60, #2ecc71)', 'box-shadow': '0 0 8px rgba(39, 174, 96, 0.5)'});
                } else if (category === 'isolated') {
                    cfLabel.html('<i class="fas fa-home"></i> ' + game.i18n.localize("HEXFORGE.Editor.MicroHub"));
                    cfBtn.html('<i class="fas fa-hammer"></i> ' + game.i18n.localize("HEXFORGE.Editor.GenerateIsolated"));
                    cfBtn.css({'background': 'linear-gradient(to bottom, #2980b9, #3498db)', 'box-shadow': 'none'});
                } else if (category === 'settlements') {
                    cfLabel.html('<i class="fas fa-city"></i> ' + game.i18n.localize("HEXFORGE.Editor.Settlement"));
                    cfBtn.html('<i class="fas fa-hammer"></i> ' + game.i18n.localize("HEXFORGE.Editor.ForgeCity"));
                    cfBtn.css({'background': 'linear-gradient(to bottom, #2c3e50, #34495e)', 'box-shadow': 'none'});
                }
            }
        };

        occSelect.change(e => {
            updateCityForgeButton();
            this._autoSelectOverlay(html);
        });

        traitSelect.change(e => {
            this._autoSelectOverlay(html);
        });

        updateCityForgeButton();

        html.find('button[type="submit"]').click(async (e) => {
            e.preventDefault();
            await this._saveData(html, true);
        });

        html.find('#hf-btn-cityforge').click(async (e) => {
            e.preventDefault();
            await this._saveData(html, false);
            
            if (!game.modules.get("ultimateforge")?.active) {
                ui.notifications.error(game.i18n.localize("HEXFORGE.Notifications.CityForgeMissing"));
                this.close();
                return;
            }

            const existingData = canvas.scene.getFlag("ultimateforge", this.hexId) || {};
            let cityDataToLoad = null;

            if (existingData.cityJournalId) {
                const journal = game.journal.get(existingData.cityJournalId);
                if (journal) cityDataToLoad = journal.getFlag("ultimateforge", "cityData");
            }

            const selectedOption = occSelect.find('option:selected');
            const category = selectedOption.data('category');
            const occId = selectedOption.val(); 

            if (globalThis.AvantisCityForgeApp) {
                if (category === 'isolated') {
                    if (!existingData.cityJournalId) {
                        if (globalThis.AvantisCityForgeApp.generateIsolatedPlaceJournal) {
                            ui.notifications.info(game.i18n.localize("CITYFORGE.Notifications.IsoGenStarted"));
                            await globalThis.AvantisCityForgeApp.generateIsolatedPlaceJournal(this.hexId, occId, this.currentRegion, this.currentBiome);
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
                            ui.notifications.warn(game.i18n.localize("HEXFORGE.Notifications.JournalNotFound"));
                        }
                    }
                }
                
                new globalThis.AvantisCityForgeApp({ 
                    loadedCityData: cityDataToLoad,
                    traitCategory: category,
                    traitId: occId 
                }, this.hexId).render({force: true}); 
                this.close(); 
            }
        });

        html.find('#hf-btn-unlink').click(async (e) => {
            e.preventDefault();
            const confirm = await Dialog.confirm({
                title: game.i18n.localize("HEXFORGE.Editor.RazingPlace"),
                content: "<p>" + game.i18n.localize("HEXFORGE.Editor.RazingConfirm") + "</p>",
                yes: () => true, no: () => false, defaultYes: false
            });

            if (confirm) {
                await canvas.scene.setFlag("ultimateforge", this.hexId, { 
                    "-=cityJournalId": null,
                    "-=occupation": null, 
                    "overlay": "ruines_cite"
                });
                
                const existingTile = canvas.scene.tiles.find(t => t.flags["ultimateforge"]?.hexId === this.hexId);
                let ruinsPath = "modules/ultimateforge/data/default_fantasy/assets/ruins_city.webp";
                if (this.overlaysData && this.overlaysData["ruines_cite"]) ruinsPath = this.overlaysData["ruines_cite"].path; 
                
                if (existingTile) await existingTile.update({ "texture.src": ruinsPath });

                ui.notifications.success(game.i18n.localize("HEXFORGE.Notifications.PlaceRazed"));
                this.render({force: true}); 
            }
        });
    }

    _updateOverlayOptions(html) {
        const overlaySelect = html.find('#hf-overlay-select');
        const currentVal = overlaySelect.val(); 
        
        overlaySelect.empty();
        overlaySelect.append(`<option value="">${game.i18n.localize('HEXFORGE.Editor.NoVisual')}</option>`);
        
        const lang = String(game.i18n.lang).startsWith('en') ? 'en' : 'fr';

        for (const [key, overlay] of Object.entries(this.overlaysData)) {
            const matchRegion = !overlay.regions || overlay.regions.includes("all") || overlay.regions.includes(this.currentRegion);
            const matchBiome = !overlay.biomes || overlay.biomes.includes("all") || overlay.biomes.includes(this.currentBiome);
            
            if (matchRegion && matchBiome) {
                const name = overlay.name[lang] || overlay.name.fr || key;
                const selected = (key === currentVal) ? "selected" : "";
                overlaySelect.append(`<option value="${key}" ${selected}>${name}</option>`);
            }
        }
    }

    _autoSelectOverlay(html) {
        const occ = html.find('#hf-occupation-select').val();
        const trait = html.find('#hf-trait-select').val();
        
        const targetId = occ || trait;

        if (!targetId) {
            html.find('#hf-overlay-select').val(""); 
            return;
        }

        let bestMatch = "";
        let bestScore = -1;

        html.find('#hf-overlay-select option').each((i, el) => {
            const val = $(el).val();
            if (!val) return;

            if (val.includes(targetId)) {
                let score = 0;
                const overlayDef = this.overlaysData[val];
                
                if (overlayDef && overlayDef.biomes && !overlayDef.biomes.includes("all")) {
                    score += 10; 
                }
                if (overlayDef && overlayDef.regions && !overlayDef.regions.includes("all")) {
                    score += 10; 
                }
                if (val === targetId) {
                    score += 5; 
                }

                if (score > bestScore) {
                    bestScore = score;
                    bestMatch = val;
                }
            }
        });

        if (bestMatch !== "") {
            html.find('#hf-overlay-select').val(bestMatch);
        } else {
            html.find('#hf-overlay-select').val(""); 
        }
    }

    async _saveData(html, closeAfter = true) {
        const formData = {
            region: html.find('[name="region"]').val(),
            biome: html.find('[name="biome"]').val(),
            state: html.find('[name="state"]').val(),
            trait: html.find('[name="trait"]').val(),
            occupation: html.find('[name="occupation"]').val(), 
            overlay: html.find('[name="overlay"]').val()
        };

        formData.vibe_tags = [];
        html.find('input[name="vibe_tags"]:checked').each(function() { formData.vibe_tags.push($(this).val()); });
        
        formData.eco_tags = [];
        html.find('input[name="eco_tags"]:checked').each(function() { formData.eco_tags.push($(this).val()); });
        
        await canvas.scene.setFlag("ultimateforge", this.hexId, formData);
        
        const selectedOverlayKey = formData.overlay;
        const existingTile = canvas.scene.tiles.find(t => t.flags["ultimateforge"]?.hexId === this.hexId);

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
                    flags: { "ultimateforge": { hexId: this.hexId } }
                }]);
            }
        } 
        else if (existingTile) {
            await existingTile.delete();
        }

        ui.notifications.success(game.i18n.format("HEXFORGE.Notifications.HexSaved", {row: this.row, col: this.col}));
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
            if (HexForgeManager.isToolActive && data.flags && data.flags["ultimateforge"]) {
                HexForgeManager.drawHighlights();
            }
        });
    }

    static initGraphics() {
        HexForgeManager.destroyGraphics();

        HexForgeManager.highlightGraphics = new PIXI.Graphics();
        HexForgeManager.highlightGraphics.zIndex = 9999; 
        
        if (canvas.controls) {
            canvas.controls.addChild(HexForgeManager.highlightGraphics);
        } else {
            canvas.stage.addChild(HexForgeManager.highlightGraphics);
        }

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

        if (!HexForgeManager.brushRegion && !HexForgeManager.brushBiome && !HexForgeManager.brushTrait) return; 

        let updates = {};
        
        if (HexForgeManager.brushRegion === "none") {
            updates["-=region"] = null; 
        } else if (HexForgeManager.brushRegion) {
            updates["region"] = HexForgeManager.brushRegion;
        }

        if (HexForgeManager.brushBiome === "none") {
            updates["-=biome"] = null; 
        } else if (HexForgeManager.brushBiome) {
            updates["biome"] = HexForgeManager.brushBiome;
        }

        if (HexForgeManager.brushTrait === "none") {
            updates["-=trait"] = null; 
        } else if (HexForgeManager.brushTrait) {
            updates["trait"] = HexForgeManager.brushTrait;
        }
        
        if (Object.keys(updates).length > 0) {
            await canvas.scene.setFlag("ultimateforge", hex.id, updates);
        }
    }

    static drawHighlights() {
        if (!canvas.ready || !this.highlightGraphics) return;
        this.highlightGraphics.clear();

        if (this.currentMode !== 'brush' || !this.isToolActive) return;

        const colorMap = {
            "Plaines": 0x2ecc71, "Forêt": 0x229954, "Collines": 0xd4ac0d, "Montagne": 0x7f8c8d,
            "Littoral": 0xf1c40f, "Marais": 0x8e44ad, "Désert": 0xe67e22, "Arctique": 0xecf0f1,
            "Jungle": 0x117a65, "Taïga": 0x1abc9c, "Aquatique": 0x3498db, "Sub-aquatique": 0x2980b9,
            "Outreterre": 0x34495e, "route_pavee": 0xbdc3c7, "chemin_terre": 0xa67c00,
            "riviere": 0x3498db, "lac": 0x2980b9, "faille": 0x1c2833, "grotte": 0x2c3e50
        };

        const allHexes = canvas.scene.flags?.["ultimateforge"] || {};
        
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

            const pt = canvas.grid.getTopLeftPoint({i: col, j: row});
            
            const width = canvas.grid.sizeX || canvas.grid.w;
            const height = canvas.grid.sizeY || canvas.grid.h;
            
            const cx = pt.x + (width / 2);
            const cy = pt.y + (height / 2);
            const w = width / 2;
            const h = height / 2;

            const gridType = canvas.scene.grid.type;
            let points = [];

            if (gridType === 2 || gridType === 3) {
                points = [
                    cx, cy - h,
                    cx + w, cy - h/2,
                    cx + w, cy + h/2,
                    cx, cy + h,
                    cx - w, cy + h/2,
                    cx - w, cy - h/2
                ];
            } else if (gridType === 4 || gridType === 5) {
                points = [
                    cx - w/2, cy - h,
                    cx + w/2, cy - h,
                    cx + w, cy,
                    cx + w/2, cy + h,
                    cx - w/2, cy + h,
                    cx - w, cy
                ];
            } else {
                points = [
                    pt.x, pt.y,
                    pt.x + width, pt.y,
                    pt.x + width, pt.y + height,
                    pt.x, pt.y + height
                ];
            }

            this.highlightGraphics.drawPolygon(points);
            this.highlightGraphics.endFill();
        }
    }
}

Hooks.once('init', () => {
    HexForgeManager.init();
});