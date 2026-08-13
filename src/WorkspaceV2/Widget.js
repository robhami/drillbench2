import React from 'react';
import { Rnd } from 'react-rnd';
import WidgetRegistry from './WidgetRegistry';

const Widget = ({
    widget,
    bha,
    canvasRef,
    onClose,
    onFocus,
    onMove,
    onResize,
    onMinimize,
    onRestore
}) => {
    const registryEntry =
        WidgetRegistry[widget.type];

    if (!registryEntry) {
        return null;
    }

    const Component =
        registryEntry.component;

    const minimizedHeight = 36;
    const minimizedMargin = 8;
    const canvasHeight =
        canvasRef?.current?.clientHeight || window.innerHeight;

    const minimizedY =
        canvasHeight -
        minimizedHeight -
        minimizedMargin;


    return (
        <Rnd
            size={{
                width: widget.minimized
                    ? 260
                    : widget.width || 620,
                height: widget.minimized
                    ? 36
                    : widget.height || 350
            }}

            position={{
                x: widget.minimized
                    ? 12
                    : widget.x ?? 40,

                y: widget.minimized
                    ? minimizedY
                    : widget.y ?? 40
            }}

            minWidth={widget.minimized ? 260 : 280}
            minHeight={widget.minimized ? 36 : 120}

            enableResizing={!widget.minimized}

            bounds="parent"

            dragHandleClassName="wb2WidgetHeader"
            cancel=".wb2WidgetActions"

            style={{
                zIndex: widget.minimized
                    ? 10000
                    : widget.z || 1
            }}

            onMouseDown={() => {
                if (!widget.minimized) {
                    onFocus(widget.id);
                }
            }}

            onDragStop={(e, data) => {
                if (!widget.minimized) {
                    onMove(
                        widget.id,
                        data.x,
                        data.y
                    );
                }
            }}

            onResizeStop={(
                e,
                direction,
                ref,
                delta,
                position
            ) => {
                if (widget.minimized) {
                    return;
                }

                onResize(
                    widget.id,
                    parseInt(ref.style.width, 10),
                    parseInt(ref.style.height, 10)
                );

                onMove(
                    widget.id,
                    position.x,
                    position.y
                );
            }}
        >
            <section className="wb2Widget">
                <header className="wb2WidgetHeader">
                    <div className="wb2WidgetTitle">
                        <span className="wb2DragHandle">⋮⋮</span>
                        <span>{registryEntry.title}</span>
                    </div>

                    <div className="wb2WidgetActions">
                        <button
                            type="button"
                            title={widget.minimized ? 'Restore' : 'Minimize'}
                            onClick={() =>
                                widget.minimized
                                    ? onRestore(widget.id)
                                    : onMinimize(widget.id)
                            }
                        >
                            {widget.minimized ? '□' : '−'}
                        </button>

                        <button
                            type="button"
                            title="Close"
                            onClick={() =>
                                onClose(widget.id)
                            }
                        >
                            ×
                        </button>
                    </div>




                </header>
                {!widget.minimized && (
                    <div className="wb2WidgetBody">
                        <Component bha={bha} />
                    </div>
                )}
            </section>
        </Rnd>
    );
};

export default Widget;