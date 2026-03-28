// ============================================================================
// ULTIMATEFORGE - REALMSFORGE (Moteur Géopolitique & Monde Vivant)
// ============================================================================

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class AvantisRealmsForgeApp extends HandlebarsApplicationMixin(ApplicationV2) {

    // NOUVELLE SYNTAXE V2 POUR LES OPTIONS
    static DEFAULT_OPTIONS = {
        id: "realmsforge-hud",
        window: {
            title: "RealmsForge - Équilibre des Pouvoirs",
            resizable: true
        },
        position: {
            width: 550,
            height: 600
        }
    };

    // NOUVELLE SYNTAXE V2 POUR LES TEMPLATES
    static PARTS = {
        main: {
            template: "modules/ultimateforge-realmsforge/templates/realmsforge-hud.hbs"
        }
    };

    // NOUVELLE SYNTAXE V2 POUR ENVOYER LES DONNÉES AU HTML (Remplace getData)
    async _prepareContext(options) {
        const rawFactions = game.settings.get("ultimateforge-realmsforge", "factionsData") || {};
        
        // Chargement des données fondamentales du système
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
            this.regionsStructure = regionsStructure; // On le garde en mémoire pour le Codex
        } catch(e) { console.warn("RealmsForge | Erreur de chargement JSON"); }

        // Extraction des Auras
        const vibeSet = new Set();
        for (const category of Object.values(temperaments)) {
            if (Array.isArray(category)) {
                category.forEach(item => { if (item.output_tags) item.output_tags.forEach(t => vibeSet.add(t)); });
            }
        }
        const formatLabel = (tag) => tag.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        const availableVibes = Array.from(vibeSet).sort().map(t => ({ value: t, label: formatLabel(t) }));

        const factionsArray = Object.values(rawFactions).map(f => {
            const fVibes = f.vibes ? f.vibes.split(',').map(v => v.trim()) : [];
            return {
                ...f,
                vibeList: availableVibes.map(av => ({ ...av, selected: fVibes.includes(av.value) }))
            };
        });

        // Préparation du Codex : On liste TOUTES les régions de regions-structure.json
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

    // NOUVELLE SYNTAXE V2 POUR LES BOUTONS (Remplace activateListeners)
    _onRender(context, options) {
        super._onRender(context, options);
        
        // On récupère l'élément HTML généré en V2 et on le convertit en jQuery pour garder ta logique !
        const html = $(this.element);

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
                hexId: ""
            };
            const allFactions = game.settings.get("ultimateforge-realmsforge", "factionsData");
            allFactions[newId] = newFaction;
            await game.settings.set("ultimateforge-realmsforge", "factionsData", allFactions);
            this.render({force: true}); // V2 : {force: true} remplace (false)
        });

        // Supprimer une faction
        html.find('.rf-delete-faction').click(async (e) => {
            e.preventDefault();
            const card = $(e.currentTarget).closest('.rf-faction-card');
            const factionId = card.data('id');
            const allFactions = game.settings.get("ultimateforge-realmsforge", "factionsData");
            delete allFactions[factionId];
            await game.settings.set("ultimateforge-realmsforge", "factionsData", allFactions);
            this.render({force: true});
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
            }
        });

        // NOUVEAU : Enregistrement des tags cochés
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

        // NOUVEAU : Le système de Ciblage sur la carte (Le Sniper !)
        html.find('.rf-target-btn').click(async (e) => {
            e.preventDefault();
            const btn = $(e.currentTarget);
            const card = btn.closest('.rf-faction-card');
            const factionId = card.data('id');
            
            ui.notifications.info("RealmsForge | 🎯 Cliquez sur une case de la carte pour définir la Capitale.");
            
            // Effet visuel pour indiquer qu'on est en mode Visée
            btn.css({'background': '#e74c3c', 'box-shadow': '0 0 10px #e74c3c'});
            $('body').css('cursor', 'crosshair');
            
            const targetHandler = async (canvasEvent) => {
                if (canvasEvent.data.originalEvent.button !== 0) return; // Uniquement clic gauche
                
                const position = canvasEvent.data.getLocalPosition(canvas.app.stage);
                let row, col;
                
                // Compatibilité parfaite V12 / V13
                if (canvas.grid.getOffset) {
                    const offset = canvas.grid.getOffset({x: position.x, y: position.y});
                    row = offset.j; col = offset.i;
                } else {
                    const gridPos = canvas.grid.grid.getGridPositionFromPixels(position.x, position.y);
                    row = gridPos[0]; col = gridPos[1];
                }
                const targetHexId = `hex_${row}_${col}`;
                
                // Sauvegarde
                const allFactions = game.settings.get("ultimateforge-realmsforge", "factionsData");
                if (allFactions[factionId]) {
                    allFactions[factionId].hexId = targetHexId;
                    await game.settings.set("ultimateforge-realmsforge", "factionsData", allFactions);
                }
                
                // Nettoyage de la visée
                $('body').css('cursor', 'default');
                canvas.stage.off('pointerdown', targetHandler);
                ui.notifications.success(`RealmsForge | Capitale verrouillée sur [${row}, ${col}].`);
                
                this.render({force: true});
            };
            
            // Léger délai pour éviter que le clic sur le bouton ne déclenche immédiatement la carte
            setTimeout(() => { canvas.stage.on('pointerdown', targetHandler); }, 150);
        });

        // Le Bouton Ultime : PROPAGER L'INFLUENCE
        html.find('.rf-propagate-btn').click(async (e) => {
            e.preventDefault();
            const card = $(e.currentTarget).closest('.rf-faction-card');
            const factionId = card.data('id');
            const allFactions = game.settings.get("ultimateforge-realmsforge", "factionsData");
            const faction = allFactions[factionId];

            if (!faction.hexId || !faction.vibes) {
                ui.notifications.warn("RealmsForge | La faction doit avoir une Capitale (ID de case) et des tags d'Aura !");
                return;
            }

            const vibeTags = faction.vibes.split(',').map(t => t.trim().toLowerCase()).filter(t => t);
            const radius = Math.max(0, parseInt(faction.level) - 1);

            await this._propagateFactionAura(faction.hexId, vibeTags, radius, faction.name);
        });

       // ====================================================================
        // GESTION DES ONGLETS
        // ====================================================================
        html.find('.rf-tab-item').click((e) => {
            html.find('.rf-tab-item').removeClass('active').css({'border-bottom': '3px solid transparent', 'color': '#555'});
            html.find('.rf-tab-content').hide();
            
            const targetTab = $(e.currentTarget).data('tab');
            $(e.currentTarget).addClass('active').css({'border-bottom': '3px solid #8e44ad', 'color': '#8e44ad'});
            html.find(`.rf-tab-content[data-tab="${targetTab}"]`).fadeIn(200);
        });

        // ====================================================================
        // GESTION DU CODEX RÉGIONAL
        // ====================================================================
        html.find('#rf-codex-select').change(async (e) => {
            const regionId = $(e.currentTarget).val();
            if (!regionId || regionId === "none") return;

            const regionData = this.regionsStructure[regionId];
            const lang = (game.i18n.language || "fr").startsWith('en') ? 'en' : 'fr';
            const regionName = regionData.name[lang] || regionData.name.fr;
            
            // Chargement de l'image personnalisée
            const savedRegionsData = game.settings.get("ultimateforge-realmsforge", "regionsData") || {};
            const regionImg = savedRegionsData[regionId] || "modules/ultimateforge-core/data/default_fantasy/assets/landscape_default.webp";
            html.find('#rf-codex-img').attr('src', regionImg);

            // GÉNÉRATION NARRATIVE INTELLIGENTE
            // GÉNÉRATION NARRATIVE INTELLIGENTE & BILINGUE
            const regionDesc = regionData.description ? (regionData.description[lang] || regionData.description.fr) : (lang === 'en' ? "No historical records available for this region." : "Aucune archive historique disponible pour cette région.");

            // 1. Météo Mathématique
            let climateText = lang === 'en' ? "The climate is temperate and changes with the seasons." : "Le climat y est tempéré et changeant au gré des saisons.";
            if (regionData.weather_rules && regionData.weather_rules.weighted) {
                const w = regionData.weather_rules.weighted;
                if (w.clear >= 50 && w.rain < 20) climateText = lang === 'en' ? "This region enjoys a particularly mild climate and radiant sunshine almost all year round." : "Cette région bénéficie d'un climat particulièrement clément et d'un ensoleillement radieux presque toute l'année.";
                else if (w.snow >= 30) climateText = lang === 'en' ? "It is a harsh and inhospitable land, swept by freezing winters and frequent blizzards." : "C'est une terre rude et inhospitalière, balayée par des hivers glaciaux et de fréquentes tempêtes de neige.";
                else if (w.rain >= 40) climateText = lang === 'en' ? "The territory is subject to very high humidity, punctuated by constant showers under an often heavy sky." : "Le territoire est soumis à une très forte humidité, rythmé par des averses constantes sous un ciel souvent lourd.";
                else if (w.fog >= 30) climateText = lang === 'en' ? "A thick and mysterious fog almost permanently clings to the region's reliefs." : "Un brouillard épais et mystérieux s'accroche presque en permanence aux reliefs de la région.";
            }

            // 2. Démographie
            let popText = lang === 'en' ? "Its population is extremely diverse." : "Sa population est particulièrement hétéroclite.";
            if (regionData.race_rules && regionData.race_rules.weighted) {
                const w = regionData.race_rules.weighted;
                const total = Object.values(w).reduce((a, b) => a + b, 0);
                const popArray = Object.entries(w).map(([race, weight]) => `<strong>${Math.round((weight/total)*100)}%</strong> ${race}`);
                popText = lang === 'en' ? `The local demographics consist of approximately ${popArray.join(', ')}.` : `La démographie locale est composée à environ ${popArray.join(', ')}.`;
            }

            // 3. Auras Dominantes
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

            // 4. Titres traduits
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
            
            // Stockage pour l'export Journal
            this.currentCodexContent = `<img src="${regionImg}" style="width:100%; border-radius: 8px; margin-bottom:15px;">` + narrativeHTML;
            this.currentCodexName = regionName;
            this.currentCodexId = regionId;
        });

        // IMAGE PICKER (Importation)
        html.find('#rf-codex-img').click(async (e) => {
            if (!this.currentCodexId) return;
            new FilePicker({
                type: "image",
                callback: async (path) => {
                    $(e.currentTarget).attr('src', path);
                    const savedRegionsData = game.settings.get("ultimateforge-realmsforge", "regionsData") || {};
                    savedRegionsData[this.currentCodexId] = path;
                    await game.settings.set("ultimateforge-realmsforge", "regionsData", savedRegionsData);
                    // Mise à jour du contenu pour le journal
                    this.currentCodexContent = `<img src="${path}" style="width:100%; border-radius: 8px; margin-bottom:15px;">` + html.find('#rf-codex-narrative').html();
                    ui.notifications.success("RealmsForge | Illustration sauvegardée !");
                }
            }).render(true);
        });

        // BOUTON : Archiver dans le journal
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

        // BOUTON : RAZ Auras (Purge douce)
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

        // BOUTON : CATACLYSME (Purge totale)
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
    // LE MOTEUR DE RADIATION ET D'ÉROSION 
    // =========================================================================
    async _propagateFactionAura(centerHexId, vibeTags, radius, factionName) {
        if (!game.modules.get("ultimateforge-hexforge")?.active) {
            ui.notifications.error("RealmsForge | HexForge n'est pas activé !");
            return;
        }

        const parts = centerHexId.split('_');
        if (parts.length !== 3) {
            ui.notifications.error("RealmsForge | Format de Capitale invalide. Utilisez 'hex_X_Y'.");
            return;
        }

        const cRow = parseInt(parts[1]);
        const cCol = parseInt(parts[2]);
        let flagUpdates = {};
        
        for (let r = cRow - radius; r <= cRow + radius; r++) {
            for (let c = cCol - radius; c <= cCol + radius; c++) {
                if (radius > 0 && Math.abs(r - cRow) === radius && Math.abs(c - cCol) === radius) continue; 
                
                const hexId = `hex_${r}_${c}`;
                const existingData = canvas.scene.getFlag("ultimateforge-hexforge", hexId) || {};
                
                let currentVibes = existingData.vibe_tags || [];
                
                // LA RÈGLE D'ÉROSION
                if (vibeTags.length > 0 && currentVibes.length > 0) {
                    let removableVibes = currentVibes.filter(t => !vibeTags.includes(t));
                    removableVibes = removableVibes.sort(() => 0.5 - Math.random());
                    const tagsToDrop = removableVibes.slice(0, 2); 
                    currentVibes = currentVibes.filter(t => !tagsToDrop.includes(t));
                }
                
                const newVibes = [...new Set([...currentVibes, ...vibeTags])];
                
                if (currentVibes.length !== newVibes.length) {
                    flagUpdates[`flags.ultimateforge-hexforge.${hexId}`] = {
                        ...existingData, 
                        vibe_tags: newVibes
                    };
                }
            }
        }
        
        if (Object.keys(flagUpdates).length > 0) {
            await canvas.scene.update(flagUpdates);
            ui.notifications.success(`RealmsForge | ${factionName} a étendu son influence sur les terres environnantes !`);
        } else {
            ui.notifications.info(`RealmsForge | Le territoire est déjà totalement sous l'influence de cette faction.`);
        }
    }
}

// L'initialisation globale pour que le HUD y ait accès
Hooks.once("init", () => {
    game.settings.register("ultimateforge-realmsforge", "factionsData", {
        name: "Base de données des Factions",
        scope: "world",
        config: false,
        type: Object,
        default: {} 
    });

    // NOUVEAU : Sauvegarde des illustrations et données régionales
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

