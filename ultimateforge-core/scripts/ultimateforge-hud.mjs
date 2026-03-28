console.log("UltimateForge | Chargement du HUD...");

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class UltimateForgeHUD extends HandlebarsApplicationMixin(ApplicationV2) {
    
    // NOUVELLE SYNTAXE V2 POUR LES OPTIONS
    static DEFAULT_OPTIONS = {
        id: "ultimateforge-hud",
        window: {
            title: "UltimateForge | Tableau de Bord",
            resizable: false,
            minimizable: true
        },
        position: {
            width: 320,
            height: "auto"
        }
    };

    // NOUVELLE SYNTAXE V2 POUR LE TEMPLATE
    static PARTS = {
        main: {
            template: "modules/ultimateforge-core/templates/ultimateforge-hud.html"
        }
    };

    // NOUVELLE SYNTAXE V2 POUR LES BOUTONS
    _onRender(context, options) {
        super._onRender(context, options);
        
        const html = $(this.element);

        // CORRECTION V13 : Adoucir les titres
        html.find('h1, h2, h3, h4').css({
            'font-weight': '500', 
            'text-shadow': 'none', 
            'letter-spacing': '0.5px'
        });

        // 1. GESTION DU TEMPS
        html.find('.uf-time-btn').click(async (e) => {
            const timeOfDay = e.currentTarget.dataset.time;
            let darknessLevel = 0;
            switch (timeOfDay) {
                case 'aube': darknessLevel = 0.5; break;
                case 'matin': darknessLevel = 0.2; break;
                case 'midi': darknessLevel = 0.0; break;
                case 'apresmidi': darknessLevel = 0.1; break;
                case 'crepuscule': darknessLevel = 0.6; break;
                case 'nuit': darknessLevel = 0.9; break;
            }
            await canvas.scene.update({ darkness: darknessLevel }, { animateDarkness: 3000 });
        });

        // 2. GESTION DE LA MÉTÉO 
        html.find('#uf-weather-force').click(async () => {
            const weatherValue = html.find('#uf-weather-select').val();
            let effectId = "";
            if (weatherValue === "rain") effectId = "rain";
            if (weatherValue === "snow") effectId = "snow";
            if (weatherValue === "fog") effectId = "fog";
            
            await canvas.scene.update({ weather: effectId });
            ui.notifications.success(`Météo mise à jour !`);
        });

        // ====================================================================
        // CORRECTION V13 FINALE : GRILLE ET DÉBORDEMENT DU CADRE GRIS
        // ====================================================================
        const forgesContainer = html.find('#uf-btn-hexforge').parent();
        forgesContainer.css({
            'display': 'grid',
            'grid-template-columns': 'repeat(3, 1fr)',
            'row-gap': '25px',
            'column-gap': '10px',
            'align-items': 'start',
            'padding-bottom': '30px',  // <-- On pousse le fond gris plus bas
            'margin-bottom': '5px',    // <-- On aère un peu en dessous
            'height': 'auto',          // <-- On force le recalcul de la hauteur V13
            'min-height': 'min-content'
        });

        // 3. GESTION DES 6 FORGES (Centralisée)
        const forges = [
            { 
                id: '#uf-btn-hexforge', module: 'ultimateforge-hexforge', isToggle: true,
                getState: () => game.ultimateforge?.isHexForgeActive?.(),
                action: () => {
                    const state = game.ultimateforge.toggleHexForge();
                    ui.notifications.info(`HexForge : Édition ${state ? 'ACTIVÉE' : 'DÉSACTIVÉE'}.`);
                    return state;
                }
            },
            { 
                id: '#uf-btn-cityforge', module: 'ultimateforge-cityforge', isToggle: false,
                action: () => {
                    if (globalThis.AvantisCityForgeApp) new globalThis.AvantisCityForgeApp().render({force: true});
                    else ui.notifications.warn("L'interface CityForge est introuvable.");
                }
            },
            { 
                id: '#uf-btn-journeyforge', module: 'ultimateforge-journeyforge', isToggle: true,
                getState: () => game.ultimateforge?.explorationActive,
                action: () => {
                    game.ultimateforge = game.ultimateforge || {};
                    game.ultimateforge.explorationActive = !game.ultimateforge.explorationActive;
                    ui.notifications.info(`JourneyForge : Exploration ${game.ultimateforge.explorationActive ? 'ACTIVÉE' : 'DÉSACTIVÉE'}.`);
                    return game.ultimateforge.explorationActive;
                }
            },
            { 
                id: '#uf-btn-realmsforge', module: 'ultimateforge-realmsforge', isToggle: false, 
                action: () => {
                    if (globalThis.AvantisRealmsForgeApp) new globalThis.AvantisRealmsForgeApp().render({force: true});
                    else ui.notifications.warn("L'interface RealmsForge n'est pas accessible.");
                } 
            },
            { id: '#uf-btn-donjonforge', module: 'ultimateforge-donjonforge', isToggle: false, action: () => ui.notifications.info("DonjonForge arrive bientôt !") },
            { id: '#uf-btn-guildforge', module: 'ultimateforge-guildforge', isToggle: false, action: () => ui.notifications.info("GuildForge arrive bientôt !") }
        ];

        forges.forEach(forge => {
            const btn = html.find(forge.id);
            const img = btn.find('img');
            const isActiveModule = game.modules.get(forge.module)?.active;

            btn.css({ 
                'padding': '0', 
                'margin': '0',
                'background': 'transparent', 
                'border': 'none', 
                'outline': 'none', 
                'box-shadow': 'none',
                'line-height': '0', 
                'display': 'block'
            });
            
            img.css({ 
                'width': '100%', 
                'height': 'auto', 
                'border-radius': '6px', 
                'display': 'block', 
                'transition': 'all 0.3s ease',
                'vertical-align': 'middle' // Élimine l'espace invisible sous les images
            });

            if (!isActiveModule) {
                // Si non installé : grisé, inactif
                img.css({ 'filter': 'grayscale(100%) opacity(40%)' });
                btn.css({ 'cursor': 'not-allowed' });
                btn.click((e) => { e.preventDefault(); ui.notifications.warn(`Le module ${forge.module} n'est pas installé ou activé.`); });
            } else {
                // Si installé
                btn.css({ 'cursor': 'pointer' });
                
                // Effet de survol doux
                btn.hover(
                    () => { 
                        if (!forge.isToggle || !forge.getState()) img.css({ 'transform': 'scale(1.05)', 'filter': 'drop-shadow(0 4px 6px rgba(0,0,0,0.3))' }); 
                    },
                    () => { 
                        if (!forge.isToggle || !forge.getState()) img.css({ 'transform': 'scale(1)', 'filter': 'none' }); 
                    }
                );

                if (forge.isToggle) {
                    // Création de l'effet "Allumé"
                    const applyActiveStyle = (el) => el.css({
                        'transform': 'scale(1.05)', 
                        'filter': 'drop-shadow(0px 0px 10px rgba(243, 156, 18, 0.8))'
                    });
                    const applyInactiveStyle = (el) => el.css({
                        'transform': 'scale(1)', 
                        'filter': 'none'
                    });

                    // Vérification de l'état initial
                    if (forge.getState && forge.getState()) applyActiveStyle(img);
                    
                    // Action au clic
                    btn.click((e) => {
                        e.preventDefault();
                        const state = forge.action();
                        if (state) applyActiveStyle(img);
                        else applyInactiveStyle(img);
                    });
                } else {
                    // Si c'est un bouton simple (CityForge)
                    btn.click((e) => {
                        e.preventDefault();
                        forge.action();
                    });
                }
            }
        });
    }
}

Hooks.on('getSceneControlButtons', (controls) => {
    if (!game.user.isGM) return;
    let tokenControls = Array.isArray(controls) ? controls.find(c => c.name === "token") : (controls.token || controls.tokens);

    if (tokenControls && tokenControls.tools) {
        const hudBtn = {
            name: "ultimateforge-hud",
            title: "Ouvrir le HUD UltimateForge",
            icon: "fas fa-globe",
            button: true,
            visible: true,
            onChange: () => new UltimateForgeHUD().render({force: true}) 
        };

        if (Array.isArray(tokenControls.tools) && !tokenControls.tools.find(t => t.name === "ultimateforge-hud")) {
            tokenControls.tools.push(hudBtn);
        } else if (tokenControls.tools instanceof Map && !tokenControls.tools.has("ultimateforge-hud")) {
            tokenControls.tools.set("ultimateforge-hud", hudBtn);
        } else if (typeof tokenControls.tools === "object" && !tokenControls.tools["ultimateforge-hud"]) {
            tokenControls.tools["ultimateforge-hud"] = hudBtn;
        }
    }
});