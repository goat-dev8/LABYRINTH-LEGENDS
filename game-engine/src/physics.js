/**
 * Physics Engine using Box2D-lite implementation
 * Simplified 2D physics for maze ball movement
 */

// Simple 2D Vector class
class Vec2 {
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }

  add(v) {
    return new Vec2(this.x + v.x, this.y + v.y);
  }

  sub(v) {
    return new Vec2(this.x - v.x, this.y - v.y);
  }

  mul(s) {
    return new Vec2(this.x * s, this.y * s);
  }

  dot(v) {
    return this.x * v.x + this.y * v.y;
  }

  length() {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }

  normalize() {
    const len = this.length();
    if (len > 0) {
      return new Vec2(this.x / len, this.y / len);
    }
    return new Vec2();
  }

  clone() {
    return new Vec2(this.x, this.y);
  }
}

// Simple AABB for collision
class AABB {
  constructor(minX, minY, maxX, maxY) {
    this.min = new Vec2(minX, minY);
    this.max = new Vec2(maxX, maxY);
  }

  intersects(other) {
    return !(
      this.max.x < other.min.x ||
      this.min.x > other.max.x ||
      this.max.y < other.min.y ||
      this.min.y > other.max.y
    );
  }

  contains(point) {
    return (
      point.x >= this.min.x &&
      point.x <= this.max.x &&
      point.y >= this.min.y &&
      point.y <= this.max.y
    );
  }
}

// Circle body for the ball
class CircleBody {
  constructor(x, y, radius, mass = 1) {
    this.position = new Vec2(x, y);
    this.velocity = new Vec2();
    this.acceleration = new Vec2();
    this.radius = radius;
    this.mass = mass;
    this.restitution = 0.3; // Bounciness
    this.friction = 0.98;   // Velocity damping
  }

  applyForce(force) {
    const a = force.mul(1 / this.mass);
    this.acceleration = this.acceleration.add(a);
  }

  update(dt) {
    // Apply acceleration to velocity
    this.velocity = this.velocity.add(this.acceleration.mul(dt));
    
    // Apply friction
    this.velocity = this.velocity.mul(this.friction);
    
    // Apply velocity to position
    this.position = this.position.add(this.velocity.mul(dt));
    
    // Reset acceleration
    this.acceleration = new Vec2();
  }

  getBounds() {
    return new AABB(
      this.position.x - this.radius,
      this.position.y - this.radius,
      this.position.x + this.radius,
      this.position.y + this.radius
    );
  }
}

// Static box for walls
class BoxBody {
  constructor(x, y, width, height) {
    this.position = new Vec2(x, y);
    this.width = width;
    this.height = height;
    this.isStatic = true;
  }

  getBounds() {
    return new AABB(
      this.position.x - this.width / 2,
      this.position.y - this.height / 2,
      this.position.x + this.width / 2,
      this.position.y + this.height / 2
    );
  }
}

export class PhysicsEngine {
  constructor(options = {}) {
    this.gravity = new Vec2(0, 0); // No gravity for top-down maze
    this.bodies = [];
    this.walls = [];
    this.ball = null;
    this.cellSize = options.cellSize || 1;
    this.ballRadius = options.ballRadius || 0.15;
    this.maxSpeed = options.maxSpeed || 5;
    this.forceMultiplier = options.forceMultiplier || 50;
    
    this.onCollision = options.onCollision || (() => {});
    this.onGoalReached = options.onGoalReached || (() => {});
    
    this.goalPosition = null;
    this.goalRadius = 0.3;
  }

