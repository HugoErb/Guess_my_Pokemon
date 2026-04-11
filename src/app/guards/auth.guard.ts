import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map, take } from 'rxjs/operators';
import { SupabaseService } from '../services/supabase.service';

export const authGuard: CanActivateFn = (route, state) => {
  const supabaseService = inject(SupabaseService);
  const router = inject(Router);

  return supabaseService.authReady$.pipe(
    take(1),
    map(user => {
      if (user) return true;
      // Sauvegarder l'URL de destination pour rediriger après login
      return router.createUrlTree(['/login'], {
        queryParams: { redirect: state.url }
      });
    })
  );
};
