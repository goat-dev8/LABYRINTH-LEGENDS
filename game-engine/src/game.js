/**
 * Labyrinth Legends - Main Game Class
 * Integrates maze generation, physics, rendering, and controls
 * Exposes lifecycle hooks for React integration
 */

import { MazeGenerator } from './maze.js';
import { PhysicsEngine } from './physics.js';
import { GameRenderer } from './renderer.js';
import { Controls } from './controls.js';

export class LabyrinthGame {
  constructor(container, options = {}) {
    this.container = container;
    
    // Options with defaults
    this.options = {
      difficulty: options.difficulty || 'medium',
      seed: options.seed || null,
      enableBloom: options.enableBloom !== false,
      enableSound: options.enableSound !== false,
      
      // Lifecycle callbacks
      onRunStart: options.onRunStart || (() => {}),
      onRunComplete: options.onRunComplete || (() => {}),
      onDeath: options.onDeath || (() => {}),
      onLevelProgress: options.onLevelProgress || (() => {}),
      onStateChange: options.onStateChange || (() => {})
    };

    // Game state
    this.state = {
      isRunning: false,
      isPaused: false,
      currentLevel: 1,
      timeMs: 0,
      deaths: 0,
      startTime: null,
      lastUpdateTime: null
    };

    // Run configuration (set when starting)
    this.runConfig = null;

    // Game components
    this.mazeGenerator = null;
    this.maze = null;
    this.physics = null;
    this.renderer = null;
    this.controls = null;

    // Timing
    this.gameLoopId = null;
    this.lastFrameTime = 0;
    this.fixedTimeStep = 1 / 60; // 60 FPS physics

    // Initialize
    this.init();
  }

  /**
   * Initialize game components
   */
  init() {
    // Get difficulty settings
    const settings = MazeGenerator.getDifficultySettings(this.options.difficulty);

    // Create maze generator
    this.mazeGenerator = new MazeGenerator({
      width: settings.width,
      height: settings.height,
      seed: this.options.seed
    });

    // Create physics engine
    this.physics = new PhysicsEngine({
      cellSize: 1,
      ballRadius: 0.15,
      maxSpeed: settings.ballSpeed / 5,
      forceMultiplier: settings.ballSpeed * 2,
      onCollision: (data) => this.handleCollision(data),
      onGoalReached: () => this.handleGoalReached()
    });

    // Create renderer
    this.renderer = new GameRenderer(this.container, {
      cellSize: 1,
      enableBloom: this.options.enableBloom
    });

    // Create controls
    this.controls = new Controls({
      sensitivity: 1,
      deadzone: 0.1,
      onInputChange: (input) => this.handleInput(input)
    });

    // Generate initial maze
    this.generateMaze();
  }

  /**
   * Generate a new maze
   */
  generateMaze(seed = null) {
    if (seed) {
      this.mazeGenerator.seed = typeof seed === 'string' 
        ? this.hashString(seed) 
        : seed;
      this.mazeGenerator.rng = new (class {
        constructor(s) { this.seed = s; this.m = 0x80000000; this.a = 1103515245; this.c = 12345; this.state = s; }
        next() { this.state = (this.a * this.state + this.c) % this.m; return this.state / (this.m - 1); }
        nextInt(min, max) { return Math.floor(this.next() * (max - min + 1)) + min; }
      })(this.mazeGenerator.seed);
    }

    this.maze = this.mazeGenerator.generate();
    this.physics.init(this.maze);
    this.renderer.buildMaze(this.maze);

    return this.maze;
  }

  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  /**
   * Start a new run
   */
  start(runConfig = {}) {
    this.runConfig = {
      mode: runConfig.mode || 'Practice',
      tournamentId: runConfig.tournamentId || null,
      username: runConfig.username || 'Anonymous',
      walletAddress: runConfig.walletAddress || null
    };

    // Reset state
    this.state = {
      isRunning: true,
      isPaused: false,
      currentLevel: 1,
      timeMs: 0,
      deaths: 0,
      startTime: Date.now(),
      lastUpdateTime: Date.now()
    };

    // Enable controls
    this.controls.enable(this.container);

    // Notify start
    this.options.onRunStart(this.runConfig);
    this.emitStateChange();

    // Start game loop
    this.startGameLoop();

    console.log('🎮 Game started:', this.runConfig);
  }

  /**
   * Pause the game
   */
  pause() {
    if (!this.state.isRunning || this.state.isPaused) return;
    
    this.state.isPaused = true;
    this.controls.disable();
    this.emitStateChange();
    
    console.log('⏸️ Game paused');
  }

  /**
   * Resume the game
   */
  resume() {
    if (!this.state.isRunning || !this.state.isPaused) return;
    
    this.state.isPaused = false;
    this.state.lastUpdateTime = Date.now();
    this.controls.enable(this.container);
    this.emitStateChange();
    
    console.log('▶️ Game resumed');
  }

  /**
   * Stop the game
   */
  stop() {
    this.state.isRunning = false;
    this.state.isPaused = false;
    this.stopGameLoop();
    this.controls.disable();
    this.emitStateChange();
    
    console.log('🛑 Game stopped');
  }

