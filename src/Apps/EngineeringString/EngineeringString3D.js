import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { getStringDisplayExtent } from './stringDisplayExtent';

const EngineeringString3D = ({ components = [], neutralPointFt = null, jars = [] }) => {
    const mountRef = useRef(null);

    const validComponents = useMemo(() => components.filter(
        (component) =>
            Number(component.length) > 0 &&
            (
                component.selectedToolId ||
                component.toolName ||
                component.category
            )
    ), [components]);

    const hasValidComponents =
        validComponents.length > 0;

    useEffect(() => {
        const mount = mountRef.current;

        if (!mount) return;
        if (!hasValidComponents) return;

        const scene = new THREE.Scene();

        scene.background =
            new THREE.Color(0xf5f7fa);

        const width =
            mount.clientWidth || 340;

        const height =
            mount.clientHeight || 600;

        const aspect =
            width / height;

        const viewSize = 5.2;

        const camera =
            new THREE.OrthographicCamera(
                -viewSize * aspect,
                viewSize * aspect,
                viewSize,
                -viewSize,
                0.1,
                100
            );

        camera.position.set(
            5,
            1,
            18
        );

        camera.lookAt(
            0,
            0,
            0
        );

        const renderer =
            new THREE.WebGLRenderer({
                antialias: true
            });

        renderer.setPixelRatio(
            window.devicePixelRatio
        );

        renderer.setSize(
            width,
            height,
            false
        );

        renderer.domElement.style.width = '100%';
        renderer.domElement.style.height = '100%';
        renderer.domElement.style.display = 'block';

        mount.appendChild(
            renderer.domElement
        );

        const ambientLight =
            new THREE.AmbientLight(
                0xffffff,
                1.5
            );

        scene.add(
            ambientLight
        );

        const directionalLight =
            new THREE.DirectionalLight(
                0xffffff,
                2.2
            );

        directionalLight.position.set(
            5,
            8,
            10
        );

        scene.add(
            directionalLight
        );

        const stringGroup =
            new THREE.Group();

        scene.add(
            stringGroup
        );

        const totalLength = Math.max(...validComponents.map(component => component.endFromBit));
        // Extend only as necessary to show the requested zone; preserve BHA focus.
        const zoneEndFt = Math.max(0, ...jars.map(jar => jar.avoidanceZone?.upperFt || 0));
        const visibleEndFt = Math.min(totalLength, Math.max(getStringDisplayExtent(validComponents, neutralPointFt), zoneEndFt));

        const displayLength = 8.5;

        const lengthScale =
            visibleEndFt > 0
                ? displayLength / visibleEndFt
                : 1;

        jars.forEach(jar => {
            const zone = jar.avoidanceZone;
            if (!zone) return;
            const topFt = Math.min(zone.upperFt, visibleEndFt);
            const bottomFt = Math.max(0, zone.lowerFt);
            if (!(topFt > bottomFt)) return;
            const zoneMesh = new THREE.Mesh(
                new THREE.CylinderGeometry(0.62, 0.62, (topFt - bottomFt) * lengthScale, 32, 1, true),
                new THREE.MeshBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false })
            );
            zoneMesh.position.y = -displayLength / 2 + (bottomFt + topFt) / 2 * lengthScale;
            stringGroup.add(zoneMesh);
            [bottomFt, topFt].forEach(positionFt => {
                const edge = new THREE.Mesh(
                    new THREE.TorusGeometry(0.62, 0.025, 8, 48),
                    new THREE.MeshBasicMaterial({ color: 0xb45309 })
                );
                edge.rotation.x = Math.PI / 2;
                edge.position.y = -displayLength / 2 + positionFt * lengthScale;
                stringGroup.add(edge);
            });
        });

        const getComponentColor = (
            component
        ) => {
            const bottomForce =
                Number(
                    component.bottomAxialForce
                ) || 0;

            const topForce =
                Number(
                    component.topAxialForce
                ) || 0;

            if (
                bottomForce > 0 &&
                topForce > 0
            ) {
                return 0xd96b6b;
            }

            if (
                bottomForce < 0 &&
                topForce < 0
            ) {
                return 0x6f9ed6;
            }

            return 0xc6b66b;
        };

        // Put jars left and NP right; label offsets do not move physical markers.
        const addLabel = (text, y, color, side, dimension = false) => {
            const canvas = document.createElement('canvas');
            canvas.width = dimension ? 256 : 128;
            canvas.height = 64;
            const context = canvas.getContext('2d');
            context.fillStyle = 'rgba(245,247,250,0.95)';
            context.fillRect(0, 0, canvas.width, canvas.height);
            context.font = 'bold 36px sans-serif';
            context.fillStyle = color;
            context.textAlign = 'center';
            context.textBaseline = 'middle';
            context.fillText(text, canvas.width / 2, canvas.height / 2);
            const texture = new THREE.CanvasTexture(canvas);
            const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false }));
            label.scale.set(dimension ? 1.6 : 0.8, 0.4, 1);
            label.position.set(side * (dimension ? 2.0 : text === 'NP' ? 1.2 : 0.95), y, 0);
            stringGroup.add(label);
        };

        validComponents.forEach(
            (component) => {
                const visibleTopFt = Math.min(component.endFromBit, visibleEndFt);
                const visibleLengthFt = visibleTopFt - component.startFromBit;
                if (!(visibleLengthFt > 0)) return;
                const length =
                    Number(
                        component.length
                    ) || 0;

                const od =
                    Number(
                        component.od
                    ) || 5;

                const isJar = String(component.category || '').toUpperCase() === 'JAR';

                const displayComponentLength =
                    visibleLengthFt * lengthScale;

                const radius =
                    Math.max(
                        Math.min(
                            od * 0.035,
                            0.35
                        ),
                        0.08
                    );

                const geometry =
                    new THREE.CylinderGeometry(
                        radius,
                        radius,
                        displayComponentLength,
                        32
                    );

                const material =
                    new THREE.MeshStandardMaterial({
                        color:
                            isJar ? 0x00897b : getComponentColor(
                                component
                            ),
                        metalness: 0.55,
                        roughness: 0.28
                    });

                const mesh =
                    new THREE.Mesh(
                        geometry,
                        material
                    );

                mesh.position.y =
                    -displayLength / 2 +
                    (component.startFromBit + visibleLengthFt / 2) *
                    lengthScale;

                mesh.userData = {
                    rowId:
                        component.rowId,

                    toolName:
                        component.toolName ||
                        component.category,

                    length,
                    od,

                    topAxialForce:
                        component.topAxialForce,

                    bottomAxialForce:
                        component.bottomAxialForce
                };

                stringGroup.add(
                    mesh
                );

                if (isJar) {
                    addLabel('JAR', mesh.position.y, '#00695c', -1);
                }
            }
        );

        if (visibleEndFt < totalLength) {
            addLabel('//', displayLength / 2 + 0.1, '#1f2937', 0);
        }

        if (neutralPointFt !== null && Number.isFinite(neutralPointFt)) {
            const marker = new THREE.Mesh(
                new THREE.TorusGeometry(0.48, 0.055, 12, 48),
                new THREE.MeshBasicMaterial({ color: 0x7c3aed })
            );
            marker.rotation.x = Math.PI / 2;
            marker.position.y = -displayLength / 2 + neutralPointFt * lengthScale;
            stringGroup.add(marker);
            addLabel('NP', marker.position.y, '#5b21b6', 1);
            jars.forEach(jar => {
                if (jar.distanceFromNeutralFt === null || jar.centreFt > visibleEndFt) return;
                const jarY = -displayLength / 2 + jar.centreFt * lengthScale;
                // Clear the NP sprite background, including the endpoint tick.
                const dimensionX = 2.15;
                const points = [
                    new THREE.Vector3(dimensionX - 0.1, marker.position.y, 0),
                    new THREE.Vector3(dimensionX + 0.1, marker.position.y, 0),
                    new THREE.Vector3(dimensionX, marker.position.y, 0),
                    new THREE.Vector3(dimensionX, jarY, 0),
                    new THREE.Vector3(dimensionX - 0.1, jarY, 0),
                    new THREE.Vector3(dimensionX + 0.1, jarY, 0)
                ];
                stringGroup.add(new THREE.Line(
                    new THREE.BufferGeometry().setFromPoints(points),
                    new THREE.LineBasicMaterial({ color: 0x334155 })
                ));
                addLabel(`${Math.abs(jar.distanceFromNeutralFt).toFixed(1)} ft`, (marker.position.y + jarY) / 2, '#1f2937', 1, true);
            });
        }

        const bitGeometry =
            new THREE.CylinderGeometry(
                0.75,
                0.5,
                0.4,
                12
            );

        const bitMaterial =
            new THREE.MeshStandardMaterial({
                color: 0x555555,
                metalness: 0.7,
                roughness: 0.22
            });

        const bitMesh =
            new THREE.Mesh(
                bitGeometry,
                bitMaterial
            );

        bitMesh.position.y =
            -displayLength / 2 -
            0.22;

        stringGroup.add(
            bitMesh
        );

        stringGroup.rotation.x = 0;
        stringGroup.rotation.y = -0.35;

        let isDragging = false;
        let previousX = 0;
        let previousY = 0;

        const onMouseDown = (
            event
        ) => {
            isDragging = true;

            previousX =
                event.clientX;

            previousY =
                event.clientY;
        };

        const onMouseMove = (
            event
        ) => {
            if (!isDragging) return;

            const deltaX =
                event.clientX -
                previousX;

            const deltaY =
                event.clientY -
                previousY;

            stringGroup.rotation.y +=
                deltaX * 0.01;

            stringGroup.rotation.x +=
                deltaY * 0.01;

            previousX =
                event.clientX;

            previousY =
                event.clientY;
        };

        const onMouseUp = () => {
            isDragging = false;
        };

        let zoom = 1;

        const onWheel = (
            event
        ) => {
            event.preventDefault();

            zoom +=
                event.deltaY * 0.001;

            zoom =
                Math.max(
                    0.45,
                    Math.min(
                        zoom,
                        2.2
                    )
                );

            camera.zoom =
                1 / zoom;

            camera.updateProjectionMatrix();
        };

        renderer.domElement.addEventListener(
            'mousedown',
            onMouseDown
        );

        renderer.domElement.addEventListener(
            'mousemove',
            onMouseMove
        );

        renderer.domElement.addEventListener(
            'wheel',
            onWheel,
            {
                passive: false
            }
        );

        window.addEventListener(
            'mouseup',
            onMouseUp
        );

        let animationFrameId;

        const animate = () => {
            renderer.render(
                scene,
                camera
            );

            animationFrameId =
                requestAnimationFrame(
                    animate
                );
        };

        animate();

        const onResize = () => {
            const newWidth =
                mount.clientWidth;

            const newHeight =
                mount.clientHeight;

            if (
                !newWidth ||
                !newHeight
            ) {
                return;
            }

            const newAspect =
                newWidth /
                newHeight;

            camera.left =
                -viewSize *
                newAspect;

            camera.right =
                viewSize *
                newAspect;

            camera.top =
                viewSize;

            camera.bottom =
                -viewSize;

            camera.updateProjectionMatrix();

            renderer.setSize(
                newWidth,
                newHeight,
                false
            );
        };

        let resizeFrame;

        const resizeObserver =
            new ResizeObserver(() => {
                cancelAnimationFrame(
                    resizeFrame
                );

                resizeFrame =
                    requestAnimationFrame(
                        onResize
                    );
            });

        resizeObserver.observe(
            mount
        );

        return () => {
            cancelAnimationFrame(
                animationFrameId
            );

            cancelAnimationFrame(
                resizeFrame
            );

            resizeObserver.disconnect();

            window.removeEventListener(
                'mouseup',
                onMouseUp
            );

            renderer.domElement.removeEventListener(
                'mousedown',
                onMouseDown
            );

            renderer.domElement.removeEventListener(
                'mousemove',
                onMouseMove
            );

            renderer.domElement.removeEventListener(
                'wheel',
                onWheel
            );

            stringGroup.traverse(
                (object) => {
                    if (
                        object.geometry
                    ) {
                        object.geometry.dispose();
                    }

                    if (
                        object.material
                    ) {
                        object.material.map?.dispose();
                        object.material.dispose();
                    }
                }
            );

            renderer.dispose();

            if (
                mount.contains(
                    renderer.domElement
                )
            ) {
                mount.removeChild(
                    renderer.domElement
                );
            }
        };
    }, [
        validComponents,
        neutralPointFt,
        jars,
        hasValidComponents
    ]);

    if (!hasValidComponents) {
        return (
            <div className="engineeringStringEmpty">
                Add BHA components to view the engineering string.
            </div>
        );
    }

    return (
        <div
            ref={mountRef}
            className="engineeringString3D"
            style={{ flex: '1 1 0' }}
        />
    );
};

export default EngineeringString3D;
