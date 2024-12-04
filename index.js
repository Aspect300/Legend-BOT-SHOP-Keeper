require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ChannelType,
  ButtonBuilder,
  ActionRowBuilder,
  ButtonStyle,
} = require('discord.js');
const fs = require('fs');
const path = require('path');
const { loadCommands, handleCommand } = require('./commandHandler');
const { loadReminders } = require('./commands/remind');

const PREFIX = '.';
const OWNER_ID = '1194353444023181322'; // Replace with your Discord user ID
const CATEGORY_ID = '1238209651204427848'; // Replace with your category ID
const TRANSCRIPT_CHANNEL_ID = '1254430957771952219'; // Replace with your transcript channel ID

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

// Load commands and reminders
loadCommands();

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
  loadReminders(client);

  // Send the ticket panel when the bot starts
  const channel = client.channels.cache.get('1313549168140353648'); // Replace with your channel ID
  if (channel) {
    const embed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle('🎟️ Legend Shop Tickets')
      .setDescription(
        'Welcome to the ticket system! Please select an option below to open a ticket:\n\n' +
          '**Options:**\n' +
          '🎫 **Purchase** - Create a ticket for purchasing.\n' +
          '🔒 **MM** - Open a ticket for middleman requests.\n' +
          '📩 **Report/Support** - Contact support for help.'
      )
      .setFooter({ text: 'Legend Shop - Ticket System' });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ticket_purchase').setLabel('🎫 Purchase').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('ticket_mm').setLabel('🔒 MM').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('ticket_report')
        .setLabel('📩 Report/Support')
        .setStyle(ButtonStyle.Success)
    );

    channel.send({ embeds: [embed], components: [row] }).catch(console.error);
  } else {
    console.error('Channel not found: Make sure the channel ID is correct.');
  }
});

// Handle ticket buttons
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;

  const category = {
    ticket_purchase: 'Purchase',
    ticket_mm: 'MM',
    ticket_report: 'Report/Support',
  }[interaction.customId];

  // Handle ticket closing
  if (interaction.customId === 'close_ticket') {
    const ticketChannel = interaction.channel;

    if (!ticketChannel.name.startsWith('ticket-')) {
      return interaction.reply({ content: 'This is not a ticket channel!', ephemeral: true });
    }

    try {
      // Fetch messages for transcript
      const messages = await ticketChannel.messages.fetch({ limit: 100 });
      const messageArray = messages
        .reverse() // Sort messages in chronological order
        .map((msg) => `[${msg.createdAt.toISOString()}] ${msg.author.tag}: ${msg.content}`)
        .join('\n');

      // Save transcript to file
      const transcriptPath = path.resolve(__dirname, `transcript-${ticketChannel.id}.txt`);
      fs.writeFileSync(transcriptPath, messageArray);

      // Send transcript to transcript channel
      const transcriptChannel = client.channels.cache.get(TRANSCRIPT_CHANNEL_ID);
      if (transcriptChannel) {
        await transcriptChannel.send({
          content: `📜 Transcript from the ticket channel **${ticketChannel.name}**:`,
          files: [transcriptPath],
        });
      }

      await interaction.reply({ content: 'Ticket closed and transcript saved!' });
      setTimeout(async () => {
        await ticketChannel.delete().catch((err) => console.error('Failed to delete channel:', err));
      }, 3000);
    } catch (error) {
      console.error('Error closing ticket:', error);
      return interaction.reply({ content: '❌ An error occurred while closing the ticket.', ephemeral: true });
    }
    return;
  }

  if (!category) return;

  // Create a ticket channel under the specific category
  const guild = interaction.guild;
  const ticketChannel = await guild.channels.create({
    name: `ticket-${interaction.user.username}`,
    type: ChannelType.GuildText,
    parent: CATEGORY_ID, // Assign the channel to the specified category
    permissionOverwrites: [
      {
        id: guild.id, // Deny access to everyone
        deny: ['ViewChannel'],
      },
      {
        id: interaction.user.id, // Allow access to the ticket creator
        allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'],
      },
    ],
  });

  // Embed for the ticket
  const ticketEmbed = new EmbedBuilder()
    .setColor('#5865F2')
    .setTitle(`🎟️ ${category} Ticket`)
    .setDescription('A staff member will assist you shortly. Please explain your issue in detail.')
    .setFooter({ text: `Ticket created by ${interaction.user.tag}` })
    .setTimestamp();

  // Close button for the ticket
  const closeButtonRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('close_ticket')
      .setLabel('Close Ticket')
      .setStyle(ButtonStyle.Danger)
  );

  // Send the ticket message and ping the owner
  await ticketChannel.send({
    content: `<@${interaction.user.id}> <@${OWNER_ID}>`, // Pings the ticket creator and the owner
    embeds: [ticketEmbed],
    components: [closeButtonRow],
  });

  // Acknowledge ticket creation
  await interaction.reply({ content: `Ticket created: ${ticketChannel}`, ephemeral: true });
});

// Handle general messages
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  if (message.content.startsWith(PREFIX)) {
    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    handleCommand(message, command, args);
  }
});

// Log in the bot
const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error('DISCORD_TOKEN is not set in the .env file');
  process.exit(1);
}

client.login(token).catch((error) => {
  console.error('Error logging in:', error);
  process.exit(1);
});
