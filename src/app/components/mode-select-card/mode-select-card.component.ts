import { Component, Input, Output, EventEmitter, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { NgClass } from '@angular/common';
import { ICONS } from '../../constants/icons';

type Accent = 'purple' | 'green' | 'yellow' | 'blue';

const ACCENT_CLASSES: Record<Accent, {
  border: string; shadow: string; bg: string;
  iconBorder: string; iconBgHover: string; text: string;
}> = {
  purple: { border: 'hover:border-purple-500', shadow: 'hover:shadow-purple-900/30', bg: 'bg-purple-600/20', iconBorder: 'border-purple-500/30', iconBgHover: 'group-hover:bg-purple-600/30', text: 'text-purple-300' },
  green:  { border: 'hover:border-green-500',  shadow: 'hover:shadow-green-900/30',  bg: 'bg-green-600/20',  iconBorder: 'border-green-500/30',  iconBgHover: 'group-hover:bg-green-600/30',  text: 'text-green-300'  },
  yellow: { border: 'hover:border-yellow-500', shadow: 'hover:shadow-yellow-900/30', bg: 'bg-yellow-600/20', iconBorder: 'border-yellow-500/30', iconBgHover: 'group-hover:bg-yellow-600/30', text: 'text-yellow-300' },
  blue:   { border: 'hover:border-blue-500',   shadow: 'hover:shadow-blue-900/30',   bg: 'bg-blue-600/20',   iconBorder: 'border-blue-500/30',   iconBgHover: 'group-hover:bg-blue-600/30',   text: 'text-blue-300'   },
};

@Component({
  selector: 'app-mode-select-card',
  standalone: true,
  imports: [NgClass],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  host: { class: 'flex flex-1' },
  template: `
    <button
      (click)="selected.emit()"
      [disabled]="disabled"
      class="w-full h-full group bg-slate-800 border border-slate-700 rounded-2xl p-10 flex flex-col items-center gap-6 transition-all hover:scale-105 hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed"
      [ngClass]="[accentClasses.border, accentClasses.shadow]"
    >
      <div
        class="w-20 h-20 rounded-xl border flex items-center justify-center transition-colors"
        [ngClass]="[accentClasses.bg, accentClasses.iconBorder, accentClasses.iconBgHover]"
      >
        @if (isLoading) {
          <iconify-icon [icon]="ICONS.loading" class="text-5xl animate-spin" [ngClass]="accentClasses.text"></iconify-icon>
        } @else {
          <iconify-icon [icon]="icon" class="text-5xl" [ngClass]="accentClasses.text"></iconify-icon>
        }
      </div>
      <div class="text-center">
        <h2 class="text-lg font-black text-white mb-2">{{ title }}</h2>
        <p class="text-sm text-slate-400">{{ description }}</p>
      </div>
    </button>
  `,
})
export class ModeSelectCardComponent {
  protected readonly ICONS = ICONS;

  @Input() title = '';
  @Input() description = '';
  @Input() icon = '';
  @Input() accent: Accent = 'purple';
  @Input() isLoading = false;
  @Input() disabled = false;

  @Output() selected = new EventEmitter<void>();

  get accentClasses() {
    return ACCENT_CLASSES[this.accent];
  }
}
