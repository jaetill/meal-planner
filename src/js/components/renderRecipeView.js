import { btn } from '../ui/elements.js';
import { renderRecipeForm } from './renderRecipeForm.js';
import { renderRecipes } from './renderRecipes.js';

export function renderRecipeView(recipe) {
  const container = document.getElementById('app-content');
  container.innerHTML = '';

  // Header
  const header = document.createElement('div');
  header.className = 'flex items-center gap-3 mb-6';

  const backBtn = btn('← Recipes', 'ghost');
  backBtn.onclick = renderRecipes;

  const editBtn = btn('Edit', 'secondary');
  editBtn.onclick = () => renderRecipeForm(recipe, () => renderRecipeView(recipe));

  const spacer = document.createElement('div');
  spacer.className = 'flex-1';

  header.appendChild(backBtn);
  header.appendChild(spacer);
  header.appendChild(editBtn);
  container.appendChild(header);

  // Photo
  if (recipe.photo) {
    const img = document.createElement('img');
    img.src = recipe.photo;
    img.className = 'w-full h-48 object-cover rounded-2xl mb-4';
    container.appendChild(img);
  }

  // Title + meta
  const titleEl = document.createElement('h2');
  titleEl.className = 'text-2xl font-bold text-gray-900 mb-1';
  titleEl.textContent = recipe.name;
  container.appendChild(titleEl);

  const metaRow = document.createElement('div');
  metaRow.className = 'flex flex-wrap gap-3 text-sm text-gray-500 mb-3';
  const metaParts = [
    recipe.servings && `${recipe.servings} servings`,
    recipe.prepTime && `Prep: ${recipe.prepTime}`,
    recipe.cookTime && `Cook: ${recipe.cookTime}`,
  ].filter(Boolean);
  metaParts.forEach(part => {
    const span = document.createElement('span');
    span.textContent = part;
    metaRow.appendChild(span);
  });
  if (metaRow.children.length) container.appendChild(metaRow);

  if (recipe.source) {
    const source = document.createElement('a');
    source.className = 'text-xs text-green-600 hover:underline block mb-3';
    source.textContent = recipe.source;
    source.href = recipe.source.startsWith('http') ? recipe.source : `https://${recipe.source}`;
    source.target = '_blank';
    source.rel = 'noopener';
    container.appendChild(source);
  }

  // Tags
  if (recipe.tags?.length) {
    const tagRow = document.createElement('div');
    tagRow.className = 'flex flex-wrap gap-1 mb-4';
    recipe.tags.forEach(tag => {
      const chip = document.createElement('span');
      chip.className = 'text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full';
      chip.textContent = tag;
      tagRow.appendChild(chip);
    });
    container.appendChild(tagRow);
  }

  // Ingredients
  if (recipe.ingredients?.length) {
    const label = document.createElement('span');
    label.className = 'section-label';
    label.textContent = 'Ingredients';
    container.appendChild(label);

    const ingList = document.createElement('ul');
    ingList.className = 'space-y-1 mb-5';
    recipe.ingredients.forEach(ing => {
      const li = document.createElement('li');
      li.className = 'text-sm text-gray-700 flex gap-2';

      const dot = document.createElement('span');
      dot.className = 'text-green-500 shrink-0';
      dot.textContent = '•';

      const text = document.createElement('span');
      const ingName = ing.preparation ? `${ing.name}, ${ing.preparation}` : ing.name;
      const parts = [ing.quantity, ing.unit, ingName].filter(Boolean).join(' ');
      text.textContent = ing.packageSize ? `${parts} (${ing.packageSize})` : parts;

      li.appendChild(dot);
      li.appendChild(text);
      ingList.appendChild(li);
    });
    container.appendChild(ingList);
  }

  // Directions
  if (recipe.directions?.length) {
    const label = document.createElement('span');
    label.className = 'section-label';
    label.textContent = 'Directions';
    container.appendChild(label);

    const dirList = document.createElement('ol');
    dirList.className = 'space-y-3 mb-5';
    recipe.directions.forEach((step, i) => {
      if (!step.trim()) return;
      const li = document.createElement('li');
      li.className = 'flex gap-3 text-sm text-gray-700';

      const num = document.createElement('span');
      num.className = 'font-bold text-green-600 shrink-0 w-5';
      num.textContent = `${i + 1}.`;

      const text = document.createElement('span');
      text.textContent = step;

      li.appendChild(num);
      li.appendChild(text);
      dirList.appendChild(li);
    });
    container.appendChild(dirList);
  }
}
