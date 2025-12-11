import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

// --- Global Variables ---
let scene, camera, renderer, composer;
let controls;
let particles = [];
let imageParticles = [];
let raycaster = new THREE.Raycaster();
let mouse = new THREE.Vector2(); // We'll use this for hand position mapping

// State
const STATE = {
    FIST: 'FIST',       // Aggregate to Tree
    OPEN: 'OPEN',       // Disperse & Rotate
    PINCH: 'PINCH'      // Grab Image
};
const INPUT_MODE = {
    CAMERA: 'CAMERA',
    MOUSE: 'MOUSE'
};

let currentState = STATE.OPEN;
let currentInputMode = INPUT_MODE.MOUSE;
let isHandDetected = false;
let handPosition = { x: 0, y: 0, z: 0 }; // Normalized screen coordinates (-1 to 1)

// Hand Tracking & Camera Utils
const videoElement = document.getElementById('input-video');
let cameraUtils = null; // MediaPipe Camera instance

// Particle Config
const PARTICLE_COUNT = 800;
const TREE_HEIGHT = 40;
const TREE_RADIUS = 15;

// Textures / Shapes
const EMOJIS = ['🎁', '🔔', '🎄', '🎅', '🧦', '👔', '⭐'];
const GEOMETRIES = [
    new THREE.SphereGeometry(0.3, 8, 8),
    new THREE.BoxGeometry(0.5, 0.5, 0.5),
    new THREE.TetrahedronGeometry(0.4)
];

let grabbedImage = null;
const clock = new THREE.Clock();

// --- Initialization ---
init();
initMediaPipe(); // Initialize but don't start until ready/needed
animate();

function init() {
    // 1. Scene Setup
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x000000, 0.02);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 10, 40);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.toneMapping = THREE.ReinhardToneMapping;
    document.getElementById('container').appendChild(renderer.domElement);

    // 2. Lights
    const ambientLight = new THREE.AmbientLight(0x404040, 2);
    scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0xffffff, 2, 100);
    pointLight.position.set(10, 20, 10);
    scene.add(pointLight);
    
    // Top light bulb for the tree
    const bulbLight = new THREE.PointLight(0xffaa00, 5, 30);
    bulbLight.position.set(0, TREE_HEIGHT / 2 + 2, 0);
    scene.add(bulbLight);

    // 3. Post-Processing (Bloom)
    const renderScene = new RenderPass(scene, camera);
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
    bloomPass.threshold = 0.2;
    bloomPass.strength = 1.2; // Glow strength
    bloomPass.radius = 0.5;

    composer = new EffectComposer(renderer);
    composer.addPass(renderScene);
    composer.addPass(bloomPass);

    // 4. Controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;

    // 5. Create Initial Particles
    createParticles();

    // 6. Event Listeners
    window.addEventListener('resize', onWindowResize);
    document.getElementById('fullscreen-btn').addEventListener('click', toggleFullScreen);
    document.getElementById('image-upload').addEventListener('change', handleImageUpload);
    
    // Mode Switching
    document.querySelectorAll('.mode-option').forEach(option => {
        option.addEventListener('click', (e) => {
            const mode = e.currentTarget.dataset.mode;
            switchInputMode(mode);
        });
    });

    // Mouse Listeners (initially inactive if default is camera)
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    // Prevent context menu on right click for better experience
    window.addEventListener('contextmenu', e => e.preventDefault());
}

function switchInputMode(mode) {
    if (mode === currentInputMode) return;

    // Update UI
    document.querySelectorAll('.mode-option').forEach(opt => opt.classList.remove('active'));
    document.querySelector(`.mode-option[data-mode="${mode}"]`).classList.add('active');

    // Update Instructions
    document.getElementById('inst-camera').style.display = mode === 'camera' ? 'block' : 'none';
    document.getElementById('inst-mouse').style.display = mode === 'mouse' ? 'block' : 'none';

    currentInputMode = mode === 'camera' ? INPUT_MODE.CAMERA : INPUT_MODE.MOUSE;

    if (currentInputMode === INPUT_MODE.CAMERA) {
        startCamera();
        isHandDetected = false; // Reset
    } else {
        stopCamera();
        isHandDetected = true; // Assume mouse presence is "hand detected"
        currentState = STATE.OPEN; // Default state
    }
}

// --- Particle System ---

function createTextureFromEmoji(emoji) {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.font = '100px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emoji, 64, 64);
    const texture = new THREE.CanvasTexture(canvas);
    return texture;
}

