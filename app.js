// =========================================================
//   AMIGO DOCE - app para celular (versão roleta)
// =========================================================
import { firebaseConfig } from "./config.js";
import {
  faltamTirar, calcular, faixa, normalizarEmail, emailValido, numeroValido, lerNomes,
} from "./logica.js";

const $ = (s, r = document) => r.querySelector(s);
const esc = (t) => String(t).replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const tela = $("#tela");
const modoTeste = new URLSearchParams(location.search).has("teste");

let banco = null;
let pub; // undefined = carregando, null = não configurado
let admin = false;
let aba = "inicio";
let devVisivel = false;
let aoMudarPub = null; // re-render da tela atual quando o placar muda

// ---------------------------------------------------------
//   Início
// ---------------------------------------------------------
async function iniciar() {
  if (modoTeste) {
    document.body.insertAdjacentHTML("afterbegin",
      '<div class="aviso-teste">MODO TESTE: dados só neste navegador</div>');
    const m = await import("./db-teste.js");
    banco = m.criarBanco();
  } else if (!firebaseConfig) {
    tela.innerHTML = `<div class="meio"><div class="icone">⚙</div><h1>Quase pronto</h1>
      <p class="suave">Falta colar o <b>firebaseConfig</b> no arquivo config.js.</p></div>`;
    return;
  } else {
    const m = await import("./db-firebase.js");
    banco = m.criarBanco(firebaseConfig);
  }
  banco.ouvirAdmin((v) => { admin = v; });
  banco.ouvirPublico((p) => {
    pub = p;
    atualizarProgresso();
    if (aoMudarPub) aoMudarPub();
  }, (e) => {
    tela.innerHTML = `<div class="erro">Não consegui ler o sorteio: ${esc(e.message)}</div>`;
  });
  irPara("inicio");
}

function atualizarProgresso() {
  const el = $("#progresso");
  if (!pub) { el.innerHTML = ""; return; }
  const total = pub.participantes.length;
  const feitos = pub.jaTiraram.length;
  el.innerHTML = `<b>${feitos}</b> de <b>${total}</b> já tiraram
    <div class="barra"><i style="width:${total ? (100 * feitos) / total : 0}%"></i></div>`;
}

// ---------------------------------------------------------
//   Navegação
// ---------------------------------------------------------
document.querySelectorAll(".abas button").forEach((b) =>
  b.addEventListener("click", () => irPara(b.dataset.aba)));

function irPara(nova) {
  const areaAdmin = (a) => a === "sorteios" || a === "dev";
  if (admin && areaAdmin(aba) && !areaAdmin(nova)) banco.sairAdmin(); // sai do modo organizador
  aba = nova;
  document.querySelectorAll(".abas button").forEach((b) =>
    b.classList.toggle("ativa", b.dataset.aba === nova));
  aoMudarPub = null;
  window.scrollTo(0, 0);
  ({ inicio: telaInicio, falta: telaFalta, sorteios: telaSorteios, dev: telaDev }[nova])();
}

function mostrarAbas(sim) { $("#abas").style.display = sim ? "" : "none"; }

// ---------------------------------------------------------
//   Janelinhas (confirmar / pedir texto)
// ---------------------------------------------------------
function janela(html) {
  const m = $("#modal");
  m.innerHTML = `<div class="janela">${html}</div>`;
  m.hidden = false;
  return m;
}
function fecharJanela() { const m = $("#modal"); m.hidden = true; m.innerHTML = ""; }

function confirmar(titulo, corpo, textoOk = "Confirmar", perigo = false) {
  return new Promise((ok) => {
    const m = janela(`<h3>${titulo}</h3>${corpo}
      <div class="linha-btns"><button class="btn cinza" data-r="0">Cancelar</button>
      <button class="btn ${perigo ? "vermelho" : ""}" data-r="1">${textoOk}</button></div>`);
    m.querySelectorAll("[data-r]").forEach((b) => b.onclick = () => { fecharJanela(); ok(b.dataset.r === "1"); });
  });
}

function pedirTexto(titulo, corpo, { tipo = "text", modo = "text", textoOk = "OK" } = {}) {
  return new Promise((ok) => {
    const m = janela(`<h3>${titulo}</h3>${corpo}
      <input class="entrada" id="j-txt" type="${tipo}" inputmode="${modo}" autocomplete="off">
      <div class="linha-btns"><button class="btn cinza" data-r="0">Cancelar</button>
      <button class="btn" data-r="1">${textoOk}</button></div>`);
    const inp = $("#j-txt", m);
    setTimeout(() => inp.focus(), 50);
    const fim = (v) => { fecharJanela(); ok(v); };
    m.querySelector('[data-r="0"]').onclick = () => fim(null);
    m.querySelector('[data-r="1"]').onclick = () => fim(inp.value);
    inp.addEventListener("keydown", (e) => { if (e.key === "Enter") fim(inp.value); });
  });
}

