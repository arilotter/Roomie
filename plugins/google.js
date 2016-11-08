const https = require('https');
const stream = require('stream');
const url = require('url');

const ttsRegex = /_a='(.*?)';/;
const fakeUserAgent = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/53.0.2785.116 Safari/537.36';

module.exports = {
  init: () => {},
  commands: [
    ['input.unknown', (params, callback) => {
      const query = encodeURIComponent(params.inputQuery);
      const options = url.parse(`https://www.google.ca/search?q=${query}&hl=en-US&spknlang=en-US&inm=vs&vse=1`);
      options.headers = {
        'User-Agent': fakeUserAgent
      };
      https.get(options, result => {
        let body = '';
        result.on('data', chunk => {
          body += chunk;
        });
        result.on('end', _ => {
          const ttsBody = ttsRegex.exec(body);
          if (!ttsBody) return callback(new Error('no tts data returned'));
          const ttsEncodedData = ttsBody[1];
          if (!ttsEncodedData) return callback(new Error('no tts data returned'));
          const ttsBuffer = Buffer.from(ttsEncodedData, 'base64');
          const ttsStream = new stream.PassThrough();
          ttsStream.end(ttsBuffer);
          callback(null, ttsStream); // return the voice data for speaking
        });
      });
    }]
  ]
};
