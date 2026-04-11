/**
 * scripts/fetch-pokemon.js
 *
 * Récupère les données des 1025 premiers Pokémon depuis PokéAPI
 * et génère src/assets/pokemon.json.
 *
 * Usage : node scripts/fetch-pokemon.js
 * Prérequis : Node 18+ (fetch natif)
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = join(__dirname, '..', 'src', 'assets', 'pokemon.json');
const POKEAPI = 'https://pokeapi.co/api/v2';

const BATCH_SIZE = 20;
const BATCH_DELAY_MS = 500;
const RETRY_COUNT = 3;
const RETRY_DELAY_MS = 1000;

/** Mapping type anglais → français */
const TYPE_FR = {
  normal: 'Normal',
  fire: 'Feu',
  water: 'Eau',
  electric: 'Électrik', // Orthographe officielle des jeux Nintendo (pas "Électrique")
  grass: 'Plante',
  ice: 'Glace',
  fighting: 'Combat',
  poison: 'Poison',
  ground: 'Sol',
  flying: 'Vol',
  psychic: 'Psy',
  bug: 'Insecte',
  rock: 'Roche',
  ghost: 'Spectre',
  dragon: 'Dragon',
  dark: 'Ténèbres',
  steel: 'Acier',
  fairy: 'Fée',
};

/** IDs des Pokémon starters (toutes générations) */
const STARTER_IDS = new Set([
  1,   4,   7,   // Gen 1
  152, 155, 158, // Gen 2
  252, 255, 258, // Gen 3
  387, 390, 393, // Gen 4
  495, 498, 501, // Gen 5
  650, 653, 656, // Gen 6
  722, 725, 728, // Gen 7
  810, 813, 816, // Gen 8
  906, 909, 912, // Gen 9
]);

/** Chiffres romains de génération → numéro */
const GENERATION_MAP = {
  'generation-i':    1,
  'generation-ii':   2,
  'generation-iii':  3,
  'generation-iv':   4,
  'generation-v':    5,
  'generation-vi':   6,
  'generation-vii':  7,
  'generation-viii': 8,
  'generation-ix':   9,
};

// ---------------------------------------------------------------------------
// Helpers réseau
// ---------------------------------------------------------------------------

/**
 * Fetch avec retry automatique (3 tentatives, délai 1s entre chaque).
 * @param {string} url
 * @returns {Promise<any>} JSON parsé
 */
