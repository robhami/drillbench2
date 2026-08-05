import React , { Component } from 'react';
import Container from 'react-bootstrap/Container';
import Card from 'react-bootstrap/Card';
import Table from 'react-bootstrap/Table';
import Nav from 'react-bootstrap/Nav'
// // import NavPill2 from './NavPill2.js';
import NavPill from '../../Components/NavPill.js';
import {country} from './Country.js';
// import {tableHeadObj} from './tableHeadObj.js';
// import SmallTable from '../../Components/SmallTable/SmallTable.js';
import DDTool from '../../Components/DDTool.js';

// const AppMatrix = (props) => {
class AppMatrix extends Component {

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
						<Card id="appCard" className="text-center">
							 <Card.Header>
								<h2>App Matrix Control</h2>
								<dt> Select Country Matrix: </dt>
								<DDTool unitsType={country} 
									DDClick={this.DDClick}
									/>
								
								
							</Card.Header>
					
	
	
						<Card.Body>
							<dt> Select application: </dt>
							<DDTool unitsType={country} 
									DDClick={this.DDClick}
									/>
										
							
					</Card.Body>
				</Card>
			</Container>
			</div>
  
			);
		}
}
export default AppMatrix