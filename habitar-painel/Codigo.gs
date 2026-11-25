/**
 * Gestão Habitar — servidor do painel (Google Apps Script).
 *
 * Fica dentro da planilha principal (Extensões → Apps Script).
 * 1. Rode a função instalar() uma vez: ela cria as abas, as listas, a planilha restrita do
 *    Financeiro e a rotina diária das 7h.
 * 2. Implemente como app da Web (Executar como: usuário que acessa; Quem pode acessar: qualquer
 *    pessoa com Conta do Google). Só quem tem acesso à planilha vê os dados.
 */

var APP = { titulo: 'Gestão Habitar - Habitar Consultoria & Financiamento Imobiliário', fuso: 'America/Sao_Paulo' };

var ABA = {
  CLIENTES: 'CLIENTES', TAREFAS: 'TAREFAS', HISTORICO: 'HISTÓRICO', ETAPAS: 'ETAPAS',
  EQUIPE: 'EQUIPE', LISTAS: 'LISTAS', CONFIG: 'CONFIG', LANCAMENTOS: 'LANÇAMENTOS'
};

var COLUNAS = {
  CLIENTES: ['ID', 'Entrada', 'Nome', 'WhatsApp', 'E-mail', 'Cidade', 'Origem', 'Quem indicou', 'Operação',
    'Tipo de imóvel', 'Valor do imóvel', 'Valor de entrada', 'FGTS', 'Valor a financiar', 'Banco', 'Etapa',
    'Etapa desde', 'Status', 'Motivo', 'Responsável', 'Próximo passo', 'Data do próximo passo',
    'Atualizado em', 'Atualizado por', 'Observações'],
  TAREFAS: ['ID', 'Criada em', 'Cliente ID', 'Cliente', 'Tarefa', 'Responsável', 'Prazo', 'Status', 'Origem',
    'Concluída em', 'Concluída por', 'Chave'],
  HISTORICO: ['Data', 'Cliente ID', 'Tipo', 'De', 'Para', 'Texto', 'Por'],
  ETAPAS: ['Ordem', 'Etapa', 'Prazo (dias)', 'Tarefa ao entrar', 'Responsável', 'Ativa'],
  EQUIPE: ['Nome', 'E-mail', 'Papel', 'Ativo'],
  CONFIG: ['Chave', 'Valor', 'Descrição'],
  LANCAMENTOS: ['ID', 'Data', 'Tipo', 'Categoria', 'Descrição', 'Cliente ID', 'Cliente', 'Valor', 'Situação',
    'Vencimento', 'Registrado por']
};

// Sugestões iniciais: ajuste nomes, prazos e tarefas na aba ETAPAS.
var ETAPAS_PADRAO = [
  [1, 'Novo contato', 2, 'Fazer o primeiro contato e entender o objetivo', '', 'Sim'],
  [2, 'Simulação', 3, 'Enviar a simulação ao cliente', '', 'Sim'],
  [3, 'Análise de crédito', 7, 'Acompanhar a análise de crédito', '', 'Sim'],
  [4, 'Documentação', 10, 'Conferir documentos do comprador, do vendedor e do imóvel', '', 'Sim'],
  [5, 'Avaliação do imóvel', 10, 'Acompanhar vistoria e laudo de avaliação', '', 'Sim'],
  [6, 'Análise jurídica', 10, 'Acompanhar a análise jurídica', '', 'Sim'],
  [7, 'Contrato', 7, 'Agendar a assinatura do contrato', '', 'Sim'],
  [8, 'Registro em cartório', 30, 'Acompanhar ITBI e registro em cartório', '', 'Sim'],
  [9, 'Concluído', 0, 'Agradecer e pedir indicação', '', 'Sim']
];

var LISTAS_PADRAO = {
  'Origem': ['Site', 'WhatsApp', 'Instagram', 'Facebook', 'Google', 'Indicação de cliente', 'Corretor ou imobiliária', 'Outro'],
  'Operação': ['Compra de imóvel', 'Construção', 'Portabilidade', 'Crédito com garantia de imóvel', 'Outra'],
  'Tipo de imóvel': ['Usado', 'Novo', 'Na planta', 'Terreno e construção', 'Comercial'],
  'FGTS': ['Sim', 'Não', 'A verificar'],
  'Status': ['Em andamento', 'Pausado', 'Concluído', 'Perdido'],
  'Motivo': ['Desistiu da compra', 'Crédito não aprovado', 'Fechou com outro', 'Sem resposta', 'Imóvel reprovado', 'Adiou os planos', 'Outro'],
  'Tipo de lançamento': ['Receita', 'Despesa'],
  'Categoria': ['Honorários', 'Comissão de banco', 'Comissão de parceiro', 'Aluguel', 'Marketing', 'Impostos', 'Sistemas e telefone', 'Deslocamento', 'Outras receitas', 'Outras despesas'],
  'Situação': ['Previsto', 'Recebido', 'Pago']
};