function createParticles() {
    // Standard shapes + Emojis
    const materialCommon = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.2,
        metalness: 0.8,
        emissive: 0x111111
    });

    for (let i = 0; i < PARTICLE_COUNT; i++) {
        let mesh;
        const randomType = Math.random();

        if (randomType < 0.3) {
            // Geometric Shape
            const geo = GEOMETRIES[Math.floor(Math.random() * GEOMETRIES.length)];
            mesh = new THREE.Mesh(geo, materialCommon.clone());
            mesh.material.color.setHSL(Math.random(), 0.8, 0.5);
        } else {
            // Emoji Sprite
            const emoji = EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
            const map = createTextureFromEmoji(emoji);
            const mat = new THREE.SpriteMaterial({ map: map, transparent: true });
            mesh = new THREE.Sprite(mat);
            mesh.scale.set(1.5, 1.5, 1.5);
        }

        // Initialize positions
        resetParticle(mesh);
        
        // Store target positions for states
        mesh.userData = {
            velocity: new THREE.Vector3((Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.2),
            treePos: calculateTreePosition(i, PARTICLE_COUNT),
            scatterPos: new THREE.Vector3((Math.random() - 0.5) * 50, (Math.random() - 0.5) * 50, (Math.random() - 0.5) * 50),
            initialScale: mesh.scale.clone(),
            isImage: false
        };

        // Start scattered
        mesh.position.copy(mesh.userData.scatterPos);

        scene.add(mesh);
        particles.push(mesh);
    }
}

function calculateTreePosition(index, total) {
    // Spiral Cone Algorithm
    const ratio = index / total; // 0 to 1 (top to bottom usually, or vice versa)
    const h = TREE_HEIGHT * ratio - (TREE_HEIGHT / 2); // Height from bottom to top
    const angle = index * 0.5; // Spiral density
    const r = (1 - ratio) * TREE_RADIUS; // Radius decreases as we go up
    
    const x = r * Math.cos(angle);
    const z = r * Math.sin(angle);
    const y = h;

    return new THREE.Vector3(x, y, z);
}

function resetParticle(mesh) {
   // Helper if we needed to respawn
}

// --- Image Handling ---

function handleImageUpload(event) {
    const files = event.target.files;
    if (!files.length) return;

    const loader = new THREE.TextureLoader();

    Array.from(files).forEach((file, index) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            loader.load(e.target.result, (texture) => {
                createImageParticle(texture);
            });
        };
        reader.readAsDataURL(file);
    });
}

function createImageParticle(texture) {
    const mat = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(mat);
    
    // Initial Size (similar to other particles)
    sprite.scale.set(3, 3, 3); // Slightly larger than emojis to be visible

    // Assign a spot in the tree
    // We replace a random particle or add new one. Let's add new one for simplicity but keep it within tree bounds.
    const randomIdx = Math.floor(Math.random() * particles.length);
    const treeTarget = calculateTreePosition(randomIdx, particles.length); // Reuse a position "slot" roughly
    
    // Offset slightly so it doesn't overlap perfectly
    treeTarget.x += (Math.random() - 0.5) * 2;
    treeTarget.z += (Math.random() - 0.5) * 2;

    sprite.userData = {
        treePos: treeTarget,
        scatterPos: new THREE.Vector3((Math.random() - 0.5) * 40, (Math.random() - 0.5) * 40, (Math.random() - 0.5) * 40),
        initialScale: sprite.scale.clone(),
        isImage: true,
        isGrabbed: false
    };

    sprite.position.copy(sprite.userData.scatterPos);
    scene.add(sprite);
    particles.push(sprite); // Treat as particle for movement
    imageParticles.push(sprite); // Track separately for interaction
}

// --- MediaPipe Hands ---

function initMediaPipe() {
    const Hands = window.Hands;
    const Camera = window.Camera;

    if (!Hands || !Camera) {
        console.error("MediaPipe libraries not loaded!");
        return;
    }

    const hands = new Hands({locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
    }});

    hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 1,
        minDetectionConfidence: 0.7,
        minTrackingConfidence: 0.7
    });

    hands.onResults(onHandsResults);

    cameraUtils = new Camera(videoElement, {
        onFrame: async () => {
            if (currentInputMode === INPUT_MODE.CAMERA) {
                await hands.send({image: videoElement});
            }
        },
        width: 640,
        height: 480
    });
    
    // Start automatically if camera mode is default
    if (currentInputMode === INPUT_MODE.CAMERA) {
        startCamera();
    }
}

function startCamera() {
    if (cameraUtils) {
        cameraUtils.start().then(() => {
             document.getElementById('loading').style.display = 'block';
             // Hide loading text when started (approximate)
            setTimeout(() => {
                if(currentInputMode === INPUT_MODE.CAMERA) {
                    document.getElementById('loading').style.display = 'none';
                }
            }, 2000);
        });
    }
}

