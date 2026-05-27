require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const MARKET_CHANNEL_ID = process.env.MARKET_CHANNEL_ID;
const BASE_URL = 'https://revenantelegy.com/api/v1.0/market';
const DB_URL = 'https://revenantelegy.com/api/v1.0';
const ITEM_PAGE_BASE = 'https://revenantelegy.com/market/item';
const DB_ITEM_PAGE_BASE = 'https://revenantelegy.com/database/item';
const SCAN_INTERVAL_MS = (parseInt(process.env.SCAN_INTERVAL_MINUTES) || 15) * 60 * 1000;
const DEAL_THRESHOLD = 0.10; // 90% off

const LEGEND = [
  '`@ws <name or id>` — who sells (cheapest listings + location)',
  '`@ph <name or id>` — historical pricing',
  '`@ii <name or id>` — item info & search',
  '`@whodrops <name or id>` or `@wd <name or id>` — which monsters drop this item',
  '`@mi <name or id>` — monster info',
  '`@optionslist` or `@ol` — list all random option IDs & names',
].join('\n');

// ─── Option maps ──────────────────────────────────────────────────────────
const OPTION_MAP = {
  1: 'HP', 2: 'SP', 3: 'STR', 4: 'AGI', 5: 'VIT', 6: 'INT', 7: 'DEX', 8: 'LUK',
  16: 'ASPD %', 17: 'ATK', 18: 'HIT', 19: 'MATK', 20: 'DEF', 21: 'MDEF',
  23: 'Perfect Dodge', 24: 'Crit Chance', 164: '% Crit Damage',
  168: 'Healing Effectiveness', 170: 'Cast Time Reduction', 171: 'After Cast Delay',
  255: 'Freeze Resist', 256: 'Stone Curse Resist', 172: 'SP Consumption',
  150: '% Resist Boss', 167: '% Resist Long Range', 193: '% Resist All Elements',
  257: '% Resist All Sizes', 258: '% Resist All Races',
  160: '% Resist Small', 161: '% Resist Medium', 162: '% Resist Large',
  25: '% Resist Neutral Element', 26: '% Resist Water Element', 27: '% Resist Earth Element',
  28: '% Resist Fire Element', 29: '% Resist Wind Element', 30: '% Resist Poison Element',
  31: '% Resist Holy Element', 32: '% Resist Shadow Element', 33: '% Resist Ghost Element',
  87: '% Resist Formless Race', 88: '% Resist Undead Race', 89: '% Resist Brute Race',
  90: '% Resist Plant Race', 91: '% Resist Insect Race', 92: '% Resist Fish Race',
  93: '% Resist Demon Race', 94: '% Resist Demi-Human Race', 95: '% Resist Angel Race',
  96: '% Resist Dragon Race',
  37: '% Physical Damage to Neutral', 39: '% Physical Damage to Water',
  41: '% Physical Damage to Earth', 43: '% Physical Damage to Fire',
  45: '% Physical Damage to Wind', 47: '% Physical Damage to Poison',
  49: '% Physical Damage to Holy', 51: '% Physical Damage to Shadow',
  53: '% Physical Damage to Ghost', 55: '% Physical Damage to Undead (element)',
  57: '% Magical Damage to Neutral', 59: '% Magical Damage to Water',
  61: '% Magical Damage to Earth', 63: '% Magical Damage to Fire',
  65: '% Magical Damage to Wind', 67: '% Magical Damage to Poison',
  69: '% Magical Damage to Holy', 71: '% Magical Damage to Shadow',
  73: '% Magical Damage to Ghost', 75: '% Magical Damage to Undead (element)',
  97: '% Physical Damage to Formless', 98: '% Physical Damage to Undead (race)',
  99: '% Physical Damage to Brute', 100: '% Physical Damage to Plant',
  101: '% Physical Damage to Insect', 102: '% Physical Damage to Fish',
  103: '% Physical Damage to Demon', 104: '% Physical Damage to Demi-Human',
  105: '% Physical Damage to Angel', 106: '% Physical Damage to Dragon',
  107: '% Magical Damage to Formless', 108: '% Magical Damage to Undead (race)',
  109: '% Magical Damage to Brute', 110: '% Magical Damage to Plant',
  111: '% Magical Damage to Insect', 112: '% Magical Damage to Fish',
  113: '% Magical Damage to Demon', 114: '% Magical Damage to Demi-Human',
  115: '% Magical Damage to Angel', 116: '% Magical Damage to Dragon',
  279: '% Incoming Healing', 280: 'Movement Speed',
};

