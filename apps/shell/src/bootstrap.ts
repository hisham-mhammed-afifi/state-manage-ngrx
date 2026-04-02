import { bootstrapApplication } from '@angular/platform-browser';
import mermaid from 'mermaid';
import { appConfig } from './app/app.config';
import { App } from './app/app';

// Expose mermaid globally for ngx-markdown
(window as any).mermaid = mermaid;

bootstrapApplication(App, appConfig).catch((err) => console.error(err));
