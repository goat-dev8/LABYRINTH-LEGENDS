/**
 * Game Renderer using Three.js
 * Premium visuals with post-processing effects
 */

import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

// Color palette
const COLORS = {
  background: 0x0a0a0f,
  wall: 0x1a1a2e,
  wallEmissive: 0x16213e,
  floor: 0x0f0f23,
  floorEmissive: 0x0a1628,
  player: 0x00ff88,
  playerEmissive: 0x00ff88,
  goal: 0x00d4ff,
  goalEmissive: 0x00d4ff,
  ambient: 0x404080,
  directional: 0xffffff
};

export class GameRenderer {
  constructor(container, options = {}) {
    this.container = container;
    this.width = options.width || container.clientWidth;
    this.height = options.height || container.clientHeight;
    this.cellSize = options.cellSize || 1;
    this.enableBloom = options.enableBloom !== false;
    
    // Three.js components
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.composer = null;
    
    // Game objects
    this.wallMeshes = [];
    this.floorMesh = null;
    this.ballMesh = null;
    this.ballLight = null;
    this.goalMesh = null;
    this.goalLight = null;
    
    // Animation
    this.clock = new THREE.Clock();
    this.animationId = null;
    
    this.init();
  }

  init() {
    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(COLORS.background);
    this.scene.fog = new THREE.Fog(COLORS.background, 10, 50);

    // Camera (top-down perspective)
    this.camera = new THREE.PerspectiveCamera(
      60,
      this.width / this.height,
      0.1,
      100
    );
    this.camera.position.set(0, 15, 0);
    this.camera.lookAt(0, 0, 0);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    this.container.appendChild(this.renderer.domElement);

    // Post-processing
    this.setupPostProcessing();

    // Lighting
    this.setupLighting();

    // Handle resize
    window.addEventListener('resize', () => this.onResize());
  }

  setupPostProcessing() {
    this.composer = new EffectComposer(this.renderer);

    // Render pass
    const renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(renderPass);

    // Bloom pass for neon glow
    if (this.enableBloom) {
      const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(this.width, this.height),
        1.2,    // strength
        0.4,    // radius
        0.85    // threshold
      );
      this.composer.addPass(bloomPass);
    }

