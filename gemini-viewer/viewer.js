// Floor plan data from CubiCasa API - Ground Floor Drawing
const floorPlanData = {
    "Height": 1024,
    "Width": 755,
    "averageDoor": 58.5,
    "classes": [
        { "name": "wall" },
        { "name": "door" },
        { "name": "wall" },
        { "name": "wall" },
        { "name": "wall" },
        { "name": "wall" },
        { "name": "wall" },
        { "name": "door" },
        { "name": "window" },
        { "name": "window" },
        { "name": "wall" },
        { "name": "wall" },
        { "name": "wall" },
        { "name": "wall" },
        { "name": "wall" },
        { "name": "wall" }
    ],
    "points": [
        { "x1": 388, "x2": 675, "y1": 416, "y2": 714 },
        { "x1": 645, "x2": 686, "y1": 642, "y2": 683 },
        { "x1": 64, "x2": 336, "y1": 437, "y2": 725 },
        { "x1": 128, "x2": 342, "y1": 653, "y2": 835 },
        { "x1": 632, "x2": 693, "y1": 452, "y2": 510 },
        { "x1": 681, "x2": 690, "y1": 503, "y2": 642 },
        { "x1": 292, "x2": 341, "y1": 659, "y2": 708 },
        { "x1": 340, "x2": 416, "y1": 662, "y2": 670 },
        { "x1": 486, "x2": 533, "y1": 561, "y2": 614 },
        { "x1": 429, "x2": 488, "y1": 616, "y2": 662 },
        { "x1": 419, "x2": 473, "y1": 660, "y2": 714 },
        { "x1": 66, "x2": 129, "y1": 450, "y2": 508 },
        { "x1": 69, "x2": 172, "y1": 722, "y2": 822 },
        { "x1": 66, "x2": 75, "y1": 500, "y2": 643 },
        { "x1": 633, "x2": 695, "y1": 635, "y2": 693 },
        { "x1": 371, "x2": 490, "y1": 291, "y2": 424 }
    ]
};

// Three.js scene setup
let scene, camera, renderer, controls;
const labels = [];

