import React from 'react';
import Table from 'react-bootstrap/Table';

const TableHeads=(props)=> {
  console.log(props)
  const tableHeadx=props.tableHeadx
  console.log(tableHeadx)

  return (
    <>
    {
      props.tableHeadx.map((head,i) => {

        return (

          <th 
          key={i}
          id={tableHeadx[i].id}
          name={tableHeadx[i].name}
          value={tableHeadx[i].value}
          >
            {tableHeadx[i].name}
          </th>

          )
       

      })
    }  
    </>

  )}

export default TableHeads;