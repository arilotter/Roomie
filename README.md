# Roomie

A pretty cool hotword-activated home automation system, like a poor man's Alexa.

Features:
  - ok-ish plugin system with some plugins
  - it can tell you how tall Obama is
  - it can control Google Play Music Desktop Player on a local or remote machine

How to use it: Just install dependancies with `yarn` or `npm install`, then `node index.js`

Don't forget to add an api.ai API key in `credentials.json`
```
{
	"apiai": "<key here>"
}
```

Then speak `panda` to your computer, followed by a command like "How old is Obama"

You can alternatively use `node index.js how old is Obama`, but you'll receive an audio response