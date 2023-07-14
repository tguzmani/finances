import { Typography, Divider, Grid } from '@mui/material'
import { useStoreActions, useStoreState } from 'easy-peasy'
import React from 'react'
import { useParams } from 'react-router-dom'
import useRead from 'layout/hooks/useRead'
import Spinner from 'layout/Spinner'
import AccountTView from './AccountTView'
import AccountSidePanel from './AccountSidePanel'
import useAccountById from '../hooks/useAccountById'
import AccountBalance from './AccountBalance'
import AccountHeader from './AccountHeader'

const Account = () => {
  const { loading } = useStoreState(state => state.accounts)
  const { readAccounts } = useStoreActions(state => state.accounts)
  const { readRegisters } = useStoreActions(state => state.registers)

  useRead(readAccounts, readRegisters)

  const { accountId } = useParams()

  const { account } = useAccountById(parseInt(accountId))

  if (loading && !account) return <Spinner />

  if (!loading && !account) return <div>Account not found...</div>

  return (
    <Grid container spacing={4}>
      <Grid xs={12} item>
        <AccountHeader account={account} />

        <Divider />

        <Grid container mt={3}>
          <Grid xs={6} item>
            <Typography mb={2} variant='h3'>
              Balances
            </Typography>
            <AccountBalance account={account} />
          </Grid>

          <Grid item xs={6}>
            <Typography mb={2} variant='h3'>
              T Account
            </Typography>
            <AccountTView account={account} />
          </Grid>
        </Grid>
      </Grid>
    </Grid>
  )
}

export default Account
