import React , { Component } from 'react';
import Container from 'react-bootstrap/Container';
import Card from 'react-bootstrap/Card';
import Table from 'react-bootstrap/Table';
import Nav from 'react-bootstrap/Nav'
// import NavPill2 from './NavPill2.js';
import NavPill from '../../Components/NavPill.js';
import {toolType} from './toolType.js';
import {tableHeadObj} from './tableHeadObj.js';
import SmallTable from '../../Components/SmallTable/SmallTable.js'

// const BHAEntry = (props) => {
class BHAEntry extends Component {



pillClick = (event) => {
	console.log(event) 
	//reset dd units from and to 
		// this.setState({ddHeadUnitsFrom: 'Units From'})	
		// this.setState({ddHeadUnitsTo: 'Units To'})
	// get name of pill clicked 
// 	 	let unitSelect = event.target.id
// 	 	console.log(unitSelect)
// 
// 	 	this.createUnitsObject(unitSelect)
	}
	render() {

		return (
        	<div>
            <Container>
				{/* <Card > */}
					<Card id="bhaCard" className="text-center">
						 <Card.Header>
							<h2>BHA Entry</h2>
							<dt> Select Tool Type: </dt>
							<Nav variant="pills" id="unitsTab" defaultActiveKey="0">		
								{/* get unitsType from imported text array file, add pillClick function, these are passed as props to NavPill component*/}
								<NavPill unitsType={toolType} 
								pillClick={this.pillClick}
								/>
							</Nav>
							
						</Card.Header>
				


					<Card.Body>
						<dt> Select BHA Components: </dt>
							
						<SmallTable tableHeadObj={tableHeadObj}/>			

				</Card.Body>
			</Card>
		</Container>
		</div>


	

        )
}
    

}

export default BHAEntry