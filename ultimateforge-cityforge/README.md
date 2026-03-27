# 🏰 Avantis CityForge

**Avantis CityForge** est un module de macro-génération urbaine pour Foundry VTT. Bien qu'il ait été conçu à l'origine pour l'univers post-apocalyptique d'**Avantis.World**, il est **universel** et fonctionne sur n'importe quel système de jeu (D&D5e, Pathfinder, etc.).

## 🌟 Fonctionnalités

CityForge ne se contente pas de tirer des noms au hasard. Il génère un écosystème logique grâce à une approche en "cascade" :
1. **L'Âme :** Tire l'origine du lieu, son âge et son ambiance selon le biome.
2. **Le Corps :** Déduit le type de gouvernance (selon l'ambiance) et l'économie (selon le biome et l'origine).
3. **La Structure :** Génère les quartiers et les points d'intérêts (Tavernes, Boutiques, Bâtiments officiels) en fonction de la taille de la ville et de son économie.
4. **L'Interactivité (Le Micro-détail) :** Un clic sur un bâtiment génère à la volée un *Journal Foundry* détaillé (Vendeurs, Menus de tavernes, Objets à vendre).

### ⚔️ Intégration Avantis.World
Si CityForge détecte qu'il est utilisé sur le système de jeu **Avantis**, il va encore plus loin :
* Génération et création automatique des **Fiches d'Acteur (PNJ)** avec leurs attributs, leurs jauges de PVI/PVE (calculés selon la puissance du lieu) et leur équipement.
* L'équipement, les armes, et le butin sont ajoutés physiquement dans l'inventaire du personnage, prêts à être utilisés !

## 🛠️ Installation

1. Copiez le dossier `avantis-cityforge` dans votre répertoire `Data/modules/` de Foundry VTT.
2. Lancez Foundry VTT, allez dans la gestion de votre Monde, et activez le module **Avantis CityForge**.
3. Dans la barre latérale, vous trouverez une icône pour lancer le générateur.

## ⚙️ Personnalisation (Pour les MJ)

Toute la base de données est accessible et modifiable ! Vous pouvez ajouter vos propres régions, noms, objets et tavernes en éditant les fichiers JSON situés dans `data/avantis/` :
* `names.json` : Base de noms et prénoms.
* `shops_loot.json` : Tables de loot et prix pour les boutiques.
* `districts.json` : Quartiers disponibles.