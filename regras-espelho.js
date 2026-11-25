// Cópia em JavaScript das regras de firestore.rules, usada pelo banco de TESTE
// (modo ?teste=1). Serve para testar o app sem o servidor de verdade.

const iguaisLista = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
const iguaisConj = (a, b) => {
  const A = new Set(a), B = new Set(b);
  return A.size === B.size && [...A].every((x) => B.has(x));
};
const removeAll = (lista, tirar) => lista.filter((x) => !tirar.includes(x));
const soChaves = (obj, chaves) => Object.keys(obj).every((k) => chaves.includes(k));
const temChaves = (obj, chaves) => chaves.every((k) => k in obj);
const ehInt = (x) => Number.isInteger(x);

function candidatos(antes, pessoa) {
  const faltam = removeAll(antes.participantes, antes.jaTiraram);
  const livres = removeAll(removeAll(antes.participantes, antes.jaTirados), [pessoa]);
  const outra = removeAll(faltam, [pessoa]);
  return faltam.length === 2 && outra.length === 1 && livres.includes(outra[0]) ? outra : livres;
}

const CH_PAR = ["quemTirou", "tirou", "numero", "digitos", "email", "ordem", "mareQ", "casa",
  "indice", "data"];

function parCerto(antes, p, pessoa) {
  const d = p.digitos;
  const cands = candidatos(antes, pessoa);
  const k = cands.length;
  if (!(soChaves(p, CH_PAR) && temChaves(p, CH_PAR))) return "campos do par";
  if (p.quemTirou !== pessoa) return "quemTirou";
  if (!(typeof p.numero === "string" && /^[0-9]{5}$/.test(p.numero))) return "numero";
  if (!(Array.isArray(d) && d.length === 5 && d.map(String).join("") === p.numero)) return "digitos";
  if (![p.mareQ, p.casa, p.indice, p.ordem].every(ehInt)) return "tipos";
  if (!(p.mareQ * 5 <= antes.somaMare + 2 && antes.somaMare + 2 < p.mareQ * 5 + 5)) return "mareQ";
  const numero = [0, 50][d[0] % 2] + d[1] * 5 + [0, 0, 1, 1, 2, 2, 3, 3, 4, 4][d[2]];
  const ordem = ((antes.jaTiraram.length + 1) % 5) * 4;
  if (p.casa !== (numero + ordem + (p.mareQ % 20)) % 100) return "casa";
  if (!(k > 0 && p.indice >= 0 && p.indice < k)) return "indice faixa";
  if (!(p.indice * 100 <= p.casa * k && p.casa * k < (p.indice + 1) * 100)) return "indice";
  if (p.tirou !== cands[p.indice]) return "tirou";
  if (p.ordem !== antes.jaTiraram.length + 1) return "ordem";
  if (!(typeof p.email === "string" && p.email.length <= 100 && p.email === p.email.toLowerCase()
    && /^[^@ /]+@[^@ /]+[.][^@ /]+$/.test(p.email))) return "email";
  if (!(typeof p.data === "string" && p.data.length <= 40)) return "data";
  return null;
}

function publicoCerto(antes, depois, p, pessoa) {
  const d = p.digitos;
  if (!soChaves(depois, ["participantes", "jaTiraram", "jaTirados", "somaMare", "criadoEm"]))
    return "campos do publico";
  if (!iguaisLista(depois.participantes, antes.participantes)) return "participantes";
  if (depois.criadoEm !== antes.criadoEm) return "criadoEm";
  if (!iguaisLista(depois.jaTiraram, antes.jaTiraram.concat([pessoa]))) return "jaTiraram";
  if (depois.jaTirados.length !== antes.jaTirados.length + 1) return "jaTirados tamanho";
  if (!iguaisConj(depois.jaTirados, antes.jaTirados.concat([p.tirou]))) return "jaTirados";
  if (depois.somaMare !== antes.somaMare + d[3] + d[4]) return "somaMare";
  return null;
}

// banco: { publico, pares: {id: doc}, emails: {id: doc} } antes da escrita
// escrita: { publico, parId, par, emailId, email }
export function regrasAceitamSorteio(banco, escrita) {
  const antes = banco.publico;
  if (!antes) return "sem sorteio";
  const pessoa = escrita.publico.jaTiraram[antes.jaTiraram.length];
  if (pessoa === undefined) return "jaTiraram não cresceu";
  if (escrita.parId !== pessoa) return "id do par";
  if (banco.pares[pessoa]) return "par já existe";
  if (!antes.participantes.includes(pessoa)) return "pessoa desconhecida";
  if (antes.jaTiraram.includes(pessoa)) return "já tirou";
  const p = escrita.par;
  const e1 = parCerto(antes, p, pessoa);
  if (e1) return e1;
  const e2 = publicoCerto(antes, escrita.publico, p, pessoa);
  if (e2) return e2;
  if (banco.emails[p.email]) return "email usado";
  if (escrita.emailId !== p.email) return "id do email";
  if (!(soChaves(escrita.email, ["usado"]) && escrita.email.usado === true)) return "doc email";
  return null;
}
