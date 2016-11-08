const https = require('https');
const stream = require('stream');
const url = require('url');
const Speaker = require('speaker');
const opus = require('node-opus');
const ogg = require('ogg');

const ttsRegex = /_a='(.*?)';/;
const fakeUserAgent = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/53.0.2785.116 Safari/537.36';

module.exports = {
  init: () => {},
  commands: [
    (command, callback) => {
      const query = encodeURIComponent(command);
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
          if (!ttsBody) return callback();
          const ttsEncodedData = ttsBody[1];
          if (!ttsEncodedData) return callback();
          const ttsBuffer = Buffer.from(ttsEncodedData, 'base64');
          const ttsStream = new stream.PassThrough();
          ttsStream.end(ttsBuffer);

          const speaker = new Speaker({
            sampleRate: 24000,
            channels: 1
          });
          const oggDecoder = new ogg.Decoder();
          oggDecoder.on('stream', stream => {
            const opusDecoder = new opus.Decoder();
            opusDecoder.on('format', format => {
              // Audio ready
              opusDecoder.pipe(speaker);
              callback(null, true);
            });
            opusDecoder.on('error', callback);
            stream.pipe(opusDecoder);
          });
          oggDecoder.on('error', callback);

          ttsStream.pipe(oggDecoder);
        });
      });
    }
  ]
};
