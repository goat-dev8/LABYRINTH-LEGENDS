/**
 * Labyrinth Legends - Deterministic Maze Generator
 * Uses seeded random for tournament fairness and anti-cheat
 */

// ═══════════════════════════════════════════════════════════════
// SEEDED RANDOM NUMBER GENERATOR
// Same seed = same maze = tournament fairness
// ═══════════════════════════════════════════════════════════════

class SeededRandom {
    constructor(seed) {
        this.seed = seed || Date.now();
        this.m = 0x80000000; // 2^31
        this.a = 1103515245;
        this.c = 12345;
        this.state = this.seed;
    }

    // Get next random number [0, 1)
    next() {
        this.state = (this.a * this.state + this.c) % this.m;
        return this.state / (this.m - 1);
    }

    // Get random integer in range [min, max] inclusive
    nextInt(min, max) {
        return Math.floor(this.next() * (max - min + 1)) + min;
    }
}

// Hash string to numeric seed for deterministic RNG
function hashStringToSeed(str) {
    if (!str) return Date.now();
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
}

// Global seeded RNG instance (set before maze generation)
var mazeRng = new SeededRandom(Date.now());
var currentMazeSeed = null;

// Set maze seed (called from game before generating maze)
function setMazeSeed(seed) {
    currentMazeSeed = seed;
    const numericSeed = typeof seed === 'string' ? hashStringToSeed(seed) : seed;
    mazeRng = new SeededRandom(numericSeed);
    console.log('🌱 Maze seed set:', seed, '→ numeric:', numericSeed);
}

// Get current maze seed
function getMazeSeed() {
    return currentMazeSeed;
}

// ═══════════════════════════════════════════════════════════════
// MAZE GENERATION (Recursive Backtracking with Seeded Random)
// ═══════════════════════════════════════════════════════════════

function generateSquareMaze(dimension, seed) {
    // Optionally set seed if provided
    if (seed !== undefined) {
        setMazeSeed(seed);
    }

    function iterate(field, x, y) {
        field[x][y] = false;
        while(true) {
            var directions = [];
            if(x > 1 && field[x-2][y] == true) {
                directions.push([-1, 0]);
            }
            if(x < field.dimension - 2 && field[x+2][y] == true) {
                directions.push([1, 0]);
            }
            if(y > 1 && field[x][y-2] == true) {
                directions.push([0, -1]);
            }
            if(y < field.dimension - 2 && field[x][y+2] == true) {
                directions.push([0, 1]);
            }
            if(directions.length == 0) {
                return field;
            }
            // USE SEEDED RANDOM instead of Math.random()
            var dir = directions[mazeRng.nextInt(0, directions.length - 1)];
            field[x+dir[0]][y+dir[1]] = false;
            field = iterate(field, x+dir[0]*2, y+dir[1]*2);
        }
    }

    // Initialize the field
    var field = new Array(dimension);
    field.dimension = dimension;
    for(var i = 0; i < dimension; i++) {
        field[i] = new Array(dimension);
        for (var j = 0; j < dimension; j++) {
            field[i][j] = true;
        }
    }

    // Generate the maze recursively
    field = iterate(field, 1, 1);
    
    // Store the seed used for this maze
    field.seed = currentMazeSeed;
    
    return field;
}


