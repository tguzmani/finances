import React from 'react'
import { TableCell, TableRow } from '@mui/material'
import Amount from '../../../layout/Amount'

const AccountItem = ({ account }) => {
  return (
    <TableRow key={account.id}>
      <TableCell>{account.name}</TableCell>
      <TableCell>
        <Amount value={account.initialBalance} />
      </TableCell>
      <TableCell>
        <Amount value={0} />
      </TableCell>
      <TableCell>
        <Amount value={0} />
      </TableCell>
      <TableCell>
        <Amount value={0} />
      </TableCell>
    </TableRow>
  )
}

export default AccountItem
