import { recipes, saveRecipes, newRecipe, importRecipeFromUrl, fetchIncomingShares, acceptIncomingShare, dismissIncomingShare } from '../data/index.js';
import { btn } from '../ui/elements.js';
import { toastSuccess, toastError, toastInfo } from '../ui/toast.js';
import { renderRecipeForm } from './renderRecipeForm.js';
import { renderRecipeView } from './renderRecipeView.js';

export function renderRecipes() {
  const container = document.getElementById('app-content');
  container.innerHTML = '';

  // Header row
  const header = document.createElement('div');
  header.className = 'flex items-center justify-between mb-4';

  const title = document.createElement('h2');
  title.className = 'text-lg font-bold text-gray-800';
  title.textContent = 'Recipes';

  const addBtn = btn('+ Add Recipe', 'primary');
  addBtn.onclick = () => renderRecipeForm(null, renderRecipes);

  const importBtn = btn('Import from URL', 'secondary');
  importBtn.onclick = () => showImportBar();

  const btnGroup = document.createElement('div');
  btnGroup.className = 'flex gap-2';
  btnGroup.appendChild(importBtn);
  btnGroup.appendChild(addBtn);

  header.appendChild(title);
  header.appendChild(btnGroup);
  container.appendChild(header);

  // Check for incoming shared recipes (async, non-blocking)
  const sharesContainer = document.createElement('div');
  container.appendChild(sharesContainer);
  fetchIncomingShares().then(shares => {
    if (!shares.length) return;
    sharesContainer.innerHTML = '';

    const banner = document.createElement('button');
    banner.type = 'button';
    banner.className = 'w-full text-left bg-green-50 border border-green-200 rounded-xl px-4 py-3 mb-4 flex items-center justify-between';

    const bannerText = document.createElement('span');
    bannerText.className = 'text-sm text-green-800 font-medium';
    bannerText.textContent = `📨 ${shares.length} shared recipe${shares.length !== 1 ? 's' : ''} waiting`;

    const chevron = document.createElement('span');
    chevron.className = 'text-green-600 text-sm';
    chevron.textContent = '›';

    banner.appendChild(bannerText);
    banner.appendChild(chevron);
    banner.onclick = () => showSharesSheet(shares, sharesContainer);
    sharesContainer.appendChild(banner);
  }).catch(() => { /* non-fatal */ });

  // Import URL bar (hidden by default)
  const importBar = document.createElement('div');
  importBar.className = 'hidden flex gap-2 mb-4';
  const urlInput = document.createElement('input');
  urlInput.type = 'url';
  urlInput.placeholder = 'Paste recipe URL…';
  urlInput.className = 'field flex-1';
  const goBtn = btn('Import', 'primary');
  const cancelBtn = btn('Cancel', 'ghost');
  importBar.appendChild(urlInput);
  importBar.appendChild(goBtn);
  importBar.appendChild(cancelBtn);
  container.appendChild(importBar);

  function showImportBar() {
    importBar.classList.remove('hidden');
    importBar.classList.add('flex');
    urlInput.focus();
    importBtn.disabled = true;
  }

  cancelBtn.onclick = () => {
    importBar.classList.add('hidden');
    importBar.classList.remove('flex');
    urlInput.value = '';
    importBtn.disabled = false;
  };

  async function doImport() {
    const url = urlInput.value.trim();
    if (!url) return;
    goBtn.disabled = true;
    goBtn.textContent = 'Importing…';
    try {
      toastInfo('Fetching recipe…');
      const recipe = await importRecipeFromUrl(url);
      renderRecipeForm(recipe, renderRecipes, true);
    } catch (err) {
      toastError(err.message || 'Could not import recipe.');
      goBtn.disabled = false;
      goBtn.textContent = 'Import';
    }
  }

  goBtn.onclick = doImport;
  urlInput.addEventListener('keydown', e => { if (e.key === 'Enter') doImport(); });

  if (recipes.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'text-gray-400 text-sm text-center py-12';
    empty.textContent = 'No recipes yet. Add one to get started!';
    container.appendChild(empty);
    return;
  }

  // Search
  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.placeholder = 'Search recipes…';
  searchInput.className = 'field mb-4';
  searchInput.oninput = () => renderList(searchInput.value.trim().toLowerCase());
  container.appendChild(searchInput);

  const listEl = document.createElement('div');
  listEl.className = 'space-y-2';
  container.appendChild(listEl);

  function renderList(query = '') {
    listEl.innerHTML = '';
    const filtered = query
      ? recipes.filter(r => r.name.toLowerCase().includes(query) ||
          r.tags.some(t => t.toLowerCase().includes(query)))
      : recipes;

    const sorted = [...filtered].sort((a, b) => a.name.localeCompare(b.name));

    sorted.forEach(recipe => {
      const card = document.createElement('div');
      card.className = 'card flex items-center gap-3 cursor-pointer hover:border-green-200 transition-colors';
      card.onclick = () => renderRecipeView(recipe);

      if (recipe.photo) {
        const img = document.createElement('img');
        img.src = recipe.photo;
        img.className = 'w-14 h-14 rounded-lg object-cover shrink-0';
        card.appendChild(img);
      } else {
        const icon = document.createElement('div');
        icon.className = 'w-14 h-14 rounded-lg bg-green-50 flex items-center justify-center text-2xl shrink-0';
        icon.textContent = '🍽️';
        card.appendChild(icon);
      }

      const info = document.createElement('div');
      info.className = 'flex-1 min-w-0';

      const name = document.createElement('p');
      name.className = 'font-medium text-gray-900 truncate';
      name.textContent = recipe.name;
      info.appendChild(name);

      const meta = document.createElement('p');
      meta.className = 'text-xs text-gray-400 mt-0.5';
      const parts = [];
      if (recipe.servings) parts.push(`${recipe.servings} servings`);
      if (recipe.prepTime) parts.push(`${recipe.prepTime} prep`);
      if (recipe.cookTime) parts.push(`${recipe.cookTime} cook`);
      meta.textContent = parts.join(' · ');
      info.appendChild(meta);

      if (recipe.tags?.length) {
        const tagRow = document.createElement('div');
        tagRow.className = 'flex flex-wrap gap-1 mt-1';
        recipe.tags.forEach(tag => {
          const chip = document.createElement('span');
          chip.className = 'text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full';
          chip.textContent = tag;
          tagRow.appendChild(chip);
        });
        info.appendChild(tagRow);
      }

      card.appendChild(info);
      listEl.appendChild(card);
    });

    if (sorted.length === 0) {
      const none = document.createElement('p');
      none.className = 'text-gray-400 text-sm text-center py-8';
      none.textContent = 'No recipes match your search.';
      listEl.appendChild(none);
    }
  }

  renderList();
}

