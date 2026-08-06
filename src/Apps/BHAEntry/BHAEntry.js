import React from 'react';
import Container from 'react-bootstrap/Container';
import Card from 'react-bootstrap/Card';

import BHABuilder from '../../Components/BHABuilder/BHABuilder.js';


const BHAEntry = ({
  bha,
  updateRow,
  addRow,
  removeRow,
  reorderRows
}) => {
  return (
    <Container>
      <Card id="bhaCard">
        <Card.Header
          className="bhaHeader draggableCardHeader"
          title="Drag to move card"
        >
         <span className="cardHeaderGrip">⋮⋮⋮</span>
          <span>BHA Entry</span>
        </Card.Header>

        <Card.Body>
          <BHABuilder
            bha={bha}
            updateRow={updateRow}
            addRow={addRow}
            removeRow={removeRow}
            reorderRows={reorderRows}
          />
        </Card.Body>
      </Card>
    </Container>
  );
};

export default BHAEntry;