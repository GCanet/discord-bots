require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const bossData = require('./bosses.json');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const MVP_CHANNEL_ID = process.env.MVP_CHANNEL_ID;
const SERVER_HEALTH_URL = process.env.SERVER_HEALTH_URL || 'https://revenantelegy.com/api/v1.0/serverhealth/';

// Launch event timestamp: 12 June 2026 19:00 UTC
const LAUNCH_TIMESTAMP = Math.floor(new Date('2026-06-12T19:00:00Z').getTime() / 1000);

const LEGEND = [
  '`<boss name>` — register kill & start timer',
  '`!current` — list all active timers',
  '`!remove <name>` — delete a timer',
  '`!edit <name>` — reset kill time to now',
  '`!launch` — show launch event countdown',
  '`!server` — show server status & player count',
  '`!players` — show current player & merchant count',
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

// ─── Server health fetch ───────────────────────────────────────────────────
async function fetchServerHealth() {
  const res = await fetch(SERVER_HEALTH_URL);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function statusIcon(online) {
  return online ? '🟢 Online' : '🔴 Offline';
}

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
      const button = new ButtonBuilder()
        .setCustomId(`killed_again_${boss.bossName}_${boss.location}`)
        .setLabel('KILLED AGAIN')
        .setStyle(ButtonStyle.Danger);
      const row = new ActionRowBuilder().addComponents(button);
      await channel.send({
        content: `<@${killerId}> ⏰ **${boss.bossName}** is spawning in ~10 minutes!\nMap: \`${boss.location || 'Unknown'}\` — <t:${minTs}:T>`,
        components: [row],
      });
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

// ─── Button interactions ───────────────────────────────────────────────────
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;
  if (!interaction.customId.startsWith('killed_again_')) return;

  // customId format: killed_again_<bossName>_<location>
  const payload = interaction.customId.slice('killed_again_'.length);
  // Find matching active timer by key
  let foundKey = null;
  for (const [key] of activeTimers.entries()) {
    if (payload === key) { foundKey = key; break; }
  }
  // Fallback: match by bossName prefix
  if (!foundKey) {
    for (const [key, timer] of activeTimers.entries()) {
      if (payload.startsWith(timer.boss.bossName)) { foundKey = key; break; }
    }
  }

  if (!foundKey) {
    return interaction.reply({ content: '❌ Could not find an active timer for this boss.', ephemeral: true });
  }

  const existing = activeTimers.get(foundKey);
  const { boss, killerId } = existing;
  if (existing.timerId) clearTimeout(existing.timerId);

  const killTime = Date.now();
  const { minSpawn, maxSpawn } = registerBossKill(boss, killTime, killerId, interaction.channel);
  const embed = buildTimerEmbed(boss, killTime, minSpawn, maxSpawn);

  // Disable the button on the original message
  const disabledButton = new ButtonBuilder()
    .setCustomId(interaction.customId)
    .setLabel('KILLED AGAIN')
    .setStyle(ButtonStyle.Danger)
    .setDisabled(true);
  const disabledRow = new ActionRowBuilder().addComponents(disabledButton);
  await interaction.update({ components: [disabledRow] });

  await interaction.followUp({ content: `🔁 **${boss.bossName}** killed again by <@${interaction.user.id}>! Timer reset.`, embeds: [embed] });
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

  // !launch
  if (content.toLowerCase() === '!launch') {
    const now = Math.floor(Date.now() / 1000);
    return message.reply(
      `🚀 **Revenant Elegy Launch**\n📅 <t:${LAUNCH_TIMESTAMP}:F>\n⏳ <t:${LAUNCH_TIMESTAMP}:R>`
    );
  }

  // !server
  if (content.toLowerCase() === '!server') {
    try {
      const health = await fetchServerHealth();
      return message.reply(
        `**🖥️ Server Status**\n` +
        `Login: ${statusIcon(health.login)} | Char: ${statusIcon(health.char)} | Map: ${statusIcon(health.map)}\n` +
        `👥 Players online: **${health.count}** (${health.unique} unique, ${health.multiclients} multiclient)\n` +
        `🛒 Autotraders/merchants: **${health.autotraders}**`
      );
    } catch (e) {
      return message.reply('❌ Could not reach the server health API.');
    }
  }

  // !players
  if (content.toLowerCase() === '!players') {
    try {
      const health = await fetchServerHealth();
      return message.reply(
        `👥 **Players online:** ${health.count} (${health.unique} unique, ${health.multiclients} multiclient)\n` +
        `🛒 **Autotraders/merchants:** ${health.autotraders}`
      );
    } catch (e) {
      return message.reply('❌ Could not reach the server health API.');
    }
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
