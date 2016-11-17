const apiai = require('apiai');
const credentials = require('./credentials.json');
const app = apiai(credentials.apiai);

var request = app.textRequest('Hello', { sessionId: 'beans' });

request.on('response', function(response) {
    console.log(response);
});

request.on('error', function(error) {
    console.log(error);
});

request.end();