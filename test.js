const Sonus = require('sonus');
const speech = require('@google-cloud/speech')({
  projectId: 'api-project-590894355361',
  keyFilename: './google-credentials.json'
});
const hotwords = [{file: 'resources/panda.umdl', hotword: 'panda'}];
const inputMethod = Sonus.init({hotwords}, speech);
Sonus.start(inputMethod);
Sonus.stop(inputMethod);
setTimeout(_ => {
	Sonus.start(inputMethod);
}, 2);
inputMethod.on('hotword', (index, keyword) => {
	console.log('!');
});
inputMethod.on('final-result', transcript => {
	console.log(transcript);
});