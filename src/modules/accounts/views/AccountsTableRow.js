import React from 'react'
import { TableCell, TableRow } from '@mui/material'
import Amount from 'layout/Amount'
import { useNavigate } from 'react-router-dom'
import useAccountTotals from '../hooks/useAccountTotals'
import AccountChip from './AccountChip'

const AccountsTableRow = ({ account }) => {
  const { totalDebit, totalCredit, balance } = useAccountTotals(account)

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
      <TableCell>
        <AccountChip property={account.type} />
      </TableCell>
      <TableCell>
        <AccountChip property={account.classification} />
      </TableCell>
      <TableCell>
        <Amount value={totalDebit} />
      </TableCell>
      <TableCell>
        <Amount value={totalCredit} />
      </TableCell>
      <TableCell>
        <Amount value={balance} />
      </TableCell>
    </TableRow>
  )
}

export default AccountsTableRow