const OPTION_ALIASES = {
  'hp': 1, 'sp': 2, 'str': 3, 'agi': 4, 'vit': 5, 'int': 6, 'dex': 7, 'luk': 8,
  'aspd': 16, 'atk': 17, 'hit': 18, 'matk': 19, 'def': 20, 'mdef': 21,
  'pdodge': 23, 'crit': 24, 'critdmg': 164, 'heal': 168,
  'cast': 170, 'delay': 171, 'freeze': 255, 'sc': 256, 'stone': 256,
  'spcons': 172, 'boss': 150, 'long': 167, 'allres': 193,
  'allsize': 257, 'allrace': 258, 'small': 160, 'medium': 161, 'large': 162,
};

// ─── Caches ────────────────────────────────────────────────────────────────
const nameCache = new Map();  // nameid -> item_name (from market)
const nameToId = new Map();   // normalized name -> nameid

// Full mob DB — all pages loaded on startup
let mobCache = [];
let mobCacheLoaded = false;
let mobCacheLoading = false;

// Item index built from mob drops
let itemIndex = new Map();   // item_id (number) -> { id, name, slots }
let itemNameIndex = new Map(); // normalized name -> [item_id, ...]

let alertedDealsThisCycle = new Set();

// ─── Utilities ────────────────────────────────────────────────────────────
function normalize(str) { return str.toLowerCase().trim(); }

function median(prices) {
  if (prices.length === 0) return 0;
  const sorted = [...prices].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function formatPrice(p) {
  if (p >= 1_000_000) return `${(p / 1_000_000).toFixed(2)}M z`;
  if (p >= 1_000) return `${(p / 1_000).toFixed(1)}k z`;
  return `${p} z`;
}

function formatDropRate(rate) {
  return `${(rate / 100).toFixed(2)}%`;
}

function itemImageUrl(nameid) {
  return `https://static.divine-pride.net/images/items/item/${nameid}.png`;
}

function itemPageUrl(nameid) {
  return `${ITEM_PAGE_BASE}/${nameid}`;
}

function dbItemPageUrl(nameid) {
  return `${DB_ITEM_PAGE_BASE}/${nameid}`;
}

// ─── Option filter parser ──────────────────────────────────────────────────
function parseWsQuery(fullQuery) {
  const parts = fullQuery.trim().split(/\s+/);
  const filters = [];
  let itemParts = [];

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const num = parseInt(part);

    if (!isNaN(num) && OPTION_MAP[num]) {
      const value = parseInt(parts[i + 1]);
      if (!isNaN(value)) { filters.push({ id: num, value }); i++; continue; }
    }

    const aliasId = OPTION_ALIASES[normalize(part)];
    if (aliasId !== undefined) {
      const value = parseInt(parts[i + 1]);
      if (!isNaN(value)) { filters.push({ id: aliasId, value }); i++; continue; }
    }

    const lower = normalize(part);
    let found = false;
    for (const [idStr, label] of Object.entries(OPTION_MAP)) {
      if (normalize(label).includes(lower)) {
        const value = parseInt(parts[i + 1]);
        if (!isNaN(value)) { filters.push({ id: parseInt(idStr), value }); i++; found = true; break; }
      }
    }
    if (!found) itemParts.push(part);
  }

  return { itemQuery: itemParts.join(' '), filters };
}

function hasAllFilters(listing, targetFilters) {
  if (!targetFilters || targetFilters.length === 0) return true;
  if (!Array.isArray(listing.options) || listing.options.length === 0) return false;
  return targetFilters.every(f => listing.options.some(o => o.id === f.id && o.value >= f.value));
}