    // Output pass
    const outputPass = new OutputPass();
    this.composer.addPass(outputPass);
  }

  setupLighting() {
    // Ambient light
    const ambient = new THREE.AmbientLight(COLORS.ambient, 0.3);
    this.scene.add(ambient);

    // Main directional light
    const directional = new THREE.DirectionalLight(COLORS.directional, 0.5);
    directional.position.set(5, 10, 5);
    directional.castShadow = true;
    directional.shadow.mapSize.width = 2048;
    directional.shadow.mapSize.height = 2048;
    directional.shadow.camera.near = 0.1;
    directional.shadow.camera.far = 50;
    directional.shadow.camera.left = -20;
    directional.shadow.camera.right = 20;
    directional.shadow.camera.top = 20;
    directional.shadow.camera.bottom = -20;
    this.scene.add(directional);

    // Hemisphere light for soft fill
    const hemisphere = new THREE.HemisphereLight(0x8080ff, 0x080820, 0.3);
    this.scene.add(hemisphere);
  }

  /**
   * Build maze geometry
   */
  buildMaze(maze) {
    // Clear existing meshes
    this.clearMaze();

    const { width, height, walls } = maze;

    // Create floor
    this.createFloor(width, height);

    // Create walls
    for (const wall of walls) {
      this.createWall(wall);
    }

    // Create goal
    this.createGoal(maze.end);

    // Create ball
    this.createBall(maze.start);

    // Center camera
    this.centerCamera(width, height);
  }

  createFloor(width, height) {
    const geometry = new THREE.PlaneGeometry(
      width * this.cellSize + 2,
      height * this.cellSize + 2
    );
    
    const material = new THREE.MeshStandardMaterial({
      color: COLORS.floor,
      emissive: COLORS.floorEmissive,
      emissiveIntensity: 0.05,
      roughness: 0.9,
      metalness: 0.1
    });

    this.floorMesh = new THREE.Mesh(geometry, material);
    this.floorMesh.rotation.x = -Math.PI / 2;
    this.floorMesh.position.set(
      width * this.cellSize / 2,
      -0.1,
      height * this.cellSize / 2
    );
    this.floorMesh.receiveShadow = true;
    this.scene.add(this.floorMesh);

    // Add grid lines for visual effect
    const gridHelper = new THREE.GridHelper(
      Math.max(width, height) * this.cellSize + 2,
      Math.max(width, height),
      0x1a1a2e,
      0x0f0f1a
    );
    gridHelper.position.set(
      width * this.cellSize / 2,
      0.01,
      height * this.cellSize / 2
    );
    gridHelper.material.opacity = 0.3;
    gridHelper.material.transparent = true;
    this.scene.add(gridHelper);
  }

  createWall(wall) {
    const geometry = new THREE.BoxGeometry(
      wall.width + 0.05,
      0.5,
      wall.height + 0.05
    );

    const material = new THREE.MeshStandardMaterial({
      color: COLORS.wall,
      emissive: COLORS.wallEmissive,
      emissiveIntensity: 0.1,
      roughness: 0.7,
      metalness: 0.3
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(wall.x, 0.25, wall.y);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    this.wallMeshes.push(mesh);

    // Add edge glow
    const edgeGeometry = new THREE.EdgesGeometry(geometry);
    const edgeMaterial = new THREE.LineBasicMaterial({
      color: 0x2a2a4e,
      transparent: true,
      opacity: 0.5
    });
    const edges = new THREE.LineSegments(edgeGeometry, edgeMaterial);
    mesh.add(edges);
  }

  createBall(start) {
    const geometry = new THREE.SphereGeometry(0.15, 32, 32);
    
    const material = new THREE.MeshStandardMaterial({
      color: COLORS.player,
      emissive: COLORS.playerEmissive,
      emissiveIntensity: 2,
      roughness: 0.2,
      metalness: 0.8,
      transparent: true,
      opacity: 0.95
    });

    this.ballMesh = new THREE.Mesh(geometry, material);
    this.ballMesh.position.set(
      start.x * this.cellSize + this.cellSize / 2,
      0.15,
      start.y * this.cellSize + this.cellSize / 2
    );
    this.ballMesh.castShadow = true;
    this.scene.add(this.ballMesh);

    // Add point light to ball
    this.ballLight = new THREE.PointLight(COLORS.player, 2, 8);
    this.ballLight.position.copy(this.ballMesh.position);
    this.ballLight.position.y = 0.5;
    this.scene.add(this.ballLight);

    // Add glow ring
    const ringGeometry = new THREE.RingGeometry(0.12, 0.18, 32);
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: COLORS.player,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide
    });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.01;
    this.ballMesh.add(ring);
  }

  createGoal(end) {
    // Goal platform
    const platformGeometry = new THREE.CylinderGeometry(0.35, 0.35, 0.1, 32);
    const platformMaterial = new THREE.MeshStandardMaterial({
      color: COLORS.goal,
      emissive: COLORS.goalEmissive,
      emissiveIntensity: 1.5,
      roughness: 0.3,
      metalness: 0.7,
      transparent: true,
      opacity: 0.8
    });

    this.goalMesh = new THREE.Mesh(platformGeometry, platformMaterial);
    this.goalMesh.position.set(
      end.x * this.cellSize + this.cellSize / 2,
      0.05,
      end.y * this.cellSize + this.cellSize / 2
    );
    this.scene.add(this.goalMesh);

    // Goal light beam
    this.goalLight = new THREE.PointLight(COLORS.goal, 3, 10);
    this.goalLight.position.copy(this.goalMesh.position);
    this.goalLight.position.y = 1;
    this.scene.add(this.goalLight);

    // Floating ring
    const ringGeometry = new THREE.TorusGeometry(0.3, 0.05, 16, 32);
    const ringMaterial = new THREE.MeshStandardMaterial({
      color: COLORS.goal,
      emissive: COLORS.goalEmissive,
      emissiveIntensity: 2,
      transparent: true,
      opacity: 0.7
    });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.3;
    this.goalMesh.add(ring);
    this.goalRing = ring;
  }

  centerCamera(width, height) {
    const centerX = width * this.cellSize / 2;
    const centerZ = height * this.cellSize / 2;
    const maxDim = Math.max(width, height) * this.cellSize;
    
    this.camera.position.set(centerX, maxDim * 1.2, centerZ + maxDim * 0.3);
    this.camera.lookAt(centerX, 0, centerZ);
  }

  /**
   * Update ball position
   */
  updateBall(x, y, speed = 0) {
    if (!this.ballMesh) return;

    this.ballMesh.position.x = x;
    this.ballMesh.position.z = y;

    // Update light position
    if (this.ballLight) {
      this.ballLight.position.x = x;
      this.ballLight.position.z = y;
      
      // Pulse light based on speed
      this.ballLight.intensity = 2 + speed * 0.5;
    }

    // Rotate ball based on movement
    const rotSpeed = speed * 0.1;
    this.ballMesh.rotation.x += rotSpeed;
    this.ballMesh.rotation.z += rotSpeed;
  }

  /**
   * Animate goal
   */
  animateGoal(time) {
    if (this.goalMesh && this.goalRing) {
      // Pulse
      const pulse = Math.sin(time * 3) * 0.1 + 1;
      this.goalMesh.scale.setScalar(pulse);
      
      // Rotate ring
      this.goalRing.rotation.z += 0.02;
      this.goalRing.position.y = 0.3 + Math.sin(time * 2) * 0.1;
      
      // Pulse light
      if (this.goalLight) {
        this.goalLight.intensity = 3 + Math.sin(time * 4) * 1;
      }
    }
  }

  /**
   * Render frame
   */
  render() {
    const time = this.clock.getElapsedTime();
    
    // Animate goal
    this.animateGoal(time);
    
    // Use composer for post-processing
    if (this.composer) {
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }

  /**
   * Start render loop
   */
  startRenderLoop(updateCallback) {
    const animate = () => {
      this.animationId = requestAnimationFrame(animate);
      
      if (updateCallback) {
        updateCallback(this.clock.getDelta());
      }
      
      this.render();
    };
    
    animate();
  }

  /**
   * Stop render loop
   */
  stopRenderLoop() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  /**
   * Clear maze objects
   */
  clearMaze() {
    // Remove wall meshes
    for (const mesh of this.wallMeshes) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      mesh.material.dispose();
    }
    this.wallMeshes = [];

    // Remove floor
    if (this.floorMesh) {
      this.scene.remove(this.floorMesh);
      this.floorMesh.geometry.dispose();
      this.floorMesh.material.dispose();
      this.floorMesh = null;
    }

    // Remove ball
    if (this.ballMesh) {
      this.scene.remove(this.ballMesh);
      this.ballMesh.geometry.dispose();
      this.ballMesh.material.dispose();
      this.ballMesh = null;
    }

    if (this.ballLight) {
      this.scene.remove(this.ballLight);
      this.ballLight = null;
    }

    // Remove goal
    if (this.goalMesh) {
      this.scene.remove(this.goalMesh);
      this.goalMesh.geometry.dispose();
      this.goalMesh.material.dispose();
      this.goalMesh = null;
    }

    if (this.goalLight) {
      this.scene.remove(this.goalLight);
      this.goalLight = null;
    }
  }

  /**
   * Handle resize
   */
  onResize() {
    this.width = this.container.clientWidth;
    this.height = this.container.clientHeight;

    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(this.width, this.height);
    
    if (this.composer) {
      this.composer.setSize(this.width, this.height);
    }
  }

  /**
   * Play victory effect
   */
  playVictoryEffect() {
    // Flash the scene
    const originalBackground = this.scene.background.clone();
    this.scene.background = new THREE.Color(0x00ff88);
    
    setTimeout(() => {
      this.scene.background = originalBackground;
    }, 100);

    // Pulse ball
    if (this.ballMesh) {
      this.ballMesh.material.emissiveIntensity = 5;
      setTimeout(() => {
        if (this.ballMesh) {
          this.ballMesh.material.emissiveIntensity = 2;
        }
      }, 500);
    }
  }

  /**
   * Play death effect
   */
  playDeathEffect() {
    // Red flash
    const originalBackground = this.scene.background.clone();
    this.scene.background = new THREE.Color(0xff3366);
    
    setTimeout(() => {
      this.scene.background = originalBackground;
    }, 100);
  }

  /**
   * Cleanup
   */
  dispose() {
    this.stopRenderLoop();
    this.clearMaze();
    
    if (this.renderer) {
      this.renderer.dispose();
      this.container.removeChild(this.renderer.domElement);
    }
    
    if (this.composer) {
      this.composer.dispose();
    }
  }
}
