/**
 * scripts/add-ratings.js
 *
 * Calcule le champ `rating` (1.0–10.0) pour chaque Pokémon en fonction
 * du total de ses statistiques de base, puis réécrit src/assets/pokemon.json.
 *
 * Formule : rating = 1 + ((total - minTotal) / (maxTotal - minTotal)) * 9
 * Arrondi à 1 décimale.
 *
 * Usage : node scripts/add-ratings.js
 */

import fs from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = join(__dirname, '..', 'src', 'assets', 'pokemon.json');

function statTotal(pokemon) {
  const s = pokemon.stats;
  return s.pv + s.attaque + s.defense + s.atq_spe + s.def_spe + s.vitesse;
}

function main() {
  const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));

  const totals = data.map(statTotal);
  const minTotal = Math.min(...totals);
  const maxTotal = Math.max(...totals);

  console.log(`Total stats range: ${minTotal} – ${maxTotal}`);

  const updated = data.map(p => {
    const total = statTotal(p);
    const ratio = (total - minTotal) / (maxTotal - minTotal);
    const raw = 1 + Math.pow(ratio, 0.5) * 9;
    const rating = Math.round(raw * 10) / 10;
    return { ...p, rating };
  });

  fs.writeFileSync(FILE, JSON.stringify(updated, null, 2), 'utf8');
  console.log(`Done. ${updated.length} Pokémon mis à jour avec le champ rating.`);
}

main();
