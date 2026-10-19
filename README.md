# escrivao

> Quinze ferramentas de OSINT judicial brasileiro em um único arquivo Node.

O escrivao é um servidor MCP (Model Context Protocol) autocontido para pesquisa
em registros públicos judiciais brasileiros: DataJud/CNJ, DJEN, e-SAJ (TJSP),
BrasilAPI (CNPJ), validação e quebra de máscaras de números CNJ e busca web
semântica (Exa). Remete ao escrivão judicial, guardião dos autos.

**TL;DR**

- Zero dependências: Node.js 18+ nativo, sem `npm install`, sem `pip install`.
- Zero chaves obrigatórias: APIs públicas oficiais (Exa é opcional).
- Multi-agente: opencode, kimi-code, Claude Desktop, Cursor e qualquer cliente
  MCP stdio.

> **REGRA INEGOCIÁVEL:** nunca inserir nesta pasta dados de pessoas investigadas
> ou do mantenedor (nomes, documentos, números de processos, e-mails, contas).
> A pasta é publicada como código aberto. Agente que for alterar algo aqui deve
> ler o `AGENTS.md` primeiro.

## Para que serve o escrivao?

Ele dá a um agente de IA acesso direto às bases judiciais públicas do Brasil:
validar e desmascarar números de processo (Resolução CNJ 65/2008), consultar
capas de processos no DataJud, varrer uma consulta em vários tribunais de uma
vez, ler intimações com texto integral no DJEN, consultar o 1º grau do TJSP e
buscar CNPJ com quadro societário — tudo sem chave paga.

## Quais os pré-requisitos?

Windows, Linux ou macOS com Node.js 18 ou superior. Nada mais: não há build,
não há dependências e não há chaves obrigatórias. Verifique com `node --version`.

## Como instalo no meu cliente MCP?

Basta apontar o cliente para `node <caminho-absoluto>/escrivao-mcp/server.js`,
substituindo `<caminho>` pelo local real desta pasta. Depois reinicie o cliente
para o servidor subir. As receitas por cliente estão abaixo.

### opencode — `~/.config/opencode/opencode.jsonc`
```jsonc
"mcp": {
  "escrivao": {
    "type": "local",
    "command": ["node", "<caminho>/escrivao-mcp/server.js"],
    "enabled": true,
    "timeout": 120000
  }
}
```

### kimi-code — `~/.kimi-code/mcp.json`
```json
{ "mcpServers": { "escrivao": {
  "command": "node",
  "args": ["<caminho>/escrivao-mcp/server.js"],
  "startupTimeoutMs": 30000,
  "toolTimeoutMs": 300000
}}}
```
No Windows o caminho usa `\\` entre pastas. O `toolTimeoutMs` alto é necessário
porque o DataJud do TJSP às vezes responde devagar (504).

### Claude Desktop — `claude_desktop_config.json`
```json
"mcpServers": {
  "escrivao": { "command": "node", "args": ["<caminho>/escrivao-mcp/server.js"] }
}
```

### Cursor / qualquer cliente stdio
Comando: `node <caminho>/escrivao-mcp/server.js`

## Quais variáveis de ambiente existem?

