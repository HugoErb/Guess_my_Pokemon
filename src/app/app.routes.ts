import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: '/home', pathMatch: 'full' },
  { path: 'login', loadComponent: () => import('./pages/login/login.component').then(m => m.LoginComponent) },
  { path: 'home', loadComponent: () => import('./pages/home/home.component').then(m => m.HomeComponent) },
  { path: 'invite/:roomId', loadComponent: () => import('./pages/invite/invite.component').then(m => m.InviteComponent) },
  { path: 'lobby/:roomId', loadComponent: () => import('./pages/lobby/lobby.component').then(m => m.LobbyComponent) },
  { path: 'game/:roomId', loadComponent: () => import('./pages/game/game.component').then(m => m.GameComponent) },
  { path: '**', redirectTo: '/home' }
];
