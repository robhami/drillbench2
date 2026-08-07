import React from 'react';
import Container from 'react-bootstrap/Container';
import Card from 'react-bootstrap/Card';

import EngineeringResults from './EngineeringResults.js';

const EngineeringResultsCard = ({ bha }) => {
  return (
    <Container>
      <Card>
        <Card.Header
          className="bhaHeader draggableCardHeader"
          title="Drag to move card"
        >
          ⋮⋮⋮ Engineering Results
        </Card.Header>

        <Card.Body>
          <EngineeringResults bha={bha} />
        </Card.Body>
      </Card>
    </Container>
  );
};

export default EngineeringResultsCard;