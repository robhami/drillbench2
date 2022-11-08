import React, { Component } from 'react';
import Container from 'react-bootstrap/Container';
import Card from 'react-bootstrap/Card';
import InputGroup from'react-bootstrap/InputGroup';





const BHAEntry = (props) => {
// class BHAEntry extends Component {


	
    

        return (
            <Container>
				<Card >
					<Card className="text-center">
						 <Card.Header>
							<h2>BHA Entry</h2>
								{/* <dt> Select Units Type: </dt> */}
							
						</Card.Header>
					</Card>


					<Card.Body>
						<dt> Select BHA Components: </dt>
						<InputGroup className="mb-3" 
						id="unitsFrom"
						>


    					</InputGroup>

				</Card.Body>
			</Card>
		</Container>

        )

    

}

export default BHAEntry