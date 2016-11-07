const sfx = require('sfx');
const path = require('path');

module.exports = (soundName, cb) => {
  sfx.play(path.join(__dirname, 'sounds', soundName + '.wav'), cb);
};
