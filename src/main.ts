// Game loop: rAF + accumulator, 10 sim ticks/sec
// Sim integration (accumulator, speed multiplier) arrives with the render/UI tasks.
function gameLoop(_timestamp: number) {
  requestAnimationFrame(gameLoop);
}

// Start the game loop
requestAnimationFrame(gameLoop);