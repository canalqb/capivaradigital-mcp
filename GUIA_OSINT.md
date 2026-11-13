# GUIA OSINT — Onde achar, o que pesquisar, como buscar

Playbook operacional para pesquisas judiciais com fontes 100% públicas,
validado na prática por múltiplas sessões de investigação. Companheiro do
`README.md` (instalação, atalhos) e das ferramentas do `server.js`.

> **REGRA DESTA PASTA (veja AGENTS.md):** nenhum dado de pessoas reais aqui —
> só método, ferramentas e exemplos fictícios.

> **Versão oficial das técnicas de postagem e análise:** **Prompt 9.4** — documento
> vivo no Google Docs:
> `https://docs.google.com/document/d/1WGFspgXb79mpb7rDce3Kv6k665vqDFasNCVU0qWbEwI/export?format=html`
> (acesse pelo link; **não baixe** para o MCP — o servidor consulta ao vivo).
> Todas as referências às versões 9.2 e 8.5 como padrão foram removidas — a 9.4 é a única oficial (a menção "9.2" na seção 9.2 deste guia é numeração interna do próprio guia, não versão de prompt).

---

## 1. ONDE ACHAR — mapa de fontes públicas

| Fonte | O que entrega | Acesso | Limitações |
|---|---|---|---|
| **API pública DataJud/CNJ** (`api-publica.datajud.cnj.jus.br`) | Número, classe, assuntos, órgão, movimentos com datas (**metadados** — serve para existência e fingerprint) | POST `_search`; chave pública documentada na wiki (o `server.js` descobre sozinho) | **Campo `partes` NÃO é mais publicado** (verificado em 24/10/2026: `exists`=0 em `tjsp`/`tjpr`/`tre-sp`/`tst`, 0 em 100 amostras, índice atualizado no dia anterior) — busca por parte sai pelo e-SAJ/DJE/DJEN; retestar de tempos em tempos |
| **DJEN/CNJ** (`comunicaapi.pje.jus.br`) | Intimações e comunicazioni com **texto integral** (sentenças completas, fatos, endereços, números correlatos) | GET por `nomeParte` | Cobertura por tribunal varia; melhor fonte de contexto narrativo. **Limite: `itensPorPagina` máx. 50** (acima a API falha silenciosamente — o servidor já aplica o cap) e **geo-bloqueio 403 para IPs fora do Brasil** (skill `rvsanches/skills-datajud-djen`) |
| **e-SAJ (padrão nacional do CNJ)** — TJSP (`esaj.tjsp.jus.br`), TJAL (`www2.tjal.jus.br`), TJCE (`esaj.tjce.jus.br`) | 1º e 2º grau: busca por nome (`NMPARTE`), documento (`DOCPARTE`), número (`NUMPROC`), **OAB do advogado (`NUMOAB`)** e nome do advogado (`NMADVOGADO`); capa/movimentos dos processos. No TJSP ainda há os **julgados**: `cjpg` (sentenças, texto livre) e `cjsg` (acórdãos, inteiro teor) | HTTP direto (`esaj_buscar`, com `tribunal` e `grau`) ou formulário com Playwright (`esaj_tjsp_guia`) | **No TJSP anônimo suprime partes de processos criminais**; `show.do` por URL direta é bloqueado; consulta ampla demais devolve "muitos processos, refine a busca" |
| **DJE-SP** (`esaj.tjsp.jus.br/cdje`) | Diário da Justiça Eletrônico do TJSP, base textual de 01/10/2007 até hoje: decisões, editais, precatórias, intimações com nomes de partes | `dje_sp_buscar` (nome entre aspas + janela de datas; devolve snippet e URL do PDF oficial de cada publicação) | Homônimos exigem cruzamento por CPF/número; caderno precisa ser escolhido (interior = 18/13/15) |
| **PJe/eproc dos tribunais** | Autos completos por tribunal | Ver rotas por tribunal (§2) | Cada tribunal tem regra própria de sigilo/captcha |
| **PJe CNJ — consulta pública** (`sustentacao.cloud.cnj.jus.br/pjecnj/ConsultaPublica`) | Consulta nacional PJe | Portal web | Cobertura parcial |
| **Diários oficiais** (DJSP e pares) | Editais de citação, publicação de sentenças, leilões | Sites/e-Diários; busca por texto | PDFs grandes; registrar data de publicação |
| **BrasilAPI** (`brasilapi.com.br`) | CNPJ: razão social, sócios (QSA com CPF mascarado e faixa etária), CNAE, situação, datas | GET sem chave | Só pessoa jurídica |
| **Escavador** | Agregador: processos por CPF, máscaras conforme plano, metadados (juiz, advogado, datas) | Conta própria com login (2FA) | Paywall; mascaramento; não contornar termos de uso |
| **Exa** (`api.exa.ai`) | Busca semântica web: notícias, menções, redes, homônimos | `EXA_API_KEY` gratuita | — |
| **TSE/TRE** | Filiação partidária, doações, candidaturas | Site com captcha | captcha manual via Playwright |
| **CEIS/CNEP/CEPIM** (Portal da Transparência) | Sanções e inabilitações de empresas/pessoas | API gratuita mediante chave | cadastro manual |
| **Receita Federal (comprovante CPF/CNPJ)** | Situação cadastral | Site com captcha | captcha manual |
| **Cartórios/Registro Civil (ONRC/CRCs)** | Casamentos, nascimento, imóveis | Sites dos cartórios/central nacional | Custos e captcha variam; usar genitores como âncora |

