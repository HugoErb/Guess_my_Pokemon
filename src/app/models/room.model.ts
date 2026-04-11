export type RoomStatus = 'waiting' | 'selecting' | 'playing' | 'finished';

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
}

export interface Profile {
  id: string;
  username: string;
  created_at: string;
}
