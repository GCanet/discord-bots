require('dotenv').config();
const {
  Client, GatewayIntentBits, ChannelType, EmbedBuilder,
  ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder,
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
      { role: 'SD SIN', player: null, userId: null },
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

// Map<threadId, { instanceKey, slots, creatorId, hour, mainMessageId, dropdownMessageId }>
const activeInstances = new Map();

// ─── Helpers ───────────────────────────────────────────────────────────────

function deepCopySlots(slots) { return slots.map((s) => ({ ...s })); }

function resolveInstanceKey(input) {
  return INSTANCE_ALIASES[input.toLowerCase().trim()] || null;
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

async function updateMainMessage(thread, state) {
  try {
    const msg = await thread.messages.fetch(state.mainMessageId);
    const row = buildDropdown(state.instanceKey, state.slots);
    await msg.edit({
      embeds: [buildPartyEmbed(state.instanceKey, state.slots, state.hour, state.creatorId)],
      components: [row],
    });
  } catch (e) {
    console.error('Failed to update main message:', e.message);
  }
}

function findSlotByRole(slots, roleInput) {
  const lower = roleInput.toLowerCase().replace(/\s+/g, '');
  for (let i = 0; i < slots.length; i++) {
    if (slots[i].role.toLowerCase().replace(/\s+/g, '') === lower) return i;
  }
  return -1;
}

function findPlayerSlot(slots, userId) {
  return slots.findIndex((s) => s.userId === userId);
}

// ─── Bot Ready ────────────────────────────────────────────────────────────
client.once('ready', () => {
  console.log(`[Instance Bot] Logged in as ${client.user.tag}`);
});

// ─── Dropdown interaction handler ─────────────────────────────────────────
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isStringSelectMenu()) return;
  if (interaction.customId !== 'instance_signup') return;

  const thread = interaction.channel;
  const state = activeInstances.get(thread.id);
  if (!state) return interaction.reply({ content: '❌ This instance is no longer active.', ephemeral: true });

  const { slots } = state;
  const userId = interaction.user.id;
  const username = interaction.member?.displayName || interaction.user.username;
  const targetIdx = parseInt(interaction.values[0]);

  // Check party full
  const filledCount = slots.filter((s) => s.player !== null).length;
  if (filledCount === 12) {
    return interaction.reply({ content: '❌ The party is full!', ephemeral: true });
  }

  // Fill spot check
  if (slots[targetIdx].role === 'FILL SPOT') {
    const existing = findPlayerSlot(slots, userId);
    if (existing !== -1) {
      return interaction.reply({ content: `❌ You're already in slot ${existing + 1} as **${slots[existing].role}**.`, ephemeral: true });
    }
    if (slots[targetIdx].player !== null) {
      return interaction.reply({ content: `❌ That fill spot is already taken.`, ephemeral: true });
    }
    slots[targetIdx].player = username;
    slots[targetIdx].userId = userId;
  } else {
    // Slot already taken by someone else
    if (slots[targetIdx].player !== null && slots[targetIdx].userId !== userId) {
      return interaction.reply({
        content: `❌ **${slots[targetIdx].role}** is already taken by <@${slots[targetIdx].userId}>.`,
        ephemeral: true,
      });
    }
    // Clear previous slot
    const existingIdx = findPlayerSlot(slots, userId);
    if (existingIdx !== -1 && existingIdx !== targetIdx) {
      slots[existingIdx].player = null;
      slots[existingIdx].userId = null;
    }
    slots[targetIdx].player = username;
    slots[targetIdx].userId = userId;
  }

  await updateMainMessage(thread, state);

  const newFilled = slots.filter((s) => s.player !== null).length;
  let reply = `✅ Signed up as **${slots[targetIdx].role}** (slot ${targetIdx + 1}).`;
  if (newFilled === 12) {
    reply += '\n🎉 Party is full!';
    await thread.send('@here 🎉 **The party is now full!**');
  }

  return interaction.reply({ content: reply, ephemeral: true });
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
    const embed = buildPartyEmbed(instanceKey, slots, null, message.author.id);
    const row = buildDropdown(instanceKey, slots);

    let thread;
    try {
      thread = await forumChannel.threads.create({
        name: tpl.fullName,
        message: { embeds: [embed], components: [row] },
      });
    } catch (e) {
      console.error(e);
      return message.reply('❌ Failed to create thread. Check bot permissions.');
    }

    const firstMessage = await thread.fetchStarterMessage();
    activeInstances.set(thread.id, {
      instanceKey, slots, creatorId: message.author.id, hour: null, mainMessageId: firstMessage.id,
    });

    return message.reply(`✅ Instance thread created: ${thread.url}`);
  }

  // Commands inside active instance threads
  if (!message.channel.isThread()) return;
  const state = activeInstances.get(message.channel.id);
  if (!state) return;

  const thread = message.channel;
  const { slots, instanceKey, creatorId } = state;
  const tpl = INSTANCE_TEMPLATES[instanceKey];
  const userId = message.author.id;
  const username = message.member?.displayName || message.author.username;

  // $hour help
  if (content.toLowerCase() === '$hour help') {
    return message.reply(
      '**How to set the instance time:**\nGet a Unix timestamp at https://www.unixtimestamp.com\nThen type: `$hournew <timestamp>`\nExample: `$hournew 1716900000`'
    );
  }

  // $hournew
  if (content.toLowerCase().startsWith('$hournew')) {
    if (userId !== creatorId) return message.reply('❌ Only the instance creator can change the time.');
    const ts = parseInt(content.split(/\s+/)[1]);
    if (isNaN(ts)) return message.reply('❌ Invalid timestamp. Use `$hour help`.');
    state.hour = ts;
    await updateMainMessage(thread, state);
    return message.reply(`✅ Instance time set to <t:${ts}:F>`);
  }

  // $out
  if (content.toLowerCase() === '$out') {
    const idx = findPlayerSlot(slots, userId);
    if (idx === -1) return message.reply("❌ You're not signed up.");
    slots[idx].player = null;
    slots[idx].userId = null;
    await updateMainMessage(thread, state);
    return message.reply(`✅ ${username} removed from slot ${idx + 1}.`);
  }

  // $clear <number>
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

  // $fill
  if (content.toLowerCase() === '$fill') {
    if (!tpl.hasFillSpots) return message.reply('❌ This instance has no fill spots.');
    const fillIdx = slots.findIndex((s) => s.role === 'FILL SPOT' && s.player === null);
    if (fillIdx === -1) return message.reply('❌ All fill spots are taken!');
    const existing = findPlayerSlot(slots, userId);
    if (existing !== -1) return message.reply(`❌ You're already in slot ${existing + 1} as **${slots[existing].role}**.`);
    slots[fillIdx].player = username;
    slots[fillIdx].userId = userId;
    await updateMainMessage(thread, state);
    const filled = slots.filter((s) => s.player !== null).length;
    let reply = `✅ ${username} signed up as **FILL SPOT** (slot ${fillIdx + 1}).`;
    if (filled === 12) { reply += '\n🎉 Party is full!'; await thread.send('@here 🎉 **Party is now full!**'); }
    return message.reply(reply);
  }

  // $swap
  if (content.toLowerCase().startsWith('$swap')) {
    const swapArg = content.slice(5).trim().replace(/^\$/, '');
    if (!swapArg) return message.reply('❌ Usage: `$swap $job` or `$swap $number`');
    const existingIdx = findPlayerSlot(slots, userId);
    if (existingIdx === -1) return message.reply("❌ You're not signed up yet.");
    let targetIdx;
    const asNum = parseInt(swapArg);
    if (!isNaN(asNum)) { targetIdx = asNum - 1; }
    else { targetIdx = findSlotByRole(slots, swapArg); }
    if (targetIdx < 0 || targetIdx >= 12) return message.reply('❌ Invalid slot.');
    if (slots[targetIdx].player !== null && slots[targetIdx].userId !== userId) {
      return message.reply(`❌ Slot ${targetIdx + 1} (**${slots[targetIdx].role}**) is taken by <@${slots[targetIdx].userId}>.`);
    }
    slots[existingIdx].player = null;
    slots[existingIdx].userId = null;
    slots[targetIdx].player = username;
    slots[targetIdx].userId = userId;
    await updateMainMessage(thread, state);
    return message.reply(`✅ ${username} moved to slot ${targetIdx + 1} (**${slots[targetIdx].role}**).`);
  }

  // $job or $number signup
  if (content.startsWith('$')) {
    const arg = content.slice(1).trim().toLowerCase();
    if (!arg) return;

    const filledCount = slots.filter((s) => s.player !== null).length;
    if (filledCount === 12) return message.reply('❌ The party is full!');

    const existingIdx = findPlayerSlot(slots, userId);
    let targetIdx;
    const asNum = parseInt(arg);
    if (!isNaN(asNum)) {
      targetIdx = asNum - 1;
      if (targetIdx < 0 || targetIdx >= 12) return message.reply('❌ Slot number must be 1-12.');
    } else {
      const normalized = arg.replace(/(\D)(\d)$/, '$1 $2').toUpperCase();
      targetIdx = findSlotByRole(slots, normalized);
      if (targetIdx === -1) targetIdx = findSlotByRole(slots, arg);
      if (targetIdx === -1) {
        const roles = tpl.slots.map((s) => `\`${s.role}\``).join(', ');
        return message.reply(`❌ **${arg.toUpperCase()}** is not a role in **${tpl.fullName}**.\nAvailable: ${roles}`);
      }
    }

    if (slots[targetIdx].role === 'FILL SPOT') return message.reply('❌ Use `$fill` for fill spots.');

    if (slots[targetIdx].player !== null && slots[targetIdx].userId !== userId) {
      return message.reply(`❌ Slot ${targetIdx + 1} (**${slots[targetIdx].role}**) is taken by <@${slots[targetIdx].userId}>.`);
    }

    if (existingIdx !== -1 && existingIdx !== targetIdx) {
      slots[existingIdx].player = null;
      slots[existingIdx].userId = null;
    }

    slots[targetIdx].player = username;
    slots[targetIdx].userId = userId;
    await updateMainMessage(thread, state);

    const newFilled = slots.filter((s) => s.player !== null).length;
    let reply = `✅ ${username} signed up as **${slots[targetIdx].role}** (slot ${targetIdx + 1}).`;
    if (newFilled === 12) { reply += '\n🎉 Party is full!'; await thread.send('@here 🎉 **The party is now full!**'); }
    return message.reply(reply);
  }
});

client.login(process.env.DISCORD_TOKEN);
