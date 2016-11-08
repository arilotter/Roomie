const WebSocket = require('ws');
const readline = require('readline');
const fs = require('fs');
const path = require('path');
const some = require('async-some');

const getCodeFile = host => path.join(__dirname, '.gpmdp-' + host);

let server;
const hosts = ['192.168.2.3', 'localhost'];

function init () {
  return new Promise((resolve, reject) => {
    some(hosts, (host, cb) => {
      fs.readFile(getCodeFile(host), 'utf8', (err, authCode) => {
        if (err) console.warn('GPMDP: No auth code saved, will request one.');
        server = initWebSocket(authCode, host, () => cb(host), () => cb());
      });
    }, (host) => {
      if (!host) {
        console.log('GPMDP: no servers');
        resolve();
      } else {
        console.log('GPMDP: Connected to ' + host);
        resolve();
      }
    });
  });

  function initWebSocket (authCode, host, success, fail) {
    let requestID = 1;
    const promises = {};
    let ws = new WebSocket('ws://' + host + ':5672/');
    const cancel = () => {
      ws.terminate();
      fail();
    };
    const timeout = setTimeout(cancel, 1000); // fail if it takes too long to connect

    ws.on('open', () => {
      clearTimeout(timeout);
      doAuthentication(authCode, success);
    });

    ws.on('error', err => {
      if (err) {
        clearTimeout(timeout);
        cancel();
      }
    });
    ws.on('message', (data) => {
      const msg = JSON.parse(data);
      const promise = promises[msg.requestID];
      if (msg.namespace === 'result' && promise) {
        ({
          return: promise.resolve,
          error: promise.reject
        })[msg.type](msg);
        // resolve or reject the promise depending on the return type.
      } else if (msg.channel === 'connect') {
        if (msg.payload === 'CODE_REQUIRED') {
          // get auth code from user
          getUserCode(code => {
            doAuthentication(code);
          });
        } else {
          authCode = msg.payload;
          fs.writeFile(getCodeFile(host), authCode, err => {
            if (err) throw err;
            console.log('Saved auth code to ' + getCodeFile(host));
          });
          doAuthentication(authCode, success);
        }
      }
    });

    const sendRequest = (namespace, method, args, callback) => {
      // this method returns a Promise that's fulfilled upon server response.
      // the passed callback is run when the message is sent/
      if (typeof args === 'function' && callback === undefined) {
        callback = args;
        args = [];
      }
      const reqObj = { namespace, method, arguments: args };
      reqObj['requestID'] = requestID;
      const promise = new Promise((resolve, reject) => {
        promises[requestID] = {resolve, reject};
      });
      requestID++;
      try {
        ws.send(JSON.stringify(reqObj), callback);
      } catch (err) {
        if (err.message === 'not opened') {
          console.warn('GPMDP: Music control failed because we\'re not connected to a client. Trying to reconnect...');
          init();
        } else {
          throw err;
        }
      }
      return promise;
    };
    const doAuthentication = (code, cb) => {
      if (code && cb) {
        cb();
      }
      sendRequest('connect', 'connect', ['Roomie', code]);
    };
    return { sendRequest, close: () => ws.close() };
  }
}

function play (cb) {
  server.sendRequest('playback', 'getPlaybackState').then(ret => {
    if (ret.value === 0 || ret.value === 1) {
      server.sendRequest('playback', 'playPause', err => {
        if (err) console.error(err);
        cb(null, true);
      });
    } else {
      cb(null, true); // didn't pause, but it's ok!
    }
  });
}

function playSearch (query, cb) {
  server.sendRequest('search', 'performSearch', [query.replace('designer', 'desiigner')]).then(message => {
    const search = message.value;
    const finish = err => cb(err);
    if (!search || Object.keys(search).length === 0) return cb(new Error('No matching music entities'));
    const trackMatches = (trackEntity, query) => {
      console.log(trackEntity, query);
      if (!trackEntity) {
        return false;
      }
      const search = (trackEntity.name || trackEntity.title).toLowerCase();
      return search === query;
    };
    if (search.bestMatch && trackMatches(search.bestMatch.value, query)) {
      return server.sendRequest('search', 'playResult', [search.bestMatch.value], finish);
    }
    if (![search.albums, search.artists, search.tracks].map(entity => entity[0]).some(entity => {
      if (trackMatches(entity, query)) {
        server.sendRequest('search', 'playResultRadio', [entity], finish);
        return true;
      }
    })) { // no perfect matches
      if (search.tracks.length > 0) {
        server.sendRequest('search', 'playResult', [search.tracks[0]], finish);
      } else {
        playSearch(query.replace('by', ''), cb);
      }
    }
  });
}

module.exports = {
  init,
  destroy: () => server.close(), // destroy server if it exists
  commands: [
    // Play a music entity or plays whatever is active
    ['music_play', (params, callback) => {
      const artist = params['music-artist'];
      const song = params['music-song'];
      if (artist || song) {
        playSearch(artist + ' ' + song, callback);
      } else {
        play(callback);
      }
    }],
    ['music_pause', (_, callback) => {
      server.sendRequest('playback', 'getPlaybackState').then(playbackState => {
        if (playbackState.value === 2) {
          server.sendRequest('playback', 'playPause', err => callback(err));
        } else {
          callback();
        }
      });
    }]
  ]
};

function getUserCode (callback) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.question('Please enter the code from GPMDP: ', answer => {
    callback(answer);
    rl.close();
  });
}
