const sfx = require('sfx');
module.exports = {
  init: () => {},
  commands: [
    (command, callback) => {
      if (['pizza dog', 'garlic dog'].some(x => command.startsWith(x))) {
        doPlay('bork', command.replace(/\D/g, ''), callback);
      } else {
        callback(null, false);
      }
    }
    // 'ilovepizza': (command, callback) => doPlay('pizza', command, callback)
  ]
};

function doPlay (sound, number, callback) {
  let borkCount = 1;
  if (number) {
    borkCount = Math.min(number, 20);
  }
  doBork(sound, borkCount, callback);
}

function doBork (sound, count, callback) {
  if (count <= 0) {
    return callback(null, true);
  }
  sfx.play('sounds/' + sound + '.wav', () => doBork(sound, count - 1, callback));
}
