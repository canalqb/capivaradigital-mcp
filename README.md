# escrivao

> Dezenove ferramentas de OSINT judicial brasileiro em um único arquivo Node.

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

## E se eu não tiver o Node instalado?

No Windows 10/11 o caminho mais rápido é o winget, gerenciador oficial da
Microsoft já presente no sistema atualizado; depois reabra o terminal. Sem
winget, baixe o MSI oficial — ou use chocolatey/scoop. Linux e macOS usam o
gerenciador da própria plataforma.

```powershell
# Windows 10/11 (winget) — recomendado
winget install --id OpenJS.NodeJS.LTS -e --accept-source-agreements --accept-package-agreements

# Alternativas no Windows
choco install nodejs-lts -y        # chocolatey
scoop install nodejs-lts           # scoop
# Sem gerenciador? MSI oficial: https://nodejs.org/en/download
```

```bash
# Debian/Ubuntu (use NodeSource se o repositório for antigo: https://github.com/nodesource/distributions)
sudo apt install -y nodejs
# Fedora/RHEL
sudo dnf install -y nodejs
# macOS
brew install node
```

Reinicie o terminal (o PATH só reconhece o `node` em sessões novas) e confirme
com `node --version` — precisa ser 18 ou superior.

## E se eu não tiver o escrivão na máquina?

Como o servidor é um único arquivo sem dependências, basta baixá-lo — git
NÃO é obrigatório. O clone completo é recomendado porque traz também a pasta
regras/; o download direto pega só o server.js. Guarde numa pasta fixa — o
caminho entra no registro do cliente — e rode o teste via stdin antes de
registrar.

```powershell
git clone https://github.com/canalqb/escrivao-mcp.git        # recomendado

# Sem git — apenas o servidor:
curl.exe -L -o server.js https://raw.githubusercontent.com/canalqb/escrivao-mcp/main/server.js
```

A ferramenta `guia_instalacao` devolve estes comandos prontos em tempo de
execução, para o agente guiar a instalação em qualquer máquina.

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

## Quais são as 19 ferramentas?

Uma paleta enxuta cobrindo o ciclo completo de uma pesquisa judicial: validar o
número, desmascarar o que está oculto, consultar por número, nome, documento ou
varredura multi-tribunal, ler intimações e complementar com CNPJ, web, navegação
por browser automatizado e instalação do zero. A tabela abaixo resume cada
ferramenta e sua fonte.

| Ferramenta | O que faz | Fonte |
|---|---|---|
| `cnj_validar` | Valida número CNJ (Res. 65/2008, ISO 7064 MOD 97-10) e devolve o DV esperado + tribunal | — |
| `cnj_desmascarar` | Quebra máscaras `000XXXX-XX.AAAA.J.TR.OOOO`: candidatos com DV válido, verificação numa única query `terms` no DataJud e LOOP — com `cpf`/`nome` cruza os candidatos com o pesquisado e marca VÍNCULO CONFIRMADO ou SEM âncora | DataJud |
| `cpf_desmascarar` | Quebra CPF mascarado (até 3 dígitos ocultos, ex. `***.123.456-**` ou o bloco de 6 antes do DV): loop 000-999 + DV módulo 11 + verificação em lote no DataJud; devolve CPFs com processos e nomes para o **usuário validar** — depois o dossiê pesquisa tudo pelo CPF, nunca pelo nome | DataJud |
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
| `guia_instalacao` | Comandos prontos para instalar do zero: Node.js via winget (Windows 10/11), alternativas (choco/scoop/MSI, apt/dnf/brew), obtenção do servidor (git clone ou download do `server.js`), teste via stdin e registro nos clientes | — |
| `jusbrasil_buscar` | Busca no Jusbrasil: HTTP quando passa; quando o Cloudflare bloqueia (403), devolve a rota pronta via browser (MCP Playwright) com a URL montada; números mascarados alimentam o loop do `cnj_desmascarar` | Jusbrasil |
| `mcp_atualizar` | Autoatualização: baixa o `server.js` mais recente do GitHub, guarda backup (.bak) e substitui o arquivo; a nova versão sobe ao reiniciar o cliente | GitHub |

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
- "Desmascare 000XXXX-XX.2024.8.26.0100 cruzando com o CPF 111.444.777-35 (loop)"
- "Desmascare o CPF ***.123.456-** no TJPR e liste os nomes (cpf_desmascarar)"
- "Busque no Jusbrasil: Zuliano da Silva Sauro"
- "Atualize o servidor com mcp_atualizar"

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

## Quais MCPs enriquecem a pesquisa por CPF/CNPJ?

