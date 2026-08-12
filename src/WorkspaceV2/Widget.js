import React from 'react';
import Draggable from 'react-draggable';

import WidgetRegistry from './WidgetRegistry';

const Widget = ({
    widget,
    bha,
    onClose
}) => {
    const registryEntry =
        WidgetRegistry[widget.type];

    if (!registryEntry) {
        return null;
    }

    const Component =
        registryEntry.component;

    return (
        <Draggable
            handle=".wb2WidgetHeader"
            defaultPosition={{
                x: widget.x ?? 40,
                y: widget.y ?? 40
            }}
        >
            <section
                className="wb2Widget"
                style={{
                    width: widget.width || 620
                }}
            >
                <header className="wb2WidgetHeader">
                    <span>
                        {registryEntry.title}
                    </span>

                    <div className="wb2WidgetActions">
                        <button
                            type="button"
                            title="Minimize"
                        >
                            −
                        </button>

                        <button
                            type="button"
                            title="Close"
                            onClick={() => onClose(widget.id)}
                        >
                            ×
                        </button>
                    </div>
                </header>

                <div className="wb2WidgetBody">
                    <Component bha={bha} />
                </div>
            </section>
        </Draggable>
    );
};

export default Widget;