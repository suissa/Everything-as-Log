import {EaL} from '../src';

class Example {
  @EaL('success')
  successful() {
    return 42;
  }

  @EaL('error')
  failing() {
    throw new Error('expected failure');
  }

  @EaL
  info() {
    return 'uses the method name as the canonical behavior';
  }

  @EaL('success')
  async successfulAsync() {
    return 'async';
  }

  @EaL('error')
  async failingAsync() {
    throw new Error('expected async failure');
  }
}

const example = new Example();

example.successful();
example.info();

try {
  example.failing();
} catch {}

example.successfulAsync().then(() => undefined);
example.failingAsync().catch(() => undefined);
