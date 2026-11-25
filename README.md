# agent

Thinkiac autonomous agent, chat runtime and integrated CLI agents.

Repositório: https://github.com/ThinkIac/agent.

## Uso no ThinkIac

Este pacote foi extraído de `packages/agent`. Preserve a identidade `agent` do manifest ao instalá-lo em um workspace Lógos. Views, rotas, ferramentas e hooks são descobertos pelo runtime e dependem dos provedores correspondentes. Esta extração publica o código atual; não converte JavaScript para LógosType nem implementa instalação por perfil.

Entrada declarada: `index.js`.

## Dependências e validação

Dependências declaradas: `better-sqlite3`, `dockerode`, `inflect`, `katex`, `logos`, `mermaid`, `node-telegram-bot-api`, `panzoom`.

O pacote não declara scripts npm de build/teste. Os testes existentes acompanham o fonte; a composição completa requer o host ThinkIac.

## Segurança e dados locais

Credenciais devem ser configuradas no ambiente de destino. Não acompanham esta extração bancos, sessões, uploads, perfis pessoais, arquivos `.env`, caches ou backups. As exclusões foram registradas em relatório externo à publicação. Configure segredos pelo host, sem incluí-los em commits.

## Documentação anterior

# Agent

O pacote `agent` executa o ciclo de conversa: prepara contexto, recebe o
catálogo de tools, chama o modelo e aplica a política antes de cada execução.
A classificação reduz o catálogo, mas não substitui a decisão do modelo nem as
verificações de permissão.

## Tools no ciclo do Agent

1. O Lógos descobre tools declaradas com `@register_tool`.
2. O pacote `classification` seleciona candidatas e aplica `@reach`.
3. O Agent combina candidatas, tools exigidas e tools `always`.
4. A política de execução valida cada chamada no catálogo permitido no turno.

`auto` é classificável, `always` permanece visível em todos os turnos e
`manual` não entra no catálogo automático. Esses valores controlam descoberta,
não autorização. Consulte [Engineer: tools](../engineer/docs/tools.md) e
[Classification](../classification/README.md).

## Execução paralela

`run_parallel` é uma capacidade arquitetural com `reach: always`. Agrupa duas
ou mais chamadas independentes em `tools: [{ name, input }]`. Use para leituras
e consultas que não dependem entre si. Não a aninhe e não a use para sequência
que precisa do resultado anterior.

Cada resultado é independente, inclusive em falhas parciais. O Agent valida as
chamadas internas com a mesma lista de tools permitidas no turno: a tool não
aumenta privilégios nem ignora governança.

## Referências

- [Prompt de capacidades do Runtime](prompts/capabilities/runtime.inflect)
- [Tools internas](core/builtin_tools.js)
- [Política de execução](core/execution_policy.js)
- [Contrato de decorators](../../docs/decorators.md#tools)

## Registros encontrados no código

- `command`: `claude`, `claude:agents`, `codex`, `opencode`, `tools:call`, `tools:list`.
- `hook`: `${hook.event}
`, `agent:message`, `agent:response-published`, `agent:token:usage`, `agent:tool-start`, `boot`, `boot
`, `chat`, `clear-scheduled-reset`, `clearSession`, `device:response`, `getConfig`, `governance:approved`, `inference:capabilities`, `inference:run`, `is-scheduled-reset`, `llm:call`, `llm:embed`, `llm:route-remote`, `llm:stt`, `logos:reindex)`, `package:reload_failed`, `package:rolled_back`, `presence:cancel`, `presence:initiative`, `reload:stable`, `schedule-reset`, `tenant:onboarding-received`.
- `router`: `${route.path}
`, `activities`, `antigravity-accounts`, `antigravity-accounts/:name`, `antigravity-accounts/pool`, `antigravity-sessions`, `antigravity-sessions/launch`, `antigravity-sessions/open`, `antigravity-sessions/pending`, `antigravity-usage`, `attachment`, `attachment/validate`, `chat`, `chat/cancel`, `chat/send`, `chat/stream`, `chat/stream/reconnect`, `chat/thinking-titles`, `claude-accounts`, `claude-accounts/:name`, `claude-accounts/pool`, `claude-quota`, `claude-sessions`, `claude-sessions/active`, `claude-sessions/launch`, `claude-sessions/open`, `claude-sessions/pending`, `codex-accounts`, `codex-accounts/:name`, `codex-accounts/:name/status`, `codex-accounts/execution-mode`, `codex-accounts/pool`, `codex-sessions`, `codex-sessions/launch`, `codex-sessions/open`, `codex-sessions/pending`, `codex-usage`, `codex-usage/:name/reset`, `config/save`, `d2/render`, `de`, `engineer/ask`, `file-preview`, `gemini-accounts`, `gemini-accounts/:name`, `gemini-accounts/pool`, `gemini-sessions/launch`, `gemini-sessions/pending`, `gemini-usage`, `health`, `mcp/providers`, `mcp/providers/:name`, `mcp/providers/:name/refresh`, `models`, `models/resolve`, `opencode-accounts`, `opencode-accounts/:name`, `opencode-accounts/pool`, `permission/ask`, `permission/resolve`, `provider`, `provider/models`, `reset`, `session`, `session/ask`, `session/clear`, `session/model`, `session/say`, `session/tools`, `session/workspace`, `sessions/:sessionId`, `sessions/:sessionId/clear`, `sessions/:sessionId/feedback`, `sessions/:sessionId/history`, `sessions/:sessionId/status`, `sessions/list`, `sessions/search`, `sessions/title-config`, `system/action`, `system/view`, `tools`, `transcribe`, `ui/stream`, `upload`, `workspaces/browse`.
- `tool`: `${name}
`, `${tool.name}
`, `call_llm`, `call_llm_agent`, `getDeliveryStatus`, `get_delivery_evidence`, `listModels`, `list_models`, `selectModel`, `tool_chat`.

A lista é um inventário estático e pode incluir registros em testes; não garante disponibilidade sem os provedores do host.

Há imports relativos para diretórios superiores. A instalação isolada e a composição por perfil precisam resolver esses vínculos antes de remover a cópia da base.

