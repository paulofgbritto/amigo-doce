// Banco de dados de TESTE (abra o site com ?teste=1).
// Fica só neste navegador (localStorage) e aplica a cópia das regras de segurança.
import { montarSorteio, desfazerUltimo, publicoNovo, agora } from "./logica.js";
import { regrasAceitamSorteio } from "./regras-espelho.js";

const CHAVE = "amigo-doce-teste";
const SENHA_TESTE = "teste"; // senha só do modo de teste (?teste=1)

export class Erro extends Error {}

function ler() {
  try {
    return JSON.parse(localStorage.getItem(CHAVE)) || { publico: null, pares: {}, emails: {} };
  } catch (e) {
    return { publico: null, pares: {}, emails: {} };
  }
}
function gravar(b) { localStorage.setItem(CHAVE, JSON.stringify(b)); }

export function criarBanco() {
  const ouvintes = new Set();
  let admin = sessionStorage.getItem(CHAVE + "-admin") === "1";
  const ouvintesAdmin = new Set();
  const avisar = () => { const p = ler().publico; ouvintes.forEach((cb) => cb(p)); };
  window.addEventListener("storage", (e) => { if (e.key === CHAVE) avisar(); });
  const exigirAdmin = () => { if (!admin) throw new Erro("Sem permissão."); };
  const esperar = () => new Promise((r) => setTimeout(r, 120));

  return {
    modo: "teste",
    ouvirPublico(cb) { ouvintes.add(cb); setTimeout(() => cb(ler().publico), 0); return () => ouvintes.delete(cb); },
    ouvirAdmin(cb) { ouvintesAdmin.add(cb); setTimeout(() => cb(admin), 0); return () => ouvintesAdmin.delete(cb); },

    async sortear(pessoa, numero, email) {
      await esperar();
      const b = ler();
      if (!b.publico) throw new Erro("O sorteio ainda não foi configurado.");
      if (b.emails[email]) throw new Erro("Esse e-mail já foi usado para tirar. Use o seu próprio e-mail.");
      let m;
      try { m = montarSorteio(b.publico, pessoa, numero, email, agora()); }
      catch (e) { throw new Erro(e.message); }
      const erro = regrasAceitamSorteio(b, { publico: m.novoPub, parId: pessoa, par: m.par,
        emailId: email, email: { usado: true } });
      if (erro) throw new Erro("O servidor recusou (" + erro + "). Tente de novo.");
      b.publico = m.novoPub; b.pares[pessoa] = m.par; b.emails[email] = { usado: true };
      gravar(b); avisar();
      return m.tirou;
    },

    async entrarAdmin(senha) {
      await esperar();
      if (senha !== SENHA_TESTE) throw new Erro("Senha incorreta.");
      admin = true; sessionStorage.setItem(CHAVE + "-admin", "1");
      ouvintesAdmin.forEach((cb) => cb(true));
    },
    async sairAdmin() {
      admin = false; sessionStorage.removeItem(CHAVE + "-admin");
      ouvintesAdmin.forEach((cb) => cb(false));
    },
    async listarPares() {
      exigirAdmin(); await esperar();
      return Object.values(ler().pares).sort((a, b) => a.ordem - b.ordem);
    },
    async desfazer() {
      exigirAdmin(); await esperar();
      const b = ler();
      if (!b.publico || !b.publico.jaTiraram.length) throw new Erro("Não há nada para desfazer.");
      const quem = b.publico.jaTiraram[b.publico.jaTiraram.length - 1];
      const par = b.pares[quem];
      const novo = desfazerUltimo(b.publico, par); delete novo._quem;
      b.publico = novo; delete b.pares[quem]; delete b.emails[par.email];
      gravar(b); avisar();
      return quem;
    },
    async configurar(nomes) {
      exigirAdmin(); await esperar();
      gravar({ publico: publicoNovo(nomes, agora()), pares: {}, emails: {} }); avisar();
    },
  };
}
