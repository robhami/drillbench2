import React from 'react';

import './Workspace.css';
import Widget from './Widget';

const WORKSPACE_STORAGE_KEY = 'wellbenchWorkspaceV2';

const Workspace = ({
    bha,
    savedBhas,
    saveBha,
    loadBha,
    newBha,
    duplicateBha,
    deleteBha,
    updateBha,
    updateRow,
    addRow,
    removeRow,
    reorderRows
}) => {
    const canvasRef = React.useRef(null);
    const [drillingMode, setDrillingMode] = React.useState('slide');
    const defaultWidgets = [
        {
            id: 'bhaSummary1',
            type: 'bhaSummary',
            x: 40,
            y: 40,
            width: 620,
            height: 350,
            visible: true,
            minimized: false,
            z: 1
        },
        {
            id: 'engineeringResults1',
            type: 'engineeringResults',
            x: 300,
            y: 120,
            width: 620,
            height: 450,
            visible: true,
            minimized: false,
            z: 2
        },
        {
            id: 'bhaEntry1',
            type: 'bhaEntry',
            x: 80,
            y: 70,
            width: 760,
            height: 520,
            visible: false,
            minimized: false,
            z: 3
        },
        {
            id: 'analysisInputs1',
            type: 'analysisInputs',
            x: 180,
            y: 90,
            width: 470,
            height: 420,
            visible: false,
            minimized: false,
            z: 4
        },
        {
            id: 'engineeringString1',
            type: 'engineeringString',
            x: 950,
            y: 60,
            width: 520,
            height: 620,
            visible: false,
            minimized: false,
            z: 5
        }
    ];

    const jarWidget = { id: 'jarPlacement1', type: 'jarPlacement', x: 330, y: 150, width: 580, height: 430, visible: false, minimized: false, z: 6 };
    defaultWidgets.push(jarWidget);

    const [widgets, setWidgets] = React.useState(() => {
        const savedWorkspace =
            localStorage.getItem(WORKSPACE_STORAGE_KEY);

        if (!savedWorkspace) {
            return defaultWidgets;
        }

        try {
            const parsed = JSON.parse(savedWorkspace);
            if (!Array.isArray(parsed)) return defaultWidgets;
            // Older saved layouts may predate these independently opened windows.
            const missing = defaultWidgets.filter(w =>
                ['engineeringString', 'jarPlacement'].includes(w.type) &&
                !parsed.some(saved => saved.type === w.type)
            );
            return [...parsed, ...missing];
        } catch {
            return defaultWidgets;
        }
    });

    React.useEffect(() => {
        localStorage.setItem(
            WORKSPACE_STORAGE_KEY,
            JSON.stringify(widgets)
        );
    }, [widgets]);

    const resetWorkspace = () => {
        localStorage.removeItem(WORKSPACE_STORAGE_KEY);

        setWidgets(
            defaultWidgets.map((widget) => ({
                ...widget
            }))
        );
    };

    const bringToFront = (id) => {
        setWidgets((currentWidgets) => {
            const highestZ = Math.max(
                ...currentWidgets.map(
                    (widget) => widget.z || 0
                )
            );

            return currentWidgets.map((widget) =>
                widget.id === id
                    ? {
                        ...widget,
                        z: highestZ + 1
                    }
                    : widget
            );
        });
    };

    const openWidget = (type) => {
        setWidgets((currentWidgets) => {
            const highestZ = Math.max(
                ...currentWidgets.map(
                    (widget) => widget.z || 0
                )
            );

            // Rnd's parent bounds constrain dragging, not saved coordinates.
            // Recover String on explicit navigation without resetting the layout.
            const canvasWidth = canvasRef.current?.clientWidth || Math.max(1, window.innerWidth - 72);
            const canvasHeight = canvasRef.current?.clientHeight || Math.max(1, window.innerHeight - 62);
            return currentWidgets.map((widget) =>
                widget.type === type
                    ? {
                        ...widget,
                        ...(type === 'engineeringString' ? {
                            x: Math.min(Math.max(0, Number.isFinite(widget.x) ? widget.x : 40), Math.max(0, canvasWidth - (widget.width || 520))),
                            y: Math.min(Math.max(0, Number.isFinite(widget.y) ? widget.y : 40), Math.max(0, canvasHeight - (widget.height || 620)))
                        } : {}),
                        visible: true,
                        minimized: false,
                        z: highestZ + 1
                    }
                    : widget
            );
        });
    };

    const updateWidgetPosition = (id, x, y) => {
        setWidgets((currentWidgets) =>
            currentWidgets.map((widget) =>
                widget.id === id
                    ? {
                        ...widget,
                        x,
                        y
                    }
                    : widget
            )
        );
    };

    const updateWidgetSize = (
        id,
        width,
        height
    ) => {
        setWidgets((currentWidgets) =>
            currentWidgets.map((widget) =>
                widget.id === id
                    ? {
                        ...widget,
                        width,
                        height
                    }
                    : widget
            )
        );
    };

    const minimizeWidget = (id) => {
        setWidgets((currentWidgets) =>
            currentWidgets.map((widget) =>
                widget.id === id
                    ? {
                        ...widget,
                        minimized: true
                    }
                    : widget
            )
        );
    };

    const restoreWidget = (id) => {
        setWidgets((currentWidgets) => {
            const highestZ = Math.max(
                ...currentWidgets.map(
                    (widget) => widget.z || 0
                )
            );

            return currentWidgets.map((widget) =>
                widget.id === id
                    ? {
                        ...widget,
                        minimized: false,
                        visible: true,
                        z: highestZ + 1
                    }
                    : widget
            );
        });
    };

    const getWidgetState = (type) => {
        const widget = widgets.find(
            (widget) => widget.type === type
        );

        if (!widget || !widget.visible) {
            return 'closed';
        }

        if (widget.minimized) {
            return 'minimized';
        }

        return 'open';
    };

    return (
        <div className="wb2">
            <aside className="wb2Sidebar">
                <div className="wb2SidebarBrand">
                    WB
                </div>

                <button
                    type="button"
                    className={getWidgetState('bhaEntry')}
                    onClick={() =>
                        openWidget('bhaEntry')
                    }
                >
                    BHA
                </button>

                <button
                    type="button"
                    className={getWidgetState('analysisInputs')}
                    onClick={() =>
                        openWidget('analysisInputs')
                    }
                >
                    Analysis
                </button>
                <button
                    type="button"
                    className={getWidgetState('bhaSummary')}
                    onClick={() =>
                        openWidget('bhaSummary')
                    }
                >
                    Summary
                </button>
                <button
                    type="button"
                    className={getWidgetState('engineeringResults')}
                    onClick={() =>
                        openWidget('engineeringResults')
                    }
                >
                    Results
                </button>

                <button
                    type="button"
                    className={getWidgetState('engineeringString')}
                    onClick={() =>
                        openWidget('engineeringString')
                    }
                >
                    String
                </button>

                <button type="button" className={getWidgetState('jarPlacement')} onClick={() => openWidget('jarPlacement')}>Jars</button>

                <button
                    type="button"
                    onClick={resetWorkspace}
                    title="Reset workspace layout"
                >
                    Reset
                </button>
            </aside>

            <main
                ref={canvasRef}
                className="wb2Canvas"
            >
                {widgets
                    .filter((widget) => widget.visible)
                    .map((widget) => (
                        <Widget
                            key={widget.id}
                            widget={widget}
                            bha={bha}
                            drillingMode={drillingMode}
                            setDrillingMode={setDrillingMode}
                            updateBha={updateBha}
                            updateRow={updateRow}
                            addRow={addRow}
                            removeRow={removeRow}
                            reorderRows={reorderRows}
                            canvasRef={canvasRef}
                            onFocus={bringToFront}
                            onMove={updateWidgetPosition}
                            onResize={updateWidgetSize}
                            onMinimize={minimizeWidget}
                            onRestore={restoreWidget}
                            onClose={(id) =>
                                setWidgets((currentWidgets) =>
                                    currentWidgets.map((currentWidget) =>
                                        currentWidget.id === id
                                            ? {
                                                ...currentWidget,
                                                visible: false
                                            }
                                            : currentWidget
                                    )
                                )
                            }
                        />
                    ))}
            </main>
        </div>
    );
};

export default Workspace;
