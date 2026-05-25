'use strict';

function buildTextBody(recipe) {
  const lines = [`${recipe.name}`, ''];
  if (recipe.description) lines.push(recipe.description, '');
  const meta = [
    recipe.servings && `Serves: ${recipe.servings}`,
    recipe.prepTime && `Prep: ${recipe.prepTime}`,
    recipe.cookTime && `Cook: ${recipe.cookTime}`,
  ].filter(Boolean);
  if (meta.length) lines.push(...meta, '');
  if (recipe.ingredients?.length) {
    lines.push('Ingredients:');
    recipe.ingredients.forEach(ing => {
      const ingName = ing.preparation ? `${ing.name}, ${ing.preparation}` : ing.name;
      lines.push('  • ' + [ing.quantity, ing.unit, ingName].filter(Boolean).join(' '));
    });
    lines.push('');
  }
  if (recipe.directions?.length) {
    lines.push('Directions:');
    recipe.directions.forEach((step, i) => {
      const text = typeof step === 'string' ? step : step.text;
      if (text?.trim()) lines.push(`  ${i + 1}. ${text}`);
    });
    lines.push('');
  }
  lines.push('The attached JSON file can be imported into the Meal Planner app at https://meals.jaetill.com');
  return lines.join('\n');
}

module.exports = { buildTextBody };
