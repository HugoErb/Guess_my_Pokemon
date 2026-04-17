import { Component, input, output, OnInit, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';

@Component({
	selector: 'app-duel-intro',
	standalone: true,
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
	template: `
		<div class="duel-overlay fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/95 px-4">

			<!-- Joueur 1 (gauche) -->
			<div class="player-left flex flex-col items-center gap-3 min-w-0">
				@if (player1().avatar_url) {
					<img [src]="player1().avatar_url" alt="" class="w-16 h-16 rounded-full object-cover border-2 border-red-500 shadow-lg shadow-red-500/30" />
				} @else {
					<div class="w-16 h-16 rounded-full bg-red-700 border-2 border-red-500 flex items-center justify-center text-2xl font-black text-white shadow-lg shadow-red-500/30">
						{{ player1().username.charAt(0).toUpperCase() }}
					</div>
				}
				<span class="text-sm font-bold text-white text-center max-w-[90px] truncate">{{ player1().username }}</span>
			</div>

			<!-- Zone centrale : épées + VS -->
			<div class="flex flex-col items-center gap-3 mx-6 md:mx-12 shrink-0">
				<div class="relative w-32 h-20 flex items-center justify-center">
					<!-- Épée gauche -->
					<div class="sword-left absolute inset-0 flex items-center justify-center">
						<iconify-icon icon="mdi:sword" style="font-size:2.8rem; color:#f87171; display:block;"></iconify-icon>
					</div>
					<!-- Flash d'impact au centre -->
					<div class="flash-burst absolute inset-0 flex items-center justify-center pointer-events-none">
						<div class="w-12 h-12 rounded-full bg-yellow-200" style="box-shadow: 0 0 32px 18px rgba(253,224,71,0.85);"></div>
					</div>
					<!-- Épée droite -->
					<div class="sword-right absolute inset-0 flex items-center justify-center">
						<iconify-icon icon="mdi:sword" style="font-size:2.8rem; color:#f87171; display:block;"></iconify-icon>
					</div>
				</div>
				<p class="vs-text text-2xl font-black text-yellow-400 tracking-widest uppercase italic">VS</p>
			</div>

			<!-- Joueur 2 (droite) -->
			<div class="player-right flex flex-col items-center gap-3 min-w-0">
				@if (player2().avatar_url) {
					<img [src]="player2().avatar_url" alt="" class="w-16 h-16 rounded-full object-cover border-2 border-blue-500 shadow-lg shadow-blue-500/30" />
				} @else {
					<div class="w-16 h-16 rounded-full bg-blue-700 border-2 border-blue-500 flex items-center justify-center text-2xl font-black text-white shadow-lg shadow-blue-500/30">
						{{ player2().username.charAt(0).toUpperCase() }}
					</div>
				}
				<span class="text-sm font-bold text-white text-center max-w-[90px] truncate">{{ player2().username }}</span>
			</div>
		</div>
	`,
	styles: [`
		/* Overlay : fade in puis fade out */
		.duel-overlay {
			animation:
				duelIn  200ms ease-out          forwards,
				duelOut 300ms ease-in    1700ms  forwards;
		}

		/* Joueurs : glissent depuis les côtés */
		.player-left  { animation: slideLeft  400ms cubic-bezier(0.2, 0, 0, 1) forwards; }
		.player-right { animation: slideRight 400ms cubic-bezier(0.2, 0, 0, 1) forwards; }

		/* Épées : rush rapide avec micro-overshoot pour l'impact */
		.sword-left  { animation: swordLeft  220ms cubic-bezier(0.2, 0, 0.1, 1.5) 420ms both; }
		.sword-right { animation: swordRight 220ms cubic-bezier(0.2, 0, 0.1, 1.5) 420ms both; }

		/* Flash d'impact (juste après l'impact des épées) */
		.flash-burst > div { animation: flashBurst 420ms ease-out 620ms both; }

		/* Texte VS */
		.vs-text { animation: duelIn 200ms ease-out 650ms both; }

		@keyframes duelIn {
			from { opacity: 0; }
			to   { opacity: 1; }
		}
		@keyframes duelOut {
			from { opacity: 1; }
			to   { opacity: 0; }
		}
		@keyframes slideLeft {
			from { transform: translateX(-120px); opacity: 0; }
			to   { transform: translateX(0);      opacity: 1; }
		}
		@keyframes slideRight {
			from { transform: translateX(120px); opacity: 0; }
			to   { transform: translateX(0);     opacity: 1; }
		}
		/* Épées : glissent ET tournent simultanément jusqu'à la diagonale */
		@keyframes swordLeft {
			from { transform: translateX(-140px) rotate(0deg);  opacity: 0; }
			88%  { transform: translateX(8px)    rotate(48deg); opacity: 1; }
			to   { transform: translateX(0)      rotate(45deg); opacity: 1; }
		}
		@keyframes swordRight {
			from { transform: translateX(140px)  rotate(0deg);   opacity: 0; }
			88%  { transform: translateX(-8px)   rotate(-48deg); opacity: 1; }
			to   { transform: translateX(0)      rotate(-45deg); opacity: 1; }
		}
		@keyframes flashBurst {
			0%   { transform: scale(0);   opacity: 0; }
			30%  { transform: scale(2.6); opacity: 1; }
			100% { transform: scale(1);   opacity: 0; }
		}
	`],
})
export class DuelIntroComponent implements OnInit {
	player1 = input.required<{ username: string; avatar_url?: string }>();
	player2 = input.required<{ username: string; avatar_url?: string }>();
	closed = output<void>();

	ngOnInit(): void {
		setTimeout(() => this.closed.emit(), 2000);
	}
}
