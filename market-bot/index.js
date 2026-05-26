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
const ITEM_PAGE_BASE = 'https://revenantelegy.com/market/item';
const SCAN_INTERVAL_MS = (parseInt(process.env.SCAN_INTERVAL_MINUTES) || 15) * 60 * 1000;
const DEAL_THRESHOLD = 0.25; // 75% off

const LEGEND = [
  '`@ws <name or id>` — who sells (cheapest listings + location)',
  '`@ws <name or id> <option>` — filter by option (id, name, or alias)',
  '`@ph <name or id>` — historical pricing',
].join('\n');

// Option mappings and aliases
const OPTION_MAP = {
  // ID to label
  1: 'HP',
  2: 'SP',
  3: 'STR',
  4: 'AGI',
  5: 'VIT',
  6: 'INT',
  7: 'DEX',
  8: 'LUK',
  16: 'ASPD %',
  17: 'ATK',
  18: 'HIT',
  19: 'MATK',
  20: 'DEF',
  21: 'MDEF',
  23: 'Perfect Dodge',
  24: 'Crit Chance',
  164: '% Crit Damage',
  168: 'Healing Effectiveness',
  170: 'Cast Time Reduction',
  171: 'After Cast Delay',
  255: 'Freeze Resist',
  256: 'Stone Curse Resist',
  172: 'SP Consumption',
  150: '% Resist Boss',
  167: '% Resist Long Range',
  193: '% Resist All Elements',
  257: '% Resist All Sizes',
  258: '% Resist All Races',
  160: '% Resist Small',
  161: '% Resist Medium',
  162: '% Resist Large',
  25: '% Resist Neutral Element',
  26: '% Resist Water Element',
  27: '% Resist Earth Element',
  28: '% Resist Fire Element',
  29: '% Resist Wind Element',
  30: '% Resist Poison Element',
  31: '% Resist Holy Element',
  32: '% Resist Shadow Element',
  33: '% Resist Ghost Element',
  87: '% Resist Formless Race',
  88: '% Resist Undead Race',
  89: '% Resist Brute Race',
  90: '% Resist Plant Race',
  91: '% Resist Insect Race',
  92: '% Resist Fish Race',
  93: '% Resist Demon Race',
  94: '% Resist Demi-Human Race',
  95: '% Resist Angel Race',
  96: '% Resist Dragon Race',
  37: '% Physical Damage to Neutral',
  39: '% Physical Damage to Water',
  41: '% Physical Damage to Earth',
  43: '% Physical Damage to Fire',
  45: '% Physical Damage to Wind',
  47: '% Physical Damage to Poison',
  49: '% Physical Damage to Holy',
  51: '% Physical Damage to Shadow',
  53: '% Physical Damage to Ghost',
  55: '% Physical Damage to Undead (element)',
  57: '% Magical Damage to Neutral',
  59: '% Magical Damage to Water',
  61: '% Magical Damage to Earth',
  63: '% Magical Damage to Fire',
  65: '% Magical Damage to Wind',
  67: '% Magical Damage to Poison',
  69: '% Magical Damage to Holy',
  71: '% Magical Damage to Shadow',
  73: '% Magical Damage to Ghost',
  75: '% Magical Damage to Undead (element)',
  97: '% Physical Damage to Formless',
  98: '% Physical Damage to Undead (race)',
  99: '% Physical Damage to Brute',
  100: '% Physical Damage to Plant',
  101: '% Physical Damage to Insect',
  102: '% Physical Damage to Fish',
  103: '% Physical Damage to Demon',
  104: '% Physical Damage to Demi-Human',
  105: '% Physical Damage to Angel',
  106: '% Physical Damage to Dragon',
  107: '% Magical Damage to Formless',
  108: '% Magical Damage to Undead (race)',
  109: '% Magical Damage to Brute',
  110: '% Magical Damage to Plant',
  111: '% Magical Damage to Insect',
  112: '% Magical Damage to Fish',
  113: '% Magical Damage to Demon',
  114: '% Magical Damage to Demi-Human',
  115: '% Magical Damage to Angel',
  116: '% Magical Damage to Dragon',
  279: '% Incoming Healing',
  280: 'Movement Speed',
};

const OPTION_ALIASES = {
  'hp': 1,
  'sp': 2,
  'str': 3,
  'agi': 4,
  'vit': 5,
  'int': 6,
  'dex': 7,
  'luk': 8,
  'aspd': 16,
  'atk': 17,
  'hit': 18,
  'matk': 19,
  'def': 20,
  'mdef': 21,
  'pdodge': 23,
  'crit': 24,
  'critdmg': 164,
  'heal': 168,
  'cast': 170,
  'delay': 171,
  'freeze': 255,
  'sc': 256,           // stone curse
  'stone': 256,
  'stun': 256,         // common alias
  'spcons': 172,
  'boss': 150,
  'long': 167,
  'allres': 193,
  'allsize': 257,
  'allrace': 258,
  'small': 160,
  'medium': 161,
  'large': 162,
  // Add more as needed
};