function carregando(btn, sim) {
  if (sim) { btn.dataset.txt = btn.innerHTML; btn.innerHTML = '<span class="spinner"></span>'; btn.disabled = true; }
  else { btn.innerHTML = btn.dataset.txt || btn.innerHTML; btn.disabled = false; }
}

// ---------------------------------------------------------
//   Tela: quem vai tirar
// ---------------------------------------------------------
function telaInicio() {
  mostrarAbas(true);
  aoMudarPub = telaInicio;
  if (pub === undefined) { tela.innerHTML = '<p class="suave centro carregando">Carregando…</p>'; return; }
  if (pub === null) {
    tela.innerHTML = `<div class="meio"><div class="icone">♥</div><h1>Sorteio ainda não começou</h1>
      <p class="suave">O organizador precisa cadastrar os nomes em ★ Sorteios.</p></div>`;
    return;
  }
  const faltam = faltamTirar(pub);
  if (!faltam.length) {
    tela.innerHTML = `<div class="meio"><div class="icone" style="color:var(--amarelo)">★</div>
      <h1>Sorteio concluído!</h1><p class="suave">Todo mundo já tirou o seu amigo doce.</p></div>`;
    return;
  }
  tela.innerHTML = `<h1>Quem vai tirar agora?</h1>
    <p class="suave">Toque no <b>seu</b> nome. A ordem é livre.</p>
    <div class="grade">${faltam.map((n, i) =>
      `<button class="nome" data-i="${i}">${esc(n)}</button>`).join("")}</div>`;
  tela.querySelectorAll(".nome").forEach((b) =>
    b.onclick = () => telaTirar(faltam[Number(b.dataset.i)]));
}

function telaTirar(pessoa) {
  mostrarAbas(false);
  aoMudarPub = () => {
    if (pub && pub.jaTiraram.includes(pessoa) && !tela.dataset.sorteando) {
      tela.innerHTML = `<div class="meio"><h1>${esc(pessoa)} já tirou</h1>
        <p class="suave">Esse nome acabou de ser usado em outro celular.</p>
        <button class="btn" id="vol">Voltar</button></div>`;
      $("#vol").onclick = () => irPara("inicio");
    }
  };
  tela.dataset.sorteando = "";
  tela.innerHTML = `<h1 style="color:var(--rosa)">Olá, ${esc(pessoa)}!</h1>
    <p class="suave">Confira se este é mesmo o seu nome.</p>
    <label class="campo">Seu e-mail
      <small>Fica registrado junto com o seu nome. Cada e-mail só pode tirar uma vez.</small>
      <input class="entrada" id="email" type="email" inputmode="email" autocomplete="email"
        placeholder="voce@exemplo.com" maxlength="100">
    </label>
    <label class="campo">Seu número de 5 dígitos
      <input class="entrada numero" id="num" type="text" inputmode="numeric" pattern="[0-9]*"
        autocomplete="off" maxlength="5" placeholder="•••••">
    </label>
    <div class="pontos" id="pontos"></div>
    <div id="msg"></div>
    <div class="linha-btns">
      <button class="btn cinza" id="voltar">Voltar</button>
      <button class="btn" id="sortear" disabled>Sortear ♥</button>
    </div>`;
  const email = $("#email"), num = $("#num"), btn = $("#sortear"), msg = $("#msg");
  const atualizar = () => {
    num.value = num.value.replace(/\D/g, "").slice(0, 5);
    const n = num.value.length;
    $("#pontos").textContent = "●".repeat(n) + "○".repeat(5 - n);
    btn.disabled = !(n === 5 && emailValido(normalizarEmail(email.value)));
  };
  email.oninput = atualizar; num.oninput = atualizar; atualizar();
  $("#voltar").onclick = () => irPara("inicio");
  btn.onclick = async () => {
    const e = normalizarEmail(email.value), n = num.value;
    if (!numeroValido(n) || !emailValido(e)) return;
    const ok = await confirmar("Confirmar", `<p>Nome: <b>${esc(pessoa)}</b></p><p>E-mail: <b>${esc(e)}</b></p>
      <p>Número: <b>${n}</b></p><p>Depois de confirmar não dá para trocar.</p>`, "Sortear");
    if (!ok) return;
    msg.innerHTML = "";
    tela.dataset.sorteando = "1";
    carregando(btn, true);
    try {
      const tirou = await banco.sortear(pessoa, n, e);
      telaAviso(pessoa, tirou);
    } catch (err) {
      tela.dataset.sorteando = "";
      carregando(btn, false);
      msg.innerHTML = `<div class="erro">${esc(err.message)}</div>`;
      if (pub && pub.jaTiraram.includes(pessoa)) aoMudarPub();
    }
  };
}