// ─── Listing block formatter ───────────────────────────────────────────────
function buildListingBlock(listing, opts = {}) {
  const { nameid, item_name, medianPrice, discount, isWs = false } = opts;
  const lines = [];

  const refinePrefix = listing.refine ? `+${listing.refine} ` : '';
  const displayName = item_name || listing.item_name || `Item #${nameid}`;
  const url = itemPageUrl(nameid || listing.nameid);
  lines.push(`${refinePrefix}[${displayName}](${url})`);

  if (Array.isArray(listing.cards) && listing.cards.length > 0)
    lines.push(`🃏 ${listing.cards.map(c => c.name).join(' | ')}`);

  if (Array.isArray(listing.options) && listing.options.length > 0) {
    lines.push('🎲 Options:');
    for (const o of listing.options) lines.push(`↳ ${o.label} ${o.value}`);
  }

  lines.push('');

  if (!isWs && discount !== undefined) lines.push(`🏷️ Discount: **-${discount}%**`);

  if (isWs) {
    lines.push(`💰 **${formatPrice(listing.price)}** x${listing.amount || 1}`);
  } else {
    lines.push(`💰 Sale Price: **${formatPrice(listing.price)}**`);
    lines.push(`📊 Average Price: **${formatPrice(medianPrice)}**`);
  }

  lines.push('');

  const shop = listing.shop_title || listing.char_name || 'Unknown';
  const navi = listing.map ? `/navi ${listing.map} ${listing.x} ${listing.y}` : '';
  lines.push(`🏪 ${shop}${navi ? ` \`${navi}\`` : ''}`);

  return lines;
}

// ─── API helpers ───────────────────────────────────────────────────────────
async function fetchPage(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function fetchItemListings(nameid) {
  let page = 1;
  const listings = [];
  while (true) {
    const data = await fetchPage(`${BASE_URL}/?nameid=${nameid}&page=${page}&page_size=50`);
    const results = data.results || data;
    if (!Array.isArray(results) || results.length === 0) break;
    listings.push(...results);
    if (!data.pages || page >= data.pages) break;
    page++;
    if (page > 20) break;
  }
  return listings;
}

async function* fetchAllListingsPages() {
  let page = 1;
  while (true) {
    let data;
    try { data = await fetchPage(`${BASE_URL}/?page=${page}&page_size=50`); }
    catch (e) { console.error(`Error fetching page ${page}:`, e.message); break; }
    const results = data.results || data;
    if (!Array.isArray(results) || results.length === 0) break;
    yield results;
    if (!data.pages || page >= data.pages) break;
    page++;
  }
}

async function buildNameCache() {
  console.log('[Market] Building name cache...');
  let count = 0;
  for await (const page of fetchAllListingsPages()) {
    for (const item of page) {
      if (item.nameid && item.item_name) {
        nameCache.set(item.nameid, item.item_name);
        nameToId.set(normalize(item.item_name), item.nameid);
      }
    }
    if (++count >= 10) break;
  }
  console.log(`[Market] Name cache: ${nameCache.size} items`);
}

async function loadMobCache() {
  if (mobCacheLoaded || mobCacheLoading) return;
  mobCacheLoading = true;
  console.log('[Market] Loading full mob DB...');

  try {
    const first = await fetchPage(`${DB_URL}/mobs/?page=1&page_size=50`);
    const totalPages = first.pages || 1;
    console.log(`[Market] Mob DB: ${first.total} mobs across ${totalPages} pages`);

    mobCache.push(...(first.results || []));

    for (let p = 2; p <= totalPages; p += 5) {
      const batch = [];
      for (let b = p; b < p + 5 && b <= totalPages; b++) {
        batch.push(fetchPage(`${DB_URL}/mobs/?page=${b}&page_size=50`));
      }
      const results = await Promise.all(batch);
      for (const r of results) mobCache.push(...(r.results || []));
    }

    for (const mob of mobCache) {
      const allDrops = [
        ...(mob.Drops || []),
        ...(mob.MvpDrops || []),
      ];
      for (const drop of allDrops) {
        if (!drop.item_id || !drop.item_name) continue;
        if (!itemIndex.has(drop.item_id)) {
          itemIndex.set(drop.item_id, { id: drop.item_id, name: drop.item_name, slots: drop.item_slots || 0 });
          const key = normalize(drop.item_name);
          if (!itemNameIndex.has(key)) itemNameIndex.set(key, []);
          itemNameIndex.get(key).push(drop.item_id);
        }
      }
    }

    mobCacheLoaded = true;
    console.log(`[Market] Mob DB loaded: ${mobCache.length} mobs, ${itemIndex.size} unique items indexed`);
  } catch (e) {
    console.error('[Market] Failed to load mob DB:', e.message);
    mobCacheLoading = false;
  }
}

function resolveItem(query) {
  const asNum = parseInt(query);
  if (!isNaN(asNum)) return asNum;
  const exactId = nameToId.get(normalize(query));
  if (exactId) return exactId;
  const fromIndex = itemNameIndex.get(normalize(query));
  if (fromIndex && fromIndex.length > 0) return fromIndex[0];

  const lowerQ = normalize(query);
  for (const [name, id] of nameToId.entries()) {
    if (name.includes(lowerQ)) return id;
  }
  for (const [name, ids] of itemNameIndex.entries()) {
    if (name.includes(lowerQ)) return ids[0];
  }
  return null;
}

function searchItems(query) {
  const asNum = parseInt(query);
  if (!isNaN(asNum)) {
    const item = itemIndex.get(asNum);
    return item ? [item] : [];
  }

  const lowerQ = normalize(query);
  const seen = new Set();
  const results = [];

  for (const [name, ids] of itemNameIndex.entries()) {
    if (name === lowerQ) {
      for (const id of ids) {
        if (!seen.has(id)) { seen.add(id); results.push(itemIndex.get(id)); }
      }
    }
  }
  for (const [name, ids] of itemNameIndex.entries()) {
    if (name !== lowerQ && name.includes(lowerQ)) {
      for (const id of ids) {
        if (!seen.has(id)) { seen.add(id); results.push(itemIndex.get(id)); }
      }
    }
  }

  return results.filter(Boolean);
}

function findMobDrops(query) {
  const asNum = parseInt(query);
  const lowerQ = normalize(query);
  const results = [];

  for (const mob of mobCache) {
    for (const drop of (mob.Drops || [])) {
      const matchById = !isNaN(asNum) && drop.item_id === asNum;
      const matchByName = isNaN(asNum) && normalize(drop.item_name || '').includes(lowerQ);
      if (matchById || matchByName) results.push({ mob, drop, isMvp: false });
    }
    for (const drop of (mob.MvpDrops || [])) {
      const matchById = !isNaN(asNum) && drop.item_id === asNum;
      const matchByName = isNaN(asNum) && normalize(drop.item_name || '').includes(lowerQ);
      if (matchById || matchByName) results.push({ mob, drop, isMvp: true });
    }
  }

  results.sort((a, b) => b.drop.rate - a.drop.rate);
  return results;
}

// ─── Deal scanner ─────────────────────────────────────────────────────────
async function scanForDeals(channel) {
  console.log('[Market] Scanning for deals...');
  alertedDealsThisCycle = new Set();
  const byItem = new Map();

  for await (const page of fetchAllListingsPages()) {
    for (const item of page) {
      if (!item.nameid || !item.price || !item.amount) continue;
      if (item.item_name) {
        nameCache.set(item.nameid, item.item_name);
        nameToId.set(normalize(item.item_name), item.nameid);
      }
      if (!byItem.has(item.nameid)) {
        byItem.set(item.nameid, { item_name: item.item_name || `Item #${item.nameid}`, prices: [], cheapest: null });
      }
      const entry = byItem.get(item.nameid);
      entry.prices.push(item.price);
      if (!entry.cheapest || item.price < entry.cheapest.price) entry.cheapest = item;
    }
  }

  const deals = [];
  for (const [nameid, entry] of byItem.entries()) {
    if (entry.prices.length < 2) continue;
    const med = median(entry.prices);
    if (med <= 0) continue;
    const minPrice = Math.min(...entry.prices);
    if (minPrice <= med * DEAL_THRESHOLD) {
      const dealKey = `${nameid}_${minPrice}`;
      if (!alertedDealsThisCycle.has(dealKey)) {
        alertedDealsThisCycle.add(dealKey);
        deals.push({ nameid, item_name: entry.item_name, minPrice, medianPrice: med, cheapest: entry.cheapest });
      }
    }
  }

  if (deals.length === 0) { console.log('[Market] No deals found.'); return; }
  deals.sort((a, b) => (a.minPrice / a.medianPrice) - (b.minPrice / b.medianPrice));

  const dealBlocks = deals.map(({ nameid, item_name, minPrice, medianPrice, cheapest }) => {
    const discount = Math.round((1 - minPrice / medianPrice) * 100);
    return buildListingBlock(cheapest, { nameid, item_name, medianPrice, discount, isWs: false }).join('\n');
  });

  const chunks = [];
  let current = '';
  for (const block of dealBlocks) {
    const candidate = current ? current + '\n\n' + block : block;
    if (candidate.length > 3800) { chunks.push(current); current = block; }
    else current = candidate;
  }
  if (current) chunks.push(current);

  for (let i = 0; i < chunks.length; i++) {
    const embed = new EmbedBuilder()
      .setTitle(i === 0 ? `🔥 Market Deals (${deals.length})` : `🔥 Market Deals (cont.)`)
      .setColor(0xf1c40f)
      .setDescription(chunks[i])
      .setTimestamp();
    if (i === chunks.length - 1) embed.addFields({ name: '📋 Commands', value: LEGEND });
    await channel.send({ embeds: [embed] });
    await new Promise(r => setTimeout(r, 1500));
  }
}

