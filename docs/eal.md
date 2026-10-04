# Everything-as-Log decorators

Everything-as-Log separates application behavior from logging policy.

Application code only declares a behavior:

```ts
class OrderService {
  @EaL('success')
  createOrder() {
    return createOrder();
  }

  @EaL('error')
  cancelOrder() {
    return cancelOrder();
  }
}
```

When the canonical behavior has the same name as the method, the name can be omitted:

```ts
class OrderService {
  @EaL
  success() {
    return createOrder();
  }
}
```

The decorator resolves the method name against `src/configs/core.yml`.

## Execution policies

Each behavior declares an `execution` policy:

- `success`: emit only when the function returns successfully.
- `error`: emit only when the function throws or a returned Promise rejects.
- `always`: emit on both success and error.
- `never`: disable emission for the behavior.

For example:

```yaml
behaviors:
  createOrder:
    execution: success
    logger: success
    message: "{name} completed successfully"

  deleteOrder:
    execution: error
    logger: error
    message: "{error.name}: {error.message}"
```

The decorated function does not import Signale, select a log level, construct a message, or decide when a message should be emitted.

## Error isolation

The decorator catches synchronous exceptions and Promise rejections long enough to apply the configured logging policy. The original error is then rethrown/rejected unchanged, preserving the function's normal semantics.

Failures inside the logging implementation itself are isolated and cannot replace the application's original result or error.

## Configuration

The original Signale configuration was extracted into `src/configs/core.yml`:

- all default display settings from `package.json`;
- all built-in logger names;
- badge, color, label and log-level values from `src/types.js`;
- canonical execution policies and message templates.

The YAML file is the policy boundary. Application source should not contain logging configuration.

## Message templates

Supported placeholders are:

- `{name}`: decorated method name;
- `{args}`: invocation arguments;
- `{result}`: successful return value;
- `{error}`: thrown error;
- nested values such as `{error.message}` and `{error.name}`.

