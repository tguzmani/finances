import { useStoreState } from 'easy-peasy'
import React from 'react'
import Spinner from 'layout/Spinner'
import AccountsTableRow from './AccountsTableRow'
import {
  TableContainer,
  TableHead,
  Table,
  TableRow,
  TableCell,
  TableBody,
  Paper,
} from '@mui/material'

const AccountsTable = () => {
  const { accounts, filteredAccounts, loading } = useStoreState(
    state => state.accounts
  )

  if (loading && accounts.length === 0) return <Spinner />

  const displayAccounts =
    filteredAccounts.length === 0 ? accounts : filteredAccounts

  return (
    <TableContainer className='table-container' component={Paper}>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Name</TableCell>
            <TableCell>Initial Balance</TableCell>
            <TableCell>Type</TableCell>
            <TableCell>Classification</TableCell>
            <TableCell>Debits</TableCell>
            <TableCell>Credits</TableCell>
            <TableCell>Balance</TableCell>
          </TableRow>
        </TableHead>

        <TableBody>
          {displayAccounts.map(account => (
            <AccountsTableRow account={account} key={account.id} />
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  )
}

export default AccountsTable
