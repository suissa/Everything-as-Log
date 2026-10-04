import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import Signale = require('./signale');

export type Execution = 'always' | 'success' | 'error' | 'never';

export interface Behavior {
  execution: Execution;
  logger: string;
  badge?: string;
  color?: string;
  label?: string;
  logLevel?: 'info' | 'timer' | 'debug' | 'warn' | 'error';
  message: string;
}

export interface CoreConfiguration {
  config?: Record<string, unknown>;
  behaviors: Record<string, Behavior>;
}

export interface InvocationContext {
  name: string;
  args: unknown[];
  result?: unknown;
  error?: unknown;
}

const require = createRequire(import.meta.url);
const YAML = require('yaml') as {parse(input: string): CoreConfiguration};
const CORE_PATH = path.join(__dirname, 'configs', 'core.yml');
const core = YAML.parse(fs.readFileSync(CORE_PATH, 'utf8'));
const logger = new Signale({config: core.config});

function resolveBehavior(name: string): Behavior {
  const behavior = core.behaviors[name];
  if (!behavior) {
    throw new Error(`Everything-as-Log behavior "${name}" is not configured.`);
  }
  return behavior;
}

function render(template: string, context: InvocationContext): string {
  return template.replace(/\{([^}]+)\}/g, (_, key: string) => {
    const parts = key.split('.');
    let value: unknown = parts[0] === 'error'
      ? context.error
      : parts[0] === 'result'
        ? context.result
        : parts[0] === 'args'
          ? context.args
          : parts[0] === 'name'
            ? context.name
            : undefined;

    for (const part of parts.slice(1)) {
      if (value === null || value === undefined) return '';
      value = (value as Record<string, unknown>)[part];
    }

    return value === undefined || value === null ? '' : String(value);
  });
}

function emit(behavior: Behavior, context: InvocationContext): void {
  if (behavior.execution === 'never') return;
  const method = (logger as unknown as Record<string, (...args: unknown[]) => void>)[behavior.logger];
  if (typeof method !== 'function') {
    throw new Error(`Everything-as-Log logger "${behavior.logger}" is not available.`);
  }
  method.call(logger, render(behavior.message, context));
}

export function EaL(
  behaviorOrTarget?: string | ((...args: any[]) => any)
): any {
  if (typeof behaviorOrTarget === 'function') {
    return decorate(undefined)(behaviorOrTarget, {
      name: behaviorOrTarget.name,
      kind: 'method'
    } as ClassMethodDecoratorContext);
  }

  return decorate(behaviorOrTarget);
}

function decorate(behaviorName?: string) {
  return (originalMethod: (...args: any[]) => any, context: ClassMethodDecoratorContext) => {
    const configuredName = behaviorName ?? String(context.name);
    const behavior = resolveBehavior(configuredName);
    const functionName = String(context.name);

    return function wrapped(this: unknown, ...args: any[]) {
      try {
        const result = originalMethod.apply(this, args);

        if (result && typeof (result as Promise<unknown>).then === 'function') {
          return (result as Promise<unknown>).then(
            value => {
              if (behavior.execution === 'success' || behavior.execution === 'always') {
                emit(behavior, {name: functionName, args, result: value});
              }
              return value;
            },
            error => {
              if (behavior.execution === 'error' || behavior.execution === 'always') {
                emit(behavior, {name: functionName, args, error});
              }
              throw error;
            }
          );
        }

        if (behavior.execution === 'success' || behavior.execution === 'always') {
          emit(behavior, {name: functionName, args, result});
        }

        return result;
      } catch (error) {
        if (behavior.execution === 'error' || behavior.execution === 'always') {
          emit(behavior, {name: functionName, args, error});
        }
        throw error;
      }
    };
  };
}
