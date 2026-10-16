# Áudio PT-BR do Fisherman's Bait 2 — WSOLA experimental

## Diagnóstico
A ponte Web Audio recebe PCM estéreo a 44,1 kHz gerado a partir do relógio do PS1 recompilado. Se a emulação executa a 45 ciclos/s, em vez de cerca de 59,94, a produção de amostras não acompanha o consumo do navegador. Isso causa interrupções em **todos os canais**, incluindo música e efeitos. Aumentar o buffer sozinho apenas atrasa o esgotamento. Alterar `AudioBufferSource.playbackRate` pode eliminar algumas lacunas, mas muda a altura da música e o tom dos efeitos.

## Solução proposta e testada
O módulo `web/audio-wsola.js` processa todos os blocos PCM, sem distinguir música de efeitos:
- Recebe os mesmos 44,1 kHz estéreo do runtime existente.
- Aplica **WSOLA (Waveform Similarity Overlap-Add)**, sobrepondo segmentos semelhantes com transições suaves para compensar a menor produção de áudio.
- Mantém `AudioBufferSource.playbackRate=1.0` e preserva a frequência nominal dos sons. Quando a emulação está mais lenta, **a duração/andamento ainda pode mudar** — não equivale a alcançar 60 ciclos/s.
- Mede os ciclos/s do jogo a cada segundo e ajusta gradualmente a proporção de alongamento, com realimentação da fila de áudio.
- Usa reserva de 175 ms (190 ms no Windows), e limite para não acumular atraso indefinidamente.
- Em caso de indisponibilidade do módulo, a ponte anterior permanece funcional, embora possa picotar.

### Testes
- Teste PCM sintético de tom de 440 Hz, proporções de 1,00×, 1,18×, 1,33× e 1,50×: as frequências permaneceram próximas de 440 Hz, sem a queda de altura produzida por `playbackRate`. Um teste com canais de frequências distintas apresenta artefatos modestos de junção, portanto a qualidade sonora ainda requer avaliação auditiva.
- Chromium automatizado no AEROCOOL, execução do jogo com tradução PT-BR, alternando cerca de 45–51 ciclos/s. No teste WSOLA v2 de 30 segundos (3 janelas de 10 segundos), houve **zero underruns, zero descartes na ponte e zero erros JavaScript**; a taxa de reprodução foi 1,0×. Não é garantia para outros dispositivos ou cenas.
- Uma versão preliminar WSOLA v1 teve cortes e descartes; foi descartada e substituída por controle de fila mais responsivo.

### Limitações
É uma primeira implementação experimental de *time stretch*, não um mecanismo de emulação de áudio desacoplado. Pode ocorrer repetição/coloração em transientes, bateria e voz, e a música pode ter andamento reduzido em emulação lenta. O objetivo é evitar *picotes* sem mudar o tom do som. Uma solução definitiva exigirá aproximar a emulação dos 59,94 ciclos/s em todas as cenas, ou um processador em AudioWorklet com buffer circular e sincronização contínua, além de testes auditivos reais em PC e Android.

A recompilação PSX e o disco PT-BR permanecem os mesmos. Nenhum arquivo do jogo é armazenado no repositório.