function showSharesSheet(shares, sharesContainer) {
  const overlay = document.createElement('div');
  overlay.className = 'fixed inset-0 bg-black/40 z-40 flex items-end justify-center pb-16';

  const sheet = document.createElement('div');
  sheet.className = 'bg-white w-full max-w-2xl rounded-t-2xl p-4 max-h-[80vh] flex flex-col';

  const header = document.createElement('div');
  header.className = 'flex items-center justify-between mb-4';

  const title = document.createElement('span');
  title.className = 'font-bold text-gray-800';
  title.textContent = 'Shared recipes';

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.textContent = '×';
  closeBtn.className = 'text-gray-400 text-2xl leading-none';
  closeBtn.onclick = () => overlay.remove();

  header.appendChild(title);
  header.appendChild(closeBtn);
  sheet.appendChild(header);

  const listEl = document.createElement('div');
  listEl.className = 'overflow-y-auto flex-1 space-y-3';

  function renderList(pendingShares) {
    listEl.innerHTML = '';
    if (pendingShares.length === 0) {
      const done = document.createElement('p');
      done.className = 'text-sm text-gray-400 text-center py-6';
      done.textContent = 'All caught up!';
      listEl.appendChild(done);
      sharesContainer.innerHTML = '';
      return;
    }

    pendingShares.forEach(share => {
      const card = document.createElement('div');
      card.className = 'border border-gray-100 rounded-xl p-3';

      const nameEl = document.createElement('p');
      nameEl.className = 'font-medium text-gray-800 mb-0.5';
      nameEl.textContent = share.recipe.name;

      const fromEl = document.createElement('p');
      fromEl.className = 'text-xs text-gray-400 mb-3';
      fromEl.textContent = `from ${share.fromUsername}`;

      const btnRow = document.createElement('div');
      btnRow.className = 'flex gap-2';

      const acceptBtn = document.createElement('button');
      acceptBtn.type = 'button';
      acceptBtn.textContent = 'Add to my recipes';
      acceptBtn.className = 'btn btn-primary text-sm flex-1';
      acceptBtn.onclick = async () => {
        acceptBtn.disabled = true;
        acceptBtn.textContent = 'Adding…';
        try {
          await acceptIncomingShare(share.shareId);
          pendingShares = pendingShares.filter(s => s.shareId !== share.shareId);
          renderList(pendingShares);
        } catch {
          acceptBtn.disabled = false;
          acceptBtn.textContent = 'Add to my recipes';
        }
      };

      const dismissBtn = document.createElement('button');
      dismissBtn.type = 'button';
      dismissBtn.textContent = 'Dismiss';
      dismissBtn.className = 'btn btn-ghost text-sm text-gray-400';
      dismissBtn.onclick = async () => {
        dismissBtn.disabled = true;
        try {
          await dismissIncomingShare(share.shareId);
          pendingShares = pendingShares.filter(s => s.shareId !== share.shareId);
          renderList(pendingShares);
        } catch {
          dismissBtn.disabled = false;
        }
      };

      btnRow.appendChild(acceptBtn);
      btnRow.appendChild(dismissBtn);
      card.appendChild(nameEl);
      card.appendChild(fromEl);
      card.appendChild(btnRow);
      listEl.appendChild(card);
    });
  }

  renderList(shares);
  sheet.appendChild(listEl);
  overlay.appendChild(sheet);
  overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };
  document.body.appendChild(overlay);
}