const nameCache = new Map();
const nameToId = new Map();
let alertedDealsThisCycle = new Set();

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

function itemImageUrl(nameid) {
  return `https://static.divine-pride.net/images/items/item/${nameid}.png`;
}

function itemPageUrl(nameid) {
  return `${ITEM_PAGE_BASE}/${nameid}`;
}

/**
 * Parse command query into item query + optional option filter
 */
function parseWsQuery(fullQuery) {
  const parts = fullQuery.trim().split(/\s+/);
  if (parts.length === 1) {
    return { itemQuery: parts[0], optionId: null };
  }
  const itemQuery = parts.slice(0, -1).join(' ');
  let lastPart = parts[parts.length - 1];

  // Try option ID
  const asNum = parseInt(lastPart);
  if (!isNaN(asNum) && OPTION_MAP[asNum]) {
    return { itemQuery, optionId: asNum };
  }

  // Try alias
  const aliasId = OPTION_ALIASES[normalize(lastPart)];
  if (aliasId) {
    return { itemQuery, optionId: aliasId };
  }

  // Try option name match (partial)
  const lowerOpt = normalize(lastPart);
  for (const [id, label] of Object.entries(OPTION_MAP)) {
    if (normalize(label).includes(lowerOpt)) {
      return { itemQuery, optionId: parseInt(id) };
    }
  }

  // Fallback: treat last part as part of item name
  return { itemQuery: fullQuery, optionId: null };
}

/**
 * Check if a listing has the desired option
 */
function hasOption(listing, targetOptionId) {
  if (!Array.isArray(listing.options) || listing.options.length === 0) return false;
  return listing.options.some(opt => opt.id === targetOptionId);
}

