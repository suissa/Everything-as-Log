import fs from 'node:fs';
import path from 'node:path';
import Signale = require('./signale');

export type Execution = 'always' | 'success' | 'error' | 'never';

export interface Behavior {
  execution: Execution;
  logger: string;
  badge?: string;
  color?: string;
  label: string;
  logLevel?: 'info' | 'timer' | 'debug' | 'warn' | 'error';
  message: string;
}

export interface ObservationTemplate {
  label: string;
  name: string;
  value: string;
  unit?: string;
}

export interface ObservationConfiguration {
  trace: ObservationTemplate;
  metric: ObservationTemplate;
}

export interface CoreConfiguration {
  config?: Record<string, unknown>;
  behaviors: Record<string, Behavior>;
}

export type ObsConfiguration = Record<string, ObservationConfiguration>;

interface InvocationContext {
  name: string;
  args: unknown[];
  result?: unknown;
  error?: unknown;
  durationMs: number;
}

interface YamlParser {
  parse(source: string): CoreConfiguration;
}

const YAML = require('yaml') as YamlParser;
const CORE_PATH = path.join(__dirname, 'configs', 'core.yml');
const OBS_PATH = path.join(__dirname, 'configs', 'obs.json');

function loadCoreConfiguration(): CoreConfiguration {
  const configuration = YAML.parse(fs.readFileSync(CORE_PATH, 'utf8'));

  if (!configuration || !configuration.behaviors) {
    throw new Error('Everything-as-Log core configuration must define behaviors.');
  }

  for (const [name, behavior] of Object.entries(configuration.behaviors)) {
    if (!behavior.label || !/\p{Extended_Pictographic}/u.test(behavior.label)) {
      throw new Error(`Everything-as-Log behavior "${name}" must have an emoji label.`);
    }
  }

  return configuration;
}

function loadObservabilityConfiguration(): ObsConfiguration {
  const configuration = JSON.parse(fs.readFileSync(OBS_PATH, 'utf8')) as ObsConfiguration;

  for (const [name, observation] of Object.entries(configuration)) {
    if (!observation?.trace?.label || !observation?.trace?.name || observation.trace.value === undefined) {
      throw new Error(`Everything-as-Log trace schema for "${name}" is invalid.`);
    }

    if (!observation?.metric?.label || !observation?.metric?.name || observation.metric.value === undefined) {
      throw new Error(`Everything-as-Log metric schema for "${name}" is invalid.`);
    }

    if (!/\p{Extended_Pictographic}/u.test(observation.trace.label) || !/\p{Extended_Pictographic}/u.test(observation.metric.label)) {
      throw new Error(`Everything-as-Log observation labels for "${name}" must use emoji.`);
    }
  }

  return configuration;
}

const core = loadCoreConfiguration();
const observations = loadObservabilityConfiguration();
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
      case 'name': value = context.name; break;
      case 'args': value = context.args; break;
      case 'result': value = context.result; break;
      case 'error': value = context.error; break;
      case 'durationMs': value = context.durationMs; break;
      default: return '';
    }

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
  if (typeof method !== 'function') return;

  const observation = observations[context.name];
  const parts = [render(behavior.message, context)];

  if (observation) {
    parts.push(`${observation.trace.label} ${observation.trace.name}=${render(observation.trace.value, context)}`);
    parts.push(`${observation.metric.label} ${observation.metric.name}=${render(observation.metric.value, context)}${observation.metric.unit ? ` ${observation.metric.unit}` : ''}`);
  }

  try {
    method.call(logger, parts.join(' | '));
  } catch {
    // Observability must never change the decorated function's behavior.
  }
}

function createDecorator(behaviorName?: string) {
  return (originalMethod: (...args: any[]) => any, context: ClassMethodDecoratorContext) => {
    const functionName = String(context.name);
    const behavior = resolveBehavior(behaviorName ?? functionName);

    return function wrapped(this: unknown, ...args: any[]) {
      const startedAt = process.hrtime.bigint();
      let result: unknown;
      const elapsed = () => Number(process.hrtime.bigint() - startedAt) / 1_000_000;

      try {
        result = originalMethod.apply(this, args);
      } catch (error) {
        if (behavior.execution === 'error' || behavior.execution === 'always') {
          emit(behavior, {name: functionName, args, error, durationMs: elapsed()});
        }
        throw error;
      }

      if (result && typeof (result as Promise<unknown>).then === 'function') {
        return (result as Promise<unknown>).then(
          value => {
            if (behavior.execution === 'success' || behavior.execution === 'always') {
              emit(behavior, {name: functionName, args, result: value, durationMs: elapsed()});
            }
            return value;
          },
          error => {
            if (behavior.execution === 'error' || behavior.execution === 'always') {
              emit(behavior, {name: functionName, args, error, durationMs: elapsed()});
            }
            throw error;
          }
        );
      }

      if (behavior.execution === 'success' || behavior.execution === 'always') {
        emit(behavior, {name: functionName, args, result, durationMs: elapsed()});
      }

      return result;
    };
  };
}

export function EaL(target: (...args: any[]) => any, context: ClassMethodDecoratorContext): (...args: any[]) => any;
export function EaL(behaviorName?: string): (target: (...args: any[]) => any, context: ClassMethodDecoratorContext) => (...args: any[]) => any;
export function EaL(behaviorOrTarget?: string | ((...args: any[]) => any), context?: ClassMethodDecoratorContext): any {
  if (typeof behaviorOrTarget === 'function' && context) return createDecorator()(behaviorOrTarget, context);
  return createDecorator(behaviorOrTarget as string | undefined);
}

export const EaLConfiguration = core;
export const EaLObservabilityConfiguration = observations;