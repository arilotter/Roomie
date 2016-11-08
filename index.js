const playSound = require('./play-sound');
const some = require('async-some');

const plugins = ['gpmdp', 'phone', 'memesounds', 'smarthome', 'google'].map(name => require('./plugins/' + name));
Promise.all(plugins.map(plugin => plugin.init())).then(() => {
  // Wait for all plugins to initialize.
  const commands = [];

  plugins.forEach(plugin => commands.push(...plugin.commands));

  // input method: speech or text
  const textinput = process.argv.slice(2);
  let ime;
  if (textinput.length > 0) {
    ime = cb => cb(null, {transcript: textinput.join(' '), confidence: 1.0});
  } else {
    ime = require('./speech');
  }

  ime((err, speech) => {
    if (err) throw err;
    console.info('Got command: ' + speech.transcript);
    some(commands, (command, callback) => command(speech.transcript.toLowerCase(), callback), (err, success) => {
      if (err || !success) {
        playSound('fail');
        console.log(err || 'no suitible command found');
      }
    });
  });
  // console.log('killing plugins');
  // Promise.all(plugins.map(plugin => plugin.destroy ? plugin.destroy() : null));
});
