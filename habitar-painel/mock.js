/* Dados FICTÍCIOS só para a prévia do painel. Não vai para o Apps Script.
   Imita as funções do Codigo.gs guardando tudo na memória do navegador. */
(function () {
  var hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  function iso(n) { var x = new Date(hoje); x.setDate(x.getDate() + n); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); }
  function agoraISO() { var x = new Date(); return iso(0) + 'T' + String(x.getHours()).padStart(2, '0') + ':' + String(x.getMinutes()).padStart(2, '0'); }

  var etapas = [
    ['Novo contato', 2, 'Fazer o primeiro contato e entender o objetivo'], ['Simulação', 3, 'Enviar a simulação ao cliente'],
    ['Análise de crédito', 7, 'Acompanhar a análise de crédito'], ['Documentação', 10, 'Conferir documentos do comprador, do vendedor e do imóvel'],
    ['Avaliação do imóvel', 10, 'Acompanhar vistoria e laudo de avaliação'], ['Análise jurídica', 10, 'Acompanhar a análise jurídica'],
    ['Contrato', 7, 'Agendar a assinatura do contrato'], ['Registro em cartório', 30, 'Acompanhar ITBI e registro em cartório'],
    ['Concluído', 0, 'Agradecer e pedir indicação']
  ].map(function (e) { return { nome: e[0], prazo: e[1], tarefa: e[2], responsavel: '' }; });

  var listas = {
    'Origem': ['Site', 'WhatsApp', 'Instagram', 'Facebook', 'Google', 'Indicação de cliente', 'Corretor ou imobiliária', 'Outro'],
    'Operação': ['Compra de imóvel', 'Construção', 'Portabilidade', 'Crédito com garantia de imóvel', 'Outra'],
    'Tipo de imóvel': ['Usado', 'Novo', 'Na planta', 'Terreno e construção', 'Comercial'],
    'FGTS': ['Sim', 'Não', 'A verificar'],
    'Status': ['Em andamento', 'Pausado', 'Concluído', 'Perdido'],
    'Motivo': ['Desistiu da compra', 'Crédito não aprovado', 'Fechou com outro', 'Sem resposta', 'Imóvel reprovado', 'Adiou os planos', 'Outro']
  };
  var equipe = [{ nome: 'Rosane', email: 'rosane@exemplo.com', papel: 'Administrador', ativo: true }, { nome: 'Assistente', email: 'assistente@exemplo.com', papel: 'Equipe', ativo: true }];

  // [nome, etapa, dias na etapa, entrada (dias atrás), valor imóvel, entrada, banco, origem, cidade, resp, próximo passo, data (dias), status]
  var base = [
    ['Exemplo · Ana Souza', 'Novo contato', 0, 0, 0, 0, '', 'Site', 'Santos', 'Rosane', 'Retornar a mensagem do site', 0],
    ['Exemplo · Bruno Lima', 'Novo contato', 3, 3, 420000, 90000, '', 'Instagram', 'São Vicente', 'Assistente', 'Ligar para entender o imóvel', -1],
    ['Exemplo · Carla e Diego', 'Simulação', 1, 6, 650000, 160000, '', 'Indicação de cliente', 'Santos', 'Rosane', 'Enviar simulação SAC × Price', 1],
    ['Exemplo · Eduardo Reis', 'Simulação', 5, 12, 380000, 76000, '', 'WhatsApp', 'Praia Grande', 'Rosane', '', null],
    ['Exemplo · Fernanda Alves', 'Análise de crédito', 4, 20, 520000, 130000, 'Banco A', 'Site', 'Santos', 'Rosane', 'Cobrar retorno da análise', 2],
    ['Exemplo · Gustavo Prado', 'Análise de crédito', 9, 28, 890000, 300000, 'Banco B', 'Corretor ou imobiliária', 'Guarujá', 'Assistente', '', null],
    ['Exemplo · Helena Costa', 'Documentação', 6, 35, 470000, 110000, 'Banco A', 'Indicação de cliente', 'Santos', 'Assistente', 'Pedir matrícula atualizada', 0],
    ['Exemplo · Igor e Júlia', 'Documentação', 13, 44, 720000, 200000, 'Banco C', 'Google', 'Santos', 'Rosane', 'Conferir certidões do vendedor', 3],
    ['Exemplo · Karina Melo', 'Avaliação do imóvel', 4, 50, 560000, 140000, 'Banco B', 'Site', 'São Vicente', 'Rosane', 'Acompanhar a vistoria', 4],
    ['Exemplo · Lucas Torres', 'Análise jurídica', 8, 63, 610000, 180000, 'Banco A', 'Instagram', 'Santos', 'Assistente', '', null],
    ['Exemplo · Marina Dias', 'Contrato', 2, 75, 480000, 120000, 'Banco C', 'Indicação de cliente', 'Santos', 'Rosane', 'Assinatura no banco', 5],
    ['Exemplo · Nelson Ferraz', 'Registro em cartório', 18, 98, 750000, 250000, 'Banco B', 'Corretor ou imobiliária', 'Guarujá', 'Assistente', 'Conferir registro no cartório', 6],
    ['Exemplo · Olívia Ramos', 'Concluído', 9, 120, 430000, 95000, 'Banco A', 'Site', 'Santos', 'Rosane', '', null, 'Concluído'],
    ['Exemplo · Paulo Nunes', 'Simulação', 20, 40, 300000, 30000, '', 'Facebook', 'Cubatão', 'Assistente', '', null, 'Perdido', 'Adiou os planos']
  ];
  var clientes = base.map(function (b, i) {
    var vi = b[4], ve = b[5];
    return {
      id: 'C' + String(i + 1).padStart(4, '0'), entrada: iso(-b[3]), nome: b[0], whatsapp: '(13) 90000-00' + String(10 + i), email: '',
      cidade: b[8], origem: b[7], indicou: b[7] === 'Indicação de cliente' ? 'Exemplo · cliente anterior' : '', operacao: 'Compra de imóvel',
      tipoImovel: i % 3 ? 'Usado' : 'Novo', valorImovel: vi, valorEntrada: ve, fgts: i % 2 ? 'Sim' : 'A verificar', valorFinanciar: vi ? vi - ve : 0,
      banco: b[6], etapa: b[1], etapaDesde: iso(-b[2]), status: b[12] || 'Em andamento', motivo: b[13] || '', responsavel: b[9],
      proximoPasso: b[10], dataProximo: b[11] == null ? '' : iso(b[11]), atualizadoEm: agoraISO(), atualizadoPor: b[9], obs: ''
    };
  });
  var tarefas = [], historico = [], seqT = 0;
  function novaTarefa(c, texto, resp, prazo, origem, chave) {
    seqT++;
    var t = { id: 'T' + String(seqT).padStart(4, '0'), criada: iso(0), clienteId: c ? c.id : '', cliente: c ? c.nome : '', tarefa: texto, responsavel: resp,
      prazo: prazo, status: 'Pendente', origem: origem, concluidaEm: '', concluidaPor: '', chave: chave || '' };
    tarefas.push(t); return t;
  }
  clientes.forEach(function (c) {
    historico.push({ data: c.entrada + 'T10:00', clienteId: c.id, tipo: 'Cliente', de: '', para: 'Novo contato', texto: 'Cliente cadastrado', por: c.responsavel });
    if (c.etapa !== 'Novo contato') historico.push({ data: c.etapaDesde + 'T15:00', clienteId: c.id, tipo: 'Etapa', de: 'etapa anterior', para: c.etapa, texto: '', por: c.responsavel });
    if (c.status !== 'Em andamento') return;
    var e = etapas.filter(function (x) { return x.nome === c.etapa; })[0];
    var dias = Math.round((hoje - new Date(c.etapaDesde + 'T00:00')) / 86400000);
    novaTarefa(c, e.tarefa, c.responsavel, iso(-dias + Math.max(e.prazo, 1)), 'Automática', 'etapa|' + c.id + '|' + c.etapa);
    if (e.prazo && dias > e.prazo) novaTarefa(c, 'Cliente parado em ' + c.etapa + ' há ' + dias + ' dias: ver o que falta', c.responsavel, iso(0), 'Automática', 'parado|' + c.id + '|' + c.etapa);
  });
  novaTarefa(null, 'Postar conteúdo sobre FGTS no Instagram', 'Assistente', iso(2), 'Manual');
  historico.push({ data: iso(-1) + 'T11:20', clienteId: 'C0008', tipo: 'Comentário', de: '', para: '', texto: 'Vendedor ficou de mandar a certidão até sexta.', por: 'Rosane' });

  var agenda = [
    [0, '14:00', 60, 'Primeira conversa', 'C0001', 'Escritório · Av. Affonso Pena, 167'],
    [1, '10:00', 60, 'Simulação', 'C0003', 'Escritório · Av. Affonso Pena, 167'],
    [2, '16:00', 45, 'Entrega de documentos', 'C0007', 'Escritório · Av. Affonso Pena, 167'],
    [5, '11:00', 90, 'Assinatura do contrato', 'C0011', 'Agência bancária'],
    [8, '09:30', 30, 'Retorno', 'C0005', 'On-line']
  ].map(function (a, i) {
    var c = clientes.filter(function (x) { return x.id === a[4]; })[0];
    var h = a[1].split(':'), fim = new Date(2000, 0, 1, +h[0], +h[1] + a[2]);
    return { id: 'E' + i, titulo: a[3] + ' · ' + c.nome, inicio: iso(a[0]) + 'T' + a[1], fim: iso(a[0]) + 'T' + String(fim.getHours()).padStart(2, '0') + ':' + String(fim.getMinutes()).padStart(2, '0'),
      diaInteiro: false, local: a[5], clienteId: c.id, descricao: '' };
  });

  var lanc = [], seqL = 0;
  function L(dia, tipo, cat, desc, cli, valor, sit, venc) {
    seqL++; lanc.push({ id: 'L' + String(seqL).padStart(4, '0'), data: iso(dia), tipo: tipo, categoria: cat, descricao: desc, clienteId: cli || '', cliente: cli ? clientes.filter(function (c) { return c.id === cli; })[0].nome : '', valor: valor, situacao: sit, vencimento: venc == null ? '' : iso(venc), por: 'Rosane' });
  }
  for (var m = 11; m >= 0; m--) {
    var dia = -m * 30 - 5;
    L(dia, 'Receita', 'Honorários', 'Assessoria concluída', null, 2500 + (m % 4) * 900, 'Recebido');
    if (m % 2) L(dia + 3, 'Receita', 'Comissão de banco', 'Comissão de financiamento', null, 1800 + (m % 3) * 700, 'Recebido');
    L(dia + 1, 'Despesa', 'Aluguel', 'Aluguel do escritório', null, 1900, 'Pago');
    L(dia + 2, 'Despesa', 'Marketing', 'Anúncios', null, 350 + (m % 3) * 100, 'Pago');
    L(dia + 4, 'Despesa', 'Sistemas e telefone', 'Telefone e internet', null, 240, 'Pago');
  }
  L(-2, 'Receita', 'Honorários', 'Assessoria', 'C0013', 3200, 'Recebido');
  L(0, 'Receita', 'Honorários', '2ª parcela da assessoria', 'C0011', 1500, 'Previsto', 6);
  L(0, 'Receita', 'Comissão de banco', 'Comissão do contrato', 'C0012', 2800, 'Previsto', 20);
  L(-3, 'Receita', 'Honorários', '1ª parcela', 'C0010', 1200, 'Previsto', -3);
  L(1, 'Despesa', 'Impostos', 'DAS do mês', null, 610, 'Previsto', 12);

  function cli(id) { return clientes.filter(function (c) { return c.id === id; })[0]; }
  function reg(id, tipo, de, para, texto, por) { historico.push({ data: agoraISO(), clienteId: id, tipo: tipo, de: de || '', para: para || '', texto: texto || '', por: por || 'Rosane' }); }
  function num(v) { var s = String(v || '').replace(/[^\d,.-]/g, ''); if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.'); else s = s.replace(/\.(?=\d{3}(\D|$))/g, ''); return Number(s) || 0; }
  function entrar(c, etapa, por) {
    tarefas.forEach(function (t) { if (t.status === 'Pendente' && t.clienteId === c.id && (t.chave.indexOf('etapa|' + c.id + '|' + c.etapa) === 0 || t.chave.indexOf('parado|' + c.id + '|' + c.etapa) === 0)) { t.status = 'Concluída'; t.concluidaEm = agoraISO(); t.concluidaPor = 'Automático · avançou para ' + etapa; } });
    reg(c.id, 'Etapa', c.etapa, etapa, '', por);
    c.etapa = etapa; c.etapaDesde = iso(0);
    if (etapa === etapas[etapas.length - 1].nome) c.status = 'Concluído';
    var e = etapas.filter(function (x) { return x.nome === etapa; })[0];
    if (e && e.tarefa) novaTarefa(c, e.tarefa, c.responsavel || por, iso(Math.max(e.prazo, 1)), 'Automática', 'etapa|' + c.id + '|' + etapa);
  }

  window.MOCK = {
    getDados: function () {
      return { hoje: iso(0), usuario: { email: 'rosane@exemplo.com', nome: 'Rosane' }, equipe: equipe, etapas: etapas, listas: listas, clientes: clientes,
        tarefas: tarefas.filter(function (t) { return t.status !== 'Excluída'; }), historico: historico, temFinanceiro: true };
    },
    salvarCliente: function (d, quem) {
      var c = d.id ? cli(d.id) : null, novo = !c;
      if (!String(d.nome || '').trim()) throw new Error('Informe o nome do cliente.');
      if (novo) { c = { id: 'C' + String(clientes.length + 1).padStart(4, '0'), entrada: d.entrada || iso(0), etapa: d.etapa || etapas[0].nome, etapaDesde: iso(0), status: 'Em andamento' }; clientes.push(c); }
      var etapaNova = d.etapa, statusAntes = c.status;
      ['nome', 'whatsapp', 'email', 'cidade', 'origem', 'indicou', 'operacao', 'tipoImovel', 'fgts', 'banco', 'status', 'motivo', 'responsavel', 'proximoPasso', 'dataProximo', 'obs'].forEach(function (k) { c[k] = d[k] || ''; });
      c.status = c.status || 'Em andamento'; c.responsavel = c.responsavel || quem || 'Rosane';
      c.valorImovel = num(d.valorImovel); c.valorEntrada = num(d.valorEntrada); c.valorFinanciar = c.valorImovel ? Math.max(c.valorImovel - c.valorEntrada, 0) : 0;
      c.atualizadoEm = agoraISO(); c.atualizadoPor = quem || 'Rosane';
      if (novo) {
        reg(c.id, 'Cliente', '', c.etapa, 'Cliente cadastrado', quem);
        var e = etapas.filter(function (x) { return x.nome === c.etapa; })[0];
        if (e) novaTarefa(c, e.tarefa, c.responsavel, iso(Math.max(e.prazo, 1)), 'Automática', 'etapa|' + c.id + '|' + c.etapa);
      } else {
        if (etapaNova && etapaNova !== c.etapa) entrar(c, etapaNova, quem);
        if (c.status !== statusAntes) reg(c.id, 'Status', statusAntes, c.status, c.motivo, quem);
      }
      if (c.proximoPasso && c.dataProximo) {
        var chave = 'proximo|' + c.id + '|' + c.dataProximo;
        if (!tarefas.some(function (t) { return t.chave === chave; })) novaTarefa(c, 'Próximo passo: ' + c.proximoPasso, c.responsavel, c.dataProximo, 'Automática', chave);
      }
      return c;
    },
    moverCliente: function (id, etapa, quem) { var c = cli(id); if (c.etapa !== etapa) entrar(c, etapa, quem); return c; },
    comentar: function (id, texto, quem) { reg(id, 'Comentário', '', '', texto, quem); return true; },
    criarTarefa: function (d, quem) { return novaTarefa(d.clienteId ? cli(d.clienteId) : null, d.tarefa, d.responsavel || quem, d.prazo || iso(0), 'Manual'); },
    concluirTarefa: function (id, quem) { var t = tarefas.filter(function (x) { return x.id === id; })[0]; t.status = 'Concluída'; t.concluidaEm = agoraISO(); t.concluidaPor = quem || 'Rosane'; return t; },
    reabrirTarefa: function (id) { var t = tarefas.filter(function (x) { return x.id === id; })[0]; t.status = 'Pendente'; t.concluidaEm = ''; t.concluidaPor = ''; return t; },
    excluirTarefa: function (id) { var t = tarefas.filter(function (x) { return x.id === id; })[0]; t.status = 'Excluída'; return t; },
    listarAgenda: function () { return agenda.slice().sort(function (a, b) { return a.inicio.localeCompare(b.inicio); }); },
    criarAtendimento: function (d, quem) {
      var c = d.clienteId ? cli(d.clienteId) : null, h = d.hora.split(':'), fim = new Date(2000, 0, 1, +h[0], +h[1] + (+d.duracao || 60));
      agenda.push({ id: 'E' + agenda.length, titulo: d.tipo + ' · ' + (c ? c.nome : 'Atendimento'), inicio: d.data + 'T' + d.hora, fim: d.data + 'T' + String(fim.getHours()).padStart(2, '0') + ':' + String(fim.getMinutes()).padStart(2, '0'), diaInteiro: false, local: d.local, clienteId: c ? c.id : '', descricao: d.obs });
      if (c) reg(c.id, 'Atendimento', '', '', d.tipo + ' em ' + d.data.split('-').reverse().join('/') + ' às ' + d.hora + ' · ' + d.local, quem);
      return { id: 'novo' };
    },
    getFinanceiro: function () { return { lancamentos: lanc, categorias: ['Honorários', 'Comissão de banco', 'Comissão de parceiro', 'Aluguel', 'Marketing', 'Impostos', 'Sistemas e telefone', 'Deslocamento', 'Outras receitas', 'Outras despesas'] }; },
    lancar: function (d, quem) {
      var v = num(d.valor); if (!v) throw new Error('Informe o valor.');
      var c = d.clienteId ? cli(d.clienteId) : null; seqL++;
      var l = { id: 'L' + String(seqL).padStart(4, '0'), data: d.data || iso(0), tipo: d.tipo, categoria: d.categoria, descricao: d.descricao || '', clienteId: d.clienteId || '', cliente: c ? c.nome : '', valor: v, situacao: d.situacao, vencimento: d.vencimento || '', por: quem || 'Rosane' };
      lanc.push(l); return l;
    },
    marcarLancamento: function (id, sit) { var l = lanc.filter(function (x) { return x.id === id; })[0]; l.situacao = sit; return l; }
  };
})();
