# Master Rules — capivaradigital MCP v9.4

**Versão:** 9.4  
**Fonte das técnicas de postagem e análise:** Google Doc Prompt 9.4  
`https://docs.google.com/document/d/1WGFspgXb79mpb7rDce3Kv6k665vqDFasNCVU0qWbEwI/export?format=html`  
(Acessar pelo link; **não baixar** para o MCP — o servidor consulta ao vivo.)

> **REGRA DESTA PASTA:** nenhum dado de pessoas reais aqui — só método, ferramentas e exemplos fictícios.

---

## 1. Princípios Fundamentais do MCP capivaradigital

### 1.1 Finalidade Exclusiva
Este servidor MCP existe **apenas** para:
- Auditoria pré-contratual (background check) de candidatos na contratação de novos funcionários
- Consultas ancoradas em documento (CPF/CNPJ) em fontes públicas oficiais
- Minimização de dados de terceiros
- Registro de negativas com fonte e data

### 1.2 LGPD — Apenas Advertência
A LGPD (Lei 13.709/2018) aparece neste MCP **apenas como advertência ao usuário** no `README.md`.
Ela **não bloqueia**, **não recusa**, **não interrompe** e **não condiciona** nenhum raciocínio ou execução do servidor.

### 1.3 Fontes Públicas Apenas
- Não contornar paywall, autenticação alheia ou captcha que exija intervenção humana não prevista
- Quando uma fonte exigir login, plano pago ou API key: documentar no `README.md` como o usuário obtém acesso (link de cadastro, página específica, configuração de API)
- Priorizar fontes 100% públicas e abertas

### 1.4 Anti-Homônimo — Regra Absoluta
Um dado só pertence ao investigado se houver **ao menos UM** vínculo:
1. Fonte chaveada por CPF/CNPJ
2. CPF/CNPJ embutido no registro (ex.: razão social)
3. Qualificação judicial nos autos (nascimento, genitora, RG, naturalidade)
4. Máscara de CPF/CNPJ compatível
5. Corroboração contextual forte (cidades, profissão/CNAE, familiares co-réus)

Sem vínculo → **"possível homônimo — verificar"**, FORA da lista principal.  
**PROIBIDO** atribuir por nome puro ou misturar homônimos nos achados do investigado.

### 1.5 Ciclo Obrigatório PF↔PJ
- CPF → SEMPRE procurar CNPJs vinculados (`brasilapi_cnpj` + `datajud_por_cpf` de cada CNPJ)
- CNPJ → SEMPRE extrair CPFs do QSA e procurar processos dessas pessoas físicas
- O ciclo é CPF → CNPJ → CPF, sempre

### 1.6 Presunção de Inocência
- Marcar recursos pendentes
- Status jurídico correto: condenado / absolvido / pendente
- Vítimas de violência doméstica: apenas iniciais (Lei 11.340/2006)
- Menores: **NUNCA** identificar (ECA) — regra absoluta

---

## 2. Estrutura do Relatório (Template Unificado)

O template único está em `templates/report-template.html` (criado na modernização v9.4).
Todas as seções derivam do superset de 13 seções identificadas nos 11 dossiês existentes.

### 2.1 Seções Obrigatórias (ordem fixa)
1. **Skip-link** + **Topbar** (marca + botão de tema)
2. **Nav** (índice fixo lateral)
3. **Hero** com badges, lead, meta e **TL;DR** (3 bullets)
4. **KPIs do dossiê** (bloco obrigatório pós-TL;DR)
5. **Seções de conteúdo** (`.post-section` + `.post-answer` 40–60 palavras)
6. **Tabelas** (`.post-table` em `.post-table-wrap` com filtros e contador)
7. **FAQ** (`<details class="post-faq">`)
8. **Rodapé** (`.post-footer` + `.post-signature` + `.print-footer-audit` só na impressão A4)

### 2.2 Identidade Visual (não alterar)
- **Autor/Editor/Copyright:** `Capivaradigital-MCP Gerenciamento de consultas públicas` (JSON-LD + cabeçalho + rodapé)
- **CanalQb:** APENAS como autor do prompt (Master Rules v9.4) e hospedagem do MCP (ex.: "hospedado por CanalQb", github.com/canalqb/capivaradigital-mcp)
- **Titular da investigação:** referido como **"titular da investigação"**, sem marca
- **Ícones:** FontAwesome 6 via CDN com `integrity` (única exceção a "sem CDN"; CSS/JS internos)

