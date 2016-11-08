const record = require('node-record-lpcm16');
const async = require('async');
const path = require('path');
const grpc = require('grpc');
const snowboy = require('snowboy');
const playSound = require('./play-sound');

const googleProtoFiles = require('google-proto-files');
const googleAuth = require('google-auto-auth');
const Transform = require('stream').Transform;

const PROTO_ROOT_DIR = googleProtoFiles('..');
const host = 'speech.googleapis.com';

const protoDescriptor = grpc.load({
  root: PROTO_ROOT_DIR,
  file: path.relative(PROTO_ROOT_DIR, googleProtoFiles.speech.v1beta1)
}, 'proto', {
  binaryAsBase64: true,
  convertFieldsToCamelCase: true
});
const speechProto = protoDescriptor.google.cloud.speech.v1beta1;

function getSpeechService (host, callback) {
  const googleAuthClient = googleAuth({
    scopes: [
      'https://www.googleapis.com/auth/cloud-platform'
    ]
  });

  googleAuthClient.getAuthClient(function (err, authClient) {
    if (err) {
      return callback(err);
    }

    const credentials = grpc.credentials.combineChannelCredentials(
      grpc.credentials.createSsl(),
      grpc.credentials.createFromGoogleCredential(authClient)
    );

    console.log('Connecting to Google Speech');
    const stub = new speechProto.Speech(host, credentials);
    return callback(null, stub);
  });
}

function detectSpeech (micStream, hints, callback) {
  async.waterfall([
    function (cb) {
      getSpeechService(host, cb);
    },
    function sendRequest (speechService, cb) {
      function teardown () {
        // Stop streaming audio to the Speech API
        micStream.unpipe(toRecognizeRequest);
        micStream.unpipe(call);
      }
      const autoTimeout = setTimeout(_ => {
        teardown();
        callback(null, {transcript: '', confidence: 0});
      }, 6000);

      console.log('Analyzing speech...');
      const call = speechService.streamingRecognize();

      call.on('error', err => {
        teardown();
        clearTimeout(autoTimeout);
        callback(err);
      });
      call.on('data', response => {
        if (response) {
          const results = response.results;
          if (results && results.length > 0 && results[0].isFinal) {
            teardown();
            clearTimeout(autoTimeout);
            callback(null, results[0].alternatives[0]);
          }
        }
      });

      // Write the initial recognize reqeust
      call.write({
        streamingConfig: {
          config: {
            encoding: 'LINEAR16',
            sampleRate: 16000,
            speechContext: { phrases: hints }
          },
          interimResults: false,
          singleUtterance: true
        }
      });

      const toRecognizeRequest = new Transform({ objectMode: true });
      toRecognizeRequest._transform = (chunk, encoding, done) => {
        done(null, {
          audioContent: chunk
        });
      };

      // Stream the audio to the Speech API
      micStream
        .pipe(toRecognizeRequest)
        .pipe(call);
    }
  ]);
}

function oneshot (callback) {
  const micStream = record.start();
  detectSpeech(micStream, [], callback);
}

function hotword (hints, callback) {
  const models = new snowboy.Models();
  models.add({
    file: 'resources/panda.umdl',
    hotwords: 'panda'
  });
  const detector = new snowboy.Detector({
    resource: 'resources/common.res',
    models
  });
  const micStream = record.start();
  micStream.pipe(detector);
  console.log('Listening for hotword');
  detector.on('hotword', (index, hotword) => {
    console.log(hotword);
    if (hotword === 'panda') {
      playSound('activated');
      micStream.unpipe(detector); // stop listening for hotword in case the user says it in his query
      detectSpeech(micStream, hints, (err, transcript) => {
        micStream.pipe(detector); // start listening for hotword again
        callback(err, transcript);
      });
    }
  });
}
module.exports = hotword;
