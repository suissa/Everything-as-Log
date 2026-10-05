# Everything-as-Log

**Everything-as-Log (EaL)** é uma camada de logging orientada a comportamento para aplicações TypeScript/Node.js.

A ideia central é separar **o que a aplicação faz** de **como essa execução é observada**.

No código da aplicação, o desenvolvedor declara apenas a intenção de observabilidade:

```ts
@EaL('success')
createOrder() {
  // regra de negócio
}
```

ou, quando o nome do método já representa o comportamento canônico:

```ts
@EaL
createOrder() {
  // regra de negócio
}
```

A aplicação não precisa conhecer o logger, a mensagem, o nível, o badge, a cor ou a política de execução. Essas decisões ficam na configuração do EaL.

## Princípio

O EaL trata logging como uma propriedade configurável do comportamento, e não como código espalhado pela regra de negócio.

Em vez de:

```ts
function createOrder() {
  logger.info('Creating order');

  // regra de negócio

  logger.success('Order created');
}
```

o código pode declarar:

```ts
@EaL('success')
function createOrder() {
  // regra de negócio
}
```

O decorator observa a execução e consulta a configuração canônica para decidir quando e como registrar o comportamento.

Isso reduz o acoplamento entre domínio e infraestrutura de observabilidade.

## Estado atual

O projeto utiliza:

- TypeScript para a camada de decorators e integração;
- Node.js 18 ou superior;
- Signale como engine de logging;
- YAML para a configuração principal;
- decorators padrão do TypeScript;
- suporte a métodos síncronos e assíncronos;
- configuração centralizada em `src/configs/core.yml`.

O projeto também preserva a API original do Signale. O entrypoint TypeScript do EaL exporta:

```ts
import {EaL, EaLConfiguration} from './src';
```

## Arquitetura

A arquitetura atual é composta por quatro partes principais:

```
Aplicação
   │
   │ @EaL('behavior')
   ▼
EaL Decorator
   │
   ├── resolve comportamento
   ├── observa sucesso/erro
   └── renderiza mensagem
   │
   ▼
core.yml
   │
   ├── execution
   ├── logger
   ├── badge
   ├── color
   ├── label
   ├── logLevel
   └── message
   │
   ▼
Signale
   │
   ▼
Console / saída configurada
```

A aplicação conhece somente o contrato `@EaL`.

A implementação do decorator é responsável por resolver o comportamento e delegar a saída ao logger configurado.

## Decorator `@EaL`

Existem duas formas de utilização.

### Comportamento explícito

```ts
@EaL('success')
successful() {
  return 42;
}
```

Nesse caso, `success` é procurado em `core.yml`.

### Comportamento baseado no nome do método

```ts
@EaL
info() {
  return 'uses the method name as the canonical behavior';
}
```

Quando `@EaL` é usado sem argumento, o nome do método é usado como nome do comportamento.

Portanto:

```ts
@EaL
success() {}
```

é equivalente a resolver o comportamento `success`.

Se o comportamento não estiver configurado, o EaL lança um erro indicando que o comportamento não está configurado.

## Política de execução

Cada comportamento possui uma propriedade `execution`.

Os valores aceitos são:

| Valor | Comportamento |
|---|---|
| `always` | registra sucesso e erro |
| `success` | registra somente execuções bem-sucedidas |
| `error` | registra somente erros |
| `never` | não registra |

Exemplo:

```yaml
success:
  execution: success
  logger: success
  message: "{name} completed successfully"
```

Um método decorado com `@EaL('success')` será registrado quando terminar com sucesso.

Já:

```yaml
error:
  execution: error
  logger: error
  message: "{error.name}: {error.message}"
```

faz com que o comportamento seja registrado quando a execução produzir um erro.

## Erros não são engolidos

O EaL observa a exceção, mas não altera a semântica da aplicação.

Exemplo:

```ts
@EaL('error')
failing() {
  throw new Error('expected failure');
}
```

O decorator pode registrar o erro, mas a exceção original continua sendo lançada:

```ts
try {
  example.failing();
} catch (error) {
  // error original continua disponível aqui
}
```

O mesmo princípio vale para Promises rejeitadas.

Isso significa que o EaL não é um mecanismo de tratamento de erros. Ele é uma camada de observabilidade.

## Métodos assíncronos

Métodos que retornam Promise também são suportados:

