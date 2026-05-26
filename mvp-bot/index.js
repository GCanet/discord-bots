require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const bossData = require('./bosses.json');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const MVP_CHANNEL_ID = process.env.MVP_CHANNEL_ID;

const LEGEND = [
  '`<boss name>` — register kill & start timer',
  '`!current` — list all active timers',
  '`!remove <name>` — delete a timer',
  '`!edit <name>` — reset kill time to now',
].join('\n');

// ─── Build lookup index ────────────────────────────────────────────────────
const bossLookup = new Map();

function normalize(str) {
  return str.toLowerCase().trim().replace(/\s+/g, ' ');
}

for (const boss of bossData.bosses) {
  const keys = [normalize(boss.bossName), ...boss.alias.map(normalize)];
  for (const key of keys) {
    if (!bossLookup.has(key)) bossLookup.set(key, []);
    bossLookup.get(key).push(boss);
  }
}

// ─── Active timers ─────────────────────────────────────────────────────────
const activeTimers = new Map();
const pendingDisambig = new Map();

// ─── Helpers ───────────────────────────────────────────────────────────────

function formatHp(hp) {
  return hp.toLocaleString();
}

function buildTimerEmbed(boss, killTime, minSpawn, maxSpawn) {
  const killTs = Math.floor(killTime / 1000);
  const minTs = Math.floor(minSpawn / 1000);
  const maxTs = Math.floor(maxSpawn / 1000);

  return new EmbedBuilder()
    .setTitle(`☠️ ${boss.bossName}`)
    .setColor(0xe74c3c)
    .setThumbnail(`https://static.divine-pride.net/images/mobs/png/${boss.ID}.png`)
    .addFields(
      { name: '📍 Map', value: boss.location || 'Unknown', inline: true },
      { name: '⚔️ Killed at', value: `<t:${killTs}:T>`, inline: true },
      { name: '\u200B', value: '\u200B', inline: true },
      { name: '🔁 Min Spawn', value: `<t:${minTs}:F> (<t:${minTs}:R>)`, inline: true },
      { name: '🔁 Max Spawn', value: `<t:${maxTs}:F> (<t:${maxTs}:R>)`, inline: true },
      { name: '\u200B', value: '\u200B', inline: true },
      { name: '📋 Commands', value: LEGEND, inline: false }
    )
    .setFooter({ text: `${boss.race} • ${boss.property} • HP: ${formatHp(boss.HP)}` })
    .setTimestamp();
}

function buildCurrentListEmbed(timers) {
  const base = new EmbedBuilder()
    .setColor(0x3498db)
    .addFields({ name: '📋 Commands', value: LEGEND, inline: false });

  if (timers.length === 0) {
    return base.setTitle('📋 Current MVP Timers').setDescription('No active timers.');
  }

  const now = Date.now();
  const lines = timers.map(({ boss, minSpawn, maxSpawn }) => {
    const minTs = Math.floor(minSpawn / 1000);
    const maxTs = Math.floor(maxSpawn / 1000);
    const isUp = now >= minSpawn;
    const status = isUp ? '🟢 **UP NOW**' : `⏳ <t:${minTs}:R>`;
    return `**${boss.bossName}** (${boss.location || '?'})\n${status} — max <t:${maxTs}:t>`;
  });

  return base
    .setTitle(`📋 Current MVP Timers (${timers.length})`)
    .setDescription(lines.join('\n\n'));
}

function scheduleSpawnReminder(boss, minSpawn, killerId, channel) {
  const delay = minSpawn - 10 * 60 * 1000 - Date.now();
  if (delay <= 0) return null;
  return setTimeout(async () => {
    try {
      const minTs = Math.floor(minSpawn / 1000);
      await channel.send(
        `<@${killerId}> ⏰ **${boss.bossName}** is spawning in ~10 minutes!\nMap: \`${boss.location || 'Unknown'}\` — <t:${minTs}:T>`
      );
    } catch (e) {
      console.error('Failed to send reminder:', e.message);
    }
  }, delay);
}

function registerBossKill(boss, killTime, killerId, channel) {
  const key = `${boss.bossName}_${boss.location}`;
  if (activeTimers.has(key)) {
    const old = activeTimers.get(key);
    if (old.timerId) clearTimeout(old.timerId);
  }
  const minSpawn = killTime + boss.minRespawnTimeScheduleInSeconds * 1000;
  const maxSpawn = killTime + boss.maxRespawnTimeScheduleInSeconds * 1000;
  const timerId = scheduleSpawnReminder(boss, minSpawn, killerId, channel);
  activeTimers.set(key, { boss, killTime, minSpawn, maxSpawn, killerId, timerId });
  return { minSpawn, maxSpawn };
}

