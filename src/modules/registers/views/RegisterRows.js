import {
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
} from '@mui/material'
import React from 'react'

import RegisterRowsItem from './RegisterRowsItem'

const RegisterRows = ({ rows }) => {
  const sortedRows = rows.sort((a, b) => (a.type > b.type ? -1 : 1))

  return (
    <TableContainer>
      <Table size='small'>
        <TableHead>
          <TableRow>
            <TableCell width='50%' colSpan={2} >
              Accounts
            </TableCell>
            <TableCell width='25%'>Debit</TableCell>
            <TableCell width='25%'>Credit</TableCell>
          </TableRow>
        </TableHead>

        <TableBody>
          {sortedRows.map(row => (
            <RegisterRowsItem key={row.id} row={row} />
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  )
}

export default RegisterRows
