const sfx = require('sfx');

module.exports = {
  commands: [
    ['garlicdog', (params, callback) => {
      doPlay('bork', Math.min(params.number || 1, 20), callback);
    }],
    ['ilovepizza', (params, callback) => {
      doPlay('pizza', Math.min(params.number || 1, 20), callback);
    }]
  ]
};

function doPlay (sound, repeat, callback) {
  if (repeat <= 0) {
    return callback();
  }
  sfx.play('sounds/' + sound + '.wav', () => doPlay(sound, repeat - 1, callback));
}
