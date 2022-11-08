import React, {Component} from 'react';
import Nav from 'react-bootstrap/Nav';

const NavPill = (props) => {
	const pillClick = props.pillClick
	const unitsType = props.unitsType

	return (
		<>
			<NavList unitsType={unitsType} pillClick={pillClick} activeKey="2"/>
		</>
		)
}

const NavList = (props) => {

	const pillClick = props.pillClick
	const unitsType = props.unitsType	
	// console.log(unitsType)
	
		return(
			<>
				{
					props.unitsType.map((unit,i) => {

						return (

								<Nav.Item key={i}  >
									<Nav.Link 

										id={unitsType[i].id}
										name={unitsType[i].name}
										value={unitsType[i].value}
										eventKey={i}
										onClick={pillClick}
										

										>
										{unitsType[i].name}
									</Nav.Link>
								</Nav.Item>
							)
					})
				}
			</>
		)

}

export default NavPill