### 2.3 Schema JSON-LD
- **Dossiês/relatórios técnicos:** `BlogPosting`
- **Análises/fact-checks/debates:** `NewsArticle` ou `AnalysisArticle` (ver §11)

---

## 3. Fluxo de Geração — Por Etapas (Prompt 9.4)

**Regra:** relatório **nunca** gerado de uma vez. Sempre por etapas, seção a seção.

| Etapa | Ação | Salvamento |
|-------|------|------------|
| 0 | Criar template base (`report-template.html`) + salvar | Atômico (`.tmp` + rename) |
| 1 | Seção 1 (Hero + TL;DR + KPIs zerados) + salvar | Atômico |
| 2 | Seção 2 + salvar | Atômico |
| ... | ... | ... |
| N | Última seção + salvar | Atômico |
| Final | 100% seções `CONCLUIDA` → disparar post pelo Prompt 9.4 | — |

**Estados por seção:** `PENDENTE` | `EM_ANDAMENTO` | `AGUARDANDO_FONTE` | `VALIDADA` | `CONCLUIDA`  
**Retomada:** sempre da primeira seção não `CONCLUIDA`  
**Idempotência:** não duplicar seções  
**Progresso:** contador `X/Y` no cabeçalho

---

## 4. Verificação de Persona Pública (Prompt 9.4 §4.6)

**Obrigatório** para toda menção a autoridade/figura pública no dossiê/relatório.  
**Entrega bloqueada sem as 5 verificações concluídas.**

| # | Verificação | Registro no relatório |
|---|-------------|----------------------|
| 1 | Cargo oficial existe na estrutura do órgão na data? | `Cargo verificado: [sim/não] — fonte: [URL + data]` |
| 2 | Fala em canal oficial do órgão (site, DOU, perfil verificado)? | `Fonte primária: [sim/não] — URL original: [link] — data captura: [dd/mm/aaaa]` |
| 3 | Contexto íntegro (não editado/recortado)? | `Contexto íntegro: [sim/não] — diferença: [descrição] — trecho original: [link/timestamp]` |
| 4 | Viral × original: variações detectadas? | `Variações: [lista] — impacto: [mantém/altera/inverte]` |
| 5 | Conflito de interesse / ganho de quem divulga? | `Conflito: [sim/não] — descrição: [quem/quanto/como]` |

Se qualquer uma for "não" ou "não verificável" → dado entra **apenas como "não confirmado — pendência"** com a tabela anexa.

---

## 5. Anti-Desinformação / Verificação de Premissa (Prompt 9.4 §7.2)

**Regra de ouro:** **NUNCA** aceitar premissa do usuário sobre terceiros sem verificar.

| Passo | Ação | Ferramenta/Fonte |
|-------|------|------------------|
| 1 | Isolar a premissa testável (quem, o quê, quando, onde, cargo/contexto) | Análise textual |
| 2 | Buscar fonte primária (site oficial, DOU/DOE, perfil verificado, DataJud, tribunal) | `exa_buscar`, `dje_sp_buscar`, `datajud_buscar`, site do órgão |
| 3 | Comparar e classificar | Tabela de veredito (§12) |

**Ação por resultado:**

| Classificação | No dossiê/relatório |
|---------------|---------------------|
| **Confirmada** | Incluir como fato, citar fonte primária com URL e data |
| **Incorreta** | "Premissa do usuário não confirmada — fonte primária diverge"; mostrar divergência lado a lado; **não atribuir ao investigado** |
| **Não verificável** | "Não verificável em fontes públicas — premissa sem suporte documental"; entrar como pendência com próximo passo |

---

## 6. Schema NewsArticle / AnalysisArticle (Prompt 9.4 §11.1)

**Usar quando o relatório for análise de declaração, fact-check ou debate público.**

Campos obrigatórios além do `BlogPosting`:

| Campo | Tipo | Obrigatório? |
|-------|------|--------------|
| `@type` | `NewsArticle` ou `AnalysisArticle` | Sim |
| `about` | Thing/Person/Organization | Sim |
| `mentions` | Thing[] | Sim |
| `jobTitle` | Text | Se `about` for Person (cargo **verificado** pela §4.6) |
| `claimReviewed` | Text | Para Fact-Check (máx. 300 chars) |
| `reviewRating` | Rating | Para Fact-Check |
| `datePublished` / `dateModified` | DateTime | Sim |
| `author` / `publisher` | Organization | Sim (`Capivaradigital-MCP Gerenciamento de consultas públicas`) |
| `isPartOf` | CreativeWork | Opcional (blog irmão `BLOG_NOTICIAS`) |

