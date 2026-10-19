const readline = require('readline');

const DATAJUD_BASE = 'https://api-publica.datajud.cnj.jus.br';
const DATAJUD_WIKI = 'https://datajud-wiki.cnj.jus.br/api-publica/acesso/';
const DATAJUD_KEY_FALLBACK = 'cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==';
const DJEN_BASE = 'https://comunicaapi.pje.jus.br/api/v1/comunicacao';
const BRASILAPI_CNPJ = 'https://brasilapi.com.br/api/cnpj/v1/';
const ESAJ_SEARCH = 'https://esaj.tjsp.jus.br/cpopg/search.do';
const EXA_SEARCH = 'https://api.exa.ai/search';

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
  '200': 'api_publica_stj', '500': 'api_publica_tst'
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
  if (/^(tj|trf|trt|tst|stj|stf|tse|stm)[a-z0-9]{0,4}$/.test(t)) return 'api_publica_' + t;
  throw new Error(`Tribunal desconhecido: ${tribunal}. Use sigla (tjsp, tjpr, tjsc, trt15, trf3...) ou codigo CNJ (826, 816, 824...).`);
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
      if (tentativa < 3) await new Promise(r => setTimeout(r, 5000));
    }
  }
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

function summarizeProcess(p, incluirJson) {
  const assuntos = Array.isArray(p.assunto) ? p.assunto.map(a => normName(a)).filter(Boolean).join('; ') : normName(p.assunto);
  const movs = Array.isArray(p.movimentos) ? p.movimentos : [];
  const ultimos = movs.slice(-8).map(m => `- ${m.dataHora || ''} ${m.nome || ''}`.trim()).join('\n');
  let out = `Numero: ${formatCnj(String(p.numeroProcesso || ''))}\n`;
  out += `Tribunal: ${p.tribunal || ''}\n`;
  out += `Classe: ${normName(p.classe)}\n`;
  out += `Assunto(s): ${assuntos}\n`;
  out += `Orgao julgador: ${normName(p.orgaoJulgador)}\n`;
  out += `Grau: ${p.grau || p['@grau'] || ''}\n`;
  out += `Ultima movimentacao: ${lastMovDate(p)}\n`;
  if (ultimos) out += `Movimentos recentes:\n${ultimos}\n`;
  if (incluirJson) out += `\nJSON _source:\n${JSON.stringify(p).slice(0, 12000)}`;
  return out;
}

function hitsToArray(dados) {
  return (dados && dados.hits && Array.isArray(dados.hits.hits)) ? dados.hits.hits : [];
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
  let out = `Mascara: ${a.mascara}\nCandidatos com DV valido: ${cands.length}\n`;
  if (!a.consultar_datajud) {
    out += cands.map(c => formatCnj(c.numero)).join('\n');
    out += '\n\nDica: passe consultar_datajud=true para verificar quais existem no DataJud (uma unica query terms).';
    return out;
  }
  const nums = cands.map(c => c.numero);
  const endpoint = endpointFromNumero(nums[0]);
  const chunks = [];
  for (let i = 0; i < nums.length; i += 200) chunks.push(nums.slice(i, i + 200));
  const encontrados = [];
  for (const chunk of chunks) {
    const dados = await datajudSearch(endpoint, { query: { terms: { numeroProcesso: chunk } }, size: chunk.length + 10 });
    for (const h of hitsToArray(dados)) {
      const p = h._source || {};
      const assuntos = Array.isArray(p.assunto) ? p.assunto.map(x => normName(x)).filter(Boolean).join('; ') : normName(p.assunto);
      encontrados.push(
        `${formatCnj(String(p.numeroProcesso))} | ${p.tribunal || ''} | classe: ${normName(p.classe)} | assuntos: ${assuntos} | orgao: ${normName(p.orgaoJulgador)} | ultima mov.: ${lastMovDate(p)}`
      );
    }
  }
  out += `\nExistentes no DataJud (${endpoint}): ${encontrados.length}\n`;
  out += encontrados.length ? encontrados.join('\n') : 'Nenhum dos candidatos existe no tribunal consultado.';
  out += '\n\nProximo passo: fingerprint dos existentes (orgao+classe+assunto+datas) contra os metadados da fonte que mascarou o numero.';
  return out;
}

