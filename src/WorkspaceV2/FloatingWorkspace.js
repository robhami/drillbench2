import React from 'react';

import './Workspace.css';
import Widget from './Widget';
import { analysisDepth } from '../engineering/bha/analysisDepth';
import { useActiveSurvey } from '../Apps/Survey/surveyAssociation';
import { importedGeometry } from '../Apps/JarClearance/clearanceData';
import { validateSurveyCoverage } from '../engineering/survey/surveyCoverage';

const WORKSPACE_STORAGE_KEY = 'wellbenchWorkspaceV2';
const modules = [
    ['bhaEntry', 'BHA Data Entry', 'list-columns'],
    ['analysisInputs', 'Parameter Entry', 'sliders'],
    ['engineeringString', 'Engineering String', 'diagram-3'],
    ['jarForces', 'Hookload Calculations', 'arrow-down-up'],
    ['survey', 'Survey', 'bezier2'],
    ['jarClearance', 'Neutral Point Behaviour', 'graph-up'],
    ['jarConfiguration', 'Jar Position Analysis', 'distribute-vertical'],
    ['jarPlacement', 'Impact & Impulse', 'lightning'],
    ['bhaSummary', 'BHA Summary', 'list-check', true],
    ['engineeringResults', 'Engineering Results', 'table', true]
];

const Workspace = ({
    developerPanels = false,
    bha,
    rigLimits,
    updateRigLimits,
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
    const [activeModule, setActiveModule] = React.useState(null);
    const depth = analysisDepth(bha);
    const effectiveAnalysisBitMdFt = depth.valid ? String(depth.bitMdFt) : '';
    const [surfaceReferenceMdFt, setSurfaceReferenceMdFt] = React.useState('0');
    const surveySource = useActiveSurvey(bha);
    const survey = React.useMemo(() => importedGeometry(surveySource), [surveySource]);
    const surveyCoverage = React.useMemo(() => {
        const requiredDepth = analysisDepth(bha);
        return validateSurveyCoverage(survey, {
            startMdFt: String(surfaceReferenceMdFt).trim() !== '' ? Number(surfaceReferenceMdFt) : NaN,
            endMdFt: requiredDepth.valid ? requiredDepth.bitMdFt : NaN,
            calculations: ['string-weight projection', 'off-bottom hookloads', 'static/inverse jar loads', 'buckling screening']
        });
    }, [bha, survey, surfaceReferenceMdFt]);
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
    defaultWidgets.push({ id: 'jarConfiguration1', type: 'jarConfiguration', x: 140, y: 90, width: 820, height: 700, visible: false, minimized: false, z: 7 });
    defaultWidgets.push({ id: 'survey1', type: 'survey', x: 100, y: 70, width: 720, height: 600, visible: false, minimized: false, z: 8 });
    defaultWidgets.push({ id: 'jarClearance1', type: 'jarClearance', x: 100, y: 50, width: 880, height: 740, visible: false, minimized: false, z: 1 });
    defaultWidgets.push({ id: 'jarForces1', type: 'jarForces', x: 120, y: 70, width: 620, height: 620, visible: false, minimized: false, z: 1 });
    // Applied only to fresh/reset layouts; saved records are loaded verbatim below.
    const canvasWidth = Math.max(280, window.innerWidth - (window.innerWidth <= 900 ? 184 : 224));
    const sideBySide = canvasWidth >= 1278;
    defaultWidgets.forEach(widget => {
        widget.visible = ['bhaEntry', 'analysisInputs'].includes(widget.type);
        if (widget.type === 'bhaEntry') Object.assign(widget, { x: 16, y: 16, width: Math.min(760, canvasWidth - 32) });
        if (widget.type === 'analysisInputs') Object.assign(widget, { x: sideBySide ? 792 : 16, y: sideBySide ? 16 : 552, width: Math.min(470, canvasWidth - 32) });
    });

    const [widgets, setWidgets] = React.useState(() => {
        const savedWorkspace =
            localStorage.getItem(WORKSPACE_STORAGE_KEY);

        if (!savedWorkspace) {
            return defaultWidgets;
        }

        try {
            const parsed = JSON.parse(savedWorkspace);
            if (!Array.isArray(parsed)) return defaultWidgets;
            // Keep partial/older layouts launchable without opening absent windows.
            const missing = defaultWidgets.filter(w => !parsed.some(saved => saved.type === w.type))
                .map(w => ({ ...w, visible: false }));
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
        setActiveModule(type);
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
                        ...(['engineeringString', 'jarConfiguration', 'survey', 'jarClearance', 'jarForces'].includes(type) ? {
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
            <aside className="wb2Sidebar" aria-label="Engineering modules">
                <div className="wb2SidebarBrand">WORKSPACE</div>
                {modules.filter(([, , , developer]) => !developer || developerPanels).map(([type, label, icon]) =>
                    <button key={type} type="button" title={label} aria-label={label}
                        aria-pressed={getWidgetState(type) !== 'closed'}
                        className={`${getWidgetState(type)} ${activeModule === type && getWidgetState(type) !== 'closed' ? 'selected' : ''}`}
                        onClick={() => openWidget(type)}>
                        <i className={`bi bi-${icon}`} aria-hidden="true" /><span>{label}</span>
                        {getWidgetState(type) !== 'closed' && <span className="wb2OpenIndicator" aria-hidden="true" />}
                    </button>)}
                <button type="button" className="wb2Reset" onClick={resetWorkspace} title="Reset workspace layout">
                    <i className="bi bi-layout-wtf" aria-hidden="true" /><span>Reset layout</span>
                </button>
            </aside>

            <main
                ref={canvasRef}
                className="wb2Canvas"
            >
                {widgets
                    .filter((widget) => widget.visible && (developerPanels || !['bhaSummary', 'engineeringResults'].includes(widget.type)))
                    .map((widget) => (
                        <Widget
                            key={widget.id}
                            widget={widget}
                            bha={bha}
                            rigLimits={rigLimits}
                            updateRigLimits={updateRigLimits}
                            analysisBitMdFt={effectiveAnalysisBitMdFt}
                            surveyCoverage={surveyCoverage}
                            surfaceReferenceMdFt={surfaceReferenceMdFt}
                            setSurfaceReferenceMdFt={setSurfaceReferenceMdFt}
                            drillingMode={drillingMode}
                            setDrillingMode={setDrillingMode}
                            updateBha={updateBha}
                            updateRow={updateRow}
                            addRow={addRow}
                            removeRow={removeRow}
                            reorderRows={reorderRows}
                            canvasRef={canvasRef}
                            onFocus={id => { setActiveModule(widgets.find(w => w.id === id)?.type); bringToFront(id); }}
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
