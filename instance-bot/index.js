require('dotenv').config();
const { Client, GatewayIntentBits, ChannelType, EmbedBuilder } = require('discord.js');

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

// aliases for instance names
const INSTANCE_ALIASES = {
  ifrith: 'ifirth',
  ifrit: 'ifirth',
  ifirth: 'ifirth',
  valkyrie: 'valk',
  valk: 'valk',
  'valkyrie randgris': 'valk',
  biolabs: 'bio3',
  bio3: 'bio3',
  'biolabs 3': 'bio3',
  'endless tower': 'et',
  et: 'et',
  'sealed shrine': 'sealed shrine',
  ss: 'sealed shrine',
  beelzebub: 'bee',
  bee: 'bee',
  captain: 'captain',
  'ghost ship': 'captain',
  'ghost ship captain': 'captain',
};

// ─── Active Threads State ──────────────────────────────────────────────────
// Map<threadId, { instanceKey, slots, creatorId, hour, mainMessageId }>
const activeInstances = new Map();

// ─── Helpers ───────────────────────────────────────────────────────────────

function deepCopySlots(slots) {
  return slots.map((s) => ({ ...s }));
}

function resolveInstanceKey(input) {
  const lower = input.toLowerCase().trim();
  return INSTANCE_ALIASES[lower] || null;
}

function buildPartyEmbed(instanceKey, slots, hour, creatorId) {
  const tpl = INSTANCE_TEMPLATES[instanceKey];
  const filled = slots.filter((s) => s.player !== null).length;
  const isFull = filled === 12;

  const lines = slots.map((s, i) => {
    const num = `\`${String(i + 1).padStart(2, '0')}.\``;
    const role = `**${s.role}**`;
    const player = s.player ? `<@${s.userId}>` : '—';
    return `${num} ${role}: ${player}`;
  });

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

  embed.addFields({
    name: '📋 Commands',
    value: [
      '`$job` — Sign up (e.g. `$sniper1`, `$hw`, `$hp1`)',
      '`$number` — Sign up by slot number (e.g. `$3`)',
      '`$swap $job` or `$swap $number` — Change your role',
      '`$out` — Remove yourself from the party',
      '`$clear number` — (Creator) Clear a slot',
      tpl.hasFillSpots ? '`$fill` — Sign up for a fill spot (open signup)' : '',
      '`$hour help` — How to set the instance time',
      '`$hournew <unix_timestamp>` — Update the instance time',
    ]
      .filter(Boolean)
      .join('\n'),
  });

  return embed;
}

function findSlotByRole(slots, roleInput) {
  const lower = roleInput.toLowerCase().replace(/\s+/g, '');
  for (let i = 0; i < slots.length; i++) {
    const slotRole = slots[i].role.toLowerCase().replace(/\s+/g, '');
    if (slotRole === lower) return i;
  }
  return -1;
}

function findPlayerSlot(slots, userId) {
  return slots.findIndex((s) => s.userId === userId);
}

async function updateMainMessage(thread, state) {
  try {
    const msg = await thread.messages.fetch(state.mainMessageId);
    await msg.edit({ embeds: [buildPartyEmbed(state.instanceKey, state.slots, state.hour, state.creatorId)] });
  } catch (e) {
    console.error('Failed to update main message:', e.message);
  }
}

// ─── Bot Ready ────────────────────────────────────────────────────────────
client.once('ready', () => {
  console.log(`[Instance Bot] Logged in as ${client.user.tag}`);
});

