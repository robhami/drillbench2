import React, { Component } from 'react';
import Container from 'react-bootstrap/Container';
import Card from 'react-bootstrap/Card';

import BHABuilder from '../../Components/BHABuilder/BHABuilder.js';

class BHAEntry extends Component {
  render() {
    return (
      <Container>
        <Card id="bhaCard" className="text-center">
          <Card.Header>
            <h2>BHAx Entry</h2>
          </Card.Header>

          <Card.Body>
            <BHABuilder />
          </Card.Body>
        </Card>
      </Container>
    );
  }
}

export default BHAEntry;