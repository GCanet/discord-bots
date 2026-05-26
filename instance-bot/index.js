require('dotenv').config();
const {
  Client, GatewayIntentBits, ChannelType, EmbedBuilder,
  ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder,
  ButtonBuilder, ButtonStyle,
} = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

// ─── Instance Templates ────────────────────────────────────────────────────
const INSTANCE_TEMPLATES = {
  ifirth: {
    fullName: 'Ifrit',
    slots: [
      { role: 'MENTAL', player: null, userId: null },
      { role: 'SNIPER 1', player: null, userId: null },
      { role: 'SNIPER 2', player: null, userId: null },
      { role: 'SNIPER 3', player: null, userId: null },
      { role: 'DEVO', player: null, userId: null },
      { role: 'HW', player: null, userId: null },
      { role: 'PROF', player: null, userId: null },
      { role: 'CHEM DD', player: null, userId: null },
      { role: 'CLOWN', player: null, userId: null },
      { role: 'LINKER', player: null, userId: null },
      { role: 'HP 1', player: null, userId: null },
      { role: 'HP 2', player: null, userId: null },
    ],
    hasFillSpots: false,
  },
  valk: {
    fullName: 'Valkyrie Randgris',
    slots: [
      { role: 'MENTAL', player: null, userId: null },
      { role: 'SNIPER 1', player: null, userId: null },
      { role: 'SNIPER 2', player: null, userId: null },
      { role: 'SNIPER 3', player: null, userId: null },
      { role: 'DEVO', player: null, userId: null },
      { role: 'HW', player: null, userId: null },
      { role: 'PROF', player: null, userId: null },
      { role: 'CHEM DD', player: null, userId: null },
      { role: 'CLOWN', player: null, userId: null },
      { role: 'LINKER', player: null, userId: null },
      { role: 'HP 1', player: null, userId: null },
      { role: 'HP 2', player: null, userId: null },
    ],
    hasFillSpots: false,
  },
  bio3: {
    fullName: 'Biolabs 3',
    slots: [
      { role: 'CHEM DD', player: null, userId: null },
      { role: 'HW', player: null, userId: null },
      { role: 'SNIPER', player: null, userId: null },
      { role: 'PALA', player: null, userId: null },
      { role: 'CLOWN', player: null, userId: null },
      { role: 'PROF', player: null, userId: null },
      { role: 'HP', player: null, userId: null },
      { role: 'FILL SPOT', player: null, userId: null },
      { role: 'FILL SPOT', player: null, userId: null },
      { role: 'FILL SPOT', player: null, userId: null },
      { role: 'FILL SPOT', player: null, userId: null },
      { role: 'FILL SPOT', player: null, userId: null },
    ],
    hasFillSpots: true,
  },
  et: {
    fullName: 'Endless Tower',
    slots: [
      { role: 'MENTAL', player: null, userId: null },
      { role: 'SNIPER 1', player: null, userId: null },
      { role: 'SNIPER 2', player: null, userId: null },
      { role: 'SNIPER 3', player: null, userId: null },
      { role: 'DEVO', player: null, userId: null },
      { role: 'HW', player: null, userId: null },
      { role: 'PROF', player: null, userId: null },
      { role: 'CHEM DD', player: null, userId: null },
      { role: 'CLOWN', player: null, userId: null },
      { role: 'LINKER', player: null, userId: null },
      { role: 'HP 1', player: null, userId: null },
      { role: 'HP 2', player: null, userId: null },
    ],
    hasFillSpots: false,
  },
  'sealed shrine': {
    fullName: 'Sealed Shrine',
    slots: [
      { role: 'MENTAL', player: null, userId: null },
      { role: 'SNIPER 1', player: null, userId: null },
      { role: 'SNIPER 2', player: null, userId: null },
      { role: 'SNIPER 3', player: null, userId: null },
      { role: 'DEVO', player: null, userId: null },
      { role: 'HW', player: null, userId: null },
      { role: 'PROF', player: null, userId: null },
      { role: 'CHEM DD', player: null, userId: null },
      { role: 'CLOWN', player: null, userId: null },
      { role: 'LINKER', player: null, userId: null },
      { role: 'HP 1', player: null, userId: null },
      { role: 'HP 2', player: null, userId: null },
    ],
    hasFillSpots: false,
  },
  bee: {
    fullName: 'Beelzebub',
    slots: [
      { role: 'MENTAL', player: null, userId: null },
      { role: 'HW', player: null, userId: null },
      { role: 'PALA', player: null, userId: null },
      { role: 'CLOWN', player: null, userId: null },
      { role: 'PROF', player: null, userId: null },
      { role: 'CHEM FCP', player: null, userId: null },
      { role: 'HP', player: null, userId: null },
      { role: 'LINKER', player: null, userId: null },
      { role: 'SNIPER', player: null, userId: null },
      { role: 'FILL SPOT', player: null, userId: null },
      { role: 'FILL SPOT', player: null, userId: null },
      { role: 'FILL SPOT', player: null, userId: null },
    ],
    hasFillSpots: true,
  },
  captain: {
    fullName: 'Ghost Ship Captain',
    slots: [
      { role: 'FA 1', player: null, userId: null },
      { role: 'FA 2', player: null, userId: null },
      { role: 'HW', player: null, userId: null },
      { role: 'DEVO 1', player: null, userId: null },
      { role: 'FA 3', player: null, userId: null },
      { role: 'CHAMP', player: null, userId: null },
      { role: 'PROF', player: null, userId: null },
      { role: 'DEVO 2', player: null, userId: null },
      { role: 'CLOWN', player: null, userId: null },
      { role: 'LINKER', player: null, userId: null },
      { role: 'HP 1', player: null, userId: null },
      { role: 'HP 2', player: null, userId: null },
    ],
    hasFillSpots: false,
  },
};

