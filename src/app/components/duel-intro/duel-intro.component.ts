import { Component, input, output, OnInit, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';

@Component({
	selector: 'app-duel-intro',
	standalone: true,
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
	templateUrl: './duel-intro.component.html',
	styles: [`
		/* Overlay : fade in puis fade out */
		.duel-overlay {
			animation:
				duelIn  200ms ease-out          forwards,
				duelOut 300ms ease-in    2200ms  forwards;
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
		/* Épées : animation miroir parfaite — la droite est scaleX(-1) de la gauche */
		@keyframes swordLeft {
			from { transform: translateX(-140px) rotate(-45deg); opacity: 0; }
			88%  { transform: translateX(16px)   rotate(4deg);   opacity: 1; }
			to   { transform: translateX(5px)   rotate(0deg);   opacity: 1; }
		}
		@keyframes swordRight {
			from { transform: translateX(140px)  rotate(45deg);  opacity: 0; }
			88%  { transform: translateX(-16px)  rotate(-4deg);  opacity: 1; }
			to   { transform: translateX(-5px)  rotate(0deg);   opacity: 1; }
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
		setTimeout(() => this.closed.emit(), 2500);
	}
}
