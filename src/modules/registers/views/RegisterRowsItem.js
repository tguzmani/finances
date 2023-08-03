import { TableCell, TableRow } from '@mui/material'
import React from 'react'
import Amount from 'layout/Amount'
import useAccountById from '../../accounts/hooks/useAccountById'
import { useNavigate } from 'react-router-dom'

const RegisterRowsItem = ({ row }) => {
  const { account } = useAccountById(row?.accountId)
  const navigate = useNavigate()

  const handleGoToAccount = () => navigate(`/accounts/${account.id}`)

  return (
    <TableRow sx={{ '& .MuiTableCell-root': { border: 'none' } }} hover>
      <TableCell
        width='25%'
        onClick={handleGoToAccount}
        sx={{ cursor: 'pointer' }}
      >
        {row.type === 'debit' ? account?.name : ''}
      </TableCell>

      <TableCell
        width='25%'
        onClick={handleGoToAccount}
        sx={{ cursor: 'pointer' }}
      >
        {row.type === 'credit' ? account?.name : ''}
      </TableCell>

      <TableCell width='25%'>
        {row.type === 'debit' && <Amount value={row.amount} />}
      </TableCell>

      <TableCell width='25%'>
        {row.type === 'credit' && <Amount value={row.amount} />}
      </TableCell>
    </TableRow>
  )
}

export default RegisterRowsItem
