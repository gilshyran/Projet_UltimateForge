// ============================================================================
// ULTIMATEFORGE - REALMSFORGE (Moteur Géopolitique & Monde Vivant)
// ============================================================================

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class AvantisRealmsForgeApp extends HandlebarsApplicationMixin(ApplicationV2) {

    // NOUVELLE SYNTAXE V2 POUR LES OPTIONS (Fenêtre plus grande pour le confort)
    static DEFAULT_OPTIONS = {
        id: "realmsforge-hud",
        window: {
            title: "RealmsForge - Équilibre des Pouvoirs",
            resizable: true
        },
        position: {
            width: 650,
            height: 750
        }
    };

    static PARTS = {
        main: {
            template: "modules/ultimateforge-realmsforge/templates/realmsforge-hud.hbs"
        }
    };

    static showPoliticalMap = false;
    static politicalGraphics = null;

    async _prepareContext(options) {
        const rawFactions = game.settings.get("ultimateforge-realmsforge", "factionsData") || {};
        
        let basePath = "modules/ultimateforge-core/data/default_fantasy";
        if (game.settings.settings.has("ultimateforge-core.activeThemePath")) {
            basePath = game.settings.get("ultimateforge-core", "activeThemePath");
            if (basePath.endsWith("/")) basePath = basePath.slice(0, -1);
        }
        
        let temperaments = {};
        let regionsStructure = {};
        try {
            temperaments = await fetch(`${basePath}/temperament.json`).then(r => r.json());
            regionsStructure = await fetch(`${basePath}/regions-structure.json`).then(r => r.json());
            this.regionsStructure = regionsStructure; 
        } catch(e) { console.warn("RealmsForge | Erreur de chargement JSON"); }

        const vibeSet = new Set();
        for (const category of Object.values(temperaments)) {
            if (Array.isArray(category)) {
                category.forEach(item => { if (item.output_tags) item.output_tags.forEach(t => vibeSet.add(t)); });
            }
        }
        const formatLabel = (tag) => tag.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        const availableVibes = Array.from(vibeSet).sort().map(t => ({ value: t, label: formatLabel(t) }));

        const allMapHexes = canvas.scene?.flags?.["ultimateforge-hexforge"] || {};
        
        const factionsArray = Object.values(rawFactions).map(f => {
            const fVibes = f.vibes ? f.vibes.split(',').map(v => v.trim()) : [];
            
            const territories = [];
            for (const [hexId, hexData] of Object.entries(allMapHexes)) {
                if (hexData.influence && hexData.influence[f.id] > 0) {
                    const score = hexData.influence[f.id];
                    let tName = `Case ${hexId.replace('hex_', '').replace('_', ', ')}`;
                    let isCity = false;

                    if (hexData.cityJournalId) {
                        const journal = game.journal.get(hexData.cityJournalId);
                        if (journal) {
                            tName = journal.name;
                            isCity = true;
                        }
                    }

                    let dots = "";
                    for(let i=0; i<5; i++) { dots += (i < score) ? "🔴" : "⚪"; }

                    territories.push({ hexId: hexId, name: tName, isCity: isCity, score: score, dots: dots });
                }
            }
            
            territories.sort((a, b) => {
                if (a.isCity && !b.isCity) return -1;
                if (!a.isCity && b.isCity) return 1;
                return a.name.localeCompare(b.name);
            });

            return {
                ...f,
                visible: f.visible !== false, // Vrai par défaut
                vibeList: availableVibes.map(av => ({ ...av, selected: fVibes.includes(av.value) })),
                territories: territories 
            };
        });

        const allCodexRegions = [];
        const lang = (game.i18n.language || "fr").startsWith('en') ? 'en' : 'fr';
        for (const [key, data] of Object.entries(regionsStructure)) {
            allCodexRegions.push({ id: key, name: data.name[lang] || data.name.fr });
        }
        allCodexRegions.sort((a, b) => a.name.localeCompare(b.name));

        return {
            factions: factionsArray,
            allCodexRegions: allCodexRegions
        };
    }

    _onRender(context, options) {
        super._onRender(context, options);
        const html = $(this.element);

        // BOUTON : Activer/Désactiver la Vision Politique
        const btnMap = html.find('#rf-toggle-polmap');
        if (AvantisRealmsForgeApp.showPoliticalMap) btnMap.css({'background': '#f39c12', 'box-shadow': '0 0 10px #f39c12'}).html('<i class="fas fa-eye-slash"></i> Masquer la Vision');
        
        btnMap.click((e) => {
            e.preventDefault();
            AvantisRealmsForgeApp.showPoliticalMap = !AvantisRealmsForgeApp.showPoliticalMap;
            AvantisRealmsForgeApp.drawPoliticalMap();
            this.render({force: true});
        });
        
        // Ajouter une faction
        html.find('#rf-add-faction').click(async (e) => {
            e.preventDefault();
            const newId = foundry.utils.randomID();
            const newFaction = {
                id: newId,
                name: "Nouvelle Puissance",
                type: "Royaume",
                level: "2",
                vibes: "",
                hexId: "",
                visible: true
            };
            const allFactions = game.settings.get("ultimateforge-realmsforge", "factionsData");
            allFactions[newId] = newFaction;
            await game.settings.set("ultimateforge-realmsforge", "factionsData", allFactions);
            this.render({force: true}); 
        });
        // NOUVEAU BOUTON : IMPORTER LES FACTIONS DU THÈME
        html.find('#rf-import-factions').click(async (e) => {
            e.preventDefault();
            
            let basePath = "modules/ultimateforge-core/data/default_fantasy";
            if (game.settings.settings.has("ultimateforge-core.activeThemePath")) {
                basePath = game.settings.get("ultimateforge-core", "activeThemePath").replace(/\/$/, "");
            }

            try {
                const response = await fetch(`${basePath}/factions.json`);
                if (!response.ok) throw new Error("Fichier introuvable");
                const themeFactions = await response.json();

                const allFactions = game.settings.get("ultimateforge-realmsforge", "factionsData") || {};
                const lang = (game.i18n.language || "fr").startsWith('en') ? 'en' : 'fr';
                let importedCount = 0;

                for (const [key, data] of Object.entries(themeFactions)) {
                    // On importe seulement si la faction n'existe pas déjà (évite les doublons ou d'écraser les modifs du MJ)
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
                    await game.settings.set("ultimateforge-realmsforge", "factionsData", allFactions);
                    ui.notifications.success(`RealmsForge | ${importedCount} faction(s) importée(s) depuis le thème !`);
                    this.render({force: true});
                } else {
                    ui.notifications.info("RealmsForge | Toutes les factions de ce thème sont déjà dans votre monde.");
                }

            } catch(err) {
                ui.notifications.warn("RealmsForge | Aucun fichier factions.json trouvé pour ce thème.");
            }
        });

        // Supprimer une faction
        html.find('.rf-delete-faction').click(async (e) => {
            e.preventDefault();
            const card = $(e.currentTarget).closest('.rf-faction-card');
            const factionId = card.data('id');
            const allFactions = game.settings.get("ultimateforge-realmsforge", "factionsData");
            delete allFactions[factionId];
            await game.settings.set("ultimateforge-realmsforge", "factionsData", allFactions);
            AvantisRealmsForgeApp.drawPoliticalMap();
            this.render({force: true});
        });

        // NOUVEAU : Masquer / Afficher une Faction (L'Œil magique !)
        html.find('.rf-toggle-visibility').click(async (e) => {
            e.preventDefault();
            const card = $(e.currentTarget).closest('.rf-faction-card');
            const factionId = card.data('id');
            const allFactions = game.settings.get("ultimateforge-realmsforge", "factionsData");
            if (allFactions[factionId]) {
                // Inverse la visibilité
                allFactions[factionId].visible = allFactions[factionId].visible === false ? true : false;
                await game.settings.set("ultimateforge-realmsforge", "factionsData", allFactions);
                AvantisRealmsForgeApp.drawPoliticalMap(); // Met à jour la carte en direct
                this.render({force: true}); // Met à jour l'icône de l'œil
            }
        });

        // Sauvegarde automatique quand on tape dans un champ texte
        html.find('.rf-edit-field').change(async (e) => {
            const input = $(e.currentTarget);
            const card = input.closest('.rf-faction-card');
            const factionId = card.data('id');
            const fieldName = input.data('field');
            const newValue = input.val();

            const allFactions = game.settings.get("ultimateforge-realmsforge", "factionsData");
            if (allFactions[factionId]) {
                allFactions[factionId][fieldName] = newValue;
                await game.settings.set("ultimateforge-realmsforge", "factionsData", allFactions);
                if (fieldName === 'color') AvantisRealmsForgeApp.drawPoliticalMap();
            }
        });

        // Enregistrement des tags cochés
        html.find('.rf-vibe-checkbox').change(async (e) => {
            const card = $(e.currentTarget).closest('.rf-faction-card');
            const factionId = card.data('id');
            const allFactions = game.settings.get("ultimateforge-realmsforge", "factionsData");
            
            const checkedVibes = [];
            card.find('.rf-vibe-checkbox:checked').each(function() {
                checkedVibes.push($(this).val());
            });
            
            if (allFactions[factionId]) {
                allFactions[factionId].vibes = checkedVibes.join(',');
                await game.settings.set("ultimateforge-realmsforge", "factionsData", allFactions);
                this.render({force: true});
            }
        });

        // Le système de Ciblage sur la carte (Le Sniper !)
        html.find('.rf-target-btn').click(async (e) => {
            e.preventDefault();
            const btn = $(e.currentTarget);
            const card = btn.closest('.rf-faction-card');
            const factionId = card.data('id');
            
            ui.notifications.info("RealmsForge | 🎯 Cliquez sur une case de la carte pour définir la Capitale.");
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
                
                const allFactions = game.settings.get("ultimateforge-realmsforge", "factionsData");
                if (allFactions[factionId]) {
                    allFactions[factionId].hexId = targetHexId;
                    await game.settings.set("ultimateforge-realmsforge", "factionsData", allFactions);
                }
                
                $('body').css('cursor', 'default');
                canvas.stage.off('pointerdown', targetHandler);
                ui.notifications.success(`RealmsForge | Capitale verrouillée sur [${row}, ${col}].`);
                this.render({force: true});
            };
            
            setTimeout(() => { canvas.stage.on('pointerdown', targetHandler); }, 150);
        });

        // PROPAGER L'INFLUENCE
        html.find('.rf-propagate-btn').click(async (e) => {
            e.preventDefault();
            const card = $(e.currentTarget).closest('.rf-faction-card');
            const factionId = card.data('id');
            const allFactions = game.settings.get("ultimateforge-realmsforge", "factionsData");
            const faction = allFactions[factionId];

            if (!faction.hexId || !faction.vibes) {
                ui.notifications.warn("RealmsForge | La faction doit avoir une Capitale et des tags d'Aura !");
                return;
            }

            const vibeTags = faction.vibes.split(',').map(t => t.trim().toLowerCase()).filter(t => t);
            const radius = Math.max(0, parseInt(faction.level) - 1);

            await this._propagateFactionAura(faction.hexId, vibeTags, radius, faction.name);
        });

        // AJUSTER L'INFLUENCE MANUELLEMENT (+ et -)
        html.find('.rf-inf-btn').click(async (e) => {
            e.preventDefault();
            const btn = $(e.currentTarget);
            const factionId = btn.closest('.rf-faction-card').data('id');
            const targetHexId = btn.data('hex');
            const isPlus = btn.hasClass('rf-inf-plus');
            
            const hexData = canvas.scene.getFlag("ultimateforge-hexforge", targetHexId) || {};
            const influences = { ...(hexData.influence || {}) };
            let currentScore = influences[factionId] || 0;
            
            if (isPlus) currentScore = Math.min(5, currentScore + 1);
            else currentScore = Math.max(0, currentScore - 1);
            
            if (currentScore === 0) {
                delete influences[factionId];
                influences[`-=${factionId}`] = null; // Oblige Foundry à supprimer l'entrée
            } else {
                influences[factionId] = currentScore;
            }

            // --- ASSIMILATION ET PURGE CULTURELLE ---
            let newVibeTags = [...(hexData.vibe_tags || [])];
            if (currentScore >= 3) {
                const allFactions = game.settings.get("ultimateforge-realmsforge", "factionsData") || {};
                const faction = allFactions[factionId];
                if (faction && faction.vibes) {
                    const fVibes = faction.vibes.split(',').map(v => v.trim().toLowerCase()).filter(v => v);

                    // 1. Purge d'un tag étranger (Éradication de l'ancienne culture)
                    const foreignTags = newVibeTags.filter(t => !fVibes.includes(t));
                    if (foreignTags.length > 0) {
                        const tagToRemove = foreignTags[Math.floor(Math.random() * foreignTags.length)];
                        newVibeTags = newVibeTags.filter(t => t !== tagToRemove);
                    }

                    // 2. Ajout des tags de la faction
                    fVibes.forEach(t => { if (!newVibeTags.includes(t)) newVibeTags.push(t); });
                }
            }

            // CORRECTION FOUNDRY : On utilise des chemins stricts pour FORCER l'écrasement du tableau
            await canvas.scene.setFlag("ultimateforge-hexforge", `${targetHexId}.influence`, influences);
            await canvas.scene.setFlag("ultimateforge-hexforge", `${targetHexId}.vibe_tags`, newVibeTags);
            
            AvantisRealmsForgeApp.drawPoliticalMap();
            this.render({force: true}); 
        });
// AJUSTER L'INFLUENCE MANUELLEMENT (+ et -)
        html.find('.rf-inf-btn').click(async (e) => {
            e.preventDefault();
            const btn = $(e.currentTarget);
            const factionId = btn.closest('.rf-faction-card').data('id');
            const targetHexId = btn.data('hex');
            const isPlus = btn.hasClass('rf-inf-plus');
            
            const hexData = canvas.scene.getFlag("ultimateforge-hexforge", targetHexId) || {};
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

            // --- ASSIMILATION ET PURGE CULTURELLE ---
            let newVibeTags = [...(hexData.vibe_tags || [])];
            if (currentScore >= 3) {
                const allFactions = game.settings.get("ultimateforge-realmsforge", "factionsData") || {};
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

            // CORRECTION FOUNDRY : On détruit l'ancien tableau AVANT d'écrire le nouveau
            let unsets = {};
            unsets[`flags.ultimateforge-hexforge.${targetHexId}.-=vibe_tags`] = null;
            await canvas.scene.update(unsets);

            let sets = {};
            sets[`flags.ultimateforge-hexforge.${targetHexId}.influence`] = influences;
            sets[`flags.ultimateforge-hexforge.${targetHexId}.vibe_tags`] = newVibeTags;
            await canvas.scene.update(sets);
            
            AvantisRealmsForgeApp.drawPoliticalMap();
            this.render({force: true}); 
        });

        // GESTION DES ONGLETS
        html.find('.rf-tab-item').click((e) => {
            html.find('.rf-tab-item').removeClass('active').css({'border-bottom': '3px solid transparent', 'color': '#555'});
            html.find('.rf-tab-content').hide();
            
            const targetTab = $(e.currentTarget).data('tab');
            $(e.currentTarget).addClass('active').css({'border-bottom': '3px solid #8e44ad', 'color': '#8e44ad'});
            html.find(`.rf-tab-content[data-tab="${targetTab}"]`).fadeIn(200);
        });

        // GESTION DU CODEX RÉGIONAL
        html.find('#rf-codex-select').change(async (e) => {
            // (Code du codex inchangé, conservé à l'identique)
            const regionId = $(e.currentTarget).val();
            if (!regionId || regionId === "none") return;
            const regionData = this.regionsStructure[regionId];
            const lang = (game.i18n.language || "fr").startsWith('en') ? 'en' : 'fr';
            const regionName = regionData.name[lang] || regionData.name.fr;
            const savedRegionsData = game.settings.get("ultimateforge-realmsforge", "regionsData") || {};
            const regionImg = savedRegionsData[regionId] || "modules/ultimateforge-core/data/default_fantasy/assets/landscape_default.webp";
            html.find('#rf-codex-img').attr('src', regionImg);
            const regionDesc = regionData.description ? (regionData.description[lang] || regionData.description.fr) : (lang === 'en' ? "No historical records available for this region." : "Aucune archive historique disponible pour cette région.");
            let climateText = lang === 'en' ? "The climate is temperate and changes with the seasons." : "Le climat y est tempéré et changeant au gré des saisons.";
            if (regionData.weather_rules && regionData.weather_rules.weighted) {
                const w = regionData.weather_rules.weighted;
                if (w.clear >= 50 && w.rain < 20) climateText = lang === 'en' ? "This region enjoys a particularly mild climate and radiant sunshine almost all year round." : "Cette région bénéficie d'un climat particulièrement clément et d'un ensoleillement radieux presque toute l'année.";
                else if (w.snow >= 30) climateText = lang === 'en' ? "It is a harsh and inhospitable land, swept by freezing winters and frequent blizzards." : "C'est une terre rude et inhospitalière, balayée par des hivers glaciaux et de fréquentes tempêtes de neige.";
                else if (w.rain >= 40) climateText = lang === 'en' ? "The territory is subject to very high humidity, punctuated by constant showers under an often heavy sky." : "Le territoire est soumis à une très forte humidité, rythmé par des averses constantes sous un ciel souvent lourd.";
                else if (w.fog >= 30) climateText = lang === 'en' ? "A thick and mysterious fog almost permanently clings to the region's reliefs." : "Un brouillard épais et mystérieux s'accroche presque en permanence aux reliefs de la région.";
            }
            let popText = lang === 'en' ? "Its population is extremely diverse." : "Sa population est particulièrement hétéroclite.";
            if (regionData.race_rules && regionData.race_rules.weighted) {
                const w = regionData.race_rules.weighted;
                const total = Object.values(w).reduce((a, b) => a + b, 0);
                const popArray = Object.entries(w).map(([race, weight]) => `<strong>${Math.round((weight/total)*100)}%</strong> ${race}`);
                popText = lang === 'en' ? `The local demographics consist of approximately ${popArray.join(', ')}.` : `La démographie locale est composée à environ ${popArray.join(', ')}.`;
            }
            let vibeText = "";
            if (regionData.vibe_rules) {
                const dominantVibes = Object.entries(regionData.vibe_rules)
                    .sort((a, b) => b[1] - a[1]).slice(0, 3).map(v => v[0].replace(/-/g, ' '));
                if (dominantVibes.length > 0) {
                    vibeText = lang === 'en' 
                        ? `The natural atmosphere of this land is characterized by notions of <strong style="color:#8e44ad; text-transform:capitalize;">${dominantVibes.join(', ')}</strong>.` 
                        : `L'atmosphère naturelle de cette contrée est caractérisée par des notions de <strong style="color:#8e44ad; text-transform:capitalize;">${dominantVibes.join(', ')}</strong>.`;
                }
            }
            const titleLands = lang === 'en' ? 'The Lands of' : 'Les Terres de';
            const titleClimate = lang === 'en' ? 'Climate & Environment' : 'Climat & Environnement';
            const titleDemo = lang === 'en' ? 'Demographics' : 'Démographie';
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
                    const savedRegionsData = game.settings.get("ultimateforge-realmsforge", "regionsData") || {};
                    savedRegionsData[this.currentCodexId] = path;
                    await game.settings.set("ultimateforge-realmsforge", "regionsData", savedRegionsData);
                    this.currentCodexContent = `<img src="${path}" style="width:100%; border-radius: 8px; margin-bottom:15px;">` + html.find('#rf-codex-narrative').html();
                    ui.notifications.success("RealmsForge | Illustration sauvegardée !");
                }
            }).render(true);
        });

        html.find('#rf-btn-codex-journal').click(async (e) => {
            e.preventDefault();
            if (!this.currentCodexContent) return;
            let folder = game.folders.find(f => f.name === "Codex Régional" && f.type === "JournalEntry");
            if (!folder) folder = await Folder.create({ name: "Codex Régional", type: "JournalEntry", color: "#8e44ad" });
            const entry = await JournalEntry.create({
                name: `Région : ${this.currentCodexName}`,
                folder: folder.id,
                pages: [{ name: "Informations", type: "text", text: { content: this.currentCodexContent, format: 1 } }]
            });
            entry.sheet.render(true);
            ui.notifications.success("RealmsForge | Codex archivé avec succès !");
        });

        html.find('#rf-btn-codex-raz').click(async (e) => {
            e.preventDefault();
            const regionId = this.currentCodexId;
            const confirm = await Dialog.confirm({
                title: "Remise à zéro des Auras",
                content: `<p>Voulez-vous dissiper <strong>toutes les auras d'influence</strong> de la région ${this.currentCodexName} ? Les cités resteront intactes.</p>`,
                yes: () => true, no: () => false, defaultYes: false
            });
            if (confirm) {
                const allHexes = canvas.scene?.flags?.["ultimateforge-hexforge"] || {};
                let flagUpdates = {};
                for (const [hexId, hexData] of Object.entries(allHexes)) {
                    if (hexData.region === regionId) {
                        flagUpdates[`flags.ultimateforge-hexforge.${hexId}.-=vibe_tags`] = null;
                        flagUpdates[`flags.ultimateforge-hexforge.${hexId}.-=eco_tags`] = null;
                    }
                }
                if (Object.keys(flagUpdates).length > 0) {
                    await canvas.scene.update(flagUpdates);
                    ui.notifications.success(`RealmsForge | Les auras de la région ${this.currentCodexName} ont été purgées.`);
                }
            }
        });

        html.find('#rf-btn-codex-purge').click(async (e) => {
            e.preventDefault();
            const regionId = this.currentCodexId;
            const confirm = await Dialog.confirm({
                title: "Cataclysme Régional",
                content: `<h3 style="color:red;">Attention !</h3><p>Vous allez transformer <strong>TOUTES les colonies</strong> de la région ${this.currentCodexName} en ruines.</p>`,
                yes: () => true, no: () => false, defaultYes: false
            });
            if (confirm) {
                const allHexes = canvas.scene?.flags?.["ultimateforge-hexforge"] || {};
                let flagUpdates = {};
                let tileUpdates = [];
                let destroyedCount = 0;
                let basePath = "modules/ultimateforge-core/data/default_fantasy";
                if (game.settings.settings.has("ultimateforge-core.activeThemePath")) basePath = game.settings.get("ultimateforge-core", "activeThemePath").replace(/\/$/, "");
                const ruinsPath = `${basePath}/assets/ruins_city.png`;

                for (const [hexId, hexData] of Object.entries(allHexes)) {
                    if (hexData.region === regionId && hexData.cityJournalId) {
                        flagUpdates[`flags.ultimateforge-hexforge.${hexId}.-=cityJournalId`] = null;
                        flagUpdates[`flags.ultimateforge-hexforge.${hexId}.-=trait`] = null;
                        flagUpdates[`flags.ultimateforge-hexforge.${hexId}.overlay`] = "ruines_cite";
                        const tile = canvas.scene.tiles.find(t => t.flags["ultimateforge-hexforge"]?.hexId === hexId);
                        if (tile) tileUpdates.push({ _id: tile.id, "texture.src": ruinsPath });
                        destroyedCount++;
                    }
                }
                if (destroyedCount > 0) {
                    await canvas.scene.update(flagUpdates);
                    if (tileUpdates.length > 0) await canvas.scene.updateEmbeddedDocuments("Tile", tileUpdates);
                    ui.notifications.success(`RealmsForge | ${destroyedCount} lieux ont été détruits en ${this.currentCodexName}.`);
                }
            }
        }); 
    }

    // =========================================================================
    // NETTOYAGE A LA FERMETURE DE L'APPLICATION
    // =========================================================================
    _onClose() {
        super._onClose();
        AvantisRealmsForgeApp.showPoliticalMap = false; // Désactive la vue
        if (AvantisRealmsForgeApp.politicalGraphics && !AvantisRealmsForgeApp.politicalGraphics.destroyed) {
            AvantisRealmsForgeApp.politicalGraphics.destroy();
            AvantisRealmsForgeApp.politicalGraphics = null;
        }
    }

    // =========================================================================
    // LE MOTEUR DE PROPAGATION
    // =========================================================================
    async _propagateFactionAura(centerHexId, vibeTags, radius, factionName) {
        if (!game.modules.get("ultimateforge-hexforge")?.active) {
            ui.notifications.error("RealmsForge | HexForge n'est pas activé !");
            return;
        }

        const parts = centerHexId.split('_');
        if (parts.length !== 3) {
            ui.notifications.error("RealmsForge | Format de Capitale invalide. Ciblez une case d'abord.");
            return;
        }

        const cRow = parseInt(parts[1]);
        const cCol = parseInt(parts[2]);
        
        let flagUnsets = {};
        let flagSets = {};
        let hexCount = 0;
        
        const rawFactions = game.settings.get("ultimateforge-realmsforge", "factionsData") || {};
        const factionId = Object.values(rawFactions).find(f => f.name === factionName)?.id;
        
        if (!factionId) return;

        for (let r = cRow - radius; r <= cRow + radius; r++) {
            for (let c = cCol - radius; c <= cCol + radius; c++) {
                if (radius > 0 && Math.abs(r - cRow) === radius && Math.abs(c - cCol) === radius) continue; 
                
                const hexId = `hex_${r}_${c}`;
                const existingData = canvas.scene.getFlag("ultimateforge-hexforge", hexId) || {};
                const influences = { ...(existingData.influence || {}) };
                
                const currentScore = influences[factionId] || 0;
                if (currentScore < 5) {
                    const newScore = currentScore + 1;
                    influences[factionId] = newScore;
                    
                    // --- ASSIMILATION ET PURGE CULTURELLE ---
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

                    // CORRECTION FOUNDRY : Requêtes de destruction et d'écriture séparées
                    flagUnsets[`flags.ultimateforge-hexforge.${hexId}.-=vibe_tags`] = null;
                    
                    flagSets[`flags.ultimateforge-hexforge.${hexId}.influence`] = influences;
                    flagSets[`flags.ultimateforge-hexforge.${hexId}.vibe_tags`] = newVibeTags;
                    
                    hexCount++;
                }
            }
        }
        
        if (hexCount > 0) {
            // On lance la destruction des vieux tags, puis on écrit les nouveaux
            if (Object.keys(flagUnsets).length > 0) await canvas.scene.update(flagUnsets);
            await canvas.scene.update(flagSets);
            
            ui.notifications.success(`RealmsForge | L'influence de ${factionName} a progressé sur ${hexCount} territoires !`);
            AvantisRealmsForgeApp.drawPoliticalMap();
            this.render({force: true});
        } else {
            ui.notifications.info(`RealmsForge | ${factionName} contrôle déjà ce territoire d'une main de fer (Niv 5).`);
        }
    }

    // =========================================================================
    // LE DESSIN DU CALQUE GÉOPOLITIQUE (Méthode Géométrique Absolue)
    // =========================================================================
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

        const allHexes = canvas.scene.flags?.["ultimateforge-hexforge"] || {};
        const rawFactions = game.settings.get("ultimateforge-realmsforge", "factionsData") || {};

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

            // 1. Récupération de l'origine de la case
            const pt = canvas.grid.getTopLeftPoint({i: col, j: row});
            
            // 2. Récupération des dimensions de la case (Compatibilité universelle)
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

            // On dessine le polygone généré
            AvantisRealmsForgeApp.politicalGraphics.drawPolygon(points);
            AvantisRealmsForgeApp.politicalGraphics.endFill();
        }
    }

}

Hooks.once("init", () => {
    game.settings.register("ultimateforge-realmsforge", "factionsData", {
        name: "Base de données des Factions",
        scope: "world",
        config: false,
        type: Object,
        default: {} 
    });

    game.settings.register("ultimateforge-realmsforge", "regionsData", {
        name: "Base de données du Codex Régional",
        scope: "world",
        config: false,
        type: Object,
        default: {} 
    });
    
    globalThis.AvantisRealmsForgeApp = AvantisRealmsForgeApp;
    console.log("RealmsForge | Initialisation V2 terminée.");
});