Duas, ambas opcionais: `EXA_API_KEY` habilita a busca semântica web
(`exa_buscar`, chave gratuita em https://dashboard.exa.ai) e `DATAJUD_API_KEY`
força uma chave própria do DataJud — sem ela o servidor descobre a chave
pública sozinho (https://datajud-wiki.cnj.jus.br/api-publica/acesso/).
No Windows: `setx EXA_API_KEY "sua-chave"` (vale para todas as sessões; reinicie
o cliente).

## Como valido o servidor sem cliente?

Crie um arquivo com uma requisição JSON-RPC por linha e redirecione ao
servidor; cada resposta volta como uma linha JSON-RPC no stdout. Serve para
confirmar instalação, contagem de ferramentas e saúde da rede em segundos.

```jsonl
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"t","version":"0"}}}
{"jsonrpc":"2.0","id":2,"method":"tools/list"}
{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"cnj_validar","arguments":{"numero":"0001234-56.2024.8.26.0100"}}}
```

```powershell
cmd /c "node <caminho>\escrivao-mcp\server.js < teste.jsonl"
```

## Quais são as 15 ferramentas?

Uma paleta enxuta cobrindo o ciclo completo de uma pesquisa judicial: validar o
número, desmascarar o que está oculto, consultar por número, nome, documento ou
varredura multi-tribunal, ler intimações e complementar com CNPJ, web e
navegação por browser automatizado. A tabela abaixo resume cada ferramenta e
sua fonte.

| Ferramenta | O que faz | Fonte |
|---|---|---|
| `cnj_validar` | Valida número CNJ (Res. 65/2008, ISO 7064 MOD 97-10) e devolve o DV esperado + tribunal | — |
| `cnj_desmascarar` | Quebra máscaras `000XXXX-XX.AAAA.J.TR.OOOO`: candidatos com DV válido e, opcionalmente, verificação numa única query `terms` no DataJud (fingerprint: órgão+classe+assunto+datas) | DataJud |
| `datajud_processo` | Capa do processo por número CNJ (tribunal detectado automaticamente) | DataJud |
| `datajud_pesquisar` | Pesquisa estruturada: lista de números (terms), classe, assunto ou órgão julgador | DataJud |
| `datajud_buscar` | Busca textual livre (query_string): nome exato entre aspas duplas, CPF formatado entre aspas, número; 3 tentativas para tribunais lentos | DataJud |
| `datajud_por_cpf` | Por CPF/CNPJ da parte (campo `documentoReplicado`); sugere rota alternativa quando o tribunal mascara | DataJud |
| `datajud_varrer` | Varre UMA consulta em VÁRIOS tribunais numa única chamada (default 11 tribunais; erros por tribunal não abortam a varredura) | DataJud |
| `djen_intimacoes` | Intimações por nome da parte, com texto integral (sentenças completas citam números correlatos) | DJEN/CNJ |
| `esaj_buscar` | Consulta anônima do 1º grau do TJSP por nome/CPF/número via HTTP (anônimo suprime partes criminais); agora lista também os números de processo encontrados | e-SAJ TJSP |
| `esaj_tjsp_guia` | Receita do fluxo e-SAJ por número com seletores CSS (para Playwright) | e-SAJ TJSP |
| `brasilapi_cnpj` | CNPJ formatado: razão social, sócios (QSA), CNAE, situação, endereço | BrasilAPI |
| `exa_buscar` | Busca semântica web: notícias, menções, homônimos (requer EXA_API_KEY) | Exa |
| `fontes_osint` | Playbook interno: bases, atalhos, rotas por tribunal, técnicas e ética/LGPD | — |
| `guia_navegacao` | Guia de navegação: links das regras do mantenedor (master rules, pasta de regras, prompt 8.5), fluxo validado com o MCP Playwright (captchas manuais, armadilhas do e-SAJ) e módulos de Python para scripts locais | — |
| `guia_relatorios` | Técnicas de relatório/dossiê: HTML único autocontido (CSS/JS internos, sem PHP), padrão 8.5 adaptado, níveis de confirmação (CONFIRMADO/PROVÁVEL/POSSÍVEL HOMÔNIMO), pendências com próximo passo, cadeia de evidência, anti-homônimos e checklist de entrega | — |

## Que atalhos de consulta pública existem?

Portais de consulta pública de todos os tribunais do país, listados abaixo.
Todo atalho leva a fonte oficial; nenhum exige mais que o navegador — e alguns
pedem login ou captcha, o que está sinalizado no `GUIA_OSINT.md`.

### Atalhos nacionais
| Atalho | Link |
|---|---|
| PJe — consulta por estado/tribunal | https://www.pje.jus.br/navegador/ |
| PJe CNJ — consulta pública | https://sustentacao.cloud.cnj.jus.br/pjecnj/ConsultaPublica |
| CNJ — lista de tribunais | https://www.cnj.jus.br/poder-judiciario/tribunais/ |
| Justiça Federal — fóruns | https://www.jfsp.jus.br/foruns-federais/ |
| Olho Jurídico — consulta processual | https://olhojuridico.com/consulta-processual |
| TRF3 (exemplo de portal regional) | https://www.trf3.jus.br/ |
| DataJud — API pública (docs/chave) | https://datajud-wiki.cnj.jus.br/api-publica/acesso/ |
| DJEN — comunicações/intimações | https://comunicaapi.pje.jus.br/api/v1/comunicacao |
| BrasilAPI — CNPJ gratuito | https://brasilapi.com.br |
| e-SAJ TJSP — consulta pública | https://esaj.tjsp.jus.br/cpopg |
| Escavador — agregador (paywall) | https://www.escavador.com |
| Jusbrasil — agregador (paywall) | https://www.jusbrasil.com.br |

### Portais oficiais dos tribunais (TJ)
| Estado | Portal |
|---|---|
| Acre | https://www.tjac.jus.br/ |
| Alagoas | https://www.tjal.jus.br/ |
| Amapá | https://www.tjap.jus.br/ |
| Amazonas | https://www.tjam.jus.br/ |
| Bahia | https://www.tjba.jus.br/ |
| Ceará | https://www.tjce.jus.br/ |
| Distrito Federal | https://www.tjdft.jus.br/ |
| Espírito Santo | https://www.tjes.jus.br/ |
| Goiás | https://www.tjgo.jus.br/ |
| Maranhão | https://www.tjma.jus.br/ |
| Mato Grosso | https://www.tjmt.jus.br/ |
| Mato Grosso do Sul | https://www.tjms.jus.br/ |
| Minas Gerais | https://www.tjmg.jus.br/ |
| Pará | https://www.tjpa.jus.br/ |
| Paraíba | https://www.tjpb.jus.br/ |
| Paraná | https://www.tjpr.jus.br/ |
| Pernambuco | https://www.tjpe.jus.br/ |
| Piauí | https://www.tjpi.jus.br/ |
| Rio de Janeiro | https://www.tjrj.jus.br/ |
| Rio Grande do Norte | https://www.tjrn.jus.br/ |
| Rio Grande do Sul | https://www.tjrs.jus.br/ |
| Rondônia | https://www.tjro.jus.br/ |
| Roraima | https://www.tjrr.jus.br/ |
| Santa Catarina | https://www.tjsc.jus.br/ |
| São Paulo | https://www.tjsp.jus.br/ |
| Sergipe | https://www.tjse.jus.br/ |
| Tocantins | https://www.tjto.jus.br/ |

### Justiça Federal (TRF)
| Região | Portal |
|---|---|
| TRF1 — AC, AM, AP, BA, DF, GO, MA, MT, PA, PI, RO, RR, TO | https://www.trf1.jus.br/ |
| TRF2 — ES, RJ | https://www.trf2.jus.br/ |
| TRF3 — MS, SP | https://www.trf3.jus.br/ |
| TRF4 — PR, RS, SC | https://www.trf4.jus.br/ |
| TRF5 — AL, CE, PB, PE, RN, SE | https://www.trf5.jus.br/ |
| TRF6 — MG | https://www.trf6.jus.br/ |

### Justiça do Trabalho (TRT)
| Região | Portal | Região | Portal |
|---|---|---|---|
| TRT1 (RJ) | https://www.trt1.jus.br/ | TRT13 (PB) | https://www.trt13.jus.br/ |
| TRT2 (SP capital) | https://www.trt2.jus.br/ | TRT14 (AC, RO) | https://www.trt14.jus.br/ |
| TRT3 (MG) | https://www.trt3.jus.br/ | TRT15 (SP interior) | https://www.trt15.jus.br/ |
| TRT4 (RS) | https://www.trt4.jus.br/ | TRT16 (MA) | https://www.trt16.jus.br/ |
| TRT5 (BA) | https://www.trt5.jus.br/ | TRT17 (ES) | https://www.trt17.jus.br/ |
| TRT6 (PE) | https://www.trt6.jus.br/ | TRT18 (GO) | https://www.trt18.jus.br/ |
| TRT7 (CE) | https://www.trt7.jus.br/ | TRT19 (AL) | https://www.trt19.jus.br/ |
| TRT8 (AP, PA) | https://www.trt8.jus.br/ | TRT20 (SE) | https://www.trt20.jus.br/ |
| TRT9 (PR) | https://www.trt9.jus.br/ | TRT21 (RN) | https://www.trt21.jus.br/ |
| TRT10 (DF, TO) | https://www.trt10.jus.br/ | TRT22 (PI) | https://www.trt22.jus.br/ |
| TRT11 (AM, RR) | https://www.trt11.jus.br/ | TRT23 (MT) | https://www.trt23.jus.br/ |
| TRT12 (SC) | https://www.trt12.jus.br/ | TRT24 (MS) | https://www.trt24.jus.br/ |

### Justiça Eleitoral (TSE/TRE)
Nacional: https://www.tse.jus.br/ — por estado:
https://www.tre-ac.jus.br/, https://www.tre-al.jus.br/, https://www.tre-ap.jus.br/,
https://www.tre-am.jus.br/, https://www.tre-ba.jus.br/, https://www.tre-ce.jus.br/,
https://www.tre-df.jus.br/, https://www.tre-es.jus.br/, https://www.tre-go.jus.br/,
https://www.tre-ma.jus.br/, https://www.tre-mt.jus.br/, https://www.tre-ms.jus.br/,
https://www.tre-mg.jus.br/, https://www.tre-pa.jus.br/, https://www.tre-pb.jus.br/,
https://www.tre-pr.jus.br/, https://www.tre-pe.jus.br/, https://www.tre-pi.jus.br/,
https://www.tre-rj.jus.br/, https://www.tre-rn.jus.br/, https://www.tre-rs.jus.br/,
https://www.tre-ro.jus.br/, https://www.tre-rr.jus.br/, https://www.tre-sc.jus.br/,
https://www.tre-sp.jus.br/, https://www.tre-se.jus.br/, https://www.tre-to.jus.br/

### Tribunais superiores e militares
| Tribunal | Portal |
|---|---|
| STF | https://portal.stf.jus.br/ |
| STJ | https://www.stj.jus.br/ |
| TST | https://www.tst.jus.br/ |
| STM | https://www.stm.jus.br/ |
| TJMMG | https://www.tjmmg.jus.br/ |
| TJMRS | https://www.tjmrs.jus.br/ |
| TJMSP | https://www.tjmsp.jus.br/ |

### Repositórios de referência (código aberto)
Ferramentas de código aberto úteis como referência de técnicas de consulta e
validação de documentos:

- https://github.com/jansenfelipe/cpf-gratis
- https://github.com/p0isonBR/ConsultaCPF
- https://github.com/fernandobortotti/CPF-Tools
- https://github.com/geekcom/validator-docs
- https://github.com/ACBrNet/ACBr.Net.Consulta
- https://github.com/paemuri/brdoc
- https://github.com/opastorello/cpf-validador
- https://github.com/klawdyo/validation-br
- https://github.com/mariohmol/js-brasil
- https://github.com/juniormachado5/Automacao_pje
- https://github.com/TechThings/consultasbr
- https://github.com/Ghalbavieira/busca-processos
- https://github.com/viniciusbon/viniciusbon-consultas_de_processos_judiciais_CPF_CNPJ_NOME_PROCESSOS_DataJud
- https://github.com/olavomello/jusbr
- https://github.com/Juliano2105/radar-processos
- https://github.com/claujs/buscaprocessos-api

### Busca semântica (links validados)
- https://github.com/topics/semantic-search — topic geral (filtros: `?l=html&o=desc&s=updated`, `?l=java`)
- https://github.com/topics/semantic-search-algorithm
- https://github.com/topics/pdf-semantic-search
- https://github.com/smkbarbosa/context-ia-manager
- https://github.com/edilsonmaia/searchme
- https://github.com/DaniloCorreia1/semantic_search
- https://github.com/jonas-elias/jurisprudencia-sc-busca-semantica — jurisprudência TJSC
- https://docs.crewai.com/v1.15.28/pt-BR/tools/search-research/githubsearchtool — CrewAI GithubSearchTool
- https://manticoresearch.com/blog/github-semantic-search/
- https://help.vtex.com/pt/docs/tutorials/intelligent-search-busca-semantica-beta

## Como uso na prática?

Peça em linguagem natural ao seu agente, citando a ferramenta desejada. Os
exemplos abaixo usam dados fictícios — nenhum número corresponde a um caso
real, e é assim que deve permanecer.

- "Valide o número 0001234-56.2024.8.26.0100 com cnj_validar"
- "Desmascare 000XXXX-XX.2024.8.26.0100 e verifique no DataJud"
- "Busque no DataJud do TJSP o número 0001111-22.2024.8.26.0100"
- "Consulte no DataJud do TJPR o documento 111.444.777-35"
- "Procure no e-SAJ por Zuliano da Silva Sauro (NMPARTE)"
- "Consulte o CNPJ 00.000.000/0001-91" (número de documentação)
- "Busque na web com a Exa: notícias sobre concursos públicos em 2024"

## Como monto o ambiente completo de pesquisa?

O escrivão cobre DataJud, DJEN, e-SAJ, CNPJ e quebra de máscara CNJ — e não
deve ser duplicado. Para navegar em portais com captcha, ler PDFs longos e
buscar na web, os MCPs companheiros abaixo entram como complementos; cada
comando se autoinstala na primeira execução.

| MCP | Instalação | Papel |
|---|---|---|
| Playwright (Microsoft) | `npx -y @playwright/mcp` | Browser automatizado para portais com captcha/JS: e-SAJ por nome, TSE, Receita, eproc TJSC (Turnstile) — captcha resolvido manualmente por você na tela |
| DuckDuckGo | `uvx duckduckgo-mcp-server` | Busca web sem chave (exige `uv`; no Windows, `scoop install uv`) |
| anymd | `npx -y @sylphx/anymd` | PDFs e documentos como Markdown, local e sem chave |
| Tavily | remoto: `https://mcp.tavily.com/mcp/?tavilyApiKey={env:TAVILY_API_KEY}` | Busca profunda; 1000 créditos/mês grátis (chave em https://app.tavily.com) |
| Firecrawl | `npx -y firecrawl-mcp-server` + `FIRECRAWL_API_KEY` | Scraping profundo; 500 crawls grátis (chave em https://firecrawl.dev) |
| Exa | já embutido aqui (`exa_buscar`) ou `npx -y exa-mcp-server` | Busca neural (chave gratuita em https://exa.ai) |
| Perplexity | remoto: `https://mcp.perplexity.ai/mcp` (uma vez: `opencode mcp auth perplexity`) | Consulta com citação de fontes |

## Qual o fluxo típico de uma investigação?

O ciclo validado na prática tem sete passos, cada um com a ferramenta daqui.
Homônimos ficam sempre separados dos achados do pesquisado, e nenhuma linha é
marcada como confirmada sem data exata batendo em duas bases.

1. `cnj_validar` — valida o DV e o tribunal antes de qualquer consulta.
2. `cnj_desmascarar` — máscara `000XXXX-XX...` gera candidatos com DV válido, verificados numa única query no DataJud (fingerprint).
3. `datajud_processo` / `datajud_pesquisar` — capa e metadados por número, classe, assunto ou órgão.
4. `datajud_buscar` (nome exato entre aspas) e `datajud_varrer` (uma consulta em vários tribunais) — achados por nome ou documento.
5. `djen_intimacoes` — intimações com texto integral revelam fatos e processos correlatos.
6. `brasilapi_cnpj` e `exa_buscar` — contexto societário e de web para ancorar anti-homônimos.
7. Relatório no padrão obrigatório do prompt 8.5 (seção abaixo), com nível de confirmação por linha.

## Qual o padrão obrigatório de relatório?

OBRIGATÓRIO: todo relatório ou dossiê gerado com dados deste servidor segue o
prompt 8.5, espelhado em `regras/prompt_8_5.md` (original em
https://docs.google.com/document/d/1hRoAQEZnKufWdUnzwTxuuwjbAA05sAfTf2oY1MnIky4/edit).
O formato padrão é UM único arquivo HTML autocontido — apenas HTML, CSS e JS
internos, sem PHP, sem arquivos separados, sem CDN — que abre offline; outro
formato (PDF, DOCX etc.) só quando você pedir explicitamente.

- Cabeçalho com nome do pesquisado, data de geração e TL;DR de 3 bullets (registros, confirmações, pendências).
- Seções com título em forma de pergunta e resposta curta (40-60 palavras) antes do detalhe; FAQ ao final; zero emojis; PT-BR objetivo.
- Tabela de processos: número CNJ | tribunal/foro | classe | assunto | órgão julgador | ajuizamento | status | fonte | nível de confirmação — com filtro por status e busca textual via JS interno.
- Níveis de confirmação: CONFIRMADO (fonte chaveada, datas exatas em 2+ bases), PROVÁVEL (fingerprint coerente), POSSÍVEL HOMÔNIMO (sem âncora — sempre em seção separada).
- Cadeia de evidência: número mascarado ao lado do desmascarado; toda afirmação cita fonte e data-hora; HTML/PDF brutos salvos.
- Pendências obrigatórias com o próximo passo concreto de cada item.
- A ferramenta `guia_relatorios` devolve este padrão completo em tempo de execução.

## O que há na pasta regras/?

Espelho autorizado das regras do mantenedor (Google Drive, pasta
`regras_llms`): `master_rules.md` (protocolo central), `prompt_8_5.md` (padrão
de relatório e conteúdo), `prompt_de_llms/` (regras para LLMs), `prompts_php/`
(regras PHP/CSS/JS), `templates_php/` (templates e componentes universais) e
os logs e configurações de solução. Original sempre em:
https://drive.google.com/drive/folders/1U5U9QNx__hVio5GTKSVflZP9-b_E0OLm

## Quais as limitações conhecidas?

Toda fonte pública tem lacunas, e conhecê-las evita conclusões erradas: a API
pública do DataJud omite as partes de muitos processos, o TJSP às vezes
responde devagar, a consulta anônima do e-SAJ suprime partes criminais e
vários tribunais mascaram o CPF da parte. Os detalhes estão na lista abaixo.

- A API pública do DataJud **omite as partes** de muitos processos: classifique
  por fingerprint (órgão + classe + assunto + datas) ou use `datajud_buscar`
  com o nome/CPF entre aspas.
- O TJSP responde devagar às vezes (504) — as ferramentas tentam 3x com espera.
- A consulta anônima do e-SAJ **suprime partes de processos criminais** (sigilo
  legal); ver `esaj_tjsp_guia` para o fluxo por número via formulário.
- `datajud_por_cpf` depende do campo `documentoReplicado`, mascarado em vários
  tribunais — a própria resposta sugere a rota alternativa.
- BrasilAPI bloqueia o User-Agent padrão do Node; o servidor já envia header
  de navegador.
- Escavador, CEIS/CNEP, TSE e Receita exigem login/captcha/chave — não
  implementados aqui; ver `GUIA_OSINT.md` para as rotas manuais.

## E a ética e a LGPD?

Uso apenas com fontes públicas, minimização de dados, proteção de vítimas de
violência doméstica (Lei 11.340/2006), nunca identificar menores (ECA),
presunção de inocência para recursos pendentes (CF art. 5º, LVII). Resultados
para uso interno; divulgação exige avaliação jurídica própria. Nada de
assédio, exposição ou contorno de paywall.

## Quem desenvolve e como apoiar?

Desenvolvido por qrodrigob@gmail.com. Apoie o projeto via PIX:
qrodrigob@gmail.com. Site e canal oficial: https://canalqb.com.br

## FAQ

**O servidor precisa de internet?**
Sim. Todas as ferramentas, exceto `cnj_validar` e `fontes_osint`, consultam
APIs públicas na web. Sem rede, só validação local e playbook funcionam.

**Funciona sem nenhuma chave de API?**
Sim. A chave pública do DataJud é descoberta automaticamente; DJEN, e-SAJ e
BrasilAPI são abertos. Apenas a Exa exige chave — e ela é opcional.

**Posso adicionar novas ferramentas?**
Pode e deve — leia o `AGENTS.md` da pasta primeiro. As regras: Node puro sem
dependências, registro no array `TOOLS`, bump de versão, testes via stdin com
dados sintéticos fora da pasta e zero dados reais em qualquer arquivo.

**Por que o número do exemplo não existe?**
Porque a regra número um desta pasta é não conter dados de pessoas reais.
Todos os exemplos usam números de documentação (como 0001234-56.2024.8.26.0100
e o CNPJ 00.000.000/0001-91) ou nomes claramente fictícios.

**O que fazer quando o tribunal mascara o CPF?**
Use `datajud_buscar` com o CPF formatado entre aspas duplas (query_string) ou
`datajud_varrer` para varrer vários tribunais de uma vez; o `GUIA_OSINT.md`
detalha as rotas alternativas por tribunal.