// ─── @ws ───────────────────────────────────────────────────────────────────
async function handleWhoSells(message, fullQuery) {
  const { itemQuery, filters } = parseWsQuery(fullQuery);
  if (!itemQuery) return message.reply('❌ Please specify an item name or ID.');

  const nameid = resolveItem(itemQuery);
  if (!nameid) return message.reply(`❌ Item \`${itemQuery}\` not found.`);

  let listings;
  try { listings = await fetchItemListings(nameid); }
  catch (e) { return message.reply('❌ Failed to fetch market data.'); }

  const item_name = listings[0]?.item_name || nameCache.get(nameid) || itemIndex.get(nameid)?.name || `Item #${nameid}`;
  if (listings.length === 0) return message.reply(`📦 No one is selling **${item_name}** right now.`);

  let filtered = filters.length > 0 ? listings.filter(l => hasAllFilters(l, filters)) : listings;
  if (filters.length > 0 && filtered.length === 0) {
    const ft = filters.map(f => `${OPTION_MAP[f.id] || f.id} ≥ ${f.value}`).join(', ');
    return message.reply(`📦 No listings for **${item_name}** with filters: **${ft}**`);
  }

  const sorted = filtered.sort((a, b) => a.price - b.price).slice(0, 8);
  const med = median(filtered.map(l => l.price));
  const filterText = filters.length > 0 ? ` [${filters.map(f => `${OPTION_MAP[f.id] || f.id} ≥ ${f.value}`).join(' + ')}]` : '';

  const embed = new EmbedBuilder()
    .setTitle(`🛒 ${item_name} (${nameid})${filterText}`)
    .setURL(itemPageUrl(nameid))
    .setColor(0x2ecc71)
    .setThumbnail(itemImageUrl(nameid))
    .setDescription(sorted.map(l => buildListingBlock(l, { nameid, item_name, isWs: true }).join('\n')).join('\n\n'))
    .addFields(
      { name: '📊 Average Price', value: formatPrice(med), inline: true },
      { name: '📦 Total Listings', value: `${filtered.length}`, inline: true },
      { name: '📋 Commands', value: LEGEND, inline: false }
    )
    .setFooter({ text: `Showing cheapest ${sorted.length} of ${filtered.length}` });

  return message.reply({ embeds: [embed] });
}

