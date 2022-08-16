import React from 'react'
import { TableCell, TableRow } from '@mui/material'
import Amount from '../../../layout/Amount'
import { useNavigate } from 'react-router-dom'

const AccountsTableRow = ({ account }) => {
  const navigate = useNavigate()

  const onClick = () => {
    navigate(`/accounts/${account.id}`)
  }

  return (
    <TableRow key={account.id} hover onClick={onClick}>
      <TableCell>{account.name}</TableCell>
      <TableCell>
        <Amount value={account.initialBalance} />
      </TableCell>
      <TableCell>{account.type}</TableCell>
      <TableCell>{account.classification}</TableCell>
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

export default AccountsTableRow