const INSTANCE_ALIASES = {
  ifrith: 'ifirth', ifrit: 'ifirth', ifirth: 'ifirth',
  valkyrie: 'valk', valk: 'valk', 'valkyrie randgris': 'valk',
  biolabs: 'bio3', bio3: 'bio3', 'biolabs 3': 'bio3',
  'endless tower': 'et', et: 'et',
  'sealed shrine': 'sealed shrine', ss: 'sealed shrine',
  beelzebub: 'bee', bee: 'bee',
  captain: 'captain', 'ghost ship': 'captain', 'ghost ship captain': 'captain',
};

// Map<threadId, { instanceKey, slots, creatorId, hour, mainMessageId }>
const activeInstances = new Map();

// ─── Helpers ───────────────────────────────────────────────────────────────

function deepCopySlots(slots) { return slots.map((s) => ({ ...s })); }

function resolveInstanceKey(input) {
  return INSTANCE_ALIASES[input.toLowerCase().trim()] || null;
}

// Get next Friday at 22:00 Spanish time (Europe/Madrid = UTC+1 or UTC+2)
function getDefaultFridayHour() {
  const now = new Date();
  const currentDay = now.getUTCDay(); // 0=Sun, 5=Fri
  let friday = new Date(now);

  if (currentDay === 5) {
    // Today is Friday
    friday.setUTCHours(22, 0, 0, 0);
    if (now < friday) {
      return Math.floor(friday.getTime() / 1000);
    }
  }

  // Calculate days until next Friday
  const daysToAdd = currentDay <= 5 ? 5 - currentDay : 12 - currentDay;
  friday.setUTCDate(friday.getUTCDate() + daysToAdd);
  friday.setUTCHours(22, 0, 0, 0);

  return Math.floor(friday.getTime() / 1000);
}

function buildPartyEmbed(instanceKey, slots, hour, creatorId) {
  const tpl = INSTANCE_TEMPLATES[instanceKey];
  const filled = slots.filter((s) => s.player !== null).length;
  const isFull = filled === 12;

  const lines = slots.map((s, i) => {
    const num = `\`${String(i + 1).padStart(2, '0')}.\``;
    const player = s.player ? `<@${s.userId}>` : '—';
    return `${num} **${s.role}**: ${player}`;
  });

  const commands = [
    '`$job` — sign up by role (e.g. `$hw`, `$sniper1`, `$hp1`)',
    '`$number` — sign up by slot number (e.g. `$3`)',
    '`$swap $job` or `$swap $number` — change your role',
    '`$out` — remove yourself',
    '`$clear <number>` — (creator) clear a slot',
    tpl.hasFillSpots ? '`$fill` — sign up for a fill spot' : '',
    '`$hournew <unix_timestamp>` — set instance time | `$hour help` for info',
    '↕️ Or use the **dropdown below** to pick your role',
  ].filter(Boolean).join('\n');

  const embed = new EmbedBuilder()
    .setTitle(`${tpl.fullName} Party${isFull ? ' ✅ FULL' : ''}`)
    .setColor(isFull ? 0x00ff00 : 0x5865f2)
    .setDescription(lines.join('\n'))
    .addFields(
      { name: 'Spots', value: `${filled}/12`, inline: true },
      { name: 'Created by', value: `<@${creatorId}>`, inline: true }
    );

  if (hour) {
    embed.addFields({ name: '🕐 Instance Time', value: `<t:${hour}:F> (<t:${hour}:R>)`, inline: false });
  }

  embed.addFields({ name: '📋 Commands', value: commands });

  return embed;
}

