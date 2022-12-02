import React, { Component } from 'react';
import InputGroup from'react-bootstrap/InputGroup';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import Dropdown from 'react-bootstrap/Dropdown';
import DropdownButton from 'react-bootstrap/DropdownButton';
import Nav from 'react-bootstrap/Nav'
import Container from 'react-bootstrap/Container';
import Card from 'react-bootstrap/Card';
import NavPill from './NavPill.js';
import {unitsType} from './unitsType.js';
import UnitsDrop from './UnitsDrop.js'

class UnitCon extends Component {

	state = {
		units: [],
		unitsFrom: '',
		unitsTo: '',
		ddHeadUnitsFrom: 'Units From',
		ddHeadUnitsTo: 'Units To',
		valToConv: '',
		result: ''
	}
 
	pillClick = (event) => {
	console.log(event) 
		this.setState({ddHeadUnitsFrom: 'Units From'})	
		this.setState({ddHeadUnitsTo: 'Units To'})
	 	let unitSelect = event.target.id
	 	this.createUnitsObject(unitSelect)
	}

	createUnitsObject = (unitSelect) => {
	 	// console.log(unitSelect)
		 	switch (unitSelect) {

		 	case "mass":

		 	let mass =
					{
					klb: 0.0022046226,
					lb: 2.2046226,
					metric_ton: 0.001,
					kg: 1, 
					dn: 0.9807,
					kdn: 0.009807,
					g: 1000,
					};
				// this.assignConvFac (mass);
				this.createUnitsArray (mass);
		 		break;
	 		
		 	case "length":
		 		let length =
					{
					m: 1, 
					ft: 3.28084,
					km: 0.001,
					inch: 39.37008,
					mile: 0.00062,
					cm: 100,
					mm: 1000,
					yard: 1.09361,
					};
				this.createUnitsArray (length);
		 		break;
		 	
			case "density":
		 		let density =
					{
					ppg: 0.0083,
					SG: 0.001,
					kg_m3: 1, 
					g_cm3: 0.001,
					pcf: 0.06243,				
					};
				this.createUnitsArray (density);
		 		break;

	 		case "flow":
		 		let flow =
					{
					LPM: 1, 
					GPM_US: 0.26417,
					ft3_min: 0.06243,
					m3_min: 0.001,
					in3_min: 61.02376,
					BBL_US_min: 0.00629,
					ml_min: 1000,
					};

				this.createUnitsArray (flow);
		 		break;

	 		case "pressure":
		 		let pressure =
					{
					bar: 1, 
					psi: 14.50377,
					Pa: 100000,
					kPa: 100,
					mPa: 0.1,
					atm: 0.98692,
					kg_cm2: 1.01972,
					kg_m2: 10197.16,
					};

				this.createUnitsArray (pressure);
		 		break;

	 		case "torque":
		 		let torque =
					{
					N_m: 1,
					ft_lb: 0.737562,
					kft_lb: 0.000737562,
					kg_m: 0.1019716,
					kN_m: 0.001,	
					};

				this.createUnitsArray (torque);
		 		break;

	 		case "area":
		 		let area =
					{
					m2: 1,
					cm2: 10000,
					in2: 1550,
					ft2: 1.19599,
					mm2: 1000000,
					};

				this.createUnitsArray (area);
		 		break;
			}
 	}

 	createUnitsArray = (unitsObject) => {
 		// console.log(unitsObject)

 		let unitsArray=Object.keys(unitsObject)
 		console.log(unitsArray)
 		this.setState({units: unitsArray})
 		this.setState({unitsTo: unitsObject})
 		this.setState({unitsFrom: unitsObject})
 	}

 	ddClick = (event) => {	 	
		
		let ddFromTo=event.target.parentElement.parentElement.id

		if(ddFromTo=='') {
			alert ("Please select a Units Type")
		}

		if(ddFromTo=="unitsFrom"){
			this.setState({ddHeadUnitsFrom: event.target.textContent})
			let inputField = event.target.parentElement.parentElement.children[2]
			inputField.disabled=false		
		}
		
		if(ddFromTo=="unitsTo"){
			this.setState({ddHeadUnitsTo: event.target.textContent})		
		}	

	}

	inputValueFunc = (event) => {
		console.log(event.target.value)
		let decimal =/^[0-9]+$/;
		if (event.target.value.match(decimal)){
			this.setState({valToConv: event.target.value})

		} else {
			alert ("Invalid Character Input");
			throw "Invalid character input";
		}
		
	}

	formSubmit = (event) => {

		console.log(event.target.parentElement)
		
		let unitsFromSelect = this.state.ddHeadUnitsFrom
		let unitsToSelect = this.state.ddHeadUnitsTo
		let unitsFromObject = this.state.unitsFrom
		
		let inputValue = this.state.valToConv

		let unitsFromCF	= unitsFromObject[unitsFromSelect]
		let unitsToCF	= unitsFromObject[unitsToSelect]

		console.log(unitsFromCF, " " , unitsToCF)
		console.log(this.state.valToConv)
		let conVal = (inputValue*(unitsToCF/unitsFromCF)).toFixed(7)
		console.log(conVal)
		this.setState({result: conVal})
	}


	resultValueFunc = (props) => {
		
	}

	componentDidMount (unitCon) {
		console.log("mounted")
		this.setState({ddHeadUnitsFrom: 'Units From'})	
		this.setState({ddHeadUnitsTo: 'Units To'})
	 	
	 	this.createUnitsObject("mass")

	}

    render() {
    	// get units from state and create variable
    	const {units} = this.state;
    	const {result} = this.state
    	console.log(result) 

        return (
            <Container>
				<Card >
					<Card className="text-center">
						 <Card.Header>
							<h2>Units Converter</h2>
								<dt> Select Units Type: </dt>
							<Nav variant="pills" id="unitsTab" defaultActiveKey="0">		
								{/* get unitsType from imported text array file, add pillClick function, these are passed as props to NavPill component*/}
								<NavPill unitsType={unitsType} pillClick={this.pillClick}/>
							</Nav>
						</Card.Header>
					</Card>


					<Card.Body>
						<dt> Select Units To Convert: </dt>
						<InputGroup className="mb-3" 
						id="unitsFrom"
						

						>
							<UnitsDrop
							// get units from state and pass as props
								units={units}
							// add click function and pass as props
								ddClick={this.ddClick}	
								id="unitsFrom"
								title={this.state.ddHeadUnitsFrom}
							>
							</UnitsDrop>
							<Form.Control
  								aria-label="Example text with button addon"
  								aria-describedby="basic-addon1"
  								placeholder="Value from"
  								id="userOutput" 
  								disabled 
  								onChange={this.inputValueFunc}
  								
							/>
    					</InputGroup>
						<InputGroup className="mb-3" id="unitsTo">
							<UnitsDrop
								units={units}	
								ddClick={this.ddClick}
								id="unitsTo"
								title={this.state.ddHeadUnitsTo}
							>
							</UnitsDrop>
												
    							<Form.Control
      								aria-label="Example text with button addon"
      								aria-describedby="basic-addon1"
      								placeholder="Result"
      								id="userOutput" 
      								disabled 
      								value={result}
      								/>
    					</InputGroup>

						<Button variant="outline-success"id="button-addon2" onClick={this.formSubmit}>Convert</Button>{' '}			
				</Card.Body>
			</Card>
		</Container>

        )

    }
}
export default UnitCon

	