var VALIDACOES = {
  CLIENTES: { 'Origem': 'Origem', 'Operação': 'Operação', 'Tipo de imóvel': 'Tipo de imóvel', 'FGTS': 'FGTS', 'Status': 'Status', 'Motivo': 'Motivo' },
  LANCAMENTOS: { 'Tipo': 'Tipo de lançamento', 'Categoria': 'Categoria', 'Situação': 'Situação' }
};

/* ───────────── App da Web ───────────── */

function doGet() {
  return HtmlService.createTemplateFromFile('Painel').evaluate()
    .setTitle(APP.titulo)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Gestão Habitar')
    .addItem('Instalar ou completar a estrutura', 'instalar')
    .addItem('Rodar a rotina diária agora', 'rotinaDiaria')
    .addToUi();
}

/* ───────────── Instalação ───────────── */

function instalar() {
  var ss = SpreadsheetApp.getActive();
  ss.setSpreadsheetTimeZone(APP.fuso);
  var eu = emailAtual_();

  aba_(ss, ABA.CLIENTES, COLUNAS.CLIENTES);
  aba_(ss, ABA.TAREFAS, COLUNAS.TAREFAS);
  aba_(ss, ABA.HISTORICO, COLUNAS.HISTORICO);
  var etapas = aba_(ss, ABA.ETAPAS, COLUNAS.ETAPAS);
  if (etapas.getLastRow() < 2) etapas.getRange(2, 1, ETAPAS_PADRAO.length, 6).setValues(ETAPAS_PADRAO);
  var equipe = aba_(ss, ABA.EQUIPE, COLUNAS.EQUIPE);
  if (equipe.getLastRow() < 2 && eu) equipe.getRange(2, 1, 1, 4).setValues([['', eu, 'Administrador', 'Sim']]);
  var listas = montarListas_(ss);

  var config = aba_(ss, ABA.CONFIG, COLUNAS.CONFIG);
  var cfg = lerConfig_();
  var linhas = [];
  if (!('Agenda' in cfg)) linhas.push(['Agenda', '', 'E-mail ou ID da Agenda Google dos atendimentos. Vazio = agenda de quem está usando.']);
  if (!('Duração padrão (min)' in cfg)) linhas.push(['Duração padrão (min)', 60, 'Duração sugerida de um atendimento.']);
  if (!('Financeiro' in cfg)) {
    var fin = criarFinanceiro_();
    linhas.push(['Financeiro', fin.getId(), 'ID da planilha restrita do Financeiro. Compartilhe só com quem pode ver valores.']);
  }
  if (linhas.length) config.getRange(config.getLastRow() + 1, 1, linhas.length, 3).setValues(linhas);

  validar_(ss.getSheetByName(ABA.CLIENTES), COLUNAS.CLIENTES, VALIDACOES.CLIENTES, listas);
  formatarClientes_(ss.getSheetByName(ABA.CLIENTES));

  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'rotinaDiaria') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('rotinaDiaria').timeBased().everyDays(1).atHour(7).inTimezone(APP.fuso).create();

  var padrao = ss.getSheetByName('Página1') || ss.getSheetByName('Sheet1');
  if (padrao && padrao.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(padrao);
  ss.setActiveSheet(ss.getSheetByName(ABA.CLIENTES));
  try {
    SpreadsheetApp.getUi().alert('Estrutura pronta. Preencha seu nome na aba EQUIPE e revise os prazos na aba ETAPAS.');
  } catch (e) { /* rodando sem interface */ }
}

function aba_(ss, nome, colunas) {
  var sh = ss.getSheetByName(nome) || ss.insertSheet(nome);
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, colunas.length).setValues([colunas])
      .setFontWeight('bold').setBackground('#161411').setFontColor('#E3BD6E');
    sh.setFrozenRows(1);
  } else {
    // Acrescenta colunas novas sem mexer nas existentes
    var atuais = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    colunas.forEach(function (c) {
      if (atuais.indexOf(c) < 0) {
        var col = sh.getLastColumn() + 1;
        sh.getRange(1, col).setValue(c).setFontWeight('bold').setBackground('#161411').setFontColor('#E3BD6E');
      }
    });
  }
  return sh;
}

function montarListas_(ss) {
  var sh = ss.getSheetByName(ABA.LISTAS);
  var nomes = Object.keys(LISTAS_PADRAO);
  if (!sh) {
    sh = ss.insertSheet(ABA.LISTAS);
    nomes.forEach(function (n, i) {
      var valores = [[n]].concat(LISTAS_PADRAO[n].map(function (v) { return [v]; }));
      sh.getRange(1, i + 1, valores.length, 1).setValues(valores);
    });
    sh.getRange(1, 1, 1, nomes.length).setFontWeight('bold').setBackground('#161411').setFontColor('#E3BD6E');
    sh.setFrozenRows(1);
  }
  var mapa = {};
  var cab = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  cab.forEach(function (n, i) { if (n) mapa[n] = sh.getRange(2, i + 1, 60, 1); });
  return mapa;
}

