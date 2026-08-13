import React from 'react';

import './Workspace.css';
import Widget from './Widget';

const WORKSPACE_STORAGE_KEY = 'wellbenchWorkspaceV2';

const Workspace = ({ bha }) => {

    const canvasRef = React.useRef(null);






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
        }
    ];

    const [widgets, setWidgets] = React.useState(() => {
        const savedWorkspace =
            localStorage.getItem(WORKSPACE_STORAGE_KEY);

        if (!savedWorkspace) {
            return defaultWidgets;
        }

        try {
            return JSON.parse(savedWorkspace);
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

            return currentWidgets.map((widget) =>
                widget.type === type
                    ? {
                        ...widget,
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
                    className={getWidgetState('bhaSummary')}
                    onClick={() =>
                        openWidget('bhaSummary')
                    }
                >
                    BHA
                </button>

                <button type="button">
                    Analysis
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