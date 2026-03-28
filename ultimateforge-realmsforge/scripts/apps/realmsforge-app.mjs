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
        const rawFactions = game.settings.get("ultimateforge-realmsforge", "factionsData");
        const factionsArray = Object.values(rawFactions);
        
        // On scanne la carte pour lister les régions présentes
        const allHexes = canvas.scene?.flags?.["ultimateforge-hexforge"] || {};
        const regionsSet = new Set();
        for (const hex of Object.values(allHexes)) {
            if (hex.region) regionsSet.add(hex.region);
        }

        return {
            factions: factionsArray,
            regions: Array.from(regionsSet).sort() // On envoie les régions au HTML
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
        // ZONE DE DANGER : PURGE RÉGIONALE
        // ====================================================================
        // ====================================================================
        // ZONE DE DANGER : PURGE RÉGIONALE ET GÉNÉRATION DE RUINES
        // ====================================================================
        html.find('#rf-purge-btn').click(async (e) => {
            e.preventDefault();
            const selectedRegion = html.find('#rf-purge-region').val();
            
            if (!selectedRegion || selectedRegion === "none") {
                ui.notifications.warn("RealmsForge | Sélectionnez d'abord une région à raser.");
                return;
            }

            const confirm = await Dialog.confirm({
                title: "Cataclysme Régional",
                content: `<h3 style="color:red;">Attention !</h3><p>Vous êtes sur le point d'effacer <strong>TOUTES les colonies et lieux isolés</strong> de la région <strong>${selectedRegion}</strong> sur la carte actuelle.</p><p>Ils seront remplacés par des ruines. Êtes-vous absolument sûr ?</p>`,
                yes: () => true,
                no: () => false,
                defaultYes: false
            });

            if (confirm) {
                const allHexes = canvas.scene?.flags?.["ultimateforge-hexforge"] || {};
                let flagUpdates = {};
                let tileUpdates = [];
                let destroyedCount = 0;
                
                // Déduction du chemin de l'image des ruines selon le thème actif
                let basePath = "modules/ultimateforge-core/data/default_fantasy";
                if (game.settings.settings.has("ultimateforge-core.activeThemePath")) {
                    basePath = game.settings.get("ultimateforge-core", "activeThemePath");
                    if (basePath.endsWith("/")) basePath = basePath.slice(0, -1);
                }
                const ruinsPath = `${basePath}/assets/ruins_city.png`;

                // On scanne la carte entière
                for (const [hexId, hexData] of Object.entries(allHexes)) {
                    if (hexData.region === selectedRegion && hexData.cityJournalId) {
                        
                        // 1. ADN de la case
                        flagUpdates[`flags.ultimateforge-hexforge.${hexId}.-=cityJournalId`] = null;
                        flagUpdates[`flags.ultimateforge-hexforge.${hexId}.-=trait`] = null;
                        flagUpdates[`flags.ultimateforge-hexforge.${hexId}.overlay`] = "ruines_cite";
                        
                        // 2. Visuel de la case
                        const tile = canvas.scene.tiles.find(t => t.flags["ultimateforge-hexforge"]?.hexId === hexId);
                        if (tile) {
                            tileUpdates.push({ _id: tile.id, "texture.src": ruinsPath });
                        }
                        
                        destroyedCount++;
                    }
                }

                // Application massive
                if (destroyedCount > 0) {
                    await canvas.scene.update(flagUpdates);
                    if (tileUpdates.length > 0) {
                        await canvas.scene.updateEmbeddedDocuments("Tile", tileUpdates);
                    }
                    ui.notifications.success(`RealmsForge | Cataclysme terminé. ${destroyedCount} lieux ont été réduits en ruines dans la région ${selectedRegion}.`);
                } else {
                    ui.notifications.info(`RealmsForge | Aucune colonie trouvée dans cette région.`);
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
    
    // On rend l'application accessible depuis l'extérieur (le HUD)
    globalThis.AvantisRealmsForgeApp = AvantisRealmsForgeApp;
    
    console.log("RealmsForge | Initialisation V2 terminée.");
});

