import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import '@francofantomius/material-components/dialog';
import { MarkerManager } from './markers.js';
import { SettingsManager } from './settings.js';

let scene, camera, renderer, controls;
let mesh;
let geometry, material;
let pointLight;

let pointsData = [];
let currentFractalPositions = [];

const params = {
    depth: 1,
    color: '#22d3ee',
    autoRotate: false,
    size: 20
};

const markerManager = new MarkerManager({
    getAutoRotate: () => params.autoRotate
});

function getThemeBackgroundColor(isDark) {
    return isDark ? 0x111318 : 0xf8fafc;
}

function updateSceneTheme(isDark) {
    if (!scene) return;
    const bgColor = getThemeBackgroundColor(isDark);
    scene.background.set(bgColor);
    if (scene.fog) {
        scene.fog.color.set(bgColor);
    }
}

const settingsManager = new SettingsManager({
    params,
    onColorChange: (newColor) => {
        params.color = newColor;
        if (pointLight) pointLight.color.set(params.color);
        updateMaterial();
    },
    onAutoRotateChange: (autoRotate) => {
        params.autoRotate = autoRotate;
        if (controls) controls.autoRotate = autoRotate;
    },
    onThemeChange: (themeMode, isDark) => {
        updateSceneTheme(isDark);
    }
});

init();
animate();

function init() {
    fetchPoints();

    const container = document.getElementById('canvas-container');
    const isDarkInitial = document.documentElement.getAttribute('data-theme') === 'dark';
    const initialBg = getThemeBackgroundColor(isDarkInitial);
    scene = new THREE.Scene();
    scene.background = new THREE.Color(initialBg);
    scene.fog = new THREE.Fog(initialBg, 40, 120);

    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(40, 40, 40);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = false;
    controls.dampingFactor = 0.9;
    controls.autoRotate = params.autoRotate;
    controls.autoRotateSpeed = 2.0;

    markerManager.setControls(controls);

    const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 2.5);
    dirLight.position.set(20, 30, 20);
    dirLight.castShadow = true;
    scene.add(dirLight);

    const pLight = new THREE.PointLight(params.color, 1, 100);
    pLight.position.set(-20, -20, -20);
    pointLight = pLight;
    scene.add(pointLight);

    geometry = new THREE.BoxGeometry(1, 1, 1);

    updateMaterial();
    generateFractal();
    startLevelCycle();

    window.addEventListener('resize', onWindowResize);
}

async function fetchPoints() {
    try {
        const response = await fetch('data/points_latex.json');
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
    if (!pointsData || pointsData.length === 0 || currentFractalPositions.length === 0) return;

    // Filter out center cubes
    const validBlocks = currentFractalPositions.filter(block => {
        const c = block.center;
        return !(Math.abs(c.x) < 0.01 && Math.abs(c.y) < 0.01 && Math.abs(c.z) < 0.01);
    });

    // Group blocks by size (each size corresponds to a recursive depth level)
    const sizeGroups = new Map();
    for (const block of validBlocks) {
        // Round size to avoid float precision issues when grouping
        const key = block.size.toFixed(4);
        if (!sizeGroups.has(key)) {
            sizeGroups.set(key, { size: block.size, blocks: [] });
        }
        sizeGroups.get(key).blocks.push(block);
    }

    // Sort depth tiers from largest blocks (lowest depth level) to smallest
    const sortedTiers = Array.from(sizeGroups.values()).sort((a, b) => b.size - a.size);

    const totalNeeded = pointsData.length;
    const selectedPositions = [];

    for (const tier of sortedTiers) {
        if (selectedPositions.length >= totalNeeded) break;

        // Compute outward face positions for all blocks in this tier
        const tierCandidates = tier.blocks.map(block => {
            const center = block.center;
            const halfSize = block.size / 2;

            const absX = Math.abs(center.x);
            const absY = Math.abs(center.y);
            const absZ = Math.abs(center.z);

            let faceOffset = new THREE.Vector3(0, 0, 0);
            if (absX >= absY && absX >= absZ) {
                faceOffset.x = Math.sign(center.x) * halfSize;
            } else if (absY >= absX && absY >= absZ) {
                faceOffset.y = Math.sign(center.y) * halfSize;
            } else {
                faceOffset.z = Math.sign(center.z) * halfSize;
            }

            return center.clone().add(faceOffset);
        });

        const neededAtThisTier = Math.min(tierCandidates.length, totalNeeded - selectedPositions.length);
        const chosen = MarkerManager.selectMaxSeparatedPoints(tierCandidates, neededAtThisTier, selectedPositions);
        selectedPositions.push(...chosen);
    }

    markerManager.createMarkers(pointsData, selectedPositions);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);
    if (controls) controls.update();
    markerManager.update(camera);
    if (renderer && scene && camera) renderer.render(scene, camera);
}
