import React from 'react';
import WidgetCard from '../../Workspace/WidgetCard';

import EngineeringString3D from './EngineeringString3D';

const EngineeringStringCard = (props) => {
    return (
        <WidgetCard title="Engineering String">
            <EngineeringString3D {...props} />
        </WidgetCard>
    );
};

export default EngineeringStringCard;