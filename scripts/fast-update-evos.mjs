import fs from 'fs';

/** Recupere une URL en reessayant automatiquement en cas d'echec. */
async function fetchWithRetry(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error("Status " + res.status);
      return await res.json();
    } catch(err) {
      if (i === retries - 1) throw err;
    }
  }
}

/** Analyse une chaine d'evolution pour retrouver la profondeur du Pokemon cible et la profondeur maximale. */
function analyzeChain(node, targetName, currentDepth = 1) {
  let myDepth = node.species.name === targetName || node.species.url.endsWith('/' + targetName + '/') ? currentDepth : -1;
  let maxDepth = currentDepth;
  for (const child of node.evolves_to) {
    const childResult = analyzeChain(child, targetName, currentDepth + 1);
    if (childResult.myDepth !== -1) myDepth = childResult.myDepth;
    if (childResult.maxDepth > maxDepth) maxDepth = childResult.maxDepth;
  }
  return { myDepth, maxDepth };
}

/** Execute des taches asynchrones par lots. */
async function runInBatches(tasks, batchSize) {
  const results = [];
  for (let i = 0; i < tasks.length; i += batchSize) {
    const batch = tasks.slice(i, i + batchSize);
    results.push(...await Promise.all(batch.map(fn => fn())));
  }
  return results;
}

/** Point d'entree du script. */
async function main() {
  const file = 'src/assets/pokemon.json';
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  const cache = {};
  
  let processed = 0;
  const tasks = data.map(p => async () => {
    try {
      const sp = await fetchWithRetry('https://pokeapi.co/api/v2/pokemon-species/' + p.id + '/');
      const chainUrl = sp.evolution_chain.url;
      
      let chainData;
      if (!cache[chainUrl]) {
        // Just in case of race condition, we await here safely since fetch is handled
        cache[chainUrl] = fetchWithRetry(chainUrl);
      }
      chainData = await cache[chainUrl];
      
      const result = analyzeChain(chainData.chain, sp.name);
      const stage = result.myDepth === -1 ? 1 : result.myDepth;
      p.evolution_stage = stage + '/' + result.maxDepth;
    } catch (e) {
      console.log('Error for', p.id, e.message);
      p.evolution_stage = '1/1';
    }
    processed++;
    if (processed % 100 === 0) console.log(`Processed ${processed}/${data.length}`);
  });

  console.log("Starting batch fetch...");
  await runInBatches(tasks, 50); // 50 parallel requests
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
  console.log("Done updating all evolution stages!");
}

main();
