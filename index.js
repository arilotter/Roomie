const credentials = require('./credentials.json');
const playSound = require('./play-sound');
const handleCommandResponse = require('./handle-response');
const apiai = require('apiai');

const plugins = ['gpmdp', 'memesounds', 'google'].map(name => require('./plugins/' + name));

// Wait for all plugins to initialize.
Promise.all(plugins.map(plugin => plugin.init ? plugin.init() : true)).then(_ => {
  const commands = [];
  plugins.forEach(plugin => commands.push(...plugin.commands));
  const app = apiai(credentials.apiai);
  const hints = [].concat(...plugins.filter(plugin => plugin.hints).map(plugin => plugin.hints));

  // input method: speech or text
  const textinput = process.argv.slice(2);
  let ime;
  if (textinput.length > 0) {
    ime = cb => cb(null, {transcript: textinput.join(' '), confidence: 1.0});
  } else {
    ime = require('./speech');
  }

  ime(hints, (err, speech) => {
    if (err) throw err;
    if (!speech.transcript) return;
    console.info(`Query: "${speech.transcript}"`);
    const aiRequest = app.textRequest(speech.transcript);
    aiRequest.on('response', response => {
      const result = response.result;

      const command = commands.find(command => command[0] === result.action);
      if (!command) {
        return failCommand(new Error('No suitable commands, please implement ' + result.action));
      }
      const options = result.parameters;
      options.inputQuery = result.resolvedQuery;
      console.log(`| ${command[0]} -> ${JSON.stringify(options)}\n`);
      command[1](options, (err, commandResponse) => {
        if (err) {
          return failCommand(err);
        }
        handleCommandResponse(commandResponse);
      });
    });
    aiRequest.end();
  });
});

function failCommand (err) {
  playSound('fail');
  console.log(err);
}

// Ctrl-C should always work
process.on('SIGINT', _ => {
  Promise.all(plugins.map(plugin => plugin.destroy ? plugin.destroy() : null));
  process.exit();
});
