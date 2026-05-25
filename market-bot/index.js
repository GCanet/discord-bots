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
const DEAL_THRESHOLD = 0.4; // 60% off = price <= median * 0.4

// ─── Minimal in-memory cache ───────────────────────────────────────────────
// Only store nameid <-> item_name mappings to support name search
// Map<nameid, item_name> and Map<normalized_name, nameid>
const nameCache = new Map(); // nameid (number) -> item_name (string)
const nameToId = new Map();  // normalized name -> nameid

// Track deals already alerted this cycle to avoid duplicate pings
// Cleared each scan cycle
let alertedDealsThisCycle = new Set();

// ─── Helpers ───────────────────────────────────────────────────────────────

function normalize(str) {
  return str.toLowerCase().trim();
}

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

// ─── API Fetch helpers (memory efficient: stream pages, don't hold all) ───

async function fetchPage(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
  return res.json();
}

// Fetch listings for a specific nameid
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
    if (page > 20) break; // safety limit
  }
  return listings;
}

// Fetch all listings page by page, yield each page for memory efficiency
async function* fetchAllListingsPages() {
  let page = 1;
  while (true) {
    let data;
    try {
      data = await fetchPage(`${BASE_URL}/?page=${page}&page_size=50`);
    } catch (e) {
      console.error(`Error fetching page ${page}:`, e.message);
      break;
    }
    const results = data.results || data;
    if (!Array.isArray(results) || results.length === 0) break;
    yield results;
    if (!data.next) break;
    page++;
  }
}

// ─── Name cache builder ───────────────────────────────────────────────────
// Scans a few pages to build name<->id mapping. Not exhaustive but covers common items.
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
    count++;
    if (count >= 10) break; // ~500 items, enough for common items
  }
  console.log(`[Market] Name cache built: ${nameCache.size} items`);
}

function resolveItem(query) {
  // Try as nameid first
  const asNum = parseInt(query);
  if (!isNaN(asNum)) return asNum;

  // Try exact name
  const exactId = nameToId.get(normalize(query));
  if (exactId) return exactId;

  // Try partial match
  const lowerQ = normalize(query);
  for (const [name, id] of nameToId.entries()) {
    if (name.includes(lowerQ)) return id;
  }
  return null;
}

