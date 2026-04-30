// ============================================================================
// ULTIMATEFORGE - CORE SCRIPT (Chef d'orchestre)
// ============================================================================

// 1. Importation de tous les modules avec leurs VRAIS noms de classes
import { AvantisCityForgeApp } from "./cityforge-app.mjs";
import { HexForgeHUD } from "./hexforge-app.mjs"; // <-- CORRIGÉ ICI !
import { AvantisRealmsForgeApp } from "./realmsforge-app.mjs";
import { JourneyForgeRadar } from "./journeyforge-app.mjs"; 
import { UltimateForgeHUD } from "./ultimateforge-hud.mjs"; 

Hooks.once('init', () => {
    console.log("ULTIMATEFORGE | Initialisation de la suite complète Master...");

    // 2. Préparer la liste des thèmes avec le thème par défaut obligatoire
    const themeChoices = {
        "modules/ultimateforge/data/default_fantasy": game.i18n.localize("ULTIMATEFORGE.Settings.DefaultTheme") || "Fantasy Standard"
    };

    // 3. Scanner tous les modules de Foundry activés pour trouver les thèmes
    for (const module of game.modules.values()) {
        if (module.active && module.flags?.ultimateforge?.isTheme) {
            const themeName = module.title;
            const themePath = `modules/${module.id}/data/${module.flags.ultimateforge.themeFolder}`;
            themeChoices[themePath] = themeName;
            console.log(`ULTIMATEFORGE | Thème détecté : ${themeName}`);
        }
    }

    // 4. Enregistrement du Paramètre Global : Le Thème Actif
    game.settings.register("ultimateforge", "activeThemePath", {
        name: game.i18n.localize("ULTIMATEFORGE.Settings.ThemeName") || "Thème Actif",
        hint: game.i18n.localize("ULTIMATEFORGE.Settings.ThemeHint") || "Choisissez le thème de génération.",
        scope: "world",
        config: true,
        type: String,
        choices: themeChoices,
        default: "modules/ultimateforge/data/default_fantasy",
        onChange: value => {
            console.log(`ULTIMATEFORGE | Nouveau thème chargé : ${value}`);
            ui.notifications.info(game.i18n.localize("ULTIMATEFORGE.Settings.ThemeChangedInfo") || "Thème mis à jour !");
        }
    });

    // 5. Enregistrement des Paramètres RealmsForge
    game.settings.register("ultimateforge", "factionsData", {
        name: "Données des Factions",
        scope: "world",
        config: false,
        type: Object,
        default: {} 
    });

    game.settings.register("ultimateforge", "regionsData", {
        name: "Données du Codex Régional",
        scope: "world",
        config: false,
        type: Object,
        default: {} 
    });

    // 6. Exposer les applications globalement
    globalThis.AvantisCityForgeApp = AvantisCityForgeApp;
    globalThis.HexForgeHUD = HexForgeHUD; // <-- CORRIGÉ ICI !
    globalThis.AvantisRealmsForgeApp = AvantisRealmsForgeApp;
    globalThis.JourneyForgeRadar = JourneyForgeRadar;
    globalThis.UltimateForgeHUD = UltimateForgeHUD;

    // 7. Initialiser le Radar
    if (JourneyForgeRadar.init) JourneyForgeRadar.init();
});

// 8. Injection du bouton CityForge dans l'onglet des Journaux
Hooks.on("renderJournalDirectory", (app, html, data) => {
    if (!game.user.isGM) return;

    const $html = html instanceof jQuery ? html : $(html);
    if ($html.find('.cityforge-banner-btn').length > 0) return;

    const bannerBtn = $(`
        <div class="cityforge-banner-btn" style="margin: 5px 8px 10px 8px; cursor: pointer; border-radius: 5px; border: 1px solid rgba(41, 128, 185, 0.5); box-shadow: 0 0 8px rgba(41, 128, 185, 0.3); position: relative; overflow: hidden; background: rgba(41, 128, 185, 0.15); min-height: 80px;">
            <img src="modules/ultimateforge/ui/Avantis-CityForge.webp" style="width: 50%; display: block; transition: transform 0.3s ease; opacity: 0.9;" alt="Avantis CityForge" onerror="this.style.display='none';">
            <div style="position: absolute; bottom: 0; left: 0; right: 0; background: linear-gradient(to top, rgba(20, 45, 75, 0.85), transparent); color: #e0e6ed; text-align: right; padding: 20px 15px 8px 5px; font-family: var(--font-header); font-size: 1.2em; font-weight: bold; text-shadow: 1px 1px 3px black, 0 0 8px rgba(41, 128, 185, 0.8);">
                <i class="fas fa-hammer" style="color: #e67e22;"></i> ${game.i18n.localize("CITYFORGE.BannerTitle") || "CityForge"}
            </div>
        </div>
    `);

    bannerBtn.on("mouseenter", function() { $(this).find('img').css({ 'transform': 'scale(1.08)', 'opacity': '1' }); });
    bannerBtn.on("mouseleave", function() { $(this).find('img').css({ 'transform': 'scale(1)', 'opacity': '0.9' }); });

    bannerBtn.on("click", () => {
        new AvantisCityForgeApp().render(true);
    });

    const header = $html.find('.directory-header');
    if (header.length > 0) header.after(bannerBtn);
    else $html.prepend(bannerBtn);
});