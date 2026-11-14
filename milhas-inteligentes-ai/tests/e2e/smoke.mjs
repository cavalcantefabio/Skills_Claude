/**
 * Teste ponta a ponta (navegador real) dos fluxos principais.
 * Uso: com o app rodando (pnpm dev), execute:  node tests/e2e/smoke.mjs [baseURL]
 * Cria um usuário novo a cada execução; não toca no usuário de demonstração.
 */
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const BASE = process.argv[2] ?? "http://localhost:3000";
const email = `e2e-${Date.now()}@teste.dev`;
const shots = process.env.SHOTS;
let step = 0;

function assert(cond, msg) {
  if (!cond) throw new Error(`Falhou: ${msg}`);
  console.log(`  ✓ ${msg}`);
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1360, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("dialog", (d) => d.accept());
/** Seleciona a opção cujo texto contém `text`. */
const pick = async (sel, text) => {
  const value = await page.$eval(sel, (el, t) => [...el.options].find((o) => o.textContent.includes(t))?.value, text);
  if (value == null) throw new Error(`Opção "${text}" não encontrada em ${sel}`);
  await page.selectOption(sel, value);
};
const snap = async (name) => shots && page.screenshot({ path: `${shots}/${String(++step).padStart(2, "0")}-${name}.png`, fullPage: true });

try {
  console.log("Autenticação");
  await page.goto(`${BASE}/`);
  assert(page.url().endsWith("/login"), "rota protegida redireciona para o login");
  await page.goto(`${BASE}/cadastro`);
  await page.fill("#name", "Pessoa Teste");
  await page.fill("#email", email);
  await page.fill("#password", "curta");
  await page.click("button[type=submit]");
  await page.getByText("Use ao menos 10 caracteres.").waitFor();
  assert(true, "senha fraca é recusada com mensagem no campo");
  await page.fill("#password", "SenhaForte123");
  await Promise.all([page.waitForURL(`${BASE}/`), page.click("button[type=submit]")]);
  await page.getByText("Nenhum programa de fidelidade cadastrado").waitFor();
  assert(true, "cadastro autentica e mostra o dashboard vazio");

  console.log("Programas");
  await page.goto(`${BASE}/programas/novo`);
  await page.selectOption("#programId", { label: "Livelo" });
  await page.fill("#initialBalance", "50000");
  await page.fill("#milheiroValueBrl", "35");
  await Promise.all([page.waitForURL(/\/programas\/[0-9a-f-]{36}$/), page.click("text=Cadastrar programa")]);
  await page.getByText("50.000", { exact: true }).first().waitFor();
  assert(true, "Livelo cadastrado com saldo inicial");
  await page.goto(`${BASE}/programas/novo`);
  await page.selectOption("#programId", { label: "Smiles" });
  await page.fill("#milheiroValueBrl", "16");
  await page.fill("#clubName", "Clube Smiles 1.000");
  await page.fill("#clubMonthlyCostBrl", "42");
  await Promise.all([page.waitForURL(/\/programas\/[0-9a-f-]{36}$/), page.click("text=Cadastrar programa")]);
  assert(true, "Smiles cadastrado com clube");
  await page.goto(`${BASE}/programas/novo`);
  assert((await page.locator('#programId option:text-is("Livelo")').count()) === 0, "programa já cadastrado some da lista");

  console.log("Cartões");
  await page.goto(`${BASE}/cartoes/novo`);
  await page.fill("#issuer", "Banco Teste");
  await page.fill("#name", "Platinum");
  await page.selectOption("#programId", { label: "Livelo" });
  await page.fill("#annualFeeBrl", "600");
  await page.click("text=Salvar cartão");
  await page.getByText("Informe a pontuação por dólar ou por real.").waitFor();
  assert(true, "cartão sem pontuação é recusado");
  await page.fill("#pointsPerUsd", "2,5");
  await page.fill("#creditLimit", "15000");
  await Promise.all([page.waitForURL(`${BASE}/cartoes`), page.click("text=Salvar cartão")]);
  await page.getByText("Comparar cartões").waitFor();
  assert((await page.textContent("main")).replace(/\u00a0/g, " ").includes("R$ 15.000,00"), "limite cifrado é exibido corretamente ao dono");
  await snap("cartoes");

  console.log("Movimentações");
  await page.goto(`${BASE}/milhas`);
  await pick("#tx-account", "Livelo");
  await page.selectOption("#tx-type", "acumulo");
  await page.fill("#tx-points", "3000");
  await page.selectOption("#tx-card", { label: "Banco Teste Platinum" });
  await page.click("text=Registrar");
  await page.getByText("Movimentação registrada.").waitFor();
  assert(true, "acúmulo com cartão registrado");
  await page.fill("#tr-points", "20000");
  await page.selectOption("#tr-to", { label: "Smiles" });
  await page.fill("#tr-bonus", "80");
  await page.click("text=Registrar transferência");
  await page.getByText("36.000 recebidos").waitFor();
  assert(true, "transferência 1:1 com 80% de bônus credita 36.000");
  await pick("#tx-account", "Smiles");
  await page.selectOption("#tx-type", "resgate");
  await page.fill("#tx-points", "999999");
  await page.click("text=Registrar");
  await page.getByText(/Saldo insuficiente/).waitFor();
  assert(true, "resgate acima do saldo é bloqueado");
  await page.fill("#tx-points", "30000");
  await page.fill("#tx-cost", "80");
  await page.fill("#tx-sav", "950");
  await page.click("text=Registrar");
  await page.getByText("Movimentação registrada.").waitFor();
  assert(true, "resgate com economia registrado");
  await snap("milhas");

  console.log("Dashboard");
  await page.goto(`${BASE}/`);
  await page.getByText("Saldo por programa").waitFor();
  const body = (await page.textContent("main")).replace(/\u00a0/g, " ");
  assert(body.includes("33.000"), "saldo Livelo = 50.000 + 3.000 − 20.000");
  assert(body.includes("6.000"), "saldo Smiles = 36.000 − 30.000");
  assert(body.includes("R$ 950,00"), "economia acumulada exibida");
  assert(body.includes("R$ 1.251,00"), "valor estimado = 33×35 + 6×16");
  await page.click("text=Ver tabela >> nth=0");
  assert(await page.getByRole("columnheader", { name: "Mês" }).first().isVisible(), "gráfico alterna para visão em tabela");
  await snap("dashboard");

  console.log("Calculadoras");
  await page.goto(`${BASE}/calculadoras?c=custo_milheiro`);
  await page.fill("#calc-valorPago", "1.750,00");
  await page.fill("#calc-pontos", "100.000");
  await page.getByText("R$ 17,50").first().waitFor();
  assert(true, "custo por milheiro em formato brasileiro: R$ 17,50");
  await page.fill("#calc-pontos", "-5");
  await page.locator("#calc-pontos").blur();
  await page.getByText(/mínimo|maior que zero/).first().waitFor();
  assert(true, "entrada inválida mostra erro e esconde o resultado");
  await page.fill("#calc-pontos", "100000");
  await page.fill("#calc-title", "Compra teste");
  await page.click("text=Salvar simulação");
  await page.getByText("Simulação salva.").waitFor();
  await page.getByText("Compra teste").waitFor();
  assert(true, "simulação salva aparece na lista");
  await page.click("text=Abrir");
  await page.waitForURL(/sim=/);
  assert((await page.inputValue("#calc-pontos")) === "100000", "simulação salva é reaberta com as entradas");
  await snap("calculadora");

  console.log("Viagens, alertas e configurações");
  await page.goto(`${BASE}/viagens/nova`);
  await page.fill("#title", "Teste Nordeste");
  await page.fill("#origin", "gru");
  await page.fill("#destination", "rec");
  await page.fill("#departDate", "2027-01-10");
  await page.fill("#returnDate", "2027-01-05");
  await page.fill("#passengers", "2");
  await page.fill("#budgetBrl", "1.500");
  await page.click("text=Salvar viagem");
  await page.getByText("A volta deve ser depois da ida.").waitFor();
  assert((await page.inputValue("#title")) === "Teste Nordeste", "erro de validação mantém o que foi digitado");
  await page.fill("#returnDate", "2027-01-20");
  await Promise.all([page.waitForURL(/\/viagens\/[0-9a-f-]{36}$/), page.click("text=Salvar viagem")]);
  await page.getByText("Sem cotação em milhas").first().waitFor();
  assert(true, "viagem sem cotação não inventa meta");
  // Cotação em milhas: 10.000 por passageiro + R$ 50 de taxas (ida e volta).
  await pick("#q-prog", "Smiles");
  await page.fill("#q-miles", "10000");
  await page.fill("#q-tax", "50");
  await page.getByRole("button", { name: "Adicionar cotação" }).click();
  await page.getByText("Cotação adicionada.").waitFor();
  // Cotação em dinheiro: R$ 900 por passageiro.
  await page.selectOption("#q-kind", "dinheiro");
  await page.fill("#q-cash", "900");
  await page.getByRole("button", { name: "Adicionar cotação" }).click();
  await page.getByText("Cotação adicionada.").waitFor();
  await page.reload();
  const planText = (await page.textContent("main")).replace(/\u00a0/g, " ");
  assert(/Meta de milhas\s*20\.000/.test(planText), "meta = 10.000 × 2 passageiros");
  assert(/Saldo disponível\s*39\.000/.test(planText), "disponível = 6.000 Smiles + 33.000 Livelo (premissa 1:1)");
  assert(/Meta atingida\s*100%/.test(planText), "meta coberta com transferência");
  assert(planText.includes("R$ 85,00"), "cada milheiro rende (1.800 − 100) ÷ 20 = R$ 85,00");
  assert(planText.includes("Emitir com Smiles"), "estratégia recomenda emitir com Smiles");
  assert(planText.includes("Dentro do orçamento"), "custo dentro do orçamento");
  await page.goto(`${BASE}/viagens`);
  const trips = (await page.textContent("main")).replace(/\u00a0/g, " ");
  assert(trips.includes("Minhas Viagens") && trips.includes("Teste Nordeste") && /Meta\s*20\.000/.test(trips), "Minhas Viagens mostra a meta");
  await page.goto(`${BASE}/alertas`);
  assert((await page.textContent("main")).includes("Defina o valor do milheiro") === false, "sem alerta indevido de milheiro (ambos definidos)");
  await page.goto(`${BASE}/configuracoes`);
  await page.fill("#usdRateBrl", "6");
  await page.click("text=Salvar preferências");
  await page.getByText("Preferências salvas.").waitFor();
  await page.fill("#current", "errada");
  await page.fill("#next", "NovaSenha12345");
  await page.fill("#confirm", "NovaSenha12345");
  await page.click("text=Alterar senha");
  await page.getByText("Senha atual incorreta.").waitFor();
  assert(true, "troca de senha exige a senha atual");

  console.log("Pontos vencidos");
  await page.goto(`${BASE}/milhas`);
  await pick("#tx-account", "Smiles");
  await page.selectOption("#tx-type", "bonus");
  await page.fill("#tx-points", "1500");
  await page.fill("#tx-date", "2025-01-10");
  await page.fill("#tx-exp", "2025-06-30");
  await page.click("text=Registrar");
  await page.getByText("Movimentação registrada.").waitFor();
  await page.goto(`${BASE}/programas`);
  await page.getByText("Smiles", { exact: true }).click();
  await page.getByText(/já venceram e não entram no saldo disponível/).waitFor();
  const prog = (await page.textContent("main")).replace(/\u00a0/g, " ");
  assert(prog.includes("1.500 milhas já venceram"), "crédito vencido aparece à parte, fora do saldo disponível");
  assert(/Saldo disponível\s*6\.000/.test(prog), "saldo disponível continua 6.000");
  await page.click("text=Registrar expiração de 1.500 milhas");
  await page.getByText(/já venceram/).waitFor({ state: "detached" });
  await page.reload();
  assert((await page.getByText(/já venceram/).count()) === 0, "após registrar a expiração, o aviso some");
  assert((await page.textContent("main")).includes("Pontos vencidos em 30/06/2025"), "histórico mostra a expiração com a data do vencimento");

  console.log("Exportação de dados");
  await page.goto(`${BASE}/configuracoes`);
  const fs = await import("node:fs/promises");
  const grab = async (label) => {
    const [dl] = await Promise.all([page.waitForEvent("download"), page.click(`text=${label}`)]);
    return { name: dl.suggestedFilename(), body: await fs.readFile(await dl.path(), "utf8") };
  };
  const full = await grab("Backup completo (JSON)");
  const backup = JSON.parse(full.body);
  assert(/^milhas-inteligentes-backup-\d{4}-\d{2}-\d{2}\.json$/.test(full.name), "backup completo baixa como JSON datado");
  assert(backup.programas.length === 2 && backup.movimentacoes.length > 0 && backup.cartoes[0].limite_credito_brl === 15000, "backup traz programas, movimentações e cartões");
  assert(!full.body.includes("password") && !full.body.includes("$2b$"), "backup não contém senha");
  const movs = await grab("Movimentações (CSV)");
  assert(movs.body.startsWith("\uFEFFData;Programa;Tipo;Pontos"), "CSV de movimentações abre no Excel (BOM e ;)");
  const lots = await grab("Saldos por validade (CSV)");
  assert(lots.body.includes("Programa;Unidade;Disponível"), "CSV de saldos por validade");
  const anon = await fetch(`${BASE}/api/exportar?arquivo=completo`);
  assert(anon.status === 401, "sem login, a exportação é recusada (401)");

  console.log("Bloqueio de login");
  const ctx2 = await browser.newContext();
  const p2 = await ctx2.newPage();
  const victim = `bloqueio-${Date.now()}@teste.dev`;
  for (let i = 0; i < 10; i++) {
    await p2.goto(`${BASE}/login`);
    await p2.fill("#email", victim);
    await p2.fill("#password", `errada${i}`);
    await p2.click("button[type=submit]");
    await p2.getByText("E-mail ou senha incorretos.").waitFor();
  }
  await p2.goto(`${BASE}/login`);
  await p2.fill("#email", victim);
  await p2.fill("#password", "qualquer");
  await p2.click("button[type=submit]");
  await p2.getByText(/Muitas tentativas de login/).waitFor();
  assert(true, "11ª tentativa no mesmo e-mail é bloqueada");
  await ctx2.close();

  console.log("Isolamento entre usuários");
  const cardUrl = await page.evaluate(async () => {
    const r = await fetch("/cartoes");
    const html = await r.text();
    return html.match(/\/cartoes\/[0-9a-f-]{36}/)?.[0];
  });
  await page.context().clearCookies();
  await page.goto(`${BASE}/login`);
  await page.fill("#email", "demo@milhas.local");
  await page.fill("#password", "Demo12345678");
  await Promise.all([page.waitForURL(`${BASE}/`), page.click("button[type=submit]")]);
  const res = await page.goto(`${BASE}${cardUrl}`);
  assert(res.status() === 404, "outro usuário recebe 404 ao abrir o cartão");

  assert(errors.length === 0, `sem erros de JavaScript na página (${errors.join(" | ")})`);
  console.log("\nTodos os passos passaram.");
} catch (e) {
  await snap("falha");
  console.error(e.message);
  process.exitCode = 1;
} finally {
  await browser.close();
}