```ts
@EaL('success')
async successfulAsync() {
  return 'async';
}
```

E erros assíncronos:

```ts
@EaL('error')
async failingAsync() {
  throw new Error('expected async failure');
}
```

O EaL aguarda a resolução ou rejeição da Promise para aplicar a política de execução configurada.

## Configuração principal

A configuração canônica fica em:

```
src/configs/core.yml
```

Ela possui duas áreas:

```yaml
config:
  # opções de apresentação do logger

behaviors:
  # comportamentos disponíveis para @EaL
```

### Configuração global

A seção `config` controla a apresentação do Signale:

```yaml
config:
  displayScope: true
  displayBadge: true
  displayDate: false
  displayFilename: false
  displayLabel: true
  displayTimestamp: false
  underlineLabel: true
  underlineMessage: false
  underlinePrefix: false
  underlineSuffix: false
  uppercaseLabel: false
```

Essas opções são repassadas para a instância do Signale criada pelo EaL.

### Configuração de comportamento

Cada entrada em `behaviors` possui uma estrutura semelhante a:

```yaml
success:
  execution: success
  logger: success
  badge: "✔"
  color: green
  label: success
  logLevel: info
  message: "{name} completed successfully"
```

Os campos representam:

| Campo | Função |
|---|---|
| `execution` | quando o comportamento deve ser emitido |
| `logger` | método do Signale usado para emitir o log |
| `badge` | símbolo exibido pelo Signale |
| `color` | cor utilizada pelo logger |
| `label` | label do comportamento |
| `logLevel` | nível semântico configurado |
| `message` | mensagem renderizada pelo EaL |

## Comportamentos disponíveis

A configuração atual contém comportamentos derivados da API do Signale, incluindo:

- `error`
- `fatal`
- `fav`
- `info`
- `star`
- `success`
- `wait`
- `warn`
- `complete`
- `pending`
- `note`
- `start`
- `pause`
- `debug`
- `await`
- `watch`
- `log`

Eles podem ser alterados, substituídos ou complementados diretamente no `core.yml`.

O importante é que o nome utilizado no decorator corresponda a uma entrada configurada:

```ts
@EaL('success')
```

corresponde a:

```yaml
behaviors:
  success:
    ...
```

## Templates de mensagem

As mensagens podem utilizar valores da execução.

O EaL atualmente resolve placeholders como:

```
{name}
{args}
{result}
{error}
{error.name}
{error.message}
```

Por exemplo:

```yaml
message: "{error.name}: {error.message}"
```

Em uma exceção:

```
Error: expected failure
```

a mensagem será renderizada a partir do erro recebido pelo decorator.

## Separação entre comportamento e infraestrutura

Um dos objetivos principais do projeto é impedir que a regra de negócio precise decidir detalhes de logging.

O código:

```ts
@EaL('success')
createCustomer(customer) {
  return repository.create(customer);
}
```

não precisa saber:

- qual logger será utilizado;
- qual método do logger será chamado;
- qual mensagem será exibida;
- qual badge será utilizado;
- qual cor será utilizada;
- se o comportamento será registrado em sucesso ou erro;
- como a saída será formatada.

Essas decisões pertencem à configuração.

Isso permite alterar a política de observabilidade sem reescrever a regra de negócio.

## Estrutura do projeto

A estrutura relevante é:

```
Everything-as-Log/
├── src/
│   ├── configs/
│   │   └── core.yml
│   ├── eal.ts
│   ├── index.ts
│   ├── signale.js
│   └── types.js
├── types/
│   └── signale.d.ts
├── test/
│   ├── config.ts
│   ├── custom.ts
│   ├── default.ts
│   ├── eal.ts
│   ├── override.ts
│   ├── scoped.ts
│   ├── secrets.ts
│   ├── streams.ts
│   ├── timers.ts
│   └── tsconfig.json
├── index.js
├── package.json
└── tsconfig.json
```

### `src/eal.ts`

Implementa o decorator `@EaL`, carregamento da configuração, resolução dos comportamentos, renderização dos templates e integração com o Signale.

### `src/configs/core.yml`

É a configuração canônica dos comportamentos do EaL.

### `src/signale.js`

É a implementação do logger Signale utilizada pelo projeto.

### `src/index.ts`

Expõe a API TypeScript:

```ts
export {EaL, EaLConfiguration} from './eal';
```

