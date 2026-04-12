import { trigger, transition, style, animate, query, group } from '@angular/animations';

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
