import { useStoreState } from 'easy-peasy'
import React from 'react'
import Spinner from '../../../layout/Spinner'
import AccountItem from './AccountItem'
import {
  TableContainer,
  TableHead,
  Table,
  TableRow,
  TableCell,
  TableBody,
  Paper,
} from '@mui/material'

const Accounts = () => {
  const { accounts, filteredAccounts, loading } = useStoreState(
    state => state.accounts
  )

  console.log(filteredAccounts)

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
            <TableCell>Debits</TableCell>
            <TableCell>Credits</TableCell>
            <TableCell>Balance</TableCell>
          </TableRow>
        </TableHead>

        <TableBody>
          {displayAccounts.map(account => (
            <AccountItem account={account} key={account.id} />
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  )
}

export default Accounts
