import { Component, inject } from '@angular/core';
import { NgClass } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { SupabaseService } from '../../services/supabase.service';

function passwordMatchValidator(group: AbstractControl): ValidationErrors | null {
  const password = group.get('password')?.value;
  const confirmPassword = group.get('confirmPassword')?.value;
  return password === confirmPassword ? null : { passwordMismatch: true };
}

@Component({
  selector: 'app-login',
  imports: [NgClass, ReactiveFormsModule],
  templateUrl: './login.component.html',
})
export class LoginComponent {
  mode: 'login' | 'register' | 'forgot' = 'login';
  errorMessage = '';
  infoMessage = '';
  isLoading = false;

  loginForm: FormGroup;
  registerForm: FormGroup;
  forgotForm: FormGroup;

  private readonly supabaseService = inject(SupabaseService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);

  constructor() {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required]],
    });

    this.registerForm = this.fb.group(
      {
        email: ['', [Validators.required, Validators.email]],
        username: ['', [Validators.required, Validators.minLength(3)]],
        password: ['', [Validators.required, Validators.minLength(6)]],
        confirmPassword: ['', [Validators.required]],
      },
      { validators: passwordMatchValidator }
    );

    this.forgotForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
    });
  }

  setMode(mode: 'login' | 'register' | 'forgot'): void {
    this.mode = mode;
    this.errorMessage = '';
    this.infoMessage = '';
  }

  async onLogin(): Promise<void> {
    if (this.loginForm.invalid) return;
    this.isLoading = true;
    this.errorMessage = '';

    const { email, password } = this.loginForm.value;
    try {
      await this.supabaseService.signIn(email, password);
      const rawRedirect = this.route.snapshot.queryParams['redirect'];
      const redirect = rawRedirect?.startsWith('/') ? rawRedirect : '/home';
      this.router.navigateByUrl(redirect);
    } catch (err: unknown) {
      this.errorMessage = err instanceof Error ? err.message : 'Une erreur est survenue.';
    } finally {
      this.isLoading = false;
    }
  }

  async onRegister(): Promise<void> {
    if (this.registerForm.invalid) return;
    this.isLoading = true;
    this.errorMessage = '';

    const { email, username, password } = this.registerForm.value;
    try {
      await this.supabaseService.signUp(email, password, username);
      const rawRedirect = this.route.snapshot.queryParams['redirect'];
      const redirect = rawRedirect?.startsWith('/') ? rawRedirect : '/home';
      this.router.navigateByUrl(redirect);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Une erreur est survenue.';
      if (message.startsWith('Un email de confirmation')) {
        this.infoMessage = message;
      } else {
        this.errorMessage = message;
      }
    } finally {
      this.isLoading = false;
    }
  }

  async onForgotPassword(): Promise<void> {
    if (this.forgotForm.invalid) return;
    this.isLoading = true;
    this.errorMessage = '';

    const { email } = this.forgotForm.value;
    try {
      await this.supabaseService.resetPasswordForEmail(email);
      this.infoMessage = `Un lien de réinitialisation a été envoyé à ${email}. Vérifie ta boîte mail.`;
      this.forgotForm.reset();
    } catch (err: unknown) {
      this.errorMessage = err instanceof Error ? err.message : 'Une erreur est survenue.';
    } finally {
      this.isLoading = false;
    }
  }
}
