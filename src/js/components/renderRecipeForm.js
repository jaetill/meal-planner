import { recipes, saveRecipes, newRecipe, newIngredient } from '../data/index.js';
import { btn, input } from '../ui/elements.js';
import { toastSuccess, toastError } from '../ui/toast.js';

const UNITS = [
  '', 'tsp', 'tbsp', 'cup', 'oz', 'lb', 'g', 'kg', 'ml', 'l',
  'pinch', 'dash', 'can', 'pkg', 'slice', 'piece', 'clove', 'sprig', 'bunch',
];

const COMMON_TAGS = ['freezer meal', 'quick', 'crockpot', 'instant pot', 'grilling',
                     'vegetarian', 'vegan', 'gluten-free', 'dairy-free', 'kid-friendly'];

export function renderRecipeForm(existingRecipe, onDone, isImport = false) {
  const isNew  = !existingRecipe || isImport;
  const recipe = existingRecipe
    ? JSON.parse(JSON.stringify(existingRecipe)) // work on a copy
    : newRecipe();

  const container = document.getElementById('app-content');
  container.innerHTML = '';

  // Header
  const header = document.createElement('div');
  header.className = 'flex items-center gap-3 mb-6';

  const backBtn = btn('← Back', 'ghost');
  backBtn.onclick = onDone;

  const title = document.createElement('h2');
  title.className = 'text-lg font-bold text-gray-800';
  title.textContent = isNew ? 'New Recipe' : 'Edit Recipe';

  header.appendChild(backBtn);
  header.appendChild(title);
  container.appendChild(header);

  const form = document.createElement('div');
  form.className = 'space-y-6';
  container.appendChild(form);

  // ── Basic info ────────────────────────────────────────────
  const basicSection = section('Basic Info');

  const nameInput = field('Recipe name', 'text', recipe.name);
  basicSection.appendChild(labelWrap('Name', nameInput));

  const row1 = document.createElement('div');
  row1.className = 'grid grid-cols-2 gap-3';
  const servingsInput = field('4', 'number', recipe.servings);
  const sourceInput   = field('e.g. allrecipes.com', 'text', recipe.source);
  row1.appendChild(labelWrap('Servings', servingsInput));
  row1.appendChild(labelWrap('Source', sourceInput));
  basicSection.appendChild(row1);

  const row2 = document.createElement('div');
  row2.className = 'grid grid-cols-2 gap-3';
  const prepInput = field('e.g. 15 min', 'text', recipe.prepTime);
  const cookInput = field('e.g. 30 min', 'text', recipe.cookTime);
  row2.appendChild(labelWrap('Prep time', prepInput));
  row2.appendChild(labelWrap('Cook time', cookInput));
  basicSection.appendChild(row2);

  form.appendChild(basicSection);

  // ── Tags ─────────────────────────────────────────────────
  const tagsSection = section('Tags');
  const tagChips = document.createElement('div');
  tagChips.className = 'flex flex-wrap gap-2';

  COMMON_TAGS.forEach(tag => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.textContent = tag;
    chip.className = recipe.tags.includes(tag)
      ? 'text-xs px-3 py-1 rounded-full bg-green-600 text-white font-medium'
      : 'text-xs px-3 py-1 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200';
    chip.onclick = () => {
      if (recipe.tags.includes(tag)) {
        recipe.tags = recipe.tags.filter(t => t !== tag);
        chip.className = 'text-xs px-3 py-1 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200';
      } else {
        recipe.tags.push(tag);
        chip.className = 'text-xs px-3 py-1 rounded-full bg-green-600 text-white font-medium';
      }
    };
    tagChips.appendChild(chip);
  });

  tagsSection.appendChild(tagChips);
  form.appendChild(tagsSection);

  // ── Ingredients ───────────────────────────────────────────
  const ingSection = section('Ingredients');
  const ingList    = document.createElement('div');
  ingList.className = 'space-y-2';
  ingSection.appendChild(ingList);

  function renderIngredients() {
    ingList.innerHTML = '';
    recipe.ingredients.forEach((ing, i) => {
      const row = document.createElement('div');
      row.className = 'flex gap-2 items-start';

      const qtyInput = document.createElement('input');
      qtyInput.type = 'text';
      qtyInput.value = ing.quantity;
      qtyInput.placeholder = 'Qty';
      qtyInput.className = 'field w-16 shrink-0';
      qtyInput.oninput = e => { ing.quantity = e.target.value; };

      const unitSel = document.createElement('select');
      unitSel.className = 'field w-20 shrink-0';
      UNITS.forEach(u => {
        const opt = document.createElement('option');
        opt.value = u;
        opt.textContent = u || '—';
        opt.selected = ing.unit === u;
        unitSel.appendChild(opt);
      });
      unitSel.onchange = e => { ing.unit = e.target.value; };

      const nameInput = document.createElement('input');
      nameInput.type = 'text';
      nameInput.value = ing.name;
      nameInput.placeholder = 'Ingredient name';
      nameInput.className = 'field flex-1';
      nameInput.oninput = e => { ing.name = e.target.value; };

      const pkgInput = document.createElement('input');
      pkgInput.type = 'text';
      pkgInput.value = ing.packageSize;
      pkgInput.placeholder = 'Pkg size (e.g. 14.5 oz can)';
      pkgInput.className = 'field w-36 shrink-0';
      pkgInput.oninput = e => { ing.packageSize = e.target.value; };

      const delBtn = btn('×', 'ghost');
      delBtn.className += ' shrink-0 text-gray-400';
      delBtn.onclick = () => {
        recipe.ingredients.splice(i, 1);
        renderIngredients();
      };

      row.appendChild(qtyInput);
      row.appendChild(unitSel);
      row.appendChild(nameInput);
      row.appendChild(pkgInput);
      row.appendChild(delBtn);
      ingList.appendChild(row);
    });
  }

  renderIngredients();

  const addIngBtn = btn('+ Add Ingredient', 'ghost');
  addIngBtn.className += ' text-sm mt-1';
  addIngBtn.onclick = () => {
    recipe.ingredients.push(newIngredient());
    renderIngredients();
  };
  ingSection.appendChild(addIngBtn);
  form.appendChild(ingSection);

  // ── Directions ────────────────────────────────────────────
  const dirSection = section('Directions');
  const dirList    = document.createElement('div');
  dirList.className = 'space-y-2';
  dirSection.appendChild(dirList);

  function renderDirections() {
    dirList.innerHTML = '';
    recipe.directions.forEach((step, i) => {
      const row = document.createElement('div');
      row.className = 'flex gap-2 items-start';

      const num = document.createElement('span');
      num.className = 'text-sm font-bold text-green-600 mt-2 w-5 shrink-0';
      num.textContent = `${i + 1}.`;

      const textarea = document.createElement('textarea');
      textarea.value = step;
      textarea.placeholder = 'Describe this step…';
      textarea.className = 'field flex-1 resize-none';
      textarea.rows = 2;
      textarea.oninput = e => { recipe.directions[i] = e.target.value; };

      const delBtn = btn('×', 'ghost');
      delBtn.className += ' shrink-0 text-gray-400 mt-1';
      delBtn.onclick = () => {
        recipe.directions.splice(i, 1);
        renderDirections();
      };

      row.appendChild(num);
      row.appendChild(textarea);
      row.appendChild(delBtn);
      dirList.appendChild(row);
    });
  }

  renderDirections();

  const addDirBtn = btn('+ Add Step', 'ghost');
  addDirBtn.className += ' text-sm mt-1';
  addDirBtn.onclick = () => {
    recipe.directions.push('');
    renderDirections();
  };
  dirSection.appendChild(addDirBtn);
  form.appendChild(dirSection);

  // ── Save / Delete ─────────────────────────────────────────
  const actionRow = document.createElement('div');
  actionRow.className = 'flex gap-3 pt-2 pb-8';

  const saveBtn = btn(isNew ? 'Save Recipe' : 'Save Changes', 'primary');
  saveBtn.className += ' flex-1';
  saveBtn.onclick = async () => {
    recipe.name = nameInput.value.trim();
    if (!recipe.name) { toastError('Recipe needs a name.'); return; }

    recipe.servings = parseInt(servingsInput.value) || 4;
    recipe.prepTime = prepInput.value.trim();
    recipe.cookTime = cookInput.value.trim();
    recipe.source   = sourceInput.value.trim();

    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving…';
    try {
      let updated;
      if (isNew) {
        updated = [...recipes, recipe];
      } else {
        updated = recipes.map(r => r.id === recipe.id ? recipe : r);
      }
      await saveRecipes(updated);
      toastSuccess(isNew ? 'Recipe saved!' : 'Changes saved!');
      onDone();
    } catch (err) {
      toastError(err.message || 'Could not save. Try again.');
      saveBtn.disabled = false;
      saveBtn.textContent = isNew ? 'Save Recipe' : 'Save Changes';
    }
  };

  actionRow.appendChild(saveBtn);

  if (!isNew) {
    const delBtn = btn('Delete Recipe', 'danger');
    delBtn.onclick = async () => {
      if (!confirm(`Delete "${recipe.name}"?`)) return;
      delBtn.disabled = true;
      try {
        await saveRecipes(recipes.filter(r => r.id !== recipe.id));
        toastSuccess('Recipe deleted.');
        onDone();
      } catch {
        toastError('Could not delete. Try again.');
        delBtn.disabled = false;
      }
    };
    actionRow.appendChild(delBtn);
  }

  form.appendChild(actionRow);
}

// ── Helpers ───────────────────────────────────────────────

function section(heading) {
  const el = document.createElement('div');
  const label = document.createElement('span');
  label.className = 'section-label';
  label.textContent = heading;
  el.appendChild(label);
  return el;
}

function labelWrap(labelText, inputEl) {
  const wrap = document.createElement('div');
  const label = document.createElement('label');
  label.className = 'block text-sm font-medium text-gray-700 mb-1';
  label.textContent = labelText;
  wrap.appendChild(label);
  wrap.appendChild(inputEl);
  return wrap;
}

function field(placeholder, type = 'text', value = '') {
  const el = document.createElement('input');
  el.type = type;
  el.placeholder = placeholder;
  el.value = value ?? '';
  el.className = 'field w-full';
  return el;
}
