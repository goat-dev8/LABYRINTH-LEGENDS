/**
 * Input Controls Handler
 * Supports keyboard, touch, and device orientation
 */

export class Controls {
  constructor(options = {}) {
    this.sensitivity = options.sensitivity || 1;
    this.deadzone = options.deadzone || 0.1;
    
    // Current input state
    this.input = { x: 0, y: 0 };
    
    // Active input method
    this.inputMethod = 'keyboard';
    
    // Key states
    this.keys = {
      up: false,
      down: false,
      left: false,
      right: false
    };
    
    // Touch state
    this.touchStart = null;
    this.touchCurrent = null;
    
    // Device orientation
    this.orientation = { beta: 0, gamma: 0 };
    this.orientationCalibration = null;
    
    // Callbacks
    this.onInputChange = options.onInputChange || (() => {});
    
    // Bound handlers for cleanup
    this.boundHandlers = {};
    
    this.enabled = false;
  }

  /**
   * Enable controls
   */
  enable(element = window) {
    if (this.enabled) return;
    this.enabled = true;
    this.element = element;

    // Keyboard
    this.boundHandlers.keydown = (e) => this.handleKeyDown(e);
    this.boundHandlers.keyup = (e) => this.handleKeyUp(e);
    window.addEventListener('keydown', this.boundHandlers.keydown);
    window.addEventListener('keyup', this.boundHandlers.keyup);

    // Touch
    this.boundHandlers.touchstart = (e) => this.handleTouchStart(e);
    this.boundHandlers.touchmove = (e) => this.handleTouchMove(e);
    this.boundHandlers.touchend = (e) => this.handleTouchEnd(e);
    element.addEventListener('touchstart', this.boundHandlers.touchstart, { passive: false });
    element.addEventListener('touchmove', this.boundHandlers.touchmove, { passive: false });
    element.addEventListener('touchend', this.boundHandlers.touchend);

    // Device orientation (mobile tilt)
    if (window.DeviceOrientationEvent) {
      this.boundHandlers.orientation = (e) => this.handleOrientation(e);
      window.addEventListener('deviceorientation', this.boundHandlers.orientation);
    }
  }

  /**
   * Disable controls
   */
  disable() {
    if (!this.enabled) return;
    this.enabled = false;

    window.removeEventListener('keydown', this.boundHandlers.keydown);
    window.removeEventListener('keyup', this.boundHandlers.keyup);
    
    if (this.element) {
      this.element.removeEventListener('touchstart', this.boundHandlers.touchstart);
      this.element.removeEventListener('touchmove', this.boundHandlers.touchmove);
      this.element.removeEventListener('touchend', this.boundHandlers.touchend);
    }

    if (this.boundHandlers.orientation) {
      window.removeEventListener('deviceorientation', this.boundHandlers.orientation);
    }

    this.reset();
  }

  /**
   * Reset input state
   */
  reset() {
    this.input = { x: 0, y: 0 };
    this.keys = { up: false, down: false, left: false, right: false };
    this.touchStart = null;
    this.touchCurrent = null;
  }

  // ========== Keyboard ==========

  handleKeyDown(e) {
    let handled = true;
    
    switch (e.code) {
      case 'ArrowUp':
      case 'KeyW':
        this.keys.up = true;
        break;
      case 'ArrowDown':
      case 'KeyS':
        this.keys.down = true;
        break;
      case 'ArrowLeft':
      case 'KeyA':
        this.keys.left = true;
        break;
      case 'ArrowRight':
      case 'KeyD':
        this.keys.right = true;
        break;
      default:
        handled = false;
    }

    if (handled) {
      e.preventDefault();
      this.inputMethod = 'keyboard';
      this.updateFromKeys();
    }
  }

  handleKeyUp(e) {
    switch (e.code) {
      case 'ArrowUp':
      case 'KeyW':
        this.keys.up = false;
        break;
      case 'ArrowDown':
      case 'KeyS':
        this.keys.down = false;
        break;
      case 'ArrowLeft':
      case 'KeyA':
        this.keys.left = false;
        break;
      case 'ArrowRight':
      case 'KeyD':
        this.keys.right = false;
        break;
    }
    
    this.updateFromKeys();
  }

