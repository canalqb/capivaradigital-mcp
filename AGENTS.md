# AGENTS.md — Regras para agentes trabalhando nesta pasta

Esta pasta (`escrivao-mcp/`) é o **SERVIDOR MCP ÚNICO E UNIFICADO** de OSINT
judicial. O nome do servidor (identidade vista pelos agentes) é **`escrivao`**. Qualquer agente (opencode, kimi-code, Claude, Cursor ou outro) que
for usar, alterar ou estender este sistema DEVE seguir estas regras.

## 1. Unificação — não bifurcar
- `server.js` é o único servidor. **Nunca crie pastas ou servidores paralelos**
  com as mesmas funções (nada de "mcp_dossie 2", servidores Python duplicados
  etc.). Toda nova ferramenta entra AQUI.
- Se você encontrar outro servidor MCP judicial em outro lugar, migre o que
  houver de único para cá (sanitizado) e aponte os registros dos clientes para
  esta pasta.
- Os clientes registrados que usam este servidor:
  - opencode: `mcp.escrivao` em `~/.config/opencode/opencode.jsonc`
  - kimi-code: `mcpServers.escrivao` em `~/.kimi-code/mcp.json`
  - Ao mover/renomear a pasta, atualize TODOS os registros.
  - Atualização oficial do servidor: ferramenta `mcp_atualizar` (baixa o
    server.js direto do GitHub raw; funciona em qualquer instalação, COM ou
    SEM git — não dependa de `git pull`). Em clone com git, `git pull`
    também vale.

## 2. Zero dados reais (INEGOCIÁVEL — esta pasta vai para GitHub)
- **Nunca** insira nomes, CPF, CNPJ, números de processos, máscaras que
  identifiquem casos reais, e-mails, contas ou dados do mantenedor em
  QUALQUER arquivo desta pasta (código, docs, exemplos, comentários).
- Exemplos: sempre fictícios (`000XXXX-XX.2024.8.26.0100`, "ZZZINEXISTENTEZZZ",
  CNPJs de documentação como o 00.000.000/0001-91).
- Testes: apenas com dados sintéticos ou números de documentação; arquivos de
  teste ficam FORA da pasta (ex.: temp do sistema), nunca commitados.
- Erros a evitar: máscaras "didáticas" com fórum/DD/ano de um caso real também
  identificam — use `000XXXX-XX.AAAA.8.TR.OOOO` com segmento genérico.
- **Exceção expressa do mantenedor (2026-10-19, refinada em 23/10/2026):** o
  bloco oficial de contato/apoio no README (e-mail e PIX do desenvolvedor +
  https://canalqb.com.br) e o núcleo de regras em `regras/` são permitidos —
  APENAS `master_rules.md`, `prompt_8_5.md`, `links.txt` e
  `links-consulta-proprio-cpf.txt` (usados pelo servidor). O espelho do Drive
  com regras de PHP/Blogger/CMS foi removido por decisão do mantenedor
  (refinamento de 23/10/2026). A proibição acima segue valendo para todos os
  DEMAIS dados (investigados, casos reais, credenciais).

## 3. Zero dependências
- `server.js` roda com Node 18+ puro: **não adicionar** libs npm, pip, nem
  qualquer `package.json`/`node_modules`. HTTP via `fetch` nativo.
- Mantém o servidor leve, portátil e auditável — é o motivo de ele funcionar
  em qualquer agente sem instalação.

## 4. Como estender
1. Escreva a função `async function toolX(args) { ... }` (ASCII no código-fonte;
   acentos só em strings de saída, se inevitável).
2. Registre no array `TOOLS` (name, description, inputSchema, `_run`).
3. Ferramentas de rede: use `fetchWithTimeout`; para DataJud use
   `datajudSearch` (já tem retry); trate erros lançando `Error` (o dispatcher
   converte em resposta isError).
4. Bump da versão em `serverInfo.version`.
5. Atualize `README.md` (tabela de ferramentas, limitações se houver) e
   `GUIA_OSINT.md` se criar técnica nova.

## 5. Testes obrigatórios antes de concluir qualquer mudança
1. `node --check server.js` — sintaxe.
2. Suíte via stdin (arquivo de teste FORA da pasta):
   `cmd /c "node <pasta>/server.js < teste.jsonl"` — deve responder:
   initialize, tools/list (conferir contagem de ferramentas) e chamadas de
   exemplo com dados sintéticos.
3. Verificar zero-dados: grep da pasta por nomes/documentos/números reais do
   contexto de trabalho deve retornar vazio.

## 6. Correções já aprendidas (não regredir)
- DV CNJ oficial: `98 − ((stem × 100) mod 97)` com stem de 18 dígitos
  (NNNNNNN + AAAA + J + TR + OOOO, sem o DD). O DD fica após os 7 primeiros
  dígitos no número formatado.
- Saída do processo: só encerrar depois que as respostas pendentes foram
  escritas (contador `pending` + timer unref — ver fim do arquivo).
- BrasilAPI exige header `User-Agent` de navegador.
- Aliases de tribunal: regex em `resolveEndpoint` + códigos CNJ no mapa
  `TRIBUNAIS`.