function telaAviso(pessoa, tirou) {
  mostrarAbas(false);
  aoMudarPub = null;
  tela.innerHTML = `<div class="meio"><div class="icone" style="color:var(--amarelo)">◉</div>
    <h1>Só ${esc(pessoa)} deve olhar a tela agora!</h1>
    <p class="suave">Seu sorteio já está salvo.</p><br>
    <button class="btn" id="rev">Revelar meu amigo doce</button></div>`;
  $("#rev").onclick = () => {
    tela.innerHTML = `<div class="meio"><p class="suave">${esc(pessoa)}, seu amigo doce é:</p>
      <div class="cartao">♥ ${esc(tirou)} ♥</div>
      <p class="suave">Decore (ou tire um print). Depois de esconder, não aparece de novo.</p><br>
      <button class="btn roxo" id="esc">Decorei! Esconder</button></div>`;
    $("#esc").onclick = () => irPara("inicio");
  };
}

// ---------------------------------------------------------
//   Tela: quem falta
// ---------------------------------------------------------
function telaFalta() {
  mostrarAbas(true);
  aoMudarPub = telaFalta;
  if (!pub) { tela.innerHTML = '<p class="suave centro carregando">Nenhum sorteio ainda.</p>'; return; }
  const feitos = pub.jaTiraram, faltam = faltamTirar(pub);
  const lista = (l) => l.length ? `<ul>${l.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>`
    : '<p class="suave">ninguém</p>';
  tela.innerHTML = `<h1>Situação</h1><p class="suave">${pub.participantes.length} participantes</p>
    <div class="caixa"><div class="titulo-amarelo">Faltam tirar (${faltam.length})</div>${lista(faltam)}</div>
    <div class="caixa"><div class="titulo-verde">Já tiraram (${feitos.length})</div>${lista(feitos)}</div>`;
}

// ---------------------------------------------------------
//   Login do organizador
// ---------------------------------------------------------
function telaLogin(titulo, depois) {
  mostrarAbas(true);
  aoMudarPub = null;
  tela.innerHTML = `<div class="meio" style="min-height:50vh"><div class="icone">🔒︎</div>
    <h1>${titulo}</h1><p class="suave">Só o organizador. Digite a senha.</p>
    <input class="entrada numero" id="senha" type="password" inputmode="numeric" autocomplete="off"
      maxlength="20" style="max-width:240px">
    <div id="msg" style="width:100%;max-width:320px"></div><br>
    <button class="btn" id="entrar">Entrar</button></div>`;
  const s = $("#senha"), b = $("#entrar");
  setTimeout(() => s.focus(), 50);
  const ir = async () => {
    if (!s.value) return;
    carregando(b, true);
    try {
      await banco.entrarAdmin(s.value.trim());
      admin = true;
      depois();
    } catch (e) {
      carregando(b, false);
      $("#msg").innerHTML = `<div class="erro">${esc(e.message)}</div>`;
      s.value = ""; s.focus();
    }
  };
  b.onclick = ir;
  s.addEventListener("keydown", (e) => { if (e.key === "Enter") ir(); });
}

// ---------------------------------------------------------
//   Tela: ver sorteios (organizador)
// ---------------------------------------------------------
function telaSorteios() {
  if (!admin) return telaLogin("Ver sorteios", telaSorteios);
  mostrarAbas(true);
  aoMudarPub = null;
  if (!pub) return telaNomes(true);
  tela.innerHTML = `<h1>Sorteios</h1><p class="suave">Quem tirou quem, com e-mail e número.</p>
    <div class="linha-btns">
      <button class="btn cinza" id="desf">↶ Desfazer último</button>
      <button class="btn cinza" id="nomes">⟳ Reiniciar / nomes</button>
    </div>
    <div id="msg"></div><div id="lista"><p class="suave">Carregando…</p></div>
    <br><button class="btn roxo largo" id="sair">Sair do modo organizador</button>`;
  $("#sair").onclick = async () => { await banco.sairAdmin(); admin = false; irPara("inicio"); };
  $("#nomes").onclick = () => telaNomes(false);
  $("#desf").onclick = async () => {
    if (!pub.jaTiraram.length) { $("#msg").innerHTML = '<div class="erro">Não há nada para desfazer.</div>'; return; }
    const ultimo = pub.jaTiraram[pub.jaTiraram.length - 1];
    if (!await confirmar("Desfazer último", `<p>Desfazer o sorteio de <b>${esc(ultimo)}</b>?
      Use se alguém escolheu o nome errado.</p>`, "Desfazer", true)) return;
    try {
      const quem = await banco.desfazer();
      $("#msg").innerHTML = `<div class="ok">${esc(quem)} pode tirar de novo.</div>`;
      carregarLista();
    } catch (e) { $("#msg").innerHTML = `<div class="erro">${esc(e.message)}</div>`; }
  };
  carregarLista();
}