function validar_(sh, colunas, regras, listas) {
  Object.keys(regras).forEach(function (col) {
    var i = colunas.indexOf(col);
    var lista = listas[regras[col]];
    if (i < 0 || !lista) return;
    var regra = SpreadsheetApp.newDataValidation().requireValueInRange(lista, true).setAllowInvalid(false).build();
    sh.getRange(2, i + 1, 2000, 1).setDataValidation(regra);
  });
}

function formatarClientes_(sh) {
  var c = function (n) { return COLUNAS.CLIENTES.indexOf(n) + 1; };
  ['Entrada', 'Etapa desde', 'Data do próximo passo'].forEach(function (n) {
    sh.getRange(2, c(n), 2000, 1).setNumberFormat('dd/mm/yyyy');
  });
  sh.getRange(2, c('Atualizado em'), 2000, 1).setNumberFormat('dd/mm/yyyy hh:mm');
  ['Valor do imóvel', 'Valor de entrada', 'Valor a financiar'].forEach(function (n) {
    sh.getRange(2, c(n), 2000, 1).setNumberFormat('"R$" #,##0');
  });
}

function criarFinanceiro_() {
  var fin = SpreadsheetApp.create('Habitar · Financeiro (restrito)');
  fin.setSpreadsheetTimeZone(APP.fuso);
  var sh = fin.getSheets()[0].setName(ABA.LANCAMENTOS);
  sh.getRange(1, 1, 1, COLUNAS.LANCAMENTOS.length).setValues([COLUNAS.LANCAMENTOS])
    .setFontWeight('bold').setBackground('#161411').setFontColor('#E3BD6E');
  sh.setFrozenRows(1);
  var listas = fin.insertSheet(ABA.LISTAS);
  var mapa = {};
  ['Tipo de lançamento', 'Categoria', 'Situação'].forEach(function (n, i) {
    var valores = [[n]].concat(LISTAS_PADRAO[n].map(function (v) { return [v]; }));
    listas.getRange(1, i + 1, valores.length, 1).setValues(valores);
    mapa[n] = listas.getRange(2, i + 1, 60, 1);
  });
  validar_(sh, COLUNAS.LANCAMENTOS, VALIDACOES.LANCAMENTOS, mapa);
  sh.getRange(2, 2, 2000, 1).setNumberFormat('dd/mm/yyyy');
  sh.getRange(2, 10, 2000, 1).setNumberFormat('dd/mm/yyyy');
  sh.getRange(2, 8, 2000, 1).setNumberFormat('"R$" #,##0.00');
  return fin;
}

/* ───────────── Leitura ───────────── */

function getDados() {
  var eu = emailAtual_();
  var equipe = lerObjetos_(ABA.EQUIPE).filter(function (p) { return p['E-mail'] || p['Nome']; }).map(function (p) {
    return { nome: String(p['Nome'] || p['E-mail']).trim(), email: String(p['E-mail'] || '').trim().toLowerCase(), papel: p['Papel'], ativo: p['Ativo'] !== 'Não' };
  });
  var meu = equipe.filter(function (p) { return p.email && p.email === eu; })[0];
  var etapas = lerObjetos_(ABA.ETAPAS).filter(function (e) { return e['Etapa'] && e['Ativa'] !== 'Não'; })
    .sort(function (a, b) { return Number(a['Ordem']) - Number(b['Ordem']); })
    .map(function (e) { return { nome: e['Etapa'], prazo: Number(e['Prazo (dias)']) || 0, tarefa: e['Tarefa ao entrar'], responsavel: e['Responsável'] || '' }; });

  var historico = lerObjetos_(ABA.HISTORICO);
  return {
    hoje: hojeISO_(),
    usuario: { email: eu, nome: meu ? meu.nome : '' },
    equipe: equipe,
    etapas: etapas,
    listas: lerListas_(),
    clientes: lerObjetos_(ABA.CLIENTES).filter(function (c) { return c['ID']; }).map(clienteParaJson_),
    tarefas: lerObjetos_(ABA.TAREFAS).filter(function (t) { return t['ID'] && t['Status'] !== 'Excluída'; }).map(tarefaParaJson_),
    historico: historico.slice(-600).map(function (h) {
      return { data: dataHora_(h['Data']), clienteId: h['Cliente ID'], tipo: h['Tipo'], de: h['De'], para: h['Para'], texto: h['Texto'], por: h['Por'] };
    }),
    temFinanceiro: temAcessoFinanceiro_()
  };
}