async function toolDatajudProcesso(a) {
  const n = digitsOnly(a.numero);
  if (n.length !== 20) throw new Error('Numero CNJ deve ter 20 digitos.');
  const endpoint = a.tribunal ? resolveEndpoint(a.tribunal) : endpointFromNumero(n);
  const dados = await datajudSearch(endpoint, { query: { match: { numeroProcesso: n } }, size: 5 });
  const hits = hitsToArray(dados);
  if (!hits.length) return `Nenhum processo encontrado no ${endpoint} para ${formatCnj(n)}.\nNota: a API publica omite as PARTES do processo; use classe/orgao/datas para fingerprint.`;
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
  if (a.assunto) must.push({ match: { 'assunto.nome': a.assunto } });
  if (a.orgao) must.push({ match: { 'orgaoJulgador.nome': a.orgao } });
  if (!must.length) throw new Error('Informe ao menos um filtro: numeros, classe, assunto ou orgao.');
  const size = Math.min(Number(a.tamanho) || 20, 100);
  const from = ((Number(a.pagina) || 1) - 1) * size;
  const body = { size, from, query: must.length === 1 ? must[0] : { bool: { must } } };
  const dados = await datajudSearch(endpoint, body);
  const hits = hitsToArray(dados);
  const total = (dados.hits && dados.hits.total && (dados.hits.total.value != null ? dados.hits.total.value : dados.hits.total)) || hits.length;
  let out = `Tribunal: ${endpoint} | Total de hits: ${total} | Exibindo: ${hits.length} (pagina ${a.pagina || 1})\n`;
  out += hits.map(h => {
    const p = h._source || {};
    const assuntos = Array.isArray(p.assunto) ? p.assunto.map(x => normName(x)).filter(Boolean).join('; ') : normName(p.assunto);
    return `${formatCnj(String(p.numeroProcesso || ''))} | classe: ${normName(p.classe)} | assuntos: ${assuntos} | orgao: ${normName(p.orgaoJulgador)} | ultima mov.: ${lastMovDate(p)}`;
  }).join('\n');
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
  if (!items.length) return `Nenhuma intimacao encontrada para "${a.nome_parte}" (count: ${dados.count != null ? dados.count : 0}).`;
  const maxTexto = Number(a.max_texto) || 600;
  const incluir = a.incluir_texto !== false;
  let out = `Intimacoes encontradas: ${items.length} (pagina ${a.pagina || 1})\n\n`;
  out += items.map(it => {
    let b = `[id ${it.id}] ${it.data_disponibilizacao || ''} | ${it.siglaTribunal || ''} | ${it.nomeOrgao || ''} | classe: ${it.nomeClasse || ''} | processo: ${it.numeroprocessocommascara || it.numero_processo || ''} | tipo: ${it.tipoComunicacao || ''}\n`;
    if (incluir && it.texto) b += `  Texto: ${String(it.texto).replace(/\s+/g, ' ').slice(0, maxTexto)}${String(it.texto).length > maxTexto ? ' [...]' : ''}\n`;
    return b;
  }).join('\n');
  out += '\nDica: os textos integrais das intimacoes frequentemente citam numeros de processos correlatos - mina de ouro para desmascarar.';
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
  out += '\nDica: razoes sociais costumam embutir o CPF do socio-titular (ancora anti-homonimo); o QSA traz CPFs mascarados e faixa etaria.';
  return out;
}

function fmtResumo(p) {
  const num = String(p.numeroProcesso || '');
  return `${num.length === 20 ? formatCnj(num) : num} | classe: ${normName(p.classe)} | orgao: ${normName(p.orgaoJulgador)} | ajuizado: ${String(p.dataAjuizamento || '').slice(0, 10)}`;
}