Servidores MCP externos, úteis para aprofundar uma investigação a partir do
documento do pesquisado — imóveis, sanções, certidões e situação cadastral.
São projetos e serviços de terceiros: verifique custos (créditos pré-pagos),
LGPD e política de uso antes de consultar.

| MCP/Serviço | O que traz | Acesso |
|---|---|---|
| MCP Brasil | 70 APIs públicas: BrasilAPI/CNPJ, DataJud, TSE bens de candidatos, sanções do Portal da Transparência, TCU, imóveis da União | https://github.com/Mcp-Brasil/mcp-brasil (`uvx --from mcp-brasil python -m mcp_brasil.server`) |
| ONR / RI Digital (OFICIAL) | Pesquisa Nacional de Bens por CPF/CNPJ, Pesquisa Qualificada, Consulta de Indisponibilidade de Bens — matrículas de todo o Brasil | https://ridigital.org.br (créditos pré-pagos) |
| ONR — Mapa do Registro de Imóveis | Conector MCP de terceiros para o mapa do RI | https://api.mcp.ai/p_onr_mapa_registro_imoveis (créditos pré-pagos) |
| mcp.ai Consultas | Situação cadastral CPF/CNPJ, Simples/MEI, SINTEGRA, certidões (CND Federal, CNDT, FGTS), TCU, sanções OFAC/ONU/ICIJ | https://mcp.ai/consultas (créditos pré-pagos) |
| mcp-fiscal-brasil | CNPJ, CPF, Simples Nacional, NF-e, certidões, due diligence | https://github.com/DeHor-Labs/mcp-fiscal-brasil |
| mcp-dadosbr | OSINT: CNPJ, CEP, processos, contratos governamentais | https://github.com/cristianoaredes/mcp-dadosbr |
| apipj | Dados cadastrais de CNPJ | https://apipj.com.br/mcp |
| CPFHub | CPF: nome, situação cadastral na Receita Federal | https://www.cpfhub.io |
| lakebrasil-mcp | 153 ferramentas: Transparência, TCU, DataJud, dados abertos | https://glama.ai/mcp/servers/r4szqk0atg |
| brasil-data-mcp | BrasilAPI sem chave: CNPJ, CEP, corretoras CVM, IBGE | https://github.com/alanpcf/brasil-data-mcp |
| OpenCNPJ / OpenCEP | Empresas (CNPJ) e endereços (CEP) | https://lobehub.com/mcp?q=brazil |
| Catálogos (Glama, Smithery, LobeHub, mcp.so) | Descobrir mais MCPs brasileiros | https://glama.ai · https://smithery.ai · https://lobehub.com/mcp?q=brazil · https://mcp.so/tags/brazil |

A ferramenta `guia_navegacao` devolve esta lista em tempo de execução para o
agente combinar com as consultas daqui. **Segurança/LGPD:** servidores MCP
*hospedados* por terceiros recebem o que você consulta — para dados
sensíveis, rode localmente os de código aberto (mcp-brasil, mcp-dadosbr,
brasil-data-mcp). A lista completa dos 31 MCPs catalogados, com as ressalvas
de cada um, está espelhada em `regras/links.txt`.

## Quais ferramentas de redes sociais e contato existem?

O escrivão não duplica OSINT de redes sociais — ele linka as ferramentas
validadas do GitHub (nativas ou como MCP) e as regras de uso no dossiê. A
ferramenta `guia_navegacao` devolve esta lista em tempo de execução.

| Ferramenta | O que faz | Acesso |
|---|---|---|
| sherlock-mcp (MCP) | Username em 400+ redes sociais via MCP | https://github.com/Burnsedia/sherlock-mcp |
| osint-mcp-server (MCP) | 37 ferramentas/12 fontes: Sherlock + Osintgram (Instagram) | https://github.com/pasing-group/osint-mcp-server |
| osint-mcp (MCP) | 26 ferramentas OSINT gratuitas expostas como MCP | https://pypi.org/project/osint-mcp/ |
| awesome-osint-mcp-servers | Catálogo curado de MCPs de OSINT | https://github.com/soxoj/awesome-osint-mcp-servers |
| sherlock | Username em 400+ redes | https://github.com/sherlock-project/sherlock |
| social-analyzer | Nome/username em 1000+ sites (API/CLI/web) | https://github.com/qeeqbox/social-analyzer |
| holehe | E-mail → conta registrada em 120+ sites | https://github.com/megadose/holehe |
| maigret | Username → dossiê de 6K sites, gera relatório HTML | https://github.com/soxoj/maigret |
| GHunt | Conta Google a partir do e-mail | https://github.com/mxrch/GHunt |
| mosint | E-mail: vazamentos, redes, servidores | https://github.com/alpkeskin/mosint |
| phoneinfoga | Telefone: carreira, reputação, social | https://github.com/sundowndev/phoneinfoga |
| osint-toolkit | Combo: Sherlock+Maigret+GHunt+Holehe+Ignorant+Telegram | https://github.com/d4t4n3rdsec/osint-toolkit |
| omniscan | CLI unificada: username/e-mail/telefone → todos os tools | https://pypi.org/project/omniscan/ |