### `types/signale.d.ts`

Fornece os tipos TypeScript necessários para a implementação JavaScript do Signale.

### `test/`

Contém os exemplos/testes históricos da API original do Signale e o teste específico do decorator EaL.

## Exemplo completo

Um exemplo mínimo:

```ts
import {EaL} from './src';

class OrderService {
  @EaL('success')
  createOrder() {
    return {
      id: 123,
      status: 'created'
    };
  }

  @EaL('error')
  cancelOrder() {
    throw new Error('Order cannot be cancelled');
  }

  @EaL
  info() {
    return 'uses the method name as the behavior';
  }

  @EaL('success')
  async processOrder() {
    return 'processed';
  }
}

const service = new OrderService();

service.createOrder();
service.info();

try {
  service.cancelOrder();
} catch {
  // erro continua sendo propagado
}

void service.processOrder();
```

A aplicação permanece responsável pela regra de negócio. O EaL fica responsável pela observabilidade configurada.

## Build

Instale as dependências:

```bash
npm install
```

Compile o projeto:

```bash
npm run build
```

A configuração TypeScript atual utiliza:

```json
{
  "target": "ES2022",
  "module": "CommonJS",
  "strict": true,
  "declaration": true,
  "outDir": "dist"
}
```

## Validação

Para verificar os tipos:

```bash
npm run test:ts
```

Para executar lint e validação TypeScript:

```bash
npm test
```

O script `test` executa:

```bash
npm run lint && npm run test:ts
```

## Compatibilidade com Signale

O projeto nasceu a partir do Signale e mantém sua API de logging existente.

A configuração do EaL utiliza os métodos disponibilizados pelo logger. Isso permite aproveitar comportamentos como:

```ts
success()
debug()
pending()
fatal()
watch()
complete()
```

entre outros.

O EaL não substitui o logger original. Ele adiciona uma camada declarativa baseada em decorators e configuração.

## Contrato de configuração

A fronteira conceitual do projeto é:

```
Código
  ↓
@EaL
  ↓
Nome canônico do comportamento
  ↓
core.yml
  ↓
Política de execução
  ↓
Signale
```

O código não deve depender diretamente das decisões existentes dentro de `core.yml`.

Por exemplo, não é necessário escrever:

```ts
if (config.environment === 'production') {
  logger.success(...)
}
```

A decisão pertence à configuração.

## Por que usar decorators?

Decorators permitem associar observabilidade diretamente ao comportamento sem inserir chamadas de logging dentro do corpo da função.

Isso é particularmente útil quando a aplicação possui muitos comportamentos que precisam ser observados de forma consistente.

A regra:

```ts
@EaL('success')
createOrder() {}
```

é declarativa.

A implementação do método permanece focada em:

```
entrada → regra de negócio → saída
```

Enquanto o EaL observa:

```
comportamento → execução → sucesso/erro → log
```

## Design goals

Os objetivos atuais do projeto são:

1. reduzir o acoplamento entre aplicação e infraestrutura de logging;
2. tornar políticas de logging configuráveis;
3. permitir que comportamentos sejam declarados semanticamente;
4. manter compatibilidade com o Signale;
5. suportar funções síncronas e assíncronas;
6. preservar os erros originais da aplicação;
7. evitar que falhas do logger alterem a execução da regra de negócio;
8. permitir evolução da observabilidade sem espalhar chamadas de logger pelo código.

## Limites atuais

O EaL atualmente é uma camada de logging baseada em decorators. Ele não pretende ser, por si só:

- um sistema de tracing distribuído;
- um coletor de métricas;
- um APM;
- um sistema de armazenamento de logs;
- um mecanismo de tratamento de exceções;
- um substituto para OpenTelemetry.

A responsabilidade atual termina na observação da execução e emissão através do logger configurado.

## Licença

Este projeto utiliza a licença MIT.

Consulte o arquivo de licença do projeto para os termos completos.

## Origem

O projeto é baseado no conceito e na implementação do **Signale**, expandindo-o com uma camada TypeScript orientada a comportamentos e decorators.

O objetivo do Everything-as-Log é evoluir de chamadas imperativas de logging para uma abordagem na qual **o comportamento é declarado no código e a política de observabilidade é definida por configuração**.

---

**Everything-as-Log — comportamento no código, observabilidade na configuração.**
