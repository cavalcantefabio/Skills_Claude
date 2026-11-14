-- Catálogo inicial de programas do sistema (owner_user_id nulo).
INSERT INTO "programs" ("slug", "name", "kind", "unit", "website") VALUES
  ('livelo',          'Livelo',            'banco', 'pontos', 'https://www.livelo.com.br'),
  ('esfera',          'Esfera',            'banco', 'pontos', 'https://www.esfera.com.vc'),
  ('atomos',          'Átomos (C6 Bank)',  'banco', 'átomos', 'https://www.c6bank.com.br'),
  ('inter-loop',      'Inter Loop',        'banco', 'pontos', 'https://www.bancointer.com.br'),
  ('smiles',          'Smiles',            'aerea', 'milhas', 'https://www.smiles.com.br'),
  ('latam-pass',      'LATAM Pass',        'aerea', 'pontos', 'https://latampass.latam.com'),
  ('azul-fidelidade', 'Azul Fidelidade',   'aerea', 'pontos', 'https://www.voeazul.com.br'),
  ('tap-miles-go',    'TAP Miles&Go',      'aerea', 'milhas', 'https://www.flytap.com'),
  ('flying-blue',     'Flying Blue',       'aerea', 'milhas', 'https://www.flyingblue.com'),
  ('aadvantage',      'AAdvantage',        'aerea', 'milhas', 'https://www.aa.com'),
  ('iberia-plus',     'Iberia Club',       'aerea', 'Avios',  'https://www.iberia.com'),
  ('all-accor',       'ALL Accor',         'hotel', 'pontos', 'https://all.accor.com')
ON CONFLICT DO NOTHING;
