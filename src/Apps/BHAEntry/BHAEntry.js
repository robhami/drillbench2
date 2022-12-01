import React , { Component } from 'react';
import Container from 'react-bootstrap/Container';
import Card from 'react-bootstrap/Card';
import Table from 'react-bootstrap/Table';
import Nav from 'react-bootstrap/Nav'
// import NavPill2 from './NavPill2.js';
import NavPill from '../../Components/NavPill.js';
import {toolType} from './toolType.js';
import {tableHeadObj} from './tableHeadObj.js';
import SmallTable from '../../Components/SmallTable/SmallTable.js';
import DDTool from '../../Components/DDTool.js';

// const BHAEntry = (props) => {
class BHAEntry extends Component {



DDClick = event => {
	console.log(event.target.value) 
	//reset dd units from and to 
		// this.setState({ddHeadUnitsFrom: 'Units From'})	
		// this.setState({ddHeadUnitsTo: 'Units To'})
	//get name of pill clicked 
	 	let unitSelect = event.target.value
	 	console.log(unitSelect)
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
							<DDTool unitsType={toolType} 
								DDClick={this.DDClick}
								/>
							
							
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