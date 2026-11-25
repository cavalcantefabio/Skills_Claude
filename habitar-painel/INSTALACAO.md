# Gestão Habitar: instalação

Painel de gestão da Habitar Consultoria & Financiamento Imobiliário, no mesmo modelo do Gestão IK: um site do Google (Apps Script) que lê e grava numa planilha do Google Drive. Cada pessoa entra com a própria conta Google e só vê os dados se tiver acesso à planilha.

## Arquivos

| Arquivo | Para quê |
|---|---|
| `Codigo.gs` | Servidor: cria a estrutura da planilha, lê e grava clientes, tarefas, agenda e financeiro, rotina diária das 7h |
| `Painel.html` | A tela do painel (Resumo, Clientes, Tarefas, Agenda, Financeiro) |
| `appsscript.json` | Fuso horário de São Paulo e configuração do app da Web |
| `mock.js` + `montar_previa.py` | Só para a prévia com dados fictícios; não vão para o Google |

## Passo a passo (uma vez só, uns 15 minutos)

1. **Criar a planilha.** No Google Drive da conta da Habitar: Novo → Planilhas Google → Planilha em branco. Nome sugerido: `Gestão Habitar`.
2. **Abrir o Apps Script.** Na planilha: Extensões → Apps Script.
3. **Colar os arquivos.**
   - Apague o conteúdo de `Código.gs` e cole o conteúdo de `Codigo.gs`.
   - Clique em **+** → HTML, dê o nome `Painel` (exatamente assim) e cole o conteúdo de `Painel.html`.
   - Em Configurações do projeto (engrenagem), marque "Mostrar arquivo de manifesto appsscript.json no editor". Volte ao Editor, abra `appsscript.json` e cole o conteúdo do arquivo de mesmo nome.
   - Salve (ícone de disquete).
4. **Instalar a estrutura.** No topo do editor, escolha a função `instalar` e clique em **Executar**. O Google vai pedir autorização:
   - "Revisar permissões" → escolha a conta → "O Google não verificou este app" → **Avançado** → **Acessar Gestão Habitar (não seguro)** → **Permitir**.
   - Esse aviso aparece porque o app é seu e não passou pela verificação pública do Google; é esperado.
   - Ao terminar, a planilha terá as abas CLIENTES, TAREFAS, HISTÓRICO, ETAPAS, EQUIPE, LISTAS e CONFIG, e será criada no seu Drive uma segunda planilha, **Habitar · Financeiro (restrito)**. A rotina diária das 7h também fica instalada.
5. **Completar a equipe.** Na aba EQUIPE, escreva o nome ao lado do seu e-mail (ex.: Rosane). Acrescente uma linha por pessoa da equipe (nome, e-mail Google, papel, Ativo = Sim).
6. **Revisar as etapas.** Na aba ETAPAS estão sugestões de etapas, prazos em dias e a tarefa criada ao entrar em cada etapa. Ajuste à rotina do escritório (os prazos são só referência interna, não regra de banco). Para desligar uma etapa, escreva `Não` em Ativa.
7. **Escolher a agenda.** Na aba CONFIG, em `Agenda`, escreva o e-mail da Agenda Google onde os atendimentos devem ser marcados (normalmente o e-mail da Rosane). Se ficar vazio, cada pessoa usa a própria agenda.
8. **Publicar o site.** Implementar → Nova implementação → engrenagem → **App da Web**.
   - Descrição: `Gestão Habitar`
   - Executar como: **Usuário que acessa o app da Web**
   - Quem pode acessar: **Qualquer pessoa com Conta do Google**
   - Implementar. Copie o link que termina em `/exec`: esse é o endereço do painel.

## Dar acesso à equipe

Para cada pessoa:
- Compartilhe a planilha **Gestão Habitar** como **Editor**.
- Compartilhe a Agenda Google dos atendimentos com "Fazer alterações nos eventos".
- **Não** compartilhe a planilha do Financeiro com quem não deve ver valores: para essa pessoa, a aba Financeiro simplesmente não aparece.
- Envie o link `/exec` e avise sobre a tela "O Google não verificou este app" (Avançado → Acessar → Permitir).

## Atualizar o painel depois

Quando o Claude mandar uma versão nova:
1. Substitua o conteúdo de `Painel.html` e, se vier, de `Codigo.gs`. Salve.
2. Implementar → **Gerenciar implementações** → lápis → Versão: **Nova versão** → Implementar. Nunca use "Nova implementação": ela muda o link.
3. Abra o link com Ctrl+F5.

Se o servidor ganhar colunas ou abas novas, rode `instalar` de novo: ele só acrescenta o que falta e não apaga dados.

## Como o painel funciona

- **Clientes:** quadro por etapa (arraste o cartão para mudar de etapa) ou lista com busca e filtros. A ficha do cliente mostra dados, tarefas, comentários e histórico, com botões para avançar etapa, abrir o WhatsApp, criar tarefa e agendar atendimento.
- **Tarefas automáticas:** ao entrar numa etapa, nasce a tarefa daquela etapa (prazo = dias da aba ETAPAS). Ao sair da etapa, ela se conclui sozinha. Todo dia às 7h a rotina cria "Cliente parado em … há N dias" para quem passou do prazo e a tarefa do "Próximo passo" quando a data chega.
- **Agenda:** lê e cria compromissos na Agenda Google. O atendimento criado pelo painel fica ligado ao cliente e aparece no histórico dele.
- **Financeiro:** lançamentos de receitas (honorários, comissões) e despesas na planilha restrita; resultado do mês, a receber, gráfico de 12 meses e "marcar recebido/pago".
- **Quem fez o quê:** cada alteração grava o nome de quem fez (pelo e-mail da aba EQUIPE). Se o Google não informar a conta, o painel pergunta "Quem está usando?".

## Cuidados (LGPD)

- Registre só o necessário para o atendimento. Nada de senhas bancárias, tokens ou cópias de documentos na planilha ou nos comentários; documentos ficam no canal combinado com o cliente.
- Ao desligar alguém da equipe: tire o acesso à planilha, à agenda e ao Financeiro e marque `Não` em Ativo na aba EQUIPE.
