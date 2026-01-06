document.addEventListener('DOMContentLoaded', () => {
    const uploadZone = document.getElementById('upload-zone');
    const fileInput = document.getElementById('file-input');
    const resultsSection = document.getElementById('results-section');
    const originalImage = document.getElementById('original-image');
    const loader = document.getElementById('loader');
    const resetBtn = document.getElementById('reset-btn');
    const downloadBtn = document.getElementById('download-btn');
    const downloadPngBtn = document.getElementById('download-png-btn');
    const statsContainer = document.getElementById('analysis-stats');
    const viewportContainer = document.getElementById('viewport-container');
    const threeCanvas = document.getElementById('three-canvas');

    let scene, camera, renderer, controls;
    let currentAnimationId = null;

    // Drag & Drop
    uploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadZone.classList.add('drag-over');
    });

    uploadZone.addEventListener('dragleave', () => {
        uploadZone.classList.remove('drag-over');
    });

    uploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadZone.classList.remove('drag-over');
        if (e.dataTransfer.files.length) {
            handleFile(e.dataTransfer.files[0]);
        }
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length) {
            handleFile(e.target.files[0]);
        }
    });

    resetBtn.addEventListener('click', resetUI);
    downloadBtn.addEventListener('click', downloadModel);
    downloadPngBtn.addEventListener('click', downloadPng);

    function handleFile(file) {
        if (!file.type.startsWith('image/')) {
            alert('Please upload an image file (PNG, JPG, JPEG).');
            return;
        }

        // Show UI State
        uploadZone.classList.add('hidden');
        resultsSection.classList.remove('hidden');
        resetBtn.classList.remove('hidden');
        downloadBtn.classList.remove('hidden');
        downloadPngBtn.classList.remove('hidden');
        loader.classList.remove('hidden');

        // Display Original Image
        const reader = new FileReader();
        reader.onload = (e) => {
            originalImage.src = e.target.result;
        };
        reader.readAsDataURL(file);

        // Upload to API
        uploadFile(file);
    }

    async function uploadFile(file) {
        const formData = new FormData();
        formData.append('image', file);

        try {
            const response = await fetch('http://127.0.0.1:5001/', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) throw new Error('Analysis failed');

            const data = await response.json();
            build3DModel(data);
            updateStats(data);
        } catch (err) {
            console.error(err);
            alert('Error analyzing floor plan. Please try again.');
            resetUI();
        } finally {
            loader.classList.add('hidden');
        }
    }

    function initThreeJS() {
        const width = viewportContainer.clientWidth;
        const height = viewportContainer.clientHeight;

        // Scene
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x1a1a2e);

        // Camera
        camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 10000);
        camera.position.set(0, 500, 500);
        camera.lookAt(0, 0, 0);

        // Renderer
        renderer = new THREE.WebGLRenderer({ canvas: threeCanvas, antialias: true });
        renderer.setSize(width, height);
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.shadowMap.enabled = true;

        // Orbit Controls
        controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.screenSpacePanning = false;
        controls.minDistance = 100;
        controls.maxDistance = 2000;
        controls.maxPolarAngle = Math.PI / 2;

        // Lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(200, 500, 300);
        directionalLight.castShadow = true;
        scene.add(directionalLight);

        // Ground plane
        const groundGeometry = new THREE.PlaneGeometry(2000, 2000);
        const groundMaterial = new THREE.MeshStandardMaterial({
            color: 0x2d2d44,
            roughness: 0.8
        });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = 0;
        ground.receiveShadow = true;
        scene.add(ground);

        // Grid helper
        const gridHelper = new THREE.GridHelper(2000, 50, 0x444466, 0x333355);
        scene.add(gridHelper);

        // Handle resize
        window.addEventListener('resize', onWindowResize);

        animate();
    }

    function onWindowResize() {
        if (!viewportContainer || !camera || !renderer) return;
        const width = viewportContainer.clientWidth;
        const height = viewportContainer.clientHeight;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
    }

    function animate() {
        currentAnimationId = requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
    }

    function build3DModel(data) {
        // Initialize Three.js if not done
        if (!scene) {
            initThreeJS();
        }

        // Clear existing meshes (except ground and lights)
        const objectsToRemove = [];
        scene.traverse((child) => {
            if (child.userData.isFloorPlanObject) {
                objectsToRemove.push(child);
            }
        });
        objectsToRemove.forEach(obj => scene.remove(obj));

        const WALL_HEIGHT = 80;
        const WALL_THICKNESS = 8;
        const DOOR_HEIGHT = 60;
        const WINDOW_HEIGHT = 30;
        const WINDOW_BOTTOM = 25;

        // Calculate center offset
        const centerX = data.Width / 2;
        const centerY = data.Height / 2;

        // Materials
        const wallMaterial = new THREE.MeshStandardMaterial({
            color: 0xd4a574,
            roughness: 0.7,
            metalness: 0.1
        });

        const doorMaterial = new THREE.MeshStandardMaterial({
            color: 0x228b22,
            roughness: 0.5,
            metalness: 0.2
        });

        const windowMaterial = new THREE.MeshStandardMaterial({
            color: 0x87ceeb,
            transparent: true,
            opacity: 0.6,
            roughness: 0.1,
            metalness: 0.3
        });

        // Build geometry for each detected feature
        data.points.forEach((point, index) => {
            const classObj = data.classes[index];
            const className = classObj.name || classObj; // Handle both {name: 'wall'} and 'wall'

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

            if (className === 'wall') {
                // Walls are rendered as boxes
                const isHorizontal = width > depth;
                const wallWidth = isHorizontal ? width : WALL_THICKNESS;
                const wallDepth = isHorizontal ? WALL_THICKNESS : depth;

                const geometry = new THREE.BoxGeometry(wallWidth, WALL_HEIGHT, wallDepth);
                mesh = new THREE.Mesh(geometry, wallMaterial.clone());
                mesh.position.set(centerPosX, WALL_HEIGHT / 2, centerPosZ);
                mesh.castShadow = true;
                mesh.receiveShadow = true;
            }
            else if (className === 'door') {
                // Doors are rendered as green boxes (openings)
                const isHorizontal = width > depth;
                const doorWidth = isHorizontal ? width : WALL_THICKNESS + 4;
                const doorDepth = isHorizontal ? WALL_THICKNESS + 4 : depth;

                const geometry = new THREE.BoxGeometry(doorWidth, DOOR_HEIGHT, doorDepth);
                mesh = new THREE.Mesh(geometry, doorMaterial.clone());
                mesh.position.set(centerPosX, DOOR_HEIGHT / 2, centerPosZ);
                mesh.castShadow = true;
            }
            else if (className === 'window') {
                // Windows are rendered as blue transparent boxes
                const isHorizontal = width > depth;
                const windowWidth = isHorizontal ? width : WALL_THICKNESS + 2;
                const windowDepth = isHorizontal ? WALL_THICKNESS + 2 : depth;

                const geometry = new THREE.BoxGeometry(windowWidth, WINDOW_HEIGHT, windowDepth);
                mesh = new THREE.Mesh(geometry, windowMaterial.clone());
                mesh.position.set(centerPosX, WINDOW_BOTTOM + WINDOW_HEIGHT / 2, centerPosZ);
            }

            if (mesh) {
                mesh.userData.isFloorPlanObject = true;
                mesh.userData.className = className;
                scene.add(mesh);
            }
        });

        // Adjust camera to fit the model
        camera.position.set(data.Width * 0.6, data.Height * 0.5, data.Width * 0.6);
        camera.lookAt(0, 0, 0);
        controls.target.set(0, 0, 0);
        controls.update();
    }

    function updateStats(data) {
        const counts = {};
        if (data.classes) {
            data.classes.forEach(c => {
                const name = c.name || c; // Handle both {name: 'wall'} and 'wall'
                counts[name] = (counts[name] || 0) + 1;
            });
        }

        let html = '';
        const colorClasses = { wall: 'wall', door: 'door', window: 'window' };
        for (const [key, value] of Object.entries(counts)) {
            const colorClass = colorClasses[key] || '';
            html += `<div class="stat-item ${colorClass}">${key}: <span>${value}</span></div>`;
        }
        statsContainer.innerHTML = html;
    }

    function downloadModel() {
        if (!scene) {
            alert('No 3D model to download. Please upload a floor plan first.');
            return;
        }

        const exporter = new THREE.GLTFExporter();

        // Only export floor plan objects, not the ground/grid
        const exportScene = new THREE.Scene();
        scene.traverse((child) => {
            if (child.userData.isFloorPlanObject) {
                exportScene.add(child.clone());
            }
        });

        exporter.parse(
            exportScene,
            function (result) {
                const blob = new Blob([result], { type: 'application/octet-stream' });
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = 'floorplan_3d_model.glb';
                link.click();
                URL.revokeObjectURL(link.href);
            },
            function (error) {
                console.error('Export failed:', error);
                alert('Failed to export 3D model.');
            },
            { binary: true }
        );
    }

    function downloadPng() {
        if (!renderer) {
            alert('No 3D model to screenshot. Please upload a floor plan first.');
            return;
        }

        // Render one frame to ensure latest state
        renderer.render(scene, camera);

        // Get canvas data
        const dataURL = renderer.domElement.toDataURL('image/png');

        // Create download link
        const link = document.createElement('a');
        link.href = dataURL;
        link.download = 'floorplan_3d_screenshot.png';
        link.click();
    }

    function resetUI() {
        uploadZone.classList.remove('hidden');
        resultsSection.classList.add('hidden');
        resetBtn.classList.add('hidden');
        downloadBtn.classList.add('hidden');
        downloadPngBtn.classList.add('hidden');
        fileInput.value = '';
        originalImage.src = '';
        statsContainer.innerHTML = '';

        // Clear 3D scene
        if (scene) {
            const objectsToRemove = [];
            scene.traverse((child) => {
                if (child.userData.isFloorPlanObject) {
                    objectsToRemove.push(child);
                }
            });
            objectsToRemove.forEach(obj => scene.remove(obj));
        }
    }
});
