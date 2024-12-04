const fs = require('fs');
const path = require('path');

const commands = new Map();

function loadCommands() {
  const commandFiles = fs.readdirSync(path.join(__dirname, 'commands')).filter(file => file.endsWith('.js'));

  for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    commands.set(command.name, command);
  }
}

function getCommands() {
  return Array.from(commands.keys());
}

async function handleCommand(message, commandName, args) {
  const command = commands.get(commandName);

  if (!command) return;

  try {
    await command.execute(message, args);
  } catch (error) {
    console.error(error);
    message.reply('There was an error trying to execute that command!');
  }
}

module.exports = {
  loadCommands,
  handleCommand,
  getCommands, // Export the getCommands function
};