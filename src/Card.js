import React from 'react';
import Draggable from 'react-draggable';

const Card = ({ id, app }) => {
  return (
    <div className="dashboardCardWrapper">
      <Draggable
        handle=".card-header"
        cancel="input, textarea, select, button, option"
      >
        <div className={`dashboardCard dashboardCard-${id}`}>
          <div className="dashboardCardContent">
            {app}
          </div>
        </div>
      </Draggable>
    </div>
  );
};

export default Card;