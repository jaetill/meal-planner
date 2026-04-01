import { startCookSession, advanceCookSession, backCookSession, getCookSession, formatDuration } from '../data/index.js';
import { btn } from '../ui/elements.js';

export async function renderCookMode(recipe, onExit) {
  // Normalize directions to objects (backward compat)
  const steps = (recipe.directions || []).map(d =>
    typeof d === 'string' ? { text: d, duration: null } : d
  ).filter(s => s.text?.trim());

  if (!steps.length) { onExit?.(); return; }

  let stepIndex      = 0;
  let wakeLock       = null;
  let lastLocalAction = 0;
  const POLL_MS      = 5000;
  const ACTION_GRACE = 3000;

  try {
    if ('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen');
  } catch {}

  // Sync session to S3 in background so Alexa knows which recipe is active
  startCookSession(recipe).catch(() => {});

  // Poll for Alexa-driven step changes every 5 seconds
  const pollInterval = setInterval(async () => {
    if (Date.now() - lastLocalAction < ACTION_GRACE) return;
    try {
      const { session } = await getCookSession();
      if (session.stepIndex !== stepIndex) {
        stepIndex = session.stepIndex;
        render();
      }
    } catch {}
  }, POLL_MS);

  const overlay = document.createElement('div');
  overlay.className = 'fixed inset-0 bg-white z-50 flex flex-col';

  function render() {
    overlay.innerHTML = '';
    const step  = steps[stepIndex];
    const total = steps.length;
    const isFirst = stepIndex === 0;
    const isLast  = stepIndex === total - 1;

    // ── Header ──────────────────────────────────────────────
    const header = document.createElement('div');
    header.className = 'flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0';

    const closeBtn = document.createElement('button');
    closeBtn.type      = 'button';
    closeBtn.className = 'p-2 text-gray-400 text-2xl leading-none';
    closeBtn.textContent = '✕';
    closeBtn.onclick   = exit;

    const titleEl = document.createElement('span');
    titleEl.className   = 'font-semibold text-gray-700 text-sm truncate flex-1 text-center mx-3';
    titleEl.textContent = recipe.name;

    const counter = document.createElement('span');
    counter.className   = 'text-sm text-gray-400 shrink-0 tabular-nums';
    counter.textContent = `${stepIndex + 1} / ${total}`;

    header.appendChild(closeBtn);
    header.appendChild(titleEl);
    header.appendChild(counter);
    overlay.appendChild(header);

    // ── Progress bar ────────────────────────────────────────
    const progressWrap = document.createElement('div');
    progressWrap.className = 'h-1 bg-gray-100 shrink-0';
    const progressBar = document.createElement('div');
    progressBar.className = 'h-1 bg-green-500 transition-all duration-300';
    progressBar.style.width = `${((stepIndex + 1) / total) * 100}%`;
    progressWrap.appendChild(progressBar);
    overlay.appendChild(progressWrap);

    // ── Step content ────────────────────────────────────────
    const content = document.createElement('div');
    content.className = 'flex-1 flex flex-col items-center justify-center px-8 py-6 overflow-y-auto';

    const stepLabel = document.createElement('p');
    stepLabel.className   = 'text-xs font-bold text-green-600 uppercase tracking-widest mb-5';
    stepLabel.textContent = `Step ${stepIndex + 1}`;
    content.appendChild(stepLabel);

    const stepText = document.createElement('p');
    stepText.className   = 'text-2xl text-gray-800 text-center leading-relaxed font-medium max-w-lg';
    stepText.textContent = step.text;
    content.appendChild(stepText);

    if (step.duration) {
      const durLabel = step.durationMax
        ? `${formatDuration(step.duration)}–${formatDuration(step.durationMax)}`
        : formatDuration(step.duration);
      const timerBadge = document.createElement('div');
      timerBadge.className = 'mt-8 flex items-center gap-2 bg-green-50 text-green-700 px-5 py-3 rounded-2xl text-sm font-medium';
      timerBadge.textContent = `⏱ ${durLabel} — say "Alexa, ask my cooking assistant what's next" to auto-start timer`;
      content.appendChild(timerBadge);
    }

    overlay.appendChild(content);

    // ── Navigation ──────────────────────────────────────────
    const nav = document.createElement('div');
    nav.className = 'flex gap-4 px-6 pb-10 pt-4 shrink-0';

    const backBtn = document.createElement('button');
    backBtn.type      = 'button';
    backBtn.textContent = '← Back';
    backBtn.className = `flex-1 py-5 rounded-2xl font-semibold text-lg transition-opacity${
      isFirst ? ' bg-gray-100 text-gray-300 opacity-40 pointer-events-none' : ' bg-gray-100 text-gray-600 active:bg-gray-200'
    }`;
    backBtn.onclick = () => {
      lastLocalAction = Date.now();
      stepIndex--;
      backCookSession().catch(() => {});
      render();
    };

    const nextBtn = document.createElement('button');
    nextBtn.type      = 'button';
    nextBtn.textContent = isLast ? 'Done ✓' : 'Next →';
    nextBtn.className = `flex-1 py-5 rounded-2xl font-semibold text-lg${
      isLast ? ' bg-gray-800 text-white active:bg-gray-700' : ' bg-green-600 text-white active:bg-green-700'
    }`;
    nextBtn.onclick = () => {
      if (isLast) { exit(); return; }
      lastLocalAction = Date.now();
      stepIndex++;
      advanceCookSession().catch(() => {});
      render();
    };

    nav.appendChild(backBtn);
    nav.appendChild(nextBtn);
    overlay.appendChild(nav);
  }

  function exit() {
    clearInterval(pollInterval);
    if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; }
    overlay.remove();
    onExit?.();
  }

  // Re-acquire wake lock if page becomes visible again (iOS releases it on page hide)
  document.addEventListener('visibilitychange', async () => {
    if (wakeLock !== null && document.visibilityState === 'visible') {
      try { wakeLock = await navigator.wakeLock.request('screen'); } catch {}
    }
  });

  render();
  document.body.appendChild(overlay);
}
