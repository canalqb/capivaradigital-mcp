const readline = require('readline');
const fs = require('fs');
const path = require('path');

const DATAJUD_BASE = 'https://api-publica.datajud.cnj.jus.br';
const DATAJUD_WIKI = 'https://datajud-wiki.cnj.jus.br/api-publica/acesso/';
const DATAJUD_KEY_FALLBACK = 'cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==';
const DJEN_BASE = 'https://comunicaapi.pje.jus.br/api/v1/comunicacao';
const BRASILAPI_CNPJ = 'https://brasilapi.com.br/api/cnpj/v1/';
const ESAJ_SEARCH = 'https://esaj.tjsp.jus.br/cpopg/search.do';
const DJE_SEARCH = 'https://esaj.tjsp.jus.br/cdje/consultaAvancada.do';
const DJE_TROCA_PG = 'https://esaj.tjsp.jus.br/cdje/trocaDePagina.do';
const DJE_PDF = 'https://esaj.tjsp.jus.br/cdje/getPaginaDoDiario.do';
const EXA_SEARCH = 'https://api.exa.ai/search';
const JUSBRASIL_BUSCA = 'https://www.jusbrasil.com.br/busca?q=';
const UPDATE_URL = 'https://raw.githubusercontent.com/canalqb/escrivao-mcp/main/server.js';
const WMN_DATA_URL = 'https://raw.githubusercontent.com/WebBreacher/WhatsMyName/main/wmn-data.json';
const BRASILAPI_DDD = 'https://brasilapi.com.br/api/ddd/v1/';

const TRIBUNAIS = {
  '401': 'api_publica_trf1', '402': 'api_publica_trf2', '403': 'api_publica_trf3',
  '404': 'api_publica_trf4', '405': 'api_publica_trf5', '406': 'api_publica_trf6',
  '501': 'api_publica_trt1', '502': 'api_publica_trt2', '503': 'api_publica_trt3',
  '504': 'api_publica_trt4', '505': 'api_publica_trt5', '506': 'api_publica_trt6',
  '507': 'api_publica_trt7', '508': 'api_publica_trt8', '509': 'api_publica_trt9',
  '510': 'api_publica_trt10', '511': 'api_publica_trt11', '512': 'api_publica_trt12',
  '513': 'api_publica_trt13', '514': 'api_publica_trt14', '515': 'api_publica_trt15',
  '516': 'api_publica_trt16', '517': 'api_publica_trt17', '518': 'api_publica_trt18',
  '519': 'api_publica_trt19', '520': 'api_publica_trt20', '521': 'api_publica_trt21',
  '522': 'api_publica_trt22', '523': 'api_publica_trt23', '524': 'api_publica_trt24',
  '801': 'api_publica_tjac', '802': 'api_publica_tjal', '803': 'api_publica_tjap',
  '804': 'api_publica_tjam', '805': 'api_publica_tjba', '806': 'api_publica_tjce',
  '807': 'api_publica_tjdft', '808': 'api_publica_tjes', '809': 'api_publica_tjgo',
  '810': 'api_publica_tjma', '811': 'api_publica_tjmt', '812': 'api_publica_tjms',
  '813': 'api_publica_tjmg', '814': 'api_publica_tjpa', '815': 'api_publica_tjpb',
  '816': 'api_publica_tjpr', '817': 'api_publica_tjpe', '818': 'api_publica_tjpi',
  '819': 'api_publica_tjrj', '820': 'api_publica_tjrn', '821': 'api_publica_tjrs',
  '822': 'api_publica_tjro', '823': 'api_publica_tjrr', '824': 'api_publica_tjsc',
  '825': 'api_publica_tjse', '826': 'api_publica_tjsp', '827': 'api_publica_tjto',
  '200': 'api_publica_stj', '500': 'api_publica_tst',
  '600': 'api_publica_tse', '700': 'api_publica_stm'
};

let cachedKey = null;

function digitsOnly(s) { return String(s == null ? '' : s).replace(/\D/g, ''); }

function pad2(n) { return String(n).padStart(2, '0'); }

function formatCnj(n20) {
  return `${n20.slice(0, 7)}-${n20.slice(7, 9)}.${n20.slice(9, 13)}.${n20.slice(13, 14)}.${n20.slice(14, 16)}.${n20.slice(16, 20)}`;
}

function computeDd(stem18) {
  const s = BigInt(stem18);
  const r = (100n * s) % 97n;
  return Number(98n - r);
}

function resolveEndpoint(tribunal) {
  if (!tribunal) throw new Error('Informe o tribunal (ex.: tjsp ou codigo CNJ como 826).');
  const t = String(tribunal).trim().toLowerCase().replace(/\s+/g, '');
  if (TRIBUNAIS[t]) return TRIBUNAIS[t];
  if (/^(tj|trf|trt|tst|stj|stf|tse|stm|tre)[a-z0-9-]{0,5}$/.test(t)) return 'api_publica_' + t;
  throw new Error(`Tribunal desconhecido: ${tribunal}. Use sigla (tjsp, tjpr, tjsc, trt15, tre-sp, trf3...) ou codigo CNJ (826, 816, 824...). Nota: STF nao possui endpoint na API publica (404).`);
}

function endpointFromNumero(n20) {
  const code = n20.slice(13, 16);
  const ep = TRIBUNAIS[code];
  if (!ep) throw new Error(`Tribunal ${code} não mapeado neste servidor (segmento ${n20[13]}).`);
  return ep;
}

async function fetchWithTimeout(url, options, ms) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms || 30000);
  try {
    const res = await fetch(url, Object.assign({}, options, { signal: ctrl.signal }));
    const text = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 400)}`);
    return text;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchRaw(url, options, ms) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms || 15000);
  try {
    const res = await fetch(url, Object.assign({ redirect: 'follow' }, options, { signal: ctrl.signal }));
    const text = await res.text();
    return { status: res.status, ok: res.ok, text };
  } finally {
    clearTimeout(timer);
  }
}

async function getDatajudKey() {
  if (cachedKey) return cachedKey;
  try {
    const html = await fetchWithTimeout(DATAJUD_WIKI, { headers: { 'User-Agent': 'Mozilla/5.0' } }, 15000);
    const flat = html.replace(/<[^>]*>/g, ' ').replace(/&/g, '&').replace(/\s+/g, ' ');
    const m = flat.match(/Authorization\s*:\s*APIKey\s+([A-Za-z0-9_+/=-]+)/i);
    if (m) { cachedKey = m[1].trim(); return cachedKey; }
  } catch (e) {
    process.stderr.write('Aviso: não foi possível ler a wiki do DataJud, usando chave fallback. ' + String(e) + '\n');
  }
  cachedKey = DATAJUD_KEY_FALLBACK;
  return cachedKey;
}

async function datajudSearch(endpoint, body) {
  let key = await getDatajudKey();
  let lastErr = null;
  for (let tentativa = 0; tentativa < 4; tentativa++) {
    try {
      const text = await fetchWithTimeout(`${DATAJUD_BASE}/${endpoint}/_search`, {
        method: 'POST',
        headers: { 'Authorization': `APIKey ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      }, 120000);
      return JSON.parse(text);
    } catch (e) {
      lastErr = e;
      // chave raspada da wiki pode vir corrompida (HTTP 401) -> troca pelo fallback
      if (/HTTP 401/.test(String(e)) && key !== DATAJUD_KEY_FALLBACK) {
        cachedKey = key = DATAJUD_KEY_FALLBACK;
        continue;
      }
      // erro de cliente deterministico (exceto 429 rate): nao adianta repetir a mesma query
      if (/HTTP 4\d\d/.test(String(e)) && !/HTTP 429/.test(String(e))) throw e;
      if (tentativa < 3) await new Promise(r => setTimeout(r, 5000));
    }
  }
  const msg = String(lastErr && lastErr.message ? lastErr.message : lastErr);
  if (/HTTP 50[234]/.test(msg)) throw new Error(`${msg} - gateway do tribunal lento/sobrecarregado (TRANSIENTE): aguarde e repita; para o TJSP as rotas alternativas sao esaj_buscar (DOCPARTE/NMPARTE) e dje_sp_buscar (base integral do diario).`);
  if (/HTTP 429/.test(msg)) throw new Error(`${msg} - limite de requisicoes (429): aguarde alguns minutos antes de nova consulta.`);
  if (/HTTP 403/.test(msg)) throw new Error(`${msg} - bloqueio de acesso (403): tente mais tarde ou a consulta publica do tribunal (rotas em guia_navegacao/fontes_osint).`);
  throw lastErr;
}

function normName(v) {
  if (v == null) return '';
  if (typeof v === 'object') return v.nome || v.name || JSON.stringify(v);
  return String(v);
}

function lastMovDate(p) {
  const movs = Array.isArray(p.movimentos) ? p.movimentos : [];
  if (p.dataUltimaMovimentacao) return p.dataUltimaMovimentacao;
  if (movs.length) {
    const ult = movs[movs.length - 1];
    return ult && (ult.dataHora || ult.data);
  }
  return '';
}

