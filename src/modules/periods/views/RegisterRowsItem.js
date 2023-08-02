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
    <TableRow hover onClick={handleGoToAccount}>
      <TableCell width='25%' sx={{ border: 'none' }}>
        {row.type === 'debit' ? account?.name : ''}
      </TableCell>

      <TableCell width='25%' sx={{ border: 'none' }}>
        {row.type === 'credit' ? account?.name : ''}
      </TableCell>

      <TableCell width='25%' sx={{ border: 'none' }}>
        {row.type === 'debit' && <Amount value={row.amount} />}
      </TableCell>

      <TableCell width='25%' sx={{ border: 'none' }}>
        {row.type === 'credit' && <Amount value={row.amount} />}
      </TableCell>
    </TableRow>
  )
}

export default RegisterRowsItem
