import {EaL} from '../eal';

class Example {
  @EaL('success')
  successful() { return {ok: true}; }

  @EaL('error')
  failing() { throw new Error('example failure'); }

  @EaL('warning')
  warning() { throw new Error('example warning'); }

  @EaL('debug')
  debug() { return 'debug value'; }

  @EaL('watching')
  watching() { return 'watch value'; }

  @EaL('timer_start')
  startTimer() { return 'started'; }

  @EaL('timer_end')
  endTimer() { return 'finished'; }
}

const example = new Example();
example.successful();
try { example.failing(); } catch { /* original error is preserved */ }
try { example.warning(); } catch { /* original error is preserved */ }
example.debug();
example.watching();
example.startTimer();
example.endTimer();