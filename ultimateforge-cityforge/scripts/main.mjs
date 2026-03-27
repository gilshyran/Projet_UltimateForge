import { AvantisCityForgeApp } from "./apps/cityforge-app.mjs";

Hooks.once('init', () => {
    console.log("ULTIMATEFORGE | Moteur CityForge initialisé.");
});

Hooks.on("renderJournalDirectory", (app, html, data) => {
    // 1. Sécurité MJ
    if (!game.user.isGM) return;

    const $html = html instanceof jQuery ? html : $(html);

    // CORRECTION ICI : On vérifie si la bannière existe déjà. Si oui, on s'arrête net !
    if ($html.find('.cityforge-banner-btn').length > 0) return;

    // 2. Création de la bannière avec fond transparent bleuté et image PNG
    const bannerBtn = $(`
        <div class="cityforge-banner-btn" style="margin: 5px 8px 10px 8px; cursor: pointer; border-radius: 5px; border: 1px solid rgba(41, 128, 185, 0.5); box-shadow: 0 0 8px rgba(41, 128, 185, 0.3); position: relative; overflow: hidden; background: rgba(41, 128, 185, 0.15); min-height: 80px;">
            
            <img src="modules/ultimateforge-cityforge/Avantis-CityForge.png" style="width: 50%; display: block; transition: transform 0.3s ease; opacity: 0.9;" alt="Avantis CityForge" onerror="this.style.display='none';">
            
            <div style="position: absolute; bottom: 0; left: 0; right: 0; background: linear-gradient(to top, rgba(20, 45, 75, 0.85), transparent); color: #e0e6ed; text-align: right; padding: 20px 15px 8px 5px; font-family: var(--font-header); font-size: 1.2em; font-weight: bold; text-shadow: 1px 1px 3px black, 0 0 8px rgba(41, 128, 185, 0.8);">
                <i class="fas fa-hammer" style="color: #e67e22;"></i> Avantis - CityForge
            </div>
            
        </div>
    `);

    // Effet visuel au survol
    bannerBtn.on("mouseenter", function() { $(this).find('img').css({ 'transform': 'scale(1.08)', 'opacity': '1' }); });
    bannerBtn.on("mouseleave", function() { $(this).find('img').css({ 'transform': 'scale(1)', 'opacity': '0.9' }); });

    // Clic pour ouvrir la fenêtre
    bannerBtn.on("click", () => {
        new AvantisCityForgeApp().render(true);
    });

    // 3. INJECTION COMPATIBLE V13
    const header = $html.find('.directory-header');
    
    if (header.length > 0) {
        header.after(bannerBtn);
    } else {
        $html.prepend(bannerBtn);
    }
});

// Exposer l'application pour que le HUD puisse l'appeler
globalThis.AvantisCityForgeApp = AvantisCityForgeApp;