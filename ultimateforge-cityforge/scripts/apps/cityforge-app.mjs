import { InternalTavernGenerator } from "./internal-tavern.mjs";
import { InternalNpcGenerator } from "./internal-npc.mjs";
import { InternalShopGenerator } from "./internal-shop.mjs";
import { InternalBountyGenerator } from "./internal-bounty.mjs";
import { InternalGovernanceGenerator } from "./internal-governance.mjs";

export class AvantisCityForgeApp extends Application {

    // NOUVEAU : On accepte un HexId en paramètre pour faire le lien avec la carte !
    constructor(options = {}, targetedHexId = null) {
        super(options);
        this.targetedHexId = targetedHexId; 
        this.loadedCityData = options.loadedCityData || null; // NOUVEAU : Réception de l'ADN !
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
        this.currentCityJournalData = null;
    }

    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: "avantis-cityforge",
            title: "Avantis CityForge",
            template: "modules/ultimateforge-cityforge/templates/cityforge-app.html",
            width: 850,
            height: 750,       
            resizable: true,   
            classes: ["avantis-window", "avantis-cityforge-app"]
        });
    }

    async _render(force, options) {
        try {
            let basePath = game.settings.get("ultimateforge-core", "activeThemePath");
            if (basePath.endsWith("/")) basePath = basePath.slice(0, -1);

            const themeRes = await fetch(`${basePath}/theme.json`).catch(() => null);
            this.themeSettings = themeRes ? await themeRes.json() : null;

            const regRes = await fetch(`${basePath}/regions-structure.json`);
            this.regionData = await regRes.json();
            
            const origRes = await fetch(`${basePath}/origins.json`);
            this.originsData = await origRes.json();

            const vitRes = await fetch(`${basePath}/vitality.json`);
            this.vitalityData = await vitRes.json();

            const tempRes = await fetch(`${basePath}/temperament.json`);
            this.temperamentData = await tempRes.json();

            const govRes = await fetch(`${basePath}/governance.json`);
            this.governanceData = await govRes.json();

            const ecoRes = await fetch(`${basePath}/economy.json`);
            this.economyData = await ecoRes.json();

            const distRes = await fetch(`${basePath}/districts.json`);
            this.districtsData = await distRes.json();

            const poiRes = await fetch(`${basePath}/poi_seeds.json`);
            this.poiSeedsData = await poiRes.json();

            const namesRes = await fetch(`${basePath}/names.json`);
            this.namesData = await namesRes.json();
            
            const shopsRes = await fetch(`${basePath}/shops_loot.json`);
            this.shopsData = await shopsRes.json();

            const rumRes = await fetch(`${basePath}/rumors.json`);
            this.rumorsData = await rumRes.json();

            const npcsRes = await fetch(`${basePath}/npcs.json`);
            this.npcsData = await npcsRes.json();

            const tavRes = await fetch(`${basePath}/taverns.json`);
            this.tavernsData = await tavRes.json();

            const bountiesRes = await fetch(`${basePath}/bounties.json`);
            this.bountiesData = await bountiesRes.json();

            const statesRes = await fetch(`${basePath}/regional_states.json`);
            this.statesData = await statesRes.json();

            const histRes = await fetch(`${basePath}/history.json`);
            this.historyData = await histRes.json();

            const govBuildRes = await fetch(`${basePath}/gov_buildings.json`);
            this.govBuildingsData = await govBuildRes.json();
            
        } catch (error) {
            console.error("CITYFORGE | Erreur de chargement des JSON pour ce thème :", error);
        }
        await super._render(force, options);
    }

    activateListeners(html) {
        super.activateListeners(html);
        const lang = game.i18n.lang.startsWith('en') ? 'en' : 'fr';

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

        // NOUVEAU : Si on a reçu l'ADN d'une ville (loadedCityData), on reconstruit l'interface !
        if (this.loadedCityData) {
            setTimeout(() => {
                html.find('#region-select').val(this.loadedCityData.regionId).trigger('change');
                html.find('#biome-select').val(this.loadedCityData.biome);
                html.find('#size-select').val(this.loadedCityData.size);
                html.find('#state-select').val(this.loadedCityData.stateId);
                
                this._rebuildCity(html); // Appel de la fonction de restauration
            }, 100);
        }
    }

    // NOUVEAU : Fonction qui restaure instantanément l'interface avec la mémoire
    _rebuildCity(html) {
        const data = this.loadedCityData;
        
        // Sécurité : Vérifie si la ville a été sauvegardée avec l'interface HTML
        if (!data.narrativeHTML) {
            ui.notifications.warn("CityForge | Veuillez cliquer sur 'Générer' puis 'Archiver' pour mettre cette ville à jour vers la V2.");
            return;
        }

        // Restauration de l'interface en 1 milliseconde
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
        ui.notifications.success(`CityForge | La cité ${data.settlementName} a été restaurée depuis la carte !`);
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
        let vibeTags = [];

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
            vibeTags = vibeTags.concat(randomTrait.output_tags || []);
        });
        
        const andWord = lang === 'en' ? 'and' : 'et';
        const vibeText = finalTraits.join(` <span style='color:#7b1e1e; font-weight:bold;'>${andWord}</span> `);
        const atmos = lang === 'en' 
            ? "The local ambiance is characterized by" 
            : "L'ambiance locale se distingue par";

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
            ecoTags = selectedEco.output_tags || [];
        }

       // --- PHASE 3 : QUARTIERS ---
        let numDistricts = 1;
        if (size === "Village") numDistricts = 2;
        if (size === "Petite Ville") numDistricts = 3;
        if (size === "Grande Cité") numDistricts = 4;
        if (size === "Métropole" || size === "Capitale") numDistricts = 5;

        let selectedDistricts = [];

        if (biome === "Rivage" || biome === "Aquatique") {
            const waterDistricts = this.districtsData.filter(d => 
                d.biome_tags && (d.biome_tags.includes("Rivage") || d.biome_tags.includes("Aquatique")) &&
                (!d.size_tags || d.size_tags.includes("all") || d.size_tags.includes(size))
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

        const shuffledDistricts = validDistricts.sort(() => 0.5 - Math.random());
        selectedDistricts = selectedDistricts.concat(shuffledDistricts.slice(0, Math.max(0, numDistricts)));

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
                    
                    poiHTML += `<span class="cf-poi-badge gen-poi-btn" data-type="${poi}" data-district="${distName}" data-size="${size}" data-region="${regionId}" data-city="${settlementName}" data-biome="${biome}" data-state="${stateId}" data-pricemult="${stateInfo ? stateInfo.price_multiplier : 1.0}" data-currency="${currencySym}" data-leadername="${leaderName}" data-leadertitle="${leaderTitle}" data-govtags="${govTags.join(',')}" data-ecotags="${ecoTags.join(',')}" data-vibetags="${vibeTags.join(',')}" title="Générer ce lieu"><i class="fas ${icon}"></i> <span style="text-transform: capitalize;">${label}</span></span>`;
                    
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

        // --- AFFICHAGE DE L'INTERFACE PRINCIPALE ---
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
        `;

        html.find('#res-narrative').html(narrativeHTML);
        html.find('#res-districts').html(districtsHTML);

        // --- LA MAGIE DE LA PERSISTANCE (ÉTAPE 1) ---
        const journalNarrativeHTML = narrativeHTML.replace(/<i class="fas fa-external-link-alt gen-leader-btn"[\s\S]*?<\/i>/g, '');

        this.currentCityJournalData = {
            name: settlementName,
            content: journalNarrativeHTML + journalDistrictsHTML,
            // NOUVEAU : On capture tout l'ADN de la ville !
            rawData: {
                regionId, stateId, biome, size, race,
                settlementName, leaderName, leaderTitle,
                originText, originTags,
                vitalityText,
                vibeText, vibeTags,
                govText, govTags,
                ecoText, ecoTags,
                districts: selectedDistricts,
                narrativeHTML: narrativeHTML, // NOUVEAU : Pour la persistance
                districtsHTML: districtsHTML  // NOUVEAU : Pour la persistance
            }
        };

        html.find('#watabou-btn').data('name', settlementName).data('size', size).data('biome', biome);
        html.find('#results-section').removeClass('hidden');
    }

    // ==========================================
    // FONCTIONS DE GÉNÉRATION DYNAMIQUE
    // ==========================================

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
                name: "Profil",
                type: "text",
                text: { content: npcData.html, format: 1 } 
            }]
        });
        entry.sheet.render(true);

        if (game.system.id === "avantis") {
            try {
                const valPVI = Math.floor(npcData.stats.pvi / 3) || 1;
                const valPVE = Math.floor(npcData.stats.pve / 3) || 1;

                const aptitudes = {
                    "force": { value: valPVE, label: "Force", meridien: "puissance" },
                    "intimidation": { value: valPVE, label: "Intimidation", meridien: "puissance" },
                    "magnetisme": { value: valPVE, label: "Magnétisme", meridien: "puissance" },
                    "vigueur": { value: valPVE, label: "Vigueur", meridien: "puissance" },
                    "agilite": { value: valPVE, label: "Agilité", meridien: "mouvement" },
                    "coordination": { value: valPVE, label: "Coordination", meridien: "mouvement" },
                    "finesse": { value: valPVE, label: "Finesse", meridien: "mouvement" },
                    "reflexe": { value: valPVE, label: "Réflexe", meridien: "mouvement" },
                    "adaptation": { value: valPVE, label: "Adaptation", meridien: "vitalite" },
                    "constitution": { value: valPVE, label: "Constitution", meridien: "vitalite" },
                    "regeneration": { value: valPVE, label: "Régénération", meridien: "vitalite" },
                    "resistance": { value: valPVE, label: "Résistance", meridien: "vitalite" },
                    "commandement": { value: valPVI, label: "Commandement", meridien: "domination" },
                    "logique": { value: valPVI, label: "Logique", meridien: "domination" },
                    "ruse": { value: valPVI, label: "Ruse", meridien: "domination" },
                    "volonte": { value: valPVI, label: "Volonté", meridien: "domination" },
                    "erudition": { value: valPVI, label: "Érudition", meridien: "savoir" },
                    "expertise": { value: valPVI, label: "Expertise", meridien: "savoir" },
                    "perception": { value: valPVI, label: "Perception", meridien: "savoir" },
                    "sagesse": { value: valPVI, label: "Sagesse", meridien: "savoir" },
                    "creativite": { value: valPVI, label: "Créativité", meridien: "expression" },
                    "empathie": { value: valPVI, label: "Empathie", meridien: "expression" },
                    "intuition": { value: valPVI, label: "Intuition", meridien: "expression" },
                    "persuasion": { value: valPVI, label: "Persuasion", meridien: "expression" }
                };

                const actorType = game.documentTypes.Actor.includes("pnj") ? "pnj" : "character";

                const actor = await Actor.create({
                    name: name,
                    type: actorType, 
                    img: "icons/svg/mystery-man.svg", 
                    system: {
                        meridiens: {
                            domination: { value: valPVI, label: "Domination" },
                            savoir: { value: valPVI, label: "Savoir" },
                            expression: { value: valPVI, label: "Expression" },
                            puissance: { value: valPVE, label: "Puissance" },
                            mouvement: { value: valPVE, label: "Mouvement" },
                            vitalite: { value: valPVE, label: "Vitalité" }
                        },
                        aptitudes: aptitudes,
                        pointsMaitrise: { value: 0, max: 10 },
                        pvi: { value: npcData.stats.pvi, max: npcData.stats.pvi },
                        pve: { value: npcData.stats.pve, max: npcData.stats.pve },
                        personnalite: { biographie: { histoire: npcData.textBio } }
                    }
                });

                const itemsToCreate = [];

                const parseItem = (text, type) => {
                    if (!text || text === "(Aucune)") return null;
                    const match = text.match(/^(.*?) \(.*Qualité (\d+)\)$/);
                    const itemName = match ? match[1] : text;
                    const quality = match ? parseInt(match[2]) : 0;
                    
                    let img = "icons/svg/item-bag.svg";
                    if (type === "arme") {
                        if (itemName.toLowerCase().includes("arc")) img = "icons/weapons/bows/shortbow.webp";
                        else if (itemName.toLowerCase().includes("dague")) img = "icons/weapons/daggers/dagger.webp";
                        else img = "icons/weapons/swords/sword-iron.webp";
                    }
                    if (type === "protection") img = "icons/svg/shield.svg";

                    return {
                        name: itemName,
                        type: type, 
                        img: img,
                        system: {
                            description: text,
                            qualite: quality,
                            equipe: true 
                        }
                    };
                };

                const weapon = parseItem(npcData.stats.weapon, "arme");
                if (weapon) itemsToCreate.push(weapon);

                const armor = parseItem(npcData.stats.armor, "protection");
                if (armor) itemsToCreate.push(armor);

                if (npcData.stats.loot && npcData.stats.loot !== "(Aucun)") {
                    itemsToCreate.push({
                        name: npcData.stats.loot,
                        type: "objet",
                        img: "icons/svg/chest.svg",
                        system: { 
                            description: "Butin généré.",
                            equipe: false,
                            quantite: 1
                        }
                    });
                }

                if (itemsToCreate.length > 0) {
                    await actor.createEmbeddedDocuments("Item", itemsToCreate);
                }
                
                ui.notifications.success(`L'Acteur ${name} a été généré avec son inventaire complet !`);
                actor.sheet.render(true);

            } catch (error) {
                console.warn("CITYFORGE | Création de l'acteur Avantis échouée :", error);
            }
        } else {
            ui.notifications.info(`Journal généré. (Création d'Acteur ignorée car le système n'est pas Avantis)`);
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
        const currency = btn.dataset.currency || "P";
        
        const leaderName = btn.dataset.leadername;
        const leaderTitle = btn.dataset.leadertitle;
        const govTags = btn.dataset.govtags ? btn.dataset.govtags.split(',') : [];

        if (!name) {
            const typeLabel = type.replace(/_/g, ' ');
            const capitalizedType = typeLabel.charAt(0).toUpperCase() + typeLabel.slice(1);
            name = `${capitalizedType} (${city})`;
        }

        let content = "";

        if (type.includes("taverne")) {
            const ecoTags = btn.dataset.ecotags ? btn.dataset.ecotags.split(',') : [];
            const vibeTags = btn.dataset.vibetags ? btn.dataset.vibetags.split(',') : [];
            content = InternalTavernGenerator.generateHTML(name, type, district, size, region, city, this.namesData, this.tavernsData, biome, stateId, priceMult, currency, govTags, ecoTags, vibeTags);
        }
        else if (type.includes("bazar") || type.includes("marchand") || type.includes("apothicaire") || type.includes("forge") || type.includes("armurerie") || type.includes("tailleur") || type.includes("tanneur") || type.includes("marche_noir") || type.includes("curiosite") || type.includes("librairie") || type.includes("graveur") || type.includes("archerie") || type.includes("cartographe") || type.includes("antiquaire") || type.includes("ecurie") || type.includes("menagerie") || type.includes("changeur_monnaie") || type.includes("joaillier")) {
            content = InternalShopGenerator.generateHTML(name, type, district, size, region, city, this.namesData, this.shopsData, biome, stateId, priceMult, currency);
        }
        else if (type.includes("panneau") || type.includes("doleance") || type.includes("primes")) {
            const ecoTags = btn.dataset.ecotags ? btn.dataset.ecotags.split(',') : [];
            const vibeTags = btn.dataset.vibetags ? btn.dataset.vibetags.split(',') : [];
            content = InternalBountyGenerator.generateHTML(name, type, district, size, region, city, this.namesData, this.bountiesData, biome, stateId, govTags, ecoTags, vibeTags, currency);
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

        ui.notifications.info(`Le lieu ${name} a été documenté !`);
        entry.sheet.render(true);
    }

    // --- NOUVEAU : LA FONCTION DE SAUVEGARDE AMÉLIORÉE ---
    async _onSaveCityJournal(event) {
        event.preventDefault();
        if (!this.currentCityJournalData) return;

        // 1. On crée le Journal classiquement
        const entry = await JournalEntry.create({
            name: this.currentCityJournalData.name,
            pages: [{
                name: "Vue d'ensemble",
                type: "text",
                text: { content: this.currentCityJournalData.content, format: 1 }
            }]
        });

        // 2. LA MAGIE : On sauvegarde l'ADN brut de la ville dans les "flags" du journal
        await entry.setFlag("ultimateforge-cityforge", "cityData", this.currentCityJournalData.rawData);

        // 3. LA ROBUSTESSE : On vérifie si HexForge est là ET si on a ciblé une case
        if (game.modules.get("ultimateforge-hexforge")?.active && this.targetedHexId) {
            
            // On récupère les données actuelles de la case (Biome, Trait, etc.)
            const currentHexData = canvas.scene.getFlag("ultimateforge-hexforge", this.targetedHexId) || {};
            
            // On ajoute l'ID du journal à la case !
            currentHexData.cityJournalId = entry.id; 
            
            // On sauvegarde le tout dans la carte
            await canvas.scene.setFlag("ultimateforge-hexforge", this.targetedHexId, currentHexData);
            
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
}