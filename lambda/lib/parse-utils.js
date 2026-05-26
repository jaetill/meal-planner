'use strict';

const HTML_ENTITIES = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'",
  '&nbsp;': ' ', '&frac12;': '½', '&frac14;': '¼', '&frac34;': '¾',
  '&deg;': '°', '&mdash;': '—', '&ndash;': '–', '&hellip;': '…',
  '&rsquo;': "'", '&lsquo;': "'", '&rdquo;': '"', '&ldquo;': '"',
};

function decodeHtml(str) {
  if (!str) return str;
  return str
    .replace(/&[a-z0-9#]+;/gi, e => HTML_ENTITIES[e.toLowerCase()] ?? e)
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

// Returns { min, max? } in seconds, or null. max is only set for range expressions.
function parseDurationFromText(text) {
  if (!text) return null;
  const rangeMin  = text.match(/(\d+)\s*(?:[-–]|to)\s*(\d+)\s*(?:minute|min)s?/i);
  const rangeHour = text.match(/(\d+)\s*(?:[-–]|to)\s*(\d+)\s*(?:hour|hr)s?/i);
  const rangeSec  = text.match(/(\d+)\s*(?:[-–]|to)\s*(\d+)\s*(?:second|sec)s?/i);
  if (rangeMin)  return { min: parseInt(rangeMin[1])  * 60,   max: parseInt(rangeMin[2])  * 60 };
  if (rangeHour) return { min: parseInt(rangeHour[1]) * 3600, max: parseInt(rangeHour[2]) * 3600 };
  if (rangeSec)  return { min: parseInt(rangeSec[1]),          max: parseInt(rangeSec[2]) };
  const hourMin = text.match(/(\d+)\s*(?:hour|hr)s?\s*(?:and\s*)?(\d+)\s*(?:minute|min)s?/i);
  if (hourMin) return { min: parseInt(hourMin[1]) * 3600 + parseInt(hourMin[2]) * 60 };
  const hour = text.match(/\b(?:for|about)\s+(\d+)\s*(?:hour|hr)s?|(\d+)\s*(?:hour|hr)s?/i);
  if (hour) return { min: parseInt(hour[1] || hour[2]) * 3600 };
  const min = text.match(/\b(?:for|about)\s+(\d+)\s*(?:minute|min)s?|(\d+)\s*(?:minute|min)s?/i);
  if (min) return { min: parseInt(min[1] || min[2]) * 60 };
  const sec = text.match(/\b(?:for|about)\s+(\d+)\s*(?:second|sec)s?|(\d+)\s*(?:second|sec)s?/i);
  if (sec) return { min: parseInt(sec[1] || sec[2]) };
  return null;
}

const UNITS = [
  'teaspoons','teaspoon','tsp',
  'tablespoons','tablespoon','tbsp',
  'cups','cup','c',
  'fluid ounces','fluid ounce','fl oz',
  'ounces','ounce','oz',
  'pounds','pound','lb','lbs',
  'grams','gram','g',
  'kilograms','kilogram','kg',
  'milliliters','milliliter','ml',
  'liters','liter','l',
  'pinches','pinch',
  'dashes','dash',
  'cans','can',
  'packages','package','pkg',
  'slices','slice',
  'pieces','piece',
  'cloves','clove',
  'sprigs','sprig',
  'bunches','bunch',
  'stalks','stalk',
  'heads','head',
  'inches','inch',
];

const UNIT_NORMALIZE = {
  'teaspoons': 'tsp',  'teaspoon': 'tsp',
  'tablespoons': 'tbsp', 'tablespoon': 'tbsp',
  'cups': 'cup',
  'fluid ounces': 'fl oz', 'fluid ounce': 'fl oz',
  'ounces': 'oz', 'ounce': 'oz',
  'pounds': 'lb', 'pound': 'lb', 'lbs': 'lb',
  'grams': 'g', 'gram': 'g',
  'kilograms': 'kg', 'kilogram': 'kg',
  'milliliters': 'ml', 'milliliter': 'ml',
  'liters': 'l', 'liter': 'l',
  'pinches': 'pinch',
  'dashes': 'dash',
  'cans': 'can',
  'packages': 'pkg', 'package': 'pkg',
  'slices': 'slice',
  'pieces': 'piece',
  'cloves': 'clove',
  'sprigs': 'sprig',
  'bunches': 'bunch',
  'stalks': 'stalk',
  'heads': 'head',
  'inches': 'inch',
};

// Sort longest first so "tablespoons" matches before "tablespoon"
const UNITS_SORTED = [...UNITS].sort((a, b) => b.length - a.length);
const UNITS_PATTERN = UNITS_SORTED.map(u => u.replace(/\s/g, '\\s')).join('|');
const ING_REGEX = new RegExp(
  `^([\\d½¼¾⅓⅔\\s\\/\\.]+)?\\s*(${UNITS_PATTERN})\\.?\\s+(.+)$`, 'i'
);

function parseIngredientLine(line) {
  const match = line.match(ING_REGEX);
  let quantity = '', unit = '', rest = line.trim();

  if (match) {
    quantity = match[1]?.trim() || '';
    const rawUnit = match[2]?.trim() || '';
    unit     = UNIT_NORMALIZE[rawUnit.toLowerCase()] || rawUnit;
    rest     = match[3]?.trim() || '';
  } else {
    // No unit — try to grab leading number as quantity
    const numMatch = line.match(/^([\d½¼¾⅓⅔/.\s]+)\s+(.+)$/);
    if (numMatch) {
      quantity = numMatch[1].trim();
      rest     = numMatch[2].trim();
    }
  }

  // Split preparation at comma: "onions, chopped" → name="onions", preparation="chopped"
  const commaIdx = rest.indexOf(',');
  let name = rest, preparation = '';
  if (commaIdx > 0) {
    name        = rest.slice(0, commaIdx).trim();
    preparation = rest.slice(commaIdx + 1).trim();
  }

  // Strip filler phrases that aren't real preparation instructions
  const PREP_NOISE = /^(or more as needed|as needed|or to taste|to taste|or more|if needed)$/i;
  if (PREP_NOISE.test(preparation)) preparation = '';

  return {
    id: crypto.randomUUID(),
    quantity, unit, name, preparation,
    packageSize: '',
    calories: null, protein: null, fat: null, carbs: null,
  };
}

module.exports = { decodeHtml, parseDurationFromText, parseIngredientLine };
