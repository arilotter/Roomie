const ApiAi = require('apiai');
const Sonus = require('sonus');
const uuid = require('uuid');

const credentials = require('./credentials.json');
const playSound = require('./play-sound');
const handleCommandResponse = require('./handle-response');

const apiai = ApiAi(credentials.apiai);
const apiaiSession = { sessionId: uuid.v4() };

const plugins = ['gpmdp', 'memesounds', 'google'].map(name => require('./plugins/' + name));

// Wait for all plugins to initialize.
Promise.all(plugins.map(plugin => plugin.init ? plugin.init() : true)).then(_ => {
  const commands = [];
  plugins.forEach(plugin => commands.push(...plugin.commands));
  // const hints = [].concat(...plugins.filter(plugin => plugin.hints).map(plugin => plugin.hints));

  const speech = require('@google-cloud/speech')({
    projectId: 'api-project-590894355361',
    keyFilename: './google-credentials.json'
  });
  const hotwords = [{file: 'resources/panda.umdl', hotword: 'panda'}];
  const sonus = Sonus.init({hotwords}, speech);
  sonus.on('hotword', (index, keyword) => {
    playSound('activated');
  });
  sonus.on('error', err => {
    if (err.streamingError) {
      return; // This happens when we pause & resume for some reason
    } else {
      console.log(err);
    }
  });
  sonus.on('final-result', transcript => {
    Sonus.pause(sonus);
    console.info(`Query: "${transcript}"`);
    apiai.textRequest(transcript, apiaiSession)
    .on('error', err => {
      failCommand(err);
    })
    .on('response', response => {
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
        handleCommandResponse(commandResponse, _ => Sonus.resume(sonus));
      });
    })
    .end();
  });

  Sonus.start(sonus);

  function failCommand (err) {
    playSound('fail');
    console.log(err);
    Sonus.resume(sonus);
  }
});

// Ctrl-C should always work
process.on('SIGINT', _ => {
  Promise.all(plugins.map(plugin => plugin.destroy ? plugin.destroy() : null));
  process.exit();
});
