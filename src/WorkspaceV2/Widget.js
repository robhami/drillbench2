import React from 'react';
import { Rnd } from 'react-rnd';
import WidgetRegistry from './WidgetRegistry';
import { buildEngModel } from '../engineering/models/buildEngModel.js';
import { analysisDepth } from '../engineering/bha/analysisDepth';
import { deployDrillstring } from '../engineering/bha/deployDrillstring';
import { assessBhaReadiness } from '../Components/BHABuilder/bhaReadiness';
import { hasSurveyAssociation } from '../Apps/Survey/surveyAssociation';


const Widget = ({
    widget,
    contentOnly = false,
    bha,
    bhaValidationRequest,
    rigLimits,
    updateRigLimits,
    analysisBitMdFt,
    surveyCoverage,
    surfaceReferenceMdFt,
    setSurfaceReferenceMdFt,
    drillingMode,
    setDrillingMode,
    updateBha,
    updateRow,
    addRow,
    removeRow,
    reorderRows,
    canvasRef,
    onClose,
    onFocus,
    onMove,
    onResize,
    onMinimize,
    onRestore
}) => {


    const readiness = React.useMemo(() => assessBhaReadiness(bha), [bha]);
    const requiresCompleteBha = !['bhaEntry', 'analysisInputs', 'survey', 'stringFrame'].includes(widget.type);
    const deployment = React.useMemo(() => {
        const depth = analysisDepth(bha);
        return depth.valid ? deployDrillstring(bha, depth.bitMdFt) : { valid: false, errors: [depth.error] };
    }, [bha]);
    const usesDeployedBha = ['engineeringString', 'engineeringResults', 'jarPlacement'].includes(widget.type);
    const displayBha = usesDeployedBha && deployment.valid ? deployment.bha : bha;
    const engModel = React.useMemo(
        () => readiness.valid ? buildEngModel(displayBha) : null,
        [displayBha, readiness.valid]
    );

    const registryEntry =
        WidgetRegistry[widget.type];

    if (!registryEntry) {
        return null;
    }

    const Component =
        registryEntry.component;


    const missingTrajectory = (bha?.trajectoryMode || hasSurveyAssociation(bha)) && surveyCoverage && !surveyCoverage.covered && ['engineeringString', 'jarClearance'].includes(widget.type);
    const trajectoryMessage = surveyCoverage?.status === 'invalid-required-interval' ? 'Set a valid analysis depth and surface reference MD.' :
        bha?.trajectoryMode === 'vertical' ? 'Set a valid analysis depth in BHA Data Entry.' : 'Directional survey required. Select or import a full-coverage survey in Survey.';
    const content = requiresCompleteBha && !readiness.valid ? <div role="alert"><p>Complete BHA Data Entry before analysis.</p>{readiness.messages.map(message => <p key={message}>{message}</p>)}</div> : usesDeployedBha && !deployment.valid ? <p role="alert">Analysis depth unavailable: {deployment.errors.join(' ')}</p> : missingTrajectory ? <p role="status">{trajectoryMessage}</p> : <Component
                            bha={displayBha}
                            bhaValidationRequest={bhaValidationRequest}
                            rigLimits={rigLimits}
                            updateRigLimits={updateRigLimits}
                            analysisBitMdFt={analysisBitMdFt}
                            surveyCoverage={surveyCoverage}
                            surfaceReferenceMdFt={surfaceReferenceMdFt}
                            setSurfaceReferenceMdFt={setSurfaceReferenceMdFt}
                            engModel={engModel}
                            drillingMode={drillingMode}
                            setDrillingMode={setDrillingMode}
                            updateBha={updateBha}
                            updateRow={updateRow}
                            addRow={addRow}
                            removeRow={removeRow}
                            reorderRows={reorderRows}
                        />;
    if (contentOnly) return <div className="wbDockPanel">{content}</div>;

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
                        {content}
                    </div>
                )}
            </section>
        </Rnd>
    );
};

export default Widget;
