# Material do salão

O que a dona mandou. Fica versionado porque é a fonte do cadastro de produção:
`packages/db/src/cadastro/nohora.ts` lê as fotografias daqui pelo caminho, e o
preçário abaixo é a origem de cada preço que está no banco.

Os nomes são ASCII de propósito. Os originais vinham do WhatsApp com acento em
forma decomposta (`Prec ̧a ́rio`), que o Windows abre e várias ferramentas de
linha de comando não — inclusive o `git mv`.

## Fotografias

Cada pasta é uma unidade, e o número no nome é a ordem: **`01` é a capa**
(`units.image_url`), o resto é a galeria (`unit_photos`), nesta sequência.

| Ficheiro | O que é |
| --- | --- |
| `fotos/valongo/01-montra.jpg` | Montra à noite, no centro comercial, com o letreiro |
| `fotos/valongo/02-colorbar.jpg` | Parede do ColorBar, prateleiras e lavatórios |
| `fotos/valongo/03-lavagem.jpg` | Cadeiras de lavagem, de perto (retrato) |
| `fotos/valongo/04-sala.jpg` | Sala inteira: painel de carvalho, bancos, parede verde |
| `fotos/valongo/05-maquilhagem.jpg` | Espelho de lâmpadas da maquilhagem |
| `fotos/valongo/06-colorbar-lavagem.jpg` | ColorBar visto de longe, com a zona de lavagem |
| `fotos/maia/01-lavagem.jpg` | Lavatórios pretos e prateleiraria branca |
| `fotos/maia/02-espelhos.jpg` | Espelhos suspensos retroiluminados contra o cortinado (retrato) |
| `fotos/maia/03-cadeiras.jpg` | Cadeiras de lavagem, de perto (retrato) |

**Resolução.** Todas chegaram por WhatsApp, que reduz para 1600 px no lado maior
e 110–235 KB. Serve para publicar; num ecrã Retina a capa em banda larga fica
visivelmente mole. Vale pedir os originais à dona por e-mail ou Drive — o
WhatsApp comprime outra vez a cada reenvio.

## Preçário

`precario.pdf` — os dois talões, um por loja. O conteúdo é igual nas duas; só a
morada muda. É o documento que a dona imprime e põe ao balcão, então quando o
preço mudar no papel tem de mudar aqui e no cadastro.

## Logo

`logo.jpg` — 640×640, raster, fundo branco. Falta o SVG com fundo transparente;
está na lista de pendências do `DESIGN.md`.