async function carregarLista() {
  const alvo = $("#lista");
  try {
    const pares = await banco.listarPares();
    if (!$("#lista")) return;
    alvo.innerHTML = pares.length ? pares.map((p) => `<div class="par">
        <div>${p.ordem}. <span class="quem">${esc(p.quemTirou)}</span><span class="seta">→</span>
        <span class="tirou">${esc(p.tirou)}</span></div>
        <div class="info">${esc(p.email)} · nº ${esc(p.numero)} · ${esc(p.data)}</div></div>`).join("")
      : '<p class="suave">Ninguém tirou ainda.</p>';
  } catch (e) {
    alvo.innerHTML = `<div class="erro">${esc(e.message)}</div>`;
  }
}

function telaNomes(primeiraVez) {
  mostrarAbas(true);
  aoMudarPub = null;
  const atuais = pub ? pub.participantes.join("\n") : "";
  tela.innerHTML = `<h1>${primeiraVez ? "Cadastrar nomes" : "Reiniciar sorteio"}</h1>
    <p class="suave">Um nome por linha.${primeiraVez ? "" : " Isso <b>apaga</b> todos os sorteios feitos."}</p>
    <textarea id="txt" placeholder="Ana\nBruno\nCarla">${esc(atuais)}</textarea>
    <div id="msg"></div>
    <div class="linha-btns">
      ${primeiraVez ? "" : '<button class="btn cinza" id="vol">Voltar</button>'}
      <button class="btn ${primeiraVez ? "" : "vermelho"}" id="salvar">${primeiraVez ? "Começar sorteio" : "Reiniciar"}</button>
    </div>`;
  if (!primeiraVez) $("#vol").onclick = telaSorteios;
  $("#salvar").onclick = async () => {
    let nomes;
    try { nomes = lerNomes($("#txt").value); }
    catch (e) { $("#msg").innerHTML = `<div class="erro">${esc(e.message)}</div>`; return; }
    if (!primeiraVez) {
      const r = await pedirTexto("Reiniciar sorteio",
        `<p>Vai apagar tudo e começar com <b>${nomes.length}</b> pessoas. Digite <b>REINICIAR</b>:</p>`);
      if (r === null) return;
      if (r.trim() !== "REINICIAR") { $("#msg").innerHTML = '<div class="erro">Cancelado. Nada foi apagado.</div>'; return; }
    }
    const b = $("#salvar");
    carregando(b, true);
    try {
      await banco.configurar(nomes);
      telaSorteios();
      $("#msg").innerHTML = `<div class="ok">Sorteio pronto com ${nomes.length} pessoas.</div>`;
    } catch (e) {
      carregando(b, false);
      $("#msg").innerHTML = `<div class="erro">${esc(e.message)}</div>`;
    }
  };
}

// ---------------------------------------------------------
//   Aba secreta de desenvolvedor: Shift+0 no teclado,
//   ou tocar 5 vezes no "✦ Amigo Doce" no celular. Pede a senha.
// ---------------------------------------------------------
let toques = [];
$("#logo").addEventListener("click", () => {
  const t = Date.now();
  toques = toques.filter((x) => t - x < 4000).concat([t]);
  if (toques.length >= 5) { toques = []; abrirDev(); }
});
document.addEventListener("keydown", (e) => {
  const alvo = e.target && e.target.tagName;
  if (alvo === "INPUT" || alvo === "TEXTAREA") return;
  if (e.key === ")" || (e.shiftKey && (e.code === "Digit0" || e.code === "Numpad0"))) {
    e.preventDefault();
    abrirDev();
  }
});

