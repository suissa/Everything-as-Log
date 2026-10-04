# Everything-as-Log examples

Application code only declares `@EaL("behavior")`. Logger selection, labels, trace formatting and metric formatting remain configuration concerns.

```ts
import {EaL} from '../eal';

class Checkout {
  @EaL('success')
  create() { return {id: 42}; }

  @EaL('error')
  cancel() { throw new Error('cannot cancel'); }
}
```

`src/configs/core.yml` defines the log behavior. `src/configs/obs.json` defines observability for each decorator/function.

Canonical `obs.json` schema:

```json
{
  "success": {
    "trace": {
      "label": "🛣️",
      "name": "success.trace",
      "value": "{name}"
    },
    "metric": {
      "label": "📈",
      "name": "duration",
      "value": "{durationMs}",
      "unit": "ms"
    }
  }
}
```

Supported placeholders: `{name}`, `{args}`, `{result}`, `{error.name}`, `{error.message}` and `{durationMs}`.

A success log can therefore contain the behavior, trace and metric values in one line:

```text
🎉 success completed successfully | 🛣️ success.trace=successful | 📈 duration=0.42 ms
```

Default labels:

- metrics: 📈
- traces: 🛣️ or ➡️
- success: 🎉
- error: 🚨
- warning: ⚠️
- debug: ⌛
- watching: 🔎
- timer_start: 👋
- timer_end: 🤝

Every log type must have an emoji label. Trace and metric labels are validated the same way.

All labels are configurable; changing them does not require changing application code.

Build and run:

```bash
npm run build
node dist/examples/index.js
```