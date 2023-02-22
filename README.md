<a href="#top" id="top">
  <img src="https://user-images.githubusercontent.com/441546/101619135-b1407a00-39c7-11eb-8295-ea7d52a667bb.png" style="max-width: 100%;">
</a>
<p align="center">
  <a href="https://www.npmjs.com/package/@darkobits/adeiu"><img src="https://img.shields.io/npm/v/@darkobits/adeiu.svg?style=flat-square"></a>
  <a href="https://github.com/darkobits/adeiu/actions"><img src="https://img.shields.io/github/workflow/status/darkobits/adeiu/CI?style=flat-square"></a>
  <a href="https://app.codecov.io/gh/darkobits/adeiu/branch/master"><img src="https://img.shields.io/codecov/c/github/darkobits/adeiu/master?style=flat-square"></a>
  <a href="https://depfu.com/github/darkobits/adeiu"><img src="https://img.shields.io/depfu/darkobits/adeiu?style=flat-square"></a>
  <a href="https://bundlephobia.com/package/@darkobits/adeiu"><img src="https://img.shields.io/bundlephobia/minzip/@darkobits/adeiu?label=size&style=flat-square"></a>
  <a href="https://conventionalcommits.org"><img src="https://img.shields.io/static/v1?label=commits&message=conventional&style=flat-square&color=398AFB"></a>
</p>

Yet another POSIX signal handler.

## Features

* Ensures provided functions are called before any other event listeners and are run concurrently,
  minimizing shutdown time.
* Works with any combination of synchronous and asynchronous functions.
* Ensures a clean exit if all functions resolve/return.
* Exits with an error if any functions reject/throw.
* Ensures processes exit cleanly, even when they have asynchronous shut-down functions and the Node
  debugger is in use. (See [this issue](https://github.com/nodejs/node/issues/7742))

## Install

```
npm i @darkobits/adeiu
```

## Use

Adeiu accepts an asynchronous or synchronous handler function. By default, the handler will be
registered to respond to the following signals:

* `SIGINT`
* `SIGQUIT`
* `SIGTERM`
* `SIGUSR2`

```ts
import adeiu from '@darkobits/adeiu';

adeiu(async signal => {
  console.log(`Hey, we got ${signal}. Exiting...`);

  await someAsyncStuff();

  console.log('All done!');
});

// Un-register the callback.
annuler();
```

### Unregistering Handlers

Adeiu returns a function that can be invoked to unregister a handler.

```ts
import adeiu from '@darkobits/adeiu';

const unregister = adeiu(() => {
  // Handler implementation here.
});

// Un-register the handler.
unregister();
```

### Customizing Signals

Usually, responding to signals dynamically can be accomplished by inspecting the `signal` argument
passed to your handler. However, if it is important that handlers are _only_ installed on a particular
signal, or if you'd like to respond to signals other than the defaults, you may optionally provide a
custom array of signals as a second argument:

```ts
import adeiu from '@darkobits/adeiu';

// Register callback that will _only_ be invoked on SIGINT:
adeiu(() => {
  // SIGINT cleanup tasks.
}, ['SIGINT']);
```

```ts
import adeiu from '@darkobits/adeiu';

// Register callback with the default signals _and_ SIGUSR1:
adeiu(() => {
  // Custom cleanup tasks.
}, [...adeiu.SIGNALS, 'SIGUSR1']);
```

<br />
<a href="#top">
  <img src="https://user-images.githubusercontent.com/441546/189774318-67cf3578-f4b4-4dcc-ab5a-c8210fbb6838.png" style="max-width: 100%;">
</a>
