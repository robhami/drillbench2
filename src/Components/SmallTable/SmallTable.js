import React from 'react';
import Table from 'react-bootstrap/Table';
import TableHeads from './TableHeads.js';

const SmallTable=(props)=> {
  console.log(props)
  const tableHeadx = props.tableHeadObj
  console.log(TableHeads)

  return (
    <Table responsive
    // striped bordered hover size="sm"
    >
      <thead>
        <tr>
         <TableHeads tableHeadx={tableHeadx}/> 

        </tr>
      </thead>
      <tbody>
        <tr>
          <td>1</td>
          <td>
            <select id="toolDD" value="tool" onchange="DD(this.selectedIndex, this.id)" required >
                  <option value="pend" disabled selected="true" >Select Tool</option>
              </select>
          </td>
          <td>
            <input className="numInput"/>
          </td>
          <td>
            <input className="numInput"/>
          </td>
          <td>
            <input className="numInput"/>
          </td>
          <td>
            <input className="numInput"/>
          </td>

          
        </tr>
        
      </tbody>
    </Table>
  );
}

export default SmallTable;