function init() {
    const container = document.getElementById('canvas-container');
    const canvas = document.getElementById('three-canvas');

    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f0f23);

    // Camera
    const aspect = container.clientWidth / container.clientHeight;
    camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 10000);
    camera.position.set(0, 800, 800);
    camera.lookAt(0, 0, 0);

    // Renderer
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Orbit Controls
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = false;
    controls.minDistance = 200;
    controls.maxDistance = 2000;
    controls.maxPolarAngle = Math.PI / 2;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(300, 600, 400);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);

    const fillLight = new THREE.DirectionalLight(0x88aaff, 0.3);
    fillLight.position.set(-200, 400, -200);
    scene.add(fillLight);

    // Ground plane
    const groundGeometry = new THREE.PlaneGeometry(2000, 2000);
    const groundMaterial = new THREE.MeshStandardMaterial({
        color: 0x1a1a2e,
        roughness: 0.9
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    ground.receiveShadow = true;
    scene.add(ground);

    // Grid helper
    const gridHelper = new THREE.GridHelper(1500, 30, 0x333355, 0x222244);
    scene.add(gridHelper);

    // Build the 3D model
    build3DModel(floorPlanData);

    // Update stats
    updateStats();

    // Populate coordinates panel
    populateCoordinatesPanel();

    // Handle resize
    window.addEventListener('resize', onWindowResize);

    // Start animation loop
    animate();
}

function build3DModel(data) {
    const WALL_HEIGHT = 100;
    const WALL_THICKNESS = 10;
    const DOOR_HEIGHT = 75;
    const WINDOW_HEIGHT = 40;
    const WINDOW_BOTTOM = 30;

    // Center offset
    const centerX = data.Width / 2;
    const centerY = data.Height / 2;

    // Materials with better visuals
    const wallMaterial = new THREE.MeshStandardMaterial({
        color: 0xd4a574,
        roughness: 0.6,
        metalness: 0.1
    });

    const doorMaterial = new THREE.MeshStandardMaterial({
        color: 0x228b22,
        roughness: 0.4,
        metalness: 0.2
    });

    const windowMaterial = new THREE.MeshStandardMaterial({
        color: 0x87ceeb,
        transparent: true,
        opacity: 0.7,
        roughness: 0.1,
        metalness: 0.4
    });

    // Build each detected element
    data.points.forEach((point, index) => {
        const classObj = data.classes[index];
        const className = classObj.name || classObj;

        // Calculate dimensions
        const x1 = point.x1 - centerX;
        const y1 = point.y1 - centerY;
        const x2 = point.x2 - centerX;
        const y2 = point.y2 - centerY;

        const width = Math.abs(x2 - x1);
        const depth = Math.abs(y2 - y1);
        const centerPosX = (x1 + x2) / 2;
        const centerPosZ = (y1 + y2) / 2;

        let mesh;
        let meshHeight = WALL_HEIGHT;

        if (className === 'wall') {
            const isHorizontal = width > depth;
            const wallWidth = isHorizontal ? width : WALL_THICKNESS;
            const wallDepth = isHorizontal ? WALL_THICKNESS : depth;

            const geometry = new THREE.BoxGeometry(wallWidth, WALL_HEIGHT, wallDepth);
            mesh = new THREE.Mesh(geometry, wallMaterial.clone());
            mesh.position.set(centerPosX, WALL_HEIGHT / 2, centerPosZ);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            meshHeight = WALL_HEIGHT;
        }
        else if (className === 'door') {
            const isHorizontal = width > depth;
            const doorWidth = isHorizontal ? width : WALL_THICKNESS + 6;
            const doorDepth = isHorizontal ? WALL_THICKNESS + 6 : depth;

            const geometry = new THREE.BoxGeometry(doorWidth, DOOR_HEIGHT, doorDepth);
            mesh = new THREE.Mesh(geometry, doorMaterial.clone());
            mesh.position.set(centerPosX, DOOR_HEIGHT / 2, centerPosZ);
            mesh.castShadow = true;
            meshHeight = DOOR_HEIGHT;
        }
        else if (className === 'window') {
            const isHorizontal = width > depth;
            const windowWidth = isHorizontal ? width : WALL_THICKNESS + 4;
            const windowDepth = isHorizontal ? WALL_THICKNESS + 4 : depth;

            const geometry = new THREE.BoxGeometry(windowWidth, WINDOW_HEIGHT, windowDepth);
            mesh = new THREE.Mesh(geometry, windowMaterial.clone());
            mesh.position.set(centerPosX, WINDOW_BOTTOM + WINDOW_HEIGHT / 2, centerPosZ);
            meshHeight = WINDOW_HEIGHT;
        }

        if (mesh) {
            mesh.userData.className = className;
            mesh.userData.index = index;
            mesh.userData.coords = point;
            scene.add(mesh);

            // Create floating label sprite
            const label = createTextSprite(`#${index}`, className);
            label.position.set(centerPosX, meshHeight + 20, centerPosZ);
            scene.add(label);
            labels.push(label);
        }
    });

    // Adjust camera to fit model
    camera.position.set(data.Width * 0.8, data.Height * 0.6, data.Width * 0.8);
    camera.lookAt(0, 0, 0);
    controls.target.set(0, 0, 0);
    controls.update();
}

function createTextSprite(text, className) {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = 64;
    canvas.height = 32;

    // Background color based on class
    const colors = {
        wall: '#d4a574',
        door: '#228b22',
        window: '#87ceeb'
    };

    context.fillStyle = colors[className] || '#ffffff';
    context.fillRect(0, 0, 64, 32);

    context.font = 'bold 18px Arial';
    context.fillStyle = '#000000';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(text, 32, 16);

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.scale.set(40, 20, 1);

    return sprite;
}

function populateCoordinatesPanel() {
    const panel = document.getElementById('coords-list');
    if (!panel) return;

    let html = '';
    floorPlanData.points.forEach((point, index) => {
        const classObj = floorPlanData.classes[index];
        const className = classObj.name || classObj;

        html += `
            <div class="coord-item ${className}" data-index="${index}">
                <div class="coord-header">
                    <span class="coord-id">#${index}</span>
                    <span class="coord-type">${className.toUpperCase()}</span>
                </div>
                <div class="coord-values">
                    <span>x1: ${point.x1}</span>
                    <span>y1: ${point.y1}</span>
                    <span>x2: ${point.x2}</span>
                    <span>y2: ${point.y2}</span>
                </div>
                <div class="coord-size">
                    Size: ${Math.abs(point.x2 - point.x1)} × ${Math.abs(point.y2 - point.y1)} px
                </div>
            </div>
        `;
    });
    panel.innerHTML = html;

    // Add hover interactions
    document.querySelectorAll('.coord-item').forEach(item => {
        item.addEventListener('mouseenter', () => {
            const idx = parseInt(item.dataset.index);
            highlightMesh(idx, true);
        });
        item.addEventListener('mouseleave', () => {
            const idx = parseInt(item.dataset.index);
            highlightMesh(idx, false);
        });
    });
}

function highlightMesh(index, highlight) {
    scene.traverse((obj) => {
        if (obj.userData && obj.userData.index === index) {
            if (highlight) {
                obj.material.emissive = new THREE.Color(0xffff00);
                obj.material.emissiveIntensity = 0.5;
            } else {
                obj.material.emissive = new THREE.Color(0x000000);
                obj.material.emissiveIntensity = 0;
            }
        }
    });
}

function updateStats() {
    const counts = { wall: 0, door: 0, window: 0 };
    floorPlanData.classes.forEach(c => {
        const name = c.name || c;
        counts[name] = (counts[name] || 0) + 1;
    });

    document.getElementById('wall-count').textContent = counts.wall;
    document.getElementById('door-count').textContent = counts.door;
    document.getElementById('window-count').textContent = counts.window;
}

function onWindowResize() {
    const container = document.getElementById('canvas-container');
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);
