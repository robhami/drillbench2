import React from 'react';

import './Workspace.css';
import Widget from './Widget';

const Workspace = ({ bha }) => {
    const [widgets, setWidgets] = React.useState([
        {
            id: 'bhaSummary1',
            type: 'bhaSummary',
            x: 40,
            y: 40,
            width: 620,
            visible: true,
            minimized: false
        }
    ]);

    return (
        <div className="wb2">
            <aside className="wb2Sidebar">
                <div className="wb2SidebarBrand">
                    WB
                </div>

                <button
                    type="button"
                    onClick={() =>
                        setWidgets(current =>
                            current.map(widget =>
                                widget.type === 'bhaSummary'
                                    ? { ...widget, visible: true }
                                    : widget
                            )
                        )
                    }
                >
                    BHA
                </button>

                <button type="button">
                    Analysis
                </button>

                <button type="button">
                    Results
                </button>
            </aside>

            <main className="wb2Canvas">
                {widgets
                    .filter((widget) => widget.visible)
                    .map((widget) => (
                        <Widget
                            key={widget.id}
                            widget={widget}
                            bha={bha}

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