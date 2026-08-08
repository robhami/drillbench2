import React from 'react';

const EngineeringString = ({ engModel }) => {
    const components =
        engModel?.axialLoads?.components || [];

    if (components.length === 0) {
        return (
            <div className="engStringEmpty">
                No BHA components to display.
            </div>
        );
    }

    return (
        <div className="engString">
            {[...components]
                .reverse()
                .map((component) => {
                    const bottomState =
                        component.bottomAxialState;

                    const topState =
                        component.topAxialState;

                    let stateClass = 'neutral';

                    if (
                        topState === 'compression' &&
                        bottomState === 'compression'
                    ) {
                        stateClass = 'compression';
                    } else if (
                        topState === 'tension' &&
                        bottomState === 'tension'
                    ) {
                        stateClass = 'tension';
                    } else {
                        stateClass = 'mixed';
                    }

                    return (
                        <div
                            key={component.rowId}
                            className={`engStringComponent ${stateClass}`}
                        >
                            <div className="engStringLabel">
                                {component.toolName ||
                                    component.category ||
                                    'Component'}
                            </div>

                            <div className="engStringBody">
                                <span>
                                    {Number(component.length || 0).toFixed(1)} ft
                                </span>
                            </div>
                        </div>
                    );
                })}

            <div className="engStringBit">
                BIT
            </div>
        </div>
    );
};

export default EngineeringString;