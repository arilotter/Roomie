const WebSocket = require('ws');
const readline = require('readline');
const fs = require('fs');
const path = require('path');
const some = require('async-some');

const getCodeFile = host => path.join(__dirname, '.gpmdp-' + host);

let server;
const hosts = ['192.168.1.124', 'localhost'];

function init () {
  return new Promise((resolve, reject) => {
    some(hosts, (host, cb) => {
      fs.readFile(getCodeFile(host), 'utf8', (err, authCode) => {
        if (err) console.warn('GPMDP: No auth code saved, will request one.');
        server = initWebSocket(authCode, host, () => cb(true), () => cb(false));
      });
    }, (madeConnection) => {
      if (!madeConnection) {
        console.log('GPMDP: no servers');
        resolve();
      } else {
        console.log('GPMDP: Connected successfully');
        resolve();
      }
    });
  });

  function initWebSocket (authCode, host, success, fail) {
    let requestID = 1;
    const promises = {};
    console.log('GPMDP: attempting connection to ' + host);
    let ws = new WebSocket('ws://' + host + ':5672/');
    const cancel = () => {
      console.log('killing ws connection');
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
    const finish = err => cb(null, !err);
    if (!search || Object.keys(search).length === 0) return finish(true);
    const trackMatches = (trackEntity, query) => {
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

const controlEndings = ['', ' music', ' the music', ' my music'];
module.exports = {
  init,
  destroy: () => server.close(), // destroy server if it exists
  commands: [
    // Play a music entity or plays whatever is active
    (command, cb) => {
      let start;
      if (controlEndings.map(x => 'play' + x).some(x => command === x)) {
        play(cb);
      } else if (['play', 'listen to', 'play me', 'play me some', 'play songs by'].some(x => {
        if (command.startsWith(x)) {
          start = x;
          return true;
        }
      })) {
        playSearch(command.slice(start.length + 1), cb); // length + 1 for a space
      } else {
        cb(null, false);
      }
    },

    // Pauses the music
    (command, cb) => {
      if (['pause', 'paws', 'pawn'].map(start => controlEndings.map(end => start + end)).reduce((a, b) => a.concat(b), []).some(x => command === x)) {
        server.sendRequest('playback', 'getPlaybackState').then(ret => {
          if (ret.value === 2) {
            server.sendRequest('playback', 'playPause', (err) => cb(err, !err));
          } else {
            cb(null, true);
          }
        });
      } else {
        cb(null, false);
      }
    }
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
