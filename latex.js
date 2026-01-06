import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

let scene, camera, renderer, controls;
let mesh;
let geometry, material;

let pointsData = [];
let markers = [];
let currentFractalPositions = [];

const params = {
    depth: 1,
    color: '#22d3ee',
    autoRotate: false,
    size: 20
};

const menuBtn = document.getElementById('menu-btn');
const uiContainer = document.getElementById('ui-container');
const colorPicker = document.getElementById('color-picker');
const rotateCheck = document.getElementById('rotate-check');
const countVal = document.getElementById('count-val');
const markersLayer = document.getElementById('markers-layer');
const infoCard = document.getElementById('info-card');
const cardTitle = document.getElementById('card-title');
const cardBody = document.getElementById('card-body');
const cardLink = document.getElementById('card-link');

menuBtn.addEventListener('click', () => {
    uiContainer.classList.toggle('hidden');
});

init();
animate();

function init() {
    fetchPoints();

    const container = document.getElementById('canvas-container');
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf8fafc);
    scene.fog = new THREE.Fog(0xf8fafc, 40, 120);

    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(40, 40, 40);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.autoRotate = params.autoRotate;
    controls.autoRotateSpeed = 2.0;

    const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 2.5);
    dirLight.position.set(20, 30, 20);
    dirLight.castShadow = true;
    scene.add(dirLight);

    const pointLight = new THREE.PointLight(params.color, 1, 100);
    pointLight.position.set(-20, -20, -20);
    scene.add(pointLight);

    geometry = new THREE.BoxGeometry(1, 1, 1);

    updateMaterial();
    generateFractal();
    startLevelCycle();

    window.addEventListener('resize', onWindowResize);

    colorPicker.addEventListener('input', (e) => {
        params.color = e.target.value;
        pointLight.color.set(params.color);
        updateMaterial();
    });

    rotateCheck.addEventListener('change', (e) => {
        params.autoRotate = e.target.checked;
        controls.autoRotate = params.autoRotate;
        if (!infoCard.classList.contains('active')) {
            // Let animate loop handle rotation
        }
    });

    const closeCard = document.querySelector('.close-card');
    if (closeCard) {
        closeCard.addEventListener('click', () => {
            infoCard.classList.remove('active');
            if (params.autoRotate) controls.autoRotate = true;
        });
    }
}

async function fetchPoints() {
    try {
        const response = await fetch('points_latex.json');
        pointsData = await response.json();
        createMarkers();
    } catch (error) {
        console.error("Failed to load points data:", error);
    }
}

function startLevelCycle() {
    let direction = 1;

    setInterval(() => {
        params.depth += direction;

        if (params.depth >= 4) {
            params.depth = 4;
            direction = -1;
        } else if (params.depth <= 1) {
            params.depth = 1;
            direction = 1;
        }

        requestAnimationFrame(() => {
            generateFractal();
            createMarkers();
        });

    }, 2500);
}

function updateMaterial() {
    if (mesh) scene.remove(mesh);

    material = new THREE.MeshStandardMaterial({
        color: new THREE.Color(params.color),
        roughness: 0.2,
        metalness: 0.8,
        flatShading: false
    });

    generateFractal();
}

function generateFractal() {
    if (mesh) {
        scene.remove(mesh);
        mesh.dispose();
    }

    const dummy = new THREE.Object3D();
    const matrices = [];
    currentFractalPositions = []; // Clear current positions

    function recurse(x, y, z, size, level) {
        if (level === 0) return;

        const step = size / 3;

        for (let ix = -1; ix <= 1; ix++) {
            for (let iy = -1; iy <= 1; iy++) {
                for (let iz = -1; iz <= 1; iz++) {

                    const zeros = (ix === 0 ? 1 : 0) + (iy === 0 ? 1 : 0) + (iz === 0 ? 1 : 0);
                    const isRemoved = zeros > 1;

                    const posX = x + ix * step;
                    const posY = y + iy * step;
                    const posZ = z + iz * step;

                    if (isRemoved) {
                        dummy.position.set(posX, posY, posZ);
                        dummy.scale.set(step, step, step);
                        dummy.updateMatrix();
                        matrices.push(dummy.matrix.clone());

                        // Store position and size for markers
                        // Position logic: "closer to the vertices" attempt
                        // We store the center and size, logic in createMarkers decies exact spot
                        currentFractalPositions.push({
                            center: new THREE.Vector3(posX, posY, posZ),
                            size: step
                        });
                    } else {
                        recurse(posX, posY, posZ, step, level - 1);
                    }
                }
            }
        }
    }

    recurse(0, 0, 0, params.size, params.depth);

    if (matrices.length === 0) return;

    countVal.innerText = matrices.length.toLocaleString();

    mesh = new THREE.InstancedMesh(geometry, material, matrices.length);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    for (let i = 0; i < matrices.length; i++) {
        mesh.setMatrixAt(i, matrices[i]);
    }

    mesh.instanceMatrix.needsUpdate = true;
    scene.add(mesh);
}

