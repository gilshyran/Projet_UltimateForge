// ============================================================================
// ULTIMATEFORGE - REALMSFORGE (Moteur Géopolitique & Monde Vivant)
// ============================================================================

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class AvantisRealmsForgeApp extends HandlebarsApplicationMixin(ApplicationV2) {

    static DEFAULT_OPTIONS = {
        id: "realmsforge-hud",
        window: {
            title: "REALMSFORGE.HUD.WindowTitle",
            resizable: true
        },
        position: {
            width: 850, // Un peu plus large pour l'interface Master-Detail
            height: 750
        }
    };

    static PARTS = {
        main: {
            template: "modules/ultimateforge/templates/realmsforge-hud.hbs"
        }
    };

    static showPoliticalMap = false;
    static politicalGraphics = null;
    static activeFactionId = null; // Mémorise la faction ouverte à droite

    async _prepareContext(options) {
        const rawFactions = game.settings.get("ultimateforge", "factionsData") || {};
        
        let basePath = "modules/ultimateforge/data/default_fantasy";
        if (game.settings.settings.has("ultimateforge.activeThemePath")) {
            basePath = game.settings.get("ultimateforge", "activeThemePath");
            if (basePath.endsWith("/")) basePath = basePath.slice(0, -1);
        }
        
        let temperaments = {};
        let regionsStructure = {};
        try {
            temperaments = await fetch(`${basePath}/temperament.json`).then(r => r.json());
            regionsStructure = await fetch(`${basePath}/regions-structure.json`).then(r => r.json());
            this.regionsStructure = regionsStructure; 
        } catch(e) { console.warn(game.i18n.localize("REALMSFORGE.Notifications.JsonError")); }

        const lang = String(game.i18n.lang).startsWith('en') ? 'en' : 'fr';

        let tagsDictionary = null;
        try {
            tagsDictionary = await fetch(`${basePath}/tags_dictionary.json`).then(r => r.json());
        } catch(e) {}

        const formatLabel = (tag) => {
            if (tagsDictionary && tagsDictionary.tags && tagsDictionary.tags[tag]) {
                return tagsDictionary.tags[tag][lang] || tagsDictionary.tags[tag].fr || tag;
            }
            return tag.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        };

        const vibeSet = new Set();
        for (const category of Object.values(temperaments)) {
            if (Array.isArray(category)) {
                category.forEach(item => { if (item.output_tags) item.output_tags.forEach(t => vibeSet.add(t)); });
            }
        }
        const availableVibes = Array.from(vibeSet).sort().map(t => ({ value: t, label: formatLabel(t) }));

        const allMapHexes = canvas.scene?.flags?.["ultimateforge"] || {};
        
        // WORLD STATS (Global)
        let worldTotalCities = 0;
        let worldTotalWilds = 0;

        // Dictionnaire de pondération des Vibes pour les stats 4X
        const vibeWeights = {
            "opulent": { eco: 3, mil: 0, sci: 0, fai: 0, sta: 1 },
            "laborieux": { eco: 2, mil: 1, sci: 0, fai: 0, sta: 0 },
            "miserable": { eco: -2, mil: 0, sci: 0, fai: 0, sta: -1 },
            "inegalitaire": { eco: 1, mil: 0, sci: 0, fai: 0, sta: -2 },
            "oppressant": { eco: 0, mil: 3, sci: 0, fai: 0, sta: -1 },
            "loi-du-plus-fort": { eco: -1, mil: 2, sci: 0, fai: 0, sta: -2 },
            "arcanique": { eco: 1, mil: 0, sci: 3, fai: 0, sta: 0 },
            "superstitieux": { eco: -1, mil: 0, sci: 1, fai: 1, sta: 0 },
            "pieux": { eco: 0, mil: 0, sci: 0, fai: 2, sta: 1 },
            "fanatique": { eco: 0, mil: 2, sci: -1, fai: 3, sta: -1 },
            "accueillant": { eco: 1, mil: -1, sci: 0, fai: 0, sta: 2 },
            "festif": { eco: 1, mil: -1, sci: 0, fai: 0, sta: 1 },
            "paisible": { eco: 0, mil: -1, sci: 0, fai: 0, sta: 3 },
            "paranoiaque": { eco: -1, mil: 1, sci: 0, fai: 0, sta: -1 },
            "corrompu": { eco: 2, mil: 0, sci: 0, fai: 0, sta: -2 }
        };
        
        const factionsArray = Object.values(rawFactions).map(f => {
            const fVibes = f.vibes ? f.vibes.split(',').map(v => v.trim()) : [];
            
            const cities = [];
            const wilds = [];
            
            // On calcule la puissance de la faction : Valeur des Vibes x Nombre de territoires
            let stats = { eco: 0, mil: 0, sci: 0, faith: 0, stab: 0 };

            for (const [hexId, hexData] of Object.entries(allMapHexes)) {
                
                // Comptage Global (juste pour savoir)
                if (!worldTotalCities && !worldTotalWilds && f === Object.values(rawFactions)[0]) {
                     if (hexData.cityJournalId) worldTotalCities++;
                     else worldTotalWilds++;
                }

                if (hexData.influence && hexData.influence[f.id] > 0) {
                    const score = hexData.influence[f.id];
                    let isCity = false;
                    let tName = `Case Sauvage ${hexId.replace('hex_', '').replace('_', ', ')}`;

                    if (hexData.cityJournalId) {
                        const journal = game.journal.get(hexData.cityJournalId);
                        if (journal) {
                            tName = journal.name;
                            isCity = true;
                        }
                    }

                    let dots = "";
                    for(let i=0; i<5; i++) { dots += (i < score) ? "🔴" : "⚪"; }

                    const territoryObj = { hexId: hexId, name: tName, isCity: isCity, score: score, dots: dots };
                    
                    if (isCity) cities.push(territoryObj);
                    else wilds.push(territoryObj);
                }
            }
            
            cities.sort((a, b) => a.name.localeCompare(b.name));
            wilds.sort((a, b) => a.name.localeCompare(b.name));

            // CALCUL DES STATS (La Doctrine de la Faction * Nombre de cités)
            // On donne un multiplicateur de x3 aux Cités, et x1 aux Terres sauvages
            const territoryMultiplier = (cities.length * 3) + (wilds.length * 1);
            
            fVibes.forEach(vibe => {
                if (vibeWeights[vibe]) {
                    stats.eco += vibeWeights[vibe].eco * territoryMultiplier;
                    stats.mil += vibeWeights[vibe].mil * territoryMultiplier;
                    stats.sci += vibeWeights[vibe].sci * territoryMultiplier;
                    stats.faith += vibeWeights[vibe].fai * territoryMultiplier;
                    stats.stab += vibeWeights[vibe].sta * territoryMultiplier;
                }
            });

            return {
                ...f,
                visible: f.visible !== false, 
                vibeList: availableVibes.map(av => ({ ...av, selected: fVibes.includes(av.value) })),
                cities: cities,
                wilds: wilds,
                stats: stats
            };
        });

        // Calcul propre des World Stats (au cas où on n'a aucune faction)
        if (factionsArray.length === 0) {
            for (const hexData of Object.values(allMapHexes)) {
                if (hexData.cityJournalId) worldTotalCities++;
                else worldTotalWilds++;
            }
        }

        const allCodexRegions = [];
        for (const [key, data] of Object.entries(regionsStructure)) {
            allCodexRegions.push({ id: key, name: data.name[lang] || data.name.fr });
        }
        allCodexRegions.sort((a, b) => a.name.localeCompare(b.name));

        if (AvantisRealmsForgeApp.activeFactionId && !rawFactions[AvantisRealmsForgeApp.activeFactionId]) {
            AvantisRealmsForgeApp.activeFactionId = null;
        }
        if (!AvantisRealmsForgeApp.activeFactionId && factionsArray.length > 0) {
            AvantisRealmsForgeApp.activeFactionId = factionsArray[0].id;
        }
        
        const activeFaction = factionsArray.find(f => f.id === AvantisRealmsForgeApp.activeFactionId);

        return {
            factions: factionsArray,
            activeFaction: activeFaction,
            activeFactionId: AvantisRealmsForgeApp.activeFactionId,
            allCodexRegions: allCodexRegions,
            worldStats: { totalCities: worldTotalCities, totalWilds: worldTotalWilds }
        };
    }

    _onRender(context, options) {
        super._onRender(context, options);
        const html = $(this.element);
        
        this._restoreScroll();

        // 1. Clic sur une Faction dans le menu de gauche
        html.find('.rf-faction-list-item').click((e) => {
            const factionId = $(e.currentTarget).attr('data-id');
            if (AvantisRealmsForgeApp.activeFactionId !== factionId) {
                AvantisRealmsForgeApp.activeFactionId = factionId;
                this._saveScroll();
                this.render({force: true});
            }
        });

        // 2. Bouton "Afficher la carte politique"
        const btnMap = html.find('#rf-toggle-polmap');
        if (AvantisRealmsForgeApp.showPoliticalMap) btnMap.css({'background': '#f39c12', 'box-shadow': '0 0 10px #f39c12'}).html(`<i class="fas fa-eye-slash"></i> ${game.i18n.localize("REALMSFORGE.HUD.BtnHidePolMap")}`);
        
        btnMap.click((e) => {
            e.preventDefault();
            AvantisRealmsForgeApp.showPoliticalMap = !AvantisRealmsForgeApp.showPoliticalMap;
            AvantisRealmsForgeApp.drawPoliticalMap();
            this._saveScroll();
            this.render({force: true});
        });
        
        // 3. Créer une nouvelle faction
        html.find('#rf-add-faction').click(async (e) => {
            e.preventDefault();
            const allFactions = game.settings.get("ultimateforge", "factionsData") || {};
            const newId = foundry.utils.randomID();
            const randomColor = "#" + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');

            let factionName = "Nouvelle Faction";
            if (game.i18n.has("REALMSFORGE.HUD.NewFaction")) factionName = game.i18n.localize("REALMSFORGE.HUD.NewFaction");

            allFactions[newId] = {
                id: newId,
                name: factionName,
                type: "Royaume",
                level: "2",
                hexId: "",
                color: randomColor, 
                vibes: "",
                visible: true
            };
            await game.settings.set("ultimateforge", "factionsData", allFactions);
            
            AvantisRealmsForgeApp.activeFactionId = newId; // Ouvre la nouvelle faction
            this._saveScroll();
            this.render({force: true}); 
        });

        // 4. Importer les factions depuis le thème
        html.find('#rf-import-factions').click(async (e) => {
            e.preventDefault();
            let basePath = "modules/ultimateforge/data/default_fantasy";
            if (game.settings.settings.has("ultimateforge.activeThemePath")) {
                basePath = game.settings.get("ultimateforge", "activeThemePath").replace(/\/$/, "");
            }

            try {
                const response = await fetch(`${basePath}/factions.json`);
                if (!response.ok) throw new Error("Fichier introuvable");
                const themeFactions = await response.json();

                const allFactions = game.settings.get("ultimateforge", "factionsData") || {};
                const lang = String(game.i18n.lang).startsWith('en') ? 'en' : 'fr';
                let importedCount = 0;

                for (const [key, data] of Object.entries(themeFactions)) {
                    if (!allFactions[key]) { 
                        allFactions[key] = {
                            id: key,
                            name: data.name[lang] || data.name.fr || "Faction Inconnue",
                            type: data.type[lang] || data.type.fr || "Organisation",
                            level: data.level || "2",
                            vibes: data.vibes ? data.vibes.join(',') : "",
                            color: data.color || "#8e44ad",
                            hexId: "", 
                            visible: true
                        };
                        importedCount++;
                    }
                }

                if (importedCount > 0) {
                    await game.settings.set("ultimateforge", "factionsData", allFactions);
                    ui.notifications.success(game.i18n.format("REALMSFORGE.Notifications.ImportSuccess", {count: importedCount}));
                    this._saveScroll();
                    this.render({force: true});
                } else {
                    ui.notifications.info(game.i18n.localize("REALMSFORGE.Notifications.ImportAlreadyDone"));
                }

            } catch(err) {
                ui.notifications.warn(game.i18n.localize("REALMSFORGE.Notifications.NoFactionsFile"));
            }
        });

        // 5. Supprimer la faction active
        html.find('.rf-delete-faction').click(async (e) => {
            e.preventDefault();
            const factionId = html.find('#rf-active-faction-data').attr('data-id');
            if(!factionId) return;
            const allFactions = game.settings.get("ultimateforge", "factionsData");
            delete allFactions[factionId];
            await game.settings.set("ultimateforge", "factionsData", allFactions);
            AvantisRealmsForgeApp.activeFactionId = null;
            AvantisRealmsForgeApp.drawPoliticalMap();
            this._saveScroll();
            this.render({force: true});
        });

        // 6. Masquer/Afficher la faction active sur la carte
        html.find('.rf-toggle-visibility').click(async (e) => {
            e.preventDefault();
            const factionId = html.find('#rf-active-faction-data').attr('data-id');
            if(!factionId) return;
            const allFactions = game.settings.get("ultimateforge", "factionsData");
            if (allFactions[factionId]) {
                allFactions[factionId].visible = allFactions[factionId].visible === false ? true : false;
                await game.settings.set("ultimateforge", "factionsData", allFactions);
                AvantisRealmsForgeApp.drawPoliticalMap(); 
                this._saveScroll();
                this.render({force: true}); 
            }
        });

        // 7. Editer un champ texte ou couleur de la faction active
        html.find('.rf-edit-field').change(async (e) => {
            const input = $(e.currentTarget);
            const factionId = html.find('#rf-active-faction-data').attr('data-id');
            if(!factionId) return;
            const fieldName = input.data('field');
            const newValue = input.val();

            const allFactions = game.settings.get("ultimateforge", "factionsData");
            if (allFactions[factionId]) {
                allFactions[factionId][fieldName] = newValue;
                await game.settings.set("ultimateforge", "factionsData", allFactions);
                if (fieldName === 'color') AvantisRealmsForgeApp.drawPoliticalMap();
            }
        });

        // 8. Modifier les Vibes de la faction active
        html.find('.rf-vibe-checkbox').change(async (e) => {
            const factionId = html.find('#rf-active-faction-data').attr('data-id');
            if(!factionId) return;
            const allFactions = game.settings.get("ultimateforge", "factionsData");
            
            const checkedVibes = [];
            html.find('#rf-active-faction-data .rf-vibe-checkbox:checked').each(function() {
                checkedVibes.push($(this).val());
            });
            
            if (allFactions[factionId]) {
                allFactions[factionId].vibes = checkedVibes.join(',');
                await game.settings.set("ultimateforge", "factionsData", allFactions);
                this._saveScroll();
                this.render({force: true});
            }
        });

        // 9. Cibler la capitale
        html.find('.rf-target-btn').click(async (e) => {
            e.preventDefault();
            const btn = $(e.currentTarget);
            const factionId = html.find('#rf-active-faction-data').attr('data-id');
            if(!factionId) return;
            
            ui.notifications.info(game.i18n.localize("REALMSFORGE.Notifications.TargetCapital"));
            btn.css({'background': '#e74c3c', 'box-shadow': '0 0 10px #e74c3c'});
            $('body').css('cursor', 'crosshair');
            
            const targetHandler = async (canvasEvent) => {
                if (canvasEvent.data.originalEvent.button !== 0) return; 
                
                const position = canvasEvent.data.getLocalPosition(canvas.app.stage);
                let row, col;
                
                if (canvas.grid.getOffset) {
                    const offset = canvas.grid.getOffset({x: position.x, y: position.y});
                    row = offset.j; col = offset.i;
                } else {
                    const gridPos = canvas.grid.grid.getGridPositionFromPixels(position.x, position.y);
                    row = gridPos[0]; col = gridPos[1];
                }
                const targetHexId = `hex_${row}_${col}`;
                
                const allFactions = game.settings.get("ultimateforge", "factionsData");
                if (allFactions[factionId]) {
                    allFactions[factionId].hexId = targetHexId;
                    await game.settings.set("ultimateforge", "factionsData", allFactions);
                }
                
                $('body').css('cursor', 'default');
                canvas.stage.off('pointerdown', targetHandler);
                ui.notifications.success(game.i18n.format("REALMSFORGE.Notifications.CapitalLocked", {row: row, col: col}));
                this._saveScroll();
                this.render({force: true});
            };
            
            setTimeout(() => { canvas.stage.on('pointerdown', targetHandler); }, 150);
        });

        // 10. Lancer une vague d'influence
        html.find('.rf-propagate-btn').click(async (e) => {
            e.preventDefault();
            const factionId = html.find('#rf-active-faction-data').attr('data-id');
            if(!factionId) return;
            const allFactions = game.settings.get("ultimateforge", "factionsData");
            const faction = allFactions[factionId];

            if (!faction.hexId || !faction.vibes) {
                ui.notifications.warn(game.i18n.localize("REALMSFORGE.Notifications.NeedCapitalAndAura"));
                return;
            }

            const vibeTags = faction.vibes.split(',').map(t => t.trim().toLowerCase()).filter(t => t);
            const radius = Math.max(0, parseInt(faction.level) - 1);

            await this._propagateFactionAura(faction.hexId, vibeTags, radius, faction.name);
        });

        // 11. Ajuster l'influence sur un territoire manuellement (+/-)
        html.find('.rf-inf-btn').click(async (e) => {
            e.preventDefault();
            const btn = $(e.currentTarget);
            const factionId = html.find('#rf-active-faction-data').attr('data-id');
            if(!factionId) return;
            const targetHexId = btn.data('hex');
            const isPlus = btn.hasClass('rf-inf-plus');
            
            const hexData = canvas.scene.getFlag("ultimateforge", targetHexId) || {};
            const influences = { ...(hexData.influence || {}) };
            let currentScore = influences[factionId] || 0;
            
            if (isPlus) currentScore = Math.min(5, currentScore + 1);
            else currentScore = Math.max(0, currentScore - 1);
            
            if (currentScore === 0) {
                delete influences[factionId];
                influences[`-=${factionId}`] = null; 
            } else {
                influences[factionId] = currentScore;
            }

            let newVibeTags = [...(hexData.vibe_tags || [])];
            if (currentScore >= 3) {
                const allFactions = game.settings.get("ultimateforge", "factionsData") || {};
                const faction = allFactions[factionId];
                if (faction && faction.vibes) {
                    const fVibes = faction.vibes.split(',').map(v => v.trim().toLowerCase()).filter(v => v);

                    const foreignTags = newVibeTags.filter(t => !fVibes.includes(t));
                    if (foreignTags.length > 0) {
                        const tagToRemove = foreignTags[Math.floor(Math.random() * foreignTags.length)];
                        newVibeTags = newVibeTags.filter(t => t !== tagToRemove);
                    }
                    fVibes.forEach(t => { if (!newVibeTags.includes(t)) newVibeTags.push(t); });
                }
            }

            let unsets = {};
            unsets[`flags.ultimateforge.${targetHexId}.-=vibe_tags`] = null;
            await canvas.scene.update(unsets);

            let sets = {};
            sets[`flags.ultimateforge.${targetHexId}.influence`] = influences;
            sets[`flags.ultimateforge.${targetHexId}.vibe_tags`] = newVibeTags;
            await canvas.scene.update(sets);
            
            AvantisRealmsForgeApp.drawPoliticalMap();
            this._saveScroll();
            this.render({force: true}); 
        });

        // 12. Onglets Factions / Codex
        html.find('.rf-tab-item').click((e) => {
            html.find('.rf-tab-item').removeClass('active').css({'border-bottom': '3px solid transparent', 'color': '#555'});
            html.find('.rf-tab-content').hide();
            
            const targetTab = $(e.currentTarget).data('tab');
            $(e.currentTarget).addClass('active').css({'border-bottom': '3px solid #8e44ad', 'color': '#8e44ad'});
            html.find(`.rf-tab-content[data-tab="${targetTab}"]`).fadeIn(200);
        });

        // =======================================================
        // GESTION DU CODEX RÉGIONAL (Inchangé)
        // =======================================================
        html.find('#rf-codex-select').change(async (e) => {
            const regionId = $(e.currentTarget).val();
            if (!regionId || regionId === "none") return;
            const regionData = this.regionsStructure[regionId];
            const lang = String(game.i18n.lang).startsWith('en') ? 'en' : 'fr';
            const regionName = regionData.name[lang] || regionData.name.fr;
            const savedRegionsData = game.settings.get("ultimateforge", "regionsData") || {};
            const regionImg = savedRegionsData[regionId] || "modules/ultimateforge/data/default_fantasy/assets/landscape_default.webp";
            html.find('#rf-codex-img').attr('src', regionImg);
            
            const regionDesc = regionData.description ? (regionData.description[lang] || regionData.description.fr) : game.i18n.localize("REALMSFORGE.Narrative.NoHistory");
            let climateText = game.i18n.localize("REALMSFORGE.Narrative.ClimateDefault");
            
            if (regionData.weather_rules && regionData.weather_rules.weighted) {
                const w = regionData.weather_rules.weighted;
                if (w.clear >= 50 && w.rain < 20) climateText = game.i18n.localize("REALMSFORGE.Narrative.ClimateClear");
                else if (w.snow >= 30) climateText = game.i18n.localize("REALMSFORGE.Narrative.ClimateSnow");
                else if (w.rain >= 40) climateText = game.i18n.localize("REALMSFORGE.Narrative.ClimateRain");
                else if (w.fog >= 30) climateText = game.i18n.localize("REALMSFORGE.Narrative.ClimateFog");
            }
            
            let popText = game.i18n.localize("REALMSFORGE.Narrative.PopDefault");
            if (regionData.race_rules && regionData.race_rules.weighted) {
                const w = regionData.race_rules.weighted;
                const total = Object.values(w).reduce((a, b) => a + b, 0);
                const popArray = Object.entries(w).map(([race, weight]) => `<strong>${Math.round((weight/total)*100)}%</strong> ${race}`);
                popText = game.i18n.format("REALMSFORGE.Narrative.PopDetail", {demo: popArray.join(', ')});
            }
            
            let vibeText = "";
            if (regionData.vibe_rules) {
                const dominantVibes = Object.entries(regionData.vibe_rules)
                    .sort((a, b) => b[1] - a[1]).slice(0, 3).map(v => v[0].replace(/-/g, ' '));
                if (dominantVibes.length > 0) {
                    vibeText = game.i18n.format("REALMSFORGE.Narrative.VibeDetail", {vibes: dominantVibes.join(', ')});
                }
            }
            
            const titleLands = game.i18n.localize("REALMSFORGE.Narrative.TheLandsOf");
            const titleClimate = game.i18n.localize("REALMSFORGE.Narrative.ClimateTitle");
            const titleDemo = game.i18n.localize("REALMSFORGE.Narrative.DemoTitle");
            
            let narrativeHTML = `
                <h2 style="color: #2980b9; margin-top: 0; border-bottom: 2px solid #3498db; padding-bottom: 5px;"><i class="fas fa-map"></i> ${titleLands} ${regionName}</h2>
                <p style="font-style: italic; color: #444; border-left: 3px solid #bdc3c7; padding-left: 10px; margin-bottom: 15px;">${regionDesc}</p>
                <p style="margin-bottom: 8px;"><strong><i class="fas fa-cloud-sun"></i> ${titleClimate} :</strong> ${climateText}</p>
                <p style="margin-bottom: 8px;"><strong><i class="fas fa-users"></i> ${titleDemo} :</strong> ${popText}</p>
                <p style="margin-bottom: 0;"><i class="fas fa-theater-masks"></i> ${vibeText}</p>
            `;
            html.find('#rf-codex-narrative').html(narrativeHTML);
            html.find('#rf-codex-body').fadeIn(200);
            this.currentCodexContent = `<img src="${regionImg}" style="width:100%; border-radius: 8px; margin-bottom:15px;">` + narrativeHTML;
            this.currentCodexName = regionName;
            this.currentCodexId = regionId;
        });

        html.find('#rf-codex-img').click(async (e) => {
            if (!this.currentCodexId) return;
            new FilePicker({
                type: "image",
                callback: async (path) => {
                    $(e.currentTarget).attr('src', path);
                    const savedRegionsData = game.settings.get("ultimateforge", "regionsData") || {};
                    savedRegionsData[this.currentCodexId] = path;
                    await game.settings.set("ultimateforge", "regionsData", savedRegionsData);
                    this.currentCodexContent = `<img src="${path}" style="width:100%; border-radius: 8px; margin-bottom:15px;">` + html.find('#rf-codex-narrative').html();
                    ui.notifications.success(game.i18n.localize("REALMSFORGE.Notifications.ImageSaved"));
                }
            }).render(true);
        });

        html.find('#rf-btn-codex-journal').click(async (e) => {
            e.preventDefault();
            if (!this.currentCodexContent) return;
            const folderName = game.i18n.localize("REALMSFORGE.Dialogs.CodexFolder");
            let folder = game.folders.find(f => f.name === folderName && f.type === "JournalEntry");
            if (!folder) folder = await Folder.create({ name: folderName, type: "JournalEntry", color: "#8e44ad" });
            const entry = await JournalEntry.create({
                name: game.i18n.format("REALMSFORGE.Dialogs.RegionName", {name: this.currentCodexName}),
                folder: folder.id,
                pages: [{ name: game.i18n.localize("REALMSFORGE.Dialogs.InformationPage"), type: "text", text: { content: this.currentCodexContent, format: 1 } }]
            });
            entry.sheet.render(true);
            ui.notifications.success(game.i18n.localize("REALMSFORGE.Notifications.CodexArchived"));
        });

        html.find('#rf-btn-codex-raz').click(async (e) => {
            e.preventDefault();
            const regionId = this.currentCodexId;
            const confirm = await Dialog.confirm({
                title: game.i18n.localize("REALMSFORGE.Dialogs.ResetAurasTitle"),
                content: game.i18n.format("REALMSFORGE.Dialogs.ResetAurasContent", {name: this.currentCodexName}),
                yes: () => true, no: () => false, defaultYes: false
            });
            if (confirm) {
                const allHexes = canvas.scene?.flags?.["ultimateforge"] || {};
                let flagUpdates = {};
                for (const [hexId, hexData] of Object.entries(allHexes)) {
                    if (hexData.region === regionId) {
                        flagUpdates[`flags.ultimateforge.${hexId}.-=vibe_tags`] = null;
                        flagUpdates[`flags.ultimateforge.${hexId}.-=eco_tags`] = null;
                    }
                }
                if (Object.keys(flagUpdates).length > 0) {
                    await canvas.scene.update(flagUpdates);
                    ui.notifications.success(game.i18n.format("REALMSFORGE.Notifications.AurasPurged", {name: this.currentCodexName}));
                }
            }
        });

        html.find('#rf-btn-codex-purge').click(async (e) => {
            e.preventDefault();
            const regionId = this.currentCodexId;
            const confirm = await Dialog.confirm({
                title: game.i18n.localize("REALMSFORGE.Dialogs.CataclysmTitle"),
                content: game.i18n.format("REALMSFORGE.Dialogs.CataclysmContent", {name: this.currentCodexName}),
                yes: () => true, no: () => false, defaultYes: false
            });
            if (confirm) {
                const allHexes = canvas.scene?.flags?.["ultimateforge"] || {};
                let flagUpdates = {};
                let tileUpdates = [];
                let destroyedCount = 0;
                let basePath = "modules/ultimateforge/data/default_fantasy";
                if (game.settings.settings.has("ultimateforge.activeThemePath")) basePath = game.settings.get("ultimateforge", "activeThemePath").replace(/\/$/, "");
                const ruinsPath = `${basePath}/assets/ruins_city.webp`;

                for (const [hexId, hexData] of Object.entries(allHexes)) {
                    if (hexData.region === regionId && hexData.cityJournalId) {
                        flagUpdates[`flags.ultimateforge.${hexId}.-=cityJournalId`] = null;
                        flagUpdates[`flags.ultimateforge.${hexId}.-=occupation`] = null; 
                        flagUpdates[`flags.ultimateforge.${hexId}.overlay`] = "ruines_cite";
                        const tile = canvas.scene.tiles.find(t => t.flags["ultimateforge"]?.hexId === hexId);
                        if (tile) tileUpdates.push({ _id: tile.id, "texture.src": ruinsPath });
                        destroyedCount++;
                    }
                }
                if (destroyedCount > 0) {
                    await canvas.scene.update(flagUpdates);
                    if (tileUpdates.length > 0) await canvas.scene.updateEmbeddedDocuments("Tile", tileUpdates);
                    ui.notifications.success(game.i18n.format("REALMSFORGE.Notifications.PlacesDestroyed", {count: destroyedCount, name: this.currentCodexName}));
                }
            }
        }); 
    }

    _onClose() {
        super._onClose();
        AvantisRealmsForgeApp.showPoliticalMap = false; 
        if (AvantisRealmsForgeApp.politicalGraphics && !AvantisRealmsForgeApp.politicalGraphics.destroyed) {
            AvantisRealmsForgeApp.politicalGraphics.destroy();
            AvantisRealmsForgeApp.politicalGraphics = null;
        }
    }

    async _propagateFactionAura(centerHexId, vibeTags, radius, factionName) {
        if (!game.modules.get("ultimateforge")?.active) {
            ui.notifications.error(game.i18n.localize("REALMSFORGE.Notifications.HexForgeMissing"));
            return;
        }

        const parts = centerHexId.split('_');
        if (parts.length !== 3) {
            ui.notifications.error(game.i18n.localize("REALMSFORGE.Notifications.InvalidCapital"));
            return;
        }

        const cRow = parseInt(parts[1]);
        const cCol = parseInt(parts[2]);
        
        let flagUnsets = {};
        let flagSets = {};
        let hexCount = 0;
        
        const rawFactions = game.settings.get("ultimateforge", "factionsData") || {};
        const factionId = Object.values(rawFactions).find(f => f.name === factionName)?.id;
        
        if (!factionId) return;

        for (let r = cRow - radius; r <= cRow + radius; r++) {
            for (let c = cCol - radius; c <= cCol + radius; c++) {
                if (radius > 0 && Math.abs(r - cRow) === radius && Math.abs(c - cCol) === radius) continue; 
                
                const hexId = `hex_${r}_${c}`;
                const existingData = canvas.scene.getFlag("ultimateforge", hexId) || {};
                const influences = { ...(existingData.influence || {}) };
                
                const currentScore = influences[factionId] || 0;
                if (currentScore < 5) {
                    const newScore = currentScore + 1;
                    influences[factionId] = newScore;
                    
                    let newVibeTags = [...(existingData.vibe_tags || [])];
                    if (newScore >= 3 && vibeTags && vibeTags.length > 0) {
                        
                        const foreignTags = newVibeTags.filter(t => !vibeTags.includes(t));
                        if (foreignTags.length > 0) {
                            const tagToRemove = foreignTags[Math.floor(Math.random() * foreignTags.length)];
                            newVibeTags = newVibeTags.filter(t => t !== tagToRemove);
                        }

                        vibeTags.forEach(t => {
                            if (t && !newVibeTags.includes(t)) newVibeTags.push(t);
                        });
                    }

                    flagUnsets[`flags.ultimateforge.${hexId}.-=vibe_tags`] = null;
                    flagSets[`flags.ultimateforge.${hexId}.influence`] = influences;
                    flagSets[`flags.ultimateforge.${hexId}.vibe_tags`] = newVibeTags;
                    
                    hexCount++;
                }
            }
        }
        
        if (hexCount > 0) {
            if (Object.keys(flagUnsets).length > 0) await canvas.scene.update(flagUnsets);
            await canvas.scene.update(flagSets);
            
            ui.notifications.success(game.i18n.format("REALMSFORGE.Notifications.InfluenceProgress", {name: factionName, count: hexCount}));
            AvantisRealmsForgeApp.drawPoliticalMap();
            this._saveScroll();
            this.render({force: true});
        } else {
            ui.notifications.info(game.i18n.format("REALMSFORGE.Notifications.MaxInfluence", {name: factionName}));
        }
    }

    _saveScroll() {
        if (!this.element) return;
        const html = $(this.element);
        const scrollContainer = html.find('.window-content').length ? html.find('.window-content') : html;
        this._savedScrollTop = scrollContainer.scrollTop();
    }

    _restoreScroll() {
        if (this._savedScrollTop !== undefined && this.element) {
            const html = $(this.element);
            const scrollContainer = html.find('.window-content').length ? html.find('.window-content') : html;
            scrollContainer.scrollTop(this._savedScrollTop);
        }
    }

    static drawPoliticalMap() {
        if (!canvas.ready) return;

        if (!AvantisRealmsForgeApp.politicalGraphics || AvantisRealmsForgeApp.politicalGraphics.destroyed) {
            AvantisRealmsForgeApp.politicalGraphics = new PIXI.Graphics();
            AvantisRealmsForgeApp.politicalGraphics.zIndex = -1; 
            
            if (canvas.primary) {
                 canvas.primary.addChild(AvantisRealmsForgeApp.politicalGraphics);
            } else if (canvas.tokens) {
                 canvas.tokens.addChild(AvantisRealmsForgeApp.politicalGraphics);
            } else {
                 canvas.stage.addChild(AvantisRealmsForgeApp.politicalGraphics);
            }
        }

        if (AvantisRealmsForgeApp.politicalGraphics && !AvantisRealmsForgeApp.politicalGraphics.destroyed) {
             AvantisRealmsForgeApp.politicalGraphics.clear();
        } else {
            return; 
        }

        if (!AvantisRealmsForgeApp.showPoliticalMap) return;

        const allHexes = canvas.scene.flags?.["ultimateforge"] || {};
        const rawFactions = game.settings.get("ultimateforge", "factionsData") || {};

        for (const [hexId, hexData] of Object.entries(allHexes)) {
            if (!hexData.influence) continue;

            let maxScore = 0;
            let dominantFactionId = null;
            for (const [fId, score] of Object.entries(hexData.influence)) {
                const faction = rawFactions[fId];
                if (faction && faction.visible !== false) {
                    if (score > maxScore) {
                        maxScore = score;
                        dominantFactionId = fId;
                    }
                }
            }

            if (!dominantFactionId || maxScore === 0) continue;

            const faction = rawFactions[dominantFactionId];
            const hexColorString = faction?.color || "#8e44ad";
            const colorHex = PIXI.utils.string2hex(hexColorString);
            const alpha = (maxScore / 5) * 0.75; 

            AvantisRealmsForgeApp.politicalGraphics.beginFill(colorHex, alpha);
            AvantisRealmsForgeApp.politicalGraphics.lineStyle(2, colorHex, alpha + 0.2);

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
                points = [ cx, cy - h, cx + w, cy - h/2, cx + w, cy + h/2, cx, cy + h, cx - w, cy + h/2, cx - w, cy - h/2 ];
            } else if (gridType === 4 || gridType === 5) {
                points = [ cx - w/2, cy - h, cx + w/2, cy - h, cx + w, cy, cx + w/2, cy + h, cx - w/2, cy + h, cx - w, cy ];
            } else {
                points = [ pt.x, pt.y, pt.x + width, pt.y, pt.x + width, pt.y + height, pt.x, pt.y + height ];
            }

            AvantisRealmsForgeApp.politicalGraphics.drawPolygon(points);
            AvantisRealmsForgeApp.politicalGraphics.endFill();
        }
    }
}

Hooks.once("init", () => {
    game.settings.register("ultimateforge", "factionsData", {
        name: "REALMSFORGE.Narrative.SettingsFactions",
        scope: "world",
        config: false,
        type: Object,
        default: {} 
    });

    game.settings.register("ultimateforge", "regionsData", {
        name: "REALMSFORGE.Narrative.SettingsRegions",
        scope: "world",
        config: false,
        type: Object,
        default: {} 
    });
    
    globalThis.AvantisRealmsForgeApp = AvantisRealmsForgeApp;
    console.log("RealmsForge | Initialisation V3 Master-Detail terminée.");
});