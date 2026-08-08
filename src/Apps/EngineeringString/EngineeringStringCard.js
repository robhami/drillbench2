import React from 'react';
import Container from 'react-bootstrap/Container';
import Card from 'react-bootstrap/Card';

import EngineeringString from './EngineeringString.js';

const EngineeringStringCard = ({ engModel }) => {
    return (
        <Container>
            <Card>
                <Card.Header
                    className="bhaHeader draggableCardHeader"
                    title="Drag to move card"
                >
                    ⋮⋮⋮ Engineering String
                </Card.Header>

                <Card.Body>
                    <EngineeringString engModel={engModel} />
                </Card.Body>
            </Card>
        </Container>
    );
};

export default EngineeringStringCard;