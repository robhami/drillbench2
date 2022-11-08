import React, { Component } from 'react';
import Container from 'react-bootstrap/Container';
import Card from 'react-bootstrap/Card';
import Table from 'react-bootstrap/Table';

const BHAEntry = (props) => {
// class BHAEntry extends Component {

        return (
        	<div>
            <Container>
				{/* <Card > */}
					<Card className="text-center">
						 <Card.Header>
							<h2>BHA Entry</h2>
								{/* <dt> Select Units Type: </dt> */}
							
						</Card.Header>
				


					<Card.Body>
						<dt> Select BHA Components: </dt>
							<table class="table table-bordered table-condensed" id="BHAentry" cellpadding="0" cellspacing="0">
							  <thead>
							 	
							    <tr id="headers">
							    	<th scope="col" rowspan="2">No</th>
								    <th scope="col" class="select" rowspan="2">Type</th>
									<th scope="col" rowspan="2">Tool</th>
								    <th scope="col">OD</th>
								    <th scope="col">ID</th>
								    <th scope="col">Weight</th>
								    <th scope="col">Length</th>
								    <th scope="col" rowspan="2">Delete</th>
								    <th scope="col" rowspan="2">Move</th>
							    </tr>

							    <tr id="headersUnits">
							    	
								    <th scope="col">
								    	<select  onchange="DD(this.selectedIndex, this.id)" class="units" id="unitsOD">
								    			<option class="units" value="in">in</option>
								    			<option class="units" value="mm">mm</option>
								    	</select>

								    </th>
								    <th scope="col">
								    	<select  onchange="DD(this.selectedIndex, this.id)" class="units" id="unitsID">
								    			<option class="units" value="in">in</option>
								    			<option class="units" value="mm">mm</option>
								    	</select>

								    </th>

								    <th scope="col">
								    	<select  onchange="DD(this.selectedIndex, this.id)" class="units" id="unitsWT">
								    			<option class="units" value="# ft"># ft</option>
								    			<option class="units" value="kg ft">kg ft</option>
								    	</select>
								    </th>
								    <th scope="col">
								    	<select  onchange="DD(this.selectedIndex, this.id)" class="units" id="unitsLEN">
								    			<option class="units" value="ft">ft</option>
								    			<option class="units" value="m">m</option>
								    	</select>
								    </th>
								 
							    </tr>

							  </thead>

							  <tbody id="tabBody">
							  
								  <tr id="dataRow0">
								    <td class="num" id="num" value="1">1</td>
								    <td class="select" id="typeTd" value="xc">
								    	<select id="typeSelect" onchange="DD(this.selectedIndex, this.id)" >
								    			<option value=""selected="true" disabled>Tool Type</option>
								    			<option value="DC">DC</option>
								    			<option value="HWDP">HWDP</option>
								    			<option value="DP">DP</option>
								    			<option value="Stab">Stab</option>
								    			<option value="M_LWD">M_LWD</option>
								    			<option value="Motor_RSS">Motor_RSS</option>
								    			<option value="Sub_XO">Sub_XO</option>
								    	</select>
								    </td>
								    <td class="select" id="tool" value="tool">
										<select id="toolDD" value="tool" onchange="DD(this.selectedIndex, this.id)" required >
								    			<option value="pend" disabled selected="true" >Select Tool</option>
								    	</select>
									</td>
								    
									<td class="numEnt" value="0">
										<input class="form-control-custom" type="number" id="OD" value="0" oninput="input(this.value,this.id, true)"/></td>
									<td class="numEnt" value="0">
										<input class="form-control-custom" type="number" id="ID" value="0" oninput="input(this.value,this.id)"/>
									</td>
									<td class="numEnt" value="0">
										<input class="form-control-custom" type="number" id="WT" value="0" oninput="input(this.value,this.id)"/></td>
									<td class="numEnt" value="0">
										<input class="form-control-custom" type="number" id="LEN" value="0" oninput="input(this.value,this.id)"/></td>
									<td>
										
								   		<button type="button" onClick="myDeleteFunction(this)" id="delButt"><a id="buttText">X</a></button>
								   		
								   	</td>

								   		<td>
										
								   		<button type="button" onClick="moveRowsUp(this)" id="moveButt"><a id="moveButtText">↑</a></button>
								   		<button type="button" onClick="moveRowsDown(this)" id="moveButt"><a id="moveButtText">↓</a></button>
								   		
								   	</td>
								  </tr>
							 
							 </tbody>
							
							</table>
						
						{/* <div class="d-flex p-2" id="buttonBar"> */}
						{/* 	<button type="button" class="btn btn-secondary btn" onClick="addRow(this)">Add tool row</button> */}
						{/* 		<div class="d-flex justify-content-end input-group" id="save-group"> */}
						{/* 	 */}
						{/* 			<div class="input-group-prepend" id="saveBar"> */}
						{/* 				<button type="button" class="btn btn-primary btn" onClick="myLoadFunction()" id="calcButt">Load</button> */}
						{/* 			</div> */}
						{/* 			 */}
						{/* 					<input type="text" list="saves" id="saveInput" onfocus="this.value=''" onchange="this.blur();"  */}
						{/* 					placeholder="Enter save name or select below:" autocomplete="off" method="get"> */}
						{/* 					<datalist id="saves"> */}
						{/* 						 */}
						{/* 					</datalist> */}
						{/* 		 */}
						{/* 			 */}
						{/* 			<div class="input-group-append"> */}
						{/* 				<button type="submit" class="btn btn-success btn" onClick="mySaveFunction()" id="savButt">Save</button> */}
						{/* 				<button type="submit" class="btn btn-danger btn" onClick="delName()" id="delTabButt">Delete</button> */}
						{/* 			</div> */}

									

				</Card.Body>
			</Card>
		</Container>
		</div>
		
        )

    

}

export default BHAEntry