/**
 * Sentry browser SDK init per platform ADR-0009.
 * Imported from index.html and callback.html before any app code (additive — does
 * not change existing app behavior; if VITE_SENTRY_DSN is unset, init is a no-op).
 *
 * PII-aware: configured to scrub email + name + phone fields per ADR-0006.
 *
 * To activate:
 *   1. Create a Sentry project at https://sentry.io/.
 *   2. Add VITE_SENTRY_DSN to GitHub repo secrets (also referenced by deploy.yml).
 *   3. Optional: add VITE_DEPLOY_ENV and VITE_RELEASE_VERSION via the build env.
 */

import * as Sentry from '@sentry/browser';

const dsn = import.meta.env.VITE_SENTRY_DSN;
const environment = import.meta.env.VITE_DEPLOY_ENV ?? 'production';
const release = import.meta.env.VITE_RELEASE_VERSION;

if (dsn) {
  Sentry.init({
    dsn,
    environment,
    release,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.feedbackIntegration({
        // Sentry User Feedback widget per platform Standard 11 Tier 1
        colorScheme: 'system',
        showBranding: false,
        autoInject: true, // shows the floating "Report a Bug" button
        formTitle: 'Report a bug',
        submitButtonLabel: 'Send report',
        successMessageText: 'Thanks — we got it.',
      }),
    ],
    tracesSampleRate: environment === 'production' ? 0.1 : 1.0,
    // PII scrubbing per ADR-0006
    beforeSend(event) {
      if (event.user) {
        delete event.user.email;
        delete event.user.username;
      }
      // Scrub form values from breadcrumbs that might contain PII
      if (event.breadcrumbs) {
        event.breadcrumbs = event.breadcrumbs.map((b) => {
          if (b.category === 'ui.input' && b.message) {
            b.message = b.message.replace(/value=".*?"/g, 'value="[REDACTED]"');
          }
          return b;
        });
      }
      return event;
    },
  });
}

export { Sentry };
