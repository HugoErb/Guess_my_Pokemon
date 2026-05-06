import { Pokemon } from '../models/pokemon.model';
import { computeDuoCoverageScore } from './draft-utils';

function pokemon(id: number, name: string, types: string[]): Pokemon {
  return {
    id,
    name,
    types,
    generation: 1,
    category: 'classique',
    evolution_stage: 'base',
    sprite: '',
    stats: { pv: 1, attaque: 1, defense: 1, atq_spe: 1, def_spe: 1, vitesse: 1 },
    height: 1,
    weight: 1,
    description: '',
  };
}

describe('computeDuoCoverageScore', () => {
  it('considere Arceus comme impossible a toucher en super efficace et super efficace contre tous les types', () => {
    const fightingPokemon = pokemon(68, 'Mackogneur', ['Combat']);
    const arceus = pokemon(493, 'Arceus', ['Normal']);

    expect(computeDuoCoverageScore([fightingPokemon], [arceus])).toBe(0);
    expect(computeDuoCoverageScore([arceus], [fightingPokemon])).toBe(10);
  });
});