function stopCamera() {
    // MediaPipe Camera Utils doesn't have a direct 'stop' method that stops the stream tracks easily exposed in all versions,
    // but stopping execution of send is enough for performance. 
    // We can also pause the video element.
    const stream = videoElement.srcObject;
    if (stream) {
        const tracks = stream.getTracks();
        tracks.forEach(track => track.stop());
        videoElement.srcObject = null;
    }
    document.getElementById('loading').style.display = 'none';
}

function onHandsResults(results) {
    // Only process if in camera mode
    if (currentInputMode !== INPUT_MODE.CAMERA) return;

    isHandDetected = false;
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        isHandDetected = true;
        const landmarks = results.multiHandLandmarks[0];
        
        // Detect Gestures
        detectGesture(landmarks);
        
        // Update Hand Position (Normalized)
        const x = landmarks[9].x; 
        const y = landmarks[9].y;
        
        handPosition.x = (1 - x) * 2 - 1; 
        handPosition.y = -(y * 2 - 1); // Invert Y because screen y goes down
    }
}

function detectGesture(landmarks) {
    // Simple heuristic for Open vs Closed vs Pinch
    
    // 1. Is thumb touching index? (Pinch)
    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];
    const distancePinch = Math.hypot(thumbTip.x - indexTip.x, thumbTip.y - indexTip.y);
    
    // 2. Are fingers folded? (Fist)
    // Check tips against PIP (Proximal Interphalangeal) joints for middle, ring, pinky
    const isFingerFolded = (tipIdx, pipIdx) => {
        return landmarks[tipIdx].y > landmarks[pipIdx].y; // Assuming hand is upright roughly
    };
    
    const middleFolded = isFingerFolded(12, 10);
    const ringFolded = isFingerFolded(16, 14);
    const pinkyFolded = isFingerFolded(20, 18);
    const indexFolded = isFingerFolded(8, 6);

    const isFist = middleFolded && ringFolded && pinkyFolded && indexFolded;
    
    if (distancePinch < 0.05 && !isFist) {
        currentState = STATE.PINCH;
    } else if (isFist) {
        currentState = STATE.FIST;
    } else {
        currentState = STATE.OPEN;
    }
}

// --- Mouse Interaction ---

function onMouseMove(event) {
    if (currentInputMode !== INPUT_MODE.MOUSE) return;
    
    // Normalize mouse position to -1 to 1
    handPosition.x = (event.clientX / window.innerWidth) * 2 - 1;
    handPosition.y = -(event.clientY / window.innerHeight) * 2 + 1;
    
    // In Mouse Mode, we consider "Hand Detected" as long as mouse is moving/present
    isHandDetected = true;
}

function onMouseDown(event) {
    if (currentInputMode !== INPUT_MODE.MOUSE) return;

    if (event.button === 0) { // Left Click
        currentState = STATE.FIST;
    } else if (event.button === 2) { // Right Click
        currentState = STATE.PINCH;
    }
}

function onMouseUp(event) {
    if (currentInputMode !== INPUT_MODE.MOUSE) return;
    currentState = STATE.OPEN;
}

// --- Main Animation Loop ---

