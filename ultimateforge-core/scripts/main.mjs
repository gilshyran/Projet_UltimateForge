import { UltimateForgeHUD } from "./ultimateforge-hud.mjs";

Hooks.once('init', () => {
    console.log("ULTIMATEFORGE CORE | Initialisation du noyau central.");

    // 1. Préparer la liste des thèmes avec le thème par défaut obligatoire
    const themeChoices = {
        "modules/ultimateforge-core/data/default_fantasy": "Thème Générique (Par Défaut)"
    };

    // 2. Scanner tous les modules de Foundry activés pour trouver les thèmes
    for (const module of game.modules.values()) {
        if (module.active && module.flags?.ultimateforge?.isTheme) {
            const themeName = module.title;
            // On construit le chemin du dossier de données grâce aux infos du module
            const themePath = `modules/${module.id}/data/${module.flags.ultimateforge.themeFolder}`;
            themeChoices[themePath] = themeName;
            console.log(`ULTIMATEFORGE CORE | Thème détecté : ${themeName}`);
        }
    }

    // 3. Créer le paramètre global (Menu déroulant dynamique !)
    game.settings.register("ultimateforge-core", "activeThemePath", {
        name: "Thème de l'Univers",
        hint: "Choisissez l'univers de données que les générateurs (CityForge, HexForge) utiliseront.",
        scope: "world",
        config: true,
        type: String,
        choices: themeChoices,
        default: "modules/ultimateforge-core/data/default_fantasy",
        onChange: value => {
            console.log(`ULTIMATEFORGE CORE | Nouveau thème chargé : ${value}`);
            ui.notifications.info(`UltimateForge : Thème modifié. Rechargez le monde (F5) si une fenêtre de Forge est déjà ouverte.`);
        }
    });
});