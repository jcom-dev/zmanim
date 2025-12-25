#!/usr/bin/env node

const fs = require('fs');

// Load master registry from file
const masterRegistryRaw = fs.readFileSync('/tmp/master_registry.txt', 'utf8');
const masterRegistry = {};
const masterRegistryById = {};
masterRegistryRaw.split('\n').forEach(line => {
  const parts = line.trim().split('|');
  if (parts.length === 2) {
    const [id, key] = parts;
    const idNum = parseInt(id);
    masterRegistry[key.trim()] = idNum;
    masterRegistryById[idNum] = key.trim();
  }
});

// Load valid tags from file
const validTagsRaw = fs.readFileSync('/tmp/valid_tags.txt', 'utf8');
const validTags = new Set(
  validTagsRaw.split('\n')
    .map(line => line.trim())
    .filter(Boolean)
);

console.log(`Found ${Object.keys(masterRegistry).length} master zmanim`);
console.log(`Found ${validTags.size} valid tags`);

// Zman key corrections
const zmanKeyFixes = {
  'sunrise': 'visible_sunrise',
  'sunset': 'visible_sunset',
  'misheyakir_bedieved': 'misheyakir_11',
  'sof_zman_tfila_mga_72': 'sof_zman_tfila_mga_72_zmanis'
};

// Load the publisher JSON
const filePath = process.argv[2] || 'examples/machazekei_hadass_manchester/publisher-1.json';
console.log(`\nReading ${filePath}...`);
const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

// Tag mapping based on category
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
  if (zmanKey.includes('_rt') || zmanKey === 'tzais_72') return 'shita_rt';
  if (zmanKey.includes('_baal_hatanya')) return 'shita_baal_hatanya';
  if (zmanKey.includes('_ateret_torah')) return 'shita_ateret_torah';
  if (zmanKey.includes('_yereim')) return 'shita_yereim';
  if (zmanKey.includes('_chazon_ish')) return 'shita_chazon_ish';
  return null;
};

let fixedCount = 0;
let tagFixCount = 0;
let masterIdFixCount = 0;
let zmanKeyFixCount = 0;

if (data.zmanim && Array.isArray(data.zmanim)) {
  console.log(`\nProcessing ${data.zmanim.length} zmanim...\n`);

  data.zmanim = data.zmanim.map(zman => {
    let changed = false;

    // Fix zman_key if needed
    if (zmanKeyFixes[zman.zman_key]) {
      const oldKey = zman.zman_key;
      zman.zman_key = zmanKeyFixes[oldKey];
      console.log(`Fixing zman_key: ${oldKey} -> ${zman.zman_key}`);
      zmanKeyFixCount++;
      changed = true;
    }

    // Fix master_zman_id to match zman_key
    const correctMasterId = masterRegistry[zman.zman_key];
    if (correctMasterId && zman.master_zman_id !== correctMasterId) {
      console.log(`Fixing master_zman_id for ${zman.zman_key}: ${zman.master_zman_id} -> ${correctMasterId}`);
      zman.master_zman_id = correctMasterId;
      masterIdFixCount++;
      changed = true;
    } else if (!correctMasterId) {
      console.log(`WARNING: No master registry entry for ${zman.zman_key}`);
    }

    // Ensure master_zman_id and zman_key are in sync
    if (zman.master_zman_id && masterRegistryById[zman.master_zman_id]) {
      const expectedKey = masterRegistryById[zman.master_zman_id];
      if (zman.zman_key !== expectedKey) {
        console.log(`Syncing zman_key with master_zman_id ${zman.master_zman_id}: ${zman.zman_key} -> ${expectedKey}`);
        zman.zman_key = expectedKey;
        changed = true;
      }
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

      // Filter to only valid tags
      const beforeCount = zman.tags.length;
      tags = zman.tags.filter(tag => {
        const tagKey = tag.tag_key || tag;
        if (validTags.has(tagKey)) {
          return true;
        }
        console.log(`Removing invalid tag "${tagKey}" from ${zman.zman_key}`);
        tagFixCount++;
        return false;
      });

      if (tags.length !== beforeCount) {
        changed = true;
      }
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
    if (zman.zman_key === 'candle_lighting' && validTags.has('day_before')) {
      if (!tags.find(t => t.tag_key === 'day_before')) {
        tags.push({ tag_key: 'day_before', is_negated: false });
        changed = true;
      }
    }

    // Add shabbos tag for shabbos_ends
    if (zman.zman_key === 'shabbos_ends' && validTags.has('shabbos')) {
      if (!tags.find(t => t.tag_key === 'shabbos')) {
        tags.push({ tag_key: 'shabbos', is_negated: false });
        changed = true;
      }
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
const backupPath = filePath + '.backup-final-' + Date.now();
console.log(`\nCreating backup at ${backupPath}...`);
fs.copyFileSync(filePath, backupPath);

console.log(`Writing fixed JSON to ${filePath}...`);
fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

console.log('\n=== Summary ===');
console.log(`Total zmanim: ${data.zmanim?.length || 0}`);
console.log(`Zmanim fixed: ${fixedCount}`);
console.log(`Zman keys corrected: ${zmanKeyFixCount}`);
console.log(`Master IDs corrected: ${masterIdFixCount}`);
console.log(`Invalid tags removed: ${tagFixCount}`);
console.log(`Zmanim with tags: ${data.zmanim?.filter(z => z.tags && z.tags.length > 0).length || 0}`);
console.log('\nDone!');
