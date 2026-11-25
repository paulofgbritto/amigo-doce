// Banco de dados REAL: Firebase (Firestore + login do organizador)
import {
  initializeApp, getFirestore, doc, collection, getDocs, onSnapshot, runTransaction, writeBatch,
  getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, setPersistence,
  browserSessionPersistence,
} from "./vendor/firebase.js";
import { montarSorteio, desfazerUltimo, publicoNovo, agora } from "./logica.js";

const EMAIL_ADMIN = "admin@amigo-doce.app";
const PREFIXO_SENHA = "amigodoce"; // a senha do login é "amigodoce" + a senha digitada no app

export class Erro extends Error {}

function traduzir(e) {
  if (e instanceof Erro) return e;
  const c = (e && e.code) || "";
  if (c === "permission-denied")
    return new Erro("O servidor recusou. Alguém pode ter tirado ao mesmo tempo: tente de novo.");
  if (c === "auth/invalid-credential" || c === "auth/wrong-password" || c === "auth/user-not-found"
      || c === "auth/invalid-login-credentials")
    return new Erro("Senha incorreta.");
  if (c === "auth/too-many-requests")
    return new Erro("Muitas tentativas erradas. Espere alguns minutos.");
  if (c === "unavailable" || c === "auth/network-request-failed")
    return new Erro("Sem conexão com a internet. Tente de novo.");
  if (c === "failed-precondition" || c === "aborted")
    return new Erro("Alguém mexeu no sorteio ao mesmo tempo. Tente de novo.");
  return new Erro((e && e.message) || String(e));
}

export function criarBanco(config) {
  const app = initializeApp(config);
  const db = getFirestore(app);
  const auth = getAuth(app);
  const refPub = doc(db, "sorteio", "publico");

  return {
    modo: "firebase",

    ouvirPublico(cb, cbErro) {
      return onSnapshot(refPub, (s) => cb(s.exists() ? s.data() : null),
        (e) => cbErro && cbErro(traduzir(e)));
    },

    ouvirAdmin(cb) {
      return onAuthStateChanged(auth, (u) => cb(!!u && u.email === EMAIL_ADMIN));
    },

    async sortear(pessoa, numero, email) {
      try {
        return await runTransaction(db, async (tx) => {
          const refEmail = doc(db, "emails", email);
          const sPub = await tx.get(refPub);
          const sEmail = await tx.get(refEmail);
          if (!sPub.exists()) throw new Erro("O sorteio ainda não foi configurado.");
          if (sEmail.exists()) throw new Erro("Esse e-mail já foi usado para tirar. Use o seu próprio e-mail.");
          const m = montarSorteio(sPub.data(), pessoa, numero, email, agora());
          tx.set(refPub, m.novoPub);
          tx.set(doc(db, "pares", pessoa), m.par);
          tx.set(refEmail, { usado: true });
          return m.tirou;
        });
      } catch (e) {
        if (e instanceof Erro) throw e;
        if (e && e.message && !e.code) throw new Erro(e.message);
        throw traduzir(e);
      }
    },

    async entrarAdmin(senha) {
      try {
        await setPersistence(auth, browserSessionPersistence);
        await signInWithEmailAndPassword(auth, EMAIL_ADMIN, PREFIXO_SENHA + senha);
      } catch (e) {
        throw traduzir(e);
      }
    },

    async sairAdmin() {
      try { await signOut(auth); } catch (e) { /* ignora */ }
    },

    async listarPares() {
      try {
        const s = await getDocs(collection(db, "pares"));
        return s.docs.map((d) => d.data()).sort((a, b) => a.ordem - b.ordem);
      } catch (e) {
        throw traduzir(e);
      }
    },

    async desfazer() {
      try {
        return await runTransaction(db, async (tx) => {
          const sPub = await tx.get(refPub);
          if (!sPub.exists()) throw new Erro("Não há sorteio.");
          const pub = sPub.data();
          if (!pub.jaTiraram.length) throw new Erro("Não há nada para desfazer.");
          const quem = pub.jaTiraram[pub.jaTiraram.length - 1];
          const refPar = doc(db, "pares", quem);
          const sPar = await tx.get(refPar);
          if (!sPar.exists()) throw new Erro("Dados do último sorteio não encontrados.");
          const par = sPar.data();
          const novo = desfazerUltimo(pub, par);
          delete novo._quem;
          tx.set(refPub, novo);
          tx.delete(refPar);
          tx.delete(doc(db, "emails", par.email));
          return quem;
        });
      } catch (e) {
        throw traduzir(e);
      }
    },

    async configurar(nomes) {
      try {
        const lote = writeBatch(db);
        for (const nome of ["pares", "emails"]) {
          const s = await getDocs(collection(db, nome));
          s.docs.forEach((d) => lote.delete(d.ref));
        }
        lote.set(refPub, publicoNovo(nomes, agora()));
        await lote.commit();
      } catch (e) {
        throw traduzir(e);
      }
    },
  };
}
