<p align="center">
  <picture>
    <source
      media="(prefers-color-scheme: dark)"
      srcset="https://github.com/darkobits/adeiu/assets/441546/5639dd58-3a6f-4015-98a9-14da5e22a97e"
      width="100%"
    >
    <img
      src="https://github.com/darkobits/adeiu/assets/441546/80c6679d-1419-4e15-a7f7-480e51c97511"
      width="100%"
    >
  </picture>
</p>
<p align="center">
  <a
    href="https://www.npmjs.com/package/@darkobits/adeiu"
  ><img
    src="https://img.shields.io/npm/v/@darkobits/adeiu.svg?style=flat-square"
  ></a>
  <a
    href="https://github.com/darkobits/adeiu/actions?query=workflow%3Aci"
  ><img
    src="https://img.shields.io/github/actions/workflow/status/darkobits/adeiu/ci.yml?style=flat-square"
  ></a>
  <a
    href="https://depfu.com/repos/github/darkobits/adeiu"
  ><img
    src="https://img.shields.io/depfu/darkobits/adeiu?style=flat-square"
  ></a>
  <a
    href="https://conventionalcommits.org"
  ><img
    src="https://img.shields.io/static/v1?label=commits&message=conventional&style=flat-square&color=398AFB"
  ></a>
  <a
    href="https://firstdonoharm.dev"
  ><img
    src="https://img.shields.io/static/v1?label=license&message=hippocratic&style=flat-square&color=753065"
  ></a>
</p>

Yet another POSIX signal handler.

## Features

* Ensures provided handlers are called before any other event listeners and are run concurrently,
  minimizing shutdown time.
* Works with any combination of synchronous and asynchronous functions.
* Exits with code `0` if all handlers resolve/return.
* Exits with an `AggregateError` if any handler rejects/throws.
* Supports edge cases related to the Node debugger being attached to a process. (See [this issue](https://github.com/nodejs/node/issues/7742))

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
  console.log(`Received signal ${signal}; performing shut-down tasks...`);

  await someAsyncStuff();

  console.log('All done!');
});
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
passed to your handler. However, if it is important that handlers are _only_ invoked for a particular
signal, or if you'd like to respond to signals other than the defaults, you may optionally provide an
array of signals as a second argument:

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