function clienteParaJson_(c) {
  return {
    id: c['ID'], entrada: dataISO_(c['Entrada']), nome: c['Nome'], whatsapp: String(c['WhatsApp'] || ''), email: c['E-mail'],
    cidade: c['Cidade'], origem: c['Origem'], indicou: c['Quem indicou'], operacao: c['Operação'], tipoImovel: c['Tipo de imóvel'],
    valorImovel: num_(c['Valor do imóvel']), valorEntrada: num_(c['Valor de entrada']), fgts: c['FGTS'],
    valorFinanciar: num_(c['Valor a financiar']), banco: c['Banco'], etapa: c['Etapa'], etapaDesde: dataISO_(c['Etapa desde']),
    status: c['Status'] || 'Em andamento', motivo: c['Motivo'], responsavel: c['Responsável'],
    proximoPasso: c['Próximo passo'], dataProximo: dataISO_(c['Data do próximo passo']),
    atualizadoEm: dataHora_(c['Atualizado em']), atualizadoPor: c['Atualizado por'], obs: c['Observações']
  };
}

function tarefaParaJson_(t) {
  return {
    id: t['ID'], criada: dataISO_(t['Criada em']), clienteId: t['Cliente ID'], cliente: t['Cliente'], tarefa: t['Tarefa'],
    responsavel: t['Responsável'], prazo: dataISO_(t['Prazo']), status: t['Status'] || 'Pendente', origem: t['Origem'],
    concluidaEm: dataHora_(t['Concluída em']), concluidaPor: t['Concluída por'], chave: t['Chave']
  };
}

/* ───────────── Clientes ───────────── */

function salvarCliente(dados, quem) {
  return comTrava_(function () {
    var por = nomeAtual_(quem);
    var sh = planilha_(ABA.CLIENTES);
    var mapa = cabecalho_(sh);
    var agora = new Date();
    var etapas = etapasMapa_();
    var linha = dados.id ? acharLinha_(sh, mapa, 'ID', dados.id) : 0;
    var antes = linha ? lerLinha_(sh, mapa, linha) : null;

    var valorImovel = num_(dados.valorImovel), valorEntrada = num_(dados.valorEntrada);
    var registro = {
      'Nome': (dados.nome || '').trim(), 'WhatsApp': dados.whatsapp || '', 'E-mail': dados.email || '',
      'Cidade': dados.cidade || '', 'Origem': dados.origem || '', 'Quem indicou': dados.indicou || '',
      'Operação': dados.operacao || '', 'Tipo de imóvel': dados.tipoImovel || '',
      'Valor do imóvel': valorImovel || '', 'Valor de entrada': valorEntrada || '', 'FGTS': dados.fgts || '',
      'Valor a financiar': valorImovel ? Math.max(valorImovel - valorEntrada, 0) : '',
      'Banco': dados.banco || '', 'Status': dados.status || 'Em andamento', 'Motivo': dados.motivo || '',
      'Responsável': dados.responsavel || por, 'Próximo passo': dados.proximoPasso || '',
      'Data do próximo passo': dados.dataProximo ? paraData_(dados.dataProximo) : '',
      'Atualizado em': agora, 'Atualizado por': por, 'Observações': dados.obs || ''
    };
    if (!registro['Nome']) throw new Error('Informe o nome do cliente.');

    var etapaNova = dados.etapa || (antes ? antes['Etapa'] : (Object.keys(etapas)[0] || 'Novo contato'));
    if (!antes) {
      registro['ID'] = novoId_('C', sh, mapa);
      registro['Entrada'] = dados.entrada ? paraData_(dados.entrada) : hojeData_();
      registro['Etapa'] = etapaNova;
      registro['Etapa desde'] = hojeData_();
      linha = sh.getLastRow() + 1;
      escreverLinha_(sh, mapa, linha, registro);
      registrar_(registro['ID'], 'Cliente', '', etapaNova, 'Cliente cadastrado', por);
      entrarNaEtapa_(registro['ID'], registro['Nome'], etapaNova, registro['Responsável'], por);
    } else {
      registro['ID'] = antes['ID'];
      escreverLinha_(sh, mapa, linha, registro);
      if (etapaNova !== antes['Etapa']) moverEtapa_(sh, mapa, linha, antes, etapaNova, registro['Responsável'], por);
      if (registro['Status'] !== (antes['Status'] || 'Em andamento')) {
        registrar_(registro['ID'], 'Status', antes['Status'], registro['Status'], registro['Motivo'], por);
        if (registro['Status'] !== 'Em andamento') concluirAutomaticas_(registro['ID'], '', 'Cliente ' + registro['Status'].toLowerCase(), por);
      }
    }
    if (registro['Data do próximo passo'] && registro['Próximo passo']) {
      garantirTarefa_(registro['ID'], registro['Nome'], 'Próximo passo: ' + registro['Próximo passo'], registro['Responsável'],
        registro['Data do próximo passo'], 'proximo|' + registro['ID'] + '|' + dataISO_(registro['Data do próximo passo']));
    }
    return clienteParaJson_(lerLinha_(sh, mapa, linha));
  });
}