function animate(time) {
    requestAnimationFrame(animate);
    
    TWEEN.update(time);
    controls.update();

    const dt = clock.getDelta();
    const now = Date.now() * 0.001;

    // Logic based on state
    if (!isHandDetected) {
        if (grabbedImage) {
            releaseGrabbedImage(grabbedImage);
            grabbedImage = null;
        }

        // Default behavior if no hand: Slow rotation in tree form
        particles.forEach((p, i) => {
            const target = p.userData.treePos;
            // Gentle float
            p.position.lerp(target, 0.05);
            
            // Rotate entire tree group
            const angleOffset = now * 0.2; // Continuous rotation
            const r = Math.sqrt(p.userData.treePos.x**2 + p.userData.treePos.z**2);
            const theta = Math.atan2(p.userData.treePos.z, p.userData.treePos.x);
            
            p.position.x = r * Math.cos(theta + angleOffset); 
            p.position.z = r * Math.sin(theta + angleOffset);
            p.position.y = p.userData.treePos.y; // Keep height

            // Pulse scale
            const pulse = 1 + Math.sin(now * 2 + i) * 0.1;
            p.scale.setScalar(pulse * (p.userData.initialScale.x || 1.5));
        });
    } else {
        if (currentState === STATE.FIST) {
            // Form Tree
            particles.forEach(p => {
                if (p.userData.isGrabbed) return; // Don't move grabbed image
                p.position.lerp(p.userData.treePos, 0.1);
                // Reset scale
                if (!p.userData.isGrabbed) p.scale.lerp(p.userData.initialScale, 0.1);
            });
            // Release grabbed image
            if (grabbedImage) {
                grabbedImage.userData.isGrabbed = false;
                grabbedImage = null;
            }

        } else if (currentState === STATE.OPEN) {
            // Disperse & Rotate
            particles.forEach((p, i) => {
                if (p.userData.isGrabbed) return;

                // Move towards scatter pos but keep rotating around center
                const target = p.userData.scatterPos;
                
                // Add rotation to scatter
                const rotSpeed = 0.5;
                const angle = now * rotSpeed;
                const x = target.x * Math.cos(angle) - target.z * Math.sin(angle);
                const z = target.x * Math.sin(angle) + target.z * Math.cos(angle);
                
                // Lerp towards the rotated scatter position
                p.position.x += (x - p.position.x) * 0.05;
                p.position.y += (target.y - p.position.y) * 0.05;
                p.position.z += (z - p.position.z) * 0.05;

                // Reset scale
                p.scale.lerp(p.userData.initialScale, 0.1);
            });
             if (grabbedImage) {
                grabbedImage.userData.isGrabbed = false;
                grabbedImage = null;
            }

        } else if (currentState === STATE.PINCH) {
            // Logic for finding and grabbing image
            raycaster.setFromCamera(handPosition, camera);
            const intersects = raycaster.intersectObjects(imageParticles);
            
            let targetImage = null;
            if (intersects.length > 0) {
                targetImage = intersects[0].object;
            } else {
                let minDist = 0.3; 
                imageParticles.forEach(img => {
                    const p = img.position.clone().project(camera);
                    const d = p.distanceTo(new THREE.Vector3(handPosition.x, handPosition.y, 0));
                    if (d < minDist) {
                        minDist = d;
                        targetImage = img;
                    }
                });
            }

            if (targetImage && (!grabbedImage || grabbedImage !== targetImage)) {
                if (grabbedImage) releaseGrabbedImage(grabbedImage);
                grabbedImage = targetImage;
                startGrabAnimation(grabbedImage);
            }

            // If we have a grabbed image, ensure it stays grabbed
            if (grabbedImage) {
                 // TWEENs will handle the movement initiated in startGrabAnimation
                 // We just ensure it renders on top or glows
                 grabbedImage.material.opacity = 1;
            }
        }
    }

    composer.render();
}

function startGrabAnimation(object) {
    object.userData.isGrabbed = true;
    
    // Random Transition Effect
    const effectType = Math.floor(Math.random() * 3);
    const targetPos = new THREE.Vector3(0, 0, 15); // Center front
    const startPos = object.position.clone();

    // Kill existing tweens on this object
    TWEEN.removeAll(); 

    // 1. Position Tween
    new TWEEN.Tween(object.position)
        .to(targetPos, 1000)
        .easing(TWEEN.Easing.Elastic.Out)
        .start();

    // 2. Scale Tween
    new TWEEN.Tween(object.scale)
        .to({ x: 8, y: 8, z: 8 }, 1000)
        .easing(TWEEN.Easing.Back.Out)
        .start();
        
    // 3. Rotation/Special Effect based on type
    if (effectType === 0) {
        // Spin
        new TWEEN.Tween(object.rotation)
            .to({ z: Math.PI * 2 }, 1000)
            .easing(TWEEN.Easing.Cubic.Out)
            .start();
    } else if (effectType === 1) {
        // Wobble handled by Elastic Easing already on position/scale, maybe add color flash?
        object.material.color.setHex(0xffffff); // Flash white
        setTimeout(() => object.material.color.setHex(0xffffff), 100); // Reset (sprites dont have color tint usually unless set)
    }

    // Glow Effect (if material supports it, or just rely on brightness)
    // For Sprites, we can't easily change emissive, but we can increase color intensity if it was tinted
    // Or we assume the Bloom pass will pick it up if it's bright white.
}

function releaseGrabbedImage(object) {
    object.userData.isGrabbed = false;
    
    // Return to tree or scatter position
    const target = currentState === STATE.FIST ? object.userData.treePos : object.userData.scatterPos;
    
    new TWEEN.Tween(object.position)
        .to(target, 800)
        .easing(TWEEN.Easing.Quadratic.Out)
        .start();

    new TWEEN.Tween(object.scale)
        .to(object.userData.initialScale, 800)
        .easing(TWEEN.Easing.Quadratic.Out)
        .start();
        
    new TWEEN.Tween(object.rotation)
        .to({ z: 0 }, 800)
        .start();
}


function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
}

function toggleFullScreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        }
    }
}
