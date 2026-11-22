# Churrascaria Querência: site

Site institucional da **Churrascaria Querência** (Esteio/RS, desde 1989), com abertura cinematográfica: a rolagem "toca" um filme da picanha sendo cortada.

## Estrutura

| Pasta | Conteúdo |
|---|---|
| `site/` | O site pronto (HTML, CSS e JavaScript puros, sem build). É isto que vai ao ar. |
| `fonte/` | Arquivos de trabalho: vídeos gerados, quadros-chave, fotos e logos originais. |
| `brief.json` | Resumo do projeto: dados da marca, seções, decisões e pendências. |
| `.github/workflows/pages.yml` | Publica a pasta `site/` no GitHub Pages a cada envio para `main`. |

## Ver no computador

```bash
python -m http.server 4173 --directory site
```

Depois abra http://localhost:4173.

## Como funciona

- **Filmes na rolagem:** o hero e as três cenas (fogo, mesa, pedido) são sequências de quadros WebP desenhadas em `<canvas>` conforme a rolagem. No celular usam menos quadros.
- **Sem dependências externas:** fontes (Playfair Display e Figtree) hospedadas em `site/assets/fonts`; nenhum script de terceiros.
- **Celular:** menu em tela cheia, respeita `prefers-reduced-motion` e liga um "modo leve" sozinho em aparelhos lentos.
- **Pedidos:** os botões levam ao cardápio digital da casa; o formulário abre o WhatsApp com a mensagem pronta.

## Pendências conhecidas

- Confirmar o horário de funcionamento (Instagram: dom a sex, 11h às 14h30; sistema de pedidos: 9h45 às 14h45).
- Incluir avaliações reais do Google (a seção mostra só a nota e o link).

## Direitos

Marca, logo, textos e fotos pertencem à **Churrascaria Querência**; não há licença de reuso. As cenas em vídeo e o quadro de abertura foram gerados por IA e são **imagens de conceito**, não fotos dos pratos da casa.