  /**
   * Initialize physics world with maze
   */
  init(maze) {
    this.bodies = [];
    this.walls = [];

    // Create walls from maze data
    for (const wall of maze.walls) {
      const body = new BoxBody(wall.x, wall.y, wall.width, wall.height);
      this.walls.push(body);
      this.bodies.push(body);
    }

    // Create ball at start position
    const startX = maze.start.x * this.cellSize + this.cellSize / 2;
    const startY = maze.start.y * this.cellSize + this.cellSize / 2;
    this.ball = new CircleBody(startX, startY, this.ballRadius);
    this.bodies.push(this.ball);

    // Set goal position
    this.goalPosition = new Vec2(
      maze.end.x * this.cellSize + this.cellSize / 2,
      maze.end.y * this.cellSize + this.cellSize / 2
    );

    return this.ball;
  }

  /**
   * Apply control force to ball
   */
  applyControl(dx, dy) {
    if (!this.ball) return;
    
    const force = new Vec2(dx, dy).mul(this.forceMultiplier);
    this.ball.applyForce(force);
  }

  /**
   * Update physics simulation
   */
  update(dt) {
    if (!this.ball) return;

    // Apply gravity (if any)
    this.ball.applyForce(this.gravity.mul(this.ball.mass));

    // Update ball position
    this.ball.update(dt);

    // Clamp velocity to max speed
    const speed = this.ball.velocity.length();
    if (speed > this.maxSpeed) {
      this.ball.velocity = this.ball.velocity.normalize().mul(this.maxSpeed);
    }

    // Check wall collisions
    this.resolveCollisions();

    // Check goal
    this.checkGoal();

    return {
      x: this.ball.position.x,
      y: this.ball.position.y,
      vx: this.ball.velocity.x,
      vy: this.ball.velocity.y
    };
  }

  resolveCollisions() {
    const ballBounds = this.ball.getBounds();

    for (const wall of this.walls) {
      const wallBounds = wall.getBounds();

      if (!ballBounds.intersects(wallBounds)) continue;

      // Calculate penetration depth and normal
      const overlapX = Math.min(
        ballBounds.max.x - wallBounds.min.x,
        wallBounds.max.x - ballBounds.min.x
      );
      const overlapY = Math.min(
        ballBounds.max.y - wallBounds.min.y,
        wallBounds.max.y - ballBounds.min.y
      );

      // Resolve along axis with smallest overlap
      if (overlapX < overlapY) {
        // Horizontal collision
        if (this.ball.position.x < wall.position.x) {
          this.ball.position.x -= overlapX;
        } else {
          this.ball.position.x += overlapX;
        }
        this.ball.velocity.x *= -this.ball.restitution;
        this.onCollision({ type: 'wall', axis: 'x' });
      } else {
        // Vertical collision
        if (this.ball.position.y < wall.position.y) {
          this.ball.position.y -= overlapY;
        } else {
          this.ball.position.y += overlapY;
        }
        this.ball.velocity.y *= -this.ball.restitution;
        this.onCollision({ type: 'wall', axis: 'y' });
      }
    }
  }

  checkGoal() {
    if (!this.goalPosition) return;

    const dist = this.ball.position.sub(this.goalPosition).length();
    if (dist < this.ballRadius + this.goalRadius) {
      this.onGoalReached();
    }
  }

  /**
   * Reset ball to start position
   */
  reset(maze) {
    if (!this.ball) return;
    
    const startX = maze.start.x * this.cellSize + this.cellSize / 2;
    const startY = maze.start.y * this.cellSize + this.cellSize / 2;
    
    this.ball.position = new Vec2(startX, startY);
    this.ball.velocity = new Vec2();
    this.ball.acceleration = new Vec2();
  }

  /**
   * Get ball state for rendering
   */
  getBallState() {
    if (!this.ball) return null;
    
    return {
      x: this.ball.position.x,
      y: this.ball.position.y,
      radius: this.ball.radius,
      vx: this.ball.velocity.x,
      vy: this.ball.velocity.y,
      speed: this.ball.velocity.length()
    };
  }

  /**
   * Get goal state for rendering
   */
  getGoalState() {
    if (!this.goalPosition) return null;
    
    return {
      x: this.goalPosition.x,
      y: this.goalPosition.y,
      radius: this.goalRadius
    };
  }
}