Portais oficiais de todos os tribunais (TJ, TRF, TRT, TRE, superiores):
tabela completa de atalhos no `README.md` §6.

## 2. ROTAS POR TRIBUNAL (validadas na prática)

| Tribunal | Rota que funciona | Pegadinhas |
|---|---|---|
| **TJSP** | e-SAJ `cpopg`/`cposg`: `esaj_buscar` (HTTP) por nome/doc/número/**OAB**, 1º e 2º grau; julgados em `cjpg`/`cjsg`; `esaj_tjsp_guia` para abrir o processo por número | Anônimo **suprime partes criminais** (nem co-réu comprovado aparece) — criminais exigem OAB ou certidão de distribuição; `show.do` direto é bloqueado, abra pela lista de resultados |
| **TJAL e TJCE** | O **MESMO** e-SAJ do TJSP: `esaj_buscar tribunal=tjal\|tjce` (1º grau `cpopg`, 2º grau `cposg5`) por nome/doc/número/OAB | Verificado ao vivo em 24/10/2026 — contra-prova de homônimo em 3 estados com a mesma ferramenta; mesma sintaxe de campos do TJSP |
| **STJ** | `https://processo.stj.jus.br/processo/pesquisa/` **por browser** | Captcha Turnstile do Cloudflare: recarregar a página e reenviar resolve (mesma técnica do eproc TJSC); busca por 3 formatos de número, devolve partes/advogados/movimentos |
| **TJSC** | eproc 1g/2g consulta pública **por browser** | Turnstile: quando der "Aguarde a verificação", **recarregue a página** (o widget auto-resolve) e reenvie; clique sintético via evaluate falha ("Falha no processamento") — use click nativo do Playwright |
| **TJBA** | PJe consulta pública | Captcha slider Tencent — resolve manualmente a cada busca; alguns processos não aparecem nem por CPF (segredo de justiça, Res. 121/CNJ, ou sistema não-PJe) |
| **TJPI** | e-TJPI 2ª instância por documento | 1º grau migrou para login gov.br no PDPJ (SSO) |
| **Demais TJs** | PJe navegador nacional (`pje.jus.br/navegador`) ou o sistema próprio do tribunal | Confirmar qual sistema o tribunal usa antes de desistir |

## 3. O QUE PESQUISAR — alvos e chaves de busca

1. **Por número CNJ** — completo ou mascarado (quebrável, §5.2).
2. **Por CPF/CNPJ** — fontes chaveadas por documento; a máscara `***.NNN.NNN-**` também é âncora.
3. **Por nome completo** — sempre entre aspas exatas e com qualificadores (nascimento, genitores, cidade): homônimos são a maior fonte de erro.
4. **Por CNPJ** — razões sociais frequentemente embutem o CPF do titular (âncora poderosa); QSA traz CPF mascarado + faixa etária.
5. **Por vínculos** — co-réus, advogados, juízes, empresas ligadas, genitores.
   **Eixo OAB (novo, 24/10/2026):** com o número ou o nome do advogado,
   `esaj_buscar tipo=NUMOAB|NMADVOGADO` lista todas as atuações dele em
   tjsp/tjal/tjce — serve para achar escritório, co-réus e contexto; o
   processo do advogado **nunca** é atribuído ao pesquisado sem cruzamento de
   CPF/qualificação.
6. **Por ficha de identificação** — genitores, nascimento, endereço, contatos e
   documentos do pesquisado vêm da qualificação judicial (autos/DJEN), do
   QSA/CNPJ (BrasilAPI) e do DOE-SP. Os portais de situação cadastral e de
   títulos pedem **nome completo + CPF + nascimento + nome da mãe**: descobrir
   a genitora desbloqueia consultas que o CPF sozinho não abre
   (`guia_dossie` FASE 1B).
7. **Por variações de nome** — nome completo, abreviado, **sem acentos** (os
   indexadores não normalizam), nome de casado(a) e username conhecido; o
   brasileiro no exterior pode assinar qualquer uma delas nos registros
   locais — varrer todas e ancorar por documento o que aparecer.

**Sempre registrar:** fonte exata, URL, data/hora da consulta, cópia bruta
(HTML/PDF/JSON) e a cadeia de confirmação de cada achado.

## 4. O QUE NÃO SAI POR VIA ANÔNIMA (constatações práticas)

- **Processos criminais no TJSP**: partes suprimidas na consulta anônima do
  e-SAJ. Exige advogado com OAB ou certidão de distribuição criminal.
- **Tribunais com sigilo/captcha duro**: processos em segredo de justiça não
  aparecem nem por documento (Res. CNJ 121/2010).
- **1º grau de alguns tribunais**: login gov.br/PDPJ ou captcha por busca.
- **Partes no DataJud público**: campo oculto/limpo — por isso o método
  fingerprint (§5.3) existe.
- **Jusbrasil (diário do DJSP) e eproc.tjsp.jus.br (consulta unificada)**:
  não alcançáveis via fetch anônimo (captcha/paywall) — exigem browser
  automatizado (MCP Playwright; ver `guia_navegacao`).
- **e-SAJ/DataJud = 0 por nome ou documento**: no e-SAJ a consulta anônima
  suprime criminais e o índice tem lacunas; no DataJud o 0 é **estrutural**
  (campo `partes` não publicado desde a verificação de 24/10/2026) — resultado
  negativo é **indício, não prova**; cruze as 3 casas e-SAJ (tjsp/tjal/tjce)
  com DJEN e a consulta pública do tribunal.

### 4.6 Verificação de Persona Pública (Prompt 9.4 §4.6)
Antes de atribuir qualquer declaração, cargo ou ato a uma pessoa pública no
dossiê/relatório, **executar as 5 verificações obrigatórias** e registrar o
resultado em tabela no relatório (uma linha por verificação). **Entrega bloqueada
sem as 5 verificações concluídas.**

| # | Verificação | O que conferir | Como registrar |
|---|---|---|---|
| 1 | **Cargo oficial** | O cargo citado existe na estrutura do órgão na data da fala? Consultar organograma oficial, portarias de nomeação, DOU/DOE. | `Cargo verificado: [sim/não] — fonte: [URL + data]` |
| 2 | **Fonte primária** | A fala/declaração está em canal oficial do órgão (site, Diário Oficial, transmissão ao vivo, perfil verificado do órgão) ou é reprise de terceiros? | `Fonte primária: [sim/não] — URL original: [link] — data captura: [dd/mm/aaaa]` |
| 3 | **Contexto original** | A fala foi editada, recortada ou tirada de contexto? Buscar vídeo/áudio/transcrição integral; comparar trecho viral com o original. | `Contexto íntegro: [sim/não] — diferença: [descrição] — trecho original: [link/timestamp]` |
| 4 | **Comparação viral × original** | O que circula nas redes/imprensa bate com o original? Listar variações (palavras trocadas, trechos omitidos, legendas erradas). | `Variações detectadas: [lista] — impacto no sentido: [mantém/altera/inverte]` |
| 5 | **Conflito de interesse / ganho** | Quem divulga ganha (audiência, verba, voto, venda, processo)? Mapear incentivos do amplificador. | `Conflito identificado: [sim/não] — descrição: [quem/quanto/como]` |

**Regra de bloqueio:** se qualquer das 5 verificações for "não" ou "não verificável",
o dado entra no relatório **apenas como "não confirmado — pendência"** com a
tabela de verificação anexa. **NUNCA** entregar como fato consolidado.

---

## 5. COMO BUSCAR — técnicas validadas

### 5.1 Regra anti-homônimos (antes de qualquer atribuição)
Um dado só pertence ao investigado se houver ao menos UM destes vínculos:
1. Fonte chaveada por CPF/CNPJ;
2. CPF/CNPJ embutido no registro (ex.: razão social);
3. Qualificação judicial nos autos (nascimento, genitora, RG, naturalidade);
4. Máscara de CPF/CNPJ compatível;
5. Corroboração contextual forte (cidades, profissão/CNAE, familiares co-réus).

Sem vínculo → registrar como **"possível homônimo — verificar"**, FORA da
lista principal: é PROIBIDO atribuir por nome puro ou misturar homônimos nos
achados do investigado. Dado autodeclarado (currículo, redes sociais) ≠
registro público — entrar com nota de credibilidade.

### 5.1.1 Ciclo obrigatório PF↔PJ (sempre)
- Pesquisado com CPF → SEMPRE procurar os CNPJs vinculados: `brasilapi_cnpj`
  (razão social costuma embutir o CPF do titular; o QSA traz CPFs mascarados e
  faixa etária) e `datajud_por_cpf` de cada CNPJ achado.
- Pesquisado com CNPJ → SEMPRE extrair os CPFs do QSA (`brasilapi_cnpj`) e
  procurar os processos dessas pessoas físicas: o CNPJ processa e é processado
  pelas pessoas por trás dele.
- O ciclo é CPF → CNPJ → CPF, sempre.

### 5.2 Quebra de máscara CNJ (a técnica-assinatura)
Uma máscara `NNNXXXX-DD.AAAA.J.TR.OOOO` (agregadores pagos) resolve-se assim:
1. **Loop 0000-9999** nos dígitos mascarados → 10.000 combinações;
2. **DV oficial CNJ** (Res. 65/2008, ISO 7064 MOD 97-10):
   `DD = 98 − ((NNNNNNN+AAAA+J+TR+OOOO) × 100 mod 97)` → só ~103 fecham a conta;
3. **Uma única query `terms` no DataJud** com os candidatos → devolve só os existentes;
4. **Fingerprint** dos existentes (§5.3) contra os metadados da fonte que mascarou;
5. **Confirmação tripla**: datas exatas de distribuição/última movimentação +
   números de origem citados nos autos + consulta pública do tribunal.
Ferramenta: `cnj_desmascarar` (passos 2-3 embutidos com `consultar_datajud=true`).

### 5.3 Fingerprint processual (contorno da API pública)
Cada candidato é identificado pelo conjunto **órgão julgador + classe +
assunto(s) + datas de movimentação**, cruzado com os metadados da fonte
original (data da última movimentação, juiz, advogado, tribunal). Em boa parte
das máscaras o fingerprint é **único** naquele órgão — atribui sem ver nome.

### 5.4 Mineração de intimações (DJEN)
Buscar `nomeParte` devolve intimações com **texto integral** — sentenças
completas que revelam fatos, qualificações, endereços e **números de processos
correlatos não visíveis em índices** (ex.: a condenação anterior citada como
maus antecedentes; números de origem/precedentes).

### 5.5 DataJud por documento/nome
- **Dois formatos de partes:** os índices da API pública usam `partes.nome` /
  `partes.polo` / `partes.documento` (formato consulta-processual) **ou**
  `partes.pessoa.*` (formato MTD), conforme o tribunal — as ferramentas cobrem
  ambos via `bool.should`: `datajud_por_nome` (nome COMPLETO exato em
  match_phrase nos dois caminhos, polo opcional ATIVO/PASSIVO cobrindo os
  rótulos Autor/Réu, ajuizamento decrescente) e `datajud_por_cpf`
  (`partes.documento` + `documentoReplicado`, **nas duas grafias** — com e sem
  pontuação).
- `documentoReplicado` é mascarado em muitos tribunais.
- Alternativa: `datajud_buscar` com o CPF **formatado entre aspas duplas**
  (`"000.000.000-00"`) ou o nome exato entre aspas — a query_string varre os
  textos dos autos e das partes visíveis.
- Zero resultados não é erro: tribunais que omitem as partes retornam 0 — a
  resposta sugere `datajud_buscar` ou a consulta pública do tribunal.

### 5.6 e-SAJ TJSP (sem captcha)
1. Busca: `esaj_buscar` (HTTP) — nome, documento ou número;
2. Abrir o processo: partir SEMPRE da lista de resultados ou do formulário
   (`esaj_tjsp_guia`) — `show.do` direto é bloqueado;
3. Busca por nome com captcha: Playwright + resolução manual pelo usuário.

### 5.7 Cruzamento de datas exatas
A data de **distribuição** e a da **última movimentação** devem bater
EXATAMENTE entre fontes (agregador vs. DataJud vs. tribunal). Uma divergência =
investigar antes de atribuir. Datas "aproximadas" costumam ser do lado de
origem (precatórias), não da consulta.

### 5.8 Evidências e reprodutibilidade
- Salvar a resposta bruta (HTML/JSON) com data/hora;
- Documentar a cadeia: máscara → candidatos → existentes → fingerprint → confirmação;
- Duas fontes independentes para cada fato crítico;
- Anotar o que foi ELIMINADO e por quê (evita retrabalho e vieses).

### 5.9 Mineração do DJE-SP (diário oficial textual)
O DJE-SP (`esaj.tjsp.jus.br/cdje`) é a fonte primária do TJSP: todo ato
publicado (decisões, sentenças, editais, intimações, precatórias) desde
01/10/2007, com busca textual **gratuita e anônima** — sem captcha, sem login.
Cobre o que a API pública omite (partes, nomes, desfechos por extenso).

- **Ferramenta:** `dje_sp_buscar` (nome entre aspas + janela de datas + caderno;
  até 10 páginas de 10 hits por chamada; devolve snippet, números citados e a
  URL do PDF oficial — anônima — de cada publicação).
- **Cadernos:** 1º grau Interior = **18/13/15** (Partes I/II/III); Capital =
  12/20; 2ª Instância = 11/19; Administrativo = 10; Editais = 14; todos = -11.
- **Método:** varra janelas curtas (dias/semanas) com o nome exato entre aspas;
  leia o PDF de cada hit; registre data de publicação + caderno + página.
- **Limites:** só TJSP (nada de TRT/TRF/TRE/ outros estados); datas futuras à
  última edição retornam zero (o servidor informa a última edição no campo
  `dtLimiteFim` do formulário).
- **Anti-homônimo:** publicação que cita o pesquisado só vale com o número do
  processo cruzando (DataJud/e-SAJ) ou o documento do pesquisado; precatórias
  listam RÉU com nome completo — cruzar antes de atribuir.

### 5.10 Ciclo PF<->PJ em uma chamada (e templates via protocolo)
- **`ciclo_pf_pj({ cpf_cnpj })`** executa o ciclo inteiro (§5.1.1) em uma
  chamada: DataJud multi-tribunal com o documento entre aspas + e-SAJ DOCPARTE
  + DJE-SP (base integral) + BrasilAPI (CNPJ → razão social e CPFs mascarados
  do QSA com rota de quebra), fechando com VEREDITO único (hits por fonte) e
  próximos passos. Entrada CPF devolve a receita reversa CPF→CNPJ validada:
  razão social de ME costuma embutir o CPF do titular + busca web
  `"NOME" "CPF" CNPJ`. Execute ANTES de fechar qualquer dossie.
- **`regras_ler({ arquivo })`** devolve o conteúdo integral dos .md de
  regras/ (whitelist: master_rules, prompt_9_4) para agentes que acessam o
  servidor só por protocolo — o guia_relatorios deixa de prometer arquivos
  que o agente não pode ler. Aviso embutido: o prompt 9.4 original é genérico
  de blog/YouTube; use apenas as seções aplicáveis ao dossiê. Versão única
  oficial: 9.4 (8.5 e 9.2 aposentadas).
- **Modo dossiê exclusivo:** `guia_relatorios({ escopo: "exclusivo cpf" })`
  devolve só as normas do dossiê de um único documento, com o PADRÃO NEGATIVO
  de homônimos (nenhuma seção de descartados sem pedido explícito do cliente).

### 5.11 Redes sociais e telefone (OSINT de perfil)
- **`social_buscar_usuario({ usuario, limite })`**: varre o nick na base pública
  do WhatsMyName (GitHub raw, cache em memória) — para cada site monta a URL
  (`{account}`) e confere os marcadores de existência (`m_code`/`m_string`)
  contra os de ausência (`e_code`/`e_string`). Paralelo (8 por vez), timeout
  de 12 s por site; limite configurável (default 40, max 150 sites).
- **`telefone_consultar({ telefone })`**: digita, identifica DDD/tipo, consulta
  UF + cidades do DDD na BrasilAPI e monta as rotas complementares (wa.me,
  Numtrace — página dinâmica, use Playwright —, Social Searcher).
- **Anti-homônimo de nick:** perfil EXISTENTE ≠ perfil DA PESSOA — valide por
  bio, foto, cidade, vínculos e datas; no dossiê, os achados de rede social
  entram como AUTODECLARADOS e o vínculo exige âncora (CPF/CNPJ cruzando ou
  contexto forte).
- **Inconclusivos:** sites que bloqueiam bots ou mudaram os marcadores
  aparecem como inconclusivos — "não encontrado" NUNCA é prova de ausência.
- **Equivalentes locais (Python/Go, mais sites):** sherlock, maigret, snoop,
  blackbird, nexfil, UserFinder, yesitsme, social-analyzer — e as curadorias
  Awesome-OSINT-List, OSINT-Github-profiles, OSINTAnonymous (ver README).
- **OSINT internacional — brasileiro no exterior (pacote por país, validado
  22/10/2026):** o CPF NÃO indexa fora do Brasil; a âncora vira o NOME EXATO
  contra os registros públicos do país (e todo achado por nome carrega o limite
  anti-homônimo). Irlanda — CORE/CRO (`core.cro.ie`; Cloudflare challenge passa
  aguardando ~8 s; o formulário fica num drawer off-screen — clique/fill via JS
  evaluate), insolvência ISI (`isi.jahs.ie/public/cases`, nome exato em dois
  campos), High Court (`courts.ie/high-court-search` — resultados client-side:
  varra as páginas RENDERIZADAS, o HTML via fetch vem vazio), registro eleitoral
  (`checktheregister.ie` — WAF 403 para browser automatizado, consulta manual).
  Reino Unido — Companies House (empresas + officers). Global — Interpol Red
  Notices (site; a API `ws.interpol.int` é inacessível por HTTP direto),
  OpenSanctions, Wayback CDX. Recursos por país: OSINT-for-countries (base
  estruturada por país), X-osint (CLI Termux/Linux), topics/osint-tools e
  topics/open-source-intelligence (descoberta contínua), Maltego (comercial —
  grafos de vínculos; Basic gratuito, Entry €3.000/ano). **Fuso via commits:**
  o patch bruto de um commit (`github.com/us/repo/commit/SHA.patch`) traz o
  offset local da máquina do autor (-0300 = Brasília) — indício público, nunca
  prova (VPN existe). **Limites estruturais a declarar:** passaporte, vistos,
  PNR e SIS são dados estatais (sem via pública gratuita); CLT no exterior não
  tem CAGED público; GDPR vigora na UE. A lista completa roda em
  `fontes_osint` e `guia_navegacao` em tempo de execução.

---

## 6. Histórico técnico rápido (para não repetir erros)

- DataJud: `terms` sem campo = HTTP 400; `match.numeroProcesso` só com 20
  dígitos; TJSP responde lento (504) — timeout alto + 3 tentativas.
- e-SAJ: busca via HTTP funciona (`search.do` com `cbPesquisa`), mas o link
  direto do processo (`show.do`) é bloqueado — sempre pela lista/formulário.
- eproc TJSC: clique sintético via evaluate dá "Falha no processamento" —
  usar click nativo; captcha Turnstile resolve recarregando a página.
- Escavador: sessão persiste após login; busca de nome exato via
  `escavador.com/busca?q="NOME"&tipoBusca=envolvidos`.
- BrasilAPI: bloqueia User-Agent padrão do Node — enviar header de navegador.
- DJE-SP: o POST da busca exige `dadosConsulta.cdCaderno` (sem ele o servidor
  devolve o formulário sem erro); a data do resultado alterna entre
  "01/07/2025" e "Tue Jul 01 ... 2025" conforme o locale do nó (o parser
  aceita ambos); a paginação é AJAX (`trocaDePagina.do`) com estado na sessão
  (cookie + jsessionid) — não é stateless.
- DJE-SP (2): o hidden `dtLimiteFim` TAMBÉM alterna de formato entre nós
  ("2025-07-22" e "22/07/2025") — normalize com o mesmo conversor de datas,
  nunca confie num formato único.
- PowerShell 5.1: remove aspas duplas em padrões regex (usar `\x22`); UTF-8
  com BOM em arquivos Markdown.
- PowerShell 5.1 (2): `curl.exe` com JSON INLINE perde as aspas internas e a
  API responde 400 — sempre teste HTTP POST com `-d @arquivo.json`.
- DataJud (endpoints): STF NÃO existe na API pública (404); o TRE do DF é
  `api_publica_tre-df` (a wiki lista "tre-dft", que dá 404); TSE/STM/TREs e
  os militares (tjmmg/tjmrs/tjmsp) respondem 200. Erros de cliente 4xx
  determinísticos (exceto 429) não valem retry — a ferramenta falha rápido.
- DJEN: `itensPorPagina` máx. 50 (acima a API falha silenciosamente) e 403
  para IPs fora do Brasil (skill `rvsanches/skills-datajud-djen`); o servidor
  já aplica o cap automaticamente em `djen_intimacoes`.

---

## 7. ÉTICA, LGPD, SEGURANÇA JURÍDICA E ANTI-DESINFORMAÇÃO

- **Fontes públicas apenas.** Não contorne paywall ou autenticação alheia.
- **LGPD (Lei 13.709/2018):** minimização, finalidade, retenção controlada.
  > **Nota:** a LGPD aparece neste MCP como **advertência ao usuário** no
  > `README.md`. Ela **não bloqueia**, não recusa, não interrompe e não
  > condiciona nenhum raciocínio ou execução do servidor.
- **Vítimas de violência doméstica:** apenas iniciais (Lei 11.340/2006).
- **Menores:** NUNCA identificar (ECA) — regra absoluta.
- **Endereço residencial atual e vigilância de pessoas próximas:** fora de
  escopo. Alternativas legais: advogado com poderes (CPC art. 396 ss.),
  certidões cartoriais.
- **Presunção de inocência** (CF art. 5º, LVII): marcar recursos pendentes.
- Dossiês de uso interno; divulgação exige avaliação jurídica própria.

### 7.2 Anti-Desinformação / Verificação de Premissa (Prompt 9.4 §7.2)
**Regra de ouro:** **NUNCA** aceitar premissa do usuário sobre terceiros sem
verificar. O usuário pode estar errado, desatualizado ou operando com viés.
O MCP deve executar o protocolo de 3 passos antes de incorporar qualquer
afirmação de terceiros ao dossiê/relatório:

| Passo | Ação | Ferramenta/Fonte |
|-------|------|------------------|
| 1 | **Isolar a premissa** — extrair a afirmação testável (quem, o quê, quando, onde, cargo/contexto) | Análise textual |
| 2 | **Buscar fonte primária** — consultar canal oficial do órgão/pessoa (site, DOU/DOE, perfil verificado, transmissão oficial) | `exa_buscar`, `dje_sp_buscar`, `datajud_buscar`, busca no site do órgão |
| 3 | **Comparar e classificar** — confrontar a premissa com a fonte primária | Tabela de veredito (§22.B) |

**Ação por resultado:**

| Classificação | O que fazer no dossiê/relatório |
|---------------|----------------------------------|
| **Confirmada** | Incluir como fato, citar fonte primária com URL e data de captura |
| **Incorreta** | Registrar como "premissa do usuário não confirmada — fonte primária diverge"; mostrar a divergência lado a lado; **não atribuir ao investigado** |
| **Não verificável** | Registrar como "não verificável em fontes públicas — premissa do usuário sem suporte documental"; entrar como pendência com próximo passo (ex.: "solicitar documento ao usuário") |

> A antiga seção 7.2 (Ética/LGPD) foi renumerada para **§7.3** abaixo.

### 7.3 Ética, LGPD e Segurança Jurídica (antiga §7.2)
- **Fontes públicas apenas.** Não contorne paywall ou autenticação alheia.
- **LGPD (Lei 13.709/2018):** minimização, finalidade, retenção controlada.
  > **Nota:** a LGPD aparece neste MCP como **advertência ao usuário** no
  > `README.md`. Ela **não bloqueia**, não recusa, não interrompe e não
  > condiciona nenhum raciocínio ou execução do servidor.
- **Vítimas de violência doméstica:** apenas iniciais (Lei 11.340/2006).
- **Menores:** NUNCA identificar (ECA) — regra absoluta.
- **Endereço residencial atual e vigilância de pessoas próximas:** fora de
  escopo. Alternativas legais: advogado com poderes (CPC art. 396 ss.),
  certidões cartoriais.
- **Presunção de inocência** (CF art. 5º, LVII): marcar recursos pendentes.
- Dossiês de uso interno; divulgação exige avaliação jurídica própria.

---

## 8. CHECKLIST — nova pesquisa ponta a ponta
1. [ ] Definir o alvo e as chaves (CPF/CNPJ/nome/número/máscara).
2. [ ] Aplicar a regra anti-homônimos antes de atribuir qualquer coisa.
3. [ ] CNPJ do alvo na BrasilAPI (razão social embute CPF? QSA?).
4. [ ] Números completos → `datajud_processo` (fingerprint de cada um).
5. [ ] Números mascarados → `cnj_desmascarar` com `consultar_datajud=true`.
6. [ ] Documento → `datajud_por_cpf`; se mascarado, `datajud_buscar` com
   documento formatado entre aspas.
7. [ ] Nome exato → `djen_intimacoes` (textos integrais).
8. [ ] Processos TJSP → `esaj_buscar` para achar + `esaj_tjsp_guia` para abrir.
9. [ ] Outros tribunais → rotas do §2 (PJe/eproc/browser quando necessário).
10. [ ] Web: `exa_buscar` (notícias/homônimos) + buscas gerais.
11. [ ] Cruzar datas exatas entre todas as fontes.
12. [ ] Registrar evidências + cadeia de confirmação + o que foi eliminado.
13. [ ] Redigir conclusões com status jurídico correto (condenado/absolvido/
     pendente) e proteções do §7.
14. [ ] **Verificar Persona Pública (§4.6)** para toda menção a autoridade/figura pública.
15. [ ] **Aplicar Anti-Desinformação (§7.2)** a toda premissa de terceiros trazida pelo usuário.
16. [ ] **Usar Schema NewsArticle/AnalysisArticle (§11.1)** se o relatório for post de análise/notícia.
17. [ ] **Seguir Protocolo de Análise/Fact-Check/Debate (§22.B)** para entregas de análise.

---

## 9. ESQUEMAS DE METADADOS PARA POSTS (Prompt 9.4 §11.1)

### 9.1 Schema BlogPosting (padrão — posts de dossiê/relatório técnico)
Já implementado no template `report-template.html` (LD+JSON `BlogPosting`).

### 9.2 Schema NewsArticle / AnalysisArticle (Prompt 9.4 §11.1 — posts de análise, fact-check, debate) — a numeração "9.2" aqui é a seção interna deste guia, não a versão do prompt; a versão única oficial do prompt é a 9.4
**Usar quando o relatório for uma análise de declaração, fact-check ou debate público.**
Campos adicionais/obrigatórios além do BlogPosting:

| Campo | Tipo | Obrigatório? | Descrição |
|-------|------|--------------|-----------|
| `@type` | Text | Sim | `NewsArticle` OU `AnalysisArticle` |
| `about` | Thing/Person/Organization | Sim | Entidade principal analisada (pessoa pública, órgão, política) |
| `mentions` | Thing[] | Sim | Lista de entidades citadas (pessoas, órgãos, leis, processos) com `@id` quando possível |
| `jobTitle` | Text | Se `about` for Person | Cargo **verificado** pela §4.6 (não o cargo alegado) |
| `claimReviewed` | Text | Para Fact-Check | A declaração exata verificada (máx. 300 chars) |
| `reviewRating` | Rating | Para Fact-Check | Veredito estruturado (ver §22.B tabela) |
| `datePublished` | DateTime | Sim | Data da publicação do post/análise |
| `dateModified` | DateTime | Sim | Última atualização da análise |
| `author` | Person/Organization | Sim | Autor da análise (não "canalqb"; usar "Capivaradigital-MCP Gerenciamento de consultas públicas") |
| `publisher` | Organization | Sim | Mesma identidade do author |
| `isPartOf` | CreativeWork | Opcional | Referência ao blog irmão `BLOG_NOTICIAS` (ver §10) |

**Exemplo mínimo (JSON-LD):**
```json
{
  "@context": "https://schema.org",
  "@type": "AnalysisArticle",
  "headline": "Análise: declaração do Ministro X sobre tema Y",
  "about": { "@type": "Person", "name": "Nome do Ministro", "jobTitle": "Ministro do [Órgão] (verificado em dd/mm/aaaa)" },
  "mentions": [
    { "@type": "Thing", "name": "Lei 12.345/2010" },
    { "@type": "Organization", "name": "Ministério do [Órgão]" }
  ],
  "claimReviewed": "Trecho exato da declaração verificada",
  "reviewRating": {
    "@type": "Rating",
    "ratingValue": "Parcialmente verdadeiro",
    "bestRating": "Verdadeiro",
    "worstRating": "Falso",
    "alternateName": "Veredito: Parcialmente verdadeiro — fonte primária confirma X mas omite Y"
  },
  "author": { "@type": "Organization", "name": "Capivaradigital-MCP Gerenciamento de consultas públicas" },
  "publisher": { "@type": "Organization", "name": "Capivaradigital-MCP Gerenciamento de consultas públicas" },
  "datePublished": "2026-10-25T14:30:00-03:00",
  "dateModified": "2026-10-25T14:30:00-03:00"
}
```

---

## 10. VARIÁVEL BLOG_NOTICIAS (Prompt 9.4)

**`BLOG_NOTICIAS`** — URL do blog irmão opcional para publicação de análises,
notícias, fact-checks e debates (distinto do blog de dossiês técnicos).
- Se definida, o campo `isPartOf` do schema AnalysisArticle/NewsArticle aponta
  para esta URL.
- O conteúdo do dossiê técnico **não** vai para o blog de notícias; apenas
  análises derivadas (fact-checks, debates, comentários de declarações públicas)
  usam esta rota.
- Configurar via variável de ambiente ou no arquivo de configuração do agente;
  se não definida, o campo `isPartOf` é omitido.

---

## 11. GATILHO: `{Analise a declaração}` (Prompt 9.4)

Quando o usuário invocar **exatamente** `{Analise a declaração}`, o MCP deve
executar o **Protocolo de Análise / Fact-Check / Debate (§22.B)** com os
parâmetros obrigatórios:

| Parâmetro | Obrigatório? | Descrição |
|-----------|--------------|-----------|
| `fonte` | Sim | Identificação da fonte da declaração (ex.: "Twitter @usuario", "Site oficial Ministério X", "Diário Oficial da União") |
| `cargo` | Sim | Cargo oficial do declarante na data da fala (será verificado pela §4.6) |
| `fala` | Sim | Trecho exato da declaração a ser analisada (máx. 500 chars; se maior, indicar trecho-chave + link para íntegra) |
| `url_original` | Sim | URL da fonte primária onde a declaração aparece (site oficial, DOU, transmissão ao vivo) |

**Fluxo automático ao receber o gatilho:**
1. Executar §4.6 (Verificação de Persona Pública) para validar `cargo` e `fonte`.
2. Executar §7.2 (Anti-Desinformação) para classificar a `fala` contra `url_original`.
3. Montar a análise seguindo o **Protocolo §22.B (12 blocos)**.
4. Gerar o relatório com schema **AnalysisArticle** (§11.1).
5. Se `BLOG_NOTICIAS` definida, preparar publicação no blog irmão (prompt 9.4 — versão única oficial).

---

## 12. PROTOCOLO DE ANÁLISE / FACT-CHECK / DEBATE — 12 BLOCOS (Prompt 9.4 §22.B)

Toda análise de declaração pública, fact-check ou debate estruturado deve seguir
esta estrutura **obrigatória de 12 blocos**, em ordem. Entrega bloqueada se
faltar qualquer bloco.

| Bloco | Título | Conteúdo obrigatório |
|-------|--------|----------------------|
| 1 | **Cabeçalho & Metadados** | Título descritivo, `claimReviewed`, data da fala, data da análise, autor (Capivaradigital-MCP), schema AnalysisArticle/NewsArticle, `isPartOf` se `BLOG_NOTICIAS` |
| 2 | **Declaração Verbatim** | Trecho exato da fala (`fala`), com timestamp se vídeo/áudio; link para íntegra (`url_original`) |
| 3 | **Identificação do Declarante** | Nome, cargo **verificado (§4.6)**, órgão, contexto da fala (evento, entrevista, post, sessão) |
| 4 | **Contexto Fático** | O que estava em discussão; fatos de fundo necessários para entender a declaração (leis, dados oficiais, decisões judiciais citadas) |
| 5 | **Fontes Primárias Consultadas** | Lista de URLs oficiais consultadas (site do órgão, DOU/DOE, Diário da Justiça, portal de transparência, DataJud, tribunal), com data/hora de captura |
| 6 | **Comparação: Declaração × Fonte Primária** | Tabela lado a lado: o que a declaração diz vs. o que a fonte primária mostra; marcar convergências, omissões, inversões, erros factuais |
| 7 | **Veredito Estruturado** | Classificação: **Verdadeiro / Parcialmente verdadeiro / Enganoso / Falso / Não verificável** — com justificativa em 1 frase + evidência chave |
| 8 | **Tabela de Veredito Detalhada** | Colunas: `Afirmação` | `Status (V/P/E/F/NV)` | `Fonte Primária` | `Evidência` | `Nota` — uma linha por afirmação testável extraída da fala |
| 9 | **Análise de Contexto e Intenção** | A declaração, mesmo se factualmente correta, omite contexto relevante? Há seletividade? Qual o provável objetivo retórico? (análise, não opinião) |
| 10 | **Interesse Público e Impacto** | Por que isso importa? Quem é afetado? Há processo legislativo, judicial, administrativo em curso relacionado? |
| 11 | **Limitações e Pendências** | O que NÃO foi possível verificar (fontes indisponíveis, segredo de justiça, dados não públicos); próximo passo recomendado |
| 12 | **Checklist Pré-Entrega** | □ §4.6 completo (5 verificações) □ §7.2 aplicado □ Schema AnalysisArticle válido □ Tabela de veredito (bloco 8) preenchida □ Fontes primárias com URL + data □ Nenhuma opinião sem rótulo □ LGPD advisory no rodapé do post |

**Regras de citação em contexto (obrigatórias nos blocos 5, 6, 8):**
- Citar **trecho exato** da fonte primária (máx. 300 chars por citação).
- Indicar **localização** na fonte (página, parágrafo, timestamp, seção do Diário Oficial).
- Link **direto** para o trecho quando possível (âncora, `?search=`, timestamp YouTube).
- **Nunca** citar agregador (Jusbrasil, Escavador, notícias) como fonte primária — só o original.

**Metadados específicos do post de análise (além do schema §11.1):**
- `analysisType`: `fact-check` | `statement-analysis` | `debate-context`
- `verifiedBy`: `Capivaradigital-MCP`
- `verificationDate`: ISO 8601
- `primarySourcesCount`: inteiro
- `claimsTested`: inteiro

---

## 13. CHECKLIST — nova pesquisa ponta a ponta (atualizado v9.4)
1. [ ] Definir o alvo e as chaves (CPF/CNPJ/nome/número/máscara).
2. [ ] Aplicar a regra anti-homônimos antes de atribuir qualquer coisa.
3. [ ] CNPJ do alvo na BrasilAPI (razão social embute CPF? QSA?).
4. [ ] Números completos → `datajud_processo` (fingerprint de cada um).
5. [ ] Números mascarados → `cnj_desmascarar` com `consultar_datajud=true`.
6. [ ] Documento → `datajud_por_cpf`; se mascarado, `datajud_buscar` com
   documento formatado entre aspas.
7. [ ] Nome exato → `djen_intimacoes` (textos integrais).
8. [ ] Processos TJSP → `esaj_buscar` para achar + `esaj_tjsp_guia` para abrir.
9. [ ] Outros tribunais → rotas do §2 (PJe/eproc/browser quando necessário).
10. [ ] Web: `exa_buscar` (notícias/homônimos) + buscas gerais.
11. [ ] Cruzar datas exatas entre todas as fontes.
12. [ ] Registrar evidências + cadeia de confirmação + o que foi eliminado.
13. [ ] Redigir conclusões com status jurídico correto (condenado/absolvido/
     pendente) e proteções do §7.
14. [ ] **Verificar Persona Pública (§4.6)** para toda menção a autoridade/figura pública.
15. [ ] **Aplicar Anti-Desinformação (§7.2)** a toda premissa de terceiros trazida pelo usuário.
16. [ ] **Usar Schema NewsArticle/AnalysisArticle (§11.1)** se o relatório for post de análise/notícia.
17. [ ] **Seguir Protocolo de Análise/Fact-Check/Debate (§22.B)** para entregas de análise.
18. [ ] **Gatilho `{Analise a declaração}`** — se invocado, executar fluxo automático do §11.
19. [ ] **Variável `BLOG_NOTICIAS`** — se definida, preparar `isPartOf` no schema.

---

**Fim do GUIA_OSINT.md v9.4** — fonte das técnicas de postagem e análise:
`https://docs.google.com/document/d/1WGFspgXb79mpb7rDce3Kv6k665vqDFasNCVU0qWbEwI/export?format=html`