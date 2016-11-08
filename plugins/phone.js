module.exports = {
  init: () => {},
  commands: [
    (command, callback) => {
      if (command.startsWith('wake me up at')) {
        return callback(null, true);
      }
      return callback();
    },
    (command, callback) => {
      const phrases = ['when is my alarm', 'when\'s my alarm', 'when\'s my next alarm', 'when is my next alarm']
      if (phrases.includes(command)) {
        return callback(null, true);
      }
      return callback();
    }

  ]
};
