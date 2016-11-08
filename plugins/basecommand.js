module.exports = {
  init: () => {},
  hints: ['do a thing'], // hints to provide to the speech recognition API to make words more easily recognized
  commands: [
    ['api.ai action', (params, callback) => {
      callback(null, 'text to reply with');
    }],
    ['api.ai action', (params, callback) => {
      callback(new Error('invalid params')); // on error
    }]
  ]
};
