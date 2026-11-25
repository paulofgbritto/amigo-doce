# ✦ Amigo Doce

Sorteio de amigo doce da sala, pelo celular. Todo mundo usa o mesmo link e a mesma base de dados (Firebase).

## Como funciona

- Cada pessoa toca no **próprio nome**, informa o **e-mail** e digita um **número de 5 dígitos**.
- O número decide quem ela tira, pela **roleta de 100 casas** (sem nada aleatório):
  1. **Número**: 1º dígito par começa na casa 0, ímpar na casa 50; o 2º anda 5 casas por unidade; o 3º anda 1 casa a cada 2.
  2. **Ordem** (fila do pão): a cada rodada a roleta gira 4 casas (volta a zero a cada 5).
  3. **Maré** (longo prazo): soma dos 4º e 5º dígitos de todos os números anteriores, ÷ 5 arredondado, resto 20.
  4. As 100 casas são divididas igualmente entre quem ainda pode ser tirado; a casa final diz a pessoa.
- Ninguém tira a si mesmo, ninguém é tirado duas vezes e o sorteio nunca trava.

## Segurança

- O placar público mostra só **quem já tirou** e **quem falta**.
- **Quem tirou quem** e os **e-mails** só o organizador vê (aba ★ Sorteios, com senha).
- As regras do servidor (`firestore.rules`) **refazem a conta da roleta**: ninguém consegue forçar um resultado mexendo no site.
- Cada e-mail só pode ser usado uma vez.

## Organizador

- **★ Sorteios** (senha): ver quem tirou quem, desfazer o último, reiniciar / trocar nomes.
- **Aba de desenvolvedor**: `Shift + 0` no computador, ou tocar 5 vezes em "✦ Amigo Doce" no celular (pede a senha).

## Arquivos

| Arquivo | O que é |
|---|---|
| `index.html`, `estilo.css`, `app.js` | o site |
| `logica.js` | a roleta |
| `db-firebase.js` | conexão com o Firebase |
| `config.js` | configuração do projeto Firebase |
| `firestore.rules` | regras de segurança (colar no console do Firebase) |
| `db-teste.js`, `regras-espelho.js` | modo de teste local: abra o site com `?teste=1` |
| `vendor/firebase.js` | biblioteca do Firebase (13.4.0) |
