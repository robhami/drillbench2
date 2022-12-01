import React, {Component} from 'react';
import Form from 'react-bootstrap/Form';

const DDTool = (props) => {
	const DDClick = props.DDClick
	const unitsType = props.unitsType

	return (
		<>
			<DDList unitsType={unitsType} DDClick={DDClick} 
			// activeKey="2"
			/>
		</>
		)
}

const DDList = (props) => {

	const DDClick = props.DDClick
	const unitsType = props.unitsType	
	
	
		return(
			<>
				<Form.Select onChange={DDClick}>
				{
					props.unitsType.map((unit,i) => {

						return (

								
									<option 
										key={i}
										id={unitsType[i].id}
										name={unitsType[i].name}
										value={unitsType[i].value}
										// eventKey={i}
										
									>
										{unitsType[i].name}
									</option>
								
							)
					})
				}
				</Form.Select>


			</>
		)

}

export default DDTool