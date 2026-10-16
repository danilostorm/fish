# Fisherman's Bait 2 — controles DualShock analógicos no navegador

Atualização 2026-10-16: o player agora oferece **Configurar controle** no painel principal e durante a partida, sem sair do jogo. A configuração fica no navegador via `localStorage` (chave `hoststorm-fish-controller-v2`).

## Correção técnica

O antigo adaptador Web enviava somente um campo de 16 botões PS1 e dobrava o analógico esquerdo em quatro direções digitais. Nunca transmitia o stick direito para a porta SIO do PS1. Por isso o giro da manivela (analógico direito, conforme os comandos fornecidos pelo usuário) não podia funcionar.

O novo arquivo `web/fish-controls.js` lê e mapeia os eixos físicos, com configuração de pares de eixos, controles múltiplos, zona morta, inversão vertical, remapeamento dos botões e opção de manivela simulada por R3. Os valores são convertidos para **quatro bytes LX, LY, RX, RY** (128 = centro), empacotados atomicamente e passados ao WebAssembly por `psx_web_set_pad_axes`. O teclado pode simular giro contínuo do analógico direito enquanto C está pressionada.

O patch `patches/fish-web-analog.patch` configura o primeiro controle como **DualShock analógico (ID 0x73)** por padrão e faz a CPU recompilada enviar eixos e botões ao circuito SIO em cada amostragem. É possível escolher Digital ou Híbrido no menu. Ao conectar no navegador, pressione algum botão para ativar a API Gamepad.

## Configuração recomendada para pescar

- Modo: **DualShock analógico**
- Analógico esquerdo: eixos 0/1 para movimentar a vara
- Analógico direito: eixos 2/3, girar continuamente para recolher a linha
- L1 / R1: configurar ou aliviar tensão conforme comandos do jogo
- X / ◯: manter mapeamento do controle ou personalizar
- Se o navegador mostrar eixos diferentes, altere o par no menu enquanto observa os círculos luminosos.
- Opcional: segurar **R3** para simular a rotação contínua. No teclado, segurar **C**.

## Testes

Em Chromium no AEROCOOL com gamepad virtual, a versão recompilada reportou SIO em modo analógico (1 = ID 0x73), recebeu os quatro eixos ([39,192,242,33] no teste), com resposta simultânea do botão ✕; a troca dos pares de eixos produziu [242,33,39,192]. Não houve erros de JavaScript. O painel foi validado em viewport desktop e 390 px de largura, sem overflow lateral. O usuário ainda precisa confirmar se o jogo reage ao recolhimento em gameplay real.

## Build

Recompilar a imagem privada com as modificações existentes (input + áudio + WebGL2) e, por último, o patch analógico:

```sh
patch -p1 < patches/fish-web-analog.patch
docker run --rm -v "$PWD:/project" -w /project emscripten/emsdk:4.0.23 cmake --build build-web-input -j 10
bash scripts/package-web.sh
```

O patch se aplica ao runtime **já contendo** os patches anteriores. No ambiente AEROCOOL, ele já está aplicado. Não reaplicá-lo na cópia de trabalho. Arquivos BIN/CUE e BIOS continuam fora do GitHub. Preserve o antigo WASM para rollback.

**Limitação:** o teste sintético comprova transporte do analógico até a interface de hardware PS1 e modo DualShock, mas não garante que toda fase de gameplay utilize esses comandos de forma esperada. Calibração em controle físico deve ser feita na página de pesca.
