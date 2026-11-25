"""Monta a prévia do painel com dados fictícios (mock.js) a partir do Painel.html.

Uso: python3 montar_previa.py <saida-teste.html> <saida-artifact.html>
- teste: documento completo, para abrir no navegador local.
- artifact: só o conteúdo (sem doctype/html/head/body), para publicar no claude.ai.
"""
import re, sys
from pathlib import Path

aqui = Path(__file__).parent
html = (aqui / 'Painel.html').read_text(encoding='utf-8')
mock = (aqui / 'mock.js').read_text(encoding='utf-8')
html = html.replace('<base target="_top">\n', '')
aviso = ('<p style="background:#FBEFD5;color:#7E5914;margin:0;padding:8px 16px;font:600 13px/1.4 Manrope,system-ui,sans-serif;text-align:center">'
         'Prévia com clientes e valores fictícios. As alterações ficam só nesta tela e somem ao recarregar.</p>\n')
html = html.replace('<header class="bar">', aviso + '<header class="bar">', 1)
html = html.replace('<script>\n/* ───────── Conexão', '<script>\n' + mock + '\n</script>\n<script>\n/* ───────── Conexão', 1)
Path(sys.argv[1]).write_text(html, encoding='utf-8')

head = html[html.index('<head>') + 6:html.index('</head>')]
body = html[html.index('<body>') + 6:html.index('</body>')]
head = re.sub(r'\s*<meta charset="utf-8">\s*<meta name="viewport"[^>]*>', '', head)
titulo = re.search(r'<title>.*?</title>', head).group(0)
head = head.replace(titulo, '')
Path(sys.argv[2]).write_text('<title>Prévia Gestão Habitar</title>\n' + head + '\n' + body, encoding='utf-8')
