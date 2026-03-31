import { InternalTavernGenerator } from "./internal-tavern.mjs";
import { InternalNpcGenerator } from "./internal-npc.mjs";
import { InternalShopGenerator } from "./internal-shop.mjs";
import { InternalBountyGenerator } from "./internal-bounty.mjs";
import { InternalGovernanceGenerator } from "./internal-governance.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class AvantisCityForgeApp extends HandlebarsApplicationMixin(ApplicationV2) {

    constructor(options = {}, targetedHexId = null) {
        super(options);
        this.targetedHexId = targetedHexId || options.targetedHexId || null; 
        this.loadedCityData = options.loadedCityData || null; 
        this.regionData = {}; 
        this.originsData = [];
        this.vitalityData = [];
        this.temperamentData = {};
        this.governanceData = [];
        this.economyData = [];
        this.districtsData = []; 
        this.poiSeedsData = [];
        this.namesData = {}; 
        this.shopsData = {};
        this.rumorsData = [];
        this.npcsData = {};
        this.tavernsData = {};
        this.bountiesData = {};
        this.statesData = {};
        this.historyData = {};
        this.govBuildingsData = {};
        this.currentCityJournalData = null;
    }

    static DEFAULT_OPTIONS = {
        id: "avantis-cityforge",
        window: {
            title: "Avantis CityForge",
            resizable: true
        },
        position: { width: 800, height: 680 },
        classes: ["avantis-window", "avantis-cityforge-app"]
    };

    static PARTS = {
        main: { template: "modules/ultimateforge-cityforge/templates/cityforge-app.html" }
    };

    async _prepareContext(options) {
        if (Object.keys(this.regionData).length === 0) {
            try {
                let basePath = game.settings.get("ultimateforge-core", "activeThemePath");
                if (basePath.endsWith("/")) basePath = basePath.slice(0, -1);

                const themeRes = await fetch(`${basePath}/theme.json`).catch(() => null);
                this.themeSettings = themeRes ? await themeRes.json() : null;

                const [regRes, origRes, vitRes, tempRes, govRes, ecoRes, distRes, poiRes, namesRes, shopsRes, rumRes, npcsRes, tavRes, bountiesRes, statesRes, histRes, govBuildRes] = await Promise.all([
                    fetch(`${basePath}/regions-structure.json`), fetch(`${basePath}/origins.json`), fetch(`${basePath}/vitality.json`), fetch(`${basePath}/temperament.json`),
                    fetch(`${basePath}/governance.json`), fetch(`${basePath}/economy.json`), fetch(`${basePath}/districts.json`), fetch(`${basePath}/poi_seeds.json`),
                    fetch(`${basePath}/names.json`), fetch(`${basePath}/shops_loot.json`), fetch(`${basePath}/rumors.json`), fetch(`${basePath}/npcs.json`),
                    fetch(`${basePath}/taverns.json`), fetch(`${basePath}/bounties.json`), fetch(`${basePath}/regional_states.json`), fetch(`${basePath}/history.json`),
                    fetch(`${basePath}/gov_buildings.json`)
                ]);

                this.regionData = await regRes.json();
                this.originsData = await origRes.json();
                this.vitalityData = await vitRes.json();
                this.temperamentData = await tempRes.json();
                this.governanceData = await govRes.json();
                this.economyData = await ecoRes.json();
                this.districtsData = await distRes.json();
                this.poiSeedsData = await poiRes.json();
                this.namesData = await namesRes.json();
                this.shopsData = await shopsRes.json();
                this.rumorsData = await rumRes.json();
                this.npcsData = await npcsRes.json();
                this.tavernsData = await tavRes.json();
                this.bountiesData = await bountiesRes.json();
                this.statesData = await statesRes.json();
                this.historyData = await histRes.json();
                this.govBuildingsData = await govBuildRes.json();
            } catch (error) {
                console.error("CITYFORGE | Erreur de chargement des JSON :", error);
            }
        }
        return {};
    }

    _onRender(context, options) {
        super._onRender(context, options);
        const html = $(this.element);
        const lang = (game.i18n.language || "fr").startsWith('en') ? 'en' : 'fr';

        const windowContent = html.find('.window-content');
        windowContent.css({ 
            'overflow-y': 'auto', 
            'overflow-x': 'hidden',
            'padding': '15px',
            'box-sizing': 'border-box'
        });

        html.find('.avantis-cityforge').css({
            'height': 'auto',
            'min-height': '100%',
            'overflow': 'visible'
        });

        const regionSelect = html.find('#region-select');
        regionSelect.empty().append(`<option value="none" selected disabled>${game.i18n.localize('CITYFORGE.RegionSelect')}</option>`);
        for (const [key, data] of Object.entries(this.regionData)) {
            const name = data.name[lang] || data.name.fr;
            regionSelect.append(`<option value="${key}">${name}</option>`);
        }

        const stateSelect = html.find('#state-select');
        stateSelect.empty();
        for (const [key, data] of Object.entries(this.statesData)) {
            const name = data.name[lang] || data.name.fr;
            stateSelect.append(`<option value="${key}">${name}</option>`);
        }

        html.find('#region-select').change(event => this._updateDynamicFields(html, event.currentTarget.value));
        html.find('#generate-btn').click(async event => await this._onGenerateCity(html));

        html.on('click', '.gen-leader-btn', this._onCreateLeaderJournal.bind(this));
        html.on('click', '.gen-poi-btn', this._onCreatePOIJournal.bind(this));
        html.find('#save-city-btn').click(this._onSaveCityJournal.bind(this));
        html.find('#watabou-btn').click(this._onOpenWatabou.bind(this));

        if (this.loadedCityData) {
            setTimeout(() => {
                html.find('#region-select').val(this.loadedCityData.regionId).trigger('change');
                html.find('#biome-select').val(this.loadedCityData.biome);
                html.find('#size-select').val(this.loadedCityData.size);
                html.find('#state-select').val(this.loadedCityData.stateId);
                
                this._rebuildCity(html); 
            }, 100);
        } else if (this.targetedHexId && game.modules.get("ultimateforge-hexforge")?.active) {
            setTimeout(() => {
                const hexData = canvas.scene.getFlag("ultimateforge-hexforge", this.targetedHexId) || {};
                
                if (hexData.region) html.find('#region-select').val(hexData.region).trigger('change');
                if (hexData.biome) html.find('#biome-select').val(hexData.biome);
                if (hexData.state) html.find('#state-select').val(hexData.state);
                
                const traitId = this.options.traitId || hexData.trait;
                if (traitId) {
                    const sizeMap = { 
                        "campement": "Campement", "hameau": "Hameau", "village": "Village", 
                        "petite_ville": "Petite Ville", "grande_cite": "Grande Cité", 
                        "metropole": "Métropole", "capitale": "Capitale" 
                    };
                    const matchedSize = sizeMap[traitId.toLowerCase()] || Object.values(sizeMap).find(s => traitId.toLowerCase().includes(s.toLowerCase()));
                    if (matchedSize) html.find('#size-select').val(matchedSize);
                }
            }, 150);
        }
    }

    _rebuildCity(html) {
        const data = this.loadedCityData;
        
        if (!data.narrativeHTML) {
            ui.notifications.warn("CityForge | Veuillez cliquer sur 'Générer' puis 'Archiver' pour mettre cette ville à jour.");
            return;
        }

        html.find('#res-title').text(data.settlementName);
        const lang = game.i18n.lang.startsWith('en') ? 'en' : 'fr';
        const regionInfo = this.regionData[data.regionId];
        const regionName = regionInfo ? (regionInfo.name[lang] || regionInfo.name.fr) : data.regionId;
        html.find('#res-subtitle').text(`${data.size} en ${regionName} | Biome : ${data.biome}`);

        html.find('#res-narrative').html(data.narrativeHTML);
        html.find('#res-districts').html(data.districtsHTML);

        this.currentCityJournalData = {
            name: data.settlementName,
            content: data.narrativeHTML + data.districtsHTML,
            rawData: data
        };

        html.find('#watabou-btn').data('name', data.settlementName).data('size', data.size).data('biome', data.biome);
        html.find('#results-section').removeClass('hidden');

        let updateBtn = html.find('#update-atmosphere-btn');
        if (updateBtn.length === 0) {
            updateBtn = $(`<button id="update-atmosphere-btn" class="cf-action-btn" style="width: auto; padding: 8px 20px; font-size: 1.1em; background: linear-gradient(to bottom, #e67e22, #d35400); border-color: #e67e22; margin-left: 15px;" title="Met à jour l'atmosphère selon les modificateurs de la carte RealmsForge"><i class="fas fa-bolt"></i> Actualiser l'Atmosphère</button>`);
            html.find('#watabou-btn').after(updateBtn);
            
            updateBtn.click(async (e) => {
                e.preventDefault();
                await this._triggerAtmosphereUpdate(html);
            });
        }

        ui.notifications.success(`CityForge | La cité ${data.settlementName} a été chargée depuis la carte.`);
    }

    // =========================================================================
    // LE DÉCLENCHEUR D'ACTUALISATION AMÉLIORÉ
    // =========================================================================
    async _triggerAtmosphereUpdate(html) {
        if (!this.targetedHexId) {
            ui.notifications.error("Impossible d'actualiser : Aucune case ciblée sur la carte.");
            return;
        }
        const hexData = canvas.scene.getFlag("ultimateforge-hexforge", this.targetedHexId);
        if (!hexData || !hexData.cityJournalId) {
            ui.notifications.warn("CityForge | Cette ville n'est pas archivée. Cliquez sur 'Archiver' d'abord.");
            return;
        }
        const journal = game.journal.get(hexData.cityJournalId);
        if (!journal) return;

        ui.notifications.info(`CityForge | Les érudits recalculent l'atmosphère de la cité...`);

        const data = this.loadedCityData;
        const lang = (game.i18n.language || "fr").startsWith('en') ? 'en' : 'fr';

        const newVibeTags = (hexData.vibe_tags || []).filter(t => typeof t === 'string' && t.trim() !== "");
        const newEcoTags = (hexData.eco_tags || []).filter(t => typeof t === 'string' && t.trim() !== "");
        const newStateId = hexData.state || null;

        let newGovTags = [];
        let newGovText = lang === 'en' ? "led by a local chief." : "dirigé par un chef local.";
        let newSafeGovText = "Chef local";

        const validGov = this.governanceData.filter(gov => {
            return (gov.size_tags.includes("all") || gov.size_tags.includes(data.size)) &&
                   (gov.vibe_tags.includes("all") || gov.vibe_tags.some(tag => newVibeTags.includes(tag)));
        });

        if (validGov.length > 0) {
            let govWeightObj = {};
            validGov.forEach((gov, index) => {
                let baseWeight = 10; 
                if (gov.vibe_tags) gov.vibe_tags.forEach(tag => { if (newVibeTags.includes(tag)) baseWeight += 50; });
                if (gov.vibe_tags.includes("all")) baseWeight = 5; 
                govWeightObj[index] = baseWeight;
            });
            const selectedGovIndex = this._rollWeighted(govWeightObj);
            const selectedGov = validGov[selectedGovIndex];
            newGovText = selectedGov.description[lang] || selectedGov.description.fr;
            newSafeGovText = newGovText.replace(/['"]/g, "&apos;").trim();
            if (newSafeGovText.startsWith(",")) newSafeGovText = newSafeGovText.substring(1).trim();
            newGovTags = selectedGov.output_tags || [];
        }

        const finalTraits = [];
        Object.keys(this.temperamentData).forEach(axeName => {
            const traitsArray = this.temperamentData[axeName];
            const matching = traitsArray.filter(t => t.output_tags && t.output_tags.some(tag => newVibeTags.includes(tag)));
            if (matching.length > 0) {
                const randomTrait = matching[Math.floor(Math.random() * matching.length)];
                finalTraits.push(randomTrait.trait[lang] || randomTrait.trait.fr);
            }
        });
        let newVibeText = lang === 'en' ? "a shifting atmosphere" : "une atmosphère changeante et incertaine";
        if (finalTraits.length > 0) {
            const selected = finalTraits.sort(() => 0.5 - Math.random()).slice(0, 2);
            newVibeText = selected.join(` <span style='color:#7b1e1e; font-weight:bold;'>${lang === 'en' ? 'and' : 'et'}</span> `);
        }

        let newEcoText = data.ecoText; 
        const stateInfo = newStateId ? this.statesData[newStateId] : null;
        const validEco = this.economyData.filter(eco => eco.output_tags && eco.output_tags.some(tag => newEcoTags.includes(tag)));
        if (validEco.length > 0) {
            const selectedEco = validEco[Math.floor(Math.random() * validEco.length)];
            let barterText = (stateInfo && stateInfo.price_multiplier >= 1.5) ? (lang === 'en' ? " <br><em>Note: Barter is heavily practiced here.</em>" : " <br><em>Note : La région étant en crise, le troc est massivement pratiqué.</em>") : "";
            newEcoText = (selectedEco.description[lang] || selectedEco.description.fr) + barterText;
        }

        let newStateHtmlBlock = "";
        if (stateInfo && stateInfo.description) {
            const stateDesc = lang === 'en' ? stateInfo.description.en : stateInfo.description.fr;
            const contextTitle = lang === 'en' ? 'Current Context' : 'Contexte Régional';
            newStateHtmlBlock = `
                <div style="margin-bottom: 15px; border-left: 4px solid #c0392b; background: rgba(192, 57, 43, 0.05); padding: 10px; border-radius: 0 4px 4px 0;">
                    <h4 style="margin: 0 0 5px 0; color: #c0392b;"><i class="fas fa-exclamation-triangle"></i> ${contextTitle}</h4>
                    <p style="margin: 0; font-size: 0.95em; color: #444;">${stateDesc}</p>
                </div>`;
        }

        // --- RECALCUL DE LA POLITIQUE ---
        const influences = hexData.influence || {};
        const rawFactions = game.settings.get("ultimateforge-realmsforge", "factionsData") || {};
        let factionsPresent = [];
        let politicalText = "";
        for (const [fId, score] of Object.entries(influences)) {
            const faction = rawFactions[fId];
            if (faction) factionsPresent.push({ name: faction.name, score: score, type: faction.type });
        }
        const activeFactions = factionsPresent.filter(f => f.score >= 2);
        
        if (activeFactions.length > 0) {
            const mainFaction = activeFactions[0];
            if (activeFactions.length === 1) {
                if (mainFaction.score >= 4) politicalText = lang === 'en' ? `The settlement is firmly under the control of <strong>${mainFaction.name}</strong>.` : `La cité est fermement sous le contrôle de <strong>${mainFaction.name}</strong>.`;
                else if (mainFaction.score === 3) politicalText = lang === 'en' ? `<strong>${mainFaction.name}</strong> holds a fragile authority here.` : `<strong>${mainFaction.name}</strong> exerce une autorité fragile sur ce lieu.`;
                else politicalText = lang === 'en' ? `Agents of <strong>${mainFaction.name}</strong> actively infiltrate the city.` : `Des agents de <strong>${mainFaction.name}</strong> infiltrent activement la ville.`;
            } else {
                const secondFaction = activeFactions[1];
                if (mainFaction.score >= 4 && secondFaction.score >= 3) politicalText = lang === 'en' ? `On the brink of civil war. <strong>${mainFaction.name}</strong> rules officially, but <strong>${secondFaction.name}</strong> violently contests it.` : `Au bord de la guerre civile. <strong>${mainFaction.name}</strong> dirige officiellement, mais <strong>${secondFaction.name}</strong> conteste violemment le pouvoir.`;
                else if (mainFaction.score >= 4 && secondFaction.score === 2) politicalText = lang === 'en' ? `<strong>${mainFaction.name}</strong> rules with an iron fist against dissent sown by <strong>${secondFaction.name}</strong>.` : `<strong>${mainFaction.name}</strong> tient la ville d'une main de fer contre la dissidence de <strong>${secondFaction.name}</strong>.`;
                else politicalText = lang === 'en' ? `War of influence and conspiracies between <strong>${mainFaction.name}</strong> and <strong>${secondFaction.name}</strong>.` : `Guerre d'influence et de complots entre <strong>${mainFaction.name}</strong> et <strong>${secondFaction.name}</strong>.`;
            }
        }
        
        let updatedHTML = data.narrativeHTML;

        // Mise à jour robuste de l'encart politique avec un marqueur indestructible
        let newPoliticalHtmlBlock = politicalText ? `<div class="cf-political-box" style="background: #fdf5e6; border-left: 3px solid #e67e22; padding: 6px 10px; margin-bottom: 10px; border-radius: 0 4px 4px 0;"><p style="margin: 0; font-size: 0.9em; color: #d35400; font-style: italic;"><i class="fas fa-chess-knight"></i> ${politicalText}</p></div>\n` : '';
        
        // 1. On retire proprement l'ancien bloc (même rétrocompatible)
        updatedHTML = updatedHTML.replace(/<div class="cf-political-box".*?<\/div>\n?/s, '');
        updatedHTML = updatedHTML.replace(/<div style="background: #fdf5e6; border-left: 3px solid #e67e22;.*?<\/div>\n?/s, ''); 
        
        // 2. On injecte le nouveau juste après le titre "Gouvernance"
        const polRegex = /(<h4 style="margin: 0 0 8px 0; color: #2980b9;"><i class="fas fa-landmark"><\/i>.*?<\/h4>\s*)/s;
        updatedHTML = updatedHTML.replace(polRegex, `$1${newPoliticalHtmlBlock}`);

        const vibeRegex = /(<span style="display:inline-block; margin-top:5px;">.*?<strong>)(.*?)(<\/strong>\.<\/span>)/;
        updatedHTML = updatedHTML.replace(vibeRegex, `$1${newVibeText}$3`);

        const survieFr = "Pour prospérer, la population s'appuie sur son environnement :";
        const survieEn = "To survive, the settlement relies on:";
        const ecoRegex = new RegExp(`(${survieFr}|${survieEn})(.*?)(<\/p>)`, "s");
        updatedHTML = updatedHTML.replace(ecoRegex, `$1 ${newEcoText}\n$3`);
        
        const govRegex = /(<strong class="cf-leader-highlight">.*?data-gov=")[^"]*(".*?(?:<\/i><\/strong>|<\/strong><\/a>)\s*)(.*?)(<\/p>)/s;
        updatedHTML = updatedHTML.replace(govRegex, `$1${newSafeGovText}$2${newGovText}\n$4`);

        const stateRegex = /(<\/div>\s*)(<div style="margin-bottom: 15px; border-left: 4px solid #c0392b;.*?<\/div>\s*)?(<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">)/s;
        updatedHTML = updatedHTML.replace(stateRegex, `$1${newStateHtmlBlock}\n$3`);

        const tagsRegex = /(<strong><i class="fas fa-fingerprint"><\/i>[^<]*<\/strong>\s*)<span[^>]*>.*?<\/span>(\s*\|\s*)<span[^>]*>.*?<\/span>/;
        const newVibeTagsHTML = newVibeTags.length ? newVibeTags.join(', ') : 'Aucune';
        const newEcoTagsHTML = newEcoTags.length ? newEcoTags.join(', ') : 'Aucune';
        updatedHTML = updatedHTML.replace(tagsRegex, `$1<span style="color: #8e44ad; text-transform: capitalize;">${newVibeTagsHTML}</span>$2<span style="color: #27ae60; text-transform: capitalize;">${newEcoTagsHTML}</span>`);

        const newFactionDataStr = factionsPresent.slice(0, 2).map(f => f.name.replace(/['"|,]/g, '') + ':' + f.score).join('|');
        
        let updatedDistricts = data.districtsHTML;
        updatedDistricts = updatedDistricts.replace(/data-vibetags="[^"]*"/g, `data-vibetags="${newVibeTags.join(',')}"`);
        updatedDistricts = updatedDistricts.replace(/data-ecotags="[^"]*"/g, `data-ecotags="${newEcoTags.join(',')}"`);
        updatedDistricts = updatedDistricts.replace(/data-govtags="[^"]*"/g, `data-govtags="${newGovTags.join(',')}"`);
        updatedDistricts = updatedDistricts.replace(/data-state="[^"]*"/g, `data-state="${newStateId || ""}"`);
        
        if (!updatedDistricts.includes('data-factions=')) {
            updatedDistricts = updatedDistricts.replace(/data-vibetags="([^"]*)"/g, `data-vibetags="$1" data-factions="${newFactionDataStr}"`);
        } else {
            updatedDistricts = updatedDistricts.replace(/data-factions="[^"]*"/g, `data-factions="${newFactionDataStr}"`);
        }

        data.govTags = newGovTags;
        data.govText = newGovText;
        data.vibeTags = newVibeTags;
        data.ecoTags = newEcoTags;
        data.stateId = newStateId;
        data.narrativeHTML = updatedHTML;
        data.districtsHTML = updatedDistricts; 
        data.factionsStr = newFactionDataStr;
        
        const journalNarrativeHTML = updatedHTML.replace(/<i class="fas fa-external-link-alt gen-leader-btn"[\s\S]*?<\/i>/g, '');
        this.currentCityJournalData = {
            name: data.settlementName,
            content: journalNarrativeHTML + data.districtsHTML,
            rawData: data
        };

        await AvantisCityForgeApp.updateCityAtmosphere(journal, this.targetedHexId, this.currentCityJournalData);
        this.loadedCityData = data;
        html.find('#state-select').val(newStateId);
        this._rebuildCity(html);
    }

    _updateDynamicFields(html, regionId) {
        const data = this.regionData[regionId];
        const biomeSelect = html.find('#biome-select');
        const sizeSelect = html.find('#size-select');
        const generateBtn = html.find('#generate-btn');

        if (!data) return;

        biomeSelect.empty().append(`<option value="auto">🎲 Aléatoire (Selon la région)</option>`);
        Object.keys(data.biome_rules.weighted).forEach(b => biomeSelect.append(`<option value="${b}">${b}</option>`));
        biomeSelect.prop('disabled', false);

        sizeSelect.empty().append(`<option value="auto">🎲 Aléatoire (Selon la région)</option>`);
        Object.keys(data.size_rules.weighted).forEach(s => sizeSelect.append(`<option value="${s}">${s}</option>`));
        sizeSelect.prop('disabled', false);

        generateBtn.prop('disabled', false);
    }

    _rollWeighted(weightObj) {
        let totalWeight = 0;
        for (let key in weightObj) totalWeight += weightObj[key];
        let random = Math.floor(Math.random() * totalWeight);
        for (let key in weightObj) {
            random -= weightObj[key];
            if (random < 0) return key;
        }
    }

    async _onGenerateCity(html) {
        const lang = game.i18n.lang.startsWith('en') ? 'en' : 'fr';
        const regionId = html.find('#region-select').val();
        const stateId = html.find('#state-select').val(); 
        const stateInfo = stateId && this.statesData[stateId] ? this.statesData[stateId] : null;
        let biome = html.find('#biome-select').val();
        let size = html.find('#size-select').val();
        const regionInfo = this.regionData[regionId];

        if (biome === "auto") biome = this._rollWeighted(regionInfo.biome_rules.weighted);
        if (size === "auto") size = this._rollWeighted(regionInfo.size_rules.weighted);
        
        let race = "Humain";
        if (regionInfo.race_rules && regionInfo.race_rules.weighted) {
            race = this._rollWeighted(regionInfo.race_rules.weighted);
        }

        // --- PHASE 0 : NOMS ---
        let settlementName = lang === 'en' ? "Unknown Settlement" : "Colonie Anonyme";
        let leaderName = lang === 'en' ? "Unknown Leader" : "Dirigeant Inconnu";
        const regionNames = this.namesData[regionId];

        const getText = (item) => (typeof item === 'object') ? (item[lang] || item.fr || "") : (item || "");

        if (regionNames) {
            const sn = regionNames.settlement_names;
            if (sn) {
                const useStandalone = Math.random() > 0.5 && sn.standalone && sn.standalone.length > 0;
                if (useStandalone) {
                    const rawName = sn.standalone[Math.floor(Math.random() * sn.standalone.length)];
                    settlementName = getText(rawName);
                } else if (sn.prefixes && sn.suffixes) {
                    const rawPrefix = sn.prefixes[Math.floor(Math.random() * sn.prefixes.length)];
                    const rawSuffix = sn.suffixes[Math.floor(Math.random() * sn.suffixes.length)];
                    settlementName = getText(rawPrefix) + getText(rawSuffix);
                }
            }

            const chars = regionNames.characters;
            if (chars) {
                const sex = Math.random() > 0.5 ? 'm' : 'f';
                const charData = chars[sex];
                if (charData) {
                    const rawFirstName = charData.firstnames[Math.floor(Math.random() * charData.firstnames.length)];
                    let rawLastName = charData.lastnames[Math.floor(Math.random() * charData.lastnames.length)];
                    const firstName = getText(rawFirstName);
                    let lastName = getText(rawLastName);
                    if (lastName.includes("{Lieu}")) lastName = lastName.replace("{Lieu}", settlementName);
                    leaderName = firstName + lastName; 
                }
            }
        }

        // --- PHASE 1 : L'ÂME ---
        let originTags = [];
        let originText = lang === 'en' ? "Unknown origins." : "Origines inconnues.";
        let historyEventText = "";
        let ageText = "";

        if (this.historyData && this.historyData.ages) {
            const rolledAgeKey = this._rollWeighted(this.historyData.ages.weighted);
            ageText = this.historyData.ages.descriptions[rolledAgeKey][lang] || this.historyData.ages.descriptions[rolledAgeKey].fr;
        }

        if (this.historyData && this.historyData.past_events && Math.random() > 0.7) {
            const randomEvent = this.historyData.past_events[Math.floor(Math.random() * this.historyData.past_events.length)];
            historyEventText = " " + (randomEvent[lang] || randomEvent.fr);
        }

        const validOrigins = this.originsData.filter(orig => {
            const rTags = orig.region_tags || ["all"];
            const bTags = orig.biome_tags || ["all"];
            return (rTags.includes("all") || rTags.includes(regionId)) &&
                   (bTags.includes("all") || bTags.includes(biome));
        });

        if (validOrigins.length > 0) {
            const selectedOrigin = validOrigins[Math.floor(Math.random() * validOrigins.length)];
            const baseOrigin = selectedOrigin.description[lang] || selectedOrigin.description.fr;
            originText = `${baseOrigin} Le lieu est ${ageText}.${historyEventText}`;
            originTags = selectedOrigin.output_tags || [];
        }

        let vitalityText = lang === 'en' ? "Unknown vitality." : "Vitalité inconnue.";
        let selectedVitality = null; 
        
        if (this.vitalityData.length > 0) {
            let vitWeightObj = {};
            this.vitalityData.forEach((vit, index) => {
                let baseWeight = 10; 
                if (vit.origin_tags) {
                    vit.origin_tags.forEach(tag => {
                        if (originTags.includes(tag)) baseWeight += 40; 
                    });
                }
                if (stateInfo && stateInfo.vibe_modifiers && vit.vibe_modifiers) {
                    Object.keys(vit.vibe_modifiers).forEach(vibe => {
                         if (stateInfo.vibe_modifiers[vibe] > 0 && vit.vibe_modifiers[vibe] > 0) baseWeight += 20; 
                         if (stateInfo.vibe_modifiers[vibe] > 0 && vit.vibe_modifiers[vibe] < 0) baseWeight -= 10;
                    });
                }
                vitWeightObj[index] = Math.max(1, baseWeight); 
            });

            const selectedVitIndex = this._rollWeighted(vitWeightObj);
            selectedVitality = this.vitalityData[selectedVitIndex];
            vitalityText = selectedVitality.description[lang] || selectedVitality.description.fr;
        }

        const allAxes = Object.keys(this.temperamentData);
        const shuffledAxes = allAxes.sort(() => 0.5 - Math.random());
        const selectedAxes = shuffledAxes.slice(0, 2);
        const finalTraits = [];
        
        // --- HÉRITAGE DE LA CARTE (Correction de Scope) ---
        let vibeTags = [];
        let existingEcos = [];
        let politicalText = ""; 
        let factionsPresent = [];
        let factionDataStr = "";
        
        if (this.targetedHexId && game.modules.get("ultimateforge-hexforge")?.active) {
            const hexData = canvas.scene.getFlag("ultimateforge-hexforge", this.targetedHexId) || {};
            vibeTags = [...(hexData.vibe_tags || [])];
            existingEcos = [...(hexData.eco_tags || [])];

            const influences = hexData.influence || {};
            const rawFactions = game.settings.get("ultimateforge-realmsforge", "factionsData") || {};
            
            for (const [fId, score] of Object.entries(influences)) {
                const faction = rawFactions[fId];
                if (faction) {
                    factionsPresent.push({ name: faction.name, score: score, type: faction.type, vibes: faction.vibes });
                    if (faction.vibes) {
                        const fVibes = faction.vibes.split(',').map(v => v.trim().toLowerCase());
                        vibeTags.push(...fVibes);
                    }
                }
            }

            // NOUVELLE LOGIQUE : L'encart de Gouvernance ignore le niveau 1
            const activeFactions = factionsPresent.filter(f => f.score >= 2);

            if (activeFactions.length > 0) {
                // Tri déjà fait, on prend les plus fortes parmi les "actives"
                const mainFaction = activeFactions[0];

                if (activeFactions.length === 1) {
                    if (mainFaction.score >= 4) politicalText = lang === 'en' ? `The settlement is firmly under the control of <strong>${mainFaction.name}</strong> (${mainFaction.type}).` : `La cité est fermement sous le contrôle de <strong>${mainFaction.name}</strong> (${mainFaction.type}).`;
                    else if (mainFaction.score === 3) politicalText = lang === 'en' ? `<strong>${mainFaction.name}</strong> holds a fragile authority here.` : `<strong>${mainFaction.name}</strong> exerce une autorité officielle mais très fragile sur ce lieu.`;
                    else politicalText = lang === 'en' ? `Agents of <strong>${mainFaction.name}</strong> actively infiltrate the upper echelons.` : `Des agents affiliés à <strong>${mainFaction.name}</strong> infiltrent activement les sphères d'influence locales.`;
                } else {
                    const secondFaction = activeFactions[1];
                    if (mainFaction.score >= 4 && secondFaction.score >= 3) {
                        politicalText = lang === 'en' ? `The city is on the brink of civil war. <strong>${mainFaction.name}</strong> rules officially, but <strong>${secondFaction.name}</strong> violently contests this power.` : `La ville est au bord de la guerre civile. <strong>${mainFaction.name}</strong> dirige officiellement, mais <strong>${secondFaction.name}</strong> conteste violemment ce pouvoir.`;
                    } else if (mainFaction.score >= 4 && secondFaction.score === 2) {
                        politicalText = lang === 'en' ? `<strong>${mainFaction.name}</strong> rules with an iron fist, fighting dissent sown by <strong>${secondFaction.name}</strong>.` : `<strong>${mainFaction.name}</strong> tient la ville d'une main de fer, luttant contre la dissidence semée dans l'ombre par <strong>${secondFaction.name}</strong>.`;
                    } else {
                        politicalText = lang === 'en' ? `A nest of vipers where <strong>${mainFaction.name}</strong> and <strong>${secondFaction.name}</strong> wage a shadow war.` : `La cité est un nid de vipères où <strong>${mainFaction.name}</strong> et <strong>${secondFaction.name}</strong> se livrent une guerre d'ombre mortelle.`;
                    }
                }
            }
        }
        
        // C'est cette variable qui était perdue !
        factionDataStr = factionsPresent.slice(0, 2).map(f => f.name.replace(/['"|,]/g, '') + ':' + f.score).join('|');

        selectedAxes.forEach(axeName => {
            const traitsArray = this.temperamentData[axeName];
            let weightObj = {};
            traitsArray.forEach((trait, index) => {
                let baseWeight = 20; 
                if (trait.output_tags) {
                    trait.output_tags.forEach(tag => {
                        if (regionInfo.vibe_rules && regionInfo.vibe_rules[tag]) baseWeight += regionInfo.vibe_rules[tag]; 
                        if (stateInfo && stateInfo.vibe_modifiers && stateInfo.vibe_modifiers[tag]) baseWeight += stateInfo.vibe_modifiers[tag]; 
                        if (selectedVitality && selectedVitality.vibe_modifiers && selectedVitality.vibe_modifiers[tag]) {
                            baseWeight += selectedVitality.vibe_modifiers[tag];
                        }
                    });
                }
                weightObj[index] = Math.max(1, baseWeight); 
            });

            const selectedIndex = this._rollWeighted(weightObj);
            const randomTrait = traitsArray[selectedIndex];

            finalTraits.push(randomTrait.trait[lang] || randomTrait.trait.fr);
            vibeTags = [...new Set(vibeTags.concat(randomTrait.output_tags || []))];
        });
        
        const andWord = lang === 'en' ? 'and' : 'et';
        const vibeText = finalTraits.join(` <span style='color:#7b1e1e; font-weight:bold;'>${andWord}</span> `);
        const atmos = lang === 'en' ? "The local ambiance is characterized by" : "L'ambiance locale se distingue par";


        // --- PHASE 2 : LE CORPS ---
        let govTags = [];
        let govText = lang === 'en' ? "led by a local chief." : "dirigé par un chef local.";
        let safeGovText = "Chef local";

        const validGov = this.governanceData.filter(gov => {
            return (gov.size_tags.includes("all") || gov.size_tags.includes(size)) &&
                   (gov.vibe_tags.includes("all") || gov.vibe_tags.some(tag => vibeTags.includes(tag)));
        });

        if (validGov.length > 0) {
            let govWeightObj = {};
            validGov.forEach((gov, index) => {
                let baseWeight = 10; 
                if (gov.vibe_tags) {
                    gov.vibe_tags.forEach(tag => {
                        if (vibeTags.includes(tag)) baseWeight += 50; 
                    });
                }
                if (gov.vibe_tags.includes("all")) baseWeight = 5; 
                govWeightObj[index] = baseWeight;
            });

            const selectedGovIndex = this._rollWeighted(govWeightObj);
            const selectedGov = validGov[selectedGovIndex];

            govText = selectedGov.description[lang] || selectedGov.description.fr;
            safeGovText = govText.replace(/['"]/g, "&apos;").trim();
            if (safeGovText.startsWith(",")) safeGovText = safeGovText.substring(1).trim();
            govTags = selectedGov.output_tags || [];
        }
        
        let ecoTags = [];
        const validEco = this.economyData.filter(eco => {
            return (eco.biome_tags.includes("all") || eco.biome_tags.includes(biome)) &&
                   (eco.origin_tags.includes("all") || eco.origin_tags.some(tag => originTags.includes(tag)));
        });
        
        let ecoText = lang === 'en' ? "Subsistence economy." : "Économie de survie.";
        let barterText = "";
        if (stateInfo && stateInfo.price_multiplier >= 1.5) {
            barterText = lang === 'en' 
                ? " <br><em>Note : The region is in crisis. Coins have lost their value; barter is heavily practiced here.</em>" 
                : " <br><em>Note : La région étant en crise, les pièces ont perdu de leur valeur. Le troc est massivement pratiqué.</em>";
        }

        if (validEco.length > 0) {
            let ecoWeightObj = {};
            validEco.forEach((eco, index) => {
                let baseWeight = 10; 
                if (eco.output_tags) {
                    eco.output_tags.forEach(tag => {
                        if (regionInfo.eco_rules && regionInfo.eco_rules[tag]) baseWeight += regionInfo.eco_rules[tag];
                        if (stateInfo && stateInfo.eco_modifiers && stateInfo.eco_modifiers[tag]) baseWeight += stateInfo.eco_modifiers[tag];
                        if (vibeTags.includes(tag)) baseWeight += 40; 
                    });
                }

                if (eco.output_tags) {
                    if ((vibeTags.includes("luxe") || vibeTags.includes("opulent")) && (eco.output_tags.includes("pauvre") || eco.output_tags.includes("survie"))) baseWeight = 0;
                    if ((vibeTags.includes("pauvre") || vibeTags.includes("miserable")) && eco.output_tags.includes("luxe")) baseWeight = 0;
                    if (vibeTags.includes("luxe") && eco.id === "eco_av_007") baseWeight = 0;
                }

                ecoWeightObj[index] = Math.max(0, baseWeight); 
            });

            const selectedEcoIndex = this._rollWeighted(ecoWeightObj);
            const selectedEco = validEco[selectedEcoIndex];
            ecoText = (selectedEco.description[lang] || selectedEco.description.fr) + barterText;
            ecoTags = [...new Set(existingEcos.concat(selectedEco.output_tags || []))];
        }

       // --- PHASE 3 : QUARTIERS ---
        let numDistricts = 1;
        if (size === "Village") numDistricts = 2;
        if (size === "Petite Ville") numDistricts = 3;
        if (size === "Grande Cité") numDistricts = 4;
        if (size === "Métropole" || size === "Capitale") numDistricts = 5;

        let selectedDistricts = [];

        const govDistricts = this.districtsData.filter(d => 
            d.poi_types && d.poi_types.includes("gouvernance") &&
            (!d.size_tags || d.size_tags.includes("all") || d.size_tags.includes(size)) &&
            (!d.biome_tags || d.biome_tags.includes("all") || d.biome_tags.includes(biome)) &&
            (!d.eco_tags || d.eco_tags.includes("all") || d.eco_tags.some(tag => ecoTags.includes(tag)))
        );
        
        if (govDistricts.length > 0) {
            const coreDistrict = govDistricts[Math.floor(Math.random() * govDistricts.length)];
            selectedDistricts.push(coreDistrict);
        }

        if ((biome === "Rivage" || biome === "Aquatique") && selectedDistricts.length < numDistricts) {
            const waterDistricts = this.districtsData.filter(d => 
                d.biome_tags && (d.biome_tags.includes("Rivage") || d.biome_tags.includes("Aquatique")) &&
                (!d.size_tags || d.size_tags.includes("all") || d.size_tags.includes(size)) &&
                !selectedDistricts.includes(d)
            );
            
            if (waterDistricts.length > 0) {
                const dockDistrict = waterDistricts[Math.floor(Math.random() * waterDistricts.length)];
                selectedDistricts.push(dockDistrict);
            }
        }

        const validDistricts = this.districtsData.filter(d => {
            if (selectedDistricts.includes(d)) return false; 
            const validBiome = !d.biome_tags || d.biome_tags.includes("all") || d.biome_tags.includes(biome);
            const validEco = !d.eco_tags || d.eco_tags.includes("all") || d.eco_tags.some(tag => ecoTags.includes(tag));
            const validSize = !d.size_tags || d.size_tags.includes("all") || d.size_tags.includes(size);
            return validBiome && validEco && validSize;
        });

        const remainingSlots = Math.max(0, numDistricts - selectedDistricts.length);
        const shuffledDistricts = validDistricts.sort(() => 0.5 - Math.random());
        selectedDistricts = selectedDistricts.concat(shuffledDistricts.slice(0, remainingSlots));

        // --- PRÉPARATION DES VARIABLES NARRATIVES ---
        const regionName = regionInfo.name[lang] || regionInfo.name.fr;
        const firstLetter = settlementName.charAt(0);
        const restName = settlementName.slice(1);
        const estUn = lang === 'en' ? 'is a' : 'est un(e)';
        const situe = lang === 'en' ? 'located in' : 'situé(e) au cœur de la région de';
        const survie = lang === 'en' ? 'To survive, the settlement relies on:' : 'Pour prospérer, la population s\'appuie sur son environnement :';

        let leaderTitleObj = { fr: "le dirigeant", en: "the leader" }; 
        if (regionInfo.leader_titles && regionInfo.leader_titles[size]) {
            leaderTitleObj = regionInfo.leader_titles[size];
        }
        const leaderTitle = leaderTitleObj[lang] || leaderTitleObj.fr;
        const dirige = lang === 'en' ? `The settlement is led by` : `Le lieu est sous l'autorité de`;

        const stateText = stateInfo ? (lang === 'en' ? ` Current Context: ${stateInfo.description.en}` : ` Contexte Actuel : ${stateInfo.description.fr}`) : "";

        let population = 0;
        if (size === "Campement") population = Math.floor(Math.random() * 50) + 20;
        if (size === "Hameau") population = Math.floor(Math.random() * 150) + 50;
        if (size === "Village") population = Math.floor(Math.random() * 800) + 200;
        if (size === "Petite Ville") population = Math.floor(Math.random() * 4000) + 1000;
        if (size === "Grande Cité") population = Math.floor(Math.random() * 15000) + 5000;
        if (size === "Métropole") population = Math.floor(Math.random() * 40000) + 20000;
        if (size === "Capitale") population = Math.floor(Math.random() * 50000) + 50000;

        let demoText = "";
        if (regionInfo.race_rules && regionInfo.race_rules.weighted) {
            const baseWeights = regionInfo.race_rules.weighted;
            const races = Object.keys(baseWeights);
            if (races.length === 1) {
                demoText = `(100% ${races[0]})`;
            } else {
                let totalNewWeight = 0;
                let randomizedWeights = {};
                races.forEach(race => {
                    const variation = 0.7 + (Math.random() * 0.6); 
                    const w = baseWeights[race] * variation;
                    randomizedWeights[race] = w;
                    totalNewWeight += w;
                });
                let percentages = [];
                let totalPct = 0;
                races.forEach(race => {
                    let pct = Math.round((randomizedWeights[race] / totalNewWeight) * 100);
                    if (pct > 0) { percentages.push({ race: race, pct: pct }); totalPct += pct; }
                });
                if (percentages.length > 0 && totalPct !== 100) {
                    percentages.sort((a, b) => b.pct - a.pct);
                    percentages[0].pct += (100 - totalPct);
                }
                percentages.sort((a, b) => b.pct - a.pct);
                const demoParts = percentages.map(p => `${p.pct}% ${p.race}`);
                demoText = `(${demoParts.join(', ')})`;
            }
        }
        const popText = lang === 'en' 
            ? `home to around <strong>${population} souls</strong> <span style="font-size:0.85em; color:#555;">${demoText}</span>,` 
            : `abritant environ <strong>${population} âmes</strong> <span style="font-size:0.85em; color:#555;">${demoText}</span>,`;

        let districtsHTML = "";
        let journalDistrictsHTML = `<h2><i class="fas fa-map-marked-alt"></i> Les Quartiers</h2>`;

        selectedDistricts.forEach(dist => {
            const distName = dist.name[lang] || dist.name.fr;
            const distDesc = dist.description[lang] || dist.description.fr;
            
            let poiHTML = `<div style="display:flex; gap:5px; flex-wrap:wrap; margin-top:8px;">`;
            let journalPoiHTML = "<ul>";

            if (dist.poi_types && dist.poi_types.length > 0) {
                dist.poi_types.forEach(poi => {
                    let icon = "fa-map-marker-alt";
                    if (poi.includes("taverne")) icon = "fa-beer";
                    if (poi.includes("marchand") || poi.includes("apothicaire")|| poi.includes("bazar")|| poi.includes("armurerie")|| poi.includes("tailleur")|| poi.includes("archerie")|| poi.includes("antiquaire")|| poi.includes("ecurie")|| poi.includes("tanneur")|| poi.includes("curiosite")|| poi.includes("librairie") || poi.includes("forgeron")) icon = "fa-store";
                    if (poi === "gouvernance") icon = "fa-landmark";
                    if (poi.includes("panneau") || poi.includes("primes")) icon = "fa-bullhorn";
                    
                    const label = poi.replace(/_/g, ' ');

                    let currencySym = "PO";
                    if (this.themeSettings && this.themeSettings.currency && this.themeSettings.currency.symbol) {
                        currencySym = this.themeSettings.currency.symbol[lang] || this.themeSettings.currency.symbol.fr;
                    }
                    
                    // ON UTILISE LA VARIABLE GLOBALE ICI !
                    poiHTML += `<span class="cf-poi-badge gen-poi-btn" data-type="${poi}" data-district="${distName}" data-size="${size}" data-region="${regionId}" data-city="${settlementName}" data-biome="${biome}" data-state="${stateId}" data-pricemult="${stateInfo ? stateInfo.price_multiplier : 1.0}" data-currency="${currencySym}" data-leadername="${leaderName}" data-leadertitle="${leaderTitle}" data-govtags="${govTags.join(',')}" data-ecotags="${ecoTags.join(',')}" data-vibetags="${vibeTags.join(',')}" data-factions="${factionDataStr}" title="Générer ce lieu"><i class="fas ${icon}"></i> <span style="text-transform: capitalize;">${label}</span></span>`;

                    journalPoiHTML += `<li><strong><span style="text-transform: capitalize;">${label}</span></strong> <span style="color:#7f8c8d; font-size: 0.9em;">(${icon === "fa-beer" ? "Taverne" : icon === "fa-store" ? "Boutique" : "Lieu Public"})</span></li>`;
                });
            }
            poiHTML += `</div>`;
            journalPoiHTML += "</ul>";

            districtsHTML += `
                <div class="cf-district-card">
                    <h4><i class="fas fa-map-signs"></i> ${distName}</h4>
                    <p style="font-size:0.9em; margin: 5px 0; color: #555;"><em>${distDesc}</em></p>
                    ${poiHTML}
                </div>
            `;

            journalDistrictsHTML += `
                <h3 style="color: #27ae60; border-bottom: 1px solid #27ae60; margin-top: 15px;">${distName}</h3>
                <p style="font-style: italic; color: #555;">${distDesc}</p>
                ${journalPoiHTML}
            `;
        });

        html.find('#res-title').text(settlementName);
        html.find('#res-subtitle').text(`${size} en ${regionName} | Biome : ${biome}`);

        const introTitle = lang === 'en' ? 'Overview & History' : 'Vue d\'Ensemble & Histoire';
        const vibeTitle = lang === 'en' ? 'Atmosphere & Vitality' : 'Atmosphère & Vitalité';
        const govTitle = lang === 'en' ? 'Governance' : 'Gouvernance';
        const ecoTitle = lang === 'en' ? 'Economy & Survival' : 'Économie & Survie';
        const contextTitle = lang === 'en' ? 'Current Context' : 'Contexte Régional';

        let stateHtmlBlock = "";
        if (stateInfo && stateInfo.description) {
            const stateDesc = lang === 'en' ? stateInfo.description.en : stateInfo.description.fr;
            stateHtmlBlock = `
                <div style="margin-bottom: 15px; border-left: 4px solid #c0392b; background: rgba(192, 57, 43, 0.05); padding: 10px; border-radius: 0 4px 4px 0;">
                    <h4 style="margin: 0 0 5px 0; color: #c0392b;"><i class="fas fa-exclamation-triangle"></i> ${contextTitle}</h4>
                    <p style="margin: 0; font-size: 0.95em; color: #444;">${stateDesc}</p>
                </div>
            `;
        }

        const narrativeHTML = `
            <div style="margin-bottom: 15px;">
                <h3 style="color: #2c3e50; border-bottom: 1px solid #bdc3c7; padding-bottom: 5px;"><i class="fas fa-scroll"></i> ${introTitle}</h3>
                <p style="text-align: justify; line-height: 1.5;">
                    <span class="cf-dropcap">${firstLetter}</span><strong>${restName}</strong> ${estUn} <strong>${size.toLowerCase()}</strong> ${situe} <strong>${regionName}</strong>, ${popText} 
                    ${originText}
                </p>
            </div>

            <div style="background: rgba(142, 68, 173, 0.05); border-left: 3px solid #8e44ad; padding: 10px 15px; border-radius: 0 4px 4px 0; margin-bottom: 20px;">
                <h4 style="margin: 0 0 5px 0; color: #8e44ad;"><i class="fas fa-street-view"></i> ${vibeTitle}</h4>
                <p style="text-align: justify; line-height: 1.5; margin: 0; color: #333;">
                    ${vitalityText} <br><span style="display:inline-block; margin-top:5px;">${atmos} <strong>${vibeText}</strong>.</span>
                </p>
            </div>

            ${stateHtmlBlock}

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
                <div style="background: rgba(41, 128, 185, 0.05); padding: 12px; border-radius: 6px; border: 1px solid #d6eaf8;">
                    <h4 style="margin: 0 0 8px 0; color: #2980b9;"><i class="fas fa-landmark"></i> ${govTitle}</h4>
                    
                    ${politicalText ? `<div class="cf-political-box" style="background: #fdf5e6; border-left: 3px solid #e67e22; padding: 6px 10px; margin-bottom: 10px; border-radius: 0 4px 4px 0;"><p style="margin: 0; font-size: 0.9em; color: #d35400; font-style: italic;"><i class="fas fa-chess-knight"></i> ${politicalText}</p></div>\n` : ''}
                    
                    <p style="margin: 0; font-size: 0.95em; line-height: 1.4;">
                        ${dirige} <strong class="cf-leader-highlight"><i class="fas fa-crown"></i> ${leaderName} <i class="fas fa-external-link-alt gen-leader-btn" data-title="${leaderTitle}" data-name="${leaderName}" data-gov="${safeGovText}" data-size="${size}" data-region="${regionId}" data-city="${settlementName}" data-race="${race}" style="cursor:pointer;" title="Générer la Fiche"></i></strong>
                        ${govText}
                    </p>
                </div>

                <div style="background: rgba(39, 174, 96, 0.05); padding: 12px; border-radius: 6px; border: 1px solid #d5f5e3;">
                    <h4 style="margin: 0 0 8px 0; color: #27ae60;"><i class="fas fa-coins"></i> ${ecoTitle}</h4>
                    <p style="margin: 0; font-size: 0.95em; line-height: 1.4;">
                        ${survie} ${ecoText}
                    </p>
                </div>
            </div>

            <div style="margin-top: 15px; font-size: 0.85em; color: #7f8c8d; border-top: 1px solid #ecf0f1; padding-top: 8px; text-align: center;">
                <strong><i class="fas fa-fingerprint"></i> Empreinte de la cité :</strong> 
                <span style="color: #8e44ad; text-transform: capitalize;">${vibeTags.length ? vibeTags.join(', ') : 'Aucune'}</span> | 
                <span style="color: #27ae60; text-transform: capitalize;">${ecoTags.length ? ecoTags.join(', ') : 'Aucune'}</span>
            </div>
        `;

        html.find('#res-narrative').html(narrativeHTML);
        html.find('#res-districts').html(districtsHTML);

        const journalNarrativeHTML = narrativeHTML.replace(/<i class="fas fa-external-link-alt gen-leader-btn"[\s\S]*?<\/i>/g, '');

        this.currentCityJournalData = {
            name: settlementName,
            content: journalNarrativeHTML + journalDistrictsHTML,
            rawData: {
                regionId, stateId, biome, size, race,
                settlementName, leaderName, leaderTitle,
                originText, originTags,
                vitalityText,
                vibeText, vibeTags,
                govText, govTags,
                ecoText, ecoTags,
                factionsStr: factionDataStr,
                districts: selectedDistricts,
                narrativeHTML: narrativeHTML, 
                districtsHTML: districtsHTML  
            }
        };

        html.find('#watabou-btn').data('name', settlementName).data('size', size).data('biome', biome);
        html.find('#results-section').removeClass('hidden');

    }

    async _onCreateLeaderJournal(event) {
        const btn = event.currentTarget;
        const name = btn.dataset.name;
        const govDesc = btn.dataset.gov;
        const size = btn.dataset.size;
        const regionId = btn.dataset.region;
        const cityName = btn.dataset.city;
        const race = btn.dataset.race;
        const leaderTitle = btn.dataset.title;
        
        const npcData = InternalNpcGenerator.generate(name, govDesc, size, regionId, cityName, race, this.npcsData, leaderTitle);

        // 1. Création systématique du Journal
        const entry = await JournalEntry.create({
            name: name,
            pages: [{
                name: "Profil",
                type: "text",
                text: { content: npcData.html, format: 1 } 
            }]
        });
        entry.sheet.render(true);

        // 2. MODULARITÉ : On cherche le script de création de fiche propre au thème actif
        let basePath = "modules/ultimateforge-core/data/default_fantasy";
        if (game.settings.settings.has("ultimateforge-core.activeThemePath")) {
            basePath = game.settings.get("ultimateforge-core", "activeThemePath").replace(/\/$/, "");
        }

        try {
            // Import dynamique : Le code va tenter de charger le fichier en direct
            const modulePath = `/${basePath}/theme-actor.mjs`;
            const themeModule = await import(modulePath);

            // Si le fichier existe et possède la fonction createActor, on lance la machine !
            if (themeModule && themeModule.createActor) {
                ui.notifications.info(`CityForge | Génération de la fiche Acteur via le thème...`);
                await themeModule.createActor(name, npcData);
            }
        } catch (error) {
            // Si l'import échoue (fichier introuvable), c'est normal : le thème ne supporte pas la création de fiche
            console.log(`CityForge | Aucun générateur d'acteur détecté pour le thème (${basePath}).`);
            ui.notifications.info(`CityForge | Journal du dirigeant généré (Création de fiche non gérée par ce thème).`);
        }
    }

    async _onCreatePOIJournal(event) {
        const btn = event.currentTarget;
        
        let name = btn.dataset.name; 
        const type = btn.dataset.type;
        const district = btn.dataset.district; 
        const size = btn.dataset.size;
        const region = btn.dataset.region; 
        const city = btn.dataset.city; 
        const biome = btn.dataset.biome;
        const stateId = btn.dataset.state;
        const priceMult = parseFloat(btn.dataset.pricemult) || 1.0;
        const currency = btn.dataset.currency || "PO";
        
        const leaderName = btn.dataset.leadername;
        const leaderTitle = btn.dataset.leadertitle;
        const govTags = btn.dataset.govtags ? btn.dataset.govtags.split(',') : [];
        const factionsStr = btn.dataset.factions || ""; 

        if (!name) {
            const typeLabel = type.replace(/_/g, ' ');
            const capitalizedType = typeLabel.charAt(0).toUpperCase() + typeLabel.slice(1);
            name = `${capitalizedType} (${city})`;
        }

        let content = "";

        if (type.includes("taverne")) {
            const ecoTags = btn.dataset.ecotags ? btn.dataset.ecotags.split(',') : [];
            const vibeTags = btn.dataset.vibetags ? btn.dataset.vibetags.split(',') : [];
            content = InternalTavernGenerator.generateHTML(name, type, district, size, region, city, this.namesData, this.tavernsData, biome, stateId, priceMult, currency, govTags, ecoTags, vibeTags, factionsStr);
        }
        else if (type.includes("bazar") || type.includes("marchand") || type.includes("apothicaire") || type.includes("forge") || type.includes("armurerie") || type.includes("tailleur") || type.includes("tanneur") || type.includes("marche_noir") || type.includes("curiosite") || type.includes("librairie") || type.includes("graveur") || type.includes("archerie") || type.includes("cartographe") || type.includes("antiquaire") || type.includes("ecurie") || type.includes("menagerie") || type.includes("changeur_monnaie") || type.includes("joaillier")) {
            content = InternalShopGenerator.generateHTML(name, type, district, size, region, city, this.namesData, this.shopsData, biome, stateId, priceMult, currency);
        }
        else if (type.includes("panneau") || type.includes("doleance") || type.includes("primes")) {
            const ecoTags = btn.dataset.ecotags ? btn.dataset.ecotags.split(',') : [];
            const vibeTags = btn.dataset.vibetags ? btn.dataset.vibetags.split(',') : [];
            content = InternalBountyGenerator.generateHTML(name, type, district, size, region, city, this.namesData, this.bountiesData, biome, stateId, govTags, ecoTags, vibeTags, currency, factionsStr);
        }
        else if (type === "gouvernance" || type.includes("gouvernance")) {
            content = InternalGovernanceGenerator.generateHTML(district, size, region, city, leaderName, leaderTitle, govTags, this.govBuildingsData);
        }
        else {
            content = `
                <div style="font-family: var(--font-primary);">
                    <h2 style="color: #27ae60; border-bottom: 2px solid #27ae60;">${name}</h2>
                    <p><strong>Type :</strong> ${type.toUpperCase()}</p>
                    <p><strong>Emplacement :</strong> ${district}</p>
                    <hr>
                    <p style="color: #7f8c8d; font-style: italic;">Description en cours de rédaction...</p>
                </div>
            `;
        }

        const entry = await JournalEntry.create({
            name: name,
            pages: [{
                name: "Détails du Lieu",
                type: "text",
                text: { content: content, format: 1 }
            }]
        });

        await entry.setFlag("ultimateforge-cityforge", "poiData", {
            type: type,
            district: district,
            parentHexId: this.targetedHexId
        });

        ui.notifications.info(`Le lieu ${name} a été documenté !`);
        entry.sheet.render(true);
    }

    async _onSaveCityJournal(event) {
        event.preventDefault();
        if (!this.currentCityJournalData) return;

        const entry = await JournalEntry.create({
            name: this.currentCityJournalData.name,
            pages: [{
                name: "Vue d'ensemble",
                type: "text",
                text: { content: this.currentCityJournalData.content, format: 1 }
            }]
        });

        await entry.setFlag("ultimateforge-cityforge", "cityData", this.currentCityJournalData.rawData);

        if (game.modules.get("ultimateforge-hexforge")?.active && this.targetedHexId) {
            const currentHexData = canvas.scene.getFlag("ultimateforge-hexforge", this.targetedHexId) || {};
            currentHexData.cityJournalId = entry.id; 
            
            // --- NOUVEAU : SAUVEGARDE ET PROPAGATION DES TAGS UNIQUEMENT À L'ARCHIVAGE ---
            const rawData = this.currentCityJournalData.rawData;
            
            // On inscrit les tags définitifs de la ville dans la case centrale
            currentHexData.vibe_tags = rawData.vibeTags;
            currentHexData.eco_tags = rawData.ecoTags;
            await canvas.scene.setFlag("ultimateforge-hexforge", this.targetedHexId, currentHexData);
            
            // On propage l'influence aux cases alentours
            this._propagateAurasToMap(this.targetedHexId, rawData.vibeTags, rawData.ecoTags);
            // -----------------------------------------------------------------------------

            ui.notifications.success(`La cité "${this.currentCityJournalData.name}" a été archivée ET implantée sur la carte !`);
        } else {
            ui.notifications.success(`La cité "${this.currentCityJournalData.name}" a été archivée (Mode Autonome).`);
        }

        entry.sheet.render(true);
    }

    _onOpenWatabou(event) {
        event.preventDefault();
        const btn = $(event.currentTarget);
        const name = encodeURIComponent(btn.data('name') || "Ville");
        const sizeLabel = btn.data('size');
        const biome = btn.data('biome'); 
        
        let wSize = 15; 
        let hasWalls = 1;
        let hasCitadel = 1;
        let hasTemple = 1;
        let hasPlaza = 1;
        let shantytown = 0; 
        
        let coast = 0;
        let river = 0;

        if (biome === "Rivage" || biome === "Aquatique") {
            coast = 1;
            river = Math.random() < 0.6 ? 1 : 0;
        } else {
            coast = 0;
            river = Math.random() < 0.5 ? 1 : 0;
        }

        if (sizeLabel === "Campement" || sizeLabel === "Hameau") {
            wSize = 3;
            hasWalls = 0;    
            hasCitadel = 0;  
            hasTemple = 0;   
            hasPlaza = 0;    
            if (sizeLabel === "Campement") shantytown = 1; 
        }
        else if (sizeLabel === "Village") {
            wSize = 6;
            hasWalls = 0;    
            hasCitadel = 0;  
            hasTemple = 1;   
            hasPlaza = 1;    
        }
        else if (sizeLabel === "Petite Ville") {
            wSize = 15;
            hasWalls = 1;    
            hasCitadel = 0;  
            hasTemple = 1;
            hasPlaza = 1;
        }
        else if (sizeLabel === "Grande Cité") {
            wSize = 35;
            hasWalls = 1;
            hasCitadel = 1;  
            hasTemple = 1;
            hasPlaza = 1;
        }
        else if (sizeLabel === "Métropole" || sizeLabel === "Capitale") {
            wSize = 50;
            hasWalls = 1;
            hasCitadel = 1;
            hasTemple = 1;
            hasPlaza = 1;
        }

        const url = `https://watabou.github.io/city-generator/?name=${name}&size=${wSize}&citadel=${hasCitadel}&plaza=${hasPlaza}&temple=${hasTemple}&walls=${hasWalls}&shantytown=${shantytown}&coast=${coast}&river=${river}`;
        window.open(url, '_blank');
    }

    static async generateIsolatedPlaceJournal(hexId, traitId, regionId, biome) {
        const lang = game.i18n.lang.startsWith('en') ? 'en' : 'fr';
        
        let basePath = "modules/ultimateforge-core/data/default_fantasy";
        if (game.settings.settings.has("ultimateforge-core.activeThemePath")) {
            basePath = game.settings.get("ultimateforge-core", "activeThemePath");
            if (basePath.endsWith("/")) basePath = basePath.slice(0, -1);
        }

        const [
            namesData, tavernsData, shopsData, bountiesData, npcsData, 
            regionData, statesData, themeSettings, isolatedData, decorsData
        ] = await Promise.all([
            fetch(`${basePath}/names.json`).then(r => r.json()).catch(()=>({})),
            fetch(`${basePath}/taverns.json`).then(r => r.json()).catch(()=>({})),
            fetch(`${basePath}/shops_loot.json`).then(r => r.json()).catch(()=>({})),
            fetch(`${basePath}/bounties.json`).then(r => r.json()).catch(()=>({})),
            fetch(`${basePath}/npcs.json`).then(r => r.json()).catch(()=>({})),
            fetch(`${basePath}/regions-structure.json`).then(r => r.json()).catch(()=>({})),
            fetch(`${basePath}/regional_states.json`).then(r => r.json()).catch(()=>({})),
            fetch(`${basePath}/theme.json`).then(r => r.json()).catch(()=>null),
            fetch(`${basePath}/isolated_places.json`).then(r => r.json()).catch(()=>({})),
            fetch(`${basePath}/jf_decors.json`).then(r => r.json()).catch(()=>[]) 
        ]);

        const getText = (item) => (typeof item === 'object') ? (item[lang] || item.fr || "") : (item || "");

        const hexData = canvas.scene.getFlag("ultimateforge-hexforge", hexId) || {};
        const vibeTags = (hexData.vibe_tags || []).filter(t => typeof t === 'string' && t.trim() !== "");
        const ecoTags = (hexData.eco_tags || []).filter(t => typeof t === 'string' && t.trim() !== "");
        const stateId = hexData.state || null;
        const stateInfo = stateId ? statesData[stateId] : null;
        const priceMult = stateInfo ? stateInfo.price_multiplier : 1.0;
        const govTags = ["isole"];
        const size = "Campement";
        
        const safeRegionId = regionId || Object.keys(regionData)[0] || "inconnue";
        const regionInfo = regionData[safeRegionId] || {};
        const safeBiome = biome || "Plaines";
        const weatherId = canvas.scene?.weather || "clear"; 
        
        let currencySym = "PO";
        if (themeSettings && themeSettings.currency && themeSettings.currency.symbol) {
            currencySym = themeSettings.currency.symbol[lang] || themeSettings.currency.symbol.fr;
        }

        let leaderName = lang === 'en' ? "Unknown Owner" : "Propriétaire Inconnu";
        let charPool = namesData[safeRegionId]?.characters;
        if (!charPool) {
            const fallbackRegion = Object.keys(namesData)[0];
            if (fallbackRegion) charPool = namesData[fallbackRegion]?.characters;
        }
        if (charPool) {
            const sex = Math.random() > 0.5 ? 'm' : 'f';
            const charData = charPool[sex];
            if (charData && charData.firstnames && charData.firstnames.length > 0) {
                const rawFirstName = charData.firstnames[Math.floor(Math.random() * charData.firstnames.length)];
                let rawLastName = charData.lastnames[Math.floor(Math.random() * charData.lastnames.length)];
                leaderName = (getText(rawFirstName) + " " + getText(rawLastName)).replace("{Lieu}", "").trim();
            }
        }

        const isoConfig = isolatedData[traitId] || {
            name_format: { fr: "Lieu de {Leader}", en: "{Leader}'s Place" },
            leader_title: { fr: "Propriétaire", en: "Owner" },
            recipe: ["bazar"],
            description: { fr: "Un lieu isolé et mystérieux.", en: "An isolated and mysterious place." }
        };

        const settlementName = (isoConfig.name_format[lang] || isoConfig.name_format.fr).replace("{Leader}", leaderName);
        const leaderTitle = isoConfig.leader_title[lang] || isoConfig.leader_title.fr;
        const recipe = isoConfig.recipe;
        
        let finalDescription = isoConfig.description[lang] || isoConfig.description.fr;
        const validDecors = decorsData.filter(d => d.trait_id === traitId && (!d.weather_tags || d.weather_tags.length === 0 || d.weather_tags.includes(weatherId) || d.weather_tags.includes("all")));
        if (validDecors.length > 0) {
            const selectedDecor = validDecors[Math.floor(Math.random() * validDecors.length)];
            finalDescription = selectedDecor.text[lang] || selectedDecor.text.fr;
        }

        let pages = [];
        const regionNameText = regionInfo.name ? (regionInfo.name[lang] || regionInfo.name.fr) : safeRegionId;
        const stateText = stateInfo ? (lang === 'en' ? stateInfo.description.en : stateInfo.description.fr) : "";
        
        const formatTags = (tagsArray) => tagsArray.map(t => t.charAt(0).toUpperCase() + t.slice(1).replace(/-/g, ' ')).join(', ');
        
        let auraText = vibeTags.length > 0 ? `<br>L'atmosphère du lieu est marquée par : <strong style="color:#8e44ad;">${formatTags(vibeTags)}</strong>.` : "";
        let ecoTextDesc = ecoTags.length > 0 ? `<br>Les activités locales s'articulent autour de : <strong style="color:#27ae60;">${formatTags(ecoTags)}</strong>.` : "";

        const npcData = InternalNpcGenerator.generate(leaderName, "Lieu Isolé / Autonomie totale", size, safeRegionId, settlementName, "Humain", npcsData, leaderTitle);

        const overviewHTML = `
            <div style="font-family: var(--font-primary);">
                <h1 style="color: #2980b9; border-bottom: 2px solid #3498db;"><i class="fas fa-home"></i> ${settlementName}</h1>
                <p style="text-align: justify; font-size: 1.15em; line-height: 1.6; color: #2c3e50; border-left: 3px solid #f39c12; padding-left: 10px; background: #fcf3cf; padding: 10px;">
                    <em>${finalDescription}</em>
                </p>
                <p style="font-size: 0.95em; color: #555;">
                    Ce refuge est situé au cœur du biome <strong>${safeBiome}</strong> de la région de <strong>${regionNameText}</strong>.
                </p>
                <p style="font-size: 0.95em; border: 1px solid #eee; padding: 8px; background: #fafafa;">${auraText}${ecoTextDesc}</p>
                ${stateText ? `<p style="color: #c0392b; border-left: 3px solid #c0392b; padding-left: 10px;"><strong>Contexte Régional :</strong> ${stateText}</p>` : ''}
                
                <hr style="border: 0; border-top: 1px dashed #ccc; margin: 20px 0;">
                <h3 style="color: #27ae60;"><i class="fas fa-map-signs"></i> Navigation</h3>
                <p style="color: #555; font-style: italic;">Utilisez l'index sur la gauche du journal pour visiter les différentes installations de ce lieu.</p>
                <hr style="border: 0; border-top: 1px dashed #ccc; margin: 20px 0;">
                
                ${npcData.html}
            </div>
        `;

        pages.push({ name: "1. Vue d'ensemble", type: "text", text: { content: overviewHTML, format: 1 } });

        let pageIndex = 2;
        for (const poi of recipe) {
            let poiName = poi.replace(/_/g, ' ');
            poiName = poiName.charAt(0).toUpperCase() + poiName.slice(1);
            let contentHTML = "";

            if (poi.includes("taverne")) {
                contentHTML = InternalTavernGenerator.generateHTML(poiName, poi, "Le Domaine", size, safeRegionId, settlementName, namesData, tavernsData, safeBiome, stateId, priceMult, currencySym, govTags, ecoTags, vibeTags, "");
            } else if (poi.includes("panneau") || poi.includes("primes")) {
                contentHTML = InternalBountyGenerator.generateHTML(poiName, poi, "Le Domaine", size, safeRegionId, settlementName, namesData, bountiesData, safeBiome, stateId, govTags, ecoTags, vibeTags, currencySym, "");
            } else {
                contentHTML = InternalShopGenerator.generateHTML(poiName, poi, "Le Domaine", size, safeRegionId, settlementName, namesData, shopsData, safeBiome, stateId, priceMult, currencySym);
            }

            pages.push({ name: `${pageIndex}. ${poiName}`, type: "text", text: { content: contentHTML, format: 1 } });
            pageIndex++;
        }

        const entry = await JournalEntry.create({ name: settlementName, pages: pages });
        await canvas.scene.setFlag("ultimateforge-hexforge", hexId, { cityJournalId: entry.id });

        ui.notifications.success(`CityForge | Le lieu isolé "${settlementName}" a été généré !`);
        entry.sheet.render(true);
    }

    async _propagateAurasToMap(centerHexId, vibeTags, ecoTags) {
        if (!vibeTags.length && !ecoTags.length) return;
        
        const parts = centerHexId.split('_');
        if (parts.length !== 3) return;
        const cRow = parseInt(parts[1]);
        const cCol = parseInt(parts[2]);
        
        const radius = 2; 
        let flagUpdates = {};
        
        for (let r = cRow - radius; r <= cRow + radius; r++) {
            for (let c = cCol - radius; c <= cCol + radius; c++) {
                if (Math.abs(r - cRow) === radius && Math.abs(c - cCol) === radius) continue; 
                
                const hexId = `hex_${r}_${c}`;
                const existingData = canvas.scene.getFlag("ultimateforge-hexforge", hexId) || {};
                
                let currentVibes = existingData.vibe_tags || [];
                const currentEcos = existingData.eco_tags || [];
                
                if (vibeTags.length > 0 && currentVibes.length > 0) {
                    let removableVibes = currentVibes.filter(t => !vibeTags.includes(t));
                    removableVibes = removableVibes.sort(() => 0.5 - Math.random());
                    const tagsToDrop = removableVibes.slice(0, 2);
                    currentVibes = currentVibes.filter(t => !tagsToDrop.includes(t));
                }
                
                const newVibes = [...new Set([...currentVibes, ...vibeTags])];
                const newEcos = [...new Set([...currentEcos, ...ecoTags])];
                
                if (currentVibes.length !== newVibes.length || currentEcos.length !== newEcos.length) {
                    flagUpdates[`flags.ultimateforge-hexforge.${hexId}`] = {
                        ...existingData, 
                        vibe_tags: newVibes,
                        eco_tags: newEcos
                    };
                }
            }
        }
        
        if (Object.keys(flagUpdates).length > 0) {
            await canvas.scene.update(flagUpdates);
        }
    }

    static async updateCityAtmosphere(journal, hexId, journalData) {
        const lang = (game.i18n.language || "fr").startsWith('en') ? 'en' : 'fr';
        
        let basePath = "modules/ultimateforge-core/data/default_fantasy";
        if (game.settings.settings.has("ultimateforge-core.activeThemePath")) {
            basePath = game.settings.get("ultimateforge-core", "activeThemePath");
            if (basePath.endsWith("/")) basePath = basePath.slice(0, -1);
        }

        const [namesData, tavernsData, bountiesData, statesData, themeSettings] = await Promise.all([
            fetch(`${basePath}/names.json`).then(r => r.json()).catch(()=>({})),
            fetch(`${basePath}/taverns.json`).then(r => r.json()).catch(()=>({})),
            fetch(`${basePath}/bounties.json`).then(r => r.json()).catch(()=>({})),
            fetch(`${basePath}/regional_states.json`).then(r => r.json()).catch(()=>({})),
            fetch(`${basePath}/theme.json`).then(r => r.json()).catch(()=>null)
        ]);

        const cityData = journalData.rawData;
        const stateInfo = cityData.stateId ? statesData[cityData.stateId] : null;
        const priceMult = stateInfo ? stateInfo.price_multiplier : 1.0;
        let currencySym = "PO";
        if (themeSettings && themeSettings.currency && themeSettings.currency.symbol) {
            currencySym = themeSettings.currency.symbol[lang] || themeSettings.currency.symbol.fr;
        }

        let nbUpdated = 0;

        const mainUpdates = [];
        for (const page of journal.pages.contents) {
            if (page.name.includes("Vue d'ensemble")) {
                mainUpdates.push({ _id: page.id, "text.content": journalData.content });
                nbUpdated++;
            }
        }
        if (mainUpdates.length > 0) {
            await journal.updateEmbeddedDocuments("JournalEntryPage", mainUpdates);
            await journal.setFlag("ultimateforge-cityforge", "cityData", cityData);
        }

        const allJournals = game.journal.contents;
        const linkedJournals = allJournals.filter(j => {
            const poiData = j.getFlag("ultimateforge-cityforge", "poiData");
            if (poiData && poiData.parentHexId === hexId) return true;
            if (j.name.includes(`(${cityData.settlementName})`)) return true;
            return false;
        });

        for (const poiJournal of linkedJournals) {
            const poiUpdates = [];
            const poiData = poiJournal.getFlag("ultimateforge-cityforge", "poiData") || {};
            let type = poiData.type || "inconnu";
            let district = poiData.district || "Quartier";

            if (type === "inconnu") {
                const lowerName = poiJournal.name.toLowerCase();
                if (lowerName.includes("taverne")) type = lowerName.includes("louche") ? "taverne_louche" : (lowerName.includes("luxueuse") ? "taverne_luxueuse" : "taverne");
                else if (lowerName.includes("panneau") || lowerName.includes("primes")) type = "panneau_annonces";
            }

            for (const page of poiJournal.pages.contents) {
                let content = page.text.content;
                let pageUpdated = false;
                const cleanName = poiJournal.name;
                const factionsStr = cityData.factionsStr || ""; 
                
                if (type.includes("taverne")) {
                    content = InternalTavernGenerator.generateHTML(cleanName, type, district, cityData.size, cityData.regionId, cityData.settlementName, namesData, tavernsData, cityData.biome, cityData.stateId, priceMult, currencySym, cityData.govTags, cityData.ecoTags, cityData.vibeTags, factionsStr);
                    pageUpdated = true;
                } else if (type.includes("panneau") || type.includes("primes")) {
                    content = InternalBountyGenerator.generateHTML(cleanName, "panneau_annonces", district, cityData.size, cityData.regionId, cityData.settlementName, namesData, bountiesData, cityData.biome, cityData.stateId, cityData.govTags, cityData.ecoTags, cityData.vibeTags, currencySym, factionsStr);
                    pageUpdated = true;
                }

                if (pageUpdated) {
                    poiUpdates.push({ _id: page.id, "text.content": content });
                }
            }
            if (poiUpdates.length > 0) {
                await poiJournal.updateEmbeddedDocuments("JournalEntryPage", poiUpdates);
                nbUpdated++;
            }
        }

        if (nbUpdated > 0) {
            ui.notifications.success(`RealmsForge | L'atmosphère et les lieux ont été actualisés (${nbUpdated} pages modifiées) !`);
        }
    }

}