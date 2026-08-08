import React from 'react';
import Container from 'react-bootstrap/Container';
import Card from 'react-bootstrap/Card';

import BHAManager from './BHAManager.js';

const BHAManagerCard = (props) => {
    return (
        <Container>
            <Card>
                <Card.Header
                    className="bhaHeader draggableCardHeader"
                    title="Drag to move card"
                >
                    ⋮⋮⋮ BHA Manager
                </Card.Header>

                <Card.Body>
                    <BHAManager {...props} />
                </Card.Body>
            </Card>
        </Container>
    );
};

export default BHAManagerCard;