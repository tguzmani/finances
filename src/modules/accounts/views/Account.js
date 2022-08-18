import { Typography, Chip, Divider, Grid, Stack } from '@mui/material'
import { useStoreActions, useStoreState } from 'easy-peasy'
import React from 'react'
import { useParams } from 'react-router-dom'
import Amount from '../../../layout/Amount'
import useRead from '../../../layout/hooks/useRead'
import Spinner from '../../../layout/Spinner'
import AccountTView from './AccountTView'
import AccountSidePanel from './AccountSidePanel'
import useReadAccountById from '../hooks/useReadAccountById'
import useAccountTotals from '../hooks/useAccountTotals'
import AccountChip from './AccountChip'

const Account = () => {
  const { loading } = useStoreState(state => state.accounts)
  const { readAccounts } = useStoreActions(state => state.accounts)

  useRead(readAccounts)

  const { accountId } = useParams()

  const { account } = useReadAccountById(parseInt(accountId))
  const { balance } = useAccountTotals(account)

  if (loading && !account) return <Spinner />

  if (!loading && !account) return <div>Account not found...</div>

  return (
    <Grid container spacing={4}>
      <Grid mt={3} xs={9} item>
        <Typography mb={1} variant='h2'>
          {account?.name}
        </Typography>
        <Stack direction='row' mb={3} spacing={1}>
          <AccountChip property={account.classification} />
          <AccountChip property={account.type} />
        </Stack>
        <Divider />
        <Grid container mt={3}>
          {/* Comp AccountBalance */}
          <Grid xs={6} item>
            <Typography mb={2} variant='h3'>
              Balances
            </Typography>
            <Grid container spacing={1}>
              <Grid xs={3} item>
                <Typography variant='body1'>Initial Balance</Typography>
              </Grid>
              <Grid item xs={9}>
                <Typography variant='body1'>
                  <Amount value={account.initialBalance} />
                </Typography>
              </Grid>

              <Grid xs={3} item>
                <Typography variant='body1'>Current Balance</Typography>
              </Grid>
              <Grid item xs={9}>
                <Typography variant='body1'>
                  <Amount value={balance} />
                </Typography>
              </Grid>
            </Grid>
          </Grid>
          {/* /Comp AccountBalance */}

          <Grid item xs={6}>
            <Typography mb={2} variant='h3'>
              T Account
            </Typography>
            <AccountTView account={account} />
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
