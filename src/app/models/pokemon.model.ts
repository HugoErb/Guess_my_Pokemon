export interface Pokemon {
  id: number;
  name: string;
  types: string[];
  generation: number;
  category: 'normal' | 'starter' | 'legendaire' | 'fabuleux';
  evolution_stage: 1 | 2 | 3 | null;
  sprite: string;
  stats: {
    pv: number;
    attaque: number;
    defense: number;
    atq_spe: number;
    def_spe: number;
    vitesse: number;
  };
  abilities: string[];
  height: number;
  weight: number;
  description: string;
}