function moverCliente(id, etapa, quem) {
  return comTrava_(function () {
    var por = nomeAtual_(quem);
    var sh = planilha_(ABA.CLIENTES), mapa = cabecalho_(sh);
    var linha = acharLinha_(sh, mapa, 'ID', id);
    if (!linha) throw new Error('Cliente não encontrado.');
    var antes = lerLinha_(sh, mapa, linha);
    if (antes['Etapa'] !== etapa) moverEtapa_(sh, mapa, linha, antes, etapa, antes['Responsável'], por);
    return clienteParaJson_(lerLinha_(sh, mapa, linha));
  });
}

function moverEtapa_(sh, mapa, linha, antes, etapa, responsavel, por) {
  sh.getRange(linha, mapa['Etapa']).setValue(etapa);
  sh.getRange(linha, mapa['Etapa desde']).setValue(hojeData_());
  sh.getRange(linha, mapa['Atualizado em']).setValue(new Date());
  sh.getRange(linha, mapa['Atualizado por']).setValue(por);
  var etapas = etapasMapa_();
  var ultima = Object.keys(etapas).pop();
  if (etapa === ultima) sh.getRange(linha, mapa['Status']).setValue('Concluído');
  registrar_(antes['ID'], 'Etapa', antes['Etapa'], etapa, '', por);
  concluirAutomaticas_(antes['ID'], antes['Etapa'], 'Cliente avançou para ' + etapa, por);
  entrarNaEtapa_(antes['ID'], antes['Nome'], etapa, responsavel, por);
}

function entrarNaEtapa_(id, nome, etapa, responsavel, por) {
  var e = etapasMapa_()[etapa];
  if (!e || !e.tarefa) return;
  var prazo = hojeData_();
  prazo.setDate(prazo.getDate() + Math.max(e.prazo, 1));
  garantirTarefa_(id, nome, e.tarefa, e.responsavel || responsavel || por, prazo, 'etapa|' + id + '|' + etapa);
}

function comentar(id, texto, quem) {
  return comTrava_(function () {
    if (!String(texto || '').trim()) throw new Error('Escreva o comentário.');
    registrar_(id, 'Comentário', '', '', String(texto).trim(), nomeAtual_(quem));
    return true;
  });
}

/* ───────────── Tarefas ───────────── */

function criarTarefa(dados, quem) {
  return comTrava_(function () {
    var por = nomeAtual_(quem);
    if (!String(dados.tarefa || '').trim()) throw new Error('Descreva a tarefa.');
    var cliente = dados.clienteId ? buscarCliente_(dados.clienteId) : null;
    return tarefaParaJson_(inserirTarefa_(dados.clienteId || '', cliente ? cliente['Nome'] : '', dados.tarefa.trim(),
      dados.responsavel || por, dados.prazo ? paraData_(dados.prazo) : hojeData_(), 'Manual', ''));
  });
}

function concluirTarefa(id, quem) { return mudarTarefa_(id, 'Concluída', quem); }
function excluirTarefa(id, quem) { return mudarTarefa_(id, 'Excluída', quem); }
function reabrirTarefa(id, quem) { return mudarTarefa_(id, 'Pendente', quem); }

function mudarTarefa_(id, status, quem) {
  return comTrava_(function () {
    var sh = planilha_(ABA.TAREFAS), mapa = cabecalho_(sh);
    var linha = acharLinha_(sh, mapa, 'ID', id);
    if (!linha) throw new Error('Tarefa não encontrada.');
    sh.getRange(linha, mapa['Status']).setValue(status);
    sh.getRange(linha, mapa['Concluída em']).setValue(status === 'Pendente' ? '' : new Date());
    sh.getRange(linha, mapa['Concluída por']).setValue(status === 'Pendente' ? '' : nomeAtual_(quem));
    return tarefaParaJson_(lerLinha_(sh, mapa, linha));
  });
}

function garantirTarefa_(clienteId, nome, texto, responsavel, prazo, chave) {
  var sh = planilha_(ABA.TAREFAS), mapa = cabecalho_(sh);
  if (chave && acharLinha_(sh, mapa, 'Chave', chave)) return null;
  return inserirTarefa_(clienteId, nome, texto, responsavel, prazo, 'Automática', chave);
}

