const record = require('node-record-lpcm16');
const snowboy = require('snowboy');

const models = new snowboy.Models();
models.add({
  file: 'resources/snowboy.umdl',
  hotwords: 'snowboy'
});

const detector = new snowboy.Detector({
  resource: 'resources/common.res',
  models
});
record.start().pipe(detector);
