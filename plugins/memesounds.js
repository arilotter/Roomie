const sfx = require('sfx');

module.exports = {
  commands: [
    ['garlicdog', (params, callback) => {
      doPlay('bork', params.number, callback);
    }],
    ['ilovepizza', (params, callback) => {
      doPlay('pizza', params.number, callback);
    }]
  ]
};

function doPlay (sound, repeat, callback) {
  const count = Math.min(repeat || 1, 20);
  if (count <= 0) {
    return callback();
  }
  sfx.play('sounds/' + sound + '.wav', () => doPlay(sound, count - 1, callback));
}
