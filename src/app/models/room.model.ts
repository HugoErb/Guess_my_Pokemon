export type RoomStatus = 'waiting' | 'ready' | 'selecting' | 'playing' | 'finished';

export type FirstPlayer = 'player1' | 'player2' | 'random';

export interface GameSettings {
  generations: number[];  // [] = toutes les générations
  noPokedex: boolean;     // cache tout sauf le nom
  noSearch: boolean;      // désactive les filtres avancés (garde la recherche par nom)
  firstPlayer: FirstPlayer; // qui joue en premier
}

export const DEFAULT_SETTINGS: GameSettings = {
  generations: [],
  noPokedex: false,
  noSearch: false,
  firstPlayer: 'random',
};

export interface Room {
  id: string;
  player1_id: string;
  player2_id: string | null;
  pokemon_p1: number | null;
  pokemon_p2: number | null;
  p1_ready: boolean;
  p2_ready: boolean;
  current_turn: string | null;
  status: RoomStatus;
  winner_id: string | null;
  created_at: string;
  settings: GameSettings | null;
}

export type RoomPatch = Partial<Omit<Room, 'id' | 'created_at' | 'player1_id'>>;

export interface Profile {
  id: string;
  username: string;
  avatar_url?: string;
  created_at: string;
}
