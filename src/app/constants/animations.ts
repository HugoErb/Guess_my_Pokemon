import { trigger, state, transition, style, animate, query, group, keyframes, stagger } from '@angular/animations';

/**
 * Animation pour les modales (entrée et sortie)
 */
export const modalAnimation = trigger('modalAnimation', [
  transition(':enter', [
    group([
      // Animation du backdrop (le div parent)
      style({ opacity: 0 }),
      animate('250ms ease-out', style({ opacity: 1 })),
      
      // Animation du contenu (le div enfant)
      query('.modal-content', [
        style({ opacity: 0, transform: 'scale(0.9) translateY(20px)' }),
        animate('300ms cubic-bezier(0.34, 1.56, 0.64, 1)', 
          style({ opacity: 1, transform: 'scale(1) translateY(0)' })
        )
      ], { optional: true })
    ])
  ]),
  transition(':leave', [
    group([
      // Animation du backdrop
      animate('150ms ease-in', style({ opacity: 0 })),

      // Animation du contenu
      query('.modal-content', [
        animate('150ms ease-in',
          style({ opacity: 0, transform: 'scale(0.95) translateY(10px)' })
        )
      ], { optional: true })
    ])
  ])
]);

// ─── Team Builder : apparition initiale des 6 slots en stagger ───────────────
export const slotsGridAnimation = trigger('slotsGrid', [
  transition(':enter', [
    query(':enter', [
      style({ opacity: 0, transform: 'translateY(28px) scale(0.92)' }),
      stagger(80, [
        animate('380ms cubic-bezier(0.34, 1.56, 0.64, 1)',
          style({ opacity: 1, transform: 'translateY(0) scale(1)' })
        )
      ])
    ], { optional: true })
  ])
]);

// ─── Team Builder : animation d'état par slot (leaving → entering) ────────────
export const slotStateAnimation = trigger('slotState', [
  state('leaving', style({ opacity: 0, transform: 'translateY(-14px) scale(0.88)' })),
  transition('* => leaving', [
    animate('260ms cubic-bezier(0.4, 0, 1, 1)',
      style({ opacity: 0, transform: 'translateY(-14px) scale(0.88)' })
    )
  ]),
  transition('leaving => entering', [
    style({ opacity: 0, transform: 'translateY(22px) scale(0.90)' }),
    animate('360ms cubic-bezier(0.34, 1.56, 0.64, 1)',
      style({ opacity: 1, transform: 'translateY(0) scale(1)' })
    )
  ])
]);

// ─── Team Builder : badge de verrouillage (zoom entrant) ─────────────────────
export const lockAnimation = trigger('lockEffect', [
  transition(':enter', [
    animate('380ms ease-out', keyframes([
      style({ opacity: 0, transform: 'scale(2.2)', offset: 0 }),
      style({ opacity: 1, transform: 'scale(0.88)', offset: 0.65 }),
      style({ opacity: 1, transform: 'scale(1)', offset: 1 })
    ]))
  ])
]);

// ─── Team Builder : révélation du score final ────────────────────────────────
export const scoreRevealAnimation = trigger('scoreReveal', [
  transition(':enter', [
    style({ opacity: 0, transform: 'scale(0.5)' }),
    animate('580ms cubic-bezier(0.34, 1.56, 0.64, 1)',
      style({ opacity: 1, transform: 'scale(1)' })
    )
  ])
]);
