module.exports = {
  init: () => {},
  commands: [
    ['api.ai action', (params, callback) => {
      callback(null, 'text to reply with');
    }],
    ['api.ai action', (params, callback) => {
      callback(new Error('invalid params')); // on error
    }]
  ]
};
