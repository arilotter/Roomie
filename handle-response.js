const Speaker = require('speaker');
const opus = require('node-opus');
const ogg = require('ogg');

function handleCommandResponse (data) {
  if (!data) return;
  if (data.pipe) { // data is pipable, therefore probably a stream. For now, assume it's Ogg Opus
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
      });
      opusDecoder.on('error', console.log);
      stream.pipe(opusDecoder);
    });
    oggDecoder.on('error', console.log);
    data.pipe(oggDecoder);
  } else {
    // TODO Here, use a TTS engine to create an audio stream, and pass that back into handleCommandResponse.
    console.log(data);
  }
}
module.exports = handleCommandResponse;