async function toolDatajudBuscar(a) {
  const endpoint = resolveEndpoint(a.tribunal);
  const consulta = String(a.consulta || '').trim();
  if (!consulta) throw new Error('Informe a consulta: texto livre, nome exato entre aspas duplas, CPF formatado entre aspas ou numero de processo.');
  const tamanho = Math.min(Number(a.tamanho) || 10, 100);
  const n = digitsOnly(consulta);
  const corpo = (n.length === 20 && !/X/i.test(consulta))
    ? { query: { match: { numeroProcesso: n } }, size: tamanho }
    : { query: { query_string: { query: consulta } }, size: tamanho };
  const dados = await datajudSearch(endpoint, corpo);
  const hits = hitsToArray(dados);
  const total = (dados.hits && dados.hits.total && (dados.hits.total.value != null ? dados.hits.total.value : dados.hits.total)) || hits.length;
  let out = `DataJud ${endpoint}: ${total} resultado(s)\n`;
  out += hits.map(h => fmtResumo(h._source || {})).join('\n');
  if (!hits.length) out += 'Nenhum resultado. Dicas: nome exato entre aspas duplas ("NOME COMPLETO"), CPF formatado entre aspas ("000.000.000-00") ou numero CNJ de 20 digitos.';
  return out;
}

async function toolDatajudPorCpf(a) {
  const endpoint = resolveEndpoint(a.tribunal);
  const doc = digitsOnly(a.cpf);
  if (doc.length !== 11 && doc.length !== 14) throw new Error('Informe CPF (11 digitos) ou CNPJ (14), com ou sem pontuacao.');
  const tamanho = Math.min(Number(a.tamanho) || 10, 100);
  const dados = await datajudSearch(endpoint, { query: { match: { 'partes.pessoa.documentoReplicado': doc } }, size: tamanho });
  const hits = hitsToArray(dados);
  if (!hits.length) {
    const fmt = doc.length === 11
      ? `${doc.slice(0, 3)}.${doc.slice(3, 6)}.${doc.slice(6, 9)}-${doc.slice(9)}`
      : `${doc.slice(0, 2)}.${doc.slice(2, 5)}.${doc.slice(5, 8)}/${doc.slice(8, 12)}-${doc.slice(12)}`;
    return `0 processos por documento ${doc} em ${endpoint}. Muitos tribunais mascaram o documento da parte - tente datajud_buscar com "${fmt}" (formatado e entre aspas duplas) ou a consulta publica do tribunal de origem.`;
  }
  let out = `DataJud ${endpoint} por documento ${doc}: ${hits.length} processo(s)\n`;
  out += hits.map(h => fmtResumo(h._source || {})).join('\n');
  return out;
}

const TRIBUNAIS_VARREDURA_PADRAO = ['tjsp', 'tjpr', 'tjsc', 'tjba', 'tjpi', 'tjmg', 'tjrs', 'tjrj', 'trt2', 'trt9', 'trt15'];

