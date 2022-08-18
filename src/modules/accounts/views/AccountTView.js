import {
  Divider,
  Grid,
  List,
  ListItem,
  ListItemText,
  Typography,
} from '@mui/material'
import React from 'react'
import Amount from '../../../layout/Amount'
import useAccountTotals from '../hooks/useAccountTotals'
import useReadAccountById from '../hooks/useReadAccountById'
import AccountTViewRow from './AccountTViewRow'

const AccountTView = ({ account }) => {
  const { debits, credits, totalDebit, totalCredit, balance } =
    useAccountTotals(account)

  const { accountBalanceType } = useReadAccountById(account.id)

  if (debits.length === 0 && credits.length === 0)
    return <Typography variant='body1'>No transactions</Typography>

  return (
    <Grid container>
      <Grid item xs={6}>
        <Typography mb={1} align='center' variant='h6'>
          Debit
        </Typography>
      </Grid>

      <Grid item xs={6}>
        <Typography mb={1} align='center' variant='h6'>
          Credit
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
        <Typography align='center' variant='h6'>
          <Amount value={totalDebit} />
        </Typography>
      </Grid>

      <Grid item xs={6} my={1}>
        <Typography align='center' variant='h6'>
          <Amount value={totalCredit} />
        </Typography>
      </Grid>

      <Grid item xs={12}>
        <Divider />
      </Grid>

      <Grid item xs={6} my={1}>
        <Typography align='center' variant='h5'>
          {accountBalanceType() === 'debit' && <Amount value={balance} />}
        </Typography>
      </Grid>

      <Grid item xs={6} my={1}>
        <Typography align='center' variant='h5'>
          {accountBalanceType() === 'credit' && <Amount value={balance} />}
        </Typography>
      </Grid>
    </Grid>
  )
}

export default AccountTView
