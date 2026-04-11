import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';
import { Profile, Room } from '../models/room.model';

@Injectable({ providedIn: 'root' })
export class SupabaseService {
  private supabase: SupabaseClient;
  private userSubject = new BehaviorSubject<User | null>(null);

  currentUser$: Observable<User | null> = this.userSubject.asObservable();

  constructor() {
    this.supabase = createClient(environment.supabaseUrl, environment.supabaseAnonKey);

    // Initialise avec la session courante
    this.supabase.auth.getSession().then(({ data }) => {
      this.userSubject.next(data.session?.user ?? null);
    });

    // Écoute les changements d'état d'authentification
    this.supabase.auth.onAuthStateChange((_event, session) => {
      this.userSubject.next(session?.user ?? null);
    });
  }

  // ─── Auth ────────────────────────────────────────────────────────────────────

  async signUp(email: string, password: string, username: string): Promise<void> {
    const { data, error } = await this.supabase.auth.signUp({ email, password });
    if (error) throw error;

    const user = data.user;
    if (!user) throw new Error('Aucun utilisateur retourné après l\'inscription');

    const { error: profileError } = await this.supabase
      .from('profiles')
      .insert({ id: user.id, username });

    if (profileError) throw profileError;
  }

  async signIn(email: string, password: string): Promise<void> {
    const { error } = await this.supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }

  async signOut(): Promise<void> {
    const { error } = await this.supabase.auth.signOut();
    if (error) throw error;
  }

  // ─── Profil ──────────────────────────────────────────────────────────────────

  async getProfile(userId: string): Promise<Profile> {
    const { data, error } = await this.supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) throw error;
    return data as Profile;
  }

  // ─── Rooms ───────────────────────────────────────────────────────────────────

  async createRoom(): Promise<string> {
    const user = this.userSubject.getValue();
    if (!user) throw new Error('Utilisateur non connecté');

    const { data, error } = await this.supabase
      .from('rooms')
      .insert({ player1_id: user.id, status: 'waiting' })
      .select('id')
      .single();

    if (error) throw error;
    return (data as { id: string }).id;
  }

  async getRoomById(roomId: string): Promise<Room> {
    const { data, error } = await this.supabase
      .from('rooms')
      .select('*')
      .eq('id', roomId)
      .single();

    if (error) throw error;
    return data as Room;
  }

  async joinRoom(roomId: string): Promise<void> {
    const user = this.userSubject.getValue();
    if (!user) throw new Error('Utilisateur non connecté');

    const { error } = await this.supabase
      .from('rooms')
      .update({ player2_id: user.id, status: 'selecting' })
      .eq('id', roomId);

    if (error) throw error;
  }

  subscribeToRoom(roomId: string): Observable<Room> {
    return new Observable<Room>(observer => {
      const channel = this.supabase
        .channel(`room-${roomId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'rooms',
            filter: `id=eq.${roomId}`,
          },
          payload => {
            observer.next(payload.new as Room);
          }
        )
        .subscribe(status => {
          if (status === 'CHANNEL_ERROR') {
            observer.error(new Error(`Erreur de connexion au canal room-${roomId}`));
          }
        });

      // Cleanup : retirer le canal à la désinscription
      return () => {
        this.supabase.removeChannel(channel);
      };
    });
  }

  async updateRoom(roomId: string, patch: Partial<Room>): Promise<void> {
    const { error } = await this.supabase
      .from('rooms')
      .update(patch)
      .eq('id', roomId);

    if (error) throw error;
  }

  // ─── Utilitaire interne ──────────────────────────────────────────────────────

  getCurrentUser(): User | null {
    return this.userSubject.getValue();
  }
}
