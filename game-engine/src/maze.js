/**
 * Maze Generator
 * Based on Astray's maze generation algorithm with seeded random
 * Uses recursive backtracking (depth-first search)
 */

// Seeded random number generator for reproducible mazes
class SeededRandom {
  constructor(seed) {
    this.seed = seed || Date.now();
    this.m = 0x80000000;
    this.a = 1103515245;
    this.c = 12345;
    this.state = this.seed;
  }

  next() {
    this.state = (this.a * this.state + this.c) % this.m;
    return this.state / (this.m - 1);
  }

  nextInt(min, max) {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }
}

// Hash string to number for seed
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

export class MazeGenerator {
  constructor(options = {}) {
    this.width = options.width || 10;
    this.height = options.height || 10;
    this.seed = options.seed ? hashString(options.seed.toString()) : Date.now();
    this.rng = new SeededRandom(this.seed);
    this.grid = [];
    this.walls = [];
  }

  /**
   * Generate maze using recursive backtracking
   * Returns object with cells, walls, start, and end positions
   */
  generate() {
    // Initialize grid
    this.grid = [];
    for (let y = 0; y < this.height; y++) {
      this.grid[y] = [];
      for (let x = 0; x < this.width; x++) {
        this.grid[y][x] = {
          x,
          y,
          visited: false,
          walls: { north: true, south: true, east: true, west: true }
        };
      }
    }

    // Start from random cell
    const startX = this.rng.nextInt(0, this.width - 1);
    const startY = this.rng.nextInt(0, this.height - 1);
    
    // Generate maze using recursive backtracking
    this.carve(startX, startY);

    // Find start (top-left area) and end (bottom-right area)
    const start = { x: 0, y: 0 };
    const end = { x: this.width - 1, y: this.height - 1 };

    // Build wall segments for physics/rendering
    this.walls = this.buildWalls();

    return {
      grid: this.grid,
      walls: this.walls,
      start,
      end,
      width: this.width,
      height: this.height,
      seed: this.seed
    };
  }

  carve(x, y) {
    const cell = this.grid[y][x];
    cell.visited = true;

    // Get unvisited neighbors in random order
    const directions = this.shuffle([
      { dx: 0, dy: -1, wall: 'north', opposite: 'south' },
      { dx: 0, dy: 1, wall: 'south', opposite: 'north' },
      { dx: 1, dy: 0, wall: 'east', opposite: 'west' },
      { dx: -1, dy: 0, wall: 'west', opposite: 'east' }
    ]);

    for (const dir of directions) {
      const nx = x + dir.dx;
      const ny = y + dir.dy;

      if (this.isValid(nx, ny) && !this.grid[ny][nx].visited) {
        // Remove walls between current and next cell
        cell.walls[dir.wall] = false;
        this.grid[ny][nx].walls[dir.opposite] = false;

        // Recursively carve from next cell
        this.carve(nx, ny);
      }
    }
  }

  isValid(x, y) {
    return x >= 0 && x < this.width && y >= 0 && y < this.height;
  }

  shuffle(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = this.rng.nextInt(0, i);
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  buildWalls() {
    const walls = [];
    const cellSize = 1;
    const wallThickness = 0.1;

    // Outer walls
    // Top
    walls.push({
      x: this.width * cellSize / 2,
      y: 0,
      width: this.width * cellSize + wallThickness * 2,
      height: wallThickness,
      type: 'outer'
    });
    // Bottom
    walls.push({
      x: this.width * cellSize / 2,
      y: this.height * cellSize,
      width: this.width * cellSize + wallThickness * 2,
      height: wallThickness,
      type: 'outer'
    });
    // Left
    walls.push({
      x: 0,
      y: this.height * cellSize / 2,
      width: wallThickness,
      height: this.height * cellSize,
      type: 'outer'
    });
    // Right
    walls.push({
      x: this.width * cellSize,
      y: this.height * cellSize / 2,
      width: wallThickness,
      height: this.height * cellSize,
      type: 'outer'
    });

    // Inner walls based on grid
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const cell = this.grid[y][x];
        const cx = x * cellSize + cellSize / 2;
        const cy = y * cellSize + cellSize / 2;

        // Add south wall if present (avoid duplicates)
        if (cell.walls.south && y < this.height - 1) {
          walls.push({
            x: cx,
            y: (y + 1) * cellSize,
            width: cellSize,
            height: wallThickness,
            type: 'inner'
          });
        }

        // Add east wall if present (avoid duplicates)
        if (cell.walls.east && x < this.width - 1) {
          walls.push({
            x: (x + 1) * cellSize,
            y: cy,
            width: wallThickness,
            height: cellSize,
            type: 'inner'
          });
        }
      }
    }

    return walls;
  }

  /**
   * Get difficulty settings
   */
  static getDifficultySettings(difficulty) {
    const settings = {
      easy: { width: 6, height: 6, ballSpeed: 15 },
      medium: { width: 10, height: 10, ballSpeed: 20 },
      hard: { width: 15, height: 15, ballSpeed: 25 },
      nightmare: { width: 20, height: 20, ballSpeed: 30 }
    };
    return settings[difficulty.toLowerCase()] || settings.medium;
  }
}
