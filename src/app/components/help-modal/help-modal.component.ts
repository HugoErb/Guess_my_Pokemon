import { Component, input, output, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ICONS } from '../../constants/icons';
import { modalAnimation } from '../../constants/animations';

@Component({
	selector: 'app-help-modal',
	standalone: true,
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
	animations: [modalAnimation],
	template: `
		<div
			class="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
			(click)="close.emit()"
			[@modalAnimation]
		>
			<div
				class="bg-slate-800 border border-slate-600 rounded-2xl p-6 max-w-lg w-full shadow-2xl flex flex-col gap-5 modal-content max-h-[90vh] overflow-y-auto relative"
				(click)="$event.stopPropagation()"
			>
				<button (click)="close.emit()" class="absolute top-4 right-4 z-10 bg-slate-900/60 hover:bg-red-600 rounded-full w-8 h-8 flex items-center justify-center text-slate-300 hover:text-white transition-colors">
					<iconify-icon [icon]="ICONS.close" class="text-lg"></iconify-icon>
				</button>

				<!-- En-tête -->
				<div class="flex items-center gap-3">
					<div class="w-10 h-10 rounded-xl bg-cyan-600/20 flex items-center justify-center border border-cyan-500/30 shrink-0">
						<iconify-icon [icon]="ICONS.help" class="text-2xl text-cyan-400"></iconify-icon>
					</div>
					<div>
						<h2 class="text-lg font-bold text-white uppercase tracking-wider">Aide</h2>
						<p class="text-[10px] text-slate-500 font-bold uppercase tracking-[0.1em]">Règles du jeu et filtres du Pokédex</p>
					</div>
				</div>

				<!-- Règles du jeu -->
				<div class="space-y-3">
					<div class="flex items-center gap-3">
						<div class="flex-1 h-px bg-slate-700"></div>
						<span class="text-[10px] font-black text-slate-500 uppercase tracking-widest">Règles du jeu</span>
						<div class="flex-1 h-px bg-slate-700"></div>
					</div>

					<div class="bg-slate-900/50 border border-slate-700/50 rounded-xl p-4">
						<ol class="space-y-3 text-sm text-slate-300 list-none">
							<li class="flex gap-3">
								<span class="text-red-500 font-bold text-base leading-snug shrink-0">1.</span>
								<span>Chaque joueur choisit secrètement un Pokémon que son adversaire devra deviner.</span>
							</li>
							<li class="flex gap-3">
								<span class="text-red-500 font-bold text-base leading-snug shrink-0">2.</span>
								<span>À chaque tour, le joueur actif pose <strong class="text-white">une question à l'oral</strong> à son adversaire sur son Pokémon.</span>
							</li>
							<li class="flex gap-3">
								<span class="text-red-500 font-bold text-base leading-snug shrink-0">3.</span>
								<span>L'adversaire doit répondre <strong class="text-white">par oui ou par non</strong>, en disant la vérité.</span>
							</li>
							<li class="flex gap-3">
								<span class="text-red-500 font-bold text-base leading-snug shrink-0">4.</span>
								<span>Quand un joueur pense avoir trouvé, il tape le nom du Pokémon dans le champ de recherche pour tenter sa chance en appuyant sur le bouton "Deviner ce pokémon".</span>
							</li>
							<li class="flex gap-3">
								<span class="text-red-500 font-bold text-base leading-snug shrink-0">5.</span>
								<span>Le <strong class="text-white">premier à deviner</strong> le Pokémon de son adversaire remporte la partie !</span>
							</li>
						</ol>
					</div>
				</div>

				@if (showFilters()) {
					<div class="space-y-3">
						<!-- Séparateur filtres -->
						<div class="flex items-center gap-3">
							<div class="flex-1 h-px bg-slate-700"></div>
							<span class="text-[10px] font-black text-slate-500 uppercase tracking-widest">Filtres du Pokédex</span>
							<div class="flex-1 h-px bg-slate-700"></div>
						</div>

						<!-- Génération -->
						<div class="bg-slate-900/50 border border-slate-700/50 rounded-xl p-4 space-y-2">
							<div class="flex items-center gap-2">
								<span class="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-700 text-slate-200 border border-slate-600">Génération</span>
							</div>
							<p class="text-sm text-slate-300">
								Filtre les Pokémon par génération (1 à 9). Tous les boutons sont actifs par défaut. Cliquer sur un bouton
								désactive cette génération et masque ses Pokémon.
							</p>
							<div class="bg-slate-800 rounded-lg px-3 py-2 text-xs space-y-0.5">
								<div class="text-slate-400 font-bold mb-1">Exemple :</div>
								<div class="text-slate-300">Gén. 1 désactivée → Bulbizarre, Dracaufeu, Pikachu... sont masqués.</div>
							</div>
						</div>

						<!-- Stade d'évolution -->
						<div class="bg-slate-900/50 border border-slate-700/50 rounded-xl p-4 space-y-2">
							<div class="flex items-center gap-2">
								<span class="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-700 text-slate-200 border border-slate-600">Stade Évo.</span>
							</div>
							<p class="text-sm text-slate-300">
								Filtre par stade d'évolution.
								Stade 1 = formes de base,
								Stade 2 = premières évolutions,
								Stade 3 = deuxièmes évolutions.
							</p>
							<div class="bg-slate-800 rounded-lg px-3 py-2 text-xs space-y-0.5">
								<div class="text-slate-400 font-bold mb-2">Exemple :</div>
								<div class="flex gap-2 flex-col">
									<span class="text-slate-300">Stade 1 → <span class="text-white font-semibold">Salamèche</span></span>
									<span class="text-slate-300">Stade 2 → <span class="text-white font-semibold">Reptincel</span></span>
									<span class="text-slate-300">Stade 3 → <span class="text-white font-semibold">Dracaufeu</span></span>
								</div>
							</div>
						</div>

						<!-- Catégorie -->
						<div class="bg-slate-900/50 border border-slate-700/50 rounded-xl p-4 space-y-2">
							<div class="flex items-center gap-2">
								<span class="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-700 text-slate-200 border border-slate-600">Catégorie</span>
							</div>
							<p class="text-sm text-slate-300">Filtre par catégorie de Pokémon.</p>
							<div class="bg-slate-800 rounded-lg px-3 py-2 text-xs space-y-1">
								<div class="text-slate-400 font-bold mb-2">Catégories :</div>
								<div class="flex gap-2 flex-col">
									<div class="text-slate-300"><span class="text-white font-semibold">Classique</span> — Pokémon sans caractéristique spéciale</div>
									<div class="text-slate-300"><span class="text-white font-semibold">Starter</span> — Pokémon de départ (ex. Bulbizarre, Salamèche, Carapuce)</div>
									<div class="text-slate-300"><span class="text-white font-semibold">Légendaire</span> — ex. Mewtwo, Lugia</div>
									<div class="text-slate-300"><span class="text-white font-semibold">Fabuleux</span> — ex. Mew, Celebi</div>
								</div>
							</div>
						</div>

						<!-- Poids & Taille -->
						<div class="bg-slate-900/50 border border-slate-700/50 rounded-xl p-4 space-y-2">
							<div class="flex items-center gap-2">
								<span class="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-700 text-slate-200 border border-slate-600">Poids (KG)</span>
								<span class="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-700 text-slate-200 border border-slate-600">Taille (M)</span>
							</div>
							<p class="text-sm text-slate-300">
								Définit une plage min/max pour le poids en kilogrammes et la taille en mètres.
								<br />
								Les bornes sont inclusives (ex. Min "1KG" inclut les Pokémon à exactement 1kg). Laisser un champ vide signifie
								pas de limite de ce côté.
								<br />
								Les valeurs décimales sont acceptées avec un point (ex. <span class="font-mono text-slate-200">0.6</span> pour 600 g).
							</p>
							<div class="bg-slate-800 rounded-lg px-3 py-2 text-xs space-y-0.5">
								<div class="text-slate-400 font-bold mb-2">Exemples :</div>
								<div class="flex gap-2 flex-col text-slate-300">• Poids Min = 0.1 et Poids Max = 1 → Pokémon entre 0.1 et 1 kg inclus.</div>
								<div class="text-slate-300">• Taille Max = 6 → Pokémon mesurant au plus 6 m.</div>
							</div>
						</div>

						<!-- Stats -->
						<div class="bg-slate-900/50 border border-slate-700/50 rounded-xl p-4 space-y-2">
							<div class="flex items-center gap-2">
								<span class="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-700 text-slate-200 border border-slate-600">Filtrer les stats</span>
							</div>
							<p class="text-sm text-slate-300">
								Filtre les Pokémon selon leurs statistiques de base. Cliquer sur le bouton ouvre un panneau avec un min et un max pour chaque stat.
								Laisser un champ vide signifie pas de limite de ce côté.
							</p>
							<div class="bg-slate-800 rounded-lg px-3 py-2 text-xs space-y-0.5">
								<div class="text-slate-400 font-bold mb-2">Exemple :</div>
								<div class="text-slate-300">TOTAL Min = 600 → seuls les Pokémon ayant une somme de stats ≥ 600 sont affichés.</div>
							</div>
						</div>

						<!-- Séparateur -->
						<div class="flex items-center gap-3">
							<div class="flex-1 h-px bg-slate-700"></div>
							<span class="text-[10px] font-black text-slate-500 uppercase tracking-widest">Filtres de types</span>
							<div class="flex-1 h-px bg-slate-700"></div>
						</div>

						<!-- Types -->
						<div class="bg-slate-900/50 border border-slate-700/50 rounded-xl p-4 space-y-2">
							<div class="flex items-center gap-2">
								<span class="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-700 text-slate-200 border border-slate-600">Type</span>
							</div>
							<p class="text-sm text-slate-300">
								Les 18 types sont tous cochés par défaut. Décocher un type masque les Pokémon dont
								<em>tous</em> les types sont décochés.
							</p>
							<div class="bg-slate-800 rounded-lg px-3 py-2 text-xs space-y-1">
								<div class="text-slate-400 font-bold mb-2">Exemple avec le type "Feu" décoché :</div>
								<div><span class="text-slate-300">• Arcanin sera masqué car il n'est que de type "Feu"</span></div>
								<div>
									<span class="text-slate-300">
										• Dracaufeu sera affiché car il n'est pas que de type "Feu" mais aussi "Vol" (et le type "Vol" reste coché)
									</span>
								</div>
							</div>
						</div>

						<!-- Mono type -->
						<div class="bg-slate-900/50 border border-slate-700/50 rounded-xl p-4 space-y-2">
							<div class="flex items-center gap-2">
								<span class="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-700 text-slate-200 border border-slate-600">Mono type seulement</span>
							</div>
							<p class="text-sm text-slate-300">Affiche uniquement les Pokémon qui n'ont qu'<em>un seul type</em>.</p>
							<div class="bg-slate-800 rounded-lg px-3 py-2 text-xs space-y-1">
								<div class="text-slate-400 font-bold mb-1">Exemple :</div>
								<div class="flex gap-2 flex-col">
									<div><span class="text-slate-300">• Arcanin sera affiché car il n'est que de type "Feu"</span></div>
									<div><span class="text-slate-300">• Dracaufeu sera masqué car il est de type "Feu" et "Vol" (double type)</span></div>
								</div>
							</div>
						</div>

						<!-- Double type seulement -->
						<div class="bg-slate-900/50 border border-slate-700/50 rounded-xl p-4 space-y-2">
							<div class="flex items-center gap-2">
								<span class="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-700 text-slate-200 border border-slate-600">Double type seulement</span>
							</div>
							<p class="text-sm text-slate-300">
								Affiche uniquement les Pokémon à <em>deux types</em>. Un Pokémon est visible s'il possède
								<em>au moins un</em> de ses types parmi les types cochés.
							</p>
							<div class="bg-slate-800 rounded-lg px-3 py-2 text-xs space-y-1">
								<div class="text-slate-400 font-bold mb-2">Exemple avec "Feu coché, Vol décoché" :</div>
								<div><span class="text-slate-300">• Dracaufeu (Feu/Vol) sera affiché car il possède au moins un type coché (Feu)</span></div>
								<div><span class="text-slate-300">• Arcanin (Feu) sera masqué car il est mono type</span></div>
							</div>
						</div>

						<!-- Double type strict seulement -->
						<div class="bg-slate-900/50 border border-slate-700/50 rounded-xl p-4 space-y-2">
							<div class="flex items-center gap-2">
								<span class="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-700 text-slate-200 border border-slate-600">Double type strict seulement</span>
							</div>
							<p class="text-sm text-slate-300">
								Affiche uniquement les Pokémon à <em>deux types</em>, mais un Pokémon n'est visible que si
								<em>ses deux types</em> sont cochés.
							</p>
							<div class="bg-slate-800 rounded-lg px-3 py-2 text-xs space-y-1">
								<div class="text-slate-400 font-bold mb-2">Exemple avec "Feu coché, Vol décoché" :</div>
								<div><span class="text-slate-300">• Dracaufeu (Feu/Vol) sera masqué car Vol est décoché</span></div>
								<div class="text-slate-400 font-bold mt-2 mb-1">Exemple avec "Feu coché, Vol coché" :</div>
								<div><span class="text-slate-300">• Dracaufeu (Feu/Vol) sera affiché car ses deux types sont cochés</span></div>
							</div>
						</div>

						<!-- Note exclusive -->
						<div class="bg-amber-900/20 border border-amber-700/40 rounded-xl px-4 py-3 flex gap-2 items-start">
							<iconify-icon [icon]="ICONS.alert" class="text-amber-400 text-base shrink-0 mt-0.5"></iconify-icon>
							<p class="text-xs text-amber-300">
								Mono type, Double type seulement et Double type strict seulement sont mutuellement exclusifs :
								en activer un désactive automatiquement les deux autres.
							</p>
						</div>
					</div>
				}

				<button
					(click)="close.emit()"
					class="w-full py-3 bg-slate-700 hover:bg-slate-600 rounded-xl text-sm font-bold text-white transition-colors"
				>
					Fermer
				</button>
			</div>
		</div>
	`,
})
export class HelpModalComponent {
	showFilters = input<boolean>(true);
	close = output<void>();

	protected readonly ICONS = ICONS;
}