async function toolDatajudVarrer(a) {
  const consulta = String(a.consulta || '').trim();
  if (!consulta) throw new Error('Informe a consulta: nome exato entre aspas duplas ("NOME COMPLETO") ou CPF formatado entre aspas ("000.000.000-00").');
  let alvos;
  if (a.tribunais) {
    alvos = String(a.tribunais).split(/[,;\s]+/).map(s => s.trim().toLowerCase()).filter(Boolean);
  } else {
    alvos = TRIBUNAIS_VARREDURA_PADRAO;
  }
  if (a.todos_tribunais) alvos = Object.values(TRIBUNAIS).map(e => e.replace('api_publica_', ''));
  const tamanho = Math.min(Number(a.tamanho) || 10, 100);
  const n = digitsOnly(consulta);
  const corpo = (n.length === 20 && !/X/i.test(consulta))
    ? { query: { match: { numeroProcesso: n } }, size: 1 }
    : { query: { query_string: { query: consulta } }, size: tamanho };
  const linhas = [];
  let ok = 0, falhas = 0;
  for (const t of alvos) {
    let endpoint;
    try { endpoint = resolveEndpoint(t); } catch (e) { linhas.push(`[${t}] TRIBUNAL DESCONHECIDO`); falhas++; continue; }
    try {
      const dados = await datajudSearch(endpoint, corpo);
      const hits = hitsToArray(dados);
      const total = (dados.hits && dados.hits.total && (dados.hits.total.value != null ? dados.hits.total.value : dados.hits.total)) || 0;
      ok++;
      if (hits.length) {
        linhas.push(`[${t}] ${total} resultado(s):`);
        hits.forEach(h => linhas.push('  ' + fmtResumo(h._source || {})));
      } else {
        linhas.push(`[${t}] 0`);
      }
    } catch (e) {
      falhas++;
      linhas.push(`[${t}] ERRO: ${String(e && e.message ? e.message : e).slice(0, 120)}`);
    }
  }
  let out = `Varredura "${consulta}" em ${alvos.length} tribunal(is): ${ok} consultados, ${falhas} falha(s)\n\n`;
  out += linhas.join('\n');
  out += '\n\nDicas: nome exato entre aspas duplas elimina homonimos; CPF formatado entre aspas ("000.000.000-00") e o modo mais preciso. Para documento da parte use datajud_por_cpf por tribunal.';
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
  const plano = html.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  if (/nao existem informa/i.test(plano)) return `e-SAJ TJSP: 0 processos para "${valor}" (a consulta anonima SUPRIME partes de processos criminais - sigilo legal).`;
  const m = plano.match(/(\d+)\s*Processos?\s*encontrados?/i);
  const total = m ? m[1] : '?';
  const numeros = plano.match(/\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/g) || [];
  const i = plano.search(/Processos? encontrados?/i);
  const trecho = i >= 0 ? plano.slice(i, i + 3000) : plano.slice(0, 3000);
  let out = `e-SAJ TJSP - ${total} processo(s) encontrado(s) para "${valor}" (tipo ${tipo}):\n${trecho}`;
  if (numeros.length) out += `\n\nNumeros listados (${numeros.length}):\n${[...new Set(numeros)].join('\n')}`;
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
    'BASES PUBLICAS (onde achar):',
    '- API publica DataJud/CNJ: https://api-publica.datajud.cnj.jus.br (endpoint api_publica_{tjsp|tjpr|...}/_search; chave publica na wiki https://datajud-wiki.cnj.jus.br/api-publica/acesso/). LIMITACAO: campo "partes" vem vazio - classifique por orgao+classe+assunto+datas (fingerprint).',
    '- DJEN/CNJ: https://comunicaapi.pje.jus.br/api/v1/comunicacao?nomeParte=... - intimacoes com TEXTO INTEGRAL (sentencas completas); citam numeros correlatos.',
    '- e-SAJ TJSP: consulta publica por numero via formulario (use a ferramenta esaj_tjsp_guia); busca por nome exige captcha manual.',
    '- BrasilAPI: https://brasilapi.com.br (CNPJ gratuito, sem chave).',
    '- Diarios oficiais (DJSP e equivalentes): editais de citacao, publicacoes de sentenca.',
    '- Escavador: agregador (paywall; mascara numeros conforme plano; login 2FA; numeros RELACIONADOS costumam aparecer completos).',
    '- Pendentes com chave/captcha: CEIS/CNEP (API key gratuita), TSE (filiacao/doacoes), Receita Federal (captcha), cartorios/registro civil.',
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
    '1. ANTI-HOMONIMOS: valide por (a) fonte chaveada por CPF, (b) CPF embutido em registro (ex.: razao social de CNPJ), (c) qualificacao judicial (nascimento, genitora, RG), (d) mascara de CPF compativel, (e) contexto (cidades+profissao+familiares co-reus). Sem isso: "possivel homonimo".',
    '2. QUEBRA DE MASCARA: NNNXXXX-DD -> 10.000 combinacoes -> DV CNJ (Res. 65/2008, ISO 7064 MOD 97-10) deixa ~103 validos -> UMA query terms no DataJud -> fingerprint -> confirmacao tripla (datas exatas + numeros de origem + e-SAJ). Ferramenta: cnj_desmascarar.',
    '3. FINGERPRINT: orgao julgador + classe + assunto + datas de movimentacao contra os metadados da fonte que mascarou.',
    '4. INTIMACOES DJEN: busque pelo nome da parte; textos integrais revelam fatos, enderecos e numeros de processos correlatos.',
    '5. CRUZAMENTO DE DATAS: data de ultima movimentacao e distribuicao devem bater EXATAS entre fontes.',
    '6. EVIDENCIAS: salve o HTML/PDF bruto, registre data/hora da consulta e a cadeia de confirmacao.',
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

async function toolGuiaRelatorios() {
  return [
    'OBRIGACAO (prompt 8.5): todo relatorio/dossie gerado com dados deste servidor segue OBRIGATORIAMENTE o padrao 8.5 - espelho local em regras/prompt_8_5.md; protocolo central em regras/master_rules.md (original no Drive, ver guia_navegacao).',
    'FORMATO PADRAO: UM unico arquivo HTML autocontido - apenas HTML, CSS e JS INTERNOS (tags <style> e <script> embutidas), sem PHP, sem arquivos separados, sem CDN - abrindo offline; outro formato (PDF, DOCX etc.) SOMENTE quando o usuario pedir explicitamente.',
    '',
    'TECNICAS DE RELATORIO (validadas na pratica - dossies de investigacao judicial):',
    '',
    '1. FORMATO: HTML UNICO AUTOCONTIDO',
    '- UM arquivo .html com CSS e JS EMBUTIDOS (tags <style> e <script> internas); NUNCA PHP, nunca arquivos separados, nunca CDN externo - o relatorio abre offline em qualquer navegador.',
    '- <meta charset="utf-8"> obrigatorio; titulo com nome do pesquisado e data de geracao no <title> e no cabecalho.',
    '- Estrutura semantica: <header>, <nav> com ancora por secao, <main>, <section id> por tema, <footer> com data/hora da geracao e aviso de uso interno.',
    '',
    '2. PADRAO DE CONTEUDO (adaptacao do prompt 8.5 ao dossie):',
    '- Cabecalho: TL;DR com 3 bullets (total de registros, confirmacoes, pendencias).',
    '- Cada secao com titulo em forma de PERGUNTA seguida de resposta curta e direta (40-60 palavras) antes do detalhe.',
    '- Zero emojis/unicode decorativo; linguagem objetiva em PT-BR.',
    '- FAQ ao final: perguntas que o leitor faria (quantos confirmados? qual o proximo passo? o que nao foi possivel verificar?).',
    '',
    '3. TABELAS DE PROCESSOS (o coracao do relatorio):',
    '- Colunas padrao: numero CNJ | tribunal/foro | classe | assunto | orgao julgador | data ajuizamento | status | fonte | nivel de confirmacao.',
    '- Nivel de confirmacao em 3 graus: CONFIRMADO (documento/fonte chaveada), PROVAVEL (fingerprint: orgao+classe+assunto+datas coerentes), POSSIVEL HOMONIMO (sem ancora anti-homonimo - marcar e separar).',
    '- Numeros mascarados da fonte original exibidos AO LADO do numero desmascarado (cadeia de evidencia).',
    '- JS interno: filtro por status e busca textual na pagina (input + listener em todas as linhas da tabela via data-attributes).',
    '',
    '4. SECAO DE PENDENCIAS OBRIGATORIA:',
    '- Tudo que ficou sem numero, sem confirmacao ou sem fonte acessivel - com o PROXIMO PASSO concreto de cada item (ex.: busca por nome no e-SAJ com captcha manual; ProJudi TJPR; certidao de distribuicao).',
    '- Contadores no topo: identificados vs. pendentes vs. descartados.',
    '',
    '5. CADEIA DE EVIDENCIA E AUDITORIA:',
    '- Cada afirmação cita a fonte (API/portal/data-hora da consulta); salve HTML/PDF bruto das consultas-chave.',
    '- Confirmacao tripla antes de marcar CONFIRMADO: datas EXATAS batendo entre 2+ fontes + numero de origem + verificacao em segunda base (ex.: DataJud + e-SAJ + DJEN).',
    '- NUNCA misturar achados de homonimos com os do pesquisado; secoes separadas com aviso.',
    '',
    '6. ANTI-HOMONIMOS (precisao por documento):',
    '- Prioridade SEMPRE: CPF/CNPJ exato > documento embutido em registro (razao social de CNPJ) > qualificacao judicial (nascimento, genitora, RG) > mascara de CPF compativel > contexto (cidade+profissao+familiares co-reus).',
    '- Busca por nome: SEMPRE entre aspas duplas ("NOME COMPLETO") no DataJud; varrer varios tribunais (datajud_varrer) e cruzar.',
    '',
    '7. ETICA NO RELATORIO:',
    '- Presuncao de inocencia para recursos pendentes (CF art. 5, LVII); NUNCA identificar menores (ECA); proteger vitimas de violencia domestica (Lei 11.340/2006).',
    '- Aviso no rodape: uso interno, dados de fontes publicas, LGPD (Lei 13.709/2018).',
    '- Familiares: incluir somente com documento/ancora propria, nunca por conjetura.',
    '',
    '8. CHECKLIST FINAL ANTES DE ENTREGAR:',
    '( ) todos os numeros CNJ validados (cnj_validar); ( ) niveis de confirmacao marcados; ( ) pendencias com proximo passo; ( ) filtro/busca JS funcionando; ( ) data de geracao no rodape; ( ) nenhum dado de homonimo misturado; ( ) arquivo abre offline.',
    '',
    'REUSO: este servidor NAO gera o HTML - o agente gera seguindo estas regras. Use fontes_osint (onde/como buscar), guia_navegacao (browser/instalacao) e este guia (como apresentar).'
  ].join('\n');
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
    description: 'Quebra numeros mascarados: recebe uma mascara com X (ex.: 000XXXX-XX.2024.8.26.0100), gera todos os candidatos com DV valido e, opcionalmente, verifica numa unica query terms quais existem no DataJud (orgao, classe, assunto e datas para fingerprint). Ferramenta generica.',
    inputSchema: {
      type: 'object',
      properties: {
        mascara: { type: 'string', description: 'Mascara NNNNNNN-DD.AAAA.J.TR.OOOO com X nos digitos desconhecidos (ano/segmento/tribunal/foro devem ser conhecidos)' },
        consultar_datajud: { type: 'boolean', description: 'Se true, consulta o DataJud com os candidatos (default: false)' },
        limite: { type: 'number', description: 'Maximo de candidatos (default 200, max 2000)' }
      },
      required: ['mascara']
    },
    _run: toolCnjDesmascarar
  },
  {
    name: 'datajud_processo',
    description: 'Consulta um processo pelo numero CNJ na API publica do DataJud. Detecta o tribunal automaticamente. Retorna classe, assuntos, orgao julgador, datas e ultimos movimentos. Atencao: a API publica omite as PARTES.',
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
    description: 'Pesquisa processos no DataJud com filtros combinaveis: lista de numeros CNJ (terms), classe, assunto ou orgao julgador. Feita para montar fingerprints (orgao+classe+assunto+datas).',
    inputSchema: {
      type: 'object',
      properties: {
        tribunal: { type: 'string', description: 'Tribunal (alias tjsp/tjpr/trt15... ou codigo 826/816/501...)' },
        numeros: { type: 'string', description: 'Numeros CNJ de 20 digitos separados por virgula (query terms)' },
        classe: { type: 'string', description: 'Nome parcial da classe (ex.: Precatoria)' },
        assunto: { type: 'string', description: 'Nome parcial do assunto' },
        orgao: { type: 'string', description: 'Nome parcial do orgao julgador' },
        tamanho: { type: 'number', description: 'Resultados por pagina (default 20, max 100)' },
        pagina: { type: 'number', description: 'Pagina (default 1)' }
      },
      required: ['tribunal']
    },
    _run: toolDatajudPesquisar
  },
  {
    name: 'datajud_buscar',
    description: 'Busca textual livre no DataJud (query_string do Elastic): nome exato entre aspas duplas ("NOME COMPLETO"), CPF formatado entre aspas ("000.000.000-00"), numero de 20 digitos (match exato) ou termo qualquer. O TJSP costuma responder lento (a ferramenta faz 3 tentativas). A API publica omite as PARTES em muitos processos.',
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
    description: 'Busca processos pelo CPF/CNPJ da parte no DataJud (campo partes.pessoa.documentoReplicado). Muitos tribunais mascaram esse campo e retornam 0 - nesse caso a resposta sugere a rota alternativa (datajud_buscar com o documento formatado entre aspas).',
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
    name: 'djen_intimacoes',
    description: 'Consulta intimacoes/comunicacoes oficiais (DJEN/CNJ) pelo nome da parte. Retorna textos (frequentemente sentencas integrais) que citam numeros de processos correlatos - tecnica chave para desmascarar numeros ocultos.',
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
    description: 'Consulta CNPJ gratuito na BrasilAPI (razao social, socios, CNAE, situacao, endereco). Sem chave de API.',
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
    description: 'Varre UMA consulta em VARIOS tribunais de uma vez (uma chamada, N buscas). Ideal para nome exato entre aspas ou CPF formatado entre aspas - economiza dezenas de chamadas individuais. Default: 11 tribunais (tjsp, tjpr, tjsc, tjba, tjpi, tjmg, tjrs, tjrj, trt2, trt9, trt15); passe tribunais="tjsp,tjpr" para escolher ou todos_tribunais=true para todos os mapeados. Erros por tribunal nao abortam a varredura.',
    inputSchema: {
      type: 'object',
      properties: {
        consulta: { type: 'string', description: 'Nome exato entre aspas duplas ("NOME COMPLETO"), CPF formatado entre aspas ("000.000.000-00") ou numero CNJ de 20 digitos' },
        tribunais: { type: 'string', description: 'Lista de aliases separados por virgula (ex.: tjsp,tjpr,tjsc). Default: 11 principais' },
        todos_tribunais: { type: 'boolean', description: 'Se true, varre todos os tribunais mapeados (ignora tribunais)' },
        tamanho: { type: 'number', description: 'Maximo de resultados por tribunal (default 10, max 100)' }
      },
      required: ['consulta']
    },
    _run: toolDatajudVarrer
  },
  {
    name: 'esaj_buscar',
    description: 'Consulta anonima do 1o grau do TJSP (e-SAJ) por nome da parte (NMPARTE), CPF/CNPJ (DOCPARTE) ou numero (NUMPROC), via HTTP direto. LIMITACAO: a consulta anonima SUPRIME partes de processos criminais (sigilo legal).',
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
    name: 'fontes_osint',
    description: 'Guia rapido: bases publicas de pesquisa (onde achar), rotas por tribunal, tecnicas validadas (como buscar) e regras de etica/LGPD.',
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
    name: 'guia_relatorios',
    description: 'Tecnicas validadas para gerar relatorios/dossies de investigacao judicial: HTML unico autocontido (CSS/JS internos, sem PHP), padrao de conteudo adaptado do prompt 8.5 (TL;DR, secoes em pergunta, FAQ), tabelas de processos com nivel de confirmacao (CONFIRMADO/PROVAVEL/POSSIVEL HOMONIMO), secao de pendencias, cadeia de evidencia, anti-homonimos, etica e checklist de entrega.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    _run: toolGuiaRelatorios
  }
];

function send(obj) { process.stdout.write(JSON.stringify(obj) + '\n'); }

async function handle(msg) {
  if (msg.method === 'initialize') {
    return { protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'escrivao', version: '1.6.0' } };
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
      return { content: [{ type: 'text', text: 'ERRO: ' + String(e && e.message ? e.message : e) }], isError: true };
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
