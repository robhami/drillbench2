import React from 'react';

import EngineeringString3D from './EngineeringString3D.js';

const EngineeringStringCard = ({ engModel }) => {
    return (
        <div className="engineeringStringCard">
            <EngineeringString3D
                engModel={engModel}
            />
        </div>
    );
};

export default EngineeringStringCard;