# O Cobogó

Revista editorial pessoal de João Andrade — "Ensaios de um não-candango no Planalto".
Ensaios longos (1.000–1.200 palavras) sobre política, cidade e cultura, escritos de Brasília.

- **Produção:** https://ocobogo.com.br (Vercel, deploy automático da `main`)
- **Register:** brand/editorial — o design É parte do produto; estética de revista impressa.
- **Público:** leitores de política/economia no Brasil; chegam por WhatsApp e LinkedIn, maioria no celular.

## Identidade visual (já estabelecida — preservar)

- Tokens em `src/styles/global.css`: papel (`--paper #f9f9f6`), tinta (`--ink`), acento terracota (`--terra #B85A1F`).
- Tipografia unificada: **Bitter** (serif) pra tudo — títulos, corpo, rótulos.
- Rótulos/kickers: caixa alta, 10–11px, letter-spacing largo (grammar da casa, sistema nomeado).
- Marca registrada: **peças de cobogó** em SVG (`CobogoSymbols.astro`, 7 símbolos via `<use href="#cobogo-*">`), cada editoria tem cor + peça própria.
- Inserts editoriais (padrão "Sobre o autor"): régua preta de 12px + rótulo + conteúdo em grid.
- Header com cor da paleta Brasília sorteada por carregamento.

## Estado

Fase "só o essencial": rodapé desativado, nav só Home, /sobre redireciona pra home.
Admin próprio (TipTap → commit via Octokit no GitHub). Analytics Umami.
