console.log("UltimateForge | Chargement du HUD...");

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class UltimateForgeHUD extends HandlebarsApplicationMixin(ApplicationV2) {
    
    static DEFAULT_OPTIONS = {
        id: "ultimateforge-hud",
        window: {
            title: "ULTIMATEFORGE.HUD.WindowTitle", 
            resizable: false, // On interdit le redimensionnement manuel
            minimizable: true
        },
        position: {
            width: 320,
            height: "auto"
        },
        // Classe maître pour l'isolation CSS
        classes: ["ultimateforge-hud-window"]
    };

    // UNE SEULE DÉCLARATION DE 'PARTS'
    static PARTS = {
        main: {
            template: "modules/ultimateforge/templates/ultimateforge-hud.html"
        }
    };

    // UNE SEULE FONCTION '_onRender'
    _onRender(context, options) {
        super._onRender(context, options);
        
        const html = $(this.element);

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
            await canvas.scene.update({ "environment.darknessLevel": darknessLevel }, { animateDarkness: 3000 });
        });

        // 2. GESTION DE LA MÉTÉO 
        const applyWeather = async (e) => {
            if (e) e.preventDefault();
            const weatherValue = html.find('#uf-weather-select').val();
            const weatherMapping = {
                "rain": "rain", "snow": "snow", "fog": "fog", "leaves": "autumnLeaves", "clear": "" 
            };
            const effectId = weatherMapping[weatherValue] ?? "";
            
            try {
                await canvas.scene.update({ weather: effectId });
                const successMsg = game.i18n.localize("ULTIMATEFORGE.HUD.Weather.Updated");
                ui.notifications.success(successMsg !== "ULTIMATEFORGE.HUD.Weather.Updated" ? successMsg : "Météo modifiée");
            } catch (err) {
                ui.notifications.error("Impossible de modifier le climat.");
            }
        };

        html.find('#uf-weather-force').click(applyWeather);
        html.find('#uf-weather-select').change(applyWeather);

        // 3. GESTION DES 6 FORGES (Logique pure)
        const forges = [
            { 
                id: '#uf-btn-hexforge', module: 'ultimateforge', isToggle: true,
                getState: () => game.ultimateforge?.isHexForgeActive?.(),
                action: () => {
                    const state = game.ultimateforge.toggleHexForge();
                    ui.notifications.info(state ? game.i18n.localize("ULTIMATEFORGE.HUD.Notifications.HexForgeActive") : game.i18n.localize("ULTIMATEFORGE.HUD.Notifications.HexForgeInactive"));
                    return state;
                }
            },
            { 
                id: '#uf-btn-cityforge', module: 'ultimateforge', isToggle: false,
                action: () => {
                    if (globalThis.AvantisCityForgeApp) new globalThis.AvantisCityForgeApp().render({force: true});
                    else ui.notifications.warn(game.i18n.localize("ULTIMATEFORGE.HUD.Notifications.CityForgeMissing"));
                }
            },
            { 
                id: '#uf-btn-journeyforge', module: 'ultimateforge', isToggle: true,
                getState: () => game.ultimateforge?.explorationActive,
                action: () => {
                    game.ultimateforge = game.ultimateforge || {};
                    game.ultimateforge.explorationActive = !game.ultimateforge.explorationActive;
                    ui.notifications.info(game.ultimateforge.explorationActive ? game.i18n.localize("ULTIMATEFORGE.HUD.Notifications.JourneyForgeActive") : game.i18n.localize("ULTIMATEFORGE.HUD.Notifications.JourneyForgeInactive"));
                    return game.ultimateforge.explorationActive;
                }
            },
            { 
                id: '#uf-btn-realmsforge', module: 'ultimateforge', isToggle: false, 
                action: () => {
                    if (globalThis.AvantisRealmsForgeApp) new globalThis.AvantisRealmsForgeApp().render({force: true});
                    else ui.notifications.warn(game.i18n.localize("ULTIMATEFORGE.HUD.Notifications.RealmsForgeMissing"));
                } 
            },
            { 
                id: '#uf-btn-donjonforge', module: 'ultimateforge-donjonforge', isToggle: false, 
                action: () => ui.notifications.info(game.i18n.localize("ULTIMATEFORGE.HUD.Notifications.ComingSoonDungeon")) 
            },
            { 
                id: '#uf-btn-guildforge', module: 'ultimateforge-guildforge', isToggle: false, 
                action: () => ui.notifications.info(game.i18n.localize("ULTIMATEFORGE.HUD.Notifications.ComingSoonGuild")) 
            }
        ];

        forges.forEach(forge => {
            const btn = html.find(forge.id);
            const isActiveModule = game.modules.get(forge.module)?.active;

            if (!isActiveModule) {
                // On délègue l'esthétique grisée au CSS
                btn.addClass('uf-disabled');
                btn.click((e) => { 
                    e.preventDefault(); 
                    ui.notifications.warn(game.i18n.format("ULTIMATEFORGE.HUD.Notifications.ModuleMissing", { module: forge.module })); 
                });
            } else {
                if (forge.isToggle) {
                    // Vérification de l'état initial
                    if (forge.getState && forge.getState()) btn.addClass('uf-active');
                    
                    btn.click((e) => {
                        e.preventDefault();
                        const state = forge.action();
                        // On bascule la classe CSS
                        if (state) btn.addClass('uf-active');
                        else btn.removeClass('uf-active');
                    });
                } else {
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
            // Appel dynamique de la localisation
            title: game.i18n.localize("ULTIMATEFORGE.Controls.OpenHUD"),
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