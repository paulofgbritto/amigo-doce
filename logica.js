// =========================================================
//   AMIGO DOCE - lógica da ROLETA (igual à amigo_doce_espirito.py)
//   Sem nada aleatório. As regras do Firestore (firestore.rules)
//   conferem esta mesma conta no servidor.
// =========================================================

export const CASAS = 100;
export const CHAVES_PUBLICO = ["participantes", "jaTiraram", "jaTirados", "somaMare", "criadoEm"];
export const CHAVES_PAR = ["quemTirou", "tirou", "numero", "digitos", "email", "ordem",
  "mareQ", "casa", "indice", "data"];

export function numeroValido(numero) {
  return typeof numero === "string" && /^[0-9]{5}$/.test(numero);
}

export function normalizarEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export function emailValido(email) {
  return email.length <= 100 && /^[^@ /]+@[^@ /]+[.][^@ /]+$/.test(email);
}

export function digitos(numero) {
  return numero.split("").map(Number);
}

// 1) NÚMERO: 0 a 99 casas (sozinho alcança a roleta toda)
export function fatorNumero(d) {
  const lado = d[0] % 2 === 0 ? 0 : 50;
  const passo = d[1] * 5;
  const ajuste = Math.floor(d[2] / 2);
  return { lado, passo, ajuste, total: lado + passo + ajuste };
}

// 2) ORDEM (fila do pão): gira 4 casas por rodada, volta a zero a cada 5
export function fatorOrdem(rodada) {
  return (rodada % 5) * 4;
}

// 3) MARÉ: soma dos 4º e 5º dígitos de todos os números anteriores, ÷5 arredondado, resto 20
export function mareQ(soma) {
  return Math.floor((soma + 2) / 5);
}

export function faltamTirar(pub) {
  return pub.participantes.filter((p) => !pub.jaTiraram.includes(p));
}

export function candidatos(pub, pessoa) {
  const faltam = faltamTirar(pub);
  const livres = pub.participantes.filter((p) => !pub.jaTirados.includes(p) && p !== pessoa);
  const outra = faltam.filter((p) => p !== pessoa);
  // anti-travamento: com 2 faltando, se a outra ainda não foi tirada, tem de ser tirada agora
  if (faltam.length === 2 && outra.length === 1 && livres.includes(outra[0])) return outra;
  return livres;
}

export function faixa(i, k) {
  return [Math.ceil((i * CASAS) / k), Math.ceil(((i + 1) * CASAS) / k) - 1];
}

export function calcular(pub, pessoa, numero) {
  const d = digitos(numero);
  const fn = fatorNumero(d);
  const rodada = pub.jaTiraram.length + 1;
  const ordem = fatorOrdem(rodada);
  const q = mareQ(pub.somaMare);
  const mare = q % 20;
  const casa = (fn.total + ordem + mare) % CASAS;
  const cands = candidatos(pub, pessoa);
  const k = cands.length;
  const indice = Math.floor((casa * k) / CASAS);
  return { d, fn, rodada, ordem, soma: pub.somaMare, q, mare, casa, cands, k, indice,
    tirou: cands[indice], forcado: k === 1 &&
      pub.participantes.filter((p) => !pub.jaTirados.includes(p) && p !== pessoa).length > 1 };
}

// Monta o que será gravado num sorteio
export function montarSorteio(pub, pessoa, numero, email, data) {
  if (!pub.participantes.includes(pessoa)) throw new Error("Nome desconhecido.");
  if (pub.jaTiraram.includes(pessoa)) throw new Error("Essa pessoa já tirou.");
  if (!numeroValido(numero)) throw new Error("O número precisa ter 5 dígitos.");
  if (!emailValido(email)) throw new Error("E-mail inválido.");
  const c = calcular(pub, pessoa, numero);
  if (!c.k) throw new Error("Ninguém disponível (erro inesperado).");
  const tirou = c.tirou;
  const novoPub = {
    participantes: pub.participantes,
    jaTiraram: pub.jaTiraram.concat([pessoa]),
    jaTirados: pub.participantes.filter((p) => pub.jaTirados.includes(p) || p === tirou),
    somaMare: pub.somaMare + c.d[3] + c.d[4],
    criadoEm: pub.criadoEm,
  };
  const par = {
    quemTirou: pessoa, tirou, numero, digitos: c.d, email, ordem: c.rodada,
    mareQ: c.q, casa: c.casa, indice: c.indice, data,
  };
  return { novoPub, par, tirou, calculo: c };
}

export function desfazerUltimo(pub, parUltimo) {
  const g = pub.jaTiraram[pub.jaTiraram.length - 1];
  return {
    participantes: pub.participantes,
    jaTiraram: pub.jaTiraram.slice(0, -1),
    jaTirados: pub.jaTirados.filter((p) => p !== parUltimo.tirou),
    somaMare: pub.somaMare - parUltimo.digitos[3] - parUltimo.digitos[4],
    criadoEm: pub.criadoEm,
    _quem: g,
  };
}

export function lerNomes(texto) {
  const nomes = [];
  const vistos = new Set();
  for (const linha of String(texto).split(/\r?\n/)) {
    const nome = linha.split(/\s+/).filter(Boolean).join(" ");
    if (!nome) continue;
    const chave = nome.toLocaleLowerCase("pt-BR");
    if (vistos.has(chave)) throw new Error("Nome repetido: " + nome);
    vistos.add(chave);
    nomes.push(nome);
  }
  if (nomes.length < 2) throw new Error("São necessárias pelo menos 2 pessoas.");
  return nomes;
}

export function publicoNovo(nomes, data) {
  return { participantes: nomes, jaTiraram: [], jaTirados: [], somaMare: 0, criadoEm: data };
}

export function agora() {
  return new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}