// ─── @ph ───────────────────────────────────────────────────────────────────
async function handlePriceHistory(message, query) {
  const nameid = resolveItem(query);
  if (!nameid) return message.reply(`❌ Item \`${query}\` not found.`);

  let history;
  try {
    const res = await fetch(`${BASE_URL}/history/?nameid=${nameid}`);
    history = await res.json();
  } catch (e) { return message.reply('❌ Failed to fetch price history.'); }

  const item_name = nameCache.get(nameid) || itemIndex.get(nameid)?.name || `Item #${nameid}`;
  const results = history.results || history;

  if (!Array.isArray(results) || results.length === 0)
    return message.reply(`📦 No price history for **[${item_name}](${itemPageUrl(nameid)})**.`);

  const recent = results.slice(0, 10);
  const prices = recent.map(r => r.price);
  const med = median(prices);

  const embed = new EmbedBuilder()
    .setTitle(`📈 Price History: ${item_name} (${nameid})`)
    .setURL(itemPageUrl(nameid))
    .setColor(0x9b59b6)
    .setThumbnail(itemImageUrl(nameid))
    .setDescription(recent.map(r => {
      const date = r.listed_at ? `<t:${Math.floor(new Date(r.listed_at).getTime() / 1000)}:d>` : '?';
      return `**${formatPrice(r.price)}** x${r.amount || 1} — ${date}`;
    }).join('\n'))
    .addFields(
      { name: '📊 Median', value: formatPrice(med), inline: true },
      { name: '📉 Lowest', value: formatPrice(Math.min(...prices)), inline: true },
      { name: '📈 Highest', value: formatPrice(Math.max(...prices)), inline: true },
      { name: '📋 Commands', value: LEGEND, inline: false }
    )
    .setFooter({ text: `Last ${recent.length} sales` });

  return message.reply({ embeds: [embed] });
}