function fmtData(d) {
  const s = String(d || '');
  const m = s.match(/^(\d{4})(\d{2})(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return s.slice(0, 10);
}

function summarizeProcess(p, incluirJson) {
  const assuntos = Array.isArray(p.assunto) ? p.assunto.map(a => normName(a)).filter(Boolean).join('; ') : normName(p.assunto);
  const movs = Array.isArray(p.movimentos) ? p.movimentos : [];
  const ultimos = movs.slice(-8).map(m => `- ${m.dataHora || ''} ${m.nome || ''}`.trim()).join('\n');
  let out = `Numero: ${formatCnj(String(p.numeroProcesso || ''))}\n`;
  out += `Tribunal: ${p.tribunal || ''}\n`;
  out += `Classe: ${normName(p.classe)}\n`;
  out += `Assunto(s): ${assuntos}\n`;
  out += `Orgao julgador: ${normName(p.orgaoJulgador)}\n`;
  out += `Grau: ${p.grau || p['@grau'] || ''} | Sistema: ${normName(p.sistema)} | Formato: ${normName(p.formato)} | Nivel de sigilo: ${p.nivelSigilo != null ? p.nivelSigilo : 'n/d'}\n`;
  out += `Ajuizado: ${fmtData(p.dataAjuizamento)} | Ultima atualizacao (DataJud): ${String(p.dataHoraUltimaAtualizacao || '').slice(0, 10)}\n`;
  out += `Ultima movimentacao: ${lastMovDate(p)}\n`;
  const partesLinhas = partesToLines(p);
  if (partesLinhas.length) out += `Partes:\n${partesLinhas.slice(0, 14).join('\n')}\n`;
  else out += `Partes: NAO indexadas neste tribunal (a API publica omite em varios casos) - use fingerprint orgao+classe+assunto+datas.\n`;
  if (ultimos) out += `Movimentos recentes:\n${ultimos}\n`;
  if (incluirJson) out += `\nJSON _source:\n${JSON.stringify(p).slice(0, 12000)}`;
  return out;
}

function hitsToArray(dados) {
  return (dados && dados.hits && Array.isArray(dados.hits.hits)) ? dados.hits.hits : [];
}

function avisoAncora(consulta) {
  const n = digitsOnly(consulta);
  if (n.length === 20) return 'Busca por NUMERO de processo (ancora unica) - sem risco de homonimo.';
  if (n.length === 11 || n.length === 14) return 'DOCUMENTO (CPF/CNPJ) como ancora: correto pela regra do servidor. Ciclo PF<->PJ completo em uma chamada: ciclo_pf_pj. Cruze com as demais fontes antes de marcar CONFIRMADO.';
  return 'HOMONIMO: achado por nome so vale com o CPF/CNPJ do pesquisado cruzando (ciclo_pf_pj, datajud_por_cpf, esaj_buscar DOCPARTE); sem documento = POSSIVEL HOMONIMO, PROIBIDO apresenta-lo como sendo do pesquisado. Protocolo completo: fontes_osint.';
}

function cpfDvs(base9) {
  let s = 0;
  for (let i = 0; i < 9; i++) s += Number(base9[i]) * (10 - i);
  const d1 = (s % 11) < 2 ? 0 : 11 - (s % 11);
  const dez = base9 + String(d1);
  let s2 = 0;
  for (let i = 0; i < 10; i++) s2 += Number(dez[i]) * (11 - i);
  const d2 = (s2 % 11) < 2 ? 0 : 11 - (s2 % 11);
  return String(d1) + String(d2);
}

function formatCpf(c) {
  return `${c.slice(0, 3)}.${c.slice(3, 6)}.${c.slice(6, 9)}-${c.slice(9)}`;
}

function nomesDePartes(src) {
  try {
    const partes = src && src.partes;
    if (!Array.isArray(partes)) return [];
    const out = [];
    for (const p of partes) {
      const pessoas = p && Array.isArray(p.pessoa) ? p.pessoa : (p && p.pessoa ? [p.pessoa] : []);
      for (const pes of pessoas) {
        if (pes && pes.nome) out.push(`${normName(pes.nome)} (${p && p.tipo ? p.tipo : 'parte'})`);
      }
    }
    return out;
  } catch (e) { return []; }
}

function partesToLines(src) {
  try {
    const partes = src && src.partes;
    if (!Array.isArray(partes)) return [];
    const out = [];
    const push = (nome, polo, doc, advogados) => {
      if (!nome) return;
      let l = `- ${normName(nome)} [${String(polo || 'PARTE').toUpperCase()}]`;
      if (doc) l += ` | doc: ${doc}`;
      out.push(l);
      if (Array.isArray(advogados)) {
        for (const ad of advogados) {
          if (ad && (ad.nome || ad.nomeAdvogado)) {
            const nm = normName(ad.nome || ad.nomeAdvogado);
            const oab = ad.oabAdvogado || ad.oab || ad.inscricao || '';
            out.push(`    advogado: ${nm}${oab ? ' | OAB: ' + oab : ''}`);
          }
        }
      }
    };
    for (const p of partes) {
      if (!p) continue;
      if (p.nome) {
        push(p.nome, p.polo || p.tipo, p.documento, p.advogados);
      } else if (Array.isArray(p.pessoa)) {
        for (const pes of p.pessoa) push(pes && pes.nome, p.polo || p.tipo, pes && (pes.documentoReplicado || pes.documento), pes && pes.advogados);
      } else if (p.pessoa) {
        push(p.pessoa.nome, p.polo || p.tipo, p.pessoa.documentoReplicado || p.pessoa.documento, p.pessoa.advogados);
      }
    }
    return out;
  } catch (e) { return []; }
}

function parseMask(mascara) {
  const t = String(mascara || '').trim().toUpperCase().replace(/\s+/g, '');
  const re = /^([0-9X]{7})-?([0-9X]{2})\.?([0-9X]{4})\.?([0-9X])\.?([0-9X]{2})\.?([0-9X]{4})$/;
  const m = t.match(re);
  if (!m) throw new Error(`Mascara invalida: "${mascara}". Use NNNNNNN-DD.AAAA.J.TR.OOOO com X nos digitos desconhecidos (ex.: 000XXXX-XX.2024.8.26.0100).`);
  const [ , nnnnnnn, dd, aaaa, j, tr, oooo ] = m;
  if (/X/.test(aaaa) || /X/.test(j) || /X/.test(tr) || /X/.test(oooo)) {
    throw new Error('X so e suportado nos 7 digitos iniciais e no digito verificador (DD). Ano, segmento, tribunal e foro devem ser conhecidos.');
  }
  const stemFixed = nnnnnnn.replace(/X/g, '?') + aaaa + j + tr + oooo;
  const ddKnown = /X/.test(dd) ? null : dd;
  const xCount = (stemFixed.match(/\?/g) || []).length;
  if (xCount > 6) throw new Error('Limite de 6 digitos desconhecidos (X) por mascara.');
  return { stemFixed, ddKnown, xCount };
}

function maskCandidates(mask, limite) {
  const { stemFixed, ddKnown, xCount } = parseMask(mask);
  const limit = Math.min(Number(limite) || 200, 2000);
  const positions = [];
  for (let i = 0; i < stemFixed.length; i++) if (stemFixed[i] === '?') positions.push(i);
  const total = Math.pow(10, xCount);
  const out = [];
  for (let v = 0; v < total && out.length < limit; v++) {
    const arr = stemFixed.split('');
    let x = v;
    for (let pi = positions.length - 1; pi >= 0; pi--) {
      arr[positions[pi]] = String(x % 10);
      x = Math.floor(x / 10);
    }
    const stem = arr.join('');
    const dd = pad2(computeDd(stem));
    if (ddKnown && dd !== ddKnown) continue;
    out.push({ stem, dd, numero: stem.slice(0, 7) + dd + stem.slice(7) });
  }
  return out;
}

function validateCnj(numero) {
  const n = digitsOnly(numero);
  if (n.length !== 20) throw new Error(`Numero CNJ deve ter 20 digitos (recebi ${n.length}).`);
  const stem = n.slice(0, 7) + n.slice(9);
  const dd = n.slice(7, 9);
  const esperado = pad2(computeDd(stem));
  const codigo = n.slice(13, 16);
  return {
    raw: n,
    numero: formatCnj(n),
    valido: dd === esperado,
    dv_informado: dd,
    dv_esperado: esperado,
    tribunal_codigo: codigo,
    tribunal_endpoint: TRIBUNAIS[codigo] || null
  };
}

async function toolCnjValidar(a) {
  const r = validateCnj(a.numero);
  let out = `Numero: ${r.numero}\nDV informado: ${r.dv_informado} | DV esperado: ${r.dv_esperado}\n`;
  out += r.valido ? 'VALIDO segundo a Resolucao CNJ 65/2008 (MOD 97-10).\n' : 'INVALIDO segundo a Resolucao CNJ 65/2008.\n';
  out += `Tribunal (codigo J+TR): ${r.tribunal_codigo} -> ${r.tribunal_endpoint || 'nao mapeado'}\n`;
  if (!r.valido) out += `Numero corrigido com DV valido: ${formatCnj(r.raw.slice(0, 7) + r.dv_esperado + r.raw.slice(9))}\n`;
  return out;
}

async function toolCnjDesmascarar(a) {
  const cands = maskCandidates(a.mascara, a.limite || 200);
  const doc = a.cpf ? digitsOnly(a.cpf) : '';
  if (doc && doc.length !== 11 && doc.length !== 14) throw new Error('cpf deve ter 11 digitos (CPF) ou 14 (CNPJ).');
  const nome = String(a.nome || '').trim();
  const cruzar = Boolean(doc) || Boolean(nome);
  const consultar = a.consultar_datajud === true || cruzar;
  let out = `Mascara: ${a.mascara}\nCandidatos com DV valido: ${cands.length}\n`;
  if (cruzar) {
    out += doc
      ? `Loop de cruzamento ATIVO por documento (${doc.length === 11 ? 'CPF' : 'CNPJ'}).\n`
      : `Loop de cruzamento ATIVO por nome ("${nome}") - nome e ancora fraca: prefira o documento.\n`;
  }
  if (!consultar) {
    out += cands.map(c => formatCnj(c.numero)).join('\n');
    out += '\n\nDica: passe consultar_datajud=true (ou cpf/nome para cruzar) para verificar quais existem no DataJud.';
    return out;
  }
  const nums = cands.map(c => c.numero);
  const endpoint = endpointFromNumero(nums[0]);
  const chunks = [];
  for (let i = 0; i < nums.length; i += 200) chunks.push(nums.slice(i, i + 200));
  const encontrados = [];
  const vistos = new Set();
  for (const chunk of chunks) {
    const dados = await datajudSearch(endpoint, { query: { terms: { numeroProcesso: chunk } }, size: chunk.length + 10 });
    for (const h of hitsToArray(dados)) {
      const p = h._source || {};
      const n20 = String(p.numeroProcesso || '');
      if (!n20 || vistos.has(n20)) continue;
      vistos.add(n20);
      encontrados.push(p);
    }
  }
  const ancorados = new Set();
  let ancoraDescricao = '';
  let totalAncora = 0;
  if (cruzar) {
    const querys = [];
    if (doc) {
      const fmt = doc.length === 11
        ? `${doc.slice(0, 3)}.${doc.slice(3, 6)}.${doc.slice(6, 9)}-${doc.slice(9)}`
        : `${doc.slice(0, 2)}.${doc.slice(2, 5)}.${doc.slice(5, 8)}/${doc.slice(8, 12)}-${doc.slice(12)}`;
      querys.push({ label: `documento "${fmt}"`, q: `"${fmt}"` });
    }
    if (nome) querys.push({ label: `nome "${nome}"`, q: `"${nome}"` });
    for (const qs of querys) {
      const d = await datajudSearch(endpoint, { query: { query_string: { query: qs.q } }, size: 100 });
      const hitsA = hitsToArray(d);
      totalAncora += hitsA.length;
      hitsA.forEach(h => ancorados.add(String((h._source || {}).numeroProcesso || '')));
      ancoraDescricao += (ancoraDescricao ? ' + ' : '') + qs.label;
    }
  }
  out += `\nExistentes no DataJud (${endpoint}): ${encontrados.length}\n`;
  if (encontrados.length) {
    const linhas = encontrados.map(p => {
      const assuntos = Array.isArray(p.assunto) ? p.assunto.map(x => normName(x)).filter(Boolean).join('; ') : normName(p.assunto);
      const base = `${formatCnj(String(p.numeroProcesso))} | ${p.tribunal || ''} | classe: ${normName(p.classe)} | assuntos: ${assuntos} | orgao: ${normName(p.orgaoJulgador)} | ultima mov.: ${lastMovDate(p)}`;
      if (!cruzar) return base;
      return (ancorados.has(String(p.numeroProcesso)) ? '[VINCULO CONFIRMADO] ' : '[SEM ancora no pesquisado - possivel homonimo/outra pessoa] ') + base;
    });
    out += linhas.join('\n');
  } else {
    out += 'Nenhum dos candidatos existe no tribunal consultado.';
  }
  if (cruzar) {
    const nVinc = encontrados.filter(p => ancorados.has(String(p.numeroProcesso || ''))).length;
    out += `\n\nResumo do loop: ${encontrados.length} candidato(s) existem; ${nVinc} com vinculo (${ancoraDescricao}); a busca pela ancora localizou ${totalAncora} processo(s) do pesquisado no tribunal.`;
    out += '\nRegra: sem documento (CPF/CNPJ) batendo, no maximo PROVAVEL por fingerprint - nunca CONFIRMADO.';
  } else {
    out += '\n\nProximo passo: fingerprint dos existentes (orgao+classe+assunto+datas) contra os metadados da fonte que mascarou - ou passe cpf/nome para o loop confirmar o vinculo.';
  }
  return out;
}

async function toolDatajudProcesso(a) {
  const n = digitsOnly(a.numero);
  if (n.length !== 20) throw new Error('Numero CNJ deve ter 20 digitos.');
  const endpoint = a.tribunal ? resolveEndpoint(a.tribunal) : endpointFromNumero(n);
  const dados = await datajudSearch(endpoint, { query: { match: { numeroProcesso: n } }, size: 5 });
  const hits = hitsToArray(dados);
  if (!hits.length) return `Nenhum processo encontrado no ${endpoint} para ${formatCnj(n)}.\nNota: a API publica omite as PARTES em varios tribunais; quando o tribunal as indexa, elas sao exibidas abaixo. Sem partes, use classe/orgao/datas para fingerprint.`;
  return hits.map(h => summarizeProcess(h._source || {}, a.incluir_json)).join('\n' + '='.repeat(50) + '\n');
}

async function toolDatajudPesquisar(a) {
  const endpoint = resolveEndpoint(a.tribunal);
  const must = [];
  if (a.numeros) {
    const nums = Array.isArray(a.numeros) ? a.numeros : String(a.numeros).split(/[,;\s]+/);
    const clean = nums.map(digitsOnly).filter(x => x.length === 20);
    if (!clean.length) throw new Error('numeros deve conter numeros CNJ de 20 digitos (separados por virgula).');
    must.push({ terms: { numeroProcesso: clean } });
  }
  if (a.classe) must.push({ match: { 'classe.nome': a.classe } });
  if (a.classe_codigo) must.push({ match: { 'classe.codigo': Number(a.classe_codigo) } });
  if (a.assunto) must.push({ match: { 'assunto.nome': a.assunto } });
  if (a.assunto_codigo) must.push({ match: { 'assunto.codigo': Number(a.assunto_codigo) } });
  if (a.orgao) must.push({ match: { 'orgaoJulgador.nome': a.orgao } });
  if (a.orgao_codigo) must.push({ match: { 'orgaoJulgador.codigo': Number(a.orgao_codigo) } });
  if (a.grau) must.push({ match: { grau: String(a.grau).trim().toUpperCase() } });
  if (a.data_inicio || a.data_fim) {
    const r = {};
    const di = String(a.data_inicio || '').trim();
    const df = String(a.data_fim || '').trim();
    if (di) r.gte = /^\d{4}-\d{2}-\d{2}$/.test(di) ? di + '||/d' : di;
    if (df) r.lte = /^\d{4}-\d{2}-\d{2}$/.test(df) ? df + '||/d' : df;
    must.push({ range: { dataAjuizamento: r } });
  }
  if (!must.length) throw new Error('Informe ao menos um filtro: numeros, classe, classe_codigo, assunto, assunto_codigo, orgao, orgao_codigo, grau, data_inicio ou data_fim (datas de AJUIZAMENTO, formato AAAA-MM-DD).');
  const size = Math.min(Number(a.tamanho) || 20, 1000);
  const body = { size, query: must.length === 1 ? must[0] : { bool: { must } } };
  const ordenar = String(a.ordenar || '').trim().toLowerCase();
  if (a.apartir_de != null && a.apartir_de !== '') {
    body.sort = [{ '@timestamp': { order: 'asc' } }];
    body.search_after = [Number(a.apartir_de)];
  } else if (ordenar === 'ajuizamento_desc') {
    body.sort = [{ dataAjuizamento: { order: 'desc' } }];
  } else if (ordenar === 'ajuizamento_asc') {
    body.sort = [{ dataAjuizamento: { order: 'asc' } }];
  } else if (ordenar === 'atualizacao') {
    body.sort = [{ '@timestamp': { order: 'asc' } }];
  } else {
    body.from = ((Number(a.pagina) || 1) - 1) * size;
  }
  const dados = await datajudSearch(endpoint, body);
  const hits = hitsToArray(dados);
  const tot = dados.hits && dados.hits.total ? dados.hits.total : null;
  const total = tot && tot.value != null ? tot.value : (tot || hits.length);
  const rel = tot && tot.relation === 'gte' ? ' (total pode passar de 10.000 - janela maxima; pagine com ordenar=atualizacao + apartir_de)' : '';
  let out = `Tribunal: ${endpoint} | Total de hits: ${total}${rel} | Exibindo: ${hits.length}\n`;
  out += hits.map(h => {
    const p = h._source || {};
    const assuntos = Array.isArray(p.assunto) ? p.assunto.map(x => normName(x)).filter(Boolean).join('; ') : normName(p.assunto);
    return `${formatCnj(String(p.numeroProcesso || ''))} | classe: ${normName(p.classe)} | assuntos: ${assuntos} | orgao: ${normName(p.orgaoJulgador)} | ultima mov.: ${lastMovDate(p)}`;
  }).join('\n');
  const last = hits[hits.length - 1];
  if (last && Array.isArray(last.sort) && last.sort.length) out += `\nProxima pagina: repita com apartir_de=${last.sort[0]}`;
  return out || 'Nenhum resultado.';
}

async function toolDjenIntimacoes(a) {
  if (!a.nome_parte) throw new Error('Informe nome_parte (nome da parte no DJEN).');
  const params = new URLSearchParams();
  params.set('nomeParte', String(a.nome_parte));
  params.set('itensPorPagina', String(Math.min(Number(a.itens_por_pagina) || 30, 100)));
  params.set('pagina', String(Math.max(Number(a.pagina) || 1, 1)));
  const text = await fetchWithTimeout(`${DJEN_BASE}?${params.toString()}`, { headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' } }, 45000);
  const dados = JSON.parse(text);
  const items = Array.isArray(dados.items) ? dados.items : [];
  if (!items.length) return `Nenhuma intimacao encontrada para "${a.nome_parte}" (count: ${dados.count != null ? dados.count : 0}).\n\n${avisoAncora(a.nome_parte)}`;
  const maxTexto = Number(a.max_texto) || 600;
  const incluir = a.incluir_texto !== false;
  let out = `Intimacoes encontradas: ${items.length} (pagina ${a.pagina || 1})\n\n`;
  out += items.map(it => {
    let b = `[id ${it.id}] ${it.data_disponibilizacao || ''} | ${it.siglaTribunal || ''} | ${it.nomeOrgao || ''} | classe: ${it.nomeClasse || ''} | processo: ${it.numeroprocessocommascara || it.numero_processo || ''} | tipo: ${it.tipoComunicacao || ''}\n`;
    if (incluir && it.texto) b += `  Texto: ${String(it.texto).replace(/\s+/g, ' ').slice(0, maxTexto)}${String(it.texto).length > maxTexto ? ' [...]' : ''}\n`;
    return b;
  }).join('\n');
  out += '\nDica: os textos integrais das intimacoes frequentemente citam numeros de processos correlatos - mina de ouro para desmascarar.';
  out += `\n\n${avisoAncora(a.nome_parte)}`;
  return out;
}

async function toolBrasilapiCnpj(a) {
  const c = digitsOnly(a.cnpj);
  if (c.length !== 14) throw new Error('CNPJ deve ter 14 digitos.');
  const text = await fetchWithTimeout(`${BRASILAPI_CNPJ}${c}`, { headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' } }, 30000);
  const d = JSON.parse(text);
  const qsa = (d.qsa || []).map(q => `- ${q.nome_socio || ''} | ${q.qualificacao_socio || ''} | doc: ${q.cnpj_cpf_do_socio || ''} | ${q.faixa_etaria || ''} | desde ${q.data_entrada_sociedade || ''}`);
  let out = `CNPJ: ${d.cnpj || ''}\nRazao social: ${d.razao_social || ''}\nNome fantasia: ${d.nome_fantasia || ''}\n`;
  out += `Situacao: ${d.descricao_situacao_cadastral || ''} (desde ${d.data_situacao_cadastral || ''})\n`;
  out += `Abertura: ${d.data_inicio_atividade || ''}\nAtividade (CNAE): ${d.cnae_fiscal_descricao || ''}\n`;
  out += `Endereco: ${d.logradouro || ''}, ${d.numero || ''} - ${d.bairro || ''}, ${d.municipio || ''}/${d.uf || ''} - CEP ${d.cep || ''}\n`;
  out += `Capital social: ${d.capital_social || ''}\n`;
  if (qsa.length) out += `Socios (QSA):\n${qsa.join('\n')}\n`;
  out += '\nCICLO OBRIGATORIO PF<->PJ: com CPF do pesquisado, procure os CNPJs vinculados a ele (razao social costuma embutir o CPF do titular); com CNPJ do pesquisado, extraia os CPFs do QSA (mascarados, com faixa etaria) e procure os processos dessas pessoas (datajud_por_cpf). CPF mascarado com digitos visiveis pode ser quebrado por combinacao (ferramenta cpf_desmascarar - loop + DV modulo 11 + verificacao em lote no DataJud); sem digitos suficientes, mascara + faixa etaria + nome servem apenas como fingerprint (PROVAVEL, nunca CONFIRMADO). PROIBICAO anti-homonimo: sem documento cruzado, nao atribua o achado ao pesquisado.';
  return out;
}

function fmtResumo(p) {
  const num = String(p.numeroProcesso || '');
  return `${num.length === 20 ? formatCnj(num) : num} | classe: ${normName(p.classe)} | orgao: ${normName(p.orgaoJulgador)} | ajuizado: ${fmtData(p.dataAjuizamento)}`;
}

async function toolDatajudBuscar(a) {
  const endpoint = resolveEndpoint(a.tribunal);
  const consulta = String(a.consulta || '').trim();
  if (!consulta) throw new Error('Informe a consulta: texto livre, nome exato entre aspas duplas, CPF formatado entre aspas ou numero de processo.');
  const tamanho = Math.min(Number(a.tamanho) || 10, 100);
  const n = digitsOnly(consulta);
  const corpo = (n.length === 20 && !/X/i.test(consulta))
    ? { query: { match: { numeroProcesso: n } }, size: tamanho }
    : { query: { query_string: { query: consulta } }, size: tamanho, sort: [{ dataAjuizamento: { order: 'desc' } }] };
  const dados = await datajudSearch(endpoint, corpo);
  const hits = hitsToArray(dados);
  const total = (dados.hits && dados.hits.total && (dados.hits.total.value != null ? dados.hits.total.value : dados.hits.total)) || hits.length;
  let out = `DataJud ${endpoint}: ${total} resultado(s)\n`;
  out += hits.map(h => {
    const p = h._source || {};
    const pt = partesToLines(p);
    let l = fmtResumo(p);
    if (pt.length) l += '\n  partes: ' + pt.join(' | ').slice(0, 400);
    return l;
  }).join('\n');
  if (!hits.length) out += 'Nenhum resultado. Dicas: nome exato entre aspas duplas ("NOME COMPLETO"), CPF formatado entre aspas ("000.000.000-00") ou numero CNJ de 20 digitos.';
  out += `\n\n${avisoAncora(consulta)}`;
  return out;
}

async function toolDatajudPorCpf(a) {
  const endpoint = resolveEndpoint(a.tribunal);
  const doc = digitsOnly(a.cpf);
  if (doc.length !== 11 && doc.length !== 14) throw new Error('Informe CPF (11 digitos) ou CNPJ (14), com ou sem pontuacao.');
  const tamanho = Math.min(Number(a.tamanho) || 10, 100);
  const fmt = doc.length === 11
    ? `${doc.slice(0, 3)}.${doc.slice(3, 6)}.${doc.slice(6, 9)}-${doc.slice(9)}`
    : `${doc.slice(0, 2)}.${doc.slice(2, 5)}.${doc.slice(5, 8)}/${doc.slice(8, 12)}-${doc.slice(12)}`;
  const dados = await datajudSearch(endpoint, {
    size: tamanho,
    query: {
      bool: {
        should: [
          { match: { 'partes.documento': doc } },
          { match: { 'partes.pessoa.documentoReplicado': doc } },
          { match_phrase: { 'partes.documento': fmt } },
          { match_phrase: { 'partes.pessoa.documentoReplicado': fmt } }
        ],
        minimum_should_match: 1
      }
    }
  });
  const hits = hitsToArray(dados);
  if (!hits.length) {
    return `0 processos por documento ${doc} em ${endpoint}. ATENCAO: 0 NAO significa que o pesquisado nao tem processos - a API publica mascara o documento da parte em varios tribunais (a busca ja tenta as DUAS grafias, com e sem pontuacao, nos campos partes.documento e documentoReplicado); resultado negativo e INDICIO, nao prova. Tente datajud_buscar com "${fmt}" (formatado e entre aspas duplas), datajud_varrer em varios tribunais ou a consulta publica do tribunal de origem.\n\n${avisoAncora(doc)}`;
  }
  let out = `DataJud ${endpoint} por documento ${doc}: ${hits.length} processo(s)\n`;
  out += hits.map(h => {
    const p = h._source || {};
    const pt = partesToLines(p);
    let l = fmtResumo(p);
    if (pt.length) l += '\n  partes: ' + pt.join(' | ').slice(0, 400);
    return l;
  }).join('\n');
  out += `\n\n${avisoAncora(doc)}`;
  return out;
}

async function toolDatajudPorNome(a) {
  const endpoint = resolveEndpoint(a.tribunal);
  const nome = String(a.nome || '').trim();
  if (!nome) throw new Error('Informe o nome da parte (idealmente o nome COMPLETO exato, como consta nos autos).');
  let polo = String(a.polo || '').trim().toUpperCase();
  if (polo === 'ATIVA') polo = 'ATIVO';
  if (polo === 'PASSIVA') polo = 'PASSIVO';
  if (polo && polo !== 'ATIVO' && polo !== 'PASSIVO') throw new Error('polo deve ser ATIVO ou PASSIVO.');
  const tamanho = Math.min(Number(a.tamanho) || 20, 100);
  const must = [{
    bool: {
      should: [
        { match_phrase: { 'partes.nome': nome } },
        { match_phrase: { 'partes.pessoa.nome': nome } }
      ],
      minimum_should_match: 1
    }
  }];
  if (polo) {
    must.push({
      bool: {
        should: [
          { match: { 'partes.polo': polo } },
          { match: { 'partes.tipo': polo === 'ATIVO' ? 'Autor' : 'Reu' } }
        ],
        minimum_should_match: 1
      }
    });
  }
  const dados = await datajudSearch(endpoint, {
    size: tamanho,
    query: { bool: { must } },
    sort: [{ dataAjuizamento: { order: 'desc' } }]
  });
  const hits = hitsToArray(dados);
  const tot = dados.hits && dados.hits.total ? dados.hits.total : null;
  const total = tot && tot.value != null ? tot.value : (tot || hits.length);
  let out = `DataJud ${endpoint} por nome${polo ? ', polo ' + polo : ''}: ${total} resultado(s)\n`;
  out += hits.map(h => {
    const p = h._source || {};
    const pt = partesToLines(p);
    let l = fmtResumo(p);
    if (pt.length) l += '\n  partes: ' + pt.slice(0, 6).join(' | ').slice(0, 300);
    return l;
  }).join('\n');
  if (!hits.length) out += 'Nenhum resultado. A API publica omite/mascara as partes em varios tribunais - nesse caso use datajud_buscar com "NOME COMPLETO" entre aspas (query_string varre o texto integral dos autos) ou a consulta publica do tribunal (e-SAJ NMPARTE).';
  out += `\n\n${avisoAncora(nome)}`;
  return out;
}

const TRIBUNAIS_VARREDURA_PADRAO = ['tjsp', 'tjpr', 'tjsc', 'tjba', 'tjpi', 'tjmg', 'tjrs', 'tjrj', 'trt2', 'trt9', 'trt15'];

const ESCOPOS_VARREDURA = {
  tj: ['tjac', 'tjal', 'tjam', 'tjap', 'tjba', 'tjce', 'tjdf', 'tjes', 'tjgo', 'tjma', 'tjmg', 'tjms', 'tjmt', 'tjpa', 'tjpb', 'tjpe', 'tjpi', 'tjpr', 'tjrj', 'tjrn', 'tjro', 'tjrr', 'tjrs', 'tjsc', 'tjse', 'tjsp', 'tjto'],
  trf: ['trf1', 'trf2', 'trf3', 'trf4', 'trf5', 'trf6'],
  trt: ['trt1', 'trt2', 'trt3', 'trt4', 'trt5', 'trt6', 'trt7', 'trt8', 'trt9', 'trt10', 'trt11', 'trt12', 'trt13', 'trt14', 'trt15', 'trt16', 'trt17', 'trt18', 'trt19', 'trt20', 'trt21', 'trt22', 'trt23', 'trt24'],
  tre: ['tre-ac', 'tre-al', 'tre-am', 'tre-ap', 'tre-ba', 'tre-ce', 'tre-df', 'tre-es', 'tre-go', 'tre-ma', 'tre-mg', 'tre-ms', 'tre-mt', 'tre-pa', 'tre-pb', 'tre-pe', 'tre-pi', 'tre-pr', 'tre-rj', 'tre-rn', 'tre-ro', 'tre-rr', 'tre-rs', 'tre-sc', 'tre-se', 'tre-sp', 'tre-to'],
  superiores: ['stj', 'tst', 'tse', 'stm'],
  militares: ['tjmmg', 'tjmrs', 'tjmsp']
};

const TODOS_TRIBUNAIS = [].concat(
  ESCOPOS_VARREDURA.tj, ESCOPOS_VARREDURA.trf, ESCOPOS_VARREDURA.trt,
  ESCOPOS_VARREDURA.tre, ESCOPOS_VARREDURA.superiores, ESCOPOS_VARREDURA.militares
);

async function toolDatajudVarrer(a) {
  const consulta = String(a.consulta || '').trim();
  if (!consulta) throw new Error('Informe a consulta: nome exato entre aspas duplas ("NOME COMPLETO"), CPF formatado entre aspas ("000.000.000-00") ou numero CNJ de 20 digitos.');
  let alvos;
  if (a.escopo) {
    const esc = String(a.escopo).trim().toLowerCase();
    const grupo = ESCOPOS_VARREDURA[esc];
    if (!grupo) throw new Error(`escopo invalido: "${a.escopo}". Use tj, trf, trt, tre, superiores, militares ou todos.`);
    alvos = esc === 'todos' ? TODOS_TRIBUNAIS.slice() : grupo.slice();
  } else if (a.tribunais) {
    alvos = String(a.tribunais).split(/[,;\s]+/).map(s => s.trim().toLowerCase()).filter(Boolean);
  } else if (a.todos_tribunais) {
    alvos = TODOS_TRIBUNAIS.slice();
  } else {
    alvos = TRIBUNAIS_VARREDURA_PADRAO;
  }
  const tamanho = Math.min(Number(a.tamanho) || 10, 100);
  const n = digitsOnly(consulta);
  const corpo = (n.length === 20 && !/X/i.test(consulta))
    ? { query: { match: { numeroProcesso: n } }, size: 1 }
    : { query: { query_string: { query: consulta } }, size: tamanho };
  const linhas = new Array(alvos.length);
  let ok = 0, falhas = 0, idx = 0;
  const worker = async () => {
    while (idx < alvos.length) {
      const i = idx++;
      const t = alvos[i];
      let endpoint;
      try { endpoint = resolveEndpoint(t); } catch (e) { falhas++; linhas[i] = `[${t}] TRIBUNAL DESCONHECIDO`; continue; }
      try {
        const dados = await datajudSearch(endpoint, corpo);
        const hits = hitsToArray(dados);
        const total = (dados.hits && dados.hits.total && (dados.hits.total.value != null ? dados.hits.total.value : dados.hits.total)) || 0;
        ok++;
        if (hits.length) {
          linhas[i] = `[${t}] ${total} resultado(s):\n` + hits.map(h => '  ' + fmtResumo(h._source || {})).join('\n');
        } else {
          linhas[i] = `[${t}] 0`;
        }
      } catch (e) {
        falhas++;
        linhas[i] = `[${t}] ERRO: ${String(e && e.message ? e.message : e).slice(0, 120)}`;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(5, alvos.length) }, () => worker()));
  let out = `Varredura "${consulta}" em ${alvos.length} tribunal(is): ${ok} consultados, ${falhas} falha(s) (paralela, 5 por vez)\n\n`;
  out += linhas.filter(Boolean).join('\n');
  out += '\n\nDicas: CPF/CNPJ formatado entre aspas ("000.000.000-00") e o modo mais preciso - nome, mesmo exato e entre aspas, produz homonimos (PROIBIDO na lista principal). Para documento da parte use datajud_por_cpf por tribunal. Escopos prontos: escopo=tj, trf, trt, tre, superiores, militares ou todos (STF nao existe na API publica).';
  out += `\n\n${avisoAncora(consulta)}`;
  return out;
}

async function toolCpfDesmascarar(a) {
  let t = String(a.mascara || '').trim().toUpperCase().replace(/\s+/g, '');
  if (/^[0-9]{6}$/.test(t)) t = '***' + t + 'XX';
  const re = /^([0-9X*]{3})\.?([0-9X*]{3})\.?([0-9X*]{3})(?:-?([0-9X*]{2}))?$/;
  const m = t.match(re);
  if (!m) throw new Error(`Mascara invalida: "${a.mascara}". Use NNN.NNN.NNN-DD com X ou * nos desconhecidos (ex.: ***.123.456-**, 111.444.777-**) OU o bloco de 6 digitos antes do DV (ex.: 123456 -> ***.123.456-**).`);
  const base9 = m[1] + m[2] + m[3];
  const desconhecidos = [];
  [...base9].forEach((c, i) => { if (!/[0-9]/.test(c)) desconhecidos.push(i); });
  if (desconhecidos.length > 3) throw new Error(`Mascara com ${desconhecidos.length} digitos desconhecidos na base de 9 - maximo sao 3 (ate 1000 candidatos).`);
  const total = Math.pow(10, desconhecidos.length);
  const cands = [];
  for (let n = 0; n < total; n++) {
    const s = String(n).padStart(desconhecidos.length, '0');
    const b = base9.split('');
    desconhecidos.forEach((pos, k) => { b[pos] = s[k]; });
    const bb = b.join('');
    cands.push(bb + cpfDvs(bb));
  }
  const consultar = a.consultar_datajud !== false;
  if (!consultar) {
    const n = Math.min(cands.length, 100);
    const lista = cands.slice(0, n).map(formatCpf).join('\n');
    return `Mascara "${a.mascara}": ${cands.length} CPF(s) com DV correto gerado(s) (${desconhecidos.length} digito(s) oculto(s) + 2 DVs por modulo 11).\n${lista}${cands.length > n ? `\n... e mais ${cands.length - n} (passe o tribunal com consultar_datajud=true para a verificacao em lote - nao despejamos 1000 linhas).` : ''}`;
  }
  if (!a.tribunal) throw new Error('Informe o tribunal (alias tjsp/tjpr... ou codigo) para a verificacao em lote no DataJud.');
  const endpoint = resolveEndpoint(a.tribunal);
  const tamanho = Math.min(Number(a.tamanho) || 100, 100);
  const porCpf = new Map();
  const registro = (cpf, hit) => {
    const k = porCpf.get(cpf) || { processos: [], nomes: new Set() };
    const src = hit._source || {};
    const num = String(src.numeroProcesso || '');
    if (num && !k.processos.some(p => p.numero === num)) k.processos.push({ numero: num, resumo: fmtResumo(src) });
    nomesDePartes(src).forEach(x => k.nomes.add(x));
    porCpf.set(cpf, k);
  };
  try {
    const r1 = await datajudSearch(endpoint, { query: { terms: { 'partes.pessoa.documentoReplicado': cands } }, size: tamanho });
    for (const h of hitsToArray(r1)) {
      const js = JSON.stringify(h._source || {});
      const achados = cands.filter(c => js.includes(c));
      if (achados.length) achados.forEach(c => registro(c, h));
    }
  } catch (e) { /* terms pode falhar; segue para query_string */ }
  for (let i = 0; i < cands.length; i += 500) {
    const q = cands.slice(i, i + 500).map(c => `"${formatCpf(c)}"`).join(' OR ');
    try {
      const r2 = await datajudSearch(endpoint, { query: { query_string: { query: q } }, size: tamanho });
      for (const h of hitsToArray(r2)) {
        const js = JSON.stringify(h._source || {});
        const achados = cands.filter(c => js.includes(formatCpf(c)));
        if (achados.length) achados.forEach(c => registro(c, h));
      }
    } catch (e) { /* bloco ignora falha individual */ }
  }
  let out = `Mascara "${a.mascara}": ${cands.length} CPF(s) com DV correto gerado(s); verificacao EM LOTE no DataJud ${endpoint}: ${porCpf.size} CPF(s) com processo(s).\n`;
  if (!porCpf.size) {
    out += 'Nenhum candidato tem processo visivel neste tribunal. 0 e INDICIO, nao prova: repita em outros tribunais.';
  }
  const ordenados = [...porCpf.entries()].sort((x, y) => y[1].processos.length - x[1].processos.length);
  for (const [cpf, d] of ordenados) {
    out += `\nCPF ${formatCpf(cpf)} - ${d.processos.length} processo(s)`;
    out += d.nomes.size ? `\n  Nomes visiveis na base: ${[...d.nomes].slice(0, 5).join('; ')}` : '\n  Partes ocultas na API publica - leia a capa no portal do tribunal para o nome.';
    d.processos.slice(0, 5).forEach(p => { out += `\n  ${p.resumo}`; });
    if (d.processos.length > 5) out += `\n  ... e mais ${d.processos.length - 5} processo(s).`;
  }
  out += '\n\nVALIDACAO OBRIGATORIA PELO USUARIO: aponte qual CPF e do pesquisado (ex.: "o pesquisado e o CPF 123.456.789-0X"). Nenhum nome/CPF acima foi atribuido a ele ainda - homonimo e PROIBIDO antes da validacao. APOS validar, o dossie pesquisa TUDO pelo CPF (datajud_por_cpf, datajud_buscar com o CPF entre aspas, esaj_buscar DOCPARTE, ciclo PF<->PJ) - NUNCA pelo nome. Candidatos sem processo neste tribunal podem existir em outros: repita neles ou valide pelo nome completo + data de nascimento na Receita (captcha manual).';
  return out;
}

async function toolEsajBuscar(a) {
  const valor = String(a.nome_ou_doc || '').trim();
  if (!valor) throw new Error('Informe nome_ou_doc: nome da parte, CPF/CNPJ ou numero do processo.');
  const tipo = String(a.tipo || 'NMPARTE').toUpperCase();
  if (['NMPARTE', 'DOCPARTE', 'NUMPROC'].indexOf(tipo) < 0) throw new Error('tipo deve ser NMPARTE (nome), DOCPARTE (CPF/CNPJ) ou NUMPROC (numero).');
  const params = new URLSearchParams();
  params.set('conversationId', '');
  params.set('cbPesquisa', tipo);
  params.set('dadosConsulta.valorConsulta', valor);
  params.set('cdForo', String(a.foro || '-1'));
  const html = await fetchWithTimeout(`${ESAJ_SEARCH}?${params.toString()}`, { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'text/html' } }, 90000);
  const plano = html
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ');
  if (/nao existem informa/i.test(plano)) return `e-SAJ TJSP: 0 processos para "${valor}" (a consulta anonima SUPRIME partes de processos criminais - sigilo legal). ATENCAO: 0 e INDICIO, nao prova - o indice de partes do e-SAJ tem lacunas; cruze com DataJud (datajud_buscar/datajud_varrer) e DJEN antes de concluir ausencia.\n\n${avisoAncora(valor)}`;
  const m = plano.match(/(\d+)\s*Processos?\s*encontrados?/i);
  const leuContagem = !!m;
  const total = m ? m[1] : '0 (nao foi possivel ler a contagem)';
  const numeros = plano.match(/\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/g) || [];
  const i = plano.search(/Processos? encontrados?/i);
  const trecho = i >= 0 ? plano.slice(i, i + 3000) : plano.slice(0, 3000);
  let out = `e-SAJ TJSP - ${total} processo(s) encontrado(s) para "${valor}" (tipo ${tipo})${leuContagem ? '' : ` | HTML recebido: ${html.length} bytes`}:\n${trecho}`;
  if (numeros.length) out += `\n\nNumeros listados (${numeros.length}):\n${[...new Set(numeros)].join('\n')}`;
  out += `\n\n${tipo === 'DOCPARTE'
    ? 'DOCUMENTO como ancora: correto pela regra do servidor - cruze com DataJud/DJEN antes de marcar CONFIRMADO. CICLO OBRIGATORIO PF<->PJ: com CPF, procure os CNPJs vinculados; com CNPJ, extraia os CPFs do QSA (brasilapi_cnpj) e procure os processos dessas pessoas.'
    : tipo === 'NMPARTE'
      ? 'PROIBICAO: busca por NOME produz HOMONIMOS - PROIBIDO lista-los como sendo do pesquisado sem cruzamento pelo CPF/CNPJ (DOCPARTE ou datajud_por_cpf); sem documento que bate = POSSIVEL HOMONIMO, fora da lista principal (protocolo em fontes_osint).'
      : 'Busca por NUMERO: ancora unica.'}`;
  return out;
}

// --- DJE-SP (Diario da Justica Eletronico do TJSP) ---
// Pipeline validado: GET consultaAvancada.do (sessao+campos ocultos) ->
// POST consultaAvancada.do;jsessionid=... (busca) ->
// POST trocaDePagina.do pagina=N (fragmentos AJAX) ->
// PDF oficial anonimo em getPaginaDoDiario.do?...&uuidCaptcha=

const DJE_CADERNOS = {
  '-11': 'Todos os cadernos',
  '10': 'Caderno 1 - Administrativo',
  '11': 'Caderno 2 - Judicial - 2a Instancia - Entrada e Distribuicao - Parte I',
  '19': 'Caderno 2 - Judicial - 2a Instancia - Processamento - Parte II',
  '12': 'Caderno 3 - Judicial - 1a Instancia - Capital - Parte I',
  '20': 'Caderno 3 - Judicial - 1a Instancia - Capital - Parte II',
  '18': 'Caderno 4 - Judicial - 1a Instancia - Interior - Parte I',
  '13': 'Caderno 4 - Judicial - 1a Instancia - Interior - Parte II',
  '15': 'Caderno 4 - Judicial - 1a Instancia - Interior - Parte III',
  '14': 'Caderno 5 - Editais e Leiloes'
};

const DJE_MESES = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' };

function djeDecodeEnt(s) {
  const mapa = {
    nbsp: ' ', amp: String.fromCharCode(38), lt: String.fromCharCode(60), gt: String.fromCharCode(62), quot: String.fromCharCode(34),
    aacute: '\u00e1', eacute: '\u00e9', iacute: '\u00ed', oacute: '\u00f3', uacute: '\u00fa',
    atilde: '\u00e3', otilde: '\u00f5', ccedil: '\u00e7', acirc: '\u00e2', ecirc: '\u00ea', ocirc: '\u00f4', agrave: '\u00e0',
    Aacute: '\u00c1', Eacute: '\u00c9', Iacute: '\u00cd', Oacute: '\u00d3', Uacute: '\u00da', Ccedil: '\u00c7'
  };
  return String(s).replace(/&(#39|[a-zA-Z]+);/g, function (m, g) {
    if (g === '#39') return "'";
    return Object.prototype.hasOwnProperty.call(mapa, g) ? mapa[g] : m;
  });
}

function djeStripTags(s) {
  return djeDecodeEnt(String(s).replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function djeNormData(v, fallback) {
  const s = String(v || '').trim();
  if (!s) return fallback || '';
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return m[3] + '/' + m[2] + '/' + m[1];
  m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return s;
  throw new Error('Data invalida: "' + v + '" - use dd/mm/aaaa ou aaaa-mm-dd.');
}

function djeHiddenValue(html, nome) {
  const re = new RegExp('<input\\b[^>]*\\bname="' + nome + '"[^>]*>');
  const m = html.match(re);
  if (!m) return '';
  const v = m[0].match(/\bvalue="([^"]*)"/);
  return v ? v[1] : '';
}

async function djeFetch(url, options, ms, jar) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms || 90000);
  try {
    const opts = Object.assign({}, options, { signal: ctrl.signal });
    opts.headers = Object.assign({}, opts.headers || {});
    const ck = Object.keys(jar).map(k => k + '=' + jar[k]).join('; ');
    if (ck) opts.headers.Cookie = ck;
    const res = await fetch(url, opts);
    let setCk = [];
    if (typeof res.headers.getSetCookie === 'function') setCk = res.headers.getSetCookie();
    else {
      const raw = res.headers.get('set-cookie');
      if (raw) setCk = raw.split(/,(?=[^ ;,]+=)/);
    }
    for (const c of setCk) {
      const par = c.split(';')[0];
      const eq = par.indexOf('=');
      if (eq > 0) jar[par.slice(0, eq).trim()] = par.slice(eq + 1).trim();
    }
    const text = await res.text();
    if (!res.ok) throw new Error('HTTP ' + res.status + ': ' + text.slice(0, 300));
    return text;
  } finally {
    clearTimeout(timer);
  }
}

function djeParseHits(html) {
  const mCont = html.match(/Resultados\s*<strong>([^<]+)<\/strong>\s*de\s*(\d+)/i);
  const cont = mCont ? { faixa: mCont[1].trim(), total: Number(mCont[2]) } : null;
  const hits = [];
  const blocos = html.split('<tr class="fundocinza1">').slice(1);
  for (const bloco of blocos) {
    const mUrl = bloco.match(/popup\('(\/cdje\/consultaSimples\.do\?[^']+)'\)/);
    if (!mUrl) continue;
    const q = new URLSearchParams(mUrl[1].split('?')[1]);
    const hit = {
      cdVolume: q.get('cdVolume') || '',
      nuDiario: q.get('nuDiario') || '',
      cdCaderno: q.get('cdCaderno') || '',
      nuSeqpagina: q.get('nuSeqpagina') || '',
      data: '',
      caderno: '',
      ocorrencias: '',
      snippet: '',
      processos: []
    };
    const mLinha = bloco.match(/popup\('([^']*)'\)[^>]*>\s*([^<]+?)\s*<\/a>/);
    if (mLinha) {
      const linha = mLinha[2].replace(/\s+/g, ' ').trim();
      const mBr = linha.match(/(\d{2}\/\d{2}\/\d{4})\s+-\s+(.+)$/);
      const mEn = linha.match(/^[A-Za-z]{3}\s+([A-Za-z]{3})\s+(\d{2})\s+[\d:]+\s+GMT[^\s]*\s+(\d{4})\s+-\s+(.+)$/);
      if (mBr) {
        hit.data = mBr[1];
        hit.caderno = djeStripTags(mBr[2]);
      } else if (mEn) {
        hit.data = mEn[2] + '/' + (DJE_MESES[mEn[1]] || '??') + '/' + mEn[3];
        hit.caderno = djeStripTags(mEn[4]);
      } else {
        hit.caderno = djeStripTags(linha);
      }
    }
    const mOc = bloco.match(/\((\d+)\s+ocorr[^)]*\)/);
    if (mOc) hit.ocorrencias = mOc[1];
    const mSnip = bloco.match(/<tr class="ementaClass2">\s*<td[^>]*>([\s\S]*?)<\/td>/);
    if (mSnip) hit.snippet = djeStripTags(mSnip[1]).slice(0, 700);
    const fontes = hit.snippet + ' ' + hit.caderno;
    hit.processos = [...new Set(fontes.match(/\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/g) || [])];
    hits.push(hit);
  }
  return { cont: cont, hits: hits };
}

async function toolDjeSpBuscar(a) {
  const termo = String(a.nome_ou_texto || a.termo || '').trim();
  if (!termo) throw new Error('Informe nome_ou_texto: nome exato entre aspas ("NOME COMPLETO"), termo livre ou numero de processo.');
  const caderno = String(a.cd_caderno || '-11');
  if (!DJE_CADERNOS[caderno]) throw new Error('cd_caderno invalido: ' + caderno + '. Opcoes: ' + Object.keys(DJE_CADERNOS).map(k => k + '=' + DJE_CADERNOS[k]).join('; '));
  const maxPaginas = Math.min(Math.max(Number(a.max_paginas) || 1, 1), 10);
  const jar = {};
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    'Accept': 'text/html,application/xhtml+xml',
    'Referer': DJE_SEARCH,
    'Origin': 'https://esaj.tjsp.jus.br'
  };
  const form = await djeFetch(DJE_SEARCH, { headers: headers }, 60000, jar);
  const mAct = form.match(/action="([^"]*consultaAvancada\.do[^"]*)"/);
  if (!mAct) throw new Error('Pagina de busca do DJE-SP mudou de formato (action nao encontrada).');
  const actionUrl = 'https://esaj.tjsp.jus.br' + mAct[1].replace(new RegExp('&am' + 'p;', 'g'), String.fromCharCode(38));
  const limRaw = djeHiddenValue(form, 'dtLimiteFim') || djeHiddenValue(form, 'dtDiario');
  let ultimoDia = '';
  if (limRaw) { try { ultimoDia = djeNormData(limRaw, ''); } catch (e) { ultimoDia = ''; } }
  const dtFim = djeNormData(a.data_fim, ultimoDia);
  const dtIni = djeNormData(a.data_inicio, dtFim);
  if (!dtFim || !dtIni) throw new Error('Nao foi possivel deduzir a janela de datas do DJE-SP nesta resposta - informe data_inicio e data_fim (dd/mm/aaaa; a base comeca em 01/10/2007).');
  const body = new URLSearchParams();
  for (const tag of form.matchAll(/<input\b[^>]*>/g)) {
    const nm = tag[0].match(/\bname="([^"]+)"/);
    if (!nm) continue;
    const nome = nm[1];
    if (nome === 'consultar' || nome === 'Limpar' || nome === 'download' || nome === 'pagina' || nome.indexOf('dadosConsulta.') === 0) continue;
    const vl = tag[0].match(/\bvalue="([^"]*)"/);
    body.set(nome, vl ? vl[1] : '');
  }
  body.set('dadosConsulta.dtInicio', dtIni);
  body.set('dadosConsulta.dtFim', dtFim);
  body.set('dadosConsulta.pesquisaLivre', termo);
  body.set('dadosConsulta.cdCaderno', caderno);
  body.set('secoes', '');
  body.set('cadernosCad', '');
  body.set('consultar', 'Consultar');
  let html = await djeFetch(actionUrl, {
    method: 'POST',
    headers: Object.assign({}, headers, { 'Content-Type': 'application/x-www-form-urlencoded' }),
    body: body.toString()
  }, 120000, jar);
  let r = djeParseHits(html);
  if (!r.cont) {
    const semScripts = html.replace(/<script[\s\S]*?<\/script>/gi, ' ');
    if (/nenhum registro correspondente/i.test(semScripts)) {
      let zero = 'DJE-SP: 0 publicacoes para ' + termo + ' entre ' + dtIni + ' e ' + dtFim + ' (caderno: ' + DJE_CADERNOS[caderno] + ').';
      if (ultimoDia) zero += '\nUltima edicao publicada na base: ' + ultimoDia + ' (janelas futuras retornam zero).';
      zero += '\nATENCAO: 0 aqui e INDICIO, nao prova - o DJE-SP so publica decisoes do TJSP (nao cobre Justica do Trabalho/Federal/Eleitoral nem outros estados).';
      return zero;
    }
    throw new Error('Resposta inesperada do DJE-SP (sem marcador de resultados). Confira o intervalo de datas (base: 01/10/2007 a ' + (ultimoDia || 'hoje') + ') e o termo.');
  }
  const total = r.cont.total;
  const todas = r.hits.slice();
  const totalPaginas = Math.max(1, Math.ceil(total / 10));
  for (let pg = 2; pg <= Math.min(maxPaginas, totalPaginas); pg++) {
    const frag = await djeFetch(DJE_TROCA_PG, {
      method: 'POST',
      headers: Object.assign({}, headers, { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Requested-With': 'XMLHttpRequest' }),
      body: 'pagina=' + pg
    }, 60000, jar);
    const rf = djeParseHits(frag);
    for (const h of rf.hits) todas.push(h);
  }
  let out = 'DJE-SP (Diario da Justica Eletronico do TJSP) - busca por ' + termo + ' | janela ' + dtIni + ' a ' + dtFim + ' | caderno: ' + DJE_CADERNOS[caderno] + '\n';
  if (ultimoDia) out += 'Ultima edicao publicada na base: ' + ultimoDia + '\n';
  out += 'Total: ' + total + ' publicacoes | lidas: ' + todas.length + ' (paginas 1-' + Math.min(maxPaginas, totalPaginas) + ' de ' + totalPaginas + '; cada pagina = 10 hits; aumente max_paginas ate 10 para ler mais)\n';
  todas.forEach((h, i) => {
    out += '\n[' + (i + 1) + '] ' + (h.data || 'data?') + ' - ' + (h.caderno || 'caderno?') + (h.ocorrencias ? ' | ocorrencias na pagina: ' + h.ocorrencias : '') + '\n';
    out += '    PDF oficial: ' + DJE_PDF + '?cdVolume=' + h.cdVolume + '&nuDiario=' + h.nuDiario + '&cdCaderno=' + h.cdCaderno + '&nuSeqpagina=' + h.nuSeqpagina + '&uuidCaptcha=\n';
    if (h.processos.length) out += '    Processos citados: ' + h.processos.join(', ') + '\n';
    if (h.snippet) out += '    ' + h.snippet + '\n';
  });
  out += '\nCOMO USAR: o PDF e a pagina oficial do diario (URL anonima - baixe com curl/ferramenta de leitura). Snippets citam numeros de processo: valide com cnj_validar e confirme com datajud_processo. Publicacoes que citam o pesquisado por nome EXIGEM cruzamento por CPF/CNPJ ou pelo numero do processo.\n';
  out += avisoAncora(termo);
  return out;
}

async function toolExaBuscar(a) {
  const chave = process.env.EXA_API_KEY;
  if (!chave) return 'EXA_API_KEY nao configurada no ambiente. Obtenha em https://dashboard.exa.ai e defina (Windows: setx EXA_API_KEY "sua-chave").';
  const consulta = String(a.consulta || '').trim();
  if (!consulta) throw new Error('Informe a consulta (texto semantico, nome, tema).');
  const n = Math.min(Number(a.n) || 5, 20);
  const text = await fetchWithTimeout(EXA_SEARCH, {
    method: 'POST',
    headers: { 'x-api-key': chave, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: consulta, type: 'auto', numResults: n, contents: { highlights: true } })
  }, 60000);
  const j = JSON.parse(text);
  const res = j.results || [];
  if (!res.length) return '0 resultados na Exa.';
  return res.map(r => `${r.title || ''} — ${r.url || ''}\n  ${((r.highlights || [''])[0] || '').slice(0, 300)}`).join('\n');
}

let wmnCache = null;
async function loadWmnSites() {
  if (wmnCache) return wmnCache;
  const text = await fetchWithTimeout(WMN_DATA_URL, { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' } }, 30000);
  const j = JSON.parse(text);
  wmnCache = Array.isArray(j.sites) ? j.sites : [];
  return wmnCache;
}

async function toolSocialBuscarUsuario(a) {
  const usuario = String(a.usuario || '').trim().replace(/^@+/, '');
  if (!usuario) throw new Error('Informe o usuario/nick (sem espacos).');
  if (/@/.test(usuario) || /[^a-zA-Z0-9._-]/.test(usuario)) throw new Error('Usuario com caracteres invalidos: use apenas letras, numeros, ponto, traco ou underline (sem espacos).');
  const limite = Math.min(Number(a.limite) || 40, 150);
  const sites = await loadWmnSites();
  if (!sites.length) throw new Error('Nao foi possivel carregar a base de sites do WhatsMyName (GitHub raw). Tente novamente.');
  const alvo = sites.slice(0, limite);
  const achados = [], inconclusivos = [];
  let erros = 0, idx = 0;
  const worker = async () => {
    while (idx < alvo.length) {
      const s = alvo[idx++];
      const url = String(s.uri_check || '').replace('{account}', encodeURIComponent(usuario));
      if (!url || url.indexOf('{') >= 0) continue;
      try {
        const r = await fetchRaw(url, { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'text/html,application/xhtml+xml,*/*' } }, 12000);
        const corpo = r.text || '';
        const eCode = s.e_code != null ? s.e_code : 200;
        const eStr = s.e_string || '';
        const mCode = s.m_code != null ? s.m_code : 404;
        const mStr = s.m_string || '';
        if (r.status === mCode && (!mStr || corpo.includes(mStr))) {
          // marcador de AUSENCIA (m_code/m_string = missing) - nao encontrado, esperado
        } else if (r.status === eCode && (!eStr || corpo.includes(eStr))) {
          achados.push(`${s.name}: ${String(s.uri_pretty || url).replace('{account}', encodeURIComponent(usuario))}`);
        } else {
          inconclusivos.push(`${s.name} (HTTP ${r.status}${eStr && !corpo.includes(eStr) ? ' sem marcador de existencia' : ''})`);
        }
      } catch (e) {
        erros++;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(8, alvo.length) }, () => worker()));
  let out = `Scanner de perfis (base publica WhatsMyName) para o usuario "${usuario}": ${alvo.length} site(s) verificados\n\n`;
  out += `PERFIS ENCONTRADOS (${achados.length}):\n`;
  out += achados.length ? achados.join('\n') : 'Nenhum perfil confirmado nos sites verificados.';
  out += `\n\nINCONCLUSIVOS (${inconclusivos.length}): ${inconclusivos.slice(0, 15).join(', ')}${inconclusivos.length > 15 ? '...' : ''}`;
  out += `\nFalhas de conexao (timeout/bloqueio): ${erros}`;
  out += `\n\nAVISO CRITICO: perfil EXISTENTE nao e perfil DA PESSOA - nicks tem homonimos; valide por bio, foto, cidade, vinculos e datas antes de atribuir (LGPD). Equivalentes locais (Python, mais sites): sherlock, maigret, snoop, blackbird, nexfil, social-analyzer - rotas em fontes_osint.`;
  return out;
}

async function toolTelefoneConsultar(a) {
  const tel = digitsOnly(a.telefone);
  if (tel.length < 10 || tel.length > 15) throw new Error('Informe o telefone com DDD (BR: 10-11 digitos, ex. 11999998888) ou completo com codigo de pais.');
  let out = `Telefone analisado: ${tel}\n`;
  if (tel.length === 10 || tel.length === 11) {
    const ddd = tel.slice(0, 2);
    const tipo = tel.length === 11 ? 'celular (nono digito)' : 'fixo ou celular antigo (sem nono digito)';
    out += `Tipo (BR): ${tipo}\n`;
    try {
      const text = await fetchWithTimeout(`${BRASILAPI_DDD}${ddd}`, { headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' } }, 20000);
      const j = JSON.parse(text);
      const cidades = Array.isArray(j.cities) ? j.cities : [];
      out += `DDD ${ddd}: UF ${j.uf || j.state || '?'} - ${cidades.length} cidade(s): ${cidades.slice(0, 40).join(', ')}${cidades.length > 40 ? '...' : ''}\n`;
    } catch (e) {
      out += `DDD ${ddd}: consulta de cidades (BrasilAPI) falhou: ${String(e && e.message ? e.message : e).slice(0, 120)}\n`;
    }
    out += `WhatsApp: verificar existencia via https://wa.me/55${tel} (abrir no app; ferramentas dedicadas em github.com/kinghacker0/WhatsApp-OSINT)\n`;
  } else {
    out += `Formato internacional detectado - consulte por pais nas fontes especializadas.\n`;
  }
  out += `\nConsultas completas em paginas dinamicas (use Playwright/browser):\n`;
  out += `- Numtrace: https://numtrace.com/pt-br/phone-page?phone=${tel}\n`;
  out += `- Social Searcher (mencoes em redes): https://www.social-searcher.com/google-social-search/?q=${tel}\n`;
  out += `\nAVISO: telefone e dado pessoal (LGPD); tipo de linha/operadora so a telefonia confirma; agregadores (numtrace etc.) listam dados publicos e denuncias de spam - trate tudo como INDICIO, nunca como prova.`;
  return out;
}

async function toolJusbrasilBuscar(a) {
  const consulta = String(a.consulta || '').trim();
  if (!consulta) throw new Error('Informe a consulta: nome exato entre aspas duplas, CPF/CNPJ formatado entre aspas ou termo livre.');
  const url = JUSBRASIL_BUSCA + encodeURIComponent(consulta);
  const rotaBrowser = [
    'Jusbrasil bloqueia HTTP puro (Cloudflare "Just a moment", 403) - use o BROWSER (MCP Playwright):',
    `1. browser_navigate: ${url}`,
    '2. browser_snapshot / browser_find: procure links de /processos/, /diarios/, /topicos/ e o padrao "Processo no.".',
    '3. O Jusbrasil MASCARA numeros de processo (digitos ocultos como XXXX) conforme o plano - anote a mascara exata.',
    '4. Alimente o loop: cnj_desmascarar com a mascara + cpf (e/ou nome) - o servidor gera os candidatos com DV valido, verifica no DataJud e marca o processo do pesquisado.',
    '',
    'Consulta ideal: CPF/CNPJ formatado entre aspas duplas (ancora por documento, regra do servidor); nome entre aspas so como complemento.'
  ].join('\n');
  let html = '';
  let bloqueado = false;
  try {
    html = await fetchWithTimeout(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36', 'Accept': 'text/html', 'Accept-Language': 'pt-BR,pt;q=0.9' } }, 45000);
  } catch (e) {
    if (/HTTP 40[03]|HTTP 429/.test(String(e))) bloqueado = true;
    else throw e;
  }
  if (!bloqueado && /Just a moment|challenges\.cloudflare|Enable JavaScript/.test(html)) bloqueado = true;
  if (bloqueado) return rotaBrowser + '\n\n' + avisoAncora(consulta);
  const itens = [];
  const vistos = new Set();
  const re = /<a[^>]+href="(https?:\/\/(?:[\w-]+\.)*jusbrasil\.com\.br\/[^"#?]+)"[^>]*>([^<]{4,180})<\/a>/g;
  let m;
  while ((m = re.exec(html)) && itens.length < 25) {
    if (/\/(login|registro|assinaturas|planos|cadastrar)/.test(m[1])) continue;
    const chave = m[1].replace(/\/$/, '');
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    itens.push(`- ${m[2].replace(/\s+/g, ' ').trim()}\n  ${m[1]}`);
  }
  const completos = [...new Set(html.match(/\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/g) || [])];
  const mascarados = [...new Set(html.match(/(?:\d{0,7}X{1,7}|X{2,7})-?(?:XX|\d{0,2})\.\d{4}\.\d\.\d{2}\.\d{4}/g) || [])];
  let out = `Jusbrasil (via HTTP): "${consulta}"\n`;
  if (itens.length) {
    out += `\nResultados (${itens.length}):\n`;
    out += itens.join('\n');
  } else {
    out += '\nSem itens extraidos via HTTP (a pagina renderiza via JavaScript e/ou limita bots).\n';
    out += '\n' + rotaBrowser;
  }
  if (completos.length) out += `\n\nNumeros completos na pagina (${completos.length}):\n${completos.join('\n')}`;
  if (mascarados.length) out += `\n\nNumeros MASCARADOS na pagina (${mascarados.length}) - use cnj_desmascarar (loop cpf/nome):\n${mascarados.join('\n')}`;
  out += `\n\n${avisoAncora(consulta)}`;
  return out;
}

async function toolMcpAtualizar(a) {
  const url = (a && a.fonte ? String(a.fonte).trim() : '') || UPDATE_URL;
  const novo = await fetchWithTimeout(url, { headers: { 'User-Agent': 'escrivao-mcp-updater' } }, 60000);
  const vRe = /version:\s*'([0-9][0-9.]*)'/;
  const caminho = __filename;
  let atual = '';
  try { atual = fs.readFileSync(caminho, 'utf8'); } catch (e) { /* primeira execucao sem leitura */ }
  const vAtual = (atual.match(vRe) || [])[1] || '?';
  const vNova = (novo.match(vRe) || [])[1] || '?';
  if (atual && novo.trim() === atual.trim()) {
    return `Servidor ja esta na versao mais recente (v${vAtual}). Nada a fazer. (Esta e a rota oficial de atualizacao - nao requer git.)`;
  }
  let bak = '';
  try {
    if (atual) { bak = caminho + '.bak'; fs.writeFileSync(bak, atual); }
  } catch (e) { bak = ''; }
  try {
    fs.writeFileSync(caminho, novo);
  } catch (e) {
    const alt = caminho + '.novo';
    fs.writeFileSync(alt, novo);
    return `Nao foi possivel substituir ${caminho} (${String(e && e.code ? e.code : e)}). Nova versao salva em ${alt} - substitua manualmente e reinicie o cliente MCP.`;
  }
  return [
    `Atualizacao concluida: v${vAtual} -> v${vNova}${bak ? ` (backup: ${bak})` : ''}`,
    'A instancia em memoria continua na versao antiga ate o processo terminar.',
    'Atualizacao sem git: este metodo baixa direto do GitHub raw e funciona em qualquer instalacao.',
    `REINICIE o cliente MCP para a v${vNova} subir - comandos por cliente: opencode: encerre a sessao/processo e abra de novo; kimi-code: reinicie o cliente e confira com /mcp; Claude Desktop: feche e reabra o app; Cursor: reinicie o painel MCP. Confira a versao com tools/list.`
  ].join('\n');
}

async function toolEsajGuia() {
  return [
    'FLUXO VALIDADO - CONSULTA PUBLICA e-SAJ TJSP (sem captcha para numero de processo):',
    '1. Navegue para https://esaj.tjsp.jus.br/cpopg/show.do?processo.numero=NNNNNNN-DD.AAAA.J.TR.OOOO (a pagina renderiza o formulario de consulta).',
    '2. Preencha o campo CSS #numeroDigitoAnoUnificado com os 13 primeiros digitos (NNNNNNNDDAAAA).',
    '3. Preencha o campo CSS #foroNumeroUnificado com os 4 digitos do foro (OOOO).',
    '4. Clique no botao CSS #botaoConsultarProcessos.',
    '5. Leia a pagina resultante (capa, movimentos, peticoes, apensos, vinculados e originacao). Para usuario anonimo, nomes de reus criminais ficam ocultos, mas movimentos e documentos aparecem.',
    'NOTAS IMPORTANTES:',
    '- A busca por NOME/DOCUMENTO via HTTP funciona (ferramenta esaj_buscar: GET search.do com cbPesquisa=NMPARTE/DOCPARTE/NUMPROC). O acesso DIRETO ao link do processo (show.do) falha com "Nao foi possivel validar o seu acesso a esse recurso" - abra o processo a partir da lista de resultados ou use o formulario.',
    '- A consulta ANONIMA suprime partes de processos CRIMINAIS (nem co-reus comprovados aparecem); para criminais e preciso acesso OAB ou certidao de distribuicao.',
    '- Buscas que exigem captcha: use o MCP Playwright e deixe o usuario resolver o captcha manualmente na tela.',
    '- Casos de uso comprovados: confirmar execucao penal (relatorios SAP/PSC), verificar vinculados/origem, eliminar candidatos falsos por fingerprint de datas.'
  ].join('\n');
}

async function toolFontesOsint() {
  return [
    'PROTOCOLO OBRIGATORIO DE PESQUISA (vale para TODA consulta feita com este servidor):',
    '1. DOCUMENTO MANDA: havendo CPF/CNPJ do pesquisado, a busca PRINCIPAL e pelo DOCUMENTO (datajud_por_cpf; datajud_buscar/datajud_varrer com o CPF formatado entre aspas; esaj_buscar DOCPARTE). Nome e apenas complemento.',
    '2. HOMONIMO E PROIBIDO: achado de busca por nome sem documento que bata = POSSIVEL HOMONIMO - PROIBIDO apresenta-lo como sendo do pesquisado; nunca entra na lista principal do relatorio (no maximo, secao separada claramente marcada).',
    '3. CRUZAMENTO OBRIGATORIO: nenhuma afirmacao de vinculo sem cruzar DataJud + DJEN + e-SAJ + BrasilAPI (CNPJ) + web (jusbrasil_buscar, exa_buscar).',
    '4. CONFIRMADO so com documento (CPF/CNPJ) exato batendo; sem documento, no maximo PROVAVEL (fingerprint orgao+classe+assunto+datas).',
    '5. NUMERO MASCARADO (XXXX): cnj_desmascarar com o LOOP - passe a mascara + cpf e/ou nome; o servidor gera candidatos, verifica no DataJud e marca os vinculados ao pesquisado. Vale para mascara de qualquer fonte (Jusbrasil, Escavador, documentos). CPF MASCARADO (ate 3 digitos ocultos, ex.: ***.NNN.NNN-** ou o bloco de 6 antes do DV): cpf_desmascarar - loop 000-999 + DV modulo 11 + verificacao EM LOTE no DataJud; devolve CPFs com processos e nomes para o USUARIO validar; apos validar, o dossie pesquisa TUDO pelo CPF, nunca pelo nome.',
    '6. CICLO OBRIGATORIO PF<->PJ: execute com ciclo_pf_pj({ cpf_cnpj }) - UMA chamada roda DataJud multi-tribunal (documento entre aspas) + e-SAJ DOCPARTE + DJE-SP (base integral) + BrasilAPI (CNPJ->QSA) e devolve veredito unico. Pesquisado com CPF -> SEMPRE procure os CNPJs vinculados: nao ha busca reversa CPF->CNPJ em API publica - receita validada: (a) razao social de ME costuma EMBUTIR o CPF do titular; (b) busca web \'"NOME COMPLETO" "CPF" CNPJ\' (exa_buscar/jusbrasil_buscar); (c) com o CNPJ: brasilapi_cnpj + ciclo_pf_pj. Pesquisado com CNPJ -> SEMPRE extraia os CPFs do QSA (mascarados: cpf_desmascarar) e procure os processos dessas pessoas. O ciclo e CPF -> CNPJ -> CPF, sempre.',
    '7. CONFIRMACAO RAPIDA POR NUMERO: datajud_pesquisar (terms com o numero de 20 digitos) confirma a existencia do processo em segundos (1 hit por fingerprint) - use antes do datajud_processo para checagens rapidas de existencia.',
    '',
    'BASES PUBLICAS (onde achar):',
    '- API publica DataJud/CNJ: https://api-publica.datajud.cnj.jus.br (endpoint api_publica_{tjsp|tjpr|tre-sp|...}/_search; chave publica na wiki https://datajud-wiki.cnj.jus.br/api-publica/acesso/). As partes seguem DOIS formatos de indexacao conforme o tribunal (partes.nome/polo/documento ou partes.pessoa.* estilo MTD) - datajud_por_nome e datajud_por_cpf cobrem ambos via bool.should; nos que omitem, classifique por orgao+classe+assunto+datas (fingerprint). Paginacao alem dos 10.000 hits: datajud_pesquisar com ordenar=atualizacao + apartir_de (cursor search_after).',
    '- DJEN/CNJ: https://comunicaapi.pje.jus.br/api/v1/comunicacao?nomeParte=... - intimacoes com TEXTO INTEGRAL (sentencas completas); citam numeros correlatos.',
    '- e-SAJ TJSP: consulta publica por numero via formulario (use a ferramenta esaj_tjsp_guia); busca por nome exige captcha manual.',
    '- BrasilAPI: https://brasilapi.com.br (CNPJ gratuito, sem chave).',
    '- Diarios oficiais (DJSP e equivalentes): editais de citacao, publicacoes de sentenca.',
    '- Escavador: agregador (paywall; mascara numeros conforme plano; login 2FA; numeros RELACIONADOS costumam aparecer completos).',
    '- Pendentes com chave/captcha: CEIS/CNEP (API key gratuita), TSE (filiacao/doacoes), Receita Federal (captcha), cartorios/registro civil.',
    '',
    'REDES SOCIAIS E TELEFONE (ferramentas embutidas + rotas):',
    '- social_buscar_usuario (EMBUTIDO, gratuito, sem chave): varre o nick na base publica do WhatsMyName em dezenas de redes e devolve os PERFIS EXISTENTES com URL.',
    '- Mencoes sociais por termo (web UI): https://www.social-searcher.com/google-social-search/?q=TERMO | sherlock-osint.com/pt-br (SERVICO COMERCIAL; equivalentes gratuitos abaixo).',
    '- Scanners de username (Python local, cobrem mais sites): https://github.com/sherlock-project/sherlock | https://github.com/soxoj/maigret | https://github.com/snooppr/snoop | https://github.com/antoniaci/blackbird | https://github.com/thewhiteh4t/nexfil | https://github.com/mishakorzik/UserFinder | https://github.com/0x0be/yesitsme | https://github.com/qeeqbox/social-analyzer',
    '- WhatsMyName (a base consumida pelo social_buscar_usuario): https://github.com/WebBreacher/WhatsMyName',
    '- Escaneamento profundo de perfil (web UI): https://footprintiq.app/free-scan',
    '- TELEFONE: telefone_consultar (EMBUTIDO: DDD/UF/cidades via BrasilAPI + rotas) | Numtrace: https://numtrace.com/pt-br/phone-page?phone=NNNNNNNNNNN (pagina dinamica - use Playwright) | WhatsApp: https://wa.me/55NNNNNNNNNNN (conferir no app; tecnicas: https://github.com/kinghacker0/WhatsApp-OSINT)',
    '- COLECOES/CURADORIAS OSINT: https://github.com/Astrosp/Awesome-OSINT-List | https://github.com/cipher387/OSINT-Github-profiles | https://github.com/CScorza/OSINTAnonymous',
    '- REGRA: perfil/numero encontrado e INDICIO - nicks tem homonimos; valide bio/foto/cidade/vinculos antes de atribuir (LGPD).',
    '',
    'OSINT INTERNACIONAL / POR PAIS (brasileiro no exterior - o CPF NAO indexa fora do Brasil; ancora = NOME EXATO + registros locais):',
    '- OSINT in the Countries (base por pais: registros governamentais, empresas, telecom, buscadores, arcabouco legal de cada pais): https://github.com/OSINT-for-countries',
    '- X-osint (CLI Termux/Linux: telefone, e-mail, VIN, subdominios, e-mail a partir do nome): https://github.com/TermuxHackz/X-osint',
    '- Topicos GitHub (descoberta continua de ferramentas OSINT): https://github.com/topics/osint-tools e https://github.com/topics/open-source-intelligence',
    '- Maltego (COMERCIAL, grafos de vinculos/link analysis; Basic gratuito com Graph CE, Entry Standard EUR 3.000/ano, Professional EUR 7.500/ano): https://www.maltego.com/pricing/',
    '- ROTAS VALIDADAS POR PAIS: Irlanda - CORE/CRO empresas+inelegidos (core.cro.ie), insolvencia ISI (isi.jahs.ie/public/cases, nome exato), High Court (courts.ie/high-court-search; resultados client-side), registro eleitoral (checktheregister.ie; WAF 403 = manual) | Reino Unido - Companies House (find-and-update.company-information.service.gov.uk) | GLOBAL - Interpol Red Notices (interpol.int; API ws.interpol.int instavel), OpenSanctions (opensanctions.org), Wayback CDX (web.archive.org/cdx/search/cdx).',
    '- FUSO VIA COMMITS (proxy de localizacao): o patch bruto do commit (github.com/usuario/repo/commit/SHA.patch) traz o offset local do autor (-0300 = Brasilia; +0100 = Irlanda no verao) - indicio publico, nunca prova (VPN existe).',
    '- LIMITE ESTRUTURAL (declare no dossie): passaporte, vistos, PNR e SIS sao dados ESTATAIS (sem via publica gratuita); CLT no exterior nao tem CAGED publico; GDPR vigora na UE.',
    '- IRLANDA COMPLEMENTO: OSINT in Ireland (guia de fontes publicas irlandesas, mesma org do OSINT-for-countries): https://github.com/OSINT-for-countries/OSINT_in_Ireland | CRO Open Data (datasets e API REST estruturados das empresas irlandesas): https://opendata.cro.ie e https://services.cro.ie (API cobrada por consulta; a busca core.cro.ie segue gratuita) | gov.ie (publicacoes e informacoes governamentais): https://www.gov.ie',
    '- DIRETORIO DE FERRAMENTAS: OSINT Framework (catalogo por categoria - nome, e-mail, usuario, dominios, documentos): https://osintframework.com',
    '- VARIACOES DE NOME (anti-homonimo e desbloqueio de busca): pesquise TODAS as grafias - nome completo, nome abreviado, SEM ACENTOS (indexadores nao normalizam acento), nome de casado(a) e username conhecido; brasileiro no exterior pode assinar qualquer uma delas nos registros locais. Achado com documento? Ancore por documento; achado so por grafia nova entra como mais uma variacao para varrer (datajud_varrer), nunca como fato.',
    '',
    'FONTES OFICIAIS DE CPF (rotas validadas - classificadas por QUEM pode consultar; espelho completo em regras/links-consulta-proprio-cpf.txt):',
    '- TERCEIRO (publicas, legais, com o documento do pesquisado):',
    '  * Situacao cadastral na Receita (CPF + data de nascimento + CAPTCHA - rota browser com captcha manual): regular/pendente/cancelada/nula/titular falecido + data de inscricao: https://servicos.receita.fazenda.gov.br/servicos/cpf/consultasituacao/consultapublica.asp',
    '  * Protestos em cartorio por CPF/CNPJ (Cenprot Nacional): https://site.cenprotnacional.org.br',
    '  * Pesquisa de bens do ONR (matriculas por CPF/CNPJ, creditos pre-pagos): https://registradores.onr.org.br e https://ridigital.org.br',
    '  * Certidao de distribuicao por tribunal (TJ/TRF/TRT) - localize via DataJud/e-SAJ aqui e formalize no portal do tribunal.',
    '  * Reclamacoes contra EMPRESAS (Consumidor.gov.br, consulta por CNPJ/razao social): https://www.consumidor.gov.br',
    '- PROPRIO TITULAR (login gov.br do pesquisado - use apenas com o titular ou autorizacao formal; NUNCA para terceiro sem base legal):',
    '  * Registrato BCB (contas, chaves Pix, emprestimos no CPF): https://www.bcb.gov.br/meubc/registrato | Valores a Receber: https://valoresareceber.bcb.gov.br',
    '  * Meu INSS/CNIS (vinculos e contribuicoes): https://meu.inss.gov.br | Carteira de Trabalho Digital: https://www.gov.br/trabalho-e-emprego/pt-br/servicos/carteira-de-trabalho-digital',
    '  * Score/negativacao do proprio CPF: https://www.serasa.com.br | https://www.boavistaservicos.com.br | https://www.quod.com.br | https://www.spcbrasil.org.br',
    '  * Certidao de situacao fiscal federal (PGFN): https://solucoes.receita.fazenda.gov.br/Servicos/certidaointernet/PF/Emitir',
    '- POR REQUERIMENTO (terceiro sem login): antecedentes PF (https://www.gov.br/pf/pt-br/assuntos/antecedentes-criminais), certidoes eleitorais TSE (https://www.tse.jus.br/servicos-eleitorais/certidoes), CNDT/TST (https://www.tst.jus.br/certidao).',
    '- Regra LGPD: rotas de PROPRIO TITULAR sem autorizacao sao vedadas; as de TERCEIRO acima sao publicas e legais - sempre registre data/hora da consulta.',
    'ATALHOS NACIONAIS (consulta por tribunal):',
    '- PJe navegador (todos os tribunais PJe): https://www.pje.jus.br/navegador/',
    '- PJe CNJ consulta publica: https://sustentacao.cloud.cnj.jus.br/pjecnj/ConsultaPublica',
    '- Lista oficial de tribunais: https://www.cnj.jus.br/poder-judiciario/tribunais/',
    '- Justica Federal (foruns): https://www.jfsp.jus.br/foruns-federais/',
    'ROTAS POR TRIBUNAL (validadas na pratica):',
    '- TJSP: e-SAJ cpopg - esaj_buscar (HTTP) por nome/documento; consultar processo via formulario (esaj_tjsp_guia); ANONIMO SUPRIME criminais.',
    '- TJSC: eproc 1g/2g POR BROWSER (Turnstile: recarregar a pagina e resubmeter resolve); nao funciona via HTTP puro.',
    '- TJBA: PJe consulta publica (captcha slider manual a cada busca).',
    '- TJPI: e-TJPI 2a instancia por documento; 1o grau exige login gov.br no PDPJ.',
    'TECNICAS (como buscar):',
    '1. ANTI-HOMONIMOS (PROIBICAO): valide por (a) fonte chaveada por CPF, (b) CPF embutido em registro (ex.: razao social de CNPJ), (c) qualificacao judicial (nascimento, genitora, RG), (d) mascara de CPF compativel, (e) contexto (cidades+profissao+familiares co-reus). Sem isso: PROIBIDO atribuir o achado ao pesquisado - classifique "possivel homonimo", fora da lista principal.',
    '2. QUEBRA DE MASCARA: NNNXXXX-DD -> 10.000 combinacoes -> DV CNJ (Res. 65/2008, ISO 7064 MOD 97-10) deixa ~103 validos -> UMA query terms no DataJud -> fingerprint -> confirmacao tripla (datas exatas + numeros de origem + e-SAJ). Ferramenta: cnj_desmascarar.',
    '3. FINGERPRINT: orgao julgador + classe + assunto + datas de movimentacao contra os metadados da fonte que mascarou.',
    '4. INTIMACOES DJEN: busque pelo nome da parte; textos integrais revelam fatos, enderecos e numeros de processos correlatos.',
    '5. CRUZAMENTO DE DATAS: data de ultima movimentacao e distribuicao devem bater EXATAS entre fontes.',
    '6. EVIDENCIAS: salve o HTML/PDF bruto, registre data/hora da consulta e a cadeia de confirmacao.',
    '7. CRUZAMENTO EMPREGOS x PROCESSOS: vinculos de trabalho aparecem em processos trabalhistas (TRT: empregador + periodo), no QSA/CNPJ (brasilapi_cnpj) e nas sentencas integrais do DJEN; cruze empregador x periodo x processo - ex.: reclamante de TRT contra o empregador na mesma epoca em que o QSA o lista como socio. Cada cruzamento cita empregador, CNPJ e periodo.',
    '8. RELACIONAMENTOS (pais, filhos, irmaos, conjuge): extraia da QUALIFICACAO JUDICIAL nos autos (genitora, genitor, data de nascimento) e dos textos integrais do DJEN; parente entra no dossie SO com ancora propria - mesmo sobrenome NAO e vinculo (homonimo de parente tambem e PROIBIDO).',
    'ETICA/LEGAL:',
    '- Use apenas fontes publicas; nao contorne paywall; LGPD (Lei 13.709/2018) com minimizacao.',
    '- Proteja vitimas de violencia domestica (Lei 11.340/2006) e NUNCA identifique menores (ECA).',
    '- Presuncao de inocencia (CF art. 5, LVII) para recursos pendentes; relatorios de uso interno; nada de assedio ou exposicao.'
  ].join('\n');
}

async function toolGuiaNavegacao() {
  return [
    'REGRAS E PROMPTS DO MANTENEDOR (ler ANTES de gerar relatorio/documento):',
    '- Master Rules (protocolo central, ponto de partida obrigatorio): https://drive.google.com/file/d/1h9sjA3ZfBFGiczqyy8HjsZjaUzI4nYIo/view',
    '- Pasta de regras (LLMs): https://drive.google.com/drive/folders/1U5U9QNx__hVio5GTKSVflZP9-b_E0OLm',
    '- Prompt 8.5 ("Criar um post" - padrao de relatorio/conteudo): https://docs.google.com/document/d/1hRoAQEZnKufWdUnzwTxuuwjbAA05sAfTf2oY1MnIky4/edit',
    '  Resumo do padrao 8.5: TL;DR de 3 bullets no topo; pattern interrupt curto (ate 15 palavras, sem exclamacao); titulos em forma de pergunta (H2) com resposta de 40-60 palavras; zero caracteres decorativos/emojis; FAQ ao final; PT-BR.',
    '',
    'NAVEGACAO POR BROWSER AUTOMATIZADO (quando HTTP puro falha: captcha, JS, login):',
    '- Cliente: MCP Playwright (@playwright/mcp) - ferramentas browser_navigate, browser_snapshot, browser_find, browser_click, browser_type, browser_fill_form, browser_select_option, browser_network_requests, browser_take_screenshot, browser_evaluate.',
    '- Fluxo padrao: (1) browser_navigate ate a URL; (2) browser_snapshot para ver a acessibilidade da pagina; (3) browser_find para localizar o campo/botao; (4) browser_type/browser_fill_form para preencher; (5) browser_click para submeter; (6) browser_snapshot/browser_find para ler o resultado.',
    '- CAPTCHAS: nao contorne - deixe o usuario resolver manualmente na tela (e-SAJ por nome, TJBA slider, Receita) e siga depois dele resolver.',
    '- Armadilhas validadas: acesso DIRETO a URL de processo do e-SAJ (show.do) falha com "Nao foi possivel validar o seu acesso" - abra SEMPRE a partir da lista de resultados ou do formulario (ver esaj_tjsp_guia).',
    '- Turnstile/Cloudflare (ex.: eproc TJSC): recarregar a pagina e resubmeter costuma resolver.',
    '- Outros navegadores uteis: browser_tabs (multi-abas), browser_navigate_back, browser_wait_for (esperar texto carregar), browser_press_key.',
    '',
    'MCPS COMPANHEIROS - AUTOINSTALACAO (nada e pre-instalado: o npx/uvx baixa na primeira execucao):',
    '- Playwright (browser automatizado, oficial Microsoft): comando "npx -y @playwright/mcp" - autoinstala o pacote; na PRIMEIRA execucao baixa o browser Chromium (demora varios minutos, so acontece uma vez). Resolve sites com captcha/JS: e-SAJ, TSE, Receita, infoRegistro.',
    '- DuckDuckGo (busca web SEM chave): comando "uvx duckduckgo-mcp-server" - exige o Python uv (Windows: scoop install uv; ou pip install uv). Ferramentas: search, fetch_content, expand_link.',
    '- anymd (leitor de PDFs/docs -> Markdown): comando "npx -y @sylphx/anymd" (Rust local, sem chave). Ferramentas: anymd_read, anymd_search, anymd_outline, anymd_inspect.',
    '- datajud dedicado (alternativa Node compilada): "node ~/.mcp-servers/datajud-mcp-server/dist/index.js" com env TRANSPORT=stdio.',
    '- Tavily (busca profunda, 1000 creditos/mes gratis): remoto "https://mcp.tavily.com/mcp/?tavilyApiKey={env:TAVILY_API_KEY}" - chave em https://app.tavily.com.',
    '- Firecrawl (scraping profundo, 500 crawls gratis): "npx -y firecrawl-mcp-server" com env FIRECRAWL_API_KEY - chave em https://firecrawl.dev.',
    '- Exa (busca neural): ja embutido aqui (exa_buscar, env EXA_API_KEY) OU "npx -y exa-mcp-server" - chave em https://exa.ai.',
    '- Perplexity (remoto): "https://mcp.perplexity.ai/mcp" - rodar "opencode mcp auth perplexity" uma vez.',
    '- REGRA: o escrivao cobre DataJud/DJEN/e-SAJ/CNPJ/mascara CNJ - NAO duplique essas funcoes em outro MCP; os companheiros entram como recursos complementares.',
    '',
    'MCPS DE ENRIQUECIMENTO POR CPF/CNPJ (externos - verifique LGPD/custos antes de usar):',
    '- MCP Brasil (70 APIs publicas: BrasilAPI/CNPJ, DataJud, TSE bens de candidatos, sancoes do Portal da Transparencia, TCU, imoveis da Uniao): https://github.com/Mcp-Brasil/mcp-brasil | uvx --from mcp-brasil python -m mcp_brasil.server',
    '- ONR/RI Digital (OFICIAL: Pesquisa Nacional de Bens por CPF/CNPJ, Pesquisa Qualificada, Consulta de Indisponibilidade de Bens; creditos pre-pagos): https://ridigital.org.br',
    '- ONR Mapa do Registro de Imoveis (conector MCP de terceiros, creditos pre-pagos): https://api.mcp.ai/p_onr_mapa_registro_imoveis',
    '- mcp.ai Consultas (situacao cadastral CPF/CNPJ, Simples/MEI, SINTEGRA, certidoes CND Federal/CNDT/FGTS, TCU, sancoes OFAC/ONU/ICIJ; creditos pre-pagos): https://mcp.ai/consultas',
    '- mcp-fiscal-brasil (CNPJ, CPF, Simples Nacional, NF-e, certidoes, due diligence de fornecedores): https://github.com/DeHor-Labs/mcp-fiscal-brasil',
    '- mcp-dadosbr (OSINT: CNPJ, CEP, processos, contratos governamentais, indicadores): https://github.com/cristianoaredes/mcp-dadosbr',
    '- apipj (dados cadastrais de CNPJ): https://apipj.com.br/mcp',
    '- CPFHub (CPF: nome, genero, situacao cadastral na Receita Federal): https://www.cpfhub.io',
    '- lakebrasil-mcp (153 ferramentas: Transparencia, TCU, DataJud, portais de dados abertos): https://glama.ai/mcp/servers/r4szqk0atg',
    '- brasil-data-mcp (BrasilAPI sem chave: CNPJ, CEP, corretoras CVM, IBGE, feriados, dominios .br): https://github.com/alanpcf/brasil-data-mcp',
    '- OpenCNPJ/OpenCEP (empresas e enderecos): https://lobehub.com/mcp?q=brazil',
    '- CNJ SEEU - processos (servidor HOSPEDADO de terceiros): https://glama.ai/mcp/servers/z3jfob1ic1',
    '- Catalogos para descobrir mais MCPs brasileiros: https://glama.ai | https://smithery.ai | https://lobehub.com/mcp?q=brazil | https://mcp.so/tags/brazil',
    '- SEGURANCA/LGPD: servidores HOSPEDADOS recebem o que voce consulta - para dados sensiveis rode LOCAL os de codigo aberto (mcp-brasil, mcp-dadosbr, brasil-data-mcp, brasil-api-mcp). O mcp-dadosbr expoe mandados do BNMP (dados publicos do CNJ). Lista completa dos 31 catalogados em regras/links.txt.',
    '',
    'OSINT DE REDES SOCIAIS E CONTATO (nome, e-mail e telefone -> perfis; complementam o dossie):',
    '- MCPS PRONTOS (registre ao lado do escrivao):',
    '  * sherlock-mcp (username em 400+ redes sociais, via MCP): https://github.com/Burnsedia/sherlock-mcp',
    '  * osint-mcp-server (37 ferramentas/12 fontes: Sherlock + Osintgram/Instagram profundo): https://github.com/pasing-group/osint-mcp-server',
    '  * osint-mcp (26 ferramentas OSINT gratuitas expostas como MCP): https://pypi.org/project/osint-mcp/',
    '  * Catalogo curado de MCPs OSINT: https://github.com/soxoj/awesome-osint-mcp-servers',
    '- FERRAMENTAS CLI VALIDADAS (rode LOCAL; dados sensiveis nao saem da maquina):',
    '  * sherlock (username em 400+ redes): https://github.com/sherlock-project/sherlock',
    '  * social-analyzer (nome/username em 1000+ sites; API, CLI e web): https://github.com/qeeqbox/social-analyzer',
    '  * holehe (e-mail -> conta registrada em 120+ sites via recuperacao de senha): https://github.com/megadose/holehe',
    '  * maigret (username -> DOSSIER de 6K sites, gera relatorio HTML proprio): https://github.com/soxoj/maigret',
    '  * GHunt (conta Google a partir do e-mail): https://github.com/mxrch/GHunt',
    '  * mosint (e-mail: vazamentos, redes, servidores): https://github.com/alpkeskin/mosint',
    '  * phoneinfoga (telefone: carreira, reputacao, social, google hacking): https://github.com/sundowndev/phoneinfoga',
    '  * osint-toolkit (combo: Sherlock+Maigret+GHunt+Holehe+Ignorant+Telegram): https://github.com/d4t4n3rdsec/osint-toolkit',
    '  * omniscan (CLI unificada: username/e-mail/telefone -> todos os tools): https://pypi.org/project/omniscan/',
    '- REGRAS PARA O DOSSIE: perfil achado por nome/username/e-mail/telefone = POSSIVEL HOMONIMO ate cruzar com CPF/CNPJ (PROIBICAO vale); redes sociais e curriculo sao dados AUTODECLARADOS (nota de credibilidade, nunca CONFIRMADO so por eles); "quao seguro e o usuario" responde com vazamentos (holehe/mosint/H8mail) e exposicao publica - indicativo, nunca sentenca. LGPD: uso investigativo com fontes publicas.',
    '',
    'OSINT INTERNACIONAL / POR PAIS (pesquisado brasileiro no exterior - o CPF NAO indexa fora do Brasil; ancora = NOME EXATO + registros locais):',
    '- OSINT in the Countries (base estruturada por pais: registros governamentais, empresas, telecom, buscadores, datasets, arcabouco legal de cada pais): https://github.com/OSINT-for-countries',
    '- X-osint (CLI Termux/Linux: telefone, e-mail, VIN, subdominios, e-mail a partir do nome): https://github.com/TermuxHackz/X-osint',
    '- Topicos GitHub (descoberta continua de ferramentas OSINT): https://github.com/topics/osint-tools e https://github.com/topics/open-source-intelligence',
    '- Maltego (COMERCIAL de grafos de vinculos/link analysis; Basic gratuito com Graph CE, Entry Standard EUR 3.000/ano, Professional EUR 7.500/ano): https://www.maltego.com/pricing/',
    '- ROTAS VALIDADAS EM SESSAO REAL: Irlanda - CORE/CRO empresas+inelegidos (core.cro.ie), insolvencia ISI (isi.jahs.ie/public/cases, nome exato), High Court (courts.ie/high-court-search; resultados client-side - varra as paginas RENDERIZADAS), registro eleitoral (checktheregister.ie; WAF 403 para browser automatizado = consulta manual). Reino Unido - Companies House (find-and-update.company-information.service.gov.uk; empresas e officers). Global - Interpol Red Notices (site interpol.int; API ws.interpol.int instavel por HTTP), OpenSanctions (opensanctions.org), Wayback CDX (web.archive.org/cdx/search/cdx).',
    '- FUSO HORARIO VIA COMMITS (proxy de localizacao): o patch bruto de um commit do GitHub (github.com/usuario/repo/commit/SHA.patch) traz o offset local da maquina do autor (ex.: -0300 = Brasilia, +0100 = Irlanda no verao) - indicio publico, nunca prova (VPN existe).',
    '- LIMITE ESTRUTURAL (declare no dossie): passaporte, vistos, PNR e SIS sao dados ESTATAIS - nenhuma via publica gratuita os expoe, no Brasil ou na UE; emprego CLT no exterior nao tem CAGED equivalente publico; GDPR vigora na UE.',
    '',
    'LINKS EXTERNOS (recursos de apoio):',
    '- Escavador (agregador, paywall): https://www.escavador.com',
    '- Jusbrasil: https://www.jusbrasil.com.br',
    '- DataJud docs/chave: https://datajud-wiki.cnj.jus.br/api-publica/acesso/',
    '- PJe consulta publica: https://sustentacao.cloud.cnj.jus.br/pjecnj/ConsultaPublica e https://www.pje.jus.br/navegador/',
    '- DJEN API: https://comunicaapi.pje.jus.br/api/v1/comunicacao',
    '- BrasilAPI: https://brasilapi.com.br',
    '- Olho Juridico: https://olhojuridico.com/consulta-processual',
    '- Consulta CPF/CNPJ gratuitos (repos): https://github.com/jansenfelipe/cpf-gratis e https://github.com/TechThings/consultasbr',
    '- Playwright MCP: https://github.com/microsoft/playwright-mcp',
    '- DuckDuckGo MCP: https://github.com/pleary/python-mcp-duckduckgo (ou pacote duckduckgo-mcp-server no PyPI)',
    '- Busca semantica/repos de referencia: https://github.com/topics/semantic-search e https://github.com/jonas-elias/jurisprudencia-sc-busca-semantica',
    '- BUSCA SEMANTICA (links validados do mantenedor):',
    '  https://github.com/topics/semantic-search (topic geral) | https://github.com/topics/semantic-search?l=html&o=desc&s=updated (HTML) | https://github.com/topics/semantic-search?l=java (Java) | https://github.com/topics/semantic-search-algorithm | https://github.com/topics/pdf-semantic-search',
    '  https://github.com/smkbarbosa/context-ia-manager | https://github.com/edilsonmaia/searchme | https://github.com/DaniloCorreia1/semantic_search | https://github.com/jonas-elias/jurisprudencia-sc-busca-semantica (jurisprudencia TJSC)',
    '  https://docs.crewai.com/v1.15.28/pt-BR/tools/search-research/githubsearchtool (CrewAI GithubSearchTool) | https://manticoresearch.com/blog/github-semantic-search/ | https://help.vtex.com/pt/docs/tutorials/intelligent-search-busca-semantica-beta',
    '',
    'MODULOS DE PYTHON (quando o agente precisar de script local):',
    '- requests: HTTP simples (GET/POST em APIs como DataJud, DJEN, BrasilAPI) - sempre com timeout e headers de navegador.',
    '- playwright (pip install playwright + playwright install): automacao de browser fora do MCP - sync_playwright para scripts pontuais; reutilize os seletores CSS das guias (esaj_tjsp_guia).',
    '- pandas: ler/consolidar CSVs de resultados (ex.: export de consulta por nome).',
    '- python-docx / reportlab: gerar documentos de saida quando HTML nao basta.',
    '- Padrao anti-bloqueio: User-Agent de navegador, timeout generoso (TJSP responde lento), retry com espera (3-5s) e nunca paralelismo agressivo contra portais publicos.',
    '- O servidor Node (server.js) cobre o dia a dia sem Python; use scripts Python apenas para ETL/exportacao/relatorios, nunca duplicando ferramenta que ja existe aqui (regra de pasta unica).'
  ].join('\n');
}

async function toolGuiaRelatorios(a) {
  const escopo = String((a && a.escopo) || '').trim().toLowerCase();
  if (escopo === 'exclusivo cpf' || escopo === 'exclusivo_cpf' || escopo === 'dossie exclusivo') {
    return [
      'NORMAS DO MODO "DOSSIE EXCLUSIVO POR DOCUMENTO" (guia_relatorios escopo="exclusivo cpf"):',
      '1. O dossie e EXCLUSIVO do documento validado pelo cliente (CPF/CNPJ informado). Toda a lista principal e ancorada nesse documento.',
      '2. PADRAO NEGATIVO - HOMONIMOS: NAO publique secao de homonimos/descartados. Crie "Descartados (possiveis homonimos)" SOMENTE se o cliente pedir com essas palavras. Achado sem documento que bata fica FORA do relatorio (nem em anexo, nem em nota) - no maximo anote internamente.',
      '3. PADRAO NEGATIVO - TERCEIROS: nenhum CPF, nome ou dado de terceiro em texto integral no dossie; terceiros (empregadores, socios, co-reus, familiares) entram SO como contexto minimo com fonte, e familiares somente com ancora propria.',
      '4. Antes de entregar, PERGUNTE ao cliente: "deseja incluir a secao de descartados (possiveis homonimos)?" - o default e NAO.',
      '5. Niveis: CONFIRMADO so com o documento do pesquisado batendo; sem documento, PROVAVEL no maximo (fingerprint); homonimo, nada.',
      '6. Ciclo PF<->PJ completo: ciclo_pf_pj (CPF acha CNPJs vinculados / CNPJ acha CPFs do QSA) antes de fechar a analise.',
      '7. Checklist final: ( ) nada de homonimo publicado; ( ) nenhum dado de terceiro em texto integral; ( ) pendencias com proximo passo; ( ) data de geracao no rodape.',
      '8. Ficha de identificacao: campos do pesquisado (nome+variacoes, nascimento, genitora/genitor, filhos maiores, documentos descobertos, ultimo endereco valido de registro publico, telefones, e-mails) com fonte e nivel - tecnica dos 4 campos-chave (nome+CPF+nascimento+nome da mae) e fontes por campo no guia_dossie FASE 1B.',
      '9. Montagem: links de perfil sempre clicaveis (target="_blank" rel="noopener noreferrer"); secao sem dado nenhum NAO existe no relatorio (nem card de "por que nada aparece") - a ausencia fica na resposta curta da secao ou nas pendencias.',
      'Guia tecnico completo (HTML, secoes, WCAG, temas): chame guia_relatorios sem escopo.'
    ].join('\n');
  }
  return [
    'OBRIGACAO (padrao 8.5 + master_rules.md): todo relatorio/dossie gerado com dados deste servidor segue OBRIGATORIAMENTE o padrao 8.5 E as estruturas do master_rules.md adaptadas ao HTML estatico (SEM PHP). CONTEUDO INTEGRAL dos .md: ferramenta regras_ler (whitelist: master_rules, prompt_8_5) - se a pasta regras/ nao existir na instalacao (instalacao so-server.js), monte pelo RESUMO deste guia, que e autocontido. AVISO: o prompt_8_5 original e GENERICO de blog/YouTube (thumbnail, hashtags, monetizacao) - use dele apenas o que aplicavel ao dossie (Answer Target, FAQ, temas claro/escuro, CSS sem duplicatas).',
    'ORDEM OBRIGATORIA DE MONTAGEM DO HTML: (1) PRIMEIRO monte a pagina aplicando os .md aplicaveis da pasta regras/, comecando pelo master_rules.md (semantica W3C, WCAG AA, temas claro/escuro com persistencia, CSS sem duplicatas, zero alert, PT-BR); (2) DEPOIS finalize o CONTEUDO com o padrao do prompt 8.5 (regras/prompt_8_5.md): TL;DR de 3 bullets, titulos em forma de pergunta com resposta de 40-60 palavras, FAQ ao final, zero emojis.',
    'FORMATO PADRAO: UM unico arquivo HTML autocontido - apenas HTML, CSS e JS INTERNOS (tags <style> e <script> embutidas), sem PHP, sem arquivos separados, sem CDN - abrindo offline; outro formato (PDF, DOCX etc.) SOMENTE quando o usuario pedir explicitamente.',
    '',
    'TECNICAS DE RELATORIO (validadas na pratica - dossies de investigacao judicial):',
    '',
    '1. FORMATO: HTML UNICO AUTOCONTIDO',
    '- UM arquivo .html com CSS e JS EMBUTIDOS (tags <style> e <script> internas); NUNCA PHP, nunca arquivos separados, nunca CDN externo - o relatorio abre offline em qualquer navegador.',
    '- <meta charset="utf-8"> obrigatorio; titulo com nome do pesquisado e data de geracao no <title> e no cabecalho.',
    '- Estrutura semantica: <header>, <nav> com ancora por secao, <main>, <section id> por tema, <footer> com data/hora da geracao e aviso de uso interno.',
    '- ESTRUTURAS OBRIGATORIAS DO master_rules.md ADAPTADAS AO RELATORIO (sem PHP):',
    '  * Semantica W3C: <main>, <section>, <article> (alem de <header>/<nav>/<footer>).',
    '  * Acessibilidade: ARIA labels e WCAG AA - contraste garantido (fundo escuro -> fonte clara; fundo claro -> fonte escura) em todos os estados.',
    '  * Temas claro E escuro: obrigatorios, com alternancia dinamica (botao no cabecalho) e persistencia via localStorage.',
    '  * JS interno: ZERO alert()/confirm()/prompt() - aviso via showToast() (toast em CSS/JS embutidos).',
    '  * CSS sem duplicatas: cada seletor em um bloco unico; duplicatas aceitaveis apenas para dark mode ([data-theme="dark"]), media queries e pseudo-classes (:hover/:focus).',
    '  * Titulos <h2> em forma de pergunta com resposta direta de 40-60 palavras logo abaixo (Answer Target do master_rules + prompt 8.5).',
    '  * Idioma: PT-BR obrigatorio em todo o relatorio.',
    '',
    '2. PADRAO DE CONTEUDO (adaptacao do prompt 8.5 ao dossie):',
    '- Cabecalho: TL;DR com 3 bullets (total de registros, confirmacoes, pendencias).',
    '- Cada secao com titulo em forma de PERGUNTA seguida de resposta curta e direta (40-60 palavras) antes do detalhe.',
    '- Zero emojis/unicode decorativo; linguagem objetiva em PT-BR.',
    '- FAQ ao final: perguntas que o leitor faria (quantos confirmados? qual o proximo passo? o que nao foi possivel verificar?).',
    '',
    '3. TABELAS DE PROCESSOS (o coracao do relatorio):',
    '- Colunas padrao: numero CNJ | tribunal/foro | classe | assunto | orgao julgador | data ajuizamento | status | fonte | nivel de confirmacao.',
    '- Nivel de confirmacao em 3 graus: CONFIRMADO (CPF/CNPJ do pesquisado batendo exatamente na fonte), PROVAVEL (sem documento, mas fingerprint orgao+classe+assunto+datas coerente), POSSIVEL HOMONIMO (sem ancora por documento - PROIBIDO incluir na lista principal; secao separada). Regra: sem documento cruzado, nunca CONFIRMADO e PROIBIDO apresenta-lo como sendo do pesquisado.',
    '- Numeros mascarados da fonte original exibidos AO LADO do numero desmascarado (cadeia de evidencia).',
    '- JS interno: filtro por status e busca textual na pagina (input + listener em todas as linhas da tabela via data-attributes).',
    '',
    '4. SECOES OBRIGATORIAS DO DOSSIE (monte TODAS que tiverem dados; sem dados, declare a ausencia nas pendencias):',
    '   a) Redes sociais: perfis achados por NOME/E-MAIL/TELEFONE/username (ferramentas em guia_navegacao) - sempre com a nota: dado AUTODECLARADO, credibilidade menor que registro publico.',
    '   b) Processos relacionados ao CPF: a tabela principal (secao 3) ancorada no documento validado pelo usuario.',
    '   c) PADRAO NEGATIVO - HOMONIMOS: NAO publique secao de homonimos/descartados. Crie "Descartados (possiveis homonimos)" SOMENTE se o cliente pedir com essas palavras. O dossie e EXCLUSIVO do documento validado; terceiros so entram com documento proprio E pedido do cliente - sem isso, fora do relatorio (nem em anexo).',
    '   d) Curriculo declarado: formacao, empregos e experiencias declaradas pelo proprio pesquisado (LinkedIn, redes sociais, sites) - marcadas como AUTODECLARADO, separadas do que o registro publico comprova.',
    '   e) Tabela de processos: a secao 3 (o coracao do dossie).',
    '   f) Cruzamento entre empregos e processos: para cada vinculo de trabalho (processos trabalhistas revelam empregador+periodo; QSA/CNPJ revela societario; CNIS quando disponivel), cruzar empregador x periodo x processo - ex.: reclamante de TRT contra ex-empregador no mesmo periodo em que consta do QSA; socio de CNPJ que figura em processo da empresa. Cada cruzamento cita empregador, CNPJ e periodo.',
    '   g) Analise de perfil do usuario: sintese de QUEM E (ocupacao, circulos, padroes) cruzando registro publico + redes sociais + curriculo - cada afirmacao com fonte.',
    '   h) Quao seguro e o usuario: exposicao digital (e-mail/telefone em vazamentos via holehe/mosint/H8mail; dados expostos em redes; credenciais vazadas) e indicadores de risco (processos, negativacao) - sempre com ressalva: INDICATIVO, nao sentenca.',
     '   i) Relacionamentos (parentes): pais, filhos, irmaos, conjuge e demais parentes SO com ancora propria (qualificacao judicial nos autos: genitora/genitor, nascimento; textos integrais do DJEN citam parentes) - cruzar sempre que possivel (ex.: genitora citada nos autos + processo conjunto). Parente sem ancora: fora do relatorio - mesmo sobrenome NAO e vinculo.',
     '   j) Ficha de identificacao: nome completo e variacoes, data de nascimento, genitora/genitor, filhos (maiores), documentos descobertos (CPF/RG/titulo de eleitor/passaporte), ultimo endereco valido de registro publico, telefone(s) e e-mail(is) - cada campo com fonte e nivel (fontes por campo: guia_dossie FASE 1B).',
     '   k) Perfis digitais: TODO link de perfil CLICAVEL e abrindo em nova aba - <a href="URL" target="_blank" rel="noopener noreferrer">.</a>',
     '   REGRA DE SECOES VAZIAS (22/10/2026): secao sem NENHUM dado (confirmado ou possivel) NAO existe no relatorio - nem a secao, nem card explicando a ausencia ("por que nenhuma empresa aparece"). A ausencia se declara em UMA linha na resposta curta da secao ou nas pendencias.',
    '',
    '5. SECAO DE PENDENCIAS OBRIGATORIA:',
    '- Tudo que ficou sem numero, sem confirmacao ou sem fonte acessivel - com o PROXIMO PASSO concreto de cada item (ex.: busca por nome no e-SAJ com captcha manual; ProJudi TJPR; certidao de distribuicao).',
    '- Erros de consulta (fonte fora, HTTP 504/403, bloqueio) entram como pendencia com data/hora da tentativa - e a checagem anti-homonimo NAO relaxa: o aviso de PROIBICAO/ciclo PF<->PJ vem anexado ao proprio erro.',
    '- Contadores no topo: identificados vs. pendentes vs. descartados.',
    '',
    '6. CADEIA DE EVIDENCIA E AUDITORIA:',
    '- Cada afirmação cita a fonte (API/portal/data-hora da consulta); salve HTML/PDF bruto das consultas-chave.',
    '- Confirmacao tripla antes de marcar CONFIRMADO: datas EXATAS batendo entre 2+ fontes + numero de origem + verificacao em segunda base (ex.: DataJud + e-SAJ + DJEN).',
    '- PROIBIDO misturar achados de homonimos com os do pesquisado - homonimo nunca entra na tabela principal; secoes separadas com aviso.',
    '',
    '7. ANTI-HOMONIMOS (PROIBICAO de homonimo na lista principal):',
    '- Prioridade SEMPRE: CPF/CNPJ exato > documento embutido em registro (razao social de CNPJ) > qualificacao judicial (nascimento, genitora, RG) > mascara de CPF compativel > contexto (cidade+profissao+familiares co-reus).',
    '- Busca por nome: SEMPRE entre aspas duplas ("NOME COMPLETO") no DataJud; varrer varios tribunais (datajud_varrer) e cruzar.',
    '- PADRAO NEGATIVO: sem pedido EXPLICITO do cliente, NENHUMA secao de homonimos/descartados no relatorio (item 4c); pergunte ao cliente antes de incluir qualquer descarte.',
    '',
    '8. ETICA NO RELATORIO:',
    '- Presuncao de inocencia para recursos pendentes (CF art. 5, LVII); NUNCA identificar menores (ECA); proteger vitimas de violencia domestica (Lei 11.340/2006).',
    '- Aviso no rodape: uso interno, dados de fontes publicas, LGPD (Lei 13.709/2018).',
    '- Familiares: incluir somente com documento/ancora propria, nunca por conjetura.',
    '',
    '9. CHECKLIST FINAL ANTES DE ENTREGAR:',
    '( ) todos os numeros CNJ validados (cnj_validar); ( ) niveis de confirmacao marcados; ( ) pendencias com proximo passo; ( ) filtro/busca JS funcionando; ( ) data de geracao no rodape; ( ) nenhum dado de homonimo na lista principal (PROIBICAO); ( ) nenhuma secao de homonimo publicada, salvo pedido EXPLICITO do cliente; ( ) nenhum CPF/nome/dado de terceiro em texto integral; ( ) ciclo PF<->PJ executado (ciclo_pf_pj: CPF achou CNPJs vinculados / CNPJ achou CPFs do QSA); ( ) arquivo abre offline.',
    '',
    'REUSO: este servidor NAO gera o HTML - o agente gera seguindo estas regras. Use fontes_osint (onde/como buscar), guia_navegacao (browser/instalacao) e este guia (como apresentar).'
  ].join('\n');
}

// --- regras_ler: conteudo integral dos .md da pasta regras/ (whitelist) ---
// Resolve a FALHA 1 do QA de 20/10/2026: agentes por protocolo nao leem filesystem.
// Whitelist obrigatoria: nenhum caminho arbitrario do servidor e acessivel.

const REGRAS_WHITELIST = {
  master_rules: 'master_rules.md',
  prompt_8_5: 'prompt_8_5.md'
};

async function toolRegrasLer(a) {
  const lista = Object.keys(REGRAS_WHITELIST).map(k => '- ' + k + '  (regras/' + REGRAS_WHITELIST[k] + ')').join('\n');
  let alvo = String((a && a.arquivo) || '').trim().toLowerCase();
  if (alvo.endsWith('.md')) alvo = alvo.slice(0, -3);
  if (!alvo) {
    return 'Use regras_ler({ arquivo: "<chave>" }) para o conteudo INTEGRAL dos .md de regras/. Whitelist (so estes - nenhum outro caminho do servidor e acessivel):\n' + lista +
      '\n\nAVISO: prompt_8_5.md e o prompt GENERICO de blog/YouTube (thumbnail, hashtags, monetizacao). As normas APLICAVEIS a dossie judicial (Answer Target, FAQ, temas claro/escuro, CSS sem duplicatas, secoes a-i) estao resumidas no guia_relatorios - ao ler o integral, use apenas o que aplicavel.' +
      '\n\nOrdem de montagem de dossie (padrao do servidor): (1) master_rules (estruturas/sintaxe); (2) guia_relatorios (adaptacao ao dossie + checklist); (3) prompt_8_5 apenas como referencia de conteudo.';
  }
  const arq = REGRAS_WHITELIST[alvo];
  if (!arq) throw new Error('Arquivo fora da whitelist: "' + alvo + '". Opcoes:\n' + lista);
  let texto;
  try {
    texto = fs.readFileSync(path.join(__dirname, 'regras', arq), 'utf8');
  } catch (e) {
    return [
      'A pasta regras/ NAO existe nesta instalacao (instalacao apenas-server.js via mcp_atualizar).',
      'COMO PROCEDER: (1) o RESUMO aplicavel ao dossie e autocontido no guia_relatorios - monte por ele;',
      '(2) para os .md integrais, clone o repo github.com/canalqb/escrivao-mcp (pasta regras/) e rode o server.js de dentro do clone.',
      'Detalhe tecnico: ' + String(e && e.code ? e.code : e)
    ].join('\n');
  }
  const LIMITE = 70000;
  let out = '=== regras/' + arq + ' (' + texto.length + ' chars) ===\n';
  if (alvo === 'prompt_8_5') out += 'AVISO: prompt generico de BLOG/YouTube - use apenas as secoes aplicaveis ao dossie (Answer Target, FAQ, temas, CSS sem duplicatas); ignore thumbnail/hashtags/monetizacao. Resumo adaptado: guia_relatorios.\n\n';
  if (texto.length > LIMITE) return out + texto.slice(0, LIMITE) + '\n\n[TRUNCADO em ' + LIMITE + ' de ' + texto.length + ' chars]';
  return out + texto;
}

// --- ciclo_pf_pj: o ciclo PF<->PJ inteiro em uma chamada ---
// Resolve a FALHA 3 do QA de 20/10/2026: o ciclo era lembrado mas executado
// pela metade. Aqui: DataJud multi-tribunal + e-SAJ DOCPARTE + DJE-SP +
// BrasilAPI (CNPJ->QSA) + receita reversa (CPF->CNPJ) + veredito unico.

function formatDocPf(n11) {
  return n11.slice(0, 3) + '.' + n11.slice(3, 6) + '.' + n11.slice(6, 9) + '-' + n11.slice(9);
}

function formatDocPj(n14) {
  return n14.slice(0, 2) + '.' + n14.slice(2, 5) + '.' + n14.slice(5, 8) + '/' + n14.slice(8, 12) + '-' + n14.slice(12);
}

async function toolCicloPfPj(a) {
  const doc = digitsOnly(a && a.cpf_cnpj);
  const docFormatado = doc.length === 11 ? formatDocPf(doc) : doc.length === 14 ? formatDocPj(doc) : '';
  if (!docFormatado) throw new Error('Informe cpf_cnpj: CPF (11 digitos) ou CNPJ (14 digitos) do pesquisado.');
  const tribunaisArg = a && a.tribunais ? a.tribunais : undefined;
  const partes = [];
  const erros = [];
  let varreduraOut = '', esajOut = '', djeOut = '', pjOut = '';

  try {
    varreduraOut = await toolDatajudVarrer({ consulta: '"' + docFormatado + '"', tribunais: tribunaisArg, tamanho: 10 });
    partes.push('=== 1. DataJud - documento entre aspas (varredura multi-tribunal) ===\n' + varreduraOut);
  } catch (e) { erros.push('DataJud: ' + String(e && e.message ? e.message : e).slice(0, 200)); }

  try {
    esajOut = await toolEsajBuscar({ nome_ou_doc: docFormatado, tipo: 'DOCPARTE' });
    partes.push('\n=== 2. e-SAJ TJSP - DOCPARTE (documento) ===\n' + esajOut);
  } catch (e) { erros.push('e-SAJ: ' + String(e && e.message ? e.message : e).slice(0, 200)); }

  try {
    djeOut = await toolDjeSpBuscar({ nome_ou_texto: '"' + docFormatado + '"', data_inicio: '01/10/2007', max_paginas: 2 });
    partes.push('\n=== 3. DJE-SP - documento entre aspas (base integral 01/10/2007 ate hoje) ===\n' + djeOut);
  } catch (e) { erros.push('DJE-SP: ' + String(e && e.message ? e.message : e).slice(0, 200)); }

  if (doc.length === 14) {
    try {
      pjOut = await toolBrasilapiCnpj({ cnpj: docFormatado });
      partes.push('\n=== 4. BrasilAPI - CNPJ (razao social + QSA) ===\n' + pjOut);
      const mascarados = [...new Set(String(pjOut).match(/\*{3}\.\d{3}\.\d{3}-(?:\*\*|XX|xx)/g) || [])];
      if (mascarados.length) {
        partes.push('\nQSA com CPF MASCARADO (' + mascarados.length + '): ' + mascarados.join(', ') + '\n-> quebre com cpf_desmascarar (loop 000-999 + DV + verificacao em lote no DataJud) e valide com o cliente quem e o pesquisado; apos validar, rode ciclo_pf_pj no CPF de cada socio relevante.');
      }
    } catch (e) { erros.push('BrasilAPI: ' + String(e && e.message ? e.message : e).slice(0, 200)); }
  } else {
    partes.push('\n=== 4. Ciclo PF->PJ (entrada e CPF) ===\nNao existe busca reversa CPF->CNPJ em API publica. RECEITA VALIDADA (QA 20/10/2026):\n(a) razoes sociais de ME/empresas individuais costumam EMBUTIR o CPF do titular ("NOME 12345678901 - ME") - procure o numero formatado em razoes sociais;\n(b) busca web: exa_buscar ou jusbrasil_buscar com \'"NOME COMPLETO" "CPF" CNPJ\';\n(c) com cada CNPJ achado: brasilapi_cnpj (QSA + razao social) e ciclo_pf_pj no CNPJ (processos da PJ + CPFs do QSA).');
  }

  const totaisDatajud = [];
  let somaDatajud = 0;
  for (const m of varreduraOut.matchAll(/^\[([a-z0-9]+)\] (\d+)(?: resultado|\b)/gim)) {
    const t = Number(m[2]);
    if (t > 0) { somaDatajud += t; totaisDatajud.push(m[1] + ': ' + t); }
  }
  const mEsaj = esajOut.match(/(\d+)\s*Processos?\s*encontrados?/i);
  const esajTotal = mEsaj ? Number(mEsaj[1]) : (/:\s*0 processos/i.test(esajOut) ? 0 : -1);
  const mDje = djeOut.match(/Total: (\d+) publicacoes/);
  const djeTotal = mDje ? Number(mDje[1]) : -1;

  let veredito = '\n=== VEREDITO DO CICLO (' + docFormatado + ') ===\n';
  veredito += '- DataJud por documento (' + (tribunaisArg ? String(tribunaisArg) : 'tribunais padrao') + '): ' + (totaisDatajud.length ? somaDatajud + ' hit(s) em ' + totaisDatajud.join(', ') : somaDatajud + ' hit(s)') + '\n';
  veredito += '- e-SAJ DOCPARTE: ' + (esajTotal < 0 ? 'nao lido' : esajTotal + ' processo(s)') + '\n';
  veredito += '- DJE-SP: ' + (djeTotal < 0 ? 'nao lido' : djeTotal + ' publicacao(oes)') + '\n';
  if (erros.length) veredito += '- FONTES COM ERRO (ver pendencias): ' + erros.join(' | ') + '\n';
  veredito += 'PROXIMOS PASSOS: valide cada numero com cnj_validar + datajud_processo; niveis de confirmacao em guia_relatorios; se 0 em tudo, registre o NEGATIVO como evidencia (controle positivo documentado) e amplie tribunais (datajud_varrer todos_tribunais) antes de concluir ausencia.';
  partes.push(veredito);
  partes.push(avisoAncora(docFormatado));
  return partes.join('\n');
}

async function toolGuiaInstalacao() {
  return [
    'GUIA DE INSTALACAO DO ZERO (para usuario ou agente sem Node e/ou sem este servidor):',
    '',
    '1. VERIFICAR O NODE (requisito: 18 ou superior):',
    '   node --version',
    '   Se imprimir v18/v20/v22+ esta tudo pronto. Se falhar ou for anterior a 18, instale (item 2).',
    '',
    '2. INSTALAR O NODE.JS NO WINDOWS 10/11 - WINGET (preferido; gerenciador oficial da Microsoft, ja presente no sistema atualizado):',
    '   winget install --id OpenJS.NodeJS.LTS -e --accept-source-agreements --accept-package-agreements',
    '   Sem winget? Instale o "Instalador de Aplicativo" (App Installer) pela Microsoft Store, ou baixe o MSI oficial em https://nodejs.org/en/download',
    '   Alternativas: choco install nodejs-lts -y   |   scoop install nodejs-lts',
    '',
    '3. INSTALAR O NODE.JS NO LINUX / MACOS:',
    '   Debian/Ubuntu: sudo apt install -y nodejs   (repositorio antigo? use NodeSource: https://github.com/nodesource/distributions)',
    '   Fedora/RHEL: sudo dnf install -y nodejs',
    '   macOS: brew install node',
    '',
    '4. REINICIAR O TERMINAL APOS INSTALAR (o PATH so reconhece o node em sessoes novas) e conferir: node --version',
    '',
    '5. OBTER O SERVIDOR (arquivo unico, zero dependencias - nunca npm install; GIT NAO E OBRIGATORIO):',
    '   Com git (recomendado - traz tambem a pasta regras/):',
    '   git clone https://github.com/canalqb/escrivao-mcp.git',
    '   SEM git (rota oficial alternativa - so o servidor):',
    '   curl.exe -L -o server.js https://raw.githubusercontent.com/canalqb/escrivao-mcp/main/server.js   (Windows)',
    '   curl -L -o server.js https://raw.githubusercontent.com/canalqb/escrivao-mcp/main/server.js       (Linux/macOS)',
    '   PowerShell sem curl: Invoke-WebRequest -Uri https://raw.githubusercontent.com/canalqb/escrivao-mcp/main/server.js -OutFile server.js',
    '',
    '6. TESTAR SEM CLIENTE (stdin JSON-RPC):',
    '   echo {"jsonrpc":"2.0","id":1,"method":"tools/list"} | node server.js',
    '   Deve responder ' + TOOLS.length + ' ferramentas (contagem dinamica desta versao). Suite completa de teste no README (secao "Como valido o servidor sem cliente?").',
    '',
    '7. REGISTRAR NO CLIENTE MCP (apos o teste passar):',
    '   node <caminho-absoluto>/escrivao-mcp/server.js  -  receitas por cliente (opencode, kimi-code, Claude Desktop, Cursor) no README.',
    '   Windows: caminho com \\ entre pastas. Reinicie o cliente para o servidor subir.',
    '',
    '8. ATUALIZAR (qualquer instalacao, COM ou SEM git):',
    '   A rota oficial e a ferramenta mcp_atualizar - baixa o server.js direto do GitHub raw, guarda backup .bak e se substitui; NAO depende de git.',
    '   Em clone com git tambem vale: git pull. Reinicie o cliente apos atualizar.',
    '',
    'REGRAS DA CASA: zero dependencias, zero dados reais, Node 18+; todo relatorio segue o padrao 8.5 (ver guia_relatorios).'
  ].join('\n');
}

async function toolGuiaDossie(args) {
  const so = args && args.fase;
  const FASES = [
    ['FASE 0 - REGRA DOS PEDIDOS DO TITULAR (obrigatoria, validada em campo 2026-10-20/21)',
     'TODO pedido do titular da investigacao nesta sessao vira ETAPA EXECUTAVEL do protocolo: se ele pediu empresas em que trabalhou, o agente pesquisa vinculos empregaticios (fase 5); se pediu o artigo do crime, pesquisa enquadramento (fase 6); se pediu redes sociais, fase 5; se pediu numeros mascarados, fase 3. Nenhum pedido e respondido com "nao e possivel" antes de executar TODAS as rotas publicas gratuitas desta lista e declarar os limites com fonte.'],
    ['FASE 1 - ANCORA: SEMPRE POR DOCUMENTO, NUNCA POR NOME',
     '1. A busca e SEMPRE por CPF/CNPJ (datajud_por_cpf, esaj_buscar DOCPARTE, datajud_buscar com documento entre aspas) - precisao por documento, homonimo nunca na lista principal.',
     '2. CPF mascarado (ex.: QSA ***.123.456-**): cpf_desmascarar gera os candidatos com DV valido e verifica em lote no DataJud; o USUARIO escolhe o nome certo; dai em diante pesquisa-se SO pelo CPF.',
     '3. ciclo_pf_pj (1a chamada de todo dossie): DataJud multi-tribunal + e-SAJ DOCPARTE + DJE-SP + rota reversa CPF->CNPJ.',
      '4. LICAO DOE-SP (2026-10-21): CPF em listas de IPVA/dividas do Diario Oficial do Estado de SP vem em 14 digitos com PADDING de 3 zeros a esquerda (ex.: 00037542700871 = 375.427.008-71). ANTES de descartar um numero como invalido: remover o padding e validar o DV do CPF de 11 digitos - falso negativo real atrasou uma ancora de dossie. Validou? Ancorar no esaj_buscar DOCPARTE (palavra final).'],
    ['FASE 1B - FICHA DE IDENTIFICACAO DO PESQUISADO (pedido tipico do titular, validado 22/10/2026)',
     '1. Monte a ficha com TODOS os campos descobertos, cada um com FONTE e NIVEL: nome completo e variacoes; data de nascimento; genitora e genitor (nome de pai e mae); filhos (SO maiores; menores NUNCA); ultimo endereco VALIDO de registro publico; telefone(s) e e-mail(is) de contato; documentos descobertos (CPF, RG, titulo de eleitor, passaporte, CNH, CTPS).',
     '2. Fontes por campo: QUALIFICACAO JUDICIAL nos autos e textos integrais do DJEN (genitora/genitor, nascimento, endereco da epoca; djen_intimacoes por nome); QSA/CNPJ via brasilapi_cnpj (endereco comercial, telefone/e-mail de contato, frequentemente mascarados); DOE-SP por nome (listas de dividas/IPVA trazem nome+CPF+endereco; dje_sp_buscar); ONR/RI Digital (imoveis por CPF/CNPJ); redes sociais e LinkedIn bio (marque AUTODECLARADO).',
     '3. TECNICA DOS 4 CAMPOS-CHAVE (desbloqueio de documentos): os portais publicos de situacao cadastral e de titulos normalmente pedem NOME COMPLETO + CPF + DATA DE NASCIMENTO + NOME DA MAE. Quem tem os 4 campos desbloqueia consultas que o CPF sozinho nao abre (situacao cadastral da Receita exige data de nascimento; certidoes eleitorais pedem qualificacao completa). Descubra a genitora nos autos/DJEN ANTES de tentar essas rotas - e use os campos descobertos como ancora anti-homonimo.',
     '4. LGPD: enderecos/contatos de registro publico entram no dossie com fonte e data; endereco residencial ATUAL para vigilancia de pessoa permanece FORA de escopo (etica) - declare o limite quando o titular pedir.'],
    ['FASE 2 - CICLO PF<->PJ FORCADO (regra do mantenedor: CNPJ SEMPRE com o CPF)',
     '1. Com o CPF, procure TODOS os CNPJs vinculados (razao social costuma embutir iniciais+CPF; validar no BrasilAPI).',
     '2. Validou o CNPJ? Extraia o QSA (brasilapi_cnpj) e confira o CPF mascarado (ancora de bloco, ex. ***381258**).',
     '3. Com o CNPJ, extraia os CPFs do QSA e pesquise os processos DELES (datajud_por_cpf) - achados de terceiros do QSA so entram minimizados e sem dados pessoais.',
     '4. Controle negativo: 0 processos da PJ tambem e EVIDENCIA - documente (tribunais consultados, data, fonte).'],
    ['FASE 3 - MASCARAS DE PROCESSO: LOOP CNJ + CONTRA-PROVA',
     '1. Toda mascara de agregador (Escavador/Jusbrasil/documentos) entra no cnj_desmascarar com consultar_datajud=true + cpf/nome para cruzamento.',
     '2. CONTRA-PROVA DEFINITIVA (aprendida 2026-10-21): se o feito for TJSP, o esaj_buscar DOCPARTE pelo CPF e a palavra final - se a mascara nao aparece por documento no e-SAJ, NAO e do pesquisado (homonimo), mesmo que o DataJud publico nao a tenha indexado ainda (processos novos atrasam).',
     '3. Marcado "SEM ANCORA" no loop = PROIBIDO publicar como sendo do pesquisado.',
     '4. Agregadores combinam 2-3+ homonimos por nome comum - o numero agregado deles NUNCA e o numero do dossie.'],
    ['FASE 4 - VARREDURA MULTI-TRIBUNAL E DIARIOS',
     '1. datajud_varrer por documento (default 11 principais; amplie com trt1,trt2,trt15,trf3 - varredura todos_tribunais pode dar timeout no TJSP: repita em janelas menores e documente a pendencia).',
     '2. dje_sp_buscar por nome (triagem interna; so publica com documento cruzado) e por NUMERO de processo (ancora unica, sem risco de homonimo).',
     '3. djen_intimacoes por nome: textos integrais citam processos correlatos e despachos - mina de ouro para desmascarar; homonimo exigido.'],
    ['FASE 5 - REDES SOCIAIS, CURRICULO DECLARADO E VINCULOS EMPREGATICIOS',
     '1. LinkedIn/web (exa_buscar, buscadores): classificar cada perfil como COMPATIVEL (coerente com CNAE/empresa/geografia, mas SEM documento = nao atribuir) ou DESCARTADO (historico incompativel). Publicar descartes apenas como lista resumida.',
     '2. VINCULOS EMPREGATICIOS (pedido tipico): (a) CONFIRMADO por ancora = apenas a propria empresa do QSA; (b) COMPATIVEL = cargos declarados em perfil publico, SEM nome de empregador; (c) controle negativo = 0 processos trabalhistas por CPF nos TRTs (so assim empregador aparece em via publica); (d) LIMITE DECLARADO: CAGED/Rais sao bases fechadas - nenhuma fonte publica gratuita lista empregadores CLT; escreva isso no dossie.',
     '3. Curriculo de agregadores (Beege etc.) e AUTODECLARADO - pode conter qualquer coisa; trate como hipotese a validar, nunca como fato.'],
    ['FASE 6 - DETALHES DO CRIME (quando ha feito criminal confirmado)',
     '1. Enquadramento: o artigo tipico vem da classe/assunto (ex. Furto = Art. 155 CP, Roubo = Art. 157 CP); o tipo exato (caput x majorado/qualificado) SO consta da denuncia nos autos.',
     '2. Rotas publicas para circunstancias: datajud_processo incluir_json=true (orgao de origem, mandados e resultado da citacao, cartas preocatorias, audiencias), esaj_buscar NUMPROC (partes, defesa, movimentacao integral), dje_sp_buscar por numero. O TEOR DA DENUNCIA nao e publico: exige autos (advogado) ou certidao de objetos e pendencias - declare a pendencia.',
     '3. Rito como hipotese: procedimento ORDINARIO em vara comum (em vez de sumarissimo/JECRIM) sugere circunstancias que afastam o juizado - MARCAR COMO HIPOTESE, nunca como fato.',
     '4. Presuncao de inocencia (CF art. 5, LVII) em toda linha do dossie; suspensao/andamento nunca e desfecho.'],
    ['FASE 7 - FAMILIARES E TERCEIROS',
     '1. Conjuges e filhos MAIORES podem ser citados e pesquisados; MENORES nunca (independe de pedido).',
     '2. Terceiros (familiares, vitimas, testemunhas) entram MINIMIZADOS (iniciais), sem dados pessoais, e so com ancora.'],
    ['FASE 8 - VALIDACAO DE CURRICULO/CERTIFICACOES (quando existir curriculo declarado)',
     '1. Curso superior: e-MEC (consulta publica de IES/cursos), registro em conselho profissional (CRM/CREA/OAB/CFA etc. - consultas publicas por nome).',
     '2. Certificacoes de TI/idiomas: so validar quando o emissor tem verificador publico; sem verificador = nao validavel por via publica (declarar).',
     '3. Cruzar curriculo x processos x empresas: incoerencia documentada e achado relevante.'],
    ['FASE 9 - MONTAGEM DO DOSSIE',
     '1. Dossie x METODO separados: tecnica de pesquisa NUNCA no dossie do documento (vive no relatorio de metodo); no dossie so dados + fontes.',
     '2. Template: HTML unico autocontido (CSS/JS internos, sem PHP), classes post-*, FontAwesome CDN, JSON-LD, nav por ancoras, filtro JS, tema claro/escuro, footer com data + LGPD + presuncao de inocencia; creditos: criacao = "Escrivao-MCP Gerenciamento de consultas publicas", CanalQb so como autor do prompt 8.5 e hospedador do MCP; titular = "titular da investigacao". Padrao v1.17.2: ordenacao por clique nos cabecalhos (th[data-sort] + aria-sort + suporte a teclado, locale pt-BR numerico) e impressao pericial (@page A4, break-inside:avoid em cards/tabelas/linhas, rodape de auditoria .print-footer-audit visivel so no PDF).',
     '3. Secoes: TL;DR 3 bullets com nivel; identidade (ancora dupla); CNPJs; redes/curriculo/vinculos; tabela de processos CONFIRMADOS com coluna de confirmacao; movimentacao integral; detalhes do crime; analise de perfil; pendencias COM proximo passo; fontes; FAQ. Zero emojis, PT-BR.',
     '4. Validar antes de entregar: parser HTML sem erros, JS sem erro de sintaxe, JSON-LD parseavel, grep de homonimos.'],
    ['FASE 10 - FECHAMENTO',
     '1. Pendencias com proximo passo concreto (uma por lacuna).',
     '2. Registro da sessao em log interno do projeto (nao no MCP - zero dados reais aqui).',
     '3. Niveis: CONFIRMADO (ancora de documento) / PROVAVEL (fingerprint) / POSSIVEL HOMONIMO (nunca na lista principal).']
  ];
  let out = FASES.map(f => f.join('\n')).join('\n\n');
  const header = 'PROTOCOLO DE DOSSIE COMPLETO POR DOCUMENTO (v1.18.1) - regra obrigatoria para TODOS os agentes que usam o escrivao. Execute as fases em ordem; nenhum pedido do titular fica sem resposta ou sem rota tentada. Fonte: sessoes reais 18-22/10/2026 (dossies validados). Zero dados reais neste texto.\n\n';
  if (so) { const f = FASES.find(x => x[0].indexOf(so.toUpperCase()) > -1); return header + (f ? f.join('\n') : 'Fase nao encontrada. Fases: 0,1,1B,2,3,4,5,6,7,8,9,10 (use fase="FASE 6" etc.).'); }
  return header + out + '\n\nVEJA TAMBEM: guia_relatorios (template/niveis), fontes_osint (protocolo anti-homonimo), guia_navegacao (browser), ciclo_pf_pj (execucao da fase 1-2).';
}

const TOOLS = [
  {
    name: 'cnj_validar',
    description: 'Valida um numero CNJ (Resolucao 65/2008, ISO 7064 MOD 97-10) e devolve o DV esperado, alem do tribunal detectado. Aceita formatado ou 20 digitos.',
    inputSchema: { type: 'object', properties: { numero: { type: 'string', description: 'Numero CNJ, ex.: 0001234-56.2024.8.26.0100' } }, required: ['numero'] },
    _run: toolCnjValidar
  },
  {
    name: 'cnj_desmascarar',
    description: 'Quebra numeros mascarados: recebe uma mascara com X (ex.: 000XXXX-XX.2024.8.26.0100), gera todos os candidatos com DV valido e verifica numa unica query terms quais existem no DataJud. LOOP: passe cpf (CPF/CNPJ) e/ou nome para cruzar os candidatos com o pesquisado - o resultado marca cada processo como VINCULO CONFIRMADO ou SEM ancora (PROIBIDO apresenta-lo como sendo do pesquisado - possivel homonimo). Vale para mascara de qualquer fonte (Jusbrasil, Escavador, documentos).',
    inputSchema: {
      type: 'object',
      properties: {
        mascara: { type: 'string', description: 'Mascara NNNNNNN-DD.AAAA.J.TR.OOOO com X nos digitos desconhecidos (ano/segmento/tribunal/foro devem ser conhecidos)' },
        consultar_datajud: { type: 'boolean', description: 'Se true, consulta o DataJud com os candidatos (default: false; passa a true quando cpf/nome informados)' },
        cpf: { type: 'string', description: 'CPF (11) ou CNPJ (14) do pesquisado - ativa o loop de cruzamento (ancora preferida)' },
        nome: { type: 'string', description: 'Nome exato do pesquisado - ancora secundaria quando nao houver documento' },
        limite: { type: 'number', description: 'Maximo de candidatos (default 200, max 2000)' }
      },
      required: ['mascara']
    },
    _run: toolCnjDesmascarar
  },
  {
    name: 'cpf_desmascarar',
    description: 'Quebra CPF mascarado com ate 3 digitos desconhecidos na base de 9 (ex.: ***.123.456-**, tipico de QSA/DataJud, OU o bloco de 6 digitos antes do DV): loop 000-999 nos ocultos + DV oficial (modulo 11) gera ate 1000 CPFs validos; verificacao EM LOTE no DataJud (terms no documentoReplicado + query_string com CPF formatado) devolve os CPFs com processos e os NOMES visiveis - lista para o USUARIO validar qual e o pesquisado. Apos a validacao, o dossie pesquisa tudo pelo CPF, nunca pelo nome.',
    inputSchema: {
      type: 'object',
      properties: {
        mascara: { type: 'string', description: 'Mascara do CPF com X ou * nos desconhecidos (ex.: ***.123.456-**, 111.444.777-**) OU o bloco de 6 digitos antes do DV (ex.: 123456). Os 2 DVs finais sao calculados automaticamente' },
        tribunal: { type: 'string', description: 'Tribunal da verificacao em lote (alias tjsp/tjpr... ou codigo 826). Obrigatorio quando consultar_datajud=true' },
        consultar_datajud: { type: 'boolean', description: 'Default true: verifica os candidatos no DataJud; false: apenas lista os CPFs gerados' },
        tamanho: { type: 'number', description: 'Maximo de processos por query (default 100, max 100)' }
      },
      required: ['mascara']
    },
    _run: toolCpfDesmascarar
  },
  {
    name: 'datajud_processo',
    description: 'Consulta um processo pelo numero CNJ na API publica do DataJud. Detecta o tribunal automaticamente. Retorna classe, assuntos, orgao julgador, datas, ultimos movimentos e, quando o tribunal indexa, as PARTES (nomes, polos, documentos e advogados). Tribunais que omitem partes: use fingerprint orgao+classe+assunto+datas.',
    inputSchema: {
      type: 'object',
      properties: {
        numero: { type: 'string', description: 'Numero CNJ (20 digitos ou formatado)' },
        tribunal: { type: 'string', description: 'Opcional: forca o tribunal (alias tjsp ou codigo 826)' },
        incluir_json: { type: 'boolean', description: 'Inclui o _source JSON bruto (default: false)' }
      },
      required: ['numero']
    },
    _run: toolDatajudProcesso
  },
  {
    name: 'datajud_pesquisar',
    description: 'Pesquisa processos no DataJud com filtros combinaveis: lista de numeros CNJ (terms), classe (nome ou codigo numerico), assunto (nome ou codigo), orgao julgador (nome ou codigo), grau e FAIXA DE AJUIZAMENTO (data_inicio/data_fim, AAAA-MM-DD). Ordenacao por ajuizamento e paginacao por cursor (ordenar=atualizacao + apartir_de) para alem dos 10.000 hits (janela maxima do Elastic). Feita para montar fingerprints (orgao+classe+assunto+datas).',
    inputSchema: {
      type: 'object',
      properties: {
        tribunal: { type: 'string', description: 'Tribunal (alias tjsp/tjpr/trt15/tre-sp... ou codigo 826/816/501/600...)' },
        numeros: { type: 'string', description: 'Numeros CNJ de 20 digitos separados por virgula (query terms)' },
        classe: { type: 'string', description: 'Nome parcial da classe (ex.: Precatoria)' },
        classe_codigo: { type: 'number', description: 'Codigo numerico da classe (ex.: 1116)' },
        assunto: { type: 'string', description: 'Nome parcial do assunto' },
        assunto_codigo: { type: 'number', description: 'Codigo numerico do assunto' },
        orgao: { type: 'string', description: 'Nome parcial do orgao julgador' },
        orgao_codigo: { type: 'number', description: 'Codigo numerico do orgao julgador' },
        grau: { type: 'string', description: 'Grau de jurisdicao (ex.: JE, TR, SE...)' },
        data_inicio: { type: 'string', description: 'Data de ajuizamento inicial AAAA-MM-DD' },
        data_fim: { type: 'string', description: 'Data de ajuizamento final AAAA-MM-DD' },
        ordenar: { type: 'string', description: 'ajuizamento_desc | ajuizamento_asc | atualizacao (prepara cursor search_after)' },
        apartir_de: { type: 'number', description: 'Cursor: valor de @timestamp retornado na pagina anterior (paginacao alem dos 10.000)' },
        tamanho: { type: 'number', description: 'Resultados por pagina (default 20, max 1000)' },
        pagina: { type: 'number', description: 'Pagina por deslocamento (default 1; limitada a janela de 10.000)' }
      },
      required: ['tribunal']
    },
    _run: toolDatajudPesquisar
  },
  {
    name: 'datajud_buscar',
    description: 'Busca textual livre no DataJud (query_string do Elastic): nome exato entre aspas duplas ("NOME COMPLETO"), CPF formatado entre aspas ("000.000.000-00"), numero de 20 digitos (match exato) ou termo qualquer. Ordena por ajuizamento (mais recentes primeiro) e exibe as PARTES quando o tribunal as indexa. O TJSP costuma responder lento (a ferramenta faz 3 tentativas). REGRA DO SERVIDOR: havendo CPF/CNPJ do pesquisado, a ancora e o documento entre aspas - achado por nome so vale com documento cruzando (sem isso: POSSIVEL HOMONIMO, PROIBIDO na lista principal).',
    inputSchema: {
      type: 'object',
      properties: {
        tribunal: { type: 'string', description: 'Tribunal (alias tjsp/tjpr/tjsc... ou codigo 826/816/501...)' },
        consulta: { type: 'string', description: 'Texto, nome entre aspas duplas, CPF formatado entre aspas ou numero CNJ' },
        tamanho: { type: 'number', description: 'Maximo de resultados (default 10, max 100)' }
      },
      required: ['tribunal', 'consulta']
    },
    _run: toolDatajudBuscar
  },
  {
    name: 'datajud_por_cpf',
    description: 'Busca processos pelo CPF/CNPJ da parte no DataJud nos campos partes.documento E partes.pessoa.documentoReplicado, nas DUAS grafias (com e sem pontuacao) via bool.should. Muitos tribunais mascaram o documento e retornam 0 - nesse caso a resposta sugere a rota alternativa (datajud_buscar com o documento formatado entre aspas). Rota de ancora por documento - OBRIGATORIA sempre que existir CPF/CNPJ do pesquisado. CICLO PF<->PJ: aceita CNPJ tambem - com CPF do pesquisado, procure os CNPJs vinculados (brasilapi_cnpj) e consulte-os aqui; com CNPJ, extraia os CPFs do QSA e consulte-os aqui.',
    inputSchema: {
      type: 'object',
      properties: {
        tribunal: { type: 'string', description: 'Tribunal (alias tjsp/tjpr/tjsc... ou codigo 826/816/501...)' },
        cpf: { type: 'string', description: 'CPF (11 digitos) ou CNPJ (14), com ou sem pontuacao' },
        tamanho: { type: 'number', description: 'Maximo de resultados (default 10, max 100)' }
      },
      required: ['tribunal', 'cpf']
    },
    _run: toolDatajudPorCpf
  },
  {
    name: 'datajud_por_nome',
    description: 'Busca processos pelo NOME da parte no DataJud (match_phrase no nome COMPLETO exato) nos dois formatos de indexacao - partes.nome (API publica) e partes.pessoa.nome (MTD) - com filtro opcional de polo (ATIVO/PASSIVO, cobrindo os rotulos Autor/Reu) e ordenacao por ajuizamento (mais recentes primeiro). A API publica omite/mascara as partes em varios tribunais; com 0 resultados a resposta sugere datajud_buscar com "NOME COMPLETO" entre aspas (query_string no texto integral) ou a consulta publica do tribunal. REGRA ANTI-HOMONIMO: achado por nome so vale com o CPF/CNPJ do pesquisado cruzando - sem documento: POSSIVEL HOMONIMO, PROIBIDO na lista principal.',
    inputSchema: {
      type: 'object',
      properties: {
        tribunal: { type: 'string', description: 'Tribunal (alias tjsp/tjpr/tjsc/tre-sp... ou codigo 826/816/501...)' },
        nome: { type: 'string', description: 'Nome COMPLETO exato da parte, como consta nos autos' },
        polo: { type: 'string', description: 'Opcional: ATIVO ou PASSIVO' },
        tamanho: { type: 'number', description: 'Maximo de resultados (default 20, max 100)' }
      },
      required: ['tribunal', 'nome']
    },
    _run: toolDatajudPorNome
  },
  {
    name: 'djen_intimacoes',
    description: 'Consulta intimacoes/comunicacoes oficiais (DJEN/CNJ) pelo nome da parte. Retorna textos (frequentemente sentencas integrais) que citam numeros de processos correlatos - tecnica chave para desmascarar numeros ocultos. O retorno traz a PROIBICAO anti-homonimo: cruze pelo CPF/CNPJ - sem documento que bata, PROIBIDO apresentar como sendo do pesquisado.',
    inputSchema: {
      type: 'object',
      properties: {
        nome_parte: { type: 'string', description: 'Nome da parte exata (sem mascaras)' },
        itens_por_pagina: { type: 'number', description: 'Default 30, max 100' },
        pagina: { type: 'number', description: 'Default 1' },
        incluir_texto: { type: 'boolean', description: 'Incluir texto integral truncado (default: true)' },
        max_texto: { type: 'number', description: 'Caracteres do texto por intimacao (default 600)' }
      },
      required: ['nome_parte']
    },
    _run: toolDjenIntimacoes
  },
  {
    name: 'brasilapi_cnpj',
    description: 'Consulta CNPJ gratuito na BrasilAPI (razao social, socios, CNAE, situacao, endereco). Sem chave de API. CICLO OBRIGATORIO PF<->PJ: com CPF do pesquisado, use para achar CNPJs vinculados; com CNPJ do pesquisado, extraia os CPFs do QSA (mascarados, com faixa etaria) e procure os processos dessas pessoas (datajud_por_cpf). Razao social costuma embutir o CPF do titular.',
    inputSchema: { type: 'object', properties: { cnpj: { type: 'string', description: 'CNPJ (14 digitos ou formatado)' } }, required: ['cnpj'] },
    _run: toolBrasilapiCnpj
  },
  {
    name: 'esaj_tjsp_guia',
    description: 'Receita validada do fluxo de consulta publica do e-SAJ TJSP (seletores CSS e armadilhas) para execucao com o MCP Playwright.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    _run: toolEsajGuia
  },
  {
    name: 'datajud_varrer',
    description: 'Varre UMA consulta em VARIOS tribunais de uma vez (uma chamada, N buscas PARALELAS de 5 por vez). Ideal para nome exato entre aspas ou CPF formatado entre aspas - economiza dezenas de chamadas individuais. Escopos prontos (param escopo): tj (27), trf (6), trt (24), tre (27), superiores (stj/tst/tse/stm), militares (tjmmg/tjmrs/tjmsp) ou todos. Default: 11 tribunais principais; ou passe tribunais="tjsp,tjpr". STF nao existe na API publica. Erros por tribunal nao abortam a varredura. REGRA: CPF/CNPJ entre aspas e a consulta preferida; achado por nome exige cruzamento por documento - sem isso: POSSIVEL HOMONIMO, PROIBIDO na lista principal.',
    inputSchema: {
      type: 'object',
      properties: {
        consulta: { type: 'string', description: 'Nome exato entre aspas duplas ("NOME COMPLETO"), CPF formatado entre aspas ("000.000.000-00") ou numero CNJ de 20 digitos' },
        escopo: { type: 'string', description: 'Grupo pronto: tj, trf, trt, tre, superiores, militares ou todos' },
        tribunais: { type: 'string', description: 'Lista de aliases separados por virgula (ex.: tjsp,tjpr,tjsc)' },
        todos_tribunais: { type: 'boolean', description: 'Se true, varre todos os tribunais mapeados (ignora tribunais/escopo)' },
        tamanho: { type: 'number', description: 'Maximo de resultados por tribunal (default 10, max 100)' }
      },
      required: ['consulta']
    },
    _run: toolDatajudVarrer
  },
  {
    name: 'esaj_buscar',
    description: 'Consulta anonima do 1o grau do TJSP (e-SAJ) por nome da parte (NMPARTE), CPF/CNPJ (DOCPARTE) ou numero (NUMPROC), via HTTP direto. LIMITACAO: a consulta anonima SUPRIME partes de processos criminais (sigilo legal). REGRA: com CPF/CNPJ use DOCPARTE (ancora) - e siga o ciclo PF<->PJ (CPF acha CNPJs vinculados / CNPJ acha CPFs do QSA); NMPARTE (nome) produz homonimos - PROIBIDO lista-los como sendo do pesquisado sem cruzamento por documento.',
    inputSchema: {
      type: 'object',
      properties: {
        nome_ou_doc: { type: 'string', description: 'Nome da parte, CPF/CNPJ ou numero do processo' },
        tipo: { type: 'string', description: 'NMPARTE (nome, default), DOCPARTE (CPF/CNPJ) ou NUMPROC (numero)' },
        foro: { type: 'string', description: 'Codigo do foro (default -1 = todos)' }
      },
      required: ['nome_ou_doc']
    },
    _run: toolEsajBuscar
  },
  {
    name: 'dje_sp_buscar',
    description: 'Busca textual no Diario da Justica Eletronico de Sao Paulo (DJE-SP/TJSP), cobrindo 01/10/2007 ate a ultima edicao publicada. Pipeline validado: POST consultaAvancada.do + paginacao AJAX trocaDePagina.do. Busque nome exato entre aspas ("NOME COMPLETO"), termo livre ou numero de processo; devolve data, caderno, pagina, snippet, numeros de processo citados e a URL do PDF oficial (anonima) de cada publicacao. REGRA ANTI-HOMONIMO: publicacao que cita o pesquisado por nome EXIGE cruzamento por CPF/CNPJ ou numero do processo.',
    inputSchema: {
      type: 'object',
      properties: {
        nome_ou_texto: { type: 'string', description: 'Termo de busca: nome exato entre aspas ("NOME COMPLETO"), frase ou numero de processo' },
        data_inicio: { type: 'string', description: 'dd/mm/aaaa ou aaaa-mm-dd (default: igual a data_fim)' },
        data_fim: { type: 'string', description: 'dd/mm/aaaa ou aaaa-mm-dd (default: ultima edicao publicada)' },
        cd_caderno: { type: 'string', description: '-11 todos (default) | 10 Administrativo | 11/19 Judicial 2a Instancia | 12/20 Judicial 1a Inst Capital | 18/13/15 Judicial 1a Inst Interior | 14 Editais' },
        max_paginas: { type: 'number', description: 'Paginas de 10 hits a ler por chamada (1 a 10, default 1)' }
      },
      required: ['nome_ou_texto']
    },
    _run: toolDjeSpBuscar
  },
  {
    name: 'exa_buscar',
    description: 'Busca semantica na web (Exa API): noticias, menções, redes sociais, homonimos. Requer a variavel de ambiente EXA_API_KEY (gratuita em https://dashboard.exa.ai).',
    inputSchema: {
      type: 'object',
      properties: {
        consulta: { type: 'string', description: 'Consulta semantica (ex.: "nome da pessoa" cidade profissao)' },
        n: { type: 'number', description: 'Numero de resultados (default 5, max 20)' }
      },
      required: ['consulta']
    },
    _run: toolExaBuscar
  },
  {
    name: 'social_buscar_usuario',
    description: 'Scanner GRATUITO de perfis por usuario/nick em dezenas de redes sociais, usando a base publica do WhatsMyName (github.com/WebBreacher/WhatsMyName): para cada site verifica a URL do perfil contra os marcadores do dataset - e_code/e_string = EXISTE, m_code/m_string = AUSENTE (missing). Sem API key. Achados vem com URL; inconclusivos e falhas sao listados a parte. AVISO CRITICO: perfil EXISTENTE nao e perfil DA PESSOA - nicks tem homonimos; valide por bio/foto/cidade/vinculos antes de atribuir (LGPD).',
    inputSchema: {
      type: 'object',
      properties: {
        usuario: { type: 'string', description: 'Nick sem @ (letras, numeros, ponto, traco, underline)' },
        limite: { type: 'number', description: 'Quantos sites da base verificar (default 40, max 150)' }
      },
      required: ['usuario']
    },
    _run: toolSocialBuscarUsuario
  },
  {
    name: 'telefone_consultar',
    description: 'Analisa TELEFONE brasileiro: digita e limpa, identifica DDD e tipo (celular/fixo), consulta UF e cidades do DDD via BrasilAPI (gratuita, sem chave) e monta as rotas de consulta complementares (wa.me/WhatsApp, Numtrace, Social Searcher). Paginas dinamicas exigem Playwright/browser. AVISO: telefone e dado pessoal (LGPD) - dados de agregadores sao INDICIO, nunca prova.',
    inputSchema: {
      type: 'object',
      properties: {
        telefone: { type: 'string', description: 'Telefone com DDD (BR: 10-11 digitos, ex. 11999998888) ou com codigo de pais' }
      },
      required: ['telefone']
    },
    _run: toolTelefoneConsultar
  },
  {
    name: 'fontes_osint',
    description: 'Guia rapido: bases publicas de pesquisa (onde achar), rotas por tribunal, tecnicas validadas (como buscar) e regras de etica/LGPD. ABRE COM O PROTOCOLO OBRIGATORIO: documento (CPF/CNPJ) primeiro, cruzamento total das fontes, HOMONIMO PROIBIDO (sem documento cruzado, nunca na lista principal) e ciclo obrigatorio PF<->PJ (CPF acha CNPJs vinculados; CNPJ acha CPFs do QSA).',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    _run: toolFontesOsint
  },
  {
    name: 'guia_navegacao',
    description: 'Guia de navegacao por browser automatizado: links das regras do mantenedor (master rules, pasta de regras, prompt 8.5 de relatorio), fluxo validado com o MCP Playwright (snapshot/find/fill/click, captchas manuais, armadilhas do e-SAJ) e modulos de Python para scripts locais (requests, playwright, pandas).',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    _run: toolGuiaNavegacao
  },
  {
    name: 'guia_dossie',
    description: 'PROTOCOLO DE DOSSIE COMPLETO POR DOCUMENTO (v1.17.2): regra obrigatoria para todo agente - TODOS os pedidos do titular da investigacao (empresas em que trabalhou, artigo do crime, redes sociais, curriculo, mascaras) viram etapa executavel deste checklist de 11 fases: ancora por documento, ciclo PF<->PJ forcado (CNPJ sempre com o CPF), loop de mascaras CNJ com contra-prova no e-SAJ DOCPARTE, varredura multi-tribunal e diarios, redes/curriculo/vinculos empregaticios (com limite declarado do CAGED/Rais), detalhes do crime (artigo pelo assunto + rito como hipotese + denuncia exige autos), familiares maiores/terceiros minimizados, validacao de curriculo/certificados (e-MEC/conselhos), montagem (dossie x metodo separados, template HTML autocontido, creditos oficiais) e fechamento com pendencias. Use ANTES de iniciar qualquer dossie de novo CPF/CNPJ.',
    inputSchema: {
      type: 'object',
      properties: {
        fase: { type: 'string', description: 'Opcional: devolve so uma fase (ex.: "FASE 6" para detalhes de crime, "FASE 5" para vinculos empregaticios). Sem argumento: protocolo completo.' }
      },
      additionalProperties: false
    },
    _run: toolGuiaDossie
  },
  {
    name: 'guia_relatorios',
    description: 'Tecnicas validadas para gerar relatorios/dossies de investigacao judicial: HTML unico autocontido (CSS/JS internos, sem PHP), montado PRIMEIRO pelos .md de regras/ (master_rules.md) e FINALIZADO pelo padrao 8.5; secoes obrigatorias do dossie (redes sociais, processos por CPF, nao postar homonimos, curriculo declarado, tabela de processos, cruzamento empregos x processos, analise de perfil, quao seguro e o usuario, relacionamentos com ancora), estruturas do master_rules.md (semantica W3C, WCAG AA, temas claro/escuro, CSS sem duplicatas, zero alert), niveis de confirmacao (CONFIRMADO/PROVAVEL/POSSIVEL HOMONIMO), pendencias, cadeia de evidencia, anti-homonimos, etica e checklist de entrega. escopo="exclusivo cpf" devolve SO as normas do modo dossie-exclusivo-por-documento (padrao negativo de homonimos).',
    inputSchema: {
      type: 'object',
      properties: {
        escopo: { type: 'string', description: '"exclusivo cpf": normas filtradas para dossie de um unico documento (sem secoes de homonimos). Sem escopo: guia tecnico completo.' }
      },
      additionalProperties: false
    },
    _run: toolGuiaRelatorios
  },
  {
    name: 'regras_ler',
    description: 'Conteudo INTEGRAL dos .md da pasta regras/ (whitelist: master_rules, prompt_8_5). Resolve o acesso por protocolo: agentes sem filesystem do servidor leem aqui os templates que o guia_relatorios cita. AVISO: prompt_8_5 e generico de blog/YouTube - use apenas o aplicavel ao dossie. Se a pasta regras/ nao existir (instalacao so-server.js), devolve instrucoes de fallback.',
    inputSchema: {
      type: 'object',
      properties: {
        arquivo: { type: 'string', description: 'Chave da whitelist: master_rules | prompt_8_5 (sem argumento: lista as opcoes)' }
      },
      additionalProperties: false
    },
    _run: toolRegrasLer
  },
  {
    name: 'ciclo_pf_pj',
    description: 'Ciclo PF<->PJ COMPLETO em uma chamada: DataJud multi-tribunal com o documento entre aspas + e-SAJ DOCPARTE + DJE-SP (base integral) + BrasilAPI (se CNPJ: razao social e CPFs mascarados do QSA com rota de quebra). Entrada CPF devolve a receita reversa CPF->CNPJ validada (razao social com CPF embutido + busca web). Termina com VEREDITO unico (hits por fonte) e proximos passos. Use ANTES de fechar qualquer dossie.',
    inputSchema: {
      type: 'object',
      properties: {
        cpf_cnpj: { type: 'string', description: 'CPF (11 digitos) ou CNPJ (14 digitos) do pesquisado, com ou sem pontuacao' },
        tribunais: { type: 'string', description: 'Lista de tribunais separada por virgula (default: 11 principais). Ex.: tjsp,tjpr,tjsc' }
      },
      required: ['cpf_cnpj']
    },
    _run: toolCicloPfPj
  },
  {
    name: 'guia_instalacao',
    description: 'Comandos prontos para instalar tudo do zero: Node.js via winget (Windows 10/11), alternativas (choco/scoop/MSI, apt/dnf/brew), obtencao deste servidor (git clone ou download do server.js), teste via stdin e registro nos clientes MCP. Use quando o usuario ou o agente nao possuir Node ou o escrivao.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    _run: toolGuiaInstalacao
  },
  {
    name: 'jusbrasil_buscar',
    description: 'Busca no Jusbrasil (agregador de processos, diarios e noticias): tenta via HTTP e, quando o Cloudflare bloqueia (403), devolve a rota pronta via browser (MCP Playwright) com a URL montada. Os numeros de processo do Jusbrasil vem MASCARADOS (XXXX) - alimente o loop do cnj_desmascarar com cpf/nome.',
    inputSchema: {
      type: 'object',
      properties: {
        consulta: { type: 'string', description: 'Nome completo entre aspas duplas, CPF/CNPJ formatado entre aspas ou termo livre' }
      },
      required: ['consulta']
    },
    _run: toolJusbrasilBuscar
  },
  {
    name: 'mcp_atualizar',
    description: 'Autoatualizacao do servidor: baixa a ultima versao do server.js direto do GitHub (canalqb/escrivao-mcp), guarda backup (.bak) e substitui o arquivo local; a nova versao sobe apos reiniciar o cliente MCP. Funciona em QUALQUER instalacao (com ou sem git) - e a rota oficial de atualizacao.',
    inputSchema: {
      type: 'object',
      properties: {
        fonte: { type: 'string', description: 'URL alternativa do server.js (opcional; default: GitHub oficial)' }
      },
      additionalProperties: false
    },
    _run: toolMcpAtualizar
  }
];

function send(obj) { process.stdout.write(JSON.stringify(obj) + '\n'); }

async function handle(msg) {
  if (msg.method === 'initialize') {
    return { protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'escrivao', version: '1.18.2' } };
  }
  if (msg.method === 'ping') return {};
  if (msg.method === 'tools/list') return { tools: TOOLS.map(t => ({ name: t.name, description: t.description, inputSchema: t.inputSchema })) };
  if (msg.method === 'tools/call') {
    const name = msg.params && msg.params.name;
    const args = (msg.params && msg.params.arguments) || {};
    const t = TOOLS.find(x => x.name === name);
    if (!t) return { content: [{ type: 'text', text: `Ferramenta desconhecida: ${name}` }], isError: true };
    try {
      const text = String(await t._run(args)).slice(0, 60000);
      return { content: [{ type: 'text', text }], isError: false };
    } catch (e) {
      let txt = 'ERRO: ' + String(e && e.message ? e.message : e);
      try {
        const q = String(args.consulta || args.nome_parte || args.nome_ou_doc || args.cpf || args.cnpj || args.nome || '').trim();
        if (q) txt += `\n\n${avisoAncora(q)}\nA checagem anti-homonimo e o ciclo PF<->PJ continuam valendo mesmo quando a fonte falha - registre a falha na secao de pendencias do relatorio.`;
      } catch (e2) { /* aviso best-effort */ }
      return { content: [{ type: 'text', text: txt }], isError: true };
    }
  }
  const err = new Error(`Metodo nao suportado: ${msg.method}`);
  err.code = -32601;
  throw err;
}

const rl = readline.createInterface({ input: process.stdin, terminal: false });
let closing = false, pending = 0;
function maybeExit() {
  if (closing && pending === 0) {
    const t = setTimeout(() => process.exit(0), 250);
    t.unref();
  }
}
rl.on('line', (line) => {
  const s = line.trim();
  if (!s) return;
  let msg;
  try { msg = JSON.parse(s); } catch (e) { return; }
  if (msg.id === undefined || msg.id === null) return;
  pending++;
  handle(msg).then(
    (res) => send({ jsonrpc: '2.0', id: msg.id, result: res }),
    (err) => send({ jsonrpc: '2.0', id: msg.id, error: { code: err.code || -32603, message: String(err && err.message ? err.message : err) } })
  ).then(() => { pending--; maybeExit(); });
});
rl.on('close', () => { closing = true; maybeExit(); });
