import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import * as Tone from 'tone';
import * as CANNON from 'cannon-es';

const CubeSynth = () => {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const sphereRef = useRef(null);
  const synthRef = useRef(null);
  const worldRef = useRef(null);
  const spheresRef = useRef([]);
  const physicsBodiesRef = useRef([]);
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const pressStartTimeRef = useRef(0);
  const currentVolumeRef = useRef(-20);
  const currentNoteRef = useRef("C4");
  const [volume, setVolume] = useState(-20);
  const [octave, setOctave] = useState(4);
  const [isStarted, setIsStarted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // 모바일 기기 감지
    const checkMobile = () => {
      const userAgent = navigator.userAgent || navigator.vendor || window.opera;
      const mobileRegex = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i;
      setIsMobile(mobileRegex.test(userAgent.toLowerCase()));
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  }, []);

  const startAudio = async () => {
    try {
      // 모바일 브라우저를 위한 오디오 컨텍스트 초기화
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      await audioContext.resume();
      
      // Tone.js 초기화
      await Tone.start();
      setIsStarted(true);
    } catch (error) {
      console.error('Audio initialization failed:', error);
    }
  };

  useEffect(() => {
    if (!isStarted) return;

    // 터치 이벤트 핸들러 추가
    const handleTouchStart = async (event) => {
      if (!isStarted) {
        await startAudio();
      }
    };

    // 터치 이벤트 리스너 등록
    document.addEventListener('touchstart', handleTouchStart, { once: true });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
    };
  }, [isStarted]);

  useEffect(() => {
    if (!isStarted) return;

    // Scene setup
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 15, 0);
    camera.lookAt(0, 0, 0);
    camera.rotation.z = 0;

    const renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mountRef.current.appendChild(renderer.domElement);

    // Physics world setup
    const world = new CANNON.World();
    world.gravity.set(0, -9.82, 0);
    world.broadphase = new CANNON.NaiveBroadphase();
    worldRef.current = world;

    // Create materials
    const sphereMaterial = new CANNON.Material('sphereMaterial');
    const floorPhysicsMaterial = new CANNON.Material('floorPhysicsMaterial');

    // Create contact materials
    const sphereFloorContactMaterial = new CANNON.ContactMaterial(
      sphereMaterial,
      floorPhysicsMaterial,
      {
        friction: 0.2,
        restitution: 0.2
      }
    );

    const sphereSphereContactMaterial = new CANNON.ContactMaterial(
      sphereMaterial,
      sphereMaterial,
      {
        friction: 0.2,
        restitution: 0.3
      }
    );

    world.addContactMaterial(sphereFloorContactMaterial);
    world.addContactMaterial(sphereSphereContactMaterial);

    // Create floor
    const floorGeometry = new THREE.PlaneGeometry(32, 18);
    const floorVisualMaterial = new THREE.MeshToonMaterial({ 
      color: 0xffffff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8
    });
    const floor = new THREE.Mesh(floorGeometry, floorVisualMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -2;
    floor.receiveShadow = true;
    scene.add(floor);

    // Create floor physics body
    const floorShape = new CANNON.Plane();
    const floorBody = new CANNON.Body({
      mass: 0,
      shape: floorShape,
      material: floorPhysicsMaterial
    });
    floorBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
    floorBody.position.set(0, -2, 0);
    world.addBody(floorBody);

    // Create walls
    const wallMaterial = new THREE.MeshToonMaterial({ 
      color: 0xffffff,
      transparent: true,
      opacity: 0.3
    });
    const wallHeight = 8;
    const wallThickness = 1;
    const wallLength = 32;
    const wallWidth = 18;

    // Create wall meshes and physics bodies
    const walls = [
      // North wall
      { pos: [0, wallHeight/2 - 2, -wallWidth/2], rot: [0, 0, 0] },
      // South wall
      { pos: [0, wallHeight/2 - 2, wallWidth/2], rot: [0, 0, 0] },
      // East wall
      { pos: [wallLength/2, wallHeight/2 - 2, 0], rot: [0, Math.PI/2, 0] },
      // West wall
      { pos: [-wallLength/2, wallHeight/2 - 2, 0], rot: [0, Math.PI/2, 0] }
    ];

    // Add ceiling
    const ceilingGeometry = new THREE.PlaneGeometry(wallLength, wallWidth);
    const ceiling = new THREE.Mesh(ceilingGeometry, wallMaterial);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = wallHeight - 2;
    scene.add(ceiling);

    // Add ceiling physics body
    const ceilingShape = new CANNON.Plane();
    const ceilingBody = new CANNON.Body({
      mass: 0,
      shape: ceilingShape,
      material: floorPhysicsMaterial
    });
    ceilingBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), Math.PI / 2);
    ceilingBody.position.set(0, wallHeight - 2, 0);
    world.addBody(ceilingBody);

    walls.forEach(wall => {
      // Visual wall
      const wallGeometry = new THREE.BoxGeometry(wallLength, wallHeight, wallThickness);
      const wallMesh = new THREE.Mesh(wallGeometry, wallMaterial);
      wallMesh.position.set(...wall.pos);
      wallMesh.rotation.set(...wall.rot);
      scene.add(wallMesh);

      // Physics wall
      const wallShape = new CANNON.Box(new CANNON.Vec3(wallLength/2, wallHeight/2, wallThickness/2));
      const wallBody = new CANNON.Body({
        mass: 0,
        shape: wallShape,
        material: floorPhysicsMaterial
      });
      wallBody.position.set(...wall.pos);
      wallBody.quaternion.setFromEuler(...wall.rot);
      world.addBody(wallBody);
    });

    // Create main sphere
    const geometry = new THREE.SphereGeometry(1, 32, 32);
    const material = new THREE.MeshToonMaterial({ 
      color: 0x00ff00,
      flatShading: true
    });
    const sphere = new THREE.Mesh(geometry, material);
    sphere.castShadow = true;
    sphere.receiveShadow = true;
    scene.add(sphere);
    sphereRef.current = sphere;

    // Create physics body for main sphere
    const sphereShape = new CANNON.Sphere(1);
    const sphereBody = new CANNON.Body({
      mass: 5,
      position: new CANNON.Vec3(0, 10, 0),
      shape: sphereShape,
      material: sphereMaterial,
      linearDamping: 0.05,
      angularDamping: 0.05,
      fixedRotation: false
    });
    world.addBody(sphereBody);
    physicsBodiesRef.current.push(sphereBody);

    // Create surrounding spheres
    const surroundingSpheres = [];
    const surroundingBodies = [];
    const numSpheres = 150;
    const maxRadius = 12;
    const minRadius = 2;
    const maxHeight = wallHeight - 4;
    const minHeight = 2;

    // 고무공 재질 생성
    const rubberMaterial = new THREE.MeshToonMaterial({
      color: 0xffffff,
      flatShading: true,
      transparent: true,
      opacity: 0.9,
      shininess: 20,
      specular: 0x222222
    });

    for (let i = 0; i < numSpheres; i++) {
      const angle = Math.random() * Math.PI * 2;
      const distance = minRadius + Math.random() * (maxRadius - minRadius);
      const x = Math.cos(angle) * distance;
      const z = Math.sin(angle) * distance;
      const y = minHeight + Math.random() * (maxHeight - minHeight);

      const surroundingSphere = new THREE.Mesh(
        geometry,
        rubberMaterial
      );
      surroundingSphere.position.set(x, y, z);
      surroundingSphere.castShadow = true;
      surroundingSphere.receiveShadow = true;
      scene.add(surroundingSphere);
      surroundingSpheres.push(surroundingSphere);

      const body = new CANNON.Body({
        mass: 1,
        position: new CANNON.Vec3(x, y, z),
        shape: sphereShape,
        material: sphereMaterial,
        linearDamping: 0.05,
        angularDamping: 0.05,
        fixedRotation: false
      });
      world.addBody(body);
      surroundingBodies.push(body);
    }

    spheresRef.current = surroundingSpheres;
    physicsBodiesRef.current.push(...surroundingBodies);

    // Add lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 50;
    directionalLight.shadow.camera.left = -10;
    directionalLight.shadow.camera.right = 10;
    directionalLight.shadow.camera.top = 10;
    directionalLight.shadow.camera.bottom = -10;
    scene.add(directionalLight);

    // 천장 조명 추가
    const ceilingLight = new THREE.DirectionalLight(0xffffff, 0.6);
    ceilingLight.position.set(0, wallHeight - 1, 0);
    ceilingLight.castShadow = true;
    ceilingLight.shadow.mapSize.width = 2048;
    ceilingLight.shadow.mapSize.height = 2048;
    ceilingLight.shadow.camera.near = 0.5;
    ceilingLight.shadow.camera.far = 50;
    ceilingLight.shadow.camera.left = -10;
    ceilingLight.shadow.camera.right = 10;
    ceilingLight.shadow.camera.top = 10;
    ceilingLight.shadow.camera.bottom = -10;
    scene.add(ceilingLight);

    // Add toon light helper
    const toonLight = new THREE.DirectionalLight(0xffffff, 0.5);
    toonLight.position.set(-5, 10, -5);
    toonLight.castShadow = true;
    scene.add(toonLight);

    // Audio setup
    const synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: {
        type: "sine",
        partials: [0, 2, 3, 4],
        phase: 0,
        harmonicity: 0.5
      },
      envelope: {
        attack: 0.005,
        decay: 0.1,
        sustain: 0.3,
        release: 1
      },
      portamento: 0.05
    }).toDestination();
    synthRef.current = synth;

    // Create collision sound synth
    const collisionSynth = new Tone.Synth({
      oscillator: {
        type: "sine"
      },
      envelope: {
        attack: 0.001,
        decay: 0.2,
        sustain: 0,
        release: 0.1
      }
    }).toDestination();

    // Add collision event listeners
    let lastCollisionTime = 0;
    const collisionCooldown = 100; // 100ms cooldown between collisions

    world.addEventListener('beginContact', (event) => {
      const bodyA = event.bodyA;
      const bodyB = event.bodyB;
      
      if (bodyA.mass === 0 || bodyB.mass === 0) return;
      
      const relativeVelocity = bodyA.velocity.vsub(bodyB.velocity);
      const impactVelocity = relativeVelocity.length();
      
      const currentTime = Date.now();
      if (impactVelocity > 1 && (currentTime - lastCollisionTime) > collisionCooldown) {
        lastCollisionTime = currentTime;
        
        const note = Math.min(notes.length - 1, Math.floor(impactVelocity * 2));
        const volume = Math.min(0, -20 + impactVelocity * 5);
        
        try {
          collisionSynth.volume.value = volume;
          collisionSynth.triggerAttackRelease(notes[note], "32n");
        } catch (error) {
          console.log("Sound trigger error:", error);
        }
      }
    });

    // 음계 배열 (C4부터 시작하는 2옥타브)
    const notes = [
      "C4", "C#4", "D4", "D#4", "E4", "F4", "F#4", "G4", "G#4", "A4", "A#4", "B4",
      "C5", "C#5", "D5", "D#5", "E5", "F5", "F#5", "G5", "G#5", "A5", "A#5", "B5"
    ];

    // 코드 정의
    const chords = {
      major: [0, 4, 7],
      minor: [0, 3, 7],
      diminished: [0, 3, 6],
      augmented: [0, 4, 8],
      sus4: [0, 5, 7],
      sus2: [0, 2, 7]
    };

    function getChordNotes(baseNoteIndex) {
      const chordType = Math.floor((event.clientX - startXRef.current + window.innerWidth/2) / (window.innerWidth/6)) % 6;
      const chordTypes = ['major', 'minor', 'diminished', 'augmented', 'sus4', 'sus2'];
      const selectedChord = chords[chordTypes[chordType]];
      
      return selectedChord.map(interval => {
        const noteIndex = (baseNoteIndex + interval) % notes.length;
        return notes[noteIndex];
      });
    }

    // Mouse interaction
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    function onMouseDown(event) {
      mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObject(sphere);

      if (intersects.length > 0) {
        isDraggingRef.current = true;
        startXRef.current = event.clientX;
        startYRef.current = event.clientY;
        
        sphereRef.current = sphere;
        
        const baseNoteIndex = notes.indexOf(currentNoteRef.current);
        const chordNotes = getChordNotes(baseNoteIndex);
        synth.volume.value = volume / 2;
        synth.triggerAttack(chordNotes);
      }
    }

    function onMouseMove(event) {
      if (isDraggingRef.current) {
        const mouseX = (event.clientX / window.innerWidth) * 2 - 1;
        const mouseY = -(event.clientY / window.innerHeight) * 2 + 1;
        
        const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(new THREE.Vector2(mouseX, mouseY), camera);
        
        const intersectionPoint = new THREE.Vector3();
        raycaster.ray.intersectPlane(plane, intersectionPoint);
        
        const selectedBody = physicsBodiesRef.current[0];
        
        // X와 Z 위치만 업데이트하고 Y는 현재 위치 유지
        selectedBody.position.x = intersectionPoint.x;
        selectedBody.position.z = intersectionPoint.z;
        
        selectedBody.velocity.set(0, 0, 0);
        selectedBody.angularVelocity.set(0, 0, 0);

        sphere.position.copy(selectedBody.position);
        sphere.quaternion.copy(selectedBody.quaternion);

        const totalDeltaY = event.clientY - startYRef.current;
        const noteIndex = Math.floor(Math.abs(totalDeltaY) / 50);
        const newIndex = Math.max(0, Math.min(notes.length - 1, noteIndex));
        const newNote = notes[newIndex];
        
        if (newNote !== currentNoteRef.current) {
          currentNoteRef.current = newNote;
          const baseNoteIndex = notes.indexOf(currentNoteRef.current);
          const chordNotes = getChordNotes(baseNoteIndex);
          synth.releaseAll();
          synth.triggerAttack(chordNotes);
        }
      }
    }

    function onMouseUp() {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        synth.releaseAll();
        synth.volume.value = volume;
        
        // 마우스를 놓으면 중력의 영향을 받도록 설정
        const selectedBody = physicsBodiesRef.current[0];
        selectedBody.velocity.set(0, 0, 0);
      }
    }

    // 마우스 오른쪽 버튼 메뉴 방지
    function onContextMenu(event) {
      event.preventDefault();
    }

    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('contextmenu', onContextMenu);

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    function animate() {
      requestAnimationFrame(animate);
      
      world.step(1/60);
      
      if (sphereRef.current && physicsBodiesRef.current[0]) {
        sphereRef.current.position.copy(physicsBodiesRef.current[0].position);
        sphereRef.current.quaternion.copy(physicsBodiesRef.current[0].quaternion);
      }

      spheresRef.current.forEach((surroundingSphere, index) => {
        if (physicsBodiesRef.current[index + 1]) {
          surroundingSphere.position.copy(physicsBodiesRef.current[index + 1].position);
          surroundingSphere.quaternion.copy(physicsBodiesRef.current[index + 1].quaternion);
        }
      });

      renderer.render(scene, camera);
    }
    animate();

    return () => {
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('resize', handleResize);
      mountRef.current?.removeChild(renderer.domElement);
      synth.dispose();
    };
  }, [isStarted]);

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh' }}>
      {!isStarted ? (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center',
          zIndex: 1000
        }}>
          <button
            onClick={startAudio}
            style={{
              padding: '20px 40px',
              fontSize: '24px',
              backgroundColor: '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              cursor: 'pointer',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
              transition: 'all 0.3s ease'
            }}
            onMouseOver={(e) => e.target.style.backgroundColor = '#45a049'}
            onMouseOut={(e) => e.target.style.backgroundColor = '#4CAF50'}
          >
            {isMobile ? '터치하여 소리 켜기' : 'Start Experience'}
          </button>
          {isMobile && (
            <p style={{ 
              marginTop: '20px', 
              color: '#666',
              fontSize: '16px',
              maxWidth: '300px',
              margin: '20px auto 0'
            }}>
              모바일에서는 소리를 켜야 합니다. 버튼을 터치해주세요.
            </p>
          )}
        </div>
      ) : (
        <>
          <div ref={mountRef} style={{ width: '100%', height: '100%' }} />
        </>
      )}
    </div>
  );
};

export default CubeSynth; 