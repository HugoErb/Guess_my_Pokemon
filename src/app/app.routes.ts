import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: '/home', pathMatch: 'full' },
  { path: 'login', loadComponent: () => import('./pages/login/login.component').then(m => m.LoginComponent) },
  { path: 'home', loadComponent: () => import('./pages/home/home.component').then(m => m.HomeComponent), canActivate: [authGuard] },
  { path: 'invite/:roomId', loadComponent: () => import('./pages/invite/invite.component').then(m => m.InviteComponent), canActivate: [authGuard] },
  { path: 'lobby/:roomId', loadComponent: () => import('./pages/lobby/lobby.component').then(m => m.LobbyComponent), canActivate: [authGuard] },
  { path: 'game/:roomId', loadComponent: () => import('./pages/game/game.component').then(m => m.GameComponent), canActivate: [authGuard] },
  { path: 'reset-password', loadComponent: () => import('./pages/reset-password/reset-password.component').then(m => m.ResetPasswordComponent) },
  { path: '**', redirectTo: '/login' }
];
