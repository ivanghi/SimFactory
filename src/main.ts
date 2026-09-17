import { WorldState } from './sim/world';

// Game loop: rAF + accumulator, 10 sim ticks/sec
let lastTime = 0;
const TICK_INTERVAL = 100; // 10 ticks per second

function gameLoop(timestamp: number) {
  if (!lastTime) lastTime = timestamp;
  const deltaTime = timestamp - lastTime;

  // Update game state based on delta time
  // This is a placeholder - actual implementation will come later
  
  requestAnimationFrame(gameLoop);
}

// Start the game loop
requestAnimationFrame(gameLoop);