import React from 'react';
import Table from 'react-bootstrap/Table';
import TableHeads from './TableHeads.js';
import Form from 'react-bootstrap/Form';

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
            <Form.Select className="numInput" size="sm" aria-label="Default select example">
                  <option >Select Tool</option>
              </Form.Select>
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