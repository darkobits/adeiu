<a href="#top" id="top">
  <img src="https://user-images.githubusercontent.com/441546/56342070-cf5ec400-616b-11e9-8079-04fc9bc744c5.png" style="max-width: 100%;">
</a>
<p align="center">
  <a href="https://www.npmjs.com/package/@darkobits/adeiu"><img src="https://img.shields.io/npm/v/@darkobits/adeiu.svg?style=flat-square"></a>
  <a href="https://travis-ci.org/darkobits/adeiu"><img src="https://img.shields.io/travis/darkobits/adeiu.svg?style=flat-square"></a>
  <a href="https://david-dm.org/darkobits/adeiu"><img src="https://img.shields.io/david/darkobits/adeiu.svg?style=flat-square"></a>
  <a href="https://github.com/conventional-changelog/standard-version"><img src="https://img.shields.io/badge/conventional%20commits-1.0.0-027dc6.svg?style=flat-square"></a>
  <a href="https://github.com/sindresorhus/xo"><img src="https://img.shields.io/badge/code_style-XO-e271a5.svg?style=flat-square"></a>
</p>

Yet another POSIX signal handler.

## Features

* Runs any combination of synchronous and asynchronous callbacks concurrently.
* Ensures a clean exit if all callbacks resolve/return.
* Exit with an error if any callbcks reject/throw.
* Ensures processes exit cleanly, even when they have asynchronous callbacks and the Node debugger is in use. (See [this issue](https://github.com/nodejs/node/issues/7742).

## Install

```
npm i @darkobits/adeiu
```

## Use

```ts
import adeiu from '@darkobits/adeiu';

// Register a callback.
const annuler = adeiu(async signal => {
  console.log(`Hey, we got ${signal}. Exiting...`);

  await someAsyncStuff();

  console.log('All done!');
});

// Unregister the callack.
annuler();
```