**Regras no dossiê:** perfil achado por nome/username/e-mail/telefone é
POSSÍVEL HOMÔNIMO até cruzar com CPF/CNPJ; redes sociais e currículo são dados
AUTODECLARADOS (nota de credibilidade); "quão seguro é o usuário" é indicativo
de vazamentos/exposição, nunca sentença.

## Quais fontes oficiais de CPF existem?

As rotas oficiais se dividem em três classes: públicas (qualquer pessoa, com o
documento do pesquisado), de próprio titular (login gov.br — use apenas com o
titular ou com autorização formal) e por requerimento (certidões). A lista
completa com boas práticas está espelhada em `regras/links-consulta-proprio-cpf.txt`.

| Rota | O que devolve | Acesso |
|---|---|---|
| Receita Federal — consulta pública | Situação cadastral (regular/pendente/cancelada/nula/titular falecido) — CPF + nascimento + captcha | https://servicos.receita.fazenda.gov.br/servicos/cpf/consultasituacao/consultapublica.asp |
| Cenprot Nacional | Protestos em cartório por CPF/CNPJ | https://site.cenprotnacional.org.br |
| ONR — pesquisa de bens | Matrículas de imóveis por CPF/CNPJ (créditos pré-pagos) | https://registradores.onr.org.br |
| Certidão de distribuição | Distribuições em TJ/TRF/TRT por nome/CPF | portais dos tribunais |
| Consumidor.gov.br | Reclamações contra empresas | https://www.consumidor.gov.br |
| Registrato (BCB) | Contas, chaves Pix e empréstimos no CPF — PRÓPRIO TITULAR | https://www.bcb.gov.br/meubc/registrato |
| Meu INSS (CNIS) | Vínculos e contribuições — PRÓPRIO TITULAR | https://meu.inss.gov.br |
| Carteira de Trabalho Digital | Vínculos de emprego — PRÓPRIO TITULAR | https://www.gov.br/trabalho-e-emprego/pt-br/servicos/carteira-de-trabalho-digital |
| Serasa / Boa Vista / Quod / SPC | Score e negativação do próprio CPF | https://www.serasa.com.br |
| PF / TSE / CNDT | Antecedentes, certidão eleitoral, débitos trabalhistas — por requerimento | https://www.gov.br/pf/pt-br/assuntos/antecedentes-criminais |

A ferramenta `fontes_osint` devolve esta classificação em tempo de execução.

## Qual o fluxo típico de uma investigação?

Regras de ouro do servidor: o documento (CPF/CNPJ) manda — a busca principal é
sempre pelo documento e o nome é complemento; HOMÔNIMO É PROIBIDO — achado por
nome sem documento que bata nunca entra na lista principal (no máximo, seção
separada); e o ciclo PF↔PJ é obrigatório — CPF sempre procura os CNPJs
vinculados e CNPJ sempre extrai os CPFs do QSA. O ciclo validado tem nove
passos:

1. `cnj_validar` — valida o DV e o tribunal antes de qualquer consulta.
2. Documento primeiro (OBRIGATÓRIO): `datajud_por_cpf`, `datajud_buscar`/`datajud_varrer` com CPF/CNPJ entre aspas, `esaj_buscar` DOCPARTE.
3. Ciclo PF↔PJ (OBRIGATÓRIO): com CPF do pesquisado, procure os CNPJs vinculados (`brasilapi_cnpj` — razão social costuma embutir o CPF do titular — e `datajud_por_cpf` de cada CNPJ); com CNPJ, extraia os CPFs do QSA e procure os processos dessas pessoas.
4. `datajud_buscar` (nome entre aspas) e `datajud_varrer` — achados por nome: só entram na lista principal se o documento cruzar; sem âncora, POSSÍVEL HOMÔNIMO — PROIBIDO na lista principal.
5. `cnj_desmascarar` com o loop — máscara `000XXXX-XX...` + `cpf` e/ou `nome`: gera candidatos com DV válido, verifica no DataJud e marca os vinculados ao pesquisado.
6. `jusbrasil_buscar` — agregador (rota via browser quando o Cloudflare bloqueia); números mascarados voltam para o passo 5.
7. `djen_intimacoes` — intimações com texto integral revelam fatos, documentos e processos correlatos.
8. `datajud_processo` / `datajud_pesquisar` — capa e metadados por número, classe, assunto ou órgão; `brasilapi_cnpj` e `exa_buscar` para contexto societário e de web.
9. Relatório no padrão obrigatório do prompt 8.5 (seção abaixo), com nível de confirmação por linha.

