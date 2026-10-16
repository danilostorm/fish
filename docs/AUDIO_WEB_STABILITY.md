# Fisherman's Bait 2 — estabilidade do áudio WebAssembly

## Causa e mitigação

A ponte entre o motor recompilado do PS1 e o Web Audio usava apenas **30 ms de reserva** fora de Windows. Quando o jogo executa a 44–50 ciclos/s, em vez dos ~59,94 esperados, ele gera menos amostras por segundo de tempo real. O navegador esgota a fila, provocando cortes (underruns).

A configuração nova no launcher:
- Ativa **Som adaptativo** por padrão, com botão para voltar ao áudio original.
- Eleva a reserva para **120 ms**, ou pelo menos **160 ms em Windows**.
- Corrige a reprodução em cada lote PCM com realimentação do tamanho da fila, evitando lacunas e buffers superlotados.
- Evita enfileirar áudio obsoleto enquanto o navegador bloqueia reprodução automática.
- Não modifica BIN/CUE, tradução, comandos ou relógio da simulação: altera apenas a saída Web Audio.

## Testes AEROCOOL / Chromium, 2026-10-16

| Configuração | Janela | Ciclos/s | Underruns | Descartes |
| --- | --- | ---: | ---: | ---: |
| Novo modo adaptativo + feedback de buffer | 18 s | 44,3 | **0** | **0** |
| Mesmo player com modo adaptativo desativado | 18 s | 46,6 | 31 | 0 |

São métricas técnicas, não uma confirmação de qualidade sonora subjetiva em Windows, Android ou numa pescaria completa. Os cortes contados antes do usuário autorizar AudioContext não entram nas janelas.

## Limitações

AudioBufferSourceNode.playbackRate modifica tanto a velocidade como o **pitch**, fazendo a música soar mais grave quando o jogo executa abaixo do alvo. Preservar a altura do áudio enquanto reduz a velocidade exige time stretch com pitch preservado (por exemplo WSOLA/AudioWorklet), ou aproximar a execução de 59,94 ciclos/s o tempo inteiro.

**60 ciclos/s do PS1 não é sinônimo de 60 FPS:** um jogo a 30 FPS pode atualizar a imagem a cada dois VBlanks.

O modo original continua disponível pelo botão Som adaptativo. O usuário pode compará-lo, especialmente se a música ficar grave no modo adaptativo.
