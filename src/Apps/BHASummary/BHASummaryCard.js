import React from 'react';
import Container from 'react-bootstrap/Container';
import Card from 'react-bootstrap/Card';

import BHASummary from '../../Components/BHASummary/BHASummary.js';

const BHASummaryCard = ({ bha }) => {
  return (
    <Container>
      <Card className="bhaSummaryCard">
        <Card.Header
          className="bhaHeader draggableCardHeader"
          title="Drag to move card"
        >
          <span className="cardHeaderGrip">⋮⋮⋮</span>
          <span>BHA Summary</span>
        </Card.Header>

        <Card.Body>
          <BHASummary bha={bha} />
        </Card.Body>
      </Card>
    </Container>
  );
};

export default BHASummaryCard;