async function abrirDev() {
  if (!banco || !$("#modal").hidden) return;
  if (!devVisivel) {
    if (!admin) {
      const s = await pedirTexto("Desenvolvedor", "<p>Digite a senha:</p>",
        { tipo: "password", modo: "numeric", textoOk: "Entrar" });
      if (s === null) return;
      try { await banco.entrarAdmin(s.trim()); admin = true; }
      catch (e) { await confirmar("Não entrou", `<p>${esc(e.message)}</p>`, "OK"); return; }
    }
    devVisivel = true;
    $("#aba-dev").hidden = false;
  }
  irPara("dev");
}

function fecharDev() {
  devVisivel = false;
  $("#aba-dev").hidden = true;
  irPara("inicio");
}

function telaDev() {
  if (!devVisivel) return irPara("inicio");
  if (!admin) return telaLogin("Desenvolvedor", telaDev);
  mostrarAbas(true);
  const faltam = pub ? faltamTirar(pub) : [];
  tela.innerHTML = `<div class="dev-topo"><h1>✕ Desenvolvedor</h1>
      <button class="icone-btn" id="fechar" title="Esconder aba">✕</button></div>
    <p class="suave">Simulação: nada é salvo.</p>
    <div class="dev-campos">
      <select id="pessoa">${faltam.map((n) => `<option>${esc(n)}</option>`).join("")}</select>
      <input class="entrada" id="dnum" type="text" inputmode="numeric" maxlength="5" placeholder="número"
        style="text-align:center;font-weight:800;letter-spacing:.15em">
    </div>
    <div class="saida" id="saida"></div>`;
  $("#fechar").onclick = fecharDev;
  const sel = $("#pessoa"), num = $("#dnum"), out = $("#saida");
  const linha = (cls, t) => `<span class="${cls}">${esc(t)}</span>`;
  const desenhar = () => {
    num.value = num.value.replace(/\D/g, "").slice(0, 5);
    const pessoa = sel.value, n = num.value;
    if (!pub || !faltamTirar(pub).length) { out.innerHTML = linha("a", "Todo mundo já tirou."); return; }
    if (n.length < 5) { out.innerHTML = linha("s", "Escolha quem você é e digite os 5 dígitos…"); return; }
    const c = calcular(pub, pessoa, n);
    const d = c.d;
    let h = linha("r", `${pessoa} + ${n} → ${c.tirou}  (casa ${c.casa})`) + "\n\n";
    h += linha("t", "1) NÚMERO (0 a 99 casas)") + "\n";
    h += `   1º dígito ${d[0]} é ${d[0] % 2 ? "ímpar" : "par"} → começa na casa ${c.fn.lado}\n`;
    h += `   2º dígito ${d[1]} × 5 → + ${c.fn.passo}\n`;
    h += `   3º dígito ${d[2]} ÷ 2 (inteiro) → + ${c.fn.ajuste}\n`;
    h += linha("s", `   4º e 5º (${d[3]}, ${d[4]}) vão para a maré dos próximos`) + "\n";
    h += `   = ${c.fn.total} casas\n\n`;
    h += linha("t", "2) ORDEM (fila do pão)") + "\n";
    h += `   rodada ${c.rodada} → (${c.rodada} resto 5) × 4 = + ${c.ordem}\n\n`;
    h += linha("t", "3) MARÉ (longo prazo)") + "\n";
    h += `   soma dos 4º e 5º dígitos anteriores = ${c.soma}\n`;
    h += `   ${c.soma} ÷ 5 arredondado = ${c.q} → resto 20 = + ${c.mare}\n\n`;
    h += linha("t", "4) POSIÇÃO") + "\n";
    h += `   (${c.fn.total} + ${c.ordem} + ${c.mare}) resto 100 = casa ${c.casa}\n\n`;
    h += linha("t", `5) ROLETA (${c.k} possíveis)`) + "\n";
    if (c.forcado) h += linha("a", "   Anti-travamento: escolha forçada.") + "\n";
    c.cands.forEach((nome, i) => {
      const [a, b] = faixa(i, c.k);
      const txt = `   casas ${String(a).padStart(2)} a ${String(b).padStart(2)}  ${nome}`;
      h += (i === c.indice ? linha("d", txt) : esc(txt)) + "\n";
    });
    out.innerHTML = h;
  };
  sel.onchange = desenhar; num.oninput = desenhar;
  aoMudarPub = () => {
    const atual = sel.value;
    const f = pub ? faltamTirar(pub) : [];
    sel.innerHTML = f.map((n) => `<option${n === atual ? " selected" : ""}>${esc(n)}</option>`).join("");
    desenhar();
  };
  desenhar();
}

iniciar();