function buildListingBlock(listing, opts = {}) {
  const {
    nameid,
    item_name,
    medianPrice,
    discount,
    isWs = false,
    amount,
  } = opts;

  const lines = [];

  const refinePrefix = listing.refine ? `+${listing.refine} ` : '';
  const displayName = item_name || listing.item_name || `Item #${nameid}`;
  const url = itemPageUrl(nameid || listing.nameid);
  const titleLine = `${refinePrefix}[${displayName}](${url})`;
  lines.push(titleLine);

  if (Array.isArray(listing.cards) && listing.cards.length > 0) {
    const cardList = listing.cards.map((c) => c.name).join(' | ');
    lines.push(`🃏 ${cardList}`);
  }

  if (Array.isArray(listing.options) && listing.options.length > 0) {
    lines.push('🎲 Options:');
    for (const o of listing.options) {
      lines.push(`↳ ${o.label}`);
    }
  }

  lines.push('');

  if (!isWs && discount !== undefined) {
    lines.push(`🏷️ Discount: **-${discount}%**`);
  }

  const qty = amount || listing.amount || 1;
  if (isWs) {
    lines.push(`💰 **${formatPrice(listing.price)}** x${qty}`);
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
    if (!data.next) break;
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
    if (!data.next) break;
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

function resolveItem(query) {
  const asNum = parseInt(query);
  if (!isNaN(asNum)) return asNum;
  const exactId = nameToId.get(normalize(query));
  if (exactId) return exactId;
  const lowerQ = normalize(query);
  for (const [name, id] of nameToId.entries()) {
    if (name.includes(lowerQ)) return id;
  }
  return null;
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
  console.log(`[Market] ${deals.length} deals found, posting...`);

  const dealBlocks = deals.map((deal) => {
    const { nameid, item_name, minPrice, medianPrice, cheapest } = deal;
    const discount = Math.round((1 - minPrice / medianPrice) * 100);
    const lines = buildListingBlock(cheapest, { nameid, item_name, medianPrice, discount, isWs: false });
    return lines.join('\n');
  });

  const chunks = [];
  let current = '';
  for (const block of dealBlocks) {
    const candidate = current ? current + '\n\n' + block : block;
    if (candidate.length > 3800) {
      chunks.push(current);
      current = block;
    } else {
      current = candidate;
    }
  }
  if (current) chunks.push(current);

  for (let i = 0; i < chunks.length; i++) {
    const embed = new EmbedBuilder()
      .setTitle(i === 0 ? `🔥 Market Deals (${deals.length})` : `🔥 Market Deals (cont.)`)
      .setColor(0xf1c40f)
      .setDescription(chunks[i])
      .setTimestamp();

    if (i === chunks.length - 1) {
      embed.addFields({ name: '📋 Commands', value: LEGEND });
    }

    await channel.send({ embeds: [embed] });
    await new Promise((r) => setTimeout(r, 1500));
  }
}

// ─── @ws — Who Sells ───────────────────────────────────────────────────────
async function handleWhoSells(message, fullQuery) {
  const { itemQuery, optionId } = parseWsQuery(fullQuery);
  const nameid = resolveItem(itemQuery);
  if (!nameid) return message.reply(`❌ Item \`${itemQuery}\` not found. Try the item ID number.`);

  let listings;
  try { listings = await fetchItemListings(nameid); }
  catch (e) { return message.reply('❌ Failed to fetch market data. Try again later.'); }

  const item_name = listings[0]?.item_name || nameCache.get(nameid) || `Item #${nameid}`;

  if (!listings || listings.length === 0) {
    return message.reply(`📦 No one is selling **${item_name}** right now.`);
  }

  let filtered = listings;
  if (optionId) {
    filtered = listings.filter(l => hasOption(l, optionId));
    if (filtered.length === 0) {
      return message.reply(`📦 No listings found for **${item_name}** with option **${OPTION_MAP[optionId] || optionId}**.`);
    }
  }

  const sorted = filtered.sort((a, b) => a.price - b.price).slice(0, 8);
  const med = median(filtered.map((l) => l.price));

  const listingBlocks = sorted.map((l) => {
    const lines = buildListingBlock(l, { nameid, item_name, isWs: true });
    return lines.join('\n');
  });

  const embed = new EmbedBuilder()
    .setTitle(`🛒 ${item_name} (${nameid})${optionId ? ` [${OPTION_MAP[optionId]}]` : ''}`)
    .setURL(itemPageUrl(nameid))
    .setColor(0x2ecc71)
    .setThumbnail(itemImageUrl(nameid))
    .setDescription(listingBlocks.join('\n\n'))
    .addFields(
      { name: '📊 Average Price', value: formatPrice(med), inline: true },
      { name: '📦 Total Listings', value: `${filtered.length}`, inline: true },
      { name: '📋 Commands', value: LEGEND, inline: false }
    )
    .setFooter({ text: `Showing cheapest ${sorted.length} of ${filtered.length}` });

  return message.reply({ embeds: [embed] });
}

// ─── @ph — Price History ───────────────────────────────────────────────────
async function handlePriceHistory(message, query) {
  const nameid = resolveItem(query);
  if (!nameid) return message.reply(`❌ Item \`${query}\` not found. Try the item ID number.`);

  let history;
  try {
    const res = await fetch(`${BASE_URL}/history/?nameid=${nameid}`);
    history = await res.json();
  } catch (e) {
    return message.reply('❌ Failed to fetch price history. Try again later.');
  }

  const item_name = nameCache.get(nameid) || `Item #${nameid}`;
  const results = history.results || history;

  if (!Array.isArray(results) || results.length === 0) {
    return message.reply(`📦 No price history found for **[${item_name}](${itemPageUrl(nameid)})**.`);
  }

  const recent = results.slice(0, 10);
  const prices = recent.map((r) => r.price);
  const med = median(prices);
  const minP = Math.min(...prices);
  const maxP = Math.max(...prices);

  const lines = recent.map((r) => {
    const date = r.listed_at ? `<t:${Math.floor(new Date(r.listed_at).getTime() / 1000)}:d>` : '?';
    return `**${formatPrice(r.price)}** x${r.amount || 1} — ${date}`;
  });

  const embed = new EmbedBuilder()
    .setTitle(`📈 Price History: ${item_name} (${nameid})`)
    .setURL(itemPageUrl(nameid))
    .setColor(0x9b59b6)
    .setThumbnail(itemImageUrl(nameid))
    .setDescription(lines.join('\n'))
    .addFields(
      { name: '📊 Median', value: formatPrice(med), inline: true },
      { name: '📉 Lowest', value: formatPrice(minP), inline: true },
      { name: '📈 Highest', value: formatPrice(maxP), inline: true },
      { name: '📋 Commands', value: LEGEND, inline: false }
    )
    .setFooter({ text: `Last ${recent.length} sales` });

  return message.reply({ embeds: [embed] });
}

// ─── Bot Ready ────────────────────────────────────────────────────────────
client.once('ready', async () => {
  console.log(`[Market Bot] Logged in as ${client.user.tag}`);
  await buildNameCache().catch(console.error);
  const channel = await client.channels.fetch(MARKET_CHANNEL_ID).catch(() => null);
  if (!channel) { console.error('[Market Bot] Channel not found!'); return; }
  await scanForDeals(channel).catch(console.error);
  setInterval(() => scanForDeals(channel).catch(console.error), SCAN_INTERVAL_MS);
  console.log(`[Market Bot] Scanning every ${SCAN_INTERVAL_MS / 60000} min.`);
});

// ─── Message Handler ──────────────────────────────────────────────────────
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (message.channelId !== MARKET_CHANNEL_ID) return;
  const content = message.content.trim();

  const wsMatch = content.match(/^[@!]ws\s+(.+)/i);
  if (wsMatch) return handleWhoSells(message, wsMatch[1].trim());

  const phMatch = content.match(/^[@!]ph\s+(.+)/i);
  if (phMatch) return handlePriceHistory(message, phMatch[1].trim());
});

client.login(process.env.DISCORD_TOKEN);
