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
    href="https://app.codecov.io/gh/darkobits/adeiu"
  ><img
    src="https://img.shields.io/codecov/c/github/darkobits/adeiu?style=flat-square&color=%2346CC10"
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

Adeiu is a POSIX signal handler designed to for applications with asynchronous cleanup / shutdown
requirements, such as gracefully shutting-down an HTTP server or closing a database connection.

## Features

* Zero dependencies.
* Ensures provided handlers are called before any other event listeners and are run concurrently,
  minimizing shutdown time.
* Works with any combination of synchronous and asynchronous handlers.
* Automatically exits with code `0` once all handlers resolve/return, or `1` if any reject/throw.
* Supports edge cases related to the Node debugger being attached to a process. (See [this issue](https://github.com/nodejs/node/issues/7742))

## Install

```
npm i @darkobits/adeiu
```

## Use

```ts
adeiu(handler: AdeiuHandler, options?: AdeiuOptions): () => void
```

Adeiu accepts an asynchronous or synchronous handler function and returns an unregister function. By
default, the handler will be registered to respond to the following signals:

* `SIGINT`
* `SIGQUIT`
* `SIGTERM`
* `SIGUSR2`

```ts
import adeiu from '@darkobits/adeiu'

const unregister = adeiu(async signal => {
  console.log(`Received signal ${signal}; shutting down...`)
  await asyncCleanup()
  console.log('Done.')
})
```

If multiple handlers are registered, they will be invoked in parallel.

### Customizing Signals

Usually, responding to signals dynamically can be accomplished by inspecting the `signal` argument
passed to your handler. However, if it is important that handlers are _only_ installed for a particular
signal, or if you'd like to respond to signals other than the defaults, you may optionally provide an
array of signals:

```ts
import adeiu from '@darkobits/adeiu'

// Register handler that will _only_ be invoked on SIGINT:
adeiu(() => {
  // ...
}, { signals: ['SIGINT'] })
```

```ts
import adeiu, { DEFAULT_SIGNALS } from '@darkobits/adeiu'

// Register handler with the default signals _and_ SIGUSR1:
adeiu(() => {
  // ...
}, { signals: [...DEFAULT_SIGNALS, 'SIGUSR1'] })
```

### Specifying a Timeout

By default, handlers will have no timeout imposed. If, however, you wish to only wait a specific amount
of time for a handler to run, the `timeout` option may be used:

```ts
import adeiu from '@darkobits/adeiu'

// Register a handler that will have 5 seconds to execute.
adeiu(() => {
  // ...
}, { timeout: 5000 })
```
