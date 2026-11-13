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