function buildDropdown(instanceKey, slots) {
  const tpl = INSTANCE_TEMPLATES[instanceKey];
  const options = slots.map((s, i) => {
    const taken = s.player !== null;
    const label = `${String(i + 1).padStart(2, '0')}. ${s.role}${taken ? ` (${s.player})` : ''}`;
    return new StringSelectMenuOptionBuilder()
      .setLabel(label.slice(0, 100))
      .setValue(String(i))
      .setDescription(taken ? `Taken by ${s.player}` : 'Available')
      .setEmoji(taken ? '🔴' : '🟢');
  });

  const menu = new StringSelectMenuBuilder()
    .setCustomId('instance_signup')
    .setPlaceholder('Select a role to sign up...')
    .addOptions(options);

  return new ActionRowBuilder().addComponents(menu);
}

function buildSignOutButton() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('instance_signout')
      .setLabel('Sign Out')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('🚪')
  );
}

async function updateMainMessage(thread, state) {
  try {
    const msg = await thread.messages.fetch(state.mainMessageId);
    const dropdown = buildDropdown(state.instanceKey, state.slots);
    const signout = buildSignOutButton();

    await msg.edit({
      embeds: [buildPartyEmbed(state.instanceKey, state.slots, state.hour, state.creatorId)],
      components: [dropdown, signout],
    });
  } catch (e) {
    console.error('Failed to update main message:', e.message);
  }
}

// ─── Interaction Handler ─────────────────────────────────────────────────
client.on('interactionCreate', async (interaction) => {
  if (!interaction.channel?.isThread()) return;

  const state = activeInstances.get(interaction.channel.id);
  if (!state) return interaction.reply({ content: '❌ This instance is no longer active.', ephemeral: true });

  const { slots } = state;
  const userId = interaction.user.id;
  const username = interaction.member?.displayName || interaction.user.username;

  // Sign Out Button
  if (interaction.isButton() && interaction.customId === 'instance_signout') {
    const idx = slots.findIndex(s => s.userId === userId);
    if (idx === -1) {
      return interaction.reply({ content: "❌ You're not signed up in this party.", ephemeral: true });
    }

    slots[idx].player = null;
    slots[idx].userId = null;

    await updateMainMessage(interaction.channel, state);
    return interaction.reply({ content: `✅ You have signed out.`, ephemeral: true });
  }

  // Dropdown Signup
  if (interaction.isStringSelectMenu() && interaction.customId === 'instance_signup') {
    const targetIdx = parseInt(interaction.values[0]);
    const filledCount = slots.filter(s => s.player !== null).length;

    if (filledCount === 12) {
      return interaction.reply({ content: '❌ The party is full!', ephemeral: true });
    }

    if (slots[targetIdx].role === 'FILL SPOT') {
      const existing = slots.findIndex(s => s.userId === userId);
      if (existing !== -1) return interaction.reply({ content: `❌ You're already in slot ${existing + 1}.`, ephemeral: true });
      if (slots[targetIdx].player !== null) return interaction.reply({ content: `❌ That fill spot is taken.`, ephemeral: true });

      slots[targetIdx].player = username;
      slots[targetIdx].userId = userId;
    } else {
      if (slots[targetIdx].player !== null && slots[targetIdx].userId !== userId) {
        return interaction.reply({ content: `❌ **${slots[targetIdx].role}** is taken by <@${slots[targetIdx].userId}>.`, ephemeral: true });
      }

      const existingIdx = slots.findIndex(s => s.userId === userId);
      if (existingIdx !== -1 && existingIdx !== targetIdx) {
        slots[existingIdx].player = null;
        slots[existingIdx].userId = null;
      }

      slots[targetIdx].player = username;
      slots[targetIdx].userId = userId;
    }

    await updateMainMessage(interaction.channel, state);

    const newFilled = slots.filter(s => s.player !== null).length;
    let reply = `✅ Signed up as **${slots[targetIdx].role}** (slot ${targetIdx + 1}).`;
    if (newFilled === 12) {
      reply += '\n🎉 Party is full!';
      await interaction.channel.send('@here 🎉 **The party is now full!**');
    }

    return interaction.reply({ content: reply, ephemeral: true });
  }
});