## Qual o padrão obrigatório de relatório?

OBRIGATÓRIO: todo relatório ou dossiê gerado com dados deste servidor segue o
prompt 8.5 (espelhado em `regras/prompt_8_5.md`) E as estruturas do
`master_rules.md` adaptadas ao HTML estático — sem PHP. O formato padrão é UM
único arquivo HTML autocontido — apenas HTML, CSS e JS internos, sem PHP, sem
arquivos separados, sem CDN — que abre offline; outro formato (PDF, DOCX etc.)
só quando você pedir explicitamente.

- Cabeçalho com nome do pesquisado, data de geração e TL;DR de 3 bullets (registros, confirmações, pendências).
- Seções com título em forma de pergunta e resposta curta (40-60 palavras) antes do detalhe; FAQ ao final; zero emojis; PT-BR objetivo.
- Tabela de processos: número CNJ | tribunal/foro | classe | assunto | órgão julgador | ajuizamento | status | fonte | nível de confirmação — com filtro por status e busca textual via JS interno.
- Níveis de confirmação: CONFIRMADO (fonte chaveada, datas exatas em 2+ bases), PROVÁVEL (fingerprint coerente), POSSÍVEL HOMÔNIMO (sem âncora — PROIBIDO na lista principal; sempre em seção separada).
- Estruturas do master_rules.md: semântica W3C (`<main>`, `<section>`, `<article>`), WCAG AA com contraste, temas claro e escuro com alternância + persistência (localStorage), CSS sem duplicatas, zero `alert()` (JS interno usa showToast) e títulos `<h2>` em pergunta com resposta de 40-60 palavras.
- Ordem de montagem: PRIMEIRO a estrutura pelos `.md` de `regras/` (master_rules.md primeiro), DEPOIS o conteúdo finalizado pelo prompt 8.5.
- Seções obrigatórias do dossiê (sempre que existirem dados): redes sociais, processos relacionados ao CPF, currículo declarado, tabela de processos, cruzamento entre empregos e processos, análise de perfil, quão seguro é o usuário e relacionamentos (pais, filhos, irmãos, cônjuge) — cada qual com fonte e nota de credibilidade; **homônimos não são postados** (no máximo, seção "Descartados", nunca como o pesquisado).
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
- O Jusbrasil bloqueia HTTP puro (Cloudflare 403): `jusbrasil_buscar` devolve
  a rota via browser (MCP Playwright) e os números vêm mascarados — use o
  loop do `cnj_desmascarar` com `cpf`/`nome`.
- Escavador, CEIS/CNEP, TSE e Receita exigem login/captcha/chave — não
  implementados aqui; ver `GUIA_OSINT.md` para as rotas manuais.
- Resultado negativo (0 processos) por nome ou documento no e-SAJ/DataJud é
  **indício, não prova**: o índice de partes tem lacunas (CPF mascarado,
  consulta anônima suprime criminais) — cruze com DJEN e a consulta pública do
  tribunal antes de concluir ausência de processos.

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

**E se o computador não tiver Node?**
No Windows 10/11: `winget install --id OpenJS.NodeJS.LTS -e` e reabra o
terminal; sem winget, use o MSI de https://nodejs.org. A ferramenta
`guia_instalacao` devolve os comandos prontos para Windows, Linux e macOS.

**Por que o agente deve buscar pelo CPF/CNPJ e não pelo nome?**
Porque nome produz homônimos e documento não. O protocolo do servidor (em
`fontes_osint`) é obrigatório: a busca principal é sempre pelo documento,
todas as fontes se cruzam, e achado por nome só vale com o CPF/CNPJ batendo —
sem isso é POSSÍVEL HOMÔNIMO, PROIBIDO na lista principal. E o ciclo PF↔PJ é
obrigatório: CPF procura os CNPJs vinculados; CNPJ extrai os CPFs do QSA.

**Como atualizo o escrivão já instalado?**
Peça `mcp_atualizar` ao agente: o servidor baixa o `server.js` mais recente
direto do GitHub, guarda um backup `.bak` e se substitui — funciona com OU
sem git (não dependa de `git pull`). Depois reinicie o cliente MCP para a
nova versão subir.
