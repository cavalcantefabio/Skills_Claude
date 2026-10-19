// Habitar Consultoria — interações da landing page.
// Tudo funciona sem JavaScript (links de WhatsApp já vêm prontos no HTML); o script só acrescenta conforto.
(function () {
  'use strict';

  var WA_NUMBER = '5513997220749';
  var doc = document.documentElement;
  doc.classList.add('js');

  // Menu mobile
  var toggle = document.querySelector('.menu-toggle');
  var nav = document.getElementById('menu');
  if (toggle && nav) {
    var setOpen = function (open) {
      toggle.setAttribute('aria-expanded', String(open));
      nav.classList.toggle('is-open', open);
    };
    toggle.addEventListener('click', function () {
      setOpen(toggle.getAttribute('aria-expanded') !== 'true');
    });
    nav.addEventListener('click', function (e) {
      if (e.target.closest('a')) setOpen(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') setOpen(false);
    });
  }

  // Sombra discreta no topo ao rolar
  var bar = document.querySelector('.topbar');
  var onScroll = function () { bar.classList.toggle('is-scrolled', window.scrollY > 8); };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Entrada das seções (escalonada por seção)
  var reveals = document.querySelectorAll('.reveal');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!('IntersectionObserver' in window) || reduce) {
    reveals.forEach(function (el) { el.classList.add('is-in'); });
  } else {
    var groups = new Map();
    reveals.forEach(function (el) {
      var parent = el.closest('section, footer') || document.body;
      var n = groups.get(parent) || 0;
      el.style.setProperty('--d', Math.min(n, 6) * 80 + 'ms');
      groups.set(parent, n + 1);
    });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    reveals.forEach(function (el) { io.observe(el); });
  }

  // Foto da Rosane: mostra o aviso [PREENCHER] enquanto o arquivo não existir
  var photo = document.querySelector('.about__photo img');
  if (photo) {
    var missing = function () { photo.parentElement.classList.add('is-missing'); };
    if (photo.complete && photo.naturalWidth === 0) missing();
    photo.addEventListener('error', missing);
  }

  // Mapa carregado sob demanda (desempenho e privacidade)
  var mapBtn = document.getElementById('carregar-mapa');
  if (mapBtn) {
    mapBtn.addEventListener('click', function () {
      var map = document.getElementById('mapa');
      var iframe = document.createElement('iframe');
      iframe.src = 'https://www.google.com/maps?q=' + encodeURIComponent('Avenida Affonso Pena, 167, Santos - SP') + '&output=embed';
      iframe.title = 'Mapa: Avenida Affonso Pena, 167, Santos - SP';
      iframe.loading = 'lazy';
      iframe.referrerPolicy = 'no-referrer-when-downgrade';
      iframe.setAttribute('allowfullscreen', '');
      map.innerHTML = '';
      map.appendChild(iframe);
    });
  }

  // Planejador: cálculo apenas local, sem taxas e sem armazenamento
  var form = document.getElementById('plano');
  if (form) {
    var brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
    var int = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
    var valorEl = form.querySelector('#valor');
    var entradaEl = form.querySelector('#entrada');
    var out = {
      entrada: document.getElementById('r-entrada'),
      financiar: document.getElementById('r-financiar'),
      msg: document.getElementById('r-msg'),
      bar: document.getElementById('barra-entrada')
    };

    var parse = function (input) {
      var digits = input.value.replace(/\D/g, '').slice(0, 12);
      return digits ? parseInt(digits, 10) : 0;
    };
    var mask = function (input) {
      var v = parse(input);
      input.value = v ? int.format(v) : '';
    };

    var state = function () {
      var valor = parse(valorEl);
      var entrada = parse(entradaEl);
      return {
        valor: valor,
        entrada: entrada,
        financiar: Math.max(valor - entrada, 0),
        pct: valor ? Math.min(entrada / valor, 1) : 0
      };
    };

    var render = function () {
      var s = state();
      if (!s.valor) {
        out.entrada.textContent = '—';
        out.financiar.textContent = '—';
        out.bar.style.width = '0';
        out.msg.textContent = 'Preencha o valor do imóvel e a entrada para ver o seu cenário.';
        return;
      }
      var pct = Math.round(s.pct * 100);
      out.entrada.textContent = brl.format(s.entrada) + ' (' + pct + '%)';
      out.financiar.textContent = brl.format(s.financiar);
      out.bar.style.width = (s.pct * 100).toFixed(1) + '%';
      if (s.entrada >= s.valor) {
        out.msg.textContent = 'Sua entrada cobre o valor do imóvel. Podemos conversar sobre a compra e os custos de cartório e ITBI.';
      } else {
        out.msg.textContent = 'A entrada mínima e o valor financiável dependem da instituição e da modalidade. Na conversa verificamos se este cenário é viável e se o FGTS pode ajudar.';
      }
    };

    [valorEl, entradaEl].forEach(function (input) {
      input.addEventListener('input', function () { mask(input); render(); });
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var s = state();
      var lines = ['Olá! Encontrei o escritório pelo site e gostaria de saber mais sobre financiamento imobiliário.'];
      if (s.valor) {
        lines.push('', 'Meu plano:',
          '• Valor do imóvel: ' + brl.format(s.valor),
          '• Entrada disponível: ' + brl.format(s.entrada),
          '• Valor a financiar (estimativa): ' + brl.format(s.financiar));
      }
      lines.push('• Uso do FGTS: ' + form.fgts.value,
        '• Tipo de imóvel: ' + form.tipo.value,
        '• Cidade: ' + form.cidade.value);
      var url = 'https://wa.me/' + WA_NUMBER + '?text=' + encodeURIComponent(lines.join('\n'));
      window.open(url, '_blank', 'noopener');
    });
  }

  var ano = document.getElementById('ano');
  if (ano) ano.textContent = new Date().getFullYear();
})();
