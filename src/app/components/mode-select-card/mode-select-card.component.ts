import { Component, Input, Output, EventEmitter, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { NgClass } from '@angular/common';
import { ICONS } from '../../constants/icons';

type Accent = 'purple' | 'green' | 'yellow' | 'blue' | 'red';

const ACCENT_CLASSES: Record<Accent, {
  border: string; shadow: string; bg: string;
  iconBorder: string; iconBgHover: string; text: string;
}> = {
  purple: { border: 'hover:border-purple-500', shadow: 'hover:shadow-purple-900/30', bg: 'bg-purple-600/20', iconBorder: 'border-purple-500/30', iconBgHover: 'group-hover:bg-purple-600/30', text: 'text-purple-300' },
  green:  { border: 'hover:border-green-500',  shadow: 'hover:shadow-green-900/30',  bg: 'bg-green-600/20',  iconBorder: 'border-green-500/30',  iconBgHover: 'group-hover:bg-green-600/30',  text: 'text-green-300'  },
  yellow: { border: 'hover:border-yellow-500', shadow: 'hover:shadow-yellow-900/30', bg: 'bg-yellow-600/20', iconBorder: 'border-yellow-500/30', iconBgHover: 'group-hover:bg-yellow-600/30', text: 'text-yellow-300' },
  blue:   { border: 'hover:border-blue-500',   shadow: 'hover:shadow-blue-900/30',   bg: 'bg-blue-600/20',   iconBorder: 'border-blue-500/30',   iconBgHover: 'group-hover:bg-blue-600/30',   text: 'text-blue-300'   },
  red:    { border: 'hover:border-red-500',    shadow: 'hover:shadow-red-900/30',    bg: 'bg-red-600/20',    iconBorder: 'border-red-500/30',    iconBgHover: 'group-hover:bg-red-600/30',    text: 'text-red-400'    },
};

@Component({
  selector: 'app-mode-select-card',
  standalone: true,
  imports: [NgClass],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  host: { class: 'flex flex-1', '[attr.title]': 'null' },
  template: `
    <button
      (click)="selected.emit()"
      [disabled]="disabled"
      class="w-full h-full group bg-slate-800 border border-slate-700 rounded-2xl transition-all hover:scale-105 hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed
             flex flex-row items-center gap-4 px-5 py-4
             sm:flex-col sm:gap-6 sm:p-10"
      [ngClass]="[accentClasses.border, accentClasses.shadow]"
    >
      <div
        class="w-12 h-12 rounded-xl border flex items-center justify-center transition-colors flex-shrink-0
               sm:w-20 sm:h-20"
        [ngClass]="[accentClasses.bg, accentClasses.iconBorder, accentClasses.iconBgHover]"
      >
        @if (isLoading) {
          <iconify-icon [icon]="ICONS.loading" class="text-2xl sm:text-5xl animate-spin" [ngClass]="accentClasses.text"></iconify-icon>
        } @else {
          <iconify-icon [icon]="icon" class="text-2xl sm:text-5xl" [ngClass]="accentClasses.text"></iconify-icon>
        }
      </div>
      <div class="text-left sm:text-center">
        <h2 class="text-base font-black text-white sm:text-lg sm:mb-2">{{ title }}</h2>
        <p class="text-xs sm:text-sm text-slate-400 mt-0.5 sm:mt-0">{{ description }}</p>
      </div>
    </button>
  `,
})
export class ModeSelectCardComponent {
  protected readonly ICONS = ICONS;

  @Input({ alias: 'cardTitle' }) title = '';
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
