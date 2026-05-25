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

// ─── Build lookup index ────────────────────────────────────────────────────
// Map: normalizedName -> [boss, boss, ...] (array because same name can have multiple entries)
const bossLookup = new Map(); // normalized string -> boss[]

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
// Map<key, { boss, killTime, minSpawn, maxSpawn, killerId, messageId, timerId }>
// key = `${boss.bossName}_${boss.location}`
const activeTimers = new Map();

// Pending disambiguation: userId -> { matches: boss[], message }
const pendingDisambig = new Map();

// ─── Helpers ───────────────────────────────────────────────────────────────

function formatHp(hp) {
  return hp.toLocaleString();
}

function buildTimerEmbed(boss, killTime, minSpawn, maxSpawn) {
  const killTs = Math.floor(killTime / 1000);
  const minTs = Math.floor(minSpawn / 1000);
  const maxTs = Math.floor(maxSpawn / 1000);

  const embed = new EmbedBuilder()
    .setTitle(`☠️ ${boss.bossName}`)
    .setColor(0xe74c3c)
    .setThumbnail(`https://static.divine-pride.net/images/mobs/png/${boss.ID}.png`)
    .addFields(
      { name: '📍 Map', value: boss.location || 'Unknown', inline: true },
      { name: '⚔️ Killed at', value: `<t:${killTs}:T>`, inline: true },
      { name: '\u200B', value: '\u200B', inline: true },
      { name: '🔁 Min Spawn', value: `<t:${minTs}:F> (<t:${minTs}:R>)`, inline: true },
      { name: '🔁 Max Spawn', value: `<t:${maxTs}:F> (<t:${maxTs}:R>)`, inline: true }
    )
    .setFooter({ text: `${boss.race} • ${boss.property} • HP: ${formatHp(boss.HP)}` })
    .setTimestamp();

  return embed;
}

function buildCurrentListEmbed(timers) {
  if (timers.length === 0) {
    return new EmbedBuilder()
      .setTitle('📋 Current MVP Timers')
      .setColor(0x3498db)
      .setDescription('No active timers.');
  }

  const now = Date.now();
  const lines = timers.map(({ boss, minSpawn, maxSpawn }) => {
    const minTs = Math.floor(minSpawn / 1000);
    const maxTs = Math.floor(maxSpawn / 1000);
    const isUp = now >= minSpawn;
    const status = isUp ? '🟢 **UP NOW**' : `⏳ <t:${minTs}:R>`;
    return `**${boss.bossName}** (${boss.location || '?'})\n${status} — max <t:${maxTs}:t>`;
  });

  return new EmbedBuilder()
    .setTitle(`📋 Current MVP Timers (${timers.length})`)
    .setColor(0x3498db)
    .setDescription(lines.join('\n\n'));
}

function scheduleSpawnReminder(boss, minSpawn, killerId, channel) {
  const reminderTime = minSpawn - 10 * 60 * 1000; // 10 min before min spawn
  const delay = reminderTime - Date.now();

  if (delay <= 0) return null; // Already past reminder time

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

  // Clear existing timer if re-killed
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

  // !current command
  if (content.toLowerCase() === '!current') {
    const timers = Array.from(activeTimers.values()).sort((a, b) => a.minSpawn - b.minSpawn);
    const embed = buildCurrentListEmbed(timers);
    return message.reply({ embeds: [embed] });
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
      const embed = buildTimerEmbed(boss, killTime, minSpawn, maxSpawn);
      return message.reply({ embeds: [embed] });
    } else {
      return message.reply(`❌ Invalid choice. Please reply with a number between 1 and ${matches.length}.`);
    }
  }

  // ── Boss name detection ────────────────────────────────────────────────
  // Try exact match first, then partial match
  const lower = normalize(content);
  let matches = bossLookup.get(lower) || [];

  // Partial/fuzzy search if no exact match
  if (matches.length === 0) {
    for (const [key, bosses] of bossLookup.entries()) {
      if (key.includes(lower) || lower.includes(key)) {
        matches = matches.concat(bosses);
      }
    }
    // deduplicate by bossName+location
    const seen = new Set();
    matches = matches.filter((b) => {
      const k = `${b.bossName}_${b.location}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }

  if (matches.length === 0) return; // Not a boss name, ignore silently

  // ── Single match ──────────────────────────────────────────────────────
  if (matches.length === 1) {
    const boss = matches[0];
    if (!boss.minRespawnTimeScheduleInSeconds) {
      return message.reply(`⚠️ **${boss.bossName}** has no standard respawn timer (instance/event boss).`);
    }
    const killTime = message.createdTimestamp;
    const { minSpawn, maxSpawn } = registerBossKill(boss, killTime, userId, message.channel);
    const embed = buildTimerEmbed(boss, killTime, minSpawn, maxSpawn);
    return message.reply({ embeds: [embed] });
  }

  // ── Multiple matches — need disambiguation ─────────────────────────────
  pendingDisambig.set(userId, { matches });

  // Auto-expire disambiguation after 60 seconds
  setTimeout(() => pendingDisambig.delete(userId), 60000);

  const options = matches.map((b, i) => `\`${i + 1}\` — **${b.bossName}** (${b.location || 'unknown map'})`).join('\n');
  return message.reply(
    `🤔 Multiple bosses found for **"${content}"**. Which one died?\n\n${options}\n\nReply with the number.`
  );
});

client.login(process.env.DISCORD_TOKEN);
