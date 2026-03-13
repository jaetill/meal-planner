import { recipes, saveRecipes, newRecipe } from '../data/index.js';
import { btn } from '../ui/elements.js';
import { toastSuccess, toastError } from '../ui/toast.js';
import { renderRecipeForm } from './renderRecipeForm.js';

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

  header.appendChild(title);
  header.appendChild(addBtn);
  container.appendChild(header);

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
      card.onclick = () => renderRecipeForm(recipe, renderRecipes);

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
