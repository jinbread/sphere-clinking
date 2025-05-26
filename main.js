import * as THREE from 'three';
import * as Tone from 'tone';

// Scene setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Create cube
const geometry = new THREE.BoxGeometry(1, 1, 1);
const material = new THREE.MeshPhongMaterial({ color: 0x00ff00 });
const cube = new THREE.Mesh(geometry, material);
scene.add(cube);

// Add lights
const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(1, 1, 1);
scene.add(light);
scene.add(new THREE.AmbientLight(0x404040));

// Position camera
camera.position.z = 5;

// Audio setup
const synth = new Tone.Synth().toDestination();
let isPlaying = false;
let baseFrequency = 440; // A4 note
let currentFrequency = baseFrequency;

// Mouse interaction
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let isDragging = false;
let previousMousePosition = { x: 0, y: 0 };

function onMouseDown(event) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(cube);

    if (intersects.length > 0) {
        isDragging = true;
        isPlaying = true;
        previousMousePosition = {
            x: event.clientX,
            y: event.clientY
        };
        synth.triggerAttack(baseFrequency);
    }
}

function onMouseMove(event) {
    if (isDragging) {
        const deltaMove = {
            x: event.clientX - previousMousePosition.x,
            y: event.clientY - previousMousePosition.y
        };

        // X-axis movement changes frequency
        currentFrequency = baseFrequency + deltaMove.x * 2;
        synth.setNote(currentFrequency);

        // Y-axis movement changes volume
        const volume = Math.max(-20, Math.min(0, -deltaMove.y * 0.1));
        synth.volume.value = volume;

        // Z-axis movement changes filter
        const filterFreq = Math.max(100, Math.min(10000, 1000 + deltaMove.y * 10));
        synth.set({ filterFrequency: filterFreq });

        // Move cube with mouse
        const mouseX = (event.clientX / window.innerWidth) * 2 - 1;
        const mouseY = -(event.clientY / window.innerHeight) * 2 + 1;
        
        // Convert mouse position to world coordinates
        const vector = new THREE.Vector3(mouseX, mouseY, 0.5);
        vector.unproject(camera);
        const dir = vector.sub(camera.position).normalize();
        const distance = -camera.position.z / dir.z;
        const pos = camera.position.clone().add(dir.multiplyScalar(distance));
        
        // Update cube position
        cube.position.x = pos.x;
        cube.position.y = pos.y;

        previousMousePosition = {
            x: event.clientX,
            y: event.clientY
        };
    }
}

function onMouseUp() {
    if (isDragging) {
        isDragging = false;
        isPlaying = false;
        synth.triggerRelease();
    }
}

// Event listeners
window.addEventListener('mousedown', onMouseDown);
window.addEventListener('mousemove', onMouseMove);
window.addEventListener('mouseup', onMouseUp);

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Animation loop
function animate() {
    requestAnimationFrame(animate);

    if (isPlaying) {
        cube.rotation.x += 0.01;
        cube.rotation.y += 0.01;
    }

    renderer.render(scene, camera);
}

animate(); 