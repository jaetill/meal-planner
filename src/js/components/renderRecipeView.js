import { btn } from '../ui/elements.js';
import { renderRecipeForm } from './renderRecipeForm.js';
import { renderRecipes } from './renderRecipes.js';
import { populateRecipeNutrition, calcNutritionPerServing } from '../data/nutrition.js';
import { shareRecipe } from '../data/index.js';

export function renderRecipeView(recipe, onBack) {
  const container = document.getElementById('app-content');
  container.innerHTML = '';

  // Header
  const header = document.createElement('div');
  header.className = 'flex items-center gap-3 mb-6';

  const backBtn = btn('← Back', 'ghost');
  backBtn.onclick = onBack || renderRecipes;

  const editBtn = btn('Edit', 'secondary');
  editBtn.onclick = () => renderRecipeForm(recipe, () => renderRecipeView(recipe));

  const shareBtn = btn('Share', 'ghost');
  shareBtn.className += ' text-xs';
  shareBtn.onclick = () => showShareSheet(recipe);

  const spacer = document.createElement('div');
  spacer.className = 'flex-1';

  header.appendChild(backBtn);
  header.appendChild(shareBtn);
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

  // Nutrition
  if (recipe.ingredients?.some(ing => ing.quantity)) {
    const label = document.createElement('span');
    label.className = 'section-label';
    label.textContent = 'Nutrition per serving';
    container.appendChild(label);

    const nutritionCard = document.createElement('div');
    nutritionCard.className = 'card mb-5';

    function renderNutrition() {
      nutritionCard.innerHTML = '';
      const n = calcNutritionPerServing(recipe);

      if (!n) {
        const loading = document.createElement('p');
        loading.className = 'text-xs text-gray-400 text-center py-2';
        loading.textContent = 'Loading nutrition…';
        nutritionCard.appendChild(loading);
        return;
      }

      // Primary row: calories, protein, fat, carbs
      const primary = document.createElement('div');
      primary.className = 'grid grid-cols-4 divide-x divide-gray-100 mb-3';
      [
        { label: 'Calories', value: n.calories, unit: '' },
        { label: 'Protein',  value: n.protein,  unit: 'g' },
        { label: 'Fat',      value: n.fat,       unit: 'g' },
        { label: 'Carbs',    value: n.carbs,     unit: 'g' },
      ].forEach(({ label, value, unit }) => {
        const cell = document.createElement('div');
        cell.className = 'flex flex-col items-center py-2';
        const val = document.createElement('span');
        val.className = 'text-base font-bold text-gray-800';
        val.textContent = value != null ? `${value}${unit}` : '–';
        const lbl = document.createElement('span');
        lbl.className = 'text-xs text-gray-400 mt-0.5';
        lbl.textContent = label;
        cell.appendChild(val);
        cell.appendChild(lbl);
        primary.appendChild(cell);
      });
      nutritionCard.appendChild(primary);

      // Secondary row: sat fat, cholesterol, sodium, fiber, sugar
      const secondary = document.createElement('div');
      secondary.className = 'flex flex-wrap gap-x-4 gap-y-1 pt-2 border-t border-gray-50 px-1';
      [
        { label: 'Sat. fat',  value: n.saturatedFat, unit: 'g'  },
        { label: 'Cholest.',  value: n.cholesterol,  unit: 'mg' },
        { label: 'Sodium',    value: n.sodium,        unit: 'mg' },
        { label: 'Fiber',     value: n.fiber,         unit: 'g'  },
        { label: 'Sugar',     value: n.sugar,         unit: 'g'  },
      ].forEach(({ label, value, unit }) => {
        const item = document.createElement('span');
        item.className = 'text-xs text-gray-500';
        item.textContent = `${label}: ${value != null ? `${value}${unit}` : '–'}`;
        secondary.appendChild(item);
      });
      nutritionCard.appendChild(secondary);
    }

    renderNutrition();
    container.appendChild(nutritionCard);

    // Fetch missing nutrition in the background, then re-render
    populateRecipeNutrition(recipe).then(() => renderNutrition());
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

function showShareSheet(recipe) {
  const overlay = document.createElement('div');
  overlay.className = 'fixed inset-0 bg-black/40 z-40 flex items-end justify-center pb-16';

  const sheet = document.createElement('div');
  sheet.className = 'bg-white w-full max-w-2xl rounded-t-2xl p-4';

  const header = document.createElement('div');
  header.className = 'flex items-center justify-between mb-4';

  const title = document.createElement('span');
  title.className = 'font-bold text-gray-800';
  title.textContent = `Share "${recipe.name}"`;

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.textContent = '×';
  closeBtn.className = 'text-gray-400 text-2xl leading-none';
  closeBtn.onclick = () => overlay.remove();

  header.appendChild(title);
  header.appendChild(closeBtn);
  sheet.appendChild(header);

  const desc = document.createElement('p');
  desc.className = 'text-sm text-gray-500 mb-3';
  desc.textContent = 'Enter the username of the person you want to share with. They\'ll see it in their Recipes tab.';
  sheet.appendChild(desc);

  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'Recipient\'s username';
  input.className = 'field mb-3';
  sheet.appendChild(input);

  const statusEl = document.createElement('p');
  statusEl.className = 'text-sm mb-3 hidden';
  sheet.appendChild(statusEl);

  const sendBtn = document.createElement('button');
  sendBtn.type = 'button';
  sendBtn.textContent = 'Send recipe';
  sendBtn.className = 'btn btn-primary w-full';

  sendBtn.onclick = async () => {
    const target = input.value.trim();
    if (!target) return;
    sendBtn.disabled = true;
    sendBtn.textContent = 'Sending…';
    statusEl.className = 'text-sm mb-3';
    try {
      await shareRecipe(recipe, target);
      statusEl.textContent = `✓ Sent to ${target}!`;
      statusEl.className = 'text-sm mb-3 text-green-600';
      sendBtn.textContent = 'Sent';
      input.value = '';
    } catch (err) {
      statusEl.textContent = err.message || 'Could not send. Check the username and try again.';
      statusEl.className = 'text-sm mb-3 text-red-500';
      sendBtn.disabled = false;
      sendBtn.textContent = 'Send recipe';
    }
  };

  sheet.appendChild(sendBtn);
  overlay.appendChild(sheet);
  overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };
  document.body.appendChild(overlay);
  input.focus();
}