// ─── Message Handler ──────────────────────────────────────────────────────
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  const content = message.content.trim();

  // !instance command
  if (content.toLowerCase().startsWith('!instance')) {
    const args = content.slice('!instance'.length).trim();
    if (!args) {
      return message.reply('❌ Available: `ifirth`, `valk`, `bio3`, `et`, `sealed shrine`, `bee`, `captain`');
    }

    const instanceKey = resolveInstanceKey(args);
    if (!instanceKey) {
      return message.reply(`❌ Unknown instance \`${args}\`. Available: \`ifirth\`, \`valk\`, \`bio3\`, \`et\`, \`sealed shrine\`, \`bee\`, \`captain\``);
    }

    const tpl = INSTANCE_TEMPLATES[instanceKey];
    const forumChannelId = process.env.INSTANCES_FORUM_CHANNEL_ID;
    let forumChannel;
    try { forumChannel = await client.channels.fetch(forumChannelId); }
    catch (e) { return message.reply('❌ Could not find the #instances forum channel.'); }

    if (forumChannel.type !== ChannelType.GuildForum) {
      return message.reply('❌ INSTANCES_FORUM_CHANNEL_ID is not a Forum channel.');
    }

    const slots = deepCopySlots(tpl.slots);
    const defaultHour = getDefaultFridayHour();

    const embed = buildPartyEmbed(instanceKey, slots, defaultHour, message.author.id);
    const dropdown = buildDropdown(instanceKey, slots);
    const signout = buildSignOutButton();

    let thread;
    try {
      thread = await forumChannel.threads.create({
        name: tpl.fullName,
        message: { embeds: [embed], components: [dropdown, signout] },
      });
    } catch (e) {
      console.error(e);
      return message.reply('❌ Failed to create thread. Check bot permissions.');
    }

    const firstMessage = await thread.fetchStarterMessage();
    activeInstances.set(thread.id, {
      instanceKey,
      slots,
      creatorId: message.author.id,
      hour: defaultHour,
      mainMessageId: firstMessage.id,
    });

    return message.reply(`✅ Instance thread created: ${thread.url}`);
  }

  // Commands inside threads
  if (!message.channel.isThread()) return;
  const state = activeInstances.get(message.channel.id);
  if (!state) return;

  const thread = message.channel;
  const { slots, instanceKey, creatorId } = state;
  const tpl = INSTANCE_TEMPLATES[instanceKey];
  const userId = message.author.id;
  const username = message.member?.displayName || message.author.username;

  if (content.toLowerCase() === '$hour help') {
    return message.reply('**How to set the instance time:**\nGet a Unix timestamp at https://www.unixtimestamp.com\nThen type: `$hournew <timestamp>`\nExample: `$hournew 1716900000`');
  }

  if (content.toLowerCase().startsWith('$hournew')) {
    if (userId !== creatorId) return message.reply('❌ Only the instance creator can change the time.');
    const ts = parseInt(content.split(/\s+/)[1]);
    if (isNaN(ts)) return message.reply('❌ Invalid timestamp. Use `$hour help`.');
    state.hour = ts;
    await updateMainMessage(thread, state);
    return message.reply(`✅ Instance time set to <t:${ts}:F>`);
  }

  if (content.toLowerCase() === '$out') {
    const idx = slots.findIndex(s => s.userId === userId);
    if (idx === -1) return message.reply("❌ You're not signed up.");
    slots[idx].player = null;
    slots[idx].userId = null;
    await updateMainMessage(thread, state);
    return message.reply(`✅ ${username} removed from slot ${idx + 1}.`);
  }

  if (content.toLowerCase().startsWith('$clear')) {
    if (userId !== creatorId) return message.reply('❌ Only the instance creator can clear slots.');
    const num = parseInt(content.split(/\s+/)[1]);
    if (isNaN(num) || num < 1 || num > 12) return message.reply('❌ Invalid slot number (1-12).');
    const idx = num - 1;
    const was = slots[idx].player;
    slots[idx].player = null;
    slots[idx].userId = null;
    await updateMainMessage(thread, state);
    return message.reply(`✅ Cleared slot ${num}${was ? ` (was ${was})` : ''}.`);
  }

  if (content.toLowerCase() === '$fill') {
    if (!tpl.hasFillSpots) return message.reply('❌ This instance has no fill spots.');
    const fillIdx = slots.findIndex(s => s.role === 'FILL SPOT' && s.player === null);
    if (fillIdx === -1) return message.reply('❌ All fill spots are taken!');
    const existing = slots.findIndex(s => s.userId === userId);
    if (existing !== -1) return message.reply(`❌ You're already in slot ${existing + 1}.`);
    slots[fillIdx].player = username;
    slots[fillIdx].userId = userId;
    await updateMainMessage(thread, state);
    const filled = slots.filter(s => s.player !== null).length;
    let reply = `✅ Signed up as **FILL SPOT** (slot ${fillIdx + 1}).`;
    if (filled === 12) { reply += '\n🎉 Party is full!'; await thread.send('@here 🎉 **Party is now full!**'); }
    return message.reply(reply);
  }

  if (content.toLowerCase().startsWith('$swap')) {
    const swapArg = content.slice(5).trim().replace(/^\$/, '');
    if (!swapArg) return message.reply('❌ Usage: `$swap $job` or `$swap $number`');
    const existingIdx = slots.findIndex(s => s.userId === userId);
    if (existingIdx === -1) return message.reply("❌ You're not signed up yet.");
    let targetIdx = parseInt(swapArg);
    if (isNaN(targetIdx)) targetIdx = findSlotByRole(slots, swapArg);
    else targetIdx -= 1;

    if (targetIdx < 0 || targetIdx >= 12) return message.reply('❌ Invalid slot.');
    if (slots[targetIdx].player !== null && slots[targetIdx].userId !== userId) {
      return message.reply(`❌ Slot ${targetIdx + 1} is taken.`);
    }

    slots[existingIdx].player = null;
    slots[existingIdx].userId = null;
    slots[targetIdx].player = username;
    slots[targetIdx].userId = userId;
    await updateMainMessage(thread, state);
    return message.reply(`✅ Moved to slot ${targetIdx + 1} (**${slots[targetIdx].role}**).`);
  }

  // $job or $number signup
  if (content.startsWith('$')) {
    const arg = content.slice(1).trim().toLowerCase();
    if (!arg) return;

    const filledCount = slots.filter(s => s.player !== null).length;
    if (filledCount === 12) return message.reply('❌ The party is full!');

    const existingIdx = slots.findIndex(s => s.userId === userId);
    let targetIdx = parseInt(arg);
    if (!isNaN(targetIdx)) {
      targetIdx -= 1;
    } else {
      targetIdx = findSlotByRole(slots, arg);
    }

    if (targetIdx < 0 || targetIdx >= 12) return message.reply('❌ Invalid slot/role.');

    if (slots[targetIdx].role === 'FILL SPOT') return message.reply('❌ Use `$fill` for fill spots.');

    if (slots[targetIdx].player !== null && slots[targetIdx].userId !== userId) {
      return message.reply(`❌ Slot taken by <@${slots[targetIdx].userId}>.`);
    }

    if (existingIdx !== -1 && existingIdx !== targetIdx) {
      slots[existingIdx].player = null;
      slots[existingIdx].userId = null;
    }

    slots[targetIdx].player = username;
    slots[targetIdx].userId = userId;
    await updateMainMessage(thread, state);

    const newFilled = slots.filter(s => s.player !== null).length;
    let reply = `✅ Signed up as **${slots[targetIdx].role}** (slot ${targetIdx + 1}).`;
    if (newFilled === 12) { reply += '\n🎉 Party is full!'; await thread.send('@here 🎉 **The party is now full!**'); }
    return message.reply(reply);
  }
});

function findSlotByRole(slots, roleInput) {
  const lower = roleInput.toLowerCase().replace(/\s+/g, '');
  for (let i = 0; i < slots.length; i++) {
    if (slots[i].role.toLowerCase().replace(/\s+/g, '') === lower) return i;
  }
  return -1;
}

client.once('ready', () => {
  console.log(`[Instance Bot] Logged in as ${client.user.tag}`);
});

client.login(process.env.DISCORD_TOKEN);
