console.log("UltimateForge | Chargement du HUD...");

export class UltimateForgeHUD extends Application {
    
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: "ultimateforge-hud",
            title: "UltimateForge | Tableau de Bord",
            template: "modules/ultimateforge-core/templates/ultimateforge-hud.html",
            width: 320,
            height: "auto",
            popOut: true,
            minimizable: true,
            resizable: false
        });
    }

    activateListeners(html) {
        super.activateListeners(html);

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
                    if (globalThis.AvantisCityForgeApp) new globalThis.AvantisCityForgeApp().render(true);
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
            { id: '#uf-btn-realmsforge', module: 'ultimateforge-realmsforge', isToggle: false, action: () => ui.notifications.info("RealmsForge arrive bientôt !") },
            { id: '#uf-btn-donjonforge', module: 'ultimateforge-donjonforge', isToggle: false, action: () => ui.notifications.info("DonjonForge arrive bientôt !") },
            { id: '#uf-btn-guildforge', module: 'ultimateforge-guildforge', isToggle: false, action: () => ui.notifications.info("GuildForge arrive bientôt !") }
        ];

        forges.forEach(forge => {
            const btn = html.find(forge.id);
            const img = btn.find('img');
            const isActiveModule = game.modules.get(forge.module)?.active;

            // Style par défaut
            btn.css({ 'padding': '2px', 'background': 'transparent', 'border': '1px solid transparent' });
            img.css({ 'width': '100%', 'border-radius': '4px', 'display': 'block', 'transition': '0.2s' });

            if (!isActiveModule) {
                // Si non installé : grisé, inactif
                img.css({ 'filter': 'grayscale(100%) opacity(40%)' });
                btn.css({ 'cursor': 'not-allowed' });
                btn.click(() => ui.notifications.warn(`Le module ${forge.module} n'est pas installé ou activé.`));
            } else {
                // Si installé
                btn.css({ 'cursor': 'pointer' });
                
                // Effet de survol basique
                btn.hover(
                    () => { if (!forge.isToggle || !forge.getState()) img.css('transform', 'scale(1.05)'); },
                    () => { img.css('transform', 'scale(1)'); }
                );

                if (forge.isToggle) {
                    // Si c'est un toggle (HexForge / JourneyForge), on vérifie l'état initial
                    if (forge.getState && forge.getState()) {
                        btn.css({'box-shadow': '0 0 12px #d4af37', 'border': '1px solid #d4af37', 'border-radius': '6px'});
                    }
                    // Action au clic
                    btn.click(() => {
                        const state = forge.action();
                        if (state) btn.css({'box-shadow': '0 0 12px #d4af37', 'border': '1px solid #d4af37', 'border-radius': '6px'});
                        else btn.css({'box-shadow': 'none', 'border': '1px solid transparent'});
                    });
                } else {
                    // Si c'est un bouton simple (CityForge)
                    btn.click(() => forge.action());
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
            onClick: () => new UltimateForgeHUD().render(true)
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