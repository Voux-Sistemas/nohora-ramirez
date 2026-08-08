# Operação da produção

O que é preciso saber para instalar, entrar e não perder dado. Cada seção é uma
coisa que já deu (ou daria) trabalho descobrir na hora errada.

| Assunto | Onde |
| --- | --- |
| Backup diário e prova do restore | [backup/README.md](backup/README.md) |
| Primeira conta do sistema | aqui embaixo |

## A primeira conta

Banco novo não tem ninguém, e o sistema não deixa entrar quem não existe:
`/admin` exige sessão de equipe, e a senha da equipe só se define **dentro** de
`/admin`. Instalado e inacessível é um estado real — a produção subiu nele.

A saída é `/comecar`, que cria a conta da dona (papel `owner`, escopo de rede) e
já entra com ela. A tela existe sob duas condições ao mesmo tempo:

1. **nenhuma conta de equipe no banco.** A primeira conta criada fecha a porta,
   e ela não reabre. Não depende de ninguém lembrar de desligar nada;
2. **`CODIGO_INSTALACAO` configurada** no serviço `web`. Sem a variável, a porta
   está fechada — o padrão é fechado, igual ao de `AMBIENTE`.

Fora dessas condições `/comecar` redireciona para `/entrar` sem dizer por quê:
quem chega ali não descobre se o sistema já tem dono nem se o código existe.

A condição (1) sozinha não bastaria. Entre o deploy e o primeiro login o
endereço já é público, e quem chegasse primeiro viraria dono do salão.

**Para instalar um salão novo:**

```sh
railway variable set CODIGO_INSTALACAO=<código> --service web
```

Abra `/comecar`, preencha nome, celular e senha da dona, e informe o código.
Depois disso a variável pode ficar onde está — a porta já está fechada pela
conta que existe. Trocar o código não reabre nada.

**Se a conta for criada errada** (nome ou telefone trocado), não há tela para
desfazer: apague a linha e refaça. O container não tem `psql` — tem o Node e o
driver da aplicação, que dá no mesmo:

```sh
railway ssh --service web
# lá dentro, com DATABASE_URL já no ambiente. O telefone vai como argumento,
# não colado dentro do SQL.
node -e 'const s=require("postgres")(process.env.DATABASE_URL);s`delete from users where phone = ${process.argv[1]}`.then(r=>console.log(r.count)).finally(()=>s.end())' "+5511999998888"
```

Apagar a pessoa leva junto papéis e sessões (`on delete cascade`), e `/comecar`
volta a abrir sozinha.

## Papéis

Hoje o sistema tem um degrau só: ou a pessoa é cliente, ou é equipe. Quem é
equipe vê tudo — agenda, caixa, cadastro e faturamento das unidades. `/admin`,
`/caixa` e o painel da home checam apenas "tem papel diferente de `client`".

Os papéis granulares (`receptionist`, `unit_manager`, `finance`) existem no banco
e ainda não separam nada na aplicação. Para um salão onde a dona e as
profissionais trabalham lado a lado isso não incomoda; num salão com recepção
rotativa, incomoda. Está escrito aqui para ser uma decisão, não uma surpresa.

## Variáveis do serviço `web`

| Variável | Para quê |
| --- | --- |
| `AMBIENTE` | `producao` ou `teste`. Sem ela, `NODE_ENV=production` já vale como produção |
| `CODIGO_INSTALACAO` | libera `/comecar` enquanto não houver conta de equipe |
| `DATABASE_URL` | referência ao serviço `Postgres` |
| `IMAGE_STORE` `UPLOAD_DIR` | onde as fotos ficam — no volume, não no container |
