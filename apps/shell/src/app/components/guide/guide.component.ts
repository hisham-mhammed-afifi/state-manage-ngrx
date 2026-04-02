import { Component, computed, input } from '@angular/core';
import { RouterModule } from '@angular/router';
import { MarkdownComponent } from 'ngx-markdown';

interface Chapter {
  slug: string;
  title: string;
  file: string;
}

const CHAPTERS: Chapter[] = [
  { slug: '01', title: '1. Architecture Thinking', file: '01-architecture-thinking.md' },
  { slug: '02', title: '2. Nx Workspace Design', file: '02-nx-workspace-design.md' },
  { slug: '03', title: '3. Module Federation & Shared State', file: '03-module-federation-and-shared-state.md' },
  { slug: '04', title: '4. NgRx Signal Store Deep Dive', file: '04-ngrx-signal-store-deep-dive.md' },
  { slug: '05', title: '5. NgRx Toolkit in Production', file: '05-ngrx-toolkit-in-production.md' },
  { slug: '06', title: '6. Store Patterns & Recipes', file: '06-store-patterns-and-recipes.md' },
  { slug: '07', title: '7. Testing State Libraries', file: '07-testing-state-libraries.md' },
  { slug: '08', title: '8. DevOps & Scaling', file: '08-devops-and-scaling.md' },
  { slug: '09', title: '9. Future Growth', file: '09-future-growth.md' },
];

@Component({
  selector: 'shell-guide',
  standalone: true,
  imports: [RouterModule, MarkdownComponent],
  styles: [`
    :host { display: flex; max-width: 1100px; margin: 0 auto; min-height: calc(100vh - 60px); }
    aside {
      width: 260px; flex-shrink: 0; padding: var(--space-6) var(--space-4);
      border-right: 1px solid var(--color-border);
      position: sticky; top: 0; align-self: flex-start; max-height: 100vh; overflow-y: auto;
    }
    aside h2 { font-size: var(--font-size-base); color: var(--color-navy); margin: 0 0 var(--space-4); text-transform: uppercase; letter-spacing: 0.05em; }
    .chapter-list { list-style: none; padding: 0; margin: 0; }
    .chapter-list li a {
      display: block; padding: 0.5rem 0.75rem; border-radius: var(--radius-md);
      text-decoration: none; color: var(--color-gray-500); font-size: var(--font-size-sm);
      transition: background var(--transition-fast), color var(--transition-fast);
    }
    .chapter-list li a:hover { background: var(--color-gray-50); color: var(--color-navy); }
    .chapter-list li a.active { background: var(--color-primary-light); color: var(--color-primary); font-weight: 600; }
    main { flex: 1; padding: var(--space-8); overflow-y: auto; min-width: 0; }

    /* Markdown content styling */
    main ::ng-deep h1 { font-size: 1.75rem; color: var(--color-navy); border-bottom: 2px solid var(--color-primary-light); padding-bottom: 0.5rem; }
    main ::ng-deep h2 { font-size: 1.35rem; color: var(--color-navy); margin-top: 2rem; }
    main ::ng-deep h3 { font-size: 1.1rem; color: #334155; }
    main ::ng-deep p { line-height: 1.7; color: #334155; }
    main ::ng-deep code:not([class*="language-"]) { background: var(--color-gray-50); padding: 0.15rem 0.4rem; border-radius: var(--radius-sm); font-size: 0.875em; color: var(--color-primary); }
    main ::ng-deep pre { border-radius: var(--radius-lg); margin: 1rem 0; overflow-x: auto; }
    main ::ng-deep table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
    main ::ng-deep th, main ::ng-deep td { border: 1px solid var(--color-border); padding: 0.5rem 0.75rem; text-align: left; }
    main ::ng-deep th { background: var(--color-gray-50); color: var(--color-navy); font-weight: 600; }
    main ::ng-deep blockquote { border-left: 4px solid var(--color-primary); margin: 1rem 0; padding: 0.5rem 1rem; background: var(--color-gray-50); color: var(--color-gray-500); font-style: italic; }
    main ::ng-deep a { color: var(--color-primary); text-decoration: none; }
    main ::ng-deep a:hover { text-decoration: underline; }
    main ::ng-deep hr { border: none; border-top: 1px solid var(--color-border); margin: 2rem 0; }
    main ::ng-deep ul, main ::ng-deep ol { padding-left: 1.5rem; line-height: 1.7; color: #334155; }
  `],
  template: `
    <aside>
      <h2>Guide</h2>
      <ul class="chapter-list">
        @for (ch of chapters; track ch.slug) {
          <li>
            <a [routerLink]="['/guide', ch.slug]"
               routerLinkActive="active"
               [routerLinkActiveOptions]="{ exact: true }">
              {{ ch.title }}
            </a>
          </li>
        }
      </ul>
    </aside>
    <main>
      <markdown [src]="markdownSrc()" mermaid />
    </main>
  `,
})
export class GuideComponent {
  readonly chapters = CHAPTERS;
  readonly chapter = input<string>();

  readonly markdownSrc = computed(() => {
    const slug = this.chapter() ?? CHAPTERS[0].slug;
    const ch = CHAPTERS.find(c => c.slug === slug);
    return ch ? `/assets/guide/${ch.file}` : `/assets/guide/${CHAPTERS[0].file}`;
  });
}