// ─── @ii — Item Info ───────────────────────────────────────────────────────
async function handleItemInfo(message, query) {
  if (!mobCacheLoaded) {
    await message.reply('⏳ Item database is still loading, please try again in a few seconds.');
    return;
  }

  const matches = searchItems(query);

  if (matches.length === 0) {
    const nameid = resolveItem(query);
    if (!nameid) return message.reply(`❌ Item \`${query}\` not found.`);
    const name = nameCache.get(nameid) || `Item #${nameid}`;
    return message.reply({ embeds: [
      new EmbedBuilder()
        .setTitle(`📦 ${name} (${nameid})`)
        .setURL(dbItemPageUrl(nameid))
        .setColor(0x3498db)
        .setThumbnail(itemImageUrl(nameid))
        .addFields(
          { name: 'Item ID', value: `${nameid}`, inline: true },
          { name: '📋 Commands', value: LEGEND, inline: false }
        )
    ]});
  }

  if (matches.length > 1) {
    const lines = matches.slice(0, 25).map(item => {
      const slots = item.slots > 0 ? ` [${item.slots}]` : '';
      return `• **[${item.name}${slots}](${dbItemPageUrl(item.id)})** — ID: \`${item.id}\``;
    });

    return message.reply({ embeds: [
      new EmbedBuilder()
        .setTitle(`🔍 Items matching "${query}" (${matches.length})`)
        .setColor(0x3498db)
        .setDescription(lines.join('\n'))
        .addFields({ name: '📋 Commands', value: LEGEND })
        .setFooter({ text: matches.length > 25 ? `Showing 25 of ${matches.length} — use item ID for exact match` : `${matches.length} results` })
    ]});
  }

  const item = matches[0];
  const slots = item.slots > 0 ? ` [${item.slots}]` : '';

  return message.reply({ embeds: [
    new EmbedBuilder()
      .setTitle(`📦 ${item.name}${slots}`)
      .setURL(dbItemPageUrl(item.id))
      .setColor(0x3498db)
      .setThumbnail(itemImageUrl(item.id))
      .addFields(
        { name: 'Item ID', value: `${item.id}`, inline: true },
        { name: 'Slots', value: `${item.slots}`, inline: true },
        { name: '📋 Commands', value: LEGEND, inline: false }
      )
  ]});
}

