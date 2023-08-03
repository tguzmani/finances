import React from 'react'
import { TableCell, TableRow } from '@mui/material'
import Amount from 'layout/Amount'
import { useNavigate } from 'react-router-dom'
import useAccountTotals from '../hooks/useAccountTotals'
import AccountChip from './AccountChip'

const AccountsTableRow = ({ account }) => {
  const { totalDebit, totalCredit, balance, initialBalance } =
    useAccountTotals(account)

  const navigate = useNavigate()

  const onClick = () => {
    navigate(`/accounts/${account.id}`)
  }

  return (
    <TableRow
      key={account.id}
      hover
      sx={{ '& .MuiTableCell-root': { textAlign: 'center' } }}
    >
      <TableCell onClick={onClick} sx={{ cursor: 'pointer' }}>
        {account.name}
      </TableCell>
      <TableCell>
        {account.classification !== 'nominal' && (
          <Amount greyedZeroes value={initialBalance} />
        )}
      </TableCell>
      <TableCell>
        <AccountChip property={account.type} />
      </TableCell>
      <TableCell>
        <AccountChip property={account.classification} />
      </TableCell>
      <TableCell>
        <Amount greyedZeroes value={totalDebit} />
      </TableCell>
      <TableCell>
        <Amount greyedZeroes value={totalCredit} />
      </TableCell>
      <TableCell>
        <Amount greyedZeroes value={balance} />
      </TableCell>
    </TableRow>
  )
}

export default AccountsTableRow
