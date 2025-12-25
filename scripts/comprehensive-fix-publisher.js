#!/usr/bin/env node

const fs = require('fs');
const { execSync } = require('child_process');

// Load .env and get DB connection
const envPath = 'api/.env';
const env = fs.readFileSync(envPath, 'utf8')
  .split('\n')
  .filter(line => line.includes('='))
  .reduce((acc, line) => {
    const [key, ...values] = line.split('=');
    acc[key.trim()] = values.join('=').trim().replace(/^["']|["']$/g, '');
    return acc;
  }, {});

const dbUrl = env.DATABASE_URL;

// Get master registry from DB
console.log('Fetching master_zmanim_registry from database...');
const masterRegistryRaw = execSync(
  `psql "${dbUrl}" -t -c "SELECT id, zman_key FROM master_zmanim_registry ORDER BY id;"`
).toString();

const masterRegistry = {};
masterRegistryRaw.split('\n').forEach(line => {
  const match = line.trim().match(/^(\d+)\s*\|\s*(.+)$/);
  if (match) {
    const [, id, key] = match;
    masterRegistry[key.trim()] = parseInt(id);
  }
});

// Get tags from DB
console.log('Fetching zman_tags from database...');
const tagsRaw = execSync(
  `psql "${dbUrl}" -t -c "SELECT id, tag_key FROM zman_tags ORDER BY id;"`
).toString();

const validTags = new Set();
tagsRaw.split('\n').forEach(line => {
  const match = line.trim().match(/^(\d+)\s*\|\s*(.+)$/);
  if (match) {
    const [, id, key] = match;
    validTags.add(key.trim());
  }
});

console.log(`Found ${Object.keys(masterRegistry).length} master zmanim`);
console.log(`Found ${validTags.size} valid tags`);

// Load the publisher JSON
const filePath = process.argv[2] || 'examples/machazekei_hadass_manchester/publisher-1.json';
console.log(`\nReading ${filePath}...`);
const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

// Tag mapping based on category and zman_key
const getCategoryTag = (category) => {
  const categoryMap = {
    'dawn': 'category_shema',
    'shema': 'category_shema',
    'tefila': 'category_tefila',
    'mincha': 'category_mincha',
    'candle_lighting': 'category_candle_lighting',
    'havdalah': 'category_havdalah',
    'fast_start': 'category_fast_start',
    'fast_end': 'category_fast_end',
    'chametz': 'category_chametz',
    'kiddush_levana': 'category_kiddush_levana',
    'tisha_bav_fast_start': 'category_tisha_bav_fast_start',
    'tisha_bav_fast_end': 'category_tisha_bav_fast_end'
  };
  return categoryMap[category];
};

const getShitaTag = (zmanKey) => {
  if (zmanKey.includes('_gra')) return 'shita_gra';
  if (zmanKey.includes('_mga')) return 'shita_mga';
  if (zmanKey.includes('_rt') || zmanKey.includes('_72')) return 'shita_rt';
  if (zmanKey.includes('_baal_hatanya')) return 'shita_baal_hatanya';
  if (zmanKey.includes('_ateret_torah')) return 'shita_ateret_torah';
  if (zmanKey.includes('_yereim')) return 'shita_yereim';
  if (zmanKey.includes('_chazon_ish')) return 'shita_chazon_ish';
  return null;
};

// Tag replacement mapping for invalid tags
const tagReplacements = {
  'chol_hamoed_sukkos': 'sukkos',
  'hoshanah_rabbah': 'sukkos',
  'yom_tov': null, // Will be handled by specific holiday tags
  'fast_day': null, // Generic, will be removed
  'category_dawn': 'category_shema',
  'erev_shabbos': 'day_before', // or keep as is if it's for Friday
  'motzei_shabbos': 'shabbos'
};

let fixedCount = 0;
let tagFixCount = 0;
let masterIdFixCount = 0;

if (data.zmanim && Array.isArray(data.zmanim)) {
  console.log(`\nProcessing ${data.zmanim.length} zmanim...\n`);

  data.zmanim = data.zmanim.map(zman => {
    let changed = false;

    // Fix master_zman_id
    const correctMasterId = masterRegistry[zman.zman_key];
    if (correctMasterId && zman.master_zman_id !== correctMasterId) {
      console.log(`Fixing master_zman_id for ${zman.zman_key}: ${zman.master_zman_id} -> ${correctMasterId}`);
      zman.master_zman_id = correctMasterId;
      masterIdFixCount++;
      changed = true;
    }

    // Fix tags
    let tags = [];

    if (zman.tags && Array.isArray(zman.tags)) {
      // Convert string tags to objects if needed
      if (zman.tags.length > 0 && typeof zman.tags[0] === 'string') {
        zman.tags = zman.tags.map(tagKey => ({
          tag_key: tagKey,
          is_negated: false
        }));
        changed = true;
      }

      // Filter and fix tags
      tags = zman.tags
        .map(tag => {
          const tagKey = tag.tag_key || tag;

          // Replace invalid tags
          if (tagReplacements.hasOwnProperty(tagKey)) {
            const replacement = tagReplacements[tagKey];
            if (replacement && validTags.has(replacement)) {
              return { tag_key: replacement, is_negated: tag.is_negated || false };
            }
            return null; // Remove invalid tag
          }

          // Keep only valid tags
          if (validTags.has(tagKey)) {
            return { tag_key: tagKey, is_negated: tag.is_negated || false };
          }

          console.log(`Removing invalid tag "${tagKey}" from ${zman.zman_key}`);
          tagFixCount++;
          return null;
        })
        .filter(Boolean);
    }

    // Add category tag if missing
    const categoryTag = getCategoryTag(zman.category);
    if (categoryTag && validTags.has(categoryTag)) {
      if (!tags.find(t => t.tag_key === categoryTag)) {
        tags.push({ tag_key: categoryTag, is_negated: false });
        changed = true;
      }
    }

    // Add shita tag if applicable
    const shitaTag = getShitaTag(zman.zman_key);
    if (shitaTag && validTags.has(shitaTag)) {
      if (!tags.find(t => t.tag_key === shitaTag)) {
        tags.push({ tag_key: shitaTag, is_negated: false });
        changed = true;
      }
    }

    // Add day_before tag for candle lighting
    if (zman.zman_key === 'candle_lighting' && !tags.find(t => t.tag_key === 'day_before')) {
      tags.push({ tag_key: 'day_before', is_negated: false });
      changed = true;
    }

    // Add shabbos tag for shabbos-related zmanim
    if ((zman.zman_key.includes('shabbos') || zman.zman_key === 'candle_lighting')
        && !tags.find(t => t.tag_key === 'shabbos')) {
      tags.push({ tag_key: 'shabbos', is_negated: false });
      changed = true;
    }

    // Remove duplicates
    const uniqueTags = [];
    const seen = new Set();
    tags.forEach(tag => {
      const key = `${tag.tag_key}:${tag.is_negated}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueTags.push(tag);
      }
    });

    zman.tags = uniqueTags.length > 0 ? uniqueTags : null;

    if (changed) {
      fixedCount++;
    }

    return zman;
  });
}

// Write output
const backupPath = filePath + '.backup-' + Date.now();
console.log(`\nCreating backup at ${backupPath}...`);
fs.copyFileSync(filePath, backupPath);

console.log(`Writing fixed JSON to ${filePath}...`);
fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

console.log('\n=== Summary ===');
console.log(`Total zmanim: ${data.zmanim?.length || 0}`);
console.log(`Zmanim fixed: ${fixedCount}`);
console.log(`Master IDs corrected: ${masterIdFixCount}`);
console.log(`Invalid tags removed: ${tagFixCount}`);
console.log(`Zmanim with tags: ${data.zmanim?.filter(z => z.tags && z.tags.length > 0).length || 0}`);
console.log('\nDone!');
