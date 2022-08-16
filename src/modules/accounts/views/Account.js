import { Typography, Chip, Divider, Grid, Box } from '@mui/material'
import { useStoreActions, useStoreState } from 'easy-peasy'
import React from 'react'
import { useParams } from 'react-router-dom'
import Amount from '../../../layout/Amount'
import useRead from '../../../layout/hooks/useRead'
import Spinner from '../../../layout/Spinner'
import AccountTView from './AccountTView'
import AccountSidePanel from './AccountSidePanel'

const Account = () => {
  const { accounts, loading } = useStoreState(state => state.accounts)
  const { readAccounts } = useStoreActions(state => state.accounts)

  useRead(readAccounts)

  const { accountId } = useParams()

  const account = accounts.find(account => account.id === parseInt(accountId))

  if (loading) return <Spinner />

  if (!loading && !account) return <div>Account not found...</div>

  return (
    <Grid container spacing={4}>
      <Grid mt={3} xs={9} item>
        <Typography mb={1} variant='h1'>
          {account?.name}
        </Typography>
        <Box mb={3}>
          <Chip label={account.classification}></Chip> >{' '}
          <Chip label={account.type}></Chip>
        </Box>
        <Divider />
        <Grid container mt={3}>
          {/* Comp AccountBalance */}
          <Grid xs={6} item>
            <Typography mb={2} variant='h2'>
              Balances
            </Typography>
            <Grid container>
              <Grid xs={3} item>
                <Typography variant='body1'>Initial Balance</Typography>
              </Grid>
              <Grid item>
                <Typography variant='body1'>
                  <Amount value={account.initialBalance} />
                </Typography>
              </Grid>
            </Grid>
          </Grid>
          {/* /Comp AccountBalance */}

          <Grid item xs={6}>
            <Typography mb={2} variant='h2'>
              T Account
            </Typography>
            <AccountTView />
          </Grid>
        </Grid>
      </Grid>
      <Grid mt={3} xs={3} item>
        <AccountSidePanel account={account} />
      </Grid>
    </Grid>
  )
}

export default Account