  /**
   * Handle input from controls
   */
  handleInput(input) {
    if (!this.state.isRunning || this.state.isPaused) return;
    
    // Apply control force to physics (y is inverted for 3D space)
    this.physics.applyControl(input.x, input.y);
  }

  /**
   * Handle wall collision
   */
  handleCollision(data) {
    // Play collision sound/effect
    // Could emit event for sound system
  }

  /**
   * Handle reaching the goal
   */
  handleGoalReached() {
    if (!this.state.isRunning) return;

    console.log('🎯 Goal reached! Level:', this.state.currentLevel);

    // Play victory effect
    this.renderer.playVictoryEffect();

    // Calculate final time
    const finalTimeMs = Date.now() - this.state.startTime;
    this.state.timeMs = finalTimeMs;

    // Create run result
    const result = {
      runId: crypto.randomUUID(),
      mode: this.runConfig.mode,
      tournamentId: this.runConfig.tournamentId,
      username: this.runConfig.username,
      walletAddress: this.runConfig.walletAddress,
      level: this.state.currentLevel,
      timeMs: finalTimeMs,
      completed: true,
      deaths: this.state.deaths,
      difficulty: this.options.difficulty,
      mazeSeed: this.maze.seed,
      startedAt: this.state.startTime,
      finishedAt: Date.now()
    };

    // Stop the game
    this.stop();

    // Notify completion
    this.options.onRunComplete(result);

    console.log('✅ Run complete:', result);
  }

  /**
   * Handle player death (e.g., falling off)
   */
  handleDeath() {
    if (!this.state.isRunning) return;

    this.state.deaths++;
    
    // Play death effect
    this.renderer.playDeathEffect();

    // Reset ball position
    this.physics.reset(this.maze);

    // Notify death
    this.options.onDeath();
    this.emitStateChange();

    console.log('💀 Death #' + this.state.deaths);
  }

  /**
   * Start game loop
   */
  startGameLoop() {
    this.lastFrameTime = performance.now();

    const loop = () => {
      if (!this.state.isRunning) return;

      this.gameLoopId = requestAnimationFrame(loop);

      const now = performance.now();
      const deltaTime = (now - this.lastFrameTime) / 1000;
      this.lastFrameTime = now;

      if (!this.state.isPaused) {
        this.update(deltaTime);
      }
    };

    // Start renderer loop
    this.renderer.startRenderLoop();
    
    // Start game loop
    loop();
  }

  /**
   * Stop game loop
   */
  stopGameLoop() {
    if (this.gameLoopId) {
      cancelAnimationFrame(this.gameLoopId);
      this.gameLoopId = null;
    }
    this.renderer.stopRenderLoop();
  }

  /**
   * Update game state
   */
  update(deltaTime) {
    // Clamp delta time to prevent physics explosion
    const dt = Math.min(deltaTime, this.fixedTimeStep * 3);

    // Update physics
    this.physics.update(dt);

    // Get ball state
    const ballState = this.physics.getBallState();

    // Update renderer
    if (ballState) {
      this.renderer.updateBall(ballState.x, ballState.y, ballState.speed);
    }

    // Update time
    this.state.timeMs = Date.now() - this.state.startTime;

    // Emit progress periodically (every 100ms)
    if (Date.now() - this.state.lastUpdateTime > 100) {
      this.state.lastUpdateTime = Date.now();
      this.options.onLevelProgress(this.state.currentLevel, this.state.timeMs);
    }
  }

  /**
   * Emit state change event
   */
  emitStateChange() {
    this.options.onStateChange({
      isRunning: this.state.isRunning,
      isPaused: this.state.isPaused,
      currentLevel: this.state.currentLevel,
      timeMs: this.state.timeMs,
      deaths: this.state.deaths
    });
  }

  /**
   * Get current game state
   */
  getState() {
    return { ...this.state };
  }

  /**
   * Get run configuration
   */
  getRunConfig() {
    return this.runConfig ? { ...this.runConfig } : null;
  }

  /**
   * Set difficulty
   */
  setDifficulty(difficulty) {
    this.options.difficulty = difficulty;
    const settings = MazeGenerator.getDifficultySettings(difficulty);
    
    this.mazeGenerator.width = settings.width;
    this.mazeGenerator.height = settings.height;
    this.physics.maxSpeed = settings.ballSpeed / 5;
    this.physics.forceMultiplier = settings.ballSpeed * 2;
  }

  /**
   * Set maze seed
   */
  setSeed(seed) {
    this.options.seed = seed;
  }

  /**
   * Regenerate maze with current settings
   */
  regenerate() {
    if (this.state.isRunning) {
      this.stop();
    }
    this.generateMaze(this.options.seed);
  }

  /**
   * Cleanup
   */
  destroy() {
    this.stop();
    this.controls.disable();
    this.renderer.dispose();
    
    this.mazeGenerator = null;
    this.maze = null;
    this.physics = null;
    this.renderer = null;
    this.controls = null;

    console.log('🧹 Game destroyed');
  }
}