function inserirTarefa_(clienteId, nome, texto, responsavel, prazo, origem, chave) {
  var sh = planilha_(ABA.TAREFAS), mapa = cabecalho_(sh);
  var reg = {
    'ID': novoId_('T', sh, mapa), 'Criada em': new Date(), 'Cliente ID': clienteId, 'Cliente': nome, 'Tarefa': texto,
    'Responsável': responsavel, 'Prazo': prazo, 'Status': 'Pendente', 'Origem': origem, 'Chave': chave || ''
  };
  var linha = sh.getLastRow() + 1;
  escreverLinha_(sh, mapa, linha, reg);
  sh.getRange(linha, mapa['Prazo']).setNumberFormat('dd/mm/yyyy');
  return lerLinha_(sh, mapa, linha);
}

// Conclui as tarefas automáticas pendentes de um cliente (de uma etapa, ou todas se etapa = '').
function concluirAutomaticas_(clienteId, etapa, motivo, por) {
  var sh = planilha_(ABA.TAREFAS), mapa = cabecalho_(sh);
  var n = sh.getLastRow();
  if (n < 2) return;
  var dados = sh.getRange(2, 1, n - 1, sh.getLastColumn()).getValues();
  dados.forEach(function (r, i) {
    var chave = String(r[mapa['Chave'] - 1] || '');
    if (r[mapa['Status'] - 1] !== 'Pendente' || r[mapa['Cliente ID'] - 1] !== clienteId || !chave) return;
    var daEtapa = !etapa || chave.indexOf('etapa|' + clienteId + '|' + etapa) === 0 || chave.indexOf('parado|' + clienteId + '|' + etapa) === 0;
    if (!daEtapa) return;
    sh.getRange(i + 2, mapa['Status']).setValue('Concluída');
    sh.getRange(i + 2, mapa['Concluída em']).setValue(new Date());
    sh.getRange(i + 2, mapa['Concluída por']).setValue('Automático · ' + motivo);
  });
}

/* ───────────── Rotina diária (7h) ───────────── */

function rotinaDiaria() {
  var hoje = hojeData_();
  var etapas = etapasMapa_();
  var clientes = lerObjetos_(ABA.CLIENTES);
  clientes.forEach(function (c) {
    if (!c['ID'] || (c['Status'] || 'Em andamento') !== 'Em andamento') return;
    var e = etapas[c['Etapa']];
    if (e && e.prazo > 0 && c['Etapa desde'] instanceof Date) {
      var dias = Math.floor((hoje - c['Etapa desde']) / 86400000);
      if (dias > e.prazo) {
        garantirTarefa_(c['ID'], c['Nome'], 'Cliente parado em ' + c['Etapa'] + ' há ' + dias + ' dias: ver o que falta',
          c['Responsável'], hoje, 'parado|' + c['ID'] + '|' + c['Etapa']);
      }
    }
    if (c['Data do próximo passo'] instanceof Date && c['Próximo passo'] && c['Data do próximo passo'] <= hoje) {
      garantirTarefa_(c['ID'], c['Nome'], 'Próximo passo: ' + c['Próximo passo'], c['Responsável'],
        c['Data do próximo passo'], 'proximo|' + c['ID'] + '|' + dataISO_(c['Data do próximo passo']));
    }
  });
}

/* ───────────── Agenda ───────────── */

function listarAgenda(dias) {
  var agenda = agenda_();
  var inicio = hojeData_();
  var fim = new Date(inicio.getTime() + (dias || 14) * 86400000);
  return agenda.getEvents(inicio, fim).map(function (ev) {
    var desc = ev.getDescription() || '';
    var m = desc.match(/\[HAB-(C\d+)\]/);
    return {
      id: ev.getId(), titulo: ev.getTitle(), inicio: dataHora_(ev.getStartTime()), fim: dataHora_(ev.getEndTime()),
      diaInteiro: ev.isAllDayEvent(), local: ev.getLocation(), clienteId: m ? m[1] : '',
      descricao: desc.replace(/\[HAB-C\d+\]/, '').trim()
    };
  });
}

function criarAtendimento(dados, quem) {
  var por = nomeAtual_(quem);
  var cliente = dados.clienteId ? buscarCliente_(dados.clienteId) : null;
  var nome = cliente ? cliente['Nome'] : (dados.titulo || 'Atendimento');
  var inicio = paraDataHora_(dados.data, dados.hora);
  var fim = new Date(inicio.getTime() + (Number(dados.duracao) || 60) * 60000);
  var descricao = (dados.obs ? dados.obs + '\n\n' : '') + 'Marcado por ' + por + ' no Gestão Habitar.' +
    (cliente ? '\n[HAB-' + cliente['ID'] + ']' : '');
  var ev = agenda_().createEvent((dados.tipo || 'Atendimento') + ' · ' + nome, inicio, fim,
    { location: dados.local || '', description: descricao });
  if (cliente) {
    registrar_(cliente['ID'], 'Atendimento', '', '', (dados.tipo || 'Atendimento') + ' em ' +
      Utilities.formatDate(inicio, APP.fuso, "dd/MM/yyyy 'às' HH:mm") + (dados.local ? ' · ' + dados.local : ''), por);
  }
  return { id: ev.getId() };
}

