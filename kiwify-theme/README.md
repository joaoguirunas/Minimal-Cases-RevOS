# Kiwify Members-Area Theme — Growth Sales

Tema Liquid (modelo Shopify-like) da **área de membros hospedada pela Kiwify**, ao qual
aplicamos a identidade **Growth Sales**. Este diretório **versiona os arquivos REAIS** do
Code Editor da Kiwify — **não há deploy pela nossa infra**.

> ⚠️ Os arquivos aqui são os **reais**, colados do Code Editor da Kiwify. Uma versão anterior
> deste tema foi construída sobre **suposições** (snippets/sections inventados) e foi
> **descartada**. Não recrie arquivos: **edite os reais**. Mecanismo e racional completo em
> `docs/smart-memory/decisions/ADR-KFY-02-tema-mecanismo-aplicacao-marca.md`.

## Publicação (manual)

A Kiwify **não expõe CLI/deploy**. A entrega é o código Liquid/CSS que o usuário **cola no
Code Editor** do painel (ou edita pelo Theme Editor visual — as duas vias sincronizam).
Copie o conteúdo de cada arquivo para o arquivo correspondente do tema na Kiwify.

## Estrutura real

```
kiwify-theme/
├── sections/
│   ├── banner.liquid              # carousel de slides (embla, autoplay)
│   ├── login.liquid              # acesso — variantes sidebar/background (objeto club)
│   ├── modules.liquid            # módulos de um curso → delega a snippet 'cards'
│   ├── courses.liquid            # grade de cursos → delega a 'cards'
│   ├── lessons.liquid            # aulas de um módulo → delega a 'cards'
│   └── continue_watching.liquid  # last_watched_lessons → delega a 'cards'
├── snippets/
│   ├── cards.liquid              # monta o carousel embla, itera 'cards-item'
│   ├── cards-item.liquid         # card individual (disabled/purchasable/progresso/router)
│   ├── image.liquid              # mount do componente hidratado ClubImage
│   └── auth-button.liquid        # mount do componente hidratado AuthButton
├── templates/                    # index.json / login.json — AUTO-GERADOS pela Kiwify, NÃO deliverable
└── locales/                      # traduções (chaves | t)
```

> ⚠️ **`templates/*.json` são auto-gerados** pelo editor visual ("pode ser sobrescrito") —
> pertencem ao runtime da conta. **Não versionar/colar** como deliverable; no máximo exemplo
> de referência. Deliverables = só `sections/*.liquid` + `snippets/*.liquid`.

> ⚠️ **Sem arquivo novo.** O Code Editor desta conta Kiwify só permite editar os arquivos fixos
> do tema (as 6 sections + 4 snippets acima) — não há ação de "criar arquivo". Por isso o
> backbone `{% style %}` (fontes, `body` void, texturas, `::selection`, override `--primary-*`)
> não vive num `snippets/gs-foundation.liquid` separado — está **duplicado no topo de cada uma
> das 6 sections reais** (idempotente, só verboso). Se a plataforma passar a permitir arquivos
> custom, colapsar de volta pra 1 snippet renderizado é trivial.

## Como aplicamos a marca (ADR-KFY-02)

Não existe config global de cores na Kiwify (sem `settings_schema.json`, sem `layout/theme.liquid`;
schema é por-seção e não tem input `color`). As classes `bg-primary-500`/`text-primary-foreground`/
`bg-gray-*` são Tailwind semântico da plataforma. Aplicação em 3 camadas:

1. **Painel (zero código, `TODO verify`):** se houver "cor principal", setar `#ff3a0e`.
2. **Backbone `{% style %}`** (duplicado no topo de cada uma das 6 sections reais — sem arquivo
   novo, ver aviso acima): fontes (`@import` + fallback), `body` void/`--bone-dim`/`font-family`,
   texturas `::before/::after`, `::selection` ember, override best-effort de `--primary-*`/gray.
3. **Edição direta de classes** nos arquivos reais: `bg-primary-500` → `bg-[#ff3a0e]`,
   `text-primary-foreground` → `text-[#050507]`, `bg-gray-50 dark:bg-gray-800` → superfícies
   Growth, progress `text-red-500` → ember, etc. **Lógica Liquid intacta** — só cor/tipografia.

## Restrições da plataforma (reais)

- **Sem `<script>` autoral.** A plataforma injeta o próprio JS por **hidratação declarativa**:
  `data-kiwi-component` (ClubImage/AuthButton), `data-embla-options` (carousel),
  `data-kiwi-router-link` (navegação), `data-microtip-position` (tooltips). Não é JS nosso.
- **`{% style %}` (oficial)** é o mecanismo de CSS arbitrário. Schema é **por-seção**.
- Máx **25 sections/template**, **50 blocks/section**.
- **2 templates customizáveis** (index, login); telas de aula/player **não** são tematizáveis.
- **Não reescrever** a lógica Liquid (`assign`/`if`/`reject_exp`/`has_exp`/`render`/`| t`).

## Fontes — três caminhos (fallback gracioso)

Design system pede **Fraunces** (display), **Inter Tight** (sans), **JetBrains Mono** (mono).
No backbone `{% style %}`: `@import` do Google Fonts (padrão), ou `<link>` no markup da
section, ou só stacks de sistema. Em qualquer caso a hierarquia serif/sans/mono é preservada
(`Georgia serif` / `system-ui` / `ui-monospace` como fallback).

> **TODO(verify) em runtime:** (a) existência/efeito da cor-principal do painel; (b) nomes
> exatos das vars `--primary-*`; (c) Kiwify não sanitiza `@import` externo; (d) filtro de URL
> do `image_picker`. Ver ADR-KFY-02.

## Tokens

Valores exatos em `docs/smart-memory/project/growth-sales-design-system.md` §1
(void/ink/bone/ember, hairlines, easings, escala de display).
</content>