// ─── Message Handler ──────────────────────────────────────────────────────
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  const content = message.content.trim();

  // ── !instance command (any channel) ──────────────────────────────────────
  if (content.toLowerCase().startsWith('!instance')) {
    const args = content.slice('!instance'.length).trim();
    if (!args) {
      return message.reply(
        '❌ Please specify an instance. Available: `ifirth`, `valk`, `bio3`, `et`, `sealed shrine`, `bee`, `captain`'
      );
    }

    const instanceKey = resolveInstanceKey(args);
    if (!instanceKey) {
      return message.reply(
        `❌ Unknown instance \`${args}\`. Available: \`ifirth\`, \`valk\`, \`bio3\`, \`et\`, \`sealed shrine\`, \`bee\`, \`captain\``
      );
    }

    const tpl = INSTANCE_TEMPLATES[instanceKey];
    const forumChannelId = process.env.INSTANCES_FORUM_CHANNEL_ID;
    let forumChannel;
    try {
      forumChannel = await client.channels.fetch(forumChannelId);
    } catch (e) {
      return message.reply('❌ Could not find the #instances forum channel. Check INSTANCES_FORUM_CHANNEL_ID.');
    }

    if (forumChannel.type !== ChannelType.GuildForum) {
      return message.reply('❌ The configured INSTANCES_FORUM_CHANNEL_ID is not a Forum channel.');
    }

    const slots = deepCopySlots(tpl.slots);
    const embed = buildPartyEmbed(instanceKey, slots, null, message.author.id);

    let thread;
    try {
      const result = await forumChannel.threads.create({
        name: tpl.fullName,
        message: { embeds: [embed] },
      });
      thread = result;
    } catch (e) {
      console.error(e);
      return message.reply('❌ Failed to create thread in #instances. Make sure the bot has permissions.');
    }

    const firstMessage = await thread.fetchStarterMessage();
    activeInstances.set(thread.id, {
      instanceKey,
      slots,
      creatorId: message.author.id,
      hour: null,
      mainMessageId: firstMessage.id,
    });

    await message.reply(`✅ Instance thread created: ${thread.url}`);
    return;
  }

  // ── Commands inside active instance threads ───────────────────────────────
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
      '**How to set the instance time:**\n' +
        'Use https://www.unixtimestamp.com to get a Unix timestamp for your desired time.\n' +
        'Then type: `$hournew <unix_timestamp>`\n' +
        'Example: `$hournew 1716900000`\n' +
        'Discord will display it in every member\'s local timezone automatically.'
    );
  }

  // $hournew <timestamp>
  if (content.toLowerCase().startsWith('$hournew')) {
    if (userId !== creatorId) {
      return message.reply('❌ Only the instance creator can change the time.');
    }
    const ts = parseInt(content.split(/\s+/)[1]);
    if (isNaN(ts)) return message.reply('❌ Invalid timestamp. Use `$hour help` for instructions.');
    state.hour = ts;
    await updateMainMessage(thread, state);
    return message.reply(`✅ Instance time updated to <t:${ts}:F>`);
  }

  // $out — remove yourself
  if (content.toLowerCase() === '$out') {
    const idx = findPlayerSlot(slots, userId);
    if (idx === -1) return message.reply("❌ You're not signed up.");
    slots[idx].player = null;
    slots[idx].userId = null;
    await updateMainMessage(thread, state);
    return message.reply(`✅ ${username} removed from slot ${idx + 1}.`);
  }

  // $clear <number> — creator only
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

  // $fill — for bio3 / bee fill spots
  if (content.toLowerCase() === '$fill') {
    if (!tpl.hasFillSpots) return message.reply('❌ This instance has no fill spots.');
    const fillIdx = slots.findIndex((s) => s.role === 'FILL SPOT' && s.player === null);
    if (fillIdx === -1) return message.reply('❌ All fill spots are taken!');
    // check not already signed up
    const existing = findPlayerSlot(slots, userId);
    if (existing !== -1) return message.reply(`❌ You're already signed up in slot ${existing + 1} as **${slots[existing].role}**.`);
    slots[fillIdx].player = username;
    slots[fillIdx].userId = userId;
    await updateMainMessage(thread, state);
    const filled = slots.filter((s) => s.player !== null).length;
    let reply = `✅ ${username} signed up as **FILL SPOT** (slot ${fillIdx + 1}).`;
    if (filled === 12) {
      reply += '\n🎉 **Party is full! Sign-ups are closed.**';
      await thread.send('@here 🎉 **Party is now full!**');
    }
    return message.reply(reply);
  }

  // $swap $job or $swap $number
  if (content.toLowerCase().startsWith('$swap')) {
    const swapArg = content.slice(5).trim().replace(/^\$/, '');
    if (!swapArg) return message.reply('❌ Usage: `$swap $job` or `$swap $number`');

    const existingIdx = findPlayerSlot(slots, userId);
    if (existingIdx === -1) return message.reply("❌ You're not signed up. Use `$job` or `$number` to sign up first.");

    let targetIdx;
    const asNum = parseInt(swapArg);
    if (!isNaN(asNum)) {
      targetIdx = asNum - 1;
    } else {
      targetIdx = findSlotByRole(slots, swapArg);
    }

    if (targetIdx < 0 || targetIdx >= 12) return message.reply('❌ Invalid slot.');
    if (slots[targetIdx].player !== null && slots[targetIdx].userId !== userId) {
      return message.reply(`❌ Slot ${targetIdx + 1} (**${slots[targetIdx].role}**) is already taken by <@${slots[targetIdx].userId}>.`);
    }
    // clear old slot
    slots[existingIdx].player = null;
    slots[existingIdx].userId = null;
    // assign new slot
    slots[targetIdx].player = username;
    slots[targetIdx].userId = userId;
    await updateMainMessage(thread, state);
    return message.reply(`✅ ${username} moved to slot ${targetIdx + 1} (**${slots[targetIdx].role}**).`);
  }

  // $job or $number signup
  if (content.startsWith('$')) {
    const arg = content.slice(1).trim().toLowerCase();
    if (!arg) return;

    // check if full
    const filledCount = slots.filter((s) => s.player !== null).length;
    if (filledCount === 12) return message.reply('❌ The party is full! Sign-ups are closed.');

    // check already signed up
    const existingIdx = findPlayerSlot(slots, userId);

    let targetIdx;
    const asNum = parseInt(arg);
    if (!isNaN(asNum)) {
      // $number signup
      targetIdx = asNum - 1;
      if (targetIdx < 0 || targetIdx >= 12) return message.reply('❌ Slot number must be between 1 and 12.');
    } else {
      // $job signup — also handle sniper1 → SNIPER 1, hp1 → HP 1, etc.
      const normalized = arg.replace(/(\D)(\d)$/, '$1 $2').toUpperCase();
      targetIdx = findSlotByRole(slots, normalized);
      if (targetIdx === -1) {
        // try as-is
        targetIdx = findSlotByRole(slots, arg);
      }
      if (targetIdx === -1) {
        const roles = tpl.slots.map((s) => `\`${s.role}\``).join(', ');
        return message.reply(`❌ **${arg.toUpperCase()}** is not a role in **${tpl.fullName}**.\nAvailable roles: ${roles}`);
      }
    }

    if (slots[targetIdx].role === 'FILL SPOT') {
      return message.reply('❌ Use `$fill` to sign up for fill spots.');
    }

    if (slots[targetIdx].player !== null && slots[targetIdx].userId !== userId) {
      return message.reply(
        `❌ Slot ${targetIdx + 1} (**${slots[targetIdx].role}**) is already taken by <@${slots[targetIdx].userId}>. Use \`$swap $${slots[targetIdx].role}\` to request a swap, or pick another slot.`
      );
    }

    // clear previous slot if exists
    if (existingIdx !== -1 && existingIdx !== targetIdx) {
      slots[existingIdx].player = null;
      slots[existingIdx].userId = null;
    }

    slots[targetIdx].player = username;
    slots[targetIdx].userId = userId;
    await updateMainMessage(thread, state);

    const newFilled = slots.filter((s) => s.player !== null).length;
    let reply = `✅ ${username} signed up as **${slots[targetIdx].role}** (slot ${targetIdx + 1}).`;
    if (newFilled === 12) {
      reply += '\n🎉 **Party is full! Sign-ups are closed.**';
      await thread.send('@here 🎉 **The party is now full!**');
    }
    return message.reply(reply);
  }
});

client.login(process.env.DISCORD_TOKEN);