// ─── @whodrops / @wd ───────────────────────────────────────────────────────
async function handleWhoDrops(message, query) {
  if (!mobCacheLoaded) {
    await message.reply('⏳ Monster database is still loading, please try again in a few seconds.');
    return;
  }

  const results = findMobDrops(query);

  if (results.length === 0)
    return message.reply(`❌ No monsters found dropping \`${query}\`.`);

  const itemName = results[0].drop.item_name || query;
  const itemId = results[0].drop.item_id;

  const mvpDrops = results.filter(r => r.isMvp);
  const normalDrops = results.filter(r => !r.isMvp);

  const formatEntry = ({ mob, drop }) =>
    `**${mob.Name}** (ID: ${mob.Id}) — **${formatDropRate(drop.rate)}**${drop.steal_protected ? ' 🔒' : ''}`;

  const lines = [];
  if (mvpDrops.length > 0) {
    lines.push('**⭐ MVP Drops:**');
    lines.push(...mvpDrops.map(formatEntry));
    lines.push('');
  }
  if (normalDrops.length > 0) {
    lines.push(`**🗡️ Normal Drops (${normalDrops.length}):**`);
    lines.push(...normalDrops.map(formatEntry));
  }

  const description = lines.join('\n');
  const truncated = description.length > 3900;

  const embed = new EmbedBuilder()
    .setTitle(`🎯 Who Drops: ${itemName} (${itemId})`)
    .setURL(dbItemPageUrl(itemId))
    .setColor(0xe67e22)
    .setThumbnail(itemImageUrl(itemId))
    .setDescription(truncated ? description.slice(0, 3900) + '\n...' : description)
    .addFields({ name: '📋 Commands', value: LEGEND })
    .setFooter({ text: `${results.length} monster(s) | 🔒 steal protected | ⭐ MVP drop` });

  return message.reply({ embeds: [embed] });
}

// ─── @optionslist / @ol ────────────────────────────────────────────────────
async function handleOptionsList(message) {
  const entries = Object.entries(OPTION_MAP);
  const half = Math.ceil(entries.length / 2);
  const col1 = entries.slice(0, half).map(([id, name]) => `\`${String(id).padStart(3)}\` ${name}`).join('\n');
  const col2 = entries.slice(half).map(([id, name]) => `\`${String(id).padStart(3)}\` ${name}`).join('\n');

  const embed = new EmbedBuilder()
    .setTitle('🎲 Random Option IDs')
    .setColor(0x9b59b6)
    .addFields(
      { name: 'Options', value: col1, inline: true },
      { name: '\u200B', value: col2, inline: true },
      { name: '💡 Usage', value: '`@ws <item> <option_id> <min_value>` — e.g. `@ws knife 17 50` (ATK ≥ 50)\nAliases also work: `atk`, `hp`, `mdef`, `crit`, `sc`, `aspd`, etc.', inline: false }
    );

  return message.reply({ embeds: [embed] });
}

