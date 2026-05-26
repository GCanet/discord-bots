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
  '`@ph <name or id>` — historical pricing',
].join('\n');

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
 * Format a single listing block for use in both @ws and deals.
 * Returns an array of lines.
 *
 * Layout:
 *   [+refine] [item name](url)          <- for deals (title line passed in)
 *   🃏 Card1 | Card2 | ...              <- only if cards present
 *   🎲 Options:
 *   ↳ Option 1
 *   ↳ Option 2
 *   <blank>
 *   🏷️ Discount: -X%                   <- deals only
 *   💰 Sale Price / price x amount
 *   📊 Average Price                    <- deals only / in fields for @ws
 *   <blank>
 *   🏪 Shop /navi ...
 */
function buildListingBlock(listing, opts = {}) {
  const {
    nameid,
    item_name,
    medianPrice,
    discount,
    isWs = false,       // true = @ws mode (no discount line, price shown differently)
    amount,
  } = opts;

  const lines = [];

  // ── Title line (refine + clickable name) ──
  const refinePrefix = listing.refine ? `+${listing.refine} ` : '';
  const displayName = item_name || listing.item_name || `Item #${nameid}`;
  const url = itemPageUrl(nameid || listing.nameid);
  const titleLine = `${refinePrefix}[${displayName}](${url})`;
  lines.push(titleLine);

  // ── Cards (inline, only if present) ──
  if (Array.isArray(listing.cards) && listing.cards.length > 0) {
    const cardList = listing.cards.map((c) => c.name).join(' | ');
    lines.push(`🃏 ${cardList}`);
  }

  // ── Options (each on own indented line) ──
  if (Array.isArray(listing.options) && listing.options.length > 0) {
    lines.push('🎲 Options:');
    for (const o of listing.options) {
      lines.push(`↳ ${o.label}`);
    }
  }

  // blank line before pricing
  lines.push('');

  // ── Pricing ──
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

  // blank line before shop
  lines.push('');

  // ── Shop / location ──
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

  // Split into chunks (4096 char limit), separated by blank line
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
async function handleWhoSells(message, query) {
  const nameid = resolveItem(query);
  if (!nameid) return message.reply(`❌ Item \`${query}\` not found. Try the item ID number.`);

  let listings;
  try { listings = await fetchItemListings(nameid); }
  catch (e) { return message.reply('❌ Failed to fetch market data. Try again later.'); }

  const item_name = listings[0]?.item_name || nameCache.get(nameid) || `Item #${nameid}`;

  if (!listings || listings.length === 0) {
    return message.reply(`📦 No one is selling **${item_name}** right now.`);
  }

  const sorted = listings.sort((a, b) => a.price - b.price).slice(0, 8);
  const med = median(listings.map((l) => l.price));

  const listingBlocks = sorted.map((l) => {
    const lines = buildListingBlock(l, { nameid, item_name, isWs: true });
    return lines.join('\n');
  });

  const embed = new EmbedBuilder()
    .setTitle(`🛒 ${item_name} (${nameid})`)
    .setURL(itemPageUrl(nameid))
    .setColor(0x2ecc71)
    .setThumbnail(itemImageUrl(nameid))
    .setDescription(listingBlocks.join('\n\n'))
    .addFields(
      { name: '📊 Average Price', value: formatPrice(med), inline: true },
      { name: '📦 Total Listings', value: `${listings.length}`, inline: true },
      { name: '📋 Commands', value: LEGEND, inline: false }
    )
    .setFooter({ text: `Showing cheapest ${sorted.length} of ${listings.length}` });

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
