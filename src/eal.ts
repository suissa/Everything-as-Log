import fs from 'node:fs';
import path from 'node:path';
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

interface InvocationContext {
  name: string;
  args: unknown[];
  result?: unknown;
  error?: unknown;
}

interface YamlParser {
  parse(source: string): CoreConfiguration;
}

// Loaded lazily so the application only depends on the decorator boundary.
const YAML = require('yaml') as YamlParser;
const CORE_PATH = path.join(__dirname, 'configs', 'core.yml');

function loadCoreConfiguration(): CoreConfiguration {
  const configuration = YAML.parse(fs.readFileSync(CORE_PATH, 'utf8'));

  if (!configuration || !configuration.behaviors) {
    throw new Error('Everything-as-Log core configuration must define behaviors.');
  }

  return configuration;
}

const core = loadCoreConfiguration();
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
    let value: unknown;

    switch (parts[0]) {
      case 'name':
        value = context.name;
        break;
      case 'args':
        value = context.args;
        break;
      case 'result':
        value = context.result;
        break;
      case 'error':
        value = context.error;
        break;
      default:
        return '';
    }

    for (const part of parts.slice(1)) {
      if (value === null || value === undefined) {
        return '';
      }

      value = (value as Record<string, unknown>)[part];
    }

    return value === undefined || value === null ? '' : String(value);
  });
}

function emit(behavior: Behavior, context: InvocationContext): void {
  if (behavior.execution === 'never') {
    return;
  }

  const method = (logger as unknown as Record<string, (...args: unknown[]) => void>)[behavior.logger];

  if (typeof method !== 'function') {
    throw new Error(`Everything-as-Log logger "${behavior.logger}" is not available.`);
  }

  // Logging must never change the business function's behavior.
  try {
    method.call(logger, render(behavior.message, context));
  } catch {
    // A logger failure is intentionally isolated from the decorated function.
  }
}

function createDecorator(behaviorName?: string) {
  return (
    originalMethod: (...args: any[]) => any,
    context: ClassMethodDecoratorContext
  ) => {
    const functionName = String(context.name);
    const behavior = resolveBehavior(behaviorName ?? functionName);

    return function wrapped(this: unknown, ...args: any[]) {
      let result: unknown;

      try {
        result = originalMethod.apply(this, args);
      } catch (error) {
        if (behavior.execution === 'error' || behavior.execution === 'always') {
          emit(behavior, {name: functionName, args, error});
        }

        // Preserve normal function semantics: the decorator observes the error,
        // but does not replace or swallow it.
        throw error;
      }

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
    };
  };
}

export function EaL(
  target: (...args: any[]) => any,
  context: ClassMethodDecoratorContext
): (...args: any[]) => any;
export function EaL(behaviorName?: string): (
  target: (...args: any[]) => any,
  context: ClassMethodDecoratorContext
) => (...args: any[]) => any;
export function EaL(
  behaviorOrTarget?: string | ((...args: any[]) => any),
  context?: ClassMethodDecoratorContext
): any {
  if (typeof behaviorOrTarget === 'function' && context) {
    return createDecorator()(behaviorOrTarget, context);
  }

  return createDecorator(behaviorOrTarget as string | undefined);
}

export const EaLConfiguration = core;
