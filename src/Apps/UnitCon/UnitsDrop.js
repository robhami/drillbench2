import React, {Component} from 'react';
import Dropdown from 'react-bootstrap/Dropdown';
import DropdownButton from 'react-bootstrap/DropdownButton';

const UnitsDrop = (props) => {

// units list for unitsType that are in state are passed (e.g. Klbs, T etc)	
	const units = props.units
	const ddClick = props.ddClick
	const title = props.title
	const idPass = props.id
	
	// console.log (props)
	// console.log(title)

	return (
	
	<>
		<DropdownButton
		variant="outline-secondary"
	    title={title}
	    id={idPass}
	    value={title}
		>
			<UnitsList 
			units={units}
			ddClick={ddClick}

			/>

		</DropdownButton>
	</>

	)
}

const UnitsList = (props) => {
		
	const units = props.units
	const ddClick = props.ddClick
	// console.log (ddClick)

	return (
		<>


			{ 
				props.units.map((uom,i) => {

					return (
						<Dropdown.Item
							// id={"dd"+i}
							key={i}
							onClick={ddClick}
						>
							{units[i]}
						</Dropdown.Item>
					)
				})
			}
		</>
	)	
}


export default UnitsDrop