// ─── Deal scanner ─────────────────────────────────────────────────────────
// Groups all listings by nameid, computes median, flags deals
async function scanForDeals(channel) {
  console.log('[Market] Starting deal scan...');
  alertedDealsThisCycle = new Set();

  // Collect prices grouped by nameid — we only keep aggregated stats, not full listings
  // Map<nameid, { item_name, prices: number[], cheapest: listing }>
  const byItem = new Map();

  for await (const page of fetchAllListingsPages()) {
    for (const item of page) {
      if (!item.nameid || !item.price || !item.amount) continue;

      // Update name cache opportunistically
      if (item.item_name) {
        nameCache.set(item.nameid, item.item_name);
        nameToId.set(normalize(item.item_name), item.nameid);
      }

      if (!byItem.has(item.nameid)) {
        byItem.set(item.nameid, { item_name: item.item_name || `Item #${item.nameid}`, prices: [], cheapest: null });
      }
      const entry = byItem.get(item.nameid);
      entry.prices.push(item.price);

      if (!entry.cheapest || item.price < entry.cheapest.price) {
        entry.cheapest = item;
      }
    }
  }

  console.log(`[Market] Scanned ${byItem.size} unique items. Checking for deals...`);

  // Find deals
  const deals = [];
  for (const [nameid, entry] of byItem.entries()) {
    if (entry.prices.length < 2) continue; // Need at least 2 listings to compare
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

  if (deals.length === 0) {
    console.log('[Market] No deals found this cycle.');
    return;
  }

  console.log(`[Market] Found ${deals.length} deals! Posting to channel...`);

  for (const deal of deals) {
    try {
      const { nameid, item_name, minPrice, medianPrice, cheapest } = deal;
      const discount = Math.round((1 - minPrice / medianPrice) * 100);
      const embed = new EmbedBuilder()
        .setTitle(`🔥 DEAL: ${item_name}`)
        .setColor(0xf1c40f)
        .setThumbnail(itemImageUrl(nameid))
        .addFields(
          { name: '💰 Price', value: formatPrice(minPrice), inline: true },
          { name: '📊 Median', value: formatPrice(medianPrice), inline: true },
          { name: '🏷️ Discount', value: `-${discount}%`, inline: true },
          { name: '🏪 Shop', value: cheapest.shop_title || 'Unknown', inline: true },
          { name: '👤 Seller', value: cheapest.char_name || 'Unknown', inline: true },
          {
            name: '📍 Location',
            value: cheapest.map ? `/navi ${cheapest.map} ${cheapest.x} ${cheapest.y}` : 'Unknown',
            inline: false,
          }
        )
        .setFooter({ text: `Item ID: ${nameid}` })
        .setTimestamp();

      await channel.send({ content: '@here 🔥 **Market Deal Alert!**', embeds: [embed] });
      // Small delay between posts to avoid rate limits
      await new Promise((r) => setTimeout(r, 1500));
    } catch (e) {
      console.error('Error posting deal:', e.message);
    }
  }
}

// ─── Commands ─────────────────────────────────────────────────────────────

async function handleWhoSells(message, query) {
  const nameid = resolveItem(query);
  if (!nameid) {
    return message.reply(`❌ Item \`${query}\` not found. Try using the item ID number.`);
  }

  let listings;
  try {
    listings = await fetchItemListings(nameid);
  } catch (e) {
    return message.reply('❌ Failed to fetch market data. Try again later.');
  }

  if (!listings || listings.length === 0) {
    return message.reply(`📦 No one is selling \`${nameCache.get(nameid) || `Item #${nameid}`}\` right now.`);
  }

  const item_name = listings[0].item_name || nameCache.get(nameid) || `Item #${nameid}`;
  const sorted = listings.sort((a, b) => a.price - b.price).slice(0, 8);
  const prices = listings.map((l) => l.price);
  const med = median(prices);

  const lines = sorted.map((l) => {
    const navi = l.map ? `/navi ${l.map} ${l.x} ${l.y}` : 'Unknown';
    return `**${formatPrice(l.price)}** x${l.amount} — ${l.shop_title || l.char_name} \`${navi}\``;
  });

  const embed = new EmbedBuilder()
    .setTitle(`🛒 Who Sells: ${item_name}`)
    .setColor(0x2ecc71)
    .setThumbnail(itemImageUrl(nameid))
    .setDescription(lines.join('\n'))
    .addFields(
      { name: '📊 Median Price', value: formatPrice(med), inline: true },
      { name: '📦 Total Listings', value: `${listings.length}`, inline: true }
    )
    .setFooter({ text: `ID: ${nameid} • Showing cheapest ${sorted.length} of ${listings.length}` });

  return message.reply({ embeds: [embed] });
}

async function handleWhoBuys(message, query) {
  // The API is vending/shop focused; "who buys" is often not in vending APIs
  // We'll show buy shop listings if available (looking for buy shops in market data)
  // For now, show price history as a buying reference
  const nameid = resolveItem(query);
  if (!nameid) {
    return message.reply(`❌ Item \`${query}\` not found. Try using the item ID number.`);
  }

  let history;
  try {
    const res = await fetch(`${BASE_URL}/history/?nameid=${nameid}`);
    history = await res.json();
  } catch (e) {
    return message.reply('❌ Failed to fetch market history.');
  }

  const item_name = nameCache.get(nameid) || `Item #${nameid}`;
  const results = history.results || history;

  if (!Array.isArray(results) || results.length === 0) {
    return message.reply(`📦 No sale history found for \`${item_name}\`.`);
  }

  const recent = results.slice(0, 6);
  const prices = recent.map((r) => r.price);
  const med = median(prices);

  const lines = recent.map((r) => {
    const date = r.listed_at ? new Date(r.listed_at).toLocaleDateString() : '?';
    return `**${formatPrice(r.price)}** x${r.amount || 1} — ${date}`;
  });

  const embed = new EmbedBuilder()
    .setTitle(`💰 Sale History: ${item_name}`)
    .setColor(0xe67e22)
    .setThumbnail(itemImageUrl(nameid))
    .setDescription(lines.join('\n'))
    .addFields({ name: '📊 Recent Median', value: formatPrice(med), inline: true })
    .setFooter({ text: `ID: ${nameid} • Recent sales (use this as buy price reference)` });

  return message.reply({ embeds: [embed] });
}

// ─── Bot Ready ────────────────────────────────────────────────────────────
client.once('ready', async () => {
  console.log(`[Market Bot] Logged in as ${client.user.tag}`);

  // Build initial name cache
  await buildNameCache().catch(console.error);

  const channel = await client.channels.fetch(MARKET_CHANNEL_ID).catch(() => null);
  if (!channel) {
    console.error('[Market Bot] Could not find MARKET_CHANNEL_ID!');
    return;
  }

  // Initial scan on startup
  await scanForDeals(channel).catch(console.error);

  // Recurring scan
  setInterval(async () => {
    await scanForDeals(channel).catch(console.error);
  }, SCAN_INTERVAL_MS);

  console.log(`[Market Bot] Deal scanner running every ${SCAN_INTERVAL_MS / 60000} minutes.`);
});

// ─── Message Handler ──────────────────────────────────────────────────────
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (message.channelId !== MARKET_CHANNEL_ID) return;

  const content = message.content.trim();

  // @ws or !ws — who sells
  const wsMatch = content.match(/^[@!]ws\s+(.+)/i);
  if (wsMatch) {
    return handleWhoSells(message, wsMatch[1].trim());
  }

  // @wb or !wb — who buys (price history)
  const wbMatch = content.match(/^[@!]wb\s+(.+)/i);
  if (wbMatch) {
    return handleWhoBuys(message, wbMatch[1].trim());
  }
});

client.login(process.env.DISCORD_TOKEN);
