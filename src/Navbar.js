import React, {Component} from 'react';
import Nav from 'react-bootstrap/Nav';
import 'bootstrap/dist/css/bootstrap.min.css';

class Navbar extends Component {

	render () {
		 return (
     
		  	<Nav
			  activeKey="/home"
			  onSelect={(selectedKey) => alert(`selected ${selectedKey}`)}
			>

				<h1 >drillBenchx</h1>
			  	<Nav.Item>
				    <Nav.Link href="/home">Active</Nav.Link>
			  	</Nav.Item>
				<Nav.Item>
		    		<Nav.Link eventKey="link-1">Link</Nav.Link>
		  		</Nav.Item>
			  	<Nav.Item>
				    <Nav.Link eventKey="link-2">Link</Nav.Link>
			  	</Nav.Item>
			  	<Nav.Item>
				    <Nav.Link eventKey="disabled" disabled>Disabled</Nav.Link>
			  	</Nav.Item>
				
			</Nav>      
    	)  

	}
      
}


export default Navbar;