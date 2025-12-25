#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const filePath = process.argv[2] || 'examples/machazekei_hadass_manchester/publisher-1.json';

console.log(`Fixing ${filePath}...`);

// Read the JSON
const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

// DSL formula fixes
const dslFixes = {
  // Old syntax -> New syntax mappings
  'visible_sunrise': 'sunrise',
  'visible_sunset': 'sunset',
  'before_visible_sunrise': 'before_sunrise',
  'after_visible_sunset': 'after_sunset',
  'before_sunrise': 'before_sunrise',
  'after_sunrise': 'after_sunrise',
  'before_sunset': 'before_sunset',
  'after_sunset': 'after_sunset',
  // Minutes formatting
  ' - ': ' - ',
  ' + ': ' + ',
  'min': 'min'
};

// Common tag mappings based on zman_key patterns
const getDefaultTags = (zmanKey, category) => {
  const tags = [];

  // Category-based tags
  if (category === 'dawn') tags.push('category_shema');
  if (category === 'shema') tags.push('category_shema');
  if (category === 'tefila') tags.push('category_tefila');
  if (category === 'mincha') tags.push('category_mincha');
  if (category === 'candle_lighting') tags.push('category_candle_lighting');
  if (category === 'havdalah') tags.push('category_havdalah');

  // Key-based tags
  if (zmanKey.includes('shabbos') || zmanKey.includes('shabbat')) {
    tags.push('erev_shabbos');
  }
  if (zmanKey.includes('yom_tov')) {
    tags.push('erev_yom_tov');
  }
  if (zmanKey.includes('candle')) {
    tags.push('category_candle_lighting');
    tags.push('erev_shabbos');
  }
  if (zmanKey.includes('havdalah')) {
    tags.push('category_havdalah');
    tags.push('motzei_shabbos');
  }

  // Remove duplicates
  return [...new Set(tags)];
};

// Fix zmanim
if (data.zmanim && Array.isArray(data.zmanim)) {
  console.log(`Processing ${data.zmanim.length} zmanim...`);

  let tagFormatFixed = 0;

  data.zmanim = data.zmanim.map(zman => {
    // Fix DSL formula
    let formula = zman.formula_dsl;
    if (formula) {
      // Replace old syntax
      formula = formula.replace(/visible_sunrise/g, 'sunrise');
      formula = formula.replace(/visible_sunset/g, 'sunset');
      formula = formula.replace(/before_visible_sunrise/g, 'before_sunrise');
      formula = formula.replace(/after_visible_sunset/g, 'after_sunset');

      zman.formula_dsl = formula;
    }

    // Fix tags format: convert string array to ZmanTag object array
    if (zman.tags && Array.isArray(zman.tags)) {
      if (zman.tags.length > 0 && typeof zman.tags[0] === 'string') {
        zman.tags = zman.tags.map(tagKey => ({
          tag_key: tagKey,
          is_negated: false
        }));
        tagFormatFixed++;
      }
    } else if (!zman.tags || zman.tags.length === 0) {
      // Add missing tags if not present
      const defaultTags = getDefaultTags(zman.zman_key, zman.category);
      zman.tags = defaultTags.map(tagKey => ({
        tag_key: tagKey,
        is_negated: false
      }));
    }

    return zman;
  });

  console.log(`Fixed ${data.zmanim.length} zmanim`);
  console.log(`Fixed tag format in ${tagFormatFixed} zmanim`);
}

// Write back
const outputPath = filePath.replace('.json', '-fixed.json');
fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
console.log(`\nWrote fixed file to: ${outputPath}`);
console.log(`\nSummary:`);
console.log(`- Total zmanim: ${data.zmanim?.length || 0}`);
console.log(`- Zmanim with tags: ${data.zmanim?.filter(z => z.tags && z.tags.length > 0).length || 0}`);