async function fetchWithRetry(url) {
  let lastError;
  for (let attempt = 1; attempt <= RETRY_COUNT; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} pour ${url}`);
      }
      return await res.json();
    } catch (err) {
      lastError = err;
      if (attempt < RETRY_COUNT) {
        await sleep(RETRY_DELAY_MS * attempt);  // backoff exponentiel : 1s, 2s, 3s
      }
    }
  }
  throw lastError;
}

/** Pause en millisecondes */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Helpers de mapping
// ---------------------------------------------------------------------------

/**
 * Extrait le nom FR depuis un tableau de noms PokéAPI.
 * Fallback sur la valeur anglaise si introuvable.
 * @param {Array<{language:{name:string}, name:string}>} names
 * @param {string} fallback
 * @returns {string}
 */
function getNameFr(names, fallback) {
  const fr = names.find((n) => n.language.name === 'fr');
  if (fr) return fr.name;
  const en = names.find((n) => n.language.name === 'en');
  return en ? en.name : fallback;
}

/**
 * Extrait le numéro de génération depuis l'URL de génération.
 * Ex : ".../generation-i" → 1
 * @param {string} generationUrl
 * @returns {number}
 */
function extractGeneration(generationUrl) {
  const segments = generationUrl.replace(/\/$/, '').split('/');
  const key = segments[segments.length - 1];
  return GENERATION_MAP[key] ?? 0;
}

/**
 * Détermine la catégorie du Pokémon.
 * Priorité : legendaire > fabuleux > starter > normal
 * @param {object} species Données de l'espèce PokéAPI
 * @param {number} id
 * @returns {'legendaire'|'fabuleux'|'starter'|'normal'}
 */
function getCategory(species, id) {
  if (species.is_legendary) return 'legendaire';
  if (species.is_mythical)  return 'fabuleux';
  if (STARTER_IDS.has(id))  return 'starter';
  return 'normal';
}

/**
 * Détermine le stade d'évolution.
 *
 * Algorithme :
 *  - Si evolves_from_species est non-null :
 *    - Récupère l'espèce parente pour voir si elle-même évolue → stade 3
 *    - Sinon → stade 2
 *  - Sinon (stade 1 potentiel) :
 *    - Fetch la chaîne d'évolution pour voir si chain.evolves_to.length > 0
 *    - Oui → stade 1 / Non → null (pas d'évolution)
 *
 * @param {object} species Données de l'espèce PokéAPI
 * @returns {Promise<number|null>}
 */
async function getEvolutionStage(species) {
  if (species.evolves_from_species !== null) {
    // Ce Pokémon évolue depuis quelqu'un → au moins stade 2
    try {
      const parentSpecies = await fetchWithRetry(species.evolves_from_species.url);
      // Si le parent évolue lui-même depuis quelqu'un, ce Pokémon est au stade 3
      return parentSpecies.evolves_from_species !== null ? 3 : 2;
    } catch {
      // En cas d'erreur, on suppose stade 2
      return 2;
    }
  }

  // Ce Pokémon est le premier de sa ligne → stade 1 ou pas d'évolution
  try {
    const chain = await fetchWithRetry(species.evolution_chain.url);
    const hasEvolutions = chain.chain.evolves_to.length > 0;
    return hasEvolutions ? 1 : null;
  } catch {
    // En cas d'erreur, on renvoie stade 1 par défaut
    return 1;
  }
}

/**
 * Mappe les stats PokéAPI vers les clés françaises.
 * @param {Array<{stat:{name:string}, base_stat:number}>} stats
 * @returns {object}
 */
function mapStats(stats) {
  const STAT_MAP = {
    hp:               'pv',
    attack:           'attaque',
    defense:          'defense',
    'special-attack': 'atq_spe',
    'special-defense':'def_spe',
    speed:            'vitesse',
  };
  const result = {};
  for (const entry of stats) {
    const key = STAT_MAP[entry.stat.name];
    if (key) result[key] = entry.base_stat;
  }
  return result;
}

/**
 * Extrait la première description FR (ou EN en fallback) depuis flavor_text_entries.
 * @param {Array<{flavor_text:string, language:{name:string}}>} entries
 * @returns {string}
 */
function getDescription(entries) {
  const clean = (text) =>
    text.replace(/[\n\f\r]+/g, ' ').replace(/\s{2,}/g, ' ').trim();

  const fr = entries.find((e) => e.language.name === 'fr');
  if (fr) return clean(fr.flavor_text);

  const en = entries.find((e) => e.language.name === 'en');
  if (en) return clean(en.flavor_text);

  return '';
}

// ---------------------------------------------------------------------------
// Traitement d'un Pokémon
// ---------------------------------------------------------------------------

/**
 * Récupère et assemble toutes les données d'un Pokémon.
 * @param {number} id
 * @param {number} index Position dans la liste (pour le log)
 * @param {number} total
 * @returns {Promise<object|null>} Objet Pokémon ou null en cas d'échec
 */
async function processPokemon(id, index, total) {
  try {
    // Fetch Pokémon + espèce en parallèle
    const [pokemon, species] = await Promise.all([
      fetchWithRetry(`${POKEAPI}/pokemon/${id}`),
      fetchWithRetry(`${POKEAPI}/pokemon-species/${id}`),
    ]);

    // Abilities : fetch en parallèle
    const abilityData = await Promise.all(
      pokemon.abilities.map((a) =>
        fetchWithRetry(`${POKEAPI}/ability/${a.ability.name}`)
      )
    );

    // Stade d'évolution
    const evolutionStage = await getEvolutionStage(species);

    // Nom FR
    const name = getNameFr(species.names, pokemon.name);

    // Types FR
    const types = pokemon.types
      .sort((a, b) => a.slot - b.slot)
      .map((t) => TYPE_FR[t.type.name] ?? t.type.name);

    // Génération
    const generation = extractGeneration(species.generation.url);

    // Catégorie
    const category = getCategory(species, id);

    // Sprite
    const sprite = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;

    // Stats
    const stats = mapStats(pokemon.stats);

    // Abilities FR
    const abilities = abilityData.map((a) => getNameFr(a.names, a.name));

    // Taille & Poids
    const height = pokemon.height / 10;
    const weight = pokemon.weight / 10;

    // Description
    const description = getDescription(species.flavor_text_entries);

    return {
      id,
      name,
      types,
      generation,
      category,
      evolution_stage: evolutionStage,
      sprite,
      stats,
      abilities,
      height,
      weight,
      description,
    };
  } catch (err) {
    console.error(`  [ERREUR] Pokémon #${id} (${index}/${total}) : ${err.message}`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Traitement par batches
// ---------------------------------------------------------------------------

/**
 * Exécute un tableau de fonctions async par groupes de taille `batchSize`,
 * avec une pause entre chaque groupe.
 * @param {Array<() => Promise<any>>} tasks
 * @param {number} batchSize
 * @param {number} delayMs
 * @returns {Promise<any[]>}
 */
async function runInBatches(tasks, batchSize, delayMs) {
  const results = [];
  for (let i = 0; i < tasks.length; i += batchSize) {
    const batch = tasks.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map((fn) => fn()));
    results.push(...batchResults);
    if (i + batchSize < tasks.length) {
      await sleep(delayMs);
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// Point d'entrée
// ---------------------------------------------------------------------------

async function main() {
  console.log('=== Génération de pokemon.json ===\n');

  // 1. Récupère la liste des 1025 premiers Pokémon
  console.log('Récupération de la liste des Pokémon...');
  const listData = await fetchWithRetry(
    `${POKEAPI}/pokemon?limit=1025&offset=0`
  );
  const total = listData.results.length;
  console.log(`${total} Pokémon trouvés.\n`);

  // 2. Extrait les IDs depuis les URLs
  const pokemonIds = listData.results.map((p) => {
    const parts = p.url.replace(/\/$/, '').split('/');
    return parseInt(parts[parts.length - 1], 10);
  });

  // 3. Crée les tâches et les exécute par batches
  let processed = 0;
  const tasks = pokemonIds.map((id) => async () => {
    processed++;
    if (processed === 1 || processed % 100 === 0) {
      console.log(`Traitement ${processed}/${total}...`);
    }
    return processPokemon(id, processed, total);
  });

  const rawResults = await runInBatches(tasks, BATCH_SIZE, BATCH_DELAY_MS);

  // 4. Filtre les erreurs (null)
  const pokemonList = rawResults.filter(Boolean);
  const failedCount = total - pokemonList.length;

  // 5. Sauvegarde
  console.log('\nSauvegarde du fichier...');
  await mkdir(dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, JSON.stringify(pokemonList, null, 2), 'utf-8');

  // 6. Résumé
  console.log(`\n=== Terminé ===`);
  console.log(`Pokémon traités avec succès : ${pokemonList.length}/${total}`);
  if (failedCount > 0) {
    console.log(`Pokémon en erreur : ${failedCount}`);
  }
  console.log(`Fichier généré : ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error('Erreur fatale :', err);
  process.exit(1);
});
