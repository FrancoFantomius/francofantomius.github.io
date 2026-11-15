import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import '@francofantomius/material-components/dialog';
import { MarkerManager } from './markers.js';
import { SettingsManager } from './settings.js';

let pointsData = [];
let scene, camera, renderer, controls;
let mesh; 
let geometry, material;

const params = {
    depth: 1, 
    color: '#0044aa',
    autoRotate: false, 
    size: 40
};

const markerManager = new MarkerManager({
    getAutoRotate: () => params.autoRotate
});

function getThemeBackgroundColor(isDark) {
    return isDark ? 0x111318 : 0xf7f7f7;
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

const baseTetrahedron = new THREE.TetrahedronGeometry(1);
const tVerts = [
    new THREE.Vector3(1, 1, 1),
    new THREE.Vector3(-1, -1, 1),
    new THREE.Vector3(-1, 1, -1),
    new THREE.Vector3(1, -1, -1)
];

init();
animate();

async function init() {
    try {
        const response = await fetch('data/points.json');
        pointsData = await response.json();
    } catch (error) {
        console.error("Failed to load points data:", error);
    }

    const container = document.getElementById('canvas-container');
    const isDarkInitial = document.documentElement.getAttribute('data-theme') === 'dark';
    const initialBg = getThemeBackgroundColor(isDarkInitial);
    scene = new THREE.Scene();
    scene.background = new THREE.Color(initialBg);
    scene.fog = new THREE.Fog(initialBg, 50, 150);

    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 40, 80);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = false;
    controls.dampingFactor = 0.05;
    controls.autoRotate = params.autoRotate;
    controls.autoRotateSpeed = 2.0;

    markerManager.setControls(controls);

    const ambientLight = new THREE.AmbientLight(0xffffff, 1.5); 
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 2.5);
    dirLight.position.set(10, 20, 10);
    dirLight.castShadow = true;
    scene.add(dirLight);

    const pointLight = new THREE.PointLight(0x00aaff, 1, 100);
    pointLight.position.set(-10, -10, -10);
    scene.add(pointLight);

    geometry = new THREE.TetrahedronGeometry(1); 
    
    updateMaterial();
    generateFractal();
    createMarkers();

    startLevelCycle();

    window.addEventListener('resize', onWindowResize);
}

function getFractalVertices(targetDepth) {
    const positions = [];

    function traverse(center, radius, currentLevel) {
        if (currentLevel === targetDepth) {
            for (let i = 0; i < 4; i++) {
                const vertexPos = tVerts[i].clone().normalize().multiplyScalar(radius).add(center);
                positions.push(vertexPos);
            }
            return;
        }

        const nextRadius = radius / 2;
        for (let i = 0; i < 4; i++) {
            const offset = tVerts[i].clone().normalize().multiplyScalar(radius / 2);
            traverse(center.clone().add(offset), nextRadius, currentLevel + 1);
        }
    }

    traverse(new THREE.Vector3(0,0,0), 1, 0);
    return positions;
}

function createMarkers() {
    if (!pointsData || pointsData.length === 0) return;

    const totalNeeded = pointsData.length;
    const availablePositions = [];
    
    const maxSearchDepth = 3; 
    
    for (let d = 0; d <= maxSearchDepth; d++) {
        const levelPoints = getFractalVertices(d);
        
        for (let point of levelPoints) {
            let isDuplicate = false;
            
            for (let existing of availablePositions) {
                if (point.distanceTo(existing) < 0.01) {
                    isDuplicate = true;
                    break;
                }
            }
            
            if (!isDuplicate) {
                availablePositions.push(point);
            }
        }

        if (availablePositions.length >= totalNeeded) {
            break;
        }
    }

    markerManager.createMarkers(pointsData, availablePositions);
}

function startLevelCycle() {
    let direction = 1;

    setInterval(() => {
        params.depth += direction;

        if (params.depth >= 7) {
            params.depth = 7;
            direction = -1;
        } else if (params.depth <= 1) {
            params.depth = 1;
            direction = 1;
        }

        requestAnimationFrame(() => {
            generateFractal();
        });

    }, 2000); 
}

function updateMaterial() {
    if (mesh) scene.remove(mesh);
    
    material = new THREE.MeshStandardMaterial({
        color: new THREE.Color(params.color),
        roughness: 0.3,
        metalness: 0.5,
        flatShading: true
    });
    
    generateFractal();
}

function generateFractal() {
    if (mesh) {
        scene.remove(mesh);
        mesh.dispose();
    }

    const count = Math.pow(4, params.depth);

    mesh = new THREE.InstancedMesh(geometry, material, count);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    const dummy = new THREE.Object3D();
    let index = 0;

    function recurse(center, radius, currentDepth) {
        if (currentDepth === 0) {
            dummy.position.copy(center);
            dummy.scale.set(radius, radius, radius);
            dummy.updateMatrix();
            mesh.setMatrixAt(index++, dummy.matrix);
            return;
        }

        const nextRadius = radius / 2;
        const nextDepth = currentDepth - 1;
        
        for (let i = 0; i < 4; i++) {
            const offset = tVerts[i].clone().normalize().multiplyScalar(radius / 2);
            const newCenter = center.clone().add(offset);
            recurse(newCenter, nextRadius, nextDepth);
        }
    }

    recurse(new THREE.Vector3(0, 0, 0), params.size, params.depth);

    mesh.instanceMatrix.needsUpdate = true;
    scene.add(mesh);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);
    if (controls) controls.update();
    markerManager.update(camera, params.size);
    if (renderer && scene && camera) renderer.render(scene, camera);
}
