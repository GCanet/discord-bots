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
const SCAN_INTERVAL_MS = (parseInt(process.env.SCAN_INTERVAL_MINUTES) || 15) * 60 * 1000;
const DEAL_THRESHOLD = 0.25; // 75% off

const LEGEND = '`@ws <name or id>` — who sells (cheapest listings + location)';

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

  // Sort biggest discount first
  deals.sort((a, b) => (a.minPrice / a.medianPrice) - (b.minPrice / b.medianPrice));

  console.log(`[Market] ${deals.length} deals found, posting...`);

  // Build list with restored field titles
  const lines = deals.map((deal) => {
    const { nameid, item_name, minPrice, medianPrice, cheapest } = deal;
    const discount = Math.round((1 - minPrice / medianPrice) * 100);
    const navi = cheapest.map ? `/navi ${cheapest.map} ${cheapest.x} ${cheapest.y}` : 'Unknown';
    return [
      `**${item_name}** (${nameid})`,
      `💰 Sale Price: **${formatPrice(minPrice)}**`,
      `📊 Average Price: **${formatPrice(medianPrice)}**`,
      `🏷️ Discount: **-${discount}%**`,
      `🏪 ${cheapest.shop_title || cheapest.char_name || 'Unknown'} \`${navi}\``,
    ].join('\n');
  });

  // Split into chunks if needed (4096 char limit)
  const chunks = [];
  let current = '';
  for (const line of lines) {
    if ((current + '\n\n' + line).length > 3800) {
      chunks.push(current);
      current = line;
    } else {
      current = current ? current + '\n\n' + line : line;
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
    return message.reply(`📦 No one is selling **${item_name}** (${nameid}) right now.`);
  }

  const sorted = listings.sort((a, b) => a.price - b.price).slice(0, 8);
  const med = median(listings.map((l) => l.price));

  const lines = sorted.map((l) => {
    const navi = l.map ? `/navi ${l.map} ${l.x} ${l.y}` : 'Unknown';
    return `**${formatPrice(l.price)}** x${l.amount} — ${l.shop_title || l.char_name} \`${navi}\``;
  });

  const embed = new EmbedBuilder()
    .setTitle(`🛒 ${item_name} (${nameid})`)
    .setColor(0x2ecc71)
    .setThumbnail(itemImageUrl(nameid))
    .setDescription(lines.join('\n'))
    .addFields(
      { name: '📊 Average Price', value: formatPrice(med), inline: true },
      { name: '📦 Total Listings', value: `${listings.length}`, inline: true },
      { name: '📋 Commands', value: LEGEND, inline: false }
    )
    .setFooter({ text: `Showing cheapest ${sorted.length} of ${listings.length}` });

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
});

client.login(process.env.DISCORD_TOKEN);
