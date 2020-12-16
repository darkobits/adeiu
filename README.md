<a href="#top" id="top">
  <img src="https://user-images.githubusercontent.com/441546/101619135-b1407a00-39c7-11eb-8295-ea7d52a667bb.png" style="max-width: 100%;">
</a>
<p align="center">
  <a href="https://www.npmjs.com/package/@darkobits/adeiu"><img src="https://img.shields.io/npm/v/@darkobits/adeiu.svg?style=flat-square"></a>
  <a href="https://travis-ci.com/github/darkobits/adeiu"><img src="https://img.shields.io/travis/com/darkobits/adeiu?style=flat-square"></a>
  <a href="https://www.codacy.com/app/darkobits/adeiu"><img src="https://img.shields.io/codacy/coverage/c18a33f1bf79468087b8a06ac8c645d2.svg?style=flat-square"></a>
  <a href="https://david-dm.org/darkobits/adeiu"><img src="https://img.shields.io/david/darkobits/adeiu.svg?style=flat-square"></a>
  <a href="https://github.com/conventional-changelog/standard-version"><img src="https://img.shields.io/badge/conventional%20commits-1.0.0-027dc6.svg?style=flat-square"></a>
</p>

Yet another POSIX signal handler.

## Features

* Ensures provided functions are called before any other event listeners and are run concurrently, minimizing shutdown time.
* Works with any combination of synchronous and asynchronous functions.
* Ensures a clean exit if all functions resolve/return.
* Exits with an error if any functions reject/throw.
* Ensures processes exit cleanly, even when they have asynchronous shut-down functions and the Node debugger is in use. (See [this issue](https://github.com/nodejs/node/issues/7742))

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

## Advanced Usage

Usually, responding to signals dynamically can be accomplished by inspecting the `signal` argument passed to your callback. However, if it is important that listeners are _only_ installed on a particular signal, you may optionally provide a custom array of signals to assign a callback to.

```ts
import adeiu from '@darkobits/adeiu';

// Register callback that will only be invoked on SIGINT.
adeiu(() => {
  // SIGINT cleanup tasks.
}, ['SIGINT']);
```

```ts
import adeiu, {SIGNALS} from '@darkobits/adeiu';

// Register callback with the default signals and SIGUSR1.
adeiu(() => {
  // Custom cleanup tasks.
}, [...SIGNALS, 'SIGUSR1']);
```

<a href="#top">
  <img src="https://user-images.githubusercontent.com/441546/102322726-5e6d4200-3f34-11eb-89f2-c31624ab7488.png" style="max-width: 100%;">
</a>