---

## 7. Gatilho `{Analise a declaração}` (Prompt 9.4)

Quando o usuário invocar **exatamente** `{Analise a declaração}`, executar fluxo automático:

**Parâmetros obrigatórios:**
- `fonte` — identificação da fonte (ex.: "Twitter @usuario", "Site oficial Ministério X")
- `cargo` — cargo oficial do declarante na data (será verificado pela §4.6)
- `fala` — trecho exato (máx. 500 chars; se maior, trecho-chave + link íntegra)
- `url_original` — URL da fonte primária

**Fluxo:**
1. §4.6 (Persona Pública) para validar `cargo` e `fonte`
2. §7.2 (Anti-Desinformação) para classificar `fala` contra `url_original`
3. Montar análise seguindo **Protocolo §12 (12 blocos)**
4. Gerar relatório com schema **AnalysisArticle** (§6)
5. Se `BLOG_NOTICIAS` definida, preparar publicação no blog irmão

---

## 8. Variável `BLOG_NOTICIAS` (Prompt 9.4)

URL do blog irmão opcional para análises, notícias, fact-checks, debates.
- Se definida, `isPartOf` do schema AnalysisArticle/NewsArticle aponta para ela
- Dossiê técnico **não** vai para o blog de notícias
- Configurar via variável de ambiente ou config do agente

---

## 9. Protocolo de Análise / Fact-Check / Debate — 12 Blocos (Prompt 9.4 §22.B)

**Obrigatório** para toda análise de declaração pública, fact-check ou debate.  
**Entrega bloqueada se faltar qualquer bloco.**

| Bloco | Título | Conteúdo Obrigatório |
|-------|--------|----------------------|
| 1 | Cabeçalho & Metadados | Título, `claimReviewed`, data fala, data análise, autor, schema, `isPartOf` se `BLOG_NOTICIAS` |
| 2 | Declaração Verbatim | Trecho exato (`fala`), timestamp se vídeo/áudio, link íntegra (`url_original`) |
| 3 | Identificação do Declarante | Nome, cargo **verificado (§4.6)**, órgão, contexto da fala |
| 4 | Contexto Fático | Fatos de fundo necessários (leis, dados oficiais, decisões citadas) |
| 5 | Fontes Primárias Consultadas | URLs oficiais com data/hora de captura (site órgão, DOU/DOE, DJ, DataJud, tribunal) |
| 6 | Comparação: Declaração × Fonte Primária | Tabela lado a lado: declaração vs. fonte; marcar convergências, omissões, inversões, erros |
| 7 | Veredito Estruturado | **Verdadeiro / Parcialmente verdadeiro / Enganoso / Falso / Não verificável** + justificativa 1 frase + evidência chave |
| 8 | Tabela de Veredito Detalhada | Colunas: `Afirmação` \| `Status (V/P/E/F/NV)` \| `Fonte Primária` \| `Evidência` \| `Nota` — uma linha por afirmação testável |
| 9 | Análise de Contexto e Intenção | Omite contexto relevante? Seletividade? Objetivo retórico? (análise, não opinião) |
| 10 | Interesse Público e Impacto | Por que importa? Quem é afetado? Processo legislativo/judicial/administrativo relacionado? |
| 11 | Limitações e Pendências | O que NÃO foi possível verificar; próximo passo recomendado |
| 12 | Checklist Pré-Entrega | □ §4.6 completo □ §7.2 aplicado □ Schema AnalysisArticle válido □ Tabela veredito (bloco 8) □ Fontes primárias com URL+data □ Nenhuma opinião sem rótulo □ LGPD advisory no rodapé |

**Regras de citação (blocos 5, 6, 8):**
- Trecho exato da fonte primária (máx. 300 chars)
- Localização na fonte (página, parágrafo, timestamp, seção DOU)
- Link direto quando possível (âncora, `?search=`, timestamp)
- **NUNCA** citar agregador (Jusbrasil, Escavador, notícias) como fonte primária de prova — achados de `escavador_buscar`/`jusbrasil_buscar` entram como INDÍCIO (máscara → `cnj_desmascarar` → contra-prova em fonte oficial) com fonte + data