function agenda_() {
  var id = String(lerConfig_()['Agenda'] || '').trim();
  var cal = id ? CalendarApp.getCalendarById(id) : CalendarApp.getDefaultCalendar();
  if (!cal) throw new Error('Não consegui abrir a agenda "' + id + '". Confira o e-mail na aba CONFIG e se ela foi compartilhada com você.');
  return cal;
}

/* ───────────── Financeiro (planilha restrita) ───────────── */

function getFinanceiro() {
  var fin = financeiro_();
  if (!fin) return { semAcesso: true };
  var sh = fin.getSheetByName(ABA.LANCAMENTOS);
  return {
    lancamentos: lerObjetosDe_(sh).filter(function (l) { return l['ID']; }).map(lancamentoParaJson_),
    categorias: LISTAS_PADRAO['Categoria']
  };
}

function lancar(dados, quem) {
  return comTrava_(function () {
    var fin = financeiro_();
    if (!fin) throw new Error('Você não tem acesso ao Financeiro.');
    var valor = num_(dados.valor);
    if (!valor) throw new Error('Informe o valor.');
    var sh = fin.getSheetByName(ABA.LANCAMENTOS), mapa = cabecalho_(sh);
    var cliente = dados.clienteId ? buscarCliente_(dados.clienteId) : null;
    var reg = {
      'ID': novoId_('L', sh, mapa), 'Data': paraData_(dados.data || hojeISO_()), 'Tipo': dados.tipo, 'Categoria': dados.categoria,
      'Descrição': dados.descricao || '', 'Cliente ID': dados.clienteId || '', 'Cliente': cliente ? cliente['Nome'] : '',
      'Valor': valor, 'Situação': dados.situacao || 'Previsto', 'Vencimento': dados.vencimento ? paraData_(dados.vencimento) : '',
      'Registrado por': nomeAtual_(quem)
    };
    var linha = sh.getLastRow() + 1;
    escreverLinha_(sh, mapa, linha, reg);
    return lancamentoParaJson_(lerLinha_(sh, mapa, linha));
  });
}

function marcarLancamento(id, situacao) {
  return comTrava_(function () {
    var fin = financeiro_();
    if (!fin) throw new Error('Você não tem acesso ao Financeiro.');
    var sh = fin.getSheetByName(ABA.LANCAMENTOS), mapa = cabecalho_(sh);
    var linha = acharLinha_(sh, mapa, 'ID', id);
    if (!linha) throw new Error('Lançamento não encontrado.');
    sh.getRange(linha, mapa['Situação']).setValue(situacao);
    return lancamentoParaJson_(lerLinha_(sh, mapa, linha));
  });
}

function lancamentoParaJson_(l) {
  return {
    id: l['ID'], data: dataISO_(l['Data']), tipo: l['Tipo'], categoria: l['Categoria'], descricao: l['Descrição'],
    clienteId: l['Cliente ID'], cliente: l['Cliente'], valor: num_(l['Valor']), situacao: l['Situação'],
    vencimento: dataISO_(l['Vencimento']), por: l['Registrado por']
  };
}

function financeiro_() {
  var id = String(lerConfig_()['Financeiro'] || '').trim();
  if (!id) return null;
  try { return SpreadsheetApp.openById(id); } catch (e) { return null; }
}

function temAcessoFinanceiro_() { return !!financeiro_(); }

/* ───────────── Utilitários ───────────── */

function comTrava_(fn) {
  var trava = LockService.getScriptLock();
  if (!trava.tryLock(20000)) throw new Error('A planilha está ocupada. Tente de novo em alguns segundos.');
  try { return fn(); } finally { SpreadsheetApp.flush(); trava.releaseLock(); }
}

function planilha_(nome) {
  var sh = SpreadsheetApp.getActive().getSheetByName(nome);
  if (!sh) throw new Error('A aba ' + nome + ' não existe. Rode instalar() no Apps Script.');
  return sh;
}

function cabecalho_(sh) {
  var mapa = {};
  sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].forEach(function (n, i) { if (n) mapa[n] = i + 1; });
  return mapa;
}

function lerObjetos_(nome) {
  var sh = SpreadsheetApp.getActive().getSheetByName(nome);
  return sh ? lerObjetosDe_(sh) : [];
}

function lerObjetosDe_(sh) {
  var n = sh.getLastRow();
  if (n < 2) return [];
  var valores = sh.getRange(1, 1, n, sh.getLastColumn()).getValues();
  var cab = valores.shift();
  return valores.map(function (r) {
    var o = {};
    cab.forEach(function (c, i) { if (c) o[c] = r[i]; });
    return o;
  });
}

