## Tradução nativa PT-BR (em desenvolvimento)

A versão de tradução do *Fisherman's Bait 2: Big Ol' Bass* **edita fisicamente os dados do disco PS1** — não existe substituição DOM/HTML, OCR, overlay ou legenda externa. A cópia original é preservada.

### O que já está traduzido

- **21 substituições de texto ASCII** dentro do executável `SLUS_009.99` (por exemplo: `PRESS START BUTTON` → `APERTE START`, `CREDIT(S)` → `CREDITOS`, nome do jogador, ranking e algumas mensagens de Memory Card).
- **Texturas TIM internas a `FISHING.DAT`**: `MODE SELECT` → `ESCOLHA O MODO`, `BEGINNER` → `INICIANTE`, `TOURNAMENT` → `TORNEIO`, `FREE FISHING` → `PESCA LIVRE`, `VS PLAY` → `VERSUS`, `WORLD MONSTERS` → `MONSTROS`, `TRAINING` → `TREINO`.
- A tradução gráfica é feita reconstruindo as imagens em formato **TIM indexado 4bpp**, preservando resolução, paleta, tamanho dos recursos e posições no arquivo DAT. As palavras foram adaptadas às larguras originais recortadas pelo jogo.
- Os setores **MODE2/Form1 de 2352 bytes** alterados têm EDC e ECC P/Q recalculados e verificados. O algoritmo coincide bit a bit com setores originais do disco.
- Chromium/PSXRecomp comprovou o fluxo completo até **MODE SELECT** usando o BIN modificado, com os textos integrados ao vídeo do jogo. O último teste não apresentou exceções JavaScript.

**Importante:** isto **não é uma tradução integral**. Outras texturas TIM, instruções da pescaria e eventuais recursos de áudio continuam em inglês. A fonte ASCII do executável não foi ampliada para acentos; por isso as frases de texto usam português sem diacríticos onde necessário. As texturas TIM podem exibir acentos. Para uma tradução total será necessário percorrer os demais recursos (foram identificadas 1.236 TIMs válidas no DAT) e validar os textos restantes.

### Reproduzir apenas com sua cópia original

Na pasta do projeto:

```bash
python3 tools/translate_fish_ptbr.py \
  "private/original-disc/Fisherman's Bait 2 - Big Ol' Bass.bin" \
  --out private/ptbr/translated
```

A primeira etapa gera `private/ptbr/translated/Big_Ol_Bass_PTBR.bin`, `.cue` e `translation_report.json`. O hash SHA-1 original é validado antes de alterar qualquer byte. A ferramenta se recusa a sobrescrever uma saída existente.

Para **traduzir também os TIMs**, é necessário Python com Pillow e uma fonte TrueType instalada localmente. Exemplo isolado para AEROCOOL/Unraid:

```bash
docker run --rm \
  -v "$PWD":/project \
  -v /usr/share/fonts/TTF:/fonts:ro \
  -w /project python:3.12-slim \
  sh -lc 'pip install -q pillow && python tools/patch_fish_tim_ptbr.py'
```

O segundo estágio gera em `private/ptbr/translated_graphics/`:

- `Big_Ol_Bass_PTBR_v2.bin` e `.cue`: **arquivo de disco PS1 contendo as traduções reais**.
- `graphic_report.json`: hashes, offsets e setores modificados.
- Prévias das TIMs traduzidas (somente locais).

Validações automáticas sem material protegido:

```bash
python3 -m unittest discover -s tests -p 'test_*.py' -v
```

Não coloque os BIN/CUE traduzidos no GitHub nem ofereça download público dos dados do jogo sem permissão dos titulares. Os scripts incluem as instruções de modificação, mas **não** contêm o jogo, BIOS, recursos originais extraídos, código recompilado ou fontes tipográficas.

Para o AEROCOOL, os arquivos ficam sob `/mnt/user/Games/fish-port/private/ptbr/`. A instância de teste PT-BR usa o endereço privado `http://127.0.0.1:18874/` no próprio host e **não** substitui o site público do jogo.