function createMarkers() {
    markersLayer.innerHTML = '';
    markers = [];

    if (!pointsData || pointsData.length === 0 || currentFractalPositions.length === 0) return;

    // Logic: "fill the lowest level first" -> Largest blocks first
    // Sort by size descending
    // Filter out center cubes (at origin) as they don't have an outward-facing side
    const sortedPositions = [...currentFractalPositions]
        .filter(block => {
            const c = block.center;
            return !(Math.abs(c.x) < 0.01 && Math.abs(c.y) < 0.01 && Math.abs(c.z) < 0.01);
        })
        .sort((a, b) => b.size - a.size);

    pointsData.forEach((data, index) => {
        if (index >= sortedPositions.length) return;

        const block = sortedPositions[index];
        const center = block.center;
        const halfSize = block.size / 2;

        // Determine which face is "outward" (facing away from origin)
        // Find the axis with the largest absolute value in the center position
        const absX = Math.abs(center.x);
        const absY = Math.abs(center.y);
        const absZ = Math.abs(center.z);

        let faceOffset = new THREE.Vector3(0, 0, 0);

        if (absX >= absY && absX >= absZ) {
            // X-axis is most outward
            faceOffset.x = Math.sign(center.x) * halfSize;
        } else if (absY >= absX && absY >= absZ) {
            // Y-axis is most outward
            faceOffset.y = Math.sign(center.y) * halfSize;
        } else {
            // Z-axis is most outward
            faceOffset.z = Math.sign(center.z) * halfSize;
        }

        const position = center.clone().add(faceOffset);

        const wrapper = document.createElement('div');
        wrapper.className = 'marker-wrapper';

        const btn = document.createElement('div');
        btn.className = 'marker-btn';
        btn.innerText = '+';
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            showInfoCard(data);
        });
        wrapper.appendChild(btn);

        if (data.short) {
            const label = document.createElement('div');
            label.className = 'marker-label';
            label.innerText = data.short;
            wrapper.appendChild(label);
        }

        markersLayer.appendChild(wrapper);

        markers.push({
            element: wrapper,
            baseVector: position
        });
    });
}

function showInfoCard(data) {
    cardTitle.innerText = data.title;

    if (data.body) {
        cardBody.innerText = data.body;
        cardBody.style.display = 'block';
    } else {
        cardBody.style.display = 'none';
    }

    cardLink.href = data.link;

    if (data.redirect) {
        cardLink.target = "_self";
    } else {
        cardLink.target = "_blank";
    }

    infoCard.classList.add('active');

    if (params.autoRotate) {
        controls.autoRotate = false;
    }
}

function updateMarkers() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const widthHalf = width / 2;
    const heightHalf = height / 2;

    markers.forEach(marker => {
        const pos = marker.baseVector.clone();
        pos.project(camera);

        if (pos.z > 1) {
            marker.element.style.display = 'none';
        } else {
            marker.element.style.display = 'flex';

            const x = (pos.x * widthHalf) + widthHalf;
            const y = -(pos.y * heightHalf) + heightHalf;

            marker.element.style.left = `${x}px`;
            marker.element.style.top = `${y}px`;
        }
    });
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);
    if (controls) controls.update();
    if (camera && markers.length > 0) updateMarkers();
    if (renderer && scene && camera) renderer.render(scene, camera);
}
