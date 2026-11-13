import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { getStringDisplayExtent } from './stringDisplayExtent';

const DISPLAY_LENGTH = 8.5;
const COLORS = {
    lowerBha: 0x64748b,
    lowerDc: 0x348b91,
    upperDc: 0xb18b47,
    hwdp: 0x7564a2,
    dp: 0x426b9a,
    jar: 0x1e4c78,
    fallback: 0x9aa3aa,
    np: 0xf28c28,
    jarMarker: 0x2879aa
};
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const category = component => String(component?.category || '').toUpperCase();

export const get3DComponentKind = component => {
    const type = category(component);
    const name = `${component?.toolName || ''} ${component?.name || ''} ${component?.bitType || ''} ${component?.description || ''} ${component?.componentDefinition?.name || ''}`.toUpperCase();
    if (type === 'BIT') return /\bTCI\b|ROLLER\s*CONE|TRICONE/.test(name) ? 'TCI' : /\bPDC\b/.test(name) ? 'PDC' : 'BIT';
    if (['STB', 'STAB', 'STABILIZER'].includes(type)) return 'STB';
    return ['DC', 'DP', 'HWDP', 'JAR'].includes(type) ? type : 'OTHER';
};

export const mapStringPosition = (positionFt, visibleEndFt) =>
    -DISPLAY_LENGTH / 2 + Number(positionFt) * DISPLAY_LENGTH / visibleEndFt;

const sectionContains = (component, section) => {
    if (!(Number(section?.lengthFt) > 0)) return false;
    const start = Number(component.startFromBit);
    const end = Number(component.endFromBit);
    return Number.isFinite(start) && Number.isFinite(end) &&
        start >= Number(section.startFt) - 1e-6 && end <= Number(section.endFt) + 1e-6;
};

// Section membership is presentation-only and reuses the Engineering String's
// authoritative contiguous-DC intervals supplied by EngineeringStringCard.
export const classifyEngineeringSection = (component, components, dcSections) => {
    const type = category(component);
    if (type === 'JAR') return 'jar';
    if (type === 'DP') return 'dp';
    if (type === 'HWDP') return 'hwdp';
    if (type === 'DC') {
        if (sectionContains(component, dcSections?.below)) return 'lowerDc';
        if (sectionContains(component, dcSections?.above)) return 'upperDc';
    }

    const jarRow = components.find(item => category(item) === 'JAR');
    const jarBottomFt = Number(jarRow?.startFromBit);
    const lowerDcBoundaryFt = Number(dcSections?.below?.lengthFt) > 0
        ? Number(dcSections.below.startFt)
        : jarBottomFt;
    const componentEndFt = Number(component.endFromBit);
    if (Number.isFinite(lowerDcBoundaryFt) && Number.isFinite(componentEndFt) &&
        componentEndFt <= lowerDcBoundaryFt + 1e-6 && type !== 'DP') return 'lowerBha';
    return 'fallback';
};

const addLabel = (group, text, color, x, y) => {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 48;
    const context = canvas.getContext('2d');
    if (!context) return null;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.font = '600 30px Arial, sans-serif';
    context.fillStyle = color;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(text, canvas.width / 2, canvas.height / 2);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
    sprite.scale.set(0.62, 0.23, 1);
    sprite.position.set(x, y, 0.55);
    group.add(sprite);
    return sprite;
};

const addLeader = (group, x1, y, x2, color) => {
    const geometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(x1, y, 0.5), new THREE.Vector3(x2, y, 0.5)
    ]);
    group.add(new THREE.Line(geometry, new THREE.LineBasicMaterial({ color })));
};

