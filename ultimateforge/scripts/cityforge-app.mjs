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
        this.biomesData = null;
        this.tagsDictionary = null;
        this.currentCityJournalData = null;
    }

    static DEFAULT_OPTIONS = {
        id: "avantis-cityforge",
        window: {
            title: "CITYFORGE.Title",
            resizable: true
        },
        position: { width: 800, height: 680 },
        classes: ["avantis-window", "avantis-cityforge-app"]
    };

    static PARTS = {
        main: { template: "modules/ultimateforge/templates/cityforge-app.html" }
    };

    _getSizeLabel(sizeKey, lang) {
        const sizes = {
            "Campement": { fr: "Campement", en: "Encampment" },
            "Hameau": { fr: "Hameau", en: "Hamlet" },
            "Village": { fr: "Village", en: "Village" },
            "Petite Ville": { fr: "Petite Ville", en: "Small Town" },
            "Grande Cité": { fr: "Grande Cité", en: "Large City" },
            "Métropole": { fr: "Métropole", en: "Metropolis" },
            "Capitale": { fr: "Capitale", en: "Capital" }
        };
        return sizes[sizeKey] ? sizes[sizeKey][lang] : sizeKey;
    }

    _getBiomeLabel(biomeKey, lang) {
        if (this.biomesData && this.biomesData.biomes && this.biomesData.biomes[biomeKey]) {
            return this.biomesData.biomes[biomeKey].name[lang] || biomeKey;
        }
        return biomeKey;
    }

    _formatTags(tagsArray, lang) {
        if (!tagsArray || tagsArray.length === 0) return "";
        return tagsArray.map(tag => {
            if (this.tagsDictionary && this.tagsDictionary.tags && this.tagsDictionary.tags[tag]) {
                return this.tagsDictionary.tags[tag][lang] || this.tagsDictionary.tags[tag].fr || tag;
            }
            return tag.charAt(0).toUpperCase() + tag.slice(1).replace(/-/g, ' ');
        }).join(', ');
    }

    async _prepareContext(options) {
        if (Object.keys(this.regionData).length === 0) {
            try {
                let basePath = game.settings.get("ultimateforge", "activeThemePath");
                if (basePath.endsWith("/")) basePath = basePath.slice(0, -1);

                const themeRes = await fetch(`${basePath}/theme.json`).catch(() => null);
                this.themeSettings = themeRes ? await themeRes.json() : null;

                const [regRes, origRes, vitRes, tempRes, govRes, ecoRes, distRes, poiRes, namesRes, shopsRes, rumRes, npcsRes, tavRes, bountiesRes, statesRes, histRes, govBuildRes, biomesRes, tagsDictRes] = await Promise.all([
                    fetch(`${basePath}/regions-structure.json`), fetch(`${basePath}/origins.json`), fetch(`${basePath}/vitality.json`), fetch(`${basePath}/temperament.json`),
                    fetch(`${basePath}/governance.json`), fetch(`${basePath}/economy.json`), fetch(`${basePath}/districts.json`), fetch(`${basePath}/poi_seeds.json`),
                    fetch(`${basePath}/names.json`), fetch(`${basePath}/shops_loot.json`), fetch(`${basePath}/rumors.json`), fetch(`${basePath}/npcs.json`),
                    fetch(`${basePath}/taverns.json`), fetch(`${basePath}/bounties.json`), fetch(`${basePath}/regional_states.json`), fetch(`${basePath}/history.json`),
                    fetch(`${basePath}/gov_buildings.json`), fetch(`${basePath}/hex_biomes.json`).catch(() => null), fetch(`${basePath}/tags_dictionary.json`).catch(() => null)
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
                this.biomesData = biomesRes ? await biomesRes.json() : null;
                this.tagsDictionary = tagsDictRes ? await tagsDictRes.json() : null;
            } catch (error) {
                console.error("CITYFORGE | Erreur de chargement des JSON :", error);
            }
        }
        return {};
    }

    _onRender(context, options) {
        super._onRender(context, options);
        const html = $(this.element);

        const lang = String(game.i18n.lang).startsWith('en') ? 'en' : 'fr';

        const windowContent = html.find('.window-content');
        windowContent.addClass('cf-window-content');

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

        // NOUVEAU : Écouteur pour la modification manuelle du nom de la ville
        html.find('#res-title-input').change(e => {
            const newName = e.currentTarget.value.trim();
            if (!newName) return;
            
            // 1. Mise à jour de la mémoire centrale
            if (this.currentCityJournalData) {
                this.currentCityJournalData.name = newName;
                this.currentCityJournalData.rawData.settlementName = newName;
            }
            if (this.loadedCityData) {
                this.loadedCityData.settlementName = newName;
            }
            
            // 2. Mise à jour du bouton Watabou
            html.find('#watabou-btn').data('name', newName);
            
            // 3. RUISSELLEMENT : Mise à jour des attributs des Forges (Boutiques, PNJ)
            html.find('.gen-poi-btn').attr('data-city', newName);
            html.find('.gen-leader-btn').attr('data-city', newName);
            
            ui.notifications.info(`Nom de la ville mis à jour : ${newName}`);
        });

        if (this.loadedCityData) {
            setTimeout(() => {
                html.find('#region-select').val(this.loadedCityData.regionId).trigger('change');
                html.find('#biome-select').val(this.loadedCityData.biome);
                html.find('#size-select').val(this.loadedCityData.size);
                html.find('#state-select').val(this.loadedCityData.stateId);

                this._rebuildCity(html);
            }, 100);
        } else if (this.targetedHexId && game.modules.get("ultimateforge")?.active) {
            setTimeout(() => {
                const hexData = canvas.scene.getFlag("ultimateforge", this.targetedHexId) || {};

                if (hexData.region) html.find('#region-select').val(hexData.region).trigger('change');
                if (hexData.biome) html.find('#biome-select').val(hexData.biome);
                if (hexData.state) html.find('#state-select').val(hexData.state);

                const traitId = this.options.traitId || hexData.occupation;
                if (traitId) {
                    const sizeMapVal = {
                        "campement": "Campement", "hameau": "Hameau", "village": "Village",
                        "petite_ville": "Petite Ville", "grande_cite": "Grande Cité",
                        "metropole": "Métropole", "capitale": "Capitale"
                    };
                    const matchedSize = sizeMapVal[traitId.toLowerCase()] || Object.values(sizeMapVal).find(s => traitId.toLowerCase().includes(s.toLowerCase()));
                    if (matchedSize) html.find('#size-select').val(matchedSize);
                }
            }, 150);
        }
    }

    _rebuildCity(html) {
        const data = this.loadedCityData;
        const lang = String(game.i18n.lang).startsWith('en') ? 'en' : 'fr';

        if (!data.narrativeHTML) {
            ui.notifications.warn(game.i18n.localize("CITYFORGE.Notifications.NeedGenerateFirst"));
            return;
        }

        html.find('#res-title-input').val(data.settlementName);
        const regionInfo = this.regionData[data.regionId];
        const regionName = regionInfo ? (regionInfo.name[lang] || regionInfo.name.fr) : data.regionId;

        const sizeLabel = this._getSizeLabel(data.size, lang);
        const biomeLabel = this._getBiomeLabel(data.biome, lang);
        html.find('#res-subtitle').text(`${sizeLabel} en ${regionName} | Biome : ${biomeLabel}`);

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
            const btnText = game.i18n.localize("CITYFORGE.Narrative.UpdateAtmosphereBtn");
            const btnTitle = game.i18n.localize("CITYFORGE.Narrative.UpdateAtmosphereTitle");
            // Utilisation de la nouvelle classe cf-update-btn
            updateBtn = $(`<button id="update-atmosphere-btn" class="cf-action-btn cf-update-btn" title="${btnTitle}"><i class="fas fa-bolt"></i> ${btnText}</button>`);
            html.find('#watabou-btn').after(updateBtn);

            updateBtn.click(async (e) => {
                e.preventDefault();
                await this._triggerAtmosphereUpdate(html);
            });
        }

        ui.notifications.success(game.i18n.format("CITYFORGE.Notifications.CityLoaded", { name: data.settlementName }));
    }

    async _triggerAtmosphereUpdate(html) {
        if (!this.targetedHexId) {
            ui.notifications.error(game.i18n.localize("CITYFORGE.Notifications.NoHexTargeted"));
            return;
        }
        const hexData = canvas.scene.getFlag("ultimateforge", this.targetedHexId);
        if (!hexData || !hexData.cityJournalId) {
            ui.notifications.warn(game.i18n.localize("CITYFORGE.Notifications.NotArchived"));
            return;
        }
        const journal = game.journal.get(hexData.cityJournalId);
        if (!journal) return;

        ui.notifications.info(game.i18n.localize("CITYFORGE.Notifications.Recalculating"));

        const data = this.loadedCityData;
        const lang = String(game.i18n.lang).startsWith('en') ? 'en' : 'fr';

        const newVibeTags = (hexData.vibe_tags || []).filter(t => typeof t === 'string' && t.trim() !== "");
        let newEcoTags = (hexData.eco_tags || []).filter(t => typeof t === 'string' && t.trim() !== "");
        const newStateId = hexData.state || null;

        // --- 1. GOUVERNANCE basée sur les Vibes ---
        let newGovTags = [];
        let newGovText = game.i18n.localize("CITYFORGE.Narrative.LocalChiefDesc");
        let newSafeGovText = game.i18n.localize("CITYFORGE.Narrative.LocalChief");

        const validGov = this.governanceData.filter(gov => {
            const matchRegion = !gov.region_tags || gov.region_tags.includes("all") || gov.region_tags.includes(data.regionId);
            return matchRegion &&
                (gov.size_tags.includes("all") || gov.size_tags.includes(data.size)) &&
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

        // --- 2. TEMPÉRAMENT (Texte de l'ambiance) ---
        const finalTraits = [];
        Object.keys(this.temperamentData).forEach(axeName => {
            const traitsArray = this.temperamentData[axeName];
            const matching = traitsArray.filter(t => t.output_tags && t.output_tags.some(tag => newVibeTags.includes(tag)));
            if (matching.length > 0) {
                const randomTrait = matching[Math.floor(Math.random() * matching.length)];
                finalTraits.push(randomTrait.trait[lang] || randomTrait.trait.fr);
            }
        });
        let newVibeText = game.i18n.localize("CITYFORGE.Narrative.ShiftingAtmosphere");
        if (finalTraits.length > 0) {
            const selected = finalTraits.sort(() => 0.5 - Math.random()).slice(0, 2);
            newVibeText = selected.join(` <span style='color:#7b1e1e; font-weight:bold;'>${game.i18n.localize("CITYFORGE.Narrative.And")}</span> `);
        }

        // --- 3. NOUVEAU : VITALITÉ basée sur les Vibes ---
        let newVitalityText = data.vitalityText || game.i18n.localize("CITYFORGE.Narrative.UnknownVitality");
        const validVit = this.vitalityData.filter(vit => vit.vibe_tags && vit.vibe_tags.some(tag => newVibeTags.includes(tag)));

        if (validVit.length > 0) {
            let vitWeightObj = {};
            validVit.forEach((vit, index) => {
                let baseWeight = 10;
                vit.vibe_tags.forEach(tag => { if (newVibeTags.includes(tag)) baseWeight += 40; });
                vitWeightObj[index] = baseWeight;
            });
            const selectedVitIndex = this._rollWeighted(vitWeightObj);
            const selectedVit = validVit[selectedVitIndex];
            newVitalityText = selectedVit.description[lang] || selectedVit.description.fr;
        }

        // --- 4. ÉCONOMIE ---
        let newEcoText = data.ecoText;
        const stateInfo = newStateId ? this.statesData[newStateId] : null;

        const validEco = this.economyData.filter(eco => {
            const matchBiome = eco.biome_tags.includes("all") || eco.biome_tags.includes(data.biome);
            // Ici on lit les origines depuis "data" (la ville déjà générée)
            const matchOrigin = eco.origin_tags.includes("all") || (data.originTags && eco.origin_tags.some(tag => data.originTags.includes(tag)));
            const matchVibe = !eco.vibe_tags || eco.vibe_tags.includes("all") || eco.vibe_tags.some(tag => newVibeTags.includes(tag));
            return matchBiome && matchOrigin && matchVibe;
        });

        if (validEco.length > 0) {
            let ecoWeightObj = {};
            validEco.forEach((eco, index) => {
                let baseWeight = 10;
                if (eco.output_tags) {
                    eco.output_tags.forEach(tag => {
                        if (stateInfo && stateInfo.eco_modifiers && stateInfo.eco_modifiers[tag]) baseWeight += stateInfo.eco_modifiers[tag];
                    });
                }
                ecoWeightObj[index] = Math.max(0, baseWeight);
            });

            const selectedEcoIndex = this._rollWeighted(ecoWeightObj);
            const selectedEco = validEco[selectedEcoIndex];
            let barterText = (stateInfo && stateInfo.price_multiplier >= 1.5) ? game.i18n.localize("CITYFORGE.Narrative.BarterNote") : "";
            newEcoText = (selectedEco.description[lang] || selectedEco.description.fr) + barterText;

            const existingEcos = (hexData.eco_tags || []).filter(t => typeof t === 'string' && t.trim() !== "");
            newEcoTags = [...new Set(existingEcos.concat(selectedEco.output_tags || []))];
        }

        // --- 5. FACTIONS ET ETAT CIVIL ---
        let newStateHtmlBlock = "";
        if (stateInfo && stateInfo.description) {
            const stateDesc = lang === 'en' ? stateInfo.description.en : stateInfo.description.fr;
            const contextTitle = game.i18n.localize("CITYFORGE.Narrative.CurrentContext");
            newStateHtmlBlock = `
                <div style="margin-bottom: 15px; border-left: 4px solid #c0392b; background: rgba(192, 57, 43, 0.05); padding: 10px; border-radius: 0 4px 4px 0;">
                    <h4 style="margin: 0 0 5px 0; color: #c0392b;"><i class="fas fa-exclamation-triangle"></i> ${contextTitle}</h4>
                    <p style="margin: 0; font-size: 0.95em; color: #444;">${stateDesc}</p>
                </div>`;
        }

        const influences = hexData.influence || {};
        const rawFactions = game.settings.get("ultimateforge", "factionsData") || {};
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
                if (mainFaction.score >= 4) politicalText = game.i18n.format("CITYFORGE.Politics.U_Control1", { name: mainFaction.name });
                else if (mainFaction.score === 3) politicalText = game.i18n.format("CITYFORGE.Politics.U_Control2", { name: mainFaction.name });
                else politicalText = game.i18n.format("CITYFORGE.Politics.U_Control3", { name: mainFaction.name });
            } else {
                const secondFaction = activeFactions[1];
                if (mainFaction.score >= 4 && secondFaction.score >= 3) politicalText = game.i18n.format("CITYFORGE.Politics.U_War1", { name1: mainFaction.name, name2: secondFaction.name });
                else if (mainFaction.score >= 4 && secondFaction.score === 2) politicalText = game.i18n.format("CITYFORGE.Politics.U_War2", { name1: mainFaction.name, name2: secondFaction.name });
                else politicalText = game.i18n.format("CITYFORGE.Politics.U_War3", { name1: mainFaction.name, name2: secondFaction.name });
            }
        }

        let updatedHTML = data.narrativeHTML;

        // Mise à jour de la Politique
        // Mise à jour de la Politique
        let newPoliticalHtmlBlock = politicalText ? `<div class="cf-political-box"><p><i class="fas fa-chess-knight"></i> ${politicalText}</p></div>\n` : '';
        updatedHTML = updatedHTML.replace(/<div class="cf-political-box".*?<\/div>\n?/s, '');
        const polRegex = /(<h4.*?><i class="fas fa-landmark"><\/i>.*?<\/h4>\s*)/s;
        updatedHTML = updatedHTML.replace(polRegex, `$1${newPoliticalHtmlBlock}`);

        // Mise à jour de l'Ambiance ET de la Vitalité
        const vibeRegex = /(<h4.*?><i class="fas fa-street-view"><\/i>.*?<\/h4>\s*<p[^>]*>\s*)(.*?)( <br><span class="cf-vibe-summary">.*?<strong>)(.*?)(<\/strong>\.<\/span>\s*<\/p>)/s;
        updatedHTML = updatedHTML.replace(vibeRegex, `$1${newVitalityText}$3${newVibeText}$5`);

        // Mise à jour de l'économie
        const survieRegexStr = game.i18n.localize("CITYFORGE.Narrative.ReliesOn");
        const ecoRegex = new RegExp(`(${survieRegexStr})(.*?)(<\/p>)`, "s");
        updatedHTML = updatedHTML.replace(ecoRegex, `$1 ${newEcoText}\n$3`);

        // Mise à jour du gouverneur
        const govRegex = /(<strong class="cf-leader-highlight">.*?data-gov=")[^"]*(".*?(?:<\/i><\/strong>|<\/strong><\/a>)\s*)(.*?)(<\/p>)/s;
        updatedHTML = updatedHTML.replace(govRegex, `$1${newSafeGovText}$2${newGovText}\n$4`);

        // Mise à jour de l'état
        const stateRegex = /(<\/div>\s*)(<div class="cf-state-box".*?<\/div>\s*)?(<div class="cf-grid-2">)/s;
        updatedHTML = updatedHTML.replace(stateRegex, `$1${newStateHtmlBlock}\n$3`);

        // Mise à jour des Tags affichés
        const tagsRegex = /(<strong><i class="fas fa-fingerprint"><\/i>[^<]*<\/strong>\s*)<span class="cf-tag-vibe">.*?<\/span>(\s*\|\s*)<span class="cf-tag-eco">.*?<\/span>/;
        const noneText = game.i18n.localize("CITYFORGE.Narrative.None");
        const newVibeTagsHTML = newVibeTags.length ? this._formatTags(newVibeTags, lang) : noneText;
        const newEcoTagsHTML = newEcoTags.length ? this._formatTags(newEcoTags, lang) : noneText;
        updatedHTML = updatedHTML.replace(tagsRegex, `$1<span class="cf-tag-vibe">${newVibeTagsHTML}</span>$2<span class="cf-tag-eco">${newEcoTagsHTML}</span>`);

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

        // Sauvegarde des nouvelles données
        data.govTags = newGovTags;
        data.govText = newGovText;
        data.vibeTags = newVibeTags;
        data.vitalityText = newVitalityText; // ON SAUVEGARDE LA NOUVELLE VITALITE
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
        const lang = String(game.i18n.lang).startsWith('en') ? 'en' : 'fr';

        if (!data) return;

        biomeSelect.empty().append(`<option value="auto">${game.i18n.localize('CITYFORGE.Random')}</option>`);
        Object.keys(data.biome_rules.weighted).forEach(b => {
            const bName = this._getBiomeLabel(b, lang);
            biomeSelect.append(`<option value="${b}">${bName}</option>`);
        });
        biomeSelect.prop('disabled', false);

        sizeSelect.empty().append(`<option value="auto">${game.i18n.localize('CITYFORGE.Random')}</option>`);
        Object.keys(data.size_rules.weighted).forEach(s => {
            const sName = this._getSizeLabel(s, lang);
            sizeSelect.append(`<option value="${s}">${sName}</option>`);
        });
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
        const lang = String(game.i18n.lang).startsWith('en') ? 'en' : 'fr';
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

        let settlementName = game.i18n.localize("CITYFORGE.Narrative.UnknownSettlement");
        let leaderName = game.i18n.localize("CITYFORGE.Narrative.UnknownLeader");
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
            if (chars && chars.first_names) {
                const sex = Math.random() > 0.5 ? 'm' : 'f';
                // On pointe vers la bonne clé JSON : first_names
                const firstNamesList = chars.first_names[sex]; 
                
                if (firstNamesList && firstNamesList.length > 0) {
                    const rawFirstName = firstNamesList[Math.floor(Math.random() * firstNamesList.length)];
                    let lastName = "";
                    
                    // On pointe vers la bonne clé JSON : last_names
                    if (chars.last_names && chars.last_names.length > 0) {
                        const rawLastName = chars.last_names[Math.floor(Math.random() * chars.last_names.length)];
                        lastName = getText(rawLastName);
                        if (lastName.includes("{Lieu}")) lastName = lastName.replace("{Lieu}", settlementName);
                    }
                    leaderName = getText(rawFirstName) + lastName;
                }
            }
        }

        // --- Récupération du trait géographique ---
        let geoTraitId = "";
        if (this.targetedHexId && game.modules.get("ultimateforge")?.active) {
            const hexData = canvas.scene.getFlag("ultimateforge", this.targetedHexId) || {};
            geoTraitId = hexData.trait || "";
        }

        // --- Origines et Historique ---
        let originTags = [];
        let originText = game.i18n.localize("CITYFORGE.Narrative.UnknownOrigin");
        let historyEventText = "";
        let ageText = "";

        if (this.historyData && this.historyData.ages) {
            const rolledAgeKey = this._rollWeighted(this.historyData.ages.weighted);
            ageText = this.historyData.ages.descriptions[rolledAgeKey][lang] || this.historyData.ages.descriptions[rolledAgeKey].fr;
        }

        const validOrigins = this.originsData.filter(orig => {
            const rTags = orig.region_tags || ["all"];
            const bTags = orig.biome_tags || ["all"];
            const tTags = orig.trait_tags || ["all"];

            const matchRegion = rTags.includes("all") || rTags.includes(regionId);
            const matchBiome = bTags.includes("all") || bTags.includes(biome);
            const matchTrait = tTags.includes("all") || (geoTraitId && tTags.includes(geoTraitId));

            return matchRegion && matchBiome && matchTrait;
        });

        let baseOriginText = "";
        if (validOrigins.length > 0) {
            let originWeightObj = {};
            validOrigins.forEach((orig, index) => {
                let baseWeight = 10;
                const tTags = orig.trait_tags || ["all"];
                if (geoTraitId && tTags.includes(geoTraitId)) {
                    baseWeight += 50;
                }
                originWeightObj[index] = baseWeight;
            });

            const selectedOriginIndex = this._rollWeighted(originWeightObj);
            const selectedOrigin = validOrigins[selectedOriginIndex];
            baseOriginText = selectedOrigin.description[lang] || selectedOrigin.description.fr;
            originTags = selectedOrigin.output_tags || [];
        }

        if (this.historyData && this.historyData.past_events && Math.random() > 0.7) {
            const validEvents = this.historyData.past_events.filter(evt => {
                const matchBiome = !evt.biome_tags || evt.biome_tags.includes("all") || evt.biome_tags.includes(biome);
                const matchOrigin = !evt.origin_tags || evt.origin_tags.includes("all") || evt.origin_tags.some(tag => originTags.includes(tag));
                return matchBiome && matchOrigin;
            });

            if (validEvents.length > 0) {
                const randomEvent = validEvents[Math.floor(Math.random() * validEvents.length)];
                historyEventText = " " + (randomEvent.description[lang] || randomEvent.description.fr);
            }
        }

        if (baseOriginText) {
            originText = `${baseOriginText} Le lieu est ${ageText}.${historyEventText}`;
        }

        // --- FACTIONS ET RÉCUPÉRATION DES VIBES ---
        let vibeTags = [];
        let existingEcos = [];
        let politicalText = "";
        let factionsPresent = [];
        let factionDataStr = "";

        if (this.targetedHexId && game.modules.get("ultimateforge")?.active) {
            const hexData = canvas.scene.getFlag("ultimateforge", this.targetedHexId) || {};
            vibeTags = [...(hexData.vibe_tags || [])];
            existingEcos = [...(hexData.eco_tags || [])];

            const influences = hexData.influence || {};
            const rawFactions = game.settings.get("ultimateforge", "factionsData") || {};

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

            const activeFactions = factionsPresent.filter(f => f.score >= 2);

            if (activeFactions.length > 0) {
                const mainFaction = activeFactions[0];
                if (activeFactions.length === 1) {
                    if (mainFaction.score >= 4) politicalText = game.i18n.format("CITYFORGE.Politics.G_Control1", { name: mainFaction.name, type: mainFaction.type });
                    else if (mainFaction.score === 3) politicalText = game.i18n.format("CITYFORGE.Politics.G_Control2", { name: mainFaction.name });
                    else politicalText = game.i18n.format("CITYFORGE.Politics.G_Control3", { name: mainFaction.name });
                } else {
                    const secondFaction = activeFactions[1];
                    if (mainFaction.score >= 4 && secondFaction.score >= 3) {
                        politicalText = game.i18n.format("CITYFORGE.Politics.G_War1", { name1: mainFaction.name, name2: secondFaction.name });
                    } else if (mainFaction.score >= 4 && secondFaction.score === 2) {
                        politicalText = game.i18n.format("CITYFORGE.Politics.G_War2", { name1: mainFaction.name, name2: secondFaction.name });
                    } else {
                        politicalText = game.i18n.format("CITYFORGE.Politics.G_War3", { name1: mainFaction.name, name2: secondFaction.name });
                    }
                }
            }
        }

        factionDataStr = factionsPresent.slice(0, 2).map(f => f.name.replace(/['"|,]/g, '') + ':' + f.score).join('|');

        // --- GÉNÉRATION DU TEMPÉRAMENT (On crée les Vibe Tags FINAUX) ---
        
        // 1. UX : Évaluation de l'identité préalable de la case
        const initialHexVibes = this.targetedHexId ? (canvas.scene.getFlag("ultimateforge", this.targetedHexId)?.vibe_tags || []) : [];
        // Si la case est déjà bien typée (2 tags ou plus), on ajoute moins de chaos (1 seul axe)
        const nbAxes = initialHexVibes.length >= 2 ? 1 : 2; 

        const allAxes = Object.keys(this.temperamentData);
        const shuffledAxes = allAxes.sort(() => 0.5 - Math.random());
        const selectedAxes = shuffledAxes.slice(0, nbAxes);
        const finalTraits = [];

        selectedAxes.forEach(axeName => {
            const traitsArray = this.temperamentData[axeName];
            let weightObj = {};
            
            traitsArray.forEach((trait, index) => {
                let baseWeight = 20;

                if (trait.output_tags) {
                    trait.output_tags.forEach(tag => {
                        // A. Influence des Régions et des États (Pré-existant)
                        if (regionInfo.vibe_rules && regionInfo.vibe_rules[tag]) baseWeight += regionInfo.vibe_rules[tag];
                        if (stateInfo && stateInfo.vibe_modifiers && stateInfo.vibe_modifiers[tag]) baseWeight += stateInfo.vibe_modifiers[tag];
                        
                        // B. NOUVEAU UX : Préservation stricte de l'identité de la case (RealmsForge/HexForge)
                        if (initialHexVibes.includes(tag)) {
                            baseWeight += 150; // Bonus colossal si le trait confirme l'aura déjà présente sur la carte
                        }
                    });
                    
                    // C. Pénalité si le trait n'a AUCUN rapport avec l'aura puissante déjà existante
                    if (initialHexVibes.length > 0 && !trait.output_tags.some(t => initialHexVibes.includes(t))) {
                        baseWeight = Math.max(1, baseWeight - 15);
                    }
                }

                // D. Influence directe de l'Origine du lieu
                if (trait.origin_tags) {
                    trait.origin_tags.forEach(orig => {
                        if (originTags.includes(orig)) baseWeight += 40; 
                    });
                }

                weightObj[index] = Math.max(1, baseWeight);
            });

            const selectedIndex = this._rollWeighted(weightObj);
            const randomTrait = traitsArray[selectedIndex];

            finalTraits.push(randomTrait.trait[lang] || randomTrait.trait.fr);
            vibeTags = [...new Set(vibeTags.concat(randomTrait.output_tags || []))];
        });

        const andWord = game.i18n.localize("CITYFORGE.Narrative.And");
        const vibeText = finalTraits.join(` <span class='cf-vibe-and'>${andWord}</span> `);
        const atmos = game.i18n.localize("CITYFORGE.Narrative.AmbianceIs");


        // --- NOUVEAU : GÉNÉRATION DE LA VITALITÉ BASÉE SUR LES VIBES ---
        let vitalityText = game.i18n.localize("CITYFORGE.Narrative.UnknownVitality");
        const validVit = this.vitalityData.filter(vit => vit.vibe_tags && vit.vibe_tags.some(tag => vibeTags.includes(tag)));

        if (validVit.length > 0) {
            let vitWeightObj = {};
            validVit.forEach((vit, index) => {
                let baseWeight = 10;
                vit.vibe_tags.forEach(tag => {
                    if (vibeTags.includes(tag)) baseWeight += 40;
                });
                vitWeightObj[index] = baseWeight;
            });

            const selectedVitIndex = this._rollWeighted(vitWeightObj);
            const selectedVitality = validVit[selectedVitIndex];
            vitalityText = selectedVitality.description[lang] || selectedVitality.description.fr;
        }

        // --- GÉNÉRATION DE LA GOUVERNANCE BASÉE SUR LES VIBES ---
        let govTags = [];
        let govText = game.i18n.localize("CITYFORGE.Narrative.LocalChiefDesc");
        let safeGovText = game.i18n.localize("CITYFORGE.Narrative.LocalChief");

        const validGov = this.governanceData.filter(gov => {
            const matchRegion = !gov.region_tags || gov.region_tags.includes("all") || gov.region_tags.includes(regionId);
            return matchRegion &&
                (gov.size_tags.includes("all") || gov.size_tags.includes(size)) &&
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

        // --- ÉCONOMIE ---
        let ecoTags = [];
        const validEco = this.economyData.filter(eco => {
            const matchBiome = eco.biome_tags.includes("all") || eco.biome_tags.includes(biome);
            const matchOrigin = eco.origin_tags.includes("all") || eco.origin_tags.some(tag => originTags.includes(tag));
            const matchVibe = !eco.vibe_tags || eco.vibe_tags.includes("all") || eco.vibe_tags.some(tag => vibeTags.includes(tag));
            return matchBiome && matchOrigin && matchVibe;
        });

        let ecoText = game.i18n.localize("CITYFORGE.Narrative.SubsistenceEco");
        let barterText = "";
        if (stateInfo && stateInfo.price_multiplier >= 1.5) {
            barterText = game.i18n.localize("CITYFORGE.Narrative.BarterNote");
        }

        if (validEco.length > 0) {
            let ecoWeightObj = {};
            validEco.forEach((eco, index) => {
                let baseWeight = 10;
                if (eco.output_tags) {
                    eco.output_tags.forEach(tag => {
                        if (regionInfo.eco_rules && regionInfo.eco_rules[tag]) baseWeight += regionInfo.eco_rules[tag];
                        if (stateInfo && stateInfo.eco_modifiers && stateInfo.eco_modifiers[tag]) baseWeight += stateInfo.eco_modifiers[tag];
                    });
                }
                ecoWeightObj[index] = Math.max(0, baseWeight);
            });

            const selectedEcoIndex = this._rollWeighted(ecoWeightObj);
            const selectedEco = validEco[selectedEcoIndex];
            ecoText = (selectedEco.description[lang] || selectedEco.description.fr) + barterText;
            ecoTags = [...new Set(existingEcos.concat(selectedEco.output_tags || []))];
        }

        // --- GÉNÉRATION DES QUARTIERS ---
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

        // --- GÉNÉRATION DU HTML ---
        const regionName = regionInfo.name[lang] || regionInfo.name.fr;
        const firstLetter = settlementName.charAt(0);
        const restName = settlementName.slice(1);
        const estUn = game.i18n.localize("CITYFORGE.Narrative.IsA");
        const situe = game.i18n.localize("CITYFORGE.Narrative.LocatedIn");
        const survie = game.i18n.localize("CITYFORGE.Narrative.ReliesOn");

        let leaderTitleObj = { fr: "le dirigeant", en: "the leader" };
        if (regionInfo.leader_titles && regionInfo.leader_titles[size]) {
            leaderTitleObj = regionInfo.leader_titles[size];
        }
        const leaderTitle = leaderTitleObj[lang] || leaderTitleObj.fr;
        const dirige = game.i18n.localize("CITYFORGE.Narrative.LedBy");

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
        const popText = game.i18n.format("CITYFORGE.Narrative.HomeTo", { pop: population, demo: demoText });

        let districtsHTML = "";
        const distTitle = game.i18n.localize("CITYFORGE.Narrative.DistrictsTitle");
        let journalDistrictsHTML = `<h2><i class="fas fa-map-marked-alt"></i> ${distTitle}</h2>`;

        selectedDistricts.forEach(dist => {
            const distName = dist.name[lang] || dist.name.fr;
            const distDesc = dist.description[lang] || dist.description.fr;

            let poiHTML = `<div style="display:flex; gap:5px; flex-wrap:wrap; margin-top:8px;">`;
            let journalPoiHTML = "<ul>";

            if (dist.poi_types && dist.poi_types.length > 0) {
                dist.poi_types.forEach(poi => {
                    let icon = "fa-map-marker-alt";
                    if (poi.includes("taverne")) icon = "fa-beer";
                    if (poi.includes("marchand") || poi.includes("apothicaire") || poi.includes("bazar") || poi.includes("maison_plaisir") || poi.includes("maison_plaisir_louche") || poi.includes("fumerie") || poi.includes("armurerie") || poi.includes("tailleur") || poi.includes("archerie") || poi.includes("antiquaire") || poi.includes("ecurie") || poi.includes("tanneur") || poi.includes("curiosite") || poi.includes("librairie") || poi.includes("forgeron")) icon = "fa-store";
                    if (poi === "gouvernance") icon = "fa-landmark";
                    if (poi.includes("panneau") || poi.includes("primes")) icon = "fa-bullhorn";

                    const poiDef = this.poiSeedsData.find(p => p.type === poi);
                    let label = poi.replace(/_/g, ' ');
                    if (poiDef && poiDef.name) {
                        label = poiDef.name[lang] || poiDef.name.fr || label;
                    }

                    let currencySym = "PO";
                    if (this.themeSettings && this.themeSettings.currency && this.themeSettings.currency.symbol) {
                        currencySym = this.themeSettings.currency.symbol[lang] || this.themeSettings.currency.symbol.fr;
                    }

                    const genPoiTip = game.i18n.localize("CITYFORGE.Narrative.GeneratePoi");
                    const subLabel = icon === "fa-beer" ? game.i18n.localize("CITYFORGE.Narrative.Tavern") : icon === "fa-store" ? game.i18n.localize("CITYFORGE.Narrative.Shop") : game.i18n.localize("CITYFORGE.Narrative.PublicPlace");

                    poiHTML += `<span class="cf-poi-badge gen-poi-btn" data-type="${poi}" data-district="${distName}" data-size="${size}" data-region="${regionId}" data-city="${settlementName}" data-biome="${biome}" data-state="${stateId}" data-pricemult="${stateInfo ? stateInfo.price_multiplier : 1.0}" data-currency="${currencySym}" data-leadername="${leaderName}" data-leadertitle="${leaderTitle}" data-govtags="${govTags.join(',')}" data-ecotags="${ecoTags.join(',')}" data-vibetags="${vibeTags.join(',')}" data-origintags="${originTags.join(',')}" data-traittags="${geoTraitId}" data-factions="${factionDataStr}" title="${genPoiTip}"><i class="fas ${icon}"></i> <span style="text-transform: capitalize;">${label}</span></span>`;

                    journalPoiHTML += `<li><strong><span style="text-transform: capitalize;">${label}</span></strong> <span style="color:#7f8c8d; font-size: 0.9em;">(${subLabel})</span></li>`;
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

        html.find('#res-title-input').val(settlementName);

        const sizeLabel = this._getSizeLabel(size, lang);
        const biomeLabel = this._getBiomeLabel(biome, lang);
        html.find('#res-subtitle').text(`${sizeLabel} en ${regionName} | Biome : ${biomeLabel}`);

        const introTitle = game.i18n.localize('CITYFORGE.Narrative.OverviewHistory');
        const vibeTitle = game.i18n.localize('CITYFORGE.Narrative.AtmosphereVitality');
        const govTitle = game.i18n.localize('CITYFORGE.Narrative.Governance');
        const ecoTitle = game.i18n.localize('CITYFORGE.Narrative.EconomySurvival');
        const contextTitle = game.i18n.localize('CITYFORGE.Narrative.CurrentContext');

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

        const noneText = game.i18n.localize("CITYFORGE.Narrative.None");
        const imprintTitle = game.i18n.localize("CITYFORGE.Narrative.CityImprint");

        const narrativeHTML = `
            <div class="cf-intro-box">
                <h3><i class="fas fa-scroll"></i> ${introTitle}</h3>
                <p>
                    <span class="cf-dropcap">${firstLetter}</span><strong>${restName}</strong> ${estUn} <strong>${sizeLabel.toLowerCase()}</strong> ${situe} <strong>${regionName}</strong>, ${popText} 
                    ${originText}
                </p>
            </div>

            <div class="cf-box cf-vibe-box">
                <h4><i class="fas fa-street-view"></i> ${vibeTitle}</h4>
                <p>
                    ${vitalityText} <br><span class="cf-vibe-summary">${atmos} <strong>${vibeText}</strong>.</span>
                </p>
            </div>

            ${stateHtmlBlock}

            <div class="cf-grid-2">
                <div class="cf-box cf-gov-box">
                    <h4><i class="fas fa-landmark"></i> ${govTitle}</h4>
                    
                    ${politicalText ? `<div class="cf-political-box"><p><i class="fas fa-chess-knight"></i> ${politicalText}</p></div>\n` : ''}
                    
                    <p>
                        ${dirige} <strong class="cf-leader-highlight"><i class="fas fa-crown"></i> ${leaderName} <i class="fas fa-external-link-alt gen-leader-btn" data-title="${leaderTitle}" data-name="${leaderName}" data-gov="${safeGovText}" data-size="${size}" data-region="${regionId}" data-city="${settlementName}" data-race="${race}" title="Générer la Fiche"></i></strong>
                        ${govText}
                    </p>
                </div>

                <div class="cf-box cf-eco-box">
                    <h4><i class="fas fa-coins"></i> ${ecoTitle}</h4>
                    <p>
                        ${survie} ${ecoText}
                    </p>
                </div>
            </div>

            <div class="cf-tags-footer">
                <strong><i class="fas fa-fingerprint"></i> ${imprintTitle}</strong> 
                <span class="cf-tag-vibe">${vibeTags.length ? this._formatTags(vibeTags, lang) : noneText}</span> | 
                <span class="cf-tag-eco">${ecoTags.length ? this._formatTags(ecoTags, lang) : noneText}</span>
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
                originText, originTags, traitTags: [geoTraitId],
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

        const entry = await JournalEntry.create({
            name: name,
            pages: [{
                name: game.i18n.localize("CITYFORGE.Narrative.Profile"),
                type: "text",
                text: { content: npcData.html, format: 1 }
            }]
        });
        entry.sheet.render(true);

        let basePath = "modules/ultimateforge/data/default_fantasy";
        if (game.settings.settings.has("ultimateforge.activeThemePath")) {
            basePath = game.settings.get("ultimateforge", "activeThemePath").replace(/\/$/, "");
        }

        try {
            const modulePath = `/${basePath}/theme-actor.mjs`;
            const themeModule = await import(modulePath);

            if (themeModule && themeModule.createActor) {
                ui.notifications.info(game.i18n.localize("CITYFORGE.Notifications.ActorGenerated"));
                await themeModule.createActor(name, npcData);
            }
        } catch (error) {
            console.log(`CityForge | Aucun générateur d'acteur détecté pour le thème (${basePath}).`);
            ui.notifications.info(game.i18n.localize("CITYFORGE.Notifications.NoActorGen"));
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

        // --- EXTRACTION GLOBALE DES TAGS POUR TOUS LES POIs ---
        const govTags = btn.dataset.govtags ? btn.dataset.govtags.split(',') : [];
        const ecoTags = btn.dataset.ecotags ? btn.dataset.ecotags.split(',') : [];
        const vibeTags = btn.dataset.vibetags ? btn.dataset.vibetags.split(',') : [];
        const originTags = btn.dataset.origintags ? btn.dataset.origintags.split(',') : [];
        const traitTags = btn.dataset.traittags ? btn.dataset.traittags.split(',') : [];
        const factionsStr = btn.dataset.factions || "";
        const weather = canvas.scene?.weather || "clear";
        // ------------------------------------------------------

        let timeTags = ["jour"];
        const dl = canvas.scene?.environment?.darknessLevel || 0;
        if (dl >= 0.8) timeTags = ["nuit"];
        else if (dl >= 0.6) timeTags = ["crepuscule", "nuit"];
        else if (dl >= 0.4) timeTags = ["aube", "jour"];
        else if (dl > 0) timeTags = ["matin", "apresmidi", "jour"];
        else timeTags = ["midi", "jour"];

        if (!name) {
            const typeLabel = type.replace(/_/g, ' ');
            const capitalizedType = typeLabel.charAt(0).toUpperCase() + typeLabel.slice(1);
            name = `${capitalizedType} (${city})`;
        }

        let content = "";

        if (type.includes("taverne")) {
            // On ajoute weather à la fin (et on a retiré rumorsData)
            content = InternalTavernGenerator.generateHTML(name, type, district, size, region, city, this.namesData, this.tavernsData, biome, stateId, priceMult, currency, govTags, ecoTags, vibeTags, factionsStr, weather);
        }
        else if (type.includes("bazar") || type.includes("marchand") || type.includes("apothicaire") || type.includes("fumerie") || type.includes("maison_plaisir") || type.includes("maison_plaisir_louche") || type.includes("forge") || type.includes("armurerie") || type.includes("tailleur") || type.includes("tanneur") || type.includes("marche_noir") || type.includes("curiosite") || type.includes("librairie") || type.includes("graveur") || type.includes("archerie") || type.includes("cartographe") || type.includes("antiquaire") || type.includes("ecurie") || type.includes("menagerie") || type.includes("changeur_monnaie") || type.includes("joaillier")) {
            // On ajoute les govTags, ecoTags, vibeTags et weather à la boutique
            content = InternalShopGenerator.generateHTML(name, type, district, size, region, city, this.namesData, this.shopsData, biome, stateId, priceMult, currency, govTags, ecoTags, vibeTags, weather);
        }
        else if (type.includes("panneau") || type.includes("doleance") || type.includes("primes")) {
            content = InternalBountyGenerator.generateHTML(name, type, district, size, region, city, this.namesData, this.bountiesData, biome, stateId, govTags, ecoTags, vibeTags, originTags, traitTags, weather, timeTags, currency, factionsStr);
        }
        else if (type === "gouvernance" || type.includes("gouvernance")) {
            content = InternalGovernanceGenerator.generateHTML(district, size, region, city, leaderName, leaderTitle, govTags, this.govBuildingsData);
        }
        else {
            const lblType = game.i18n.localize("CITYFORGE.Narrative.Type");
            const lblLoc = game.i18n.localize("CITYFORGE.Narrative.Location");
            const lblDesc = game.i18n.localize("CITYFORGE.Narrative.DescInProgress");
            content = `
                <div style="font-family: var(--font-primary);">
                    <h2 style="color: #27ae60; border-bottom: 2px solid #27ae60;">${name}</h2>
                    <p><strong>${lblType}</strong> ${type.toUpperCase()}</p>
                    <p><strong>${lblLoc}</strong> ${district}</p>
                    <hr>
                    <p style="color: #7f8c8d; font-style: italic;">${lblDesc}</p>
                </div>
            `;
        }

        const entry = await JournalEntry.create({
            name: name,
            pages: [{
                name: game.i18n.localize("CITYFORGE.Narrative.PoiDetails"),
                type: "text",
                text: { content: content, format: 1 }
            }]
        });

        await entry.setFlag("ultimateforge", "poiData", {
            type: type,
            district: district,
            parentHexId: this.targetedHexId
        });

        ui.notifications.info(game.i18n.format("CITYFORGE.Notifications.PoiDocumented", { name: name }));
        entry.sheet.render(true);
    }

    async _onSaveCityJournal(event) {
        event.preventDefault();
        if (!this.currentCityJournalData) return;

        const entry = await JournalEntry.create({
            name: this.currentCityJournalData.name,
            pages: [{
                name: game.i18n.localize("CITYFORGE.Narrative.OverviewHistory").split(' &')[0], // Raccourci pour l'onglet
                type: "text",
                text: { content: this.currentCityJournalData.content, format: 1 }
            }]
        });

        await entry.setFlag("ultimateforge", "cityData", this.currentCityJournalData.rawData);

        if (game.modules.get("ultimateforge")?.active && this.targetedHexId) {
            const currentHexData = canvas.scene.getFlag("ultimateforge", this.targetedHexId) || {};
            currentHexData.cityJournalId = entry.id;

            const rawData = this.currentCityJournalData.rawData;

            currentHexData.vibe_tags = rawData.vibeTags;
            currentHexData.eco_tags = rawData.ecoTags;
            await canvas.scene.setFlag("ultimateforge", this.targetedHexId, currentHexData);

            this._propagateAurasToMap(this.targetedHexId, rawData.vibeTags, rawData.ecoTags);

            ui.notifications.success(game.i18n.format("CITYFORGE.Notifications.CityArchivedMap", { name: this.currentCityJournalData.name }));
        } else {
            ui.notifications.success(game.i18n.format("CITYFORGE.Notifications.CityArchivedAuto", { name: this.currentCityJournalData.name }));
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
        const lang = String(game.i18n.lang).startsWith('en') ? 'en' : 'fr';

        let basePath = "modules/ultimateforge/data/default_fantasy";
        if (game.settings.settings.has("ultimateforge.activeThemePath")) {
            basePath = game.settings.get("ultimateforge", "activeThemePath");
            if (basePath.endsWith("/")) basePath = basePath.slice(0, -1);
        }

        const [
            namesData, tavernsData, shopsData, bountiesData, npcsData,
            regionData, statesData, themeSettings, isolatedData, decorsData, tagsDictRes
        ] = await Promise.all([
            fetch(`${basePath}/names.json`).then(r => r.json()).catch(() => ({})),
            fetch(`${basePath}/taverns.json`).then(r => r.json()).catch(() => ({})),
            fetch(`${basePath}/shops_loot.json`).then(r => r.json()).catch(() => ({})),
            fetch(`${basePath}/bounties.json`).then(r => r.json()).catch(() => ({})),
            fetch(`${basePath}/npcs.json`).then(r => r.json()).catch(() => ({})),
            fetch(`${basePath}/regions-structure.json`).then(r => r.json()).catch(() => ({})),
            fetch(`${basePath}/regional_states.json`).then(r => r.json()).catch(() => ({})),
            fetch(`${basePath}/theme.json`).then(r => r.json()).catch(() => null),
            fetch(`${basePath}/isolated_places.json`).then(r => r.json()).catch(() => ({})),
            fetch(`${basePath}/jf_decors.json`).then(r => r.json()).catch(() => []),
            fetch(`${basePath}/tags_dictionary.json`).then(r => r.json()).catch(() => null)
        ]);

        const tagsDictData = tagsDictRes || { tags: {} };

        const getText = (item) => (typeof item === 'object') ? (item[lang] || item.fr || "") : (item || "");

        const hexData = canvas.scene.getFlag("ultimateforge", hexId) || {};
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

        // ==========================================
        // CORRECTION 1 : GESTION DES NOMS DES PNJ
        // ==========================================
        let leaderName = game.i18n.localize("CITYFORGE.Narrative.IsoOwner");
        let chars = namesData[safeRegionId]?.characters;
        
        // Si la région n'a pas de noms, on prend la première disponible
        if (!chars || !chars.first_names) {
            const fallbackRegion = Object.keys(namesData)[0];
            if (fallbackRegion) chars = namesData[fallbackRegion]?.characters;
        }

        if (chars && chars.first_names) {
            const sex = Math.random() > 0.5 ? 'm' : 'f';
            const firstNamesList = chars.first_names[sex];
            
            if (firstNamesList && firstNamesList.length > 0) {
                const rawFirstName = firstNamesList[Math.floor(Math.random() * firstNamesList.length)];
                let lastName = "";
                
                // On va chercher le nom de famille
                if (chars.last_names && chars.last_names.length > 0) {
                    const rawLastName = chars.last_names[Math.floor(Math.random() * chars.last_names.length)];
                    lastName = getText(rawLastName);
                    if (lastName.includes("{Lieu}")) lastName = lastName.replace("{Lieu}", ""); // Laisse vide pour éviter les répétitions bizarres
                }
                leaderName = getText(rawFirstName) + lastName;
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

        // Formatage des tags avec le dictionnaire
        const formatTags = (tagsArray) => {
            if (!tagsArray || tagsArray.length === 0) return "";
            return tagsArray.map(tag => {
                if (tagsDictData.tags && tagsDictData.tags[tag]) {
                    return tagsDictData.tags[tag][lang] || tagsDictData.tags[tag].fr || tag;
                }
                return tag.charAt(0).toUpperCase() + tag.slice(1).replace(/-/g, ' ');
            }).join(', ');
        };

        const isoLocText = game.i18n.format("CITYFORGE.Narrative.IsoLocationDesc", { biome: safeBiome, region: regionNameText });
        let auraText = vibeTags.length > 0 ? game.i18n.format("CITYFORGE.Narrative.IsoAura", { tags: formatTags(vibeTags) }) : "";
        let ecoTextDesc = ecoTags.length > 0 ? game.i18n.format("CITYFORGE.Narrative.IsoEco", { tags: formatTags(ecoTags) }) : "";
        const navTitle = game.i18n.localize("CITYFORGE.Narrative.IsoNavTitle");
        const navDesc = game.i18n.localize("CITYFORGE.Narrative.IsoNavDesc");
        const ctxTitle = game.i18n.localize("CITYFORGE.Narrative.CurrentContext");

        const npcData = InternalNpcGenerator.generate(leaderName, "Lieu Isolé / Autonomie totale", size, safeRegionId, settlementName, "Humain", npcsData, leaderTitle);

        // ==========================================
        // CORRECTION 2 : NETTOYAGE DU HTML / CSS
        // ==========================================
        const overviewHTML = `
            <div class="cf-window-content">
                
                <div class="cf-intro-box">
                    <h3 style="color: #2980b9; font-size: 2em; margin-bottom: 5px;"><i class="fas fa-home"></i> ${settlementName}</h3>
                    <div class="cf-narrative-box">
                        <p><em>${finalDescription}</em></p>
                        <p style="font-size: 0.9em; margin-top: 10px; color: #555;">${isoLocText}</p>
                    </div>
                </div>

                <div class="cf-box cf-vibe-box">
                    <p>${auraText} <br> ${ecoTextDesc}</p>
                </div>
                
                ${stateText ? `<div class="cf-state-box"><h4><i class="fas fa-exclamation-triangle"></i> ${ctxTitle}</h4><p>${stateText}</p></div>` : ''}

                <div class="cf-box cf-eco-box" style="margin-bottom: 20px;">
                    <h4><i class="fas fa-map-signs"></i> ${navTitle}</h4>
                    <p style="font-style: italic; margin:0;">${navDesc}</p>
                </div>
                
                ${npcData.html}
            </div>
        `;

        pages.push({ name: game.i18n.localize("CITYFORGE.Narrative.PageOverview"), type: "text", text: { content: overviewHTML, format: 1 } });

        let pageIndex = 2;
        for (const poi of recipe) {
            let poiName = poi.replace(/_/g, ' ');
            poiName = poiName.charAt(0).toUpperCase() + poiName.slice(1);
            let contentHTML = "";

            if (poi.includes("taverne")) {
                contentHTML = InternalTavernGenerator.generateHTML(poiName, poi, "Le Domaine", size, safeRegionId, settlementName, namesData, tavernsData, safeBiome, stateId, priceMult, currencySym, govTags, ecoTags, vibeTags, "");
            } else if (poi.includes("panneau") || poi.includes("primes")) {
                const weather = canvas.scene?.weather || "clear";

                let timeTags = ["jour"];
                const dl = canvas.scene?.environment?.darknessLevel || 0;
                if (dl >= 0.8) timeTags = ["nuit"];
                else if (dl >= 0.6) timeTags = ["crepuscule", "nuit"];
                else if (dl >= 0.4) timeTags = ["aube", "jour"];
                else if (dl > 0) timeTags = ["matin", "apresmidi", "jour"];
                else timeTags = ["midi", "jour"];

                contentHTML = InternalBountyGenerator.generateHTML(poiName, poi, "Le Domaine", size, safeRegionId, settlementName, namesData, bountiesData, safeBiome, stateId, govTags, ecoTags, vibeTags, ["isole"], [traitId], weather, timeTags, currencySym, "");
            } else {
                contentHTML = InternalShopGenerator.generateHTML(poiName, poi, "Le Domaine", size, safeRegionId, settlementName, namesData, shopsData, safeBiome, stateId, priceMult, currencySym);
            }

            pages.push({ name: `${pageIndex}. ${poiName}`, type: "text", text: { content: contentHTML, format: 1 } });
            pageIndex++;
        }

        const entry = await JournalEntry.create({ name: settlementName, pages: pages });
        await canvas.scene.setFlag("ultimateforge", hexId, { cityJournalId: entry.id });

        ui.notifications.success(game.i18n.format("CITYFORGE.Notifications.IsoGenDone", { name: settlementName }));
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
                const existingData = canvas.scene.getFlag("ultimateforge", hexId) || {};

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
                    flagUpdates[`flags.ultimateforge.${hexId}`] = {
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
        const lang = String(game.i18n.lang).startsWith('en') ? 'en' : 'fr';

        let basePath = "modules/ultimateforge/data/default_fantasy";
        if (game.settings.settings.has("ultimateforge.activeThemePath")) {
            basePath = game.settings.get("ultimateforge", "activeThemePath");
            if (basePath.endsWith("/")) basePath = basePath.slice(0, -1);
        }

        const [namesData, tavernsData, bountiesData, statesData, themeSettings] = await Promise.all([
            fetch(`${basePath}/names.json`).then(r => r.json()).catch(() => ({})),
            fetch(`${basePath}/taverns.json`).then(r => r.json()).catch(() => ({})),
            fetch(`${basePath}/bounties.json`).then(r => r.json()).catch(() => ({})),
            fetch(`${basePath}/regional_states.json`).then(r => r.json()).catch(() => ({})),
            fetch(`${basePath}/theme.json`).then(r => r.json()).catch(() => null)
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
            if (page.name.includes(game.i18n.localize("CITYFORGE.Narrative.OverviewHistory").split(' &')[0])) {
                mainUpdates.push({ _id: page.id, "text.content": journalData.content });
                nbUpdated++;
            }
        }
        if (mainUpdates.length > 0) {
            await journal.updateEmbeddedDocuments("JournalEntryPage", mainUpdates);
            await journal.setFlag("ultimateforge", "cityData", cityData);
        }

        const allJournals = game.journal.contents;
        const linkedJournals = allJournals.filter(j => {
            const poiData = j.getFlag("ultimateforge", "poiData");
            if (poiData && poiData.parentHexId === hexId) return true;
            if (j.name.includes(`(${cityData.settlementName})`)) return true;
            return false;
        });

        for (const poiJournal of linkedJournals) {
            const poiUpdates = [];
            const poiData = poiJournal.getFlag("ultimateforge", "poiData") || {};
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
                    const weather = canvas.scene?.environment?.weather || "clear";
                    content = InternalTavernGenerator.generateHTML(cleanName, type, district, cityData.size, cityData.regionId, cityData.settlementName, namesData, tavernsData, cityData.biome, cityData.stateId, priceMult, currencySym, cityData.govTags, cityData.ecoTags, cityData.vibeTags, factionsStr);
                    pageUpdated = true;
                } else if (type.includes("panneau") || type.includes("primes")) {
                    const weather = canvas.scene?.environment?.weather || "clear";

                    let timeTags = ["jour"];
                    const dl = canvas.scene?.environment?.darknessLevel || 0;
                    if (dl >= 0.8) timeTags = ["nuit"];
                    else if (dl >= 0.6) timeTags = ["crepuscule", "nuit"];
                    else if (dl >= 0.4) timeTags = ["aube", "jour"];
                    else if (dl > 0) timeTags = ["matin", "apresmidi", "jour"];
                    else timeTags = ["midi", "jour"];

                    const originTags = cityData.originTags || [];
                    const traitTags = cityData.traitTags || [];
                    content = InternalBountyGenerator.generateHTML(cleanName, "panneau_annonces", district, cityData.size, cityData.regionId, cityData.settlementName, namesData, bountiesData, cityData.biome, cityData.stateId, cityData.govTags, cityData.ecoTags, cityData.vibeTags, originTags, traitTags, weather, timeTags, currencySym, factionsStr);
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
            ui.notifications.success(game.i18n.format("CITYFORGE.Notifications.UpdateSuccess", { count: nbUpdated }));
        }
    }

}