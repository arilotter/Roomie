const apiai = require('apiai');
const Sonus = require('sonus');

const credentials = require('./credentials.json');
const playSound = require('./play-sound');
const handleCommandResponse = require('./handle-response');

const plugins = ['gpmdp', 'memesounds', 'google'].map(name => require('./plugins/' + name));

// Wait for all plugins to initialize.
Promise.all(plugins.map(plugin => plugin.init ? plugin.init() : true)).then(_ => {
  const commands = [];
  plugins.forEach(plugin => commands.push(...plugin.commands));
  const app = apiai(credentials.apiai);
  // const hints = [].concat(...plugins.filter(plugin => plugin.hints).map(plugin => plugin.hints));

  // input method: speech or text
  const textinput = process.argv.slice(2);
  let inputMethod;
  if (textinput.length > 0) {
    inputMethod = cb => cb(null, {transcript: textinput.join(' '), confidence: 1.0});
  } else {
    const speech = require('@google-cloud/speech')({
      projectId: 'api-project-590894355361',
      keyFilename: './google-credentials.json'
    });
    const hotwords = [{file: 'resources/panda.umdl', hotword: 'panda'}];
    inputMethod = Sonus.init({hotwords}, speech);
    Sonus.start(inputMethod);
  }

  inputMethod.on('hotword', (index, keyword) => {
    playSound('activated');
  });

  inputMethod.on('final-result', transcript => {
    Sonus.pause(inputMethod);
    console.info(`Query: "${transcript}"`);
    const nlpRequest = app.textRequest(transcript);
    nlpRequest.on('error', err => {
      console.log(err);
    });
    nlpRequest.on('response', response => {
      const result = response.result;

      const command = commands.find(command => command[0] === result.action);
      if (!command) {
        return failCommand(new Error('No suitable commands, please implement ' + result.action));
      }
      const options = result.parameters;
      options.inputQuery = result.resolvedQuery;
      console.log(`| ${command[0]} -> ${JSON.stringify(options)}\n`);
      command[1](options, (err, commandResponse) => {
        // Restart listening
        if (err) {
          return failCommand(err);
        }
        handleCommandResponse(commandResponse, _ => Sonus.resume(inputMethod));
      });
    });
    nlpRequest.end();
  });
  function failCommand (err) {
    playSound('fail');
    console.log(err);
    Sonus.resume(inputMethod);
  }
});

// Ctrl-C should always work
process.on('SIGINT', _ => {
  Promise.all(plugins.map(plugin => plugin.destroy ? plugin.destroy() : null));
  process.exit();
});