const EngineeringString3D = ({ components = [], neutralPointFt = null, jars = [], dcSections = {}, fullString = false }) => {
    const mountRef = useRef(null);
    const validComponents = useMemo(() => components.filter(component =>
        Number(component.length) > 0 && (component.selectedToolId || component.toolName || component.category)
    ), [components]);

    useEffect(() => {
        const mount = mountRef.current;
        if (!mount || !validComponents.length) return undefined;

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0xf4f7fa);
        const width = mount.clientWidth || 350;
        const height = mount.clientHeight || 600;
        const camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 100);
        camera.position.set(2.4, 0.65, 16);
        camera.lookAt(0, 0, 0);

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.setSize(width, height, false);
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.05;
        renderer.domElement.style.cssText = 'display:block;width:100%;height:100%';
        renderer.domElement.setAttribute('aria-label', 'Fixed 3D engineering string visualization');
        mount.appendChild(renderer.domElement);

        scene.add(new THREE.AmbientLight(0xffffff, 1.45));
        const key = new THREE.DirectionalLight(0xffffff, 1.15);
        key.position.set(-3, 5, 8);
        scene.add(key);

        const stringGroup = new THREE.Group();
        scene.add(stringGroup);
        const totalLength = Math.max(0, ...validComponents.map(component => Number(component.endFromBit) || 0));
        const zoneEndFt = Math.max(0, ...jars.map(jar => jar.avoidanceZone?.upperFt || 0));
        const visibleEndFt = fullString
            ? totalLength
            : Math.min(totalLength, Math.max(getStringDisplayExtent(validComponents, neutralPointFt), zoneEndFt));
        const scale = visibleEndFt > 0 ? DISPLAY_LENGTH / visibleEndFt : 1;
        const visibleTopY = DISPLAY_LENGTH / 2;
        const visibleBottomY = -DISPLAY_LENGTH / 2;
        const materials = Object.fromEntries(Object.entries(COLORS).map(([keyName, color]) => [
            keyName,
            new THREE.MeshStandardMaterial({ color, metalness: 0.12, roughness: 0.62 })
        ]));

        validComponents.forEach(component => {
            const startFt = Number(component.startFromBit) || 0;
            const sourceEndFt = Number(component.endFromBit) || startFt + Number(component.length);
            const endFt = Math.min(sourceEndFt, visibleEndFt);
            const visibleLengthFt = endFt - startFt;
            if (!(visibleLengthFt > 0)) return;

            const kind = get3DComponentKind(component);
            const height = Math.max(visibleLengthFt * scale, kind === 'BIT' ? 0.12 : 0.001);
            const od = Number(component.od) || 5;
            const radius = clamp(od * 0.035, 0.08, 0.35);
            const section = classifyEngineeringSection(component, validComponents, dcSections);
            const material = materials[section] || materials.fallback;
            const geometry = kind === 'BIT'
                ? new THREE.CylinderGeometry(radius * 0.62, radius * 0.9, height, 16)
                : new THREE.CylinderGeometry(radius, radius, height, 20);
            const mesh = new THREE.Mesh(geometry, section === 'jar' ? materials.jar : material);
            mesh.position.y = mapStringPosition(startFt + visibleLengthFt / 2, visibleEndFt);
            stringGroup.add(mesh);
        });

        // The selected jar and NP are positioned only from the existing physical
        // feet-above-bit coordinates; label offsets never alter those positions.
        const selectedJar = jars[0];
        const jarComponent = validComponents.find(component => category(component) === 'JAR');
        const jarCentreFt = Number(selectedJar?.centreFt);
        if (jarComponent && Number.isFinite(jarCentreFt) && jarCentreFt >= 0 && jarCentreFt <= visibleEndFt) {
            const y = mapStringPosition(jarCentreFt, visibleEndFt);
            const radius = clamp((Number(jarComponent.od) || 5) * 0.035, 0.08, 0.35);
            addLeader(stringGroup, -radius - 0.03, y, -0.74, COLORS.jarMarker);
            addLabel(stringGroup, 'JAR', '#2879aa', -0.98, y);
        }

        if (Number.isFinite(neutralPointFt)) {
            if (neutralPointFt >= 0 && neutralPointFt <= visibleEndFt) {
                const y = mapStringPosition(neutralPointFt, visibleEndFt);
                const radius = clamp((Number(validComponents.find(component =>
                    neutralPointFt >= Number(component.startFromBit) && neutralPointFt <= Number(component.endFromBit))?.od) || 5) * 0.035, 0.08, 0.35);
                addLeader(stringGroup, radius + 0.04, y, 0.74, COLORS.np);
                addLabel(stringGroup, neutralPointFt < 0 ? 'NP ↓' : 'NP ↑', '#e67e22', 0.98, y);
            } else {
                const y = neutralPointFt < 0 ? visibleBottomY + 0.15 : visibleTopY - 0.15;
                addLeader(stringGroup, 0.35, y, 0.74, COLORS.np);
                addLabel(stringGroup, 'NP', '#e67e22', 0.98, y);
            }
        }

        // Compression is indicated by a compact break mark, not an equipment ring.
        if (visibleEndFt < totalLength) {
            const y = visibleTopY - 0.06;
            const geometry = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(-0.22, y + 0.025, 0.4), new THREE.Vector3(-0.07, y - 0.025, 0.4),
                new THREE.Vector3(0.07, y + 0.025, 0.4), new THREE.Vector3(0.22, y - 0.025, 0.4)
            ]);
            stringGroup.add(new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: 0x64748b })));
        }

        renderer.render(scene, camera);
        let resizeFrame;
        const resizeObserver = new ResizeObserver(() => {
            cancelAnimationFrame(resizeFrame);
            resizeFrame = requestAnimationFrame(() => {
                const nextWidth = mount.clientWidth;
                const nextHeight = mount.clientHeight;
                if (!nextWidth || !nextHeight) return;
                camera.aspect = nextWidth / nextHeight;
                camera.updateProjectionMatrix();
                renderer.setSize(nextWidth, nextHeight, false);
                renderer.render(scene, camera);
            });
        });
        resizeObserver.observe(mount);

        return () => {
            cancelAnimationFrame(resizeFrame);
            resizeObserver.disconnect();
            const disposedGeometries = new Set();
            const disposedMaterials = new Set();
            stringGroup.traverse(object => {
                if (object.geometry && !disposedGeometries.has(object.geometry)) {
                    disposedGeometries.add(object.geometry);
                    object.geometry.dispose();
                }
                const objectMaterials = Array.isArray(object.material) ? object.material : [object.material];
                objectMaterials.filter(Boolean).forEach(material => {
                    if (!disposedMaterials.has(material)) {
                        disposedMaterials.add(material);
                        material.map?.dispose();
                        material.dispose();
                    }
                });
            });
            renderer.dispose();
            if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
        };
    }, [validComponents, neutralPointFt, jars, dcSections, fullString]);

    if (!validComponents.length) return <div className="engineeringStringEmpty">Add BHA components to view the engineering string.</div>;
    return <div ref={mountRef} className="engineeringString3D" role="img" aria-label="Fixed 3D engineering string, schematic and not to scale" />;
};

export default EngineeringString3D;