function lerLinha_(sh, mapa, linha) {
  var r = sh.getRange(linha, 1, 1, sh.getLastColumn()).getValues()[0];
  var o = {};
  Object.keys(mapa).forEach(function (c) { o[c] = r[mapa[c] - 1]; });
  return o;
}

function escreverLinha_(sh, mapa, linha, reg) {
  Object.keys(reg).forEach(function (c) { if (mapa[c]) sh.getRange(linha, mapa[c]).setValue(reg[c]); });
}

function acharLinha_(sh, mapa, coluna, valor) {
  var n = sh.getLastRow();
  if (n < 2 || !mapa[coluna]) return 0;
  var vals = sh.getRange(2, mapa[coluna], n - 1, 1).getValues();
  for (var i = 0; i < vals.length; i++) if (String(vals[i][0]) === String(valor)) return i + 2;
  return 0;
}

function novoId_(prefixo, sh, mapa) {
  var n = sh.getLastRow(), maior = 0;
  if (n >= 2) sh.getRange(2, mapa['ID'], n - 1, 1).getValues().forEach(function (r) {
    var v = parseInt(String(r[0]).replace(/\D/g, ''), 10);
    if (v > maior) maior = v;
  });
  return prefixo + String(maior + 1).padStart(4, '0');
}

function buscarCliente_(id) {
  var sh = planilha_(ABA.CLIENTES), mapa = cabecalho_(sh);
  var linha = acharLinha_(sh, mapa, 'ID', id);
  return linha ? lerLinha_(sh, mapa, linha) : null;
}

function registrar_(clienteId, tipo, de, para, texto, por) {
  planilha_(ABA.HISTORICO).appendRow([new Date(), clienteId, tipo, de || '', para || '', texto || '', por || '']);
}

function etapasMapa_() {
  var mapa = {};
  lerObjetos_(ABA.ETAPAS).filter(function (e) { return e['Etapa'] && e['Ativa'] !== 'Não'; })
    .sort(function (a, b) { return Number(a['Ordem']) - Number(b['Ordem']); })
    .forEach(function (e) { mapa[e['Etapa']] = { prazo: Number(e['Prazo (dias)']) || 0, tarefa: e['Tarefa ao entrar'], responsavel: e['Responsável'] || '' }; });
  return mapa;
}

function lerListas_() {
  var sh = SpreadsheetApp.getActive().getSheetByName(ABA.LISTAS);
  if (!sh) return LISTAS_PADRAO;
  var vals = sh.getDataRange().getValues();
  var listas = {};
  vals[0].forEach(function (nome, i) {
    if (!nome) return;
    listas[nome] = vals.slice(1).map(function (r) { return r[i]; }).filter(function (v) { return v !== ''; });
  });
  return listas;
}

function lerConfig_() {
  var cfg = {};
  lerObjetos_(ABA.CONFIG).forEach(function (r) { if (r['Chave']) cfg[r['Chave']] = r['Valor']; });
  return cfg;
}

function emailAtual_() {
  try { return String(Session.getActiveUser().getEmail() || '').toLowerCase(); } catch (e) { return ''; }
}

// Nome de quem está usando: equipe pelo e-mail; se o Google não informar, o nome escolhido no painel.
function nomeAtual_(quem) {
  var eu = emailAtual_();
  if (eu) {
    var p = lerObjetos_(ABA.EQUIPE).filter(function (x) { return String(x['E-mail']).trim().toLowerCase() === eu; })[0];
    if (p && p['Nome']) return String(p['Nome']).trim();
  }
  return String(quem || eu || 'Equipe').trim();
}

function num_(v) {
  if (typeof v === 'number') return v;
  var s = String(v || '').replace(/[^\d,.-]/g, '');
  if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.');
  else s = s.replace(/\.(?=\d{3}(\D|$))/g, '');
  return Number(s) || 0;
}

function hojeData_() {
  var p = hojeISO_().split('-');
  return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
}
function hojeISO_() { return Utilities.formatDate(new Date(), APP.fuso, 'yyyy-MM-dd'); }
function dataISO_(v) { return v instanceof Date ? Utilities.formatDate(v, APP.fuso, 'yyyy-MM-dd') : (v ? String(v) : ''); }
function dataHora_(v) { return v instanceof Date ? Utilities.formatDate(v, APP.fuso, "yyyy-MM-dd'T'HH:mm") : (v ? String(v) : ''); }
function paraData_(iso) {
  var p = String(iso).split('-');
  return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
}
function paraDataHora_(iso, hora) {
  var d = paraData_(iso), h = String(hora || '09:00').split(':');
  d.setHours(Number(h[0]) || 0, Number(h[1]) || 0, 0, 0);
  return d;
}
