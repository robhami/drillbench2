import React from 'react';
import Container from 'react-bootstrap/Container';
import Card from 'react-bootstrap/Card';

import EngineeringString3D from './EngineeringString3D.js';

const EngineeringStringCard = ({ engModel }) => {
    return (
        <Container className="engineeringStringCard">
            <Card>


                <Card.Body>
                    <EngineeringString3D engModel={engModel} />
                </Card.Body>
            </Card>
        </Container>
    );
};

export default EngineeringStringCard;