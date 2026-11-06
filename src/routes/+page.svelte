<script lang="ts">
  import { onMount } from 'svelte';
  import { createGame, type GameHandle } from '../game/game';

  let canvas: HTMLCanvasElement | undefined = undefined;
  let game: GameHandle | undefined = undefined;

  onMount(() => {
    if (!canvas) return;
    game = createGame(canvas, { seed: 1 });
    return () => game?.dispose();
  });
</script>

<main>
  <canvas bind:this={canvas}></canvas>
</main>

<style>
  main {
    position: fixed;
    inset: 0;
    display: block;
  }

  canvas {
    display: block;
    width: 100%;
    height: 100%;
    touch-action: none;
  }
</style>
