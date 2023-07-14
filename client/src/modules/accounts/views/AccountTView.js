import { Divider, Grid, List, Typography } from '@mui/material'
import React from 'react'
import Amount from 'layout/Amount'
import useAccountTotals from '../hooks/useAccountTotals'
import useAccountById from '../hooks/useAccountById'
import AccountTViewRow from './AccountTViewRow'

const AccountTView = ({ account }) => {
  const { debits, credits, totalDebit, totalCredit, balance } =
    useAccountTotals(account)

  const { accountBalanceType } = useAccountById(account.id)

  if (debits.length === 0 && credits.length === 0)
    return <Typography variant='body1'>No transactions</Typography>

  return (
    <Grid container>
      <Grid item xs={6}>
        <Typography mb={1} align='center' variant='h6'>
          Debits ({debits.length})
        </Typography>
      </Grid>

      <Grid item xs={6}>
        <Typography mb={1} align='center' variant='h6'>
          Credits ({credits.length})
        </Typography>
      </Grid>

      <Grid item xs={12}>
        <Divider />
      </Grid>

      <Grid item xs={6}>
        <List>
          {debits.map(debit => (
            <AccountTViewRow row={debit} />
          ))}
        </List>
      </Grid>

      <Grid item xs={6}>
        <List>
          {credits.map(credit => (
            <AccountTViewRow row={credit} />
          ))}
        </List>
      </Grid>

      <Grid item xs={12}>
        <Divider />
      </Grid>

      <Grid item xs={6} my={1}>
        <Typography align='center' variant='body1'>
          <Amount value={totalDebit} />
        </Typography>
      </Grid>

      <Grid item xs={6} my={1}>
        <Typography align='center' variant='body1'>
          <Amount value={totalCredit} />
        </Typography>
      </Grid>

      <Grid item xs={12}>
        <Divider />
      </Grid>

      <Grid item xs={6} my={1}>
        <Typography align='center' variant='body1'>
          {accountBalanceType === 'debit' && <Amount value={balance} />}
        </Typography>
      </Grid>

      <Grid item xs={6} my={1}>
        <Typography align='center' variant='body1'>
          {accountBalanceType === 'credit' && <Amount value={balance} />}
        </Typography>
      </Grid>
    </Grid>
  )
}

export default AccountTView
