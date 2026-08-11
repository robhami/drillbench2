import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

const EngineeringString3D = ({ engModel }) => {
    const mountRef = useRef(null);

    useEffect(() => {
        const mount = mountRef.current;

        if (!mount) return;

        const components =
            engModel?.axialLoads?.components || [];

        if (components.length === 0) return;

        const scene = new THREE.Scene();

        scene.background =
            new THREE.Color(0xf5f7fa);

        const width =
            mount.clientWidth || 340;

        const height =
            mount.clientHeight || 600;

        const aspect =
            width / height;

        const viewSize = 6.5;

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
            height
        );

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

        const totalLength =
            Number(
                engModel?.positions?.totalLength
            ) || 0;

        const displayLength = 11.5;

        const lengthScale =
            totalLength > 0
                ? displayLength / totalLength
                : 1;

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

        components.forEach(
            (component) => {
                const length =
                    Number(
                        component.length
                    ) || 0;

                const od =
                    Number(
                        component.od
                    ) || 5;

                const centreFromBit =
                    Number(
                        component.centreFromBit
                    ) || 0;

                const displayComponentLength =
                    Math.max(
                        length * lengthScale,
                        0.05
                    );

                const radius = Math.max(
                    Math.min(od * 0.035, 0.35),
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
                            getComponentColor(
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
                    centreFromBit *
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
            }
        );

        /*
         * Simple bit
         */

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

        /*
         * Slight 3D angle
         */

        stringGroup.rotation.x = 0;
        stringGroup.rotation.y = -0.35;

        /*
         * Drag controls
         */

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

        /*
         * Zoom
         */

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

        /*
         * Animation
         */

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

        /*
         * Resize
         */

        const onResize = () => {
            const newWidth =
                mount.clientWidth;

            const newHeight =
                mount.clientHeight;

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
                newHeight
            );
        };

        window.addEventListener(
            'resize',
            onResize
        );

        /*
         * Cleanup
         */

        return () => {
            cancelAnimationFrame(
                animationFrameId
            );

            window.removeEventListener(
                'resize',
                onResize
            );

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
    }, [engModel]);

    return (
        <div
            ref={mountRef}
            className="engineeringString3D"
        />
    );
};

export default EngineeringString3D;