// ─── @mi — Mob Info ────────────────────────────────────────────────────────
async function handleMobInfo(message, query) {
  if (!mobCacheLoaded) {
    await message.reply('⏳ Monster database is still loading, please try again in a few seconds.');
    return;
  }

  const asNum = parseInt(query);
  const lowerQ = normalize(query);

  let matches = [];
  if (!isNaN(asNum)) {
    matches = mobCache.filter(m => m.Id === asNum);
  } else {
    matches = mobCache.filter(m => normalize(m.Name).includes(lowerQ));
  }

  if (matches.length === 0)
    return message.reply(`❌ No monster found for \`${query}\`.`);

  if (matches.length > 1) {
    const lines = matches.slice(0, 25).map(m => `• **${m.Name}** — ID: \`${m.Id}\` | Lv.${m.Level} | ${m.Race} | ${m.Element} ${m.ElementLevel}`);
    return message.reply({ embeds: [
      new EmbedBuilder()
        .setTitle(`🔍 Monsters matching "${query}" (${matches.length})`)
        .setColor(0xe74c3c)
        .setDescription(lines.join('\n'))
        .addFields({ name: '📋 Commands', value: LEGEND })
        .setFooter({ text: matches.length > 25 ? `Showing 25 of ${matches.length} — use mob ID for exact match` : `${matches.length} results` })
    ]});
  }

  const mob = matches[0];

  const formatDropLine = (drop, isMvp = false) => {
    const star = isMvp ? '⭐ ' : '';
    const lock = drop.steal_protected ? ' 🔒' : '';
    return `${star}**${drop.item_name}** (${drop.item_id})${lock} — ${formatDropRate(drop.rate)}`;
  };

  const allDrops = [
    ...(mob.MvpDrops || []).map(d => formatDropLine(d, true)),
    ...(mob.Drops || []).map(d => formatDropLine(d, false)),
  ];

  const dropText = allDrops.length > 0 ? allDrops.join('\n') : 'No drops';

  const statsText = [
    `STR: **${mob.Str ?? '?'}** | AGI: **${mob.Agi ?? '?'}** | VIT: **${mob.Vit ?? '?'}**`,
    `INT: **${mob.Int ?? '?'}** | DEX: **${mob.Dex ?? '?'}** | LUK: **${mob.Luk ?? '?'}**`,
    `ATK: **${mob.Attack ?? '?'}~${mob.Attack2 ?? '?'}** | DEF: **${mob.Defense ?? '?'}**`,
    `Range: **${mob.AttackRange ?? '?'}** | Size: **${mob.Size ?? '?'}**`,
    `Hit (100%): **${mob['100hit'] ?? '?'}** | Flee (95%): **${mob['95flee'] ?? '?'}**`,
  ].join('\n');

  const embed = new EmbedBuilder()
    .setTitle(`👾 ${mob.Name} (ID: ${mob.Id})`)
    .setColor(0xe74c3c)
    .setThumbnail(`https://static.divine-pride.net/images/mobs/png/${mob.Id}.png`)
    .addFields(
      { name: '📊 Level', value: `${mob.Level ?? '?'}`, inline: true },
      { name: '❤️ HP', value: `${(mob.Hp ?? 0).toLocaleString()}`, inline: true },
      ...(mob.MvpExp > 0 ? [{ name: '✨ MVP EXP', value: `${mob.MvpExp.toLocaleString()}`, inline: true }] : []),
      { name: '🧪 Base EXP', value: `${(mob.BaseExp ?? 0).toLocaleString()}`, inline: true },
      { name: '💼 Job EXP', value: `${(mob.JobExp ?? 0).toLocaleString()}`, inline: true },
      { name: '🌍 Element', value: `${mob.Element ?? '?'} ${mob.ElementLevel ?? ''}`, inline: true },
      { name: '🐾 Race', value: mob.Race ?? '?', inline: true },
      { name: '📐 Size', value: mob.Size ?? '?', inline: true },
      { name: '⚔️ Stats', value: statsText, inline: false },
      { name: `🎁 Drops (${allDrops.length})`, value: dropText.slice(0, 1020), inline: false },
      { name: '📋 Commands', value: LEGEND, inline: false }
    );

  return message.reply({ embeds: [embed] });
}

// ─── Message Handler ──────────────────────────────────────────────────────
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (message.channelId !== MARKET_CHANNEL_ID) return;
  const content = message.content.trim();

  const wsMatch = content.match(/^[@!]ws\s+(.+)/i);
  if (wsMatch) return handleWhoSells(message, wsMatch[1].trim());

  const phMatch = content.match(/^[@!]ph\s+(.+)/i);
  if (phMatch) return handlePriceHistory(message, phMatch[1].trim());

  const iiMatch = content.match(/^[@!]ii\s+(.+)/i);
  if (iiMatch) return handleItemInfo(message, iiMatch[1].trim());

  // Support both @whodrops and @wd
  const wdMatch = content.match(/^[@!](whodrops|wd)\s+(.+)/i);
  if (wdMatch) return handleWhoDrops(message, wdMatch[2].trim());

  const miMatch = content.match(/^[@!]mi\s+(.+)/i);
  if (miMatch) return handleMobInfo(message, miMatch[1].trim());

  // Support both @optionslist and @ol
  if (content.match(/^[@!](optionslist|ol)$/i)) return handleOptionsList(message);
});

client.once('ready', async () => {
  console.log(`[Market Bot] Logged in as ${client.user.tag}`);
  await buildNameCache().catch(console.error);
  loadMobCache().catch(console.error);
  const channel = await client.channels.fetch(MARKET_CHANNEL_ID).catch(() => null);
  if (!channel) { console.error('[Market Bot] Channel not found!'); return; }
  await scanForDeals(channel).catch(console.error);
  setInterval(() => scanForDeals(channel).catch(console.error), SCAN_INTERVAL_MS);
  console.log(`[Market Bot] Scanning every ${SCAN_INTERVAL_MS / 60000} min.`);
});

client.login(process.env.DISCORD_TOKEN);