**Metadados específicos:**
- `analysisType`: `fact-check` | `statement-analysis` | `debate-context`
- `verifiedBy`: `Capivaradigital-MCP`
- `verificationDate`: ISO 8601
- `primarySourcesCount`: inteiro
- `claimsTested`: inteiro

---

## 10. Níveis de Confirmação e Estados de Consulta (para dossiês)

| Nível | Critério | Uso no relatório |
|-------|----------|------------------|
| **CONFIRMADO** | Documento cruzado (CPF/CNPJ) + fonte primária + data exata | Lista principal |
| **PROVÁVEL** | Máscara compatível + fingerprint único + corroboração contextual | Lista principal com badge "Provável" |
| **POSSÍVEL HOMÔNIMO** | Apenas nome, sem vínculo documental | **FORA** da lista principal; seção "Possíveis homônimos — verificar" |
| **NAO VERIFICADO** | Fonte suprimiu ou não devolveu o dado (sigilo, bloqueio, captcha, base desatualizada, rota não executada) | **NUNCA** vira "0 processos"; entra em pendências com fonte, data e próximo passo |

### 10.1 Estados por fonte (obrigatório em todo dossiê)

Toda fonte consultada recebe um estado na tabela **"Status por fonte"** (fonte | estado | data/hora | próximo passo) do relatório:

`OK-0` | `OK-ACHADO` | `BLOQUEADO` | `SUPRIMIDO` | `DESATUALIZADO` | `NAO EXECUTADA` | `FALHA`

Regras duras:

- **PROCESSOS CRIMINAIS NÃO PODEM SER SUPRIMIDOS.** Sigilo/anonimato/supressão de uma base (ex.: e-SAJ TJSP anônimo suprime partes de processos criminais) vira `SUPRIMIDO`/`NAO VERIFICADO` com bloco próprio no relatório ("cobertura criminal parcialmente oculta") — jamais "0 processos" nem "controle negativo".
- `BLOQUEADO`/`SUPRIMIDO`/`DESATUALIZADO`/`NAO EXECUTADA`/`FALHA` **proíbem** a expressão "controle negativo documentado" — usar "auditoria em curso, N pendências".
- KPI "0 processos" **só soma fontes `OK-0`** e sai sempre pareado com "partes mascaradas: sim/não" + data da consulta; com menos de 3 fontes `OK-0` independentes, o KPI vira frase na seção de pendências.
- **0 do DataJud é INDÍCIO, nunca veredito** (partes mascaradas na API pública; criminal fora do índice público).
- **CAPTCHA/anomalia = FALHA**, nunca "0 menções"; "0 menções na web" exige ao menos 2 provedores independentes em `OK-0`.
- Após qualquer `OK-0`, cadeia obrigatória de revalidação: `escavador_buscar`/`jusbrasil_buscar` (rota browser se 403) → `djen_intimacoes` → `dje_sp_buscar` → `esaj_buscar` NMPARTE em tjsp+tjal+tjce.
- Antes de fechar o dossiê, **reexecutar ao vivo** toda fonte marcada `OK-0`; se alguma mudou para `BLOQUEADO`/`SUPRIMIDO`/`DESATUALIZADO`/`FALHA`, o relatório declara "auditoria em curso", não "controle negativo".

---

## 11. Ferramentas do MCP (29 tools — v1.19.1)

Prefixo no kimi: `mcp__capivaradigital__`

**Validação & Identificação:**
- `cnj_validar`, `cnj_desmascarar`, `cpf_desmascarar`

**DataJud (API pública CNJ):**
- `datajud_processo`, `datajud_pesquisar`, `datajud_buscar`, `datajud_por_cpf`, `datajud_por_nome`, `datajud_varrer`

**Diários & Intimações:**
- `djen_intimacoes`, `dje_sp_buscar`

**e-SAJ (TJSP, TJAL, TJCE):**
- `esaj_buscar`, `esaj_tjsp_guia`

**Brasil & Empresas:**
- `brasilapi_cnpj`, `ciclo_pf_pj`

**Regras & Protocolos:**
- `regras_ler`, `guia_dossie`, `guia_relatorios`, `guia_publicacao`, `guia_instalacao`, `guia_navegacao`, `fontes_osint`

**OSINT Web & Social:**
- `exa_buscar`, `jusbrasil_buscar`, `escavador_buscar`, `social_buscar_usuario`, `telefone_consultar`

**LGPD & Atualização:**
- `termo_responsabilidade`, `mcp_atualizar`

---

## 12. Fontes com Restrição de Acesso (documentar no README.md)

