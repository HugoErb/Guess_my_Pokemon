import { Component, inject, OnInit, OnDestroy, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { NgClass } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { SupabaseService } from '../../services/supabase.service';
import { Subscription } from 'rxjs';
import { ICONS } from '../../constants/icons';

function passwordMatchValidator(group: AbstractControl): ValidationErrors | null {
  const password = group.get('password')?.value;
  const confirmPassword = group.get('confirmPassword')?.value;
  return password === confirmPassword ? null : { passwordMismatch: true };
}

@Component({
  selector: 'app-reset-password',
  imports: [NgClass, ReactiveFormsModule, RouterLink],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './reset-password.component.html',
})
export class ResetPasswordComponent implements OnInit, OnDestroy {
  protected readonly ICONS = ICONS;
  resetForm: FormGroup;
  errorMessage = '';
  infoMessage = '';
  isLoading = false;
  isReady = false; // true quand Supabase a établi la session PASSWORD_RECOVERY

  private readonly supabaseService = inject(SupabaseService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private authSub: Subscription | null = null;
  private timeoutId: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.resetForm = this.fb.group(
      {
        password: ['', [Validators.required, Validators.minLength(6)]],
        confirmPassword: ['', [Validators.required]],
      },
      { validators: passwordMatchValidator }
    );
  }

  ngOnInit(): void {
    // Supabase émet PASSWORD_RECOVERY quand le lien email est valide
    this.authSub = this.supabaseService.currentUser$.subscribe(user => {
      if (user) {
        this.isReady = true;
        if (this.timeoutId !== null) clearTimeout(this.timeoutId);
      }
    });

    // Timeout de sécurité : si pas de session après 5s, lien invalide
    this.timeoutId = setTimeout(() => {
      if (!this.isReady) {
        this.errorMessage = 'Lien invalide ou expiré. Demande un nouveau lien depuis la page de connexion.';
      }
    }, 5000);
  }

  ngOnDestroy(): void {
    this.authSub?.unsubscribe();
    if (this.timeoutId !== null) clearTimeout(this.timeoutId);
  }

  async onSubmit(): Promise<void> {
    if (this.resetForm.invalid || !this.isReady) return;
    this.isLoading = true;
    this.errorMessage = '';

    const { password } = this.resetForm.value;
    try {
      await this.supabaseService.updatePassword(password);
      this.infoMessage = 'Mot de passe mis à jour avec succès !';
      setTimeout(() => this.router.navigateByUrl('/login'), 2000);
    } catch (err: unknown) {
      this.errorMessage = err instanceof Error ? err.message : 'Une erreur est survenue.';
    } finally {
      this.isLoading = false;
    }
  }
}
