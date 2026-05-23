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

module.exports = { decodeHtml, parseDurationFromText };