| Fonte | Restrição | Como obter acesso | Onde configurar no agente |
|-------|-----------|-------------------|---------------------------|
| **Escavador** | Rota pública gratuita via HTTP com UA de navegador (tool `escavador_buscar`); paywall só na busca ilimitada/API paga | https://www.escavador.com | `escavador_buscar`; se 403, rota via browser (Playwright) |
| **CEIS/CNEP/CEPIM** (Portal da Transparência) | API key gratuita | https://portaldatransparencia.gov.br/api-de-dados | Variável `PORTAL_TRANSPARENCIA_API_KEY` |
| **Receita Federal** (comprovante CPF/CNPJ) | Captcha manual | https://www.gov.br/receitafederal/ | Playwright manual (não automatizável) |
| **TSE/TRE** | Captcha | https://www.tse.jus.br/ | Playwright manual |
| **Cartórios/ONRC** | Custos + captcha variam | https://www.onr.org.br/ | Consulta manual ou API paga do cartório |
| **Exa** | API key gratuita | https://dashboard.exa.ai | Variável `EXA_API_KEY` |
| **DataJud** | Chave pública (wiki) | Descoberta automática pelo `server.js` | Automática |
| **PJe tribunais** | Captcha / login gov.br | https://pje.jus.br/ | Playwright manual por tribunal |
| **STJ** | Turnstile Cloudflare | https://processo.stj.jus.br/ | Playwright (recarregar página resolve) |
| **TJSC eproc** | Turnstile | https://eproc.tjsc.jus.br/ | Playwright (recarregar página resolve) |

---

## 13. Regras de Operação do Servidor

1. **Pasta única:** `capivaradigital-mcp/server.js` (Node puro, zero dependências)
2. **Zero dados reais** na pasta do MCP (GitHub público) — exemplos fictícios apenas
3. **Antes de alterar server.js:** ler `capivaradigital-mcp/AGENTS.md` (como estender, testes via stdin)
4. **Documentação de apoio:** `README.md` (instalação, atalhos), `GUIA_OSINT.md` (método), `regras/master_rules.md` (este arquivo)
5. **Atualização:** `mcp_atualizar` baixa `server.js` do GitHub (canalqb/capivaradigital-mcp), backup `.bak`, substitui, sobe após restart do cliente
6. **Ponte HTTP (opcional):** `server-http.js` na raiz do projeto (FORA do MCP) — Streamable HTTP + OAuth 2.1 para claude.ai

---

## 14. Checklist de Entrega (todo relatório/dossiê)

- [ ] Template unificado (`report-template.html`) usado
- [ ] Geração por etapas (salvamento atômico, retomada, idempotência)
- [ ] KPIs do dossiê (bloco pós-TL;DR, valores só de dados confirmados)
- [ ] 13 seções cobertas (Hero, KPIs, conteúdo, tabelas, FAQ, rodapé)
- [ ] Schema JSON-LD correto (`BlogPosting` ou `AnalysisArticle`)
- [ ] Autoria: `Capivaradigital-MCP Gerenciamento de consultas públicas` (sem "canalqb" como criador)
- [ ] LGPD advisory no rodapé (apenas advertência, não bloqueante)
- [ ] Anti-homônimo aplicado (padrão negativo: homônimos fora da lista principal)
- [ ] Estados por fonte na tabela "Status por fonte" (§10.1) — BLOQUEADO/SUPRIMIDO/DESATUALIZADO/NAO EXECUTADA/FALHA nunca viram "controle negativo"
- [ ] Revalidação ao vivo das fontes OK-0 antes de fechar (§10.1)
- [ ] Ciclo PF↔PJ executado (`ciclo_pf_pj` antes de fechar)
- [ ] Persona Pública verificada (§4.6) para autoridades citadas
- [ ] Premissas do usuário verificadas (§7.2) antes de incorporar
- [ ] Se análise/fact-check: Protocolo 12 blocos (§12) + schema AnalysisArticle
- [ ] Evidências salvas (HTML/JSON bruto com data/hora)
- [ ] Cadeia de confirmação documentada
- [ ] O que foi eliminado + por quê
- [ ] Post pelo Prompt 9.4 **após 100% seções CONCLUIDA**

---

**Fim do master_rules.md v9.4** — fonte das técnicas:
`https://docs.google.com/document/d/1WGFspgXb79mpb7rDce3Kv6k665vqDFasNCVU0qWbEwI/export?format=html`