function findTimerByName(query) {
  const lower = normalize(query);
  // Try exact key match
  for (const [key, timer] of activeTimers.entries()) {
    if (normalize(timer.boss.bossName) === lower) return { key, timer };
    if (timer.boss.alias && timer.boss.alias.some(a => normalize(a) === lower)) return { key, timer };
  }
  // Try partial
  for (const [key, timer] of activeTimers.entries()) {
    if (normalize(timer.boss.bossName).includes(lower)) return { key, timer };
  }
  return null;
}

// ─── Bot Ready ────────────────────────────────────────────────────────────
client.once('ready', () => {
  console.log(`[MVP Bot] Logged in as ${client.user.tag}`);
});

// ─── Message Handler ──────────────────────────────────────────────────────
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (message.channelId !== MVP_CHANNEL_ID) return;

  const content = message.content.trim();
  const userId = message.author.id;

  // !current
  if (content.toLowerCase() === '!current') {
    const timers = Array.from(activeTimers.values()).sort((a, b) => a.minSpawn - b.minSpawn);
    return message.reply({ embeds: [buildCurrentListEmbed(timers)] });
  }

  // !remove <name>
  if (content.toLowerCase().startsWith('!remove')) {
    const query = content.slice(7).trim();
    if (!query) return message.reply('❌ Usage: `!remove <boss name>`');
    const found = findTimerByName(query);
    if (!found) return message.reply(`❌ No active timer found for \`${query}\`.`);
    if (found.timer.timerId) clearTimeout(found.timer.timerId);
    activeTimers.delete(found.key);
    return message.reply(`✅ Timer for **${found.timer.boss.bossName}** removed.`);
  }

  // !edit <name> — reset kill time to now
  if (content.toLowerCase().startsWith('!edit')) {
    const query = content.slice(5).trim();
    if (!query) return message.reply('❌ Usage: `!edit <boss name>`');
    const found = findTimerByName(query);
    if (!found) return message.reply(`❌ No active timer found for \`${query}\`. Register the kill first by typing the boss name.`);
    const { boss, killerId } = found.timer;
    if (found.timer.timerId) clearTimeout(found.timer.timerId);
    const killTime = Date.now();
    const { minSpawn, maxSpawn } = registerBossKill(boss, killTime, killerId, message.channel);
    const embed = buildTimerEmbed(boss, killTime, minSpawn, maxSpawn);
    return message.reply({ content: `✅ Timer for **${boss.bossName}** reset to now.`, embeds: [embed] });
  }

  // ── Handle disambiguation reply ────────────────────────────────────────
  if (pendingDisambig.has(userId)) {
    const { matches } = pendingDisambig.get(userId);
    const choice = parseInt(content.trim());
    if (!isNaN(choice) && choice >= 1 && choice <= matches.length) {
      pendingDisambig.delete(userId);
      const boss = matches[choice - 1];
      if (!boss.minRespawnTimeScheduleInSeconds) {
        return message.reply(`⚠️ **${boss.bossName}** has no standard respawn timer (instance/event boss).`);
      }
      const killTime = message.createdTimestamp;
      const { minSpawn, maxSpawn } = registerBossKill(boss, killTime, userId, message.channel);
      return message.reply({ embeds: [buildTimerEmbed(boss, killTime, minSpawn, maxSpawn)] });
    } else {
      return message.reply(`❌ Invalid choice. Reply with a number between 1 and ${matches.length}.`);
    }
  }

  // ── Boss name detection ────────────────────────────────────────────────
  const lower = normalize(content);
  let matches = bossLookup.get(lower) || [];

  if (matches.length === 0) {
    for (const [key, bosses] of bossLookup.entries()) {
      if (key.includes(lower) || lower.includes(key)) matches = matches.concat(bosses);
    }
    const seen = new Set();
    matches = matches.filter((b) => {
      const k = `${b.bossName}_${b.location}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }

  if (matches.length === 0) return;

  if (matches.length === 1) {
    const boss = matches[0];
    if (!boss.minRespawnTimeScheduleInSeconds) {
      return message.reply(`⚠️ **${boss.bossName}** has no standard respawn timer (instance/event boss).`);
    }
    const killTime = message.createdTimestamp;
    const { minSpawn, maxSpawn } = registerBossKill(boss, killTime, userId, message.channel);
    return message.reply({ embeds: [buildTimerEmbed(boss, killTime, minSpawn, maxSpawn)] });
  }

  // Disambiguation
  pendingDisambig.set(userId, { matches });
  setTimeout(() => pendingDisambig.delete(userId), 60000);
  const options = matches.map((b, i) => `\`${i + 1}\` — **${b.bossName}** (${b.location || 'unknown map'})`).join('\n');
  return message.reply(`🤔 Multiple bosses found for **"${content}"**. Which one died?\n\n${options}\n\nReply with the number.`);
});

client.login(process.env.DISCORD_TOKEN);