  updateFromKeys() {
    let x = 0;
    let y = 0;

    if (this.keys.left) x -= 1;
    if (this.keys.right) x += 1;
    if (this.keys.up) y -= 1;
    if (this.keys.down) y += 1;

    // Normalize diagonal movement
    if (x !== 0 && y !== 0) {
      const len = Math.sqrt(x * x + y * y);
      x /= len;
      y /= len;
    }

    this.input.x = x * this.sensitivity;
    this.input.y = y * this.sensitivity;
    
    this.onInputChange(this.input);
  }

  // ========== Touch ==========

  handleTouchStart(e) {
    e.preventDefault();
    
    const touch = e.touches[0];
    this.touchStart = { x: touch.clientX, y: touch.clientY };
    this.touchCurrent = { ...this.touchStart };
    this.inputMethod = 'touch';
  }

  handleTouchMove(e) {
    e.preventDefault();
    
    if (!this.touchStart) return;
    
    const touch = e.touches[0];
    this.touchCurrent = { x: touch.clientX, y: touch.clientY };
    
    // Calculate delta from start
    const dx = this.touchCurrent.x - this.touchStart.x;
    const dy = this.touchCurrent.y - this.touchStart.y;
    
    // Max touch distance for full input
    const maxDist = 100;
    
    let x = Math.max(-1, Math.min(1, dx / maxDist));
    let y = Math.max(-1, Math.min(1, dy / maxDist));
    
    // Apply deadzone
    if (Math.abs(x) < this.deadzone) x = 0;
    if (Math.abs(y) < this.deadzone) y = 0;
    
    this.input.x = x * this.sensitivity;
    this.input.y = y * this.sensitivity;
    
    this.onInputChange(this.input);
  }

  handleTouchEnd(e) {
    this.touchStart = null;
    this.touchCurrent = null;
    this.input = { x: 0, y: 0 };
    this.onInputChange(this.input);
  }

  // ========== Device Orientation ==========

  handleOrientation(e) {
    if (this.inputMethod !== 'tilt') return;
    
    // Get orientation values
    // beta: front-back tilt (-180 to 180)
    // gamma: left-right tilt (-90 to 90)
    const { beta, gamma } = e;
    
    if (beta === null || gamma === null) return;
    
    // Calibrate if needed
    if (!this.orientationCalibration) {
      this.calibrateOrientation(beta, gamma);
      return;
    }
    
    // Calculate delta from calibration
    let x = (gamma - this.orientationCalibration.gamma) / 30;
    let y = (beta - this.orientationCalibration.beta) / 30;
    
    // Clamp
    x = Math.max(-1, Math.min(1, x));
    y = Math.max(-1, Math.min(1, y));
    
    // Apply deadzone
    if (Math.abs(x) < this.deadzone) x = 0;
    if (Math.abs(y) < this.deadzone) y = 0;
    
    this.input.x = x * this.sensitivity;
    this.input.y = y * this.sensitivity;
    
    this.onInputChange(this.input);
  }

  calibrateOrientation(beta = 0, gamma = 0) {
    this.orientationCalibration = { beta, gamma };
  }

  /**
   * Enable tilt controls
   */
  enableTilt() {
    this.inputMethod = 'tilt';
    this.orientationCalibration = null;
    
    // Request permission on iOS 13+
    if (typeof DeviceOrientationEvent !== 'undefined' && 
        typeof DeviceOrientationEvent.requestPermission === 'function') {
      DeviceOrientationEvent.requestPermission()
        .then(permission => {
          if (permission === 'granted') {
            console.log('Device orientation permission granted');
          }
        })
        .catch(console.error);
    }
  }

  /**
   * Get current input state
   */
  getInput() {
    return { ...this.input };
  }

  /**
   * Get input method
   */
  getInputMethod() {
    return this.inputMethod;
  }
}
