# Coleta de dados — Fase 0

Estes arquivos são o que falta para o sistema sair do papel. Sem eles, qualquer
tela que eu construir vai usar dado inventado, e a gente descobre o que estava
errado só no dia do piloto.

## Como preencher

- Abra os `.csv` no Excel ou Google Sheets. O separador é **ponto e vírgula (`;`)**,
  que é o padrão do Excel em português.
- Cada arquivo já vem com **linhas de exemplo** — apague-as e coloque as suas.
- Não precisa ficar bonito. Preencha do jeito que der; eu limpo depois.
- Se for mais fácil mandar foto do caderno, print da agenda ou a planilha que
  você já usa, manda. Eu converto.

## Ordem de prioridade

Se não der para preencher tudo de uma vez, siga esta ordem — é a ordem em que
eu preciso dos dados para construir:

| # | Arquivo | Por que é crítico |
|---|---|---|
| 1 | `01-unidades.csv` | Sem as unidades, nada mais existe |
| 2 | `02-horarios-funcionamento.csv` | Define quando existe agenda |
| 3 | `05-servicos.csv` | **O mais importante.** Duração errada = agenda errada |
| 4 | `03-profissionais.csv` | Quem são e onde atendem |
| 5 | `06-quem-faz-o-que.csv` | Sem isso o cliente marca com quem não sabe fazer |
| 6 | `04-escalas.csv` | Quando cada um trabalha |
| 7 | `07-recursos.csv` | Evita duas clientes na mesma cabine |
| 8 | `08-precos-excecoes.csv` | Só se preço varia por profissional/unidade |
| 9 | `09-comissoes.csv` | Fase 2, mas melhor coletar junto |
| 10 | `10-clientes.csv` | Sua carteira de clientes — veja abaixo |

## O campo que mais gera dúvida: duração do serviço

O sistema separa a duração em três partes. Isso não é firula — é o que permite
encaixar outra cliente enquanto a primeira está de química na cabeça.

```
COLORAÇÃO — 100 minutos no total

|── aplicação 30min ──|──── pausa 40min ────|── finalização 30min ──|
      você trabalha         você está LIVRE        você trabalha
```

- **`aplicacao_min`** — o tempo em que a profissional está de fato com a cliente
- **`pausa_min`** — o tempo de processamento/ação do produto, em que a
  profissional pode atender outra pessoa. **Zero na maioria dos serviços**
  (corte, escova, manicure)
- **`finalizacao_min`** — lavar, secar, finalizar

Se o serviço não tem pausa (corte, por exemplo), preencha só `aplicacao_min` e
deixe os outros dois zerados.

- **`folga_depois_min`** — tempo de limpeza/troca entre uma cliente e outra.
  Se você sempre precisa de 10 minutos para arrumar a estação, coloque 10.

## Convenções que valem para todos os arquivos

- **Coluna em branco = herda / não se aplica.** Em `08-precos-excecoes.csv`, se
  você preencher só o preço e deixar as durações vazias, o sistema mantém a
  duração padrão do serviço. Em `02-horarios-funcionamento.csv`, `abre` e `fecha`
  vazios significam **fechado naquele dia**.
- **Código** (`centro`, `ana`, `corte-fem`) é o apelido curto que amarra um
  arquivo no outro. Use letras minúsculas, sem acento e sem espaço — e repita
  exatamente o mesmo código nos outros arquivos.
- **Dinheiro** com vírgula, do jeito brasileiro: `180,00`.
- **Listas dentro de uma célula** separadas por vírgula, sem espaço:
  `corte-fem,escova,coloracao`.
- **Sim/não** escreva `sim` ou `nao`.

### Sobre `08-precos-excecoes.csv`

Só preencha se o preço ou a duração mudar em algum caso. A regra de desempate,
da mais específica para a mais genérica:

```
profissional + unidade  →  profissional  →  unidade  →  preço base do serviço
```

Ou seja: se a Ana cobra mais caro por mechas em qualquer unidade, é uma linha
com `profissional=ana` e `unidade` vazio.

### Sobre `09-comissoes.csv`

É Fase 2, mas coletar agora evita uma segunda rodada de perguntas. Preencha
**ou** `percentual` **ou** `valor_fixo`, nunca os dois na mesma linha. Deixar
`servico` e `categoria` vazios significa "regra geral desta profissional".

### Sobre `10-clientes.csv`

É o único arquivo que **entra sozinho no sistema**, pela tela *Clientes →
Importar*. Os outros eu cadastro na mão junto com você.

Só duas colunas são obrigatórias: `nome` e `telefone`. `email` pode ficar em
branco à vontade.

O telefone pode vir do jeito que estiver na sua agenda — `(11) 98888-0001`,
`11988880001`, `+55 11 98888-0001`. O sistema arruma. Só precisa ter DDD.

**Quem já existe não vira cópia.** A conferência é pelo telefone: se a cliente
já está cadastrada, a linha não cria uma segunda — no máximo preenche o e-mail
que estava faltando. Então pode reenviar o arquivo depois de completar, sem
medo de duplicar ninguém.

Essa é a lista que faz as rotinas de WhatsApp terem para quem falar no primeiro
dia. Sem ela, o sistema só conhece quem marcar do zero.

## Depois de preencher

Me avise. Eu carrego os dados no banco, e a partir daí a agenda que você vai
ver na tela é a agenda real do seu estúdio, não um exemplo.
